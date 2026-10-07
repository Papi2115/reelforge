/**
 * The project manager behind the IPC channels (PLAN.md#6.2), Electron-free: the folder picker is
 * injected. Main holds at most one open project; history and revert only ever act on it, and
 * "open recent" accepts only folders from the recent list, so the renderer cannot point main at
 * arbitrary paths. Scene code is never executed here.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  autocommit,
  createProject,
  findRecentProject,
  hasRepository,
  history,
  listRecentProjects,
  openProject,
  projectFolderName,
  rememberRecentProject,
  restoreFileFromHistory,
  revertTo,
  err,
  type AutocommitKind,
  type CommitResult,
  type GitOptions,
  type OpenedProject,
  type ProjectError,
  type Result,
} from '@reelforge/project';
import type { CharacterMode, MascotChoice, ShotsPerMinute } from '@reelforge/shared';
import type {
  HistoryResult,
  NewProjectRequest,
  ProjectErrorInfo,
  ProjectOpenFailure,
  ProjectOpenResult,
  ProjectSummary,
  RecentProjectEntry,
  RevertProjectResult,
} from '../shared/project-contract.js';
import type {
  ProjectManifestResult,
  ProjectSnapshotResult,
  RepairableFile,
  RepairFileResult,
} from '../shared/snapshot-contract.js';
import { isOfferedStyle } from '../shared/style-choices.js';
import { checkFileText, repairFile } from './file-repair.js';
import { describeError, type Logger } from './logger.js';
import { buildProjectManifest } from './project-manifest.js';
import { readProjectSnapshot } from './project-snapshot.js';

export type FolderPurpose = 'new-project-parent' | 'open-project';

export interface ProjectServiceOptions {
  /** `<userData>/recent-projects.json` */
  readonly recentFile: string;
  readonly templateDir: string;
  /** Style presets whose `<id>/STYLE.md` bibles new projects get. */
  readonly stylesDir: string;
  /** Shows a folder picker; undefined when the user cancels. */
  readonly pickFolder: (purpose: FolderPurpose) => Promise<string | undefined>;
  /** Style preset of new projects (app settings); the template's when omitted. */
  readonly defaultStyle?: () => string;
  /**
   * Settings → "Experimental worlds (preview)" (PLAN.md#13.6): a new project may then start in
   * an experimental world's style. Off when omitted.
   */
  readonly experimentalWorlds?: () => boolean;
  /**
   * Characters and mascot (PLAN.md#12.20), scenes per minute and faster checks (ADR-027) of new
   * projects (app settings); the template's if omitted. The New project form may override the
   * last two.
   */
  readonly newProjectDefaults?: () => {
    readonly characters: CharacterMode;
    readonly mascot: MascotChoice;
    readonly shotsPerMinute?: ShotsPerMinute | null;
    readonly fasterChecks?: boolean;
  };
  readonly log: Logger;
  readonly git?: GitOptions;
  /** Called with the open project's folder (undefined after close) whenever it changes. */
  readonly onCurrentChanged?: (dir: string | undefined) => void;
  /** Opening failed on a damaged project.json (the start screen offers a restore). */
  readonly onOpenFailed?: (failure: ProjectOpenFailure) => void;
  /** Copies the bundled example project somewhere new and returns its folder (PLAN.md#10.3). */
  readonly installExample?: () => Promise<Result<string>>;
}

/** Open errors caused by the content of project.json (not a missing folder or a newer app). */
function isDamagedProjectJson(error: ProjectError): boolean {
  return error.kind === 'corrupt' || error.kind === 'invalid';
}

const MAX_NAME_SUFFIX = 99;

function errorInfo(error: ProjectError): ProjectErrorInfo {
  return { kind: error.kind, message: error.message };
}

function summary(opened: OpenedProject): ProjectSummary {
  const { title, language, style, fps } = opened.project;
  return { dir: opened.dir, title, language, style, fps };
}

/** `<parent>/<title>`, or `<title> 2`, `<title> 3`, … when that folder already exists. */
export function newProjectDir(parent: string, title: string): string {
  const base = projectFolderName(title);
  for (let suffix = 1; suffix <= MAX_NAME_SUFFIX; suffix += 1) {
    const candidate = path.join(parent, suffix === 1 ? base : `${base} ${String(suffix)}`);
    if (!existsSync(candidate)) return candidate;
  }
  return path.join(parent, base);
}

export class ProjectService {
  private current: OpenedProject | undefined;
  /** Folder of the last open that failed on a damaged project.json (for restoreFailedOpen). */
  private failedOpen: string | undefined;

  constructor(private readonly options: ProjectServiceOptions) {}

  /** Settings → "Experimental worlds (preview)" is on. */
  experimentalWorlds(): boolean {
    return this.options.experimentalWorlds?.() === true;
  }

  async newProject(request: NewProjectRequest): Promise<ProjectOpenResult> {
    // Checked before the picker: a style the app does not offer never creates a folder.
    if (request.style !== undefined && !isOfferedStyle(request.style, this.experimentalWorlds())) {
      return {
        status: 'error',
        error: {
          kind: 'invalid-argument',
          message: `style "${request.style}" is not offered (preview worlds need Settings → Projects → Experimental worlds)`,
        },
      };
    }
    const style = request.style ?? this.options.defaultStyle?.();
    const parent = await this.options.pickFolder('new-project-parent');
    if (parent === undefined) return { status: 'cancelled' };
    // A world's style gets its own defaults over these (createProject, world-defaults.ts).
    const created = await createProject({
      dir: newProjectDir(parent, request.title),
      title: request.title,
      language: request.language,
      ...(style === undefined ? {} : { style }),
      ...this.options.newProjectDefaults?.(),
      ...(request.shotsPerMinute === undefined ? {} : { shotsPerMinute: request.shotsPerMinute }),
      ...(request.fasterChecks === undefined ? {} : { fasterChecks: request.fasterChecks }),
      templateDir: this.options.templateDir,
      stylesDir: this.options.stylesDir,
      ...this.gitOption(),
    });
    return this.opened(created, 'create');
  }

  async openWithPicker(): Promise<ProjectOpenResult> {
    const dir = await this.options.pickFolder('open-project');
    if (dir === undefined) return { status: 'cancelled' };
    return this.open(dir);
  }

  /** A fresh copy of the example project, opened (Welcome → "Open the example project"). */
  async openExample(): Promise<ProjectOpenResult> {
    const install = this.options.installExample;
    if (install === undefined) {
      return {
        status: 'error',
        error: { kind: 'not-found', message: 'this build has no example project' },
      };
    }
    const installed = await install();
    if (!installed.ok) return this.opened(installed, 'create');
    this.options.log.info(`copied the example project to ${installed.value}`);
    return this.open(installed.value);
  }

  async openRecent(dir: string): Promise<ProjectOpenResult> {
    const known = await findRecentProject(this.options.recentFile, dir);
    if (!known.ok) return { status: 'error', error: errorInfo(known.error) };
    if (known.value === undefined) {
      this.options.log.warn(`refused to open ${dir}: not in the recent projects list`);
      return {
        status: 'error',
        error: { kind: 'invalid-argument', message: `${dir} is not a recent project` },
      };
    }
    return this.open(known.value.dir);
  }

  async recent(): Promise<RecentProjectEntry[]> {
    const list = await listRecentProjects(this.options.recentFile);
    if (list.ok) return list.value;
    this.options.log.warn(`recent projects unreadable: ${list.error.message}`);
    return [];
  }

  currentProject(): ProjectSummary | null {
    return this.current === undefined ? null : summary(this.current);
  }

  close(): null {
    if (this.current) this.options.log.info(`closed project ${this.current.dir}`);
    this.current = undefined;
    this.options.onCurrentChanged?.(undefined);
    return null;
  }

  /** File listing + storyboard / words / cues of the open project (PLAN.md#6.3). */
  async snapshot(): Promise<ProjectSnapshotResult> {
    const project = this.current;
    if (!project) return { status: 'error', error: noProject() };
    try {
      return { status: 'ok', snapshot: await readProjectSnapshot(project.dir) };
    } catch (error) {
      this.options.log.warn(`snapshot of ${project.dir} failed: ${describeError(error)}`);
      return {
        status: 'error',
        error: { kind: 'io', message: `cannot read ${project.dir}: ${errorText(error)}` },
      };
    }
  }

  /** Render manifest of the open project for the preview (unbuilt shots as placeholders). */
  async manifest(): Promise<ProjectManifestResult> {
    const project = this.current;
    if (!project) return { status: 'unavailable', reason: noProject().message };
    return buildProjectManifest(project.dir, { previewPlaceholders: true });
  }

  async history(limit: number): Promise<HistoryResult> {
    const project = this.current;
    if (!project) return { status: 'error', error: noProject() };
    const entries = await history(project.dir, { limit, ...this.gitOption() });
    return entries.ok
      ? {
          status: 'ok',
          entries: entries.value.map((entry) => ({ ...entry, files: [...entry.files] })),
        }
      : { status: 'error', error: errorInfo(entries.error) };
  }

  async revert(hash: string): Promise<RevertProjectResult> {
    const project = this.current;
    if (!project) return { status: 'error', error: noProject() };
    const result = await revertTo(project.dir, hash, this.options.git);
    if (!result.ok) {
      this.options.log.warn(`revert to ${hash} failed: ${result.error.message}`);
      return { status: 'error', error: errorInfo(result.error) };
    }
    this.options.log.info(`reverted ${project.dir} to ${hash}: ${result.value.status}`);
    // project.json is tracked: title/language may have changed with the restored tree.
    const reopened = await openProject(project.dir, this.openOptions());
    if (reopened.ok) this.current = reopened.value;
    return result.value.status === 'reverted'
      ? { status: 'reverted', hash: result.value.hash }
      : { status: 'unchanged' };
  }

  /** Fixes a damaged file of the open project (restore from history / reset app state). */
  async repairFile(file: RepairableFile): Promise<RepairFileResult> {
    const project = this.current;
    if (!project) return { status: 'error', error: noProject() };
    const result = await repairFile(project.dir, file, this.gitOption());
    if (result.status === 'error') {
      this.options.log.warn(`repair of ${file} failed: ${result.error.message}`);
      return result;
    }
    this.options.log.info(result.message);
    if (file === 'project.json') {
      const reopened = await openProject(project.dir, this.openOptions());
      if (reopened.ok) this.current = reopened.value;
    }
    return result;
  }

  /** Restores project.json of the folder that just failed to open, then opens it. */
  async restoreFailedOpen(): Promise<ProjectOpenResult> {
    const dir = this.failedOpen;
    if (dir === undefined) {
      return {
        status: 'error',
        error: { kind: 'invalid-argument', message: 'no project failed to open' },
      };
    }
    const restored = await restoreFileFromHistory(dir, 'project.json', {
      isValid: (text) => checkFileText('project.json', text) === undefined,
      ...this.gitOption(),
    });
    if (!restored.ok) {
      this.options.log.warn(`restore of ${dir} project.json failed: ${restored.error.message}`);
      return { status: 'error', error: errorInfo(restored.error) };
    }
    this.options.log.info(`restored project.json of ${dir} from ${restored.value.target}`);
    return this.open(dir);
  }

  /**
   * Hook for later stages (pipeline runner, Claude turns): commits the open project with a
   * structured message (`ReelForge-Step` trailer). No-op result when nothing changed.
   */
  autocommit(
    message: string,
    options: { readonly kind: AutocommitKind; readonly step?: string },
  ): Promise<Result<CommitResult>> {
    const project = this.current;
    if (!project) return Promise.resolve(err({ ...noProject() }));
    return autocommit(project.dir, message, { ...options, ...this.gitOption() });
  }

  private async open(dir: string): Promise<ProjectOpenResult> {
    const result = await openProject(dir, this.openOptions());
    this.failedOpen = undefined;
    if (!result.ok && isDamagedProjectJson(result.error)) {
      const resolved = path.resolve(dir);
      const file = result.error.path ?? path.join(resolved, 'project.json');
      const canRestore = hasRepository(resolved);
      this.failedOpen = resolved;
      this.options.onOpenFailed?.({
        dir: resolved,
        file,
        message: result.error.message,
        canRestore,
      });
      const hint = canRestore ? 'Restore it from the project history or fix it' : 'Fix it';
      return this.opened(
        err({ ...result.error, message: `${result.error.message}: ${file}. ${hint}.` }),
        'open',
      );
    }
    if (result.ok && result.value.removedLeftovers.length > 0) {
      this.options.log.info(
        `removed ${String(result.value.removedLeftovers.length)} leftover(s) of interrupted writes`,
      );
    }
    return this.opened(result, 'open');
  }

  private async opened(
    result: Result<OpenedProject>,
    action: 'create' | 'open',
  ): Promise<ProjectOpenResult> {
    if (!result.ok) {
      this.options.log.warn(
        `${action} project failed: ${result.error.kind}: ${result.error.message}`,
      );
      return { status: 'error', error: errorInfo(result.error) };
    }
    const project = result.value;
    this.current = project;
    this.options.onCurrentChanged?.(project.dir);
    this.options.log.info(`${action === 'create' ? 'created' : 'opened'} project ${project.dir}`);
    const remembered = await rememberRecentProject(this.options.recentFile, {
      dir: project.dir,
      title: project.project.title,
    });
    if (!remembered.ok)
      this.options.log.warn(`recent projects not saved: ${remembered.error.message}`);
    return { status: 'opened', project: summary(project) };
  }

  private gitOption(): { readonly git?: GitOptions } {
    return this.options.git === undefined ? {} : { git: this.options.git };
  }

  private openOptions(): { readonly git?: GitOptions; readonly templateDir: string } {
    return { templateDir: this.options.templateDir, ...this.gitOption() };
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function noProject(): ProjectError & ProjectErrorInfo {
  return { kind: 'invalid-argument', message: 'no project is open' };
}

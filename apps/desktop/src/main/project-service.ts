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
  history,
  listRecentProjects,
  openProject,
  projectFolderName,
  rememberRecentProject,
  revertTo,
  err,
  type AutocommitKind,
  type CommitResult,
  type GitOptions,
  type OpenedProject,
  type ProjectError,
  type Result,
} from '@reelforge/project';
import type {
  HistoryResult,
  NewProjectRequest,
  ProjectErrorInfo,
  ProjectOpenResult,
  ProjectSummary,
  RecentProjectEntry,
  RevertProjectResult,
} from '../shared/project-contract.js';
import type { ProjectManifestResult, ProjectSnapshotResult } from '../shared/snapshot-contract.js';
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
  readonly log: Logger;
  readonly git?: GitOptions;
  /** Called with the open project's folder (undefined after close) whenever it changes. */
  readonly onCurrentChanged?: (dir: string | undefined) => void;
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

  constructor(private readonly options: ProjectServiceOptions) {}

  async newProject(request: NewProjectRequest): Promise<ProjectOpenResult> {
    const parent = await this.options.pickFolder('new-project-parent');
    if (parent === undefined) return { status: 'cancelled' };
    const created = await createProject({
      dir: newProjectDir(parent, request.title),
      title: request.title,
      language: request.language,
      ...(this.options.defaultStyle === undefined ? {} : { style: this.options.defaultStyle() }),
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

  /** Render manifest of the open project for the preview. */
  async manifest(): Promise<ProjectManifestResult> {
    const project = this.current;
    if (!project) return { status: 'unavailable', reason: noProject().message };
    return buildProjectManifest(project.dir);
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
    return this.opened(await openProject(dir, this.openOptions()), 'open');
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

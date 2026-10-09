/**
 * The projects of the Home screen (PLAN.md#13.16). The app has no global project index: the known
 * projects are the recent list plus the production line's films (their folders come from main's
 * own queue files). Cards are cached per folder until one of the watched files changes
 * (project-summary.ts `projectSignature`); pictures are cached by file and modification time.
 * Open / Show folder / Rename only act on folders of that list, never on a path made up by the
 * renderer.
 */
import { listRecentProjects } from '@reelforge/project';
import type { HomeActionResult, HomeProject } from '../../shared/home-contract.js';
import type { ProjectOpenResult } from '../../shared/project-contract.js';
import type { Logger } from '../logger.js';
import { projectKey } from '../stages/stage-service-model.js';
import { renameProject, type RenameCommit } from './project-rename.js';
import { projectSignature, readHomeProject, type ThumbnailReader } from './project-summary.js';

export interface ProjectLibraryOptions {
  /** `<userData>/recent-projects.json` */
  readonly recentFile: string;
  /** Project folders of the production line's films (absent = none). */
  readonly lineDirs?: () => Promise<readonly string[]>;
  /** Makes a card picture (Electron's nativeImage in the app); absent = no pictures. */
  readonly thumbnail?: ThumbnailReader;
  /** Opens a folder main knows (ProjectService.openKnown). */
  readonly openKnown: (dir: string) => Promise<ProjectOpenResult>;
  /** The open project's folder, if any. */
  readonly currentDir: () => string | undefined;
  /** Shows a folder in the system's file browser; resolves to an error text ('' = shown). */
  readonly openPath: (dir: string) => Promise<string>;
  readonly commit: RenameCommit;
  readonly log: Logger;
}

interface KnownProject {
  readonly dir: string;
  readonly title: string;
  readonly openedAt: string | null;
  readonly fromLine: boolean;
}

interface CachedCard {
  readonly signature: string;
  readonly card: HomeProject;
}

/** At most this many pictures stay in memory (a few KB each). */
const MAX_CACHED_PICTURES = 300;

function folderName(dir: string): string {
  return (
    dir
      .split(/[\\/]+/)
      .filter((part) => part !== '')
      .at(-1) ?? dir
  );
}

export class ProjectLibrary {
  private readonly cards = new Map<string, CachedCard>();
  private readonly pictures = new Map<string, string | null>();

  constructor(private readonly options: ProjectLibraryOptions) {}

  /** The known projects: the recent list (newest first), then the line's other films. */
  async known(): Promise<KnownProject[]> {
    const recent = await listRecentProjects(this.options.recentFile);
    if (!recent.ok) this.options.log.warn(`recent projects unreadable: ${recent.error.message}`);
    const line = await this.lineFolders();
    const lineKeys = new Set(line.map(projectKey));
    const seen = new Set<string>();
    const known: KnownProject[] = [];
    for (const entry of recent.ok ? recent.value : []) {
      const key = projectKey(entry.dir);
      if (seen.has(key)) continue;
      seen.add(key);
      known.push({
        dir: entry.dir,
        title: entry.title,
        openedAt: entry.openedAt,
        fromLine: lineKeys.has(key),
      });
    }
    for (const dir of line) {
      const key = projectKey(dir);
      if (seen.has(key)) continue;
      seen.add(key);
      known.push({ dir, title: folderName(dir), openedAt: null, fromLine: true });
    }
    return known;
  }

  /** Every known project as a card. */
  async list(): Promise<HomeProject[]> {
    const known = await this.known();
    const live = new Set(known.map((project) => projectKey(project.dir)));
    for (const key of this.cards.keys()) if (!live.has(key)) this.cards.delete(key);
    return Promise.all(known.map((project) => this.card(project)));
  }

  async open(dir: string): Promise<ProjectOpenResult> {
    const project = await this.find(dir);
    if (project === undefined) return refusedOpen(dir);
    return this.options.openKnown(project.dir);
  }

  async showFolder(dir: string): Promise<HomeActionResult> {
    const project = await this.find(dir);
    if (project === undefined) return refused();
    const problem = await this.options.openPath(project.dir);
    if (problem === '') return { status: 'ok' };
    this.options.log.warn(`cannot show ${project.dir}: ${problem}`);
    return { status: 'error', message: `The folder could not be shown: ${problem}` };
  }

  async rename(dir: string, title: string): Promise<HomeActionResult> {
    const project = await this.find(dir);
    if (project === undefined) return refused();
    const current = this.options.currentDir();
    if (current !== undefined && projectKey(current) === projectKey(project.dir)) {
      return { status: 'error', message: 'Close the project before renaming it.' };
    }
    const result = await renameProject(project.dir, title.trim(), this.options.commit);
    if (result.status === 'ok') this.options.log.info(`renamed ${project.dir}`);
    else this.options.log.warn(`rename of ${project.dir} failed: ${result.message}`);
    return result;
  }

  /** The folder of a known project (as the list holds it); undefined = not in the list. */
  async knownDir(dir: string): Promise<string | undefined> {
    return (await this.find(dir))?.dir;
  }

  private async find(dir: string): Promise<KnownProject | undefined> {
    const key = projectKey(dir);
    const project = (await this.known()).find((candidate) => projectKey(candidate.dir) === key);
    if (project === undefined) this.options.log.warn(`refused ${dir}: not a known project`);
    return project;
  }

  private async lineFolders(): Promise<readonly string[]> {
    if (this.options.lineDirs === undefined) return [];
    try {
      return await this.options.lineDirs();
    } catch (error) {
      this.options.log.warn(`production line films unreadable: ${String(error)}`);
      return [];
    }
  }

  private async card(project: KnownProject): Promise<HomeProject> {
    const key = projectKey(project.dir);
    const signature = await projectSignature(project.dir);
    const cached = this.cards.get(key);
    const card =
      cached?.signature === signature
        ? cached.card
        : await readHomeProject({
            dir: project.dir,
            fallbackTitle: project.title,
            openedAt: project.openedAt,
            fromLine: project.fromLine,
            thumbnail: this.picture,
          });
    this.cards.set(key, { signature, card });
    return { ...card, openedAt: project.openedAt, fromLine: project.fromLine };
  }

  private readonly picture: ThumbnailReader = async (file, mtimeMs) => {
    const read = this.options.thumbnail;
    if (read === undefined) return null;
    const key = `${projectKey(file)}|${String(mtimeMs)}`;
    const cached = this.pictures.get(key);
    if (cached !== undefined) return cached;
    const picture = await read(file, mtimeMs);
    if (this.pictures.size >= MAX_CACHED_PICTURES) this.pictures.clear();
    this.pictures.set(key, picture);
    return picture;
  };
}

function refused(): HomeActionResult {
  return { status: 'error', message: 'This project is not in your list any more.' };
}

function refusedOpen(dir: string): ProjectOpenResult {
  return {
    status: 'error',
    error: { kind: 'invalid-argument', message: `${dir} is not a known project` },
  };
}

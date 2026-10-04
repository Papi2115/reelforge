/**
 * New project from `templates/project/`: project.json (template merged with the user's choices,
 * zod-validated), CLAUDE.md and .gitignore copied verbatim, the style bibles
 * (`styles/<id>/STYLE.md`), the standard folders, `git init -b main` and a first commit. Every
 * file is written atomically.
 */
import { randomInt } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CharacterMode,
  MascotChoice,
  ProjectFile,
  ShotsPerMinute,
  VideoLanguage,
} from '@reelforge/shared';
import { writeAtomic, writeJsonAtomic } from './atomic.js';
import { commitProjectChanges, initRepository } from './git-repo.js';
import type { GitOptions } from './git-runner.js';
import { migrateProjectJson, parseProjectFile, type OpenedProject } from './open.js';
import {
  DEFAULT_STYLES_DIR,
  DEFAULT_TEMPLATE_DIR,
  KEEP_FILES,
  PROJECT_CLAUDE_MD,
  PROJECT_FOLDERS,
  PROJECT_GITIGNORE,
  PROJECT_JSON,
} from './paths.js';
import { describeUnknown, err, errorCode, ok, projectError, tryIo, type Result } from './result.js';
import { copyStyleBibles, findStyleBibles, type StyleBible } from './style-bibles.js';

export interface CreateProjectOptions {
  /** Project folder; created if missing, must be empty if it exists. */
  readonly dir: string;
  readonly title: string;
  readonly language?: VideoLanguage;
  /** Style preset id (default: the template's). */
  readonly style?: string;
  readonly fps?: number;
  /** Characters and mascot (PLAN.md#12.20, the app's new-project defaults); template's if omitted. */
  readonly characters?: CharacterMode;
  readonly mascot?: MascotChoice;
  /**
   * Scenes per minute and faster checks (ADR-027). null / false / omitted = not written to
   * project.json (no constraint, checks as before).
   */
  readonly shotsPerMinute?: ShotsPerMinute | null;
  readonly fasterChecks?: boolean;
  /** Project seed (uint32); random when omitted. */
  readonly seed?: number;
  readonly templateDir?: string;
  /** Style presets with their `<id>/STYLE.md` bibles (default: the repo's `styles/`). */
  readonly stylesDir?: string;
  readonly git?: GitOptions;
}

/** Files copied byte for byte from the template. */
const VERBATIM_FILES = [PROJECT_CLAUDE_MD, PROJECT_GITIGNORE] as const;

async function ensureEmptyFolder(dir: string): Promise<Result<void>> {
  try {
    const entries = await readdir(dir);
    if (entries.length > 0) {
      return err(
        projectError('not-empty', `${dir} already contains files; choose an empty or new folder`, {
          path: dir,
        }),
      );
    }
    return ok(undefined);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      return tryIo(dir, async () => {
        await mkdir(dir, { recursive: true });
      });
    }
    return err(projectError('io', `${dir}: ${describeUnknown(error)}`, { path: dir }));
  }
}

async function templateProject(
  templateDir: string,
  options: CreateProjectOptions,
): Promise<Result<ProjectFile>> {
  const file = path.join(templateDir, PROJECT_JSON);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    return err(
      projectError('io', `project template ${file}: ${describeUnknown(error)}`, { path: file }),
    );
  }
  const migrated = migrateProjectJson(raw);
  if (!migrated.ok) return migrated;
  const base = migrated.value.value;
  if (typeof base !== 'object' || base === null) {
    return err(
      projectError('invalid', `project template ${file} is not an object`, { path: file }),
    );
  }
  const choices = {
    title: options.title.trim(),
    seed: options.seed ?? randomInt(0, 0x1_0000_0000),
    ...(options.language === undefined ? {} : { language: options.language }),
    ...(options.style === undefined ? {} : { style: options.style }),
    ...(options.fps === undefined ? {} : { fps: options.fps }),
    ...(options.characters === undefined ? {} : { characters: options.characters }),
    ...(options.mascot === undefined ? {} : { mascot: options.mascot }),
    ...(options.shotsPerMinute === undefined || options.shotsPerMinute === null
      ? {}
      : { shotsPerMinute: options.shotsPerMinute }),
    ...(options.fasterChecks === true ? { fasterChecks: true } : {}),
  };
  const project = parseProjectFile({ ...base, ...choices });
  if (!project.ok) {
    return err({ ...project.error, kind: 'invalid-argument' });
  }
  return project;
}

async function writeProjectFiles(
  dir: string,
  templateDir: string,
  bibles: readonly StyleBible[],
  project: ProjectFile,
): Promise<Result<void>> {
  return tryIo(dir, async () => {
    for (const name of VERBATIM_FILES) {
      await writeAtomic(path.join(dir, name), await readFile(path.join(templateDir, name)));
    }
    await copyStyleBibles(dir, bibles);
    for (const folder of PROJECT_FOLDERS) await mkdir(path.join(dir, folder), { recursive: true });
    for (const keep of KEEP_FILES) await writeAtomic(path.join(dir, ...keep.split('/')), '');
    await writeJsonAtomic(path.join(dir, PROJECT_JSON), project);
  });
}

export async function createProject(options: CreateProjectOptions): Promise<Result<OpenedProject>> {
  const dir = path.resolve(options.dir);
  const templateDir = options.templateDir ?? DEFAULT_TEMPLATE_DIR;
  const git = options.git ?? {};
  // Validate first: a bad title must not leave a half-created folder behind.
  const project = await templateProject(templateDir, options);
  if (!project.ok) return project;
  const bibles = await findStyleBibles(
    options.stylesDir ?? DEFAULT_STYLES_DIR,
    project.value.style,
  );
  if (!bibles.ok) return bibles;
  const folder = await ensureEmptyFolder(dir);
  if (!folder.ok) return folder;
  const written = await writeProjectFiles(dir, templateDir, bibles.value, project.value);
  if (!written.ok) return written;
  const init = await initRepository(dir, git);
  if (!init.ok) return init;
  const commit = await commitProjectChanges(
    dir,
    `Create project "${project.value.title}"`,
    'create',
    'create',
    git,
  );
  if (!commit.ok) return commit;
  return ok({
    dir,
    project: project.value,
    migratedFrom: null,
    initializedGit: true,
    removedLeftovers: [],
  });
}

/**
 * New project from `templates/project/`: project.json (template merged with the user's choices,
 * zod-validated), CLAUDE.md and .gitignore copied verbatim, the style bibles
 * (`styles/<id>/STYLE.md`), the standard folders, `git init -b main` and a first commit. Every
 * file is written atomically.
 */
import { randomInt } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  findGenrePreset,
  resolveGenrePreset,
  type CharacterMode,
  type GenrePresetField,
  type GenrePresetPatch,
  type MascotChoice,
  type ProjectFile,
  type ShotsPerMinute,
  type VideoLanguage,
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
import { worldProjectDefaults } from './world-defaults.js';

export interface CreateProjectOptions {
  /** Project folder; created if missing, must be empty if it exists. */
  readonly dir: string;
  readonly title: string;
  readonly language?: VideoLanguage;
  /** Style preset id (default: the channel's default style, else the template's). */
  readonly style?: string;
  /**
   * Channel of the project (PLAN.md#13.13): its id goes to project.json#channelId and its default
   * style applies when `style` is omitted. Omitted = no `channelId` (the default channel).
   */
  readonly channel?: {
    readonly id: string;
    readonly defaultStyle: string | null;
    /** The channel's genre preset: used when `genrePreset` is omitted; an unknown id is ignored. */
    readonly genrePreset?: string | null | undefined;
  };
  /**
   * Genre preset (PLAN.md#13.8, ADR-035). Omitted = the channel's; null = none (not even the
   * channel's); an unknown id is refused. Precedence: explicit choices > preset > channel default
   * style > app/template defaults. project.json records the id.
   */
  readonly genrePreset?: string | null;
  /**
   * The fields the user chose in the form (they beat the preset). Omitted = every preset field this
   * call passes (`style`, `shotsPerMinute`, `fasterChecks`); pass it when some of those are only
   * app or channel defaults, which the preset should replace.
   */
  readonly explicitFields?: readonly GenrePresetField[];
  /**
   * Whether the app offers a style (the preset's first offered style wins). Omitted = the styles
   * with a bible in `stylesDir` (built-ins only; worlds need the app's answer).
   */
  readonly isStyleAvailable?: (id: string) => boolean;
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

/** The preset fields this call passes: explicit unless `explicitFields` says otherwise. */
function explicitFields(options: CreateProjectOptions): readonly GenrePresetField[] {
  if (options.explicitFields !== undefined) return options.explicitFields;
  const passed: [GenrePresetField, unknown][] = [
    ['style', options.style],
    ['shotsPerMinute', options.shotsPerMinute],
    ['fasterChecks', options.fasterChecks],
  ];
  return passed.filter(([, value]) => value !== undefined).map(([field]) => field);
}

/** Built-in availability: the styles with a bible (worlds have none until they ship). */
async function bibleStyles(stylesDir: string): Promise<Result<(id: string) => boolean>> {
  const bibles = await findStyleBibles(stylesDir, undefined);
  if (!bibles.ok) return bibles;
  const ids = new Set(bibles.value.map((bible) => bible.id));
  return ok((id: string) => ids.has(id));
}

/**
 * The genre preset's project.json fields (PLAN.md#13.8): the form's preset, else the channel's
 * (an unknown channel preset is ignored, an unknown form preset refused); none = empty patch.
 */
async function genrePresetPatch(options: CreateProjectOptions): Promise<Result<GenrePresetPatch>> {
  const fromForm = options.genrePreset;
  const fromChannel = options.channel?.genrePreset ?? undefined;
  if (fromForm === null) return ok({});
  if (fromForm !== undefined && findGenrePreset(fromForm) === undefined) {
    return err(projectError('invalid-argument', `there is no genre preset "${fromForm}"`));
  }
  const id = fromForm ?? (findGenrePreset(fromChannel) === undefined ? undefined : fromChannel);
  if (id === undefined) return ok({});
  const available =
    options.isStyleAvailable === undefined
      ? await bibleStyles(options.stylesDir ?? DEFAULT_STYLES_DIR)
      : ok(options.isStyleAvailable);
  if (!available.ok) return available;
  const resolution = resolveGenrePreset(id, {
    isStyleAvailable: available.value,
    explicit: explicitFields(options),
  });
  return ok(resolution?.patch ?? {});
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
  const style = options.style ?? options.channel?.defaultStyle ?? undefined;
  const choices = {
    title: options.title.trim(),
    seed: options.seed ?? randomInt(0, 0x1_0000_0000),
    ...(options.language === undefined ? {} : { language: options.language }),
    ...(style === undefined ? {} : { style }),
    ...(options.fps === undefined ? {} : { fps: options.fps }),
    ...(options.characters === undefined ? {} : { characters: options.characters }),
    ...(options.mascot === undefined ? {} : { mascot: options.mascot }),
    ...(options.shotsPerMinute === undefined || options.shotsPerMinute === null
      ? {}
      : { shotsPerMinute: options.shotsPerMinute }),
    ...(options.fasterChecks === true ? { fasterChecks: true } : {}),
    ...(options.channel === undefined ? {} : { channelId: options.channel.id }),
  };
  // The preset's patch leaves out the explicit choices, so it only replaces defaults (ADR-035).
  const preset = await genrePresetPatch(options);
  if (!preset.ok) return preset;
  // A world's style brings its film language (world-defaults.ts); built-in styles: nothing.
  const merged: Record<string, unknown> = { ...base, ...choices, ...preset.value };
  const mergedStyle = merged['style'];
  const world = typeof mergedStyle === 'string' ? worldProjectDefaults(mergedStyle) : undefined;
  const project = parseProjectFile({ ...merged, ...world });
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
  // A world style has no bible until it ships (its prompts carry the world brief).
  const bibles = await findStyleBibles(
    options.stylesDir ?? DEFAULT_STYLES_DIR,
    worldProjectDefaults(project.value.style) === undefined ? project.value.style : undefined,
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

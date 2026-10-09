/**
 * "New shorts from a film" (PLAN.md#13.18): two new projects, a 30 s and a 60 s SHORT, next to
 * the film's other projects. Each keeps the film's style, channel (so its voice), language, genre
 * preset, characters, mascot and look settings, is vertical (`format: 'portrait'`) and records
 * its parent film and settings (`kind`, `parentProject`, `short`). Only reusable assets are copied
 * (copy-assets.ts); the brief names the film, its script and the short's angle (the two shorts take
 * different ones). The film is only read. Each short is a git repo with its own commits.
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  autocommit,
  createProject,
  projectFolderName,
  type CreateProjectOptions,
} from '@reelforge/project';
import {
  BRIEF_FILE_VERSION,
  briefFileSchema,
  channelForProject,
  DEFAULT_SHORT_ANGLES,
  isShort,
  projectFileSchema,
  SHORT_LENGTHS,
  shortEndCardText,
  SHORTS_UNSUPPORTED_MESSAGE,
  supportsShorts,
  type BriefFile,
  type ChannelsFile,
  type ProjectFile,
  type ShortLength,
} from '@reelforge/shared';
import { readProjectText, requireProjectJson, writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import { copyReusableAssets } from './copy-assets.js';

export interface CreateShortsOptions {
  /** Angle per length (what the hook opens on); omitted = the built-in angle of that length. */
  readonly angles?: Partial<Record<ShortLength, string>>;
  /** Word-by-word captions (default off). */
  readonly captions?: boolean;
  /** Template, styles, git and style availability, as createProject takes them. */
  readonly create?: Pick<
    CreateProjectOptions,
    'templateDir' | 'stylesDir' | 'git' | 'isStyleAvailable'
  >;
}

export interface CreateShortsRequest {
  /** The long film's project folder. */
  readonly parentDir: string;
  /** Folder the shorts are created in (usually the channel's projects folder). */
  readonly projectsRoot: string;
  readonly channels: ChannelsFile;
  readonly options?: CreateShortsOptions;
}

export interface CreatedShort {
  readonly lengthS: ShortLength;
  readonly dir: string;
  readonly title: string;
  /** Reusable files copied from the film (project-relative). */
  readonly copied: readonly string[];
}

/** Settings a short keeps from its film (the rest comes from the template and the preset). */
const KEPT_FIELDS = [
  'palette',
  'models',
  'lookMode',
  'ambientVariation',
  'researchMode',
  'researchSources',
  'beatSync',
  'repetitionControl',
  'continuityLinks',
  'antiSlopGuards',
  'characters',
  'mascot',
  'fasterChecks',
] as const satisfies readonly (keyof ProjectFile)[];

/**
 * Off in a short: no tension map turn, no surprise beats or open loops planned from beats.md (a
 * short's script has none), no scenes-per-minute range (the short's own cut rules apply).
 */
const SHORT_OVERRIDES = {
  format: 'portrait',
  tensionMap: 'off',
  patternInterrupts: 'off',
  openLoops: 'off',
  revealMoments: 'off',
} as const satisfies Partial<ProjectFile>;

export function shortTitle(filmTitle: string, lengthS: ShortLength): string {
  return `${filmTitle} — Short ${String(lengthS)}s`;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false; // missing: the folder name is free
  }
}

/** `<root>/<folder of title>`, with ` 2`, ` 3`, … when that folder already exists. */
async function freeFolder(root: string, title: string): Promise<string> {
  const base = projectFolderName(title);
  for (let suffix = 1; ; suffix += 1) {
    const candidate = path.join(root, suffix === 1 ? base : `${base} ${String(suffix)}`);
    if (!(await exists(candidate))) return candidate;
  }
}

function shortBrief(
  film: ProjectFile,
  filmBrief: BriefFile | undefined,
  parentDir: string,
  lengthS: ShortLength,
  angles: Readonly<Record<ShortLength, string>>,
): BriefFile {
  const other = SHORT_LENGTHS.find((length) => length !== lengthS) ?? lengthS;
  const notes = [
    `Teaser of the film "${film.title}" (folder: ${parentDir}; its script: ${path.join(parentDir, FILES.script)}).`,
    `Angle: ${angles[lengthS]}.`,
    `The other short of this film (${String(other)} s) takes the angle: ${angles[other]}.`,
  ].join(' ');
  return {
    version: BRIEF_FILE_VERSION,
    topic: `A ${String(lengthS)}-second vertical short that teases the film "${film.title}" and sends viewers to it.`,
    language: film.language,
    targetMinutes: lengthS / 60,
    ...(filmBrief?.tone === undefined ? {} : { tone: filmBrief.tone }),
    ...(filmBrief?.audience === undefined ? {} : { audience: filmBrief.audience }),
    notes,
  };
}

function keptFields(film: ProjectFile): Partial<ProjectFile> {
  return Object.fromEntries(
    KEPT_FIELDS.filter((field) => film[field] !== undefined).map((field) => [field, film[field]]),
  );
}

async function readFilmBrief(parentDir: string): Promise<BriefFile | undefined> {
  const text = await readProjectText(parentDir, FILES.brief);
  if (!text.ok || text.value === undefined) return undefined;
  try {
    const parsed = briefFileSchema.safeParse(JSON.parse(text.value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined; // an unreadable brief only loses the tone and audience hints
  }
}

async function createOne(
  request: CreateShortsRequest,
  film: ProjectFile,
  filmBrief: BriefFile | undefined,
  lengthS: ShortLength,
  angles: Readonly<Record<ShortLength, string>>,
): Promise<Result<CreatedShort, string>> {
  const parentDir = path.resolve(request.parentDir);
  const title = shortTitle(film.title, lengthS);
  const dir = await freeFolder(request.projectsRoot, title);
  const channelName = channelForProject(request.channels, film).channel.name;
  const git = request.options?.create?.git;
  const created = await createProject({
    ...request.options?.create,
    dir,
    title,
    language: film.language,
    style: film.style,
    // The film's preset (null = none, not even the channel's); its style is the film's.
    genrePreset: film.genrePreset ?? null,
    explicitFields: ['style'],
    seed: (film.seed + lengthS) >>> 0,
    ...(film.channelId === undefined
      ? {}
      : { channel: { id: film.channelId, defaultStyle: null, genrePreset: null } }),
  });
  if (!created.ok) return err(`cannot create "${title}": ${created.error.message}`);
  const base: ProjectFile = { ...created.value.project };
  delete base.shotsPerMinute;
  const project = await writeProjectJson(dir, FILES.project, projectFileSchema, {
    ...base,
    ...keptFields(film),
    ...SHORT_OVERRIDES,
    kind: 'short',
    parentProject: { folder: parentDir, title: film.title.slice(0, 200) },
    short: {
      lengthS,
      captions: request.options?.captions ?? false,
      endCardText: shortEndCardText(channelName).slice(0, 120),
      angle: angles[lengthS].slice(0, 300),
    },
  });
  if (!project.ok) return err(project.error.message);
  const brief = await writeProjectJson(
    dir,
    FILES.brief,
    briefFileSchema,
    shortBrief(film, filmBrief, parentDir, lengthS, angles),
  );
  if (!brief.ok) return err(brief.error.message);
  const copied = await copyReusableAssets(parentDir, dir, film.style);
  if (!copied.ok) return copied;
  const commit = await autocommit(dir, `Short of "${film.title}" (${String(lengthS)} s)`, {
    kind: 'pipeline-step',
    step: 'short-setup',
    ...(git === undefined ? {} : { git }),
  });
  if (!commit.ok) return err(`cannot commit "${title}": ${commit.error.message}`);
  return ok({ lengthS, dir, title, copied: copied.value });
}

/** Creates the 30 s and the 60 s short of the film in `parentDir`. */
export async function createShortsForFilm(
  request: CreateShortsRequest,
): Promise<Result<readonly CreatedShort[], string>> {
  const film = await requireProjectJson(request.parentDir, FILES.project, projectFileSchema);
  if (!film.ok) return err(`cannot read the film: ${film.error.message}`);
  if (isShort(film.value)) return err('a short is made from a film, not from another short');
  if (!supportsShorts(film.value.style)) return err(SHORTS_UNSUPPORTED_MESSAGE);
  const filmBrief = await readFilmBrief(request.parentDir);
  const angles = { ...DEFAULT_SHORT_ANGLES, ...request.options?.angles };
  const shorts: CreatedShort[] = [];
  for (const lengthS of SHORT_LENGTHS) {
    const created = await createOne(request, film.value, filmBrief, lengthS, angles);
    if (!created.ok) return created;
    shorts.push(created.value);
  }
  return ok(shorts);
}

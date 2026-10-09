/**
 * One Home card (PLAN.md#13.16) read from a project folder: project.json (title, channel, style,
 * genre, and the Short fields `kind` / `parentProject` read defensively: they may be absent), the
 * step strip (home-steps.ts), the film's length, the last change and the card picture. Cheap: a
 * few stats and small JSON files; nothing is written and no scene code runs. A `signature` of the
 * watched paths' modification times lets the library reuse a card until something changes.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  pipelineStateSchema,
  projectFileSchema,
  shortSettingsSchema,
  VOICEOVER_EXTENSIONS,
} from '@reelforge/shared';
import { z } from 'zod';
import type { HomeProject, HomeShort } from '../../shared/home-contract.js';
import { describeIssues, readProjectJson, readProjectText } from '../project-files.js';
import { homeSteps, NO_FILES, type StepFiles } from './home-steps.js';

/** Project-relative paths whose times decide whether a cached card is still right. */
export const WATCHED_PATHS = [
  'project.json',
  'brief.json',
  'script.txt',
  'storyboard.json',
  'timing/words.json',
  '.reelforge/pipeline.json',
  'audio',
  'scenes',
  'out',
  'publish',
] as const;

/** The card picture, best first: the uploaded YouTube thumbnail, then the export's frame. */
export const THUMBNAIL_CANDIDATES = [
  'publish/thumbnail.png',
  'publish/thumbnail.jpg',
  'publish/thumbnail.jpeg',
  'out/thumb.png',
] as const;

/** Turns a picture file into a small data URL; null when it cannot be read. */
export type ThumbnailReader = (file: string, mtimeMs: number) => Promise<string | null>;

const rawProjectSchema = z
  .object({
    title: z.string().optional(),
    style: z.string().optional(),
    channelId: z.string().optional(),
    genrePreset: z.string().optional(),
    kind: z.unknown().optional(),
    parentProject: z.unknown().optional(),
    short: z.unknown().optional(),
  })
  .loose();

/** `parentProject`: `{ folder, title }` (Shorts since 3.4), or a bare folder (older drafts). */
const parentProjectSchema = z.union([
  z.string(),
  z.object({ folder: z.string(), title: z.string().optional() }).loose(),
]);
type RawProject = z.infer<typeof rawProjectSchema>;

const timedSchema = z.object({ shots: z.array(z.object({ t1: z.number() }).loose()) }).loose();
const wordsSchema = z.object({ words: z.array(z.object({ tEnd: z.number() }).loose()) }).loose();

async function mtimeOf(file: string): Promise<number | undefined> {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    // Missing (or unreadable) counts as absent: the card shows what exists.
    return undefined;
  }
}

async function namesIn(folder: string): Promise<string[]> {
  try {
    return await readdir(folder);
  } catch {
    // A missing folder has no files.
    return [];
  }
}

/** `<times of WATCHED_PATHS>`: equal signatures = the card did not change. */
export async function projectSignature(dir: string): Promise<string> {
  const times = await Promise.all(
    WATCHED_PATHS.map((relative) => mtimeOf(path.join(dir, relative))),
  );
  return times.map((time) => (time === undefined ? '-' : String(time))).join('|');
}

async function stepFiles(dir: string): Promise<StepFiles> {
  const at = (relative: string): string => path.join(dir, relative);
  const [audio, scenes, out] = await Promise.all([
    namesIn(at('audio')),
    namesIn(at('scenes')),
    namesIn(at('out')),
  ]);
  const has = async (relative: string): Promise<boolean> =>
    (await mtimeOf(at(relative))) !== undefined;
  const [brief, script, words, storyboard] = await Promise.all([
    has('brief.json'),
    has('script.txt'),
    has('timing/words.json'),
    has('storyboard.json'),
  ]);
  return {
    brief,
    script,
    voiceover: VOICEOVER_EXTENSIONS.some((extension) => audio.includes(`vo.original.${extension}`)),
    cleaned: audio.includes('vo.clean.wav'),
    words,
    storyboard,
    scenes: scenes.some((name) => name.endsWith('.js')),
    mix: audio.includes('mix.wav'),
    video: out.some((name) => name.toLowerCase().endsWith('.mp4')),
  };
}

/** Seconds of film: the storyboard's last shot end, else the last timed word; null = unknown. */
async function filmLength(dir: string): Promise<number | null> {
  const storyboard = await readProjectJson(dir, 'storyboard.json', timedSchema);
  if (storyboard.status === 'ok' && storyboard.data.shots.length > 0) {
    return Math.max(...storyboard.data.shots.map((shot) => shot.t1));
  }
  const words = await readProjectJson(dir, 'timing/words.json', wordsSchema);
  const last = words.status === 'ok' ? words.data.words.at(-1) : undefined;
  return last === undefined ? null : last.tEnd;
}

async function lastChange(dir: string): Promise<string | null> {
  const files = [...WATCHED_PATHS, 'cues.json', 'audio/mix.wav'];
  const times = await Promise.all(files.map((relative) => mtimeOf(path.join(dir, relative))));
  const known = times.filter((time): time is number => time !== undefined);
  return known.length === 0 ? null : new Date(Math.max(...known)).toISOString();
}

async function thumbnailOf(dir: string, read: ThumbnailReader | undefined): Promise<string | null> {
  if (read === undefined) return null;
  for (const relative of THUMBNAIL_CANDIDATES) {
    const file = path.join(dir, relative);
    const mtime = await mtimeOf(file);
    if (mtime !== undefined) return read(file, mtime);
  }
  return null;
}

/**
 * A Short's film from `parentProject`: its folder (absolute, or relative to the Short's folder)
 * and title; null when absent or unreadable.
 */
export function parentOf(
  dir: string,
  parentProject: unknown,
): { readonly dir: string; readonly title: string | null } | null {
  const parsed = parentProjectSchema.safeParse(parentProject);
  if (!parsed.success) return null;
  const folder = typeof parsed.data === 'string' ? parsed.data : parsed.data.folder;
  if (folder.trim() === '') return null;
  const title = typeof parsed.data === 'string' ? null : (parsed.data.title ?? null);
  return { dir: path.resolve(dir, folder), title };
}

function shortOf(raw: RawProject | undefined): HomeShort | null {
  const parsed = shortSettingsSchema.safeParse(raw?.short);
  if (!parsed.success) return null;
  const { lengthS, captions, endCardText } = parsed.data;
  return { lengthS, captions, endCardText };
}

interface ReadProject {
  readonly raw: RawProject | undefined;
  /** The folder or its project.json is gone. */
  readonly missing: boolean;
  readonly problem: string | null;
}

async function readProject(dir: string): Promise<ReadProject> {
  const text = await readProjectText(dir, 'project.json');
  if (text.status === 'missing') {
    return { raw: undefined, missing: true, problem: 'The project folder is gone.' };
  }
  if (text.status === 'error') {
    return { raw: undefined, missing: false, problem: text.error.message };
  }
  let json: unknown;
  try {
    json = JSON.parse(text.data);
  } catch (error) {
    return {
      raw: undefined,
      missing: false,
      problem: `The project file is damaged: ${String(error)}`,
    };
  }
  const raw = rawProjectSchema.safeParse(json);
  if (!raw.success) {
    return { raw: undefined, missing: false, problem: 'The project file is damaged.' };
  }
  const valid = projectFileSchema.safeParse(json);
  return {
    raw: raw.data,
    missing: false,
    problem: valid.success ? null : `The project file is damaged: ${describeIssues(valid.error)}`,
  };
}

export interface SummaryInput {
  readonly dir: string;
  /** The title the recent list remembers (used when project.json cannot be read). */
  readonly fallbackTitle: string;
  readonly openedAt: string | null;
  readonly fromLine: boolean;
  readonly thumbnail?: ThumbnailReader;
}

/** The card of `input.dir` (a missing folder gives a card that says so). */
export async function readHomeProject(input: SummaryInput): Promise<HomeProject> {
  const { dir } = input;
  const { raw, missing, problem } = await readProject(dir);
  const pipeline = await readProjectJson(dir, '.reelforge/pipeline.json', pipelineStateSchema);
  const files = raw === undefined ? NO_FILES : await stepFiles(dir);
  const short = raw?.kind === 'short';
  const parent = short ? parentOf(dir, raw.parentProject) : null;
  return {
    dir,
    title: raw?.title ?? input.fallbackTitle,
    exists: !missing,
    problem,
    channelId: raw?.channelId ?? null,
    style: raw?.style ?? null,
    genrePreset: raw?.genrePreset ?? null,
    kind: short ? 'short' : 'film',
    parentDir: parent?.dir ?? null,
    parentTitle: parent?.title ?? null,
    short: short ? shortOf(raw) : null,
    hasScript: files.script,
    steps: homeSteps(pipeline.status === 'ok' ? pipeline.data.stages : {}, files),
    durationS: raw === undefined ? null : await filmLength(dir),
    updatedAt: raw === undefined ? null : await lastChange(dir),
    openedAt: input.openedAt,
    thumbnail: raw === undefined ? null : await thumbnailOf(dir, input.thumbnail),
    fromLine: input.fromLine,
  };
}

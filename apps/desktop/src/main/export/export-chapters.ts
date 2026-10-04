/**
 * `out/chapters.txt` of an export (PLAN.md#9.2): one chapter per storyboard shot, titled with the
 * scene's `meta.title` (read statically from the scene source, never executed) or the first clause
 * of the shot's intent; shots too short for a YouTube chapter (< 10 s) are merged into the chapter
 * before them. With timed words (timing/words.json) a chapter is titled like the publish kit's:
 * the key phrase spoken at its start (`spokenChapterTitle`), the scene title as the fallback.
 * The pipeline's `buildChaptersTxt` applies YouTube's rules (first at 0:00, ≥ 3 chapters, each
 * ≥ 10 s).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildChaptersTxt,
  MAX_TITLE_WORDS,
  MIN_CHAPTER_SECONDS,
  spokenChapterTitle,
  type Chapter,
} from '@reelforge/pipeline';
import { wordsFileSchema, type StoryboardShot, type TimedWord } from '@reelforge/shared';
import { SNAPSHOT_FILES } from '../../shared/snapshot-contract.js';
import { isInsideFolder, readProjectJson } from '../project-files.js';

const MAX_TITLE_CHARS = 60;

/** `title` of `export const meta = { … }` in a scene source (string literal only), else null. */
export function sceneMetaTitle(source: string): string | null {
  const meta = /export\s+const\s+meta\s*=\s*\{([^}]*)\}/.exec(source);
  const body = meta?.[1];
  if (body === undefined) return null;
  const title = /(?:^|[,{\s])title\s*:\s*(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/.exec(body);
  const text = title?.[2]?.replace(/\\(.)/g, '$1').trim();
  return text === undefined || text === '' ? null : text;
}

/** ALL-CAPS on-screen titles read better as "Sentence case" in a description. */
function sentenceCase(text: string): string {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters === '' || letters !== letters.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function clip(text: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= MAX_TITLE_CHARS) return trimmed;
  const cut = trimmed.slice(0, MAX_TITLE_CHARS);
  const space = cut.lastIndexOf(' ');
  return `${(space > 20 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, '')}…`;
}

/** A short human title of a shot: its scene's meta.title, else the intent's first clause. */
export function shotTitle(intent: string, metaTitle: string | null): string {
  if (metaTitle !== null) return clip(sentenceCase(metaTitle));
  const clause = intent.split(/[.;:!?—–]|,\s|\s-\s/)[0] ?? intent;
  return clip(clause.trim() === '' ? intent : clause);
}

export interface TitledShot {
  readonly t0: number;
  readonly title: string;
}

/**
 * One chapter per shot start, merged so every chapter lasts ≥ 10 s: a shot that starts too soon
 * after the current chapter joins it; a too-short last chapter joins the one before.
 */
export function chaptersFromShots(shots: readonly TitledShot[], durationS: number): Chapter[] {
  const chapters: Chapter[] = [];
  for (const [index, shot] of shots.entries()) {
    const t = index === 0 ? 0 : shot.t0;
    const current = chapters.at(-1);
    if (current === undefined) chapters.push({ title: shot.title, t });
    else if (Math.floor(t) - Math.floor(current.t) >= MIN_CHAPTER_SECONDS) {
      chapters.push({ title: shot.title, t });
    }
  }
  const last = chapters.at(-1);
  if (
    chapters.length > 1 &&
    last !== undefined &&
    Math.floor(durationS) - Math.floor(last.t) < MIN_CHAPTER_SECONDS
  ) {
    chapters.pop();
  }
  return chapters;
}

async function metaTitleOf(dir: string, scene: string): Promise<string | null> {
  const file = path.resolve(dir, scene);
  if (!isInsideFolder(path.resolve(dir), file)) return null;
  try {
    return sceneMetaTitle(await readFile(file, 'utf8'));
  } catch {
    return null; // a missing scene keeps the intent as its title
  }
}

/**
 * Chapters retitled with the key phrase spoken at their start (no words: unchanged); a spoken
 * title another chapter already has keeps the chapter's own title.
 */
export function spokenTitles(
  chapters: readonly Chapter[],
  words: readonly TimedWord[],
  durationS: number,
): Chapter[] {
  if (words.length === 0) return [...chapters];
  const used = new Set<string>();
  return chapters.map((chapter, index) => {
    const until = chapters[index + 1]?.t ?? durationS;
    const spoken = spokenChapterTitle(words, chapter.t, until, MAX_TITLE_WORDS);
    const title = spoken !== undefined && !used.has(spoken.toLowerCase()) ? spoken : chapter.title;
    used.add(title.toLowerCase());
    return { ...chapter, title };
  });
}

/** The project's timed words, [] without a valid timing/words.json (legacy titles). */
async function timedWords(dir: string): Promise<readonly TimedWord[]> {
  const words = await readProjectJson(dir, SNAPSHOT_FILES.words, wordsFileSchema);
  return words.status === 'ok' ? words.data.words : [];
}

export type ChaptersText = { readonly text: string } | { readonly problem: string };

/** chapters.txt of the storyboard (or why YouTube would not show chapters for it). */
export async function projectChapters(
  dir: string,
  shots: readonly StoryboardShot[],
  durationS: number,
): Promise<ChaptersText> {
  const titled = await Promise.all(
    shots.map(async (shot) => ({
      t0: shot.t0,
      title: shotTitle(shot.intent, await metaTitleOf(dir, shot.scene)),
    })),
  );
  const chapters = spokenTitles(
    chaptersFromShots(titled, durationS),
    await timedWords(dir),
    durationS,
  );
  const built = buildChaptersTxt(chapters, durationS);
  return built.ok
    ? { text: built.value }
    : { problem: built.error.message.replace(/^chapters: /, '') };
}

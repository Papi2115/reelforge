/**
 * Chapters of the publish kit (PLAN.md#12.17) from the final storyboard: chapter starts are shot
 * starts, chosen by dynamic programming so that YouTube's rules hold (first at 0:00, ≥ 3 chapters,
 * each ≥ 10 s, compared in whole seconds like the description shows them) while the cuts land on
 * the storyboard's act changes (look/roll changes, title cards, non-cut transitions) and the
 * chapters stay near a target length. Short shots are merged into the chapter they fall in.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { MIN_CHAPTER_SECONDS, MIN_CHAPTERS, type Chapter } from '../export/chapters.js';

/** About one chapter per this many seconds (clamped to 3..MAX_TARGET_CHAPTERS chapters). */
const SECONDS_PER_CHAPTER = 60;
const MAX_TARGET_CHAPTERS = 15;
/** Most chapters ever planned (YouTube shows long lists badly). */
const MAX_CHAPTERS = 40;
/** Weight of the squared relative deviation from the target chapter length. */
const LENGTH_WEIGHT = 4;
export const MAX_TITLE_WORDS = 5;

export type PlanShot = Pick<StoryboardShot, 'id' | 't0' | 'treatment' | 'intent'> &
  Partial<Pick<StoryboardShot, 'roll' | 'look' | 'transitionIn'>>;

/** How strongly a chapter wants to start at shot `index` (0 = no act change at all). */
export function boundaryStrength(shots: readonly PlanShot[], index: number): number {
  const shot = shots[index];
  const previous = shots[index - 1];
  if (shot === undefined || previous === undefined) return 0;
  let strength = 0;
  if ((shot.look ?? 'voxel') !== (previous.look ?? 'voxel')) strength += 3;
  if (shot.roll !== undefined && shot.roll !== previous.roll) strength += 1.5;
  if (shot.roll === 'C') strength += 1;
  if (shot.treatment === 'title-card') strength += 2;
  if (shot.transitionIn !== undefined && shot.transitionIn.type !== 'cut') strength += 2;
  if (shot.treatment !== previous.treatment) strength += 0.5;
  return strength;
}

interface Node {
  /** Shot index the chapter starts at; -1 = the end of the video. */
  readonly shot: number;
  /** Whole second the chapter starts at (what the description shows). */
  readonly second: number;
  readonly strength: number;
}

export type ChapterStarts =
  | { readonly ok: true; readonly starts: readonly number[] }
  | { readonly ok: false; readonly problem: string };

/** Shot indexes the chapters start at (the first is 0), or why YouTube would show none. */
export function planChapterStarts(shots: readonly PlanShot[], durationS: number): ChapterStarts {
  const end = Math.floor(durationS);
  const maxChapters = Math.min(MAX_CHAPTERS, Math.floor(end / MIN_CHAPTER_SECONDS));
  if (shots.length < MIN_CHAPTERS || maxChapters < MIN_CHAPTERS) {
    return {
      ok: false,
      problem: `YouTube needs at least ${String(MIN_CHAPTERS)} chapters of ${String(MIN_CHAPTER_SECONDS)} s or more; the video is too short or has too few shots`,
    };
  }
  const target =
    end /
    Math.min(MAX_TARGET_CHAPTERS, Math.max(MIN_CHAPTERS, Math.round(end / SECONDS_PER_CHAPTER)));
  const nodes: Node[] = [
    { shot: 0, second: 0, strength: 0 },
    ...shots.slice(1).map((shot, offset) => ({
      shot: offset + 1,
      second: Math.floor(shot.t0),
      strength: boundaryStrength(shots, offset + 1),
    })),
    { shot: -1, second: end, strength: 0 },
  ];
  const last = nodes.length - 1;
  // best[c][j]: best score of c chapters covering 0..node j; from[c][j]: the node before j.
  const best: number[][] = [];
  const from: number[][] = [];
  for (let count = 0; count <= maxChapters; count += 1) {
    best.push(new Array<number>(nodes.length).fill(-Infinity));
    from.push(new Array<number>(nodes.length).fill(-1));
  }
  const zero = best[0];
  if (zero !== undefined) zero[0] = 0;
  for (let count = 1; count <= maxChapters; count += 1) {
    const row = best[count] ?? [];
    const before = best[count - 1] ?? [];
    const links = from[count] ?? [];
    for (let j = 1; j <= last; j += 1) {
      const node = nodes[j];
      if (node === undefined) continue;
      for (let i = 0; i < j; i += 1) {
        const start = nodes[i];
        const previous = before[i] ?? -Infinity;
        if (start === undefined || previous === -Infinity) continue;
        const length = node.second - start.second;
        if (length < MIN_CHAPTER_SECONDS) continue;
        const score = previous + node.strength - LENGTH_WEIGHT * ((length - target) / target) ** 2;
        if (score > (row[j] ?? -Infinity)) {
          row[j] = score;
          links[j] = i;
        }
      }
    }
  }
  let bestCount = -1;
  for (let count = MIN_CHAPTERS; count <= maxChapters; count += 1) {
    const score = best[count]?.[last] ?? -Infinity;
    if (score > -Infinity && (bestCount < 0 || score > (best[bestCount]?.[last] ?? -Infinity))) {
      bestCount = count;
    }
  }
  if (bestCount < 0) {
    return {
      ok: false,
      problem: `no split at shot boundaries gives ${String(MIN_CHAPTERS)}+ chapters of ${String(MIN_CHAPTER_SECONDS)} s or more (video ${String(end)} s)`,
    };
  }
  const starts: number[] = [];
  let node = from[bestCount]?.[last] ?? -1;
  for (let count = bestCount; count > 0 && node >= 0; count -= 1) {
    starts.unshift(nodes[node]?.shot ?? 0);
    node = from[count - 1]?.[node] ?? -1;
  }
  return { ok: true, starts };
}

const TRAILING_WORDS = new Set(
  'a an the of on in to and or with for at by its their is are was while from as into over under its his her their this that'.split(
    ' ',
  ),
);

/** A human chapter title (≤ 5 words) from a shot intent: its first clause, trimmed. */
export function chapterTitle(intent: string): string {
  const clause = intent.split(/[.;:!?—–]|,\s|\s-\s/)[0] ?? intent;
  const words = clause
    .replace(/["“”„«»()[\]]/g, '')
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, MAX_TITLE_WORDS);
  while (words.length > 1 && TRAILING_WORDS.has((words.at(-1) ?? '').toLowerCase())) words.pop();
  const text = words.join(' ');
  const letters = text.replace(/[^\p{L}]/gu, '');
  const cased = letters !== '' && letters === letters.toUpperCase() ? text.toLowerCase() : text;
  return cased.charAt(0).toUpperCase() + cased.slice(1);
}

/** `M:SS Title` / `H:MM:SS Title` lines of a description, by whole second. */
export function chapterLinesOf(description: string): Map<number, string> {
  const found = new Map<number, string>();
  for (const line of description.split(/\r?\n/)) {
    const match = /^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s+(\S.*)$/.exec(line);
    if (match === null) continue;
    const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    found.set(seconds, (match[4] ?? '').trim());
  }
  return found;
}

/**
 * Titled chapters: a suggested title (Claude's description) for the same second wins, else the
 * intent of the chapter's first shot; a repeated title tries the chapter's later shots, then gets
 * a number.
 */
export function titleChapters(
  shots: readonly PlanShot[],
  starts: readonly number[],
  suggested: ReadonlyMap<number, string>,
): Chapter[] {
  const used = new Set<string>();
  return starts.map((start, index) => {
    const shot = shots[start];
    const t = index === 0 ? 0 : (shot?.t0 ?? 0);
    const until = starts[index + 1] ?? shots.length;
    const candidates = [
      suggested.get(Math.floor(t)),
      ...shots.slice(start, until).map((candidate) => chapterTitle(candidate.intent)),
    ].filter((title): title is string => title !== undefined && title !== '');
    let title = candidates.find((candidate) => !used.has(candidate.toLowerCase())) ?? candidates[0];
    if (title === undefined) title = index === 0 ? 'Intro' : `Part ${String(index + 1)}`;
    if (used.has(title.toLowerCase())) title = `${title} ${String(index + 1)}`;
    used.add(title.toLowerCase());
    return { title, t };
  });
}

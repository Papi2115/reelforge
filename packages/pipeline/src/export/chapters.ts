/**
 * `out/chapters.txt` in the YouTube description format: one `M:SS Title` line per chapter
 * (`H:MM:SS` when the video is an hour or longer). YouTube only shows chapters when the first
 * starts at 0:00, there are at least 3, they ascend and each lasts at least 10 seconds.
 */
import type { ExportError } from './errors.js';
import { err, ok, type Result } from '../result.js';

export const MIN_CHAPTERS = 3;
export const MIN_CHAPTER_SECONDS = 10;

export interface Chapter {
  readonly title: string;
  /** Start time in seconds. */
  readonly t: number;
}

export function formatChapterTime(seconds: number, withHours: boolean): string {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = String(whole % 60).padStart(2, '0');
  if (withHours) return `${String(hours)}:${String(minutes).padStart(2, '0')}:${secs}`;
  return `${String(Math.floor(whole / 60))}:${secs}`;
}

/** Builds chapters.txt text; `durationS` is the video length (checks the last chapter's length). */
export function buildChaptersTxt(
  chapters: readonly Chapter[],
  durationS: number,
): Result<string, ExportError> {
  const invalid = (message: string): Result<string, ExportError> =>
    err({ kind: 'invalid-input', message: `chapters: ${message}` });
  if (chapters.length < MIN_CHAPTERS) {
    return invalid(
      `YouTube needs at least ${String(MIN_CHAPTERS)} chapters, got ${String(chapters.length)}`,
    );
  }
  const first = chapters[0];
  if (first === undefined || Math.floor(first.t) !== 0) {
    return invalid('the first chapter must start at 0:00');
  }
  const withHours = durationS >= 3600;
  const lines: string[] = [];
  for (const [index, chapter] of chapters.entries()) {
    const title = chapter.title.replace(/\s+/g, ' ').trim();
    if (title === '') return invalid(`chapter ${String(index + 1)} has an empty title`);
    const end = chapters[index + 1]?.t ?? durationS;
    if (Math.floor(end) - Math.floor(chapter.t) < MIN_CHAPTER_SECONDS) {
      return invalid(
        `"${title}" lasts under ${String(MIN_CHAPTER_SECONDS)} s (${formatChapterTime(chapter.t, withHours)}); merge it with a neighbour`,
      );
    }
    lines.push(`${formatChapterTime(chapter.t, withHours)} ${title}`);
  }
  return ok(`${lines.join('\n')}\n`);
}

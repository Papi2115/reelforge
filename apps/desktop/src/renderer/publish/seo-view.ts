/**
 * What "Tags and timestamps" shows (PLAN.md#13.17): the 15 tags by word count, the paste-ready
 * tags line and chapters block, where they came from, whether the film changed since, and the
 * outcome of (re)generating. Pure, tested; shared by the export dialog and the project overview.
 */
import {
  publishSeoIssues,
  seoTagList,
  type PublishSeoFile,
  type SeoTagGroup,
} from '@reelforge/shared';
import type { PublishSeoGenerateResult } from '../../shared/publish-contract.js';

export const SEO_GROUP_LABELS: Readonly<Record<SeoTagGroup, string>> = {
  oneWord: 'One word',
  twoWord: 'Two words',
  threeWord: 'Three words',
};

export interface SeoTagRow {
  readonly group: SeoTagGroup;
  readonly label: string;
  readonly tags: readonly string[];
}

export function seoTagRows(seo: PublishSeoFile): SeoTagRow[] {
  return (['oneWord', 'twoWord', 'threeWord'] as const).map((group) => ({
    group,
    label: SEO_GROUP_LABELS[group],
    tags: seo.tags[group],
  }));
}

/** What YouTube Studio's Tags field takes: the 15 tags, comma separated. */
export function seoTagsText(seo: PublishSeoFile): string {
  return seoTagList(seo.tags).join(', ');
}

function clock(seconds: number, withHours: boolean): string {
  const whole = Math.floor(seconds);
  const secs = String(whole % 60).padStart(2, '0');
  if (!withHours) return `${String(Math.floor(whole / 60))}:${secs}`;
  const minutes = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
  return `${String(Math.floor(whole / 3600))}:${minutes}:${secs}`;
}

/** `0:00 Title` lines for the description (H:MM:SS when the film is an hour or longer). */
export function seoChaptersText(seo: PublishSeoFile, durationS: number): string {
  return seo.chapters
    .map((chapter) => `${clock(chapter.t, durationS >= 3600)} ${chapter.title}`)
    .join('\n');
}

/** Where the texts came from, with the time they were written (UTC, minutes). */
export function seoSourceNote(seo: PublishSeoFile): string {
  const when = seo.generatedAt.slice(0, 16).replace('T', ' ');
  return seo.source === 'claude'
    ? `Written by Claude (${seo.model ?? 'sonnet'}) · ${when} UTC`
    : `Made from the script without Claude · ${when} UTC`;
}

/** One line about the chapters (count or why none). */
export function seoChaptersNote(seo: PublishSeoFile): string {
  const count = seo.chapters.length;
  if (count === 0) return 'No timestamps: the video is too short for YouTube chapters.';
  return `${String(count)} timestamp${count === 1 ? '' : 's'} · paste them into the description`;
}

/** Why the saved tags or timestamps no longer fit the film (null: they still do). */
export function seoStaleNote(seo: PublishSeoFile, durationS: number): string | null {
  if (durationS <= 0) return null;
  const issues = publishSeoIssues(seo, { durationS });
  if (issues.length === 0) return null;
  const parts = [
    issues.some((entry) => entry.path.startsWith('tags')) ? 'tags' : null,
    issues.some((entry) => entry.path.startsWith('chapters')) ? 'timestamps' : null,
  ].filter((part): part is string => part !== null);
  return `The video changed since: the ${parts.join(' and ') || 'texts'} no longer fit. Regenerate them.`;
}

/** Status line after Regenerate. */
export function seoGenerateNote(result: PublishSeoGenerateResult): string {
  if (result.status === 'error') return `Not written: ${result.message}`;
  if (result.fallbackReason !== null) {
    return `Made from the script instead (${result.fallbackReason}).`;
  }
  return result.warnings.length === 0
    ? 'Tags and timestamps written by Claude.'
    : `Tags and timestamps written by Claude (${result.warnings.join('; ')}).`;
}

/** Label of the regenerate button. */
export function seoActionLabel(seo: PublishSeoFile | null, busy: boolean): string {
  if (busy) return 'Writing…';
  return seo === null ? 'Write tags and timestamps' : 'Regenerate';
}

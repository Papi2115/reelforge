/**
 * The `publish-seo` prompt (PLAN.md#13.17): its variables (the film's texts capped in size, the
 * channel's niche, the candidate chapter cuts with their narration) and its reply
 * `{"title","tags":{oneWord[5],twoWord[5],threeWord[5]},"chapters":[{t,title}]}`, checked with the
 * shared schema and every rule of `publish/seo.json` (word counts, duplicates, offensive words,
 * YouTube's chapter rules, cuts from the candidate list, no generic titles).
 */
import {
  publishSeoIssues,
  publishSeoSchema,
  seoChapterBounds,
  type PublishSeo,
} from '@reelforge/shared';
import { issue, parseJsonText, report, schemaIssues, type ValidationReport } from './issues.js';

export const SEO_SCRIPT_MAX_CHARS = 40_000;
export const SEO_BEATS_MAX_CHARS = 4_000;
export const SEO_RESEARCH_MAX_CHARS = 6_000;
const NOTES_MAX_CHARS = 1_000;
/** Longer titles are cut in search results (a warning, YouTube allows 100). */
export const SEO_TITLE_SOFT_MAX = 70;

/** The channel as the prompt describes it (every field optional). */
export interface SeoPromptChannel {
  readonly name?: string | undefined;
  readonly genreName?: string | undefined;
  readonly genreDescription?: string | undefined;
  readonly style?: string | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly notes?: string | undefined;
}

export interface SeoPromptCandidate {
  readonly t: number;
  readonly narration: string;
}

export interface PublishSeoPromptInput {
  readonly title: string;
  readonly script: string;
  readonly beats?: string | undefined;
  readonly research?: string | undefined;
  readonly durationS: number;
  readonly channel: SeoPromptChannel | null;
  readonly candidates: readonly SeoPromptCandidate[];
}

function capped(text: string | undefined, max: number): string | undefined {
  const trimmed = (text ?? '').trim();
  if (trimmed === '') return undefined;
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).trimEnd()} …`;
}

/** Seconds as the candidate list writes them (2 decimals at most). */
export function seoSeconds(t: number): string {
  return String(Math.round(t * 100) / 100);
}

function clock(t: number): string {
  const whole = Math.floor(t);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
}

function channelBlock(channel: SeoPromptChannel | null): string {
  const lines: string[] = [];
  const add = (label: string, value: string | undefined): void => {
    const text = (value ?? '').replace(/\s+/g, ' ').trim();
    if (text !== '') lines.push(`- ${label}: ${text}`);
  };
  add('name', channel?.name);
  const genre = [channel?.genreName, channel?.genreDescription].filter(
    (part) => part !== undefined && part !== '',
  );
  add('genre', genre.join(' — '));
  add('visual style', channel?.style);
  add('its usual tags', channel?.tags?.join(', '));
  add('about', capped(channel?.notes, NOTES_MAX_CHARS));
  return lines.length === 0
    ? '- (no channel details: infer the niche from the video and keep the umbrella tags broad)'
    : lines.join('\n');
}

export function publishSeoPromptVars(
  input: PublishSeoPromptInput,
): Record<string, string | number | boolean> {
  const bounds = seoChapterBounds(
    input.durationS,
    input.candidates.map((candidate) => candidate.t),
  );
  const vars: Record<string, string | number | boolean> = {
    title: input.title.trim() || 'Untitled video',
    durationS: input.durationS.toFixed(1),
    channel: channelBlock(input.channel),
    script: capped(input.script, SEO_SCRIPT_MAX_CHARS) ?? '(no script)',
  };
  const beats = capped(input.beats, SEO_BEATS_MAX_CHARS);
  if (beats !== undefined) vars['beats'] = beats;
  const research = capped(input.research, SEO_RESEARCH_MAX_CHARS);
  if (research !== undefined) vars['research'] = research;
  if (bounds.max > 0) {
    vars['chapters'] = true;
    vars['chapterMin'] = bounds.min;
    vars['chapterMax'] = bounds.max;
    vars['candidates'] = input.candidates
      .map((candidate) => {
        const said = candidate.narration.replace(/\s+/g, ' ').trim();
        return `${seoSeconds(candidate.t)} (${clock(candidate.t)}) · ${said === '' ? '(no narration)' : said}`;
      })
      .join('\n');
  }
  return vars;
}

export interface PublishSeoReplyOptions {
  readonly durationS: number;
  /** Candidate cut times given in the prompt (absent: any time). */
  readonly candidates?: readonly number[];
}

export function validatePublishSeoReply(
  text: string,
  options: PublishSeoReplyOptions,
): ValidationReport<PublishSeo> {
  const json = parseJsonText(text);
  if (!json.parsed) return report<PublishSeo>(undefined, json.issues);
  const parsed = publishSeoSchema.safeParse(json.value);
  if (!parsed.success) {
    return report<PublishSeo>(undefined, [...json.issues, ...schemaIssues(parsed.error)]);
  }
  const seo = parsed.data;
  const issues = [
    ...json.issues,
    ...publishSeoIssues(seo, options).map((entry) =>
      issue('error', entry.code, entry.message, entry.path),
    ),
  ];
  if (seo.title !== undefined && seo.title.length > SEO_TITLE_SOFT_MAX) {
    issues.push(
      issue(
        'warning',
        'title-long',
        `the title has ${String(seo.title.length)} characters (search shows about ${String(SEO_TITLE_SOFT_MAX)})`,
        'title',
      ),
    );
  }
  return report(seo, issues);
}

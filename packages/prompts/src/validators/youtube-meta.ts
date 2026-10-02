/**
 * The `youtube-meta` reply (PLAN.md#9.2): `{"titles":[3],"description","tags":[…]}` checked with
 * the shared schema and YouTube's limits. The chapters, when the video has them, must appear in
 * the description line by line (YouTube builds chapters from the description); missing ones are a
 * warning: `withChapters` appends them.
 */
import {
  tagsLength,
  YOUTUBE_TAGS_TOTAL_MAX,
  youtubeMetaSchema,
  type YoutubeMeta,
} from '@reelforge/shared';
import {
  issue,
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';

export interface YoutubeMetaReplyOptions {
  /** chapters.txt of the video (null: none). */
  readonly chapters: string | null;
}

function chapterIssues(description: string, chapters: string | null): ValidationIssue[] {
  if (chapters === null) return [];
  const missing = chapters
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !description.includes(line));
  return missing.length === 0
    ? []
    : [
        issue(
          'warning',
          'chapters-missing',
          `the description lacks ${String(missing.length)} chapter line(s), e.g. "${missing[0] ?? ''}"`,
          'description',
        ),
      ];
}

export function validateYoutubeMetaReply(
  text: string,
  options: YoutubeMetaReplyOptions,
): ValidationReport<YoutubeMeta> {
  const json = parseJsonText(text);
  if (!json.parsed) return report<YoutubeMeta>(undefined, json.issues);
  const parsed = youtubeMetaSchema.safeParse(json.value);
  if (!parsed.success) {
    return report<YoutubeMeta>(undefined, [...json.issues, ...schemaIssues(parsed.error)]);
  }
  const meta = parsed.data;
  const issues: ValidationIssue[] = [...json.issues];
  if (new Set(meta.titles.map((title) => title.toLowerCase())).size < meta.titles.length) {
    issues.push(issue('error', 'same-titles', 'the title options must differ', 'titles'));
  }
  if (tagsLength(meta.tags) > YOUTUBE_TAGS_TOTAL_MAX) {
    issues.push(
      issue(
        'error',
        'tags-too-long',
        `tags have ${String(tagsLength(meta.tags))} characters together (YouTube allows ${String(YOUTUBE_TAGS_TOTAL_MAX)})`,
        'tags',
      ),
    );
  }
  issues.push(...chapterIssues(meta.description, options.chapters));
  return report(meta, issues);
}

/** The description with the chapters appended when it does not contain every chapter line. */
export function withChapters(description: string, chapters: string | null): string {
  if (chapters === null || chapterIssues(description, chapters).length === 0) return description;
  return `${description.trimEnd()}\n\n${chapters.trim()}`;
}

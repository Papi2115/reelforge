/**
 * `out/metadata.json` (PLAN.md#9.2): suggested YouTube title options, description (with the
 * chapters) and tags, from a Claude turn (`youtube-meta` prompt) or the deterministic template
 * when Claude is unavailable. Limits follow YouTube: title ≤ 100, description ≤ 5000 characters,
 * all tags together ≤ 500 characters.
 */
import { z } from 'zod';

export const YOUTUBE_META_VERSION = 1;
export const YOUTUBE_TITLE_MAX = 100;
export const YOUTUBE_DESCRIPTION_MAX = 5000;
export const YOUTUBE_TAGS_TOTAL_MAX = 500;
export const YOUTUBE_TITLE_OPTIONS = 3;

/** The suggestion itself (also the shape of Claude's JSON reply). */
export const youtubeMetaSchema = z.strictObject({
  titles: z.array(z.string().trim().min(1).max(YOUTUBE_TITLE_MAX)).length(YOUTUBE_TITLE_OPTIONS),
  description: z.string().trim().min(1).max(YOUTUBE_DESCRIPTION_MAX),
  tags: z.array(z.string().trim().min(1).max(100)).min(1).max(40),
});
export type YoutubeMeta = z.infer<typeof youtubeMetaSchema>;

export const youtubeMetaFileSchema = z.strictObject({
  version: z.literal(YOUTUBE_META_VERSION),
  source: z.enum(['claude', 'template']),
  /** ISO time. */
  generatedAt: z.string(),
  ...youtubeMetaSchema.shape,
});
export type YoutubeMetaFile = z.infer<typeof youtubeMetaFileSchema>;

/** YouTube counts the tags' characters together (separators included). */
export function tagsLength(tags: readonly string[]): number {
  return tags.join(',').length;
}

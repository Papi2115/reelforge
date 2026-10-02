/**
 * IPC payloads of the project manager (PLAN.md#6.2). Requests are strict (unknown keys rejected).
 * Failures are values (`status: 'error'`), so the renderer can show the typed error kind and
 * message instead of a rejected promise.
 */
import { videoLanguageSchema } from '@reelforge/shared';
import { z } from 'zod';

export const projectSummarySchema = z.object({
  dir: z.string(),
  title: z.string(),
  language: videoLanguageSchema,
  style: z.string(),
  fps: z.number(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

/** Mirrors `ProjectError` of `@reelforge/project` (kind + message only). */
export const projectErrorSchema = z.object({
  kind: z.string(),
  message: z.string(),
});
export type ProjectErrorInfo = z.infer<typeof projectErrorSchema>;

const errorResult = z.object({ status: z.literal('error'), error: projectErrorSchema });

export const projectOpenResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('opened'), project: projectSummarySchema }),
  /** The user closed the folder picker. */
  z.object({ status: z.literal('cancelled') }),
  errorResult,
]);
export type ProjectOpenResult = z.infer<typeof projectOpenResultSchema>;

export const newProjectRequestSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  language: videoLanguageSchema,
});
export type NewProjectRequest = z.infer<typeof newProjectRequestSchema>;

export const openRecentRequestSchema = z.strictObject({ dir: z.string().min(1).max(4096) });

export const recentProjectEntrySchema = z.object({
  dir: z.string(),
  title: z.string(),
  openedAt: z.string(),
  exists: z.boolean(),
});
export type RecentProjectEntry = z.infer<typeof recentProjectEntrySchema>;

export const historyEntrySchema = z.object({
  hash: z.string(),
  shortHash: z.string(),
  time: z.string(),
  subject: z.string(),
  /** `create` · `pipeline-step` · `claude-turn` · `manual` · `revert` · `external`. */
  kind: z.string(),
  step: z.string().nullable(),
  revertOf: z.string().nullable(),
  files: z.array(z.object({ status: z.string(), path: z.string() })),
  counts: z.object({ added: z.number(), modified: z.number(), deleted: z.number() }),
});
export type HistoryEntryInfo = z.infer<typeof historyEntrySchema>;

export const historyRequestSchema = z.strictObject({ limit: z.int().min(1).max(500) });

export const historyResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), entries: z.array(historyEntrySchema) }),
  errorResult,
]);
export type HistoryResult = z.infer<typeof historyResultSchema>;

/** Full hashes only: the renderer reverts to entries it got from `history`. */
export const revertRequestSchema = z.strictObject({ hash: z.string().regex(/^[0-9a-f]{40}$/) });

export const revertResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('reverted'), hash: z.string() }),
  /** The project already had that content. */
  z.object({ status: z.literal('unchanged') }),
  errorResult,
]);
export type RevertProjectResult = z.infer<typeof revertResultSchema>;

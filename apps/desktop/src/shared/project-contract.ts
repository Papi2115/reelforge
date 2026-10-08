/**
 * IPC payloads of the project manager (PLAN.md#6.2). Requests are strict (unknown keys rejected).
 * Failures are values (`status: 'error'`), so the renderer can show the typed error kind and
 * message instead of a rejected promise.
 */
import {
  channelIdSchema,
  genrePresetIdSchema,
  shotsPerMinuteSchema,
  stylePresetIdSchema,
  videoLanguageSchema,
  type GenrePresetField,
} from '@reelforge/shared';
import { z } from 'zod';

/** The New project form's fields a genre preset also sets (PLAN.md#13.8). */
export const NEW_PROJECT_FORM_FIELDS = [
  'style',
  'shotsPerMinute',
  'fasterChecks',
] as const satisfies readonly GenrePresetField[];
export type NewProjectFormField = (typeof NEW_PROJECT_FORM_FIELDS)[number];

export const projectSummarySchema = z.object({
  dir: z.string(),
  title: z.string(),
  language: videoLanguageSchema,
  style: z.string(),
  fps: z.number(),
  /** project.json#channelId (PLAN.md#13.13); absent = the default channel. */
  channelId: z.string().optional(),
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

/**
 * Opening a project failed on a damaged project.json (PLAN.md#10.2): pushed to the start screen,
 * which offers "Restore from history" when the folder has git history.
 */
export const projectOpenFailureSchema = z.object({
  dir: z.string(),
  /** The damaged file (absolute). */
  file: z.string(),
  message: z.string(),
  canRestore: z.boolean(),
});
export type ProjectOpenFailure = z.infer<typeof projectOpenFailureSchema>;

export const newProjectRequestSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  language: videoLanguageSchema,
  /** Scenes per minute (ADR-027): null = no range; omitted = the app's default. */
  shotsPerMinute: shotsPerMinuteSchema.nullable().optional(),
  /** Faster checks (ADR-027); omitted = the app's default. */
  fasterChecks: z.boolean().optional(),
  /**
   * Style of the new project (PLAN.md#13.6): one main offers (style-choices.ts; a preview world
   * only with Settings → Experimental worlds); omitted = the app's default style.
   */
  style: stylePresetIdSchema.optional(),
  /**
   * Channel of the new project (PLAN.md#13.13); its default style applies when `style` is
   * omitted. Omitted = the default channel.
   */
  channelId: channelIdSchema.optional(),
  /**
   * Genre preset (PLAN.md#13.8, ADR-035): null = none (not even the channel's); omitted = the
   * channel's. An id the app does not know is refused.
   */
  genrePreset: genrePresetIdSchema.nullable().optional(),
  /**
   * The fields above the user actually chose in the form (they beat the genre preset); the others
   * are only shown defaults the preset may replace. Omitted = every one of them the request has.
   */
  explicitFields: z
    .array(z.enum(NEW_PROJECT_FORM_FIELDS))
    .max(NEW_PROJECT_FORM_FIELDS.length)
    .optional(),
});
export type NewProjectRequest = z.infer<typeof newProjectRequestSchema>;

export const openRecentRequestSchema = z.strictObject({ dir: z.string().min(1).max(4096) });

export const recentProjectEntrySchema = z.object({
  dir: z.string(),
  title: z.string(),
  openedAt: z.string(),
  exists: z.boolean(),
  /** The project's channel when it was last opened; absent = the default channel. */
  channelId: z.string().optional(),
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

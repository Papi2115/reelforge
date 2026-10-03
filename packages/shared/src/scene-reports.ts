/**
 * Reports of the scene stage (PLAN.md#7.4-7.7), under `<project>/.reelforge/` (not tracked by
 * git): the per-shot build/QA result (`scenes-report.json`, ✓ / ⚠ / ✗ in the UI) and the sync
 * report (`sync-report.json`): every visual/sound event of a shot against its spoken word (±150 ms).
 */
import { z } from 'zod';

export const SCENES_REPORT_VERSION = 1;
export const SYNC_REPORT_VERSION = 1;

/** ✓ clean · ⚠ built with remaining findings · ✗ lint/runtime error persisted (or no scene). */
export const shotBuildStatusSchema = z.enum(['ok', 'warning', 'failed']);
export type ShotBuildStatus = z.infer<typeof shotBuildStatusSchema>;

export const SHOT_STATUS_SYMBOLS: Readonly<Record<ShotBuildStatus, string>> = {
  ok: '✓',
  warning: '⚠',
  failed: '✗',
};

/** Where a QA finding comes from (code checks first, the Haiku critic last). */
export const qaFindingSourceSchema = z.enum([
  'scene',
  'lint',
  'runtime',
  'console',
  'blank',
  'cards',
  'sync',
  'legibility',
  'critic',
  'missing-prop',
  'claude',
]);
export type QaFindingSource = z.infer<typeof qaFindingSourceSchema>;

export const qaFindingSchema = z.object({
  source: qaFindingSourceSchema,
  /** `error`: fix it (a fix turn is run); `warning`: reported, never fixed automatically. */
  severity: z.enum(['error', 'warning']),
  /** Lint/runtime errors and missing scenes: the shot cannot render at all. */
  fatal: z.boolean(),
  message: z.string().min(1),
  /** Local shot time (s) the finding is about, when known. */
  t: z.number().optional(),
});
export type QaFinding = z.infer<typeof qaFindingSchema>;

export const criticVerdictRecordSchema = z.object({
  verdict: z.enum(['blank', 'clipped', 'overlap', 'off-intent', 'ok']),
  note: z.string(),
});
export type CriticVerdictRecord = z.infer<typeof criticVerdictRecordSchema>;

export const shotBuildRecordSchema = z.object({
  shotId: z.string().min(1),
  /** Project-relative scene path. */
  scene: z.string().min(1),
  status: shotBuildStatusSchema,
  /** Findings left after the last QA round (empty = ✓). */
  findings: z.array(qaFindingSchema),
  /** Fix turns run for this shot (≤ 2 per build or review). */
  fixIterations: z.int().nonnegative(),
  /** Props the scene needed but the kit lacks (`MISSING:` reply line / unknown kit calls). */
  missingProps: z.array(z.string().min(1)),
  /** Project-local props built for this shot (`kit-ext/props/<name>.js`, PLAN.md#7.4). */
  builtProps: z.array(z.string().min(1)).optional(),
  /** Last critic verdicts (empty when the critic did not run). */
  critic: z.array(criticVerdictRecordSchema),
  /** Project-relative contact sheet of the last QA round, when one was rendered. */
  contactSheet: z.string().optional(),
  /** Informational lines (invalid critic reply, kit extension decision, …). */
  notes: z.array(z.string()),
  updatedAt: z.iso.datetime(),
});
export type ShotBuildRecord = z.infer<typeof shotBuildRecordSchema>;

/** `.reelforge/scenes-report.json`: one record per shot, in storyboard order. */
export const scenesReportSchema = z.object({
  version: z.literal(SCENES_REPORT_VERSION),
  updatedAt: z.iso.datetime(),
  shots: z.array(shotBuildRecordSchema),
});
export type ScenesReport = z.infer<typeof scenesReportSchema>;

/**
 * `anchor`: a scene's `anchor(phrase)` (its visual hit) checked against the words file;
 * `sfx`: a scene's `sfx.at(t, name)`; `cue`: an sfx entry of `cues.json`; `annotation`: a
 * `ctx.annotate.*` mark with a `phrase` (its `at` against the spoken phrase).
 */
export const syncEventKindSchema = z.enum(['anchor', 'sfx', 'cue', 'annotation']);
export type SyncEventKind = z.infer<typeof syncEventKindSchema>;

/**
 * `ok` within the tolerance · `off` a spoken word is near but the event misses it ·
 * `free` no spoken anchor near (a free cue, not a problem) · `outside-shot` the anchor is spoken
 * outside the shot or the event lies outside it.
 */
export const syncVerdictSchema = z.enum(['ok', 'off', 'free', 'outside-shot']);
export type SyncVerdict = z.infer<typeof syncVerdictSchema>;

export const syncEventSchema = z.object({
  kind: syncEventKindSchema,
  /** Anchor phrase, sfx name or annotation id. */
  label: z.string(),
  /** Global event time (s). */
  t: z.number(),
  /** Global time of the spoken word it is measured against; null when none is near. */
  spokenT: z.number().nullable(),
  /** Phrase it is measured against (anchor phrase), null when none. */
  phrase: z.string().nullable(),
  /** (t - spokenT) in ms, rounded; null when not matched. */
  deltaMs: z.number().nullable(),
  verdict: syncVerdictSchema,
});
export type SyncEvent = z.infer<typeof syncEventSchema>;

export const shotSyncSchema = z.object({
  shotId: z.string().min(1),
  t0: z.number(),
  t1: z.number(),
  events: z.array(syncEventSchema),
  /** Events with verdict `off` or `outside-shot`. */
  problems: z.int().nonnegative(),
  /** Largest |delta| of the matched events (ms), null when none matched. */
  maxDeltaMs: z.number().nullable(),
  /** The shot could not be loaded (no events then). */
  error: z.string().optional(),
});
export type ShotSync = z.infer<typeof shotSyncSchema>;

export const MISSING_PROPS_VERSION = 1;

/** One prop a scene build asked for that the kit does not have. */
export const missingPropEntrySchema = z.object({
  name: z.string().min(1),
  /** Shots that use a fallback because of it (storyboard ids). */
  shots: z.array(z.string().min(1)),
  firstSeenAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
});
export type MissingPropEntry = z.infer<typeof missingPropEntrySchema>;

/**
 * `.reelforge/missing-props.json`: props the kit lacks, logged by the app for the developer
 * (extending the kit is a repo-level change, never an edit inside a user project).
 */
export const missingPropsFileSchema = z.object({
  version: z.literal(MISSING_PROPS_VERSION),
  updatedAt: z.iso.datetime(),
  entries: z.array(missingPropEntrySchema),
});
export type MissingPropsFile = z.infer<typeof missingPropsFileSchema>;

/** `.reelforge/sync-report.json` ("Check every visual lands on its spoken word"). */
export const syncReportSchema = z.object({
  version: z.literal(SYNC_REPORT_VERSION),
  createdAt: z.iso.datetime(),
  toleranceMs: z.number().positive(),
  shots: z.array(shotSyncSchema),
  summary: z.object({
    shots: z.int().nonnegative(),
    events: z.int().nonnegative(),
    ok: z.int().nonnegative(),
    problems: z.int().nonnegative(),
    failedShots: z.int().nonnegative(),
  }),
});
export type SyncReport = z.infer<typeof syncReportSchema>;

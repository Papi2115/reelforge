/**
 * `<project>/.reelforge/pipeline.json`: per-stage status, the persistent work-item queue (e.g. one
 * scene-build job per shot) and the usage-limit pause, so a limit hit mid-stage resumes after a
 * restart without redoing finished work (PLAN.md#5.4). Written atomically by claude-bridge.
 */
import { z } from 'zod';
import { sessionPurposeSchema } from './sessions.js';

export const PIPELINE_STATE_VERSION = 1;

/** `running` only while a turn is in flight; a restart turns it back into `pending`. */
export const workItemStatusSchema = z.enum(['pending', 'running', 'done', 'failed']);
export type WorkItemStatus = z.infer<typeof workItemStatusSchema>;

export const workItemSchema = z.object({
  /** Unique within its stage (e.g. `shot-03`). */
  id: z.string().min(1),
  stage: z.string().min(1),
  prompt: z.string(),
  purpose: sessionPurposeSchema.optional(),
  newSession: z.boolean().optional(),
  status: workItemStatusSchema,
  /** Turns started for this item, excluding the ones that hit a usage limit. */
  attempts: z.int().nonnegative(),
  limitHits: z.int().nonnegative(),
  lastError: z.string().optional(),
  sessionId: z.string().min(1).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().optional(),
});
export type WorkItem = z.infer<typeof workItemSchema>;

export const stageRunStatusSchema = z.enum([
  'idle',
  'running',
  'paused',
  'done',
  'failed',
  'blocked',
]);
export type StageRunStatus = z.infer<typeof stageRunStatusSchema>;

export const stageStateSchema = z.object({
  status: stageRunStatusSchema,
  updatedAt: z.iso.datetime(),
  message: z.string().optional(),
  /**
   * An upstream stage produced new output after this one ran (e.g. the voice-over was replaced):
   * the outputs still exist but should be redone. Cleared when the stage runs again.
   */
  stale: z.boolean().optional(),
  /** Why the stage is stale, e.g. `voiceover changed`. */
  staleReason: z.string().optional(),
  /**
   * The app closed while the stage was running (or waiting out a usage limit); it can be run again.
   * Cleared when the stage runs again.
   */
  interrupted: z.boolean().optional(),
  /**
   * The user approved the stage's output (the script acceptance gate, PLAN.md#7.1); later stages
   * wait for it. Cleared when the stage runs again.
   */
  approvedAt: z.iso.datetime().optional(),
});
export type StageState = z.infer<typeof stageStateSchema>;

export const pauseUntilSourceSchema = z.enum(['reset-time', 'reset-text', 'backoff']);
export type PauseUntilSource = z.infer<typeof pauseUntilSourceSchema>;

export const pipelinePauseSchema = z.object({
  reason: z.enum(['limit', 'manual']),
  pausedAt: z.iso.datetime(),
  /** Absent for a manual pause (resumed by the user only). */
  pausedUntil: z.iso.datetime().optional(),
  untilSource: pauseUntilSourceSchema.optional(),
  /** Limit incidents in a row without a successful turn in between (drives the backoff). */
  consecutiveLimits: z.int().nonnegative(),
  /** Concurrency to use after resuming (reduced after a limit). */
  concurrency: z.int().positive(),
  rateLimitType: z.string().optional(),
  message: z.string().optional(),
});
export type PipelinePause = z.infer<typeof pipelinePauseSchema>;

export const pipelineStateSchema = z.object({
  version: z.literal(PIPELINE_STATE_VERSION),
  updatedAt: z.iso.datetime(),
  stages: z.record(z.string(), stageStateSchema),
  queue: z.array(workItemSchema),
  pause: pipelinePauseSchema.optional(),
});
export type PipelineState = z.infer<typeof pipelineStateSchema>;

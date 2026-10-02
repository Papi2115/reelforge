/**
 * `<project>/.reelforge/sessions.json`: Claude Code session ids per project purpose (main chat,
 * side sessions for script/QA) plus the turn that was in flight, so a crashed turn can be resumed
 * with `claude --resume <sessionId>` (PLAN.md#5.2). Written atomically by `packages/claude-bridge`.
 */
import { z } from 'zod';

export const SESSIONS_FILE_VERSION = 1;

/** One long-lived session per purpose and project. */
export const sessionPurposeSchema = z.enum(['main', 'script', 'qa']);
export type SessionPurpose = z.infer<typeof sessionPurposeSchema>;

/** `running`: the app died while the turn ran; `interrupted`: the turn ended without finishing. */
export const pendingTurnStateSchema = z.enum(['running', 'interrupted']);
export type PendingTurnState = z.infer<typeof pendingTurnStateSchema>;

export const pendingTurnSchema = z.object({
  turnId: z.string().min(1),
  stage: z.string().min(1),
  model: z.string().min(1),
  prompt: z.string(),
  startedAt: z.iso.datetime(),
  state: pendingTurnStateSchema,
  /** Why the turn was interrupted (bridge turn status, e.g. `crashed`, `timeout`). */
  reason: z.string().optional(),
});
export type PendingTurn = z.infer<typeof pendingTurnSchema>;

const modelTokensSchema = z.object({
  inputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  cacheCreationInputTokens: z.number().nonnegative(),
  cacheReadInputTokens: z.number().nonnegative(),
  costUsd: z.number().nonnegative(),
});

/**
 * What the CLI reported after the last turn of `sessionId`. Its `total_cost_usd` and
 * `modelUsage` add up the whole session across `--resume` (seen in the first real run,
 * PLAN.md#10.4), so the next resumed turn books only the difference.
 */
export const usageSnapshotSchema = z.object({
  sessionId: z.string().min(1),
  costUsd: z.number().nonnegative(),
  models: z.record(z.string(), modelTokensSchema),
});
export type UsageSnapshot = z.infer<typeof usageSnapshotSchema>;

export const sessionRecordSchema = z.object({
  /** Claude Code session id from `system:init`; absent until the first turn reached init. */
  sessionId: z.string().min(1).optional(),
  model: z.string().min(1),
  updatedAt: z.iso.datetime(),
  pendingTurn: pendingTurnSchema.optional(),
  usageSnapshot: usageSnapshotSchema.optional(),
});
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

export const sessionsFileSchema = z.object({
  version: z.literal(SESSIONS_FILE_VERSION),
  sessions: z.object({
    main: sessionRecordSchema.optional(),
    script: sessionRecordSchema.optional(),
    qa: sessionRecordSchema.optional(),
  }),
});
export type SessionsFile = z.infer<typeof sessionsFileSchema>;

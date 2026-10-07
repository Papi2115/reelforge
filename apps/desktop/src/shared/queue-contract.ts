/**
 * IPC payloads of the production line (PLAN.md#13.9, ADR-034): the channels' queues as plain views
 * (main derives every status with the line's own state machine), the line's state, the "Needs you"
 * entries of the queues, the line's preferences (notifications, quiet hours) and the commands of
 * the "Production line" dialog. Films are English only (no language in a request). Merged into
 * ipc-contract.ts.
 */
import {
  MAX_QUEUE_ITEMS,
  channelIdSchema,
  queueItemIdSchema,
  queueItemStatusSchema,
  queueStepSchema,
  queueStepStateNameSchema,
} from '@reelforge/shared';
import { z } from 'zod';
import { projectOpenResultSchema, type ProjectOpenResult } from './project-contract.js';

/** Topics one "Add topics" may carry. */
export const MAX_TOPICS_PER_ADD = 100;
/** Longest film a topic line may ask for (minutes; the queue schema's own limit). */
export const MAX_TOPIC_MINUTES = 60;

/** Local wall-clock time, 24 h "HH:MM". */
export const clockTextSchema = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/);

export const quietHoursSchema = z.object({ start: clockTextSchema, end: clockTextSchema });
export type QuietHoursView = z.infer<typeof quietHoursSchema>;

/** `<app data>/production-line.json`: what the line remembers between runs. */
export const LINE_PREFS_VERSION = 1;
export const linePrefsSchema = z.object({
  version: z.literal(LINE_PREFS_VERSION),
  /** A system notification when a film is ready, needs you, or the line stops. */
  notifications: z.boolean().default(true),
  /** No new step starts in this window (applies the next time the line starts). */
  quietHours: quietHoursSchema.nullable().default(null),
});
export type LinePrefs = z.output<typeof linePrefsSchema>;

export const linePrefsPatchSchema = z.strictObject({
  notifications: z.boolean().optional(),
  quietHours: quietHoursSchema.nullable().optional(),
});
export type LinePrefsPatch = z.infer<typeof linePrefsPatchSchema>;

export const liveProgressSchema = z.object({
  label: z.string(),
  /** 0..100 when known. */
  percent: z.number().nullable(),
});
export type LiveProgress = z.infer<typeof liveProgressSchema>;

export const queueItemViewSchema = z.object({
  id: queueItemIdSchema,
  topic: z.string(),
  status: queueItemStatusSchema,
  /** The first step not done (null: the film is finished). */
  step: queueStepSchema.nullable(),
  stepState: queueStepStateNameSchema.nullable(),
  /** What waits for you, or why the film failed. */
  message: z.string().nullable(),
  /** The film's length: its own, else the queue's default. */
  targetMinutes: z.number(),
  stepsDone: z.number().int().nonnegative(),
  stepsTotal: z.number().int().positive(),
  projectPath: z.string().nullable(),
  /** The ⚠ lines of the film's report. */
  warnings: z.array(z.string()),
  reviewed: z.boolean(),
  /** What the running step is doing now. */
  live: liveProgressSchema.nullable(),
});
export type QueueItemView = z.infer<typeof queueItemViewSchema>;

export const channelQueueViewSchema = z.object({
  channelId: channelIdSchema,
  autoApproveScript: z.boolean(),
  paused: z.boolean(),
  defaultTargetMinutes: z.number(),
  /** The channel generates its voice-overs (a voice and a key are saved). */
  voiceReady: z.boolean(),
  items: z.array(queueItemViewSchema).max(MAX_QUEUE_ITEMS),
  /** The queue file cannot be read. */
  error: z.string().nullable(),
});
export type ChannelQueueView = z.infer<typeof channelQueueViewSchema>;

export const LINE_ACTIVITIES = ['running', 'waiting', 'limit', 'quiet', 'stopped'] as const;
export const LINE_ENDS = ['idle', 'time', 'stopped', 'blocked'] as const;

export const runUntilViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('idle') }),
  /** `at`: epoch ms of the next `text` o'clock when the line started. */
  z.object({ kind: z.literal('time'), at: z.number(), text: clockTextSchema }),
]);
export type RunUntilView = z.infer<typeof runUntilViewSchema>;

export const lineViewSchema = z.object({
  activity: z.enum(LINE_ACTIVITIES),
  /** Epoch ms the line waits for (the limit reset, the end of the quiet hours). */
  until: z.number().nullable(),
  message: z.string().nullable(),
  current: z
    .object({ channelId: channelIdSchema, itemId: queueItemIdSchema, step: queueStepSchema })
    .nullable(),
  /** Started and not stopped by you: after an approval it goes on by itself. */
  wanted: z.boolean(),
  runUntil: runUntilViewSchema,
  /** How the last run ended (null: none ended in this session yet). */
  lastEnd: z.enum(LINE_ENDS).nullable(),
  /** Why the line could not run (Claude not connected, another app runs it…). */
  problem: z.string().nullable(),
});
export type LineView = z.infer<typeof lineViewSchema>;

export const QUEUE_ATTENTION_KINDS = [
  'approve-script',
  'add-voice',
  'review-assets',
  'failed',
  'check-warnings',
] as const;
export type QueueAttentionKindView = (typeof QUEUE_ATTENTION_KINDS)[number];

export const queueAttentionViewSchema = z.object({
  kind: z.enum(QUEUE_ATTENTION_KINDS),
  channelId: channelIdSchema,
  itemId: queueItemIdSchema,
  topic: z.string(),
  step: queueStepSchema.nullable(),
  message: z.string(),
  since: z.string(),
  projectPath: z.string().nullable(),
});
export type QueueAttentionView = z.infer<typeof queueAttentionViewSchema>;

export const queueStateSchema = z.object({
  line: lineViewSchema,
  /** In the channel order of Settings → Channels. */
  channels: z.array(channelQueueViewSchema),
  attention: z.array(queueAttentionViewSchema),
  prefs: linePrefsSchema,
});
export type QueueState = z.infer<typeof queueStateSchema>;

export const queueCommandResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), message: z.string().nullable() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type QueueCommandResult = z.infer<typeof queueCommandResultSchema>;

export const queueTopicRequestSchema = z.strictObject({
  topic: z.string().trim().min(1).max(500),
  targetMinutes: z.number().positive().max(MAX_TOPIC_MINUTES).optional(),
});
export type QueueTopicRequest = z.infer<typeof queueTopicRequestSchema>;

export const queueAddTopicsRequestSchema = z.strictObject({
  channelId: channelIdSchema,
  topics: z.array(queueTopicRequestSchema).min(1).max(MAX_TOPICS_PER_ADD),
});

export const queueItemRequestSchema = z.strictObject({
  channelId: channelIdSchema,
  itemId: queueItemIdSchema,
});
export type QueueItemRef = z.infer<typeof queueItemRequestSchema>;

export const queueMoveRequestSchema = queueItemRequestSchema.extend({
  index: z.int().min(0).max(MAX_QUEUE_ITEMS),
});

export const queueOptionsPatchSchema = z.strictObject({
  autoApproveScript: z.boolean().optional(),
  paused: z.boolean().optional(),
  defaultTargetMinutes: z.number().positive().max(MAX_TOPIC_MINUTES).optional(),
});
export type QueueOptionsPatchView = z.infer<typeof queueOptionsPatchSchema>;

export const queueOptionsRequestSchema = z.strictObject({
  channelId: channelIdSchema,
  patch: queueOptionsPatchSchema,
});

export const runUntilRequestSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('idle') }),
  z.strictObject({ kind: z.literal('time'), at: clockTextSchema }),
]);
export type RunUntilRequest = z.infer<typeof runUntilRequestSchema>;

export const queueStartRequestSchema = z.strictObject({ runUntil: runUntilRequestSchema });

/** Where "Open" lands in the film's project. */
export const QUEUE_OPEN_PANELS = ['project', 'script', 'voiceover', 'assets'] as const;
export type QueueOpenPanel = (typeof QUEUE_OPEN_PANELS)[number];

export const queueOpenRequestSchema = queueItemRequestSchema.extend({
  panel: z.enum(QUEUE_OPEN_PANELS),
});

export const QUEUE_FOLDERS = ['project', 'video', 'publish'] as const;
export type QueueFolder = (typeof QUEUE_FOLDERS)[number];

export const queueFolderRequestSchema = queueItemRequestSchema.extend({
  folder: z.enum(QUEUE_FOLDERS),
});

const noPayload = z.null();

export const QUEUE_IPC = {
  queueState: { name: 'queue:state', request: noPayload, response: queueStateSchema },
  /** Appends topics (English films) at the end of the channel's queue. */
  queueAddTopics: {
    name: 'queue:add-topics',
    request: queueAddTopicsRequestSchema,
    response: queueCommandResultSchema,
  },
  /** Takes a film out of the queue (its project folder stays). */
  queueRemove: {
    name: 'queue:remove',
    request: queueItemRequestSchema,
    response: queueCommandResultSchema,
  },
  queueMove: {
    name: 'queue:move',
    request: queueMoveRequestSchema,
    response: queueCommandResultSchema,
  },
  queueHold: {
    name: 'queue:hold',
    request: queueItemRequestSchema,
    response: queueCommandResultSchema,
  },
  queueResume: {
    name: 'queue:resume',
    request: queueItemRequestSchema,
    response: queueCommandResultSchema,
  },
  queueRetry: {
    name: 'queue:retry',
    request: queueItemRequestSchema,
    response: queueCommandResultSchema,
  },
  queueSetOptions: {
    name: 'queue:set-options',
    request: queueOptionsRequestSchema,
    response: queueCommandResultSchema,
  },
  queueStart: {
    name: 'queue:start',
    request: queueStartRequestSchema,
    response: queueCommandResultSchema,
  },
  /** Stops the line: the running step is aborted and runs again next time. */
  queueStop: { name: 'queue:stop', request: noPayload, response: queueCommandResultSchema },
  /** The app's "Approve script" for a film of the queue. */
  queueApproveScript: {
    name: 'queue:approve-script',
    request: queueItemRequestSchema,
    response: queueCommandResultSchema,
  },
  /** Opens the film's project in the app (main resolves the folder from the queue). */
  queueOpenProject: {
    name: 'queue:open-project',
    request: queueOpenRequestSchema,
    response: projectOpenResultSchema,
  },
  queueOpenFolder: {
    name: 'queue:open-folder',
    request: queueFolderRequestSchema,
    response: queueCommandResultSchema,
  },
  /** You looked at a finished film's ⚠ report (it leaves "Needs you"). */
  queueMarkReviewed: {
    name: 'queue:mark-reviewed',
    request: queueItemRequestSchema,
    response: queueCommandResultSchema,
  },
  /** Something the line waits for changed (a key was saved…): check the waiting films again. */
  queueWake: { name: 'queue:wake', request: noPayload, response: queueCommandResultSchema },
  queuePrefs: { name: 'queue:prefs', request: linePrefsPatchSchema, response: linePrefsSchema },
} as const;

export const queueShowItemSchema = queueItemRequestSchema;

export const QUEUE_PUSH = {
  /** The whole state after any change (coalesced). */
  queueChanged: { name: 'queue:changed', payload: queueStateSchema },
  /** A system notification was clicked: show this film in the Production line dialog. */
  queueShowItem: { name: 'queue:show-item', payload: queueShowItemSchema },
} as const;

export interface QueueApi {
  getQueueState(): Promise<QueueState>;
  addQueueTopics(
    channelId: string,
    topics: readonly QueueTopicRequest[],
  ): Promise<QueueCommandResult>;
  removeQueueItem(ref: QueueItemRef): Promise<QueueCommandResult>;
  moveQueueItem(ref: QueueItemRef, index: number): Promise<QueueCommandResult>;
  holdQueueItem(ref: QueueItemRef): Promise<QueueCommandResult>;
  resumeQueueItem(ref: QueueItemRef): Promise<QueueCommandResult>;
  retryQueueItem(ref: QueueItemRef): Promise<QueueCommandResult>;
  setQueueOptions(channelId: string, patch: QueueOptionsPatchView): Promise<QueueCommandResult>;
  startLine(runUntil: RunUntilRequest): Promise<QueueCommandResult>;
  stopLine(): Promise<QueueCommandResult>;
  approveQueueScript(ref: QueueItemRef): Promise<QueueCommandResult>;
  openQueueProject(ref: QueueItemRef, panel: QueueOpenPanel): Promise<ProjectOpenResult>;
  openQueueFolder(ref: QueueItemRef, folder: QueueFolder): Promise<QueueCommandResult>;
  markQueueReviewed(ref: QueueItemRef): Promise<QueueCommandResult>;
  wakeLine(): Promise<QueueCommandResult>;
  updateLinePrefs(patch: LinePrefsPatch): Promise<LinePrefs>;
  /** Subscribes to `queueChanged`; returns the unsubscribe function. */
  onQueueChanged(listener: (state: QueueState) => void): () => void;
  /** Subscribes to `queueShowItem`; returns the unsubscribe function. */
  onQueueShowItem(listener: (ref: QueueItemRef) => void): () => void;
}

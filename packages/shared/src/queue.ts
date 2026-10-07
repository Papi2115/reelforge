/**
 * Production line (PLAN.md#13.9, ADR-034): one queue of film topics per channel,
 * `<app data>/queues/<channelId>.json`, driven through the pipeline one step at a time by the
 * line runner (`@reelforge/stages` `QueueRunner`). Every step's state is persisted, so a crash or
 * an app close resumes where the line stopped. `<app data>/queues/line.json` keeps what belongs
 * to the whole line (the usage-limit pause, the channel served last).
 */
import { z } from 'zod';
import { channelIdSchema } from './channels.js';
import { videoLanguageSchema } from './project.js';
import { stylePresetIdSchema } from './style-preset.js';

export const QUEUE_FILE_VERSION = 1;
export const LINE_STATE_VERSION = 1;
/** Folder in the app data folder: one `<channelId>.json` per channel + `line.json`. */
export const QUEUES_DIR = 'queues';
export const LINE_STATE_FILE = 'line.json';
/** Lock file of the one line runner of the app (pid + token). */
export const LINE_LOCK_FILE = 'runner.lock';

export const MAX_QUEUE_ITEMS = 500;
export const MAX_QUEUE_HISTORY = 100;
export const MAX_QUEUE_WARNINGS = 30;
/** Target length of a film when neither the item nor the queue names one. */
export const DEFAULT_QUEUE_TARGET_MINUTES = 8;

export function queueFileName(channelId: string): string {
  return `${channelId}.json`;
}

/**
 * What an item is doing, derived from its step states (`queueItemStatus`) except `paused`, which
 * the user sets (the item is on hold and skipped until resumed).
 */
export const QUEUE_ITEM_STATUSES = [
  'queued',
  'brief',
  'scripting',
  'needs-approval',
  'needs-voice',
  'building',
  'exporting',
  'done',
  'failed',
  'paused',
] as const;
export const queueItemStatusSchema = z.enum(QUEUE_ITEM_STATUSES);
export type QueueItemStatus = z.infer<typeof queueItemStatusSchema>;

/**
 * The steps of one film, in order. `project`: the project folder; `brief`: topic -> brief.json;
 * `approval`: the script acceptance gate; `final-review`: the quiet review after the scene build;
 * `publish`: the publish kit. The rest are the pipeline stages of the same name.
 */
export const QUEUE_STEPS = [
  'project',
  'brief',
  'script',
  'approval',
  'voiceover',
  'clean',
  'words',
  'storyboard',
  'assets',
  'scenes',
  'final-review',
  'sound-cues',
  'mix',
  'export',
  'publish',
] as const;
export const queueStepSchema = z.enum(QUEUE_STEPS);
export type QueueStep = z.infer<typeof queueStepSchema>;

/**
 * A step's state; absent = pending. `waiting`: blocked on the user (approval, voice, asset
 * review); `skipped`: does not apply to the film (e.g. no asset research).
 */
export const QUEUE_STEP_STATES = ['running', 'waiting', 'done', 'skipped', 'failed'] as const;
export const queueStepStateNameSchema = z.enum(QUEUE_STEP_STATES);
export type QueueStepStateName = z.infer<typeof queueStepStateNameSchema>;

const messageSchema = z.string().max(2_000);
const isoSchema = z.iso.datetime();

export const queueStepStateSchema = z.object({
  state: queueStepStateNameSchema,
  at: isoSchema,
  message: messageSchema.optional(),
});
export type QueueStepState = z.infer<typeof queueStepStateSchema>;

export const queueHistoryEntrySchema = z.object({
  at: isoSchema,
  status: queueItemStatusSchema,
  step: queueStepSchema.optional(),
  message: messageSchema.optional(),
});
export type QueueHistoryEntry = z.infer<typeof queueHistoryEntrySchema>;

export const queueItemIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const queueItemSchema = z.object({
  id: queueItemIdSchema,
  /** What the film is about, as the user typed it. */
  topic: z.string().trim().min(1).max(500),
  /** The user's own brief; when given, no Claude turn writes one. */
  brief: z.string().trim().min(1).max(10_000).optional(),
  language: videoLanguageSchema.default('en'),
  targetMinutes: z.number().positive().max(60).optional(),
  /** Style / world of this film instead of the channel's default. */
  style: stylePresetIdSchema.optional(),
  /**
   * Genre preset of this film (PLAN.md#13.8, ADR-035): absent = the channel's preset, null = none
   * (not even the channel's); applied when the line creates the project.
   */
  genrePreset: z.string().trim().min(1).max(64).nullable().optional(),
  status: queueItemStatusSchema,
  /** Absolute project folder once the `project` step made it. */
  projectPath: z.string().min(1).max(4_096).optional(),
  stageProgress: z.partialRecord(queueStepSchema, queueStepStateSchema).default({}),
  /** Why the item failed (the step and the reason). */
  error: z.object({ step: queueStepSchema, message: messageSchema }).optional(),
  /** ⚠ lines of the finished steps (the per-film ✓/⚠ report). */
  warnings: z.array(messageSchema).max(MAX_QUEUE_WARNINGS).default([]),
  /** The user looked at the finished film's ⚠ report (it leaves "Needs you"). */
  reviewedAt: isoSchema.optional(),
  createdAt: isoSchema,
  updatedAt: isoSchema,
  /** Status changes, oldest first (capped). */
  history: z.array(queueHistoryEntrySchema).max(MAX_QUEUE_HISTORY).default([]),
});
export type QueueItem = z.output<typeof queueItemSchema>;

export const productionQueueSchema = z
  .object({
    version: z.literal(QUEUE_FILE_VERSION),
    channelId: channelIdSchema,
    /** Skip the script acceptance gate (default false: the user approves every script). */
    autoApproveScript: z.boolean().default(false),
    /** The user stopped this channel's line (its items are skipped). */
    paused: z.boolean().default(false),
    defaultTargetMinutes: z.number().positive().max(60).default(DEFAULT_QUEUE_TARGET_MINUTES),
    /** In the user's order (the line works front to back). */
    items: z.array(queueItemSchema).max(MAX_QUEUE_ITEMS).default([]),
  })
  .superRefine((queue, context) => {
    const ids = new Set<string>();
    for (const [index, item] of queue.items.entries()) {
      if (ids.has(item.id)) {
        context.addIssue({
          code: 'custom',
          path: ['items', index, 'id'],
          message: `duplicate item id "${item.id}"`,
        });
      }
      ids.add(item.id);
    }
  });
export type ProductionQueue = z.output<typeof productionQueueSchema>;

/** A topic the user adds (the store fills in the id, status and times). */
export const queueTopicInputSchema = z.strictObject({
  topic: queueItemSchema.shape.topic,
  brief: queueItemSchema.shape.brief,
  language: videoLanguageSchema.optional(),
  targetMinutes: queueItemSchema.shape.targetMinutes,
  style: queueItemSchema.shape.style,
  genrePreset: queueItemSchema.shape.genrePreset,
});
export type QueueTopicInput = z.infer<typeof queueTopicInputSchema>;

/** Line-wide state: the Claude usage-limit pause survives a restart. */
export const lineStateSchema = z.object({
  version: z.literal(LINE_STATE_VERSION),
  limitPause: z
    .object({
      since: isoSchema,
      /** Automatic resume; absent = unknown (the runner retries after a backoff). */
      until: isoSchema.optional(),
      message: messageSchema.optional(),
    })
    .optional(),
  /** Channel whose film was served last (round-robin between channels). */
  lastChannelId: channelIdSchema.optional(),
});
export type LineState = z.output<typeof lineStateSchema>;

export function emptyProductionQueue(channelId: string): ProductionQueue {
  return productionQueueSchema.parse({ version: QUEUE_FILE_VERSION, channelId });
}

export function emptyLineState(): LineState {
  return { version: LINE_STATE_VERSION };
}

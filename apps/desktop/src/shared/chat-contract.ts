/**
 * IPC payloads of the Claude chat panel (PLAN.md#6.6): send a request with its scope (Selection /
 * Shot / Whole video) and the object picked in the preview, the FIFO queue, Stop, and the chat
 * state main pushes while Claude works (steps of every turn, queue, usage-limit pause). Merged
 * into the registry of ipc-contract.ts. Steps are plain data built in main from the bridge's
 * `steps` reducer; frame thumbnails are project-relative paths under `.reelforge/frames/`.
 */
import { shotIdSchema } from '@reelforge/shared';
import { z } from 'zod';

export const CHAT_SCOPES = ['selection', 'shot', 'video'] as const;
export const chatScopeSchema = z.enum(CHAT_SCOPES);
export type ChatScope = z.infer<typeof chatScopeSchema>;

export const SCOPE_LABELS: Readonly<Record<ChatScope, string>> = {
  selection: 'Selection',
  shot: 'Shot',
  video: 'Whole video',
};

/** Whole-video suggestions (PLAN.md#7.6): each runs a review mode of the scene stage. */
export const CHAT_CHIPS = ['review-video', 'readable-text', 'visuals-on-words'] as const;
export const chatChipSchema = z.enum(CHAT_CHIPS);
export type ChatChip = z.infer<typeof chatChipSchema>;

export const CHIP_LABELS: Readonly<Record<ChatChip, string>> = {
  'review-video': 'Review the whole video and fix what looks wrong',
  'readable-text': 'Make all on-screen text easier to read on a phone',
  'visuals-on-words': 'Check every visual lands on its spoken word',
};

export const CHAT_MODELS = ['opus', 'sonnet', 'haiku'] as const;
export const chatModelSchema = z.enum(CHAT_MODELS);

const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
const shortText = (max: number): z.ZodString => z.string().max(max);

/** The object picked in the preview (engine `pick()`), sent with a Selection request. */
export const chatSelectionSchema = z.strictObject({
  kind: z.enum(['kit', 'object', 'text']),
  shotId: shotIdSchema.max(64),
  /** Global and shot-local time of the pick. */
  t: z.number().min(0).max(86_400),
  localTime: z.number(),
  /** Normalized frame point that was clicked (0..1, top-left). */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  name: shortText(200),
  id: shortText(200),
  call: shortText(100).nullable(),
  occurrence: z.int().min(0).max(10_000).nullable(),
  sceneName: shortText(200).nullable(),
  parent: shortText(200).nullable(),
  position: vec3Schema.nullable(),
  size: vec3Schema.nullable(),
  description: shortText(600),
});
export type ChatSelection = z.infer<typeof chatSelectionSchema>;

export const MAX_CHAT_TEXT = 8_000;

export const chatSendRequestSchema = z
  .strictObject({
    /** The user's words; may be empty when a chip is sent. */
    text: z.string().max(MAX_CHAT_TEXT),
    chip: chatChipSchema.nullable(),
    scope: chatScopeSchema,
    /** Shots in scope (Shot: the selected shot; Selection: the picked object's shot). */
    shotIds: z.array(shotIdSchema.max(64)).max(500),
    selection: chatSelectionSchema.nullable(),
    /** "Think harder": the boost model (Opus by default) for this message. */
    boost: z.boolean(),
  })
  .refine((request) => request.chip !== null || request.text.trim() !== '', {
    message: 'empty message',
  });
export type ChatSendRequest = z.infer<typeof chatSendRequestSchema>;

export const CHAT_ERROR_KINDS = [
  'no-project',
  'not-connected',
  'invalid-request',
  'setup',
  'spawn',
  'auth',
  'limit',
  'billing-guard',
  'timeout',
  'crashed',
  'failed',
  'commit',
] as const;
export const chatErrorSchema = z.object({
  kind: z.enum(CHAT_ERROR_KINDS),
  message: z.string(),
});
export type ChatError = z.infer<typeof chatErrorSchema>;

export const chatSendResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('queued'), turnId: z.string() }),
  z.object({ status: z.literal('error'), error: chatErrorSchema }),
]);
export type ChatSendResult = z.infer<typeof chatSendResultSchema>;

export const TOOL_STATUSES = ['running', 'done', 'error', 'denied'] as const;

export const chatStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), id: z.string(), text: z.string() }),
  z.object({
    type: z.literal('tool'),
    id: z.string(),
    name: z.string(),
    /** One-line argument summary (`scenes/s02.js`, the command, ...). */
    summary: z.string(),
    status: z.enum(TOOL_STATUSES),
    /** Bash command line, else null. */
    command: z.string().nullable(),
    /** Start of the tool output (truncated). */
    output: z.string().nullable(),
    /** Frame PNGs the step rendered or looked at: project-relative, under `.reelforge/frames/`. */
    frames: z.array(z.string()),
  }),
  z.object({ type: z.literal('error'), id: z.string(), message: z.string() }),
]);
export type ChatStep = z.infer<typeof chatStepSchema>;
export type ChatToolStep = Extract<ChatStep, { type: 'tool' }>;

export const CHAT_TURN_STATUSES = ['queued', 'running', 'done', 'stopped', 'failed'] as const;
export type ChatTurnStatus = (typeof CHAT_TURN_STATUSES)[number];

export const chatUsageSchema = z.object({
  inputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  cacheReadTokens: z.number().nonnegative(),
  /** CLI list-price estimate (a relative meter on a subscription). */
  costUsd: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
});
export type ChatUsage = z.infer<typeof chatUsageSchema>;

export const chatTurnSchema = z.object({
  id: z.string(),
  request: z.object({
    text: z.string(),
    chip: chatChipSchema.nullable(),
    scope: chatScopeSchema,
    shotIds: z.array(z.string()),
    /** e.g. `calculator (s02)`. */
    selectionLabel: z.string().nullable(),
    model: chatModelSchema,
  }),
  status: z.enum(CHAT_TURN_STATUSES),
  /** Epoch ms. */
  queuedAt: z.number(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  steps: z.array(chatStepSchema),
  usage: chatUsageSchema.nullable(),
  error: chatErrorSchema.nullable(),
  /** The autocommit made after the turn (null: nothing changed / not yet). */
  commit: z.object({ hash: z.string(), subject: z.string() }).nullable(),
  /**
   * The claude process died mid-turn (crashed, killed, timed out): "Resume" continues it in the
   * same session (`--resume` + a continuation prompt). Only the newest such turn is resumable.
   */
  resumable: z.boolean(),
  /** Id of the interrupted turn this one continues, else null. */
  resumeOf: z.string().nullable(),
});
export type ChatTurn = z.infer<typeof chatTurnSchema>;

export const chatPauseSchema = z.object({
  reason: z.enum(['limit', 'manual']),
  /** Epoch ms of the automatic resume; null = until the user resumes. */
  until: z.number().nullable(),
  message: z.string().nullable(),
});
export type ChatPause = z.infer<typeof chatPauseSchema>;

/** Everything the chat panel shows for the open project. */
export const chatStateSchema = z.object({
  projectDir: z.string().nullable(),
  /** Started turns (running and finished), oldest first. */
  turns: z.array(chatTurnSchema),
  /** Waiting turns in the order they will run. */
  queue: z.array(chatTurnSchema),
  /** Id of the running turn of this project, if any. */
  running: z.string().nullable(),
  /** Account-wide usage-limit pause: nothing starts until it ends. */
  pause: chatPauseSchema.nullable(),
  /** Last problem that is not tied to a turn (e.g. Claude is not connected). */
  notice: chatErrorSchema.nullable(),
});
export type ChatState = z.infer<typeof chatStateSchema>;

const noPayload = z.null();

export const CHAT_IPC = {
  chatState: { name: 'chat:state', request: noPayload, response: chatStateSchema },
  /** Queues a message (runs right away when nothing else runs). */
  chatSend: { name: 'chat:send', request: chatSendRequestSchema, response: chatSendResultSchema },
  /** Removes a queued (not yet started) message; false when it is not queued. */
  chatRemove: {
    name: 'chat:remove',
    request: z.strictObject({ turnId: z.string().max(100) }),
    response: z.boolean(),
  },
  /** Stops the running turn (kills the process tree); what it changed is kept and committed. */
  chatStop: { name: 'chat:stop', request: noPayload, response: z.boolean() },
  /** "Try now" during a usage-limit pause. */
  chatResume: { name: 'chat:resume', request: noPayload, response: z.null() },
  /** Continues a turn whose claude process died (queued first; runs with `--resume`). */
  chatResumeTurn: {
    name: 'chat:resume-turn',
    request: z.strictObject({ turnId: z.string().max(100) }),
    response: chatSendResultSchema,
  },
} as const;

export const CHAT_PUSH = {
  chatChanged: { name: 'chat:changed', payload: chatStateSchema },
} as const;

export interface ChatApi {
  getChatState(): Promise<ChatState>;
  sendChat(request: ChatSendRequest): Promise<ChatSendResult>;
  removeQueuedChat(turnId: string): Promise<boolean>;
  stopChat(): Promise<boolean>;
  resumeChat(): Promise<null>;
  resumeChatTurn(turnId: string): Promise<ChatSendResult>;
  /** Subscribes to chat state pushes; returns the unsubscribe function. */
  onChatChanged(listener: (state: ChatState) => void): () => void;
}

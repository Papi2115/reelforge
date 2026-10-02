/**
 * IPC payloads of the pipeline sidebar and the Brief -> Script documents (PLAN.md#6.8, #7.1): the
 * state of every pipeline stage (status, gating reasons, staleness, approval, the running stage's
 * live steps, the queue), the stage commands (Run/Redo, Stop, Replace, Open) and the brief /
 * script documents. Merged into the registry of ipc-contract.ts. Main owns every path: the
 * renderer names stages and artifacts, never files.
 */
import {
  briefFileSchema,
  scriptReportSchema,
  stageRunStatusSchema,
  videoLanguageSchema,
} from '@reelforge/shared';
import { z } from 'zod';
import { chatPauseSchema, chatStepSchema } from './chat-contract.js';

/** Every pipeline stage in order (mirrors `PIPELINE_STAGES` of @reelforge/stages; tested). */
export const PIPELINE_STAGE_KEYS = [
  'script',
  'voiceover',
  'clean',
  'words',
  'storyboard',
  'scenes',
  'sound-cues',
  'mix',
  'export',
] as const;
export const pipelineStageKeySchema = z.enum(PIPELINE_STAGE_KEYS);
export type PipelineStageKey = z.infer<typeof pipelineStageKeySchema>;

export const stageErrorInfoSchema = z.object({
  kind: z.string(),
  message: z.string(),
  issues: z.array(z.string()),
});
export type StageErrorInfo = z.infer<typeof stageErrorInfoSchema>;

/** One stage as main sees it (pipeline.json + the files in the project + this session's runs). */
export const stageInfoSchema = z.object({
  stage: pipelineStageKeySchema,
  /** Persisted status; null when the stage never ran. */
  status: stageRunStatusSchema.nullable(),
  message: z.string().nullable(),
  updatedAt: z.string().nullable(),
  stale: z.boolean(),
  staleReason: z.string().nullable(),
  /** The app closed while it ran: it can be run again ("Resume"). */
  interrupted: z.boolean(),
  /** ISO time of the user's approval (script acceptance gate). */
  approvedAt: z.string().nullable(),
  /** Its output exists in the project. */
  hasOutput: z.boolean(),
  /** The app can run this stage at all (false: it arrives with a later update). */
  registered: z.boolean(),
  /** Plain "Run" starts it (false for the voice-over: it needs a recording, see Replace). */
  runnable: z.boolean(),
  /** Gating: may it run right now, and if not, why (one sentence each). */
  ready: z.boolean(),
  reasons: z.array(z.string()),
  /** Stages a new output of this one would mark out of date (the Redo confirmation). */
  invalidates: z.array(pipelineStageKeySchema),
  /** The last failure in this session (with validation issues), else null. */
  error: stageErrorInfoSchema.nullable(),
  /** Warnings of the last run in this session. */
  warnings: z.array(z.string()),
});
export type StageInfo = z.infer<typeof stageInfoSchema>;

/** A shot of a running scene build: in progress, ✓ / ⚠ / ✗, or left for the next run. */
export const shotRunStateSchema = z.enum(['running', 'ok', 'warning', 'failed', 'requeued']);
export type ShotRunState = z.infer<typeof shotRunStateSchema>;

/** The stage running right now. */
export const stageRunViewSchema = z.object({
  stage: pipelineStageKeySchema,
  /** Current step, e.g. `Claude: research`. */
  label: z.string().nullable(),
  /** Whole-stage completion 0..100 when known. */
  percent: z.number().min(0).max(100).nullable(),
  /** Epoch ms. */
  startedAt: z.number(),
  /** Claude's steps of every turn of this run (newest last). */
  steps: z.array(chatStepSchema),
  /** Waiting out a usage limit (`until`: epoch ms of the automatic resume, null = manual). */
  paused: z.object({ until: z.number().nullable(), message: z.string() }).nullable(),
  /** Scenes: the review mode of this run (null = build / other stages). */
  action: z.string().nullable(),
  /** Scenes: the shots this run targets (null = every shot of the storyboard). */
  targets: z.array(z.string()).nullable(),
  /** Scenes: shots started/finished so far in this run. */
  shots: z.record(z.string(), shotRunStateSchema),
});
export type StageRunView = z.infer<typeof stageRunViewSchema>;

export const stagesStateSchema = z.object({
  projectDir: z.string().nullable(),
  /** In pipeline order (PIPELINE_STAGE_KEYS); empty without a project. */
  stages: z.array(stageInfoSchema),
  running: stageRunViewSchema.nullable(),
  /** Stages waiting to run, in order. */
  queue: z.array(pipelineStageKeySchema),
  /** Account-wide usage-limit pause (the same one the chat shows). */
  pause: chatPauseSchema.nullable(),
});
export type StagesState = z.infer<typeof stagesStateSchema>;

export const stageCommandResultSchema = z.object({
  status: z.enum(['ok', 'queued', 'cancelled', 'error']),
  /** What happened / why not, for the UI. */
  message: z.string().nullable(),
});
export type StageCommandResult = z.infer<typeof stageCommandResultSchema>;

/** Stages whose output can be replaced by the user's own (Replace). */
export const REPLACEABLE_STAGES = ['script', 'voiceover'] as const;
export const replaceableStageSchema = z.enum(REPLACEABLE_STAGES);
export type ReplaceableStage = z.infer<typeof replaceableStageSchema>;

/** Outputs opened with the system's default app (main resolves the path inside the project). */
export const STAGE_ARTIFACTS = [
  'voiceover',
  'clean',
  'scenes',
  'mix',
  'stems',
  'video',
  'out',
] as const;
export const stageArtifactSchema = z.enum(STAGE_ARTIFACTS);
export type StageArtifact = z.infer<typeof stageArtifactSchema>;

export const MAX_BRIEF_TOPIC = 4_000;
export const MAX_BRIEF_FIELD = 300;
export const MAX_SCRIPT_CHARS = 300_000;

/** The brief form (PLAN.md#7.1); empty optional fields are left out of brief.json. */
export const briefInputSchema = z.strictObject({
  topic: z.string().trim().min(1).max(MAX_BRIEF_TOPIC),
  language: videoLanguageSchema,
  targetMinutes: z.number().positive().max(60),
  tone: z.string().max(MAX_BRIEF_FIELD),
  audience: z.string().max(MAX_BRIEF_FIELD),
  notes: z.string().max(MAX_BRIEF_TOPIC),
});
export type BriefInput = z.infer<typeof briefInputSchema>;

export const briefResultSchema = z.object({
  /** null: no brief.json yet (or unreadable, see `error`). */
  brief: briefFileSchema.nullable(),
  error: z.string().nullable(),
});
export type BriefResult = z.infer<typeof briefResultSchema>;

export const researchSourceSchema = z.object({ url: z.string(), claim: z.string() });
export type ResearchSource = z.infer<typeof researchSourceSchema>;

/** What the script view shows: the texts (null = not written yet), sources, target and report. */
export const scriptDocumentSchema = z.object({
  script: z.string().nullable(),
  research: z.string().nullable(),
  beats: z.string().nullable(),
  sources: z.array(researchSourceSchema),
  targetMinutes: z.number().nullable(),
  report: scriptReportSchema.nullable(),
});
export type ScriptDocument = z.infer<typeof scriptDocumentSchema>;

export const scriptSaveRequestSchema = z.strictObject({ text: z.string().max(MAX_SCRIPT_CHARS) });

const noPayload = z.null();
const stageRequest = z.strictObject({ stage: pipelineStageKeySchema });

export const STAGES_IPC = {
  stagesState: { name: 'stages:state', request: noPayload, response: stagesStateSchema },
  /**
   * Queues stages (Run, Redo, Resume) as one group: they run in order once nothing else of the
   * project runs, and the group stops at the first failure.
   */
  stagesRun: {
    name: 'stages:run',
    request: z.strictObject({ stages: z.array(pipelineStageKeySchema).min(1).max(4) }),
    response: stageCommandResultSchema,
  },
  /** Stops the running stage (kills its processes) or drops it from the queue. */
  stagesStop: { name: 'stages:stop', request: stageRequest, response: z.boolean() },
  /** File picker in main: a script (.txt) or a voice-over recording to use instead. */
  stagesReplace: {
    name: 'stages:replace',
    request: z.strictObject({ stage: replaceableStageSchema }),
    response: stageCommandResultSchema,
  },
  /** Opens an output with the system's default app (audio player, Explorer, video player). */
  stagesOpen: {
    name: 'stages:open',
    request: z.strictObject({ artifact: stageArtifactSchema }),
    response: stageCommandResultSchema,
  },
  briefGet: { name: 'brief:get', request: noPayload, response: briefResultSchema },
  briefSave: { name: 'brief:save', request: briefInputSchema, response: stageCommandResultSchema },
  scriptGet: { name: 'script:get', request: noPayload, response: scriptDocumentSchema },
  /** Autosave of the script editor (commits are coalesced in main). */
  scriptSave: {
    name: 'script:save',
    request: scriptSaveRequestSchema,
    response: stageCommandResultSchema,
  },
  /** The acceptance gate: later stages wait for it. */
  scriptApprove: { name: 'script:approve', request: noPayload, response: stageCommandResultSchema },
} as const;

export const STAGES_PUSH = {
  stagesChanged: { name: 'stages:changed', payload: stagesStateSchema },
} as const;

export interface StagesApi {
  getStagesState(): Promise<StagesState>;
  runStages(stages: readonly PipelineStageKey[]): Promise<StageCommandResult>;
  stopStage(stage: PipelineStageKey): Promise<boolean>;
  replaceStage(stage: ReplaceableStage): Promise<StageCommandResult>;
  openStageArtifact(artifact: StageArtifact): Promise<StageCommandResult>;
  getBrief(): Promise<BriefResult>;
  saveBrief(brief: BriefInput): Promise<StageCommandResult>;
  getScript(): Promise<ScriptDocument>;
  saveScript(text: string): Promise<StageCommandResult>;
  approveScript(): Promise<StageCommandResult>;
  /** Subscribes to stage state pushes; returns the unsubscribe function. */
  onStagesChanged(listener: (state: StagesState) => void): () => void;
}

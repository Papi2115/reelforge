/**
 * IPC payloads of the video export (PLAN.md#4.7 in the app, the dialog and queue PLAN.md#9.1, the
 * YouTube extras PLAN.md#9.2): the dialog's options (presets with their integer scale factor, the
 * last choices), the export queue with per-shot progress and final reports, the encoder test, the
 * output folder picker and the progress pushes. Merged into the registry of ipc-contract.ts.
 */
import {
  ENCODER_PREFERENCES,
  EXPORT_PRESET_CHOICES,
  EXPORT_QUALITY_PROFILES,
} from '@reelforge/shared';
import { z } from 'zod';

export const EXPORT_PRESETS = EXPORT_PRESET_CHOICES;
const MAX_WORKERS = 64;
const MAX_VIDEO_SECONDS = 3 * 60 * 60;

/** Legacy one-shot export (render tests, the sidebar's Video exported stage). */
export const exportStartRequestSchema = z.strictObject({
  /** Default 1080p30. */
  preset: z.enum(EXPORT_PRESETS).optional(),
  /** Overrides the encoder of the settings for this export. */
  encoder: z.enum(ENCODER_PREFERENCES).optional(),
  /** `draft`: faster encoder settings; `high`: slower, bigger. Default `final`. */
  quality: z.enum(['final', 'draft', 'high']).optional(),
  /** Overrides the render workers of the settings (hidden render windows). */
  workers: z.int().min(1).max(32).optional(),
  /** Thumbnail time (s); null = no thumbnail; default the middle of the first shot. */
  thumbnailAt: z.number().min(0).max(MAX_VIDEO_SECONDS).nullable().optional(),
});
export type ExportStartRequest = z.infer<typeof exportStartRequestSchema>;

export const exportOutcomeSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('done'),
    output: z.string(),
    thumbnail: z.string().nullable(),
    renderedShots: z.array(z.string()),
    cachedShots: z.array(z.string()),
    totalFrames: z.int(),
    durationS: z.number(),
    width: z.int(),
    height: z.int(),
    encoder: z.string(),
    gpu: z.string().nullable(),
    resumed: z.boolean(),
    wallMs: z.number(),
    /** What the user should know about this export (the switch to the CPU encoder). */
    warnings: z.array(z.string()),
  }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('busy') }),
  z.object({ status: z.literal('no-project') }),
  z.object({ status: z.literal('failed'), kind: z.string(), message: z.string() }),
]);
export type ExportOutcome = z.infer<typeof exportOutcomeSchema>;

/** Mirrors `ExportProgress` of @reelforge/pipeline (frame events are throttled by main). */
export const exportProgressSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('plan'),
    shots: z.int(),
    cachedShots: z.int(),
    totalFrames: z.int(),
    framesToRender: z.int(),
    workers: z.int(),
    encoder: z.string(),
    resumed: z.boolean(),
  }),
  z.object({
    type: z.literal('source'),
    worker: z.int(),
    gpu: z.string().nullable(),
    software: z.boolean(),
  }),
  z.object({ type: z.literal('shot-start'), shotId: z.string(), frames: z.int(), worker: z.int() }),
  z.object({
    type: z.literal('frame'),
    shotId: z.string(),
    frameInShot: z.int(),
    shotFrames: z.int(),
    renderedFrames: z.int(),
    framesToRender: z.int(),
    fps: z.number(),
    etaS: z.number().nullable(),
  }),
  z.object({ type: z.literal('shot-done'), shotId: z.string(), cached: z.boolean() }),
  z.object({ type: z.literal('mux') }),
  z.object({ type: z.literal('thumbnail') }),
  z.object({ type: z.literal('done'), output: z.string() }),
]);
export type ExportProgressEvent = z.infer<typeof exportProgressSchema>;

/** One export of the dialog (main resolves the folder; `fileName` is sanitized there). */
export const exportJobRequestSchema = z.strictObject({
  preset: z.enum(EXPORT_PRESETS),
  encoder: z.enum(ENCODER_PREFERENCES),
  quality: z.enum(EXPORT_QUALITY_PROFILES),
  workers: z.int().min(1).max(MAX_WORKERS),
  fileName: z.string().trim().min(1).max(200),
  includeChapters: z.boolean(),
  includeThumbnail: z.boolean(),
  /** Thumbnail frame (s); null = the middle of the first shot. */
  thumbnailAt: z.number().min(0).max(MAX_VIDEO_SECONDS).nullable(),
});
export type ExportJobRequest = z.infer<typeof exportJobRequestSchema>;

export const presetOptionSchema = z.object({
  id: z.enum(EXPORT_PRESETS),
  label: z.string(),
  width: z.int(),
  height: z.int(),
  /** Integer upscale of the render size; null when the preset is not a whole multiple. */
  factor: z.int().nullable(),
  /** Why the preset cannot be used with this style (null = usable). */
  problem: z.string().nullable(),
});
export type PresetOption = z.infer<typeof presetOptionSchema>;

export const exportOptionsSchema = z.object({
  projectDir: z.string().nullable(),
  title: z.string(),
  /** `<safe title>.mp4`. */
  defaultFileName: z.string(),
  /** Absolute folder the MP4 goes to; `custom` = chosen in the dialog (else `<project>/out`). */
  outputDir: z.string(),
  customOutputDir: z.boolean(),
  /** Render size of the project's style; null when the project cannot be rendered yet. */
  render: z.object({ width: z.int(), height: z.int(), style: z.string() }).nullable(),
  presets: z.array(presetOptionSchema),
  cores: z.int().min(1),
  /** The last choices (settings); workers `auto` resolved by the dialog. */
  defaults: z.object({
    preset: z.enum(EXPORT_PRESETS),
    encoder: z.enum(ENCODER_PREFERENCES),
    quality: z.enum(EXPORT_QUALITY_PROFILES),
    workers: z.union([z.literal('auto'), z.int().min(1).max(MAX_WORKERS)]),
    includeChapters: z.boolean(),
    includeThumbnail: z.boolean(),
  }),
  /** chapters.txt as it would be written, or why there are none. */
  chapters: z.object({ text: z.string().nullable(), problem: z.string().nullable() }),
  /** Default thumbnail time (s): the middle of the first shot. */
  thumbnailDefaultS: z.number().nullable(),
  /** Things that stop an export now (no storyboard / scenes). */
  blockers: z.array(z.string()),
  /** Things worth knowing (no mix: silent video; the mix is out of date). */
  warnings: z.array(z.string()),
});
export type ExportOptions = z.infer<typeof exportOptionsSchema>;

export const EXPORT_JOB_STATUSES = [
  'queued',
  'running',
  'done',
  'failed',
  'cancelled',
  'interrupted',
] as const;
export const exportJobStatusSchema = z.enum(EXPORT_JOB_STATUSES);
export type ExportJobStatus = z.infer<typeof exportJobStatusSchema>;

export const shotProgressSchema = z.object({
  id: z.string(),
  frames: z.int(),
  done: z.int(),
  state: z.enum(['rendering', 'done', 'cached']),
});
export type ShotProgress = z.infer<typeof shotProgressSchema>;

export const exportReportSchema = z.object({
  output: z.string(),
  durationS: z.number(),
  sizeBytes: z.number(),
  /** Rendered frames per wall-clock second of the render phase (null: everything cached). */
  avgFps: z.number().nullable(),
  encoder: z.string(),
  gpu: z.string().nullable(),
  totalShots: z.int(),
  renderedShots: z.int(),
  cachedShots: z.int(),
  wallMs: z.number(),
  resumed: z.boolean(),
  width: z.int(),
  height: z.int(),
  /** Extra files written next to the export (project-relative when inside it). */
  extras: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type ExportReport = z.infer<typeof exportReportSchema>;

export const exportJobSchema = z.object({
  id: z.string(),
  request: exportJobRequestSchema,
  /** Absolute path of the MP4. */
  output: z.string(),
  status: exportJobStatusSchema,
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  progress: z.object({
    percent: z.number().min(0).max(100),
    label: z.string(),
    etaS: z.number().nullable(),
    fps: z.number().nullable(),
    totalShots: z.int(),
    shots: z.array(shotProgressSchema),
    /** A warning of the running export for the status line (GPU encoder fell back to CPU). */
    warning: z.string().nullable(),
  }),
  report: exportReportSchema.nullable(),
  /** What failed and what to do about it. */
  error: z.object({ kind: z.string(), message: z.string(), hint: z.string() }).nullable(),
});
export type ExportJob = z.infer<typeof exportJobSchema>;

export const exportQueueStateSchema = z.object({
  projectDir: z.string().nullable(),
  jobs: z.array(exportJobSchema),
  /** An export the app did not finish (crash, quit): its finished shots are cached. */
  interrupted: z
    .object({ output: z.string(), preset: z.string(), finishedShots: z.int(), totalShots: z.int() })
    .nullable(),
});
export type ExportQueueState = z.infer<typeof exportQueueStateSchema>;

export const exportEnqueueResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('queued'), id: z.string() }),
  z.object({ status: z.literal('invalid'), message: z.string() }),
]);
export type ExportEnqueueResult = z.infer<typeof exportEnqueueResultSchema>;

export const encoderTestResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    /** The encoder an export would use (the fallback when the chosen one failed). */
    encoder: z.string(),
    hardware: z.boolean(),
    probes: z.array(z.object({ encoder: z.string(), ok: z.boolean(), detail: z.string() })),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type EncoderTestResult = z.infer<typeof encoderTestResultSchema>;

export const exportFolderResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), outputDir: z.string(), custom: z.boolean() }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ExportFolderResult = z.infer<typeof exportFolderResultSchema>;

const jobIdRequest = z.strictObject({ id: z.string().min(1).max(64) });

export const EXPORT_IPC = {
  /** Exports the open project to out/<title>.mp4; resolves when the export ends. */
  exportStart: {
    name: 'export:start',
    request: exportStartRequestSchema,
    response: exportOutcomeSchema,
  },
  /** Cancels the running export; false when none runs. */
  exportCancel: { name: 'export:cancel', request: z.null(), response: z.boolean() },
  /** What the export dialog shows (presets with scale factors, last choices, chapters). */
  exportOptions: { name: 'export:options', request: z.null(), response: exportOptionsSchema },
  exportQueue: { name: 'export:queue', request: z.null(), response: exportQueueStateSchema },
  exportEnqueue: {
    name: 'export:enqueue',
    request: exportJobRequestSchema,
    response: exportEnqueueResultSchema,
  },
  exportCancelJob: { name: 'export:cancel-job', request: jobIdRequest, response: z.boolean() },
  /** Queues a cancelled / failed / interrupted job again (finished shots come from the cache). */
  exportResumeJob: {
    name: 'export:resume-job',
    request: jobIdRequest,
    response: exportEnqueueResultSchema,
  },
  /** Resumes the export the app did not finish last time (`interrupted` of the queue state). */
  exportResumeInterrupted: {
    name: 'export:resume-interrupted',
    request: z.null(),
    response: exportEnqueueResultSchema,
  },
  /** One real test encode with the chosen encoder (and the fallback order). */
  exportTestEncoder: {
    name: 'export:test-encoder',
    request: z.strictObject({ encoder: z.enum(ENCODER_PREFERENCES) }),
    response: encoderTestResultSchema,
  },
  /** Folder picker in main (`reset`: back to `<project>/out`). */
  exportPickFolder: {
    name: 'export:pick-folder',
    request: z.strictObject({ reset: z.boolean() }),
    response: exportFolderResultSchema,
  },
  /** Opens the folder of a finished job (or the output folder) in the file manager. */
  exportOpenFolder: {
    name: 'export:open-folder',
    request: z.strictObject({ id: z.string().min(1).max(64).nullable() }),
    response: z.object({ status: z.enum(['ok', 'error']), message: z.string().nullable() }),
  },
} as const;

export const EXPORT_PUSH = {
  exportProgress: { name: 'export:progress', payload: exportProgressSchema },
  exportQueueChanged: { name: 'export:queue-changed', payload: exportQueueStateSchema },
} as const;

export interface ExportApi {
  startExport(request: ExportStartRequest): Promise<ExportOutcome>;
  cancelExport(): Promise<boolean>;
  /** Subscribes to export progress; returns the unsubscribe function. */
  onExportProgress(listener: (event: ExportProgressEvent) => void): () => void;
  getExportOptions(): Promise<ExportOptions>;
  getExportQueue(): Promise<ExportQueueState>;
  enqueueExport(request: ExportJobRequest): Promise<ExportEnqueueResult>;
  cancelExportJob(id: string): Promise<boolean>;
  resumeExportJob(id: string): Promise<ExportEnqueueResult>;
  resumeInterruptedExport(): Promise<ExportEnqueueResult>;
  testEncoder(encoder: ExportJobRequest['encoder']): Promise<EncoderTestResult>;
  pickExportFolder(reset: boolean): Promise<ExportFolderResult>;
  openExportFolder(id: string | null): Promise<{ status: 'ok' | 'error'; message: string | null }>;
  onExportQueueChanged(listener: (state: ExportQueueState) => void): () => void;
}

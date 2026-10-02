/**
 * IPC payloads of the video export (PLAN.md#4.7 in the app; the dialog is PLAN.md#9.1): start an
 * export of the open project, cancel it, and progress pushes (the pipeline's ExportProgress).
 * Merged into the registry of ipc-contract.ts.
 */
import { ENCODER_PREFERENCES } from '@reelforge/shared';
import { z } from 'zod';

export const EXPORT_PRESETS = ['1080p30', '1440p', '4k'] as const;

export const exportStartRequestSchema = z.strictObject({
  /** Default 1080p30. */
  preset: z.enum(EXPORT_PRESETS).optional(),
  /** Overrides the encoder of the settings for this export. */
  encoder: z.enum(ENCODER_PREFERENCES).optional(),
  /** `draft`: faster encoder settings. Default `final`. */
  quality: z.enum(['final', 'draft']).optional(),
  /** Overrides the render workers of the settings (hidden render windows). */
  workers: z.int().min(1).max(32).optional(),
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

export const EXPORT_IPC = {
  /** Exports the open project to out/<title>.mp4; resolves when the export ends. */
  exportStart: {
    name: 'export:start',
    request: exportStartRequestSchema,
    response: exportOutcomeSchema,
  },
  /** Cancels the running export; false when none runs. */
  exportCancel: { name: 'export:cancel', request: z.null(), response: z.boolean() },
} as const;

export const EXPORT_PUSH = {
  exportProgress: { name: 'export:progress', payload: exportProgressSchema },
} as const;

export interface ExportApi {
  startExport(request: ExportStartRequest): Promise<ExportOutcome>;
  cancelExport(): Promise<boolean>;
  /** Subscribes to export progress; returns the unsubscribe function. */
  onExportProgress(listener: (event: ExportProgressEvent) => void): () => void;
}

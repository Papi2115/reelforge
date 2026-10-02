/**
 * IPC payloads of the whisper.cpp setup (Settings → Tools, the Words timed "Download and continue"
 * and the first-run "Prepare tools" step): engine status (installs, version, CUDA), the models,
 * whether the Words stage can run, and one install job at a time with progress pushes. Merged into
 * the registry of ipc-contract.ts. Main owns every path: the renderer names jobs and models.
 */
import { settingsWhisperModelSchema, type SettingsWhisperModel } from '@reelforge/shared';
import { z } from 'zod';

const bytes = z.number().nonnegative();

export const whisperJobSchema = z.discriminatedUnion('kind', [
  /** The app's whisper.cpp build(s): CUDA + OpenBLAS with an NVIDIA GPU, else OpenBLAS. */
  z.object({ kind: z.literal('engine') }),
  /** One model (plus the voice-activity model when missing). */
  z.object({ kind: z.literal('model'), model: settingsWhisperModelSchema }),
  /** Everything Words timed still needs with the chosen model (engine, VAD model, model). */
  z.object({ kind: z.literal('setup') }),
]);
export type WhisperJob = z.infer<typeof whisperJobSchema>;

export const WHISPER_PARTS = ['engine', 'vad', 'model'] as const;
export type WhisperPart = (typeof WHISPER_PARTS)[number];

export const cudaStatusSchema = z.enum(['available', 'unavailable', 'absent', 'unknown']);

export const whisperInstallInfoSchema = z.object({
  path: z.string(),
  /** `cuda` / `blas` / `cpu` for the app's builds, `custom` for the user's own. */
  backend: z.string(),
  source: z.enum(['configured', 'env', 'app-data']),
  version: z.string().nullable(),
  cuda: cudaStatusSchema,
  /** Why CUDA cannot be used (as printed by whisper.cpp), else null. */
  cudaReason: z.string().nullable(),
});
export type WhisperInstallInfo = z.infer<typeof whisperInstallInfoSchema>;

export const whisperEngineSchema = z.object({
  installs: z.array(whisperInstallInfoSchema),
  /** Why nothing usable was found (e.g. the chosen path is wrong), else null. */
  problem: z.string().nullable(),
  /** The user chose a whisper-cli (Browse… / Use existing). */
  configured: z.boolean(),
  /** What Install downloads on this machine and how much (0 when it is installed already). */
  installBackends: z.array(z.enum(['cuda', 'blas', 'cpu'])),
  installBytes: bytes,
  /** whisper.cpp builds found elsewhere that can be used instead ("Use existing …"). */
  existing: z.array(z.object({ path: z.string(), source: z.enum(['env', 'path', 'common-dir']) })),
  /** Where the app installs whisper.cpp and the models. */
  root: z.string(),
});
export type WhisperEngine = z.infer<typeof whisperEngineSchema>;

export const whisperReadinessSchema = z.object({
  ready: z.boolean(),
  /** The model Words timed uses (Settings → Tools). */
  model: settingsWhisperModelSchema,
  missing: z.array(z.enum(WHISPER_PARTS)),
  /** Download size of the `setup` job. */
  bytes,
});
export type WhisperReadiness = z.infer<typeof whisperReadinessSchema>;

export const whisperProgressSchema = z.object({
  job: whisperJobSchema,
  phase: z.enum(['running', 'done', 'failed', 'cancelled']),
  /** Current step, e.g. "Downloading whisper.cpp (CUDA build)" (null before the first one). */
  label: z.string().nullable(),
  step: z.int().min(0),
  steps: z.int().min(0),
  /** Whole job. */
  receivedBytes: bytes,
  totalBytes: bytes,
  bytesPerSecond: bytes.nullable(),
  etaS: bytes.nullable(),
  /** Failure: what to do about it (offline, disk full, antivirus, …). */
  message: z.string().nullable(),
  /** Failure: the technical error. */
  detail: z.string().nullable(),
});
export type WhisperProgress = z.infer<typeof whisperProgressSchema>;

export const whisperStateSchema = z.object({
  engine: whisperEngineSchema,
  models: z.array(z.object({ id: settingsWhisperModelSchema, bytes, installed: z.boolean() })),
  vadInstalled: z.boolean(),
  vadBytes: bytes,
  modelsDir: z.string(),
  /** One-click "Install recommended model". */
  recommended: settingsWhisperModelSchema,
  readiness: whisperReadinessSchema,
  /** The running job's latest progress, else null. */
  job: whisperProgressSchema.nullable(),
});
export type WhisperState = z.infer<typeof whisperStateSchema>;

export const whisperInstallResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('started') }),
  /** Nothing to download. */
  z.object({ status: z.literal('installed') }),
  z.object({ status: z.literal('busy'), job: whisperJobSchema }),
]);
export type WhisperInstallResult = z.infer<typeof whisperInstallResultSchema>;

export const whisperDeleteResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('deleted') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type WhisperDeleteResult = z.infer<typeof whisperDeleteResultSchema>;

export const whisperUseExistingResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), state: whisperStateSchema }),
  z.object({ status: z.literal('invalid'), message: z.string() }),
]);
export type WhisperUseExistingResult = z.infer<typeof whisperUseExistingResultSchema>;

export const WHISPER_IPC = {
  /** `refresh`: re-run detection and the `--version` probes (Re-detect). */
  whisperState: {
    name: 'whisper:state',
    request: z.strictObject({ refresh: z.boolean() }),
    response: whisperStateSchema,
  },
  whisperInstall: {
    name: 'whisper:install',
    request: z.strictObject({ job: whisperJobSchema }),
    response: whisperInstallResultSchema,
  },
  /** Cancels the running job. */
  whisperCancel: { name: 'whisper:cancel', request: z.null(), response: z.null() },
  whisperDelete: {
    name: 'whisper:delete',
    request: z.strictObject({ model: settingsWhisperModelSchema }),
    response: whisperDeleteResultSchema,
  },
  /** Saves one of `engine.existing` (only those) as the whisper-cli to use. */
  whisperUseExisting: {
    name: 'whisper:use-existing',
    request: z.strictObject({ path: z.string().min(1).max(4_096) }),
    response: whisperUseExistingResultSchema,
  },
} as const;

export const WHISPER_PUSH = {
  /** Install job progress / end. */
  whisperProgress: { name: 'whisper:progress', payload: whisperProgressSchema },
} as const;

/** Whisper part of `window.reelforge`. */
export interface WhisperApi {
  getWhisperState(refresh: boolean): Promise<WhisperState>;
  installWhisper(job: WhisperJob): Promise<WhisperInstallResult>;
  cancelWhisperInstall(): Promise<null>;
  deleteWhisperModel(model: SettingsWhisperModel): Promise<WhisperDeleteResult>;
  useExistingWhisper(path: string): Promise<WhisperUseExistingResult>;
  /** Subscribes to install progress; returns the unsubscribe function. */
  onWhisperProgress(listener: (progress: WhisperProgress) => void): () => void;
}

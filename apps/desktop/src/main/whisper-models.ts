/**
 * Whisper model manager behind Settings (PLAN.md#6.7): lists the downloadable ggml models,
 * downloads one at a time through `WhisperManager` (hash-verified, `.part` + rename, progress
 * pushed to the renderer), cancels and deletes. The Silero VAD model every transcription needs is
 * fetched together with the first model.
 */
import { rm } from 'node:fs/promises';
import {
  WHISPER_MODEL_IDS,
  WhisperManager,
  nodeFileSystem,
  type DownloadProgress,
  type InstallOptions,
  type Result,
  type WhisperError,
  type WhisperModelId,
} from '@reelforge/pipeline';
import type {
  WhisperDeleteResult,
  WhisperDownloadResult,
  WhisperModelsState,
  WhisperProgress,
} from '../shared/settings-contract.js';
import { describeError, type Logger } from './logger.js';

/** Download sizes of the ggml files (Hugging Face), for the UI only. */
export const WHISPER_MODEL_APPROX_BYTES: Readonly<Record<WhisperModelId, number>> = {
  'large-v3-turbo-q5_0': 574_000_000,
  small: 488_000_000,
  medium: 1_530_000_000,
  base: 148_000_000,
};

export interface WhisperModelStore {
  readonly modelsDir: string;
  hasModel(model: WhisperModelId): boolean;
  hasVadModel(): boolean;
  installModel(
    model: WhisperModelId,
    options: InstallOptions,
  ): Promise<Result<string, WhisperError>>;
  installVadModel(options: InstallOptions): Promise<Result<string, WhisperError>>;
  /** Removes the model file and its verification marker. */
  deleteModel(model: WhisperModelId): Promise<void>;
}

export function whisperModelStore(manager: WhisperManager): WhisperModelStore {
  return {
    modelsDir: manager.modelsDir,
    hasModel: (model) => manager.hasModel(model),
    hasVadModel: () => nodeFileSystem.isFile(manager.vadModelPath()),
    installModel: (model, options) => manager.installModel(model, options),
    installVadModel: (options) => manager.installVadModel(options),
    deleteModel: async (model) => {
      const file = manager.modelPath(model);
      await rm(file, { force: true });
      await rm(`${file}.verified`, { force: true });
    },
  };
}

export interface WhisperModelsServiceOptions {
  readonly store: WhisperModelStore;
  readonly push: (progress: WhisperProgress) => void;
  readonly log: Logger;
  /** Monotonic ms clock (progress throttling). */
  readonly now: () => number;
  /** Minimum gap between two `downloading` pushes. Default 150 ms. */
  readonly progressIntervalMs?: number;
}

interface Job {
  readonly model: WhisperModelId;
  readonly controller: AbortController;
  readonly done: Promise<void>;
}

export class WhisperModelsService {
  private job: Job | undefined;

  constructor(private readonly options: WhisperModelsServiceOptions) {}

  state(): WhisperModelsState {
    const { store } = this.options;
    return {
      modelsDir: store.modelsDir,
      models: WHISPER_MODEL_IDS.map((id) => ({
        id,
        approxBytes: WHISPER_MODEL_APPROX_BYTES[id],
        installed: store.hasModel(id),
      })),
      vadInstalled: store.hasVadModel(),
      downloading: this.job?.model ?? null,
    };
  }

  download(model: WhisperModelId): WhisperDownloadResult {
    if (this.job !== undefined) return { status: 'busy', downloading: this.job.model };
    const { store } = this.options;
    if (store.hasModel(model) && store.hasVadModel()) return { status: 'installed' };
    const controller = new AbortController();
    const done = this.run(model, controller.signal).finally(() => {
      this.job = undefined;
    });
    this.job = { model, controller, done };
    return { status: 'started' };
  }

  cancel(model: WhisperModelId): void {
    if (this.job?.model === model) this.job.controller.abort();
  }

  async delete(model: WhisperModelId): Promise<WhisperDeleteResult> {
    if (this.job?.model === model) {
      return { status: 'error', message: `${model} is downloading; cancel it first` };
    }
    try {
      await this.options.store.deleteModel(model);
      this.options.log.info(`deleted whisper model ${model}`);
      return { status: 'deleted' };
    } catch (error) {
      return { status: 'error', message: `cannot delete ${model}: ${describeError(error)}` };
    }
  }

  /** Aborts the running download (app quit). */
  abortAll(): void {
    this.job?.controller.abort();
  }

  /** Resolves when no download is running (tests, shutdown). */
  async whenIdle(): Promise<void> {
    await this.job?.done;
  }

  private async run(model: WhisperModelId, signal: AbortSignal): Promise<void> {
    const { store, push, log } = this.options;
    let last: WhisperProgress = {
      model,
      phase: 'downloading',
      asset: model,
      receivedBytes: 0,
      totalBytes: null,
    };
    push(last);
    let lastPushAt = this.options.now();
    const onProgress = (progress: DownloadProgress): void => {
      last = {
        model,
        phase: 'downloading',
        asset: progress.asset,
        receivedBytes: progress.receivedBytes,
        totalBytes: progress.totalBytes,
      };
      const now = this.options.now();
      if (now - lastPushAt < (this.options.progressIntervalMs ?? 150)) return;
      lastPushAt = now;
      push(last);
    };
    const steps: (() => Promise<Result<string, WhisperError>>)[] = [];
    if (!store.hasVadModel()) steps.push(() => store.installVadModel({ signal, onProgress }));
    if (!store.hasModel(model)) steps.push(() => store.installModel(model, { signal, onProgress }));
    for (const step of steps) {
      const result = await step().catch((error: unknown): Result<string, WhisperError> => ({
        ok: false,
        error: { kind: 'io', message: describeError(error), path: store.modelsDir },
      }));
      if (!result.ok) {
        const cancelled = signal.aborted || result.error.kind === 'cancelled';
        push({ ...last, phase: cancelled ? 'cancelled' : 'failed', message: result.error.message });
        if (!cancelled) log.warn(`whisper model ${model} download failed: ${result.error.message}`);
        return;
      }
    }
    log.info(`whisper model ${model} installed`);
    push({ ...last, phase: 'done' });
  }
}

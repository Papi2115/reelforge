/**
 * whisper.cpp setup behind Settings → Tools, the Words timed "Download and continue" and the
 * first-run "Prepare tools" (PLAN.md#6.7, 4.3): one install job at a time (engine build(s), the
 * VAD model, a ggml model, or everything Words timed still needs), hash-verified downloads with
 * progress (bytes, speed, time left) pushed to the renderer, cancel, model delete, and "use the
 * whisper-cli found at …". Failures carry an actionable message (install-failure.ts).
 */
import { rm } from 'node:fs/promises';
import {
  WHISPER_MODEL_IDS,
  DEFAULT_WHISPER_MODEL,
  type DiscoveredWhisper,
  type DownloadProgress,
  type InstallRequest,
  type InstallStep,
  type WhisperManager,
  type WhisperModelId,
} from '@reelforge/pipeline';
import type {
  WhisperDeleteResult,
  WhisperInstallResult,
  WhisperJob,
  WhisperProgress,
  WhisperState,
  WhisperUseExistingResult,
} from '../../shared/whisper-contract.js';
import { describeError, type Logger } from '../logger.js';
import { installFailure } from './install-failure.js';
import { TransferMeter } from './transfer-meter.js';
import { WhisperProbeCache, engineStatus, totalBytes, wordsReadiness } from './whisper-engine.js';

export interface WhisperSetupOptions {
  /** A manager for the current settings (the configured whisper-cli may change). */
  readonly manager: () => WhisperManager;
  /** The model Words timed uses. */
  readonly model: () => WhisperModelId;
  /** The user chose a whisper-cli. */
  readonly configured: () => boolean;
  /** Saves a whisper-cli path (validated by the caller); the reason when it was refused. */
  readonly saveConfiguredPath: (cliPath: string | null) => Promise<string | undefined>;
  readonly discover: () => DiscoveredWhisper[];
  /** Free bytes on the drive of `dir` (null = unknown). */
  readonly freeBytes: (dir: string) => Promise<number | null>;
  readonly push: (progress: WhisperProgress) => void;
  readonly log: Logger;
  /** Monotonic ms clock. */
  readonly now: () => number;
  /** Minimum gap between two running pushes. Default 150 ms. */
  readonly progressIntervalMs?: number;
  /** Test hook: Words timed counts as ready (recorded transcriptions, no whisper root). */
  readonly assumeReady?: boolean;
}

/** The release zips unpack to about 2.2× their size; the zip is deleted afterwards. */
const UNPACK_FACTOR = 2.2;

interface RunningJob {
  readonly job: WhisperJob;
  readonly controller: AbortController;
  done: Promise<void>;
  last: WhisperProgress;
}

function stepName(step: InstallStep): string {
  const { part } = step;
  if (part.kind === 'engine')
    return `whisper.cpp (${part.backend === 'cuda' ? 'CUDA' : 'CPU'} build)`;
  return part.kind === 'vad' ? 'the voice-activity model' : `the ${part.model} model`;
}

export class WhisperSetupService {
  private running: RunningJob | undefined;
  private readonly probes = new WhisperProbeCache();

  constructor(private readonly options: WhisperSetupOptions) {}

  async state(refresh: boolean): Promise<WhisperState> {
    if (refresh) this.probes.clear();
    const manager = this.options.manager();
    const model = this.options.model();
    const readiness = await wordsReadiness(manager, model);
    return {
      engine: await engineStatus({
        manager,
        configured: this.options.configured(),
        discovered: this.options.discover(),
        probes: this.probes,
      }),
      models: WHISPER_MODEL_IDS.map((id) => ({
        id,
        bytes: manager.asset({ kind: 'model', model: id }).bytes,
        installed: manager.hasModel(id),
      })),
      vadInstalled: manager.hasVadModel(),
      vadBytes: manager.asset({ kind: 'vad' }).bytes,
      modelsDir: manager.modelsDir,
      recommended: DEFAULT_WHISPER_MODEL,
      readiness:
        this.options.assumeReady === true
          ? { ready: true, model, missing: [], bytes: 0 }
          : readiness,
      job: this.running?.last ?? null,
    };
  }

  private request(job: WhisperJob, manager: WhisperManager): InstallRequest {
    switch (job.kind) {
      case 'engine':
        return { engine: true, vad: false, model: null };
      case 'model':
        return { engine: false, vad: true, model: job.model };
      case 'setup':
        return { engine: !manager.locate().ok, vad: true, model: this.options.model() };
    }
  }

  private busyWith(): WhisperJob | undefined {
    return this.running?.job;
  }

  async install(job: WhisperJob): Promise<WhisperInstallResult> {
    const busy = this.busyWith();
    if (busy !== undefined) return { status: 'busy', job: busy };
    const manager = this.options.manager();
    const steps = await manager.planInstall(this.request(job, manager));
    // Checked again: planning awaits (nvidia-smi), another request may have started meanwhile.
    const started = this.busyWith();
    if (started !== undefined) return { status: 'busy', job: started };
    if (steps.length === 0) return { status: 'installed' };
    const controller = new AbortController();
    const first: WhisperProgress = {
      job,
      phase: 'running',
      label: null,
      step: 0,
      steps: steps.length,
      receivedBytes: 0,
      totalBytes: totalBytes(steps),
      bytesPerSecond: null,
      etaS: null,
      message: null,
      detail: null,
    };
    const running: RunningJob = {
      job,
      controller,
      last: first,
      done: Promise.resolve(),
    };
    this.running = running;
    this.options.push(first);
    running.done = this.run(running, manager, steps)
      .catch((error: unknown) => {
        this.finish(running, 'failed', {
          message: `Installing whisper.cpp failed: ${describeError(error)}`,
          detail: describeError(error),
        });
      })
      .finally(() => {
        if (this.running === running) this.running = undefined;
      });
    return { status: 'started' };
  }

  /** Cancels the running job (any). */
  cancel(): void {
    this.running?.controller.abort();
  }

  async delete(model: WhisperModelId): Promise<WhisperDeleteResult> {
    const job = this.running?.job;
    if (
      job !== undefined &&
      (job.kind === 'setup' || (job.kind === 'model' && job.model === model))
    )
      return { status: 'error', message: `${model} is downloading; cancel it first` };
    const file = this.options.manager().modelPath(model);
    try {
      await rm(file, { force: true });
      await rm(`${file}.verified`, { force: true });
      this.options.log.info(`deleted whisper model ${model}`);
      return { status: 'deleted' };
    } catch (error) {
      return { status: 'error', message: `cannot delete ${model}: ${describeError(error)}` };
    }
  }

  async useExisting(cliPath: string): Promise<WhisperUseExistingResult> {
    const key = cliPath.toLowerCase();
    const found = this.options.discover().find((entry) => entry.cliPath.toLowerCase() === key);
    if (found === undefined) {
      return { status: 'invalid', message: 'That whisper-cli was not found by auto-detection.' };
    }
    const refused = await this.options.saveConfiguredPath(found.cliPath);
    if (refused !== undefined) return { status: 'invalid', message: refused };
    this.options.log.info(`whisper-cli set to the existing ${found.cliPath} (${found.source})`);
    return { status: 'saved', state: await this.state(true) };
  }

  /** Aborts the running job (app quit). */
  abortAll(): void {
    this.running?.controller.abort();
  }

  /** Resolves when no job runs (tests, shutdown). */
  async whenIdle(): Promise<void> {
    await this.running?.done;
  }

  private publish(running: RunningJob, next: Partial<WhisperProgress>, force: boolean): void {
    running.last = { ...running.last, ...next };
    if (force) this.options.push(running.last);
  }

  private finish(
    running: RunningJob,
    phase: 'done' | 'failed' | 'cancelled',
    failure?: { message: string; detail: string },
  ): void {
    this.publish(
      running,
      {
        phase,
        bytesPerSecond: null,
        etaS: null,
        message: failure?.message ?? null,
        detail: failure?.detail ?? null,
      },
      true,
    );
  }

  private async enoughSpace(
    running: RunningJob,
    manager: WhisperManager,
    steps: InstallStep[],
  ): Promise<boolean> {
    const engineBytes = totalBytes(steps.filter((step) => step.part.kind === 'engine'));
    const needed = Math.round(totalBytes(steps) + engineBytes * UNPACK_FACTOR);
    const free = await this.options.freeBytes(manager.root);
    if (free === null || free >= needed) return true;
    const gb = (value: number): string => `${(value / 1e9).toFixed(1)} GB`;
    this.finish(running, 'failed', {
      message: `Not enough free disk space for whisper.cpp in ${manager.root}: about ${gb(needed)} needed, ${gb(free)} free. Free up some space and try again.`,
      detail: `free ${String(free)} B < needed ${String(needed)} B`,
    });
    return false;
  }

  private async run(
    running: RunningJob,
    manager: WhisperManager,
    steps: InstallStep[],
  ): Promise<void> {
    const { log } = this.options;
    if (!(await this.enoughSpace(running, manager, steps))) return;
    const signal = running.controller.signal;
    const meter = new TransferMeter();
    const interval = this.options.progressIntervalMs ?? 150;
    let doneBytes = 0;
    let lastPushAt = Number.NEGATIVE_INFINITY;
    for (const [index, step] of steps.entries()) {
      const name = stepName(step);
      this.publish(running, { step: index + 1, label: `Downloading ${name}` }, true);
      let unpacking = false;
      const onProgress = (progress: DownloadProgress): void => {
        const now = this.options.now();
        const received = doneBytes + Math.min(progress.receivedBytes, step.asset.bytes);
        const estimate = meter.sample(now, received, running.last.totalBytes);
        const complete = progress.ratio === 1 && step.part.kind === 'engine';
        const label = complete ? `Unpacking ${name}` : `Downloading ${name}`;
        const force = complete && !unpacking;
        unpacking ||= complete;
        this.publish(running, { receivedBytes: received, label, ...estimate }, false);
        if (force || now - lastPushAt >= interval) {
          lastPushAt = now;
          this.options.push(running.last);
        }
      };
      const result = await manager.installStep(step, { signal, onProgress });
      if (!result.ok) {
        const cancelled = signal.aborted || result.error.kind === 'cancelled';
        if (cancelled) {
          this.finish(running, 'cancelled');
          return;
        }
        log.warn(`whisper install (${step.asset.name}) failed: ${result.error.message}`);
        this.finish(running, 'failed', installFailure(result.error, manager.root));
        return;
      }
      doneBytes += step.asset.bytes;
      this.publish(running, { receivedBytes: doneBytes }, false);
    }
    this.probes.clear();
    if (steps.some((step) => step.part.kind === 'engine')) await this.dropBrokenPath();
    log.info(`whisper install done: ${steps.map((step) => step.asset.name).join(', ')}`);
    this.finish(running, 'done');
  }

  /** A configured whisper-cli that does not work would hide the build just installed. */
  private async dropBrokenPath(): Promise<void> {
    if (!this.options.configured() || this.options.manager().locate().ok) return;
    this.options.log.warn('the chosen whisper-cli does not work: back to the installed build');
    await this.options.saveConfiguredPath(null);
  }
}

/**
 * ElevenLabs voice generation for the Voiceover step (PLAN.md#13.14, ADR-033), Electron-free:
 * the panel state, the cost estimate (quota read only when a key exists; offline = "quota
 * unknown"), Generate (progress pushes, Cancel, resumable: the engine saves the takes manifest
 * after every take), "Redo this sentence" with its shot impact, and the key test of a channel.
 * A finished run hands the assembled file to the Voiceover step like a manual import, so the
 * previous take is archived and later steps become out of date the same way (vo-swap.ts). One
 * voice job at a time.
 */
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import {
  calibrateCosts,
  chunkCharBudget,
  estimateCost,
  formatCount,
  pendingCharacters,
  planVoiceChunks,
  type ElevenLabsSubscription,
  type FfmpegManager,
  type QuotaSnapshot,
} from '@reelforge/pipeline';
import type { StageCommandResult } from '../../shared/stages-contract.js';
import type {
  VoiceEstimateResult,
  VoiceGenerateResult,
  VoiceProgress,
  VoiceRetakeResult,
  VoiceState,
  VoiceTestKeyResult,
} from '../../shared/voice-contract.js';
import type { ChannelSecretStore } from '../channels/channel-secrets.js';
import type { Logger } from '../logger.js';
import {
  channelKey,
  createClient,
  voiceAccess,
  voiceSetup,
  type ClientFactoryOptions,
} from './voice-access.js';
import { problem, voiceProblem } from './voice-errors.js';
import {
  apiWords,
  readVoiceProject,
  scriptChangedSince,
  usesGeneratedVoice,
  type VoiceProject,
} from './voice-project.js';
import { runGenerate, runRetake, type VoiceJob, type VoiceRunDeps } from './voice-runs.js';
import { sentenceRows } from './voice-sentences.js';
import { generationSettings, outputFormatFor } from './voice-settings.js';

export interface VoiceServiceOptions extends ClientFactoryOptions {
  readonly channelsFile: string;
  readonly secrets: Pick<ChannelSecretStore, 'get' | 'has'>;
  readonly store: PipelineStateStore;
  /** ffmpeg for mp3 takes; null when it is not configured (pcm takes need none). */
  readonly ffmpeg: () => Promise<Pick<FfmpegManager, 'run'> | null>;
  /** Queues the Voiceover step of `dir` with `file` (the app's import). */
  readonly importVoiceover: (dir: string, file: string) => Promise<StageCommandResult>;
  /** The Voiceover step runs or waits in `dir`. */
  readonly voiceoverBusy: (dir: string) => boolean;
  /** Path-limited autocommit (failures are the caller's warnings). */
  readonly commit: (dir: string, message: string, paths: readonly string[]) => Promise<void>;
  readonly push: (progress: VoiceProgress) => void;
  readonly log: Logger;
}

/** Quick answers for the estimate and the key test: two attempts, not five. */
const QUICK_RETRY = { maxAttempts: 2 } as const;

function quota(subscription: ElevenLabsSubscription): QuotaSnapshot {
  return {
    characterCount: subscription.characterCount,
    characterLimit: subscription.characterLimit,
    nextResetUnix: subscription.nextResetUnix,
  };
}

function resetDate(unixSeconds: number | null): string | null {
  return unixSeconds === null ? null : new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function lastTakeFormat(project: VoiceProject): string | null {
  return project.manifest?.takes.at(-1)?.outputFormat ?? null;
}

export class VoiceService {
  #job: VoiceJob | null = null;

  constructor(private readonly options: VoiceServiceOptions) {}

  async state(dir: string | undefined): Promise<VoiceState> {
    if (dir === undefined) {
      return {
        setup: { status: 'unavailable', message: 'No project is open.' },
        generated: false,
        scriptChanged: false,
        audioFile: null,
        sentences: [],
        running: null,
      };
    }
    const project = await this.read(dir);
    const generated = usesGeneratedVoice(project);
    const scriptChanged = scriptChangedSince(project);
    const script = generated && !scriptChanged ? project.scriptText : null;
    return {
      setup: await voiceSetup(project, this.options.secrets),
      generated,
      scriptChanged,
      audioFile: generated ? (project.record?.file ?? null) : null,
      sentences: script === null ? [] : sentenceRows(script, project.manifest, await apiWords(dir)),
      running: this.#job?.dir === dir ? this.#job.progress : null,
    };
  }

  async estimate(dir: string | undefined): Promise<VoiceEstimateResult> {
    if (dir === undefined) return problem('no-project', 'No project is open.');
    const project = await this.read(dir);
    const access = await voiceAccess(project, this.options.secrets);
    if (!access.ok) return access.error;
    const { channel, voiceId, key, scriptText } = access.value;
    const client = createClient(key, this.options, undefined, QUICK_RETRY);
    const subscription = await client.getSubscription();
    if (!subscription.ok && subscription.error.kind === 'auth') {
      return voiceProblem(subscription.error, key);
    }
    const quotaNote = subscription.ok
      ? null
      : `Quota unknown: ${voiceProblem(subscription.error, key).message}`;
    const tier = subscription.ok ? subscription.value.tier : null;
    const settings = generationSettings(
      voiceId,
      channel.voice,
      outputFormatFor(tier, lastTakeFormat(project)),
    );
    const pending = await pendingCharacters(dir, scriptText, settings);
    if (!pending.ok) return voiceProblem(pending.error, key);
    const plan = planVoiceChunks(scriptText, chunkCharBudget(settings.modelId));
    const characters = plan.ok ? plan.value.reduce((sum, chunk) => sum + chunk.characters, 0) : 0;
    const estimate = estimateCost({
      characters: pending.value.characters,
      modelId: settings.modelId,
      quota: subscription.ok ? quota(subscription.value) : null,
      calibration: calibrateCosts(project.manifest?.takes ?? []),
    });
    return {
      status: 'ok',
      characters,
      pendingCharacters: pending.value.characters,
      paragraphs: pending.value.chunks + pending.value.reused,
      reusedParagraphs: pending.value.reused,
      estimatedCredits: estimate.estimatedCredits,
      remaining: estimate.remaining,
      share: estimate.shareOfRemaining,
      summary: estimate.summary,
      warning: estimate.warning,
      quotaNote,
    };
  }

  generate(dir: string | undefined): Promise<VoiceGenerateResult> {
    return this.runJob(dir, 'generating', (deps) => runGenerate(deps));
  }

  retake(dir: string | undefined, sentenceId: string): Promise<VoiceRetakeResult> {
    return this.runJob(dir, 'retaking', (deps) => runRetake(deps, sentenceId));
  }

  /** Stops the running job (what is finished is kept); false when none runs. */
  cancel(): boolean {
    if (this.#job === null) return false;
    this.#job.controller.abort();
    return true;
  }

  async testKey(channelId: string): Promise<VoiceTestKeyResult> {
    const key = await channelKey(this.options.secrets, channelId);
    if (!key.ok) return key.error;
    const client = createClient(key.value, this.options, undefined, QUICK_RETRY);
    const subscription = await client.getSubscription();
    if (!subscription.ok) {
      this.options.log.warn(`key test of channel ${channelId}: ${subscription.error.kind}`);
      return voiceProblem(subscription.error, key.value);
    }
    const { tier, characterCount, characterLimit, nextResetUnix } = subscription.value;
    const remaining = Math.max(0, characterLimit - characterCount);
    this.options.log.info(
      `key test of channel ${channelId}: ok (${tier}, ${formatCount(remaining)} characters left)`,
    );
    return {
      status: 'ok',
      tier,
      remaining,
      limit: characterLimit,
      resetsOn: resetDate(nextResetUnix),
    };
  }

  private read(dir: string): Promise<VoiceProject> {
    return readVoiceProject(dir, this.options.channelsFile, this.options.store);
  }

  private async runJob<T extends { readonly status: string }>(
    dir: string | undefined,
    phase: VoiceProgress['phase'],
    run: (deps: VoiceRunDeps) => Promise<T | ReturnType<typeof problem>>,
  ): Promise<T | ReturnType<typeof problem>> {
    if (dir === undefined) return problem('no-project', 'No project is open.');
    if (this.#job !== null || this.options.voiceoverBusy(dir)) {
      return problem('busy', 'The voice-over is already being made or imported: wait for it.');
    }
    const project = await this.read(dir);
    const access = await voiceAccess(project, this.options.secrets);
    if (!access.ok) return access.error;
    const job: VoiceJob = {
      dir,
      controller: new AbortController(),
      progress: {
        projectDir: dir,
        phase,
        done: 0,
        total: 0,
        characters: 0,
        costSoFar: 0,
        note: null,
        finished: false,
      },
    };
    this.#job = job;
    const update = (patch: Partial<VoiceProgress>): void => {
      job.progress = { ...job.progress, ...patch };
      this.options.push(job.progress);
    };
    update({});
    try {
      return await run({
        options: this.options,
        project,
        access: access.value,
        job,
        update,
        ffmpeg: await this.options.ffmpeg(),
      });
    } finally {
      this.#job = null;
      update({ finished: true, note: null });
    }
  }
}

/**
 * The two paid voice runs (PLAN.md#13.14): Generate (the whole script, unchanged paragraphs reused)
 * and Retake (the paragraph holding one sentence). Each: preflight the account (tier -> output
 * format and concurrency), hold the current vo.original.wav aside, run the engine with progress and
 * Cancel, put the old file back, commit the API word times (path-limited), then queue the
 * Voiceover step with the assembled file — the same import a manual file gets.
 */
import {
  chunkCharBudget,
  concurrencyForTier,
  createTakeDecoder,
  formatCount,
  generateVoiceover,
  pickOutputFormat,
  planVoiceChunks,
  retakeSentence,
  voiceModelSpec,
  type ElevenLabsClient,
  type FfmpegManager,
  type VoiceClientEvent,
  type VoiceError,
  type VoiceGenerationSettings,
} from '@reelforge/pipeline';
import type {
  VoiceGenerateResult,
  VoiceProblem,
  VoiceProgress,
  VoiceRetakeResult,
} from '../../shared/voice-contract.js';
import { describeError } from '../logger.js';
import { createClient, type VoiceAccess } from './voice-access.js';
import { problem, retryNote, voiceProblem } from './voice-errors.js';
import { storyboardShots, usesGeneratedVoice, type VoiceProject } from './voice-project.js';
import type { VoiceServiceOptions } from './voice-service.js';
import { generationSettings } from './voice-settings.js';
import { holdOriginal, releaseOriginal, type HeldVoiceover } from './vo-swap.js';

export interface VoiceJob {
  readonly dir: string;
  readonly controller: AbortController;
  progress: VoiceProgress;
}

export interface VoiceRunDeps {
  readonly options: VoiceServiceOptions;
  readonly project: VoiceProject;
  readonly access: VoiceAccess;
  readonly job: VoiceJob;
  readonly update: (patch: Partial<VoiceProgress>) => void;
  readonly ffmpeg: Pick<FfmpegManager, 'run'> | null;
}

interface Prepared {
  readonly client: ElevenLabsClient;
  readonly settings: VoiceGenerationSettings;
  /** Characters per chunk id (progress: characters sent so far). */
  readonly chunkCharacters: ReadonlyMap<string, number>;
}

const CANCELLED_MESSAGE =
  'Stopped. Paragraphs already made are kept: Generate again continues without paying for them.';

/** Account preflight: the tier picks the format and the concurrency (a bad key stops here). */
async function prepare(deps: VoiceRunDeps): Promise<Prepared | VoiceProblem> {
  const { access, job, update } = deps;
  const onEvent = (event: VoiceClientEvent): void => {
    update({ note: retryNote(event.error, event.delayMs) });
  };
  const client = createClient(access.key, deps.options, onEvent);
  const subscription = await client.getSubscription(job.controller.signal);
  if (!subscription.ok) return voiceProblem(subscription.error, access.key);
  client.limiter.setMax(concurrencyForTier(subscription.value.tier));
  const settings = generationSettings(
    access.voiceId,
    access.channel.voice,
    pickOutputFormat(subscription.value.tier),
  );
  const plan = planVoiceChunks(access.scriptText, chunkCharBudget(settings.modelId));
  const chunkCharacters = new Map(
    (plan.ok ? plan.value : []).map((chunk) => [chunk.id, chunk.characters]),
  );
  update({ total: chunkCharacters.size });
  return { client, settings, chunkCharacters };
}

function isProblem(value: Prepared | VoiceProblem): value is VoiceProblem {
  return 'status' in value;
}

/** Holds vo.original.wav, runs `engine`, puts the old file back; the assembled file or null. */
async function swapped<T>(
  dir: string,
  engine: () => Promise<{ ok: true; value: T } | { ok: false; error: VoiceError }>,
): Promise<
  | { ok: true; value: T; file: string | null }
  | { ok: false; error: VoiceError }
  | { ok: false; io: string }
> {
  let hold: HeldVoiceover;
  try {
    hold = await holdOriginal(dir);
  } catch (error) {
    return { ok: false, io: `cannot set the current voice-over aside: ${describeError(error)}` };
  }
  const result = await engine();
  let file: string | null;
  try {
    file = await releaseOriginal(hold, result.ok);
  } catch (error) {
    return { ok: false, io: `cannot put the voice-over back: ${describeError(error)}` };
  }
  return result.ok ? { ok: true, value: result.value, file } : result;
}

/** Commit of the API word times + the Voiceover step import of the assembled file. */
async function handOver(
  deps: VoiceRunDeps,
  file: string | null,
  wordsFile: string | null,
  message: string,
): Promise<VoiceProblem | null> {
  const { options, job, update } = deps;
  if (wordsFile !== null) await options.commit(job.dir, message, [wordsFile]);
  if (file === null) return problem('failed', 'The engine did not write a voice-over file.');
  update({ phase: 'importing', note: null });
  const imported = await options.importVoiceover(job.dir, file);
  if (imported.status === 'error') {
    return problem(
      'failed',
      `The voice-over was made but not imported: ${imported.message ?? 'unknown error'}. Generate again imports it without new costs.`,
    );
  }
  return null;
}

function failure(
  result: { ok: false; error: VoiceError } | { ok: false; io: string },
  deps: VoiceRunDeps,
): VoiceProblem | { status: 'cancelled'; message: string } {
  if ('io' in result) return problem('failed', `Voice generation failed: ${result.io}.`);
  if (result.error.kind === 'aborted' || deps.job.controller.signal.aborted) {
    return { status: 'cancelled', message: CANCELLED_MESSAGE };
  }
  deps.options.log.warn(`voice run failed: ${result.error.kind}`);
  return voiceProblem(result.error, deps.access.key);
}

export async function runGenerate(deps: VoiceRunDeps): Promise<VoiceGenerateResult> {
  const prepared = await prepare(deps);
  if (isProblem(prepared)) return prepared;
  const { client, settings, chunkCharacters } = prepared;
  const multiplier = voiceModelSpec(settings.modelId).costMultiplier;
  let sent = 0;
  const result = await swapped(deps.job.dir, () =>
    generateVoiceover({
      projectDir: deps.job.dir,
      scriptText: deps.access.scriptText,
      settings,
      client,
      decoder: createTakeDecoder(deps.ffmpeg),
      signal: deps.job.controller.signal,
      onProgress: (progress) => {
        if (!progress.reused) sent += chunkCharacters.get(progress.chunkId) ?? 0;
        deps.update({
          done: progress.done,
          total: progress.total,
          characters: sent,
          costSoFar: Math.ceil(sent * multiplier),
          note: null,
        });
      },
    }),
  );
  if (!result.ok) return failure(result, deps);
  const voice = result.value;
  deps.options.log.info(
    `voice generated: ${String(voice.generatedChunkIds.length)} paragraph(s) new, ${String(voice.reusedChunkIds.length)} reused, ${String(voice.characters)} characters`,
  );
  const handed = await handOver(
    deps,
    result.file,
    voice.wordsFile,
    'Voiceover generated (ElevenLabs)',
  );
  if (handed !== null) return handed;
  const made = voice.generatedChunkIds.length;
  return {
    status: 'ok',
    generatedParagraphs: made,
    reusedParagraphs: voice.reusedChunkIds.length,
    characters: voice.characters,
    message:
      made === 0
        ? 'Nothing changed: every paragraph was already generated.'
        : `Generated ${String(made)} paragraph${made === 1 ? '' : 's'} (${formatCount(voice.characters)} characters).`,
  };
}

export async function runRetake(
  deps: VoiceRunDeps,
  sentenceId: string,
): Promise<VoiceRetakeResult> {
  if (!usesGeneratedVoice(deps.project)) {
    return problem(
      'failed',
      'The voice-over in use is not the generated one: Generate with ElevenLabs first.',
    );
  }
  const prepared = await prepare(deps);
  if (isProblem(prepared)) return prepared;
  const shots = await storyboardShots(deps.job.dir);
  deps.update({ done: 0, total: 1 });
  const result = await swapped(deps.job.dir, () =>
    retakeSentence({
      projectDir: deps.job.dir,
      scriptText: deps.access.scriptText,
      sentenceId,
      settings: prepared.settings,
      client: prepared.client,
      decoder: createTakeDecoder(deps.ffmpeg),
      shots,
      signal: deps.job.controller.signal,
    }),
  );
  if (!result.ok) return failure(result, deps);
  const retake = result.value;
  const characters = retake.take.characters;
  deps.update({
    done: 1,
    characters,
    costSoFar: Math.ceil(characters * voiceModelSpec(prepared.settings.modelId).costMultiplier),
  });
  deps.options.log.info(
    `voice retake of ${sentenceId}: ${String(retake.impact.changedShotIds.length)} shot(s) changed`,
  );
  const handed = await handOver(
    deps,
    result.file,
    retake.wordsFile,
    `Voiceover: sentence ${sentenceId} redone (ElevenLabs)`,
  );
  if (handed !== null) return handed;
  return {
    status: 'ok',
    sentenceIds: [...retake.sentenceIds],
    changedShotIds: [...retake.impact.changedShotIds],
    shiftedShotIds: [...retake.impact.shiftedShotIds],
    shiftS: retake.impact.shiftS,
    characters,
  };
}

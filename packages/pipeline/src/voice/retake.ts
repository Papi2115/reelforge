/**
 * Retake one sentence (PLAN.md#13.14): the chunk (paragraph) that contains it is generated again
 * with the same neighbours as context (request ids of the active takes before and after it, plus
 * the script text), stored as a new take and made active; vo.original.wav and the API words are
 * re-assembled. Returns which shots the change touches so the caller rebuilds only those scenes
 * (stages are not changed here).
 */
import type { VoiceTake, VoiceTakesFile } from '@reelforge/shared';
import { err, ok, type Result } from '../result.js';
import type { TakeDecoder } from './audio.js';
import { voiceError, type VoiceError } from './errors.js';
import { planWithHashes } from './generate.js';
import { VoiceSession, type SpeechGenerator, type VoiceGenerationSettings } from './session.js';
import { readTakesManifest } from './takes-store.js';

export interface ShotSpan {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
}

export interface TimeRange {
  readonly start: number;
  readonly end: number;
}

export interface ShotImpact {
  /** Shots overlapping the re-spoken chunk: their picture-to-voice timing changed. */
  readonly changedShotIds: readonly string[];
  /** Later shots that only move by `shiftS` (empty when the duration did not change). */
  readonly shiftedShotIds: readonly string[];
  readonly shiftS: number;
}

export interface RetakeOptions {
  readonly projectDir: string;
  readonly scriptText: string;
  readonly sentenceId: string;
  /** Usually the generation settings; a different `seed` gives a different reading. */
  readonly settings: VoiceGenerationSettings;
  readonly client: SpeechGenerator;
  readonly decoder: TakeDecoder;
  /** Storyboard shots (old times) to classify; omitted = no shot impact computed. */
  readonly shots?: readonly ShotSpan[];
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
}

export interface RetakeResult {
  readonly take: VoiceTake;
  readonly chunkId: string;
  /** Sentences spoken by the new take (the whole chunk). */
  readonly sentenceIds: readonly string[];
  readonly before: TimeRange;
  readonly after: TimeRange;
  readonly impact: ShotImpact;
  readonly wordsFile: string | null;
  readonly manifest: VoiceTakesFile;
}

/** Shots touched by replacing `before` with `after` in the voice-over (pure). */
export function shotImpact(
  shots: readonly ShotSpan[],
  before: TimeRange,
  after: TimeRange,
): ShotImpact {
  const shiftS = Math.round((after.end - before.end) * 10_000) / 10_000;
  const changed = shots.filter((shot) => shot.t1 > before.start && shot.t0 < before.end);
  const changedIds = new Set(changed.map((shot) => shot.id));
  const shifted =
    shiftS === 0 ? [] : shots.filter((shot) => !changedIds.has(shot.id) && shot.t0 >= before.end);
  return {
    changedShotIds: changed.map((shot) => shot.id),
    shiftedShotIds: shifted.map((shot) => shot.id),
    shiftS,
  };
}

function stale(message: string): Result<never, VoiceError> {
  return err(voiceError('stale-manifest', `${message}; run Generate first`));
}

export async function retakeSentence(
  options: RetakeOptions,
): Promise<Result<RetakeResult, VoiceError>> {
  const manifest = await readTakesManifest(options.projectDir);
  if (!manifest.ok) return manifest;
  if (manifest.value?.output === null || manifest.value === null)
    return stale('no generated voice-over');
  const current = manifest.value;
  const planned = planWithHashes(options.scriptText, options.settings.modelId);
  if (!planned.ok) return planned;
  const { plan, hashes } = planned.value;
  const matches =
    plan.length === current.chunks.length &&
    current.chunks.every(
      (chunk, index) => chunk.id === plan[index]?.id && chunk.textSha256 === hashes.get(chunk.id),
    );
  if (!matches) return stale('the script changed since the voice-over was generated');
  const index = plan.findIndex((chunk) =>
    chunk.sentences.some((sentence) => sentence.id === options.sentenceId),
  );
  const chunk = plan[index];
  if (chunk === undefined) {
    return err(voiceError('invalid-input', `no sentence ${options.sentenceId} in the script`));
  }
  const old = current.output?.timeline.find((entry) => entry.chunkId === chunk.id);
  if (old === undefined) return stale(`chunk ${chunk.id} is not in the assembled voice-over`);
  const session = new VoiceSession({
    projectDir: options.projectDir,
    plan,
    manifest: current,
    settings: options.settings,
    decoder: options.decoder,
    now: options.now ?? (() => new Date()),
  });
  const take = await session.generateTake(index, options.client, options.signal);
  if (!take.ok) return take;
  const assembled = await session.assemble();
  if (!assembled.ok) return assembled;
  const fresh = session.manifest.output?.timeline.find((entry) => entry.chunkId === chunk.id);
  const before = { start: old.start, end: old.end };
  const after = { start: fresh?.start ?? old.start, end: fresh?.end ?? old.end };
  return ok({
    take: take.value,
    chunkId: chunk.id,
    sentenceIds: chunk.sentences.map((sentence) => sentence.id),
    before,
    after,
    impact: shotImpact(options.shots ?? [], before, after),
    wordsFile: assembled.value.wordsFile,
    manifest: session.manifest,
  });
}

/**
 * Working state shared by Generate and Retake (PLAN.md#13.14): the chunk plan, the manifest being
 * updated, decoded takes, and the three steps both need: stitching context for a chunk, one new
 * take for a chunk, and assembling vo.original.wav (+ API words) from the active takes.
 */
import { rm } from 'node:fs/promises';
import type { TtsVoiceSettings, VoicePauses, VoiceTake, VoiceTakesFile } from '@reelforge/shared';
import { WordsFileSchema } from '../schemas/words.js';
import { writeJsonAtomic } from '../schemas/json-file.js';
import { err, ok, type Result } from '../result.js';
import { alignmentToWords, buildApiWordsFile, type PlacedChunkWords } from './alignment.js';
import { assembleTimeline, writeTimelineWav, type DecodedTake, type TakeDecoder } from './audio.js';
import type { ElevenLabsClient, GenerateSpeechRequest } from './client.js';
import { voiceError, type VoiceError } from './errors.js';
import { MAX_STITCH_IDS, REQUEST_ID_TTL_MS, voiceModelSpec } from './models.js';
import { contextAfter, contextBefore, type VoiceChunkPlan } from './script-chunks.js';
import {
  VOICE_FILES,
  projectPath,
  readTakeAlignment,
  storeTake,
  writeTakesManifest,
} from './takes-store.js';

export const DEFAULT_VOICE_PAUSES: VoicePauses = { paragraphS: 0.6, sentenceS: 0.25 };

export interface VoiceGenerationSettings {
  readonly voiceId: string;
  readonly modelId: string;
  readonly voiceSettings: TtsVoiceSettings;
  readonly seed: number | null;
  /** e.g. `pickOutputFormat(subscription.tier)`. */
  readonly outputFormat: string;
  /** Ask for character alignment (`/with-timestamps`). */
  readonly withTimestamps: boolean;
  readonly pauses: VoicePauses;
  /** `request-ids` = previous/next request ids + text fallback; `text` = context text only. */
  readonly stitching: 'request-ids' | 'text';
  /** Parallel requests; only used with `text` stitching (request ids need the previous take). */
  readonly parallel: number;
}

export type SpeechGenerator = Pick<ElevenLabsClient, 'generate'>;

export interface VoiceSessionInput {
  readonly projectDir: string;
  readonly plan: readonly VoiceChunkPlan[];
  readonly manifest: VoiceTakesFile;
  readonly settings: VoiceGenerationSettings;
  readonly decoder: TakeDecoder;
  readonly now: () => Date;
}

export class VoiceSession {
  readonly projectDir: string;
  readonly plan: readonly VoiceChunkPlan[];
  readonly settings: VoiceGenerationSettings;
  manifest: VoiceTakesFile;
  readonly #decoder: TakeDecoder;
  readonly #decoded = new Map<string, DecodedTake>();
  readonly #now: () => Date;
  #writing: Promise<Result<VoiceTakesFile, VoiceError>> | null = null;

  constructor(input: VoiceSessionInput) {
    this.projectDir = input.projectDir;
    this.plan = input.plan;
    this.manifest = input.manifest;
    this.settings = input.settings;
    this.#decoder = input.decoder;
    this.#now = input.now;
  }

  activeTake(chunkId: string): VoiceTake | undefined {
    const chunk = this.manifest.chunks.find((candidate) => candidate.id === chunkId);
    if (chunk?.activeTakeId === null || chunk === undefined) return undefined;
    return this.manifest.takes.find((take) => take.id === chunk.activeTakeId);
  }

  /** Writes the current manifest; writes are queued so the newest state always lands last. */
  save(): Promise<Result<VoiceTakesFile, VoiceError>> {
    const previous = this.#writing ?? Promise.resolve(ok(this.manifest));
    const next = previous.then(() => writeTakesManifest(this.projectDir, this.manifest));
    this.#writing = next;
    return next;
  }

  async decode(take: VoiceTake): Promise<Result<DecodedTake, VoiceError>> {
    const cached = this.#decoded.get(take.id);
    if (cached !== undefined) return ok(cached);
    const decoded = await this.#decoder.decode(projectPath(this.projectDir, take.file));
    if (decoded.ok) this.#decoded.set(take.id, decoded.value);
    return decoded;
  }

  /** Fresh request ids (< 2 h, same voice/model) of the active takes of `chunks`, in order. */
  #requestIds(chunks: readonly VoiceChunkPlan[]): string[] {
    const nowMs = this.#now().getTime();
    return chunks
      .map((chunk) => this.activeTake(chunk.id))
      .filter(
        (take): take is VoiceTake =>
          take !== undefined &&
          take.requestId !== null &&
          take.voiceId === this.settings.voiceId &&
          take.modelId === this.settings.modelId &&
          nowMs - Date.parse(take.createdAt) < REQUEST_ID_TTL_MS,
      )
      .map((take) => take.requestId ?? '');
  }

  /** Stitching fields for chunk `index`: neighbours' request ids (<= 3 per side) + context text. */
  stitchFields(
    index: number,
  ): Pick<
    GenerateSpeechRequest,
    'previousText' | 'nextText' | 'previousRequestIds' | 'nextRequestIds'
  > {
    const useIds =
      this.settings.stitching === 'request-ids' && voiceModelSpec(this.settings.modelId).stitching;
    const before = this.plan.slice(Math.max(0, index - MAX_STITCH_IDS), index);
    const after = this.plan.slice(index + 1, index + 1 + MAX_STITCH_IDS);
    return {
      previousText: contextBefore(this.plan, index),
      nextText: contextAfter(this.plan, index),
      previousRequestIds: useIds ? this.#requestIds(before) : [],
      nextRequestIds: useIds ? this.#requestIds(after) : [],
    };
  }

  /** Generates, stores and activates a new take of chunk `index`; saves the manifest. */
  async generateTake(
    index: number,
    client: SpeechGenerator,
    signal: AbortSignal | undefined,
  ): Promise<Result<VoiceTake, VoiceError>> {
    const chunk = this.plan[index];
    if (chunk === undefined) return err(voiceError('invalid-input', `no chunk ${String(index)}`));
    const { settings } = this;
    const speech = await client.generate(
      {
        voiceId: settings.voiceId,
        text: chunk.text,
        modelId: settings.modelId,
        outputFormat: settings.outputFormat,
        voiceSettings: settings.voiceSettings,
        seed: settings.seed,
        withTimestamps: settings.withTimestamps,
        ...this.stitchFields(index),
      },
      signal,
    );
    if (!speech.ok) return speech;
    const stored = await storeTake(this.projectDir, this.manifest.takes, {
      chunkId: chunk.id,
      text: chunk.text,
      characters: chunk.characters,
      voiceId: settings.voiceId,
      modelId: settings.modelId,
      voiceSettings: settings.voiceSettings,
      seed: settings.seed,
      outputFormat: settings.outputFormat,
      ...speech.value,
      createdAt: this.#now().toISOString(),
    });
    if (!stored.ok) return stored;
    const decoded = await this.#decoder.decode(projectPath(this.projectDir, stored.value.file));
    if (!decoded.ok) return decoded;
    const take: VoiceTake = {
      ...stored.value,
      durationS: decoded.value.samples.length / decoded.value.sampleRate,
    };
    this.#decoded.set(take.id, decoded.value);
    this.manifest = {
      ...this.manifest,
      takes: [...this.manifest.takes, take],
      chunks: this.manifest.chunks.map((entry) =>
        entry.id === chunk.id ? { ...entry, activeTakeId: take.id } : entry,
      ),
      output: null,
    };
    const saved = await this.save();
    return saved.ok ? ok(take) : saved;
  }

  #pauseBefore(chunk: VoiceChunkPlan): number {
    if (chunk.join === 'start') return 0;
    return chunk.join === 'paragraph'
      ? this.settings.pauses.paragraphS
      : this.settings.pauses.sentenceS;
  }

  /**
   * vo.original.wav from the active takes + words.elevenlabs.json when every take has an
   * alignment (otherwise a stale one is removed). Updates `manifest.output` and saves.
   */
  async assemble(): Promise<Result<{ wordsFile: string | null }, VoiceError>> {
    const takes: VoiceTake[] = [];
    const pieces = [];
    for (const chunk of this.plan) {
      const take = this.activeTake(chunk.id);
      if (take === undefined)
        return err(voiceError('invalid-input', `chunk ${chunk.id} has no take`));
      const decoded = await this.decode(take);
      if (!decoded.ok) return decoded;
      takes.push(take);
      pieces.push({ samples: decoded.value.samples, pauseBeforeS: this.#pauseBefore(chunk) });
    }
    const timeline = assembleTimeline(pieces);
    const outputPath = projectPath(this.projectDir, VOICE_FILES.original);
    const sha256 = await writeTimelineWav(outputPath, timeline);
    if (!sha256.ok) return sha256;
    const wordsFile = await this.#writeApiWords(takes, timeline.spans);
    if (!wordsFile.ok) return wordsFile;
    this.manifest = {
      ...this.manifest,
      output: {
        file: VOICE_FILES.original,
        sha256: sha256.value,
        sampleRate: timeline.sampleRate,
        durationS: timeline.samples.length / timeline.sampleRate,
        timeline: takes.map((take, index) => ({
          chunkId: take.chunkId,
          takeId: take.id,
          start: timeline.spans[index]?.start ?? 0,
          end: timeline.spans[index]?.end ?? 0,
        })),
      },
    };
    const saved = await this.save();
    return saved.ok ? ok({ wordsFile: wordsFile.value }) : saved;
  }

  async #writeApiWords(
    takes: readonly VoiceTake[],
    spans: readonly { readonly start: number }[],
  ): Promise<Result<string | null, VoiceError>> {
    const target = projectPath(this.projectDir, VOICE_FILES.apiWords);
    const placed: PlacedChunkWords[] = [];
    for (const [index, chunk] of this.plan.entries()) {
      const take = takes[index];
      const alignment =
        take === undefined ? ok(null) : await readTakeAlignment(this.projectDir, take);
      if (!alignment.ok) return alignment;
      if (alignment.value === null) {
        await rm(target, { force: true });
        return ok(null);
      }
      const words = alignmentToWords(chunk.text, alignment.value);
      if (!words.ok) return words;
      placed.push({ chunk, offsetS: spans[index]?.start ?? 0, words: words.value });
    }
    const file = buildApiWordsFile(placed, this.settings.modelId);
    if (!file.ok) return file;
    const written = await writeJsonAtomic(target, WordsFileSchema, file.value);
    return written.ok ? ok(VOICE_FILES.apiWords) : err(voiceError('io', written.error.message));
  }
}

/**
 * Voiceover "Generate" (PLAN.md#13.14): approved script -> ElevenLabs takes, paragraph by
 * paragraph -> `audio/vo.original.wav` (+ `timing/words.elevenlabs.json` when alignment was asked
 * for). Chunks whose text, voice, model, settings and format did not change keep their take (no
 * request, no cost). Requests run in order by default so each can be stitched to the previous ones;
 * the manifest is saved after every take, so an interrupted run never loses a paid take.
 */
import { stat } from 'node:fs/promises';
import {
  VOICE_TAKES_FILE_VERSION,
  type VoiceChunk,
  type VoiceTake,
  type VoiceTakesFile,
} from '@reelforge/shared';
import { err, ok, type Result } from '../result.js';
import type { TakeDecoder } from './audio.js';
import { voiceError, type VoiceError } from './errors.js';
import { chunkCharBudget, voiceModelSpec } from './models.js';
import { planVoiceChunks, type VoiceChunkPlan } from './script-chunks.js';
import { VoiceSession, type SpeechGenerator, type VoiceGenerationSettings } from './session.js';
import {
  VOICE_FILES,
  projectPath,
  readTakesManifest,
  sameVoiceSettings,
  sha256Text,
} from './takes-store.js';

export interface VoiceProgress {
  readonly chunkId: string;
  /** Chunks finished so far (generated or reused), including this one. */
  readonly done: number;
  readonly total: number;
  readonly reused: boolean;
}

export interface GenerateVoiceoverOptions {
  readonly projectDir: string;
  readonly scriptText: string;
  readonly settings: VoiceGenerationSettings;
  readonly client: SpeechGenerator;
  readonly decoder: TakeDecoder;
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
  readonly onProgress?: (progress: VoiceProgress) => void;
}

export interface VoiceoverResult {
  readonly manifest: VoiceTakesFile;
  /** Project-relative vo.original.wav. */
  readonly outputFile: string;
  /** Project-relative words.elevenlabs.json, null without alignment. */
  readonly wordsFile: string | null;
  readonly generatedChunkIds: readonly string[];
  readonly reusedChunkIds: readonly string[];
  /** Characters sent in this run. */
  readonly characters: number;
  /** Sum of `character-cost` headers of this run; null when no response had one. */
  readonly characterCost: number | null;
}

/** Chunks of the script with their content hash (what Generate and Retake compare). */
export function planWithHashes(
  scriptText: string,
  modelId: string,
): Result<{ plan: VoiceChunkPlan[]; hashes: Map<string, string> }, VoiceError> {
  const plan = planVoiceChunks(scriptText, chunkCharBudget(modelId));
  if (!plan.ok) return plan;
  return ok({
    plan: plan.value,
    hashes: new Map(plan.value.map((chunk) => [chunk.id, sha256Text(chunk.text)])),
  });
}

function reusable(
  take: VoiceTake | undefined,
  hash: string,
  settings: VoiceGenerationSettings,
): boolean {
  return (
    take !== undefined &&
    take.textSha256 === hash &&
    take.voiceId === settings.voiceId &&
    take.modelId === settings.modelId &&
    take.outputFormat === settings.outputFormat &&
    take.seed === settings.seed &&
    sameVoiceSettings(take.voiceSettings, settings.voiceSettings) &&
    (!settings.withTimestamps || take.alignmentFile !== null)
  );
}

async function fileExists(projectDir: string, relative: string): Promise<boolean> {
  return stat(projectPath(projectDir, relative)).then(
    (info) => info.isFile(),
    () => false,
  );
}

/** Manifest for the new plan: all old takes kept, chunks re-planned, reusable takes active. */
async function startManifest(
  projectDir: string,
  scriptText: string,
  plan: readonly VoiceChunkPlan[],
  hashes: ReadonlyMap<string, string>,
  settings: VoiceGenerationSettings,
  previous: VoiceTakesFile | null,
): Promise<VoiceTakesFile> {
  const chunks: VoiceChunk[] = [];
  for (const chunk of plan) {
    const hash = hashes.get(chunk.id) ?? '';
    const old = previous?.chunks.find((candidate) => candidate.id === chunk.id);
    const take = previous?.takes.find((candidate) => candidate.id === old?.activeTakeId);
    const keep =
      reusable(take, hash, settings) &&
      take !== undefined &&
      (await fileExists(projectDir, take.file));
    chunks.push({
      id: chunk.id,
      paragraph: chunk.paragraph,
      part: chunk.part,
      sentenceIds: chunk.sentences.map((sentence) => sentence.id),
      firstWord: chunk.firstWord,
      wordCount: chunk.wordCount,
      textSha256: hash,
      activeTakeId: keep ? take.id : null,
    });
  }
  return {
    version: VOICE_TAKES_FILE_VERSION,
    provider: 'elevenlabs',
    scriptSha256: sha256Text(scriptText),
    voiceId: settings.voiceId,
    modelId: settings.modelId,
    pauses: settings.pauses,
    chunks,
    takes: previous?.takes ?? [],
    output: null,
  };
}

async function runPool(
  indices: readonly number[],
  parallel: number,
  task: (index: number) => Promise<Result<unknown, VoiceError>>,
): Promise<Result<void, VoiceError>> {
  let next = 0;
  const state: { failure: VoiceError | null } = { failure: null };
  const worker = async (): Promise<void> => {
    while (state.failure === null && next < indices.length) {
      const index = indices[next];
      next += 1;
      if (index === undefined) return;
      const result = await task(index);
      if (!result.ok) state.failure ??= result.error;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, () => worker()));
  return state.failure === null ? ok(undefined) : err(state.failure);
}

export async function generateVoiceover(
  options: GenerateVoiceoverOptions,
): Promise<Result<VoiceoverResult, VoiceError>> {
  const { projectDir, settings } = options;
  if (settings.voiceId.trim() === '') return err(voiceError('invalid-input', 'no voice chosen'));
  const planned = planWithHashes(options.scriptText, settings.modelId);
  if (!planned.ok) return planned;
  const { plan, hashes } = planned.value;
  const previous = await readTakesManifest(projectDir);
  if (!previous.ok) return previous;
  const manifest = await startManifest(
    projectDir,
    options.scriptText,
    plan,
    hashes,
    settings,
    previous.value,
  );
  const now = options.now ?? (() => new Date());
  const session = new VoiceSession({
    projectDir,
    plan,
    manifest,
    settings,
    decoder: options.decoder,
    now,
  });
  const saved = await session.save();
  if (!saved.ok) return saved;

  const missing = plan.flatMap((chunk, index) =>
    session.activeTake(chunk.id) === undefined ? [index] : [],
  );
  const reusedChunkIds = plan
    .filter((_, index) => !missing.includes(index))
    .map((chunk) => chunk.id);
  let done = reusedChunkIds.length;
  reusedChunkIds.forEach((chunkId, index) => {
    options.onProgress?.({ chunkId, done: index + 1, total: plan.length, reused: true });
  });
  const generated: VoiceTake[] = [];
  const parallel =
    settings.stitching === 'text' || !voiceModelSpec(settings.modelId).stitching
      ? settings.parallel
      : 1;
  const pool = await runPool(missing, parallel, async (index) => {
    if (options.signal?.aborted === true) return err(voiceError('aborted', 'cancelled'));
    const take = await session.generateTake(index, options.client, options.signal);
    if (!take.ok) return take;
    generated.push(take.value);
    done += 1;
    options.onProgress?.({ chunkId: take.value.chunkId, done, total: plan.length, reused: false });
    return take;
  });
  if (!pool.ok) return pool;
  const assembled = await session.assemble();
  if (!assembled.ok) return assembled;
  const costs = generated.flatMap((take) =>
    take.characterCost === null ? [] : [take.characterCost],
  );
  return ok({
    manifest: session.manifest,
    outputFile: VOICE_FILES.original,
    wordsFile: assembled.value.wordsFile,
    generatedChunkIds: plan.filter((_, index) => missing.includes(index)).map((chunk) => chunk.id),
    reusedChunkIds,
    characters: generated.reduce((sum, take) => sum + take.characters, 0),
    characterCost: costs.length === 0 ? null : costs.reduce((sum, cost) => sum + cost, 0),
  });
}

/** Characters a Generate run would send (chunks without a reusable take). */
export async function pendingCharacters(
  projectDir: string,
  scriptText: string,
  settings: VoiceGenerationSettings,
): Promise<Result<{ characters: number; chunks: number; reused: number }, VoiceError>> {
  const planned = planWithHashes(scriptText, settings.modelId);
  if (!planned.ok) return planned;
  const previous = await readTakesManifest(projectDir);
  if (!previous.ok) return previous;
  const manifest = await startManifest(
    projectDir,
    scriptText,
    planned.value.plan,
    planned.value.hashes,
    settings,
    previous.value,
  );
  const pending = planned.value.plan.filter((chunk) =>
    manifest.chunks.some((entry) => entry.id === chunk.id && entry.activeTakeId === null),
  );
  return ok({
    characters: pending.reduce((sum, chunk) => sum + chunk.characters, 0),
    chunks: pending.length,
    reused: planned.value.plan.length - pending.length,
  });
}

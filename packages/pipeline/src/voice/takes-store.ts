/**
 * Takes on disk (PLAN.md#13.14): `audio/takes/<takeId>.<mp3|wav>` (never overwritten),
 * `<takeId>.alignment.json` and the `takes.json` manifest (zod schemas in @reelforge/shared,
 * atomic writes, §3.5).
 */
import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  VOICE_ALIGNMENT_FILE_VERSION,
  voiceAlignmentFileSchema,
  voiceTakesFileSchema,
  type TtsVoiceSettings,
  type VoiceCharAlignment,
  type VoiceTake,
  type VoiceTakesFile,
} from '@reelforge/shared';
import { readJsonFile, writeJsonAtomic } from '../schemas/json-file.js';
import { err, ok, type Result } from '../result.js';
import { describeError, voiceError, type VoiceError } from './errors.js';
import { pcmSampleRate, takeExtension } from './models.js';
import { wrapPcm } from './audio.js';

/** Project-relative files (forward slashes). */
export const VOICE_FILES = {
  takesDir: 'audio/takes',
  manifest: 'audio/takes/takes.json',
  original: 'audio/vo.original.wav',
  /** words.json built from the API alignment (the Words timed stage may adopt it, see docs). */
  apiWords: 'timing/words.elevenlabs.json',
} as const;

export function projectPath(projectDir: string, relative: string): string {
  return path.join(projectDir, ...relative.split('/'));
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function exists(filePath: string): Promise<boolean> {
  return stat(filePath).then(
    () => true,
    () => false,
  );
}

/** takes.json, or null when the project has none yet. A broken file is an error (never replaced). */
export async function readTakesManifest(
  projectDir: string,
): Promise<Result<VoiceTakesFile | null, VoiceError>> {
  const file = projectPath(projectDir, VOICE_FILES.manifest);
  if (!(await exists(file))) return ok(null);
  const read = await readJsonFile(file, voiceTakesFileSchema);
  return read.ok ? read : err(voiceError('io', read.error.message));
}

export async function writeTakesManifest(
  projectDir: string,
  manifest: VoiceTakesFile,
): Promise<Result<VoiceTakesFile, VoiceError>> {
  const written = await writeJsonAtomic(
    projectPath(projectDir, VOICE_FILES.manifest),
    voiceTakesFileSchema,
    manifest,
  );
  return written.ok ? written : err(voiceError('io', written.error.message));
}

export function readTakeAlignment(
  projectDir: string,
  take: VoiceTake,
): Promise<Result<VoiceCharAlignment | null, VoiceError>> {
  if (take.alignmentFile === null) return Promise.resolve(ok(null));
  return readJsonFile(projectPath(projectDir, take.alignmentFile), voiceAlignmentFileSchema).then(
    (read) => (read.ok ? ok(read.value.alignment) : err(voiceError('io', read.error.message))),
  );
}

/** Same voice settings (absent fields equal absent fields). */
export function sameVoiceSettings(a: TtsVoiceSettings, b: TtsVoiceSettings): boolean {
  const keys: (keyof TtsVoiceSettings)[] = [
    'stability',
    'similarityBoost',
    'style',
    'speed',
    'useSpeakerBoost',
  ];
  return keys.every((key) => a[key] === b[key]);
}

export interface StoredTakeInput {
  readonly chunkId: string;
  readonly text: string;
  readonly characters: number;
  readonly voiceId: string;
  readonly modelId: string;
  readonly voiceSettings: TtsVoiceSettings;
  readonly seed: number | null;
  readonly outputFormat: string;
  readonly audio: Uint8Array;
  readonly requestId: string | null;
  readonly characterCost: number | null;
  readonly alignment: VoiceCharAlignment | null;
  readonly normalizedAlignment: VoiceCharAlignment | null;
  readonly createdAt: string;
}

/**
 * Writes a new immutable take (the next free number of its chunk; existing files are never
 * overwritten) and its alignment. Returns the record without `durationS` (set after decoding).
 */
export async function storeTake(
  projectDir: string,
  existing: readonly VoiceTake[],
  input: StoredTakeInput,
): Promise<Result<Omit<VoiceTake, 'durationS'>, VoiceError>> {
  const extension = takeExtension(input.outputFormat);
  const rate = pcmSampleRate(input.outputFormat);
  const bytes =
    input.outputFormat.startsWith('pcm_') && rate !== null
      ? wrapPcm(input.audio, rate)
      : input.audio;
  let n =
    1 +
    Math.max(0, ...existing.filter((take) => take.chunkId === input.chunkId).map((take) => take.n));
  try {
    await mkdir(projectPath(projectDir, VOICE_FILES.takesDir), { recursive: true });
    for (; ; n++) {
      const file = `${VOICE_FILES.takesDir}/${input.chunkId}-${String(n)}.${extension}`;
      try {
        await writeFile(projectPath(projectDir, file), bytes, { flag: 'wx' });
        break;
      } catch (error) {
        // A file left by an interrupted run keeps its number; take the next one.
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      }
    }
  } catch (error) {
    return err(
      voiceError('io', `cannot store the take of ${input.chunkId}: ${describeError(error)}`),
    );
  }
  const id = `${input.chunkId}-${String(n)}`;
  let alignmentFile: string | null = null;
  if (input.alignment !== null) {
    alignmentFile = `${VOICE_FILES.takesDir}/${id}.alignment.json`;
    const written = await writeJsonAtomic(
      projectPath(projectDir, alignmentFile),
      voiceAlignmentFileSchema,
      {
        version: VOICE_ALIGNMENT_FILE_VERSION,
        takeId: id,
        alignment: input.alignment,
        normalized: input.normalizedAlignment,
      },
    );
    if (!written.ok) return err(voiceError('io', written.error.message));
  }
  return ok({
    id,
    chunkId: input.chunkId,
    n,
    file: `${VOICE_FILES.takesDir}/${id}.${extension}`,
    textSha256: sha256Text(input.text),
    characters: input.characters,
    voiceId: input.voiceId,
    modelId: input.modelId,
    voiceSettings: input.voiceSettings,
    seed: input.seed,
    outputFormat: input.outputFormat,
    requestId: input.requestId,
    characterCost: input.characterCost,
    alignmentFile,
    createdAt: input.createdAt,
  });
}

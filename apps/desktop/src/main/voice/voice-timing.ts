/**
 * "Voice changed — timing out of date" per shot (ADR-033, docs/voice.md): after "Redo this
 * sentence" the generated voice-over holds a take newer than timing/words.json, so the shots
 * under that paragraph play against stale word times until Audio cleaned + Words timed run again
 * (Re-time). Derived, never stored: the active takes of takes.json newer than the moment
 * words.json was written, located through the (still old) words of their paragraph — the same
 * times the storyboard shots were planned on — or, without those words, the take's place in the
 * assembled voice-over. Applies only while the voice-over in use is the generated one.
 */
import { stat } from 'node:fs/promises';
import { readTakesManifest, WordsFileSchema, type WordsFile } from '@reelforge/pipeline';
import { voiceoverRecordSchema, type VoiceChunk, type VoiceTakesFile } from '@reelforge/shared';
import { FILES, inProject, loadJson } from '@reelforge/stages';
import type { VoiceTiming } from '../../shared/voiceover-contract.js';
import { storyboardShots } from './voice-project.js';

export interface TimedShot {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
}

export interface VoiceTimingInput {
  readonly manifest: VoiceTakesFile | null;
  /** sha256 of the voice-over in use (`.reelforge/voiceover.json`); null without one. */
  readonly voiceoverSha256: string | null;
  /** timing/words.json; null when the words were never timed. */
  readonly words: WordsFile | null;
  /** When timing/words.json was written (epoch ms); null when it does not exist. */
  readonly wordsWrittenMs: number | null;
  readonly shots: readonly TimedShot[];
}

interface Span {
  readonly start: number;
  readonly end: number;
}

/** Where the chunk was spoken when the words were timed (its words), else its place now. */
function chunkSpan(chunk: VoiceChunk, manifest: VoiceTakesFile, words: WordsFile): Span | null {
  const last = chunk.firstWord + chunk.wordCount - 1;
  const inside = words.words.filter((word) => word.i >= chunk.firstWord && word.i <= last);
  const head = inside[0];
  const tail = inside.at(-1);
  if (head !== undefined && tail !== undefined) return { start: head.t, end: tail.tEnd };
  const placed = manifest.output?.timeline.find((entry) => entry.chunkId === chunk.id);
  return placed === undefined ? null : { start: placed.start, end: placed.end };
}

/** The out-of-date timing, or null when the words are newer than every active take (pure). */
export function staleVoiceTiming(input: VoiceTimingInput): VoiceTiming | null {
  const { manifest, words, wordsWrittenMs } = input;
  const output = manifest?.output ?? null;
  if (manifest === null || output === null || words === null || wordsWrittenMs === null) {
    return null;
  }
  if (input.voiceoverSha256 !== output.sha256) return null; // another voice-over is in use
  const changed: { chunk: VoiceChunk; createdAt: string }[] = [];
  for (const chunk of manifest.chunks) {
    const take = manifest.takes.find((candidate) => candidate.id === chunk.activeTakeId);
    if (take !== undefined && Date.parse(take.createdAt) > wordsWrittenMs) {
      changed.push({ chunk, createdAt: take.createdAt });
    }
  }
  if (changed.length === 0) return null;
  const spans = changed
    .map(({ chunk }) => chunkSpan(chunk, manifest, words))
    .filter((span): span is Span => span !== null);
  const shotIds = input.shots
    .filter((shot) => spans.some((span) => shot.t1 > span.start && shot.t0 < span.end))
    .map((shot) => shot.id);
  const newest = changed.reduce((latest, entry) =>
    Date.parse(entry.createdAt) > Date.parse(latest.createdAt) ? entry : latest,
  );
  return {
    shotIds,
    sentenceIds: changed.flatMap(({ chunk }) => chunk.sentenceIds),
    changedAt: new Date(Date.parse(newest.createdAt)).toISOString(),
  };
}

async function modifiedMs(file: string): Promise<number | null> {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return null; // never timed
  }
}

/** Reads what the derivation needs from the project (any missing or invalid file: no marker). */
export async function readVoiceTiming(dir: string): Promise<VoiceTiming | null> {
  const manifest = await readTakesManifest(dir);
  if (!manifest.ok || manifest.value === null || manifest.value.output === null) return null;
  const wordsFile = inProject(dir, FILES.words);
  const [record, words, wordsWrittenMs, shots] = await Promise.all([
    loadJson(inProject(dir, FILES.voiceoverRecord), voiceoverRecordSchema),
    loadJson(wordsFile, WordsFileSchema),
    modifiedMs(wordsFile),
    storyboardShots(dir),
  ]);
  return staleVoiceTiming({
    manifest: manifest.value,
    voiceoverSha256: record.status === 'ok' ? record.value.sha256 : null,
    words: words.status === 'ok' ? words.value : null,
    wordsWrittenMs,
    shots,
  });
}

/**
 * Test-only: spike 03 fixtures (spikes/03-audio/fixtures, SAPI-voice ground truth + whisper
 * turbo-q5 chunk-mode output) and helpers to score an alignment against the truth.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { AlignedWord } from './align.js';
import { calibrateDtw } from '../asr/whisper-output.js';
import type { RawWord } from '../schemas/words.js';

export const SPIKE_DIR = fileURLToPath(new URL('../../../../spikes/03-audio/', import.meta.url));

export const SPIKE_SAMPLES = [
  { id: 'en-doom', lang: 'en' },
  { id: 'pl-apollo', lang: 'pl' },
  { id: 'en-prism-noisy', lang: 'en' },
] as const;
export type SpikeSampleId = (typeof SPIKE_SAMPLES)[number]['id'];

/** DTW leads measured in the spike (docs/spikes/03-audio.md §5). */
export const SPIKE_DTW_LEAD_S = { 'turbo-q5': 0.21, small: 0.2 } as const;

const TruthSchema = z.object({
  durationS: z.number(),
  words: z.array(
    z.object({ text: z.string(), t: z.number().nullable(), tEnd: z.number().nullable() }),
  ),
});
export type Truth = z.infer<typeof TruthSchema>;

const SpikeRawSchema = z.object({
  audioS: z.number(),
  words: z.array(
    z.object({
      text: z.string(),
      t: z.number(),
      tEnd: z.number(),
      p: z.number(),
      tDtw: z.number().nullable(),
    }),
  ),
});

const readJson = (relative: string): unknown =>
  JSON.parse(readFileSync(`${SPIKE_DIR}${relative}`, 'utf8'));

export interface SpikeFixture {
  readonly script: string;
  readonly truth: Truth;
  /** ASR words calibrated exactly as the WhisperManager does it. */
  readonly asr: RawWord[];
  readonly audioS: number;
}

export function loadSpikeFixture(
  id: SpikeSampleId,
  model: keyof typeof SPIKE_DTW_LEAD_S = 'turbo-q5',
): SpikeFixture {
  const raw = SpikeRawSchema.parse(readJson(`fixtures/${id}.${model}.words.raw.json`));
  return {
    script: readFileSync(`${SPIKE_DIR}samples/${id}.txt`, 'utf8'),
    truth: TruthSchema.parse(readJson(`fixtures/${id}.truth.json`)),
    asr: calibrateDtw(raw.words, SPIKE_DTW_LEAD_S[model]),
    audioS: raw.audioS,
  };
}

export interface StartErrorStats {
  readonly n: number;
  readonly maeMs: number;
  readonly within150: number;
}

/** Start-time error of aligned words vs SAPI truth (words without a truth time are skipped). */
export function startErrors(words: readonly AlignedWord[], truth: Truth): StartErrorStats {
  const errors: number[] = [];
  words.forEach((word, k) => {
    const expected = truth.words[k]?.t;
    if (expected !== undefined && expected !== null) errors.push(Math.abs(word.t - expected));
  });
  const n = Math.max(1, errors.length);
  return {
    n: errors.length,
    maeMs: Math.round((errors.reduce((sum, e) => sum + e, 0) / n) * 1000),
    within150: errors.filter((e) => e <= 0.15).length / n,
  };
}

/**
 * Beat-grid-locked beds (PLAN.md#12.21): with an act's `bpm` + `phaseS` the bed is rendered at
 * that tempo and its cue starts `offsetS` into the file, so on the film timeline its onsets fall
 * on the grid (attack strength folded over the beat period, an onset analysis as in music.qa). The
 * low end stays light and the bytes deterministic; without a grid the plan is exactly as before.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { bandShare, mixToMono, powerSpectrum } from '../analysis.js';
import { MIX_SAMPLE_RATE } from '../dsp.js';
import { generateMusic, moodTempoRange, planActMusic, type MusicMood } from './music.js';

const SR = MIX_SAMPLE_RATE;
const BINS = 32;
const WINDOW_S = 0.03;

/**
 * Attack strength per beat phase on the film timeline: for each of BINS phases, the mean rise of
 * the (first-difference high-passed) energy from the 30 ms before to the 30 ms after every beat.
 */
function attackByPhase(mood: MusicMood, bpm: number, phaseS: number, from: number): number[] {
  const [plan] = planActMusic([{ from, to: from + 24, mood, bpm, phaseS, energy: 0.6 }], {
    seed: 7,
  });
  if (plan === undefined) throw new Error('no plan');
  const offsetS = plan.cue.offsetS ?? 0;
  const mono = mixToMono(generateMusic(plan.options).clip);
  const edges = Float32Array.from(mono, (value, index) => value - (mono[index - 1] ?? 0));
  const width = Math.round(WINDOW_S * SR);
  const energy = (start: number): number => {
    let sum = 0;
    for (let index = start; index < start + width; index++) sum += (edges[index] ?? 0) ** 2;
    return Math.log10(sum / width + 1e-12);
  };
  const beatS = 60 / bpm;
  return Array.from({ length: BINS }, (_, bin) => {
    // Global time of the bin's first beat after the bed starts playing.
    let t = phaseS + (bin / BINS) * beatS;
    t -= Math.floor((t - from - 1) / beatS) * beatS;
    let sum = 0;
    let count = 0;
    for (; t < from + 23; t += beatS) {
      const frame = Math.round((t - from + offsetS) * SR);
      sum += energy(frame) - energy(frame - width);
      count += 1;
    }
    return sum / Math.max(1, count);
  });
}

describe('beat-grid-locked music beds', () => {
  it.each([
    ['calm-tech', 90.5, 1.234, 3.2],
    ['bright-explainer', 105.75, 0.426, 0],
    ['lofi-chill', 77.25, 5.05, 58.9],
    ['retro-wave', 88, 0.05, 121.4],
  ] as const)(
    '%s at %s bpm attacks on the film grid',
    (mood, bpm, phaseS, from) => {
      const attacks = attackByPhase(mood, bpm, phaseS, from);
      const peak = attacks.indexOf(Math.max(...attacks));
      // The strongest attacks sit on the grid's eighth notes (beat or offbeat hats), within one bin
      // (beat / 32, ~20 ms: the score's humanizing and swing).
      const eighth = peak % (BINS / 2);
      expect(Math.min(eighth, BINS / 2 - eighth)).toBeLessThanOrEqual(1);
      expect(Math.max(...attacks)).toBeGreaterThan(0.15);
    },
    60_000,
  );

  it('keeps the tempo, a light low end and identical bytes', () => {
    const acts = [{ from: 10, to: 40, mood: 'retro-wave' as const, bpm: 92, phaseS: 0.3 }];
    const [first] = planActMusic(acts, { seed: 3 });
    const [second] = planActMusic(acts, { seed: 3 });
    if (first === undefined || second === undefined) throw new Error('no plan');
    expect(first).toEqual(second);
    expect(first.options.bpm).toBe(92);
    const offset = first.cue.offsetS ?? 0;
    const barS = (60 / 92) * 4;
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(barS);
    // The file's bar starts land on the grid: from - offset = phase + k * bar.
    const k = (first.cue.from - offset - 0.3) / barS;
    expect(Math.abs(k - Math.round(k))).toBeLessThan(0.002);
    const a = generateMusic(first.options);
    const b = generateMusic(second.options);
    expect(a.score.bpm).toBe(92);
    const hash = (clip: typeof a.clip): string =>
      createHash('sha256')
        .update(Buffer.from(clip.left.buffer))
        .update(Buffer.from(clip.right.buffer))
        .digest('hex');
    expect(hash(a.clip)).toBe(hash(b.clip));
    expect(bandShare(powerSpectrum(mixToMono(a.clip), 8192), 0, 120)).toBeLessThanOrEqual(0.12);
  }, 60_000);

  it('plans exactly as before without a grid', () => {
    const [plan] = planActMusic([{ from: 0, to: 30, mood: 'calm-tech' }], { seed: 1 });
    expect(plan?.options.bpm).toBeUndefined();
    expect(plan?.cue).not.toHaveProperty('offsetS');
    expect(Object.keys(plan?.options ?? {}).sort()).toEqual(
      ['durationS', 'energy', 'loopable', 'mood', 'seed'].sort(),
    );
  });

  it('exposes the mood tempo ranges', () => {
    expect(moodTempoRange('calm-tech')).toEqual([84, 96]);
    expect(moodTempoRange('bright-explainer')).toEqual([100, 116]);
  });
});

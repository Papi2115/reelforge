import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { peakOf, rmsOf, secondsToFrames } from './dsp.js';
import {
  SFX_DEFAULT_DURATION_S,
  SFX_PEAK,
  SFX_RECIPES,
  synthesizeSfx,
  writeSfxWav,
  type SfxRecipe,
} from './sfx.js';

/** Recipes whose sound depends on the seed (tick and pop are purely tonal). */
const SEEDED: readonly SfxRecipe[] = ['whoosh', 'click', 'hit', 'typewriter', 'riser', 'glitch'];

describe('synthesizeSfx', () => {
  it.each(SFX_RECIPES)('%s: default length, finite, -6 dBFS peak, audible', (recipe) => {
    const samples = synthesizeSfx(recipe, { seed: 7 });
    expect(samples.length).toBe(secondsToFrames(SFX_DEFAULT_DURATION_S[recipe]));
    expect(samples.every((value) => Number.isFinite(value))).toBe(true);
    expect(peakOf(samples)).toBeCloseTo(SFX_PEAK, 5);
    expect(rmsOf(samples)).toBeGreaterThan(0.01);
    // The 2 ms tail fade ends at silence.
    expect(Math.abs(samples.at(-1) ?? 1)).toBe(0);
  });

  it.each(SFX_RECIPES)('%s: same seed gives identical samples', (recipe) => {
    expect(synthesizeSfx(recipe, { seed: 123 })).toEqual(synthesizeSfx(recipe, { seed: 123 }));
  });

  it.each(SEEDED)('%s: different seeds give different samples', (recipe) => {
    expect(synthesizeSfx(recipe, { seed: 1 })).not.toEqual(synthesizeSfx(recipe, { seed: 2 }));
  });

  it('honours and clamps durationS', () => {
    expect(synthesizeSfx('riser', { seed: 1, durationS: 0.5 }).length).toBe(24_000);
    expect(synthesizeSfx('whoosh', { seed: 1, durationS: 99 }).length).toBe(secondsToFrames(10));
    expect(synthesizeSfx('click', { seed: 1, durationS: 0 }).length).toBe(secondsToFrames(0.01));
  });

  it('typewriter has several distinct keystrokes', () => {
    const samples = synthesizeSfx('typewriter', { seed: 5 });
    const window = secondsToFrames(0.01);
    let onsets = 0;
    let previous = 0;
    for (let start = 0; start + window <= samples.length; start += window) {
      const level = rmsOf(samples.slice(start, start + window));
      if (level > 0.05 && previous <= 0.05) onsets++;
      previous = level;
    }
    expect(onsets).toBeGreaterThanOrEqual(8);
  });
});

describe('writeSfxWav', () => {
  it('writes a mono 48 kHz 16-bit WAV to a path with spaces and Polish letters', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge sfx ąę '));
    try {
      const file = path.join(dir, 'hit ż.wav');
      const written = await writeSfxWav(file, 'hit', { seed: 3 });
      expect(written.ok).toBe(true);
      const bytes = await readFile(file);
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.readUInt16LE(22)).toBe(1);
      expect(bytes.readUInt32LE(24)).toBe(48_000);
      expect(bytes.readUInt16LE(34)).toBe(16);
      expect(bytes.length).toBe(44 + secondsToFrames(0.6) * 2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mixToMono } from './analysis.js';
import { peakOf, rmsOf, secondsToFrames } from './dsp.js';
import {
  SFX_CATEGORY,
  SFX_DEFAULT_DURATION_S,
  SFX_PEAK,
  SFX_RECIPES,
  SFX_USE,
  SFX_VARIANTS,
  sfxVariantIndex,
  synthesizeSfx,
  writeSfxWav,
} from './sfx.js';

describe('synthesizeSfx', () => {
  it('keeps the original v1 names first, in order, and kebab-case names only', () => {
    expect(SFX_RECIPES.slice(0, 8)).toEqual([
      'whoosh',
      'click',
      'hit',
      'typewriter',
      'riser',
      'glitch',
      'tick',
      'pop',
    ]);
    expect(new Set(SFX_RECIPES).size).toBe(SFX_RECIPES.length);
    for (const recipe of SFX_RECIPES) {
      expect(recipe).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(SFX_VARIANTS[recipe].length).toBeGreaterThanOrEqual(3);
      expect(SFX_VARIANTS[recipe].length).toBeLessThanOrEqual(5);
      expect(SFX_USE[recipe].length).toBeGreaterThan(10);
      expect(SFX_CATEGORY[recipe]).toBeTruthy();
    }
  });

  it.each(SFX_RECIPES)('%s: default length, stereo, finite, peak ceiling, audible', (recipe) => {
    const clip = synthesizeSfx(recipe, { seed: 7 });
    const frames = secondsToFrames(SFX_DEFAULT_DURATION_S[recipe]);
    expect(clip.left.length).toBe(frames);
    expect(clip.right.length).toBe(frames);
    for (const channel of [clip.left, clip.right]) {
      expect(channel.every((value) => Number.isFinite(value))).toBe(true);
      expect(peakOf(channel)).toBeLessThanOrEqual(SFX_PEAK + 1e-6);
      expect(Math.abs(channel[0] ?? 1)).toBe(0);
      expect(Math.abs(channel.at(-1) ?? 1)).toBe(0);
    }
    expect(rmsOf(mixToMono(clip))).toBeGreaterThan(0.003);
  });

  it.each(SFX_RECIPES)('%s: same seed gives identical samples', (recipe) => {
    expect(synthesizeSfx(recipe, { seed: 123 })).toEqual(synthesizeSfx(recipe, { seed: 123 }));
  });

  it.each(SFX_RECIPES)('%s: same variant, other seed gives different samples', (recipe) => {
    const count = SFX_VARIANTS[recipe].length;
    expect(sfxVariantIndex(recipe, 1)).toBe(sfxVariantIndex(recipe, 1 + count));
    expect(synthesizeSfx(recipe, { seed: 1 })).not.toEqual(
      synthesizeSfx(recipe, { seed: 1 + count }),
    );
  });

  it('is documented in docs/sfx.md (one table row per recipe, variants in order)', async () => {
    const doc = await readFile(
      path.resolve(import.meta.dirname, '..', '..', '..', '..', 'docs', 'sfx.md'),
      'utf8',
    );
    for (const recipe of SFX_RECIPES) {
      const variants = SFX_VARIANTS[recipe].map((name, index) => `${String(index)}·${name}`);
      expect(doc).toContain(`| \`${recipe}\` | ${SFX_CATEGORY[recipe]} |`);
      expect(doc).toContain(variants.join(', '));
    }
  });

  it('picks the variant as seed % variant count', () => {
    expect(SFX_VARIANTS.whoosh).toEqual(['fast', 'slow', 'up', 'down', 'air']);
    expect(sfxVariantIndex('whoosh', 12)).toBe(2);
    expect(sfxVariantIndex('whoosh', 0xffff_ffff)).toBe(0xffff_ffff % 5);
  });

  it('honours and clamps durationS', () => {
    expect(synthesizeSfx('riser', { seed: 1, durationS: 0.5 }).left.length).toBe(24_000);
    expect(synthesizeSfx('whoosh', { seed: 1, durationS: 99 }).left.length).toBe(
      secondsToFrames(10),
    );
    expect(synthesizeSfx('click', { seed: 1, durationS: 0 }).left.length).toBe(
      secondsToFrames(0.01),
    );
  });

  it('typewriter has several distinct keystrokes', () => {
    const samples = mixToMono(synthesizeSfx('typewriter', { seed: 5 }));
    const window = secondsToFrames(0.01);
    const peak = peakOf(samples);
    let onsets = 0;
    let previous = 0;
    for (let start = 0; start + window <= samples.length; start += window) {
      const level = peakOf(samples.slice(start, start + window)) / peak;
      if (level > 0.3 && previous <= 0.3) onsets++;
      previous = level;
    }
    expect(onsets).toBeGreaterThanOrEqual(8);
  });
});

describe('writeSfxWav', () => {
  it('writes a stereo 48 kHz 16-bit WAV to a path with spaces and Polish letters', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge sfx ąę '));
    try {
      const file = path.join(dir, 'hit ż.wav');
      const written = await writeSfxWav(file, 'hit', { seed: 3 });
      expect(written.ok).toBe(true);
      const bytes = await readFile(file);
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.readUInt16LE(22)).toBe(2);
      expect(bytes.readUInt32LE(24)).toBe(48_000);
      expect(bytes.readUInt16LE(34)).toBe(16);
      expect(bytes.length).toBe(44 + secondsToFrames(SFX_DEFAULT_DURATION_S.hit) * 4);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

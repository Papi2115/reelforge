import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CuesFileSchema } from '../cues.js';
import {
  generateActMusic,
  musicCacheKey,
  musicFilePath,
  planActMusic,
  writeMusicFile,
} from './music.js';

describe('music cache naming', () => {
  it('names files gen-<mood>-<seed>-<hash> and changes the hash with any option', () => {
    const options = { mood: 'calm-tech', seed: 42, durationS: 20 } as const;
    expect(musicFilePath(options)).toMatch(/^audio\/music\/gen-calm-tech-42-[0-9a-f]{10}\.wav$/);
    expect(musicCacheKey(options)).toBe(musicCacheKey({ ...options }));
    expect(musicCacheKey({ ...options, durationS: 21 })).not.toBe(musicCacheKey(options));
    expect(musicCacheKey({ ...options, energy: 0.9 })).not.toBe(musicCacheKey(options));
    expect(musicCacheKey({ ...options, loopable: false })).not.toBe(musicCacheKey(options));
  });
});

describe('planActMusic', () => {
  it('plans one ducked, non-looping bed per act with per-act seeds (pure)', () => {
    const acts = [
      { from: 0, to: 20.1234 },
      { from: 20.1234, to: 45, mood: 'tense-investigation', energy: 0.8 },
      { from: 45, to: 46 },
    ] as const;
    const plans = planActMusic(acts, { seed: 9, moods: ['lofi-chill', 'retro-wave'] });
    expect(plans).toEqual(planActMusic(acts, { seed: 9, moods: ['lofi-chill', 'retro-wave'] }));
    // The 1 s act is too short for a bed.
    expect(plans).toHaveLength(2);
    expect(plans.map((plan) => plan.options.mood)).toEqual(['lofi-chill', 'tense-investigation']);
    expect(plans[0]?.options.seed).not.toBe(plans[1]?.options.seed);
    expect(plans[1]?.options).toMatchObject({ energy: 0.8, durationS: 45 - 20.1234 });
    expect(plans[0]?.cue).toMatchObject({
      from: 0,
      to: 20.123,
      loop: false,
      gainDb: 0,
      ducking: { enabled: true },
    });
    const cues = CuesFileSchema.parse({ version: 1, music: plans.map((plan) => plan.cue) });
    expect(cues.music).toHaveLength(2);
  });
});

describe('writeMusicFile / generateActMusic', () => {
  let dir = '';

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge music ąę '));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('renders a 48 kHz stereo WAV once and reuses it', async () => {
    const options = { mood: 'retro-wave', seed: 4, durationS: 5 } as const;
    const first = await writeMusicFile(dir, options);
    expect(first).toEqual({ ok: true, value: { file: musicFilePath(options), cached: false } });
    const target = path.join(dir, ...musicFilePath(options).split('/'));
    const bytes = await readFile(target);
    expect(bytes.readUInt16LE(22)).toBe(2);
    expect(bytes.readUInt32LE(24)).toBe(48_000);
    expect(bytes.length).toBe(44 + 5 * 48_000 * 4);
    const second = await writeMusicFile(dir, options);
    expect(second).toEqual({ ok: true, value: { file: musicFilePath(options), cached: true } });
  });

  it('returns cues whose files exist', async () => {
    const result = await generateActMusic(dir, [{ from: 1, to: 7 }], {
      seed: 1,
      moods: 'bright-explainer',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    const file = result.value[0]?.file ?? '';
    expect((await stat(path.join(dir, ...file.split('/')))).isFile()).toBe(true);
  });
});

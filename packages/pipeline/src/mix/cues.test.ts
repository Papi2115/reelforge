import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CuesFileSchema, readCuesFile, writeCuesFile } from './cues.js';

describe('CuesFileSchema', () => {
  it('fills defaults for a minimal file', () => {
    const parsed = CuesFileSchema.parse({ version: 1 });
    expect(parsed).toEqual({
      version: 1,
      global: { voGainDb: 0, targetLufs: -14, truePeakMaxDbtp: -1 },
      sfx: [],
      ambience: [],
      music: [],
    });
  });

  it('fills cue defaults, including ducking', () => {
    const parsed = CuesFileSchema.parse({
      version: 1,
      sfx: [{ t: 1.5, name: 'hit' }],
      ambience: [{ from: 0, to: 10, name: 'room-tone' }],
      music: [{ from: 0, to: 30, file: 'audio/music/bed.mp3', ducking: { ratio: 4 } }],
    });
    expect(parsed.sfx[0]).toEqual({ t: 1.5, name: 'hit', gainDb: 0, pan: 0 });
    expect(parsed.ambience[0]).toMatchObject({ gainDb: 0, fadeInS: 0.5, fadeOutS: 0.5 });
    expect(parsed.music[0]).toMatchObject({
      gainDb: 0,
      offsetS: 0,
      loop: false,
      fadeInS: 1,
      fadeOutS: 2,
      ducking: { enabled: true, thresholdDb: -30, ratio: 4, attackMs: 20, releaseMs: 400 },
    });
    const noDucking = CuesFileSchema.parse({
      version: 1,
      music: [{ from: 0, to: 1, file: 'm.wav' }],
    });
    expect(noDucking.music[0]?.ducking.enabled).toBe(true);
  });

  it.each([
    ['unknown key (gain instead of gainDb)', { sfx: [{ t: 0, name: 'hit', gain: -3 }] }],
    ['both name and file', { sfx: [{ t: 0, name: 'hit', file: 'a.wav' }] }],
    ['neither name nor file', { sfx: [{ t: 0 }] }],
    ['unknown recipe', { sfx: [{ t: 0, name: 'explosion' }] }],
    ['negative time', { sfx: [{ t: -1, name: 'hit' }] }],
    ['pan out of range', { sfx: [{ t: 0, name: 'hit', pan: 2 }] }],
    ['empty range', { ambience: [{ from: 5, to: 5, name: 'hum' }] }],
    ['music without file', { music: [{ from: 0, to: 5 }] }],
    [
      'ducking ratio above 20',
      { music: [{ from: 0, to: 5, file: 'm.wav', ducking: { ratio: 30 } }] },
    ],
    ['wrong version', { version: 2 }],
    ['unknown top-level key', { extra: true }],
  ])('rejects %s', (_label, patch) => {
    expect(CuesFileSchema.safeParse({ version: 1, ...patch }).success).toBe(false);
  });
});

describe('readCuesFile / writeCuesFile', () => {
  it('round-trips through disk with defaults applied', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge cues ż '));
    try {
      const file = path.join(dir, 'cues.json');
      const written = await writeCuesFile(file, { version: 1, sfx: [{ t: 2, name: 'pop' }] });
      expect(written.ok).toBe(true);
      const read = await readCuesFile(file);
      expect(read.ok && read.value.sfx[0]).toEqual({ t: 2, name: 'pop', gainDb: 0, pan: 0 });
      const invalid = await writeCuesFile(file, { version: 1, sfx: [{ t: 2 }] });
      expect(invalid).toMatchObject({ ok: false, error: { kind: 'schema' } });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

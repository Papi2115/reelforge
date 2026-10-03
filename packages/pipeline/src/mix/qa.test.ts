import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CuesFileSchema } from './cues.js';
import { MIX_SAMPLE_RATE, Oscillator, dbToGain, mulberry32, whiteNoise } from './dsp.js';
import { analyzeMix } from './qa.js';
import { buildMixQaReport, soundMoments } from './qa-report.js';
import { MIX_REPORT_VERSION, type MixReport } from './report.js';
import { encodeWav, writeWavAtomic } from './wav.js';
import { WavReader, parseWavHeader } from './wav-reader.js';

const SECONDS = 12;
const FRAMES = SECONDS * MIX_SAMPLE_RATE;
/** Speech in [2, 5) and [7, 10) s. */
const speaking = (t: number): boolean => (t >= 2 && t < 5) || (t >= 7 && t < 10);

function signal(make: (t: number, index: number) => number): Float32Array {
  return Float32Array.from({ length: FRAMES }, (_, index) => make(index / MIX_SAMPLE_RATE, index));
}

function voice(): Float32Array {
  const oscillators = [1, 2, 3, 4, 5, 6, 8, 10, 14, 18].map(() => new Oscillator());
  return signal((t) => {
    if (!speaking(t)) return 0;
    let sum = 0;
    oscillators.forEach((oscillator, harmonic) => {
      sum += oscillator.sine(160 * (harmonic + 1)) / (harmonic + 1);
    });
    return 0.12 * sum;
  });
}

/** Mid-range "music": noise-ish chord, optionally with a strong 60 Hz bass. */
function music(level: number, bass: boolean, duckDb: number): Float32Array {
  const rng = mulberry32(5);
  const tones = [220, 277, 330, 440].map(() => new Oscillator());
  const sub = new Oscillator();
  return signal((t) => {
    let sum = 0.2 * whiteNoise(rng);
    tones.forEach((oscillator, index) => {
      sum += oscillator.sine([220, 277, 330, 440][index] ?? 220);
    });
    const low = bass ? 6 * sub.sine(60) : 0;
    const gain = speaking(t) ? dbToGain(-duckDb) : 1;
    return level * gain * (sum + low) * 0.2;
  });
}

describe('mix QA analysis', () => {
  let dir = '';

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge qa ż '));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function write(name: string, samples: Float32Array, format: 'pcm16' | 'float32') {
    const file = path.join(dir, name);
    const written = await writeWavAtomic(file, [samples, samples], MIX_SAMPLE_RATE, format);
    if (!written.ok) throw new Error(written.error.message);
    return file;
  }

  async function analyze(options: { duckDb: number; bass: boolean; clip: boolean }) {
    const vo = voice();
    const mix = Float32Array.from(vo, (value, index) =>
      options.clip && index === 1000 ? 1 : value * 0.5,
    );
    return analyzeMix({
      voStem: await write('vo.wav', vo, 'float32'),
      musicStem: await write('music.wav', music(0.3, options.bass, options.duckDb), 'float32'),
      musicBuses: [await write('bus.wav', music(0.3, options.bass, 0), 'float32')],
      mix: await write('mix.wav', mix, 'pcm16'),
      totalFrames: FRAMES,
    });
  }

  it('measures speech time, ducking depth, the speech-band margin, the low band and clipping', async () => {
    const result = await analyze({ duckDb: 10, bass: false, clip: false });
    if (!result.ok) throw new Error(result.error.message);
    const qa = result.value;
    expect(qa.speechS).toBeGreaterThan(5.6);
    expect(qa.speechS).toBeLessThan(6.4);
    expect(qa.duckingDepthDb).toBeGreaterThan(9);
    expect(qa.duckingDepthDb).toBeLessThan(11);
    expect(qa.speechMarginDb).toBeGreaterThan(15);
    expect(qa.speechMarginMinDb).toBeLessThanOrEqual(qa.speechMarginDb ?? 0);
    expect(qa.musicLowShare).toBeLessThan(0.05);
    expect(qa.clippedSamples).toBe(0);
  });

  it('catches shallow ducking, bass-heavy music and clipping (a failing mix)', async () => {
    const result = await analyze({ duckDb: 2, bass: true, clip: true });
    if (!result.ok) throw new Error(result.error.message);
    const qa = result.value;
    expect(qa.duckingDepthDb).toBeLessThan(3);
    expect(qa.musicLowShare).toBeGreaterThan(0.5);
    expect(qa.clippedSamples).toBe(2);
  });

  it('reports a missing stem as an error instead of throwing', async () => {
    const result = await analyzeMix({
      voStem: path.join(dir, 'nope.wav'),
      musicStem: path.join(dir, 'nope.wav'),
      musicBuses: [],
      mix: path.join(dir, 'nope.wav'),
      totalFrames: FRAMES,
    });
    expect(!result.ok && result.error.kind).toBe('parse-failed');
  });
});

describe('WAV reader', () => {
  it('reads what the writer wrote (pcm16 and float32) and finds data after extra chunks', async () => {
    const samples = Float32Array.from([0, 0.5, -0.5, 0.25]);
    for (const format of ['pcm16', 'float32'] as const) {
      const bytes = encodeWav([samples, samples], 48_000, format);
      const info = parseWavHeader(bytes, bytes.length);
      expect(info).toMatchObject({ channels: 2, sampleRate: 48_000, format, frames: 4 });
    }
    const plain = encodeWav([samples], 48_000, 'pcm16');
    const list = Buffer.concat([
      Buffer.from('LIST'),
      Buffer.from([4, 0, 0, 0]),
      Buffer.from('INFO'),
    ]);
    const withList = Buffer.concat([plain.subarray(0, 36), list, plain.subarray(36)]);
    expect(parseWavHeader(withList, withList.length).dataOffset).toBe(56);
    expect(() => parseWavHeader(Buffer.from('nope'), 4)).toThrow(/RIFF/);
    const dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge wav '));
    try {
      const file = path.join(dir, 'a.wav');
      await writeWavAtomic(file, [samples, samples], 48_000, 'float32');
      const reader = await WavReader.open(file);
      const [left] = await reader.read(1, 10);
      await reader.close();
      expect([...(left ?? [])]).toEqual([0.5, -0.5, 0.25]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('mix QA report', () => {
  const loudness = (lufs: number, tp: number) => ({
    integratedLufs: lufs,
    truePeakDbtp: tp,
    lraLu: 5,
  });
  const report = (patch: Partial<MixReport> = {}): MixReport => ({
    version: MIX_REPORT_VERSION,
    durationS: 60,
    sampleRate: 48_000,
    channels: 2,
    targetLufs: -14,
    truePeakMaxDbtp: -1,
    toleranceLu: 0.5,
    vo: loudness(-16, -3),
    before: loudness(-18, -4),
    after: loudness(-14.1, -1.3),
    gainDb: 4,
    limiterCeilingDb: -2,
    renderPasses: 1,
    withinTolerance: true,
    truePeakOk: true,
    cues: { sfx: 3, ambience: 1, music: 1, duckedMusicBuses: 1 },
    stems: [],
    warnings: [],
    qa: {
      speechS: 40,
      musicLowShare: 0.06,
      duckingDepthDb: 8.2,
      speechMarginDb: 19.4,
      speechMarginMinDb: 16,
      clippedSamples: 0,
    },
    ...patch,
  });
  const cues = CuesFileSchema.parse({
    version: 1,
    sfx: [
      { t: 1, name: 'tick' },
      { t: 1.2, name: 'tock' },
      { t: 10, name: 'hit' },
    ],
    moods: ['calm-tech'],
  });
  const options = { toleranceLu: 1, createdAt: '2026-10-02T10:00:00.000Z' };

  it('passes a good mix and summarizes SFX density and music', () => {
    const built = buildMixQaReport(report(), cues, options);
    expect(built.checks.every((check) => check.status === 'pass')).toBe(true);
    expect(built.warnings).toEqual([]);
    expect(built.sfx).toEqual({ count: 3, perMinute: 3, momentsPerMinute: 2 });
    expect(built.music).toEqual({ beds: 0, moods: ['calm-tech'] });
    expect(built.checks.find((check) => check.id === 'music-low-band')?.value).toBe('6.0 %');
  });

  it('fails loudness / true peak / clipping and warns on the soft bars', () => {
    const built = buildMixQaReport(
      report({
        after: loudness(-16.2, -0.4),
        qa: {
          speechS: 40,
          musicLowShare: 0.2,
          duckingDepthDb: 3,
          speechMarginDb: 11,
          speechMarginMinDb: 8,
          clippedSamples: 12,
        },
      }),
      cues,
      options,
    );
    expect(Object.fromEntries(built.checks.map((check) => [check.id, check.status]))).toEqual({
      loudness: 'fail',
      'true-peak': 'fail',
      clipping: 'fail',
      ducking: 'warn',
      'speech-clarity': 'warn',
      'music-low-band': 'warn',
      'sfx-density': 'pass',
    });
    expect(built.warnings).toContain('Music ducking under speech: 3.0 dB (want ≥ 6 dB)');
    expect(built.warnings).toHaveLength(6);
  });

  it('skips the music checks without music and without measurements', () => {
    const noMusic = buildMixQaReport(
      report({
        qa: {
          speechS: 40,
          musicLowShare: null,
          duckingDepthDb: null,
          speechMarginDb: null,
          speechMarginMinDb: null,
          clippedSamples: 0,
        },
      }),
      CuesFileSchema.parse({ version: 1 }),
      options,
    );
    expect(noMusic.checks.filter((check) => check.status === 'skip').map((c) => c.id)).toEqual([
      'ducking',
      'speech-clarity',
      'music-low-band',
      'sfx-density',
    ]);
    const unmeasured = buildMixQaReport(report({ qa: undefined }), cues, options);
    expect(unmeasured.checks.find((check) => check.id === 'clipping')?.status).toBe('skip');
  });

  it('counts a series of close cues as one sound moment', () => {
    expect(soundMoments([3, 1, 1.3, 1.6, 9, 9.49])).toBe(3);
    expect(soundMoments([])).toBe(0);
  });
});

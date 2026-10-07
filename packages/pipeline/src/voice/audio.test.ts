import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FfmpegManager } from '../ffmpeg/manager.js';
import {
  assembleTimeline,
  createTakeDecoder,
  decodeWavBytes,
  fadeEdges,
  wrapPcm,
  writeTimelineWav,
} from './audio.js';
import { toneSamples } from './testing/fake-elevenlabs.js';

const RATE = 44_100;

function floatTone(seconds: number): Float32Array {
  return Float32Array.from(toneSamples(seconds), (value) => value / 32768);
}

/** Largest difference between neighbouring samples in [from, to). */
function maxJump(samples: Float32Array, from: number, to: number): number {
  let jump = 0;
  for (let k = Math.max(1, from); k < Math.min(samples.length, to); k++) {
    jump = Math.max(jump, Math.abs((samples[k] ?? 0) - (samples[k - 1] ?? 0)));
  }
  return jump;
}

let workDir = '';
beforeAll(async () => {
  workDir = await mkdtemp(path.join(os.tmpdir(), 'reelforge voice audio '));
});
afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('timeline assembly', () => {
  it('fades take edges without touching the middle', () => {
    const faded = fadeEdges(
      Float32Array.from({ length: 2_000 }, () => 1),
      RATE,
    );
    expect(faded[0]).toBe(0);
    expect(faded[1_999]).toBe(0);
    expect(faded[1_000]).toBe(1);
    expect(faded[441]).toBe(1);
  });

  it('places takes sample-exactly with the planned pauses', () => {
    const a = floatTone(0.5);
    const b = floatTone(0.25);
    const timeline = assembleTimeline([
      { samples: a, pauseBeforeS: 0 },
      { samples: b, pauseBeforeS: 0.6 },
      { samples: a, pauseBeforeS: 0.25 },
    ]);
    expect(timeline.spans).toEqual([
      { start: 0, end: 0.5 },
      { start: 1.1, end: 1.35 },
      { start: 1.6, end: 2.1 },
    ]);
    expect(timeline.samples.length).toBe(Math.round(2.1 * RATE));
    expect(timeline.samples[Math.round(0.8 * RATE)]).toBe(0);
  });

  it('adds no clicks at joins although the takes start at full amplitude', () => {
    const tone = floatTone(0.3);
    const raw = maxJump(tone, 0, tone.length);
    const timeline = assembleTimeline([
      { samples: tone, pauseBeforeS: 0 },
      { samples: tone, pauseBeforeS: 0.25 },
    ]);
    const join = Math.round(0.55 * RATE);
    // the unfaded edge would jump from silence to 0.5 at once
    expect(Math.abs(tone[0] ?? 0)).toBeGreaterThan(0.49);
    expect(maxJump(timeline.samples, join - 50, join + 50)).toBeLessThanOrEqual(raw + 1e-6);
    expect(maxJump(timeline.samples, 0, timeline.samples.length)).toBeLessThanOrEqual(raw + 1e-6);
  });

  it('writes deterministic 16-bit WAV bytes', async () => {
    const timeline = assembleTimeline([{ samples: floatTone(0.1), pauseBeforeS: 0 }]);
    const file = path.join(workDir, 'nested', 'vo.original.wav');
    const first = await writeTimelineWav(file, timeline);
    const second = await writeTimelineWav(file, timeline);
    expect(first.ok && second.ok && first.value === second.value).toBe(true);
    const decoded = decodeWavBytes(await readFile(file));
    expect(decoded.ok && decoded.value.samples.length).toBe(timeline.samples.length);
  });
});

describe('take decoding', () => {
  it('wraps raw pcm losslessly and reads it back without ffmpeg', async () => {
    const pcm = toneSamples(0.2);
    const file = path.join(workDir, 'take.wav');
    await writeFile(file, wrapPcm(new Uint8Array(pcm.buffer), RATE));
    const decoded = await createTakeDecoder(null).decode(file);
    if (!decoded.ok) throw new Error(decoded.error.message);
    expect(decoded.value.sampleRate).toBe(RATE);
    expect(
      Array.from(decoded.value.samples.slice(0, 50), (value) => Math.round(value * 32768)),
    ).toEqual(Array.from(pcm.slice(0, 50)));
  });

  it('needs ffmpeg for mp3', async () => {
    const file = path.join(workDir, 'take.mp3');
    await writeFile(file, Buffer.from('not audio'));
    const decoded = await createTakeDecoder(null).decode(file);
    expect(!decoded.ok && decoded.error.kind).toBe('decode');
  });
});

const created = await FfmpegManager.create();
const ffmpeg = created.ok && created.value.hasEncoder('libmp3lame') ? created.value : null;

describe.skipIf(ffmpeg === null)('mp3 takes (ffmpeg with libmp3lame)', () => {
  it('decodes an mp3 take to mono 44.1 kHz and cleans up its temp file', async () => {
    const manager = ffmpeg as FfmpegManager;
    const file = path.join(workDir, 'tone take.mp3');
    const made = await manager.run([
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=220:sample_rate=44100:duration=0.5',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      '-y',
      file,
    ]);
    expect(made.ok).toBe(true);
    const decoded = await createTakeDecoder(manager).decode(file);
    if (!decoded.ok) throw new Error(decoded.error.message);
    expect(decoded.value.sampleRate).toBe(RATE);
    expect(decoded.value.samples.length / RATE).toBeCloseTo(0.5, 1);
    expect((await readdir(workDir)).filter((name) => name.includes('.decode.'))).toEqual([]);
  });
});

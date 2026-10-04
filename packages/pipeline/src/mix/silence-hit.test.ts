/**
 * Reveal moment "silence hit" in the mix (PLAN.md#12.27): the bed (SFX, ambience, music buses)
 * ducks to near silence before the key word and the hit lands exactly on it; the bus bytes are
 * deterministic, and without silences they are exactly the bytes of before.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SILENCE_FADE_FRAMES, SILENCE_FLOOR, silenceGain, writeBusWav } from './bus.js';
import { CuesFileSchema } from './cues.js';
import { MIX_SAMPLE_RATE, secondsToFrames } from './dsp.js';
import { busSilences } from './mix.js';
import { planMix } from './plan.js';
import { parseWavHeader } from './wav-reader.js';

const HIT_T = 2.5;
const SILENCE = { from: 2.0, to: HIT_T };
const TOTAL = secondsToFrames(4);

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'rf silence hit '));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function plan() {
  const cues = CuesFileSchema.parse({
    version: 1,
    sfx: [{ t: HIT_T, name: 'hit' }],
    ambience: [{ from: 0, to: 4, name: 'room-tone', fadeInS: 0, fadeOutS: 0 }],
  });
  const planned = planMix(cues, TOTAL, dir, new Map());
  if (!planned.ok) throw new Error(planned.error.message);
  return planned.value;
}

async function render(
  name: string,
  events: Parameters<typeof writeBusWav>[1],
  silences: Parameters<typeof writeBusWav>[4],
): Promise<{ bytes: Buffer; left: Float32Array }> {
  const file = path.join(dir, name);
  const written = await writeBusWav(file, events, TOTAL, undefined, silences);
  if (!written.ok) throw new Error(written.error.message);
  const bytes = await readFile(file);
  const info = parseWavHeader(bytes, bytes.length);
  const data = bytes.subarray(info.dataOffset, info.dataOffset + info.frames * 8);
  const samples = new Float32Array(Uint8Array.from(data).buffer);
  const left = new Float32Array(info.frames);
  for (let frame = 0; frame < info.frames; frame += 1) left[frame] = samples[frame * 2] ?? 0;
  return { bytes, left };
}

const rms = (samples: Float32Array, from: number, to: number): number => {
  let sum = 0;
  for (let index = from; index < to; index += 1) sum += (samples[index] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
};

describe('silence hit', () => {
  const silences = busSilences([SILENCE]);

  it('maps the window to frames ending exactly on the hit', () => {
    expect(silences).toEqual([
      { startFrame: secondsToFrames(2), endFrame: secondsToFrames(HIT_T) },
    ]);
    expect(silenceGain(silences, secondsToFrames(1.9))).toBe(1);
    expect(silenceGain(silences, secondsToFrames(2) + SILENCE_FADE_FRAMES)).toBe(SILENCE_FLOOR);
    expect(silenceGain(silences, secondsToFrames(HIT_T))).toBe(1);
  });

  it('ducks the bed to near silence, then lets it back on the word', async () => {
    const { ambience } = plan();
    const plain = await render('amb-plain.wav', ambience, []);
    const ducked = await render('amb-ducked.wav', ambience, silences);
    const start = secondsToFrames(2) + SILENCE_FADE_FRAMES;
    const end = secondsToFrames(HIT_T);
    const before = rms(plain.left, start, end);
    expect(before).toBeGreaterThan(0);
    expect(rms(ducked.left, start, end)).toBeCloseTo(before * SILENCE_FLOOR, 6);
    // Outside the window: the same samples.
    expect(ducked.left.subarray(0, secondsToFrames(2))).toEqual(
      plain.left.subarray(0, secondsToFrames(2)),
    );
    expect(ducked.left.subarray(end)).toEqual(plain.left.subarray(end));
  });

  it('lands the hit exactly on the word, unducked, with deterministic bytes', async () => {
    const { sfx } = plan();
    const first = await render('sfx-1.wav', sfx, silences);
    const second = await render('sfx-2.wav', sfx, silences);
    expect(first.bytes.equals(second.bytes)).toBe(true);
    const plain = await render('sfx-plain.wav', sfx, []);
    const hitFrame = secondsToFrames(HIT_T);
    expect(first.left.subarray(hitFrame)).toEqual(plain.left.subarray(hitFrame));
    const onset = first.left.findIndex((sample) => Math.abs(sample) > 1e-6);
    expect(onset).toBeGreaterThanOrEqual(hitFrame);
    expect(onset - hitFrame).toBeLessThan(MIX_SAMPLE_RATE * 0.005);
  });

  it('writes the same bytes as before without silences', async () => {
    const { ambience } = plan();
    const file = path.join(dir, 'amb-default.wav');
    const written = await writeBusWav(file, ambience, TOTAL, undefined);
    expect(written.ok).toBe(true);
    const plain = await render('amb-plain-2.wav', ambience, []);
    expect((await readFile(file)).equals(plain.bytes)).toBe(true);
  });
});

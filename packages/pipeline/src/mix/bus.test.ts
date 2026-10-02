import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUS_BLOCK_FRAMES, balanceGains, mixBlock, writeBusWav, type BusEvent } from './bus.js';
import { monoClip } from './clip.js';

function event(overrides: Partial<BusEvent> & Pick<BusEvent, 'clip'>): BusEvent {
  return {
    startFrame: 0,
    frames: overrides.clip.left.length,
    offsetFrame: 0,
    loop: false,
    gainLeft: 1,
    gainRight: 1,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    ...overrides,
  };
}

function render(events: readonly BusEvent[], frames: number, blockStart = 0): Float64Array[] {
  const left = new Float64Array(frames);
  const right = new Float64Array(frames);
  mixBlock(events, blockStart, left, right);
  return [left, right];
}

const ones = (length: number): Float32Array => new Float32Array(length).fill(1);

describe('balanceGains', () => {
  it('keeps the centre at unity and attenuates the far side', () => {
    expect(balanceGains(0)).toEqual({ left: 1, right: 1 });
    expect(balanceGains(1).left).toBeCloseTo(0, 10);
    expect(balanceGains(-1)).toMatchObject({ left: 1 });
    expect(balanceGains(-0.5).right).toBeCloseTo(Math.SQRT1_2, 10);
    expect(balanceGains(5)).toEqual(balanceGains(1));
  });
});

describe('mixBlock', () => {
  it('places a clip at its start frame with per-channel gain', () => {
    const [left, right] = render(
      [event({ clip: monoClip(ones(3)), startFrame: 2, gainLeft: 0.5, gainRight: 0.25 })],
      8,
    );
    expect([...(left ?? [])]).toEqual([0, 0, 0.5, 0.5, 0.5, 0, 0, 0]);
    expect([...(right ?? [])]).toEqual([0, 0, 0.25, 0.25, 0.25, 0, 0, 0]);
  });

  it('sums overlapping events and renders only the requested block', () => {
    const events = [
      event({ clip: monoClip(ones(4)), startFrame: 0 }),
      event({ clip: monoClip(ones(4)), startFrame: 2 }),
    ];
    const [left] = render(events, 3, 2);
    expect([...(left ?? [])]).toEqual([2, 2, 1]);
  });

  it('loops a clip and stops a non-looping one at its end', () => {
    const clip = monoClip(Float32Array.from([1, 2, 3]));
    const [looped] = render([event({ clip, frames: 7, loop: true, offsetFrame: 1 })], 7);
    expect([...(looped ?? [])]).toEqual([2, 3, 1, 2, 3, 1, 2]);
    const [once] = render([event({ clip, frames: 7, offsetFrame: 1 })], 7);
    expect([...(once ?? [])]).toEqual([2, 3, 0, 0, 0, 0, 0]);
  });

  it('fades in and out symmetrically', () => {
    const [left] = render(
      [event({ clip: monoClip(ones(10)), fadeInFrames: 4, fadeOutFrames: 4 })],
      10,
    );
    const values = [...(left ?? [])];
    expect(values[0]).toBeGreaterThan(0);
    expect(values[0]).toBeLessThan(0.1);
    expect(values[5]).toBe(1);
    for (let index = 0; index < 4; index++) {
      expect(values[index]).toBeCloseTo(values[9 - index] ?? Number.NaN, 12);
    }
  });
});

describe('writeBusWav', () => {
  let dir = '';
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge bus ł '));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('streams blocks that match a one-shot render', async () => {
    const total = BUS_BLOCK_FRAMES + 1000;
    const clip = monoClip(Float32Array.from({ length: 3000 }, (_, index) => (index % 7) / 10));
    const events = [event({ clip, startFrame: BUS_BLOCK_FRAMES - 1500, gainRight: 0.5 })];
    const file = path.join(dir, 'bus.wav');
    expect(await writeBusWav(file, events, total, undefined)).toEqual({
      ok: true,
      value: undefined,
    });
    const bytes = await readFile(file);
    expect(bytes.length).toBe(58 + total * 8);
    const [left, right] = render(events, total);
    const data = bytes.subarray(58);
    for (const frame of [
      0,
      BUS_BLOCK_FRAMES - 1500,
      BUS_BLOCK_FRAMES - 1,
      BUS_BLOCK_FRAMES,
      total - 1,
    ]) {
      expect(data.readFloatLE(frame * 8)).toBe(Math.fround(left?.[frame] ?? Number.NaN));
      expect(data.readFloatLE(frame * 8 + 4)).toBe(Math.fround(right?.[frame] ?? Number.NaN));
    }
  });

  it('returns cancelled and leaves no file when aborted', async () => {
    const file = path.join(dir, 'cancelled.wav');
    const result = await writeBusWav(file, [], 10, AbortSignal.abort());
    expect(result).toMatchObject({ ok: false, error: { kind: 'cancelled' } });
  });

  it('reports io errors for an unwritable path', async () => {
    const result = await writeBusWav(path.join(dir, 'missing', 'x.wav'), [], 10, undefined);
    expect(result).toMatchObject({ ok: false, error: { kind: 'io' } });
  });
});

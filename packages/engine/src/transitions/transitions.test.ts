import { TRANSITION_STYLE_IDS, TRANSITION_STYLES, type TransitionStyleId } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.js';
import { resolveStyle } from '../style.js';
import { vibeGuard } from '../vibe.js';
import { wipeDirection } from './basic.js';
import {
  compositeTransition,
  findTransition,
  paletteNumbers,
  TRANSITIONS,
  type TransitionFrame,
} from './index.js';
import { createTones, packPixel } from './pixels.js';

const WIDTH = 96;
const HEIGHT = 54;
const style = resolveStyle({ style: 'voxel-pixel-crisp640' });
const PALETTE = paletteNumbers(style.swatches);
const PARAMS = { palette: PALETTE };

/** A palette-only frame of 6x6 blocks in colours of one half of the palette. */
function syntheticFrame(seed: number, half: 0 | 1): TransitionFrame {
  const rng = createRng(seed);
  const colours = PALETTE.filter((_, index) => index % 2 === half);
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  const blocks = new Map<number, number>();
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const block = Math.floor(y / 6) * 100 + Math.floor(x / 6);
      const colour = blocks.get(block) ?? rng.pick(colours);
      blocks.set(block, colour);
      data.set(
        [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff, 255],
        (y * WIDTH + x) * 4,
      );
    }
  }
  return { width: WIDTH, height: HEIGHT, data };
}

const A = syntheticFrame(1, 0);
const B = syntheticFrame(2, 1);

function composite(id: TransitionStyleId, p: number, seed = 7): Uint8Array {
  return compositeTransition(id, PARAMS, A, B, p, seed);
}

/** Share of pixels equal to B's pixel at the same place (A and B never share a colour). */
function shareOfB(frame: Uint8Array): number {
  let count = 0;
  for (let offset = 0; offset < frame.length; offset += 4) {
    if (
      frame[offset] === B.data[offset] &&
      frame[offset + 1] === B.data[offset + 1] &&
      frame[offset + 2] === B.data[offset + 2]
    ) {
      count += 1;
    }
  }
  return count / (WIDTH * HEIGHT);
}

describe('transition kit', () => {
  it('has a compositor for every style of the shared table', () => {
    expect(Object.keys(TRANSITIONS)).toEqual([...TRANSITION_STYLE_IDS]);
    for (const id of TRANSITION_STYLE_IDS) {
      expect(TRANSITIONS[id]).toMatchObject(TRANSITION_STYLES[id]);
      expect(findTransition(id)).toBe(TRANSITIONS[id]);
    }
    expect(findTransition('nope')).toBeUndefined();
    expect(findTransition(undefined)).toBeUndefined();
  });

  it.each(TRANSITION_STYLE_IDS)('%s: starts on A, ends on B, deterministic', (id) => {
    expect(composite(id, 0)).toEqual(A.data);
    expect(composite(id, 1)).toEqual(B.data);
    const middle = composite(id, 0.5);
    expect(composite(id, 0.5)).toEqual(middle);
    expect(middle).not.toEqual(A.data);
    expect(middle).not.toEqual(B.data);
  });

  it.each(TRANSITION_STYLE_IDS)('%s: every pixel stays in the palette', (id) => {
    for (let step = 1; step < 20; step += 1) {
      const frame = composite(id, step / 20, step * 7919);
      const report = vibeGuard({ width: WIDTH, height: HEIGHT, data: frame }, style);
      expect(report.issues, `${id} p=${String(step / 20)}`).toEqual([]);
    }
  });

  it('reveals more of B as the progress grows (wipes and dissolves)', () => {
    const growing: TransitionStyleId[] = [
      'pixel-wipe',
      'dither-dissolve',
      'iris',
      'scanline-sweep',
      'draw-over',
      'pixel-sort-melt',
    ];
    for (const id of growing) {
      const shares = [0.2, 0.4, 0.6, 0.8].map((p) => shareOfB(composite(id, p)));
      for (let index = 1; index < shares.length; index += 1) {
        expect(shares[index], id).toBeGreaterThan(shares[index - 1] ?? 1);
      }
    }
    expect(shareOfB(composite('dither-dissolve', 0.25))).toBeCloseTo(0.25, 1);
  });

  it('draws the masks where they belong', () => {
    const at = (frame: Uint8Array, x: number, y: number): number[] => [
      ...frame.subarray((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 3),
    ];
    const of = (frame: TransitionFrame, x: number, y: number): number[] => at(frame.data, x, y);
    const iris = composite('iris', 0.5);
    expect(at(iris, WIDTH / 2, HEIGHT / 2)).toEqual(of(B, WIDTH / 2, HEIGHT / 2));
    expect(at(iris, 0, 0)).toEqual(of(A, 0, 0));
    const scan = composite('scanline-sweep', 0.25);
    expect(at(scan, 5, 2)).toEqual(of(B, 5, 2));
    expect(at(scan, 5, 3)).toEqual(of(A, 5, 3));
    expect(at(scan, 5, HEIGHT - 2)).toEqual(of(A, 5, HEIGHT - 2));
    const seeds = [0, 1, 2, 3, 4].map(wipeDirection);
    expect(new Set(seeds).size).toBe(5);
    const wipe = composite('pixel-wipe', 0.5, 0);
    expect(wipeDirection(0)).toBe('right');
    expect(at(wipe, 0, 10)).toEqual(of(B, 0, 10));
    expect(at(wipe, WIDTH - 1, 10)).toEqual(of(A, WIDTH - 1, 10));
    const draw = composite('draw-over', 0.5);
    expect(at(draw, 0, 0)).toEqual(of(B, 0, 0));
    expect(at(draw, WIDTH - 1, HEIGHT - 1)).toEqual(of(A, WIDTH - 1, HEIGHT - 1));
  });

  it('varies the pattern with the seed', () => {
    for (const id of ['glitch-cut', 'mosaic-reveal', 'tile-flip', 'pixel-sort-melt'] as const) {
      expect(composite(id, 0.5, 1), id).not.toEqual(composite(id, 0.5, 2));
    }
  });

  it('rejects frames of different sizes', () => {
    const small = { width: 2, height: 2, data: new Uint8Array(16) };
    expect(() => compositeTransition('iris', PARAMS, A, small, 0.5, 1)).toThrow(RangeError);
  });
});

describe('palette tones', () => {
  it('step along the luma ladder and leave other colours alone', () => {
    const tones = createTones([0x000000, 0xffffff, 0x808080]);
    expect(tones.darkest).toBe(packPixel(0x000000));
    expect(tones.brightest).toBe(packPixel(0xffffff));
    expect(tones.shift(packPixel(0x808080), 1)).toBe(packPixel(0xffffff));
    expect(tones.shift(packPixel(0x808080), -5)).toBe(packPixel(0x000000));
    expect(tones.shift(packPixel(0x123456), 2)).toBe(packPixel(0x123456));
    expect(tones.rank(packPixel(0xffffff))).toBe(2);
  });
});

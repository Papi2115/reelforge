/**
 * The accent guard in Grim Ink (PLAN.md#14.18): the real run's arena shots were flagged "accent
 * colour on 23 % / 48 % / 37 %" because the world's accent (mustard) is also its sand. Synthetic
 * frames of that sample: mustard sand reaching the frame's edges is the set, never the accent; a
 * mustard object inside the frame still counts; other worlds measure every accent pixel as before.
 */
import type { RgbaImage } from '@reelforge/engine/raster';
import { describe, expect, it } from 'vitest';
import { accentObjectShare } from './accent-objects.js';
import { accentShare, parseHex } from './frame-guards.js';
import { slopFrameFindings, type AntiSlopSetup } from './guards.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const W = 320;
const H = 180;
const MUSTARD = parseHex('#9b8236');
const SAND_DARK: readonly [number, number, number] = [120, 98, 40];
const WALL: readonly [number, number, number] = [70, 69, 42];
const INK: readonly [number, number, number] = [22, 18, 14];

function frame(paint: (x: number, y: number) => readonly [number, number, number]): RgbaImage {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * W + x) * 4);
    }
  }
  return { width: W, height: H, data };
}

if (MUSTARD === undefined) throw new Error('bad swatch');
const mustard = MUSTARD;

/** The arena: a wall, then mustard sand (45 % of the frame) with raked dark lines. */
const arena = (x: number, y: number): readonly [number, number, number] => {
  if (y < H * 0.55) return WALL;
  return (x + y) % 23 === 0 ? SAND_DARK : mustard;
};

/** The same arena with a mustard coin outlined in ink, inside the frame (no edge contact). */
const withCoin = (size: number) => (x: number, y: number) => {
  const dx = x - W / 2;
  const dy = y - H * 0.3;
  const r = Math.hypot(dx, dy);
  if (r < size) return mustard;
  if (r < size + 2) return INK;
  return arena(x, y);
};

const setup = (style: 'c-cam' | 'voxel'): AntiSlopSetup => ({
  vocabulary: buildVocabulary(['the editor hands you a coin']),
  spec: style === 'c-cam' ? worldSlopSpec('c-cam') : undefined,
  accent: mustard,
});

const accentFindings = (style: 'c-cam' | 'voxel', image: RgbaImage): string[] =>
  slopFrameFindings(setup(style), [{ t: 1, image }], { treatment: 'character-scene' })
    .map((entry) => entry.message)
    .filter((message) => message.includes('accent colour'));

describe('Grim Ink accent guard', () => {
  it('ignores the mustard sand that reaches the frame edges', () => {
    const sand = frame(arena);
    expect(accentShare(sand, mustard)).toBeGreaterThan(0.35);
    expect(accentObjectShare(sand, mustard)).toBe(0);
    expect(accentFindings('c-cam', sand)).toEqual([]);
    // every other world measures it all, as before
    expect(accentFindings('voxel', sand)).toHaveLength(1);
  });

  it('still counts an accent object inside the frame', () => {
    const coin = frame(withCoin(12));
    const share = accentObjectShare(coin, mustard);
    expect(share).toBeGreaterThan(0.005);
    expect(share).toBeLessThan(0.01);
    expect(accentFindings('c-cam', coin)).toEqual([]);
    // a huge mustard object is still too much accent
    expect(accentFindings('c-cam', frame(withCoin(48)))).toHaveLength(1);
  });
});

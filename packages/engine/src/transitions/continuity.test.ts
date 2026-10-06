import {
  CONTINUITY_STYLE_IDS,
  CONTINUITY_STYLES,
  type ContinuityStyleId,
  type TransitionFocus,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.js';
import { resolveStyle } from '../style.js';
import {
  compositeTransition,
  CONTINUITY_TRANSITIONS,
  findTransition,
  paletteNumbers,
  type TransitionFrame,
} from './index.js';

const WIDTH = 160;
const HEIGHT = 90;
const style = resolveStyle({ style: 'voxel-pixel-crisp640' });
const PALETTE = paletteNumbers(style.swatches);
const HALVES = [0, 1].map((half) => PALETTE.filter((_, index) => index % 2 === half));
const ANCHOR: TransitionFocus = { x: 0.7, y: 0.35 };

/** A palette-only frame of 5x5 blocks in the colours of one half of the palette. */
function frame(seed: number, half: 0 | 1): TransitionFrame {
  const rng = createRng(seed);
  const colours = HALVES[half] ?? [];
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  const blocks = new Map<number, number>();
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const block = Math.floor(y / 5) * 1000 + Math.floor(x / 5);
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

const A = frame(21, 0);
const B = frame(22, 1);
const B_SET = new Set(HALVES[1]);
const PALETTE_SET = new Set(PALETTE);

function composite(id: ContinuityStyleId, p: number, focus: TransitionFocus = ANCHOR) {
  return compositeTransition(id, { palette: PALETTE, focus }, A, B, p, 9);
}

function colourAt(data: Uint8Array, x: number, y: number): number {
  const offset = (y * WIDTH + x) * 4;
  return ((data[offset] ?? 0) << 16) | ((data[offset + 1] ?? 0) << 8) | (data[offset + 2] ?? 0);
}

/** Share of B pixels within `radius` px of a point (the whole frame without a radius). */
function shareOfB(data: Uint8Array, centre?: readonly [number, number], radius = 0): number {
  let count = 0;
  let total = 0;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (centre !== undefined && Math.hypot(x + 0.5 - centre[0], y + 0.5 - centre[1]) > radius) {
        continue;
      }
      total += 1;
      if (B_SET.has(colourAt(data, x, y))) count += 1;
    }
  }
  return count / Math.max(1, total);
}

const ANCHOR_PX = [ANCHOR.x * WIDTH, ANCHOR.y * HEIGHT] as const;
const CORNER: readonly [number, number] = [4, HEIGHT - 4];

describe('continuity link transitions', () => {
  it('are found by style id next to the kit styles', () => {
    for (const id of CONTINUITY_STYLE_IDS) {
      expect(findTransition(id)).toBe(CONTINUITY_TRANSITIONS[id]);
      expect(CONTINUITY_TRANSITIONS[id]).toMatchObject(CONTINUITY_STYLES[id]);
    }
  });

  it.each(CONTINUITY_STYLE_IDS)('%s: exact end frames, deterministic, palette only', (id) => {
    expect(Buffer.from(composite(id, 0)).equals(Buffer.from(A.data))).toBe(true);
    expect(Buffer.from(composite(id, 1)).equals(Buffer.from(B.data))).toBe(true);
    for (const p of [0.2, 0.5, 0.8]) {
      const first = composite(id, p);
      expect(Buffer.from(first).equals(Buffer.from(composite(id, p)))).toBe(true);
      for (let y = 0; y < HEIGHT; y += 3) {
        for (let x = 0; x < WIDTH; x += 3)
          expect(PALETTE_SET.has(colourAt(first, x, y))).toBe(true);
      }
    }
  });

  it.each(CONTINUITY_STYLE_IDS)('%s: B grows with the progress', (id) => {
    const shares = [0.1, 0.3, 0.5, 0.7, 0.9].map((p) => shareOfB(composite(id, p)));
    for (let index = 1; index < shares.length; index += 1) {
      expect(shares[index]).toBeGreaterThanOrEqual(shares[index - 1] ?? 0);
    }
    expect(shares[0]).toBeLessThan(0.5);
    expect(shares.at(-1)).toBeGreaterThan(0.5);
  });

  it('zoom-through magnifies A into the anchor before the swap', () => {
    const early = composite('continuity-zoom-through', 0.35);
    expect(shareOfB(early)).toBe(0);
    // The anchor drifts towards the centre: the centre pixel shows A close to the anchor.
    const centre = colourAt(early, WIDTH / 2, HEIGHT / 2);
    const near = new Set<number>();
    for (let dy = -10; dy <= 10; dy += 1) {
      for (let dx = -10; dx <= 10; dx += 1) {
        near.add(colourAt(A.data, Math.floor(ANCHOR_PX[0]) + dx, Math.floor(ANCHOR_PX[1]) + dy));
      }
    }
    expect(near.has(centre)).toBe(true);
    expect(shareOfB(composite('continuity-zoom-through', 0.7))).toBe(1);
  });

  it('shared-object changes the edges first and the object at the anchor last', () => {
    const middle = composite('continuity-shared-object', 0.5);
    expect(shareOfB(middle, CORNER, 6)).toBeGreaterThan(0.9);
    expect(shareOfB(middle, ANCHOR_PX, 8)).toBe(0);
  });

  it('carry-environment changes the object at the anchor first, the place after it', () => {
    const early = composite('continuity-carry-environment', 0.4);
    expect(shareOfB(early, ANCHOR_PX, 8)).toBeGreaterThan(0.9);
    expect(shareOfB(early, CORNER, 6)).toBe(0);
  });

  it('follows the anchor', () => {
    const left = composite('continuity-carry-environment', 0.4, { x: 0.2, y: 0.5 });
    expect(shareOfB(left, [0.2 * WIDTH, 0.5 * HEIGHT], 8)).toBeGreaterThan(0.9);
    expect(shareOfB(left, ANCHOR_PX, 8)).toBe(0);
  });
});

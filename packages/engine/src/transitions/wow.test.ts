import {
  TRANSITION_STYLES,
  WOW_STYLE_IDS,
  type TransitionFocus,
  type WowStyleId,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.js';
import { resolveStyle } from '../style.js';
import { vibeGuard } from '../vibe.js';
import { compositeTransition, paletteNumbers, type TransitionFrame } from './index.js';
import { diamondAngle } from './wow.js';

const WIDTH = 160;
const HEIGHT = 90;
const style = resolveStyle({ style: 'voxel-pixel-crisp640' });
const PALETTE = paletteNumbers(style.swatches);
const HALVES = [0, 1].map((half) => PALETTE.filter((_, index) => index % 2 === half));

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

const A = frame(11, 0);
const B = frame(12, 1);
const A_SET = new Set(HALVES[0]);
const B_SET = new Set(HALVES[1]);

function composite(id: WowStyleId, p: number, focus?: TransitionFocus, seed = 5): Uint8Array {
  return compositeTransition(id, { palette: PALETTE, focus }, A, B, p, seed);
}

function colourAt(data: Uint8Array, x: number, y: number): number {
  const offset = (y * WIDTH + x) * 4;
  return ((data[offset] ?? 0) << 16) | ((data[offset + 1] ?? 0) << 8) | (data[offset + 2] ?? 0);
}

/** Share of pixels drawn in B's colours (B and A use disjoint halves of the palette). */
function shareOfB(data: Uint8Array): number {
  let count = 0;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) if (B_SET.has(colourAt(data, x, y))) count += 1;
  }
  return count / (WIDTH * HEIGHT);
}

const FOCUS_STYLES = WOW_STYLE_IDS.filter((id) => TRANSITION_STYLES[id].wow?.focus === true);

describe('wow transitions', () => {
  it('are wow styles of 0.5–1.4 s for any look pair', () => {
    for (const id of WOW_STYLE_IDS) {
      const entry = TRANSITION_STYLES[id];
      expect(entry.wow, id).toBeDefined();
      expect(entry.duration.min, id).toBeGreaterThanOrEqual(0.5);
      expect(entry.duration.max, id).toBeLessThanOrEqual(1.4);
      expect(entry.lookChange, id).toBe(false);
    }
  });

  it.each(FOCUS_STYLES)('%s: exact ends and palette-pure at any focus', (id) => {
    for (const focus of [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.15, y: 0.8 },
    ]) {
      expect(composite(id, 0, focus)).toEqual(A.data);
      expect(composite(id, 1, focus)).toEqual(B.data);
      for (let step = 1; step < 20; step += 1) {
        const data = composite(id, step / 20, focus, step * 104_729);
        const issues = vibeGuard({ width: WIDTH, height: HEIGHT, data }, style).issues;
        expect(issues, `${id} focus ${JSON.stringify(focus)} p=${String(step / 20)}`).toEqual([]);
      }
    }
  });

  it.each(FOCUS_STYLES)('%s: follows the focus point (absent = the centre)', (id) => {
    const p = id === 'dive-out' ? 0.6 : 0.3;
    expect(composite(id, p, { x: 0.2, y: 0.25 })).not.toEqual(composite(id, p, { x: 0.8, y: 0.7 }));
    expect(composite(id, p)).toEqual(composite(id, p, { x: 0.5, y: 0.5 }));
  });

  it('is deterministic across interleaved seeds (cached geometry)', () => {
    for (const id of ['shatter', 'cube-smash'] as const) {
      const first = composite(id, 0.5, undefined, 1);
      composite(id, 0.5, undefined, 2);
      composite(id, 0.5, { x: 0.3, y: 0.3 }, 1);
      expect(composite(id, 0.5, undefined, 1), id).toEqual(first);
      expect(composite(id, 0.5, undefined, 2), id).not.toEqual(first);
    }
  });

  it('enters through the shape: B inside on the subject, A outside', () => {
    for (const id of ['enter-lens', 'enter-window', 'enter-keyhole', 'enter-binoculars'] as const) {
      const data = composite(id, 0.75);
      expect(B_SET.has(colourAt(data, WIDTH / 2, HEIGHT / 2)), id).toBe(true);
    }
    const lens = composite('enter-lens', 0.25, { x: 0.5, y: 0.5 });
    expect(A_SET.has(colourAt(lens, 2, HEIGHT - 3)), 'lens: corner keeps A').toBe(true);
    const keyhole = composite('enter-keyhole', 0.45);
    expect([0x1a1446, 0x2d1b69], 'keyhole: corner is the door').toContain(colourAt(keyhole, 2, 2));
  });

  it('dives: A only before the flip, B only after it; dive-out keeps A inside B', () => {
    // Before the speed lines (brightest tone) and the tile flip.
    const before = composite('dive-in', 0.12);
    const after = composite('dive-in', 0.75);
    expect(shareOfB(before)).toBe(0);
    expect(shareOfB(after)).toBeGreaterThan(0.9);
    const out = composite('dive-out', 0.5, { x: 0.3, y: 0.6 });
    expect(B_SET.has(colourAt(out, 1, 1))).toBe(true);
    const insetX = Math.round(WIDTH * (0.5 + (0.3 - 0.5) * 0.5));
    const insetY = Math.round(HEIGHT * (0.5 + (0.6 - 0.5) * 0.5));
    expect(A_SET.has(colourAt(out, insetX, insetY))).toBe(true);
  });

  it('reveals more of B as the progress grows', () => {
    for (const id of ['paper-roll', 'page-turn', 'sponge-wipe', 'shatter', 'cube-smash'] as const) {
      const shares = [0.2, 0.45, 0.7, 0.9].map((p) => shareOfB(composite(id, p)));
      expect(shares[3] ?? 0, id).toBeGreaterThan(shares[0] ?? 1);
      expect(shares[3] ?? 0, id).toBeGreaterThan(0.6);
    }
  });

  it('varies the texture styles with the seed', () => {
    for (const id of ['paper-roll', 'page-turn', 'shatter', 'cube-smash', 'sponge-wipe'] as const) {
      expect(composite(id, 0.5, undefined, 1), id).not.toEqual(composite(id, 0.5, undefined, 2));
    }
  });

  it('measures directions without trigonometry (diamond angle)', () => {
    expect(diamondAngle(1, 0)).toBe(0);
    expect(diamondAngle(0, 1)).toBe(1);
    expect(diamondAngle(-1, 0)).toBe(2);
    expect(diamondAngle(0, -1)).toBe(3);
    expect(diamondAngle(1, 1)).toBe(0.5);
    const around = [
      [1, 0.1],
      [0.2, 1],
      [-1, 0.3],
      [-0.4, -1],
      [1, -0.1],
    ].map(([x, y]) => diamondAngle(x ?? 0, y ?? 0));
    expect([...around].sort((first, second) => first - second)).toEqual(around);
  });
});

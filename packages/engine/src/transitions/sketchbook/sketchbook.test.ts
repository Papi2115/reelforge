/**
 * Page-native transitions of the Sketchbook world (PLAN.md#13.6): found by style id next to the
 * kit and continuity styles but never one of them (world-scoped), exact end frames, deterministic,
 * every pixel a sketchbook palette colour, the incoming page taking over as the page goes.
 */
import { CONTINUITY_STYLE_IDS, TRANSITION_STYLE_IDS } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng.js';
import { resolveStyle } from '../../style.js';
import {
  compositeTransition,
  findTransition,
  paletteNumbers,
  SKETCHBOOK_TRANSITION_IDS,
  SKETCHBOOK_TRANSITION_STYLES,
  WORLD_TRANSITIONS,
  type SketchbookTransitionId,
  type TransitionFrame,
} from '../index.js';

const WIDTH = 192;
const HEIGHT = 108;
const style = resolveStyle({ style: 'sketchbook' });
const PALETTE = paletteNumbers(style.swatches);
const hex = (name: string): number =>
  Number.parseInt((style.swatches[name] ?? '#000000').slice(1), 16);
const A_INKS = [hex('ink'), hex('bic')];
const B_INKS = [hex('red'), hex('green')];

/** A page: paper with fibres, ruled lines and 6x6 blocks of the given inks. */
function page(seed: number, inks: readonly number[]): TransitionFrame {
  const rng = createRng(seed);
  const blocks = new Map<number, number>();
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const block = Math.floor(y / 6) * 1000 + Math.floor(x / 6);
      const inked = blocks.get(block) ?? (rng() < 0.3 ? rng.pick(inks) : -1);
      blocks.set(block, inked);
      const paper =
        y % 9 === 0 ? hex('rule') : (x * 7 + y * 3) % 23 === 0 ? hex('fibre') : hex('paper');
      const colour = inked >= 0 ? inked : paper;
      data.set(
        [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff, 255],
        (y * WIDTH + x) * 4,
      );
    }
  }
  return { width: WIDTH, height: HEIGHT, data };
}

const A = page(31, A_INKS);
const B = page(32, B_INKS);
const PALETTE_SET = new Set(PALETTE);

function composite(id: SketchbookTransitionId, p: number): Uint8Array {
  return compositeTransition(id, { palette: PALETTE }, A, B, p, 7);
}

function colours(data: Uint8Array): number[] {
  const out: number[] = [];
  for (let offset = 0; offset < data.length; offset += 4) {
    out.push(
      ((data[offset] ?? 0) << 16) | ((data[offset + 1] ?? 0) << 8) | (data[offset + 2] ?? 0),
    );
  }
  return out;
}

/** Share of the frame's inked pixels that are the incoming page's inks. */
function shareOfB(data: Uint8Array): number {
  const all = colours(data);
  const b = all.filter((colour) => B_INKS.includes(colour)).length;
  const a = all.filter((colour) => A_INKS.includes(colour)).length;
  return b / Math.max(1, a + b);
}

describe('sketchbook page-native transitions', () => {
  it('are found by style id but are no kit or continuity style (world-scoped)', () => {
    expect([...SKETCHBOOK_TRANSITION_IDS].sort()).toEqual(
      Object.keys(SKETCHBOOK_TRANSITION_STYLES).sort(),
    );
    for (const id of SKETCHBOOK_TRANSITION_IDS) {
      expect(findTransition(id)).toBe(WORLD_TRANSITIONS[id]);
      expect(WORLD_TRANSITIONS[id]).toMatchObject({ world: 'sketchbook', type: 'wipe' });
      expect((TRANSITION_STYLE_IDS as readonly string[]).includes(id)).toBe(false);
      expect((CONTINUITY_STYLE_IDS as readonly string[]).includes(id)).toBe(false);
    }
  });

  it.each(SKETCHBOOK_TRANSITION_IDS)('%s: exact end frames, deterministic, palette only', (id) => {
    expect(Buffer.from(composite(id, 0)).equals(Buffer.from(A.data))).toBe(true);
    expect(Buffer.from(composite(id, 1)).equals(Buffer.from(B.data))).toBe(true);
    for (const p of [0.1, 0.35, 0.6, 0.85]) {
      const first = composite(id, p);
      expect(Buffer.from(first).equals(Buffer.from(composite(id, p))), `p ${String(p)}`).toBe(true);
      const off = colours(first).filter((colour) => !PALETTE_SET.has(colour));
      expect(off, `p ${String(p)}`).toEqual([]);
    }
  });

  it.each(SKETCHBOOK_TRANSITION_IDS)('%s: the incoming page takes over', (id) => {
    const early = shareOfB(composite(id, 0.08));
    const late = shareOfB(composite(id, 0.95));
    expect(early).toBeLessThan(0.5);
    expect(late).toBeGreaterThan(0.5);
    expect(late).toBeGreaterThan(early);
  });
});

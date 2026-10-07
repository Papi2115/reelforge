/**
 * Panel-native transitions of the Comic world (PLAN.md#13.3): found by style id next to the kit,
 * continuity and Sketchbook styles but never a kit or continuity style (world-scoped), exact end
 * frames, deterministic, every pixel a comic palette colour, the incoming page taking over as the
 * transition runs, and the focus moving where the cut, the panel, the ink and the slit start.
 */
import { CONTINUITY_STYLE_IDS, TRANSITION_STYLE_IDS } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng.js';
import { resolveStyle } from '../../style.js';
import {
  COMIC_TRANSITION_IDS,
  COMIC_TRANSITION_STYLES,
  compositeTransition,
  findTransition,
  paletteNumbers,
  WORLD_TRANSITIONS,
  type ComicTransitionId,
  type TransitionFrame,
} from '../index.js';

const WIDTH = 160;
const HEIGHT = 90;
const style = resolveStyle({ style: 'comic' });
const PALETTE = paletteNumbers(style.swatches);
const hex = (name: string): number =>
  Number.parseInt((style.swatches[name] ?? '#000000').slice(1), 16);
const A_INKS = [hex('cyanDeep'), hex('greyMid')];
const B_INKS = [hex('red'), hex('phosphor')];

/** A page: newsprint with fibres, ink gutters and 5x5 blocks of the given inks. */
function page(seed: number, inks: readonly number[]): TransitionFrame {
  const rng = createRng(seed);
  const blocks = new Map<number, number>();
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const block = Math.floor(y / 5) * 1000 + Math.floor(x / 5);
      const inked = blocks.get(block) ?? (rng() < 0.4 ? rng.pick(inks) : -1);
      blocks.set(block, inked);
      const paper =
        x % 53 === 0 ? hex('ink') : (x * 7 + y * 3) % 23 === 0 ? hex('shade') : hex('paper');
      const colour = inked >= 0 ? inked : paper;
      data.set(
        [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff, 255],
        (y * WIDTH + x) * 4,
      );
    }
  }
  return { width: WIDTH, height: HEIGHT, data };
}

const A = page(41, A_INKS);
const B = page(42, B_INKS);
const PALETTE_SET = new Set(PALETTE);

function composite(id: ComicTransitionId, p: number, focus = { x: 0.5, y: 0.5 }): Uint8Array {
  return compositeTransition(id, { palette: PALETTE, focus }, A, B, p, 7);
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

function shareOfB(data: Uint8Array): number {
  const all = colours(data);
  const b = all.filter((colour) => B_INKS.includes(colour)).length;
  const a = all.filter((colour) => A_INKS.includes(colour)).length;
  return b / Math.max(1, a + b);
}

describe('comic panel-native transitions', () => {
  it('are found by style id but are no kit or continuity style (world-scoped)', () => {
    expect([...COMIC_TRANSITION_IDS].sort()).toEqual(Object.keys(COMIC_TRANSITION_STYLES).sort());
    for (const id of COMIC_TRANSITION_IDS) {
      expect(findTransition(id)).toBe(WORLD_TRANSITIONS[id]);
      expect(WORLD_TRANSITIONS[id]).toMatchObject({ world: 'comic', type: 'wipe' });
      expect((TRANSITION_STYLE_IDS as readonly string[]).includes(id)).toBe(false);
      expect((CONTINUITY_STYLE_IDS as readonly string[]).includes(id)).toBe(false);
    }
  });

  it.each(COMIC_TRANSITION_IDS)('%s: exact end frames, deterministic, palette only', (id) => {
    expect(Buffer.from(composite(id, 0)).equals(Buffer.from(A.data))).toBe(true);
    expect(Buffer.from(composite(id, 1)).equals(Buffer.from(B.data))).toBe(true);
    for (const p of [0.1, 0.35, 0.6, 0.85]) {
      const first = composite(id, p);
      expect(Buffer.from(first).equals(Buffer.from(composite(id, p))), `p ${String(p)}`).toBe(true);
      const off = colours(first).filter((colour) => !PALETTE_SET.has(colour));
      expect(off, `p ${String(p)}`).toEqual([]);
    }
  });

  it.each(COMIC_TRANSITION_IDS)('%s: the incoming page takes over', (id) => {
    const early = shareOfB(composite(id, 0.08));
    const late = shareOfB(composite(id, 0.95));
    expect(early).toBeLessThan(0.5);
    expect(late).toBeGreaterThan(0.5);
    expect(late).toBeGreaterThan(early);
  });

  it.each(['comic-gutter-wipe', 'comic-panel-zoom', 'comic-ink-bleed'] as const)(
    '%s: follows the focus',
    (id) => {
      const left = composite(id, 0.5, { x: 0.2, y: 0.5 });
      const right = composite(id, 0.5, { x: 0.8, y: 0.5 });
      expect(Buffer.from(left).equals(Buffer.from(right))).toBe(false);
    },
  );

  it('comic-gutter-collapse: closes on the focus height', () => {
    const high = composite('comic-gutter-collapse', 0.7, { x: 0.5, y: 0.3 });
    const low = composite('comic-gutter-collapse', 0.7, { x: 0.5, y: 0.7 });
    expect(Buffer.from(high).equals(Buffer.from(low))).toBe(false);
  });

  it('comic-page-slide and comic-page-scroll: the page leaves sideways or upward', () => {
    // Halfway through, the slide's left edge column and the scroll's top row still show A, and
    // B arrives on the opposite side.
    const column = (data: Uint8Array, x: number): number[] =>
      colours(data).filter((_, index) => index % WIDTH === x);
    const row = (data: Uint8Array, y: number): number[] =>
      colours(data).slice(y * WIDTH, (y + 1) * WIDTH);
    const slide = composite('comic-page-slide', 0.3);
    const scroll = composite('comic-page-scroll', 0.3);
    const hasB = (pixels: number[]): boolean => pixels.some((colour) => B_INKS.includes(colour));
    expect(hasB(column(slide, 0))).toBe(false);
    expect(hasB(column(slide, WIDTH - 1))).toBe(true);
    expect(hasB(row(scroll, 0))).toBe(false);
    expect(hasB(row(scroll, HEIGHT - 1))).toBe(true);
  });
});

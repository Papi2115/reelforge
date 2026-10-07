/**
 * Game-native transitions of the Game B1 world (PLAN.md#13.5 part b): found by style id next to
 * the kit and continuity styles but never one of them (world-scoped), exact end frames,
 * deterministic, every pixel a game-b1 palette colour at 640x360 and at 1080p, the incoming frame
 * taking over; the continuity links name their kind; the calendar zoom pushes into its anchor;
 * the page slide comes up from the bottom edge; the attract cycle keeps A's shapes.
 */
import { CONTINUITY_KINDS, CONTINUITY_STYLE_IDS, TRANSITION_STYLE_IDS } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng.js';
import { resolveStyle } from '../../style.js';
import {
  compositeTransition,
  findTransition,
  GAME_B1_TRANSITION_IDS,
  GAME_B1_TRANSITION_STYLES,
  paletteNumbers,
  WORLD_TRANSITIONS,
  type GameB1TransitionId,
  type TransitionFrame,
} from '../index.js';

const style = resolveStyle({ style: 'game-b1' });
const PALETTE = paletteNumbers(style.swatches);
const hex = (name: string): number =>
  Number.parseInt((style.swatches[name] ?? '#000000').slice(1), 16);
const A_INKS = [hex('orange'), hex('cream')];
const B_INKS = [hex('mauve'), hex('crimson')];
const PALETTE_SET = new Set(PALETTE);

/** A frame: a dark picture with 5x5 blocks of the given colours. */
function frame(seed: number, inks: readonly number[], width = 160, height = 90): TransitionFrame {
  const rng = createRng(seed);
  const blocks = new Map<number, number>();
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const block = Math.floor(y / 5) * 1000 + Math.floor(x / 5);
      const inked = blocks.get(block) ?? (rng() < 0.35 ? rng.pick(inks) : -1);
      blocks.set(block, inked);
      const colour = inked >= 0 ? inked : (x + y) % 7 === 0 ? hex('night') : hex('void');
      data.set(
        [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff, 255],
        (y * width + x) * 4,
      );
    }
  return { width, height, data };
}

const A = frame(41, A_INKS);
const B = frame(42, B_INKS);

function composite(id: GameB1TransitionId, p: number, seed = 9, focus?: { x: number; y: number }) {
  return compositeTransition(id, { palette: PALETTE, focus }, A, B, p, seed);
}

function colours(data: Uint8Array): number[] {
  const out: number[] = [];
  for (let offset = 0; offset < data.length; offset += 4)
    out.push(
      ((data[offset] ?? 0) << 16) | ((data[offset + 1] ?? 0) << 8) | (data[offset + 2] ?? 0),
    );
  return out;
}

function shareOfB(data: Uint8Array): number {
  const all = colours(data);
  const b = all.filter((colour) => B_INKS.includes(colour)).length;
  const a = all.filter((colour) => A_INKS.includes(colour)).length;
  return b / Math.max(1, a + b);
}

describe('game-b1 game-native transitions', () => {
  it('are found by style id but are no kit or continuity style (world-scoped)', () => {
    expect([...GAME_B1_TRANSITION_IDS].sort()).toEqual(
      Object.keys(GAME_B1_TRANSITION_STYLES).sort(),
    );
    for (const id of GAME_B1_TRANSITION_IDS) {
      expect(findTransition(id)).toBe(WORLD_TRANSITIONS[id]);
      expect(WORLD_TRANSITIONS[id]).toMatchObject({ world: 'game-b1', type: 'wipe' });
      expect((TRANSITION_STYLE_IDS as readonly string[]).includes(id)).toBe(false);
      expect((CONTINUITY_STYLE_IDS as readonly string[]).includes(id)).toBe(false);
    }
  });

  it('names the continuity link the calendar zoom and the cartridge swaps carry', () => {
    expect(GAME_B1_TRANSITION_STYLES['game-b1-calendar-zoom'].link).toBe('zoom-through');
    expect(GAME_B1_TRANSITION_STYLES['game-b1-cartridge-in'].link).toBe('carry-environment');
    expect(GAME_B1_TRANSITION_STYLES['game-b1-cartridge-out'].link).toBe('carry-environment');
    for (const entry of Object.values(GAME_B1_TRANSITION_STYLES))
      if (entry.link !== undefined) expect(CONTINUITY_KINDS).toContain(entry.link);
    expect(GAME_B1_TRANSITION_STYLES['game-b1-page-turn'].link).toBeUndefined();
  });

  it.each(GAME_B1_TRANSITION_IDS)('%s: exact end frames, deterministic, palette only', (id) => {
    expect(Buffer.from(composite(id, 0)).equals(Buffer.from(A.data))).toBe(true);
    expect(Buffer.from(composite(id, 1)).equals(Buffer.from(B.data))).toBe(true);
    for (const p of [0.1, 0.35, 0.5, 0.65, 0.9]) {
      const first = composite(id, p);
      expect(Buffer.from(first).equals(Buffer.from(composite(id, p))), `p ${String(p)}`).toBe(true);
      const off = colours(first).filter((colour) => !PALETTE_SET.has(colour));
      expect(off, `p ${String(p)}`).toEqual([]);
    }
  });

  it.each(GAME_B1_TRANSITION_IDS)('%s: stays in the palette at 1080p', (id) => {
    const big = [frame(3, A_INKS, 480, 270), frame(4, B_INKS, 480, 270)] as const;
    for (const p of [0.2, 0.45, 0.8]) {
      const data = compositeTransition(id, { palette: PALETTE }, big[0], big[1], p, 5);
      expect(colours(data).filter((colour) => !PALETTE_SET.has(colour))).toEqual([]);
    }
  });

  it.each(GAME_B1_TRANSITION_IDS)('%s: the incoming frame takes over', (id) => {
    expect(shareOfB(composite(id, 0.08))).toBeLessThan(0.5);
    expect(shareOfB(composite(id, 0.97))).toBeGreaterThan(0.5);
  });

  it('pushes the calendar zoom into its anchor before the redraw', () => {
    const corner = { x: 0.1, y: 0.15 };
    const data = colours(composite('game-b1-calendar-zoom', 0.499, 9, corner));
    const source = colours(A.data);
    // the anchor's pixel is magnified to the middle of the frame
    const anchor = source[Math.floor(0.15 * 90) * 160 + Math.floor(0.1 * 160)];
    const centre = data[45 * 160 + 80];
    expect(centre).toBe(anchor);
    expect(data).not.toEqual(source);
  });

  it('slides the page up from the bottom edge (the first frames change only low)', () => {
    const data = colours(composite('game-b1-page-slide', 0.12));
    const source = colours(A.data);
    const changed = data.flatMap((colour, i) =>
      colour === source[i] ? [] : [Math.floor(i / 160)],
    );
    expect(changed.length).toBeGreaterThan(0);
    expect(Math.min(...changed)).toBeGreaterThan(90 * 0.7);
  });

  it("cycles the attract mode's colours but keeps A's shapes", () => {
    const data = colours(composite('game-b1-attract-cycle', 0.25));
    const source = colours(A.data);
    const inked = source.map((colour) => A_INKS.includes(colour));
    expect(data.some((colour, i) => inked[i] === true && colour !== source[i])).toBe(true);
    const blank = source.map((colour, i) => (inked[i] === true ? -1 : colour));
    expect(data.filter((colour, i) => blank[i] !== -1 && colour !== source[i]).length).toBeLessThan(
      source.length * 0.4,
    );
  });

  it('flips to the next screen sideways in whole blocks (the hero walks off the edge)', () => {
    const right = colours(composite('game-b1-screen-flip', 0.5, 9, { x: 0.9, y: 0.5 }));
    const a = colours(A.data);
    const b = colours(B.data);
    // half way A has moved left by half the frame (whole blocks); B's left edge follows it in
    expect(right[10 * 160]).toBe(a[10 * 160 + 80]);
    expect(right[10 * 160 + 80]).toBe(b[10 * 160]);
    const left = colours(composite('game-b1-screen-flip', 0.5, 9, { x: 0.1, y: 0.5 }));
    expect(left[10 * 160 + 80]).toBe(a[10 * 160]);
  });
});

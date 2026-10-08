/**
 * Game-native transitions of the Game B2 world (PLAN.md#13.4): found by style id next to the kit
 * and continuity styles but never one of them (world-scoped), exact end frames, deterministic per
 * seed, every pixel a game-b2 palette colour, the incoming frame taking over; the map links keep
 * the minimap's centre (the player) where it was.
 */
import { CONTINUITY_STYLE_IDS, TRANSITION_STYLE_IDS } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng.js';
import { resolveStyle } from '../../style.js';
import {
  compositeTransition,
  findTransition,
  GAME_B2_TRANSITION_IDS,
  GAME_B2_TRANSITION_STYLES,
  paletteNumbers,
  WORLD_TRANSITIONS,
  type GameB2TransitionId,
  type TransitionFrame,
} from '../index.js';

const WIDTH = 160;
const HEIGHT = 90;
const style = resolveStyle({ style: 'game-b2' });
const PALETTE = paletteNumbers(style.swatches);
const hex = (name: string): number =>
  Number.parseInt((style.swatches[name] ?? '#000000').slice(1), 16);
const A_INKS = [hex('sage'), hex('fluo')];
const B_INKS = [hex('pink'), hex('tungsten')];

/** A frame: a dark level with 5x5 blocks of the given colours. */
function frame(seed: number, inks: readonly number[]): TransitionFrame {
  const rng = createRng(seed);
  const blocks = new Map<number, number>();
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1)
    for (let x = 0; x < WIDTH; x += 1) {
      const block = Math.floor(y / 5) * 1000 + Math.floor(x / 5);
      const inked = blocks.get(block) ?? (rng() < 0.35 ? rng.pick(inks) : -1);
      blocks.set(block, inked);
      const colour = inked >= 0 ? inked : (x + y) % 7 === 0 ? hex('char') : hex('gloom');
      data.set(
        [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff, 255],
        (y * WIDTH + x) * 4,
      );
    }
  return { width: WIDTH, height: HEIGHT, data };
}

const A = frame(41, A_INKS);
const B = frame(42, B_INKS);
const PALETTE_SET = new Set(PALETTE);

function composite(id: GameB2TransitionId, p: number, seed = 9): Uint8Array {
  return compositeTransition(id, { palette: PALETTE }, A, B, p, seed);
}

function colours(data: Uint8Array): number[] {
  const out: number[] = [];
  for (let offset = 0; offset < data.length; offset += 4)
    out.push(
      ((data[offset] ?? 0) << 16) | ((data[offset + 1] ?? 0) << 8) | (data[offset + 2] ?? 0),
    );
  return out;
}

/** Share of the frame's inked pixels that are the incoming frame's inks. */
function shareOfB(data: Uint8Array): number {
  const all = colours(data);
  const b = all.filter((colour) => B_INKS.includes(colour)).length;
  const a = all.filter((colour) => A_INKS.includes(colour)).length;
  return b / Math.max(1, a + b);
}

describe('game-b2 game-native transitions', () => {
  it('are found by style id but are no kit or continuity style (world-scoped)', () => {
    expect([...GAME_B2_TRANSITION_IDS].sort()).toEqual(
      Object.keys(GAME_B2_TRANSITION_STYLES).sort(),
    );
    for (const id of GAME_B2_TRANSITION_IDS) {
      expect(findTransition(id)).toBe(WORLD_TRANSITIONS[id]);
      expect(WORLD_TRANSITIONS[id]).toMatchObject({ world: 'game-b2', type: 'wipe' });
      expect((TRANSITION_STYLE_IDS as readonly string[]).includes(id)).toBe(false);
      expect((CONTINUITY_STYLE_IDS as readonly string[]).includes(id)).toBe(false);
    }
  });

  it.each(GAME_B2_TRANSITION_IDS)('%s: exact end frames, deterministic, palette only', (id) => {
    expect(Buffer.from(composite(id, 0)).equals(Buffer.from(A.data))).toBe(true);
    expect(Buffer.from(composite(id, 1)).equals(Buffer.from(B.data))).toBe(true);
    for (const p of [0.1, 0.35, 0.5, 0.65, 0.9]) {
      const first = composite(id, p);
      expect(Buffer.from(first).equals(Buffer.from(composite(id, p))), `p ${String(p)}`).toBe(true);
      const off = colours(first).filter((colour) => !PALETTE_SET.has(colour));
      expect(off, `p ${String(p)}`).toEqual([]);
    }
  });

  it.each(GAME_B2_TRANSITION_IDS)('%s: the incoming frame takes over', (id) => {
    const early = shareOfB(composite(id, 0.08));
    const late = shareOfB(composite(id, 0.97));
    expect(early).toBeLessThan(0.5);
    expect(late).toBeGreaterThan(0.5);
  });

  it('melts in uneven columns that differ per seed', () => {
    const one = composite('game-b2-melt', 0.4, 1);
    const two = composite('game-b2-melt', 0.4, 2);
    expect(Buffer.from(one).equals(Buffer.from(two))).toBe(false);
  });

  it('unfolds the map out of the minimap: the first frames change only around it', () => {
    const data = composite('game-b2-map-unfold', 0.15);
    const changed: [number, number][] = [];
    for (let y = 0; y < HEIGHT; y += 1)
      for (let x = 0; x < WIDTH; x += 1) {
        const i = (y * WIDTH + x) * 4;
        if (data.slice(i, i + 3).some((v, k) => v !== A.data[i + k])) changed.push([x, y]);
      }
    expect(changed.length).toBeGreaterThan(0);
    // The minimap sits top right (542, 16, 78 x 58 at 640x360): nothing changes bottom-left.
    expect(changed.every(([x, y]) => x > WIDTH * 0.5 && y < HEIGHT * 0.6)).toBe(true);
  });
});

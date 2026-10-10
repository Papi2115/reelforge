/**
 * World `game-b1` (PLAN.md#13.5 parts a and c): registered in WORLDS, experimental and wired, its style
 * a valid world style (the 23 showcase inks, every token mapped, 640x360, no post dither, a
 * neutral variation budget), look A bound only in its own style, and the kit API (b1Screen) fails
 * with readable errors.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit, kitCatalog } from '../../kit.js';
import { getLook, isWorldStyle, listLooks, LOOKS } from '../../looks/index.js';
import { testRng } from '../../testing/rng.js';
import { isUnwiredWorldStyle, WORLDS } from '../index.js';
import {
  atariBossLook,
  atariMenuLook,
  atariStoryLook,
  GAME_B1,
  GAME_B1_ID,
  GAME_B1_STYLE,
} from './index.js';
import { B1_SWATCHES, B1_TABLE } from './palette.js';

const PALETTE: Readonly<Record<string, string>> = Object.fromEntries(
  B1_TABLE.map(([, swatch, hex]) => [swatch, hex]),
);
const TOKENS = [
  'sky',
  'ground',
  'groundAlt',
  'hero',
  'heroTrim',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'keyLight',
  'fillLight',
  'shadow',
  'text',
  'textDim',
  'outline',
];
const BUILT_IN = [undefined, 'voxel-pixel-crisp640', 'noir-voxel', 'soft-480'];

type Screen = Record<string, (...args: unknown[]) => unknown>;
type Factory = (params: Record<string, unknown>) => Screen;

function fx(style: string | undefined): Readonly<Record<string, unknown>> {
  return createKit({ three: THREE, palette: PALETTE, rng: testRng(5), style }).api.fx;
}

function screen(params: Record<string, unknown> = {}): Screen {
  const found = fx(GAME_B1_ID)['b1Screen'];
  if (typeof found !== 'function') throw new Error('kit.fx.b1Screen is not bound');
  return (found as Factory)({ duration: 6, ...params });
}

describe('world game-b1', () => {
  it('is wired after Game B2, experimental, with looks A, B, C on its own palette', () => {
    expect(WORLDS.filter((world) => world.wired).map((world) => world.id)).toEqual([
      'sketchbook',
      'comic',
      'game-b2',
      'game-b1',
      'c-cam',
    ]);
    expect(GAME_B1.experimental).toBe(true);
    expect(GAME_B1.wired).toBe(true);
    expect(isUnwiredWorldStyle(GAME_B1_ID)).toBe(false);
    expect(GAME_B1.soundPalette).toBe('game-b1');
    expect(GAME_B1.looks).toEqual([atariStoryLook, atariMenuLook, atariBossLook]);
    expect(GAME_B1.looks.map((look) => look.rolls)).toEqual([['A'], ['B'], ['C']]);
    for (const look of GAME_B1.looks) {
      expect(look.styles, look.id).toEqual([GAME_B1_ID]);
      expect(look.experimental, look.id).toBe(true);
      expect(look.soundPalette, look.id).toBe(GAME_B1.soundPalette);
      expect(look.variationBudget, look.id).toBe(GAME_B1_ID);
      expect(look.docs, look.id).toMatch(/focal point and three human traces/);
      expect(look.docs.length, look.id).toBeLessThan(2600);
    }
    expect(atariMenuLook.docs).toMatch(/never the same mechanism twice/);
  });

  it('has the 23 showcase inks, every token mapped, no token-named swatch', () => {
    const palette: Readonly<Record<string, string>> = GAME_B1_STYLE.palette;
    const hexes = Object.values(palette);
    expect(hexes).toHaveLength(23);
    expect(new Set(hexes).size).toBe(23);
    expect(Object.keys(palette)).toEqual(B1_SWATCHES);
    for (const name of Object.keys(palette)) expect(TOKENS).not.toContain(name);
    const tokens: Readonly<Record<string, string>> = GAME_B1_STYLE.tokens;
    expect(Object.keys(tokens).sort()).toEqual([...TOKENS].sort());
    for (const swatch of Object.values(tokens)) expect(palette[swatch]).toBeDefined();
    expect(GAME_B1_STYLE.resolution).toEqual({ width: 640, height: 360 });
    expect(GAME_B1_STYLE.dither.spread).toBe(0);
    expect(GAME_B1_STYLE.variation[GAME_B1_ID].toneShare).toBe(0);
  });

  it('offers its look only in its own style and binds b1Screen only there', () => {
    expect(isWorldStyle(GAME_B1_ID)).toBe(true);
    expect(listLooks(LOOKS, { style: GAME_B1_ID })).toEqual([]);
    expect(listLooks(LOOKS, { style: GAME_B1_ID, experimental: true })).toEqual(GAME_B1.looks);
    for (const style of [...BUILT_IN, 'game-b2']) {
      for (const look of GAME_B1.looks)
        expect(getLook(look.id, LOOKS, { style, experimental: true })).toBeUndefined();
      expect(Object.keys(fx(style))).not.toContain('b1Screen');
    }
    expect(Object.keys(fx(GAME_B1_ID))).toContain('b1Screen');
    expect(Object.keys(fx(GAME_B1_ID))).not.toContain('b2View');
    const catalog = kitCatalog([], LOOKS, { style: GAME_B1_ID, experimental: true });
    expect(catalog.fx.map((entry) => [entry.name, entry.look])).toEqual([
      ['b1Screen', 'atari-story'],
    ]);
  });
});

describe('kit.fx.b1Screen', () => {
  it('builds a room, a painter and the whole HUD and renders frames on the quad', () => {
    const s = screen({ seed: 1 });
    s['tv']?.((g: { rect: (...a: unknown[]) => void }) => {
      g.rect(0, 0, 160, 90, 'night');
    });
    s['room']?.({
      tree: true,
      lamp: true,
      carts: 2,
      gift: { slot: [0, 1], tag: ['E.T.'], tagAt: [1, 2] },
    });
    s['camera']?.([
      { at: 0, on: 'room' },
      { at: 2, on: 'tv' },
    ]);
    expect(s['year']?.('1982', { at: 0 })).toEqual({ at: 0, end: 6 });
    s['score']?.({ label: 'weeks', keys: [[0, 5]] });
    s['progress']?.({ from: 0.1, to: 0.2 });
    s['checkpoint']?.({ label: 'Chapter 1', at: 0.5 });
    s['lives']?.({ label: 'market', max: 3, keys: [[1, 2]] });
    s['boss']?.({ num: 1, name: 'The deadline', at: 0.2, hp: { n: 5, label: 'weeks' } });
    expect(s['say']?.('Christmas 1982.', { speaker: 'dad', at: 0.4 })).toMatchObject({ at: 0.4 });
    s['note']?.(['weak point:', 'more time'], { at: 1, x: 172, y: 190 });
    for (const t of [0, 1, 1.9, 2.5]) s['update']?.(t);
  });

  it('names what it cannot draw and a broken camera', () => {
    const s = screen();
    expect(() => s['say']?.('café', { at: 0 })).toThrow(/cannot draw É/);
    expect(() => s['say']?.('A\nB\nC\nD', { at: 0 })).toThrow(/4 lines, max 3/);
    expect(() => s['year']?.('MCMLXXXII', { at: 0 })).toThrow(/1-4 digits/);
    expect(() => s['note']?.(['½ off'], { at: 0, x: 1, y: 1 })).toThrow(/cannot write ½/);
    expect(() => s['tv']?.('rect')).toThrow(/pass a function/);
    expect(() => s['camera']?.([{ at: 0 }])).toThrow(/either on: 'room'/);
    expect(() =>
      s['camera']?.([
        { at: 2, on: 'room' },
        { at: 1, on: 'tv' },
      ]),
    ).toThrow(/time order/);
    expect(() => s['progress']?.({ from: 0.5, to: 0.2 })).toThrow(/to must be >= from/);
    expect(() => s['room']?.({ sofa: true })).toThrow(/room\(\)/);
  });

  it('enforces the 2600 rules in the painter with readable errors', () => {
    const s = screen();
    const wide = '#'.repeat(17);
    s['tv']?.((g: { sprite: (...a: unknown[]) => void }) => {
      g.sprite([wide], 'cream', 0, 0);
    });
    expect(() => s['update']?.(0)).toThrow(/<= 16 bits/);
    const t = screen();
    t['tv']?.((g: { rect: (...a: unknown[]) => void }) => {
      g.rect(0, 0, 1, 1, 'pink');
    });
    expect(() => t['update']?.(0)).toThrow(/"pink" is not a game-b1 colour/);
  });
});

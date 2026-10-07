/**
 * World `game-b2` (PLAN.md#13.4): registered in WORLDS, experimental, its style a valid world style
 * (32 showcase colours, every token mapped, 640x360, no post dither, a neutral variation budget),
 * look A bound only in its style, and the kit API (b2View, b2Hud) fails with readable errors.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit, kitCatalog } from '../../kit.js';
import { getLook, isWorldStyle, listLooks, LOOKS } from '../../looks/index.js';
import { testRng } from '../../testing/rng.js';
import { WORLDS } from '../index.js';
import { GAME_B2, GAME_B2_ID, GAME_B2_STYLE, rpgExploreLook } from './index.js';
import { B2_SWATCHES, B2_TABLE } from './palette.js';

const PALETTE: Readonly<Record<string, string>> = Object.fromEntries(
  B2_TABLE.map(([, swatch, hex]) => [swatch, hex]),
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

type Factory = (params: Record<string, unknown>) => Record<string, (...args: unknown[]) => unknown>;

function fx(style: string | undefined): Readonly<Record<string, unknown>> {
  return createKit({ three: THREE, palette: PALETTE, rng: testRng(3), style }).api.fx;
}

function factory(name: 'b2View' | 'b2Hud'): Factory {
  const found = fx(GAME_B2_ID)[name];
  if (typeof found !== 'function') throw new Error(`kit.fx.${name} is not bound`);
  return found as Factory;
}

const PATH = [{ at: 0, x: 2.5, y: 8.5, yaw: 0 }];

describe('world game-b2', () => {
  it('is registered, experimental, with look A on a placeholder sound palette', () => {
    expect(WORLDS).toContain(GAME_B2);
    expect(GAME_B2.experimental).toBe(true);
    expect(GAME_B2.looks).toEqual([rpgExploreLook]);
    expect(rpgExploreLook.rolls).toEqual(['A']);
    expect(rpgExploreLook.styles).toEqual([GAME_B2_ID]);
    expect(rpgExploreLook.experimental).toBe(true);
    expect(rpgExploreLook.soundPalette).toBe('retro-ui');
    expect(rpgExploreLook.variationBudget).toBe(GAME_B2_ID);
  });

  it('has the 32 showcase colours, every token mapped, no token-named swatch', () => {
    const palette: Readonly<Record<string, string>> = GAME_B2_STYLE.palette;
    const hexes = Object.values(palette);
    expect(hexes).toHaveLength(32);
    expect(new Set(hexes).size).toBe(32);
    expect(Object.keys(palette)).toEqual(B2_SWATCHES);
    for (const name of Object.keys(palette)) expect(TOKENS).not.toContain(name);
    const tokens: Readonly<Record<string, string>> = GAME_B2_STYLE.tokens;
    expect(Object.keys(tokens).sort()).toEqual([...TOKENS].sort());
    for (const swatch of Object.values(tokens)) expect(palette[swatch]).toBeDefined();
    expect(GAME_B2_STYLE.resolution).toEqual({ width: 640, height: 360 });
    expect((1920 % 640) + (1080 % 360)).toBe(0);
    expect(GAME_B2_STYLE.dither.spread).toBe(0);
    expect(GAME_B2_STYLE.variation[GAME_B2_ID].toneShare).toBe(0);
  });

  it('offers its look only in its own style and binds b2View / b2Hud only there', () => {
    expect(isWorldStyle(GAME_B2_ID)).toBe(true);
    expect(listLooks(LOOKS, { style: GAME_B2_ID })).toEqual([]);
    expect(listLooks(LOOKS, { style: GAME_B2_ID, experimental: true })).toEqual([rpgExploreLook]);
    for (const style of BUILT_IN) {
      expect(getLook('rpg-explore', LOOKS, { style, experimental: true })).toBeUndefined();
      expect(Object.keys(fx(style))).not.toContain('b2View');
    }
    expect(Object.keys(fx(GAME_B2_ID))).toEqual(expect.arrayContaining(['b2View', 'b2Hud']));
    const catalog = kitCatalog([], LOOKS, { style: GAME_B2_ID, experimental: true });
    expect(catalog.fx.map((entry) => [entry.name, entry.look])).toEqual([
      ['b2View', 'rpg-explore'],
      ['b2Hud', 'rpg-explore'],
    ]);
    expect(rpgExploreLook.docs).toMatch(/focal point and three human traces/);
    expect(rpgExploreLook.docs.length).toBeLessThan(2600);
  });
});

describe('kit.fx.b2View / b2Hud', () => {
  it('builds a built-in level, takes an item and renders frames on the quad', () => {
    const view = factory('b2View')({ level: 'warehouse', stencil: 'E.T.', path: PATH, seed: 1 });
    view['take']?.({ label: 'E.T.' }, { at: 0.2, from: [3.5, 7.05, 0.45] });
    view['open']?.([19, 8], { at: 0.5 });
    const hud = factory('b2Hud')({ view, duration: 4, seed: 1 });
    hud['compass']?.({ year: '1982', place: 'THE WAREHOUSE' });
    hud['minimap']?.();
    expect(hud['narrate']?.('ATARI BETS ON A HIT', { at: 0.5 })).toMatchObject({ at: 0.5 });
    for (const t of [0, 1.3, 2.6]) {
      view['update']?.(t);
      hud['update']?.(t);
    }
    expect(view['cameraAt']?.(0)).toMatchObject({ x: 2.5, y: 8.5 });
  });

  it('names the grid row of a broken level and a path key inside a wall', () => {
    const level = {
      name: 'bad',
      grid: ['###', '#.x', '###'],
      legend: { '#': { wall: 'concrete' } },
    };
    expect(() => factory('b2View')({ level, path: PATH })).toThrow(
      /grid row 1: "x" at x=2 is not in the legend/,
    );
    expect(() =>
      factory('b2View')({ level: 'warehouse', path: [{ at: 0, x: 0.5, y: 0.5 }] }),
    ).toThrow(/path\[0\]: \[0\.5, 0\.5\] is inside the wall "#"/);
  });

  it('rejects text the HUD cannot draw, an unlinked minimap and a foreign view', () => {
    const hud = factory('b2Hud')({ duration: 4 });
    expect(() => hud['say']?.('café', { at: 0 })).toThrow(/cannot draw: É/);
    expect(() => hud['say']?.('ONE\nTWO\nTHREE\nFOUR', { at: 0 })).toThrow(/4 lines, max 3/);
    expect(() => hud['minimap']?.()).toThrow(/needs the view/);
    expect(() => factory('b2Hud')({ view: {} })).toThrow(
      /view must be the object kit\.fx\.b2View\(\) returned/,
    );
    expect(() =>
      hud['choose']?.({ options: ['A', 'B'], at: 0, until: 1, steps: [{ at: 0.5, strike: 3 }] }),
    ).toThrow(/step index 3 has no option/);
  });
});

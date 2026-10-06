/**
 * World `sketchbook` (PLAN.md#13.6, part a): registered in WORLDS, experimental, its style a valid
 * world style (palette, tokens, resolution, palette-pure post), its look A offered only in its
 * own style (and only to scopes that ask for experimental looks), its template bound in ctx.kit
 * only there.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit, kitCatalog } from '../../kit.js';
import { getLook, isWorldStyle, listLooks, LOOKS } from '../../looks/index.js';
import { CRISP_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import { WORLDS } from '../index.js';
import { LETTERING_CHARS } from './draw/glyphs.js';
import { SKETCHBOOK, SKETCHBOOK_ID, SKETCHBOOK_STYLE, sketchStoryLook } from './index.js';
import { INK_TABLE, SWATCH_NAMES } from './inks.js';
import { SKETCHBOOK_PALETTE } from '../../testing/palettes.js';

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

function fxNames(style: string | undefined, palette = CRISP_PALETTE): string[] {
  const { api } = createKit({ three: THREE, palette, rng: testRng(3), style });
  return Object.keys(api.fx);
}

describe('world sketchbook', () => {
  it('is registered, experimental, with look A only (parts b/c come later)', () => {
    expect(WORLDS).toContain(SKETCHBOOK);
    expect(SKETCHBOOK.id).toBe(SKETCHBOOK_ID);
    expect(SKETCHBOOK.experimental).toBe(true);
    expect(SKETCHBOOK.looks).toEqual([sketchStoryLook]);
    expect(sketchStoryLook.styles).toEqual([SKETCHBOOK_ID]);
    expect(sketchStoryLook.experimental).toBe(true);
    expect(sketchStoryLook.rolls).toEqual(['A']);
    expect(Object.isFrozen(SKETCHBOOK)).toBe(true);
  });

  it('has a style with <= 32 unique colours, every token mapped and no token-named swatch', () => {
    const palette: Readonly<Record<string, string>> = SKETCHBOOK_STYLE.palette;
    const hexes = Object.values(palette);
    expect(hexes).toHaveLength(24);
    expect(new Set(hexes).size).toBe(hexes.length);
    expect(Object.keys(palette)).toEqual(SWATCH_NAMES);
    for (const name of Object.keys(palette)) expect(TOKENS).not.toContain(name);
    const tokens: Readonly<Record<string, string>> = SKETCHBOOK_STYLE.tokens;
    expect(Object.keys(tokens).sort()).toEqual([...TOKENS].sort());
    for (const swatch of Object.values(tokens)) expect(palette[swatch]).toBeDefined();
  });

  it('renders at the showcase size (x2 = 1080p) with no dither: pixels stay exact palette colours', () => {
    expect(SKETCHBOOK_STYLE.resolution).toEqual({ width: 960, height: 540 });
    expect(1920 % SKETCHBOOK_STYLE.resolution.width).toBe(0);
    expect(1080 % SKETCHBOOK_STYLE.resolution.height).toBe(0);
    expect(SKETCHBOOK_STYLE.dither.spread).toBe(0);
    expect(INK_TABLE.map(([, , hex]) => hex)).toEqual(Object.values(SKETCHBOOK_STYLE.palette));
  });

  it('offers look A only in its own style, and only to scopes asking for experimental looks', () => {
    expect(isWorldStyle(SKETCHBOOK_ID)).toBe(true);
    expect(listLooks(LOOKS, { style: SKETCHBOOK_ID })).toEqual([]);
    expect(listLooks(LOOKS, { style: SKETCHBOOK_ID, experimental: true })).toEqual([
      sketchStoryLook,
    ]);
    for (const style of [undefined, 'voxel-pixel-crisp640', 'noir-voxel', 'soft-480']) {
      expect(listLooks(LOOKS, { style, experimental: true })).not.toContain(sketchStoryLook);
      expect(getLook('sketch-story', LOOKS, { style, experimental: true })).toBeUndefined();
    }
    const catalog = kitCatalog([], LOOKS, { style: SKETCHBOOK_ID, experimental: true });
    expect(catalog.looks.map((look) => look.id)).toEqual(['sketch-story']);
    expect(catalog.fx.map((entry) => entry.name)).toEqual(['sketchPage']);
    expect(kitCatalog([], LOOKS, { style: SKETCHBOOK_ID }).looks).toEqual([]);
  });

  it('binds kit.fx.sketchPage only in the sketchbook style', () => {
    expect(fxNames(SKETCHBOOK_ID, SKETCHBOOK_PALETTE)).toContain('sketchPage');
    for (const style of [undefined, 'voxel-pixel-crisp640', 'noir-voxel', 'soft-480']) {
      expect(fxNames(style)).not.toContain('sketchPage');
    }
  });

  it('keeps the craft brief and references in the look docs', () => {
    expect(sketchStoryLook.docs).toContain('kit.fx.sketchPage');
    expect(sketchStoryLook.docs).toMatch(/focal point and three human traces/);
    expect(sketchStoryLook.docs).toMatch(/never polish/);
    expect(sketchStoryLook.docs).toContain('docs/worlds/sketchbook-v2/shots/');
    expect(sketchStoryLook.docs.match(/s\d-t[\d.]+\.png/g)).toHaveLength(3);
  });

  it('writes every character the showcase pages use (own CC0 stroke lettering)', () => {
    for (const char of "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz .,?!:-+=×÷≈→✓✗()/'¼") {
      expect(LETTERING_CHARS, char).toContain(char);
    }
  });
});

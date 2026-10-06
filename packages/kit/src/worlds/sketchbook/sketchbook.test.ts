/**
 * World `sketchbook` (PLAN.md#13.6): registered in WORLDS, experimental, its style a valid world
 * style (palette, tokens, resolution, palette-pure post, a neutral variation budget), its looks
 * A/B/C offered only in its own style (and only to scopes that ask for experimental looks), the
 * one world-level template they share bound in ctx.kit (and catalogued) once, only there.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit, kitCatalog } from '../../kit.js';
import { getLook, isWorldStyle, listLooks, LOOKS } from '../../looks/index.js';
import { CRISP_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import { WORLDS } from '../index.js';
import { LETTERING_CHARS } from './draw/glyphs.js';
import {
  SKETCHBOOK,
  SKETCHBOOK_ID,
  SKETCHBOOK_STYLE,
  sketchGraphLook,
  sketchLoudLook,
  sketchStoryLook,
} from './index.js';
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
  it('is registered, experimental, with looks A, B and C on the sketchbook sound palette', () => {
    expect(WORLDS).toContain(SKETCHBOOK);
    expect(SKETCHBOOK.id).toBe(SKETCHBOOK_ID);
    expect(SKETCHBOOK.experimental).toBe(true);
    expect(SKETCHBOOK.looks).toEqual([sketchStoryLook, sketchGraphLook, sketchLoudLook]);
    expect(SKETCHBOOK.looks.map((look) => look.rolls)).toEqual([['A'], ['B'], ['C']]);
    expect(SKETCHBOOK.soundPalette).toBe('sketchbook');
    for (const look of SKETCHBOOK.looks) {
      expect(look.styles, look.id).toEqual([SKETCHBOOK_ID]);
      expect(look.experimental, look.id).toBe(true);
      expect(look.soundPalette, look.id).toBe('sketchbook');
      expect(look.variationBudget, look.id).toBe('sketchbook');
    }
    expect(Object.isFrozen(SKETCHBOOK)).toBe(true);
  });

  it('shares one world-level sketchPage definition between its looks', () => {
    const [shared] = sketchStoryLook.kit.templates ?? [];
    expect(shared?.name).toBe('sketchPage');
    for (const look of SKETCHBOOK.looks) expect(look.kit.templates, look.id).toEqual([shared]);
  });

  it('has a neutral variation budget under the key of its looks', () => {
    const budget = SKETCHBOOK_STYLE.variation.sketchbook;
    expect(budget.tones).toEqual({});
    expect(budget.toneShare).toBe(0);
    expect(budget.cameraDrift).toEqual([0, 0]);
    for (const axis of ['cell', 'horizon', 'fade', 'lightAzimuth', 'lightElevation', 'debris']) {
      const [min, max] = budget[axis as 'cell'];
      expect(min, axis).toBe(max);
    }
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

  it('offers its looks only in its own style, and only to scopes asking for experimental looks', () => {
    expect(isWorldStyle(SKETCHBOOK_ID)).toBe(true);
    expect(listLooks(LOOKS, { style: SKETCHBOOK_ID })).toEqual([]);
    expect(listLooks(LOOKS, { style: SKETCHBOOK_ID, experimental: true })).toEqual([
      sketchStoryLook,
      sketchGraphLook,
      sketchLoudLook,
    ]);
    for (const style of [undefined, 'voxel-pixel-crisp640', 'noir-voxel', 'soft-480']) {
      for (const look of SKETCHBOOK.looks) {
        expect(listLooks(LOOKS, { style, experimental: true })).not.toContain(look);
        expect(getLook(look.id, LOOKS, { style, experimental: true })).toBeUndefined();
      }
    }
    const catalog = kitCatalog([], LOOKS, { style: SKETCHBOOK_ID, experimental: true });
    expect(catalog.looks.map((look) => look.id)).toEqual([
      'sketch-story',
      'sketch-graph',
      'sketch-loud',
    ]);
    expect(catalog.fx.map((entry) => [entry.name, entry.look])).toEqual([
      ['sketchPage', 'sketch-story'],
    ]);
    expect(kitCatalog([], LOOKS, { style: SKETCHBOOK_ID }).looks).toEqual([]);
  });

  it('binds kit.fx.sketchPage only in the sketchbook style', () => {
    expect(fxNames(SKETCHBOOK_ID, SKETCHBOOK_PALETTE)).toContain('sketchPage');
    for (const style of [undefined, 'voxel-pixel-crisp640', 'noir-voxel', 'soft-480']) {
      expect(fxNames(style)).not.toContain('sketchPage');
    }
  });

  it('keeps the craft brief and references in the look docs', () => {
    expect(sketchStoryLook.docs).toMatch(/focal point and three human traces/);
    expect(sketchStoryLook.docs).toMatch(/never polish/);
    for (const look of SKETCHBOOK.looks) {
      expect(look.docs, look.id).toContain('kit.fx.sketchPage');
      expect(look.docs, look.id).toMatch(/focal point and (three )?(human )?traces/);
      expect(look.docs, look.id).toMatch(/always `page.write`/);
      expect(look.docs, look.id).toContain('docs/worlds/sketchbook-v2/shots/');
      expect(look.docs.match(/s\d+-t[\d.]+\.png/g), look.id).toHaveLength(3);
    }
  });

  it('writes every character the showcase pages use (own CC0 stroke lettering)', () => {
    for (const char of "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz .,?!:-+=×÷≈→✓✗()/'¼") {
      expect(LETTERING_CHARS, char).toContain(char);
    }
  });
});

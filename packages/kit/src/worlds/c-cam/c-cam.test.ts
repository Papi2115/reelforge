/**
 * World `c-cam` / Grim Ink (PLAN.md#14.2): registered last in WORLDS, experimental and NOT wired,
 * a full-colour 1920x1080 style whose swatches come from the C palette, looks A/B/C offered only
 * in its own style to scopes asking for experimental looks, each bringing the same
 * `kit.fx.inkStage` (any one look alone binds it), nothing bound for the other styles.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit, kitCatalog } from '../../kit.js';
import { getLook, isWorldStyle, listLooks, LOOKS } from '../../looks/index.js';
import type { Look } from '../../looks/types.js';
import { CRISP_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import { isUnwiredWorldStyle, WORLDS } from '../index.js';
import { C } from './core.js';
import {
  C_CAM,
  C_CAM_ID,
  C_CAM_STYLE,
  inkInsertLook,
  inkPosterLook,
  inkSceneLook,
} from './index.js';
import { inkStage } from './stage.js';

const LOOKS_ABC = [inkSceneLook, inkInsertLook, inkPosterLook];
const OTHER_STYLES = [
  undefined,
  'voxel-pixel-crisp640',
  'noir-voxel',
  'soft-480',
  'sketchbook',
  'comic',
  'game-b2',
  'game-b1',
];
const TOKENS = [
  ...['sky', 'ground', 'groundAlt', 'hero', 'heroTrim', 'accent1', 'accent2', 'accent3'],
  ...['accent4', 'keyLight', 'fillLight', 'shadow', 'text', 'textDim', 'outline'],
];

function fxNames(style: string | undefined, looks: readonly Look[] = LOOKS): string[] {
  const { api } = createKit({
    three: THREE,
    palette: CRISP_PALETTE,
    rng: testRng(3),
    looks,
    style,
  });
  return Object.keys(api.fx);
}

describe('world c-cam (Grim Ink)', () => {
  it('is registered last, experimental and not wired, with looks A, B, C', () => {
    expect(WORLDS.at(-1)).toBe(C_CAM);
    expect(C_CAM).toMatchObject({ id: 'c-cam', label: 'Grim Ink', experimental: true });
    expect(C_CAM.wired).toBe(false);
    expect(isUnwiredWorldStyle(C_CAM_ID)).toBe(true);
    expect(C_CAM.fonts).toEqual({ display: 'display', mono: 'mono' });
    expect(C_CAM.looks).toEqual(LOOKS_ABC);
    expect(LOOKS_ABC.map((look) => look.id)).toEqual(['ink-scene', 'ink-insert', 'ink-poster']);
    expect(LOOKS_ABC.map((look) => look.rolls)).toEqual([['A'], ['B'], ['C']]);
    for (const look of LOOKS_ABC) {
      expect(look.styles, look.id).toEqual([C_CAM_ID]);
      expect(look.experimental, look.id).toBe(true);
      expect(look.available, look.id).toBe(true);
      expect(look.variationBudget, look.id).toBe('c-cam');
      expect(look.soundPalette, look.id).toBe(C_CAM.soundPalette);
      const lines = look.docs.split('\n').length;
      expect(lines, look.id).toBeGreaterThanOrEqual(3);
      expect(lines, look.id).toBeLessThanOrEqual(6);
      expect(look.docs, look.id).toContain('kit.fx.inkStage()');
    }
    expect(Object.isFrozen(C_CAM)).toBe(true);
  });

  it('has a native 1080p full-colour style from the C palette, every token mapped', () => {
    expect(C_CAM_STYLE).toMatchObject({
      id: 'c-cam',
      name: 'Grim Ink',
      resolution: { width: 1920, height: 1080 },
      quantize: false,
      dither: { matrix: 'bayer4', spread: 0 },
    });
    const palette = C_CAM_STYLE.palette;
    const hexes = Object.values(palette);
    expect(hexes.length).toBeLessThanOrEqual(32);
    expect(new Set(hexes).size).toBe(hexes.length);
    const fromC: readonly string[] = Object.values(C);
    for (const hex of hexes) expect(fromC).toContain(hex);
    expect(palette['ink']).toBe(C.INK);
    for (const name of Object.keys(palette)) expect(TOKENS).not.toContain(name);
    const tokens: Readonly<Record<string, string>> = C_CAM_STYLE.tokens;
    expect(Object.keys(tokens).sort()).toEqual([...TOKENS].sort());
    for (const swatch of Object.values(tokens)) expect(palette[swatch], swatch).toBeDefined();
    expect(tokens['shadow']).toBe('ink');
    const budget = C_CAM_STYLE.variation['c-cam'];
    expect(budget.tones).toEqual({});
    expect(budget.toneShare).toBe(0);
    expect(budget.cameraDrift).toEqual([0, 0]);
  });

  it('offers its looks only in its own style, and only to scopes asking for experimental looks', () => {
    expect(isWorldStyle(C_CAM_ID)).toBe(true);
    expect(listLooks(LOOKS, { style: C_CAM_ID })).toEqual([]);
    expect(listLooks(LOOKS, { style: C_CAM_ID, experimental: true })).toEqual(LOOKS_ABC);
    for (const style of OTHER_STYLES) {
      for (const look of LOOKS_ABC) {
        expect(listLooks(LOOKS, { style, experimental: true })).not.toContain(look);
        expect(getLook(look.id, LOOKS, { style, experimental: true })).toBeUndefined();
      }
    }
    const catalog = kitCatalog([], LOOKS, { style: C_CAM_ID, experimental: true });
    expect(catalog.looks.map((look) => look.id)).toEqual(['ink-scene', 'ink-insert', 'ink-poster']);
    expect(catalog.fx.map((entry) => [entry.name, entry.look])).toEqual([
      ['inkStage', 'ink-scene'],
    ]);
    expect(catalog.voxel).toEqual({});
  });

  it('binds kit.fx.inkStage only in its style, from any one of its looks alone', () => {
    expect(fxNames(C_CAM_ID)).toContain('inkStage');
    for (const look of LOOKS_ABC) {
      expect(look.kit.fx, look.id).toEqual([inkStage]);
      expect(fxNames(C_CAM_ID, [look]), look.id).toContain('inkStage');
    }
    for (const style of OTHER_STYLES)
      expect(fxNames(style), String(style)).not.toContain('inkStage');
  });
});

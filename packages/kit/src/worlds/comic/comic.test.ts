/**
 * World `comic` (PLAN.md#13.3): registered in WORLDS, experimental, its style a valid world style
 * (22 print inks, every token, 640x360 = 1080p / 3, palette-pure post, a neutral variation
 * budget), looks A/B/C offered only in its own style (and only to scopes that ask for
 * experimental looks), `kit.fx.comicPage` bound only there, the craft briefs and their showcase
 * references, its own sound palette.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit, kitCatalog } from '../../kit.js';
import { getLook, isWorldStyle, listLooks, LOOKS } from '../../looks/index.js';
import type { KitPalette } from '../../types.js';
import { CRISP_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import { WORLDS } from '../index.js';
import { DISPLAY_CHARS, LETTERING_CHARS } from './draw/fonts.js';
import {
  COMIC,
  COMIC_ID,
  COMIC_STYLE,
  comicInfoLook,
  comicLoudLook,
  comicStoryLook,
} from './index.js';
import { INK_TABLE, SWATCH_NAMES } from './inks.js';
import type { ComicPageObject } from './page/comic-page.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..', '..');
const LOOKS_ABC = [comicStoryLook, comicInfoLook, comicLoudLook];
const BUILT_IN = [undefined, 'voxel-pixel-crisp640', 'noir-voxel', 'soft-480'];
const TOKENS = [
  ...['sky', 'ground', 'groundAlt', 'hero', 'heroTrim', 'accent1', 'accent2', 'accent3'],
  ...['accent4', 'keyLight', 'fillLight', 'shadow', 'text', 'textDim', 'outline'],
];

const COMIC_PALETTE: KitPalette = (() => {
  const swatches: Readonly<Record<string, string>> = COMIC_STYLE.palette;
  const tokens = Object.fromEntries(
    Object.entries(COMIC_STYLE.tokens).map(([token, swatch]) => [token, swatches[swatch] ?? '']),
  );
  return { ...swatches, ...tokens };
})();

function fxNames(style: string | undefined, palette = CRISP_PALETTE): string[] {
  const { api } = createKit({ three: THREE, palette, rng: testRng(3), style });
  return Object.keys(api.fx);
}

describe('world comic', () => {
  it('is registered after sketchbook, experimental, with looks A, B, C on its own sound palette', () => {
    const ids = WORLDS.map((world) => world.id);
    expect(WORLDS).toContain(COMIC);
    expect(ids.indexOf(COMIC_ID)).toBe(ids.indexOf('sketchbook') + 1);
    expect(COMIC.experimental).toBe(true);
    expect(COMIC.looks).toEqual(LOOKS_ABC);
    expect(LOOKS_ABC.map((look) => look.rolls)).toEqual([['A'], ['B'], ['C']]);
    expect(COMIC.soundPalette).toBe('comic');
    for (const look of LOOKS_ABC) {
      expect(look.styles, look.id).toEqual([COMIC_ID]);
      expect(look.experimental, look.id).toBe(true);
      expect(look.variationBudget, look.id).toBe('comic');
      expect(look.soundPalette, look.id).toBe('comic');
    }
    expect(Object.isFrozen(COMIC)).toBe(true);
  });

  it('has a style with the 22 print inks, every token mapped and no token-named swatch', () => {
    const palette: Readonly<Record<string, string>> = COMIC_STYLE.palette;
    const hexes = Object.values(palette);
    expect(hexes).toHaveLength(22);
    expect(new Set(hexes).size).toBe(hexes.length);
    expect(Object.keys(palette)).toEqual(SWATCH_NAMES);
    expect(INK_TABLE.map(([, , hex]) => hex)).toEqual(hexes);
    for (const name of Object.keys(palette)) expect(TOKENS).not.toContain(name);
    const tokens: Readonly<Record<string, string>> = COMIC_STYLE.tokens;
    expect(Object.keys(tokens).sort()).toEqual([...TOKENS].sort());
    for (const swatch of Object.values(tokens)) expect(palette[swatch]).toBeDefined();
  });

  it('renders at the showcase size (x3 = 1080p) with no dither and a neutral budget', () => {
    expect(COMIC_STYLE.resolution).toEqual({ width: 640, height: 360 });
    expect(1920 % COMIC_STYLE.resolution.width).toBe(0);
    expect(1080 % COMIC_STYLE.resolution.height).toBe(0);
    expect(COMIC_STYLE.dither.spread).toBe(0);
    const budget = COMIC_STYLE.variation.comic;
    expect(budget.tones).toEqual({});
    expect(budget.toneShare).toBe(0);
    expect(budget.cameraDrift).toEqual([0, 0]);
  });

  it('offers its look only in its own style, and only to scopes asking for experimental looks', () => {
    expect(isWorldStyle(COMIC_ID)).toBe(true);
    expect(listLooks(LOOKS, { style: COMIC_ID })).toEqual([]);
    expect(listLooks(LOOKS, { style: COMIC_ID, experimental: true })).toEqual(LOOKS_ABC);
    for (const style of [...BUILT_IN, 'sketchbook']) {
      for (const look of LOOKS_ABC) {
        expect(listLooks(LOOKS, { style, experimental: true })).not.toContain(look);
        expect(getLook(look.id, LOOKS, { style, experimental: true })).toBeUndefined();
      }
    }
    const catalog = kitCatalog([], LOOKS, { style: COMIC_ID, experimental: true });
    expect(catalog.looks.map((look) => look.id)).toEqual([
      'comic-story',
      'comic-info',
      'comic-loud',
    ]);
    expect(catalog.fx.map((entry) => [entry.name, entry.look])).toEqual([
      ['comicPage', 'comic-story'],
    ]);
    expect(catalog.voxel).toEqual({});
  });

  it('binds kit.fx.comicPage only in the comic style', () => {
    expect(fxNames(COMIC_ID, COMIC_PALETTE)).toContain('comicPage');
    for (const style of [...BUILT_IN, 'sketchbook'])
      expect(fxNames(style)).not.toContain('comicPage');
  });

  it('builds a page through ctx.kit and repaints it for any t', () => {
    const { api } = createKit({
      three: THREE,
      palette: COMIC_PALETTE,
      rng: testRng(4),
      style: COMIC_ID,
    });
    // ctx.kit is typed by the built-in registry; world templates are bound by style at runtime.
    const fx: Readonly<Record<string, unknown>> = api.fx;
    const factory = fx['comicPage'] as (params: { seed: number }) => ComicPageObject;
    const page = factory({ seed: 9 });
    const [left, right] = page.panels('2-up');
    left?.draw((g) => {
      g.rect(0, 0, 640, 360, 'night');
    });
    right?.draw((g) => {
      g.rect(0, 0, 640, 360, 'cyanDeep');
    });
    page.balloon('GO.', { x: 320, y: 100, at: 0.5, tail: [300, 200] });
    expect(() => {
      page.update(0);
      page.update(1);
    }).not.toThrow();
    expect(page.size).toEqual([640, 360]);
  });

  it.each(LOOKS_ABC)(
    '$id keeps its craft brief and three showcase references that exist',
    (look) => {
      const { docs } = look;
      expect(docs).toContain('kit.fx.comicPage');
      expect(docs).toMatch(/focal point and three human traces/);
      expect(docs).toMatch(/never ctx\.text/i);
      const refs = docs.match(/s\d+-t[\d.]+\.png/g) ?? [];
      expect(refs).toHaveLength(3);
      for (const ref of refs) {
        expect(
          existsSync(path.join(REPO_ROOT, 'docs/worlds/comic-panels-v2/shots', ref)),
          ref,
        ).toBe(true);
      }
      for (const example of docs.match(/[a-z]\d_[a-z_\d]+\.js/g) ?? []) {
        expect(
          existsSync(path.join(REPO_ROOT, 'packages/kit/examples/comic', example)),
          example,
        ).toBe(true);
      }
    },
  );

  it('documents each breakthrough in its host look with a required intent', () => {
    expect(comicInfoLook.docs).toMatch(/page\.flashback\(\{ intent:/);
    expect(comicLoudLook.docs).toMatch(/page\.spread\(\{ intent:/);
    expect(comicLoudLook.docs).toMatch(/> 4 s without a new beat/);
  });

  it('letters every character of the showcase (own CC0 glyph tables)', () => {
    for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789.,!?'-:") {
      expect(LETTERING_CHARS, char).toContain(char);
    }
    for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!.') {
      expect(DISPLAY_CHARS, char).toContain(char);
    }
  });
});

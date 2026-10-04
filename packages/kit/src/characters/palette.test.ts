import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOKENS_ONLY_PALETTE } from '../testing/palettes.js';
import type { KitPalette } from '../types.js';
import { CAST_COLORS, castHex, paletteName } from './palette.js';

const PRESETS = path.resolve(import.meta.dirname, '..', '..', '..', 'engine', 'src', 'presets');

/** A style's scene palette as the engine builds it: swatches + tokens resolved to hex. */
function stylePalette(id: string): KitPalette {
  const preset = JSON.parse(readFileSync(path.join(PRESETS, `${id}.json`), 'utf8')) as {
    palette: Record<string, string>;
    tokens: Record<string, string>;
  };
  const tokens = Object.fromEntries(
    Object.entries(preset.tokens).map(([token, swatch]) => [token, preset.palette[swatch] ?? '']),
  );
  return { ...preset.palette, ...tokens };
}

/** Expected swatch of every page colour per style (docs/characters.md, "Palette mapping"). */
const MAPPING: Readonly<Record<string, readonly [string, string, string]>> = {
  black: ['black', 'black', 'night'],
  navy: ['navy', 'ink', 'night'],
  indigo: ['indigo', 'charcoal', 'umber'],
  purple: ['purple', 'slate', 'dusk'],
  violet: ['violet', 'steel', 'mauve'],
  magenta: ['magenta', 'blood', 'rose'],
  pink: ['pink', 'red', 'rose'],
  slateBlue: ['slateBlue', 'steel', 'dusk'],
  teal: ['teal', 'teal', 'denim'],
  brightTeal: ['brightTeal', 'teal', 'sage'],
  green: ['green', 'teal', 'mint'],
  orange: ['orange', 'amber', 'coral'],
  lightOrange: ['lightOrange', 'gold', 'peach'],
  cream: ['cream', 'bone', 'cream'],
  slateGrey: ['slateGrey', 'ash', 'ice'],
  darkSlate: ['darkSlate', 'slate', 'dusk'],
  burntOrange: ['burntOrange', 'copper', 'clay'],
  rust: ['rust', 'ember', 'brown'],
  tan: ['tan', 'sepia', 'taupe'],
  midSlate: ['midSlate', 'fog', 'stone'],
  forest: ['forest', 'teal', 'olive'],
  wine: ['wine', 'blood', 'mauve'],
};

const STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;

describe('character pack palette mapping', () => {
  it('maps every page colour to the documented swatch of each style', () => {
    expect(Object.keys(MAPPING).sort()).toEqual([...CAST_COLORS].sort());
    STYLES.forEach((style, index) => {
      const palette = stylePalette(style);
      for (const color of CAST_COLORS) {
        expect(paletteName(palette, color), `${style} ${color}`).toBe(MAPPING[color]?.[index]);
      }
    });
  });

  it('keeps the page colours exactly in Crisp 640 and resolves with tokens only', () => {
    const crisp = stylePalette('voxel-pixel-crisp640');
    for (const color of CAST_COLORS) expect(castHex(crisp, color)).toBe(crisp[color]);
    for (const color of CAST_COLORS) {
      expect(TOKENS_ONLY_PALETTE[paletteName(TOKENS_ONLY_PALETTE, color)]).toBeDefined();
    }
    expect(paletteName(TOKENS_ONLY_PALETTE, 'accent1')).toBe('accent1');
    expect(() => paletteName({}, 'nope')).toThrow(/neither a pack swatch/);
  });
});

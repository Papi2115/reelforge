/**
 * Built-in style presets (PLAN.md#3.5): every preset defines every token, text stays legible on
 * the lower-third plate (`shadow`) and the plate stands out from the backdrop colours; the
 * `styles/<id>/style.json` cards stay in sync with the presets; the kit's Crisp test palette
 * mirrors the engine preset.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PALETTE_TOKENS, styleManifestSchema, type StylePreset } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { CRISP_PALETTE } from '../../../kit/src/testing/palettes.js';
import { hexToRgb, type Rgb } from '../palette.js';
import { resolveStyle } from '../style.js';
import { DEFAULT_STYLE_ID, findStylePreset, STYLE_PRESET_IDS, STYLE_REGISTRY } from './index.js';

const STYLES_DIR = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'styles');
/** WCAG AA for normal text. */
const MIN_TEXT_CONTRAST = 4.5;
/** Secondary lower-third line (`textDim`) is small mono text: WCAG AA for large text. */
const MIN_DIM_TEXT_CONTRAST = 3;
/**
 * OKLab distance below which two dark colours read as the same surface (the old plates that
 * vanished: Noir black on ink 0.047, Crisp indigo on navy 0.063).
 */
const MIN_PLATE_DISTANCE = 0.075;
const MAX_PALETTE_COLOURS = 32;

/** Every registered preset, experimental world styles included (they must pass the same checks). */
function presets(): StylePreset[] {
  return STYLE_REGISTRY.allIds.map((id) => {
    const preset = findStylePreset(id);
    if (!preset) throw new Error(`missing preset ${id}`);
    return preset;
  });
}

function token(preset: StylePreset, name: (typeof PALETTE_TOKENS)[number]): string {
  const hex = preset.palette[preset.tokens[name]];
  if (hex === undefined) throw new Error(`${preset.id}: token ${name} has no colour`);
  return hex;
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(linear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio (1..21). */
function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function oklab(hex: string): Rgb {
  const [r, g, b] = hexToRgb(hex).map(linear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabDistance(a: string, b: string): number {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

describe('built-in style presets', () => {
  it('ship Crisp 640 (default), Noir Voxel and Soft 480', () => {
    expect(STYLE_PRESET_IDS).toEqual(['voxel-pixel-crisp640', 'noir-voxel', 'soft-480']);
    expect(DEFAULT_STYLE_ID).toBe('voxel-pixel-crisp640');
  });

  it.each(presets().map((preset) => [preset.id, preset] as const))(
    '%s: every token maps to a swatch, palette within the quantizer limit, no duplicate colours',
    (_id, preset) => {
      expect(Object.keys(preset.tokens).sort()).toEqual([...PALETTE_TOKENS].sort());
      const hexes = Object.values(preset.palette).map((hex) => hex.toLowerCase());
      expect(hexes.length).toBeLessThanOrEqual(MAX_PALETTE_COLOURS);
      expect(new Set(hexes).size).toBe(hexes.length);
    },
  );

  it.each(presets().map((preset) => [preset.id, preset] as const))(
    '%s: lower-third text is legible on the plate and the plate reads against the backdrop',
    (_id, preset) => {
      const plate = token(preset, 'shadow');
      expect(contrastRatio(token(preset, 'text'), plate)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(token(preset, 'textDim'), plate)).toBeGreaterThanOrEqual(
        MIN_DIM_TEXT_CONTRAST,
      );
      for (const backdrop of ['sky', 'ground', 'groundAlt', 'outline'] as const) {
        expect(oklabDistance(plate, token(preset, backdrop)), backdrop).toBeGreaterThanOrEqual(
          MIN_PLATE_DISTANCE,
        );
      }
      // Titles: text over its own outline-coloured drop shadow.
      expect(contrastRatio(token(preset, 'text'), token(preset, 'outline'))).toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      );
    },
  );

  it('computes WCAG contrast and OKLab distances like the references', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(oklabDistance('#000000', '#ffffff')).toBeCloseTo(1, 3);
  });

  it('keeps the kit test palette equal to the resolved Crisp 640 scene palette', () => {
    expect({ ...CRISP_PALETTE }).toEqual({ ...resolveStyle({}).palette });
  });
});

describe('styles/<id>/style.json', () => {
  const folders = readdirSync(STYLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const manifests = folders.map((folder) => {
    const raw: unknown = JSON.parse(
      readFileSync(path.join(STYLES_DIR, folder, 'style.json'), 'utf8'),
    );
    return { folder, manifest: styleManifestSchema.parse(raw) };
  });

  it('has exactly one folder per engine preset', () => {
    expect([...folders].sort()).toEqual([...STYLE_PRESET_IDS].sort());
  });

  it.each(manifests.map(({ folder, manifest }) => [folder, manifest] as const))(
    '%s: id and name match the engine preset',
    (folder, manifest) => {
      expect(manifest.id).toBe(folder);
      expect(manifest.name).toBe(findStylePreset(folder)?.name);
    },
  );

  it('marks the engine default style (and only it) as default', () => {
    const defaults = manifests.filter(({ manifest }) => manifest.default);
    expect(defaults.map(({ manifest }) => manifest.id)).toEqual([DEFAULT_STYLE_ID]);
  });
});

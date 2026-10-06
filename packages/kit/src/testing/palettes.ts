/** Test fixtures: scene palettes as the engine builds them (swatches + semantic tokens). */
import type { KitPalette } from '../types.js';
import { SKETCHBOOK_STYLE } from '../worlds/sketchbook/style.js';

const TOKENS = {
  sky: '#0b0f2a',
  ground: '#2d1b69',
  groundAlt: '#1a1446',
  hero: '#ff8c42',
  heroTrim: '#f4e9d8',
  accent1: '#2ec4b6',
  accent2: '#ff3cac',
  accent3: '#7fe39a',
  accent4: '#b0279b',
  keyLight: '#ffb26b',
  fillLight: '#f4e9d8',
  shadow: '#12355b',
  text: '#f4e9d8',
  textDim: '#8a93a6',
  outline: '#05060f',
};

/** Voxel Pixel - Crisp 640 (engine preset voxel-pixel-crisp640). */
export const CRISP_PALETTE: KitPalette = {
  black: '#05060f',
  navy: '#0b0f2a',
  indigo: '#1a1446',
  purple: '#2d1b69',
  violet: '#5b2a86',
  magenta: '#b0279b',
  pink: '#ff3cac',
  slateBlue: '#12355b',
  teal: '#1f6f8b',
  brightTeal: '#2ec4b6',
  green: '#7fe39a',
  orange: '#ff8c42',
  lightOrange: '#ffb26b',
  cream: '#f4e9d8',
  slateGrey: '#8a93a6',
  darkSlate: '#3c4256',
  burntOrange: '#c75a24',
  rust: '#7d321c',
  tan: '#c49a7a',
  midSlate: '#5c6479',
  forest: '#2f8a5f',
  wine: '#6a1d5e',
  ...TOKENS,
};

/** Only the semantic tokens: every colour chain of the kit must still resolve. */
export const TOKENS_ONLY_PALETTE: KitPalette = TOKENS;

/** Sketchbook (world style `sketchbook`): its swatches plus its tokens, as the engine builds it. */
export const SKETCHBOOK_PALETTE: KitPalette = (() => {
  const swatches: Readonly<Record<string, string>> = SKETCHBOOK_STYLE.palette;
  const tokens = Object.fromEntries(
    Object.entries(SKETCHBOOK_STYLE.tokens).map(([token, swatch]) => [
      token,
      swatches[swatch] ?? '',
    ]),
  );
  return { ...swatches, ...tokens };
})();

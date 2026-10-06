/**
 * The Sketchbook style preset (`stylePresetSchema` of @reelforge/shared, validated by the engine
 * when it registers the world). 960x540 like the approved showcase (x2 = 1080p), the 24 notebook
 * inks, every token mapped, no dither (spread 0: the renderer paints exact palette colours and the
 * paper shading is flat remaps), no outline/AO/scanlines/vignette.
 */
import { INK_TABLE } from './inks.js';

export const SKETCHBOOK_ID = 'sketchbook';

/** Page size of the showcase; the renderer's page coordinates. */
export const PAGE_WIDTH = 960;
export const PAGE_HEIGHT = 540;

const palette = Object.fromEntries(INK_TABLE.map(([, swatch, hex]) => [swatch, hex]));

export const SKETCHBOOK_STYLE = {
  version: 1,
  id: SKETCHBOOK_ID,
  name: 'Sketchbook',
  resolution: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
  palette,
  tokens: {
    sky: 'paper',
    ground: 'fibre',
    groundAlt: 'shade',
    hero: 'ink',
    heroTrim: 'paper',
    accent1: 'red',
    accent2: 'orange',
    accent3: 'green',
    accent4: 'bic',
    keyLight: 'paper',
    fillLight: 'fibre',
    shadow: 'ink',
    text: 'paper',
    textDim: 'fibre',
    outline: 'graphite',
  },
  dither: { matrix: 'bayer4', spread: 0 },
} as const;

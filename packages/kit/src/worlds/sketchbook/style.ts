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
  /**
   * Ambient variation budget of the world's looks (`variationBudget: 'sketchbook'`). Neutral on
   * purpose: it is one notebook, so no tone family drifts between shots (orange is every sun, red
   * is only the correction) and the full-frame page has no horizon, light, grid, debris or camera
   * to drift; shots differ by the hand (seeded wobble, layout, pace). The budget exists so the
   * key resolves and ctx.ambient (tension, layout variant) reaches the scenes.
   */
  variation: {
    sketchbook: {
      tones: {},
      toneShare: 0,
      steps: 3,
      cell: [1, 1],
      horizon: [0, 0],
      fade: [1, 1],
      lightAzimuth: [0, 0],
      lightElevation: [0, 0],
      debris: [1, 1],
      cameraDrift: [0, 0],
    },
  },
} as const;

/**
 * The Comic style preset (`stylePresetSchema` of @reelforge/shared, validated by the engine when
 * it registers the world). 640x360 like the approved showcase (x3 = 1080p), the 22 print inks,
 * every token mapped, no dither (spread 0: the page renderer paints exact palette colours; its
 * halftone screens are patterns of whole inks), no outline/AO/scanlines/vignette.
 */
import { INK_TABLE } from './inks.js';

export const COMIC_ID = 'comic';

/** Page size of the showcase; the renderer's page coordinates. */
export const PAGE_WIDTH = 640;
export const PAGE_HEIGHT = 360;

const palette = Object.fromEntries(INK_TABLE.map(([, swatch, hex]) => [swatch, hex]));

export const COMIC_STYLE = {
  version: 1,
  id: COMIC_ID,
  name: 'Comic',
  resolution: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
  palette,
  tokens: {
    sky: 'paper',
    ground: 'shade',
    groundAlt: 'aged',
    hero: 'ink',
    heroTrim: 'paper',
    accent1: 'red',
    accent2: 'yellow',
    accent3: 'cyan',
    accent4: 'magenta',
    keyLight: 'paper',
    fillLight: 'shade',
    shadow: 'ink',
    text: 'paper',
    textDim: 'shade',
    outline: 'cyanDeep',
  },
  dither: { matrix: 'bayer4', spread: 0 },
  /**
   * Ambient variation budget of the world's looks (`variationBudget: 'comic'`). Neutral on
   * purpose: one printed comic, so no tone family drifts between shots (red is only the point,
   * yellow the captions and foil) and the full-frame page has no horizon, light or camera of the
   * engine to drift; shots differ by the page (seeded gutters, plate offsets, layout, pace). The
   * budget exists so the key resolves and ctx.ambient (tension, layout variant) reaches the scenes.
   */
  variation: {
    comic: {
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

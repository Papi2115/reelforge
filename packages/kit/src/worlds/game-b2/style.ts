/**
 * The Game B2 style preset (`stylePresetSchema` of @reelforge/shared, validated by the engine
 * when it registers the world). 640x360 like the approved showcase (x3 = 1080p): the 3D view is a
 * 320x180 raycast doubled, the HUD native. The 32 showcase colours, every token mapped. No post
 * dither (spread 0): the raycaster dithers its own light and fog levels with a 4x4 Bayer matrix
 * and paints exact palette indices, as in the showcase; no outline, AO, scanlines or vignette.
 */
import { B2_TABLE } from './palette.js';

export const GAME_B2_ID = 'game-b2';

const palette = Object.fromEntries(B2_TABLE.map(([, swatch, hex]) => [swatch, hex]));

export const GAME_B2_STYLE = {
  version: 1,
  id: GAME_B2_ID,
  name: 'Game B2: first-person RPG',
  resolution: { width: 640, height: 360 },
  palette,
  tokens: {
    sky: 'char',
    ground: 'slate',
    groundAlt: 'dirtDark',
    hero: 'tungsten',
    heroTrim: 'bulb',
    accent1: 'pink',
    accent2: 'clay',
    accent3: 'fluo',
    accent4: 'haze',
    keyLight: 'bulb',
    fillLight: 'sage',
    shadow: 'gloom',
    text: 'paper',
    textDim: 'sand',
    outline: 'brown',
  },
  dither: { matrix: 'bayer4', spread: 0 },
  /**
   * Ambient variation budget of the world's looks (`variationBudget: 'game-b2'`). Neutral on
   * purpose for now: a B2 film is one continuous map, so places differ by their level (mood,
   * textures, lights), not by drifting tones; the raycaster has no sky, grid or debris to vary.
   * The budget exists so the key resolves and ctx.ambient (tension) reaches the scenes.
   */
  variation: {
    'game-b2': {
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

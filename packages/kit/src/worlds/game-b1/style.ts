/**
 * The Game B1 style preset (`stylePresetSchema` of @reelforge/shared, validated by the engine
 * when it registers the world). 640x360 like the approved showcase (x3 = 1080p), the 23 inks,
 * every token mapped. No post dither, outline, AO, engine scanlines or vignette: the CRT treatment
 * (wide pixels, NTSC bleed, scanlines, hum bar, rounded tube) belongs to the picture INSIDE the TV
 * only and is painted by the kit renderer as palette LUTs; the living room around the TV stays in
 * clean square pixels (the two worlds of DECISIONS.md).
 */
import { B1_TABLE } from './palette.js';

export const GAME_B1_ID = 'game-b1';

const palette = Object.fromEntries(B1_TABLE.map(([, swatch, hex]) => [swatch, hex]));

export const GAME_B1_STYLE = {
  version: 1,
  id: GAME_B1_ID,
  name: 'Game B1: Atari boss montage',
  resolution: { width: 640, height: 360 },
  palette,
  tokens: {
    sky: 'night',
    ground: 'oliveDark',
    groundAlt: 'walnut',
    hero: 'orange',
    heroTrim: 'gold',
    accent1: 'crimson',
    accent2: 'gold',
    accent3: 'teal',
    accent4: 'mauve',
    keyLight: 'cream',
    fillLight: 'aqua',
    shadow: 'void',
    text: 'cream',
    textDim: 'tan',
    outline: 'walnutDark',
  },
  dither: { matrix: 'bayer4', spread: 0 },
  /**
   * Ambient variation budget of the world's looks (`variationBudget: 'game-b1'`). Neutral on
   * purpose: one living room and one console across the film; shots differ by what the TV shows,
   * the camera and the HUD's facts, not by drifting tones. The budget exists so the key resolves
   * and ctx.ambient (tension) reaches the scenes.
   */
  variation: {
    'game-b1': {
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

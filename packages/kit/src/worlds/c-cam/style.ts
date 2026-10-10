/**
 * The C-CAM ("Grim Ink") style preset (`stylePresetSchema` of @reelforge/shared, validated by the
 * engine when it registers the world; PLAN.md#14.2). Native 1920x1080 (scale 1: exported as 1080p
 * x1 or 4K x2; 1440p is not a whole multiple and is refused), full colour (`quantize: false`,
 * PLAN.md#14.1): the ink stage's anti-aliased canvas passes the post pass unchanged, so the palette
 * below only feeds the scene tokens, text and annotation colours. Swatches come from the C-CAM
 * palette `C` (core.ts), so the two never drift. No dither, outline, AO, scanlines or vignette.
 *
 * The preset schema has no frame rate: the world's 24 fps lives in the project defaults
 * (`@reelforge/project` `WORLD_PROJECT_DEFAULTS['c-cam'].fps`).
 */
import { C } from './core.js';

export const C_CAM_ID = 'c-cam';

/** Native frame of the world (the C-CAM films' `W` x `H`). */
export const C_CAM_WIDTH = 1920;
export const C_CAM_HEIGHT = 1080;

/** Ambient variation budget key of the world's looks. */
export const C_CAM_VARIATION = 'c-cam';

/** Named swatches (camelCase) from the C palette: inks, dirty whites, muds, skins, accents. */
export const C_CAM_PALETTE: Readonly<Record<string, string>> = Object.freeze({
  ink: C.INK,
  bone: C.EYE,
  linen: C.LINEN,
  linenDark: C.LINEN_D,
  plaster: C.PLASTER,
  stone: C.STONE,
  stoneDark: C.STONE_D,
  olive: C.OLIVE,
  oliveDark: C.OLIVE_D,
  clay: C.CLAY,
  clayDark: C.CLAY_D,
  greyBlue: C.GREYBLUE,
  greyBlueDark: C.GREYBLUE_D,
  mustard: C.MUSTARD,
  mustardDark: C.MUSTARD_D,
  rust: C.RUST,
  rustDark: C.RUST_D,
  brown: C.BROWN,
  brownDark: C.BROWN_D,
  coal: C.BLACK,
  plum: C.PLUM,
  timber: C.TIMBER,
  red: C.RED,
  redDark: C.RED_D,
  gold: C.GOLD,
  fire: C.FIRE,
  skinRuddy: C.SKIN_RUDDY,
  skinSallow: C.SKIN_SALLOW,
});

export const C_CAM_STYLE = {
  version: 1,
  id: C_CAM_ID,
  name: 'Grim Ink',
  resolution: { width: C_CAM_WIDTH, height: C_CAM_HEIGHT },
  palette: C_CAM_PALETTE,
  tokens: {
    sky: 'greyBlueDark',
    ground: 'brown',
    groundAlt: 'clay',
    hero: 'rust',
    heroTrim: 'bone',
    accent1: 'mustard',
    accent2: 'red',
    accent3: 'olive',
    accent4: 'gold',
    keyLight: 'fire',
    fillLight: 'greyBlue',
    shadow: 'ink',
    text: 'bone',
    textDim: 'linen',
    outline: 'brownDark',
  },
  dither: { matrix: 'bayer4', spread: 0 },
  quantize: false,
  /**
   * Ambient variation budget of the world's looks (`variationBudget: 'c-cam'`). Neutral on
   * purpose (one hand-drawn world: places differ by content, not by tone drift; the 2D stage has
   * no engine horizon, light or camera to drift). The budget exists so the key resolves and
   * ctx.ambient reaches the scenes.
   */
  variation: {
    [C_CAM_VARIATION]: {
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

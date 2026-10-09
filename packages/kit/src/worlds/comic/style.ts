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

/** Page size in page px: the frame of the shot (landscape 640x360, portrait 360x640). */
export interface PageSize {
  readonly width: number;
  readonly height: number;
}

export const LANDSCAPE_PAGE: PageSize = { width: PAGE_WIDTH, height: PAGE_HEIGHT };
/** A portrait short (PLAN.md#13.18): the same pixel budget turned upright. */
export const PORTRAIT_PAGE: PageSize = { width: PAGE_HEIGHT, height: PAGE_WIDTH };

/** The page of a frame: portrait when it is taller than wide, else the landscape page. */
export function pageSizeFor(frame: PageSize | undefined): PageSize {
  return frame !== undefined && frame.height > frame.width ? PORTRAIT_PAGE : LANDSCAPE_PAGE;
}

export function isPortraitPage(page: PageSize): boolean {
  return page.height > page.width;
}

/**
 * Where key content goes on the page [x, y, w, h]: a portrait short keeps balloons, captions and
 * the focal subject in the central 80 % of the width, below the top 12 % and above the bottom
 * 20 % (the Shorts player covers those); a landscape page is safe everywhere.
 */
export function pageSafeBox(page: PageSize): readonly [number, number, number, number] {
  if (!isPortraitPage(page)) return [0, 0, page.width, page.height];
  const x = Math.round(page.width * 0.1);
  const y = Math.round(page.height * 0.12);
  return [x, y, page.width - 2 * x, Math.round(page.height * 0.8) - y];
}

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

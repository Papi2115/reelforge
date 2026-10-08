/**
 * Sizes of the pixel title face (PLAN.md#13.12, U13; fonts/pixel-titles.css). The face's em is 10
 * font pixels; it is sharp only when one font pixel covers a whole number of device pixels, so the
 * CSS sizes follow the display scaling (100 %: 10 / 20 px, 125 % Windows scaling: 16 / 24 px).
 */
const EM_PIXELS = 10;
/** Wanted CSS px per font pixel, rounded to whole device pixels (and large > small). */
const SMALL_CSS_PX_PER_PIXEL = 1.25;
const LARGE_CSS_PX_PER_PIXEL = 2;

export interface TitleSizes {
  /** Panel, step and section titles: about 1.25 CSS px per font pixel. */
  readonly small: number;
  /** Dialog titles and the product name: about 2 CSS px per font pixel. */
  readonly large: number;
}

export function titleSizes(devicePixelRatio: number): TitleSizes {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const small = Math.max(1, Math.round(SMALL_CSS_PX_PER_PIXEL * ratio));
  const large = Math.max(small + 1, Math.round(LARGE_CSS_PX_PER_PIXEL * ratio));
  return { small: (EM_PIXELS * small) / ratio, large: (EM_PIXELS * large) / ratio };
}

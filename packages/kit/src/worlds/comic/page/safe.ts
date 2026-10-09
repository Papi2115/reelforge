/**
 * Phone lettering of a portrait Comic page (PLAN.md#13.18): a short is read on a phone, so
 * balloons and captions letter at twice the size with short lines, and they are kept inside the
 * page's safe box (the central 80 % of the width, below the top 12 % and above the bottom 20 %;
 * the Shorts player covers the rest). Landscape pages letter exactly as before.
 */
import { balloonSize, LINE_H } from '../draw/balloons.js';
import { measure } from '../draw/text.js';
import { isPortraitPage, pageSafeBox, type PageSize } from '../style.js';

/** Lettering defaults of a page: integer text size and wrap widths (page px at size 1). */
export interface LetteringDefaults {
  readonly size: number;
  readonly balloonWidth: number;
  readonly captionWidth: number;
}

const LANDSCAPE_LETTERING: LetteringDefaults = { size: 1, balloonWidth: 150, captionWidth: 220 };
/** Twice the size, ~14 letters a line: a balloon fits the safe width of a 360-px page. */
const PORTRAIT_LETTERING: LetteringDefaults = { size: 2, balloonWidth: 100, captionWidth: 120 };

export function letteringDefaults(page: PageSize): LetteringDefaults {
  return isPortraitPage(page) ? PORTRAIT_LETTERING : LANDSCAPE_LETTERING;
}

/** Clamps `value` so [value - before, value + after] stays in [low, high] (centred if it can't). */
function fit(value: number, before: number, after: number, low: number, high: number): number {
  if (before + after >= high - low) return (low + before + high - after) / 2;
  return Math.min(high - after, Math.max(low + before, value));
}

/**
 * Where to letter a box of `w` x `h` page px whose anchor (x, y) sits at (ox, oy) inside it: on a
 * portrait page nudged into the safe box (vertically only while the page camera holds still, as
 * a reading camera moves the page under the frame); unchanged on a landscape page.
 */
export function safePlace(
  page: PageSize,
  anchor: readonly [number, number],
  box: { readonly w: number; readonly h: number; readonly ox: number; readonly oy: number },
  still: boolean,
): [number, number] {
  const [x, y] = anchor;
  if (!isPortraitPage(page)) return [x, y];
  const [sx, sy, sw, sh] = pageSafeBox(page);
  const px = fit(x, box.ox, box.w - box.ox, sx, sx + sw);
  const py = still ? fit(y, box.oy, box.h - box.oy, sy, sy + sh) : y;
  return [px, py];
}

/** Page-px box of a balloon of these lines at text size `size`, anchored at its centre. */
export function balloonBox(lines: readonly string[], size: number) {
  const { rx, ry } = balloonSize(lines);
  return { w: 2 * rx * size, h: 2 * ry * size, ox: rx * size, oy: ry * size };
}

/** Page-px box of a caption of these lines at text size `size`, anchored at its top left. */
export function captionBox(lines: readonly string[], size: number) {
  const width = Math.max(...lines.map((line) => measure('hand', line, size, true))) + 12 * size;
  return { w: width + 2, h: lines.length * LINE_H * size + 7 * size + 2, ox: 0, oy: 0 };
}

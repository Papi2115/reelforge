/**
 * Labels of the timeline blocks (PLAN.md#6.5, #11.2), fitted by an average glyph width (no
 * per-label measureText) and thinned when zoomed out. Pure.
 */

/** Average glyph width of the lanes' 11 px UI font, slightly generous so labels never spill. */
const CHAR_PX = 6;
export const LABEL_PAD = 3;

function labelChars(px: number): number {
  return Math.floor((px - 2 * LABEL_PAD) / CHAR_PX);
}

/** `text` cut (with an ellipsis) to roughly `px` pixels; empty when fewer than 4 letters fit. */
export function fitLabel(text: string, px: number): string {
  const chars = labelChars(px);
  if (chars >= text.length) return text;
  return chars >= 5 ? `${text.slice(0, chars - 1)}…` : '';
}

/**
 * The label of a shot block `px` wide: "s04_rainbow · 3d-reconstruction", else the id, else its
 * number ("s04", or the position), else nothing; never a cut-off name.
 */
export function shotLabel(id: string, treatment: string, index: number, px: number): string {
  const chars = labelChars(px);
  const number = /^s\d+/i.exec(id)?.[0] ?? String(index + 1);
  return [`${id} · ${treatment}`, id, number].find((label) => label.length <= chars) ?? '';
}

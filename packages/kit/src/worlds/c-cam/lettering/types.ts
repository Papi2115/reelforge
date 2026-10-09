/** Shared types of the C-CAM ink lettering (CC0 1.0, own work; docs/licenses.md). */

/** A point in page pixels (or glyph units, inside `glyphs.ts`). */
export interface Pt {
  readonly x: number;
  readonly y: number;
}

/**
 * Where the lettering is drawn. `points` is the centre line of a stroke, `widths` the full ink
 * width at every point (same length). The world's ink ribbon implements this later; tests use a
 * recording mock.
 */
export interface InkSurface {
  ribbon(points: readonly Pt[], widths: readonly number[], fill: string): void;
}

/** `hand` = loose handwriting (labels, ledgers); `poster` = fat block/stencil capitals. */
export type FaceName = 'hand' | 'poster';

export const FACE_NAMES: readonly FaceName[] = ['hand', 'poster'];

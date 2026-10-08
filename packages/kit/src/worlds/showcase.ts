/**
 * Showcase pieces (PLAN.md#13.15, docs/worlds/DECISIONS.md "PRINCIPLE: a world is a style
 * GRAMMAR"): built-in ids ported from a world's approved mockup film (its clerk, its cartridge, its
 * office) stay in the kit for the showcase templates, but the runtime Claude meets them only under
 * one short line, so no film picks them up as the world's vocabulary.
 */

/** The words every showcase line starts with (kit-docs, look docs). */
export const SHOWCASE_PIECES_NOTE =
  'Showcase pieces (do not use unless the narration is about them)';

/** A built-in id of a world's catalog; `showcase: true` = a piece of the mockup film. */
export interface CatalogPiece {
  readonly id: string;
  readonly showcase: boolean;
}

/** The catalog of built-in ids, the showcase pieces marked. */
export function catalogPieces(
  ids: readonly string[],
  showcase: readonly string[],
): readonly CatalogPiece[] {
  return Object.freeze(ids.map((id) => Object.freeze({ id, showcase: showcase.includes(id) })));
}

/** The ids that are not showcase pieces (what docs and error messages may list). */
export function openIds(pieces: readonly CatalogPiece[]): string[] {
  return pieces.filter((piece) => !piece.showcase).map((piece) => piece.id);
}

/** `Showcase pieces (…): sprites item, clerk; levels 'office'` from named groups of ids. */
export function showcaseLine(groups: Readonly<Record<string, string>>): string {
  const parts = Object.entries(groups).map(([what, ids]) => `${what} ${ids}`);
  return `${SHOWCASE_PIECES_NOTE}: ${parts.join('; ')}.`;
}

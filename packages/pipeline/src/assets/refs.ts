/**
 * Which asset refs a scene names (PLAN.md#12.11): string literals that look like a ref
 * (`'nasa-apollo'`, `"nasa-launch@12.5"`). Used to ship only the pictures the scenes use in the
 * render manifest and to key exported segments on them. Ids are data, so a scene must write them
 * as literals; anything computed at run time is simply not shipped (and the engine says so).
 */
import { ASSET_REF_PATTERN } from '@reelforge/shared';

const QUOTED = /(['"`])([a-z0-9][a-z0-9@.-]{0,74})\1/g;

/** Every ref-shaped string literal in `source`, in order of first appearance. */
export function refLiterals(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(QUOTED)) {
    const text = match[2] ?? '';
    if (ASSET_REF_PATTERN.test(text)) found.add(text);
  }
  return [...found];
}

/** Asset id of a ref (`nasa-launch@12.5` -> `nasa-launch`). */
export function refId(ref: string): string {
  return ref.split('@')[0] ?? ref;
}

/** Still time of a ref in seconds (`@12.5`), undefined without one. */
export function refAt(ref: string): number | undefined {
  const at = ASSET_REF_PATTERN.exec(ref)?.[2];
  return at === undefined ? undefined : Number(at);
}

/** Refs of known asset ids named by any of `sources`, sorted. */
export function referencedAssetRefs(
  sources: readonly string[],
  knownIds: ReadonlySet<string>,
): string[] {
  const refs = new Set<string>();
  for (const source of sources) {
    for (const ref of refLiterals(source)) if (knownIds.has(refId(ref))) refs.add(ref);
  }
  return [...refs].sort();
}

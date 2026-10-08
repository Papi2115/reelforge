/**
 * Sheet pages of a Comic set (PLAN.md#13.15, real run Comic 2): each asset is one panel, and the
 * kit's comicPage throws above 5 panels on a page at once, so a film with 8 characters must get
 * pages of at most 5 (it used to put 8 on one page and the whole sheet failed to render).
 */
import { buildWorldAssets } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import { worldAssetSheetPages, worldAssetSoloPages } from './sheet-scenes.js';

/** The kit's limit of panels on a comic page at once (kit worlds/comic/page/model.ts). */
const COMIC_PANELS_AT_ONCE = 5;

const fish = (count: number): Record<string, unknown> =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `fish-${String(index + 1)}`,
      { gen: 'fish', kind: 'anglerfish', description: `fish ${String(index + 1)}` },
    ]),
  );

function comicSet(characters: number) {
  const source = JSON.stringify({ version: 1, world: 'comic', characters: fish(characters) });
  return buildWorldAssets('comic', [{ file: 'assets/comic/sea.json', source }]);
}

describe('world asset sheet pages', () => {
  it('never puts more comic characters on a page than a comic page has panels', () => {
    const set = comicSet(8);
    expect(set.problems).toEqual([]);
    const pages = worldAssetSheetPages(set).filter((page) => page.kind === 'characters');
    expect(pages.map((page) => page.ids.length)).toEqual([5, 3]);
    for (const page of pages) expect(page.ids.length).toBeLessThanOrEqual(COMIC_PANELS_AT_ONCE);
    expect(pages.flatMap((page) => page.ids)).toEqual(set.ids.byKind['characters']);
  });

  it('keeps five comic characters on one page', () => {
    const pages = worldAssetSheetPages(comicSet(5));
    expect(pages.map((page) => [page.kind, page.ids.length])).toEqual([['characters', 5]]);
  });

  it('draws each asset alone and the page empty for the per-asset crops', () => {
    const [kind, ...rest] = worldAssetSoloPages(comicSet(3), 4);
    expect(rest).toEqual([]);
    expect(kind?.kind).toBe('characters');
    expect(kind?.empty).toMatchObject({ page: 4, ids: [] });
    expect(kind?.empty.source).toContain('const IDS = [];');
    expect(kind?.solos.map((page) => [page.page, page.ids])).toEqual([
      [5, ['fish-1']],
      [6, ['fish-2']],
      [7, ['fish-3']],
    ]);
  });
});

/**
 * The world-assets contact sheet (PLAN.md#13.15 phase 2): one image per sheet page, the page's
 * frame at 1x above the same frame scaled so one grid cell is at most 64 px wide (thumbnail
 * size), labelled with the page's ids. The runtime Claude (`reelforge world-assets sheet`) and
 * the Haiku critic of the world-assets step read these.
 */
import type { RgbaImage } from '@reelforge/engine/raster';
import { blit, createImage } from '../render/image.js';
import { composeSheet } from '../render/sheet.js';
import type { SheetPage } from './sheet-scenes.js';

/** Widest a thumbnail cell may be (px). */
export const THUMBNAIL_CELL = 64;

/** Project-relative files of a sheet page (git-ignored app data). */
export function worldAssetSheetPaths(page: number): { dir: string; scene: string; sheet: string } {
  const dir = '.reelforge/frames/world-assets';
  return {
    dir,
    scene: `${dir}/sheet-${String(page)}.js`,
    sheet: `${dir}/sheet-${String(page)}.png`,
  };
}

/** The integer downscale that makes one of `columns` cells <= 64 px wide. */
export function thumbnailFactor(frameWidth: number, columns: number): number {
  return Math.max(1, Math.ceil(frameWidth / (Math.max(1, columns) * THUMBNAIL_CELL)));
}

/** The 1x frame above its thumbnail, labelled with the page's ids (or why it did not render). */
export function composeWorldAssetSheet(
  page: SheetPage,
  frame: RgbaImage | undefined,
  size: { readonly width: number; readonly height: number },
  failure?: string,
): RgbaImage {
  const ids = page.ids.join(', ');
  const tile =
    frame === undefined
      ? { label: ids, failure: failure ?? 'not rendered' }
      : { label: ids, frame };
  const full = composeSheet(
    {
      title: `page ${String(page.page)}: ${page.kind} at 1x`,
      frameWidth: size.width,
      frameHeight: size.height,
      factor: 1,
    },
    [{ tiles: [tile] }],
  );
  const thumbs = composeSheet(
    {
      title: `thumbnail: each ${page.kind.replace(/s$/, '')} <= ${String(THUMBNAIL_CELL)} px wide`,
      frameWidth: size.width,
      frameHeight: size.height,
      factor: thumbnailFactor(size.width, page.columns),
    },
    [{ tiles: [tile] }],
  );
  const sheet = createImage(
    Math.max(full.width, thumbs.width),
    full.height + thumbs.height,
    [16, 16, 22],
  );
  blit(sheet, full, 0, 0);
  blit(sheet, thumbs, 0, full.height);
  return sheet;
}

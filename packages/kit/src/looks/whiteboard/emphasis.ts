/**
 * Marker emphasis around something already on the board: underline, double underline, a loose
 * circle, a box or a strike-through, as polylines in raster px around a box.
 */
import { z } from 'zod';
import { bezier, ellipse, type Box, type Point, type Polyline } from './geometry.js';

export const EMPHASIS_STYLES = ['underline', 'double', 'circle', 'box', 'strike'] as const;
export type EmphasisStyle = (typeof EMPHASIS_STYLES)[number];

export const emphasisStyleParam = z
  .enum(EMPHASIS_STYLES)
  .default('underline')
  .describe('underline, double (two underlines), circle (loose loop), box or strike');

/** Pen paths of an emphasis around `box` (raster px); `s` = raster px per reference px. */
export function emphasisPaths(style: EmphasisStyle, box: Box, s: number): Polyline[] {
  const left = box.x;
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const mid = box.y + box.height / 2;
  const under = (offset: number, sag: number): Point[] =>
    bezier([
      [left - 3 * s, bottom + offset * s],
      [left + box.width * 0.5, bottom + (offset + sag) * s],
      [right + 4 * s, bottom + (offset - 1) * s],
    ]);
  switch (style) {
    case 'underline':
      return [under(5, 2)];
    case 'double':
      return [under(4, 2), under(9, 1)];
    case 'strike':
      return [
        [
          [left - 3 * s, mid + 1 * s],
          [right + 3 * s, mid - 1 * s],
        ],
      ];
    case 'box': {
      const pad = 6 * s;
      return [
        [
          [left - pad + 3 * s, box.y - pad],
          [right + pad, box.y - pad + 1 * s],
          [right + pad - 1 * s, bottom + pad],
          [left - pad, bottom + pad - 1 * s],
          [left - pad + 1 * s, box.y - pad - 3 * s],
        ],
      ];
    }
    case 'circle': {
      const rx = box.width / 2 + 14 * s;
      const ry = box.height / 2 + 8 * s;
      return [ellipse(left + box.width / 2, mid, rx, ry, -2.3, -2.3 + Math.PI * 2.12, 3)];
    }
  }
}

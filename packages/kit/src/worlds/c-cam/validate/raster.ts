/**
 * A small CPU raster for the connectivity rules (port of c-plus `validate-raster.js`
 * `V.components`): shapes from `ShapePaint` are rasterized at pixel centres (one bit per pixel,
 * every ink counts, like the canvas silhouette with alpha >= 128), then 8-connected ink
 * components and 4-connected enclosed holes are counted.
 *
 * Public API: `Mask`, `rasterize`, `maskAt`, `Components`, `components`.
 */
import { segmentDistance, type Box } from './shape-geometry.js';
import type { Region, Shape } from './shape-paint.js';

/** One bit per pixel; pixel (i, j) has its centre at (x0 + i + 0.5, y0 + j + 0.5). */
export interface Mask {
  readonly w: number;
  readonly h: number;
  readonly x0: number;
  readonly y0: number;
  readonly on: Uint8Array;
}

const at = (pts: readonly number[], i: number): number => pts[i] ?? 0;

/** Pixels of a region (scanline at pixel centres, honouring the fill rule). */
function fillRegion(
  region: Region,
  w: number,
  h: number,
  x0: number,
  y0: number,
  set: (i: number, j: number) => void,
): void {
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const p of region.paths) {
    for (let k = 1; k < p.pts.length; k += 2) {
      ymin = Math.min(ymin, at(p.pts, k));
      ymax = Math.max(ymax, at(p.pts, k));
    }
  }
  const j0 = Math.max(0, Math.floor(ymin - y0 - 0.5));
  const j1 = Math.min(h - 1, Math.ceil(ymax - y0 - 0.5));
  for (let j = j0; j <= j1; j += 1) {
    const y = y0 + j + 0.5;
    const xs: { x: number; dir: number }[] = [];
    for (const p of region.paths) {
      const n = p.pts.length >> 1;
      for (let k = 0; k < n; k += 1) {
        const m = (k + 1) % n;
        const ay = at(p.pts, 2 * k + 1);
        const by = at(p.pts, 2 * m + 1);
        if (ay <= y === by <= y) continue;
        const ax = at(p.pts, 2 * k);
        const bx = at(p.pts, 2 * m);
        xs.push({ x: ax + ((y - ay) / (by - ay)) * (bx - ax), dir: by > ay ? 1 : -1 });
      }
    }
    xs.sort((a, b) => a.x - b.x);
    let wind = 0;
    for (let k = 0; k + 1 < xs.length; k += 1) {
      const cur = xs[k];
      const next = xs[k + 1];
      if (cur === undefined || next === undefined) continue;
      wind += region.rule === 'evenodd' ? 1 : cur.dir;
      const inside = region.rule === 'evenodd' ? wind % 2 === 1 : wind !== 0;
      if (!inside) continue;
      const i0 = Math.max(0, Math.ceil(cur.x - x0 - 0.5));
      const i1 = Math.min(w - 1, Math.floor(next.x - x0 - 0.5));
      for (let i = i0; i <= i1; i += 1) set(i, j);
    }
  }
}

function strokePixels(
  shape: Extract<Shape, { kind: 'stroke' }>,
  w: number,
  h: number,
  x0: number,
  y0: number,
  set: (i: number, j: number) => void,
): void {
  const r = shape.r;
  for (const p of shape.paths) {
    const n = p.pts.length >> 1;
    const segs = p.closed ? n : n - 1;
    for (let k = 0; k < segs; k += 1) {
      const m = (k + 1) % n;
      const ax = at(p.pts, 2 * k);
      const ay = at(p.pts, 2 * k + 1);
      const bx = at(p.pts, 2 * m);
      const by = at(p.pts, 2 * m + 1);
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - x0));
      const i1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + r - x0));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by) - r - y0));
      const j1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + r - y0));
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          if (segmentDistance(x0 + i + 0.5, y0 + j + 0.5, ax, ay, bx, by) <= r) set(i, j);
        }
      }
    }
  }
}

/** Rasterizes the shapes over `box` (grown by `pad` px so the outside touches the border). */
export function rasterize(shapes: readonly Shape[], box: Box, pad = 2): Mask {
  const x0 = Math.floor(box.x0) - pad;
  const y0 = Math.floor(box.y0) - pad;
  const w = Math.ceil(box.x1) + pad - x0;
  const h = Math.ceil(box.y1) + pad - y0;
  const on = new Uint8Array(w * h);
  const clipMasks = new Map<Region, Uint8Array>();
  const clipMask = (region: Region): Uint8Array => {
    const cached = clipMasks.get(region);
    if (cached) return cached;
    const m = new Uint8Array(w * h);
    fillRegion(region, w, h, x0, y0, (i, j) => {
      m[j * w + i] = 1;
    });
    clipMasks.set(region, m);
    return m;
  };
  for (const s of shapes) {
    const clips = s.clips.map(clipMask);
    const set = (i: number, j: number): void => {
      const k = j * w + i;
      if (clips.every((c) => c[k] === 1)) on[k] = 1;
    };
    if (s.kind === 'fill') fillRegion(s.region, w, h, x0, y0, set);
    else strokePixels(s, w, h, x0, y0, set);
  }
  return { w, h, x0, y0, on };
}

/** Is the mask pixel under (x, y) inked? */
export function maskAt(mask: Mask, x: number, y: number): boolean {
  const i = Math.floor(x - mask.x0);
  const j = Math.floor(y - mask.y0);
  if (i < 0 || j < 0 || i >= mask.w || j >= mask.h) return false;
  return mask.on[j * mask.w + i] === 1;
}

export interface Components {
  /** 8-connected ink components with area >= minArea. */
  readonly comps: number;
  /** 4-connected empty components not touching the border with area >= minHole. */
  readonly holes: number;
  readonly biggestHole: number;
}

/** c-plus `V.components(img, w, h, minArea, minHole)` on a mask. */
export function components(mask: Mask, minArea: number, minHole: number): Components {
  const { w, h, on } = mask;
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let comps = 0;
  let holes = 0;
  let biggestHole = 0;
  for (let start = 0; start < n; start += 1) {
    if (seen[start]) continue;
    const val = on[start];
    const eight = val === 1;
    let sp = 0;
    let area = 0;
    let border = false;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const i = stack[--sp] ?? 0;
      const x = i % w;
      const y = (i / w) | 0;
      area += 1;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if ((dx === 0 && dy === 0) || (!eight && dx !== 0 && dy !== 0)) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (seen[j] || on[j] !== val) continue;
          seen[j] = 1;
          stack[sp++] = j;
        }
      }
    }
    if (val === 1 && area >= minArea) comps += 1;
    if (val !== 1 && !border && area >= minHole) {
      holes += 1;
      biggestHole = Math.max(biggestHole, area);
    }
  }
  return { comps, holes, biggestHole };
}

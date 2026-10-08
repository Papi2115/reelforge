/**
 * The Game B1 index framebuffer: palette indices (one byte per pixel), a clip rect and the
 * integer-exact primitives of the showcase's core.js (rect, ordered dither, LUT remap, Bresenham
 * line, even-odd scanline polygon, ellipse, nearest-neighbour blit). Index 255 = transparent in
 * scratch layers.
 */
import type { Lut } from '../palette.js';
import { T } from '../palette.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** Ordered-dither coverage: true on `level` (0..1) of the pixels. */
export function dith(x: number, y: number, level: number): boolean {
  return (BAYER[((y & 3) << 2) | (x & 3)] ?? 0) < level * 16;
}

/** Corners [x0, y0, ..., x3, y3] of a w x h rectangle centred at cx, cy, rotated by `angle`. */
export function quad(cx: number, cy: number, w: number, h: number, angle: number): number[] {
  const co = Math.cos(angle);
  const si = Math.sin(angle);
  const out: number[] = [];
  for (const [px, py] of [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ] as const)
    out.push(cx + px * co - py * si, cy + px * si + py * co);
  return out;
}

export class IndexCanvas {
  readonly d: Uint8Array;
  private x0 = 0;
  private y0 = 0;
  private x1: number;
  private y1: number;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Uint8Array(w * h);
    this.x1 = w;
    this.y1 = h;
  }

  /** Clip to a rect (px); no arguments = the whole canvas. */
  clip(x?: number, y?: number, w?: number, h?: number): void {
    if (x === undefined || y === undefined || w === undefined || h === undefined) {
      this.x0 = 0;
      this.y0 = 0;
      this.x1 = this.w;
      this.y1 = this.h;
      return;
    }
    this.x0 = Math.max(0, Math.round(x));
    this.y0 = Math.max(0, Math.round(y));
    this.x1 = Math.min(this.w, Math.round(x + w));
    this.y1 = Math.min(this.h, Math.round(y + h));
  }

  fill(c: number): void {
    this.d.fill(c);
  }

  px(x: number, y: number, c: number): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi >= this.x0 && xi < this.x1 && yi >= this.y0 && yi < this.y1)
      this.d[yi * this.w + xi] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    const ax = Math.max(this.x0, Math.round(x));
    const ay = Math.max(this.y0, Math.round(y));
    const bx = Math.min(this.x1, Math.round(x + w));
    const by = Math.min(this.y1, Math.round(y + h));
    if (bx <= ax) return;
    for (let yy = ay; yy < by; yy += 1) this.d.fill(c, yy * this.w + ax, yy * this.w + bx);
  }

  /** Ordered-dither `level` (0..1) of the rect with colour c. */
  dither(x: number, y: number, w: number, h: number, c: number, level: number): void {
    const ax = Math.max(this.x0, Math.round(x));
    const ay = Math.max(this.y0, Math.round(y));
    const bx = Math.min(this.x1, Math.round(x + w));
    const by = Math.min(this.y1, Math.round(y + h));
    for (let yy = ay; yy < by; yy += 1)
      for (let xx = ax; xx < bx; xx += 1) if (dith(xx, yy, level)) this.d[yy * this.w + xx] = c;
  }

  /** Remaps the pixels of a rect through a LUT (on `level` of them when given). */
  remap(x: number, y: number, w: number, h: number, table: Lut, level?: number): void {
    const ax = Math.max(this.x0, Math.round(x));
    const ay = Math.max(this.y0, Math.round(y));
    const bx = Math.min(this.x1, Math.round(x + w));
    const by = Math.min(this.y1, Math.round(y + h));
    const d = this.d;
    for (let yy = ay; yy < by; yy += 1) {
      const row = yy * this.w;
      for (let xx = ax; xx < bx; xx += 1)
        if (level === undefined || dith(xx, yy, level)) d[row + xx] = table[d[row + xx] ?? 0] ?? 0;
    }
  }

  /** Bresenham line with a square brush. */
  line(ax: number, ay: number, bx: number, by: number, c: number, brush = 1): void {
    let x0 = Math.round(ax);
    let y0 = Math.round(ay);
    const x1 = Math.round(bx);
    const y1 = Math.round(by);
    const off = Math.floor(brush / 2);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (brush === 1) this.px(x0, y0, c);
      else this.rect(x0 - off, y0 - off, brush, brush, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Even-odd polygon fill (pts = [x0, y0, x1, y1, ...]); `table` remaps instead of painting. */
  poly(pts: readonly number[], c: number, table?: Lut): void {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 1; i < pts.length; i += 2) {
      const y = pts[i] ?? 0;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const n = pts.length / 2;
    const xs: number[] = [];
    const yEnd = Math.min(this.y1, Math.ceil(maxY));
    for (let y = Math.max(this.y0, Math.floor(minY)); y < yEnd; y += 1) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i += 1) {
        const ax = pts[i * 2] ?? 0;
        const ay = pts[i * 2 + 1] ?? 0;
        const j = (i + 1) % n;
        const bx = pts[j * 2] ?? 0;
        const by = pts[j * 2 + 1] ?? 0;
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy))
          xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(this.x0, Math.ceil((xs[k] ?? 0) - 0.5));
        const xb = Math.min(this.x1 - 1, Math.floor((xs[k + 1] ?? 0) - 0.5));
        const row = y * this.w;
        for (let x = xa; x <= xb; x += 1)
          this.d[row + x] = table === undefined ? c : (table[this.d[row + x] ?? 0] ?? 0);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      const d = (y + 0.5 - cy) / ry;
      if (Math.abs(d) > 1) continue;
      const hw = rx * Math.sqrt(1 - d * d);
      const a = Math.round(cx - hw);
      this.rect(a, y, Math.round(cx + hw) - a, 1, c);
    }
  }

  /**
   * Nearest-neighbour blit of a full canvas of the same size into the rect (dx, dy, dw, dh),
   * clipped; transparent source pixels (255) are skipped.
   */
  blitScaled(src: IndexCanvas, dx: number, dy: number, dw: number, dh: number): void {
    const ax = Math.max(this.x0, Math.round(dx));
    const ay = Math.max(this.y0, Math.round(dy));
    const bx = Math.min(this.x1, Math.round(dx + dw));
    const by = Math.min(this.y1, Math.round(dy + dh));
    if (bx <= ax || by <= ay) return;
    const cols = new Int32Array(bx - ax);
    for (let x = ax; x < bx; x += 1)
      cols[x - ax] = Math.min(src.w - 1, Math.floor(((x + 0.5 - dx) / dw) * src.w));
    for (let y = ay; y < by; y += 1) {
      const sy = Math.min(src.h - 1, Math.floor(((y + 0.5 - dy) / dh) * src.h));
      const srow = sy * src.w;
      const drow = y * this.w;
      for (let x = ax; x < bx; x += 1) {
        const v = src.d[srow + (cols[x - ax] ?? 0)] ?? T;
        if (v !== T) this.d[drow + x] = v;
      }
    }
  }
}

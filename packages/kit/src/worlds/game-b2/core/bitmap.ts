/**
 * Indexed bitmaps of the Game B2 world: one palette index per pixel, 255 = transparent. Textures,
 * sprites and the HUD are drawn with these integer-exact primitives (Bresenham lines, scanline
 * polygons, nearest-neighbour blits), so every frame is bit-identical everywhere.
 */
import { T } from '../palette.js';
import { bayer, rng } from './rand.js';

export type Pts = readonly number[];

export class Bmp {
  readonly w: number;
  readonly h: number;
  readonly d: Uint8Array;

  constructor(w: number, h: number, fill: number = T) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h).fill(fill);
  }

  px(x: number, y: number, c: number): void {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi >= 0 && yi >= 0 && xi < this.w && yi < this.h) this.d[yi * this.w + xi] = c;
  }

  get(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    return xi >= 0 && yi >= 0 && xi < this.w && yi < this.h ? (this.d[yi * this.w + xi] ?? T) : T;
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w));
    const y1 = Math.min(this.h, Math.floor(y + h));
    if (x1 <= x0) return;
    for (let yy = y0; yy < y1; yy += 1) this.d.fill(c, yy * this.w + x0, yy * this.w + x1);
  }

  frame(x: number, y: number, w: number, h: number, c: number): void {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }

  /** Ordered-dither fill: `level` share of the pixels get c2. */
  dither(x: number, y: number, w: number, h: number, c1: number, c2: number, level: number): void {
    for (let yy = Math.floor(y); yy < y + h; yy += 1)
      for (let xx = Math.floor(x); xx < x + w; xx += 1)
        this.px(xx, yy, bayer(xx, yy) < level ? c2 : c1);
  }

  line(xa: number, ya: number, xb: number, yb: number, c: number): void {
    let x0 = Math.round(xa);
    let y0 = Math.round(ya);
    const x1 = Math.round(xb);
    const y1 = Math.round(yb);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
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

  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.px(x, y, c);
      }
  }

  /** Scanline polygon fill; pts = [x0, y0, x1, y1, ...]. */
  poly(pts: Pts, c: number): void {
    const n = pts.length >> 1;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 1; i < pts.length; i += 2) {
      minY = Math.min(minY, pts[i] ?? 0);
      maxY = Math.max(maxY, pts[i] ?? 0);
    }
    const xs: number[] = [];
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += 1) {
      const yc = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i += 1) {
        const j = (i + 1) % n;
        const ax = pts[i * 2] ?? 0;
        const ay = pts[i * 2 + 1] ?? 0;
        const bx = pts[j * 2] ?? 0;
        const by = pts[j * 2 + 1] ?? 0;
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc))
          xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k] ?? 0); x < Math.round(xs[k + 1] ?? 0); x += 1)
          this.px(x, y, c);
    }
  }

  /** Copies the opaque pixels of `src`; `map` remaps indices, `flip` mirrors. */
  blit(src: Bmp, x: number, y: number, map?: Uint8Array, flip = false): void {
    const ox = Math.round(x);
    const oy = Math.round(y);
    for (let sy = 0; sy < src.h; sy += 1) {
      const dy = oy + sy;
      if (dy < 0 || dy >= this.h) continue;
      for (let sx = 0; sx < src.w; sx += 1) {
        const c = src.d[sy * src.w + (flip ? src.w - 1 - sx : sx)] ?? T;
        if (c === T) continue;
        const dx = ox + sx;
        if (dx < 0 || dx >= this.w) continue;
        this.d[dy * this.w + dx] = map ? (map[c] ?? c) : c;
      }
    }
  }

  /** Adds a 1 px outline around the opaque pixels (in place); `onlyBelow` = drop shadow only. */
  outline(c: number, onlyBelow = false): this {
    const src = this.d.slice();
    const solid = (xx: number, yy: number): boolean =>
      xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && src[yy * this.w + xx] !== T;
    for (let y = 0; y < this.h; y += 1)
      for (let x = 0; x < this.w; x += 1) {
        if (src[y * this.w + x] !== T) continue;
        const touches = onlyBelow
          ? solid(x, y - 1)
          : solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
        if (touches) this.d[y * this.w + x] = c;
      }
    return this;
  }
}

/** Rotated copy (nearest, pixel-snapped): crooked notes, tumbling items. */
export function rotate(src: Bmp, deg: number): Bmp {
  const a = (deg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const w = Math.ceil(Math.abs(src.w * ca) + Math.abs(src.h * sa)) + 2;
  const h = Math.ceil(Math.abs(src.w * sa) + Math.abs(src.h * ca)) + 2;
  const out = new Bmp(w, h);
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const dx = x + 0.5 - w / 2;
      const dy = y + 0.5 - h / 2;
      const sx = Math.floor(dx * ca + dy * sa + src.w / 2);
      const sy = Math.floor(-dx * sa + dy * ca + src.h / 2);
      if (sx >= 0 && sy >= 0 && sx < src.w && sy < src.h)
        out.d[y * w + x] = src.d[sy * src.w + sx] ?? T;
    }
  return out;
}

/**
 * Hand-drawn stroke: a polyline with a seeded perpendicular bow, drawn up to `progress` (0..1).
 * Two strokes with different seeds make the two-stroke arrow trace.
 */
export function handStroke(
  bmp: Bmp,
  pts: Pts,
  c: number,
  seed: number,
  wobble: number,
  progress = 1,
  thick = false,
): void {
  const random = rng(seed);
  const segments: [number, number, number, number, number][] = [];
  let total = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i] ?? 0;
    const ay = pts[i + 1] ?? 0;
    const bx = pts[i + 2] ?? 0;
    const by = pts[i + 3] ?? 0;
    const length = Math.hypot(bx - ax, by - ay);
    segments.push([ax, ay, bx, by, length]);
    total += length;
  }
  const limit = total * progress;
  let done = 0;
  for (const [ax, ay, bx, by, length] of segments) {
    const steps = Math.max(1, Math.ceil(length));
    const nx = -(by - ay) / (length || 1);
    const ny = (bx - ax) / (length || 1);
    const w0 = (random() - 0.5) * wobble;
    const w1 = (random() - 0.5) * wobble;
    for (let s = 0; s <= steps; s += 1) {
      if (done + (s / steps) * length > limit) return;
      const u = s / steps;
      const bow = Math.sin(Math.PI * u) * (w0 + (w1 - w0) * u);
      const x = ax + (bx - ax) * u + nx * bow;
      const y = ay + (by - ay) * u + ny * bow;
      bmp.px(x, y, c);
      if (thick) bmp.px(x + 1, y, c);
    }
    done += length;
  }
}

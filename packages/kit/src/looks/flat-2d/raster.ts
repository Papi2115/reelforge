/**
 * Drawing surface of the flat-2d look: a CPU pixel buffer (RGBA8, top-down) at the shot's low-res
 * size, repainted from scratch for every t and shown 1:1 on a screen-space quad (board.ts). Only
 * palette colours are written and every primitive is integer-exact (scanline polygons and
 * ellipses sampled at pixel centres, Bresenham strokes, ordered-dither coverage), so shapes are
 * crisp and free of anti-aliasing, frames are bit-identical everywhere and the post pass maps them
 * onto themselves. (A trimmed copy of the blueprint raster: looks do not share internals.)
 */

/** A packed RGBA colour (native byte order, see packColor); 0 = transparent. */
export type Pixel = number;

/** Per-pixel pattern: true = paint this pixel. */
export type Pattern = (x: number, y: number) => boolean;

export type Point = readonly [number, number];

/** 4x4 Bayer matrix (0..15): ordered dither thresholds. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** Packs bytes into one Pixel in the platform's byte order (Uint32Array view of RGBA bytes). */
export function packColor(r: number, g: number, b: number, a = 255): Pixel {
  return new Uint32Array(new Uint8Array([r, g, b, a]).buffer)[0] ?? 0;
}

/** '#rrggbb' -> Pixel (opaque). */
export function hexPixel(hex: string): Pixel {
  const value = Number.parseInt(hex.slice(1), 16);
  return packColor((value >> 16) & 255, (value >> 8) & 255, value & 255);
}

/** Ordered-dither coverage: true on `level` (0..1) of the pixels, in Bayer order. */
export function bayerOn(x: number, y: number, level: number): boolean {
  if (level >= 1) return true;
  if (level <= 0) return false;
  const threshold = BAYER4[(y & 3) * 4 + (x & 3)] ?? 0;
  return threshold < level * 16;
}

export interface StrokeOptions {
  /** Share 0..1 of the path drawn from its start (draw-on animations; default 1). */
  readonly progress?: number | undefined;
  /** Square pen in pixels (default 1). */
  readonly width?: number | undefined;
}

interface Clip {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export class Raster {
  readonly width: number;
  readonly height: number;
  /** RGBA8, row 0 = top. */
  readonly data: Uint8Array<ArrayBuffer>;
  private readonly pixels: Uint32Array;
  private clips: Clip[] = [];
  /** Coverage 0..1 of the next writes (ordered-dither dissolve for fades). */
  private level = 1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
    this.pixels = new Uint32Array(this.data.buffer);
  }

  clear(color: Pixel = 0): void {
    this.pixels.fill(color);
    this.clips = [];
    this.level = 1;
  }

  /** Runs `draw` with writes limited to a rectangle (nested clips intersect). */
  clipped(x: number, y: number, width: number, height: number, draw: () => void): void {
    const outer = this.clip();
    this.clips.push({
      x0: Math.max(outer.x0, Math.round(x)),
      y0: Math.max(outer.y0, Math.round(y)),
      x1: Math.min(outer.x1, Math.round(x + width)),
      y1: Math.min(outer.y1, Math.round(y + height)),
    });
    try {
      draw();
    } finally {
      this.clips.pop();
    }
  }

  /** Runs `draw` at dither coverage `level` (0..1, multiplied with the current one). */
  faded(level: number, draw: () => void): void {
    const previous = this.level;
    this.level = previous * Math.min(1, Math.max(0, level));
    try {
      if (this.level > 0) draw();
    } finally {
      this.level = previous;
    }
  }

  private clip(): Clip {
    return this.clips.at(-1) ?? { x0: 0, y0: 0, x1: this.width, y1: this.height };
  }

  /** Colour at a pixel (0 outside). */
  get(x: number, y: number): Pixel {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.pixels[y * this.width + x] ?? 0;
  }

  set(x: number, y: number, color: Pixel): void {
    const px = Math.round(x);
    const py = Math.round(y);
    const clip = this.clip();
    if (px < clip.x0 || py < clip.y0 || px >= clip.x1 || py >= clip.y1) return;
    if (this.level < 1 && !bayerOn(px, py, this.level)) return;
    this.pixels[py * this.width + px] = color;
  }

  /** Horizontal run [from, to] (inclusive) on `row`, optional pattern. */
  span(row: number, from: number, to: number, color: Pixel, pattern?: Pattern): void {
    const clip = this.clip();
    if (row < clip.y0 || row >= clip.y1) return;
    const x0 = Math.max(clip.x0, from);
    const x1 = Math.min(clip.x1 - 1, to);
    if (x1 < x0) return;
    if (pattern === undefined && this.level >= 1) {
      this.pixels.fill(color, row * this.width + x0, row * this.width + x1 + 1);
      return;
    }
    for (let column = x0; column <= x1; column += 1) {
      if (pattern === undefined || pattern(column, row)) this.set(column, row, color);
    }
  }

  /** Paints every pixel where `test` holds, in horizontal runs (full-frame patterns). */
  mask(color: Pixel, test: Pattern): void {
    for (let row = 0; row < this.height; row += 1) {
      let start = -1;
      for (let column = 0; column <= this.width; column += 1) {
        const on = column < this.width && test(column, row);
        if (on && start < 0) start = column;
        if (!on && start >= 0) {
          this.span(row, start, column - 1, color);
          start = -1;
        }
      }
    }
  }

  /** Filled rectangle; `pattern` picks which pixels get the colour. */
  rect(x: number, y: number, width: number, height: number, color: Pixel, pattern?: Pattern): void {
    const x0 = Math.round(x);
    const x1 = Math.round(x + width) - 1;
    const y1 = Math.round(y + height);
    for (let row = Math.round(y); row < y1; row += 1) this.span(row, x0, x1, color, pattern);
  }

  /** Filled axis-aligned ellipse (pixel centres inside), optional pattern. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: Pixel, pattern?: Pattern): void {
    if (rx <= 0 || ry <= 0) return;
    const top = Math.ceil(cy - ry - 0.5);
    const bottom = Math.floor(cy + ry - 0.5);
    for (let row = top; row <= bottom; row += 1) {
      const dy = (row + 0.5 - cy) / ry;
      const k = 1 - dy * dy;
      if (k < 0) continue;
      const half = rx * Math.sqrt(k);
      const from = Math.ceil(cx - half - 0.5);
      const to = Math.floor(cx + half - 0.5);
      if (to >= from) this.span(row, from, to, color, pattern);
    }
  }

  /** Even-odd scanline fill of polygon rings (pixel centres), optional pattern. */
  polygon(rings: readonly (readonly Point[])[], color: Pixel, pattern?: Pattern): void {
    polygonSpans(rings, this.clip(), (row, from, to) => {
      this.span(row, from, to, color, pattern);
    });
  }

  /** Square dot of `size` px centred on (x, y). */
  dot(x: number, y: number, size: number, color: Pixel): void {
    const half = Math.floor(size / 2);
    this.rect(Math.round(x) - half, Math.round(y) - half, size, size, color);
  }

  /** 8-connected polyline through rounded points; `progress` draws a prefix of its pixels. */
  polyline(points: readonly Point[], color: Pixel, options: StrokeOptions = {}): void {
    const steps = pathPixels(points);
    const shown = Math.round(steps.length * Math.min(1, Math.max(0, options.progress ?? 1)));
    const pen = Math.max(1, Math.round(options.width ?? 1));
    for (let index = 0; index < shown; index += 1) {
      const [x, y] = steps[index] ?? [0, 0];
      if (pen === 1) this.set(x, y, color);
      else this.dot(x, y, pen, color);
    }
  }
}

/**
 * Pixel spans (inclusive) covered by polygon rings (even-odd, pixel centres) inside a clip
 * rectangle [x0, x1) x [y0, y1).
 */
export function polygonSpans(
  rings: readonly (readonly Point[])[],
  clip: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number },
  span: (row: number, from: number, to: number) => void,
): void {
  let top = Infinity;
  let bottom = -Infinity;
  for (const ring of rings) {
    for (const [, y] of ring) {
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  const rowStart = Math.max(clip.y0, Math.ceil(top - 0.5));
  const rowEnd = Math.min(clip.y1 - 1, Math.floor(bottom - 0.5));
  for (let row = rowStart; row <= rowEnd; row += 1) {
    const crossings = scanlineCrossings(rings, row + 0.5);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const from = Math.max(clip.x0, Math.ceil((crossings[index] ?? 0) - 0.5));
      const to = Math.min(clip.x1 - 1, Math.floor((crossings[index + 1] ?? 0) - 0.5));
      if (to >= from) span(row, from, to);
    }
  }
}

/** Sorted x of the ring edges crossing the horizontal line y. */
function scanlineCrossings(rings: readonly (readonly Point[])[], y: number): number[] {
  const crossings: number[] = [];
  for (const ring of rings) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const [xa, ya] = ring[previous] ?? [0, 0];
      const [xb, yb] = ring[index] ?? [0, 0];
      if (ya > y !== yb > y) crossings.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
    }
  }
  return crossings.sort((a, b) => a - b);
}

/** Pixels of an 8-connected path through rounded points (no repeated joints). */
export function pathPixels(points: readonly Point[]): [number, number][] {
  const result: [number, number][] = [];
  for (let index = 0; index + 1 < points.length; index += 1) {
    const [ax, ay] = points[index] ?? [0, 0];
    const [bx, by] = points[index + 1] ?? [0, 0];
    let x = Math.round(ax);
    let y = Math.round(ay);
    const x1 = Math.round(bx);
    const y1 = Math.round(by);
    const dx = Math.abs(x1 - x);
    const dy = -Math.abs(y1 - y);
    const sx = x < x1 ? 1 : -1;
    const sy = y < y1 ? 1 : -1;
    let error = dx + dy;
    if (result.length === 0) result.push([x, y]);
    while (x !== x1 || y !== y1) {
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        x += sx;
      }
      if (doubled <= dx) {
        error += dx;
        y += sy;
      }
      result.push([x, y]);
    }
  }
  if (result.length === 0 && points[0]) {
    result.push([Math.round(points[0][0]), Math.round(points[0][1])]);
  }
  return result;
}

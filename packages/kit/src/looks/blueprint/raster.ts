/**
 * The blueprint look's drawing surface: a CPU pixel buffer (RGBA8, top-down) at the shot's
 * low-res size, painted from scratch for every t and shown 1:1 on a screen-space quad (board.ts).
 * Only palette colours are written and every primitive is integer-exact (Bresenham lines,
 * midpoint circles, scanline polygons, ordered-dither patterns), so frames are crisp pixel art,
 * bit-identical everywhere and the post pass maps them onto themselves.
 */

/** A packed RGBA colour (native byte order, see packColor); 0 = transparent. */
export type Pixel = number;

/** Per-pixel pattern: true = paint this pixel. */
export type Pattern = (x: number, y: number) => boolean;

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

export const PATTERNS = {
  solid: (() => true) as Pattern,
  /** 50 % checkerboard. */
  checker: ((x, y) => ((x + y) & 1) === 0) as Pattern,
  /** 25 % dots on a 2x2 lattice. */
  dots: ((x, y) => (x & 1) === 0 && (y & 1) === 0) as Pattern,
  /** Sparse dots every 3 px (land, halftone fills). */
  sparse: ((x, y) => x % 3 === 0 && y % 3 === 0) as Pattern,
  /** 45-degree hatching every 4 px (section fills). */
  hatch: ((x, y) => (x + y) % 4 === 0) as Pattern,
} as const;

export type PatternName = keyof typeof PATTERNS;

export interface StrokeOptions {
  /** Dash pattern [on, off] in pixels along the path (default solid). */
  readonly dash?: readonly [number, number] | undefined;
  /** Share 0..1 of the path drawn from its start (draw-on animations; default 1). */
  readonly progress?: number | undefined;
  /** Square pen in pixels (default 1). */
  readonly width?: number | undefined;
}

export type Point = readonly [number, number];

/** Saved pixels of a rectangle (Raster.snapshot). */
export interface Snapshot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint32Array;
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
  /** Coverage 0..1 of the next writes (ordered dither dissolve for fades). */
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

  /** Copy of a rectangle's pixels (restore() puts them back). */
  snapshot(x: number, y: number, width: number, height: number): Snapshot {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const w = Math.max(0, Math.min(this.width, Math.round(x + width)) - x0);
    const h = Math.max(0, Math.min(this.height, Math.round(y + height)) - y0);
    const pixels = new Uint32Array(w * h);
    for (let row = 0; row < h; row += 1) {
      const start = (y0 + row) * this.width + x0;
      pixels.set(this.pixels.subarray(start, start + w), row * w);
    }
    return { x: x0, y: y0, width: w, height: h, pixels };
  }

  restore(snapshot: Snapshot): void {
    const { x, y, width, height, pixels } = snapshot;
    for (let row = 0; row < height; row += 1) {
      this.pixels.set(pixels.subarray(row * width, (row + 1) * width), (y + row) * this.width + x);
    }
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

  /** Filled rectangle; `pattern` picks which pixels get the colour. */
  rect(x: number, y: number, width: number, height: number, color: Pixel, pattern?: Pattern): void {
    const clip = this.clip();
    const x0 = Math.max(clip.x0, Math.round(x));
    const y0 = Math.max(clip.y0, Math.round(y));
    const x1 = Math.min(clip.x1, Math.round(x + width));
    const y1 = Math.min(clip.y1, Math.round(y + height));
    if (pattern === undefined && this.level >= 1) {
      for (let row = y0; row < y1; row += 1) {
        this.pixels.fill(color, row * this.width + x0, row * this.width + Math.max(x0, x1));
      }
      return;
    }
    for (let row = y0; row < y1; row += 1) {
      for (let column = x0; column < x1; column += 1) {
        if (pattern === undefined || pattern(column, row)) this.set(column, row, color);
      }
    }
  }

  /** 1-px (or `thickness`) rectangle outline. */
  frame(x: number, y: number, width: number, height: number, color: Pixel, thickness = 1): void {
    const w = Math.round(width);
    const h = Math.round(height);
    const t = Math.max(1, Math.round(thickness));
    this.rect(x, y, w, t, color);
    this.rect(x, y + h - t, w, t, color);
    this.rect(x, y + t, t, h - 2 * t, color);
    this.rect(x + w - t, y + t, t, h - 2 * t, color);
  }

  /** Square dot of `size` px centred on (x, y). */
  dot(x: number, y: number, size: number, color: Pixel): void {
    const half = Math.floor(size / 2);
    this.rect(Math.round(x) - half, Math.round(y) - half, size, size, color);
  }

  /** Bresenham line (8-connected), see polyline for options. */
  line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: Pixel,
    options?: StrokeOptions,
  ): void {
    this.polyline(
      [
        [x0, y0],
        [x1, y1],
      ],
      color,
      options,
    );
  }

  /**
   * Polyline through rounded points: 8-connected pixel steps, dashes counted along the whole
   * path, `progress` draws a prefix of the path's pixels (so a draw-on never jumps).
   */
  polyline(points: readonly Point[], color: Pixel, options: StrokeOptions = {}): void {
    const steps = pathPixels(points);
    const shown = Math.round(steps.length * Math.min(1, Math.max(0, options.progress ?? 1)));
    const pen = Math.max(1, Math.round(options.width ?? 1));
    const [on, off] = options.dash ?? [1, 0];
    for (let index = 0; index < shown; index += 1) {
      if (off > 0 && index % (on + off) >= on) continue;
      const [x, y] = steps[index] ?? [0, 0];
      if (pen === 1) this.set(x, y, color);
      else this.dot(x, y, pen, color);
    }
  }

  /** Midpoint circle outline. */
  circle(cx: number, cy: number, radius: number, color: Pixel): void {
    for (const [x, y] of circlePixels(Math.round(radius))) {
      this.set(Math.round(cx) + x, Math.round(cy) + y, color);
    }
  }

  /** Filled disc (pixel centres within radius + 0.5). */
  disc(cx: number, cy: number, radius: number, color: Pixel, pattern?: Pattern): void {
    const r = Math.round(radius);
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (dx * dx + dy * dy > r * r + r) continue;
        if (pattern === undefined || pattern(x0 + dx, y0 + dy)) this.set(x0 + dx, y0 + dy, color);
      }
    }
  }

  /** Even-odd scanline fill of polygon rings (pixel centres), optional pattern. */
  polygon(rings: readonly (readonly Point[])[], color: Pixel, pattern?: Pattern): void {
    const clip = this.clip();
    polygonSpans(rings, clip, (row, from, to) => {
      for (let column = from; column <= to; column += 1) {
        if (pattern === undefined || pattern(column, row)) this.set(column, row, color);
      }
    });
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
  if (result.length === 0 && points[0])
    result.push([Math.round(points[0][0]), Math.round(points[0][1])]);
  return result;
}

/** Offsets of a midpoint circle of integer radius. */
export function circlePixels(radius: number): [number, number][] {
  if (radius <= 0) return [[0, 0]];
  const result: [number, number][] = [];
  let x = radius;
  let y = 0;
  let error = 1 - radius;
  while (x >= y) {
    for (const [px, py] of [
      [x, y],
      [y, x],
      [-y, x],
      [-x, y],
      [-x, -y],
      [-y, -x],
      [y, -x],
      [x, -y],
    ] as const) {
      result.push([px, py]);
    }
    y += 1;
    if (error < 0) {
      error += 2 * y + 1;
    } else {
      x -= 1;
      error += 2 * (y - x) + 1;
    }
  }
  return result;
}

/** Points of a circle (or arc, radians, clockwise on screen) as a polyline for draw-ons. */
export function arcPoints(
  cx: number,
  cy: number,
  radius: number,
  from = 0,
  to = Math.PI * 2,
): Point[] {
  const segments = Math.max(8, Math.round((Math.abs(to - from) * radius) / 3));
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = from + ((to - from) * index) / segments;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
  });
}

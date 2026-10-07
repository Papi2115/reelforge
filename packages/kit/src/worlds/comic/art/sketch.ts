/**
 * `Sketch`: how every comic art generator draws (PLAN.md#13.15a). A model is authored facing
 * right in its own units with (0, 0) where it stands (up = negative y); a Sketch maps it onto a
 * panel pen at (x, y), scale k, optionally mirrored (facing left) and turned. It draws in the
 * comic grammar only: flat fills on the colour plate (printed 1-2 px off register), boiled ink
 * outlines on the key plate (heavier on the silhouette than inside it), halftone shading from the
 * left light, hatching. Three value steps per part: fill, its halftone shade, the ink.
 */
import type { Pts } from '../draw/canvas.js';
import { clamp01 } from '../draw/math.js';
import { capsulePts, ellipsePts } from '../draw/shapes.js';
import type { BlobPart, ComicPen, PaintArg } from '../page/pen.js';

/** Fill ink -> the darker ink its halftone shade is printed in. */
const SHADE_OF: Readonly<Record<string, string>> = {
  ink: 'night',
  night: 'ink',
  paper: 'greyLight',
  shade: 'aged',
  aged: 'greyDark',
  cyan: 'cyanDeep',
  cyanDeep: 'night',
  magenta: 'night',
  yellow: 'magenta',
  yellowPale: 'yellow',
  red: 'night',
  greyLight: 'greyMid',
  greyMid: 'greyDark',
  greyDark: 'ink',
  phosphor: 'cyanDeep',
  pencil: 'greyDark',
  sepiaPaper: 'sepiaTan',
  sepiaFibre: 'sepiaTan',
  sepiaTan: 'sepiaMid',
  sepiaMid: 'sepiaInk',
  sepiaInk: 'ink',
  sepiaRed: 'sepiaInk',
};

/** The default shade ink of a fill swatch. */
export function shadeInkOf(fill: string): string {
  return SHADE_OF[fill] ?? 'greyDark';
}

export interface SketchFrame {
  readonly x: number;
  readonly y: number;
  /** Model units -> pen units. */
  readonly k: number;
  /** Mirrored: the model faces left. */
  readonly flip: boolean;
  /** Turn in radians (clockwise on the page), about the model origin. */
  readonly angle: number;
  /** Seed of the boil and wobble keys. */
  readonly key: string;
}

export interface ShapeLook {
  /** Halftone shade 0..0.9 from the left light (0 = flat). */
  readonly shade?: number | undefined;
  readonly shadeInk?: string | undefined;
  /** Outline: 'outer' (silhouette weight), 'inner' (detail weight), false, or model units. */
  readonly outline?: 'outer' | 'inner' | false | number | undefined;
  readonly hatch?: { readonly gap: number; readonly angle: number; readonly color: string };
  /** Fill on the key plate (in register) instead of the colour plate. */
  readonly key?: boolean | undefined;
  readonly boil?: number | undefined;
}

export function bbox(pts: Pts): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const x = pts[i] ?? 0;
    const y = pts[i + 1] ?? 0;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

export class Sketch {
  private counter = 0;

  constructor(
    readonly g: ComicPen,
    readonly f: SketchFrame,
  ) {}

  /** Pen px per model unit (page scale included). */
  get px(): number {
    return this.f.k * this.g.s;
  }

  /** Silhouette and detail line widths in screen px. */
  widthOf(outline: ShapeLook['outline']): number {
    if (typeof outline === 'number') return Math.max(1, Math.round(outline * this.px));
    const base = outline === 'inner' ? 0.9 : 1.7;
    return Math.max(1, Math.min(5, Math.round(base * this.px)));
  }

  /** Model point -> pen-local point. */
  pt(mx: number, my: number): [number, number] {
    const { f } = this;
    const sx = f.flip ? -mx : mx;
    const ca = Math.cos(f.angle);
    const sa = Math.sin(f.angle);
    return [f.x + (sx * ca - my * sa) * f.k, f.y + (sx * sa + my * ca) * f.k];
  }

  map(pts: Pts): number[] {
    const out: number[] = [];
    for (let i = 0; i + 1 < pts.length; i += 2) out.push(...this.pt(pts[i] ?? 0, pts[i + 1] ?? 0));
    return out;
  }

  /** A part of the model: origin at model (x, y), scaled by k, turned by angle (model sense). */
  sub(x: number, y: number, k = 1, angle = 0): Sketch {
    const [px, py] = this.pt(x, y);
    const { f } = this;
    const turn = f.flip ? -angle : angle;
    return new Sketch(this.g, { ...f, x: px, y: py, k: f.k * k, angle: f.angle + turn });
  }

  /** The same frame facing the other way. */
  mirrored(): Sketch {
    return new Sketch(this.g, { ...this.f, flip: !this.f.flip });
  }

  /**
   * Generator options written in this model's units -> pen units: where it stands (x, y, x0,
   * x1), how tall (size), which way it faces (flip) and a box [x, y, w, h].
   */
  placeOptions(options: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...options };
    const num = (key: string): number | undefined => {
      const value = options[key];
      return typeof value === 'number' ? value : undefined;
    };
    const [x, y] = this.pt(num('x') ?? 0, num('y') ?? 0);
    out['x'] = x;
    out['y'] = y;
    const size = num('size');
    if (size !== undefined) out['size'] = size * this.f.k;
    if (this.f.flip) out['flip'] = options['flip'] !== true;
    for (const key of ['x0', 'x1'] as const) {
      const value = num(key);
      if (value !== undefined) out[key] = this.pt(value, num('y') ?? 0)[0];
    }
    const box = options['box'];
    if (Array.isArray(box) && box.length === 4 && box.every((v) => typeof v === 'number')) {
      const [bx, by, bw, bh] = box as [number, number, number, number];
      const [px, py] = this.pt(this.f.flip ? bx + bw : bx, by);
      out['box'] = [px, py, bw * this.f.k, bh * this.f.k];
    }
    return out;
  }

  private nextKey(suffix: string | undefined): string {
    this.counter += 1;
    return `${this.f.key}:${suffix ?? String(this.counter)}`;
  }

  /** A fill paint with the left-light halftone shade over the mapped box. */
  shadePaint(fill: string, level: number, shadeInk: string | undefined, mapped: Pts): PaintArg {
    if (level <= 0) return fill;
    const [bx, by, bw, bh] = bbox(mapped);
    const ramp = (lx: number, ly: number) =>
      level * clamp01(((lx - bx) / (bw || 1)) * 0.8 + ((ly - by) / (bh || 1)) * 0.35 - 0.3);
    return this.g.tone(shadeInk ?? shadeInkOf(fill), ramp, { cell: 3, angle: 0.78, on: fill });
  }

  /** Filled, shaded, outlined polygon (model points). */
  shape(pts: Pts, fill: string, look: ShapeLook = {}, key?: string): void {
    const mapped = this.map(pts);
    const { g } = this;
    if (fill !== 'none') {
      const paint = this.shadePaint(fill, look.shade ?? 0, look.shadeInk, mapped);
      (look.key === true ? g : g.plate).poly(mapped, paint);
    }
    if (look.hatch !== undefined) this.hatchMapped(mapped, look.hatch);
    if (look.outline === false) return;
    g.ink(mapped, {
      w: this.widthOf(look.outline ?? 'outer'),
      boil: look.boil ?? 0.5,
      key: this.nextKey(key),
    });
  }

  oval(cx: number, cy: number, rx: number, ry: number, fill: string, look?: ShapeLook): void {
    const steps = Math.max(10, Math.min(28, Math.round((rx + ry) * this.px * 0.5)));
    this.shape(ellipsePts(cx, cy, rx, ry, steps, `${this.f.key}o${String(cx)}`, 0.03), fill, look);
  }

  cap(x0: number, y0: number, x1: number, y1: number, r: number, fill: string, look?: ShapeLook) {
    this.shape(capsulePts(x0, y0, x1, y1, r), fill, look);
  }

  /** An open ink stroke (no fill), boiled. */
  stroke(pts: Pts, look: { w?: ShapeLook['outline']; color?: string; boil?: number } = {}): void {
    this.g.ink(this.map(pts), {
      closed: false,
      w: this.widthOf(look.w ?? 'inner'),
      boil: look.boil ?? 0.4,
      color: look.color ?? 'ink',
      key: this.nextKey(undefined),
    });
  }

  /** A straight, unboiled line (detail, texture). */
  line(x0: number, y0: number, x1: number, y1: number, color = 'ink', w?: number): void {
    const [a, b] = this.pt(x0, y0);
    const [c, d] = this.pt(x1, y1);
    this.g.line(a, b, c, d, color, w ?? this.widthOf('inner'));
  }

  /** A solid dot on the key plate (eyes, rivets, stars). */
  dot(cx: number, cy: number, r: number, color = 'ink'): void {
    const [x, y] = this.pt(cx, cy);
    const radius = Math.max(0.6 / this.g.s, r * this.f.k);
    this.g.ellipse(x, y, radius, radius, color);
  }

  /** A flat key-plate polygon (hair, shadows, windows: in register, no outline). */
  solid(pts: Pts, color: string): void {
    this.g.poly(this.map(pts), color);
  }

  /** A flat plate polygon (no outline). */
  flat(pts: Pts, paint: PaintArg): void {
    this.g.plate.poly(this.map(pts), paint);
  }

  /** A fill a halftone step darker (the far side of a figure). */
  toned(fill: string, level: number): PaintArg {
    return this.g.tone(shadeInkOf(fill), level, { cell: 3, angle: 0.78, on: fill });
  }

  /** One-outline silhouette from capsules `c` and ellipses `e` (model units). */
  blob(parts: readonly BlobPart[], fill: PaintArg, key?: string): void {
    const k = this.f.k;
    const mapped = parts.map((part): BlobPart => {
      if (part.c) {
        const [x0, y0, x1, y1, r] = part.c;
        const [a, b] = this.pt(x0, y0);
        const [c, d] = this.pt(x1, y1);
        return { c: [a, b, c, d, r * k], fill: part.fill };
      }
      const [ex, ey, rx, ry] = part.e ?? [0, 0, 0, 0];
      const [x, y] = this.pt(ex, ey);
      const turned = Math.abs(Math.sin(this.f.angle)) > 0.7;
      return { e: turned ? [x, y, ry * k, rx * k] : [x, y, rx * k, ry * k], fill: part.fill };
    });
    this.g.blob(mapped, fill, { key: this.nextKey(key) });
  }

  /** Parallel hatching inside a polygon (model points). */
  hatch(pts: Pts, look: { gap: number; angle: number; color: string }): void {
    this.hatchMapped(this.map(pts), look);
  }

  private hatchMapped(mapped: Pts, look: { gap: number; angle: number; color: string }): void {
    const [bx, by, bw, bh] = bbox(mapped);
    const { g } = this;
    const gap = Math.max(1.5 / g.s, look.gap * this.f.k);
    const reach = Math.hypot(bw, bh);
    const [ux, uy] = [Math.cos(look.angle), Math.sin(look.angle)];
    const [cx, cy] = [bx + bw / 2, by + bh / 2];
    g.clip(mapped, () => {
      for (let d = -reach / 2; d <= reach / 2; d += gap) {
        const [ox, oy] = [cx - uy * d, cy + ux * d];
        g.line(ox - ux * reach, oy - uy * reach, ox + ux * reach, oy + uy * reach, look.color, 1);
      }
    });
  }
}

/** A Sketch for a generator call: model height `unit` drawn `size` tall at (x, y). */
export function sketchFor(
  g: ComicPen,
  o: { x: number; y: number; size: number; flip?: boolean; angle?: number },
  unit: number,
  key: string,
): Sketch {
  return new Sketch(g, {
    x: o.x,
    y: o.y,
    k: o.size / unit,
    flip: o.flip ?? false,
    angle: o.angle ?? 0,
    key,
  });
}

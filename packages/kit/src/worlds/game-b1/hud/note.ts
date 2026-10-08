/**
 * The sticky note on the TV glass (outside the CRT: no scanlines; it casts a shadow on the
 * picture): slapped on with a squash, its bottom-right corner curled up, the weak point written in
 * Dad's hand, underlined twice, later struck out in crimson or ticked. Drawn in picture px through
 * the glass transform, so it rides the glass when the camera is in the room or pushing in.
 */
import { quad, type IndexCanvas } from '../core/canvas.js';
import { hand, handStroke } from '../core/hand.js';
import { clamp01 } from '../core/math.js';
import { C, SCAN } from '../palette.js';

export interface NoteSpec {
  readonly at: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly angle: number;
  readonly lines: readonly string[];
  readonly size: number;
  readonly seed: number;
  readonly under: number | undefined;
  readonly strike: { readonly line: number; readonly at: number } | undefined;
  readonly tick: number | undefined;
}

/** Picture px -> frame px (the glass rect the picture is shown in). */
export interface GlassTransform {
  readonly ox: number;
  readonly oy: number;
  readonly kx: number;
  readonly ky: number;
}

type Pt = readonly [number, number];

export function drawNote(cv: IndexCanvas, spec: NoteSpec, t: number, g: GlassTransform): void {
  const u = t - spec.at;
  if (u < 0) return;
  const k = g.ky;
  const sc = u < 0.05 ? 1.16 : u < 0.1 ? 0.97 : 1;
  const w = spec.w * sc * k;
  const h = spec.h * sc * k;
  const cx = g.ox + spec.x * g.kx;
  const cy = g.oy + (spec.y + (u < 0.05 ? -5 : 0)) * g.ky;
  const drop = (u < 0.05 ? 8 : 4) * k;
  cv.poly(quad(cx + drop, cy + drop + k, w, h, spec.angle), 0, SCAN);
  cv.poly(quad(cx + drop, cy + drop + k, w - 4 * k, h - 4 * k, spec.angle), 0, SCAN);
  cv.poly(quad(cx, cy, w, h, spec.angle), C.GOLD);
  const co = Math.cos(spec.angle);
  const si = Math.sin(spec.angle);
  const P = (lx: number, ly: number): Pt => [cx + lx * co - ly * si, cy + lx * si + ly * co];
  // bottom-right corner curled up off the glass
  const c0 = P(w / 2 - 13 * k, h / 2);
  const c1 = P(w / 2, h / 2 - 11 * k);
  const c2 = P(w / 2, h / 2);
  const c3 = P(w / 2 - 9 * k, h / 2 - 8 * k);
  cv.poly([...c0, ...c1, ...c2], C.VOID);
  cv.poly([...c0, ...c1, ...c3], C.ORANGE);
  const size = spec.size * k;
  const brush = Math.max(1, Math.round(2 * k));
  spec.lines.forEach((line, i) => {
    const lx = -w / 2 + (9 + (i === 0 ? 0 : 2 + i)) * k;
    const ly = -h / 2 + 10 * k + i * size * 7.6;
    const [px, py] = P(lx, ly);
    const opts = {
      size,
      angle: spec.angle,
      seed: spec.seed + i * 17,
      colour: C.WALNUT_D,
      slant: 0.2,
    };
    const width = hand(cv, line, { x: px, y: py, brush, ...opts });
    if (spec.under === i) underline(cv, P, lx, ly, width, size, u, spec.seed, brush);
    if (spec.strike?.line === i) {
      const r = clamp01((t - spec.strike.at) / 0.22);
      if (r > 0)
        handStroke(cv, P(lx - 4 * k, ly + size * 3.6), P(lx + width + 4 * k, ly + size * 2.6), {
          colour: C.CRIMSON,
          seed: spec.seed + 9,
          reveal: r,
          bow: 4 * k,
          brush,
        });
    }
    if (spec.tick !== undefined && i === spec.lines.length - 1) {
      const r = clamp01((t - spec.tick) / 0.25);
      const a = P(lx + width + 8 * k, ly + size * 3.5);
      const b = P(lx + width + 13 * k, ly + size * 6.2);
      const c = P(lx + width + 26 * k, ly - size * 1.5);
      if (r > 0)
        handStroke(cv, a, b, {
          colour: C.WALNUT_D,
          seed: 61,
          reveal: clamp01(r * 2.5),
          bow: k,
          brush,
        });
      if (r > 0.4)
        handStroke(cv, b, c, {
          colour: C.WALNUT_D,
          seed: 62,
          reveal: (r - 0.4) / 0.6,
          bow: 3 * k,
          brush,
        });
    }
  });
}

function underline(
  cv: IndexCanvas,
  P: (lx: number, ly: number) => Pt,
  lx: number,
  ly: number,
  width: number,
  size: number,
  u: number,
  seed: number,
  brush: number,
): void {
  const k1 = clamp01((u - 0.35) / 0.25);
  if (k1 <= 0) return;
  handStroke(cv, P(lx - 2, ly + size * 7.4), P(lx + width + 3, ly + size * 7), {
    colour: C.WALNUT_D,
    seed: seed + 3,
    reveal: k1,
    bow: 2.5,
    brush,
  });
  const k2 = clamp01((u - 0.62) / 0.2);
  if (k2 > 0)
    handStroke(cv, P(lx + 6, ly + size * 8.3), P(lx + width - 4, ly + size * 8.1), {
      colour: C.WALNUT_D,
      seed: seed + 4,
      reveal: k2,
      bow: 2,
      brush: Math.max(1, brush - 1),
    });
}

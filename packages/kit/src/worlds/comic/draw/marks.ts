/**
 * Hand marks and print traces of the Comic page (the showcase's lettering.js / marks.js): a
 * two-stroke arrow, a thumbprint, an ink smudge, speed lines that stop before the subject, motion
 * trails that stop dead, a pencil loop, a tick, a strike-through, a highlighter swipe, a coffee
 * ring. All seeded by key, drawn in screen space.
 */
import { INK } from '../inks.js';
import type { ComicCanvas, Paint, Pts } from './canvas.js';
import { clamp01, rnd, rndRange } from './math.js';
import { dither } from './paint.js';

function part(p: number, a: number, b: number): number {
  return p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a);
}

/** Two-stroke arrow: a bowed shaft, then a separate head that does not quite meet it. */
export function handArrow(
  canvas: ComicCanvas,
  from: readonly [number, number],
  to: readonly [number, number],
  p: number,
  paint: Paint,
  key: string,
  w = 1,
): void {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const bow = rndRange(key, 1, 0.12, 0.22) * (rnd(key, 2) < 0.5 ? -1 : 1);
  const length = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / length;
  const ny = (x1 - x0) / length;
  const pts: number[] = [];
  for (let i = 0; i <= 16; i += 1) {
    const s = i / 16;
    const b = Math.sin(s * Math.PI) * bow * length;
    pts.push(
      x0 + (x1 - x0) * s + nx * b + Math.round(rndRange(key, 10 + i, -0.4, 0.4)),
      y0 + (y1 - y0) * s + ny * b,
    );
  }
  canvas.strokeOn(pts, part(p, 0, 0.7), paint, w);
  const head = part(p, 0.78, 1);
  if (head <= 0) return;
  const ax = pts[pts.length - 4] ?? x0;
  const ay = pts[pts.length - 3] ?? y0;
  const angle = Math.atan2(y1 - ay, x1 - ax);
  const hl = 6 + rnd(key, 30) * 2;
  const ex = x1 + 1;
  const ey = y1 - 1;
  canvas.strokeOn(
    [
      ...[ex + Math.cos(angle + 2.55) * hl, ey + Math.sin(angle + 2.55) * hl, ex, ey],
      ...[ex + Math.cos(angle - 2.4) * hl, ey + Math.sin(angle - 2.4) * hl],
    ],
    head,
    paint,
    w,
  );
}

/** A thumbprint: broken concentric loops in a pale ink. */
export function thumbprint(
  canvas: ComicCanvas,
  cx: number,
  cy: number,
  key: string,
  paint = INK.SHADE,
): void {
  for (let r = 2; r < 13; r += 2) {
    for (let i = 0; i < 40; i += 1) {
      if (rnd(key, r * 100 + i) < 0.22) continue;
      const a = (i / 40) * Math.PI * 2;
      const wobble = 1 + 0.08 * Math.sin(a * 2 + r);
      canvas.plot(cx + Math.cos(a) * r * 0.82 * wobble, cy + Math.sin(a) * r * wobble, paint);
    }
  }
}

/** Ink smudge: a dragged blot, dithered so it reads as a stain, not a shape. */
export function smudge(
  canvas: ComicCanvas,
  cx: number,
  cy: number,
  length: number,
  angle: number,
  key: string,
): void {
  for (let i = 0; i < 26; i += 1) {
    const s = i / 26;
    const r = (1 - s) * 3.2 + 0.6;
    const x = cx + Math.cos(angle) * length * s + rndRange(key, i, -1, 1);
    const y = cy + Math.sin(angle) * length * s + rndRange(key, i + 40, -1, 1);
    canvas.ellipse(x, y, r, r * 0.8, dither(-1, INK.INK, 0.75 - s * 0.6));
  }
}

export interface SpeedLines {
  /** Subject point the lines aim at (screen). */
  readonly x: number;
  readonly y: number;
  /** Direction of motion (lines trail behind, against it). */
  readonly dx: number;
  readonly dy: number;
  readonly count: number;
  readonly length: number;
  /** Half-width of the bundle across the motion. */
  readonly spread: number;
  /** Clear distance before the subject (lines stop short of it). */
  readonly gap: number;
  readonly paint: Paint;
  readonly key: string;
  /** Re-roll phase (seconds): lengths change on a 10 fps cadence, like redrawn ink. */
  readonly phase: number;
}

/** Speed lines behind a moving subject that stop before it, uneven, re-inked at 10 fps. */
export function speedLines(canvas: ComicCanvas, lines: SpeedLines): void {
  const norm = Math.hypot(lines.dx, lines.dy) || 1;
  const ux = lines.dx / norm;
  const uy = lines.dy / norm;
  const roll = Math.floor(lines.phase * 10);
  const { key } = lines;
  for (let i = 0; i < lines.count; i += 1) {
    const off = (rnd(key, i) * 2 - 1) * lines.spread;
    const edge = 1 - (Math.abs(off) / (lines.spread || 1)) ** 2 * 0.35;
    const near = lines.gap * edge + rnd(key, i + 100) * 5;
    const length = lines.length * (0.35 + rnd(key, i * 31 + roll) * 0.8);
    const bx = lines.x - ux * near - uy * off;
    const by = lines.y - uy * near + ux * off;
    const w = rnd(key, i + 400) < 0.25 ? 2 : 1;
    canvas.line(bx, by, bx - ux * length, by - uy * length, lines.paint, w);
  }
}

/**
 * Motion trail: 2-4 thin strokes along the path the subject took (`pts`, oldest first), offset
 * across it, each shorter, all stopping `gap` px before the subject's current point.
 */
export function motionTrail(
  canvas: ComicCanvas,
  pts: Pts,
  options: { paint: Paint; lines: number; spacing: number; gap: number; key: string },
): void {
  const n = pts.length >> 1;
  if (n < 2) return;
  const lengths = [0];
  for (let i = 1; i < n; i += 1) {
    const d = Math.hypot(
      (pts[i * 2] ?? 0) - (pts[i * 2 - 2] ?? 0),
      (pts[i * 2 + 1] ?? 0) - (pts[i * 2 - 1] ?? 0),
    );
    lengths.push((lengths[i - 1] ?? 0) + d);
  }
  const total = lengths[n - 1] ?? 0;
  for (let k = 0; k < options.lines; k += 1) {
    const offset = (k - (options.lines - 1) / 2) * options.spacing;
    const start = total * (0.15 + rnd(options.key, k) * 0.3);
    const end = total - options.gap - rnd(options.key, k + 10) * 4;
    const out: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const at = lengths[i] ?? 0;
      if (at < start || at > end) continue;
      const j = Math.min(n - 1, i + 1);
      const h = Math.max(0, i - 1);
      const tx = (pts[j * 2] ?? 0) - (pts[h * 2] ?? 0);
      const ty = (pts[j * 2 + 1] ?? 0) - (pts[h * 2 + 1] ?? 0);
      const tl = Math.hypot(tx, ty) || 1;
      out.push((pts[i * 2] ?? 0) - (ty / tl) * offset, (pts[i * 2 + 1] ?? 0) + (tx / tl) * offset);
    }
    canvas.polyline(out, options.paint, 1, false);
  }
}

/** Pencil loop in one stroke that overshoots its start instead of closing (p = share drawn). */
export function pencilCircle(
  canvas: ComicCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  p: number,
  paint: Paint,
  key: string,
  w = 1,
): void {
  const pts: number[] = [];
  const a0 = rndRange(key, 1, -2.6, -1.9);
  const turns = 1.12 + rnd(key, 2) * 0.1;
  for (let i = 0; i <= 40; i += 1) {
    const s = i / 40;
    const a = a0 + s * turns * Math.PI * 2;
    const grow = 1 + s * 0.12 + 0.05 * Math.sin(a * 2 + rnd(key, 3) * 6);
    pts.push(cx + Math.cos(a) * rx * grow, cy + Math.sin(a) * ry * grow + s * 2);
  }
  canvas.strokeOn(pts, p, paint, w);
}

/** Crossed out: two quick, slightly rising strokes, the second one shorter. */
export function strike(
  canvas: ComicCanvas,
  x0: number,
  y: number,
  x1: number,
  p: number,
  paint: Paint,
  key: string,
): void {
  const r = (i: number) => rndRange(key, i, -1.5, 1.5);
  canvas.strokeOn([x0 - 3, y + 2 + r(1), x1 + 3, y - 2 + r(2)], part(p, 0, 0.55), paint, 2);
  canvas.strokeOn([x1 + 1, y + 1 + r(3), x0 + 4, y - 1 + r(4)], part(p, 0.62, 1), paint, 1);
}

/** A tick: a short down-stroke, a long flick up to the right. */
export function tick(
  canvas: ComicCanvas,
  x: number,
  y: number,
  p: number,
  paint: Paint,
  key: string,
): void {
  const k = 1 + rnd(key, 1) * 0.25;
  const end = y - 6 * k + rndRange(key, 2, -1, 1);
  canvas.strokeOn([x, y, x + 3 * k, y + 5 * k, x + 11 * k, end], p, paint, 2);
}

/** Highlighter swipe: a band with ragged ends, slightly tilted, drawn on left to right. */
export function highlighter(
  canvas: ComicCanvas,
  box: readonly [number, number, number, number],
  p: number,
  paint: Paint,
  key: string,
): void {
  const [x0, y0, x1, y1] = box;
  const xe = x0 + (x1 - x0) * clamp01(p);
  const tilt = rndRange(key, 1, -0.03, 0.03);
  for (let x = Math.round(x0); x <= xe; x += 1) {
    const dy = (x - x0) * tilt;
    const top = y0 + dy + (rnd(key, x) < 0.2 ? 1 : 0);
    const bottom = y1 + dy - (rnd(key, x + 999) < 0.2 ? 1 : 0);
    for (let y = Math.round(top); y <= bottom; y += 1) canvas.plot(x, y, paint);
  }
}

/** A coffee ring: an uneven annulus, darker on one side, a gap where the cup lifted. */
export function coffeeRing(
  canvas: ComicCanvas,
  cx: number,
  cy: number,
  r: number,
  paint: Paint,
  key: string,
): void {
  for (let i = 0; i < 90; i += 1) {
    const a = (i / 90) * Math.PI * 2;
    if (Math.abs(Math.sin((a - rnd(key, 1) * 6) / 2)) < 0.1) continue;
    const w = 1 + (Math.sin(a + rnd(key, 2) * 6) > 0.3 ? 1 : 0);
    const rr = r * (1 + 0.03 * Math.sin(a * 3));
    for (let k = 0; k < w; k += 1) {
      canvas.plot(cx + Math.cos(a) * (rr - k), cy + Math.sin(a) * (rr - k) * 0.96, paint);
    }
  }
}

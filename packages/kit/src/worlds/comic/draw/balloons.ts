/**
 * Speech balloons, thought clouds and caption boxes of the Comic page (a port of the showcase's
 * lettering.js). Screen-space drawing: the page maps their anchors through its camera and passes
 * the zoom, so lettering travels with the panels and stays crisp (integer text scale).
 */
import { INK } from '../inks.js';
import type { ComicCanvas, Pts } from './canvas.js';
import { ellipsePts } from './shapes.js';
import { rnd, rndRange } from './math.js';
import { drawText, measure } from './text.js';

/** Line height of the lettering in px at scale 1. */
export const LINE_H = 10;

export type BalloonKind = 'speech' | 'radio' | 'thought';

export interface BalloonDraw {
  readonly lines: readonly string[];
  readonly cx: number;
  readonly cy: number;
  /** Tail tip (screen); absent = no tail. */
  readonly tail?: readonly [number, number] | undefined;
  readonly kind: BalloonKind;
  /** Pop scale 0..1.1 (0 = not drawn). */
  readonly scale: number;
  /** Camera zoom (text scale = floor(zoom)). */
  readonly zoom: number;
  readonly key: string;
}

/** Integer text scale for a zoom: never larger than the zoom, so text never overflows. */
export function textScale(zoom: number): number {
  return Math.max(1, Math.floor(zoom + 1e-6));
}

export interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

/** Radii of a balloon holding these lines at scale 1. */
export function balloonSize(lines: readonly string[]): { rx: number; ry: number } {
  const width = Math.max(...lines.map((line) => measure('hand', line, 1, true)));
  const height = lines.length * LINE_H - 3;
  return { rx: (width / 2) * 1.2 + 7, ry: (height / 2) * 1.25 + 7 };
}

export function drawBalloon(canvas: ComicCanvas, balloon: BalloonDraw): Ellipse | null {
  const { lines, cx, cy, key, zoom, kind } = balloon;
  const k = balloon.scale * zoom;
  if (k <= 0.05) return null;
  const size = balloonSize(lines);
  const rx = size.rx * k;
  const ry = size.ry * k;
  const tail = kind === 'thought' ? undefined : balloon.tail;
  if (tail) drawTail(canvas, { cx, cy, rx, ry }, tail, kind === 'radio', key);
  if (kind === 'thought') cloud(canvas, { cx, cy, rx, ry }, key);
  else {
    canvas.poly(ellipsePts(cx, cy, rx + 1, ry + 1, 44, key, 0.025), INK.INK);
    canvas.poly(ellipsePts(cx, cy, rx, ry, 44, key, 0.025), INK.PAPER);
  }
  if (tail) reopenTail(canvas, { cx, cy, rx, ry }, tail, kind === 'radio', key);
  if (k > 0.85 * zoom) {
    const ts = textScale(zoom);
    const lineHeight = LINE_H * ts;
    const block = lines.length * lineHeight - 3 * ts;
    lines.forEach((line, i) => {
      const width = measure('hand', line, ts, true);
      const x = cx - width / 2 + (rnd(key, 40 + i) < 0.5 ? 0 : 1);
      const y = cy - block / 2 + i * lineHeight;
      drawText(canvas, 'hand', line, x, y, INK.INK, {
        key: `${key}${String(i)}`,
        bold: true,
        scale: ts,
        jitter: ts,
      });
    });
  }
  return { cx, cy, rx, ry };
}

/** Thought balloon: a scalloped cloud, bumps of uneven size, one shared outline. */
function cloud(canvas: ComicCanvas, e: Ellipse, key: string): void {
  const bumps: [number, number, number][] = [];
  for (let i = 0; i < 11; i += 1) {
    const a = (i / 11) * Math.PI * 2 + rnd(key, 70 + i) * 0.25;
    const r = Math.min(e.rx, e.ry) * (0.34 + rnd(key, 80 + i) * 0.14);
    bumps.push([e.cx + Math.cos(a) * (e.rx - r * 0.2), e.cy + Math.sin(a) * (e.ry - r * 0.2), r]);
  }
  for (const [x, y, r] of bumps) canvas.ellipse(x, y, r + 1, r + 1, INK.INK);
  canvas.ellipse(e.cx, e.cy, e.rx + 1, e.ry + 1, INK.INK);
  for (const [x, y, r] of bumps) canvas.ellipse(x, y, r, r, INK.PAPER);
  canvas.ellipse(e.cx, e.cy, e.rx, e.ry, INK.PAPER);
}

/**
 * The trail of shrinking bubbles from a thought cloud toward the thinker's head: they start just
 * outside the cloud (never over its lettering) and stop short of the head.
 */
export function thoughtDots(
  canvas: ComicCanvas,
  cloud: Ellipse,
  to: readonly [number, number],
  zoom: number,
  key: string,
): void {
  const dx = to[0] - cloud.cx;
  const dy = to[1] - cloud.cy;
  const distance = Math.hypot(dx, dy) || 1;
  const toEdge = 1 / Math.hypot(dx / distance / cloud.rx, dy / distance / cloud.ry);
  const start = Math.min(0.9, (toEdge + 4 * Math.max(1, zoom)) / distance);
  for (let i = 0; i < 3; i += 1) {
    const s = start + (0.92 - start) * (0.12 + i * 0.36);
    const r = (4 - i * 1.2) * Math.max(1, zoom * 0.8);
    const x = cloud.cx + dx * s + rndRange(key, i, -2, 2);
    const y = cloud.cy + dy * s + rndRange(key, i + 5, -2, 2);
    canvas.ellipse(x, y, r + 1, r + 1, INK.INK);
    canvas.ellipse(x, y, r, r, INK.PAPER);
  }
}

function tailBase(e: Ellipse, tip: readonly [number, number]) {
  const angle = Math.atan2((tip[1] - e.cy) / e.ry, (tip[0] - e.cx) / e.rx);
  return {
    bx: e.cx + Math.cos(angle) * e.rx * 0.8,
    by: e.cy + Math.sin(angle) * e.ry * 0.8,
    nx: -Math.sin(angle),
    ny: Math.cos(angle),
    half: Math.min(e.rx, e.ry) * 0.28 + 2,
  };
}

function tailPoints(
  e: Ellipse,
  tip: readonly [number, number],
  radio: boolean,
  key: string,
  shrink: number,
): number[] {
  const g = tailBase(e, tip);
  const h = g.half - shrink;
  const [tx, ty] = tip;
  if (!radio) {
    // A curved, tapering tail: base offset to one side, the tip slightly hooked.
    const mx = (g.bx + tx) / 2 + g.nx * h * 0.9;
    const my = (g.by + ty) / 2 + g.ny * h * 0.9;
    return [
      ...[g.bx + g.nx * h, g.by + g.ny * h, mx + g.nx, my + g.ny, tx, ty],
      ...[mx - g.nx * h * 0.3, my - g.ny * h * 0.3, g.bx - g.nx * h * 0.4, g.by - g.ny * h * 0.4],
    ];
  }
  // Lightning tail: three zig-zag segments for a radio voice.
  const side: [number, number, number][] = [0, 0.38, 0.62, 1].map((p, i) => {
    const zig = i === 0 || i === 3 ? 0 : (i % 2 ? 1 : -1) * (6 + rnd(key, 90 + i) * 3);
    return [
      g.bx + (tx - g.bx) * p + g.nx * zig,
      g.by + (ty - g.by) * p + g.ny * zig,
      (1 - p) * h + 0.6,
    ];
  });
  const pts: number[] = [];
  for (const [x, y, w] of side) pts.push(x + g.nx * w, y + g.ny * w);
  for (const [x, y, w] of [...side].reverse()) pts.push(x - g.nx * w, y - g.ny * w);
  return pts;
}

function drawTail(
  canvas: ComicCanvas,
  e: Ellipse,
  tip: readonly [number, number],
  radio: boolean,
  key: string,
): void {
  const pts = tailPoints(e, tip, radio, key, 0);
  canvas.poly(pts, INK.PAPER);
  canvas.polyline(pts, INK.INK, 1, true);
}

/** Re-opens the joint so the tail flows out of the balloon without an ink seam. */
function reopenTail(
  canvas: ComicCanvas,
  e: Ellipse,
  tip: readonly [number, number],
  radio: boolean,
  key: string,
): void {
  const g = tailBase(e, tip);
  const pts = tailPoints(e, tip, radio, key, 1);
  const cut: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const d = Math.hypot((pts[i] ?? 0) - g.bx, (pts[i + 1] ?? 0) - g.by);
    if (d < Math.hypot(e.rx, e.ry) * 0.4) cut.push(pts[i] ?? 0, pts[i + 1] ?? 0);
  }
  if (cut.length >= 6) canvas.poly(cut, INK.PAPER);
}

export interface CaptionDraw {
  readonly lines: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  /** Left edge tilt in px (hand-cut box). */
  readonly tilt: number;
  readonly fill: number;
  readonly key: string;
  readonly reveal?: number | undefined;
}

/** Caption box: hand-cut (corners off by a pixel), hard print shadow, text left aligned. */
export function drawCaption(canvas: ComicCanvas, caption: CaptionDraw): Pts {
  const { lines, x, y, key, tilt } = caption;
  const ts = textScale(caption.zoom);
  const width = Math.max(...lines.map((line) => measure('hand', line, ts, true))) + 12 * ts;
  const height = lines.length * LINE_H * ts + 7 * ts;
  const j = (i: number) => Math.round(rndRange(key, i, -1, 1));
  const pts = [
    ...[x + j(1), y + j(2) + tilt, x + width + j(3), y + j(4)],
    ...[x + width + j(5), y + height + j(6), x + j(7), y + height + j(8) + tilt],
  ];
  canvas.poly(
    pts.map((v) => v + 2),
    INK.INK,
  );
  canvas.poly(pts, caption.fill);
  canvas.polyline(pts, INK.INK, 1, true);
  lines.forEach((line, i) => {
    drawText(canvas, 'hand', line, x + 6 * ts, y + 5 * ts + i * LINE_H * ts, INK.INK, {
      key: `${key}${String(i)}`,
      reveal: caption.reveal,
      bold: true,
      scale: ts,
      jitter: ts,
    });
  });
  return pts;
}

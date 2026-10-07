/**
 * The flat mechanisms of a pop-up card, glued to its backdrop and moved by the pull: a paper card
 * (slides, turns, grows, dissolves in or out), a hinged flap (opens toward the viewer and shows
 * what it covered), a gauge (thermometer or tank: the level rises or drains), a wheel or gear
 * (turns; the label at the top pointer is read), a counter (the number advances), a window (a
 * strip slides behind an opening) and a scale (a pointer travels between two ends). Their words
 * and drawings are built once; painting is a pure function of the pieces' states.
 */
import { sunRecipe } from '../draw/doodles.js';
import { DEFAULT_EXPRESSION, DEFAULT_POSE, figureMarks } from '../draw/figures.js';
import { drawMarks } from '../draw/ink.js';
import { textWidth, type HandName } from '../draw/lettering.js';
import { fillMark, writeMarks, type Mark } from '../draw/marks.js';
import { hash } from '../draw/math.js';
import { ellipsePts, type Point, type Pts, type Xform } from '../draw/paths.js';
import { INK, inkOfSwatch } from '../inks.js';
import type { InkCanvas } from '../draw/canvas.js';
import type { PopCamera, Plane, Vec3 } from './camera.js';
import type { AssetArt } from './popup-assets.js';
import type { PieceState } from './popup-motion.js';
import type { PopupElement } from './popup-schema.js';
import { recipeMarks } from './shapes.js';

export type FlatElement = Extract<
  PopupElement,
  { kind: 'card' | 'flap' | 'gauge' | 'wheel' | 'counter' | 'window' | 'scale' }
>;

export function isFlat(e: PopupElement): e is FlatElement {
  return ['card', 'flap', 'gauge', 'wheel', 'counter', 'window', 'scale'].includes(e.kind);
}

/** Marks that were on the card before the shot (complete at t = 0; they still boil). */
const BEFORE = { t0: -5, t1: -4.9, held: false, fps: 12 } as const;
const PAPERS = {
  paper: [INK.PAPER, INK.SHADE],
  kraft: [INK.KRAFT, INK.KRAFT_D],
  sticky: [INK.STICKY, INK.STICKY_D],
} as const;

/** Text centred on (cx, baseline y), piece-local px (y down). */
function centred(text: string, cx: number, y: number, size: number, hand: HandName, seed: number) {
  const marks: Mark[] = [];
  writeMarks(marks, text, {
    ...BEFORE,
    x: cx - textWidth(text, size, hand) / 2,
    y,
    size,
    hand,
    tool: hand === 'type' ? 'fine' : 'felt',
    boil: hand === 'type' ? 0 : undefined,
    seed,
  });
  return marks;
}

function drawing(kind: 'figure' | 'sun', cx: number, ground: number, h: number, seed: number) {
  if (kind === 'figure') {
    const figure = figureMarks({
      x: cx,
      y: ground,
      h,
      t0: -5,
      seed,
      tool: 'felt',
      fps: 12,
      belly: 0,
      brows: true,
      pose: () => DEFAULT_POSE,
      expression: () => DEFAULT_EXPRESSION,
    });
    return figure.marks.map((mark) => ({ ...mark, held: false }));
  }
  const r = h * 0.3;
  const cy = ground - h / 2;
  return [
    ...recipeMarks(sunRecipe(cx, cy, r, seed, 8, 0.7), { tool: 'felt', t0: -5, seed }),
    fillMark(ellipsePts(cx + 1, cy + 1, r - 1, r - 2, 14), {
      color: INK.ORANGE,
      t0: -5,
      dur: 0.01,
      seed: seed + 77,
      spacing: 2,
      held: false,
    }),
  ];
}

/** The words and drawings of a flat piece (piece-local px, y down), built once. */
export function flatMarks(e: FlatElement, seed: number, art?: AssetArt): Mark[][] {
  switch (e.kind) {
    case 'card': {
      const marks: Mark[] = [];
      const pictured = e.draw !== 'none' || (e.asset !== undefined && art !== undefined);
      const size = Math.min(26, e.h * (pictured ? 0.24 : 0.42));
      const ground = e.text === undefined ? e.h / 2 - 6 : e.h / 2 - size - 8;
      const h = Math.min(e.h * 0.6, ground + e.h / 2 - 6);
      if (e.asset !== undefined && art !== undefined) {
        marks.push(...art(e.asset, { cx: 0, ground, h, maxW: e.w - 8 }));
      } else if (e.draw !== 'none') {
        marks.push(...drawing(e.draw, 0, ground, h, seed));
      }
      if (e.text !== undefined) {
        const y = pictured ? e.h / 2 - 6 : size / 2;
        marks.push(...centred(e.text, 0, y, size, 'print', seed + 1));
      }
      return [marks];
    }
    case 'flap':
      return [
        e.text === undefined ? [] : centred(e.text, 0, 9, Math.min(22, e.h * 0.32), 'print', seed),
      ];
    case 'gauge':
      return [
        ...e.marks.map((mark, i) => centred(mark, 0, 4, 12, 'print', seed + i)),
        e.label === undefined ? [] : centred(e.label, 0, 0, 14, 'print', seed + 9),
      ];
    case 'wheel':
      return e.labels.map((label, i) =>
        centred(label, 0, 5, Math.min(15, e.r * 0.3), 'type', seed + i),
      );
    case 'counter':
      return [];
    case 'window':
      return e.items.map((item, i) =>
        centred(item, 0, e.h * 0.25, Math.min(22, e.h * 0.5), 'type', seed + i),
      );
    case 'scale':
      return e.ends.map((end, i) => centred(end, 0, 0, 13, 'print', seed + i));
  }
}

/** The counter's number for a value (prefix, rounded value, suffix). */
export function counterText(e: Extract<PopupElement, { kind: 'counter' }>, value: number): string {
  return `${e.prefix}${String(Math.round(value))}${e.suffix}`;
}

/** Painting context of one flat piece. */
export interface FlatPaint {
  readonly canvas: InkCanvas;
  readonly cam: PopCamera;
  /** Backdrop plane (the pieces' plane) and the backdrop itself (flaps open off it). */
  readonly plane: Plane;
  readonly back: Plane;
  /** Left edge of the card (page px). */
  readonly x0: number;
  readonly seed: number;
  readonly t: number;
  /** Marks of a counter's value (cached by text). */
  readonly counter: (text: string) => Mark[];
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Piece-local px (y down) -> backdrop uv, through the piece's state. */
function localUV(e: FlatElement, st: PieceState, x0: number) {
  const base = e.kind === 'card' ? e.deg : 0;
  const a = rad(base + st.rotate);
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const [u0, v0] = [x0 + e.u + st.x, e.v + st.y];
  return (lx: number, ly: number): Point => [
    u0 + (lx * c - ly * s) * st.scale,
    v0 - (lx * s + ly * c) * st.scale,
  ];
}

function screenOf(f: FlatPaint, toUV: (lx: number, ly: number) => Point): Xform {
  return (lx, ly) => {
    const [u, v] = toUV(lx, ly);
    const [x, y] = f.plane.xf(u, v);
    return [x * f.cam.s, y * f.cam.s];
  };
}

function poly(toUV: (lx: number, ly: number) => Point, pts: Pts): Pts {
  const uv: Pts = [];
  for (let i = 0; i < pts.length; i += 2) uv.push(...toUV(pts[i] ?? 0, pts[i + 1] ?? 0));
  return uv;
}

const rect = (w: number, h: number, cx = 0, cy = 0): Pts => [
  cx - w / 2,
  cy - h / 2,
  cx + w / 2,
  cy - h / 2,
  cx + w / 2,
  cy + h / 2,
  cx - w / 2,
  cy + h / 2,
];

/** The outline of a flat piece on the backdrop (uv), for its shadow; null = none. */
export function flatOutline(e: FlatElement, st: PieceState, x0: number): Pts | null {
  const toUV = localUV(e, st, x0);
  const map = (pts: Pts): Pts => {
    const out: Pts = [];
    for (let i = 0; i < pts.length; i += 2) out.push(...toUV(pts[i] ?? 0, pts[i + 1] ?? 0));
    return out;
  };
  if (e.kind === 'card') return st.show < 0.5 ? null : map(rect(e.w, e.h));
  if (e.kind === 'gauge') return map(rect(e.w + 6, e.h + 6, 0, -e.h / 2));
  if (e.kind === 'wheel') return map(ellipsePts(0, 0, e.r, e.r, 18));
  if (e.kind === 'window') return map(rect(e.w + 26, e.h + 26));
  if (e.kind === 'scale') return map(rect(e.w + 10, 18, e.w / 2, 0));
  return null;
}

/** Paints one flat piece at its state; `marks` from flatMarks. */
export function paintFlat(f: FlatPaint, e: FlatElement, st: PieceState, marks: Mark[][]): void {
  const toUV = localUV(e, st, f.x0);
  const xf = screenOf(f, toUV);
  const shape = (pts: Pts, fill: number, edge?: number): Pts =>
    f.cam.flat(f.plane, poly(toUV, pts), fill, edge);
  const ink = (list: Mark[] | undefined, move: Xform = xf): void => {
    if (list) drawMarks(f.canvas, list, f.t, move);
  };
  const shifted =
    (dx: number, dy: number, turn = 0): Xform =>
    (lx, ly) => {
      const [c, s] = [Math.cos(turn), Math.sin(turn)];
      return xf(dx + lx * c - ly * s, dy + lx * s + ly * c);
    };
  switch (e.kind) {
    case 'card': {
      if (st.show <= 0) return;
      const [color, edge] = PAPERS[e.paper];
      const draw = (): void => {
        shape(rect(e.w, e.h), color, edge);
        ink(marks[0]);
      };
      // Swapping in or out: a dissolve, pixel by pixel.
      if (st.show >= 1) draw();
      else f.canvas.sieve((x, y) => hash(x, y, f.seed, 41) < st.show, draw);
      return;
    }
    case 'gauge': {
      const level = Math.min(1, Math.max(0, st.level));
      const color = inkOfSwatch(e.color) ?? INK.BIC;
      if (e.bulb) shape(ellipsePts(0, e.w * 0.3, e.w * 0.85, e.w * 0.85, 16), color, INK.GRAPHITE);
      shape(rect(e.w, e.h, 0, -e.h / 2), INK.PAPER, INK.GRAPHITE);
      if (level > 0)
        shape(rect(e.w - 6, (e.h - 6) * level, 0, -3 - ((e.h - 6) * level) / 2), color);
      const n = e.marks.length;
      e.marks.forEach((_, i) => {
        const y = -e.h * (n === 1 ? 0.5 : 0.1 + (0.8 * i) / (n - 1));
        shape(rect(8, 2, e.w / 2 + 4, y), INK.GRAPHITE);
        ink(marks[i], shifted(e.w / 2 + 12 + textWidth(e.marks[i] ?? '', 12, 'print') / 2, y));
      });
      ink(marks[n], shifted(0, -e.h - 10));
      return;
    }
    case 'wheel': {
      const color = inkOfSwatch(e.color) ?? INK.ORANGE;
      const turn = rad(st.angle);
      const rim: Pts = [];
      const teeth = e.teeth ? 14 : 0;
      for (let i = 0; i < 56; i += 1) {
        const a = (i / 56) * Math.PI * 2 + turn;
        const r = teeth > 0 && Math.floor((i / 56) * teeth * 2) % 2 === 0 ? e.r + 6 : e.r;
        rim.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      shape(rim, e.teeth ? color : INK.PAPER, INK.GRAPHITE);
      if (!e.teeth) shape(ellipsePts(0, 0, e.r * 0.28, e.r * 0.28, 12), color, INK.GRAPHITE);
      e.labels.forEach((_, i) => {
        const a = turn + (i / e.labels.length) * Math.PI * 2 - Math.PI / 2;
        const [cx, cy] = [Math.cos(a) * e.r * 0.64, Math.sin(a) * e.r * 0.64];
        ink(marks[i], shifted(cx, cy, a + Math.PI / 2));
      });
      shape(ellipsePts(0, 0, 4, 4, 8), INK.GRAPH_L, INK.GRAPHITE);
      // The fixed pointer at the top: the label under it is the one read.
      const top = -e.r - (e.teeth ? 8 : 3);
      shape([-7, top - 12, 7, top - 12, 0, top], INK.INK);
      return;
    }
    case 'counter': {
      const text = counterText(e, st.value);
      const w = textWidth(text, e.size, 'type') + 18;
      shape(rect(w, e.size * 1.6), INK.PAPER, INK.GRAPHITE);
      ink(f.counter(text), shifted(-w / 2 + 9, e.size / 2));
      return;
    }
    case 'window': {
      const hole = poly(toUV, rect(e.w, e.h));
      const screenHole = f.cam.screen(f.plane, hole);
      const inside = insideQuad(screenHole);
      f.canvas.sieve(inside, () => {
        shape(rect(e.w + 4, e.h + 4), INK.STICKY);
        e.items.forEach((_, i) => {
          ink(marks[i], shifted(0, (i - st.index) * e.h));
        });
      });
      const [ow, oh] = [e.w + 26, e.h + 26];
      shape(rect(ow, 13, 0, -oh / 2 + 6.5), INK.KRAFT);
      shape(rect(ow, 13, 0, oh / 2 - 6.5), INK.KRAFT);
      shape(rect(13, e.h, -ow / 2 + 6.5, 0), INK.KRAFT);
      shape(rect(13, e.h, ow / 2 - 6.5, 0), INK.KRAFT);
      f.canvas.outline(f.cam.screen(f.plane, poly(toUV, rect(ow, oh))), INK.KRAFT_D);
      f.canvas.outline(screenHole, INK.KRAFT_D);
      return;
    }
    case 'scale': {
      shape(rect(e.w, 12, e.w / 2, 0), INK.PAPER, INK.GRAPHITE);
      for (let i = 0; i < e.ticks; i += 1) {
        const x = (e.w * i) / (e.ticks - 1);
        shape(rect(1.5, i === 0 || i === e.ticks - 1 ? 10 : 6, x, -1), INK.GRAPHITE);
      }
      ink(marks[0], shifted(0, 24));
      ink(marks[1], shifted(e.w, 24));
      const x = e.w * Math.min(1.05, Math.max(-0.05, st.value));
      shape([x - 8, -26, x + 8, -26, x, -8], INK.INK);
      return;
    }
    case 'flap':
      paintFlap(f, e, st, marks[0] ?? []);
      return;
  }
}

/** Is a canvas pixel inside a convex screen quad? */
function insideQuad(q: Pts): (x: number, y: number) => boolean {
  return (x, y) => {
    let sign = 0;
    for (let i = 0; i < 4; i += 1) {
      const [ax, ay] = [q[2 * i] ?? 0, q[2 * i + 1] ?? 0];
      const [bx, by] = [q[(2 * i + 2) % 8] ?? 0, q[(2 * i + 3) % 8] ?? 0];
      const cross = (bx - ax) * (y + 0.5 - ay) - (by - ay) * (x + 0.5 - ax);
      if (cross !== 0) {
        if (sign !== 0 && Math.sign(cross) !== sign) return false;
        sign = Math.sign(cross);
      }
    }
    return true;
  };
}

/** A flap turning on its hinge off the backdrop, toward the viewer (3D, then the lens). */
function paintFlap(
  f: FlatPaint,
  e: Extract<PopupElement, { kind: 'flap' }>,
  st: PieceState,
  marks: Mark[],
): void {
  const theta = Math.PI * Math.min(1, Math.max(0, st.open));
  const [c, s] = [Math.cos(theta), Math.sin(theta)];
  const n = f.back.n;
  const side = e.hinge === 'left' || e.hinge === 'right';
  const sign = e.hinge === 'left' || e.hinge === 'bottom' ? 1 : -1;
  const [u0, v0] = [f.x0 + e.u + st.x, e.v + st.y];
  // (a = across the hinge 0..1, b = along it -0.5..0.5) -> canvas px.
  const at = (a: number, b: number): Point => {
    const reach = (side ? e.w : e.h) * a;
    const along = (side ? e.h : e.w) * b;
    const hinge = (side ? e.w : e.h) / 2;
    const flat = sign * (reach * c - hinge);
    const [u, v] = side ? [u0 + flat, v0 + along] : [u0 + along, v0 + flat];
    const P = f.plane.at(u, v);
    const lift = reach * s;
    const Q: Vec3 = [P[0] + n[0] * lift, P[1] + n[1] * lift, P[2] + n[2] * lift];
    const [x, y] = f.cam.proj(Q[0], Q[1], Q[2]);
    return [x * f.cam.s, y * f.cam.s];
  };
  const quad = [...at(0, -0.5), ...at(1, -0.5), ...at(1, 0.5), ...at(0, 0.5)];
  const [color, edge] = PAPERS[e.paper];
  f.canvas.fillPoly(quad, c >= 0 ? color : INK.PAPER);
  f.canvas.outline(quad, edge);
  if (c < 0.15) return;
  const across = side ? e.w : e.h;
  const along = side ? e.h : e.w;
  drawMarks(f.canvas, marks, f.t, (lx, ly) => {
    const a = side
      ? sign > 0
        ? lx / across + 0.5
        : 0.5 - lx / across
      : sign > 0
        ? 0.5 - ly / across
        : ly / across + 0.5;
    const b = side ? -ly / along : lx / along;
    return at(a, b);
  });
}

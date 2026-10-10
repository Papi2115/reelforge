/**
 * C-CAM faces (PLAN.md#14.4), part 1: the expression vocabulary (`EXPR`, 14 entries, default
 * deadpan), the resolved face state at time t (`face`: expression + blink + talking jaw), the
 * expression cue track (`exprAt`) and the small skin marks (stubble, wart, pores). The eye, brow
 * and mouth brushes are in face-parts.ts, the mitten hand in hand.ts (400-line limit).
 *
 * Port of `docs/concepts/c-cam-style/films/03-apollo-11/js/face.js` (md5-identical in films 1-3).
 * Divergences:
 *  - no `window.ST`, no module state; `ST.LW` (stubble line width) comes from the explicit
 *    `BrushEnv` like every brush in brushes.ts;
 *  - expression names are typed (`ExprName`); `face` still takes any string and falls back to
 *    deadpan for unknown names, but looks names up with `Object.hasOwn` (bug fixed: the original
 *    `ST.EXPR[expr]` resolved inherited keys such as `"constructor"` to non-expressions);
 *  - `exprAt` is new: the original snapped expressions with `ST.step(t, cues)` on raw `t`, so a
 *    change could land on an odd 24 fps frame (08-KNOWN_ISSUES #14); the port snaps on `twos(t)`;
 *  - option objects are typed; the `||` defaults of the original (0 falls back) are kept.
 */
import { blink, hash, rnd, step, talk, twos } from '../core.js';
import { brushStroke, bbox, curve, tracePath, type BrushEnv, type Pts } from './brushes.js';
import type { Paint2D } from './paint.js';
import { blob, ellipseRing } from './shapes.js';

/** The 14 expression names, in the order of the original table. */
export const EXPR_NAMES = [
  'deadpan',
  'miserable',
  'exhausted',
  'shock',
  'rage',
  'smug',
  'scared',
  'confused',
  'sad',
  'yelling',
  'disgust',
  'grin',
  'asleep',
  'focused',
] as const;

export type ExprName = (typeof EXPR_NAMES)[number];

/** Mouth shape keys (`mouth` in face-parts.ts draws each one). */
export type MouthShape =
  'flat' | 'smirk' | 'frown' | 'grin' | 'twist' | 'wavy' | 'open' | 'yell' | 'snarl';

export type Pair = readonly [number, number];

/** `[raise, knit]` of one brow. */
export type BrowSet = readonly [raise: number, knit: number];

/**
 * lid: upper-lid cover 0..1 · eye: white size · pup: pupil size · bl/br: [raise, knit] per brow ·
 * sq: lower-lid squint [left, right] · mouth: shape key · jaw: resting jaw drop 0..1 · look: pupil
 * offset.
 */
export interface ExprSpec {
  readonly lid: number;
  readonly eye: number;
  readonly pup: number;
  readonly bl: BrowSet;
  readonly br: BrowSet;
  readonly sq?: Pair;
  readonly mouth: MouthShape;
  readonly jaw: number;
  readonly look?: Pair;
}

// prettier-ignore
export const EXPR: Readonly<Record<ExprName, ExprSpec>> = {
  deadpan: { lid: 0.58, eye: 0.96, pup: 1, bl: [-0.15, 0.1], br: [-0.1, 0.15], mouth: 'flat', jaw: 0 },
  miserable: { lid: 0.62, eye: 0.95, pup: 1, bl: [0.1, -0.7], br: [0.05, -0.6], mouth: 'frown', jaw: 0, look: [0, 0.3] },
  exhausted: { lid: 0.78, eye: 0.95, pup: 1, bl: [-0.1, -0.5], br: [-0.2, -0.4], mouth: 'open', jaw: 0.35, look: [0, 0.4] },
  shock: { lid: 0, eye: 1.3, pup: 0.5, bl: [1.1, -0.2], br: [1.1, -0.2], mouth: 'open', jaw: 0.9 },
  rage: { lid: 0.3, eye: 1.06, pup: 0.7, bl: [-0.6, 1.1], br: [-0.6, 1.1], sq: [0.25, 0.25], mouth: 'snarl', jaw: 0.5 },
  smug: { lid: 0.66, eye: 0.98, pup: 1, bl: [-0.25, 0.25], br: [0.7, 0], mouth: 'smirk', jaw: 0 },
  scared: { lid: 0.02, eye: 1.2, pup: 0.5, bl: [0.8, -1], br: [0.8, -1], mouth: 'wavy', jaw: 0.3 },
  confused: { lid: 0.32, eye: 1.04, pup: 0.9, bl: [0.9, -0.3], br: [-0.4, 0.5], mouth: 'twist', jaw: 0.08 },
  sad: { lid: 0.5, eye: 1, pup: 1, bl: [0.2, -1.1], br: [0.2, -1.1], mouth: 'frown', jaw: 0, look: [0, 0.5] },
  yelling: { lid: 0.12, eye: 1.16, pup: 0.6, bl: [-0.3, 1], br: [-0.3, 1], mouth: 'yell', jaw: 1 },
  disgust: { lid: 0.5, eye: 1, pup: 1, sq: [0.45, 0.1], bl: [-0.6, 0.6], br: [0.5, 0], mouth: 'twist', jaw: 0.22 },
  grin: { lid: 0.4, eye: 1, pup: 1, bl: [0.3, 0], br: [0.4, 0], mouth: 'grin', jaw: 0.4 },
  asleep: { lid: 1, eye: 1, pup: 1, bl: [-0.1, -0.3], br: [-0.1, -0.3], mouth: 'open', jaw: 0.25 },
  focused: { lid: 0.44, eye: 1, pup: 0.85, bl: [-0.35, 0.7], br: [-0.35, 0.7], sq: [0.2, 0.2], mouth: 'flat', jaw: 0 },
};

export function isExprName(name: string): name is ExprName {
  return Object.hasOwn(EXPR, name);
}

/** Resolved face state at a moment (what eye / brow / mouth read). */
export interface FaceState {
  readonly lid: number;
  readonly eye: number;
  readonly pup: number;
  readonly bl: BrowSet;
  readonly br: BrowSet;
  readonly sq: Pair;
  readonly mouth: MouthShape;
  readonly jaw: number;
  readonly look: Pair;
  /** The name that was asked for (unknown names keep their text but act deadpan). */
  readonly name: string;
}

export interface FaceOptions {
  /** Speech spans `[from, to]` (seconds): the jaw flaps on twos inside them. */
  readonly talk?: readonly Pair[];
  /** Jaw drop at full flap (default 0.8). */
  readonly talkAmp?: number;
  readonly noBlink?: boolean;
  /** Pupil offset override. */
  readonly look?: Pair;
}

/** Face state at time t: expression + blink + talking jaw (+ per-call overrides). */
export function face(t: number, seed: number, expr: string, o: FaceOptions = {}): FaceState {
  const e = isExprName(expr) ? EXPR[expr] : EXPR.deadpan;
  const jawFlap = o.talk ? talk(t, seed, o.talk) : 0;
  const shut = o.noBlink || e.lid >= 1 ? 0 : blink(t, seed);
  return {
    lid: Math.max(e.lid, shut),
    eye: e.eye,
    pup: e.pup,
    bl: e.bl,
    br: e.br,
    sq: e.sq || [0, 0],
    mouth: jawFlap > 0 && (e.mouth === 'flat' || e.mouth === 'frown') ? 'open' : e.mouth,
    jaw: Math.max(e.jaw, jawFlap * (o.talkAmp || 0.8)),
    look: o.look || e.look || [0, 0],
    name: expr,
  };
}

/** `[time, expression]`: the expression snaps in at `time` (seconds). */
export type ExprCue = readonly [time: number, expr: ExprName];

/**
 * Expression track: the last cue whose time has passed, evaluated on `twos(t)` so changes land
 * on the acting clock (12 per second) like poses. Before the first cue the first cue holds (as
 * `step` does); an empty track is deadpan. Snaps, never blends.
 */
export function exprAt(cues: readonly ExprCue[], t: number): ExprName {
  return cues.length === 0 ? 'deadpan' : step(twos(t), cues);
}

/** Stubble: short dark dashes scattered inside a closed region (control points), clipped to it. */
export function stubble(
  g: Paint2D,
  env: BrushEnv,
  pts: Pts,
  seed: number,
  n: number,
  col?: string,
): void {
  const c = curve(pts, true, 6);
  const bb = bbox(c);
  g.save();
  tracePath(g, c, true);
  g.clip();
  g.strokeStyle = col || 'rgba(30,24,18,0.55)';
  g.lineWidth = 2.4 * env.lw;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < n; i += 1) {
    const x = bb.x0 + hash(seed, i, 1) * bb.w;
    const y = bb.y0 + hash(seed, i, 2) * bb.h;
    const a = rnd(1.2, 1.9, seed, i, 3);
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
  }
  g.stroke();
  g.restore();
}

/** Wart / mole: a lumpy dark-skin blob with a hair or two. */
export function wart(
  g: Paint2D,
  env: BrushEnv,
  x: number,
  y: number,
  r: number,
  col: string,
  seed?: number,
  hair?: boolean,
): void {
  const s = seed || 5;
  blob(g, env, ellipseRing(x, y, r, r * 0.85, 7), col, {
    lw: 3,
    seed: s,
    patch: ['rgba(255,240,210,0.18)', -r * 0.2, -r * 0.3, 0.4],
  });
  if (hair) {
    brushStroke(g, env, [x, y - r * 0.4, x + r * 0.6, y - r * 1.8, x + r * 1.4, y - r * 2.2], {
      w: 2,
      seed: s + 1,
      taper: false,
    });
  }
}

/** Pores / pock marks: a handful of tiny dark 3 x 2.5 px ticks in a box. */
export function pores(
  g: Paint2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  n: number,
  seed: number,
  col?: string,
): void {
  g.fillStyle = col || 'rgba(60,30,20,0.45)';
  for (let i = 0; i < n; i += 1) {
    g.fillRect(x0 + hash(seed, i, 7) * w, y0 + hash(seed, i, 8) * h, 3, 2.5);
  }
}

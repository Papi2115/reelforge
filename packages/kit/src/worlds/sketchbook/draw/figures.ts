/**
 * Stick people of the Sketchbook story pages (deliberately crude: a loop head, a bent body line,
 * stick limbs with little feet, a face that reacts). The pose and the expression are pure
 * functions of t, redrawn on twelves; the figure is drawn by the hand in the order a person draws
 * one (head, body, legs, arms, eyes, mouth, brows) with uneven pauses.
 */
import { strokeMark, type Mark, type Shape, type ToolName } from './marks.js';
import { rnd } from './math.js';
import { ellipsePts, type Point, type Pts } from './paths.js';

export interface Pose {
  /** Body lean (degrees, + = forward/right). */
  readonly lean: number;
  /** Head tilt on top of the lean (degrees). */
  readonly head: number;
  /** Where the face looks sideways (-1 left .. 1 right). */
  readonly turn: number;
  /** Where the face looks vertically (-1 up .. 1 down). */
  readonly look: number;
  /** [upper, lower] limb angles (degrees; 0 = down, 90 = right, 180 = up). */
  readonly armL: readonly [number, number];
  readonly armR: readonly [number, number];
  readonly legL: readonly [number, number];
  readonly legR: readonly [number, number];
  /** Hip offset in figure heights. */
  readonly hip: readonly [number, number];
}

export const DEFAULT_POSE: Pose = {
  lean: 0,
  head: 0,
  turn: 0,
  look: 0,
  armL: [-20, -10],
  armR: [20, 10],
  legL: [-12, -4],
  legR: [12, 4],
  hip: [0, 0],
};

export const EYES = ['dot', 'closed', 'wide'] as const;
export const MOUTHS = ['smile', 'o', 'flat', 'frown', 'grin', 'tongue'] as const;

export interface Expression {
  readonly eyes: (typeof EYES)[number];
  /** Closed eyes curve up (smug, happy) instead of down (asleep). */
  readonly happy: boolean;
  readonly mouth: (typeof MOUTHS)[number];
  /** Brow tilt: + frown (inner ends down), - worried/raised. */
  readonly brow: number;
}

export const DEFAULT_EXPRESSION: Expression = {
  eyes: 'dot',
  happy: false,
  mouth: 'smile',
  brow: 0,
};

export type Limb = readonly [Point, Point, Point];

export interface Skeleton {
  readonly hip: Point;
  readonly neck: Point;
  readonly head: Point;
  /** Head radius (page px). */
  readonly headRadius: number;
  readonly shoulder: Point;
  readonly armL: Limb;
  readonly armR: Limb;
  readonly legL: Limb;
  readonly legR: Limb;
  readonly turn: number;
  readonly look: number;
  /** Head angle (lean + head tilt, degrees). */
  readonly headAngle: number;
}

export const JOINT_NAMES = [
  'head',
  'neck',
  'shoulder',
  'hip',
  'elbowL',
  'handL',
  'elbowR',
  'handR',
  'kneeL',
  'footL',
  'kneeR',
  'footR',
] as const;
export type JointName = (typeof JOINT_NAMES)[number];

const rad = (deg: number): number => (deg * Math.PI) / 180;
/** Direction vector: 0 = down, 90 = right, 180 = up. */
const dir = (deg: number, length: number): Point => [
  Math.sin(rad(deg)) * length,
  Math.cos(rad(deg)) * length,
];

export interface FigurePlacement {
  /** Feet at (x, y) on the ground line; h = figure height (page px). */
  readonly x: number;
  readonly y: number;
  readonly h: number;
}

export function skeleton(place: FigurePlacement, pose: Pose): Skeleton {
  const { h } = place;
  const hip: Point = [place.x + pose.hip[0] * h, place.y - 0.47 * h + pose.hip[1] * h];
  const nb = dir(180 + pose.lean, 0.3 * h);
  const neck: Point = [hip[0] + nb[0], hip[1] + nb[1]];
  const headRadius = 0.115 * h;
  const hb = dir(180 + pose.lean + pose.head, headRadius * 1.08);
  const head: Point = [neck[0] + hb[0], neck[1] + hb[1]];
  const shoulder: Point = [
    neck[0] + (hip[0] - neck[0]) * 0.13,
    neck[1] + (hip[1] - neck[1]) * 0.13,
  ];
  const limb = (
    root: Point,
    angles: readonly [number, number],
    upper: number,
    lower: number,
  ): Limb => {
    const e1 = dir(angles[0], upper);
    const joint: Point = [root[0] + e1[0], root[1] + e1[1]];
    const e2 = dir(angles[1], lower);
    return [root, joint, [joint[0] + e2[0], joint[1] + e2[1]]];
  };
  return {
    hip,
    neck,
    head,
    headRadius,
    shoulder,
    armL: limb(shoulder, pose.armL, 0.17 * h, 0.16 * h),
    armR: limb(shoulder, pose.armR, 0.17 * h, 0.16 * h),
    legL: limb(hip, pose.legL, 0.245 * h, 0.235 * h),
    legR: limb(hip, pose.legR, 0.245 * h, 0.235 * h),
    turn: pose.turn,
    look: pose.look,
    headAngle: pose.lean + pose.head,
  };
}

export function jointOf(sk: Skeleton, name: JointName): Point {
  switch (name) {
    case 'head':
    case 'neck':
    case 'shoulder':
    case 'hip':
      return sk[name];
    case 'elbowL':
      return sk.armL[1];
    case 'handL':
      return sk.armL[2];
    case 'elbowR':
      return sk.armR[1];
    case 'handR':
      return sk.armR[2];
    case 'kneeL':
      return sk.legL[1];
    case 'footL':
      return sk.legL[2];
    case 'kneeR':
      return sk.legR[1];
    case 'footR':
      return sk.legR[2];
  }
}

const flat = (...points: readonly Point[]): Pts => points.flatMap((point) => [point[0], point[1]]);

export interface FigureSpec extends FigurePlacement {
  readonly t0: number;
  readonly seed: number;
  readonly tool: ToolName;
  readonly fps: number;
  /** Belly bulge of the body line (page px). */
  readonly belly: number;
  readonly brows: boolean;
  readonly pose: (t: number) => Pose;
  readonly expression: (t: number) => Expression;
}

function eyeShape(sk: Skeleton, e: Expression, side: number): Shape {
  const k = sk.headRadius;
  const cx = sk.head[0] + sk.turn * k * 0.38 + side * k * 0.34;
  const cy = sk.head[1] - k * 0.12 + sk.look * k * 0.25;
  if (e.eyes === 'closed')
    return {
      pts: [cx - k * 0.2, cy, cx, cy + k * 0.13 * (e.happy ? -1 : 1), cx + k * 0.2, cy],
      corners: null,
    };
  if (e.eyes === 'wide') return { pts: ellipsePts(cx, cy, k * 0.14, k * 0.17, 7), corners: null };
  return { pts: [cx, cy - k * 0.1, cx + 0.3, cy + k * 0.12], corners: null };
}

function mouthShape(sk: Skeleton, e: Expression): Pts {
  const k = sk.headRadius;
  const cx = sk.head[0] + sk.turn * k * 0.42;
  const cy = sk.head[1] + k * 0.42 + sk.look * k * 0.12;
  switch (e.mouth) {
    case 'o':
      return [...ellipsePts(cx, cy, k * 0.13, k * 0.16, 8), cx + k * 0.13, cy];
    case 'flat':
      return [cx - k * 0.22, cy + 1, cx + k * 0.24, cy];
    case 'frown':
      return [cx - k * 0.24, cy + k * 0.1, cx, cy - k * 0.04, cx + k * 0.24, cy + k * 0.1];
    case 'grin':
      return [
        cx - k * 0.32,
        cy - k * 0.1,
        cx - k * 0.05,
        cy + k * 0.16,
        cx + k * 0.32,
        cy - k * 0.12,
      ];
    case 'tongue':
      return [
        cx - k * 0.26,
        cy,
        cx + k * 0.22,
        cy - k * 0.03,
        cx + k * 0.16,
        cy + k * 0.2,
        cx + k * 0.06,
        cy + 1,
      ];
    case 'smile':
      return [cx - k * 0.26, cy - k * 0.04, cx, cy + k * 0.12, cx + k * 0.26, cy - k * 0.06];
  }
}

/** The figure as marks (body, then face); returns them and the time the last one ends. */
export function figureMarks(spec: FigureSpec): { readonly marks: Mark[]; readonly end: number } {
  const marks: Mark[] = [];
  const sk = (t: number): Skeleton => skeleton(spec, spec.pose(t));
  let t = spec.t0;
  const add = (source: (t: number) => Shape, dur: number, tool: ToolName, width?: number): void => {
    marks.push(
      strokeMark([], {
        source,
        t0: t,
        dur,
        seed: spec.seed + marks.length * 17,
        tool,
        width,
        fps: spec.fps,
      }),
    );
  };
  const body = (
    dur: number,
    source: (s: Skeleton) => Pts,
    corners: readonly boolean[] | null = null,
  ): void => {
    add((tt) => ({ pts: source(sk(tt)), corners }), dur, spec.tool);
    t += dur + rnd(0.03, 0.11, spec.seed, marks.length, 1);
  };
  const turnStart = rad(100 + (spec.seed % 40));
  // Head: one loop from the chin side, overlapping itself.
  body(0.24, (s) => {
    const loop = ellipsePts(
      s.head[0],
      s.head[1],
      s.headRadius,
      s.headRadius * 1.04,
      15,
      0,
      turnStart,
    );
    loop.push((loop[0] ?? 0) + 2, (loop[1] ?? 0) - 1);
    return loop;
  });
  body(0.13, (s) => {
    const top: Point = [
      s.head[0] + (s.neck[0] - s.head[0]) * 0.92,
      s.head[1] + (s.neck[1] - s.head[1]) * 0.92,
    ];
    const mid: Point = [(top[0] + s.hip[0]) / 2 + spec.belly, (top[1] + s.hip[1]) / 2];
    return flat(top, mid, s.hip);
  });
  const foot = (leg: Limb, side: number): Point => [leg[2][0] + side * 7, leg[2][1] + 0.5];
  body(0.15, (s) => flat(...s.legL, foot(s.legL, -1)), [false, true, true, false]);
  body(0.14, (s) => flat(...s.legR, foot(s.legR, 1)), [false, true, true, false]);
  body(0.13, (s) => flat(...s.armL), [false, true, false]);
  body(0.13, (s) => flat(...s.armR), [false, true, false]);
  // Face: eyes look where the figure looks, mouth and brows per expression.
  const fine: ToolName = spec.tool === 'felt' ? 'fine' : spec.tool;
  add((tt) => eyeShape(sk(tt), spec.expression(tt), -1), 0.05, fine, 2);
  t += 0.09;
  add((tt) => eyeShape(sk(tt), spec.expression(tt), 1), 0.05, fine, 2);
  t += 0.1;
  add((tt) => ({ pts: mouthShape(sk(tt), spec.expression(tt)), corners: null }), 0.1, fine, 1);
  t += 0.12;
  if (spec.brows) {
    for (const side of [-1, 1]) {
      add(
        (tt) => {
          const s = sk(tt);
          const k = s.headRadius;
          const cx = s.head[0] + s.turn * k * 0.38 + side * k * 0.34;
          const cy = s.head[1] - k * 0.42 + s.look * k * 0.2;
          const tilt = spec.expression(tt).brow * side * k * 0.12;
          return { pts: [cx - k * 0.17, cy - tilt, cx + k * 0.17, cy + tilt], corners: null };
        },
        0.05,
        fine,
        1,
      );
      t += 0.07;
    }
  }
  return { marks, end: t + 0.02 };
}

/**
 * C-CAM gags (PLAN.md#14.9), part 2: what each gag kind does at phase `u` (gags.ts). Hand targets
 * are body space (`handAt` units: arm lengths from the shoulder), eased from the pose's own hand
 * so a gag never snaps; marks are flat ink (gag-props.ts) on twos. The face guard of the rig still
 * applies: a hand that goes to the head ends beside it, never across the face.
 *
 * Public API: `GagContext`, `gagFrame`, `gagSeed`.
 */
import { ANIM, C, ease, hash, seg, twos } from '../core.js';
import type { RigDims } from './character.js';
import { bump, type FaceSpots, type GagFrame, type GagKind, type ResolvedGag } from './gags.js';
import {
  checklist,
  gumBubble,
  helmet,
  mug,
  puff,
  sandwich,
  sweat,
  thumbsUp,
  ticks,
  watch,
} from './gag-props.js';
import type { BrushEnv } from './brushes.js';
import type { ArmSide } from './figure.js';
import type { HandKind } from './hand.js';
import type { Paint2D } from './paint.js';
import { handAt, type Pose, type Vec3 } from './poses.js';
import { palm } from './rig-ik.js';
import type { LimbRig } from './rig-layers.js';
import { blob, ellipseRing, tube } from './shapes.js';

/** Everything a gag reads at one moment. */
export interface GagContext {
  readonly gag: ResolvedGag;
  /** Phase in [0, 1) (gagPhase). */
  readonly u: number;
  /** Shot time (s). */
  readonly t: number;
  readonly D: RigDims;
  readonly P: Pose;
  /** Colours of the hand (the arm style's skin / glove). */
  readonly skin: string;
  readonly skinD: string;
  /** Ink seed of this gag on this person. */
  readonly seed: number;
}

type Spot = readonly [out: number, down: number, fwd: number];

/** Where the acting hand goes (`handAt(D, sgn, out, down, fwd)`). */
const SPOT = {
  mouth: [-0.4, -0.09, 0.42],
  chin: [-0.36, -0.04, 0.42],
  chest: [-0.3, 0.45, 0.45],
  belt: [-0.35, 0.75, 0.5],
  headSide: [0.05, -0.75, 0.05],
  brow: [-0.05, -0.62, 0.3],
  collar: [-0.3, 0.02, 0.3],
  watch: [-0.45, 0.32, 0.55],
  thumbs: [0.3, -0.7, 0.2],
} as const satisfies Readonly<Record<string, Spot>>;

const sgnOf = (side: ArmSide): 1 | -1 => (side === 'L' ? 1 : -1);
const frame = (t: number): number => Math.round(twos(t) * ANIM);
const armLen = (D: RigDims): number => D.l1a + D.l2a;

/** The acting hand eased from its pose target toward `spot` (+ a body-space nudge) by w. */
function reach(c: GagContext, spot: Spot, w: number, nudge: Vec3 = [0, 0, 0]): GagFrame {
  const side = c.gag.hand;
  const own = side === 'L' ? c.P.hL : c.P.hR;
  const to = handAt(c.D, sgnOf(side), spot[0], spot[1], spot[2]);
  const T: Vec3 = [
    own[0] + (to[0] + nudge[0] - own[0]) * w,
    own[1] + (to[1] + nudge[1] - own[1]) * w,
    own[2] + (to[2] + nudge[2] - own[2]) * w,
  ];
  return side === 'L' ? { hL: T } : { hR: T };
}

const handOf = (side: ArmSide, kind: HandKind | 'none') =>
  side === 'L' ? { L: kind } : { R: kind };

/** A held object drawn at the palm of the acting hand, scaled with the hand. */
type ArmMark = NonNullable<GagFrame['beforeArm']>;

function held(c: GagContext, draw: (g: Paint2D, env: BrushEnv) => void): ArmMark {
  return (g, env, side, j) => {
    if (side !== c.gag.hand) return;
    const [x, y] = palm(j, c.D.hsz);
    const k = c.D.hsz / 40;
    g.save();
    g.translate(x, y);
    g.scale(k, k);
    draw(g, env);
    g.restore();
  };
}

function sip(c: GagContext): GagFrame {
  const w = bump(c.u, 0.3, 0.45, 0.75, 0.9);
  const tilt = -40 * bump(c.u, 0.45, 0.55, 0.7, 0.78);
  const steam = w < 0.05 ? Math.floor(twos(c.t) * 3) % 2 : 0;
  return {
    ...reach(c, SPOT.mouth, w),
    hands: handOf(c.gag.hand, 'grip'),
    ...(w > 0.5 ? { front: c.gag.hand } : {}),
    beforeArm: held(c, (g, env) => {
      mug(g, env, 6, -4, tilt, c.seed, steam);
    }),
  };
}

function eat(c: GagContext): GagFrame {
  const w = bump(c.u, 0.3, 0.45, 0.55, 0.7);
  const bitten = c.u > 0.5;
  return {
    ...reach(c, SPOT.mouth, w),
    hands: handOf(c.gag.hand, 'grip'),
    ...(w > 0.5 ? { front: c.gag.hand } : {}),
    beforeArm: held(c, (g, env) => {
      sandwich(g, env, 0, -16, -10, c.seed, bitten);
    }),
  };
}

function thumbs(c: GagContext): GagFrame {
  const w = bump(c.u, 0.05, 0.2, 0.8, 0.95);
  const pump = w > 0.99 && frame(c.t) % 4 >= 2 ? -0.03 * armLen(c.D) : 0;
  const up = w > 0.5;
  return {
    ...reach(c, SPOT.thumbs, w, [0, pump, 0]),
    ...(up ? { hands: handOf(c.gag.hand, 'none') } : {}),
    afterArm: (g, env, side, j) => {
      if (up && side === c.gag.hand) {
        thumbsUp(g, env, j.h[0], j.h[1], c.D.hsz, c.skin, c.skinD, c.seed + 84);
      }
    },
  };
}

function readChecklist(c: GagContext): GagFrame {
  const A = armLen(c.D);
  const at = (sgn: number): Vec3 => [
    sgn * Math.min(42, c.D.sw * 0.7),
    c.D.sy + 0.68 * A,
    (c.D.sz || 0) + 0.5 * A,
  ];
  const page = c.u >= 0.6 && c.u < 0.85 ? ease.inOut(seg(c.u, 0.6, 0.85)) : 0;
  return {
    hL: at(1),
    hR: at(-1),
    hands: { L: 'grip', R: 'grip' },
    beforeHand: (g, env, J, view) => {
      if (view === 3) return;
      const x = (J.aL.h[0] + J.aR.h[0]) / 2;
      const y = (J.aL.h[1] + J.aR.h[1]) / 2 + 30;
      checklist(g, env, x, y, c.D.hsz * 4.4, page, c.seed + 60);
    },
  };
}

function headMarks(c: GagContext): GagFrame {
  if (c.gag.kind === 'gum') {
    const r = ease.out(seg(c.u, 0.25, 0.7));
    return {
      afterHead: (g, env, _view, s) => {
        if (c.u < 0.7) gumBubble(g, env, s.mouth[0] + 4, s.mouth[1] + 2, r * s.rx * 0.55, c.seed);
        else if (c.u < 0.78) ticks(g, env, s.mouth[0] + 8, s.mouth[1], s.rx * 0.3, 90, c.seed);
      },
    };
  }
  if (c.gag.kind === 'sweat') {
    return {
      afterHead: (g, env, view, s) => {
        if (view === 3) return;
        const pts: [number, number][] = [[s.forehead[0], s.forehead[1] + 8]];
        pts.push([s.cheek[0], s.cheek[1] - 12]);
        if (view < 2) pts.push([2 * s.centre[0] - s.cheek[0], s.cheek[1] - 6]);
        sweat(g, env, pts, c.t, c.seed + 53);
      },
    };
  }
  const visor = c.gag.visor;
  return {
    afterHead: (g, env, view, s) => {
      const vx = [0, 14, 26, 0][view] ?? 0;
      const o = { visor, vx, seed: c.seed + 61 };
      helmet(g, env, s.centre[0] + vx * 0.15, s.centre[1], s.rx * 1.28, s.ry * 1.08, o);
    },
  };
}

function breath(c: GagContext, k: number, at: (s: FaceSpots) => readonly [number, number]) {
  return (g: Paint2D, env: BrushEnv, view: number, s: FaceSpots): void => {
    if (view === 3) return;
    const [x, y] = at(s);
    puff(g, env, x + 6, y, k, c.seed + 70);
  };
}

function face(c: GagContext): GagFrame {
  const { u } = c;
  if (c.gag.kind === 'glance') {
    if (u >= 0.15 && u < 0.35) return { look: [-0.9, 0.1] };
    if (u >= 0.45 && u < 0.65) return { look: [0.9, 0.1] };
    return {};
  }
  if (c.gag.kind === 'yawn') {
    const w = bump(u, 0.25, 0.4, 0.6, 0.75);
    if (w <= 0) return {};
    return { expr: w > 0.5 ? 'asleep' : 'exhausted', headDy: -6 * w };
  }
  const w = bump(u, 0.3, 0.45, 0.6, 0.8);
  return {
    headDy: 8 * w,
    ...(w > 0.3 ? { expr: 'miserable' as const } : {}),
    afterHead: breath(c, seg(u, 0.45, 0.85), (s) => s.mouth),
  };
}

function cough(c: GagContext): GagFrame {
  const w = bump(c.u, 0.2, 0.3, 0.6, 0.7);
  const jolt = c.u >= 0.32 && c.u < 0.58 && frame(c.t) % 3 === 0;
  return {
    ...reach(c, SPOT.chin, w),
    hands: handOf(c.gag.hand, 'fist'),
    ...(w > 0.5 ? { front: c.gag.hand } : {}),
    ...(jolt ? { headDy: 6 } : {}),
    afterHead: breath(c, jolt ? 0.3 : 0, (s) => s.mouth),
  };
}

function hands(c: GagContext): GagFrame {
  const side = c.gag.hand;
  const f = frame(c.t);
  const A = armLen(c.D);
  const out = sgnOf(side);
  const mine = (s: ArmSide): boolean => s === side;
  const at = (j: LimbRig): readonly [number, number] => palm(j, c.D.hsz);
  const kind: GagKind = c.gag.kind;
  if (kind === 'fidget') {
    const w = bump(c.u, 0.1, 0.2, 0.8, 0.9);
    const tap = w > 0.99 && f % 2 === 0;
    return {
      ...reach(c, SPOT.belt, w),
      hands: handOf(side, tap ? 'point' : 'fist'),
      afterArm: (g, env, s, j) => {
        if (tap && mine(s)) ticks(g, env, at(j)[0], at(j)[1], c.D.hsz, 180, c.seed + 90);
      },
    };
  }
  if (kind === 'scratchHead') {
    const w = bump(c.u, 0.1, 0.25, 0.75, 0.9);
    const jitter = w > 0.99 ? (f % 2 ? 0.03 : -0.03) * A : 0;
    return {
      ...reach(c, SPOT.headSide, w, [0, jitter, 0]),
      hands: handOf(side, 'grip'),
      ...(w > 0.5 ? { expr: 'confused' as const } : {}),
    };
  }
  if (kind === 'clockCheck') {
    const w = bump(c.u, 0.15, 0.3, 0.7, 0.85);
    return {
      ...reach(c, SPOT.watch, w),
      ...(w > 0.5 ? { front: side, look: [0, 0.8] as const } : {}),
      afterArm: (g, env, s, j) => {
        if (mine(s)) watch(g, env, j.h[0], j.h[1], c.D.hsz * 0.24, c.t, c.seed + 95);
      },
    };
  }
  if (kind === 'tugCollar') {
    const w = bump(c.u, 0.15, 0.3, 0.7, 0.85);
    const tug = w > 0.99 && f % 2 ? 0.04 * A * out : 0;
    return { ...reach(c, SPOT.collar, w, [tug, 0, 0]), hands: handOf(side, 'grip') };
  }
  if (kind === 'wipeBrow') {
    const w = bump(c.u, 0.15, 0.3, 0.55, 0.7);
    const sweep = (seg(c.u, 0.3, 0.55) - 0.5) * 0.3 * A * out;
    const fling = seg(c.u, 0.55, 0.75);
    return {
      ...reach(c, SPOT.brow, w, [sweep, 0, 0]),
      hands: handOf(side, 'flat'),
      afterArm: (g, env, s, j) => {
        if (!mine(s) || fling <= 0 || fling >= 1) return;
        const [x, y] = at(j);
        const d = c.D.hsz * (0.6 + 2 * fling);
        sweat(g, env, [[x - d, y - d * 0.2 + 30 * fling * fling]], 0, c.seed + 97);
      },
    };
  }
  const w = bump(c.u, 0.05, 0.15, 0.85, 0.95);
  const click = w > 0.99 && f % 4 === 0;
  const pen = (g: Paint2D, env: BrushEnv): void => {
    tube(g, env, [0, 26, 0, -80], [10, 9], C.INK, { lw: 3, seed: c.seed + 98 });
    const top = ellipseRing(0, click ? -80 : -88, 6, 7, 6);
    blob(g, env, top, C.STONE, { lw: 3, seed: c.seed + 99 });
    if (click) ticks(g, env, 0, -96, 14, 0, c.seed + 100);
  };
  return { ...reach(c, SPOT.chest, w), hands: handOf(side, 'grip'), beforeArm: held(c, pen) };
}

/** The gag's frame at its phase (see `GAG_DOCS` for what each kind does). */
export function gagFrame(c: GagContext): GagFrame {
  switch (c.gag.kind) {
    case 'sip':
      return sip(c);
    case 'eat':
      return eat(c);
    case 'thumbs':
      return thumbs(c);
    case 'checklist':
      return readChecklist(c);
    case 'gum':
    case 'sweat':
    case 'helmet':
      return headMarks(c);
    case 'glance':
    case 'yawn':
    case 'sighPuff':
      return face(c);
    case 'cough':
      return cough(c);
    default:
      return hands(c);
  }
}

/** Ink seed of gag `gag` on a person with seed `personSeed` (stable, distinct per gag). */
export function gagSeed(personSeed: number, gag: ResolvedGag): number {
  return personSeed + 700 + Math.floor(hash(gag.seed, 17) * 50);
}

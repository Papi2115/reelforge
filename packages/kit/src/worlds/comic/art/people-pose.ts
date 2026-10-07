/**
 * The skeleton of a comic figure (art.person, PLAN.md#13.15a): joint positions for each pose in
 * model units (100 tall, feet at y = 0, facing right), animated by time for walk and run. Far
 * limbs are listed first (drawn behind the body), near limbs second.
 */

export const POSES = [
  'stand',
  'walk',
  'run',
  'point',
  'hold',
  'slump',
  'look-up',
  'wave',
  'sit',
] as const;
export type Pose = (typeof POSES)[number];

export const BUILDS = ['average', 'slim', 'broad', 'child', 'elder'] as const;
export type Build = (typeof BUILDS)[number];

export type Pt = readonly [number, number];

export interface Limb {
  readonly root: Pt;
  readonly mid: Pt;
  readonly end: Pt;
}

export interface Skeleton {
  readonly hip: Pt;
  readonly neck: Pt;
  readonly head: Pt;
  /** Head turn: positive = chin up (look-up), negative = down (slump). */
  readonly chin: number;
  readonly arms: readonly [Limb, Limb];
  readonly legs: readonly [Limb, Limb];
}

export interface Proportions {
  readonly headR: number;
  readonly shoulder: number;
  readonly hipW: number;
  readonly limbR: number;
  /** Height scale of the whole figure (a child is shorter). */
  readonly scale: number;
}

export const PROPORTIONS: Readonly<Record<Build, Proportions>> = {
  average: { headR: 9, shoulder: 11, hipW: 8, limbR: 3.4, scale: 1 },
  slim: { headR: 8.6, shoulder: 9, hipW: 6.5, limbR: 2.8, scale: 1.03 },
  broad: { headR: 9.4, shoulder: 15, hipW: 11, limbR: 4.4, scale: 1 },
  child: { headR: 11.5, shoulder: 9, hipW: 7, limbR: 3, scale: 0.7 },
  elder: { headR: 9, shoulder: 10.5, hipW: 8.5, limbR: 3.2, scale: 0.96 },
};

const HIP_Y = -47;
const NECK_Y = -79;

function limb(root: Pt, mid: Pt, end: Pt): Limb {
  return { root, mid, end };
}

/** Two-segment leg from the hip to a foot, the knee bent forward by `bend`. */
function leg(hip: Pt, foot: Pt, bend: number): Limb {
  const mx = (hip[0] + foot[0]) / 2 + bend;
  const my = (hip[1] + foot[1]) / 2;
  return limb(hip, [mx, my], foot);
}

function arm(shoulder: Pt, elbow: Pt, hand: Pt): Limb {
  return limb(shoulder, elbow, hand);
}

function skeleton(
  lean: number,
  bob: number,
  arms: (sh: Pt) => [Limb, Limb],
  legs: (hip: Pt) => [Limb, Limb],
  chin = 0,
): Skeleton {
  const hip: Pt = [0, HIP_Y + bob];
  const neck: Pt = [lean, NECK_Y + bob];
  const head: Pt = [lean * 1.15 + chin * 1.5, NECK_Y - 11 + bob + Math.min(0, chin) * -2];
  const shoulder: Pt = [lean * 0.92, NECK_Y + 3 + bob];
  return { hip, neck, head, chin, arms: arms(shoulder), legs: legs(hip) };
}

/** Joint positions of a pose at time t (walk and run cycle; the others are still). */
export function poseSkeleton(pose: Pose, t: number, speed: number): Skeleton {
  const phase = t * speed * Math.PI * 2;
  const s = Math.sin(phase);
  const lift = (sign: number) => -Math.max(0, Math.cos(phase) * sign) * 5;
  switch (pose) {
    case 'walk':
      return skeleton(
        1.5,
        -Math.abs(Math.cos(phase)) * 1.6,
        (sh) => [
          arm(sh, [sh[0] + 6 * s, -63], [sh[0] + 10 * s, -50]),
          arm(sh, [sh[0] - 6 * s, -63], [sh[0] - 10 * s + 1, -50]),
        ],
        (hip) => [leg(hip, [-13 * s, lift(-1)], 3), leg(hip, [13 * s, lift(1)], 3)],
      );
    case 'run':
      return skeleton(
        8,
        -Math.abs(Math.cos(phase)) * 3,
        (sh) => [
          arm(sh, [sh[0] + 9 * s - 2, -66], [sh[0] + 16 * s + 4, -72]),
          arm(sh, [sh[0] - 9 * s - 2, -66], [sh[0] - 16 * s + 4, -72]),
        ],
        (hip) => [
          leg(hip, [-22 * s, Math.min(0, -12 * Math.cos(phase))], 9),
          leg(hip, [22 * s, Math.min(0, 12 * Math.cos(phase))], 9),
        ],
      );
    case 'point':
      return skeleton(
        1,
        0,
        (sh) => [
          arm(sh, [sh[0] - 4, -63], [sh[0] - 4, -50]),
          arm(sh, [sh[0] + 13, -78], [sh[0] + 28, -84]),
        ],
        (hip) => [leg(hip, [-6, 0], 1), leg(hip, [9, 0], 2)],
        1,
      );
    case 'hold':
      return skeleton(
        0.5,
        0,
        (sh) => [
          arm(sh, [sh[0] + 4, -61], [sh[0] + 14, -63]),
          arm(sh, [sh[0] + 6, -61], [sh[0] + 17, -64]),
        ],
        (hip) => [leg(hip, [-5, 0], 1), leg(hip, [6, 0], 1)],
      );
    case 'slump':
      return skeleton(
        6,
        2.5,
        (sh) => [
          arm(sh, [sh[0] + 2, -58], [sh[0] + 4, -44]),
          arm(sh, [sh[0] + 4, -58], [sh[0] + 7, -44]),
        ],
        (hip) => [leg(hip, [-4, 0], 5), leg(hip, [6, 0], 5)],
        -2,
      );
    case 'look-up':
      return skeleton(
        -2,
        0,
        (sh) => [
          arm(sh, [sh[0] - 5, -63], [sh[0] - 6, -50]),
          arm(sh, [sh[0] + 12, -72], [sh[0] + 9, -92]),
        ],
        (hip) => [leg(hip, [-6, 0], 1), leg(hip, [7, 0], 1)],
        3,
      );
    case 'wave': {
      const w = Math.sin(t * 9) * 5;
      return skeleton(
        0,
        0,
        (sh) => [
          arm(sh, [sh[0] - 5, -63], [sh[0] - 6, -50]),
          arm(sh, [sh[0] + 13, -84], [sh[0] + 12 + w, -102]),
        ],
        (hip) => [leg(hip, [-6, 0], 1), leg(hip, [7, 0], 1)],
        1,
      );
    }
    case 'sit':
      return skeleton(
        1,
        19,
        (sh) => [
          arm(sh, [sh[0] + 3, -42], [sh[0] + 13, -36]),
          arm(sh, [sh[0] + 5, -42], [sh[0] + 16, -37]),
        ],
        (hip) => [
          limb(hip, [hip[0] + 19, hip[1] - 1], [hip[0] + 19, 0]),
          limb(hip, [hip[0] + 22, hip[1] - 1], [hip[0] + 23, 0]),
        ],
      );
    case 'stand':
      return skeleton(
        0,
        0,
        (sh) => [
          arm(sh, [sh[0] - 6, -63], [sh[0] - 7, -50]),
          arm(sh, [sh[0] + 6, -63], [sh[0] + 8, -50]),
        ],
        (hip) => [leg(hip, [-5, 0], 1), leg(hip, [6, 0], 1)],
      );
  }
}

/**
 * Validator thresholds and the test grid, each taken from the c-plus suite
 * (`docs/concepts/styles7/20-cplus-engine/js/validate*.js`, `CHARACTER_CONTRACT.md`,
 * `proof/validate.log`) unless marked C-CAM.
 *
 * Public API: `THRESHOLDS`, `VALIDATE_YAWS`, `TEST_POSES`, `TEST_SWEEPS`, `SWEEP_FRAMES`,
 * `HANDSHAKE_YAWS`, `HANDSHAKE_SCALES`, `HANDSHAKE_DISTANCES`, `HANDSHAKE_OFFER`.
 */
import { pose, type PoseName } from '../draw/poses.js';
import type { PoseCase, SweepCase } from './types.js';

export const THRESHOLDS = {
  /** Default `D.neckGap`: shoulders sit at least this far below the chin (px; c-plus `CHARACTER_CONTRACT.md` §1). */
  neckGap: 6,
  /** A face anchor may sit at most this far off the head ink (px; c-plus face-contact palm tolerance, `validate.js:46`). */
  faceAnchorPx: 4,
  /** Connectivity: ink pieces smaller than this are ignored (px; `validate-raster.js:111,126`). */
  minPiecePx: 6,
  /** Connectivity: enclosed gaps smaller than this are slivers between strokes, not holes (px; `validate-raster.js:126`). */
  minHolePx: 20,
  /** Whole figures are rasterized this tall (px; `validate-raster.js:103`, s = 520 / -D.top). */
  figureHeightPx: 520,
  /** Palm radius for the head-box test, in hand sizes (`validate.js:32`). */
  palmRadius: 0.35,
  /** The face box an arm in front must not cross is the head box shrunk by this share per side (`validate.js:42`). */
  faceInset: 0.15,
  /** A pose target may overshoot the arm by this share of its length (`validate.js:41`). */
  reachOvershoot: 0.08,
  /** Elbow flip: |cross(shoulder->wrist, shoulder->elbow)| must exceed this share of len^2 on both frames (`validate.js:69`). */
  flipBend: 0.12,
  /** Elbow flip: the wrist moved less than this share of the arm between the frames (`validate.js:70`). */
  flipHandMove: 0.5,
  /** Contact: solved palms / palm and goal at most this far apart (world px; `validate.js:98`). */
  contactPx: 4,
  /** Contact: a goal counts as reachable within this share of the arm (`ST.meet` slides beyond 0.9, `contact.js:69`) ... */
  reachShare: 0.9,
  /** ... plus this many hand sizes (`validate.js:60`). */
  reachHand: 0.5,
  /** A handshake point stays this many hand sizes below both chins (`contact.js:62`). */
  handshakeBelowChin: 1.2,
} as const;

/** Every view, plain and mirrored (c-plus `V.YAWS`). */
export const VALIDATE_YAWS: readonly number[] = [0, 1, 2, 3, -2, -1];

const fromLibrary = (name: string, poseName: PoseName, ph = 0): PoseCase => ({
  name,
  pose: (D) => pose(poseName, D, ph),
});

/**
 * The static pose grid (c-plus `ST.TEST_POSES` mapped onto the C-CAM pose library: no fold, hug,
 * crouch or face-touch poses exist in C-CAM; clasp, slump and stomp are added).
 */
export const TEST_POSES: readonly PoseCase[] = [
  fromLibrary('stand', 'stand'),
  fromLibrary('akimbo', 'akimbo'),
  fromLibrary('clasp', 'clasp'),
  fromLibrary('point L', 'point', 1),
  fromLibrary('point R', 'point', -1),
  fromLibrary('armsUp', 'armsUp'),
  fromLibrary('slump', 'slump'),
  fromLibrary('jig', 'jig', 0.25),
  fromLibrary('stomp', 'stomp', 0.25),
  fromLibrary('flail', 'flail', 0.25),
  fromLibrary('flail 2', 'flail', 0.75),
  fromLibrary('walk', 'walk', 0.3),
];

/** Phase-driven poses swept frame by frame (c-plus: jig, flail, walk, throw, stomp; C-CAM has no throw). */
export const TEST_SWEEPS: readonly SweepCase[] = (['jig', 'flail', 'walk', 'stomp'] as const).map(
  (name) => ({ name, pose: (D, ph) => pose(name, D, ph) }),
);

/** Frames per sweep (phases i / SWEEP_FRAMES, i = 0..SWEEP_FRAMES; `validate.js:65`). */
export const SWEEP_FRAMES = 24;

/** Handshake set-ups (`validate.js:84`): yaw pairs, scale pairs, feet distances (px). */
export const HANDSHAKE_YAWS: readonly (readonly [number, number])[] = [
  [1, -1],
  [2, -2],
  [1, -2],
  [0, -1],
];
export const HANDSHAKE_SCALES: readonly (readonly [number, number])[] = [
  [1, 1],
  [0.6, 0.6],
  [1.4, 1.3],
  [0.9, 1.1],
  [0.6, 1.4],
];
export const HANDSHAKE_DISTANCES: readonly number[] = [260, 420];

/** Where a free hand is offered `[out, down, fwd]` in arm lengths (`contact.js:48`). */
export const HANDSHAKE_OFFER: readonly [number, number, number] = [-0.15, 0.5, 0.85];

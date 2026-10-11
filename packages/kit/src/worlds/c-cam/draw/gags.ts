/**
 * C-CAM gags (PLAN.md#14.9): small, repeatable micro-acting a person does on top of a pose, the
 * series' character beats (the commander's gum bubble, the pilot's sweat, the director's mug). A
 * gag is a pure function of the shot time: `{ kind, t0, rate, hand, seed }` -> a phase `u` in
 * [0, 1) on twos, and per kind (gag-acts.ts) hand-target overrides, hand shapes, an expression /
 * look / head nod, and flat ink marks drawn through the rig's hooks (figure.ts). Same input -> same
 * strokes; works for any person (it reads `D`, the head box and the optional face anchors).
 *
 * The seven film gags reuse the ported film props (gag-props.ts); the others are generic tics in
 * the same grammar. Rule (docs, prompts): one signature gag per person, 1-2 gags per shot, never
 * decorative: a gag is acting (boredom, nerves, impatience), not ornament.
 *
 * Public API: `GAG_KINDS`, `GagKind`, `GAG_DOCS`, `GAG_PERIOD`, `MAX_GAGS`, `gagSpecSchema`,
 * `GagSpec`, `ResolvedGag`, `gagPhase`, `bump`, `FaceSpots`, `GagFrame`.
 */
import { z } from 'zod';
import { clamp01, ease, twos } from '../core.js';
import type { BrushEnv } from './brushes.js';
import type { ExprName, Pair } from './face.js';
import type { ArmSide, HandOverrides } from './figure.js';
import type { Paint2D } from './paint.js';
import type { Vec3 } from './poses.js';
import type { LimbRig, RigJoints } from './rig-layers.js';
import type { ViewIndex } from './rig-views.js';

/** Every gag kind; the first seven are the Apollo film's, the rest generic tics. */
export const GAG_KINDS = [
  'gum',
  'sweat',
  'sip',
  'eat',
  'thumbs',
  'checklist',
  'helmet',
  'fidget',
  'glance',
  'yawn',
  'scratchHead',
  'sighPuff',
  'cough',
  'clockCheck',
  'tugCollar',
  'wipeBrow',
  'penClick',
] as const;

export type GagKind = (typeof GAG_KINDS)[number];

/** At most this many gags on one person in one draw. */
export const MAX_GAGS = 2;

/** Seconds of one cycle at rate 1. */
export const GAG_PERIOD: Readonly<Record<GagKind, number>> = {
  gum: 4,
  sweat: 1,
  sip: 5,
  eat: 4,
  thumbs: 3,
  checklist: 4,
  helmet: 1,
  fidget: 2,
  glance: 3,
  yawn: 4,
  scratchHead: 3,
  sighPuff: 4,
  cough: 3,
  clockCheck: 4,
  tugCollar: 3,
  wipeBrow: 3,
  penClick: 2,
};

/** One line per gag for the docs: what the person does (hand = the acting hand). */
export const GAG_DOCS: Readonly<Record<GagKind, string>> = {
  gum: 'chews; a gum bubble swells at the lips and pops (bored, cocky)',
  sweat: 'sweat drops drip from the brow and cheeks on twos (fear, heat, pressure)',
  sip: 'holds a coffee mug (steam at rest), raises it to the lips and sips (the hand comes in front)',
  eat: 'holds a sandwich, lifts it and takes a bite (the bite stays)',
  thumbs: 'raises a thumbs-up and pumps it (glove / skin of the arm style)',
  checklist:
    'holds a ring-bound checklist in both hands at the chest and flips a page (not from the back)',
  helmet:
    'wears a bubble helmet; visor: true pulls the gold visor down (a costume state, no cycle)',
  fidget: 'taps a finger at the belt, quick ticks on the tap frames (impatience)',
  glance: 'eyes dart left, then right, then back (suspicion, nerves); no hand',
  yawn: 'head tips back, eyes shut, mouth open (boredom, fatigue); no hand',
  scratchHead: 'hand scratches the side of the head, puzzled brows (confusion)',
  sighPuff: 'head drops, miserable brows, a breath puff leaves the mouth (resignation)',
  cough: 'fist to the mouth, the head jerks twice with small puffs (awkwardness, smoke)',
  clockCheck: 'raises the wrist and looks down at the watch (impatience, deadline)',
  tugCollar: 'hand tugs at the collar (guilt, heat, a lie)',
  wipeBrow: 'hand swipes beside the brow and flicks a drop away (relief, effort)',
  penClick: 'holds a pen at the chest and clicks it on twos (nervous energy)',
};

/** What a scene passes as `gag` (one object or a list of at most `MAX_GAGS`). */
export const gagSpecSchema = z.strictObject({
  kind: z.enum(GAG_KINDS),
  /** Shot time (s) the gag starts; before it the person is still. */
  t0: z.number().min(-1e4).max(1e4).default(0),
  /** Speed multiplier of the cycle (1 = `GAG_PERIOD`). */
  rate: z.number().min(0.25).max(4).default(1),
  /** The acting hand (the character's own left / right). */
  hand: z.enum(['L', 'R']).default('R'),
  /** Ink seed offset (two people with the same gag wobble differently). */
  seed: z.number().int().min(0).max(1e6).default(0),
  /** helmet only: the gold visor down. */
  visor: z.boolean().default(false),
});

export type GagSpec = z.input<typeof gagSpecSchema>;
export type ResolvedGag = z.output<typeof gagSpecSchema>;

/** Phase in [0, 1) of the gag at shot time t (on twos), or undefined before `t0`. */
export function gagPhase(gag: ResolvedGag, t: number): number | undefined {
  const local = twos(t) - gag.t0;
  if (local < 0) return undefined;
  const cycles = (local * gag.rate) / GAG_PERIOD[gag.kind];
  return cycles - Math.floor(cycles);
}

/** 0 before a, eases up to 1 by b, holds to c, eases back to 0 by d. */
export function bump(u: number, a: number, b: number, c: number, d: number): number {
  const up = ease.inOut(clamp01((u - a) / (b - a)));
  const down = ease.inOut(clamp01((u - c) / (d - c)));
  return up * (1 - down);
}

/** Head-local face points of one head view (from `faceAnchors`, else estimated from `D.head`). */
export interface FaceSpots {
  readonly mouth: Pair;
  readonly forehead: Pair;
  readonly cheek: Pair;
  /** Head centre and half extents in head-local px. */
  readonly centre: Pair;
  readonly rx: number;
  readonly ry: number;
}

/** What one gag does at one moment; every field optional. Hooks draw with the figure's env. */
export interface GagFrame {
  /** Body-space hand targets replacing the pose's. */
  readonly hL?: Vec3;
  readonly hR?: Vec3;
  readonly hands?: HandOverrides;
  /** Bring this arm in front of the face (layer 2) unless it is behind the body. */
  readonly front?: ArmSide;
  readonly expr?: ExprName;
  readonly look?: Pair;
  /** Head nod (body px, + down). */
  readonly headDy?: number;
  readonly afterHead?: (g: Paint2D, env: BrushEnv, view: ViewIndex, spots: FaceSpots) => void;
  readonly beforeArm?: (g: Paint2D, env: BrushEnv, side: ArmSide, j: LimbRig) => void;
  readonly afterArm?: (g: Paint2D, env: BrushEnv, side: ArmSide, j: LimbRig) => void;
  readonly beforeHand?: (g: Paint2D, env: BrushEnv, J: RigJoints, view: ViewIndex) => void;
}

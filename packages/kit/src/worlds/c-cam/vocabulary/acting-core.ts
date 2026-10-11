/**
 * Grim Ink acting (PLAN.md#14.20), shared parts: the figure a two-body gag takes (`who` = a person
 * handle `kit.people.<id>` or its `.character`, placed like `person.draw`: x, y, s, view, pose, bow,
 * lean), the cue it gives back for each person (spread it into `person.draw(g, cam.env, { …cue,
 * t: env.t })`), and the contact helpers it solves with (the rig's `reachPalm` / `palmWorld` in
 * world space, before the camera). Nothing here draws; everything is a pure function of the shot
 * time on twos.
 */
import { z } from 'zod';
import { clamp01, ease, twos } from '../core.js';
import type { Character } from '../draw/character.js';
import { anchorWorld, type BodyAnchorName } from '../draw/anchors.js';
import { palmWorld, reachPalm, type HandSide, type Point2 } from '../draw/contact.js';
import type { ExprName, Pair } from '../draw/face.js';
import { resolveView, type FigureView } from '../draw/figure.js';
import { viewState } from '../draw/rig-views.js';
import { handAt, pose as libraryPose, type Pose, type Vec3 } from '../draw/poses.js';
import { coord, timeSchema } from './common.js';

/** A person handle or a rig character record (both carry `D`). */
export type Who = Character | { readonly kind: 'person'; readonly character: Character };

function isWho(value: unknown): value is Who {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Readonly<Record<string, unknown>>;
  return v['kind'] === 'person' ? typeof v['character'] === 'object' : typeof v['D'] === 'object';
}

const isPose = (value: unknown): value is Pose =>
  typeof value === 'object' && value !== null && 'hL' in value && 'hR' in value && 'fL' in value;

export const viewSchema = z.union([
  z.enum(['front', 'three-quarter', 'profile', 'back']),
  z.number().int().min(-3).max(3),
]);

export const figSchema = z.strictObject({
  who: z.custom<Who>(isWho, {
    message: 'who must be a person (ctx.kit.people.<id>) or its .character',
  }),
  x: coord,
  y: coord,
  s: z.number().min(0.1).max(8).default(1),
  view: viewSchema.default(0),
  pose: z
    .custom<Pose>(isPose, { message: 'pose must come from person.pose(name, ph, over)' })
    .optional(),
  bow: z.number().min(-90).max(120).default(0),
  lean: z.number().min(-45).max(45).default(0),
});

export type FigInput = z.output<typeof figSchema>;

/** Options every two-body gag shares. */
export const gagBase = {
  a: figSchema,
  b: figSchema,
  t: timeSchema,
  t0: timeSchema,
} as const;

/** A placed figure the contact helpers read. */
export interface Fig {
  readonly character: Character;
  readonly placement: {
    readonly x: number;
    readonly y: number;
    readonly s: number;
    readonly yaw: number;
    readonly bow: number;
    readonly lean: number;
  };
  readonly pose: Pose;
  readonly view: FigureView;
}

export function figOf(f: FigInput): Fig {
  const character = 'kind' in f.who ? f.who.character : f.who;
  const yaw = resolveView(f.view).yaw;
  return {
    character,
    placement: { x: f.x, y: f.y, s: f.s, yaw, bow: f.bow, lean: f.lean },
    pose: f.pose ?? libraryPose('stand', character.D),
    view: f.view,
  };
}

/** What a gag gives back for one person: spread into `person.draw(g, e, { …cue, t })`. */
export interface ActingCue {
  readonly x: number;
  readonly y: number;
  readonly s: number;
  readonly view: FigureView;
  readonly pose: Pose;
  readonly bow: number;
  readonly lean: number;
  readonly headDy: number;
  readonly headYaw?: number;
  readonly expr?: ExprName;
  readonly look?: Pair;
}

export interface CueChange {
  readonly x?: number;
  readonly pose?: Partial<Pose>;
  readonly bow?: number;
  readonly lean?: number;
  readonly headDy?: number;
  readonly headYaw?: number;
  readonly view?: FigureView;
  readonly expr?: ExprName | undefined;
  readonly look?: Pair;
}

export function cue(f: Fig, change: CueChange = {}): ActingCue {
  const p = f.placement;
  return {
    x: change.x ?? p.x,
    y: p.y,
    s: p.s,
    view: change.view ?? f.view,
    pose: { ...f.pose, ...change.pose },
    bow: change.bow ?? p.bow,
    lean: change.lean ?? p.lean,
    headDy: change.headDy ?? 0,
    ...(change.headYaw === undefined ? {} : { headYaw: change.headYaw }),
    ...(change.expr === undefined ? {} : { expr: change.expr }),
    ...(change.look === undefined ? {} : { look: change.look }),
  };
}

/** The same figure moved (x), bent (bow, lean) or re-posed, for solving the next contact. */
export function moved(
  f: Fig,
  change: {
    readonly x?: number;
    readonly bow?: number;
    readonly lean?: number;
    readonly pose?: Partial<Pose>;
  },
): Fig {
  return {
    ...f,
    placement: {
      ...f.placement,
      x: change.x ?? f.placement.x,
      bow: change.bow ?? f.placement.bow,
      lean: change.lean ?? f.placement.lean,
    },
    pose: { ...f.pose, ...change.pose },
  };
}

/**
 * Lean (figure frame, as placements take it) that tips the figure's top `screen` degrees toward
 * screen +x on top of its own lean: a mirrored figure leans the other way in its own frame.
 */
export const tilt = (f: Fig, screen: number): number =>
  f.placement.lean + (f.placement.yaw < 0 ? -screen : screen);

/** Gag phase in [0, 1] on twos: 0 before t0, 1 after t0 + dur. */
export const phase = (t: number, t0: number, dur: number): number => clamp01((twos(t) - t0) / dur);

/** 0 -> 1 over [a, b] of the phase u, eased. */
export const span = (
  u: number,
  a: number,
  b: number,
  name: 'inOut' | 'out' | 'lin' | 'back' = 'inOut',
): number => ease[name](clamp01((u - a) / (b - a)));

/** A short jolt (body px, - = up) for 0.2 s after `at` on twos. */
export const jolt = (t: number, at: number, px: number): number => {
  const d = twos(t) - at;
  return d >= 0 && d < 0.2 ? px : 0;
};

export const lerp2 = (a: Point2, b: Point2, k: number): Point2 => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
];

/**
 * Hand target that puts `side`'s palm on the world point. In three-quarter and profile views the
 * body x the view cannot see is held near the centre line (a hand reaching forward to someone),
 * which reaches much further than the hanging hand's own x; front and back keep the pose's depth.
 */
export function reach(f: Fig, side: HandSide, goal: Point2): Vec3 {
  const v = viewState(f.placement.yaw).v;
  const sideways = v === 1 || v === 2;
  const keep = sideways ? (side === 'L' ? 0.3 : -0.3) * f.character.D.sw : undefined;
  return reachPalm(f, side, goal, keep);
}

export const palm = (f: Fig, side: HandSide): Point2 => palmWorld(f, side);

/** A body point of the figure in the world (shoulder, neck, hip…), falling back to the feet. */
export function bodyPoint(f: Fig, name: BodyAnchorName): Point2 {
  return anchorWorld(f, name) ?? [f.placement.x, f.placement.y];
}

/** Chest height in front of the figure, toward x (world). */
export function chest(f: Fig, towardX: number): Point2 {
  const neck = bodyPoint(f, 'neck');
  const D = f.character.D;
  const dir = towardX >= f.placement.x ? 1 : -1;
  return [
    f.placement.x + dir * D.sw * 0.6 * f.placement.s,
    neck[1] + (D.l1a + D.l2a) * 0.35 * f.placement.s,
  ];
}

/** A hand target from the library: out, down, fwd in arm lengths (`handAt`). */
export const handLib = (f: Fig, side: HandSide, out: number, down: number, fwd: number): Vec3 =>
  handAt(f.character.D, side === 'L' ? 1 : -1, out, down, fwd);

/** Which hand side key of a pose. */
export const handKey = (side: HandSide): 'hL' | 'hR' => (side === 'L' ? 'hL' : 'hR');
export const kindKey = (side: HandSide): 'kL' | 'kR' => (side === 'L' ? 'kL' : 'kR');

/** Ring yaw that faces the other x (three-quarter toward it). */
export const faceToward = (from: number, to: number): number => (to >= from ? 1 : -1);

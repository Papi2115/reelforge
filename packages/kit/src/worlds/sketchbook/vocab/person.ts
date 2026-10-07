/**
 * `page.person(...)`: the parametric person of the open vocabulary (PLAN.md#13.15a) on top of the
 * crude stick figure - named poses (stand, walk, run, point, hold, slump, look-up, shrug, wave,
 * cheer, sit) facing either way, moods (neutral, happy, sad, angry, surprised, scared, thinking,
 * tired), a stick or blob body, clothes, hat, hair, skin and a held thing (any tool, object or
 * instrument type, or a project prop). One hand task: head, skin, clothes, body, face, hair, hat,
 * the held thing - in the order a person draws one.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import type { Skeleton } from '../draw/figures.js';
import type { Mark } from '../draw/marks.js';
import type { PoseFields } from '../page/motion.js';
import { PageFrame } from '../page/motion.js';
import { compileDoodle, type Placement } from './compile.js';
import {
  CLOTHES,
  clothesDoodle,
  HAIRS,
  hairDoodle,
  HATS,
  hatDoodle,
  SKIN_INKS,
  SKINS,
} from './person-parts.js';
import { sequenceOps } from './sequence.js';
import { completeDoodle, swatch, type DoodleInput, type DoodleSpec } from './spec.js';

export const POSES = {
  stand: { armL: [-18, -8], armR: [18, 8], legL: [-10, -3], legR: [10, 3] },
  walk: { lean: 4, armL: [28, 44], armR: [-26, -14], legL: [-22, -38], legR: [22, 6] },
  run: {
    lean: 14,
    hip: [0, -0.02],
    armL: [-50, -12],
    armR: [62, 134],
    legL: [-40, -104],
    legR: [56, 8],
  },
  point: { turn: 0.65, armR: [92, 88], armL: [-15, -6] },
  hold: { armR: [52, 104], armL: [36, 96] },
  slump: { lean: 10, head: 22, look: 0.7, armL: [-4, 0], armR: [6, 0], hip: [0, 0.015] },
  'look-up': { lean: -6, head: -24, look: -1, armL: [-20, -10], armR: [20, 10] },
  shrug: { turn: 0, head: 10, armL: [-62, -150], armR: [62, 150] },
  wave: { armR: [140, 168], armL: [-18, -8] },
  cheer: { turn: 0, armL: [-150, -172], armR: [150, 172] },
  sit: { hip: [0, 0.235], legL: [84, 2], legR: [90, 6], armL: [30, 70], armR: [40, 80] },
} as const satisfies Record<string, PoseFields>;
export type PoseName = keyof typeof POSES;
export const POSE_NAMES = Object.keys(POSES) as [PoseName, ...PoseName[]];

export const MOODS = {
  neutral: { eyes: 'dot', mouth: 'smile', brow: 0 },
  happy: { eyes: 'closed', happy: true, mouth: 'grin', brow: -0.3 },
  sad: { eyes: 'dot', mouth: 'frown', brow: -1.3 },
  angry: { eyes: 'dot', mouth: 'frown', brow: 1.8 },
  surprised: { eyes: 'wide', mouth: 'o', brow: -1.6 },
  scared: { eyes: 'wide', mouth: 'flat', brow: -2 },
  thinking: { eyes: 'dot', mouth: 'flat', brow: 0.8 },
  tired: { eyes: 'closed', happy: false, mouth: 'flat', brow: -0.4 },
} as const;
export type MoodName = keyof typeof MOODS;
export const MOOD_NAMES = Object.keys(MOODS) as [MoodName, ...MoodName[]];

/** What a person looks like (the part a `defineFigure` stores). */
export const personLook = z.strictObject({
  body: z.enum(['stick', 'blob']).default('stick'),
  clothes: z.enum(CLOTHES).default('none'),
  color: swatch.optional().describe('Clothes / blob body crayon'),
  hat: z.enum(HATS).default('none'),
  hatColor: swatch.optional(),
  hair: z.enum(HAIRS).default('none'),
  hairColor: swatch.default('ink'),
  skin: z.enum(SKINS).default('none'),
  holds: z
    .string()
    .min(1)
    .max(40)
    .optional()
    .describe('A tool/object/instrument type or a prop id'),
  holdSize: z.number().min(0.05).max(1.5).optional().describe('Held thing height / figure height'),
  hand: z.enum(['R', 'L']).default('R'),
  belly: z.number().min(-20).max(30).default(0),
  pen: z.enum(['felt', 'fine', 'bic', 'pencil', 'red']).default('felt'),
});
export type PersonLook = z.output<typeof personLook>;

const moodKey = z.strictObject({ at: whenParam, mood: z.enum(MOOD_NAMES) });

/** Options of `page.person(...)` besides the look. */
export const personPlace = z.object({
  like: z
    .string()
    .optional()
    .describe('A figure defined with defineFigure (its look; options override it)'),
  x: z.number(),
  y: z.number().describe('Ground line (feet)'),
  h: z.number().min(30).max(520).default(220),
  face: z
    .union([z.literal(1), z.literal(-1), z.literal(0)])
    .default(1)
    .describe('1 right, -1 left, 0 front'),
  action: z.enum(POSE_NAMES).default('stand'),
  mood: z.union([z.enum(MOOD_NAMES), z.array(moodKey).min(1).max(24)]).default('neutral'),
});

const mirror = (fields: PoseFields): PoseFields => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'look') out[key] = value;
    else if (key === 'hip' && Array.isArray(value)) out[key] = [-value[0], value[1]];
    else if (Array.isArray(value)) out[key] = value.map((v: number) => -v);
    else if (typeof value === 'number') out[key] = -value;
  }
  return out;
};

/** The preset pose for an action, facing `face`. */
export function presetPose(action: PoseName, face: -1 | 0 | 1): PoseFields {
  const base: PoseFields = { turn: face * 0.45, ...POSES[action] };
  return face < 0 ? mirror(base) : base;
}

/** The figure's pose option: the preset under whatever the scene passed. */
export function mergePose(preset: PoseFields, pose: unknown): unknown {
  if (pose === undefined) return preset;
  if (typeof pose === 'function') {
    const fn = pose as (t: number) => PoseFields;
    return (t: number) => ({ ...preset, ...fn(t) });
  }
  if (Array.isArray(pose)) {
    const [first, ...rest] = pose as Record<string, unknown>[];
    return [{ ...preset, ...first }, ...rest];
  }
  return typeof pose === 'object' ? { ...preset, ...(pose as object) } : pose;
}

/** The figure's expression option from a mood (unless the scene passed its own). */
export function moodExpression(
  mood: z.output<typeof personPlace>['mood'],
  expression: unknown,
): unknown {
  if (expression !== undefined) return expression;
  if (typeof mood === 'string') return MOODS[mood];
  return mood.map((key) => ({ at: key.at, ...MOODS[key.mood] }));
}

const torsoFrame = (sk: (t: number) => Skeleton) =>
  new PageFrame('torso', (t) => {
    const s = sk(t);
    const [dx, dy] = [s.hip[0] - s.neck[0], s.hip[1] - s.neck[1]];
    return (u, v) => [s.neck[0] + v * dx + u * dy, s.neck[1] + v * dy - u * dx];
  });

const headFrame = (sk: (t: number) => Skeleton) =>
  new PageFrame('head', (t) => {
    const s = sk(t);
    const a = (s.headAngle * Math.PI) / 180;
    const [c, si] = [Math.cos(a), Math.sin(a)];
    return (u, v) => [
      s.head[0] + (u * c - v * si) * s.headRadius,
      s.head[1] + (u * si + v * c) * s.headRadius,
    ];
  });

const handFrame = (sk: (t: number) => Skeleton, hand: 'R' | 'L') =>
  new PageFrame(`hand${hand}`, (t) => {
    const s = sk(t);
    const [x, y] = hand === 'R' ? s.armR[2] : s.armL[2];
    return (u, v) => [x + u, y + v];
  });

export interface Accessory {
  readonly spec: DoodleSpec;
  readonly frame: PageFrame;
  /** Page px per frame unit. */
  readonly unit: number;
  readonly scale: number;
  readonly flip: boolean;
  readonly pivot?: readonly [number, number] | undefined;
}

export interface PersonParts {
  readonly skin: Accessory | null;
  readonly clothes: Accessory | null;
  readonly after: readonly Accessory[];
}

/** The person's drawings around its skeleton (`held` = the held thing's drawing, if any). */
export function personParts(
  look: PersonLook,
  face: -1 | 0 | 1,
  sk: (t: number) => Skeleton,
  seed: number,
  held: { readonly spec: DoodleSpec; readonly size: number } | null,
  call: string,
): PersonParts {
  const s0 = sk(0);
  const torso = Math.hypot(s0.hip[0] - s0.neck[0], s0.hip[1] - s0.neck[1]);
  const flip = face < 0;
  const head = headFrame(sk);
  const make = (input: DoodleInput | null, frame: PageFrame, unit: number): Accessory | null =>
    input ? { spec: completeDoodle(input, call), frame, unit, scale: 0.01, flip } : null;
  const skin =
    look.skin === 'none'
      ? null
      : make(
          {
            box: [1, 1],
            parts: [
              { circle: [0, 0, 88], fill: SKIN_INKS[look.skin], outline: false, shade: 'light' },
            ],
          },
          head,
          s0.headRadius,
        );
  const color = look.color ?? 'skyPencil';
  const clothes = make(
    clothesDoodle(look.clothes, look.body === 'blob', color, seed + 3),
    torsoFrame(sk),
    torso,
  );
  const hair = make(hairDoodle(look.hair, look.hairColor, seed + 5), head, s0.headRadius);
  const hat = make(hatDoodle(look.hat, look.hatColor ?? color, seed + 7), head, s0.headRadius);
  const after: Accessory[] = [];
  if (hair) after.push(hair);
  if (hat) after.push(hat);
  if (held) {
    const [, boxH] = held.spec.box;
    const [bw, bh] = held.spec.box;
    after.push({
      spec: held.spec,
      frame: handFrame(sk, look.hand),
      unit: 1,
      scale: (held.size * s0.headRadius) / 0.115 / boxH,
      flip,
      pivot: held.spec.grip ?? [bw / 2, bh / 2],
    });
  }
  return { skin, clothes, after };
}

function accessoryMarks(a: Accessory, seed: number, fps: number): Mark[] {
  const place: Placement = {
    x: 0,
    y: 0,
    scale: a.scale,
    anchor: 'top-left',
    flip: a.flip,
    rot: 0,
    unit: a.unit,
    pivot: a.pivot,
  };
  const ops = compileDoodle(a.spec, place, seed);
  return sequenceOps(ops, {
    t0: 0,
    seed,
    speed: 1.4,
    fps,
    held: true,
    unit: a.unit,
    frame: a.frame,
  });
}

/** Lays out the figure's marks with the person's parts woven in (times re-sequenced). */
export function weave(
  figure: { readonly marks: readonly Mark[] },
  parts: PersonParts,
  seed: number,
  fps: number,
): Mark[] {
  const out: Mark[] = [];
  let shift = 0;
  let cursor = 0;
  const insert = (a: Accessory | null, salt: number): void => {
    if (!a) return;
    const marks = accessoryMarks(a, seed + salt, fps);
    const start = cursor + 0.05;
    let end = start;
    for (const mark of marks) {
      const moved = { ...mark, t0: mark.t0 + start };
      out.push(moved);
      end = Math.max(end, moved.t0 + moved.dur);
    }
    shift += end - cursor + 0.05;
    cursor = end;
  };
  figure.marks.forEach((mark, index) => {
    const moved = { ...mark, t0: mark.t0 + shift };
    out.push(moved);
    cursor = Math.max(cursor, moved.t0 + moved.dur);
    if (index === 0) {
      insert(parts.skin, 11);
      insert(parts.clothes, 13);
    }
  });
  parts.after.forEach((a, index) => {
    insert(a, 17 + index * 3);
  });
  return out;
}

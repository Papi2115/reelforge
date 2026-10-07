/**
 * Figure motion for the page API: a pose (or expression) is a plain object, a list of keys, or a
 * function of t. Pose keys ease from the pose so far to their values between `at` and `to`
 * (anticipation, travel, overshoot with `back`); expression keys switch at `at`. Frames attach a
 * mark to something that moves: a joint, the head (local units = head radius), or a sheet.
 */
import { z } from 'zod';
import { whenParam, type Resolver } from '../../../looks/blueprint/timing.js';
import {
  DEFAULT_EXPRESSION,
  DEFAULT_POSE,
  EYES,
  MOUTHS,
  type Expression,
  type Pose,
} from '../draw/figures.js';
import { EASE_NAMES, ease, lerp, seg } from '../draw/math.js';
import type { Xform } from '../draw/paths.js';

const angle = z.number().min(-720).max(720);
const pair = z.tuple([angle, angle]);

export const poseFields = z.object({
  lean: angle.optional(),
  head: angle.optional(),
  turn: z.number().min(-1.5).max(1.5).optional(),
  look: z.number().min(-1.5).max(1.5).optional(),
  armL: pair.optional(),
  armR: pair.optional(),
  legL: pair.optional(),
  legR: pair.optional(),
  hip: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)]).optional(),
});
export type PoseFields = z.output<typeof poseFields>;

const poseKey = poseFields.extend({
  at: whenParam,
  to: whenParam.optional().describe('End of the move (default: a cut at `at`)'),
  ease: z.enum(EASE_NAMES).default('inOut'),
  overshoot: z.number().min(0).max(4).default(1.9).describe('Overshoot of ease "back"'),
});

const fn = <T>(what: string) =>
  z.custom<(t: number) => T>((value) => typeof value === 'function', {
    message: `${what} function`,
  });

export const poseParam = z.union([
  poseFields,
  z.array(poseKey).min(1).max(24),
  fn<PoseFields>('pose'),
]);

export const expressionFields = z.object({
  eyes: z.enum(EYES).optional(),
  happy: z.boolean().optional(),
  mouth: z.enum(MOUTHS).optional(),
  brow: z.number().min(-2).max(2).optional(),
});
type ExpressionFields = z.output<typeof expressionFields>;

const expressionKey = expressionFields.extend({ at: whenParam });

export const expressionParam = z.union([
  expressionFields,
  z.array(expressionKey).min(1).max(24),
  fn<ExpressionFields>('expression'),
]);

type PoseValue = number | readonly [number, number];

function mixField(from: PoseValue, to: PoseValue, k: number): PoseValue {
  if (typeof from === 'number' || typeof to === 'number') {
    return typeof from === 'number' && typeof to === 'number' ? lerp(from, to, k) : to;
  }
  return [lerp(from[0], to[0], k), lerp(from[1], to[1], k)];
}

function merge(base: Pose, fields: PoseFields, k = 1): Pose {
  const out: Record<string, PoseValue> = { ...base };
  for (const key of Object.keys(DEFAULT_POSE) as (keyof Pose)[]) {
    const value = fields[key];
    if (value !== undefined) out[key] = mixField(base[key], value, k);
  }
  return out as unknown as Pose;
}

/** The pose at t from the API input. */
export function poseTrack(
  input: z.output<typeof poseParam>,
  resolve: Resolver,
): (t: number) => Pose {
  if (typeof input === 'function') return (t) => merge(DEFAULT_POSE, input(t));
  if (!Array.isArray(input)) {
    const pose = merge(DEFAULT_POSE, input);
    return () => pose;
  }
  const keys = input.map((key) => {
    const start = resolve(key.at, 0);
    return { key, start, end: resolve(key.to, start) };
  });
  const first = keys[0];
  const base = first ? merge(DEFAULT_POSE, first.key) : DEFAULT_POSE;
  return (t) =>
    keys.slice(1).reduce((pose, { key, start, end }) => {
      const k = seg(t, start, end);
      return k <= 0 ? pose : merge(pose, key, ease(key.ease, k, key.overshoot));
    }, base);
}

export function expressionTrack(
  input: z.output<typeof expressionParam>,
  resolve: Resolver,
): (t: number) => Expression {
  const with_ = (fields: ExpressionFields, base: Expression = DEFAULT_EXPRESSION): Expression => ({
    eyes: fields.eyes ?? base.eyes,
    happy: fields.happy ?? base.happy,
    mouth: fields.mouth ?? base.mouth,
    brow: fields.brow ?? base.brow,
  });
  if (typeof input === 'function') return (t) => with_(input(t));
  if (!Array.isArray(input)) {
    const expression = with_(input);
    return () => expression;
  }
  const keys = input.map((key) => ({ key, start: resolve(key.at, 0) }));
  return (t) =>
    keys.reduce(
      (expression, { key, start }, index) =>
        index === 0 || t >= start ? with_(key, expression) : expression,
      DEFAULT_EXPRESSION,
    );
}

/** Something marks can be attached to: local coordinates -> page px at time t. */
export class PageFrame {
  readonly at: (t: number) => Xform;
  readonly label: string;

  constructor(label: string, map: (t: number) => Xform) {
    this.label = label;
    this.at = map;
  }
}

export const attachParam = z
  .custom<PageFrame>((value) => value instanceof PageFrame, {
    message: 'attach must come from figure.joint(), figure.carry(), figure.head() or sheet.frame()',
  })
  .optional()
  .describe('Move with a figure joint, its head or a sheet (points are then local)');

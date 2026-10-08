/** Option schemas of the Comic page API (validated at build time, readable errors). */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { EASE_NAMES } from '../draw/math.js';
import { LAYOUT_NAMES } from './layouts.js';

const point = z.tuple([z.number(), z.number()]);
const quad = z.array(z.number()).length(8, 'a quad is 8 numbers [x0, y0, x1, y1, x2, y2, x3, y3]');
const ease = z.enum(EASE_NAMES);
const paint = z.union([z.string().min(1), z.int().min(0)]);
/** A point that moves: (t) => [x, y] in page px. */
const pointFn = z.custom<(t: number) => readonly number[]>((value) => typeof value === 'function', {
  message: 'expected [x, y] or a function (t) => [x, y]',
});

export const layoutOptionsSchema = z
  .object({
    weights: z.array(z.number().min(0.12).max(0.88)).max(4).optional(),
    mirror: z.boolean().default(false),
    margin: z.number().min(0).max(40).optional(),
    gutter: z.number().min(3).max(30).default(10),
    seed: z.int().min(0).optional(),
  })
  .default({ mirror: false, gutter: 10 });

export const panelOptionsSchema = z
  .object({
    key: z.string().min(1).optional(),
    border: z.number().min(0).max(8).default(2),
    boil: z.number().min(0).max(2).default(0.5),
    pencils: z.boolean().default(true),
    mis: point.optional(),
    z: z.number().optional(),
  })
  .default({ border: 2, boil: 0.5, pencils: true });

export const enterSchema = z.object({
  at: whenParam,
  kind: z.enum(['cut', 'slam', 'slide', 'pop']).default('cut'),
  from: z.enum(['left', 'right', 'top', 'bottom']).default('right'),
  dur: z.number().min(0.05).max(3).optional(),
  rough: z.boolean().default(false),
});

export const morphSchema = z.object({
  at: whenParam,
  dur: z.number().min(0.05).max(10).default(1.2),
  ease: ease.default('inOutCubic'),
});

export const cameraKeySchema = z.object({
  at: whenParam,
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.25).max(8).default(1),
  ease: ease.default('inOutCubic'),
});

export const clockSchema = z.object({
  offset: z.number().default(0),
  rate: z.number().min(0.1).max(4).default(1),
  hold: whenParam.optional(),
});

export const balloonSchema = z.object({
  x: z.number(),
  y: z.number(),
  at: whenParam,
  until: whenParam.optional(),
  kind: z.enum(['speech', 'radio', 'thought']).default('speech'),
  tail: z.union([point, pointFn]).optional(),
  dots: z.union([point, pointFn]).optional(),
  pop: z.number().min(0.05).max(1).default(0.22),
  size: z.int().min(1).max(3).default(1).describe('Lettering size (integer scale)'),
  width: z.number().min(40).max(400).default(150),
  on: z.unknown().optional(),
});

export const captionSchema = z.object({
  x: z.number(),
  y: z.number(),
  at: whenParam,
  until: whenParam.optional(),
  tilt: z.number().min(-4).max(4).default(0),
  fill: paint.default('yellowPale'),
  width: z.number().min(40).max(600).default(220),
  on: z.unknown().optional(),
  type: z
    .number()
    .min(0)
    .max(3)
    .default(0)
    .describe('Seconds to letter it in, letter by letter (a time-stamp caption); 0 = at once'),
});

export const stampSchema = z.object({
  x: z.number(),
  y: z.number(),
  at: whenParam,
  until: whenParam.optional(),
  angle: z.number().min(-0.6).max(0.6).default(-0.13),
  color: paint.default('red'),
  w: z.number().min(30).max(240).optional(),
  h: z.number().min(18).max(120).default(40),
  size: z.number().min(1.5).max(8).default(3.4),
  wear: z.number().min(0).max(0.5).default(0.2),
  inner: z.boolean().default(false),
  shake: z.number().min(0).max(8).default(3),
});

export const sfxSchema = z.object({
  x: z.number(),
  y: z.number(),
  at: whenParam,
  until: whenParam.optional(),
  size: z.number().min(1).max(16).default(6),
  pitch: z.number().min(4).max(200).optional(),
  beats: z.array(z.number().min(0).max(2)).optional(),
  angles: z.array(z.number().min(-0.6).max(0.6)).optional(),
  rise: z.array(z.number().min(-60).max(60)).optional(),
  fill: paint.default('yellow'),
  shade: paint.default('magenta'),
  shadeTone: z.number().min(0).max(1).default(0.6),
  outline: z.int().min(0).max(4).default(2),
  extrude: point.default([3, 3]),
  mis: point.default([1, 1]),
  on: z.unknown().optional(),
});

export const noteSchema = z.object({
  x: z.number(),
  y: z.number(),
  at: whenParam,
  until: whenParam.optional(),
  dur: z.number().min(0).max(4).default(0.5),
  color: paint.default('pencil'),
  slant: z.number().min(-2).max(2).default(1),
});

export const strokeSchema = z.object({
  at: whenParam,
  until: whenParam.optional(),
  dur: z.number().min(0).max(4).default(0.3),
  color: paint.default('pencil'),
  w: z.int().min(1).max(4).default(1),
});

export const traceSchema = z.object({
  at: whenParam.optional(),
  over: z.boolean().default(false),
});

export const drawSchema = z
  .object({
    at: whenParam.optional(),
    until: whenParam.optional(),
    over: z.boolean().default(true),
    z: z.number().optional().describe('Draw among the panels, after those with a lower z'),
  })
  .default({ over: true });

export { LAYOUT_NAMES, quad as quadSchema };

/**
 * Param schemas of `kit.fx.b1Screen` and its methods, and the readable errors they produce.
 * Times are seconds or spoken phrases (resolved through `anchor: ctx.anchor`).
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { anchorParam, whenParam } from '../../../looks/blueprint/timing.js';
import { missingGlyphs } from '../core/fonts.js';
import { missingHandGlyphs } from '../core/hand.js';
import { EASE_IDS } from '../core/math.js';
import { VIEW_NAMES } from '../room/view.js';

export const CALL = 'kit.fx.b1Screen()';

export function fail(message: string): never {
  throw new KitError('invalid-params', `${CALL}: ${message}`);
}

export function parse<S extends z.ZodType>(schema: S, value: unknown, what: string): z.output<S> {
  const parsed = schema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  fail(
    `${what}: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || '(value)'} ${issue.message}`).join('; ')}`,
  );
}

/** HUD / screen text: CAPS in the Joy face, at most `lines` lines of `max` px. */
export function checkJoy(what: string, text: string, lines = 1): string {
  const upper = text.toUpperCase();
  const missing = missingGlyphs(upper, 'joy');
  if (missing.length > 0) fail(`${what} "${text}": the B1 font cannot draw ${missing.join(' ')}`);
  const count = upper.split('\n').length;
  if (count > lines) fail(`${what} "${text}": ${String(count)} lines, max ${String(lines)}`);
  return upper;
}

export function checkHand(what: string, text: string): string {
  const upper = text.toUpperCase();
  const missing = missingHandGlyphs(upper);
  if (missing.length > 0) fail(`${what} "${text}": Dad's hand cannot write ${missing.join(' ')}`);
  return upper;
}

export const screenParams = z.object({
  size: z
    .tuple([z.int().min(64).max(3840), z.int().min(36).max(2160)])
    .default([640, 360])
    .describe('Pass [ctx.shot.width, ctx.shot.height]'),
  duration: z
    .number()
    .min(0.5)
    .max(600)
    .optional()
    .describe('Shot length (ctx.shot.duration): the default `until` of every element'),
  flickerLimit: z
    .int()
    .min(1)
    .max(8)
    .default(2)
    .describe('Sprites per scanline before they flicker (the 2600 has two players)'),
  seed: z.int().min(0).optional(),
  layer: z.int().min(0).max(9).default(0),
  anchor: anchorParam,
});

const range = z.tuple([whenParam, whenParam]);

export const roomSchema = z.strictObject({
  calendar: z
    .union([
      z.literal(false),
      z.strictObject({
        month: z.string().min(1).max(9).default('DEC'),
        mark: z.int().min(0).max(28).default(25).describe('Day ringed by hand (0 = none)'),
        markAt: range.optional().describe('[from, to] the pen draws the ring (default: drawn)'),
      }),
    ])
    .default({ month: 'DEC', mark: 25 }),
  tree: z.boolean().default(false).describe('The Christmas tree (right edge) with blinking bulbs'),
  presents: z.boolean().optional().describe('Two wrapped presents (default: with the tree)'),
  gift: z
    .strictObject({
      slot: range.describe('[from, to] the dashed outline of the missing gift is drawn'),
      tag: z.array(z.string().min(1).max(10)).min(1).max(2).describe("Dad's tag, 1-2 lines"),
      tagAt: range.describe('[from, to] the tag drops and swings to rest'),
      blink: whenParam.optional().describe('The outline blinks three times'),
    })
    .optional(),
  lamp: z.boolean().default(false).describe('A table lamp on the TV cabinet'),
  carts: z.int().min(0).max(4).default(0).describe('Loose cartridges on the carpet'),
});

export const cameraKeySchema = z.strictObject({
  at: whenParam,
  on: z
    .enum(VIEW_NAMES)
    .optional()
    .describe("'room' | 'tv' (inside the TV) | 'calendar' | 'console'"),
  x: z.number().optional().describe('Room point at the frame centre (room units, 320 x 180)'),
  y: z.number().optional(),
  zoom: z.number().min(1).max(12).optional().describe('px per room unit (room = 2)'),
  ease: z.enum(EASE_IDS).default('inOut'),
});

export const timedSchema = z.strictObject({ at: whenParam, until: whenParam.optional() });

export const scoreSchema = z.strictObject({
  label: z.string().max(12).default(''),
  keys: z.array(z.tuple([whenParam, z.number().min(0).max(99999)])).min(1),
  at: whenParam.default(0),
  until: whenParam.optional(),
});

export const progressSchema = z.strictObject({
  from: z.number().min(0).max(1).describe('Share of the film done when the shot starts'),
  to: z.number().min(0).max(1).describe('Share done when it ends'),
  slots: z.int().min(2).max(16).default(10).describe('Cartridge slots (one per shot reads best)'),
  at: whenParam.default(0),
});

export const checkpointSchema = z.strictObject({
  label: z.string().min(1).max(24),
  at: whenParam,
  until: whenParam.optional(),
});

export const livesSchema = z.strictObject({
  label: z.string().max(12).default(''),
  max: z.int().min(1).max(5),
  keys: z.array(z.tuple([whenParam, z.int().min(0).max(5)])).default([]),
  at: whenParam.default(0),
  until: whenParam.optional(),
});

export const bossSchema = z.strictObject({
  num: z.int().min(1).max(9),
  name: z.string().min(1).max(16),
  from: z.enum(['left', 'right', 'top']).default('left').describe('Side the name slams in from'),
  x: z.number().min(0).max(560).default(40),
  y: z.number().min(0).max(300).default(52),
  at: whenParam,
  hp: z
    .strictObject({
      n: z.int().min(1).max(12),
      label: z.string().max(10).default(''),
      keys: z.array(z.tuple([whenParam, z.number().min(0)])).default([]),
      segW: z.int().min(4).max(24).default(12),
    })
    .optional(),
  defeat: whenParam.optional().describe('The card flickers out (hit-stop death)'),
  seed: z.int().min(0).optional(),
});

export const saySchema = z.strictObject({
  speaker: z.string().max(16).default(''),
  at: whenParam,
  until: whenParam.optional(),
  place: z.enum(['bottom', 'top']).default('bottom'),
});

export const noteSchema = z.strictObject({
  at: whenParam,
  x: z.number().describe('Centre in picture px (640 x 360)'),
  y: z.number(),
  w: z.number().min(40).max(400).default(168),
  h: z.number().min(24).max(240).default(66),
  angle: z.number().min(-0.4).max(0.4).default(-0.075),
  size: z.number().min(1).max(4).default(2.1),
  under: z.int().min(0).max(3).optional().describe('Line underlined twice after the slap'),
  strike: z.strictObject({ line: z.int().min(0).max(3), at: whenParam }).optional(),
  tick: whenParam.optional().describe('A two-stroke tick after the last line'),
  seed: z.int().min(0).optional(),
});

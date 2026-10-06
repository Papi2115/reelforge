/**
 * Option schemas of the Sketchbook page methods (`page.write(...)`, `page.figure(...)`, ...).
 * Every method validates its arguments and fails with a message written for the scene author.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { CROSS_STYLES } from '../draw/doodles.js';
import { HAND_NAMES } from '../draw/lettering.js';
import { APPEAR_KINDS, TOOL_NAMES } from '../draw/marks.js';
import { EASE_NAMES } from '../draw/math.js';
import { SWATCH_NAMES, type SwatchName } from '../inks.js';
import { attachParam, expressionParam, poseParam } from './motion.js';
import { SHEET_PAPERS } from './sheet.js';

const swatch = z.enum(SWATCH_NAMES as unknown as readonly [SwatchName, ...SwatchName[]]);
const seconds = z.number().min(0.02).max(30);

/** Options every pen mark shares. */
export const penOptions = z.object({
  tool: z
    .enum(TOOL_NAMES)
    .default('felt')
    .describe('felt (default), fine, bic, red, marker, pencil, cpencil, hi'),
  color: swatch.optional().describe("Ink colour (a palette swatch); default the tool's"),
  width: z.int().min(1).max(8).optional().describe('Nib width in px'),
  at: whenParam.optional().describe('Start (s or phrase); default: right after the previous mark'),
  dur: seconds.optional().describe('Duration; default from the length and the pen speed'),
  speed: z.number().min(20).max(4000).optional().describe('Page px per second'),
  seed: z.int().min(0).optional(),
  held: z.boolean().default(true).describe('The visible hand draws it'),
  parallel: z
    .boolean()
    .default(false)
    .describe('Never take the hand: the ink appears by itself, on time (background marks)'),
  hero: z
    .boolean()
    .default(false)
    .describe('The hero mark of the shot: it keeps its time and gets the hand; others wait for it'),
  appear: z
    .enum(APPEAR_KINDS)
    .optional()
    .describe('No hand: bloom (ink soaks in), pop (all at once), type (letter by letter)'),
  boil: z.number().min(0).max(2).optional().describe('Line boil amplitude (0 = printed)'),
  fps: z.number().min(4).max(24).optional().describe('Boil cadence (default the page boilFps)'),
  nib: z
    .tuple([z.number().min(2).max(40), z.number().min(-90).max(90), z.int().min(1).max(8)])
    .optional()
    .describe('Chisel nib [length, angle, thickness] of the marker/highlighter (big words)'),
  attach: attachParam,
});
export type PenOptions = z.output<typeof penOptions>;

export const writeOptions = penOptions.extend({
  x: z.number(),
  y: z.number().describe('Baseline'),
  size: z
    .number()
    .min(4)
    .max(300)
    .default(20)
    .describe('Cap height (page px; >= 13 stays legible)'),
  hand: z
    .enum(HAND_NAMES)
    .default('print')
    .describe('print, scrawl (slanted), marker (caps), type (printed)'),
  rot: z.number().min(-45).max(45).default(0).describe('Line rotation (degrees)'),
  track: z.number().min(-1).max(6).default(0),
  until: whenParam.optional().describe('Squeeze/stretch the writing to end here'),
  speed: z
    .number()
    .min(0.5)
    .max(2)
    .default(1)
    .describe('Pace multiplier (a 12-letter word takes ~1.1 s at 1; 2 = twice as fast)'),
  quick: z.boolean().default(false).describe('Quick label pace (~1.7x faster, same roughness)'),
});

export const strokeOptions = penOptions.extend({
  corners: z
    .array(z.int().min(0))
    .max(64)
    .default([])
    .describe('Point indices that are sharp corners'),
  smooth: z.boolean().default(true),
  ease: z.enum(EASE_NAMES).default('hand'),
});

export const fillOptions = z.object({
  color: swatch.default('orange'),
  at: whenParam.optional(),
  dur: seconds.default(0.4),
  spacing: z.int().min(2).max(8).default(3).describe('Hatch spacing (px)'),
  dir: z
    .union([z.literal(1), z.literal(-1)])
    .default(1)
    .describe('1 = "\\" hatch, -1 = "/"'),
  dense: z.boolean().default(false).describe('Crayon tooth between the hatch lines'),
  seed: z.int().min(0).optional(),
  held: z.boolean().default(true),
  parallel: z.boolean().default(false).describe('Never take the hand: appears by itself'),
  hero: z.boolean().default(false).describe('The hero mark: keeps its time, others wait'),
  appear: z.enum(APPEAR_KINDS).optional().describe('No hand: bloom, pop or type'),
  attach: attachParam,
});

export const arrowOptions = penOptions.extend({
  head: z.number().min(4).max(40).default(12),
  spread: z.number().min(0.2).max(1.2).default(0.5),
  ease: z.enum(EASE_NAMES).default('hand').describe('Pace of the shaft (sine = slow-fast-slow)'),
});

export const loopOptions = penOptions.extend({
  turns: z
    .number()
    .min(0.8)
    .max(2)
    .default(1.12)
    .describe('More than one turn: never closed neatly'),
  start: z.number().default(-2.4).describe('Start angle (radians)'),
  grow: z.number().min(0).max(0.4).default(0.08),
});

export const underlineOptions = penOptions.extend({
  hook: z.boolean().default(true),
  sag: z.number().min(-10).max(10).default(0),
});

export const crossOutOptions = penOptions.extend({
  tool: z.enum(TOOL_NAMES).default('red'),
  style: z
    .enum(CROSS_STYLES)
    .default('x')
    .describe('x (careful), strike (one line), zigzag (impatient)'),
});

export const sunOptions = penOptions.extend({
  rays: z.int().min(0).max(16).default(9),
  rayScale: z.number().min(0.3).max(2).default(1),
  fill: swatch.or(z.literal('none')).default('orange'),
  fillDur: seconds.default(0.5),
  until: whenParam.optional(),
});

export const figureOptions = z.object({
  x: z.number().describe('Feet (page px)'),
  y: z.number().describe('Ground line'),
  h: z.number().min(30).max(520).default(220).describe('Height'),
  at: whenParam.optional(),
  until: whenParam.optional().describe('Draw the whole figure by then'),
  pose: poseParam.default({}),
  expression: expressionParam.default({}),
  tool: z.enum(TOOL_NAMES).default('felt'),
  belly: z.number().min(-20).max(30).default(0),
  brows: z.boolean().default(true),
  fps: z.number().min(4).max(24).optional(),
  seed: z.int().min(0).optional(),
  subject: z.boolean().default(true).describe('The hand keeps off it when it can (rest rule)'),
  parallel: z.boolean().default(false).describe('Drawn without the hand, on time'),
  hero: z.boolean().default(false).describe('The hero mark: keeps its time, others wait'),
});

export const sheetOptions = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().min(20).max(900),
  h: z.number().min(20).max(520),
  deg: z.number().min(-30).max(30).default(0),
  at: whenParam.optional().describe('Slapped on: lands at this time (default: taped in before)'),
  holes: z.boolean().default(false).describe('Two punched holes at the top'),
  paper: z
    .enum(SHEET_PAPERS)
    .default('paper')
    .describe('paper (white insert), kraft (envelope, brown card), sticky (yellow note)'),
  envelope: z.boolean().default(false).describe('Back of an envelope: printed flap seams'),
  seed: z.int().min(0).optional(),
});

export const calendarOptions = z.object({
  title: z.string().min(1).max(24),
  days: z.int().min(28).max(31).default(31),
  firstColumn: z.int().min(0).max(6).default(0),
  u: z.number().default(20),
  v: z.number().default(80),
  cell: z.number().min(12).max(80).default(40),
  titleSize: z.number().min(8).max(40).default(20),
  numberSize: z.number().min(7).max(30).default(12),
});

export const traceOptions = z.object({
  at: whenParam.optional().describe('When it appears (default: already there)'),
  seed: z.int().min(0).optional(),
});

export const smudgeOptions = traceOptions.extend({
  color: swatch.default('graphiteLight'),
  density: z.number().min(0.05).max(1).default(0.5),
});

export const clipOptions = traceOptions.extend({ scale: z.number().min(0.4).max(3).default(1) });

/** Flat [x, y, ...] or [[x, y], ...] points. */
export const pointsParam = z.union([
  z.array(z.number()).min(2),
  z.array(z.tuple([z.number(), z.number()])).min(1),
]);

export function parse<S extends z.ZodType>(schema: S, value: unknown, call: string): z.output<S> {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(value)'}: ${issue.message}`)
    .join('; ');
  throw new KitError('invalid-params', `${call}: ${details}`);
}

export function flatPoints(value: unknown, call: string): number[] {
  const points = parse(pointsParam, value, call);
  const flat = points.flatMap((point) =>
    typeof point === 'number' ? [point] : [point[0], point[1]],
  );
  if (flat.length % 2 !== 0 || flat.length < 4) {
    throw new KitError('invalid-params', `${call}: points need at least two [x, y] pairs`);
  }
  return flat;
}

export function finite(value: unknown, name: string, call: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new KitError(
      'invalid-params',
      `${call}: ${name} must be a number (got ${String(value)})`,
    );
  }
  return value;
}

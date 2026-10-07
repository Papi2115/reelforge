/**
 * The doodle DSL of the open vocabulary (PLAN.md#13.15a): a drawing is a box of local units and
 * a list of hand-drawn parts (blob, circle, rect, poly, line, arc, dots, rays, hatch, scribble,
 * zigzag, wave), each with a nib (felt, fine, crayon, ballpoint, marker, pencil, red), an ink
 * and an optional coloured fill. Spot art is the tiny-icon DSL: rows of characters and a legend
 * of notebook inks. Every part is validated on its own so an error names the part and the field.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import type { ToolName } from '../draw/marks.js';
import { APPEAR_KINDS } from '../draw/marks.js';
import { SWATCH_NAMES, type SwatchName } from '../inks.js';
import { attachParam } from '../page/motion.js';
import { pointsParam } from '../page/schemas.js';

export const swatch = z.enum(SWATCH_NAMES as unknown as readonly [SwatchName, ...SwatchName[]]);

export const NIB_NAMES = [
  'felt',
  'fine',
  'crayon',
  'ballpoint',
  'marker',
  'pencil',
  'red',
] as const;
export type NibName = (typeof NIB_NAMES)[number];

/** The page tool and default width behind each nib of the DSL. */
export const NIB_TOOLS: Readonly<Record<NibName, { tool: ToolName; width?: number }>> = {
  felt: { tool: 'felt' },
  fine: { tool: 'fine' },
  crayon: { tool: 'cpencil', width: 3 },
  ballpoint: { tool: 'bic' },
  marker: { tool: 'felt', width: 4 },
  pencil: { tool: 'pencil' },
  red: { tool: 'red' },
};

export const SHADES = ['hatch', 'dense', 'light', 'scribble'] as const;
export type Shade = (typeof SHADES)[number];

const n = z.number();
const xy = z.tuple([n, n]);

const common = {
  nib: z.enum(NIB_NAMES).default('felt'),
  color: swatch.optional(),
  width: z.int().min(1).max(8).optional(),
  fill: swatch.optional(),
  shade: z.enum(SHADES).default('hatch'),
  dir: z.union([z.literal(1), z.literal(-1)]).default(1),
  outline: z.boolean().default(true),
  wobble: z.number().min(0.3).max(3).optional(),
};

/** One schema per part kind; a part is an object with exactly one of these keys. */
export const PART_SCHEMAS = {
  blob: z.strictObject({
    ...common,
    blob: z.tuple([n, n, z.number().positive(), z.number().positive()]),
    lumps: z.number().min(0).max(0.5).default(0.12),
    rot: z.number().min(-180).max(180).default(0),
  }),
  circle: z.strictObject({ ...common, circle: z.tuple([n, n, z.number().positive()]) }),
  rect: z.strictObject({
    ...common,
    rect: z.tuple([n, n, z.number().positive(), z.number().positive()]),
  }),
  poly: z.strictObject({ ...common, poly: pointsParam }),
  line: z.strictObject({
    ...common,
    line: pointsParam,
    sharp: z.boolean().default(false),
    arrow: z.boolean().default(false),
  }),
  arc: z.strictObject({ ...common, arc: z.tuple([n, n, z.number().positive(), n, n]) }),
  dots: z.strictObject({
    ...common,
    dots: pointsParam,
    size: z.number().min(1).max(12).default(2),
  }),
  rays: z.strictObject({
    ...common,
    rays: z.tuple([n, n, z.number().min(0), z.number().positive()]),
    count: z.int().min(1).max(32).default(8),
    from: z.number().default(0),
    to: z.number().default(360),
  }),
  hatch: z.strictObject({ ...common, hatch: pointsParam }),
  scribble: z.strictObject({
    ...common,
    scribble: pointsParam,
    spacing: z.number().min(1).max(40).default(6),
    angle: z.number().default(-35),
  }),
  zigzag: z.strictObject({
    ...common,
    zigzag: z.tuple([n, n, n, n]),
    teeth: z.int().min(2).max(60).default(6),
    amp: z.number().min(0).max(200).default(6),
  }),
  wave: z.strictObject({
    ...common,
    wave: z.tuple([n, n, n]),
    count: z.int().min(1).max(30).default(3),
    amp: z.number().min(0).max(200).default(6),
  }),
} as const;

export type PartKind = keyof typeof PART_SCHEMAS;
export const PART_KINDS = Object.keys(PART_SCHEMAS) as PartKind[];
type Outputs = { [K in PartKind]: z.output<(typeof PART_SCHEMAS)[K]> };
export type DoodlePart = Outputs[PartKind];
/** A part as authored (defaults optional): what generators write. */
export type PartInput = { [K in PartKind]: z.input<(typeof PART_SCHEMAS)[K]> }[PartKind];

export const MAX_PARTS = 120;

export const doodleSpecSchema = z.strictObject({
  box: z
    .tuple([z.number().min(1).max(4000), z.number().min(1).max(4000)])
    .default([100, 100])
    .describe('Local units [w, h] the parts are drawn in (y down)'),
  parts: z.array(z.unknown()).min(1).max(MAX_PARTS),
  grip: xy.optional().describe('Where a person holds it (local units)'),
  origin: xy.optional().describe('Top-left of the box in local units (default [0, 0])'),
  wobble: z.number().min(0.3).max(3).default(1).describe('Roughness (1 = the notebook hand)'),
});

export interface DoodleSpec {
  readonly box: readonly [number, number];
  readonly parts: readonly DoodlePart[];
  readonly grip?: readonly [number, number] | undefined;
  /** Top-left of the box in local units (generators fit the box to what they drew). */
  readonly origin?: readonly [number, number] | undefined;
  readonly wobble: number;
}

/** A doodle as generators write it (part defaults optional). */
export interface DoodleInput {
  readonly box: readonly [number, number];
  readonly parts: readonly PartInput[];
  readonly grip?: readonly [number, number] | undefined;
  readonly wobble?: number;
}

function fail(call: string, where: string, error: z.ZodError): never {
  const details = error.issues
    .map((issue) => `${[where, ...issue.path.map(String)].join('.')}: ${issue.message}`)
    .join('; ');
  throw new KitError('invalid-params', `${call}: ${details}`);
}

/** Validates one part: it must have exactly one shape key, then that kind's fields. */
export function parsePart(value: unknown, index: number, call: string): DoodlePart {
  const where = `parts[${String(index)}]`;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new KitError(
      'invalid-params',
      `${call}: ${where} must be an object like { blob: [cx, cy, rx, ry] }`,
    );
  }
  const kinds = PART_KINDS.filter((kind) => kind in value);
  if (kinds.length !== 1) {
    const keys = Object.keys(value).join(', ') || 'none';
    throw new KitError(
      'invalid-params',
      `${call}: ${where} needs exactly one shape key of ${PART_KINDS.join(', ')} (got ${keys})`,
    );
  }
  const kind = kinds[0] as PartKind;
  const result = PART_SCHEMAS[kind].safeParse(value);
  if (!result.success) fail(call, `${where} (${kind})`, result.error);
  return result.data;
}

export function parseDoodle(value: unknown, call: string): DoodleSpec {
  const result = doodleSpecSchema.safeParse(value ?? {});
  if (!result.success) fail(call, 'spec', result.error);
  const spec = result.data;
  return { ...spec, parts: spec.parts.map((part, index) => parsePart(part, index, call)) };
}

/** Generator output: trusted shapes, but defaults filled and checked the same way. */
export function completeDoodle(input: DoodleInput, call: string): DoodleSpec {
  return parseDoodle(input, call);
}

/** Where a drawing goes on the page and how the hand draws it. */
export const placeOptions = z.object({
  x: z.number().describe('Anchor x (page px)'),
  y: z.number().describe('Anchor y (page px; bottom anchor = where it stands)'),
  h: z.number().min(4).max(1200).optional().describe('Height on the page (default the box height)'),
  w: z.number().min(4).max(1600).optional().describe('Width on the page instead of h'),
  anchor: z.enum(['bottom', 'center', 'top-left']).default('bottom'),
  flip: z.boolean().default(false).describe('Mirror it (face the other way)'),
  rot: z.number().min(-180).max(180).default(0).describe('Rotation (degrees)'),
  at: whenParam.optional().describe('Start (s or phrase); default right after the previous mark'),
  until: whenParam.optional().describe('Draw it all by then'),
  speed: z.number().min(0.25).max(4).default(1).describe('Pace multiplier of the hand'),
  seed: z.int().min(0).optional(),
  held: z.boolean().default(true),
  parallel: z.boolean().default(false).describe('Never take the hand: it appears by itself'),
  hero: z
    .boolean()
    .default(false)
    .describe('The hero of the shot: first among marks timed with it'),
  appear: z.enum(APPEAR_KINDS).optional().describe('No hand: bloom, pop or type'),
  subject: z.boolean().default(false).describe('The hand keeps off it (keep-clear box)'),
  attach: attachParam,
});
export type PlaceOptions = z.output<typeof placeOptions>;

const legendEntry = z.union([
  swatch,
  z.strictObject({ color: swatch, nib: z.enum(NIB_NAMES).default('felt') }),
]);

export const spotSchema = z.strictObject({
  rows: z.array(z.string().max(32)).min(1).max(32).describe("Rows of cells; ' ' and '.' are paper"),
  legend: z.record(z.string().length(1), legendEntry).describe('Cell character -> notebook ink'),
  px: z.number().min(2).max(24).default(6).describe('Cell size in local units'),
});
export type SpotArt = z.output<typeof spotSchema>;

export function parseSpot(value: unknown, call: string): SpotArt {
  const result = spotSchema.safeParse(value ?? {});
  if (!result.success) fail(call, 'art', result.error);
  const art = result.data;
  art.rows.forEach((row, y) => {
    Array.from({ length: row.length }, (_, x) => row.charAt(x)).forEach((char, x) => {
      if (char === ' ' || char === '.' || char in art.legend) return;
      const known = Object.keys(art.legend).join(' ') || '(empty)';
      throw new KitError(
        'invalid-params',
        `${call}: art.rows[${String(y)}] column ${String(x)}: '${char}' is not in the legend (${known}; ' ' and '.' are paper)`,
      );
    });
  });
  return art;
}

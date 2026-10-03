/**
 * Runtime validation of `ctx.text` arguments (scenes are plain JS, often written by an LLM): strict
 * zod schemas with defaults, and error messages that name the call, the option and the fix.
 */
import { z } from 'zod';
import { EngineError, type EngineErrorCode } from '../errors.js';

export const FONT_NAMES = ['display', 'mono'] as const;
const SLIDES = ['slide-up', 'slide-down', 'slide-left', 'slide-right'] as const;
/** Enter/exit animations of titles and kinetic exits. */
export const TITLE_ANIMATIONS = [
  'none',
  'fade',
  'wipe',
  'pop',
  'typewriter',
  'shake',
  ...SLIDES,
] as const;
/** Enter/exit animations of lower thirds (the plate moves as one block). */
export const LOWER_THIRD_ANIMATIONS = ['none', 'fade', 'wipe', ...SLIDES] as const;
/** Per-word reveal styles of kinetic text. */
export const KINETIC_STYLES = ['pop', 'typewriter', 'shake'] as const;

export type TitleAnimation = (typeof TITLE_ANIMATIONS)[number];
export type LowerThirdAnimation = (typeof LOWER_THIRD_ANIMATIONS)[number];

/** Largest integer pixel scale of a font. */
export const MAX_TEXT_SCALE = 12;

/** Palette token (`text`, `accent1`, ...) or swatch name of the style. */
const colorName = z.string().min(1);
const optionalColor = z.union([colorName, z.literal(false)]);
/** Normalized frame position: [0, 0] = top-left corner, [1, 1] = bottom-right corner. */
const position = z.tuple([z.number().min(-1).max(2), z.number().min(-1).max(2)]);
const widthFraction = z.number().gt(0).max(1);
const scale = z.int().min(1).max(MAX_TEXT_SCALE);
const font = z.enum(FONT_NAMES);
const align = z.enum(['left', 'center', 'right']);
const valign = z.enum(['top', 'middle', 'bottom']);

const timing = {
  /** Card id used in QA messages; defaults to `<kind>:<first words>`. */
  id: z.string().min(1).optional(),
  /** Local time (s) the card appears. */
  at: z.number().default(0),
  /** Local time (s) the card is gone; omitted = until the end of the shot. */
  until: z.number().optional(),
  enterDuration: z.number().positive().optional(),
  exitDuration: z.number().positive().default(0.3),
};

export const titleOptionsSchema = z.strictObject({
  ...timing,
  enter: z.enum(TITLE_ANIMATIONS).default('pop'),
  exit: z.enum(TITLE_ANIMATIONS).default('fade'),
  pos: position.default([0.5, 0.5]),
  align: align.default('center'),
  valign: valign.default('middle'),
  scale: scale.optional(),
  font: font.default('display'),
  color: colorName.default('text'),
  shadow: optionalColor.default('outline'),
  /** Wrap width as a share of the frame width; defaults to the safe-area width. */
  maxWidth: widthFraction.optional(),
});

export const lowerThirdOptionsSchema = z.strictObject({
  ...timing,
  enter: z.enum(LOWER_THIRD_ANIMATIONS).default('wipe'),
  exit: z.enum(LOWER_THIRD_ANIMATIONS).default('wipe'),
  side: z.enum(['left', 'right']).default('left'),
  /** Scale of the primary line (display font); the secondary line is mono at scale 1. */
  scale: scale.optional(),
  color: colorName.default('text'),
  secondaryColor: colorName.default('textDim'),
  plate: optionalColor.default('shadow'),
  accent: optionalColor.default('accent1'),
  maxWidth: widthFraction.default(0.55),
});

export const kineticWordSchema = z.union([
  z.string(),
  z.strictObject({ text: z.string(), t: z.number().optional() }),
]);

export const kineticWordsSchema = z.union([z.string(), z.array(kineticWordSchema)]);

export const kineticOptionsSchema = z.strictObject({
  id: timing.id,
  at: timing.at,
  until: timing.until,
  exitDuration: timing.exitDuration,
  /** Seconds between word starts (words without their own `t`). */
  perWordDelay: z.number().positive().default(0.25),
  style: z.enum(KINETIC_STYLES).default('pop'),
  exit: z.enum(LOWER_THIRD_ANIMATIONS).default('fade'),
  pos: position.default([0.5, 0.5]),
  align: align.default('center'),
  valign: valign.default('middle'),
  scale: scale.optional(),
  font: font.default('display'),
  color: colorName.default('text'),
  /** Colour of the most recently revealed word (false = no highlight). */
  highlight: optionalColor.default(false),
  shadow: optionalColor.default('outline'),
  maxWidth: widthFraction.optional(),
});

export const measureStyleSchema = z.strictObject({
  font: font.default('display'),
  scale: scale.optional(),
  maxWidth: widthFraction.optional(),
});

export type TitleOptions = z.input<typeof titleOptionsSchema>;
export type LowerThirdOptions = z.input<typeof lowerThirdOptionsSchema>;
export type KineticWord = z.input<typeof kineticWordSchema>;
export type KineticOptions = z.input<typeof kineticOptionsSchema>;
export type MeasureStyle = z.input<typeof measureStyleSchema>;

export type ParsedTitleOptions = z.output<typeof titleOptionsSchema>;
export type ParsedLowerThirdOptions = z.output<typeof lowerThirdOptionsSchema>;
export type ParsedKineticOptions = z.output<typeof kineticOptionsSchema>;
export type ParsedMeasureStyle = z.output<typeof measureStyleSchema>;

/**
 * Parses an argument of a `ctx.text` (or `ctx.annotate`) call (`label` names it in messages) or
 * throws an EngineError (`code`, default `invalid-text-options`) naming the call and the option.
 */
export function parseTextArgument<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  call: string,
  shotId: string,
  label = 'options',
  code: EngineErrorCode = 'invalid-text-options',
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => {
      const where = [label, ...issue.path.map(String)].join('.');
      const known = issue.code === 'unrecognized_keys' ? knownKeys(schema, issue.path) : undefined;
      return `${where}: ${issue.message}${known === undefined ? '' : ` (known options: ${known.join(', ')})`}`;
    })
    .join('; ');
  throw new EngineError(code, `${call}: ${details}`, { shotId });
}

/** Keys of the object schema at `path` (an LLM guessing `position` learns it is `pos`). */
function knownKeys(schema: z.ZodType, path: readonly PropertyKey[]): string[] | undefined {
  let current: z.ZodType = schema;
  for (const segment of path) {
    if (!(current instanceof z.ZodObject) || typeof segment !== 'string') return undefined;
    const next: unknown = current.shape[segment];
    if (!(next instanceof z.ZodType)) return undefined;
    current = next;
  }
  return current instanceof z.ZodObject ? Object.keys(current.shape) : undefined;
}

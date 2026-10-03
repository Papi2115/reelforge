/**
 * Runtime validation of `ctx.annotate.*` options (scenes are plain JS, often written by an LLM):
 * strict zod schemas with defaults. Geometric sizes are shares of the frame height (resolution
 * independent), positions are normalized frame coordinates, strokes and text scales are pixels.
 */
import { z } from 'zod';
import { FONT_NAMES, MAX_TEXT_SCALE } from '../text/options.js';
import { targetSchema } from './target-spec.js';

/** Enter/exit animations of every annotation (see `ANNOTATION_TYPES` for what each does). */
export const ANNOTATION_ANIMATIONS = ['none', 'fade', 'pop', 'draw', 'wipe'] as const;
export type AnnotationAnimation = (typeof ANNOTATION_ANIMATIONS)[number];

export const PIN_SIDES = [
  'auto',
  'up',
  'down',
  'left',
  'right',
  'up-left',
  'up-right',
  'down-left',
  'down-right',
] as const;
export type PinSide = (typeof PIN_SIDES)[number];

export const BADGE_MARKS = ['check', 'cross', '!', '?'] as const;

const colorName = z.string().min(1);
const optionalColor = z.union([colorName, z.literal(false)]);
/** Normalized frame position: [0, 0] = top-left corner, [1, 1] = bottom-right corner. */
const position = z.tuple([z.number().min(-1).max(2), z.number().min(-1).max(2)]);
/** A size as a share of the frame height (0.1 = 36 px at 360 px high). */
const share = z.number().min(0).max(2);
const textScale = z.int().min(1).max(MAX_TEXT_SCALE);
const thickness = z.int().min(1).max(6);

const common = {
  /** Card id used in QA messages; defaults to `<type>:<text>` or `<type>`. */
  id: z.string().min(1).optional(),
  /** Local time (s) it appears; defaults to the time `phrase` is spoken, else 0. */
  at: z.number().optional(),
  /** Local time (s) it is gone; omitted = until the end of the shot. */
  until: z.number().optional(),
  /** Spoken phrase it illustrates (words.json): sets `at` when omitted; QA checks it (±150 ms). */
  phrase: z.string().min(1).optional(),
  /** Which occurrence of `phrase` (1 = first). */
  nth: z.int().min(1).default(1),
  enter: z.enum(ANNOTATION_ANIMATIONS).optional(),
  exit: z.enum(ANNOTATION_ANIMATIONS).default('fade'),
  enterDuration: z.number().positive().optional(),
  exitDuration: z.number().positive().default(0.3),
  /** Main colour (palette token or swatch); the default depends on the type. */
  color: colorName.optional(),
  /** 1 px dark rim around strokes and plates for contrast (false = none). */
  outline: optionalColor.default('outline'),
};

const label = {
  /** Integer pixel scale of the label text (default 2 at 360 px high). */
  scale: textScale.optional(),
  font: z.enum(FONT_NAMES).default('display'),
  textColor: colorName.default('text'),
  /** Plate behind the label (false = text only, with an outline shadow). */
  plate: optionalColor.default('shadow'),
};

export const calloutOptionsSchema = z.strictObject({
  ...common,
  ...label,
  /** Body text (wrapped to maxWidth). */
  text: z.string(),
  /** Optional header bar text (drawn dark on the main colour). */
  title: z.string().optional(),
  /** What the pointer tail points at; omit for a free-standing box. */
  target: targetSchema.optional(),
  /** Centre of the box; default: next to the target, inside the safe area, away from other cards. */
  pos: position.optional(),
  /** Wrap width as a share of the frame width. */
  maxWidth: z.number().gt(0).max(1).default(0.34),
  corner: z.enum(['square', 'round', 'cut']).default('round'),
  tail: z.boolean().default(true),
});

export const arrowOptionsSchema = z.strictObject({
  ...common,
  ...label,
  /** Where the head points. */
  target: targetSchema,
  /** Where the tail starts; default: `length` away from the target, towards the frame centre. */
  from: targetSchema.optional(),
  curve: z.enum(['straight', 'curved', 'elbow']).default('straight'),
  /** Sideways bulge of a curved arrow as a share of its length (negative = other side). */
  bend: z.number().min(-1).max(1).default(0.25),
  /** Arrow length when `from` is omitted (frame-height share). */
  length: share.default(0.2),
  /** Pixels left free between the head and the target. */
  gap: z.int().min(0).max(40).default(3),
  head: z.enum(['triangle', 'open', 'none']).default('triangle'),
  /** The head nudges towards the target once drawn. */
  bounce: z.boolean().default(true),
  thickness: thickness.optional(),
  /** Optional label at the tail. */
  text: z.string().optional(),
});

export const ringOptionsSchema = z.strictObject({
  ...common,
  target: targetSchema,
  shape: z.enum(['circle', 'rect']).default('circle'),
  /** Circle radius (frame-height share); default: fits the target's projected bounds. */
  radius: share.optional(),
  /** Rect size [w, h] (frame-height shares); default: fits the target. */
  size: z.tuple([share, share]).optional(),
  /** Pixels of air between the target bounds and the ring. */
  padding: z.int().min(0).max(60).default(4),
  /** Gentle breathing of the radius once drawn. */
  pulse: z.boolean().default(true),
  dashed: z.boolean().default(false),
  thickness: thickness.optional(),
});

export const bracketOptionsSchema = z.strictObject({
  ...common,
  ...label,
  /** The two ends of the span (e.g. the first and the last of three props). */
  from: targetSchema,
  to: targetSchema,
  style: z.enum(['curly', 'square']).default('curly'),
  /** Distance from the span to the bracket (frame-height share). */
  offset: share.default(0.03),
  /** Depth of the bracket shape (frame-height share). */
  depth: share.default(0.05),
  /** Default side: above a horizontal span, away from the frame centre otherwise. */
  flip: z.boolean().default(false),
  thickness: thickness.optional(),
  /** Label at the tip of the bracket. */
  text: z.string().optional(),
});

export const pinOptionsSchema = z.strictObject({
  ...common,
  ...label,
  target: targetSchema,
  text: z.string(),
  /** Where the label sits relative to the target; auto keeps it in the safe area. */
  side: z.enum(PIN_SIDES).default('auto'),
  /** Leader line length (frame-height share). */
  length: share.default(0.09),
  /** Hide the pin while its target is behind other geometry. */
  occlude: z.boolean().default(false),
  thickness: thickness.optional(),
});

export const underlineOptionsSchema = z.strictObject({
  ...common,
  /** Usually `{ card: '<text card id>', words: [first, last] }`; any target with bounds works. */
  target: targetSchema,
  style: z.enum(['line', 'double', 'scribble']).default('line'),
  /** Pixels between the text and the line. */
  gap: z.int().min(0).max(20).default(2),
  thickness: thickness.optional(),
});

export const highlightOptionsSchema = z.strictObject({
  ...common,
  target: targetSchema,
  /** Pixels the marker bar extends around the target bounds. */
  padding: z.int().min(0).max(20).default(2),
});

export const badgeOptionsSchema = z.strictObject({
  ...common,
  /** A number (0-99) or a mark: 'check', 'cross', '!', '?'. */
  value: z.union([z.int().min(0).max(99), z.enum(BADGE_MARKS)]),
  /** Where the badge is centred; or use pos. */
  target: targetSchema.optional(),
  pos: position.optional(),
  /** Pixel nudge [dx, dy] from the target point (e.g. [12, -12] = up-right of it). */
  nudge: z.tuple([z.int().min(-200).max(200), z.int().min(-200).max(200)]).default([0, 0]),
  shape: z.enum(['circle', 'square', 'none']).default('circle'),
  /** Diameter (frame-height share); default: fits the number at the label text scale. */
  size: share.optional(),
  /** Colour of the number/mark; default: dark on the badge, the main colour with shape 'none'. */
  textColor: colorName.optional(),
  pulse: z.boolean().default(false),
});

export const stampOptionsSchema = z.strictObject({
  ...common,
  text: z.string(),
  target: targetSchema.optional(),
  pos: position.optional(),
  /** Degrees, clockwise. */
  rotate: z.number().min(-45).max(45).default(-12),
  /** Integer pixel scale of the letters (default 3 at 360 px high). */
  scale: textScale.optional(),
  /** Share of missing ink pixels (worn rubber stamp look). */
  texture: z.number().min(0).max(0.6).default(0.12),
  border: z.enum(['double', 'single', 'none']).default('double'),
});

export const dimensionOptionsSchema = z.strictObject({
  ...common,
  ...label,
  from: targetSchema,
  to: targetSchema,
  /** The measured value, e.g. '15 CM'. */
  text: z.string(),
  /** Distance from the measured points to the line (frame-height share). */
  offset: share.default(0.04),
  flip: z.boolean().default(false),
  ends: z.enum(['ticks', 'arrows']).default('ticks'),
  thickness: thickness.optional(),
});

export const spotlightOptionsSchema = z.strictObject({
  ...common,
  target: targetSchema,
  shape: z.enum(['circle', 'rect']).default('circle'),
  radius: share.optional(),
  size: z.tuple([share, share]).optional(),
  padding: z.int().min(0).max(80).default(8),
  /** How dark the rest of the frame gets (share of dithered pixels). */
  dim: z.number().min(0.1).max(1).default(0.7),
  /** Width of the dithered soft edge (frame-height share). */
  feather: share.default(0.05),
});

export type CalloutOptions = z.input<typeof calloutOptionsSchema>;
export type ArrowOptions = z.input<typeof arrowOptionsSchema>;
export type RingOptions = z.input<typeof ringOptionsSchema>;
export type BracketOptions = z.input<typeof bracketOptionsSchema>;
export type PinOptions = z.input<typeof pinOptionsSchema>;
export type UnderlineOptions = z.input<typeof underlineOptionsSchema>;
export type HighlightOptions = z.input<typeof highlightOptionsSchema>;
export type BadgeOptions = z.input<typeof badgeOptionsSchema>;
export type StampOptions = z.input<typeof stampOptionsSchema>;
export type DimensionOptions = z.input<typeof dimensionOptionsSchema>;
export type SpotlightOptions = z.input<typeof spotlightOptionsSchema>;

export type ParsedCallout = z.output<typeof calloutOptionsSchema>;
export type ParsedArrow = z.output<typeof arrowOptionsSchema>;
export type ParsedRing = z.output<typeof ringOptionsSchema>;
export type ParsedBracket = z.output<typeof bracketOptionsSchema>;
export type ParsedPin = z.output<typeof pinOptionsSchema>;
export type ParsedUnderline = z.output<typeof underlineOptionsSchema>;
export type ParsedHighlight = z.output<typeof highlightOptionsSchema>;
export type ParsedBadge = z.output<typeof badgeOptionsSchema>;
export type ParsedStamp = z.output<typeof stampOptionsSchema>;
export type ParsedDimension = z.output<typeof dimensionOptionsSchema>;
export type ParsedSpotlight = z.output<typeof spotlightOptionsSchema>;

/** Options every annotation shares (after parsing). */
export type CommonParsed = Pick<
  ParsedArrow,
  'id' | 'at' | 'until' | 'phrase' | 'nth' | 'enter' | 'exit' | 'enterDuration' | 'exitDuration'
> &
  Pick<ParsedArrow, 'color' | 'outline'>;

/** Every annotation type with its schema, default colour and default enter animation. */
export const ANNOTATION_TYPES = {
  callout: { schema: calloutOptionsSchema, color: 'accent1', enter: 'pop' },
  arrow: { schema: arrowOptionsSchema, color: 'accent1', enter: 'draw' },
  ring: { schema: ringOptionsSchema, color: 'accent2', enter: 'draw' },
  bracket: { schema: bracketOptionsSchema, color: 'accent1', enter: 'draw' },
  pin: { schema: pinOptionsSchema, color: 'accent1', enter: 'draw' },
  underline: { schema: underlineOptionsSchema, color: 'accent2', enter: 'draw' },
  highlight: { schema: highlightOptionsSchema, color: 'accent4', enter: 'wipe' },
  badge: { schema: badgeOptionsSchema, color: 'accent1', enter: 'pop' },
  stamp: { schema: stampOptionsSchema, color: 'accent2', enter: 'pop' },
  dimension: { schema: dimensionOptionsSchema, color: 'accent1', enter: 'draw' },
  spotlight: { schema: spotlightOptionsSchema, color: 'outline', enter: 'fade' },
} as const;

export type AnnotationType = keyof typeof ANNOTATION_TYPES;
export const ANNOTATION_TYPE_NAMES = Object.keys(ANNOTATION_TYPES) as AnnotationType[];

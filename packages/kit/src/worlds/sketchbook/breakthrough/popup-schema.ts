/**
 * Spec of `page.popup(...)`: a pop-up card as a creative toolkit, not a template. The card, at
 * most eight paper pieces (standing on the fold: block, cutout; on the backdrop: arm, card,
 * flap, gauge, wheel, counter, window, scale; static: tag, note), the opening, and a pull: a tab
 * (tab, ribbon, knob or lever, left, right or bottom) whose progress p in [0, 1] drives the
 * pieces through `motions` (each moves named properties of one piece over a span of p) and/or a
 * pure `drive(p, t)` callback. `intent` (required) says what claim the motion shows. Positions
 * are card px: `u` from the card's left edge, `depth` from the fold toward the viewer, `v` up
 * the backdrop from the fold. The rules zod cannot say live in popup-check.ts.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { EASE_NAMES } from '../draw/math.js';
import { SWATCH_NAMES, type SwatchName } from '../inks.js';
import { ASSET_ID } from '../vocab/library.js';

export const POPUP_LIMITS = { elements: 8, arms: 2, motions: 8 } as const;
/** Height of the arm pivot above the fold (card px). */
export const ARM_PIVOT = 8;

const swatch = z.enum(SWATCH_NAMES as unknown as readonly [SwatchName, ...SwatchName[]]);
const text = (max: number) => z.string().min(1).max(max);
const id = z
  .string()
  .regex(/^[A-Za-z][\w-]{0,23}$/)
  .optional()
  .describe('Name of the piece, for pull motions (letters, digits, - or _)');
const rises = whenParam.optional().describe('Stands up at this time (default: with the card)');
const asset = z
  .string()
  .regex(ASSET_ID)
  .optional()
  .describe(
    "A film asset id (ctx.worldAssets figure or prop, or defineFigure / defineProp) drawn on the piece instead of draw: the film's own subject moves with the pull",
  );
const v = z.number().min(0).describe('Height up the backdrop from the fold (card px)');

const block = z.object({
  kind: z.literal('block'),
  id,
  u: z.number().min(0).describe('Left edge (card px from the card left)'),
  w: z.number().min(40).max(220).default(102),
  h: z.number().min(30).max(140).default(72).describe('Height when standing'),
  depth: z.number().min(10).max(140).default(30).describe('Foot distance from the fold'),
  band: text(12).optional().describe('Small printed word on a dark band (MARCH)'),
  text: text(6).describe('Big printed word or number on the front (21)'),
  at: rises,
});

const cutout = z.object({
  kind: z.literal('cutout'),
  id,
  u: z.number().min(0),
  w: z.number().min(40).max(220).default(80),
  h: z.number().min(50).max(160).default(110),
  depth: z.number().min(10).max(140).default(60),
  draw: z.enum(['figure', 'sun', 'none']).default('figure').describe('Felt drawing on the card'),
  asset,
  pose: z.enum(['stand', 'cheer', 'point']).default('stand'),
  text: text(12).optional().describe('Hand-lettered word under the drawing'),
  at: rises,
});

const arm = z.object({
  kind: z.literal('arm'),
  id,
  u: z.number().min(0).describe('Pivot (brad) on the backdrop, card px from the left'),
  length: z.number().min(60).max(220).default(160),
  piece: z.enum(['sun', 'disc']).default('sun').describe('Cut-paper sun, or a coloured disc'),
  color: swatch.default('skyPencil').describe('Colour of a disc'),
  label: text(4).optional().describe('Printed on a disc (a disc must say what it is)'),
  angle: z.number().min(-70).max(70).default(22.7).describe('Degrees from upright, + = right'),
});

const paper = z.enum(['paper', 'kraft', 'sticky']).default('paper');

const card = z.object({
  kind: z.literal('card'),
  id,
  u: z.number().min(0).describe('Centre (card px from the left)'),
  v,
  w: z.number().min(30).max(260).default(90),
  h: z.number().min(24).max(160).default(60),
  text: text(14).optional().describe('Printed on it'),
  draw: z.enum(['none', 'figure', 'sun']).default('none'),
  asset,
  paper,
  deg: z.number().min(-30).max(30).default(0),
});

const flap = z.object({
  kind: z.literal('flap'),
  id,
  u: z.number().min(0).describe('Centre of what it covers'),
  v,
  w: z.number().min(30).max(300).default(110),
  h: z.number().min(24).max(170).default(80),
  hinge: z.enum(['left', 'right', 'top', 'bottom']).default('left'),
  text: text(12).optional().describe('Printed on its front (what you see before it opens)'),
  paper: paper.default('kraft'),
});

const gauge = z.object({
  kind: z.literal('gauge'),
  id,
  u: z.number().min(0).describe('Centre of the tube'),
  v: v.describe('Bottom of the tube'),
  h: z.number().min(60).max(180).default(130),
  w: z.number().min(14).max(44).default(22),
  level: z.number().min(0).max(1).default(0.15).describe('Filled share before the pull'),
  bulb: z.boolean().default(true).describe('Thermometer bulb at the bottom'),
  label: text(10).optional(),
  marks: z.array(text(8)).max(4).default([]).describe('Tick labels, bottom to top'),
  color: swatch.default('red'),
});

const wheel = z.object({
  kind: z.literal('wheel'),
  id,
  u: z.number().min(0).describe('Centre'),
  v,
  r: z.number().min(24).max(90).default(52),
  labels: z.array(text(8)).min(2).max(8).describe('Around the rim; the top one is read'),
  angle: z.number().min(-720).max(720).default(0),
  teeth: z.boolean().default(false).describe('A gear (teeth) instead of a dial'),
  color: swatch.default('orange'),
});

const counter = z.object({
  kind: z.literal('counter'),
  id,
  u: z.number().min(0).describe('Centre'),
  v,
  from: z.number().min(-99999).max(99999).describe('The number shown before the pull'),
  size: z.number().min(16).max(48).default(30),
  prefix: z.string().max(4).default(''),
  suffix: z.string().max(6).default(''),
});

const windowPiece = z.object({
  kind: z.literal('window'),
  id,
  u: z.number().min(0).describe('Centre of the opening'),
  v,
  w: z.number().min(40).max(220).default(110),
  h: z.number().min(24).max(80).default(40),
  items: z.array(text(12)).min(2).max(6).describe('On a strip behind the opening, top to bottom'),
});

const scale = z.object({
  kind: z.literal('scale'),
  id,
  u: z.number().min(0).describe('Left end'),
  v,
  w: z.number().min(80).max(360).default(220),
  ends: z.tuple([text(10), text(10)]).describe('Labels of the two ends'),
  ticks: z.int().min(2).max(10).default(5),
  value: z.number().min(0).max(1).default(0).describe('Pointer before the pull (0-1)'),
});

const tag = z.object({
  kind: z.literal('tag'),
  lines: z.array(text(10)).min(1).max(2).describe('One or two short words'),
  u: z.number().optional().describe('Card px (default: below the first block, right)'),
  depth: z.number().optional(),
});

const note = z.object({
  kind: z.literal('note'),
  text: text(28).describe("The maker's pencil note on the card floor"),
  u: z.number().default(34),
  depth: z.number().default(114),
});

export const popupElement = z.discriminatedUnion('kind', [
  block,
  cutout,
  arm,
  card,
  flap,
  gauge,
  wheel,
  counter,
  windowPiece,
  scale,
  tag,
  note,
]);
export type PopupElement = z.output<typeof popupElement>;
export type PopupKind = PopupElement['kind'];

/** What a pull may move, per kind (card px, degrees, 0-1 shares, numbers). */
export const MOTION_PROPS: Readonly<Record<PopupKind, readonly string[]>> = {
  block: ['rise', 'slide'],
  cutout: ['rise', 'slide'],
  arm: ['angle'],
  card: ['x', 'y', 'rotate', 'scale', 'show'],
  flap: ['open'],
  gauge: ['level'],
  wheel: ['angle'],
  counter: ['value'],
  window: ['index'],
  scale: ['value'],
  tag: [],
  note: [],
};

const props = z.record(z.string(), z.number());

const motion = z.object({
  target: z.string().describe('id of the piece it moves'),
  to: props.describe('Values at the end of its span, e.g. { level: 0.9 } or { x: 120, y: 30 }'),
  from: props.optional().describe("Values at the start (default: the piece's own)"),
  span: z
    .tuple([z.number().min(0).max(1), z.number().min(0).max(1)])
    .default([0, 1])
    .describe('Share of the pull it plays over (stagger, chain)'),
  ease: z.enum(EASE_NAMES).default('inOut'),
  arc: z.number().min(-200).max(200).default(0).describe('x/y move along an arc (bend, card px)'),
  vary: z.number().min(0).max(0.3).default(0).describe('Seeded jitter of the span'),
});
export type PopupMotion = z.output<typeof motion>;

/** Pure callback: piece values for pull progress p and page time t, by piece id. */
export type PopupDrive = (
  p: number,
  t: number,
) => Readonly<Record<string, Readonly<Record<string, number>>>>;

const pull = z.object({
  at: whenParam.describe('The red pen takes the tab'),
  tab: z.enum(['tab', 'ribbon', 'knob', 'lever']).default('tab'),
  side: z.enum(['left', 'right', 'bottom']).default('left'),
  dur: z.number().min(0.4).max(3).default(0.98).describe('How long the pull takes (s)'),
  ease: z.enum(['inOut', 'out', 'back', 'lin', 'sine']).default('inOut'),
  motions: z.array(motion).max(POPUP_LIMITS.motions).default([]),
  drive: z
    .custom<PopupDrive>(
      (value) => typeof value === 'function',
      'drive must be (p, t) => ({ id: { prop: n } })',
    )
    .optional(),
  focus: z
    .string()
    .optional()
    .describe("id of the piece the red pen marks (default: the first motion's target)"),
  callout: z
    .enum(['loop', 'trail', 'notch', 'none'])
    .default('loop')
    .describe(
      'Red mark after the pull: loop round the moved piece, trail (arrow along the move + loop), notch (arm: loop on the spot it left + arrow), none',
    ),
});
export type PopupPull = z.output<typeof pull>;

export const popupOptions = z.object({
  intent: z
    .string()
    .min(12)
    .max(160)
    .describe('The claim the motion shows (what the pull does and why it matters)'),
  x: z.number().min(40).max(700).default(380).describe('Left edge of the card (page px)'),
  y: z.number().min(60).max(400).default(272).describe('The fold line (page px)'),
  w: z.number().min(200).max(600).default(412).describe('Card width'),
  depth: z.number().min(120).max(240).default(196).describe('Depth of the base and of the cover'),
  at: whenParam.optional().describe('The pencil hand starts lifting the cover (default 0.36)'),
  elements: z.array(popupElement).min(1).max(POPUP_LIMITS.elements),
  pull: pull.optional(),
  camera: z
    .object({
      dx: z.number().min(-90).max(90).default(0),
      dy: z.number().min(-90).max(90).default(0),
    })
    .default({ dx: 0, dy: 0 })
    .describe('Eye drift (page px) while the card opens: parallax of the standing pieces'),
  seed: z.int().min(0).optional(),
});
export type PopupOptions = z.output<typeof popupOptions>;

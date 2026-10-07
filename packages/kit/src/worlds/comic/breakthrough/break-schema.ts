/**
 * Spec of `page.panelBreak(...)`: the open composition toolkit of the Comic breakthroughs
 * (PLAN.md#13.15, docs/worlds/DECISIONS.md "Comic breakthroughs are never a template"). A break
 * is 1-5 panels the scene shapes and places itself, whose MOTION carries the claim of the
 * narration (`intent`, required): how each panel arrives (`enter`), how panels move, turn, grow
 * or rearrange on the narration's beats (`moves`, one panel leading and others dragged after it
 * with `lag`; or a pure `drive(t)`), what the gutters do meanwhile (`gutters`), the camera inside
 * each panel, and whether the panels are printed as the older sepia job of a look back (`print`).
 * Rules zod cannot say (ids, targets, times, the page box) live in break.ts.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { EASE_NAMES } from '../draw/math.js';
import type { ComicPen } from '../page/pen.js';

/** A break panel's painter: panel-local px ((0, 0) = its top-left), size = its [w, h] now. */
export type BreakPainter = (g: ComicPen, t: number, size: readonly [number, number]) => void;

/** Pure offsets per panel id at shot time t (added to the moves). */
export type BreakDrive = (
  t: number,
) => Readonly<
  Record<string, Readonly<{ x?: number; y?: number; rotate?: number; scale?: number }>>
>;

export const BREAK_LIMITS = { panels: 5, moves: 12, camera: 6, rotate: 12, when: 40 } as const;
export const BREAK_SHAPES = ['rect', 'lean', 'wedge', 'shard'] as const;
export const BREAK_ENTERS = [
  'cut',
  'slide',
  'slam',
  'pop',
  'drop',
  'swing',
  'grow',
  'unroll',
] as const;
export const BREAK_GUTTERS = ['keep', 'close', 'lift', 'tear'] as const;
export const BREAK_SIDES = ['left', 'right', 'top', 'bottom'] as const;
/** What a move may change, as the guard reads it (`moves x,rotate`). */
export const BREAK_MOVE_PROPS = ['x', 'y', 'rotate', 'scale', 'box', 'border'] as const;

export type BreakEnter = (typeof BREAK_ENTERS)[number];
export type BreakSide = (typeof BREAK_SIDES)[number];

const id = z
  .string()
  .regex(/^[A-Za-z][\w-]{0,23}$/, 'an id is a name: letters, digits, - or _ (up to 24)');

const box = z
  .tuple([z.number(), z.number(), z.number().min(40).max(720), z.number().min(30).max(420)])
  .describe('[x, y, w, h] page px (640x360)');

const quad = z.array(z.number()).length(8, 'a quad is 8 numbers [x0, y0, ..., x3, y3]');

const painter = z.custom<BreakPainter>((value) => typeof value === 'function', {
  message: 'draw must be a painter (g, t, [w, h]) => { ... }',
});

const cameraKey = z.object({
  at: whenParam,
  x: z.number().describe('Panel-local content point at the panel centre'),
  y: z.number(),
  zoom: z.number().min(0.25).max(6).default(1),
  ease: z.enum(EASE_NAMES).default('inOutCubic'),
});

const panel = z.object({
  id,
  box: box.optional(),
  quad: quad.optional().describe('Exact corners instead of box + shape (clockwise from top left)'),
  shape: z
    .enum(BREAK_SHAPES)
    .default('rect')
    .describe(
      "From the box: 'rect' hand-ruled, 'lean' parallelogram, 'wedge' one short side, 'shard'",
    ),
  lean: z.number().min(-80).max(80).default(14).describe('px of lean / wedge / shard'),
  draw: painter.describe("The panel's content in panel-local px, t = shot time"),
  at: whenParam.optional().describe('It arrives (default: the break at)'),
  enter: z.enum(BREAK_ENTERS).default('cut'),
  from: z.enum(BREAK_SIDES).default('left').describe('Side or hinge of the entrance'),
  dur: z.number().min(0.08).max(2.5).optional().describe('Entrance seconds'),
  until: whenParam.optional().describe('It leaves (default: the break until)'),
  border: z.number().int().min(0).max(4).default(3),
  camera: z.array(cameraKey).max(BREAK_LIMITS.camera).default([]),
  print: z
    .enum(['present', 'past'])
    .optional()
    .describe("This panel's print job (default: the break's): a then-and-now in one break"),
});

const moveTo = z
  .object({
    x: z.number().min(-700).max(700).optional().describe('px right of its rest place'),
    y: z.number().min(-420).max(420).optional().describe('px below its rest place'),
    rotate: z.number().min(-BREAK_LIMITS.rotate).max(BREAK_LIMITS.rotate).optional(),
    scale: z.number().min(0.2).max(3).optional(),
    box: box.optional().describe('A new place and size (rearrange, grow to the bleed)'),
    border: z.number().min(0).max(5).optional(),
  })
  .refine((to) => Object.keys(to).length > 0, 'a move changes x, y, rotate, scale, box or border');

const move = z.object({
  target: z.union([id, z.array(id).min(1).max(BREAK_LIMITS.panels)]),
  at: whenParam,
  dur: z.number().min(0.05).max(4).default(0.6),
  ease: z.enum(EASE_NAMES).default('inOutCubic'),
  lag: z.number().min(0).max(1.5).default(0).describe('Seconds each next target follows the first'),
  to: moveTo,
});

export const breakSchema = z.object({
  intent: z
    .string()
    .trim()
    .min(12, 'intent is required: the claim the motion shows (one sentence)')
    .max(240),
  at: whenParam.default(0),
  until: whenParam.optional(),
  print: z
    .enum(['present', 'past'])
    .default('present')
    .describe("'past' = the panels printed as the older sepia job (a look back)"),
  when: z
    .string()
    .trim()
    .min(1)
    .max(BREAK_LIMITS.when)
    .optional()
    .describe('Time-stamp caption on the first past panel (else the first panel)'),
  type: z.number().min(0).max(3).default(0).describe('Seconds to letter `when` in (0 = at once)'),
  fold: z.number().min(200).max(440).optional().describe('x of a spine crease through the panels'),
  gutters: z
    .object({
      kind: z.enum(BREAK_GUTTERS).default('keep'),
      at: whenParam.optional().describe('Default: the first move'),
      dur: z.number().min(0.1).max(4).default(0.8),
    })
    .default({ kind: 'keep', dur: 0.8 }),
  panels: z
    .array(panel)
    .min(1)
    .max(BREAK_LIMITS.panels, `at most ${String(BREAK_LIMITS.panels)} panels`),
  moves: z
    .array(move)
    .max(BREAK_LIMITS.moves, `at most ${String(BREAK_LIMITS.moves)} moves`)
    .default([]),
  drive: z
    .custom<BreakDrive>((value) => typeof value === 'function', {
      message: 'drive must be (t) => ({ id: { x, y, rotate, scale } })',
    })
    .optional(),
});

export type BreakSpec = z.output<typeof breakSchema>;
export type BreakPanelSpec = BreakSpec['panels'][number];
export type BreakMoveSpec = BreakSpec['moves'][number];
export type BreakBox = readonly [number, number, number, number];

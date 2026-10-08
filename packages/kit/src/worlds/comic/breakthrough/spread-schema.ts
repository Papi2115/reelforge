/**
 * Spec of `page.spread(...)`: the double-page spread of the Comic world as a creative toolkit,
 * not a template. The frame becomes two pages with a fold; ONE picture (`art`, page px, may
 * bleed past every edge) crosses the fold; how it arrives is the scene's choice (`assemble`:
 * panels that turn out to be one picture and merge, the book opening from the spine, or one
 * small panel whose camera pulls back to the whole spread); up to three small inset panels land
 * on it later. `intent` (required) says what the big picture shows. A finished spread may hold
 * still, but never more than 4 s without a new beat (`beats` = narration lines or sounds landing,
 * plus any inset, note or balloon on the page); the check runs on the first frame.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import type { Painter } from '../page/panel.js';

export const SPREAD_LIMITS = { insets: 3, hold: 4, beats: 12 } as const;

export const SPREAD_ASSEMBLIES = ['merge', 'unfold', 'pull-back'] as const;
export const SPREAD_PIECES = ['grid', 'columns', 'halves'] as const;

const painter = z.custom<Painter>((value) => typeof value === 'function', {
  message: 'must be a painter (g, t) => { ... }',
});

const inset = z.object({
  box: z
    .tuple([z.number(), z.number(), z.number().min(60).max(320), z.number().min(40).max(220)])
    .describe('[x, y, w, h] page px; a small panel over the spread'),
  at: whenParam,
  until: whenParam.optional(),
  draw: painter,
  kind: z.enum(['pop', 'slam', 'slide']).default('pop'),
  from: z.enum(['left', 'right', 'top', 'bottom']).default('right'),
});

export const spreadSchema = z.object({
  intent: z
    .string()
    .trim()
    .min(12, 'intent is required: the claim the big picture shows (one sentence)')
    .max(240),
  art: painter.describe(
    'The one big picture across both pages (page px 640x360, bleed past the edges)',
  ),
  at: whenParam.default(0).describe('The spread starts assembling'),
  until: whenParam
    .optional()
    .describe('The spread ends (default: the page duration, kit.fx.comicPage({ duration }))'),
  // No defaults: a default would replay the showcase's own spread (PLAN.md#13.15).
  assemble: z.enum(SPREAD_ASSEMBLIES),
  pieces: z
    .enum(SPREAD_PIECES)
    .optional()
    .describe(
      "merge (required there): the panels it starts as ('grid' 4, 'columns' 3, 'halves' 3 split at the fold)",
    ),
  delay: z
    .number()
    .min(0)
    .max(3)
    .default(0)
    .describe(
      'Seconds the starting state (panels, closed book, small panel) holds before it assembles',
    ),
  dur: z.number().min(0.5).max(2.5).default(1.4).describe('Seconds the assembly takes'),
  focus: z
    .tuple([z.number(), z.number()])
    .optional()
    .describe('pull-back: the detail the camera starts on (page px)'),
  fold: z.number().min(260).max(380).default(320).describe('x of the spine crease'),
  insets: z
    .array(inset)
    .max(SPREAD_LIMITS.insets, `at most ${String(SPREAD_LIMITS.insets)} insets`)
    .default([]),
  beats: z
    .array(whenParam)
    .max(SPREAD_LIMITS.beats)
    .default([])
    .describe('When narration lines or sounds land while the spread holds'),
});

export type SpreadSpec = z.output<typeof spreadSchema>;

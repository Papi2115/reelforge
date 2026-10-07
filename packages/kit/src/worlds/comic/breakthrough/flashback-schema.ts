/**
 * Spec of `page.flashback(...)`: the sepia retrospective strip of the Comic world as a creative
 * toolkit, not a template. An older print job (brown key, one tan tint on yellowed stock, a
 * coarser screen at another angle) of 1-5 narrated beats revealed panel by panel; `when` is the
 * time-stamp caption that opens it; `intent` (required) says what the look back shows. How the
 * past sits on the page (`cover`: the whole page re-inked, or a torn strip pasted over the
 * present) and how its beats are arranged (`arrange`) are the scene's choices. Rules zod cannot
 * say (beat order, spans) live in flashback.ts.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import type { ComicPen } from '../page/pen.js';

/** A beat's painter: beat-local px ((0, 0) = its panel's top-left), size = [w, h] of the panel. */
export type BeatPainter = (g: ComicPen, t: number, size: readonly [number, number]) => void;

export const FLASHBACK_LIMITS = { beats: 5, caption: 40, stamp: 6 } as const;

export const FLASHBACK_ARRANGES = ['rows', 'row', 'stair', 'pile'] as const;
export type FlashbackArrange = (typeof FLASHBACK_ARRANGES)[number];

const painter = z.custom<BeatPainter>((value) => typeof value === 'function', {
  message: 'draw must be a painter (g, t, [w, h]) => { ... }',
});

const caption = z.string().trim().min(1).max(FLASHBACK_LIMITS.caption);

const beat = z.object({
  at: whenParam.describe('When this beat of the narration lands: its panel is revealed then'),
  draw: painter.describe(
    "The beat's panel content in beat-local px ((0, 0) = its top-left), t = shot time",
  ),
  weight: z.number().min(0.4).max(3).default(1).describe('Panel share (size = importance)'),
  caption: caption.optional().describe('A caption on this panel (MEANWHILE...)'),
  enter: z.enum(['cut', 'slide', 'pop']).default('cut'),
});

const box = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .describe('[x0, y0, x1, y1] page px the beats are laid out in');

export const flashbackSchema = z.object({
  intent: z
    .string()
    .trim()
    .min(12, 'intent is required: the claim this look back shows (one sentence)')
    .max(240),
  when: caption.describe('The time-stamp caption that opens it (EIGHT YEARS EARLIER...)'),
  at: whenParam.default(0).describe('The past arrives'),
  until: whenParam.optional().describe('The past leaves (default: it holds to the end)'),
  // No defaults: a default pair would replay the showcase's own flashback (PLAN.md#13.15).
  cover: z
    .enum(['page', 'strip'])
    .describe(
      "'page' = the whole page is the older print; 'strip' = a torn strip of it pasted over the present",
    ),
  arrange: z.enum(FLASHBACK_ARRANGES),
  type: z
    .number()
    .min(0)
    .max(3)
    .default(0)
    .describe(
      'Seconds to letter `when` in, letter by letter (beat captions a bit faster); 0 = at once',
    ),
  box: box.optional(),
  tilt: z.number().min(-4).max(4).optional().describe('Degrees a strip is pasted at'),
  enter: z.enum(['slide', 'drop', 'cut']).default('slide').describe('How a strip arrives'),
  beats: z
    .array(beat)
    .min(1)
    .max(FLASHBACK_LIMITS.beats, `at most ${String(FLASHBACK_LIMITS.beats)} beats`),
  stamp: z
    .object({
      text: z.string().trim().min(1).max(FLASHBACK_LIMITS.stamp),
      at: whenParam,
      x: z.number().optional(),
      y: z.number().optional(),
      angle: z.number().min(-0.5).max(0.5).optional(),
    })
    .optional()
    .describe('A rubber date stamp in stamp red (the only red of the past)'),
});

export type FlashbackSpec = z.output<typeof flashbackSchema>;
export type FlashbackBeat = FlashbackSpec['beats'][number];
export type Box = readonly [number, number, number, number];

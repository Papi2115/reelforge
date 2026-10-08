/**
 * The automap spec (`view.automap(spec)`, PLAN.md#13.4): a Doom overhead map of the shot's own
 * level, generated from its grid. A toolkit, not a template: the scene says what the map is FOR
 * (`intent`, required), which rooms are done / next / ahead and what they are called (words of
 * the narration), whether the arrow replays the walk, where the camera holds, which marks and
 * margin note make the point, and how the map opens (unfolds out of the HUD minimap, keeping the
 * player's position and heading) and closes (folds back into it), and what lies behind it (black,
 * or the level frozen and dimmed). Schema here; resolution and the checks zod cannot say (cells
 * in rooms, labels on screen and apart) in automap-plan.ts; readability (the map spans half the
 * frame, never held to the shot's end over black) in automap-checks.ts.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';

const caps = (max: number) =>
  z
    .string()
    .max(max)
    .transform((text) => text.toUpperCase());
const cell = z.tuple([z.number(), z.number()]).describe('[x, y] in level cells');

/** The largest map scale (pixels per cell): a small level still fills half the frame. */
export const MAX_SCALE = 24;

export const ROOM_STATES = ['done', 'next', 'ahead', 'hidden'] as const;
export type RoomState = (typeof ROOM_STATES)[number];

export const automapSchema = z.strictObject({
  intent: z
    .string()
    .min(12)
    .max(160)
    .describe('What the map shows and why now (the claim: e.g. "two rooms done, the stores next")'),
  at: whenParam.describe('The map starts opening'),
  until: whenParam.describe('The map is gone (folded back into the view)'),
  enter: z
    .enum(['unfold', 'wipe', 'cut'])
    .default('unfold')
    .describe(
      'unfold = grows out of the HUD minimap (same position and heading), wipe = dithers in from it',
    ),
  exit: z.enum(['fold', 'cut']).default('fold').describe('fold = shrinks back into the minimap'),
  scale: z
    .int()
    .min(4)
    .max(MAX_SCALE)
    .default(8)
    .describe('Pixels per cell on the 640x360 screen (the map must span half the frame)'),
  backdrop: z
    .enum(['void', 'freeze'])
    .default('void')
    .describe(
      'freeze = the level at `at` held dimmed behind the map (never a black screen), void = black',
    ),
  rooms: z
    .array(
      z.strictObject({
        cell: cell.describe('Any open cell inside the room'),
        label: caps(18).default('').describe('Its name, a word of the narration'),
        sub: caps(16).default('').describe('Second line (a year, a date)'),
        state: z
          .enum(ROOM_STATES)
          .default('done')
          .describe('done = walked (solid), next = the objective room, ahead = dashed, hidden'),
        at: whenParam.optional().describe('When it draws on (default: in walk / list order)'),
        labelAt: cell.optional().describe('Top-left of the label in cells (default: above-left)'),
      }),
    )
    .max(10)
    .default([]),
  replay: z
    .strictObject({
      from: z
        .number()
        .describe('Path time the arrow replays from (may be < 0: the walk before the shot)'),
      to: whenParam.optional().describe('Path time it replays to (default: the map start)'),
      dur: z.number().min(0.6).max(6).optional().describe('Seconds the replay takes'),
    })
    .optional()
    .describe('The arrow replays the walk; walked rooms draw on as it enters them'),
  marks: z
    .array(
      z.strictObject({
        kind: z
          .enum(['objective', 'item', 'cross'])
          .describe('objective = pulsing diamond, item = THE item (the one accent), cross'),
        pos: cell,
        at: whenParam,
      }),
    )
    .max(6)
    .default([]),
  note: z
    .strictObject({
      text: caps(24).describe('Margin note in hand lettering (words of the narration)'),
      pos: cell.describe('Top-left of the lettering'),
      to: cell.optional().describe('Its two-stroke arrow points here'),
      at: whenParam,
    })
    .optional(),
  camera: z
    .array(z.strictObject({ at: whenParam, x: z.number(), y: z.number() }))
    .max(6)
    .default([])
    .describe(
      'Pans: at = the move starts, [x, y] = cell centred after it (anticipation, overshoot)',
    ),
  legend: z
    .union([z.boolean(), z.strictObject({ done: caps(10), ahead: caps(10) })])
    .default(true)
    .describe('DONE / AHEAD key when the map has seen and unseen rooms'),
});

export type AutomapInput = z.input<typeof automapSchema>;
export type AutomapSpec = z.output<typeof automapSchema>;

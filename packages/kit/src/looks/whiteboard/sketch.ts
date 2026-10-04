/**
 * `kit.fx.whiteboardSketch`: draws a list of strokes from the compact stroke language (dsl.ts):
 * lines, arrows, boxes, circles, brackets, underlines, zigzags, hatching, dots, handwritten labels
 * and the built-in doodles, one after the other or each on its spoken phrase.
 */
import { z } from 'zod';
import { whenParam } from '../blueprint/timing.js';
import { boardParams, defineWhiteboard } from './board.js';
import { DOODLE_NAMES } from './doodles.js';
import { parseStroke, PRIMITIVES } from './dsl.js';
import type { Entry, WhiteboardContext } from './tools.js';

const strokeObject = z.object({
  draw: z.string().min(2).describe("A stroke string, e.g. 'arrow 200 180 420 180'"),
  at: whenParam
    .optional()
    .describe('When it starts (seconds or phrase); default after the previous'),
  duration: z
    .number()
    .min(0.05)
    .max(10)
    .optional()
    .describe('Seconds to draw it (default by length)'),
  color: z.string().optional().describe('Ink: black, blue, red, green (or a palette name)'),
  width: z.int().min(1).max(4).optional().describe('Marker width (640x360-frame px)'),
  scale: z.int().min(1).max(8).optional().describe('Letter cell size for write (2 = 14-px caps)'),
  id: z
    .string()
    .min(1)
    .max(24)
    .optional()
    .describe("Name for point(): 'id', 'id.top', 'id.end'..."),
});

export const strokeParam = z.union([z.string().min(2), strokeObject]);
export type StrokeInput = z.output<typeof strokeParam>;

const sketchParams = z
  .object({
    strokes: z
      .array(strokeParam)
      .min(1)
      .max(40)
      .describe(
        `What to draw, in order: strings like 'circle 320 180 60 blue' or { draw, at, duration, color, id }. Shapes: ${PRIMITIVES.join(', ')}; doodles: ${DOODLE_NAMES.join(', ')}`,
      ),
  })
  .extend(boardParams);

/** The entry of one stroke (shared by the templates that accept extra strokes). */
export function strokeEntry(input: StrokeInput, index: number, context: WhiteboardContext): Entry {
  const spec = typeof input === 'string' ? { draw: input } : input;
  const parsed = parseStroke(spec.draw, context.call);
  const color = spec.color ?? parsed.color;
  const timing = { at: spec.at, duration: spec.duration };
  if (parsed.figure.kind === 'write') {
    const { figure } = parsed;
    const written = context.write(figure.text, context.px(figure.x), context.px(figure.y), {
      scale: context.cell(spec.scale ?? 2),
      align: 'center',
      valign: 'middle',
      color,
      key: index + 1,
    });
    return { name: spec.id, items: [{ shape: written.shape, ...timing }] };
  }
  const shape = context.pen(parsed.figure.paths, { color, width: spec.width, key: index + 1 });
  return { name: spec.id, items: [{ shape, ...timing }] };
}

export const whiteboardSketch = defineWhiteboard({
  name: 'whiteboardSketch',
  description:
    'Whiteboard sketch (look whiteboard): a hand draws strokes in order on a whiteboard (lines, arrows, boxes, circles, brackets, zigzags, labels and 20+ doodles: person, bulb, gear, house, computer, axes, bars, pie, cloud, rocket...). Full-frame 2D board: call update(t) every frame.',
  params: sketchParams,
  setup: (params, context) => ({
    entries: params.strokes.map((stroke, index) => strokeEntry(stroke, index, context)),
  }),
});

/**
 * `kit.fx.whiteboardText`: lines written by hand glyph by glyph (the kit's 5x7 caps, slanted,
 * bobbing a pixel off the baseline), each line on its own phrase if asked, then emphasis strokes
 * (underline, double, circle, box, strike) on chosen words, and optional extra strokes.
 */
import { z } from 'zod';
import { KitError } from '../../errors.js';
import { whenParam } from '../blueprint/timing.js';
import { boardParams, defineWhiteboard } from './board.js';
import { emphasisPaths, emphasisStyleParam } from './emphasis.js';
import { centerOf, type Box, type Point } from './geometry.js';
import { strokeEntry, strokeParam } from './sketch.js';
import type { Entry, WhiteboardContext } from './tools.js';

const lineParam = z.union([
  z.string().min(1).max(40),
  z.object({
    text: z.string().min(1).max(40),
    at: whenParam.optional().describe('When the line starts (seconds or phrase)'),
    color: z.string().optional(),
  }),
]);

const textParams = z
  .object({
    lines: z
      .array(lineParam)
      .min(1)
      .max(6)
      .describe('Lines to write, top to bottom (short: <= 24 chars reads best)'),
    scale: z
      .int()
      .min(2)
      .max(8)
      .optional()
      .describe(
        'Letter cell size at 640x360 (3 = 21-px caps); default: the largest that fits, up to 5',
      ),
    align: z.enum(['left', 'center', 'right']).default('center'),
    position: z
      .tuple([z.number(), z.number()])
      .optional()
      .describe(
        'Centre of the text block, 640x360-frame pixels (default: the middle of the board)',
      ),
    rate: z.number().min(2).max(40).default(9).describe('Letters per second'),
    emphasis: z
      .array(
        z.object({
          word: z
            .union([z.string().min(1), z.int().min(0)])
            .describe('Word text (case-insensitive) or index counted over all lines'),
          style: emphasisStyleParam,
          color: z.string().default('red'),
          at: whenParam.optional().describe('When (default: after the writing)'),
        }),
      )
      .max(6)
      .default([]),
    strokes: z
      .array(strokeParam)
      .max(20)
      .default([])
      .describe('Extra strokes drawn after (stroke language, see whiteboardSketch)'),
  })
  .extend(boardParams);

type TextParams = z.output<typeof textParams>;

const MAX_AUTO_SCALE = 5;

function fitScale(
  params: TextParams,
  texts: readonly string[],
  context: WhiteboardContext,
): number {
  if (params.scale !== undefined) return context.cell(params.scale);
  for (let reference = MAX_AUTO_SCALE; reference > 2; reference -= 1) {
    const scale = context.cell(reference);
    const width = Math.max(...texts.map((text) => context.textWidth(text, scale)));
    const height = texts.length * context.textHeight(scale) + (texts.length - 1) * scale * 4;
    if (width <= context.area.width && height <= context.area.height) return scale;
  }
  return context.cell(2);
}

function setupText(params: TextParams, context: WhiteboardContext): { entries: Entry[] } {
  const lines = params.lines.map((line) => (typeof line === 'string' ? { text: line } : line));
  const scale = fitScale(
    params,
    lines.map((line) => line.text),
    context,
  );
  const lineHeight = context.textHeight(scale) + scale * 4;
  const blockHeight = lines.length * lineHeight - scale * 4;
  const [cx, cy] = params.position
    ? [context.px(params.position[0]), context.px(params.position[1])]
    : centerOf(context.area);
  const blockWidth = Math.max(...lines.map((line) => context.textWidth(line.text, scale)));
  const x =
    params.align === 'center'
      ? cx
      : params.align === 'left'
        ? cx - blockWidth / 2
        : cx + blockWidth / 2;
  const top = Math.round(cy - blockHeight / 2);
  const words: Box[] = [];
  const wordTexts: string[] = [];
  const entries: Entry[] = lines.map((line, index) => {
    const written = context.write(line.text, x, top + index * lineHeight, {
      scale,
      align: params.align,
      color: line.color,
      key: 100 + index,
    });
    const globals: Record<string, Point> = {};
    written.line.words.forEach((box) => {
      globals[`word:${String(words.length)}`] = centerOf(box);
      words.push(box);
    });
    wordTexts.push(...line.text.split(/\s+/).filter((word) => word.length > 0));
    return {
      name: `line:${String(index)}`,
      items: [
        {
          shape: written.shape,
          at: line.at,
          duration: Math.max(0.3, line.text.length / params.rate),
          gap: 0.25,
        },
      ],
      globals,
    };
  });
  params.emphasis.forEach((emphasis, index) => {
    const wordIndex =
      typeof emphasis.word === 'number'
        ? emphasis.word
        : wordTexts.findIndex(
            (word) =>
              word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') ===
              String(emphasis.word).toLowerCase(),
          );
    const box = words[wordIndex];
    if (!box) {
      throw new KitError(
        'invalid-params',
        `${context.call}: emphasis word "${String(emphasis.word)}" is not in the lines (words: ${wordTexts.join(', ')})`,
      );
    }
    entries.push({
      name: `emphasis:${String(index)}`,
      items: [
        {
          shape: context.penRaster(emphasisPaths(emphasis.style, box, context.s), {
            color: emphasis.color,
            key: 300 + index,
          }),
          at: emphasis.at,
          gap: 0.3,
        },
      ],
    });
  });
  params.strokes.forEach((stroke, index) =>
    entries.push(strokeEntry(stroke, 500 + index, context)),
  );
  return { entries };
}

export const whiteboardText = defineWhiteboard({
  name: 'whiteboardText',
  description:
    'Whiteboard handwriting (look whiteboard): lines written glyph by glyph by a hand with a marker, each on its phrase, then words underlined, circled, boxed or struck out. Full-frame 2D board: call update(t) every frame.',
  params: textParams,
  setup: setupText,
});

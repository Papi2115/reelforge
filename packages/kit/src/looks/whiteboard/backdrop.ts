/**
 * `kit.env.whiteboardBoard`: the bare whiteboard (frame, tray, grain, optional grid) as a backdrop
 * for voxel objects and ctx.text, or a title card: a big headline written by hand, underlined, with
 * a smaller subline, plus optional extra strokes.
 */
import { z } from 'zod';
import { whenParam } from '../blueprint/timing.js';
import { boardParams, defineWhiteboard } from './board.js';
import { emphasisPaths } from './emphasis.js';
import { centerOf } from './geometry.js';
import { strokeEntry, strokeParam } from './sketch.js';
import type { Entry, WhiteboardContext } from './tools.js';

const backdropParams = z
  .object({
    headline: z.string().max(24).default('').describe('Big centred handwriting (title card)'),
    subline: z.string().max(40).default('').describe('Smaller line under the headline'),
    at: whenParam.optional().describe('When the headline starts (default: the board start)'),
    underline: z
      .string()
      .default('red')
      .describe("Ink of the headline's underline ('none' = no underline)"),
    strokes: z
      .array(strokeParam)
      .max(20)
      .default([])
      .describe('Extra strokes (stroke language, see whiteboardSketch)'),
  })
  .extend(boardParams);

type BackdropParams = z.output<typeof backdropParams>;

function headlineScale(text: string, context: WhiteboardContext): number {
  for (let reference = 7; reference > 2; reference -= 1) {
    if (context.textWidth(text, context.cell(reference)) <= context.area.width)
      return context.cell(reference);
  }
  return context.cell(2);
}

function setupBackdrop(params: BackdropParams, context: WhiteboardContext): { entries: Entry[] } {
  const entries: Entry[] = [];
  if (params.headline.length > 0) {
    const scale = headlineScale(params.headline, context);
    const small = Math.max(context.cell(2), Math.round(scale / 2));
    const gap = context.px(22);
    const total =
      context.textHeight(scale) + (params.subline.length > 0 ? gap + context.textHeight(small) : 0);
    const [cx, cy] = centerOf(context.area);
    const top = Math.round(cy - total / 2);
    const headline = context.write(params.headline, cx, top, { scale, align: 'center', key: 11 });
    const items = [{ shape: headline.shape, at: params.at }];
    if (params.underline !== 'none') {
      items.push({
        shape: context.penRaster(emphasisPaths('underline', headline.line.box, context.s), {
          color: params.underline,
          width: 3,
          key: 12,
        }),
        at: undefined,
      });
    }
    entries.push({ name: 'headline', items });
    if (params.subline.length > 0) {
      const subline = context.write(params.subline, cx, top + context.textHeight(scale) + gap, {
        scale: small,
        align: 'center',
        color: 'blue',
        key: 13,
      });
      entries.push({ name: 'subline', items: [{ shape: subline.shape }] });
    }
  }
  params.strokes.forEach((stroke, index) => entries.push(strokeEntry(stroke, 20 + index, context)));
  return { entries };
}

export const whiteboardBoard = defineWhiteboard({
  name: 'whiteboardBoard',
  kind: 'env',
  description:
    'Whiteboard backdrop (look whiteboard): framed off-white board with grain, marker tray and optional grid; optional headline written by hand and underlined (title card) and extra strokes. Full-frame 2D board under voxel objects and ctx.text: call update(t) every frame.',
  params: backdropParams,
  setup: setupBackdrop,
});

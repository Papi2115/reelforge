/**
 * `kit.env.blueprintSheet`: the bare blueprint sheet (grid paper, border, rulers, corner marks,
 * title block) as a backdrop, optionally with a big lettered headline that types itself in: a
 * title card for an act opening or a calm backdrop for voxel objects and ctx.text.
 */
import { z } from 'zod';
import { defineEnv } from '../../registry.js';
import { boardParams, createBoard, type BoardContext, type Painter } from './board.js';
import { drawText, fitScale, textHeight } from './text.js';
import { ramp, whenParam } from './timing.js';

const sheetParams = z
  .object({
    headline: z.string().max(28).default('').describe('Big centred lettering (title card)'),
    subline: z.string().max(40).default('').describe('Smaller line under the headline'),
    at: whenParam.default(0.3).describe('When the headline starts typing (seconds or phrase)'),
  })
  .extend(boardParams);

type SheetParams = z.output<typeof sheetParams>;

const TYPE_RATE = 18;

function setupSheet(params: SheetParams, context: BoardContext): Painter {
  const { theme } = context;
  const at = context.resolve(params.at, 0.3);
  return (raster, t, area) => {
    if (params.headline.length === 0) return;
    const scale = fitScale(params.headline, area.width - context.px(40), context.textScale(4));
    const small = context.textScale(2);
    const typed = Math.floor(Math.max(0, t - at) * TYPE_RATE);
    if (typed <= 0) return;
    const total =
      textHeight(1, scale) +
      (params.subline.length > 0 ? textHeight(1, small) + context.px(14) : 0);
    const top = Math.round(area.y + (area.height - total) / 2);
    const box = drawText(raster, [params.headline], area.x + area.width / 2, top, {
      scale,
      color: theme.ink,
      align: 'center',
      plate: theme.paper,
      pad: context.px(6),
      chars: typed,
    });
    if (typed >= params.headline.length) {
      raster.line(
        box.x,
        box.y + box.height + context.px(2),
        box.x + box.width - 1,
        box.y + box.height + context.px(2),
        theme.accent,
        { progress: ramp(t, at + params.headline.length / TYPE_RATE, 0.4), width: context.px(2) },
      );
    }
    if (params.subline.length > 0) {
      const rest = typed - params.headline.length - 4;
      if (rest <= 0) return;
      drawText(
        raster,
        [params.subline],
        area.x + area.width / 2,
        top + textHeight(1, scale) + context.px(14),
        {
          scale: small,
          color: theme.dim,
          align: 'center',
          plate: theme.paper,
          pad: context.px(3),
          chars: rest,
        },
      );
    }
  };
}

export const blueprintSheet = defineEnv({
  name: 'blueprintSheet',
  description:
    'Blueprint sheet backdrop: grid paper drifting slowly, border, rulers, corner marks, optional heading and title block, and an optional big headline that types itself in (title cards, act openers). Full-frame 2D board under voxel objects and ctx.text: call update(t) every frame.',
  params: sheetParams,
  methods: { 'update(t)': 'Repaints the sheet for local time t: call it every frame' },
  build: (params, tools) =>
    createBoard(tools, 'blueprintSheet', params, (context) => setupSheet(params, context), 'env'),
});

/**
 * `kit.fx.maskedRegion` (look blueprint, PLAN.md#12.26 open loops): a value on the drawing hidden
 * under a hatched "masked" plate with a question mark until the closing phrase, then the plate is
 * wiped off left to right in an ordered dither (reveal.ts) and the value stands highlighted.
 */
import { z } from 'zod';
import { revealProgress, wipeCovered } from '../../reveal.js';
import { boardParams, defineBoard, type BoardContext, type Painter } from './board.js';
import { drawText, textWidth } from './text.js';
import { whenParam } from './timing.js';

const maskedParams = z.object({
  text: z
    .string()
    .min(1)
    .max(20)
    .describe('The hidden value or word (revealed on the closing phrase)'),
  caption: z.string().max(32).default('').describe('Dimension-style caption under it'),
  revealAt: whenParam
    .default(1)
    .describe('When the mask starts to lift (seconds or the closing phrase)'),
  duration: z.number().min(0).max(3).default(0.6).describe('Seconds the wipe takes'),
  textScale: z.int().min(2).max(8).default(5).describe('Value scale at 640x360'),
});

export type MaskedParams = z.output<typeof maskedParams>;

export function setupMasked(params: MaskedParams, context: BoardContext): Painter {
  const { theme } = context;
  const revealAt = context.resolve(params.revealAt, 1);
  const scale = context.textScale(params.textScale);
  const captionScale = context.textScale(2);
  return (raster, t, area) => {
    const progress = revealProgress(t, revealAt, params.duration);
    const textW = textWidth(params.text, scale);
    const textH = 7 * scale;
    const pad = context.px(10);
    const plate = {
      x: Math.round(area.x + (area.width - textW) / 2) - pad,
      y: Math.round(area.y + (area.height - textH) / 2) - pad,
      w: textW + 2 * pad,
      h: textH + 2 * pad,
    };
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2;
    drawText(raster, [params.text], cx, cy, {
      scale,
      color: progress >= 1 ? theme.hot : theme.ink,
      align: 'center',
      valign: 'middle',
    });
    if (params.caption.length > 0) {
      drawText(raster, [params.caption], cx, plate.y + plate.h + context.px(18), {
        scale: captionScale,
        color: theme.dim,
        align: 'center',
        valign: 'middle',
      });
    }
    if (progress >= 1) {
      raster.frame(plate.x, plate.y, plate.w, plate.h, theme.hot);
      return;
    }
    const mark = Math.max(1, Math.round(scale * 1.2));
    for (let y = plate.y; y < plate.y + plate.h; y += 1) {
      for (let x = plate.x; x < plate.x + plate.w; x += 1) {
        const u = (x - plate.x + 0.5) / plate.w;
        if (!wipeCovered(x, y, u, progress)) continue;
        const hatch = (x - y) % Math.max(2, context.px(6)) === 0;
        raster.set(x, y, hatch ? theme.dim : theme.deep);
      }
    }
    raster.frame(plate.x, plate.y, plate.w, plate.h, theme.dim);
    if (progress <= 0) {
      drawText(raster, ['?'], cx, cy, {
        scale: mark,
        color: theme.accent,
        align: 'center',
        valign: 'middle',
      });
    }
  };
}

export const maskedRegion = defineBoard({
  name: 'maskedRegion',
  description:
    'Open-loop veil (look blueprint): a value hidden under a hatched mask plate with a question mark until the closing phrase (revealAt: seconds or the phrase), then the mask wipes off in a pixel dither and the value lights up. Full-frame 2D board (region for a part of the frame): call update(t) every frame.',
  params: maskedParams.extend(boardParams),
  setup: (params, context) => setupMasked(params, context),
});

/**
 * `kit.fx.flatLowerThird`: a flat name / caption plate in the lower third. An accent bar grows,
 * the name plate wipes out of it, the name slides up through its mask, the caption strip wipes
 * in under it; an optional icon pops on a badge. It leaves in reverse. Transparent around the
 * plate and drawn over voxel objects by default, so it works on any shot.
 */
import { z } from 'zod';
import {
  boardParams,
  defineBoard,
  type BoardContext,
  type BoardContent,
  type Box,
} from './board.js';
import { drawIcon, iconExtent, iconNameParam, type IconStyle } from './icons.js';
import { drawText, textHeight, textWidth } from './text.js';
import { clamp01, easeInCubic, easeOutBack, easeOutCubic, ramp, whenParam } from './timing.js';

const lowerThirdParams = z
  .object({
    name: z.string().min(1).max(28).describe('Big line: a name or the headline fact'),
    caption: z.string().max(40).default('').describe('Small line: role, source, place, date'),
    icon: iconNameParam.optional().describe('Icon on a badge left of the plate'),
    at: whenParam.default(0.3).describe('When it slides in (seconds or phrase)'),
    out: whenParam.optional().describe('When it leaves (default: stays)'),
    side: z.enum(['left', 'right']).default('left'),
    color: z
      .string()
      .default('primary')
      .describe('Accent bar and caption strip (role or palette name)'),
    plateColor: z.string().default('card').describe('Name plate colour'),
    y: z.number().default(312).describe('Bottom of the caption strip in frame pixels'),
  })
  .extend({ ...boardParams('none'), overlay: z.boolean().default(true) });

type LowerThirdParams = z.output<typeof lowerThirdParams>;

const BAR_S = 0.2;
const PLATE_S = 0.35;

function setupLowerThird(params: LowerThirdParams, context: BoardContext): BoardContent {
  const { theme, px, textScale } = context;
  const nameScale = textScale(3);
  const captionScale = textScale(2);
  const pad = px(8);
  const bar = px(6);
  const nameHeight = textHeight(1, nameScale) + pad * 2;
  const captionHeight = params.caption.length > 0 ? textHeight(1, captionScale) + px(10) : 0;
  const nameWidth = textWidth(params.name, nameScale, true) + pad * 2;
  const captionWidth =
    params.caption.length > 0 ? textWidth(params.caption, captionScale) + pad * 2 : 0;
  const iconStyle: IconStyle = {
    cell: textScale(2),
    main: theme.color('light'),
    accent: theme.color(params.color),
    badge: 'circle',
    badgeColor: theme.color(params.color),
  };
  const iconSize = params.icon === undefined ? 0 : iconExtent(iconStyle);
  const totalHeight = nameHeight + captionHeight;
  const bottom = px(params.y);
  const top = bottom - totalHeight;
  const right = params.side === 'right';
  const edge = right ? context.width - px(32) : px(32);
  const iconSpace = iconSize > 0 ? iconSize + px(10) : 0;
  // The bar sits next to the icon; plates grow away from it.
  const barX = right ? edge - iconSpace - bar : edge + iconSpace;
  const growX = (width: number): number => (right ? barX - width : barX + bar);
  const at = context.resolve(params.at, 0.3);
  const out = params.out === undefined ? undefined : context.resolve(params.out, 0);
  const nameBox: Box = { x: growX(nameWidth), y: top, width: nameWidth, height: nameHeight };
  const captionBox: Box = {
    x: growX(captionWidth),
    y: top + nameHeight,
    width: captionWidth,
    height: captionHeight,
  };
  const iconBox: Box = {
    x: right ? edge - iconSize : edge,
    y: top + totalHeight / 2 - iconSize / 2,
    width: iconSize,
    height: iconSize,
  };
  const anchors: Record<string, Box> = {
    name: nameBox,
    plate: {
      x: Math.min(nameBox.x, captionBox.x, barX),
      y: top,
      width: Math.max(nameWidth, captionWidth) + bar,
      height: totalHeight,
    },
    ...(captionHeight > 0 ? { caption: captionBox } : {}),
    ...(iconSize > 0 ? { icon: iconBox } : {}),
  };
  return {
    anchors,
    paint: (raster, t) => {
      // Progress in, then out in reverse (1 -> 0).
      const leave = out === undefined ? 0 : easeInCubic(ramp(t, out, 0.45));
      const phase = (start: number, length: number): number =>
        clamp01(easeOutCubic(ramp(t, at + start, length)) - leave * 1.6);
      const barK = clamp01(easeOutCubic(ramp(t, at, BAR_S)) - Math.max(0, leave * 1.6 - 0.6));
      if (barK <= 0) return;
      const barHeight = Math.round(totalHeight * barK);
      raster.rect(
        barX,
        top + Math.round((totalHeight - barHeight) / 2),
        bar,
        barHeight,
        theme.color(params.color),
      );
      const plateK = phase(0.1, PLATE_S);
      if (plateK > 0) {
        const width = Math.round(nameWidth * plateK);
        const x = right ? barX - width : barX + bar;
        raster.rect(x, top, width, nameHeight, theme.color(params.plateColor));
        raster.clipped(x, top, width, nameHeight, () => {
          const rise = Math.round((1 - phase(0.25, 0.3)) * nameHeight);
          drawText(raster, [params.name], nameBox.x + pad, top + pad + rise, {
            scale: nameScale,
            color: theme.light,
            bold: true,
          });
        });
      }
      const captionK = phase(0.3, PLATE_S);
      if (captionHeight > 0 && captionK > 0) {
        const width = Math.round(captionWidth * captionK);
        const x = right ? barX - width : barX + bar;
        raster.rect(x, captionBox.y, width, captionHeight, theme.color(params.color));
        raster.clipped(x, captionBox.y, width, captionHeight, () => {
          drawText(raster, [params.caption], captionBox.x + pad, captionBox.y + px(5), {
            scale: captionScale,
            color: theme.dark,
          });
        });
      }
      const iconK = phase(0.15, 0.4);
      if (params.icon !== undefined && iconK > 0) {
        const zoom = Math.max(0, easeOutBack(iconK));
        drawIcon(
          raster,
          theme,
          params.icon,
          iconBox.x + iconSize / 2,
          iconBox.y + iconSize / 2,
          iconStyle,
          zoom,
        );
      }
    },
  };
}

export const flatLowerThird = defineBoard({
  name: 'flatLowerThird',
  description:
    'Flat lower third: accent bar, name plate (bold caps) and caption strip wiping in on a cue, optional icon badge, leaving in reverse on `out`; transparent around the plate and drawn over voxel objects (overlay) so it fits any shot. Call update(t) every frame.',
  params: lowerThirdParams,
  targets: 'name, caption, plate, icon',
  setup: (params, context) => setupLowerThird(params, context),
});

/**
 * `kit.fx.blueprintCounter`: a 2D odometer on the blueprint sheet. One drum window per digit
 * (classic carries: a wheel turns only while every wheel to its right passes 9 -> 0), big pixel
 * digits rolling through the window, prefix/suffix, digit-group commas, and a dimension line with
 * the caption under it.
 */
import { z } from 'zod';
import { GLYPH_ROWS } from '../../fx/font.js';
import { boardParams, defineBoard, type BoardContext, type Painter } from './board.js';
import type { Raster } from './raster.js';
import { drawText, textWidth } from './text.js';
import { easeInOutCubic, easeOutCubic, ramp, whenParam } from './timing.js';

const counterParams = z.object({
  from: z.number().min(0).default(0).describe('Start value'),
  to: z.number().min(0).describe('End value'),
  start: whenParam.default(0.3).describe('When the count starts (seconds or phrase)'),
  end: whenParam.optional().describe('When it lands on `to` (default start + 2 s; a phrase works)'),
  decimals: z.int().min(0).max(2).default(0).describe('Digits after the point'),
  digits: z.int().min(1).max(10).optional().describe('Minimum whole digits (leading wheels blank)'),
  prefix: z.string().max(3).default('').describe('Before the number, e.g. "$"'),
  suffix: z.string().max(6).default('').describe('After the number, e.g. "%" or "M"'),
  groups: z.boolean().default(true).describe('Commas between digit groups'),
  label: z.string().max(32).default('').describe('Caption under the counter'),
  digitScale: z
    .int()
    .min(2)
    .max(8)
    .default(5)
    .describe('Digit scale at 640x360 (5 = 35-px digits)'),
  color: z.string().default('ink').describe('Digit colour (palette or role name)'),
});

type CounterParams = z.output<typeof counterParams>;

/**
 * Wheel positions (0..10, fractional while turning) for `value`, most significant first.
 * Wheel k (10^k) turns with the fraction of the wheels to its right once they all show 9.
 */
export function wheelPositions(value: number, wholeDigits: number, decimals: number): number[] {
  const scaled = Math.max(0, value) * 10 ** decimals;
  const count = wholeDigits + decimals;
  const result: number[] = [];
  for (let k = count - 1; k >= 0; k -= 1) {
    const unit = 10 ** k;
    const digit = Math.floor(scaled / unit) % 10;
    const below = scaled - Math.floor(scaled / unit) * unit;
    const fraction = k === 0 ? scaled % 1 : Math.max(0, below - (unit - 1));
    result.push(digit + Math.min(1, fraction));
  }
  return result;
}

/** Whole digits needed for `value`. */
export function wholeDigitsOf(value: number): number {
  return Math.max(1, Math.floor(Math.log10(Math.max(1, Math.floor(value)))) + 1);
}

function setupCounter(params: CounterParams, context: BoardContext): Painter {
  const { theme } = context;
  const start = context.resolve(params.start, 0.3);
  const end = context.resolve(params.end, start + 2);
  const whole = Math.max(params.digits ?? 1, wholeDigitsOf(params.to), wholeDigitsOf(params.from));
  const scale = context.textScale(params.digitScale);
  const color = theme.color(params.color);
  const glyphHeight = GLYPH_ROWS * scale;
  const cell = { width: 5 * scale + context.px(10), height: glyphHeight + context.px(14) };
  const gap = context.px(4);
  const comma = context.px(10);
  const count = whole + params.decimals;
  const commas = params.groups ? Math.floor((whole - 1) / 3) : 0;
  const affix = Math.max(1, Math.round(scale * 0.6));
  const prefixWidth = params.prefix.length > 0 ? textWidth(params.prefix, affix) + gap * 2 : 0;
  const suffixWidth = params.suffix.length > 0 ? textWidth(params.suffix, affix) + gap * 2 : 0;
  const point = params.decimals > 0 ? comma : 0;
  const total =
    prefixWidth + count * cell.width + (count - 1) * gap + commas * comma + point + suffixWidth;
  return (raster, t, area) => {
    const k = easeInOutCubic(ramp(t, start, end - start));
    const value = params.from + (params.to - params.from) * k;
    const wheels = wheelPositions(value, whole, params.decimals);
    const left = Math.round(area.x + (area.width - total) / 2);
    const top = Math.round(area.y + (area.height - cell.height) / 2 - context.px(10));
    const shown = easeOutCubic(ramp(t, Math.max(0, start - 0.6), 0.4));
    raster.faded(shown, () => {
      let x = left;
      if (prefixWidth > 0) {
        drawText(raster, [params.prefix], x + prefixWidth - gap, top + cell.height / 2, {
          scale: affix,
          color: theme.ink,
          align: 'right',
          valign: 'middle',
        });
        x += prefixWidth;
      }
      wheels.forEach((position, index) => {
        const significant = whole - index;
        paintWheel(
          raster,
          context,
          x,
          top,
          cell,
          position,
          scale,
          color,
          leadingBlank(wheels, index, whole),
        );
        x += cell.width + gap;
        if (
          params.groups &&
          !leadingBlank(wheels, index, whole) &&
          significant > 1 &&
          significant <= whole &&
          (significant - 1) % 3 === 0
        ) {
          raster.rect(
            x + (comma - gap) / 2 - scale / 2,
            top + cell.height - context.px(8),
            scale,
            scale * 2,
            theme.ink,
          );
          x += comma;
        }
        if (params.decimals > 0 && index === whole - 1) {
          raster.rect(
            x + (comma - gap) / 2 - scale / 2,
            top + cell.height - context.px(8),
            scale,
            scale,
            theme.ink,
          );
          x += point;
        }
      });
      if (suffixWidth > 0) {
        drawText(raster, [params.suffix], x + gap, top + cell.height / 2, {
          scale: affix,
          color: theme.ink,
          valign: 'middle',
        });
      }
      paintDimension(
        raster,
        context,
        left,
        left + total,
        top + cell.height + context.px(16),
        params.label,
      );
    });
  };
}

/** True while a leading wheel shows 0 and every wheel left of it does too (blank, not "007"). */
function leadingBlank(wheels: readonly number[], index: number, whole: number): boolean {
  if (index >= whole - 1) return false;
  return wheels.slice(0, index + 1).every((position) => position < 0.001);
}

function paintWheel(
  raster: Raster,
  context: BoardContext,
  x: number,
  y: number,
  cell: { readonly width: number; readonly height: number },
  position: number,
  scale: number,
  color: number,
  blank: boolean,
): void {
  const { theme } = context;
  raster.rect(x, y, cell.width, cell.height, theme.deep);
  raster.frame(x, y, cell.width, cell.height, theme.ink);
  const notch = context.px(3);
  raster.rect(x - notch, y + Math.floor(cell.height / 2), notch, 1, theme.ink);
  raster.rect(x + cell.width, y + Math.floor(cell.height / 2), notch, 1, theme.ink);
  if (blank) return;
  const digit = Math.floor(position) % 10;
  const fraction = position - Math.floor(position);
  const pitch = cell.height;
  const offset = Math.round(fraction * pitch);
  raster.clipped(x + 1, y + 1, cell.width - 2, cell.height - 2, () => {
    for (const [value, shift] of [
      [digit, -offset],
      [(digit + 1) % 10, pitch - offset],
    ] as const) {
      drawText(raster, [String(value)], x + cell.width / 2, y + cell.height / 2 + shift, {
        scale,
        color,
        align: 'center',
        valign: 'middle',
      });
    }
  });
}

/** Dimension line |<--- LABEL --->| under the counter. */
function paintDimension(
  raster: Raster,
  context: BoardContext,
  x0: number,
  x1: number,
  y: number,
  label: string,
): void {
  if (label.length === 0) return;
  const { theme } = context;
  const scale = context.textScale(2);
  raster.line(x0, y - context.px(6), x0, y + context.px(6), theme.dim);
  raster.line(x1, y - context.px(6), x1, y + context.px(6), theme.dim);
  raster.line(x0, y, x1, y, theme.dim);
  for (const [tip, direction] of [
    [x0, 1],
    [x1, -1],
  ] as const) {
    raster.line(tip, y, tip + direction * context.px(5), y - context.px(3), theme.dim);
    raster.line(tip, y, tip + direction * context.px(5), y + context.px(3), theme.dim);
  }
  drawText(raster, [label], (x0 + x1) / 2, y, {
    scale,
    color: theme.ink,
    align: 'center',
    valign: 'middle',
    plate: theme.paper,
    pad: context.px(4),
  });
}

export const blueprintCounter = defineBoard({
  name: 'blueprintCounter',
  description:
    'Blueprint odometer: digit wheels roll from `from` to `to` between `start` and `end` (seconds or spoken phrases), with prefix/suffix, digit groups and a dimension-line caption. Full-frame 2D board: call update(t) every frame.',
  params: counterParams.extend(boardParams),
  setup: (params, context) => setupCounter(params, context),
});

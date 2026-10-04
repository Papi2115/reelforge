/**
 * `kit.fx.whiteboardCounter`: a number written large by hand, then crossed out and replaced by the
 * next one (a corrected estimate, a price that jumps, a count that grows), the last one circled,
 * with an optional caption. Each value can land on its spoken phrase.
 */
import { z } from 'zod';
import { whenParam } from '../blueprint/timing.js';
import { boardParams, defineWhiteboard } from './board.js';
import { emphasisPaths } from './emphasis.js';
import { centerOf, type Box, type Polyline } from './geometry.js';
import type { Entry, WhiteboardContext } from './tools.js';

const valueParam = z.union([
  z.number(),
  z.string().min(1).max(12),
  z.object({
    value: z.union([z.number(), z.string().min(1).max(12)]),
    at: whenParam.optional().describe('When it is written (seconds or phrase)'),
  }),
]);

const counterParams = z
  .object({
    values: z
      .array(valueParam)
      .min(1)
      .max(4)
      .describe('Numbers in order: each crosses out the one before'),
    prefix: z.string().max(3).default('').describe('Before every number, e.g. "$"'),
    suffix: z.string().max(6).default('').describe('After every number, e.g. "%" or "M"'),
    groups: z.boolean().default(true).describe('Commas between digit groups'),
    label: z.string().max(32).default('').describe('Caption written under the numbers'),
    strike: z
      .enum(['line', 'cross', 'scribble'])
      .default('line')
      .describe('How a replaced number is crossed out'),
    strikeColor: z.string().default('red'),
    final: z
      .enum(['circle', 'underline', 'box', 'none'])
      .default('circle')
      .describe('Emphasis on the last number'),
    finalColor: z.string().default('blue'),
    scale: z
      .int()
      .min(2)
      .max(12)
      .optional()
      .describe('Digit cell size at 640x360 (default: the largest that fits, up to 9)'),
  })
  .extend(boardParams);

type CounterParams = z.output<typeof counterParams>;

/** "1250000" -> "1,250,000" (no locale: the same text everywhere). */
export function groupDigits(value: number | string, groups: boolean): string {
  const text = typeof value === 'number' ? String(value) : value;
  if (!groups || !/^-?\d{4,}(\.\d+)?$/.test(text)) return text;
  const [whole = '', fraction] = text.split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const digits = whole.replace('-', '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
}

function strikePaths(kind: CounterParams['strike'], box: Box, s: number): Polyline[] {
  const left = box.x - 4 * s;
  const right = box.x + box.width + 4 * s;
  const top = box.y - 2 * s;
  const bottom = box.y + box.height + 2 * s;
  if (kind === 'cross') {
    return [
      [
        [left, top],
        [right, bottom],
      ],
      [
        [right, top],
        [left, bottom],
      ],
    ];
  }
  if (kind === 'scribble') {
    const teeth = Math.max(3, Math.round(box.width / (7 * s)));
    const points: [number, number][] = [];
    for (let index = 0; index <= teeth * 2; index += 1) {
      const x = left + ((right - left) * index) / (teeth * 2);
      points.push([x, index % 2 === 0 ? bottom - 3 * s : top + 3 * s]);
    }
    return [points];
  }
  return emphasisPaths('strike', box, s);
}

function setupCounter(params: CounterParams, context: WhiteboardContext): { entries: Entry[] } {
  const values = params.values.map((value) =>
    typeof value === 'object' ? value : { value, at: undefined },
  );
  const texts = values.map(
    (value) => `${params.prefix}${groupDigits(value.value, params.groups)}${params.suffix}`,
  );
  const { area } = context;
  const gapOf = (scale: number): number => scale * 6 + context.px(16);
  // Room for the loop round the last number on both sides.
  const loop = params.final === 'circle' ? context.px(24) : context.px(8);
  const fits = (scale: number): boolean => {
    const width = texts.reduce((sum, text) => sum + context.textWidth(text, scale), 0);
    return width + gapOf(scale) * (texts.length - 1) + loop <= area.width;
  };
  let scale = params.scale === undefined ? context.cell(2) : context.cell(params.scale);
  if (params.scale === undefined) {
    for (let reference = 9; reference > 2; reference -= 1) {
      if (fits(context.cell(reference))) {
        scale = context.cell(reference);
        break;
      }
    }
  }
  const gap = gapOf(scale);
  const widths = texts.map((text) => context.textWidth(text, scale));
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * (texts.length - 1);
  const labelScale = Math.max(context.cell(2), Math.round(scale / 3));
  const labelHeight = params.label.length > 0 ? context.textHeight(labelScale) + context.px(26) : 0;
  const [cx, cy] = centerOf(area);
  const top = Math.round(cy - (context.textHeight(scale) + labelHeight) / 2);
  const entries: Entry[] = [];
  let x = cx - total / 2;
  const boxes: Box[] = [];
  values.forEach((value, index) => {
    const written = context.write(texts[index] ?? '', x, top, { scale, key: 40 + index });
    boxes.push(written.line.box);
    x += (widths[index] ?? 0) + gap;
    const pinned = value.at === undefined ? undefined : context.resolve(value.at, 0);
    const previous = boxes[index - 1];
    if (previous) {
      entries.push({
        name: `strike:${String(index - 1)}`,
        items: [
          {
            shape: context.penRaster(strikePaths(params.strike, previous, context.s), {
              color: params.strikeColor,
              width: 3,
              key: 60 + index,
            }),
            at: pinned === undefined ? undefined : Math.max(0, pinned - 0.55),
            duration: 0.35,
            gap: 0.5,
          },
        ],
      });
    }
    entries.push({
      name: `value:${String(index)}`,
      items: [{ shape: written.shape, at: pinned, gap: 0.2 }],
    });
  });
  const last = boxes.at(-1);
  if (params.final !== 'none' && last) {
    entries.push({
      name: 'final',
      items: [
        {
          shape: context.penRaster(emphasisPaths(params.final, last, context.s), {
            color: params.finalColor,
            width: 3,
            key: 80,
          }),
          gap: 0.3,
        },
      ],
    });
  }
  if (params.label.length > 0) {
    const label = context.write(
      params.label,
      cx,
      top + context.textHeight(scale) + context.px(26),
      {
        scale: labelScale,
        align: 'center',
        color: 'blue',
        key: 90,
      },
    );
    entries.push({ name: 'label', items: [{ shape: label.shape, gap: 0.2 }] });
  }
  return { entries };
}

export const whiteboardCounter = defineWhiteboard({
  name: 'whiteboardCounter',
  description:
    'Whiteboard number (look whiteboard): a number written large by hand, crossed out and replaced by the next (up to 4, each on its phrase), the last one circled, with a caption. Full-frame 2D board: call update(t) every frame.',
  params: counterParams,
  setup: setupCounter,
});

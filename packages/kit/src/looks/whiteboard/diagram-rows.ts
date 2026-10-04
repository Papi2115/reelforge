/**
 * Row diagrams for `whiteboardDiagram`: a hand-drawn timeline (axis arrow, then a tick, label and
 * caption per event) and an equation row (words, doodles and big operators: IDEA + WORK = $).
 */
import type { When } from '../blueprint/timing.js';
import { DOODLES, type DoodleName } from './doodles.js';
import { arrowHead, transform, type Polyline } from './geometry.js';
import type { Entry, Item, WhiteboardContext } from './tools.js';

export interface TimelineEvent {
  readonly label: string;
  readonly caption?: string | undefined;
  readonly at?: When | undefined;
  readonly color?: string | undefined;
}

export function timelineEntries(
  events: readonly TimelineEvent[],
  context: WhiteboardContext,
): Entry[] {
  const { area, s } = context;
  const y = Math.round(area.y + area.height * 0.52);
  const left = area.x + 4 * s;
  const right = area.x + area.width - 4 * s;
  const axis = context.penRaster(
    [
      [
        [left, y],
        [right, y + 1 * s],
      ],
      arrowHead([left, y], [right, y + 1 * s], 12 * s),
    ],
    { width: 3, key: 600 },
  );
  const entries: Entry[] = [{ name: 'axis', items: [{ shape: axis }] }];
  const step = (right - left - 30 * s) / Math.max(1, events.length);
  const labelScale = context.cell(events.length > 5 ? 2 : 3);
  const captionScale = context.cell(2);
  events.forEach((event, index) => {
    const x = left + step * (index + 0.5);
    const key = 610 + index * 10;
    const items: Item[] = [
      {
        shape: context.penRaster(
          [
            [
              [x, y - 9 * s],
              [x + 1 * s, y + 9 * s],
            ],
          ],
          { color: event.color ?? 'red', width: 3, key },
        ),
        at: event.at,
        gap: 0.25,
      },
    ];
    const label = context.write(event.label, x, y - 20 * s - context.textHeight(labelScale), {
      scale: labelScale,
      align: 'center',
      key: key + 1,
    });
    items.push({ shape: label.shape, gap: 0.05 });
    if (event.caption) {
      const caption = context.write(event.caption, x, y + 22 * s, {
        scale: captionScale,
        align: 'center',
        color: 'blue',
        key: key + 2,
      });
      items.push({ shape: caption.shape, gap: 0.05 });
    }
    entries.push({ name: `event:${String(index)}`, items });
  });
  return entries;
}

export interface EquationTerm {
  readonly text?: string | undefined;
  readonly doodle?: DoodleName | undefined;
  readonly at?: When | undefined;
  readonly color?: string | undefined;
}

const OPERATORS: Readonly<Record<string, (size: number) => Polyline[]>> = {
  '+': (h) => [
    [
      [-h, 0],
      [h, 0],
    ],
    [
      [0, -h],
      [0, h],
    ],
  ],
  '-': (h) => [
    [
      [-h, 0],
      [h, 0],
    ],
  ],
  '=': (h) => [
    [
      [-h, -h * 0.4],
      [h, -h * 0.4],
    ],
    [
      [-h, h * 0.4],
      [h, h * 0.4],
    ],
  ],
  x: (h) => [
    [
      [-h * 0.75, -h * 0.75],
      [h * 0.75, h * 0.75],
    ],
    [
      [h * 0.75, -h * 0.75],
      [-h * 0.75, h * 0.75],
    ],
  ],
  '>': (h) => [
    [
      [-h * 1.2, 0],
      [h * 1.2, 0],
    ],
    arrowHead([0, 0], [h * 1.2, 0], h * 0.7),
  ],
};
const OPERATOR_ALIASES: Readonly<Record<string, string>> = {
  '×': 'x',
  '*': 'x',
  '->': '>',
  '→': '>',
  '−': '-',
};

export function equationEntries(
  terms: readonly EquationTerm[],
  context: WhiteboardContext,
): Entry[] {
  const { area, s } = context;
  const operatorOf = (term: EquationTerm): string | undefined => {
    const text = term.text?.trim() ?? '';
    const name = OPERATOR_ALIASES[text] ?? text.toLowerCase();
    return term.doodle === undefined && name in OPERATORS ? name : undefined;
  };
  const operatorWidth = 48 * s;
  let scale = context.cell(4);
  let doodle = Math.min(area.height * 0.55, 120 * s);
  const widthOf = (term: EquationTerm): number =>
    operatorOf(term) !== undefined
      ? operatorWidth
      : term.doodle !== undefined
        ? doodle
        : context.textWidth(term.text ?? '', scale);
  const gap = 18 * s;
  const total = (): number =>
    terms.reduce((sum, term) => sum + widthOf(term), 0) + gap * (terms.length - 1);
  while (total() > area.width && (scale > context.cell(2) || doodle > 50 * s)) {
    scale = Math.max(context.cell(2), scale - 1);
    doodle = Math.max(50 * s, doodle * 0.85);
  }
  const cy = area.y + area.height / 2;
  let x = area.x + (area.width - total()) / 2;
  return terms.map((term, index) => {
    const width = widthOf(term);
    const cx = x + width / 2;
    x += width + gap;
    const key = 700 + index * 10;
    const operator = operatorOf(term);
    if (operator !== undefined) {
      const paths = transform(OPERATORS[operator]?.(14 * s) ?? [], 1, [cx, cy]);
      return {
        name: `term:${String(index)}`,
        items: [
          {
            shape: context.penRaster(paths, { color: term.color ?? 'red', width: 3, key }),
            at: term.at,
          },
        ],
      };
    }
    if (term.doodle !== undefined) {
      const paths = transform(DOODLES[term.doodle](), doodle / 100, [cx, cy]);
      return {
        name: `term:${String(index)}`,
        items: [{ shape: context.penRaster(paths, { color: term.color, key }), at: term.at }],
      };
    }
    const written = context.write(term.text ?? '', cx, cy, {
      scale,
      align: 'center',
      valign: 'middle',
      color: term.color,
      key,
    });
    return { name: `term:${String(index)}`, items: [{ shape: written.shape, at: term.at }] };
  });
}

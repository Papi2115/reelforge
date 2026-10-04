/**
 * `kit.fx.flatKinetic`: kinetic typography in bold pixel caps. Words land one by one on their
 * cues (spoken phrases or seconds) with a per-word effect (pop, slide up out of a mask, drop with
 * a bounce, shake, type, fade) and an optional mark drawn after it lands (underline, plate, box,
 * strike). Lines are centred (or left-aligned) and the type scale fits the frame.
 */
import { z } from 'zod';
import { GLYPH_ROWS } from '../../fx/font.js';
import { KitError } from '../../errors.js';
import {
  boardParams,
  defineBoard,
  type BoardContext,
  type BoardContent,
  type Box,
} from './board.js';
import type { Raster } from './raster.js';
import { drawText, textHeight, textWidth } from './text.js';
import {
  easeInCubic,
  easeOutBack,
  easeOutBounce,
  easeOutCubic,
  ramp,
  whenParam,
  wobble,
} from './timing.js';

const EFFECTS = ['pop', 'slide', 'drop', 'shake', 'type', 'fade', 'none'] as const;
type Effect = (typeof EFFECTS)[number];
const MARKS = ['none', 'underline', 'plate', 'box', 'strike'] as const;
type Mark = (typeof MARKS)[number];

const word = z.object({
  text: z.string().min(1).max(16),
  at: whenParam.optional().describe('When the word lands (default: staggered)'),
  effect: z.enum(EFFECTS).optional().describe('Entrance (default: the board effect)'),
  color: z.string().optional().describe('Role or palette name (default ink)'),
  mark: z
    .enum(MARKS)
    .default('none')
    .describe('Drawn after it lands: underline, plate, box, strike'),
  br: z.boolean().default(false).describe('Start a new line with this word'),
});

const kineticParams = z
  .object({
    words: z.array(word).max(16).optional().describe('Words with their own cues, effects, marks'),
    text: z
      .string()
      .max(80)
      .optional()
      .describe('Shorthand: words on `stagger`; "/" breaks the line, *word* gets the mark'),
    effect: z
      .enum(EFFECTS)
      .default('pop')
      .describe(`Default entrance: ${EFFECTS.join(', ')}`),
    mark: z.enum(MARKS).default('underline').describe('Mark of *starred* words in `text`'),
    markColor: z.string().default('primary').describe('Colour of marks (role or palette name)'),
    start: z.number().default(0.3).describe('First word when it has no `at` (s)'),
    stagger: z.number().min(0).default(0.3).describe('Seconds between default word cues'),
    scale: z.int().min(0).max(12).default(0).describe('Type scale at 640x360 (0 = fit the frame)'),
    align: z.enum(['center', 'left']).default('center'),
    y: z.number().default(180).describe('Vertical centre of the block (frame pixels)'),
    out: whenParam.optional().describe('When every word leaves (slides up into its mask)'),
  })
  .extend(boardParams('solid'));

type KineticParams = z.output<typeof kineticParams>;
type Word = z.output<typeof word>;

/** Rows (at scale 1) between lines: room for marks (underline below, box around). */
const LINE_GAP = 9;
const ENTER_S = 0.35;
const MARK_DELAY_S = 0.15;
const MARK_S = 0.3;
const TYPE_RATE = 22;

/** Words of the `text` shorthand: "/" starts a line, *word* is marked. */
export function shorthandWords(text: string, mark: Mark): Word[] {
  const result: Word[] = [];
  let br = false;
  for (const token of text.split(/\s+/).filter((part) => part.length > 0)) {
    if (token === '/') {
      br = true;
      continue;
    }
    const starred = /^\*(.+)\*$/.exec(token);
    result.push({
      text: (starred?.[1] ?? token).slice(0, 16),
      mark: starred ? mark : 'none',
      br,
    });
    br = false;
  }
  return result;
}

interface Placed {
  readonly word: Word;
  readonly at: number;
  readonly effect: Effect;
  readonly box: Box;
  readonly line: number;
}

/** Largest scale (<= max) at which every line fits `maxWidth` and all lines fit `maxHeight`. */
function fitKinetic(
  lines: readonly string[],
  maxWidth: number,
  maxHeight: number,
  max: number,
): number {
  for (let scale = max; scale > 1; scale -= 1) {
    const widest = Math.max(...lines.map((line) => textWidth(line, scale, true)));
    if (
      widest <= maxWidth &&
      (lines.length * (GLYPH_ROWS + LINE_GAP) - LINE_GAP) * scale <= maxHeight
    ) {
      return scale;
    }
  }
  return 1;
}

function layout(params: KineticParams, words: readonly Word[], context: BoardContext): Placed[] {
  const lines: Word[][] = [];
  for (const entry of words) {
    if (entry.br || lines.length === 0) lines.push([]);
    lines.at(-1)?.push(entry);
  }
  const texts = lines.map((line) => line.map((entry) => entry.text).join(' '));
  const scale =
    params.scale > 0
      ? context.textScale(params.scale)
      : fitKinetic(texts, context.px(560), context.px(250), context.textScale(9));
  const lineHeight = (GLYPH_ROWS + LINE_GAP) * scale;
  const blockHeight = lines.length * lineHeight - LINE_GAP * scale;
  const space = textWidth(' ', scale, true) + scale * 4;
  let top = Math.round(context.px(params.y) - blockHeight / 2);
  let index = 0;
  const placed: Placed[] = [];
  lines.forEach((line, lineIndex) => {
    const widths = line.map((entry) => textWidth(entry.text, scale, true));
    const total = widths.reduce((sum, width) => sum + width, 0) + space * (line.length - 1);
    let x = params.align === 'center' ? Math.round((context.width - total) / 2) : context.px(48);
    line.forEach((entry, position) => {
      const width = widths[position] ?? 0;
      placed.push({
        word: entry,
        at: context.resolve(entry.at, params.start + index * params.stagger),
        effect: entry.effect ?? params.effect,
        box: { x, y: top, width, height: textHeight(1, scale) },
        line: lineIndex,
      });
      x += width + space;
      index += 1;
    });
    top += lineHeight;
  });
  return placed;
}

function setupKinetic(params: KineticParams, context: BoardContext): BoardContent {
  const words = params.words ?? shorthandWords(params.text ?? '', params.mark);
  if (words.length === 0) {
    throw new KitError('invalid-params', `${context.call}: give words [...] or text`);
  }
  const placed = layout(params, words, context);
  const out = params.out === undefined ? undefined : context.resolve(params.out, 0);
  const scale = Math.max(1, Math.round((placed[0]?.box.height ?? 7) / 7));
  const anchors: Record<string, Box> = {};
  placed.forEach((entry, index) => {
    anchors[`word:${String(index)}`] = entry.box;
    const line = anchors[`line:${String(entry.line)}`];
    anchors[`line:${String(entry.line)}`] =
      line === undefined ? entry.box : { ...line, width: entry.box.x + entry.box.width - line.x };
  });
  return {
    anchors,
    paint: (raster, t) => {
      const leave = out === undefined ? 0 : easeInCubic(ramp(t, out, ENTER_S));
      if (leave >= 1) return;
      placed.forEach((entry, index) => {
        if (t < entry.at) return;
        const { box } = entry;
        const lift = Math.round(leave * (box.height + scale * 6));
        const draw = (): void => {
          paintWord(raster, context, params, entry, t, index, lift, scale);
        };
        // Slides and the exit move words through a mask: the band of their own line.
        if (leave > 0 || entry.effect === 'slide') {
          raster.clipped(0, box.y - scale * 4 - 1, raster.width, box.height + scale * 9, draw);
        } else {
          draw();
        }
      });
    },
  };
}

function paintWord(
  raster: Raster,
  context: BoardContext,
  params: KineticParams,
  entry: Placed,
  t: number,
  index: number,
  lift: number,
  scale: number,
): void {
  const { theme } = context;
  const { box, word: data } = entry;
  const k = ramp(t, entry.at, ENTER_S);
  let dx = 0;
  let dy = -lift;
  let zoom = 1;
  let level = 1;
  let chars: number | undefined;
  switch (entry.effect) {
    case 'pop':
      zoom = Math.max(0, easeOutBack(k));
      break;
    case 'slide':
      dy += Math.round((1 - easeOutCubic(k)) * (box.height + scale * 4));
      break;
    case 'drop':
      dy -= Math.round((1 - easeOutBounce(k)) * context.px(90));
      break;
    case 'shake': {
      const amount = (1 - ramp(t, entry.at, 0.5)) * context.px(5);
      dx += Math.round(wobble(t, index) * amount);
      dy += Math.round(wobble(t, index + 7) * amount * 0.6);
      break;
    }
    case 'type':
      chars = Math.floor((t - entry.at) * TYPE_RATE) + 1;
      break;
    case 'fade':
      level = k;
      break;
    case 'none':
      break;
  }
  const mark = data.mark;
  const markK = easeOutCubic(ramp(t, entry.at + ENTER_S + MARK_DELAY_S, MARK_S));
  const markColor = theme.color(params.markColor);
  const x = box.x + dx;
  const y = box.y + dy;
  const pad = scale * 2;
  if (mark === 'plate' && markK > 0) {
    raster.rect(x - pad, y - pad, (box.width + pad * 2) * markK, box.height + pad * 2, markColor);
  }
  const color = mark === 'plate' && markK > 0 ? theme.dark : theme.color(data.color ?? 'ink');
  raster.faded(level, () => {
    drawText(raster, [data.text], x, y, { scale, color, bold: true, zoom, chars });
  });
  if (markK <= 0) return;
  const reach = Math.round((box.width + pad * 2) * markK);
  if (mark === 'underline')
    raster.rect(x - pad, y + box.height + scale * 2, reach, scale, markColor);
  if (mark === 'strike')
    raster.rect(x - pad, y + Math.floor(box.height / 2), reach, scale, markColor);
  if (mark === 'box')
    paintBox(
      raster,
      x - pad * 2,
      y - pad * 2,
      box.width + pad * 4,
      box.height + pad * 4,
      scale,
      markK,
      markColor,
    );
}

/** Rectangle outline drawn on clockwise from the top left, `k` of its perimeter. */
function paintBox(
  raster: Raster,
  x: number,
  y: number,
  width: number,
  height: number,
  pen: number,
  k: number,
  color: number,
): void {
  raster.polyline(
    [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
      [x, y],
    ],
    color,
    { width: pen, progress: k },
  );
}

export const flatKinetic = defineBoard({
  name: 'flatKinetic',
  description:
    'Kinetic typography in bold pixel caps: words land one by one on spoken phrases (pop, slide out of a mask, drop, shake, type, fade) and get marks (underline, plate, box, strike); auto-fitted, centred or left-aligned; all leave together on `out`. Full-frame 2D board: call update(t) every frame.',
  params: kineticParams,
  targets: 'word:<i> (each word in order), line:<i>',
  setup: (params, context) => setupKinetic(params, context),
});

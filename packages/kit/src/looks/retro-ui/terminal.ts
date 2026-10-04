/**
 * `kit.props.retroTerminal`: a text terminal (DOS/Unix prompt) in a retro window or bare (to put
 * inside a CRT): header lines, typed commands with a block cursor, printed output in tones,
 * scrollback when the screen is full, inverse-video marks. Timing: typing.ts.
 */
import { z } from 'zod';
import { defineProp } from '../../registry.js';
import {
  drawText,
  fillRect,
  MONO_CELL,
  normalize,
  rect,
  type PixelCanvas,
  type Rect,
} from './canvas.js';
import { drawChrome, dropShadow } from './chrome.js';
import { C } from './colors.js';
import { accentParam, MarkTracker, marksParam, pixelParam, seedParam, sizeParam } from './marks.js';
import { createSurface, type AnchorMap, type RetroPainter } from './surface.js';
import { scheduleLines, TERMINAL_TONES, terminalRows, type TerminalEntry } from './typing.js';

const ROW = 10;
const PAD = 4;
const PHOSPHORS = ['green', 'amber', 'cream', 'cyan'] as const;

const SCHEMES: Readonly<
  Record<(typeof PHOSPHORS)[number], { ink: number; input: number; prompt: number; dim: number }>
> = {
  green: { ink: C.green, input: C.cream, prompt: C.green, dim: C.forest },
  amber: { ink: C.amber, input: C.cream, prompt: C.orange, dim: C.burnt },
  cream: { ink: C.cream, input: C.amber, prompt: C.grey, dim: C.midGrey },
  cyan: { ink: C.cyan, input: C.cream, prompt: C.teal, dim: C.teal },
};

const lineParam = z.union([
  z.string().max(80).describe('A printed output line'),
  z.object({
    text: z.string().max(80),
    input: z.boolean().default(false).describe('Typed after the prompt'),
    at: z.number().optional().describe('Earliest local time (e.g. ctx.anchor(...).t)'),
    tone: z.enum(TERMINAL_TONES).default('normal').describe('Output tone: normal, dim, alert, ok'),
  }),
]);

export const retroTerminalParams = z.object({
  lines: z
    .array(lineParam)
    .max(40)
    .default([
      { text: 'DIR', input: true, tone: 'normal' },
      'README  TXT     1,024',
      'DOOM    EXE   715,766',
      { text: 'DOOM', input: true, tone: 'normal' },
    ])
    .describe('Script: strings print, { text, input: true } is typed; optional at/tone'),
  header: z.array(z.string().max(60)).max(4).default([]).describe('Lines shown from the start'),
  prompt: z.string().max(16).default('C:\\>').describe('Prompt before typed lines'),
  start: z.number().default(0.4).describe('Local time the first line starts'),
  cps: z.number().positive().max(80).default(16).describe('Typed characters per second'),
  pause: z.number().min(0).default(0.35).describe('Pause after a typed line'),
  outputGap: z.number().min(0).default(0.12).describe('Gap between printed lines'),
  phosphor: z.enum(PHOSPHORS).default('green').describe('Text colours: green, amber, cream, cyan'),
  frame: z
    .enum(['window', 'none'])
    .default('window')
    .describe("'none' = bare screen (inside a CRT)"),
  title: z.string().max(40).default('TERMINAL').describe('Window title (frame window)'),
  size: sizeParam(220, 130, [400, 300]),
  accent: accentParam,
  marks: marksParam,
  pixel: pixelParam,
  seed: seedParam,
});

export type RetroTerminalParams = z.output<typeof retroTerminalParams>;

function entriesOf(params: RetroTerminalParams): TerminalEntry[] {
  return params.lines.map((line) =>
    typeof line === 'string' ? { text: line, input: false } : { ...line },
  );
}

interface Row {
  readonly text: string;
  readonly color: number;
  readonly prompt: boolean;
  readonly index: number;
}

/** Paints the terminal text area (background included) and returns its anchors. */
function paintScreen(
  canvas: PixelCanvas,
  area: Rect,
  params: RetroTerminalParams,
  t: number,
): AnchorMap {
  const scheme = SCHEMES[params.phosphor];
  fillRect(canvas, area, C.black);
  const schedule = scheduleLines(entriesOf(params), params);
  const state = terminalRows(schedule, t);
  const columns = Math.max(4, Math.floor((area.w - PAD * 2 + 1) / MONO_CELL));
  const prompt = normalize(params.prompt);
  const rows: Row[] = params.header.map((text) => ({
    text: normalize(text),
    color: scheme.ink,
    prompt: false,
    index: -2,
  }));
  let cursorRow = -1;
  let cursorColumn = 0;
  state.rows.forEach((row, rowIndex) => {
    const color = row.input
      ? scheme.input
      : row.tone === 'alert'
        ? C.pink
        : row.tone === 'dim'
          ? scheme.dim
          : row.tone === 'ok'
            ? C.cyan
            : scheme.ink;
    const text = (row.input ? prompt : '') + normalize(row.text);
    const chars = Array.from(text);
    const pieces = Math.max(1, Math.ceil(chars.length / columns));
    for (let piece = 0; piece < pieces; piece += 1) {
      rows.push({
        text: chars.slice(piece * columns, (piece + 1) * columns).join(''),
        color,
        prompt: row.input && piece === 0,
        index: row.index,
      });
    }
    if (state.cursor?.row === rowIndex) {
      const column = Array.from(prompt).length + state.cursor.column;
      cursorRow = rows.length - pieces + Math.floor(column / columns);
      cursorColumn = column % columns;
      if (cursorRow >= rows.length) rows.push({ text: '', color, prompt: false, index: row.index });
    }
  });
  const capacity = Math.max(1, Math.floor((area.h - PAD * 2 + 3) / ROW));
  const first = Math.max(0, rows.length - capacity);
  const marks = new MarkTracker(params.marks, t, { mode: 'inverse', color: C.black });
  const anchors: AnchorMap = {};
  const rowY = (row: number): number => area.y + PAD + (row - first) * ROW;
  rows.forEach((row, index) => {
    const y = rowY(Math.max(first, index));
    if (index >= first) {
      const promptWidth = row.prompt ? Array.from(prompt).length : 0;
      if (promptWidth > 0) drawText(canvas, prompt, area.x + PAD, y, scheme.prompt, { mono: true });
      const body = Array.from(row.text).slice(promptWidth).join('');
      marks.text(canvas, body, area.x + PAD + promptWidth * MONO_CELL, y, row.color, {
        mono: true,
      });
    }
    if (row.index >= 0) {
      anchors[`line:${String(row.index)}`] ??= [
        area.x + PAD + (Array.from(row.text).length * MONO_CELL) / 2,
        y + 3.5,
      ];
    }
  });
  schedule.lines.forEach((line) => {
    anchors[`line:${String(line.index)}`] ??= [
      area.x + PAD + 20,
      rowY(Math.max(first, rows.length)),
    ];
  });
  const lastRow = Math.max(first, rows.length - 1);
  anchors['last'] = [area.x + area.w / 2, rowY(lastRow) + 3.5];
  if (cursorRow >= 0) {
    const x = area.x + PAD + cursorColumn * MONO_CELL;
    const y = rowY(cursorRow);
    const blinkOn = state.typing || Math.floor(t * 2.5) % 2 === 0;
    if (blinkOn && cursorRow >= first) fillRect(canvas, rect(x, y, 5, 7), scheme.ink);
    anchors['cursor'] = [x + 2.5, y + 3.5];
    anchors['prompt'] = [area.x + PAD + 2, y + 3.5];
  } else {
    anchors['cursor'] = anchors['last'];
    anchors['prompt'] = anchors['last'];
  }
  return { ...anchors, ...marks.anchors([area.x + area.w / 2, area.y + area.h / 2]) };
}

export function terminalPainter(params: RetroTerminalParams): RetroPainter {
  const framed = params.frame === 'window';
  const shadow = framed ? 4 : 0;
  return {
    width: params.size[0] + shadow,
    height: params.size[1] + shadow,
    paint(canvas, t) {
      if (!framed) return paintScreen(canvas, rect(0, 0, canvas.width, canvas.height), params, t);
      const frame = rect(0, 0, canvas.width - shadow, canvas.height - shadow);
      dropShadow(canvas, frame, shadow);
      const layout = drawChrome(canvas, frame, {
        title: params.title,
        active: true,
        accent: params.accent,
        content: C.black,
      });
      return {
        ...paintScreen(canvas, layout.content, params, t),
        title: layout.title,
        close: layout.close,
      };
    },
  };
}

export const retroTerminal = defineProp({
  name: 'retroTerminal',
  description:
    'Retro text terminal (look retro-ui): prompt, typed commands with a block cursor, printed output (tones), scrollback; in a window or bare for a CRT (crt.show(terminal)). Typing is a pure function of t; give a line `at` to land it on a spoken word.',
  params: retroTerminalParams,
  anchors: {
    'line:<i>': 'line i of the script (where it is or will appear)',
    cursor: 'the cursor',
    prompt: 'start of the open prompt',
    last: 'the newest row',
    title: 'window title (frame window)',
    'mark:<text>': 'a phrase listed in marks (inverse video from its at)',
  },
  methods: {
    'update(t)': 'types/prints/scrolls for local time t; call every frame',
    'fitDistance(px = 2, fov = 50)': 'camera distance for one UI pixel = px frame pixels',
  },
  build(params, tools) {
    return createSurface(tools, {
      kitType: 'retroTerminal',
      painter: terminalPainter(params),
      pixel: params.pixel,
    });
  },
});

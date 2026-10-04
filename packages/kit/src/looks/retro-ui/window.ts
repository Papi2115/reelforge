/**
 * `kit.props.retroWindow`: a retro-OS window (title bar, boxes, optional menu, sunken content)
 * with a see-through drop shadow, up to two inactive windows stacked behind, a zoom-rect
 * open/close animation and a pointer that clicks a button. Content: text, dialog, progress,
 * icons, image or blank; `show(child)` puts another template (terminal, browser...) inside.
 */
import { z } from 'zod';
import { EASES, progress } from '../../fx/shared.js';
import { defineProp } from '../../registry.js';
import {
  blit,
  centerOf,
  createCanvas,
  drawText,
  fillRect,
  inset,
  rect,
  strokeRect,
  textWidth,
  wrap,
  type PixelCanvas,
  type Point,
  type Rect,
} from './canvas.js';
import {
  button,
  DIALOG_ICONS,
  drawDialogIcon,
  drawChrome,
  drawIcon,
  drawPointer,
  dropShadow,
  iconKindOf,
  zoomRects,
} from './chrome.js';
import { ACCENT_BRIGHT, C, type Accent } from './colors.js';
import { accentParam, MarkTracker, marksParam, pixelParam, seedParam, sizeParam } from './marks.js';
import { drawGreek, drawPhoto, PHOTO_KINDS } from './photo.js';
import { adoptChild, createSurface, type AnchorMap, type RetroPainter } from './surface.js';

export const WINDOW_CONTENTS = ['text', 'dialog', 'progress', 'icons', 'image', 'blank'] as const;
const PHOTO_RAMP = [C.black, C.indigo, C.violet, C.pink, C.amber, C.cream];
const OPEN_TIME = 0.3;
const STACK_STEP = 10;
const SHADOW = 4;
const CLICK_TRAVEL = 0.75;
const CLICK_HOLD = 0.18;

export const retroWindowParams = z.object({
  title: z.string().max(40).default('UNTITLED').describe('Title bar text'),
  size: sizeParam(200, 120, [400, 300]),
  content: z
    .enum(WINDOW_CONTENTS)
    .default('text')
    .describe('text (lines), dialog (icon + message + buttons), progress, icons, image, blank'),
  lines: z
    .array(z.string().max(120))
    .max(12)
    .default(['HELLO, WORLD.'])
    .describe('Text lines; dialog: the message; progress: label (+ second line = file name)'),
  icon: z
    .enum(DIALOG_ICONS)
    .default('warning')
    .describe('Dialog icon: error, warning, info, question'),
  buttons: z.array(z.string().max(10)).min(1).max(3).default(['OK']).describe('Dialog buttons'),
  items: z
    .array(z.string().max(14))
    .max(12)
    .default(['MY PC', 'FILES', 'README.TXT', 'TRASH'])
    .describe('Icons content: labels (icon picked from the name: TRASH, PC, DISK, MAIL, X.TXT...)'),
  photo: z.enum(PHOTO_KINDS).default('landscape').describe('Image content: dithered photo kind'),
  fillStart: z.number().default(0.3).describe('Progress: local time the bar starts filling'),
  fillEnd: z.number().default(3).describe('Progress: local time it reaches fillTo'),
  fillTo: z.number().min(0).max(1).default(1).describe('Progress: final fill 0..1'),
  menu: z.array(z.string().max(8)).max(5).default([]).describe('Menu bar items (empty = none)'),
  accent: accentParam,
  stack: z.int().min(0).max(2).default(0).describe('Inactive windows stacked behind (0-2)'),
  shadow: z.boolean().default(true).describe('See-through checker drop shadow'),
  open: z.number().optional().describe('Local time it opens (0.3 s zoom); omit = open already'),
  close: z.number().optional().describe('Local time it closes (0.3 s zoom back)'),
  click: z
    .number()
    .optional()
    .describe('Local time the pointer clicks the first dialog button (else the close box)'),
  marks: marksParam,
  pixel: pixelParam,
  seed: seedParam,
});

export type RetroWindowParams = z.output<typeof retroWindowParams>;

interface ContentResult {
  readonly anchors: AnchorMap;
  /** Point the pointer clicks (dialog button). */
  readonly target?: Point;
}

function paintText(
  canvas: PixelCanvas,
  area: Rect,
  params: RetroWindowParams,
  marks: MarkTracker,
): ContentResult {
  const anchors: AnchorMap = {};
  let y = area.y + 4;
  let index = 0;
  for (const line of params.lines) {
    for (const part of wrap(line, area.w - 8, 4)) {
      if (y + 7 > area.y + area.h - 2) break;
      marks.text(canvas, part, area.x + 4, y, C.black);
      anchors[`line:${String(index)}`] ??= [area.x + 4 + textWidth(part) / 2, y + 3.5];
      y += 10;
    }
    index += 1;
  }
  return { anchors };
}

function paintDialog(
  canvas: PixelCanvas,
  area: Rect,
  params: RetroWindowParams,
  marks: MarkTracker,
  pressed: boolean,
): ContentResult {
  fillRect(canvas, area, C.grey);
  drawDialogIcon(canvas, params.icon, area.x + 8, area.y + 8);
  const anchors: AnchorMap = { icon: [area.x + 15, area.y + 14] };
  const textLeft = area.x + 30;
  let y = area.y + 9;
  params.lines.forEach((line, index) => {
    for (const part of wrap(line, area.x + area.w - textLeft - 6, 3)) {
      if (y + 7 > area.y + area.h - 20) return;
      marks.text(canvas, part, textLeft, y, C.black);
      anchors[`line:${String(index)}`] ??= [textLeft + textWidth(part) / 2, y + 3.5];
      y += 10;
    }
  });
  const widths = params.buttons.map((label) => Math.max(44, textWidth(label) + 14));
  const total = widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 6;
  let x = Math.round(area.x + (area.w - total) / 2);
  let target: Point = [x, area.y + area.h - 11];
  params.buttons.forEach((label, index) => {
    const width = widths[index] ?? 44;
    const box = rect(x, area.y + area.h - 18, width, 15);
    if (index === 0) strokeRect(canvas, inset(box, -1), C.black);
    button(canvas, box, label, pressed && index === 0);
    anchors[index === 0 ? 'button' : `button:${String(index)}`] = centerOf(box);
    if (index === 0) target = centerOf(box);
    x += width + 6;
  });
  return { anchors, target };
}

function paintProgress(
  canvas: PixelCanvas,
  area: Rect,
  params: RetroWindowParams,
  accent: Accent,
  t: number,
): ContentResult {
  fillRect(canvas, area, C.grey);
  const [label = '', file] = params.lines;
  drawText(canvas, label, area.x + 6, area.y + 6, C.black);
  if (file !== undefined)
    drawText(canvas, file, area.x + 6, area.y + 17, C.darkGrey, { font: 'small' });
  const bar = rect(area.x + 6, area.y + area.h - 26, area.w - 12, 12);
  strokeRect(canvas, bar, C.midGrey);
  fillRect(canvas, inset(bar, 1), C.cream);
  const stepped = Math.floor(t * 8) / 8;
  const fill =
    params.fillTo * EASES.easeInOutCubic(progress(stepped, params.fillStart, params.fillEnd));
  const inner = inset(bar, 2);
  const chunks = Math.floor((inner.w + 1) / 7);
  const shown = Math.floor(chunks * fill + 1e-9);
  for (let chunk = 0; chunk < shown; chunk += 1) {
    fillRect(
      canvas,
      { x: inner.x + chunk * 7, y: inner.y, w: 6, h: inner.h },
      ACCENT_BRIGHT[accent],
    );
  }
  const percent = `${String(Math.round(fill * 100))}%`;
  drawText(canvas, percent, bar.x + bar.w - textWidth(percent), bar.y + bar.h + 3, C.black);
  return {
    anchors: {
      bar: [inner.x + Math.max(0, shown * 7 - 1), inner.y + inner.h / 2],
      line: [area.x + 6 + textWidth(label) / 2, area.y + 9],
    },
  };
}

function paintIcons(canvas: PixelCanvas, area: Rect, params: RetroWindowParams): ContentResult {
  const anchors: AnchorMap = {};
  const columns = Math.max(1, Math.floor((area.w - 4) / 44));
  params.items.forEach((label, index) => {
    const x = area.x + 4 + (index % columns) * 44;
    const y = area.y + 5 + Math.floor(index / columns) * 30;
    if (y + 24 > area.y + area.h) return;
    drawIcon(canvas, iconKindOf(label), x + 14, y);
    const text = label.length > 10 ? `${label.slice(0, 9)}.` : label;
    const width = textWidth(text, { font: 'small' });
    drawText(canvas, text, x + 22 - width / 2, y + 16, C.black, { font: 'small' });
    anchors[`item:${String(index)}`] = [x + 22, y + 7];
  });
  return { anchors };
}

type WindowPainter = RetroPainter & { child?: RetroPainter };

/** The open window (stack, shadow, chrome, content, pointer) at t; returns its anchors. */
function paintOpenWindow(
  canvas: PixelCanvas,
  front: Rect,
  params: RetroWindowParams,
  child: RetroPainter | undefined,
  t: number,
): AnchorMap {
  const shadow = params.shadow ? SHADOW : 0;
  for (let index = params.stack; index >= 1; index -= 1) {
    const behind = rect(
      front.x - index * STACK_STEP,
      front.y - index * STACK_STEP,
      front.w,
      front.h,
    );
    if (shadow > 0) dropShadow(canvas, behind, shadow);
    const layout = drawChrome(canvas, behind, {
      title: `UNTITLED ${String(index + 1)}`,
      active: false,
      accent: params.accent,
    });
    drawGreek(canvas, inset(layout.content, 4), C.tan, params.seed + index);
  }
  if (shadow > 0) dropShadow(canvas, front, shadow);
  const clickK = params.click === undefined ? -1 : t - params.click;
  const pressed = clickK >= 0 && clickK < CLICK_HOLD;
  const layout = drawChrome(canvas, front, {
    title: params.title,
    active: true,
    accent: params.accent,
    menu: params.menu,
    content: child ? C.black : C.cream,
    closePressed: pressed && params.content !== 'dialog' && child === undefined,
  });
  const content = layout.content;
  const marks = new MarkTracker(params.marks, t, { mode: 'marker', color: C.amber });
  let result: ContentResult = { anchors: {} };
  if (child) {
    const inner = createCanvas(content.w, content.h);
    const moved: AnchorMap = {};
    for (const [name, [x, y]] of Object.entries(child.paint(inner, t))) {
      moved[name] = [x + content.x, y + content.y];
    }
    blit(inner, canvas, content.x, content.y);
    result = { anchors: moved };
  } else if (params.content === 'text') result = paintText(canvas, content, params, marks);
  else if (params.content === 'dialog')
    result = paintDialog(canvas, content, params, marks, pressed);
  else if (params.content === 'progress')
    result = paintProgress(canvas, content, params, params.accent, t);
  else if (params.content === 'icons') result = paintIcons(canvas, content, params);
  else if (params.content === 'image')
    drawPhoto(canvas, content, params.photo, params.seed, PHOTO_RAMP);
  const own: AnchorMap = {
    window: centerOf(front),
    title: layout.title,
    close: layout.close,
    content: centerOf(content),
  };
  const target = result.target ?? layout.close;
  const start: Point = [front.x + front.w - 6, front.y + front.h - 4];
  let tip = start;
  if (params.click !== undefined) {
    const travel = EASES.easeOutCubic(progress(t, params.click - CLICK_TRAVEL, params.click - 0.1));
    tip = [start[0] + (target[0] - start[0]) * travel, start[1] + (target[1] - start[1]) * travel];
    if (t >= params.click - CLICK_TRAVEL) drawPointer(canvas, tip);
  }
  return { ...result.anchors, ...marks.anchors(centerOf(content)), ...own, pointer: tip };
}

/** Painter of a window; `child` (set by show()) replaces the content. */
export function windowPainter(params: RetroWindowParams): WindowPainter {
  const stack = params.stack * STACK_STEP;
  const shadow = params.shadow ? SHADOW : 0;
  let scratch: PixelCanvas | undefined;
  const painter: WindowPainter = {
    width: params.size[0] + stack + shadow,
    height: params.size[1] + stack + shadow,
    paint(canvas, t) {
      const front = rect(
        stack,
        stack,
        canvas.width - stack - shadow,
        canvas.height - stack - shadow,
      );
      const openK =
        params.open === undefined ? 1 : progress(t, params.open, params.open + OPEN_TIME);
      const closeK =
        params.close === undefined ? 0 : progress(t, params.close, params.close + OPEN_TIME);
      const k = Math.min(openK, 1 - closeK);
      if (k >= 1) return paintOpenWindow(canvas, front, params, painter.child, t);
      // Closed or zooming: the anchors stay where the window will be (painted off-screen).
      if (scratch?.width !== canvas.width || scratch.height !== canvas.height) {
        scratch = createCanvas(canvas.width, canvas.height);
      }
      const anchors = paintOpenWindow(scratch, front, params, painter.child, t);
      const centre = centerOf(front);
      const from = rect(
        centre[0] - front.w / 16,
        centre[1] - front.h / 16,
        front.w / 8,
        front.h / 8,
      );
      if (k > 0) zoomRects(canvas, from, front, EASES.easeOutCubic(k));
      return anchors;
    },
  };
  return painter;
}

export const retroWindow = defineProp({
  name: 'retroWindow',
  description:
    'Retro-OS window (look retro-ui): title bar, boxes, menu, content (text, dialog, progress bar, icons, dithered image) with a checker drop shadow and stacked windows; zoom open/close and a pointer click by t. window.show(child) puts a terminal/browser inside.',
  params: retroWindowParams,
  anchors: {
    title: 'title bar text',
    close: 'close box',
    content: 'centre of the content area',
    button: 'first dialog button',
    bar: 'progress bar head',
    'line:<i>': 'text/dialog line i',
    'item:<i>': 'icon i',
    pointer: 'pointer tip (while clicking)',
    'mark:<text>': 'a phrase listed in marks',
  },
  methods: {
    'update(t)': 'repaints for local time t (open/close, progress, click); call every frame',
    'show(child)':
      "paints another retro template (e.g. retroTerminal({ frame: 'none' })) in the content area; its anchors pass through",
    'fitDistance(px = 2, fov = 50)': 'camera distance for one UI pixel = px frame pixels',
  },
  build(params, tools) {
    const painter = windowPainter(params);
    const object = createSurface(tools, { kitType: 'retroWindow', painter, pixel: params.pixel });
    const show = (child: unknown): typeof object => {
      painter.child = adoptChild('retroWindow.show(child)', child);
      object.update(0);
      return object;
    };
    return Object.assign(object, { show });
  },
});

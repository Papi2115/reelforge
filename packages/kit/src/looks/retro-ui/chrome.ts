/**
 * Retro-OS chrome shared by the templates: bevelled panels and buttons, the window frame (title
 * bar with a dithered accent gradient, close/maximise/minimise boxes, optional menu bar, sunken
 * content well), see-through checker drop shadows, the zoom-rect open animation, the mouse
 * pointer and 16x16 desktop icons. Pure drawing on a PixelCanvas.
 */
import {
  checkerRect,
  clipText,
  ditherPick,
  dottedRect,
  drawSprite,
  drawText,
  fillRect,
  inset,
  rect,
  strokeRect,
  textWidth,
  type PixelCanvas,
  type Point,
  type Rect,
} from './canvas.js';
import { ACCENT_RAMP, C, type Accent } from './colors.js';

export const TITLE_BAR = 11;
export const MENU_BAR = 11;
const BUTTON = 9;

/** Raised (light top-left) or sunken (dark top-left) 1-px bevel inside `area`. */
export function bevel(canvas: PixelCanvas, area: Rect, raised: boolean): void {
  const light = raised ? C.cream : C.midGrey;
  const dark = raised ? C.midGrey : C.cream;
  fillRect(canvas, { x: area.x, y: area.y, w: area.w, h: 1 }, light);
  fillRect(canvas, { x: area.x, y: area.y, w: 1, h: area.h }, light);
  fillRect(canvas, { x: area.x, y: area.y + area.h - 1, w: area.w, h: 1 }, dark);
  fillRect(canvas, { x: area.x + area.w - 1, y: area.y, w: 1, h: area.h }, dark);
}

/** Grey push button with an optional label (pressed = sunken, label shifted by one pixel). */
export function button(canvas: PixelCanvas, area: Rect, label: string, pressed: boolean): void {
  strokeRect(canvas, area, C.black);
  const face = inset(area, 1);
  fillRect(canvas, face, C.grey);
  bevel(canvas, face, !pressed);
  if (label.length === 0) return;
  const shift = pressed ? 1 : 0;
  const width = textWidth(label);
  drawText(
    canvas,
    label,
    Math.round(area.x + (area.w - width) / 2) + shift,
    Math.round(area.y + (area.h - 7) / 2) + shift,
    C.black,
  );
}

/** Checker shadow to the right of and below `area` (see-through: odd pixels stay clear). */
export function dropShadow(canvas: PixelCanvas, area: Rect, offset = 4): void {
  checkerRect(canvas, { x: area.x + area.w, y: area.y + offset, w: offset, h: area.h }, C.black);
  checkerRect(canvas, { x: area.x + offset, y: area.y + area.h, w: area.w, h: offset }, C.black);
}

export interface ChromeOptions {
  readonly title: string;
  readonly active: boolean;
  readonly accent: Accent;
  readonly menu?: readonly string[] | undefined;
  /** Fill of the content well (default cream). */
  readonly content?: number | undefined;
  /** Close box drawn pressed. */
  readonly closePressed?: boolean | undefined;
}

export interface ChromeLayout {
  readonly frame: Rect;
  readonly titleBar: Rect;
  /** Inside of the content well. */
  readonly content: Rect;
  readonly title: Point;
  readonly close: Point;
}

const CLOSE_GLYPH = ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'];
const MAX_GLYPH = ['#####', '#####', '#...#', '#...#', '#####'];
const MIN_GLYPH = ['.....', '.....', '.....', '.....', '#####'];

/** Draws a window frame filling `frame`; returns where its parts are. */
export function drawChrome(canvas: PixelCanvas, frame: Rect, options: ChromeOptions): ChromeLayout {
  strokeRect(canvas, frame, C.black);
  const body = inset(frame, 1);
  fillRect(canvas, body, C.grey);
  bevel(canvas, body, true);
  const titleBar = rect(frame.x + 2, frame.y + 2, frame.w - 4, TITLE_BAR);
  const [dark, light] = options.active ? ACCENT_RAMP[options.accent] : [C.darkGrey, C.midGrey];
  for (let y = titleBar.y; y < titleBar.y + titleBar.h; y += 1) {
    for (let x = titleBar.x; x < titleBar.x + titleBar.w; x += 1) {
      const value = (x - titleBar.x) / Math.max(1, titleBar.w - 1);
      fillRect(canvas, { x, y, w: 1, h: 1 }, ditherPick(x, y, value, [dark, light]));
    }
  }
  const buttonsWidth = BUTTON * 3 + 2;
  const titleText = clipText(options.title, titleBar.w - buttonsWidth - 8, { bold: true });
  drawText(canvas, titleText, titleBar.x + 3, titleBar.y + 2, options.active ? C.cream : C.grey, {
    bold: true,
  });
  const glyphs = [MIN_GLYPH, MAX_GLYPH, CLOSE_GLYPH];
  let close: Point = [titleBar.x + titleBar.w - 6, titleBar.y + 5];
  glyphs.forEach((glyph, index) => {
    const box = rect(
      titleBar.x + titleBar.w - (3 - index) * (BUTTON + 1),
      titleBar.y + 1,
      BUTTON,
      BUTTON,
    );
    const pressed = index === 2 && options.closePressed === true;
    button(canvas, box, '', pressed);
    drawSprite(
      canvas,
      glyph,
      { '#': C.black },
      box.x + 2 + (pressed ? 1 : 0),
      box.y + 2 + (pressed ? 1 : 0),
    );
    if (index === 2) close = [box.x + box.w / 2, box.y + box.h / 2];
  });
  let top = titleBar.y + titleBar.h + 1;
  const menu = options.menu ?? [];
  if (menu.length > 0) {
    let x = frame.x + 6;
    for (const item of menu) {
      const width = drawText(canvas, item, x, top + 2, C.black);
      fillRect(canvas, { x, y: top + 10, w: 5, h: 1 }, C.black);
      x += width + 9;
    }
    top += MENU_BAR;
  }
  const well = rect(frame.x + 3, top + 1, frame.w - 6, frame.y + frame.h - 4 - top);
  bevel(canvas, well, false);
  strokeRect(canvas, inset(well, 1), C.black);
  const content = inset(well, 2);
  fillRect(canvas, content, options.content ?? C.cream);
  return {
    frame,
    titleBar,
    content,
    title: [titleBar.x + 3 + textWidth(titleText, { bold: true }) / 2, titleBar.y + 5],
    close,
  };
}

/** Mac-style zoom rectangles from `from` to `to` (k = 0..1, trailing outlines). */
export function zoomRects(canvas: PixelCanvas, from: Rect, to: Rect, k: number): void {
  for (const lag of [0, 0.18, 0.36]) {
    const step = k - lag;
    if (step <= 0) continue;
    const lerp = (a: number, b: number): number => a + (b - a) * step;
    dottedRect(
      canvas,
      rect(lerp(from.x, to.x), lerp(from.y, to.y), lerp(from.w, to.w), lerp(from.h, to.h)),
      lag === 0 ? C.cream : C.black,
    );
  }
}

const POINTER = [
  'X..........',
  'XX.........',
  'XoX........',
  'XooX.......',
  'XoooX......',
  'XooooX.....',
  'XoooooX....',
  'XooooooX...',
  'XoooooooX..',
  'XooooXXXXX.',
  'XooXooX....',
  'XoX.XooX...',
  'XX..XooX...',
  'X....XooX..',
  '.....XXXX..',
];

/** Arrow pointer with its hot spot (tip) at `tip`. */
export function drawPointer(canvas: PixelCanvas, tip: Point): void {
  drawSprite(canvas, POINTER, { X: C.black, o: C.cream }, Math.round(tip[0]), Math.round(tip[1]));
}

export const ICON_KINDS = ['folder', 'file', 'computer', 'disk', 'trash', 'mail'] as const;
export type IconKind = (typeof ICON_KINDS)[number];

const ICONS: Readonly<Record<IconKind, readonly string[]>> = {
  folder: [
    '................',
    '.XXXXX..........',
    'XaaaaaX.........',
    'XaaaaaaXXXXXXXX.',
    'XbbbbbbbbbbbbbbX',
    'XaaaaaaaaaaaaaaX',
    'XaaaaaaaaaaaaaaX',
    'XaaaaaaaaaaaaaaX',
    'XaaaaaaaaaaaaaaX',
    'XaaaaaaaaaaaaaaX',
    'XaaaaaaaaaaaaaaX',
    'XccccccccccccccX',
    '.XXXXXXXXXXXXXX.',
  ],
  file: [
    '..XXXXXXXX......',
    '..XwwwwwwXX.....',
    '..XwwwwwwXwX....',
    '..XwkkkkwXXXX...',
    '..XwwwwwwwwwX...',
    '..XwkkkkkkkwX...',
    '..XwwwwwwwwwX...',
    '..XwkkkkkkkwX...',
    '..XwwwwwwwwwX...',
    '..XwkkkkkwwwX...',
    '..XwwwwwwwwwX...',
    '..XgggggggggX...',
    '..XXXXXXXXXXX...',
  ],
  computer: [
    '.XXXXXXXXXXXXX..',
    '.XgggggggggggX..',
    '.XgXXXXXXXXXgX..',
    '.XgXsssssssXgX..',
    '.XgXsssssssXgX..',
    '.XgXsssssssXgX..',
    '.XgXXXXXXXXXgX..',
    '.XggggggggglgX..',
    '.XXXXXXXXXXXXX..',
    '...XgggggggX....',
    '.XXXXXXXXXXXXX..',
    '.XgkgkgkgkgkgX..',
    '.XXXXXXXXXXXXX..',
  ],
  disk: [
    '.XXXXXXXXXXXX...',
    '.XddXwwwwXddX...',
    '.XddXwwkwXddX...',
    '.XddXwwkwXddX...',
    '.XddXXXXXXddX...',
    '.XddddddddddX...',
    '.XdwwwwwwwwdX...',
    '.XdwkkkkkkwdX...',
    '.XdwwwwwwwwdX...',
    '.XdwkkkkkkwdX...',
    '.XdwwwwwwwwdX...',
    '.XXXXXXXXXXXX...',
    '................',
  ],
  trash: [
    '.....XXXX.......',
    '.XXXXXXXXXXXX...',
    '.XggggggggggX...',
    '.XXXXXXXXXXXX...',
    '..XgkgkgkgkX....',
    '..XgkgkgkgkX....',
    '..XgkgkgkgkX....',
    '..XgkgkgkgkX....',
    '..XgkgkgkgkX....',
    '..XgkgkgkgkX....',
    '..XgkgkgkgkX....',
    '..XggggggggX....',
    '..XXXXXXXXXX....',
  ],
  mail: [
    '................',
    '................',
    'XXXXXXXXXXXXXXX.',
    'XwXwwwwwwwwwXwX.',
    'XwwXwwwwwwwXwwX.',
    'XwwwXwwwwwXwwwX.',
    'XwwwwXwwwXwwwwX.',
    'XwwwwwXXXwwwwwX.',
    'XwwwwwwwwwwwwwX.',
    'XwwwwwwwwwwwwwX.',
    'XwwwwwwwwwwwwwX.',
    'XXXXXXXXXXXXXXX.',
    '................',
  ],
};

const ICON_KEY: Readonly<Record<string, number>> = {
  X: C.black,
  a: C.amber,
  b: C.cream,
  c: C.orange,
  w: C.cream,
  k: C.midGrey,
  g: C.grey,
  s: C.teal,
  l: C.green,
  d: C.slateBlue,
};

/** Icon kind guessed from a label (TRASH/BIN, PC/COMPUTER, DISK, MAIL, a file name, else folder). */
export function iconKindOf(label: string): IconKind {
  const upper = label.toUpperCase();
  if (/TRASH|BIN|RECYCLE/.test(upper)) return 'trash';
  if (/\bPC\b|COMPUTER|SYSTEM/.test(upper)) return 'computer';
  if (/DISK|FLOPPY|DRIVE/.test(upper)) return 'disk';
  if (/MAIL|INBOX|MESSAGE/.test(upper)) return 'mail';
  if (/\.[A-Z0-9]{1,4}$/.test(upper)) return 'file';
  return 'folder';
}

/** 16x13 icon with its top-left corner at (x, y). */
export function drawIcon(canvas: PixelCanvas, kind: IconKind, x: number, y: number): void {
  drawSprite(canvas, ICONS[kind], ICON_KEY, x, y);
}

export const DIALOG_ICONS = ['error', 'warning', 'info', 'question'] as const;
export type DialogIcon = (typeof DIALOG_ICONS)[number];

const DIALOG_SPRITES: Readonly<Record<DialogIcon, readonly string[]>> = {
  error: [
    '....XXXXXX....',
    '..XXrrrrrrXX..',
    '.XrrrrrrrrrrX.',
    '.XrrwrrrrwrrX.',
    'XrrrwwrrwwrrrX',
    'XrrrrwwwwrrrrX',
    'XrrrrrwwrrrrrX',
    'XrrrrwwwwrrrrX',
    'XrrrwwrrwwrrrX',
    '.XrrwrrrrwrrX.',
    '.XrrrrrrrrrrX.',
    '..XXrrrrrrXX..',
    '....XXXXXX....',
  ],
  warning: [
    '......XX......',
    '.....XyyX.....',
    '.....XyyX.....',
    '....XyyyyX....',
    '....XykkyX....',
    '...XyykkyyX...',
    '...XyykkyyX...',
    '..XyyykkyyyX..',
    '..XyyykkyyyX..',
    '.XyyyyyyyyyyX.',
    '.XyyyykkyyyyX.',
    'XyyyyyyyyyyyyX',
    'XXXXXXXXXXXXXX',
  ],
  info: [
    '....XXXXXX....',
    '..XXbbbbbbXX..',
    '.XbbbbwwbbbbX.',
    '.XbbbbwwbbbbX.',
    'XbbbbbbbbbbbbX',
    'XbbbbwwwbbbbbX',
    'XbbbbbwwbbbbbX',
    'XbbbbbwwbbbbbX',
    'XbbbbbwwbbbbbX',
    '.XbbbwwwwbbbX.',
    '.XbbbbbbbbbbX.',
    '..XXbbbbbbXX..',
    '....XXXXXX....',
  ],
  question: [
    '....XXXXXX....',
    '..XXbbbbbbXX..',
    '.XbbbwwwwbbbX.',
    '.XbbwwbbwwbbX.',
    'XbbbbbbbwwbbbX',
    'XbbbbbbwwbbbbX',
    'XbbbbbwwbbbbbX',
    'XbbbbbwwbbbbbX',
    'XbbbbbbbbbbbbX',
    '.XbbbbwwbbbbX.',
    '.XbbbbwwbbbbX.',
    '..XXbbbbbbXX..',
    '....XXXXXX....',
  ],
};
const DIALOG_KEY = { X: C.black, r: C.pink, w: C.cream, y: C.amber, k: C.black, b: C.teal };

/** 14x13 dialog icon with its top-left corner at (x, y). */
export function drawDialogIcon(canvas: PixelCanvas, kind: DialogIcon, x: number, y: number): void {
  drawSprite(canvas, DIALOG_SPRITES[kind], DIALOG_KEY, x, y);
}

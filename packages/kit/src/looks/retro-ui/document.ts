/**
 * `kit.props.retroDocument`: paper proof - a newspaper front page (masthead, rules, headline,
 * halftone photo, columns), a dossier (manila folder, clipped mugshot, typed fields, redaction
 * bars that wipe on by t) or a memo - on grainy dithered paper, with a rubber stamp that slams
 * on at a time and marker highlights over marked phrases.
 */
import { z } from 'zod';
import { hashCell } from '../../env/shared.js';
import { EASES, progress } from '../../fx/shared.js';
import { defineProp } from '../../registry.js';
import {
  centerOf,
  checkerRect,
  clipText,
  drawText,
  drawTextCentered,
  fillRect,
  inset,
  rect,
  strokeRect,
  textWidth,
  wrap,
  type PixelCanvas,
  type Rect,
} from './canvas.js';
import { dropShadow } from './chrome.js';
import { C } from './colors.js';
import { MarkTracker, marksParam, pixelParam, seedParam } from './marks.js';
import { drawGreek, drawPhoto, PHOTO_KINDS } from './photo.js';
import { drawStamp, STAMP_TIME } from './stamp.js';
import { createSurface, type AnchorMap, type RetroPainter } from './surface.js';

const VARIANTS = ['newspaper', 'dossier', 'memo'] as const;
type Variant = (typeof VARIANTS)[number];
const DEFAULT_SIZE: Readonly<Record<Variant, readonly [number, number]>> = {
  newspaper: [220, 290],
  dossier: [280, 176],
  memo: [170, 220],
};
const HALFTONE = [C.black, C.darkGrey, C.tan, C.cream];
const REDACT_TIME = 0.4;

export const retroDocumentParams = z.object({
  variant: z
    .enum(VARIANTS)
    .default('newspaper')
    .describe('newspaper, dossier (folder + file) or memo'),
  title: z.string().max(30).optional().describe('Masthead / folder label / memo heading'),
  headline: z
    .string()
    .max(80)
    .default('CALCULATOR RUNS DOOM')
    .describe('Headline (newspaper, memo subject)'),
  date: z.string().max(30).default('MONDAY, MAY 4, 1998').describe('Dateline'),
  body: z.string().max(500).optional().describe('Body copy in small caps (omit = greeked columns)'),
  photo: z
    .enum([...PHOTO_KINDS, 'none'])
    .optional()
    .describe('Halftone photo (default per variant)'),
  caption: z.string().max(40).default('').describe('Photo caption'),
  fields: z
    .array(
      z.object({
        label: z.string().max(12),
        value: z.string().max(28),
        redactAt: z.number().optional(),
      }),
    )
    .max(8)
    .default([
      { label: 'NAME', value: 'J. DOE' },
      { label: 'ALIAS', value: 'THE CALCULATOR' },
      { label: 'STATUS', value: 'AT LARGE' },
    ])
    .describe('Dossier/memo typed fields; redactAt = time a black bar wipes over the value'),
  stamp: z
    .object({
      text: z.string().max(16).default('CONFIDENTIAL'),
      at: z.number().optional().describe('Local time it slams on (omit = already there)'),
      color: z.enum(['red', 'ink']).default('red'),
      position: z
        .tuple([z.number().min(0).max(1), z.number().min(0).max(1)])
        .default([0.62, 0.55])
        .describe('Centre on the page as [u, v] fractions'),
    })
    .optional()
    .describe('Rubber stamp across the page'),
  size: z
    .tuple([z.int().min(80).max(400), z.int().min(80).max(400)])
    .optional()
    .describe('[width, height] in UI pixels (default per variant)'),
  marks: marksParam,
  pixel: pixelParam,
  seed: seedParam,
});

export type RetroDocumentParams = z.output<typeof retroDocumentParams>;

/** Cream paper with a dithered grain and a darker rim. */
function paper(canvas: PixelCanvas, area: Rect, seed: number): void {
  fillRect(canvas, area, C.cream);
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (hashCell(x, y, 9, seed) < 0.035) canvas.data[y * canvas.width + x] = C.tan;
    }
  }
  checkerRect(canvas, { x: area.x, y: area.y, w: area.w, h: 1 }, C.tan);
  checkerRect(canvas, { x: area.x, y: area.y + area.h - 1, w: area.w, h: 1 }, C.tan);
  strokeRect(canvas, inset(area, -1), C.darkGrey);
}

function paintNewspaper(
  canvas: PixelCanvas,
  page: Rect,
  params: RetroDocumentParams,
  marks: MarkTracker,
): AnchorMap {
  const anchors: AnchorMap = {};
  const cx = page.x + page.w / 2;
  let y = page.y + 6;
  const masthead = params.title ?? 'THE DAILY BYTE';
  const mastStyle =
    textWidth(masthead, { scale: 2, bold: true }) <= page.w - 12
      ? { scale: 2, bold: true }
      : { bold: true };
  drawTextCentered(canvas, masthead, cx, y, C.black, mastStyle);
  anchors['masthead'] = [cx, y + 7];
  y += mastStyle.scale === 2 ? 17 : 10;
  fillRect(canvas, rect(page.x + 5, y, page.w - 10, 2), C.black);
  drawText(
    canvas,
    clipText(params.date, page.w / 2, { font: 'small' }),
    page.x + 6,
    y + 4,
    C.black,
    { font: 'small' },
  );
  drawText(
    canvas,
    'EXTRA',
    page.x + page.w - 6 - textWidth('EXTRA', { font: 'small' }),
    y + 4,
    C.black,
    { font: 'small' },
  );
  y += 11;
  fillRect(canvas, rect(page.x + 5, y, page.w - 10, 1), C.black);
  y += 5;
  const headStyle = { scale: 2, bold: true };
  for (const line of wrap(params.headline, page.w - 12, 3, headStyle)) {
    const left = Math.round(cx - textWidth(line, headStyle) / 2);
    marks.text(canvas, line, left, y, C.black, headStyle);
    anchors['headline'] ??= [cx, y + 7];
    y += 17;
  }
  const photoKind = params.photo ?? 'crowd';
  if (photoKind !== 'none') {
    const photo = rect(page.x + 8, y + 1, page.w - 16, Math.round((page.w - 16) * 0.5));
    strokeRect(canvas, inset(photo, -1), C.black);
    drawPhoto(canvas, photo, photoKind, params.seed, HALFTONE);
    anchors['photo'] = centerOf(photo);
    y = photo.y + photo.h + 3;
    if (params.caption.length > 0) {
      drawText(
        canvas,
        clipText(params.caption, photo.w, { font: 'small' }),
        photo.x,
        y,
        C.darkGrey,
        { font: 'small' },
      );
      y += 8;
    }
  }
  const columns = 3;
  const gap = 6;
  const width = Math.floor((page.w - 12 - gap * (columns - 1)) / columns);
  const bodyLines =
    params.body === undefined ? [] : wrap(params.body, width, 60, { font: 'small' });
  for (let column = 0; column < columns; column += 1) {
    const area = rect(page.x + 6 + column * (width + gap), y + 2, width, page.y + page.h - y - 8);
    if (column > 0) fillRect(canvas, rect(area.x - gap / 2, area.y, 1, area.h), C.tan);
    const perColumn = Math.floor(area.h / 6);
    const own = bodyLines.slice(column * perColumn, (column + 1) * perColumn);
    if (own.length === 0) drawGreek(canvas, area, C.darkGrey, params.seed + column, 4);
    else
      own.forEach((line, index) =>
        marks.text(canvas, line, area.x, area.y + index * 6, C.black, { font: 'small' }),
      );
  }
  anchors['body'] = [cx, y + (page.y + page.h - y) / 2];
  return anchors;
}

function paintFields(
  canvas: PixelCanvas,
  area: Rect,
  params: RetroDocumentParams,
  marks: MarkTracker,
  t: number,
): AnchorMap {
  const anchors: AnchorMap = {};
  const labelWidth =
    Math.max(...params.fields.map((field) => textWidth(`${field.label}:`, { mono: true })), 0) + 6;
  params.fields.forEach((field, index) => {
    const y = area.y + index * 12;
    if (y + 7 > area.y + area.h) return;
    drawText(canvas, `${field.label}:`, area.x, y, C.darkGrey, { mono: true });
    const value = clipText(field.value, area.w - labelWidth, { mono: true });
    const width = marks.text(canvas, value, area.x + labelWidth, y, C.black, { mono: true });
    anchors[`field:${String(index)}`] = [area.x + labelWidth + width / 2, y + 3.5];
    if (field.redactAt !== undefined) {
      const k = EASES.easeOutCubic(progress(t, field.redactAt, field.redactAt + REDACT_TIME));
      if (k > 0)
        fillRect(
          canvas,
          rect(area.x + labelWidth - 2, y - 2, Math.round((width + 4) * k), 11),
          C.black,
        );
    }
  });
  return anchors;
}

function paintDossier(
  canvas: PixelCanvas,
  area: Rect,
  params: RetroDocumentParams,
  marks: MarkTracker,
  t: number,
): AnchorMap {
  const folder = rect(area.x, area.y + 12, area.w, area.h - 12);
  const tab = rect(area.x + 10, area.y + 2, Math.min(110, area.w / 2), 12);
  for (const part of [tab, folder]) {
    fillRect(canvas, part, C.tan);
    strokeRect(canvas, part, C.rust);
  }
  fillRect(canvas, rect(tab.x + 1, tab.y + tab.h - 1, tab.w - 2, 2), C.tan);
  const label = params.title ?? 'CASE FILE 0451';
  drawText(canvas, clipText(label, tab.w - 8, { mono: true }), tab.x + 5, tab.y + 3, C.rust, {
    mono: true,
  });
  const sheet = rect(folder.x + 12, folder.y + 7, folder.w - 22, folder.h - 12);
  checkerRect(canvas, rect(sheet.x + 3, sheet.y + 3, sheet.w, sheet.h), C.rust);
  paper(canvas, sheet, params.seed);
  const photoKind = params.photo ?? 'portrait';
  const anchors: AnchorMap = { folder: centerOf(folder), tab: centerOf(tab) };
  let textLeft = sheet.x + 8;
  if (photoKind !== 'none') {
    const photo = rect(sheet.x + 8, sheet.y + 12, 56, 70);
    strokeRect(canvas, inset(photo, -1), C.black);
    drawPhoto(canvas, photo, photoKind, params.seed, HALFTONE);
    fillRect(canvas, rect(photo.x + 10, photo.y - 5, 3, 12), C.midGrey);
    strokeRect(canvas, rect(photo.x + 8, photo.y - 6, 7, 14), C.grey);
    anchors['photo'] = centerOf(photo);
    textLeft = photo.x + photo.w + 10;
  }
  drawText(canvas, 'SUBJECT REPORT', textLeft, sheet.y + 10, C.black, { mono: true });
  fillRect(canvas, rect(textLeft, sheet.y + 19, sheet.x + sheet.w - 8 - textLeft, 1), C.black);
  const fields = rect(textLeft, sheet.y + 25, sheet.x + sheet.w - 8 - textLeft, sheet.h - 30);
  Object.assign(anchors, paintFields(canvas, fields, params, marks, t));
  const notes = rect(
    textLeft,
    fields.y + params.fields.length * 12 + 4,
    fields.w,
    sheet.y + sheet.h - 6 - (fields.y + params.fields.length * 12 + 4),
  );
  if (notes.h > 6) drawGreek(canvas, notes, C.midGrey, params.seed, 5);
  return anchors;
}

function paintMemo(
  canvas: PixelCanvas,
  page: Rect,
  params: RetroDocumentParams,
  marks: MarkTracker,
  t: number,
): AnchorMap {
  const heading = params.title ?? 'MEMORANDUM';
  drawText(canvas, heading, page.x + 8, page.y + 8, C.black, { scale: 2, bold: true });
  const anchors: AnchorMap = {
    masthead: [page.x + 8 + textWidth(heading, { scale: 2, bold: true }) / 2, page.y + 15],
  };
  fillRect(canvas, rect(page.x + 8, page.y + 26, page.w - 16, 2), C.black);
  const fields = rect(page.x + 8, page.y + 34, page.w - 16, params.fields.length * 12);
  Object.assign(anchors, paintFields(canvas, fields, params, marks, t));
  let y = fields.y + fields.h + 4;
  marks.text(
    canvas,
    clipText(`RE: ${params.headline}`, page.w - 16, { mono: true }),
    page.x + 8,
    y,
    C.black,
    { mono: true },
  );
  anchors['headline'] = [page.x + page.w / 2, y + 3.5];
  y += 14;
  const body = rect(page.x + 8, y, page.w - 16, page.y + page.h - y - 10);
  if (params.body === undefined) drawGreek(canvas, body, C.darkGrey, params.seed, 5);
  else
    wrap(params.body, body.w, Math.floor(body.h / 6), { font: 'small' }).forEach((line, index) =>
      marks.text(canvas, line, body.x, body.y + index * 6, C.black, { font: 'small' }),
    );
  anchors['body'] = centerOf(body);
  return anchors;
}

export function documentSize(params: RetroDocumentParams): readonly [number, number] {
  return params.size ?? DEFAULT_SIZE[params.variant];
}

export function documentPainter(params: RetroDocumentParams): RetroPainter {
  const [width, height] = documentSize(params);
  return {
    width: width + 4,
    height: height + 4,
    paint(canvas, t) {
      const page = rect(1, 1, canvas.width - 6, canvas.height - 6);
      const marks = new MarkTracker(params.marks, t, { mode: 'marker', color: C.amber });
      let anchors: AnchorMap;
      if (params.variant === 'dossier') {
        anchors = paintDossier(canvas, page, params, marks, t);
      } else {
        dropShadow(canvas, inset(page, -1), 4);
        paper(canvas, page, params.seed);
        anchors =
          params.variant === 'newspaper'
            ? paintNewspaper(canvas, page, params, marks)
            : paintMemo(canvas, page, params, marks, t);
      }
      anchors['page'] = centerOf(page);
      if (params.stamp !== undefined) {
        const stamp = params.stamp;
        const k = stamp.at === undefined ? 1 : (t - stamp.at) / STAMP_TIME;
        const at: readonly [number, number] = [
          page.x + page.w * stamp.position[0],
          page.y + page.h * stamp.position[1],
        ];
        if (k >= 0)
          drawStamp(
            canvas,
            stamp.text,
            at,
            stamp.color === 'red' ? C.pink : C.navy,
            params.seed,
            k,
          );
        anchors['stamp'] = at;
      }
      return { ...anchors, ...marks.anchors(centerOf(page)) };
    },
  };
}

export const retroDocument = defineProp({
  name: 'retroDocument',
  description:
    'Paper proof (look retro-ui): newspaper front page (masthead, headline, halftone photo, columns), dossier (manila folder, clipped mugshot, typed fields with timed redaction bars) or memo, on grainy dithered paper; rubber stamp that slams on at a time; marker highlights.',
  params: retroDocumentParams,
  anchors: {
    masthead: 'newspaper masthead / memo heading',
    headline: 'headline (memo: RE line)',
    photo: 'halftone photo',
    body: 'body columns',
    'field:<i>': 'dossier/memo field value i',
    stamp: 'centre of the stamp',
    tab: 'dossier folder tab',
    'mark:<text>': 'a phrase listed in marks',
  },
  methods: {
    'update(t)': 'stamp, redactions and marker highlights for local time t; call every frame',
    'fitDistance(px = 2, fov = 50)': 'camera distance for one UI pixel = px frame pixels',
  },
  build(params, tools) {
    return createSurface(tools, {
      kitType: 'retroDocument',
      painter: documentPainter(params),
      pixel: params.pixel,
    });
  },
});

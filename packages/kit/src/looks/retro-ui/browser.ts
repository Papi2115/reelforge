/**
 * `kit.props.retroBrowser`: a 90s web browser window - tabs, back/forward/reload, address bar
 * (optionally typed), status bar with a loading bar - showing a news-style page: site banner,
 * headline, byline, dithered photo with caption, body copy (real small text or greeked) and a
 * hit counter. `load` reveals the page top-down with an interlaced (coarse -> fine) photo.
 */
import { z } from 'zod';
import { assetParam } from '../../assets/handle.js';
import { progress } from '../../fx/shared.js';
import { defineProp } from '../../registry.js';
import {
  centerOf,
  clipText,
  drawSprite,
  drawText,
  fillRect,
  inset,
  rect,
  strokeRect,
  textWidth,
  wrap,
  type PixelCanvas,
  type Rect,
} from './canvas.js';
import { bevel, button, drawChrome, dropShadow } from './chrome.js';
import { ACCENT_BRIGHT, ACCENT_RAMP, C, resolveRoles, type RoleColors } from './colors.js';
import { accentParam, MarkTracker, marksParam, pixelParam, seedParam, sizeParam } from './marks.js';
import { drawAssetColor, drawGreek, drawPhoto, PHOTO_KINDS } from './photo.js';
import { createSurface, type AnchorMap, type RetroPainter } from './surface.js';

const URL_CPS = 14;
const HEADLINE = { scale: 2, bold: true };
const PHOTO_RAMP = [C.black, C.indigo, C.violet, C.pink, C.amber, C.cream];

export const retroBrowserParams = z.object({
  url: z.string().max(60).default('WWW.BYTE-TIMES.COM').describe('Address bar text'),
  title: z.string().max(30).default('BYTE TIMES').describe('Tab and window title'),
  site: z.string().max(30).default('THE BYTE TIMES').describe('Site banner'),
  headline: z
    .string()
    .max(80)
    .default('CALCULATOR RUNS DOOM')
    .describe('Page headline (2 lines max)'),
  byline: z.string().max(40).default('BY STAFF WRITER').describe('Line under the headline'),
  body: z.string().max(400).optional().describe('Body copy in small caps (omit = greeked lines)'),
  photo: z
    .enum([...PHOTO_KINDS, 'none'])
    .default('city')
    .describe('Dithered photo kind or none'),
  asset: assetParam
    .optional()
    .describe(
      "Real picture for the photo block: ctx.assets.image('<id>') (replaces the placeholder)",
    ),
  caption: z.string().max(40).default('').describe('Photo caption'),
  tabs: z.array(z.string().max(14)).max(2).default([]).describe('Extra (inactive) tabs'),
  visitors: z.int().min(0).max(99999999).optional().describe('Hit counter value (omit = none)'),
  typeAt: z.number().optional().describe('Local time the URL is typed (omit = already there)'),
  loadAt: z.number().optional().describe('Local time the page starts loading (omit = loaded)'),
  loadTime: z.number().positive().default(1.4).describe('Seconds the page takes to load'),
  size: sizeParam(260, 170, [400, 300]),
  accent: accentParam,
  marks: marksParam,
  pixel: pixelParam,
  seed: seedParam,
});

export type RetroBrowserParams = z.output<typeof retroBrowserParams>;

const BACK = ['...#.', '..##.', '.####', '..##.', '...#.'];
const FORWARD = ['.#...', '.##..', '####.', '.##..', '.#...'];
const RELOAD = ['.###.', '#...#', '#..##', '#....', '.###.'];

function paintToolbar(
  canvas: PixelCanvas,
  area: Rect,
  params: RetroBrowserParams,
  t: number,
): AnchorMap {
  const tabs = [params.title, ...params.tabs];
  let x = area.x;
  tabs.forEach((label, index) => {
    const text = clipText(label, 60, { font: 'small' });
    const box = rect(
      x,
      area.y + (index === 0 ? 0 : 2),
      textWidth(text, { font: 'small' }) + 12,
      index === 0 ? 12 : 10,
    );
    fillRect(canvas, box, index === 0 ? C.grey : C.midGrey);
    bevel(canvas, { ...box, h: box.h + 2 }, true);
    drawText(canvas, text, box.x + 6, box.y + 4, C.black, { font: 'small' });
    x += box.w + 1;
  });
  const bar = rect(area.x, area.y + 12, area.w, 15);
  fillRect(canvas, { x: bar.x, y: bar.y, w: bar.w, h: 1 }, C.cream);
  [BACK, FORWARD, RELOAD].forEach((glyph, index) => {
    const box = rect(bar.x + 1 + index * 12, bar.y + 2, 11, 11);
    button(canvas, box, '', false);
    drawSprite(canvas, glyph, { '#': index === 1 ? C.midGrey : C.black }, box.x + 3, box.y + 3);
  });
  const field = rect(bar.x + 40, bar.y + 2, bar.w - 41, 11);
  fillRect(canvas, field, C.cream);
  bevel(canvas, field, false);
  const chars = params.typeAt === undefined ? Infinity : Math.floor((t - params.typeAt) * URL_CPS);
  const url = Array.from(params.url).slice(0, Math.max(0, chars)).join('');
  const shown = clipText(url, field.w - 10);
  const urlWidth = drawText(canvas, shown, field.x + 3, field.y + 2, C.black);
  const typing =
    params.typeAt !== undefined && t >= params.typeAt && chars <= Array.from(params.url).length;
  if (typing && Math.floor(t * 2.5) % 2 === 0)
    fillRect(canvas, rect(field.x + 4 + urlWidth, field.y + 2, 1, 7), C.black);
  return {
    url: [field.x + 3 + Math.max(10, urlWidth) / 2, field.y + 5.5],
    tab: [area.x + 10, area.y + 6],
  };
}

function loadProgress(params: RetroBrowserParams, t: number): number {
  if (params.loadAt === undefined) return 1;
  return progress(Math.floor(t * 10) / 10, params.loadAt, params.loadAt + params.loadTime);
}

function paintPage(
  canvas: PixelCanvas,
  page: Rect,
  params: RetroBrowserParams,
  t: number,
  k: number,
  roles: RoleColors | undefined,
): AnchorMap {
  const marks = new MarkTracker(params.marks, t, { mode: 'marker', color: C.amber });
  fillRect(canvas, page, C.cream);
  const [dark, light] = ACCENT_RAMP[params.accent];
  const banner = rect(page.x, page.y, page.w, 17);
  fillRect(canvas, banner, dark);
  fillRect(canvas, { x: banner.x, y: banner.y + banner.h - 3, w: banner.w, h: 3 }, light);
  drawText(
    canvas,
    clipText(params.site, banner.w - 10, { bold: true }),
    banner.x + 5,
    banner.y + 4,
    C.cream,
    { bold: true },
  );
  const anchors: AnchorMap = { banner: centerOf(banner) };
  let y = banner.y + banner.h + 5;
  const headline = wrap(params.headline, page.w - 10, 2, HEADLINE);
  const fitsTwo = headline.every((line) => textWidth(line, HEADLINE) <= page.w - 10);
  const style = fitsTwo ? HEADLINE : { bold: true };
  const lines = fitsTwo ? headline : wrap(params.headline, page.w - 10, 3, { bold: true });
  for (const line of lines) {
    marks.text(canvas, line, page.x + 5, y, C.navy, style);
    anchors['headline'] ??= [page.x + 5 + textWidth(line, style) / 2, y + (fitsTwo ? 7 : 3.5)];
    y += fitsTwo ? 17 : 10;
  }
  if (params.byline.length > 0) {
    drawText(canvas, params.byline, page.x + 5, y, C.midGrey, { font: 'small' });
    y += 9;
  }
  fillRect(canvas, { x: page.x + 5, y, w: page.w - 10, h: 1 }, C.tan);
  y += 5;
  const bottom = page.y + page.h - 4;
  let textLeft = page.x + 5;
  if (params.photo !== 'none') {
    const w = Math.round(page.w * 0.42);
    const h = Math.min(Math.round(w * 0.72), bottom - y - 10);
    if (h > 12) {
      const photo = rect(page.x + 5, y, w, h);
      strokeRect(canvas, inset(photo, -1), C.black);
      const block = k >= 1 ? 1 : k > 0.8 ? 2 : k > 0.6 ? 4 : 8;
      if (params.asset && roles) drawAssetColor(canvas, photo, params.asset, roles, block);
      else drawPhoto(canvas, photo, params.photo, params.seed, PHOTO_RAMP, block);
      anchors['photo'] = centerOf(photo);
      if (params.caption.length > 0)
        drawText(
          canvas,
          clipText(params.caption, w, { font: 'small' }),
          photo.x,
          photo.y + h + 3,
          C.midGrey,
          { font: 'small' },
        );
      textLeft = photo.x + w + 6;
    }
  }
  const column = rect(
    textLeft,
    y,
    page.x + page.w - 5 - textLeft,
    bottom - y - (params.visitors === undefined ? 0 : 12),
  );
  if (params.body === undefined) drawGreek(canvas, column, C.darkGrey, params.seed);
  else {
    let lineY = column.y;
    for (const line of wrap(params.body, column.w, Math.floor(column.h / 6), { font: 'small' })) {
      marks.text(canvas, line, column.x, lineY, C.darkGrey, { font: 'small' });
      lineY += 6;
    }
  }
  anchors['body'] = centerOf(column);
  if (params.visitors !== undefined) {
    const digits = String(params.visitors).padStart(6, '0');
    const label = 'VISITORS:';
    const left = column.x;
    drawText(canvas, label, left, bottom - 8, C.darkGrey, { font: 'small' });
    const counter = rect(
      left + textWidth(label, { font: 'small' }) + 3,
      bottom - 10,
      digits.length * 6 + 1,
      9,
    );
    fillRect(canvas, counter, C.black);
    drawText(canvas, digits, counter.x + 1, counter.y + 2, C.green, { font: 'small', scale: 1 });
    anchors['counter'] = centerOf(counter);
  }
  if (k < 1)
    fillRect(canvas, rect(page.x, page.y + Math.floor(page.h * k), page.w, page.h), C.cream);
  return { ...anchors, ...marks.anchors(centerOf(page)) };
}

/** `roles` (the style's role colours) are needed for an `asset` photo. */
export function browserPainter(params: RetroBrowserParams, roles?: RoleColors): RetroPainter {
  return {
    width: params.size[0] + 4,
    height: params.size[1] + 4,
    paint(canvas, t) {
      const frame = rect(0, 0, canvas.width - 4, canvas.height - 4);
      dropShadow(canvas, frame, 4);
      const layout = drawChrome(canvas, frame, {
        title: `${params.title} - NETSURF`,
        active: true,
        accent: params.accent,
        content: C.grey,
      });
      const area = layout.content;
      const toolbar = paintToolbar(canvas, rect(area.x, area.y + 1, area.w, 27), params, t);
      const status = rect(area.x, area.y + area.h - 10, area.w, 10);
      const page = rect(area.x + 1, area.y + 29, area.w - 2, status.y - area.y - 30);
      strokeRect(canvas, inset(page, -1), C.black);
      const k = loadProgress(params, t);
      const loading = params.loadAt !== undefined && t >= params.loadAt && k < 1;
      const waiting = params.loadAt !== undefined && t < params.loadAt;
      const anchors = { page: centerOf(page), ...paintPage(canvas, page, params, t, k, roles) };
      if (waiting) fillRect(canvas, page, C.cream);
      fillRect(canvas, status, C.grey);
      bevel(canvas, status, false);
      const message = waiting
        ? 'READY'
        : loading
          ? `LOADING... ${String(Math.round(k * 100))}%`
          : 'DONE';
      drawText(canvas, message, status.x + 3, status.y + 3, C.black, { font: 'small' });
      if (loading) {
        const bar = rect(status.x + status.w - 52, status.y + 2, 50, 6);
        strokeRect(canvas, bar, C.midGrey);
        fillRect(
          canvas,
          rect(bar.x + 1, bar.y + 1, Math.round((bar.w - 2) * k), bar.h - 2),
          ACCENT_BRIGHT[params.accent],
        );
      }
      return {
        ...anchors,
        ...toolbar,
        title: layout.title,
        close: layout.close,
        status: centerOf(status),
      };
    },
  };
}

export const retroBrowser = defineProp({
  name: 'retroBrowser',
  description:
    'Retro web browser window (look retro-ui): tabs, address bar (typed by t), news page with banner, headline, dithered photo, body copy, hit counter; progressive loading with an interlaced photo. Proof that something was published online.',
  params: retroBrowserParams,
  anchors: {
    url: 'address bar text',
    tab: 'active tab',
    headline: 'page headline',
    photo: 'dithered photo (or the asset)',
    body: 'body copy',
    counter: 'hit counter (visitors)',
    title: 'window title',
    'mark:<text>': 'a phrase listed in marks (headline or body)',
  },
  methods: {
    'update(t)': 'types the URL, loads the page for local time t; call every frame',
    'fitDistance(px = 2, fov = 50)': 'camera distance for one UI pixel = px frame pixels',
  },
  build(params, tools) {
    return createSurface(tools, {
      kitType: 'retroBrowser',
      painter: browserPainter(params, resolveRoles(tools.palette)),
      pixel: params.pixel,
    });
  },
});

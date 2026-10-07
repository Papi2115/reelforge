/**
 * `page.flashback(spec)` (Comic breakthrough 1, showcase shot 3): the past as an older print job.
 * Every beat of the narration is a panel revealed on its own time; the past is re-inked in the
 * duotone sepia set (the `SEPIA` remap: brown key, one tan tint, yellowed stock; palette-pure),
 * its halftones screened coarser at another angle, one tint plate 1 px off on every panel. With
 * `cover: 'page'` the whole page is the old print (aged edge, denser foxing); with
 * `cover: 'strip'` a torn strip of it is pasted over the present page, which stays in colour
 * around it. The time-stamp caption (`when`) is lettered in; an optional rubber date stamp is the
 * only red of the past.
 */
import type { z } from 'zod';
import { KitError } from '../../../errors.js';
import { INK, SEPIA } from '../inks.js';
import { noise2, rnd, rndRange, seg, track } from '../draw/math.js';
import { dither } from '../draw/paint.js';
import type { Screen } from '../draw/paint.js';
import { rotPts } from '../draw/shapes.js';
import { createHandle, parse, type ApiContext, type PanelHandle } from '../page/api.js';
import type { createLetteringApi } from '../page/api-lettering.js';
import type { Quad } from '../page/layouts.js';
import type { ItemContext } from '../page/model.js';
import { PanelModel } from '../page/panel.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { beatQuads, defaultBox, tornSheet } from './flashback-layout.js';
import { flashbackSchema, type Box, type FlashbackSpec } from './flashback-schema.js';

/** The older print job's screen: cells x1.5, rotated ~30 degrees. */
export const SEPIA_SCREEN: Readonly<Screen> = Object.freeze({ cellMul: 1.5, angleAdd: 0.52 });
/** Beat panels sit above the page's own panels. */
const Z = 900;
/** A strip slides off in this long after `until`. */
const LEAVE = 0.35;

type Lettering = ReturnType<typeof createLetteringApi>;

export interface FlashbackResult {
  readonly panels: readonly PanelHandle[];
  readonly at: number;
  /** The last beat has landed. */
  readonly end: number;
  readonly until: number;
  readonly box: Box;
}

interface Timing {
  readonly at: number;
  readonly until: number;
  readonly beats: readonly number[];
}

function timing(ctx: ApiContext, o: FlashbackSpec, where: string): Timing {
  const at = ctx.resolve(o.at, 0);
  const until = ctx.resolve(o.until, Number.POSITIVE_INFINITY);
  const beats = o.beats.map((beat) => ctx.resolve(beat.at, at));
  beats.forEach((t, i) => {
    const previous = i === 0 ? at : (beats[i - 1] ?? at);
    if (t < previous || (i > 0 && t - previous < 0.15)) {
      throw new KitError(
        'invalid-params',
        `${where}: beat ${String(i + 1)} lands at ${t.toFixed(2)} s; beats are revealed panel by panel in narration order, each >= 0.15 s after the one before and not before the flashback (at ${at.toFixed(2)} s)`,
      );
    }
  });
  const last = beats[beats.length - 1] ?? at;
  if (until < last + 0.4) {
    throw new KitError(
      'invalid-params',
      `${where}: until (${until.toFixed(2)} s) must leave the last beat (${last.toFixed(2)} s) on the page >= 0.4 s`,
    );
  }
  return { at, until, beats };
}

function checkBox(box: Box, where: string): void {
  const [x0, y0, x1, y1] = box;
  const inside = x0 >= -20 && y0 >= -20 && x1 <= PAGE_WIDTH + 20 && y1 <= PAGE_HEIGHT + 20;
  if (!inside || x1 - x0 < 120 || y1 - y0 < 60) {
    throw new KitError(
      'invalid-params',
      `${where}: box [x0, y0, x1, y1] must lie on the 640x360 page and be >= 120 x 60 px`,
    );
  }
}

/** Placement of the past over time: a strip's tilt and its arrival / departure. */
function motion(o: FlashbackSpec, box: Box, time: Timing, key: string) {
  const strip = o.cover === 'strip';
  const deg = strip ? (o.tilt ?? rndRange(key, 7, -1.8, 1.8)) : 0;
  const angle = (deg * Math.PI) / 180;
  const [cx, cy] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  const offset = (t: number): [number, number] => {
    if (!strip) return [0, 0];
    const leave = Number.isFinite(time.until)
      ? (PAGE_WIDTH - box[0] + 30) * seg(t, time.until, time.until + LEAVE, 'inQuad')
      : 0;
    if (o.enter === 'drop') {
      const fall = track(
        [
          [time.at, -(box[3] + 30)],
          [time.at + 0.28, 0, 'inQuad'],
          [time.at + 0.36, -4, 'outQuad'],
          [time.at + 0.44, 0, 'inQuad'],
        ],
        t,
      );
      return [leave, fall];
    }
    const arrive = o.enter === 'slide' ? 1 - seg(t, time.at, time.at + 0.42, 'outBackSoft') : 0;
    return [-(box[2] + 30) * arrive + leave, 0];
  };
  const place = (pts: readonly number[], t: number): number[] => {
    const [dx, dy] = offset(t);
    const turned = angle === 0 ? [...pts] : rotPts(pts, cx, cy, angle);
    return turned.map((value, i) => Math.round(value + (i % 2 === 0 ? dx : dy)));
  };
  return { place, offset, strip };
}

/** Pixels inside `pts` (screen px) re-inked through `table` (also a sepia panel break). */
export function remapInside(item: ItemContext, pts: readonly number[], table: Uint8Array): void {
  const { canvas } = item;
  const mask = canvas.maskPoly(pts);
  try {
    const { data } = canvas;
    for (let i = 0; i < data.length; i += 1) {
      if (mask[i] === 1) data[i] = table[data[i] ?? 0] ?? 0;
    }
  } finally {
    canvas.release(mask);
  }
}

/** The pasted strip: a soft shadow on the present page, yellowed stock, fibres, foxing. */
function stripPaper(item: ItemContext, pts: readonly number[], box: Box, key: string): void {
  const { canvas, page } = item;
  const sheet = page.map(pts);
  canvas.poly(
    sheet.map((value, i) => value + (i % 2 === 0 ? 3 : 4)),
    dither(-1, INK.AGED, 0.55),
  );
  canvas.poly(sheet, INK.SEP_PAPER);
  const [x0, y0, x1, y1] = box;
  const mask = canvas.maskPoly(sheet);
  try {
    canvas.withClip(mask, () => {
      const [ox, oy] = [sheet[0] ?? 0, sheet[1] ?? 0];
      for (let i = 0; i < 140; i += 1) {
        const x = ox + rndRange(key, i, 0, x1 - x0 + 20);
        const y = oy + rndRange(key, i + 400, 0, y1 - y0 + 20);
        if (rnd(key, i + 800) < 0.2) canvas.ellipse(x, y, 1.6, 1.2, INK.SEP_TAN);
        else canvas.line(x, y, x + 2, y, INK.SEP_FIBRE);
      }
    });
  } finally {
    canvas.release(mask);
  }
  canvas.polyline(sheet, INK.SEP_FIBRE, 1, true);
}

/** The old stock of a page flashback: denser foxing fixed to the page, a browner edge. */
function agedPage(ctx: ApiContext, time: Timing, key: string): void {
  const { model } = ctx;
  const span = { at: time.at, until: time.until };
  model.items.push({
    ...span,
    layer: 'under',
    draw: ({ canvas, page }) => {
      for (let i = 0; i < 90; i += 1) {
        const x = page.x(rndRange(key, i, 0, PAGE_WIDTH));
        const y = page.y(rndRange(key, i + 500, 0, PAGE_HEIGHT));
        const r = rnd(key, i + 900) < 0.15 ? 2 : 1;
        canvas.ellipse(x, y, r, r * 0.8, INK.AGED);
      }
    },
  });
  model.items.push({
    ...span,
    layer: 'over',
    draw: ({ canvas }) => {
      const [W, H] = [canvas.width, canvas.height];
      canvas.rect(0, 0, W, H, (x, y) => {
        const d = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (d >= 8) return -1;
        const n = noise2(`${key}edge`, x, y, 9) * 6;
        return d + n < 8 && ((x * 7 + y * 13) & 15) < 9 - d ? INK.SHADE : -1;
      });
    },
  });
}

export function createFlashback(ctx: ApiContext, lettering: Lettering) {
  const { model, call } = ctx;
  return function flashback(spec: z.input<typeof flashbackSchema>): FlashbackResult {
    const where = `${call}.flashback`;
    const o = parse(flashbackSchema, spec, where);
    if (o.intent.toUpperCase() === o.when.toUpperCase()) {
      throw new KitError('invalid-params', `${where}: intent is the claim, not the caption`);
    }
    const time = timing(ctx, o, where);
    const key = `flashback${String(ctx.seed)}:${o.when}`;
    const box = o.box ?? defaultBox(o.arrange, o.cover);
    checkBox(box, where);
    const quads = beatQuads(
      o.arrange,
      box,
      o.beats.map((beat) => beat.weight),
      key,
    );
    const { place, offset, strip } = motion(o, box, time, key);
    const gone = Number.isFinite(time.until) ? time.until + (strip ? LEAVE : 0) : time.until;
    if (strip) {
      const sheet = tornSheet(box, 10, key);
      model.items.push({
        at: time.at,
        until: gone,
        layer: 'z',
        z: Z - 1,
        draw: (item) => {
          stripPaper(item, place(sheet, item.t), box, key);
        },
      });
      model.posts.push({
        at: time.at,
        until: gone,
        apply: (item) => {
          remapInside(item, item.page.map(place(sheet, item.t)), SEPIA);
        },
      });
    } else {
      agedPage(ctx, time, key);
      model.screens.push({ at: time.at, until: gone, screen: SEPIA_SCREEN });
      model.posts.push({
        at: time.at,
        until: gone,
        apply: (item) => {
          item.canvas.remap(SEPIA);
        },
      });
    }
    const panels = o.beats.map((beat, i) => {
      const quad = quads[i] as Quad;
      const shape = strip ? (t: number) => place(quad, t) as Quad : (place(quad, 0) as Quad);
      const style = {
        key: `${key}b${String(i)}`,
        border: 3,
        boil: 0.4,
        pencils: false,
        mis: [1, 0] as const,
        screen: SEPIA_SCREEN,
      };
      const panel = new PanelModel(shape, style, Z + i);
      model.panels.push(panel);
      const handle = createHandle(ctx, panel, `${where} beat ${String(i + 1)}`);
      const xs = quad.filter((_, j) => j % 2 === 0);
      const ys = quad.filter((_, j) => j % 2 === 1);
      const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
      const size = [Math.max(...xs) - x0, Math.max(...ys) - y0] as const;
      handle.draw((g, t) => {
        const [dx, dy] = offset(t);
        beat.draw(g.at(x0 + dx, y0 + dy), t, size);
      });
      // A page that opens on the past shows the layout of the beats to come in pencil.
      const rough = !strip && time.at <= 0.05;
      handle.enter({ at: time.beats[i] ?? time.at, kind: beat.enter, from: 'left', rough });
      if (Number.isFinite(gone)) handle.exit(gone);
      return handle;
    });
    const settle = strip && o.enter !== 'cut' ? time.at + 0.45 : time.at;
    const captionAt = (t: number) => Math.max(t, settle);
    // Captions and the stamp sit where the strip comes to rest.
    const rest = Math.min(time.at + 0.5, time.until - 0.01);
    const corner = (i: number): [number, number] => {
      const quad = place(quads[i] as Quad, rest);
      const [x, y] = [Math.min(quad[0] ?? 0, quad[6] ?? 0), Math.min(quad[1] ?? 0, quad[3] ?? 0)];
      return strip ? [x + 6, y + 5] : [x + 12, y - 12];
    };
    const until = Number.isFinite(time.until) ? time.until : undefined;
    const [wx, wy] = corner(0);
    const tilt = rnd(key, 3) < 0.5 ? -1 : 1;
    lettering.caption(o.when, {
      x: wx,
      y: wy,
      at: captionAt(time.beats[0] ?? time.at),
      until,
      tilt,
      type: o.type,
      width: 300,
    });
    o.beats.forEach((beat, i) => {
      if (beat.caption === undefined || i === 0) return;
      const [x, y] = corner(i);
      const at = captionAt(time.beats[i] ?? time.at);
      // Rounded to centiseconds, so `type: 0.6` letters the beats in exactly 0.45 s.
      const type = Math.round(o.type * 75) / 100;
      lettering.caption(beat.caption, { x, y, at, until, tilt: -tilt, type, width: 260 });
    });
    if (o.stamp !== undefined) {
      const first = place(quads[0] as Quad, rest);
      const x = o.stamp.x ?? Math.max(...first.filter((_, i) => i % 2 === 0)) - 70;
      const y = o.stamp.y ?? Math.min(...first.filter((_, i) => i % 2 === 1)) + 6;
      const at = captionAt(ctx.resolve(o.stamp.at, time.at));
      const look = { color: 'sepiaRed', inner: true, w: 124, h: 54, size: 4.6, wear: 0.14 };
      lettering.stamp(o.stamp.text, { x, y, at, until, angle: o.stamp.angle ?? -0.13, ...look });
    }
    const end = (time.beats[time.beats.length - 1] ?? time.at) + 0.4;
    return { panels, at: time.at, end, until: time.until, box };
  };
}

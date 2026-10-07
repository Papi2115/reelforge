/**
 * Lettering and traces of `kit.fx.comicPage`, drawn over the panels in page coordinates (they
 * travel with the page camera; `on: panel` also rides the panel's slam/slide): speech/radio
 * balloons with tails, thought clouds with dots, caption boxes, onomatopoeia slammed in letter by
 * letter on uneven beats, pencilled margin notes, two-stroke arrows, loops, ticks, strikes,
 * highlighter, thumbprints, smudges, coffee rings.
 */
import type { z } from 'zod';
import { KitError } from '../../../errors.js';
import { INK } from '../inks.js';
import { drawBalloon, drawCaption, LINE_H, thoughtDots } from '../draw/balloons.js';
import { bigLetter } from '../draw/letters.js';
import {
  coffeeRing,
  handArrow,
  highlighter,
  pencilCircle,
  smudge,
  strike,
  thumbprint,
  tick,
} from '../draw/marks.js';
import { clamp01, pop, rndRange, seg, track } from '../draw/math.js';
import { halftone, layer } from '../draw/paint.js';
import { rubberStamp } from '../draw/stamp.js';
import { drawText, letterable, measure } from '../draw/text.js';
import { parse, panelModelOf, type ApiContext } from './api.js';
import type { ItemContext } from './model.js';
import { inkIndex } from './pen.js';
import {
  balloonSchema,
  captionSchema,
  noteSchema,
  sfxSchema,
  stampSchema,
  strokeSchema,
  traceSchema,
} from './schemas.js';

type Point = readonly [number, number];
type PointArg = Point | ((t: number) => readonly number[]);

/** Lines of a text: explicit '\n' breaks, else greedy wrapping at `width` px. */
export function wrapLines(text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n').map((part) => letterable(part))) {
    let line = '';
    for (const word of paragraph.split(' ').filter((w) => w.length > 0)) {
      const next = line === '' ? word : `${line} ${word}`;
      if (line !== '' && measure('hand', next, 1, true) > width) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

function resolvePoint(point: PointArg, t: number): Point {
  const value = typeof point === 'function' ? point(t) : point;
  return [value[0] ?? 0, value[1] ?? 0];
}

export function createLetteringApi(ctx: ApiContext) {
  const { model, resolve, call } = ctx;
  /** Seed key of an item: by what and where it is, so adding an item never reshuffles others. */
  const nextKey = (kind: string, x: number, y: number, text = '') =>
    `${kind}${String(ctx.seed)}:${text}@${String(Math.round(x))},${String(Math.round(y))}`;
  /** Screen position and zoom of a page point (riding a panel frame when `on` is a panel). */
  const anchor = (item: ItemContext, x: number, y: number, on: unknown) => {
    const panel = panelModelOf(on);
    const [px, py] = panel ? panel.carry(x, y, item.t) : [x, y];
    const k = panel ? panel.frame(item.t).k : 1;
    return { sx: item.page.x(px), sy: item.page.y(py), zoom: item.page.s * k };
  };
  const span = (at: number | string, until: number | string | undefined) => ({
    at: resolve(at, 0),
    until: resolve(until, Number.POSITIVE_INFINITY),
  });

  return {
    balloon(text: string, options: z.input<typeof balloonSchema>) {
      const o = parse(balloonSchema, options, `${call}.balloon`);
      const { at, until } = span(o.at, o.until);
      const lines = wrapLines(text, o.width);
      const key = nextKey('balloon', o.x, o.y, text);
      model.items.push({
        at,
        until,
        layer: 'over',
        draw: (item) => {
          const { t, page } = item;
          const scale =
            Number.isFinite(until) && t > until - 0.12
              ? 1 - seg(t, until - 0.12, until - 0.02, 'inQuad')
              : pop(t, at, o.pop);
          const placed = anchor(item, o.x, o.y, o.on);
          const zoom = placed.zoom * o.size;
          const toScreen = (p: Point): [number, number] => [page.x(p[0]), page.y(p[1])];
          const tail = o.tail === undefined ? undefined : toScreen(resolvePoint(o.tail, t));
          const drawn = drawBalloon(item.canvas, {
            lines,
            cx: placed.sx,
            cy: placed.sy,
            tail,
            kind: o.kind,
            scale,
            zoom,
            key,
          });
          if (drawn !== null && o.dots !== undefined && t >= at + o.pop * 0.7) {
            thoughtDots(item.canvas, drawn, toScreen(resolvePoint(o.dots, t)), zoom, key);
          }
        },
      });
      return { at, end: at + o.pop };
    },

    caption(text: string, options: z.input<typeof captionSchema>) {
      const o = parse(captionSchema, options, `${call}.caption`);
      const { at, until } = span(o.at, o.until);
      const lines = wrapLines(text, o.width);
      const key = nextKey('caption', o.x, o.y, text);
      const fill = inkIndex(o.fill, `${call}.caption fill`);
      model.items.push({
        at,
        until,
        layer: 'over',
        draw: (item) => {
          const { sx, sy, zoom } = anchor(item, o.x, o.y, o.on);
          const dy = Math.round(-5 * (1 - seg(item.t, at, at + 0.12, 'outQuad')));
          const longest = Math.max(...lines.map((line) => line.length));
          const reveal =
            o.type > 0
              ? Math.floor(seg(item.t, at, at + o.type, 'outQuad') * (longest + 0.99))
              : undefined;
          const caption = { lines, x: sx, y: sy + dy, zoom, tilt: o.tilt, fill, key, reveal };
          drawCaption(item.canvas, caption);
        },
      });
      return { at, end: at + Math.max(0.12, o.type), height: lines.length * LINE_H + 7 };
    },

    stamp(text: string, options: z.input<typeof stampSchema>) {
      const o = parse(stampSchema, options, `${call}.stamp`);
      const { at, until } = span(o.at, o.until);
      const chars = letterable(text, 'display').trim();
      if (chars.length === 0 || chars.length > 8) {
        throw new KitError('invalid-params', `${call}.stamp: 1-8 letters or digits, got "${text}"`);
      }
      const key = nextKey('stamp', o.x, o.y, text);
      const ink = inkIndex(o.color, `${call}.stamp color`);
      const pitch = o.size * 5.9;
      const w = o.w ?? pitch * chars.length + 16;
      if (o.shake > 0) model.shakes.push({ at: at + 0.08, amp: o.shake, decay: 0.09 });
      model.items.push({
        at,
        until,
        layer: 'over',
        draw: (item) => {
          const k = track(
            [
              [at, 1.55],
              [at + 0.08, 0.96, 'inQuad'],
              [at + 0.16, 1, 'outQuad'],
            ],
            item.t,
          );
          const { page } = item;
          const stamp = { text: chars, k: k * page.s, angle: o.angle, ink, key, w, h: o.h };
          const shape = { size: o.size, pitch, wear: o.wear, inner: o.inner };
          rubberStamp(item.canvas, { ...stamp, ...shape, cx: page.x(o.x), cy: page.y(o.y) });
        },
      });
      return { at, end: at + 0.16 };
    },

    sfx(word: string, options: z.input<typeof sfxSchema>) {
      const o = parse(sfxSchema, options, `${call}.sfx`);
      const { at, until } = span(o.at, o.until);
      const chars = Array.from(letterable(word, 'display'));
      const key = nextKey('sfx', o.x, o.y, word);
      const pitch = o.pitch ?? o.size * 8.2;
      const beats = chars.map((_, i) =>
        i === 0 ? 0 : (o.beats?.[i] ?? i * 0.055 + rndRange(key, i, -0.015, 0.03)),
      );
      const angles = chars.map((_, i) => o.angles?.[i] ?? rndRange(key, 20 + i, -0.13, 0.12));
      const rise = chars.map(
        (_, i) =>
          o.rise?.[i] ?? (i % 2 === 0 ? 1 : -1) * rndRange(key, 40 + i, 2, 6) * (o.size / 6),
      );
      const fill = inkIndex(o.fill, `${call}.sfx fill`);
      const shade = inkIndex(o.shade, `${call}.sfx shade`);
      const width = pitch * (chars.length - 1);
      model.items.push({
        at,
        until,
        layer: 'over',
        draw: (item) => {
          chars.forEach((char, i) => {
            const ti = at + (beats[i] ?? 0);
            if (char === ' ' || item.t < ti) return;
            const slam = track(
              [
                [ti, 1.6],
                [ti + 0.08, 0.92, 'outQuad'],
                [ti + 0.16, 1, 'inOutSine'],
              ],
              item.t,
            );
            const { sx, sy, zoom } = anchor(
              item,
              o.x - width / 2 + i * pitch,
              o.y + (rise[i] ?? 0),
              o.on,
            );
            const size = o.size * slam * zoom;
            const tone = (_x: number, y: number) =>
              o.shadeTone * clamp01((y - sy) / (o.size * zoom * 4));
            const paint = layer(halftone(shade, tone, { cell: 3, angle: 1.3, ox: 1 }), fill);
            bigLetter(item.canvas, char, sx, sy, size, angles[i] ?? 0, paint, {
              key: `${key}${String(i)}`,
              outline: o.outline,
              extrude: o.extrude,
              mis: o.mis,
            });
          });
        },
      });
      return { at, end: at + (beats[beats.length - 1] ?? 0) + 0.16 };
    },

    note(text: string, options: z.input<typeof noteSchema>) {
      const o = parse(noteSchema, options, `${call}.note`);
      const { at, until } = span(o.at, o.until);
      const line = letterable(text);
      const color = inkIndex(o.color, `${call}.note color`);
      const key = nextKey('note', o.x, o.y, text);
      model.items.push({
        at,
        until,
        layer: 'over',
        draw: (item) => {
          const shown = Math.floor(seg(item.t, at, at + o.dur, 'outQuad') * (line.length + 0.99));
          const reveal = o.dur <= 0 ? line.length : shown;
          drawTextOn(item, line, item.page.x(o.x), item.page.y(o.y), color, o.slant, reveal, key);
        },
      });
      return { at, end: at + o.dur, width: measure('hand', line) };
    },

    arrow(from: Point, to: Point, options: z.input<typeof strokeSchema>) {
      return stroke(options, 'arrow', from, (item, p, paint, key, w) => {
        const a: Point = [item.page.x(from[0]), item.page.y(from[1])];
        const b: Point = [item.page.x(to[0]), item.page.y(to[1])];
        handArrow(item.canvas, a, b, p, paint, key, w);
      });
    },

    loop(x: number, y: number, rx: number, ry: number, options: z.input<typeof strokeSchema>) {
      return stroke(options, 'loop', [x, y], (item, p, paint, key, w) => {
        const s = item.page.s;
        pencilCircle(item.canvas, item.page.x(x), item.page.y(y), rx * s, ry * s, p, paint, key, w);
      });
    },

    tick(x: number, y: number, options: z.input<typeof strokeSchema>) {
      return stroke(options, 'tick', [x, y], (item, p, paint, key) => {
        tick(item.canvas, item.page.x(x), item.page.y(y), p, paint, key);
      });
    },

    strike(x0: number, y: number, x1: number, options: z.input<typeof strokeSchema>) {
      return stroke(options, 'strike', [x0, y], (item, p, paint, key) => {
        strike(item.canvas, item.page.x(x0), item.page.y(y), item.page.x(x1), p, paint, key);
      });
    },

    highlight(
      box: readonly [number, number, number, number],
      options: z.input<typeof strokeSchema>,
    ) {
      return stroke(options, 'highlight', [box[0], box[1]], (item, p, paint, key) => {
        const { page } = item;
        const screen = [page.x(box[0]), page.y(box[1]), page.x(box[2]), page.y(box[3])] as const;
        highlighter(item.canvas, screen, p, paint, key);
      });
    },

    thumbprint(x: number, y: number, options?: z.input<typeof traceSchema>) {
      trace(options, (item) => {
        thumbprint(item.canvas, item.page.x(x), item.page.y(y), nextKey('thumb', x, y), INK.SHADE);
      });
    },

    smudge(x: number, y: number, options: { length?: number; angle?: number; at?: number } = {}) {
      const key = nextKey('smudge', x, y);
      trace({ over: true, at: options.at }, (item) => {
        const length = (options.length ?? 9) * item.page.s;
        smudge(item.canvas, item.page.x(x), item.page.y(y), length, options.angle ?? 1.9, key);
      });
    },

    coffeeRing(x: number, y: number, r = 28, options?: z.input<typeof traceSchema>) {
      const key = nextKey('coffee', x, y);
      trace({ over: true, ...options }, (item) => {
        const s = item.page.s;
        coffeeRing(item.canvas, item.page.x(x), item.page.y(y), r * s, INK.AGED, key);
      });
    },
  };

  function trace(
    options: z.input<typeof traceSchema> | undefined,
    draw: (item: ItemContext) => void,
  ) {
    const o = parse(traceSchema, options ?? {}, `${call} trace`);
    model.items.push({
      at: resolve(o.at, Number.NEGATIVE_INFINITY),
      until: Number.POSITIVE_INFINITY,
      layer: o.over ? 'over' : 'under',
      draw,
    });
  }

  function stroke(
    options: z.input<typeof strokeSchema>,
    kind: string,
    where: readonly [number, number],
    draw: (item: ItemContext, p: number, paint: number, key: string, w: number) => void,
  ) {
    const o = parse(strokeSchema, options, `${call}.${kind}`);
    const { at, until } = span(o.at, o.until);
    const paint = inkIndex(o.color, `${call}.${kind} color`);
    const key = nextKey(kind, where[0], where[1]);
    model.items.push({
      at,
      until,
      layer: 'over',
      draw: (item) => {
        draw(item, o.dur <= 0 ? 1 : seg(item.t, at, at + o.dur, 'inOutSine'), paint, key, o.w);
      },
    });
    return { at, end: at + o.dur };
  }
}

/** Margin lettering in pencil (slanted, jittery), revealed letter by letter. */
function drawTextOn(
  item: ItemContext,
  line: string,
  x: number,
  y: number,
  color: number,
  slant: number,
  reveal: number,
  key: string,
): void {
  drawText(item.canvas, 'hand', line, x, y, color, { key, reveal, slant, jitter: 1.2 });
}

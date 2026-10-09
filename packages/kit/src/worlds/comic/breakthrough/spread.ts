/**
 * `page.spread(spec)` (Comic breakthrough 2, showcase shot 9): the frame becomes a double-page
 * spread, one picture across both pages and the fold. Assemblies: `merge` (panels that turn out to
 * be one picture: gutters close on their own beats, panels slide into register, borders thin, the
 * margin slides off, the picture grows 0.955 -> 1.03 so it bleeds off every edge), `unfold` (the
 * book opens from the spine, the lifted page edges flatten out) and `pull-back` (one small panel
 * on a detail whose camera pulls back while it grows to the whole spread). Then a spine crease, up
 * to three inset panels, and the hold rule: never more than 4 s without a new beat.
 */
import type { z } from 'zod';
import { KitError } from '../../../errors.js';
import { INK } from '../inks.js';
import { clamp01, lerp, rndRange, seg } from '../draw/math.js';
import { dither } from '../draw/paint.js';
import { Place } from '../draw/place.js';
import { boil } from '../draw/shapes.js';
import { createHandle, parse, type ApiContext, type PanelHandle } from '../page/api.js';
import type { Quad } from '../page/layouts.js';
import { paper, type ItemContext, type PageItem } from '../page/model.js';
import { misFor, PanelModel } from '../page/panel.js';
import { ComicPen } from '../page/pen.js';
import { isPortraitPage, type PageSize } from '../style.js';
import { drawMergeFurniture, mergeGeometry } from './spread-merge.js';
import { SPREAD_LIMITS, spreadSchema, type SpreadSpec } from './spread-schema.js';

/** Inset panels sit above everything else on the page. */
const INSET_Z = 950;
/** The bleed rectangle of a finished spread (page px). */
function bleedQuad({ width, height }: PageSize): Quad {
  return [-4, -4, width + 4, -4, width + 4, height + 4, -4, height + 4];
}

/** Spine range on a landscape page and on a portrait one (PLAN.md#13.18). */
const FOLD_RANGE = { landscape: [260, 380], portrait: [140, 220] } as const;

export interface SpreadResult {
  readonly at: number;
  /** The spread is whole (assembly done). */
  readonly assembled: number;
  readonly until: number;
  readonly insets: readonly PanelHandle[];
}

interface SpreadDraw {
  readonly o: SpreadSpec;
  /** The assembly starts (after the delay). */
  readonly at: number;
  readonly assembled: number;
  readonly key: string;
  readonly paperKey: string;
  readonly scratch: Uint8Array;
  readonly geometry: ReturnType<typeof mergeGeometry>;
  readonly page: PageSize;
  /** x of the spine (the book opens from it). */
  readonly fold: number;
  /** The spine crease shows (always in landscape; in portrait only when `fold` is given). */
  readonly crease: boolean;
}

function art(item: ItemContext, d: SpreadDraw, place: Place, mis: readonly [number, number]): void {
  d.o.art(new ComicPen(item, place, mis, item.t), item.t);
}

/** The spine: the faintest crease down the fold. */
function crease(item: ItemContext, d: SpreadDraw): void {
  if (!d.crease) return;
  const x = Math.round(item.page.x(d.fold));
  item.canvas.rect(x, 0, 1, item.canvas.height, dither(-1, INK.GREY_D, 3 / 16));
}

function drawMerge(item: ItemContext, d: SpreadDraw): void {
  const { canvas, page, t } = item;
  const m = seg(t, d.at, d.assembled, 'inOutSine');
  const mis: [number, number] = [Math.round(lerp(2, 1, m)), Math.round(lerp(1, -1, m))];
  const [cx, cy] = [d.page.width / 2, d.page.height / 2];
  art(item, d, page.scaleAbout(cx, cy, lerp(0.955, 1.03, m)), mis);
  crease(item, d);
  if (m >= 1) return;
  drawMergeFurniture(d.geometry, {
    canvas,
    page,
    q: clamp01((t - d.at) / (d.assembled - d.at)),
    m,
    scratch: d.scratch,
    key: d.key,
    boilFrame: item.boilFrame,
    paper: () => {
      paper(canvas, page, d.paperKey);
    },
  });
}

function drawUnfold(item: ItemContext, d: SpreadDraw): void {
  const { canvas, page, t } = item;
  const k = seg(t, d.at, d.assembled, 'inOutCubic');
  const { fold } = d;
  const { width: W, height: H } = d.page;
  const left = fold - (fold + 6) * k;
  const right = fold + (W + 6 - fold) * k;
  const open = page.map([left, -6, right, -6, right, H + 6, left, H + 6]);
  const mask = canvas.maskPoly(open);
  try {
    canvas.withClip(mask, () => {
      art(item, d, page.scaleAbout(fold, H / 2, lerp(1.06, 1, k)), [1, -1]);
    });
  } finally {
    canvas.release(mask);
  }
  // The lifted page edges: the backs of the pages, a strip that flattens as the book opens.
  const lift = 16 * (1 - k);
  if (lift >= 1) {
    for (const [edge, dir] of [
      [left, -1],
      [right, 1],
    ] as const) {
      const outer = edge + dir * lift;
      const strip = page.map([edge, -6, outer, -2, outer, H + 2, edge, H + 6]);
      canvas.poly(strip, dither(INK.PAPER, INK.SHADE, 0.35 + 0.4 * (1 - k)));
      canvas.line(strip[2] ?? 0, strip[3] ?? 0, strip[4] ?? 0, strip[5] ?? 0, INK.INK, 1);
    }
    const shade = Math.round(8 * (1 - k)) + 1;
    canvas.rect(
      Math.round(page.x(fold)) - shade,
      0,
      shade * 2,
      canvas.height,
      dither(-1, INK.GREY_D, 0.3),
    );
  }
  crease(item, d);
}

function drawPullBack(item: ItemContext, d: SpreadDraw): void {
  const { canvas, page, t } = item;
  const k = seg(t, d.at, d.assembled, 'inOutCubic');
  const { width: W, height: H } = d.page;
  const [fx, fy] = d.o.focus ?? (isPortraitPage(d.page) ? [210, 300] : [430, 200]);
  const cx0 = Math.min(W - 120, Math.max(120, fx));
  const cy0 = Math.min(H - 80, Math.max(80, fy));
  const bleed = bleedQuad(d.page);
  const start: Quad = [
    cx0 - 104,
    cy0 - 64,
    cx0 + 98,
    cy0 - 70,
    cx0 + 102,
    cy0 + 66,
    cx0 - 98,
    cy0 + 70,
  ];
  const quad = start.map((value, i) => lerp(value, bleed[i] ?? value, k));
  const zoom = lerp(2.4, 1, k);
  const [cx, cy] = [lerp(cx0, fx, k), lerp(cy0, fy, k)];
  const place = new Place(page.s * zoom, page.x(cx - fx * zoom), page.y(cy - fy * zoom));
  const screen = page.map(quad);
  const mask = canvas.maskPoly(screen);
  try {
    canvas.withClip(mask, () => {
      art(item, d, place, [1, -1]);
      crease(item, d);
    });
  } finally {
    canvas.release(mask);
  }
  const border = k < 0.6 ? 3 : k < 0.9 ? 1 : 0;
  if (border > 0)
    canvas.polyline(boil(screen, `${d.key}pull`, 0.5, item.boilFrame), INK.INK, border, true);
}

const DRAW = { merge: drawMerge, unfold: drawUnfold, 'pull-back': drawPullBack } as const;

function holdCheck(ctx: ApiContext, own: PageItem, times: readonly number[], where: string) {
  return (): void => {
    const [from, to] = [times[0] ?? 0, times[1] ?? 0];
    const events = times.filter((time) => time >= from && time <= to);
    for (const item of ctx.model.items) {
      if (item !== own && Number.isFinite(item.at) && item.at > from && item.at < to)
        events.push(item.at);
    }
    for (const panel of ctx.model.panels) {
      if (panel.from > from && panel.from < to) events.push(panel.from);
    }
    events.sort((a, b) => a - b);
    for (let i = 1; i < events.length; i += 1) {
      const [a, b] = [events[i - 1] ?? 0, events[i] ?? 0];
      if (b - a > SPREAD_LIMITS.hold + 1e-6) {
        throw new KitError(
          'invalid-params',
          `${where}: the finished spread holds still for ${(b - a).toFixed(1)} s (${a.toFixed(2)} -> ${b.toFixed(2)} s) with no new beat; at most ${String(SPREAD_LIMITS.hold)} s: land a narration beat (beats: [...]), a margin note or an inset in between, or end the spread sooner (until)`,
        );
      }
    }
  };
}

export function createSpread(ctx: ApiContext) {
  const { model, call } = ctx;
  return function spread(spec: z.input<typeof spreadSchema>): SpreadResult {
    const where = `${call}.spread`;
    const o = parse(spreadSchema, spec, where);
    const at = ctx.resolve(o.at, 0);
    const until = ctx.resolve(o.until, ctx.duration ?? Number.NaN);
    if (!Number.isFinite(until)) {
      throw new KitError(
        'invalid-params',
        `${where}: give until, or build the page with kit.fx.comicPage({ duration: ctx.shot.duration })`,
      );
    }
    const assembled = at + o.delay + o.dur;
    if (until < assembled + 0.5) {
      throw new KitError(
        'invalid-params',
        `${where}: until must leave the whole spread >= 0.5 s after it assembles (${assembled.toFixed(2)} s)`,
      );
    }
    if (o.assemble === 'merge' && o.pieces === undefined) {
      throw new KitError(
        'invalid-params',
        `${where}: assemble 'merge' needs pieces: 'grid' | 'columns' | 'halves' (the panels it starts as)`,
      );
    }
    const key = `spread${String(ctx.seed)}:${o.assemble}`;
    const { page } = model;
    const portrait = isPortraitPage(page);
    const [low, high] = FOLD_RANGE[portrait ? 'portrait' : 'landscape'];
    if (o.fold !== undefined && (o.fold < low || o.fold > high)) {
      throw new KitError(
        'invalid-params',
        `${where}: fold ${String(o.fold)} is off the spine; on a ${String(page.width)}x${String(page.height)} page the fold is ${String(low)}-${String(high)}`,
      );
    }
    const fold = o.fold ?? (portrait ? page.width / 2 : 320);
    const geometry = mergeGeometry(o.pieces ?? 'columns', fold, key, page);
    const scratch = new Uint8Array(page.width * page.height);
    const start = at + o.delay;
    const d: SpreadDraw = {
      o,
      at: start,
      assembled,
      key,
      paperKey: model.paperKey,
      scratch,
      geometry,
      page,
      fold,
      crease: !portrait || o.fold !== undefined,
    };
    const own: PageItem = {
      at,
      until,
      layer: 'z',
      z: -1,
      draw: (item) => {
        DRAW[o.assemble](item, d);
      },
    };
    model.items.push(own);
    const insetTimes: number[] = [];
    const insets = o.insets.map((inset, i) => {
      const from = ctx.resolve(inset.at, assembled);
      const to = ctx.resolve(inset.until, until);
      if (from < assembled - 0.05) {
        throw new KitError(
          'invalid-params',
          `${where}: inset ${String(i + 1)} lands at ${from.toFixed(2)} s, before the spread is whole (${assembled.toFixed(2)} s)`,
        );
      }
      insetTimes.push(from, to);
      const [x, y, w, h] = inset.box;
      const nudge = (n: number) => Math.round(rndRange(`${key}inset${String(i)}`, n, -1.5, 1.5));
      const quad: Quad = [
        x + nudge(0),
        y + nudge(1),
        x + w + nudge(2),
        y + nudge(3),
        x + w + nudge(4),
        y + h + nudge(5),
        x + nudge(6),
        y + h + nudge(7),
      ];
      const style = {
        key: `${key}inset${String(i)}`,
        border: 2,
        boil: 0.5,
        pencils: true,
        mis: misFor(`${key}inset${String(i)}`),
      };
      const panel = new PanelModel(quad, style, INSET_Z + i, model.page);
      model.panels.push(panel);
      const handle = createHandle(ctx, panel, `${where} inset ${String(i + 1)}`);
      handle.draw(inset.draw).enter({ at: from, kind: inset.kind, from: inset.from }).exit(to);
      return handle;
    });
    const beats = o.beats.map((beat) => ctx.resolve(beat, assembled));
    model.checks.push(holdCheck(ctx, own, [assembled, until, ...beats, ...insetTimes], where));
    return { at, assembled, until, insets };
  };
}

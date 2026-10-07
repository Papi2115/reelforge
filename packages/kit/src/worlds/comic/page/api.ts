/**
 * The scene-facing structure API of `kit.fx.comicPage`: panels from layout presets or custom
 * quads, their entrances/exits, morphs, clocks and cameras, the page camera and its hits, the
 * press intro and free page drawings. Lettering and traces: api-lettering.ts.
 */
import type { z } from 'zod';
import { KitError } from '../../../errors.js';
import type { Resolver } from '../../../looks/blueprint/timing.js';
import { clamp01, lerp, pop, rnd, rndRange, seg, track } from '../draw/math.js';
import { layoutQuads, type LayoutName, type Quad } from './layouts.js';
import type { ComicPageModel } from './model.js';
import { misFor, PanelModel, type Painter } from './panel.js';
import { ComicPen } from './pen.js';
import { torn } from './pen-title.js';
import {
  cameraKeySchema,
  clockSchema,
  drawSchema,
  enterSchema,
  LAYOUT_NAMES,
  layoutOptionsSchema,
  morphSchema,
  panelOptionsSchema,
  quadSchema,
} from './schemas.js';

export interface ApiContext {
  readonly model: ComicPageModel;
  readonly resolve: Resolver;
  readonly call: string;
  readonly seed: number;
  /** The shot length when the scene passed it (a spread holds until it by default). */
  readonly duration?: number | undefined;
}

export function parse<S extends z.ZodType>(schema: S, value: unknown, where: string): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(options)'}: ${issue.message}`)
    .join('; ');
  throw new KitError('invalid-params', `${where}: ${details}`);
}

/** What a scene holds for one panel (chainable). */
export interface PanelHandle {
  draw(painter: Painter): PanelHandle;
  rough(painter: Painter): PanelHandle;
  enter(options: z.input<typeof enterSchema>): PanelHandle;
  exit(at: number | string): PanelHandle;
  morph(quad: readonly number[], options: z.input<typeof morphSchema>): PanelHandle;
  camera(keys: readonly z.input<typeof cameraKeySchema>[]): PanelHandle;
  clock(options: z.input<typeof clockSchema>): PanelHandle;
  quad(t?: number): number[];
  point(u: number, v: number, t?: number): [number, number];
  toPage(x: number, y: number, t?: number): [number, number];
  readonly box: readonly [number, number, number, number];
}

const PANEL_MODELS = new WeakMap<object, PanelModel>();

/** The model behind a panel handle (lettering `on: panel`). */
export function panelModelOf(handle: unknown): PanelModel | undefined {
  return typeof handle === 'object' && handle !== null ? PANEL_MODELS.get(handle) : undefined;
}

function bilinear(quad: readonly number[], u: number, v: number): [number, number] {
  const q = (i: number) => quad[i] ?? 0;
  const topX = lerp(q(0), q(2), u);
  const topY = lerp(q(1), q(3), u);
  const bottomX = lerp(q(6), q(4), u);
  const bottomY = lerp(q(7), q(5), u);
  return [lerp(topX, bottomX, v), lerp(topY, bottomY, v)];
}

function boxOf(quad: readonly number[]): [number, number, number, number] {
  const xs = quad.filter((_, i) => i % 2 === 0);
  const ys = quad.filter((_, i) => i % 2 === 1);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  return [x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0];
}

export function createHandle(ctx: ApiContext, panel: PanelModel, where: string): PanelHandle {
  const { resolve } = ctx;
  const handle: PanelHandle = {
    draw(painter) {
      if (typeof painter !== 'function') throw new KitError('invalid-params', `${where}.draw(fn)`);
      panel.painters.push(painter);
      return handle;
    },
    rough(painter) {
      panel.roughs.push(painter);
      return handle;
    },
    enter(options) {
      const o = parse(enterSchema, options, `${where}.enter`);
      const dur = o.dur ?? { cut: 0, slam: 0.22, slide: 0.45, pop: 0.19 }[o.kind];
      panel.enter = { at: resolve(o.at, 0), kind: o.kind, from: o.from, dur, rough: o.rough };
      return handle;
    },
    exit(at) {
      panel.until = resolve(at, Number.POSITIVE_INFINITY);
      return handle;
    },
    morph(quad, options) {
      const to = parse(quadSchema, quad, `${where}.morph quad`) as Quad;
      const o = parse(morphSchema, options, `${where}.morph`);
      panel.morphs.push({ to, at: resolve(o.at, 0), dur: o.dur, ease: o.ease });
      return handle;
    },
    camera(keys) {
      panel.cameraKeys = keys.map((key) => {
        const o = parse(cameraKeySchema, key, `${where}.camera`);
        return { at: resolve(o.at, 0), x: o.x, y: o.y, zoom: o.zoom, ease: o.ease };
      });
      return handle;
    },
    clock(options) {
      const o = parse(clockSchema, options, `${where}.clock`);
      const hold = o.hold === undefined ? Number.POSITIVE_INFINITY : resolve(o.hold, 0);
      panel.clock = { offset: o.offset, rate: o.rate, hold };
      return handle;
    },
    quad: (t = 0) => panel.quad(t),
    point: (u, v, t = 0) => bilinear(panel.quad(t), u, v),
    toPage: (x, y, t = 0) => panel.toPage(x, y, t),
    box: boxOf(panel.restQuad(0)),
  };
  PANEL_MODELS.set(handle, panel);
  return handle;
}

export function createStructureApi(ctx: ApiContext) {
  const { model, resolve, call } = ctx;
  const addPanel = (
    shape: Quad | ((t: number) => Quad),
    options: z.input<typeof panelOptionsSchema>,
    where: string,
  ): PanelHandle => {
    const o = parse(panelOptionsSchema, options, where);
    const index = model.panels.length;
    const key = o.key ?? `panel${String(ctx.seed)}-${String(index)}`;
    const style = {
      key,
      border: o.border,
      boil: o.boil,
      pencils: o.pencils,
      mis: o.mis ?? misFor(key),
    };
    const panel = new PanelModel(shape, style, o.z ?? index);
    model.panels.push(panel);
    return createHandle(ctx, panel, `${call}.panel #${String(index + 1)}`);
  };
  return {
    panels(layout: LayoutName, options?: z.input<typeof layoutOptionsSchema>): PanelHandle[] {
      const where = `${call}.panels('${layout}')`;
      if (!LAYOUT_NAMES.includes(layout)) {
        throw new KitError('invalid-params', `${where}: layouts are ${LAYOUT_NAMES.join(', ')}`);
      }
      const o = parse(layoutOptionsSchema, options, where);
      const quads = layoutQuads(layout, { ...o, seed: o.seed ?? ctx.seed });
      return quads.map((quad) => addPanel(quad, {}, where));
    },
    panel(
      shape: readonly number[] | ((t: number) => readonly number[]),
      options?: z.input<typeof panelOptionsSchema>,
    ): PanelHandle {
      const where = `${call}.panel`;
      const quad =
        typeof shape === 'function'
          ? (t: number) => parse(quadSchema, shape(t), `${where}(fn) at t=${String(t)}`) as Quad
          : (parse(quadSchema, shape, where) as Quad);
      return addPanel(quad, options ?? {}, where);
    },
    camera(keys: readonly z.input<typeof cameraKeySchema>[]): void {
      model.cameraKeys = keys.map((key) => {
        const o = parse(cameraKeySchema, key, `${call}.camera`);
        return { at: resolve(o.at, 0), x: o.x, y: o.y, zoom: o.zoom, ease: o.ease };
      });
    },
    shake(at: number | string, amp = 4, decay = 0.13): void {
      model.shakes.push({ at: resolve(at, 0), amp, decay });
    },
    press(options: { at?: number; step?: number; order?: string } = {}): void {
      const order = options.order ?? 'YCMK';
      if (!/^[YCMK]{1,4}$/.test(order)) {
        throw new KitError('invalid-params', `${call}.press: order is plates Y, C, M, K`);
      }
      model.press = { at: options.at ?? 0.06, step: options.step ?? 0.14, order };
    },
    draw(painter: Painter, options?: z.input<typeof drawSchema>): void {
      const o = parse(drawSchema, options, `${call}.draw`);
      model.items.push({
        at: resolve(o.at, Number.NEGATIVE_INFINITY),
        until: resolve(o.until, Number.POSITIVE_INFINITY),
        layer: o.z !== undefined ? 'z' : o.over ? 'over' : 'under',
        z: o.z,
        draw: (item) => {
          painter(new ComicPen(item, item.page, model.mis, item.t), item.t);
        },
      });
    },
    /** Pure helpers for the scene's own animation (never Math.random or a timer). */
    util: { seg, track, lerp, clamp01, pop, rnd, range: rndRange, torn },
  };
}

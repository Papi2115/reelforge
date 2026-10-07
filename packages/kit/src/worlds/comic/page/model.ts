/**
 * The Comic page compositor (ADR-032): one newsprint page per shot, repainted from scratch for
 * every t into one 640x360 index framebuffer. Order: paper (fibres fixed to the page, travelling
 * with the page camera) -> under-traces -> panels (pencil rough before an entrance; blue-line
 * pencils; content painted through the panel's mask with its own clock and camera, colour plates
 * out of register; boiled ink border) -> page drawings, lettering and traces over the panels ->
 * press intro remap. A pure function of t: no state survives a frame.
 */
import { KitError } from '../../../errors.js';
import { INK, plateRemap } from '../inks.js';
import type { ComicCanvas } from '../draw/canvas.js';
import { rnd, rndRange, shake, track, type EaseName } from '../draw/math.js';
import { dither, type Screen } from '../draw/paint.js';
import { cameraPlace, type Place } from '../draw/place.js';
import { boil } from '../draw/shapes.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { PanelModel } from './panel.js';
import { ComicPen, type PenContext } from './pen.js';

/** The QUALITY.md §6 cap: at most five panels on the page at once. */
export const MAX_PANELS_AT_ONCE = 5;

export interface PageCameraKey {
  readonly at: number;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly ease: EaseName;
}

export interface Shake {
  readonly at: number;
  readonly amp: number;
  readonly decay: number;
}

/** What page items draw with. */
export interface ItemContext extends PenContext {
  /** Page camera placement (page coordinates -> screen). */
  readonly page: Place;
  readonly t: number;
}

export interface PageItem {
  readonly at: number;
  readonly until: number;
  /** under = on the paper before the panels; over = after them; z = among the panels by `z`. */
  readonly layer: 'under' | 'over' | 'z';
  /** Panel order of a `z` item. */
  readonly z?: number | undefined;
  draw(ctx: ItemContext): void;
}

/** A pass over the finished page (before the press intro): a flashback's sepia re-ink. */
export interface PagePost {
  readonly at: number;
  readonly until: number;
  apply(ctx: ItemContext): void;
}

/** A print screen in force over a span of the shot (a flashback's coarser, rotated screen). */
export interface ScreenSpan {
  readonly at: number;
  readonly until: number;
  readonly screen: Readonly<Screen>;
}

export interface Press {
  readonly at: number;
  readonly step: number;
  readonly order: string;
}

export class ComicPageModel {
  readonly panels: PanelModel[] = [];
  readonly items: PageItem[] = [];
  cameraKeys: PageCameraKey[] = [];
  readonly shakes: Shake[] = [];
  readonly posts: PagePost[] = [];
  readonly screens: ScreenSpan[] = [];
  /** Rules checked on the first frame, when the whole page is known (a spread's hold). */
  readonly checks: ((call: string) => void)[] = [];
  press: Press | undefined;
  readonly seed: number;
  readonly paperKey: string;
  readonly mis: readonly [number, number];

  constructor(seed: number, mis: readonly [number, number]) {
    this.seed = seed;
    this.paperKey = `paper${String(seed)}`;
    this.mis = mis;
  }

  /** Checks the finished page (first frame): the panel cap. */
  validate(call: string): void {
    const most = maxOverlap(this.panels);
    if (most > MAX_PANELS_AT_ONCE) {
      throw new KitError(
        'invalid-params',
        `${call}: ${String(most)} panels on the page at once; a comic page shows at most ${String(MAX_PANELS_AT_ONCE)} (end one with panel.exit(at), or start a new page)`,
      );
    }
    for (const check of this.checks) check(call);
  }

  /** Page placement at t: the camera track plus decaying shakes. */
  place(t: number): Place {
    const keys = this.cameraKeys;
    const x =
      keys.length === 0
        ? PAGE_WIDTH / 2
        : track(
            keys.map((k) => [k.at, k.x, k.ease]),
            t,
          );
    const y =
      keys.length === 0
        ? PAGE_HEIGHT / 2
        : track(
            keys.map((k) => [k.at, k.y, k.ease]),
            t,
          );
    const zoom =
      keys.length === 0
        ? 1
        : track(
            keys.map((k) => [k.at, k.zoom, k.ease]),
            t,
          );
    let dx = 0;
    let dy = 0;
    this.shakes.forEach((hit, i) => {
      const [sx, sy] = shake(t, hit.at, hit.amp, hit.decay, `${this.paperKey}shake${String(i)}`);
      dx += sx;
      dy += sy;
    });
    return cameraPlace(PAGE_WIDTH, PAGE_HEIGHT, x, y, zoom, [dx, dy]);
  }

  render(canvas: ComicCanvas, t: number): void {
    const span = this.screens.find((entry) => t >= entry.at && t < entry.until);
    const screen: Screen = { cellMul: 1, angleAdd: 0, ...span?.screen };
    const page = this.place(t);
    const ctx: ItemContext = { canvas, boilFrame: Math.floor(t * 10), screen, page, t };
    canvas.clear(INK.PAPER);
    paper(canvas, page, this.paperKey);
    this.drawItems(ctx, 'under');
    const layered = [
      ...this.panels.map((panel) => ({ order: panel.order, panel, item: undefined })),
      ...this.items
        .filter((item) => item.layer === 'z')
        .map((item) => ({ order: item.z ?? 0, panel: undefined, item })),
    ].sort((a, b) => a.order - b.order);
    for (const { panel, item } of layered) {
      if (item !== undefined) {
        if (t >= item.at && t < item.until) item.draw(ctx);
      } else if (panel.roughVisible(t)) drawRough(ctx, panel);
      else if (panel.visible(t)) drawPanel(ctx, panel);
    }
    this.drawItems(ctx, 'over');
    for (const post of this.posts) if (t >= post.at && t < post.until) post.apply(ctx);
    if (this.press !== undefined) {
      const { at, step, order } = this.press;
      const printed = Array.from(order)
        .filter((_, i) => t >= at + i * step)
        .join('');
      if (printed.length < order.length) canvas.remap(plateRemap(printed));
    }
  }

  private drawItems(ctx: ItemContext, layer: PageItem['layer']): void {
    for (const item of this.items) {
      if (item.layer === layer && ctx.t >= item.at && ctx.t < item.until) item.draw(ctx);
    }
  }
}

function maxOverlap(panels: readonly PanelModel[]): number {
  let most = 0;
  for (const panel of panels) {
    const t = Number.isFinite(panel.from) ? panel.from : -1e9;
    most = Math.max(most, panels.filter((other) => other.from <= t && t < other.until).length);
  }
  return most;
}

/** Newsprint: paper tone, fibres and foxing fixed to the page so they travel with the camera. */
export function paper(canvas: ComicCanvas, page: Place, key: string): void {
  for (let i = 0; i < 520; i += 1) {
    const sx = Math.round(page.x(rndRange(key, i, -700, 1340)));
    const sy = Math.round(page.y(rndRange(key, i + 3000, -300, 660)));
    if (sx < 0 || sy < 0 || sx >= canvas.width || sy >= canvas.height) continue;
    const r = rnd(key, i + 6000);
    if (r < 0.08) canvas.plot(sx, sy, INK.AGED);
    else if (r < 0.2) canvas.line(sx, sy, sx + 2, sy, INK.SHADE);
    else canvas.plot(sx, sy, INK.SHADE);
  }
}

/** The artist's blue-line pencils: each edge ruled past its corners, never erased. */
function pencils(canvas: ComicCanvas, quad: readonly number[], key: string): void {
  const faint = dither(-1, INK.PENCIL, 0.45);
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    const ax = quad[i * 2] ?? 0;
    const ay = quad[i * 2 + 1] ?? 0;
    const bx = quad[j * 2] ?? 0;
    const by = quad[j * 2 + 1] ?? 0;
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / length;
    const uy = (by - ay) / length;
    const o0 = rndRange(key, i, 4, 9);
    const o1 = rndRange(key, i + 10, 3, 8);
    const off = rndRange(key, i + 20, -3, 3);
    canvas.line(
      ax - ux * o0 - uy * off,
      ay - uy * o0 + ux * off,
      bx + ux * o1 - uy * off * 0.6,
      by + uy * o1 + ux * off * 0.6,
      faint,
    );
  }
}

function drawPanel(ctx: ItemContext, panel: PanelModel): void {
  const { canvas, page, t } = ctx;
  const { style } = panel;
  const quad = page.map(panel.quad(t));
  if (style.pencils) pencils(canvas, quad, style.key);
  const mask = canvas.maskPoly(quad);
  try {
    canvas.withClip(mask, () => {
      const local = panel.localTime(t);
      const penCtx = style.screen === undefined ? ctx : { ...ctx, screen: style.screen };
      const pen = new ComicPen(penCtx, panel.contentPlace(page, t), style.mis, local);
      for (const painter of panel.painters) painter(pen, local);
    });
  } finally {
    canvas.release(mask);
  }
  if (style.border <= 0) return;
  const width = Math.max(style.border, Math.round(style.border * page.s * panel.frame(t).k));
  const inked = boil(quad, `${style.key}border`, style.boil, ctx.boilFrame);
  canvas.polyline(inked, INK.INK, width, true);
}

/** Before its entrance: the panel's pencil layout (border and the rough painters) only. */
function drawRough(ctx: ItemContext, panel: PanelModel): void {
  const { canvas, page, t } = ctx;
  const level = Math.min(0.9, 0.35 + Math.max(0, t) * 1.5);
  canvas.polyline(page.map(panel.restQuad(t)), dither(-1, INK.PENCIL, level), 1, true);
  const pen = new ComicPen(ctx, page, [0, 0], t);
  for (const painter of panel.roughs) painter(pen, t);
}

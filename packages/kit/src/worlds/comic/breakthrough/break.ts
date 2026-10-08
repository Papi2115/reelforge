/**
 * `page.panelBreak(spec)`: the open composition toolkit of the Comic breakthroughs. The scene
 * invents the mechanism (break-schema.ts): its panels, their shapes and entrances, the moves on
 * the narration's beats, the gutters (kept, closing into one picture, lifting off the page as
 * loose pieces, tearing), the camera in each panel, an optional spine crease (`fold`) and the
 * older sepia print of a look back (`print: 'past'`). Panels sit above the page's own panels and
 * count toward its five-panel cap. A pure function of t.
 */
import type { z } from 'zod';
import { KitError } from '../../../errors.js';
import { INK, SEPIA } from '../inks.js';
import { rnd, rndRange, seg } from '../draw/math.js';
import { dither } from '../draw/paint.js';
import { boil } from '../draw/shapes.js';
import { createHandle, parse, type ApiContext, type PanelHandle } from '../page/api.js';
import type { createLetteringApi } from '../page/api-lettering.js';
import type { Quad } from '../page/layouts.js';
import type { ItemContext } from '../page/model.js';
import { misFor, PanelModel } from '../page/panel.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { ENTER_DUR, poseAt, type PanelPlan, type ResolvedMove } from './break-motion.js';
import { breakSchema, type BreakBox, type BreakSpec } from './break-schema.js';
import { remapInside, SEPIA_SCREEN } from './flashback.js';

/** Break panels sit above the page's own panels (and below a flashback's beats). */
const Z = 800;
/** How far a box may reach past the page edge (a bleed). */
const BLEED = 40;

type Lettering = ReturnType<typeof createLetteringApi>;

export interface PanelBreakResult {
  readonly at: number;
  readonly until: number;
  /** The panels by id. */
  readonly panels: Readonly<Record<string, PanelHandle>>;
}

function boxOfQuad(quad: readonly number[]): BreakBox {
  const xs = quad.filter((_, i) => i % 2 === 0);
  const ys = quad.filter((_, i) => i % 2 === 1);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}

function checkBox(box: BreakBox, where: string): void {
  const [x, y, w, h] = box;
  const inside =
    x >= -BLEED && y >= -BLEED && x + w <= PAGE_WIDTH + BLEED && y + h <= PAGE_HEIGHT + BLEED;
  if (!inside) {
    throw new KitError(
      'invalid-params',
      `${where}: box [${box.map((v) => v.toFixed(0)).join(', ')}] must lie on the 640x360 page (a bleed may pass an edge by ${String(BLEED)} px)`,
    );
  }
}

function plans(ctx: ApiContext, o: BreakSpec, span: readonly [number, number], where: string) {
  const ids = new Set<string>();
  return o.panels.map((spec, i): PanelPlan => {
    const here = `${where} panel '${spec.id}'`;
    if (ids.has(spec.id)) throw new KitError('invalid-params', `${here}: ids must be unique`);
    ids.add(spec.id);
    const box = spec.box ?? (spec.quad === undefined ? undefined : boxOfQuad(spec.quad));
    if (box === undefined) {
      throw new KitError('invalid-params', `${here}: give box [x, y, w, h] or quad`);
    }
    checkBox(box, here);
    const at = ctx.resolve(spec.at, span[0]);
    const until = ctx.resolve(spec.until, span[1]);
    if (at < span[0] - 1e-6 || until < at + 0.3) {
      throw new KitError(
        'invalid-params',
        `${here}: arrives at ${at.toFixed(2)} s and leaves at ${until.toFixed(2)} s; it must arrive with or after the break (${span[0].toFixed(2)} s) and stay >= 0.3 s`,
      );
    }
    const camera = spec.camera.map((key) => ({ ...key, at: ctx.resolve(key.at, at) }));
    const key = `break${String(ctx.seed)}:${spec.id}:${String(i)}`;
    const dur = spec.dur ?? ENTER_DUR[spec.enter];
    return {
      id: spec.id,
      key,
      spec,
      box,
      at,
      until,
      enter: spec.enter,
      from: spec.from,
      dur,
      camera,
    };
  });
}

function resolveMoves(
  ctx: ApiContext,
  o: BreakSpec,
  ids: ReadonlySet<string>,
  start: number,
  where: string,
): ResolvedMove[] {
  return o.moves
    .map((move, i): ResolvedMove => {
      const targets = typeof move.target === 'string' ? [move.target] : move.target;
      const unknown = targets.find((target) => !ids.has(target));
      if (unknown !== undefined) {
        throw new KitError(
          'invalid-params',
          `${where} move ${String(i + 1)}: no panel '${unknown}' (panels: ${[...ids].join(', ')})`,
        );
      }
      const at = ctx.resolve(move.at, start);
      if (at < start - 1e-6) {
        throw new KitError(
          'invalid-params',
          `${where} move ${String(i + 1)}: starts at ${at.toFixed(2)} s, before the break (${start.toFixed(2)} s)`,
        );
      }
      if (move.to.box !== undefined) checkBox(move.to.box, `${where} move ${String(i + 1)}`);
      return { targets, at, dur: move.dur, ease: move.ease, lag: move.lag, to: move.to };
    })
    .sort((a, b) => a.at - b.at);
}

interface Gutters {
  readonly kind: BreakSpec['gutters']['kind'];
  readonly at: number;
  readonly dur: number;
}

/** A ragged edge along the quad: the panel torn out of its page. */
function tornEdge(quad: readonly number[], key: string, amp: number): number[] {
  const pts: number[] = [];
  for (let side = 0; side < 4; side += 1) {
    const [ax, ay] = [quad[side * 2] ?? 0, quad[side * 2 + 1] ?? 0];
    const [bx, by] = [quad[((side + 1) % 4) * 2] ?? 0, quad[((side + 1) % 4) * 2 + 1] ?? 0];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const [nx, ny] = [-(by - ay) / length, (bx - ax) / length];
    const steps = Math.max(2, Math.round(length / 5));
    for (let i = 0; i < steps; i += 1) {
      const u = i / steps;
      const d = i === 0 ? 0 : rndRange(key, side * 997 + i, -amp, amp);
      pts.push(ax + (bx - ax) * u + nx * d, ay + (by - ay) * u + ny * d);
    }
  }
  return pts;
}

function drawFrame(
  item: ItemContext,
  quad: readonly number[],
  border: number,
  g: Gutters,
  key: string,
): void {
  if (border <= 0) return;
  const { canvas, page, t, boilFrame } = item;
  const p = seg(t, g.at, g.at + g.dur, 'inOutCubic');
  const screen = page.map(quad);
  if (g.kind === 'tear' && p > 0) {
    const torn = tornEdge(screen, `${key}tear`, 3.5 * p);
    canvas.polyline(torn, INK.INK, Math.max(1, Math.round(border * 0.7)), true);
    return;
  }
  const width = Math.round((g.kind === 'close' ? 1 - p : 1) * border * Math.max(1, page.s));
  if (width > 0)
    canvas.polyline(boil(screen, `${key}border`, 0.4, boilFrame), INK.INK, width, true);
}

function drawShadow(item: ItemContext, quad: readonly number[], g: Gutters): void {
  const p = seg(item.t, g.at, g.at + g.dur, 'outCubic');
  if (p <= 0) return;
  const [dx, dy] = [2 + 3 * p, 3 + 4 * p];
  const lifted = quad.map((value, i) => value + (i % 2 === 0 ? dx : dy));
  item.canvas.poly(item.page.map(lifted), dither(-1, INK.AGED, 0.4 + 0.3 * p));
}

function crease(item: ItemContext, quads: readonly (readonly number[])[], fold: number): void {
  const { canvas, page } = item;
  const x = Math.round(page.x(fold));
  for (const quad of quads) {
    const mask = canvas.maskPoly(page.map(quad));
    try {
      canvas.withClip(mask, () => {
        canvas.rect(x, 0, 1, canvas.height, dither(-1, INK.GREY_D, 3 / 16));
      });
    } finally {
      canvas.release(mask);
    }
  }
}

export function createPanelBreak(ctx: ApiContext, lettering: Lettering) {
  const { model, call } = ctx;
  return function panelBreak(spec: z.input<typeof breakSchema>): PanelBreakResult {
    const where = `${call}.panelBreak`;
    const o = parse(breakSchema, spec, where);
    if (o.when !== undefined && o.intent.toUpperCase() === o.when.toUpperCase()) {
      throw new KitError('invalid-params', `${where}: intent is the claim, not the caption`);
    }
    if (o.moves.length === 0 && o.drive === undefined) {
      throw new KitError(
        'invalid-params',
        `${where}: a panel break is a motion that shows the claim: give moves [{ target, at, to }] or drive (t) => offsets`,
      );
    }
    const at = ctx.resolve(o.at, 0);
    const until = ctx.resolve(o.until, Number.POSITIVE_INFINITY);
    if (until < at + 0.5) {
      throw new KitError('invalid-params', `${where}: until must be >= 0.5 s after at`);
    }
    const panelPlans = plans(ctx, o, [at, until], where);
    const moves = resolveMoves(ctx, o, new Set(panelPlans.map((plan) => plan.id)), at, where);
    const gutters: Gutters = {
      kind: o.gutters.kind,
      at: ctx.resolve(o.gutters.at, moves[0]?.at ?? at),
      dur: o.gutters.dur,
    };
    const isPast = (plan: PanelPlan) => (plan.spec.print ?? o.print) === 'past';
    const pose = (plan: PanelPlan, t: number) => poseAt(plan, moves, o.drive, t);
    const panels: Record<string, PanelHandle> = {};
    panelPlans.forEach((plan, i) => {
      const order = Z + i * 2;
      const past = isPast(plan);
      const style = {
        key: plan.key,
        border: 0,
        boil: 0.4,
        pencils: !past,
        mis: misFor(plan.key),
        screen: past ? SEPIA_SCREEN : undefined,
      };
      const panel = new PanelModel((t: number) => pose(plan, t).quad as Quad, style, order);
      model.panels.push(panel);
      const handle = createHandle(ctx, panel, `${where} panel '${plan.id}'`);
      handle.draw((g, t) => {
        const now = pose(plan, t);
        plan.spec.draw(g.at(now.origin[0], now.origin[1], now.k), t, now.size);
      });
      handle.enter({ at: plan.at, kind: 'cut' });
      if (Number.isFinite(plan.until)) handle.exit(plan.until);
      const span = { at: plan.at, until: plan.until, layer: 'z' as const };
      if (gutters.kind === 'lift') {
        model.items.push({
          ...span,
          z: order - 0.5,
          draw: (item) => {
            drawShadow(item, pose(plan, item.t).quad, gutters);
          },
        });
      }
      model.items.push({
        ...span,
        z: order + 1,
        draw: (item) => {
          const now = pose(plan, item.t);
          drawFrame(item, now.quad, now.border, gutters, plan.key);
        },
      });
      panels[plan.id] = handle;
    });
    const last = Math.max(...panelPlans.map((plan) => plan.until));
    const visible = (t: number, only = panelPlans) =>
      only.filter((plan) => t >= plan.at && t < plan.until).map((plan) => pose(plan, t).quad);
    const pastPlans = panelPlans.filter(isPast);
    if (pastPlans.length > 0) {
      model.posts.push({
        at,
        until: last,
        apply: (item) => {
          for (const quad of visible(item.t, pastPlans)) {
            remapInside(item, item.page.map(quad), SEPIA);
          }
        },
      });
    }
    const fold = o.fold;
    if (fold !== undefined) {
      model.items.push({
        at,
        until: last,
        layer: 'z',
        z: Z + 50,
        draw: (item) => {
          crease(item, visible(item.t), fold);
        },
      });
    }
    const first = pastPlans[0] ?? panelPlans[0];
    if (o.when !== undefined && first !== undefined) {
      const tilt = rnd(first.key, 3) < 0.5 ? -1 : 1;
      lettering.caption(o.when, {
        x: first.box[0] + 6,
        y: first.box[1] + 5,
        at: first.at + first.dur,
        until: Number.isFinite(first.until) ? first.until : undefined,
        tilt,
        type: o.type,
        width: Math.max(80, Math.min(300, first.box[2] - 12)),
      });
    }
    return { at, until, panels };
  };
}

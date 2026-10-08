/**
 * `page.push({ focus, at, until, scale, ease })`: the camera of a Sketchbook page. The page is a
 * full-frame screen quad, so `ctx.camera` moves do nothing on it (real run Sketchbook 3 #3);
 * instead the quad itself grows toward a focal point of the page: the reader's eye moving in on
 * the key drawing. The view never leaves the page (no desk or black edge shows) and stays a pure
 * function of t. The raster keeps its nearest sampling, so keep pushes slow and small.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam, type Resolver } from '../../../looks/blueprint/timing.js';
import { EASE_NAMES, ease, lerp, seg, type EaseName } from '../draw/math.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { parse } from './schemas.js';

/** The strongest push: past this the nearest-sampled lines get visibly blocky. */
export const MAX_PUSH_SCALE = 1.4;

export const pushOptions = z.object({
  focus: z
    .tuple([z.number().min(0).max(PAGE_WIDTH), z.number().min(0).max(PAGE_HEIGHT)])
    .describe('Page point the view moves in on (960x540 page px): the focal drawing'),
  at: whenParam.optional().describe('The push starts (default 0)'),
  until: whenParam
    .optional()
    .describe("The push is complete (default: the page's duration, else at + 3 s)"),
  scale: z
    .number()
    .min(1.02)
    .max(MAX_PUSH_SCALE)
    .default(1.15)
    .describe('Final magnification (1.1-1.2 reads as a slow push)'),
  ease: z.enum(EASE_NAMES).default('inOut'),
});

export interface PagePush {
  readonly focus: readonly [number, number];
  readonly t0: number;
  readonly t1: number;
  readonly scale: number;
  readonly ease: EaseName;
}

/** The visible part of the page: [x, y, w, h] as shares 0..1 from the top left. */
export type PageView = readonly [number, number, number, number];

export const FULL_VIEW: PageView = [0, 0, 1, 1];

/** Parses a `page.push(...)` call into its timed push. */
export function parsePush(
  options: unknown,
  deps: {
    readonly resolve: Resolver;
    readonly duration: number | undefined;
    readonly call: string;
  },
): PagePush {
  const o = parse(pushOptions, options, deps.call);
  const t0 = deps.resolve(o.at, 0);
  const t1 = deps.resolve(o.until, deps.duration ?? t0 + 3);
  if (!(t1 > t0)) {
    throw new KitError(
      'invalid-params',
      `${deps.call}: until (${t1.toFixed(2)} s) must be after at (${t0.toFixed(2)} s)`,
    );
  }
  return { focus: o.focus, t0, t1, scale: o.scale, ease: o.ease };
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/**
 * The page part shown at t: it shrinks by the push's scale while its centre travels from the
 * page centre to the focus, clamped so the view stays inside the page.
 */
export function pushView(push: PagePush | undefined, t: number): PageView {
  if (push === undefined) return FULL_VIEW;
  const k = ease(push.ease, seg(t, push.t0, push.t1));
  const size = 1 / lerp(1, push.scale, k);
  const half = size / 2;
  const cx = clamp(lerp(0.5, push.focus[0] / PAGE_WIDTH, k), half, 1 - half);
  const cy = clamp(lerp(0.5, push.focus[1] / PAGE_HEIGHT, k), half, 1 - half);
  return [cx - half, cy - half, size, size];
}

/**
 * Clip-space corners of the page quad that shows `view` full frame, in the vertex order of the
 * whiteboard quad (left-bottom, right-bottom, right-top, left-top).
 */
export function quadCorners(view: PageView): readonly (readonly [number, number])[] {
  const [x, y, w, h] = view;
  const left = (-x / w) * 2 - 1;
  const right = ((1 - x) / w) * 2 - 1;
  const top = 1 + (y / h) * 2;
  const bottom = 1 - ((1 - y) / h) * 2;
  return [
    [left, bottom],
    [right, bottom],
    [right, top],
    [left, top],
  ];
}

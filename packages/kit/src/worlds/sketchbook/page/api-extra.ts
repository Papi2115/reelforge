/**
 * Page methods of the Sketchbook looks B and C (PLAN.md#13.6): `page.ruler(...)` (a clear plastic
 * ruler slid in under a calculation and out again) and `page.flipbook(...)` (a thumb riffles the
 * corner of `count` pages, each drawn with its own page API).
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam, type Resolver } from '../../../looks/blueprint/timing.js';
import { ease, seg } from '../draw/math.js';
import { paintRuler } from '../traces.js';
import { Flipbook } from './flipbook.js';
import { SketchPage } from './model.js';
import { parse } from './schemas.js';

const SLIDE_IN = 0.3;
const SLIDE_OUT = 0.32;

export const rulerOptions = z.object({
  at: whenParam.describe('In place (it slides in over the 0.3 s before)'),
  until: whenParam.describe('Starts to slide out (gone 0.32 s later)'),
  length: z.number().min(100).max(900).default(480),
});

export const flipbookOptions = z.object({
  count: z.int().min(2).max(60).describe('Pages in the flipbook'),
  at: whenParam.optional().describe('The thumb starts riffling (default 0.3 s)'),
  until: whenParam.describe('The last page is reached'),
  seed: z.int().min(0).optional(),
});

export interface ExtraDeps<Api> {
  readonly page: SketchPage;
  readonly resolve: Resolver;
  /** Starts a method call (fails once the page is sealed); returns its call name. */
  readonly begin: (method: string) => string;
  readonly seedOf: (own: number | undefined) => number;
  /** Page API of a flipbook page; its seal runs with the page's own. */
  readonly subApi: (page: SketchPage, seed: number) => Api;
}

export function pageExtras<Api>(deps: ExtraDeps<Api>) {
  const { page, resolve, begin } = deps;
  return {
    ruler(x: unknown, y: unknown, options?: unknown): void {
      const name = begin('ruler');
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x + y)) {
        throw new KitError('invalid-params', `${name}: x and y must be numbers`);
      }
      const o = parse(rulerOptions, options, name);
      const inAt = resolve(o.at, 0);
      const outAt = Math.max(inAt, resolve(o.until, inAt));
      const xf = page.toScreen;
      page.addLayer({
        key: Number.POSITIVE_INFINITY,
        from: inAt - SLIDE_IN,
        draw: (canvas, t) => {
          const slideIn = ease('out', seg(t, inAt - SLIDE_IN, inAt));
          const slideOut = ease('in', seg(t, outAt, outAt + SLIDE_OUT));
          if (slideOut >= 1) return null;
          const left = -o.length - 80 + (o.length + 80 + x) * slideIn + (960 - x) * slideOut;
          paintRuler(canvas, xf, left, y, o.length);
          return null;
        },
      });
    },
    flipbook(options: unknown): { page(index: unknown): Api } {
      const name = begin('flipbook');
      const o = parse(flipbookOptions, options, name);
      const at = resolve(o.at, 0.3);
      const until = resolve(o.until, at + 3);
      if (!(until > at)) throw new KitError('invalid-params', `${name}: until must be after at`);
      const seed = deps.seedOf(o.seed);
      const { width, height, stock } = page.settings;
      const pages = Array.from(
        { length: o.count },
        () => new SketchPage({ width, height, stock, pen: false, rest: null, restGap: 1.5 }),
      );
      const apis = pages.map((sub, index) => deps.subApi(sub, seed + index * 97));
      page.addLayer(new Flipbook({ pages, at, until }).layer());
      return {
        page(index) {
          const api = typeof index === 'number' ? apis[index] : undefined;
          if (api === undefined) {
            throw new KitError(
              'invalid-params',
              `${name}.page(): index must be an integer 0-${String(o.count - 1)}`,
            );
          }
          return api;
        },
      };
    },
  };
}

/**
 * Inserts and physical traces of the page API: `page.sheet(...)` (with printed text, rules, a
 * calendar and tape) and the static traces (tape, coffee ring, clip, sticky note, smudge) that
 * are on the page from the start or appear at `at`.
 */
import type { z } from 'zod';
import { KitError } from '../../../errors.js';
import type { Resolver } from '../../../looks/blueprint/timing.js';
import type { Point } from '../draw/paths.js';
import { inkOfSwatch, INK } from '../inks.js';
import { paintClip, paintCoffeeRing, paintSmudge, paintSticky, paintTape } from '../traces.js';
import type { SketchPage } from './model.js';
import { PageFrame } from './motion.js';
import * as S from './schemas.js';
import { Sheet } from './sheet.js';

export interface SheetHandle {
  /** Printed (type) text in the sheet's local px. */
  print(
    text: string,
    options: { u: number; v: number; size?: number; width?: number; track?: number },
  ): void;
  /** A printed line in local px. */
  rule(u0: number, v0: number, u1: number, v1: number, color?: string): void;
  /** A printed month grid; `cell(day)` is the centre of a day's cell in page px. */
  calendar(options: unknown): { cell(day: number): Point };
  /** Tape over the sheet at local (u, v), page degrees. */
  tape(u: number, v: number, w: number, h: number, deg?: number): void;
  /** A local point in page px (where the sheet lies once landed). */
  point(u: number, v: number): Point;
  /** Attach marks to the sheet (they move with it while it is slapped on). */
  frame(): PageFrame;
}

export function addSheet(
  page: SketchPage,
  options: z.output<typeof S.sheetOptions>,
  resolve: Resolver,
  seedOf: (own: number | undefined) => number,
  call: string,
): SheetHandle {
  const seed = seedOf(options.seed);
  const sheet = new Sheet({
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
    deg: options.deg,
    at: options.at === undefined ? undefined : resolve(options.at, 0),
    holes: options.holes,
    seed,
  });
  page.addLayer(sheet.layer(page.toScreen));
  let tapes = 0;
  return {
    print(text, o) {
      if (typeof text !== 'string' || text.length === 0) {
        throw new KitError('invalid-params', `${call}.print(): text must be a non-empty string`);
      }
      sheet.print(
        text,
        o.u,
        o.v,
        o.size ?? 14,
        o.width ?? 1,
        seed + text.length * 31,
        o.track ?? 0,
      );
    },
    rule(u0, v0, u1, v1, color) {
      sheet.rule(
        [u0, v0],
        [u1, v1],
        color === undefined ? INK.GRAPH_L : (inkOfSwatch(color) ?? INK.GRAPH_L),
      );
    },
    calendar(raw) {
      const local = sheet.calendar(S.parse(S.calendarOptions, raw, `${call}.calendar()`));
      return { cell: (day) => sheet.point(...local(day)) };
    },
    tape(u, v, w, h, deg = 0) {
      tapes += 1;
      sheet.tape(u, v, w, h, deg, seed + tapes * 101);
    },
    point: (u, v) => sheet.point(u, v),
    frame: () => new PageFrame('sheet', (t) => sheet.frameAt(t)),
  };
}

export type TraceKind = 'tape' | 'coffeeRing' | 'clip' | 'sticky' | 'smudge';

/** A static trace: on the page from the start (or from `at`), drawn in time order. */
export function addTrace(
  page: SketchPage,
  kind: TraceKind,
  args: readonly number[],
  options: z.output<typeof S.traceOptions>,
  resolve: Resolver,
  seedOf: (own: number | undefined) => number,
): void {
  const seed = seedOf(options.seed);
  const at = options.at === undefined ? Number.NEGATIVE_INFINITY : resolve(options.at, 0);
  const a = (index: number): number => args[index] ?? 0;
  const xf = page.toScreen;
  page.addLayer({
    key: at,
    from: at,
    draw: (canvas, t) => {
      if (kind === 'tape') paintTape(canvas, xf, a(0), a(1), a(2), a(3), a(4), seed);
      else if (kind === 'coffeeRing') paintCoffeeRing(canvas, xf, a(0), a(1), a(2), seed % 1000);
      else if (kind === 'clip') paintClip(canvas, xf, a(0), a(1), a(2), a(3));
      else if (kind === 'sticky') {
        const lift = Number.isFinite(at) ? Math.max(0, 1 - (t - at) / 0.18) : 0;
        paintSticky(canvas, xf, a(0), a(1), a(2), a(3), a(4), lift);
      } else paintSmudge(canvas, xf, a(0), a(1), a(2), a(3), a(4), seed, a(5), a(6));
      return null;
    },
  });
}

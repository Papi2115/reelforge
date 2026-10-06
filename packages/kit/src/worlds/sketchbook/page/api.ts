/**
 * The scene-facing methods of a Sketchbook page (called in build(), before the first update):
 * pen marks (write, stroke, fill, arrow, loop, underline, ruled, crossOut, sun), stick figures,
 * inserts (sheet + printed calendar) and physical traces (tape, coffee ring, clip, sticky note,
 * smudge). Times default to "right after the previous mark", seeds to the page seed and the call
 * index, so a scene is deterministic without passing either.
 */
import type { z } from 'zod';
import { KitError } from '../../../errors.js';
import type { Resolver } from '../../../looks/blueprint/timing.js';
import type { StrokeRecipe } from '../draw/doodles.js';
import {
  arrowRecipe,
  crossOutRecipe,
  loopRecipe,
  ruledRecipe,
  sunRecipe,
  underlineRecipe,
} from '../draw/doodles.js';
import { layoutText, textSpan, textWidth, type HandName } from '../draw/lettering.js';
import {
  fillMark,
  fitMarks,
  strokeMark,
  writeMarks,
  type Mark,
  type Shape,
} from '../draw/marks.js';
import { ellipsePts, xformPts, type Pts } from '../draw/paths.js';
import { hash } from '../draw/math.js';
import { inkOfSwatch, INK } from '../inks.js';
import type { SketchPage } from './model.js';
import type { PageFrame } from './motion.js';
import * as S from './schemas.js';
import { addSheet, addTrace, type SheetHandle, type TraceKind } from './api-inserts.js';
import { pageExtras } from './api-extra.js';
import { breakthroughs } from './api-breakthrough.js';
import { addFigure, type FigureHandle, type Timed } from './api-figure.js';

export type { FigureHandle, Timed };

export interface PageContext {
  readonly page: SketchPage;
  readonly seed: number;
  readonly resolve: Resolver;
  /** Default boil cadence of the page. */
  readonly fps: number;
  readonly call: string;
}

/** Chisel nib options of a mark (undefined = the tool's own nib). */
function nibOf(nib: S.PenOptions['nib']): { len?: number; deg?: number; thick?: number } {
  return nib === undefined ? {} : { len: nib[0], deg: nib[1], thick: nib[2] };
}

export function createPageApi(context: PageContext) {
  const { page, resolve, call } = context;
  let calls = 0;
  let cursor = 0;
  let sealed = false;
  const seals: (() => void)[] = [];
  const begin = (method: string): string => {
    if (sealed)
      throw new KitError(
        'kit-outside-build',
        `${call}.${method}(): add marks in build(), before the first update(t)`,
      );
    calls += 1;
    return `${call}.${method}()`;
  };
  const seedOf = (own: number | undefined): number =>
    own ?? Math.floor(hash(context.seed, calls, 7) * 1e6);
  const startOf = (at: S.PenOptions['at']): number =>
    resolve(at, calls <= 1 && cursor === 0 ? 0.3 : cursor + 0.12);
  const colorOf = (name: string | undefined): number | undefined =>
    name === undefined ? undefined : inkOfSwatch(name);
  const commit = (marks: Mark[], until?: number, parallel = false): Timed => {
    const first = marks[0];
    if (!first) return { at: cursor, end: cursor };
    if (until !== undefined) fitMarks(marks, 0, first.t0, until);
    const placed = page.addMarks(marks, parallel ? 'parallel' : 'queue');
    const at = Math.min(...placed.map((mark) => mark.t0));
    const end = Math.max(...placed.map((mark) => mark.t0 + mark.dur));
    cursor = Math.max(cursor, end);
    return { at, end };
  };
  /** Local points of an attached mark -> its shape source. */
  const shapeSource = (
    frame: PageFrame | undefined,
    pts: Pts,
    corners: readonly boolean[] | null,
  ) => (frame ? (t: number): Shape => ({ pts: xformPts(pts, frame.at(t)), corners }) : undefined);
  const cornersOf = (indices: readonly number[], count: number): boolean[] | null =>
    indices.length === 0 ? null : Array.from({ length: count }, (_, i) => indices.includes(i));

  const strokes = (recipes: readonly StrokeRecipe[], options: S.PenOptions): Mark[] => {
    const seed = seedOf(options.seed);
    let t = startOf(options.at);
    return recipes.map((recipe, index) => {
      if (index > 0) t += recipe.gap;
      const mark = strokeMark(recipe.pts, {
        tool: options.tool,
        color: colorOf(options.color),
        width: options.width,
        t0: t,
        dur: recipe.dur ?? (index === 0 ? options.dur : undefined),
        speed: options.speed,
        seed: seed + recipe.seed,
        corners: recipe.corners ?? null,
        source: shapeSource(options.attach, recipe.pts, recipe.corners ?? null),
        held: options.held,
        boil: recipe.boil ?? options.boil,
        fps: options.fps ?? context.fps,
        smooth: recipe.smooth,
        ease: recipe.ease,
        ...nibOf(options.nib),
      });
      t = mark.t0 + mark.dur;
      return mark;
    });
  };
  const pen = <Sch extends z.ZodType<S.PenOptions>>(
    method: string,
    schema: Sch,
    options: unknown,
    recipes: (o: z.output<Sch>, seed: number) => StrokeRecipe[],
  ): Timed => {
    const name = begin(method);
    const parsed = S.parse(schema, options, name);
    return commit(
      strokes(recipes(parsed, seedOf(parsed.seed)), parsed),
      undefined,
      parsed.parallel,
    );
  };
  const num = (value: unknown, name: string, method: string): number =>
    S.finite(value, name, `${call}.${method}()`);
  /** A static physical trace: positional numbers by name, then the kind's extra arguments. */
  const trace = <Sch extends z.ZodType<z.output<typeof S.traceOptions>>>(
    kind: TraceKind,
    schema: Sch,
    options: unknown,
    numbers: Readonly<Record<string, unknown>>,
    extra: (o: z.output<Sch>) => number[] = () => [],
  ): void => {
    const o = S.parse(schema, options, begin(kind));
    const args = Object.entries(numbers).map(([key, value]) => num(value, key, kind));
    addTrace(page, kind, [...args, ...extra(o)], o, resolve, seedOf);
  };

  const api = {
    write(text: unknown, options?: unknown) {
      const name = begin('write');
      if (typeof text !== 'string' || text.length === 0 || text.length > 80) {
        throw new KitError('invalid-params', `${name}: text must be a string of 1-80 characters`);
      }
      const o = S.parse(S.writeOptions, options, name);
      const marks: Mark[] = [];
      const t0 = startOf(o.at);
      const layout = {
        x: o.x,
        y: o.y,
        size: o.size,
        hand: o.hand,
        rot: o.rot,
        seed: seedOf(o.seed),
        track: o.track,
      };
      writeMarks(marks, text, {
        ...layout,
        tool: o.tool,
        color: colorOf(o.color),
        width: o.width,
        t0,
        t1: o.until === undefined ? undefined : resolve(o.until, t0),
        speed: o.speed,
        boil: o.boil ?? (o.hand === 'type' ? 0 : undefined),
        fps: o.fps ?? context.fps,
        held: o.held,
        ...nibOf(o.nib),
        source: o.attach
          ? (pts, corners) => shapeSource(o.attach, pts, corners) ?? (() => ({ pts, corners }))
          : undefined,
      });
      const [x0, y0, x1, y1] = textSpan(layoutText(text, layout));
      return {
        ...commit(marks, undefined, o.parallel),
        width: x1 - x0,
        box: [x0, y0, x1 - x0, y1 - y0] as const,
      };
    },
    stroke(points: unknown, options?: unknown) {
      const name = begin('stroke');
      const pts = S.flatPoints(points, name);
      const o = S.parse(S.strokeOptions, options, name);
      const corners = cornersOf(o.corners, pts.length / 2);
      return commit(
        strokes([{ pts, corners, gap: 0, seed: 0, smooth: o.smooth, ease: o.ease }], o),
        undefined,
        o.parallel,
      );
    },
    fill(points: unknown, options?: unknown) {
      const name = begin('fill');
      const pts = S.flatPoints(points, name);
      const o = S.parse(S.fillOptions, options, name);
      const frame = o.attach;
      const mark = fillMark(pts, {
        color: inkOfSwatch(o.color) ?? INK.ORANGE,
        t0: startOf(o.at),
        dur: o.dur,
        seed: seedOf(o.seed),
        spacing: o.spacing,
        dir: o.dir,
        held: o.held,
        dense: o.dense,
        source: frame ? (t) => xformPts(pts, frame.at(t)) : undefined,
      });
      return commit([mark], undefined, o.parallel);
    },
    arrow: (points: unknown, options?: unknown) =>
      pen('arrow', S.arrowOptions, options, (o) =>
        arrowRecipe(S.flatPoints(points, `${call}.arrow()`), o.head, o.spread, 0.06, o.ease),
      ),
    loop: (cx: unknown, cy: unknown, rx: unknown, ry: unknown, options?: unknown) =>
      pen('loop', S.loopOptions, options, (o, seed) =>
        loopRecipe(
          num(cx, 'cx', 'loop'),
          num(cy, 'cy', 'loop'),
          num(rx, 'rx', 'loop'),
          num(ry, 'ry', 'loop'),
          seed,
          o.turns,
          o.start,
          o.grow,
        ),
      ),
    underline: (x0: unknown, x1: unknown, y: unknown, options?: unknown) =>
      pen('underline', S.underlineOptions, options, (o) =>
        underlineRecipe(
          num(x0, 'x0', 'underline'),
          num(x1, 'x1', 'underline'),
          num(y, 'y', 'underline'),
          o.hook,
          o.sag,
        ),
      ),
    ruled: (x0: unknown, y0: unknown, x1: unknown, y1: unknown, options?: unknown) =>
      pen('ruled', S.penOptions, options, () =>
        ruledRecipe(
          num(x0, 'x0', 'ruled'),
          num(y0, 'y0', 'ruled'),
          num(x1, 'x1', 'ruled'),
          num(y1, 'y1', 'ruled'),
        ),
      ),
    crossOut: (x: unknown, y: unknown, w: unknown, h: unknown, options?: unknown) =>
      pen('crossOut', S.crossOutOptions, options, (o, seed) =>
        crossOutRecipe(
          num(x, 'x', 'crossOut'),
          num(y, 'y', 'crossOut'),
          num(w, 'w', 'crossOut'),
          num(h, 'h', 'crossOut'),
          o.style,
          seed,
        ),
      ),
    sun(cx: unknown, cy: unknown, r: unknown, options?: unknown) {
      const name = begin('sun');
      const [x, y, radius] = [num(cx, 'cx', 'sun'), num(cy, 'cy', 'sun'), num(r, 'r', 'sun')];
      const o = S.parse(S.sunOptions, options, name);
      const seed = seedOf(o.seed);
      const marks = strokes(sunRecipe(x, y, radius, seed, o.rays, o.rayScale), { ...o, seed });
      const last = marks.at(-1);
      if (o.fill !== 'none' && last) {
        marks.push(
          fillMark(ellipsePts(x + 2, y + 1, radius - 1, radius - 2, 14), {
            color: inkOfSwatch(o.fill) ?? INK.ORANGE,
            t0: last.t0 + last.dur + 0.1,
            dur: o.fillDur,
            spacing: 2,
            seed: seed + 77,
          }),
        );
      }
      const start = marks[0]?.t0 ?? 0;
      return commit(marks, o.until === undefined ? undefined : resolve(o.until, start), o.parallel);
    },
    figure(options: unknown): FigureHandle {
      const name = begin('figure');
      const o = S.parse(S.figureOptions, options, name);
      const deps = { page, resolve, start: startOf(o.at), seed: seedOf(o.seed), fps: context.fps };
      return addFigure(o, { ...deps, name, commit });
    },
    sheet: (options: unknown): SheetHandle =>
      addSheet(
        page,
        S.parse(S.sheetOptions, options, begin('sheet')),
        resolve,
        seedOf,
        `${call}.sheet()`,
      ),
    tape: (x: unknown, y: unknown, w: unknown, h: unknown, deg: unknown = 0, options?: unknown) => {
      trace('tape', S.traceOptions, options, { x, y, w, h, deg });
    },
    coffeeRing: (cx: unknown, cy: unknown, r: unknown, options?: unknown) => {
      trace('coffeeRing', S.traceOptions, options, { cx, cy, r });
    },
    clip: (x: unknown, y: unknown, deg: unknown = 0, options?: unknown) => {
      trace('clip', S.clipOptions, options, { x, y, deg }, (o) => [o.scale]);
    },
    sticky: (
      x: unknown,
      y: unknown,
      w: unknown,
      h: unknown,
      deg: unknown = 0,
      options?: unknown,
    ) => {
      trace('sticky', S.traceOptions, options, { x, y, w, h, deg });
    },
    smudge: (
      x: unknown,
      y: unknown,
      w: unknown,
      h: unknown,
      deg: unknown = 0,
      options?: unknown,
    ) => {
      trace('smudge', S.smudgeOptions, options, { x, y, w, h, deg }, (o) => [
        inkOfSwatch(o.color) ?? INK.GRAPH_L,
        o.density,
      ]);
    },
    keepClear(x: unknown, y: unknown, w: unknown, h: unknown) {
      begin('keepClear');
      const box = [
        num(x, 'x', 'keepClear'),
        num(y, 'y', 'keepClear'),
        num(w, 'w', 'keepClear'),
        num(h, 'h', 'keepClear'),
      ] as const;
      page.keepClear(box);
    },
    textWidth: (text: unknown, size: unknown, hand: unknown = 'print') =>
      textWidth(
        String(text),
        num(size, 'size', 'textWidth'),
        S.parse<z.ZodType<HandName>>(S.writeOptions.shape.hand, hand, `${call}.textWidth()`),
      ),
    doneAt: () => page.doneAt(),
    ...pageExtras({
      page,
      resolve,
      begin,
      seedOf,
      subApi: (sub: SketchPage, seed: number): object => {
        const made = createPageApi({ ...context, page: sub, seed, call: `${call}.flipbook()` });
        seals.push(made.seal);
        return made.api;
      },
    }),
    ...breakthroughs({ page, resolve, begin, seedOf }),
  };
  return {
    api,
    seal: () => {
      sealed = true;
      for (const sealSub of seals) sealSub();
    },
  };
}

export type PageApi = ReturnType<typeof createPageApi>['api'];

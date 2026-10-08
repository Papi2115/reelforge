/**
 * The open-vocabulary page methods (PLAN.md#13.15a): `doodle` (the drawing DSL), `spot` (tiny
 * spot-art icons), `draw` (parametric generators: animals, plants, backdrops, buildings,
 * vehicles, objects, tools, instruments, icons, effects), `person` and `crowd`, `diagram`, and the
 * film's own things: `defineFigure` / `defineProp` / `use`. Every drawing is one hand task like
 * `page.figure`: drawn by the hand (or appearing), timed after the previous mark by default.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam, type Resolver } from '../../../looks/blueprint/timing.js';
import type { AppearKind, Mark } from '../draw/marks.js';
import { rnd, seedOf as idSeed } from '../draw/math.js';
import { xformPts } from '../draw/paths.js';
import { compileDoodle, opsBox, spotDoodle, type Op } from '../vocab/compile.js';
import { drawDiagram, type DiagramHost } from '../vocab/diagrams.js';
import { drawSchema, familyOf, itemFamily, makeDrawing } from '../vocab/gen/index.js';
import { heightOf, type Group } from '../vocab/gen/family.js';
import type { SketchLibrary } from '../vocab/library.js';
import {
  mergePose,
  moodExpression,
  personLook,
  personParts,
  personPlace,
  presetPose,
  weave,
} from '../vocab/person.js';
import { fitDrawing, sequenceOps } from '../vocab/sequence.js';
import {
  parseDoodle,
  parseSpot,
  placeOptions,
  swatch,
  type DoodleSpec,
  type PlaceOptions,
} from '../vocab/spec.js';
import { addFigure, type FigureHandle, type Timed } from './api-figure.js';
import type { SketchPage } from './model.js';
import { expressionParam, PageFrame, poseParam } from './motion.js';
import * as S from './schemas.js';

export interface VocabDeps {
  readonly page: SketchPage;
  readonly resolve: Resolver;
  readonly begin: (method: string) => string;
  readonly seedOf: (own: number | undefined) => number;
  readonly startOf: (at: S.PenOptions['at']) => number;
  readonly commit: (
    marks: Mark[],
    until?: number,
    how?: {
      readonly parallel?: boolean;
      readonly hero?: boolean;
      readonly appear?: AppearKind | undefined;
    },
  ) => Timed;
  readonly fps: number;
  readonly library: SketchLibrary;
  /** The page API itself (diagrams are built from its methods). */
  readonly host: () => DiagramHost;
}

export type Box = readonly [number, number, number, number];
export interface Drawing extends Timed {
  /** Where it landed [x, y, w, h] (page px, at t = 0). */
  readonly box: Box;
}

/** Height of a held thing per figure height, by what it is. */
const HOLD_SIZE: Readonly<Record<Group, number>> = {
  tool: 0.42,
  instrument: 0.3,
  object: 0.28,
  plant: 0.36,
  icon: 0.16,
  vehicle: 0.3,
  animal: 0.26,
  structure: 0.3,
  backdrop: 0.3,
  effect: 0.2,
};

const personOptions = z.strictObject({
  ...personPlace.shape,
  ...personLook.shape,
  pose: poseParam
    .optional()
    .describe('Overrides on top of the action preset (object, keys or (t) => {})'),
  expression: expressionParam.optional().describe('Instead of mood: eyes/mouth/brow keys'),
  at: whenParam.optional(),
  until: whenParam.optional(),
  seed: z.int().min(0).optional(),
  parallel: z.boolean().default(false),
  hero: z.boolean().default(false),
  subject: z.boolean().default(true),
  fps: z.number().min(4).max(24).optional(),
});

const crowdOptions = z.strictObject({
  x0: z.number(),
  x1: z.number(),
  y: z.number().describe('Ground of the front row'),
  count: z.int().min(2).max(40).default(8),
  h: z.number().min(30).max(300).default(90),
  rows: z.int().min(1).max(3).default(1),
  colors: z
    .array(swatch)
    .min(1)
    .max(6)
    .default(['skyPencil', 'orange', 'green', 'purple', 'sticky']),
  at: whenParam.optional(),
  until: whenParam.optional(),
  speed: z.number().min(0.25).max(4).default(1.6),
  seed: z.int().min(0).optional(),
  parallel: z.boolean().default(false),
  hero: z.boolean().default(false),
  appear: z.enum(['bloom', 'pop', 'type']).optional(),
});

function unitOf(frame: PageFrame | undefined): number {
  if (!frame) return 1;
  const xf = frame.at(0);
  const [a, b] = [xf(0, 0), xf(1, 0)];
  return Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
}

function pageBox(ops: readonly Op[], frame: PageFrame | undefined): Box {
  if (!frame) return opsBox(ops);
  const xf = frame.at(0);
  return opsBox(
    ops.map((op) =>
      op.kind === 'stroke'
        ? { ...op, pts: xformPts(op.pts, xf) }
        : { ...op, poly: xformPts(op.poly, xf) },
    ),
  );
}

/** What a person holds (`holds`): a defined prop, else a tool/object/instrument type. */
export function heldDrawing(
  library: SketchLibrary,
  id: string,
  size: number | undefined,
  call: string,
): { spec: DoodleSpec; size: number } {
  if (library.hasProp(id)) {
    const entry = library.prop(id, call);
    return { spec: entry.drawing(1), size: size ?? 0.35 };
  }
  const entry = itemFamily(id);
  if (!entry) {
    throw new KitError(
      'invalid-params',
      `${call}: holds "${id}" is neither a defined prop nor a tool/object/instrument type`,
    );
  }
  const knobs = {
    type: id,
    color: undefined,
    action: undefined,
    count: undefined,
    w: undefined,
    h: undefined,
  };
  return {
    spec: makeDrawing(entry, knobs, idSeed(id), { plain: false, bold: false }, call),
    size: size ?? HOLD_SIZE[entry.group],
  };
}

export function vocabulary(deps: VocabDeps) {
  const { page, resolve, begin, library } = deps;

  const place = (
    spec: DoodleSpec,
    o: PlaceOptions,
    defaultHeight: number | undefined,
    seedFrom?: number,
  ): Drawing => {
    const frame = o.attach;
    const unit = unitOf(frame);
    const [bw, bh] = spec.box;
    const h = o.h ?? (o.w !== undefined ? (o.w * bh) / bw : (defaultHeight ?? bh));
    // Both w and h: the drawing is stretched to that box (a map frame, a field).
    const scale = o.w !== undefined && o.h !== undefined ? o.w / bw : h / bh;
    const seed = o.seed ?? seedFrom ?? deps.seedOf(undefined);
    const placement = {
      x: o.x,
      y: o.y,
      scale,
      scaleY: h / bh,
      anchor: o.anchor,
      flip: o.flip,
      rot: o.rot,
      unit,
    };
    const ops = compileDoodle(spec, placement, seed);
    const t0 = deps.startOf(o.at);
    const marks = sequenceOps(ops, {
      t0,
      seed,
      speed: o.speed,
      fps: deps.fps,
      held: o.held,
      unit,
      frame,
    });
    fitDrawing(marks, o.until === undefined ? undefined : resolve(o.until, t0));
    const timed = deps.commit(marks, undefined, {
      parallel: o.parallel,
      hero: o.hero,
      appear: o.appear,
    });
    const box = pageBox(ops, frame);
    if (o.subject) page.keepClear(box);
    return { ...timed, box };
  };

  /** Spot art at its page scale (the dab width follows the cell size on the page). */
  const placeSpot = (
    drawing: (pagePerUnit: number) => DoodleSpec,
    o: PlaceOptions,
    defaultHeight: number | undefined,
    seed?: number,
  ): Drawing => {
    const [bw, bh] = drawing(1).box;
    const h = o.h ?? (o.w !== undefined ? (o.w * bh) / bw : (defaultHeight ?? bh));
    return place(drawing((h / bh) * unitOf(o.attach)), { ...o, h }, undefined, seed);
  };

  const held = (id: string, size: number | undefined, call: string) =>
    heldDrawing(library, id, size, call);

  return {
    doodle(spec: unknown, options?: unknown): Drawing {
      const call = begin('doodle');
      const doodle = parseDoodle(spec, call);
      return place(doodle, S.parse(placeOptions, options, call), undefined);
    },
    spot(art: unknown, options?: unknown): Drawing {
      const call = begin('spot');
      const parsed = parseSpot(art, call);
      return placeSpot(
        (k) => spotDoodle(parsed, k),
        S.parse(placeOptions, options, call),
        undefined,
      );
    },
    draw(kind: unknown, options?: unknown): Drawing {
      const call = begin('draw');
      const entry = familyOf(kind, call);
      const o = S.parse(drawSchema(entry), options, `${call} ${entry.kind}`);
      const seed = deps.seedOf(o.seed);
      const knobs = {
        type: o.type,
        color: o.color,
        action: o.action,
        count: o.count,
        w: o.w,
        h: o.h,
      };
      const finishing = { plain: o.plain, bold: o.bold ?? o.hero, shade: o.shade };
      const spec = makeDrawing(entry, knobs, seed, finishing, call);
      // Backdrops are big and pale: the hand sketches them quicker than a subject.
      const speed = entry.group === 'backdrop' ? o.speed * 1.8 : o.speed;
      return place(spec, { ...o, seed, speed }, heightOf(entry, o.type));
    },
    use(id: unknown, options?: unknown): Drawing {
      const call = begin('use');
      const entry = library.prop(id, call);
      const o = S.parse(placeOptions, options, `${call}("${entry.id}")`);
      return placeSpot(entry.drawing, o, entry.height, idSeed(entry.id));
    },
    person(options: unknown): FigureHandle {
      const call = begin('person');
      const raw = (typeof options === 'object' && options !== null ? options : {}) as Record<
        string,
        unknown
      >;
      const like = raw['like'];
      const merged = like === undefined ? raw : { ...library.figure(like, call), ...raw };
      const o = S.parse(personOptions, merged, call);
      const fields = o as Record<string, unknown>;
      const look = personLook.parse(
        Object.fromEntries(Object.keys(personLook.shape).map((key) => [key, fields[key]])),
      );
      const seed = o.seed ?? (typeof like === 'string' ? idSeed(like) : deps.seedOf(undefined));
      const figure = S.parse(
        S.figureOptions,
        {
          x: o.x,
          y: o.y,
          h: o.h,
          at: o.at,
          seed,
          fps: o.fps,
          pose: mergePose(presetPose(o.action, o.face), o.pose),
          expression: moodExpression(o.mood, o.expression),
          tool: look.pen,
          belly: look.belly,
          subject: o.subject,
          parallel: o.parallel,
          hero: o.hero,
        },
        call,
      );
      const thing = look.holds === undefined ? null : held(look.holds, look.holdSize, call);
      const fps = figure.fps ?? deps.fps;
      const start = deps.startOf(figure.at);
      const until = o.until === undefined ? undefined : resolve(o.until, start);
      const figureDeps = { page, resolve, start, seed, fps, name: call, commit: deps.commit };
      return addFigure(figure, figureDeps, (sk, drawn) =>
        fitDrawing(
          weave(drawn, personParts(look, o.face, sk, seed, thing, call), seed, fps),
          until,
        ),
      );
    },
    crowd(options: unknown): Drawing {
      const call = begin('crowd');
      const o = S.parse(crowdOptions, options, call);
      const seed = deps.seedOf(o.seed);
      const parts: unknown[] = [];
      const perRow = Math.ceil(o.count / o.rows);
      for (let row = o.rows - 1; row >= 0; row -= 1) {
        const h = o.h * 0.86 ** row;
        const base = o.y - row * o.h * 0.32;
        for (let i = 0; i < perRow && row * perRow + i < o.count; i += 1) {
          const n = row * perRow + i;
          const k = (i + 0.5 + (row % 2) * 0.5) / (perRow + (row % 2) * 0.5);
          const x = o.x0 + (o.x1 - o.x0) * k + rnd(-6, 6, seed, n, 3);
          const tall = h * rnd(0.88, 1.12, seed, n, 4);
          const color = o.colors[n % o.colors.length] ?? 'skyPencil';
          parts.push({
            poly: [
              x - tall * 0.22,
              base,
              x - tall * 0.2,
              base - tall * 0.52,
              x,
              base - tall * 0.62,
              x + tall * 0.2,
              base - tall * 0.52,
              x + tall * 0.22,
              base,
            ],
            fill: color,
          });
          parts.push({ circle: [x, base - tall * 0.78, tall * 0.14] });
          if (row === 0)
            parts.push({
              dots: [x - tall * 0.05, base - tall * 0.8, x + tall * 0.05, base - tall * 0.8],
              size: 2,
            });
        }
      }
      const spec = parseDoodle({ box: [960, 540], parts }, call);
      return place(
        spec,
        S.parse(
          placeOptions,
          {
            x: 0,
            y: 0,
            anchor: 'top-left',
            h: 540,
            at: o.at,
            until: o.until,
            speed: o.speed,
            seed,
            parallel: o.parallel,
            hero: o.hero,
            appear: o.appear,
          },
          call,
        ),
        undefined,
      );
    },
    diagram(kind: unknown, spec?: unknown): Timed {
      const call = begin('diagram');
      return drawDiagram(deps.host(), kind, spec, call);
    },
    defineFigure(id: unknown, look?: unknown): void {
      library.defineFigure(id, look, 'page.defineFigure');
    },
    defineProp(id: unknown, spec?: unknown): void {
      library.defineProp(id, spec, 'page.defineProp');
    },
  };
}

/**
 * `kit.fx.sketchPage`: one page of the Sketchbook notebook as a full-frame 2D raster (index buffer
 * -> palette colours -> screen-space quad, through the same post pass as every look). The scene
 * draws on it in build() with the page methods (write, figure, arrow, ...) and calls
 * `page.update(t)` every frame; the page is repainted from scratch for each t.
 */
import { z } from 'zod';
import { emptyBounds } from '../../../env/shared.js';
import { asFx, type FxObject } from '../../../fx/shared.js';
import { anchorParam, createResolver } from '../../../looks/blueprint/timing.js';
import { hexPixel, Raster } from '../../../looks/blueprint/raster.js';
import { createQuad } from '../../../looks/whiteboard/quad.js';
import { createKitObject } from '../../../object.js';
import { defineFx, type KitTools } from '../../../registry.js';
import { InkCanvas } from '../draw/canvas.js';
import { writeMarks, strokeMark, TOOL_NAMES, type Mark } from '../draw/marks.js';
import { ellipsePts } from '../draw/paths.js';
import { STOCK_NAMES } from '../draw/paper.js';
import { INK_TABLE } from '../inks.js';
import { paintStubs } from '../traces.js';
import { KitError } from '../../../errors.js';
import { createPageApi, type PageApi } from './api.js';
import { LAYOUT_NAMES, layoutSlots, type LayoutSlots } from './layouts.js';
import { SketchPage } from './model.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { VOCAB_METHODS } from '../vocab/docs.js';
import { parseSketchAsset, SketchLibrary } from '../vocab/library.js';

const point = z.tuple([z.number(), z.number()]);

export const sketchPageParams = z.object({
  size: z
    .tuple([z.int().min(64).max(3840), z.int().min(36).max(2160)])
    .default([PAGE_WIDTH, PAGE_HEIGHT])
    .describe('Frame size: pass [ctx.shot.width, ctx.shot.height] (page coordinates stay 960x540)'),
  stock: z
    .enum(STOCK_NAMES)
    .default('cartridge')
    .describe('cartridge (blank), lined (+ printed margin), graph'),
  page: z.int().min(1).max(999).optional().describe('Page number, circled top right'),
  pageTool: z.enum(TOOL_NAMES).default('fine').describe("Pen of the page number (that page's pen)"),
  margin: z.number().min(40).max(940).optional().describe('x of a pencil-ruled margin line'),
  torn: z
    .boolean()
    .default(false)
    .describe('Stubs of a torn-out page left in the spiral (after a torn-strip transition)'),
  pen: z.boolean().default(true).describe('Show the writing hand'),
  rest: z
    .union([z.literal('off'), point])
    .default('off')
    .describe("Hand's rest spot in long pauses: 'off' the page or [x, y]"),
  restGap: z
    .number()
    .min(0.3)
    .max(10)
    .default(1.5)
    .describe('Pauses longer than this send the hand to rest'),
  duration: z
    .number()
    .min(0.5)
    .max(600)
    .optional()
    .describe(
      'Shot length (pass ctx.shot.duration, in update(t) time): the hand clears the subject for the last 0.4 s',
    ),
  boilFps: z
    .number()
    .min(8)
    .max(12)
    .default(12)
    .describe('Line boil cadence (story pages 12, proofs 8)'),
  layout: z
    .enum(LAYOUT_NAMES)
    .optional()
    .describe(
      'Look A composition preset; page.slots() gives its hero/figures/label/note/thing/ground',
    ),
  seed: z.int().min(0).optional().describe('Seed of every wobble (default: from the shot)'),
  library: z
    .array(z.unknown())
    .max(64)
    .default([])
    .describe(
      "The project's own figures and props (assets/sketchbook/<id>.json contents) for person({ like }) and use(id)",
    ),
  layer: z.int().min(0).max(9).default(0),
  anchor: anchorParam,
});

export type SketchPageObject = FxObject & PageApi & { slots(): LayoutSlots };

/** The page model behind each built page object (tests probe the hand through it). */
const MODELS = new WeakMap<object, SketchPage>();

export function sketchPageModel(object: object): SketchPage | undefined {
  return MODELS.get(object);
}

const PAGE_METHODS = {
  'update(t)': 'Repaints the page for local time t: call it every frame',
  'write(text, { x, y, size, hand, tool, color, at, until, rot, nib, speed, quick })':
    'Hand-lettered text written stroke by stroke (hand print/scrawl/marker/type); brisk by default (12 letters ~1.1 s), speed up to 2, quick: true for labels. Never draw letters with stroke()',
  'figure({ x, y, h, pose, expression, at, until })':
    'A crude stick person drawn by the hand; pose/expression = object, keys [{ at, to, ease, ... }] or (t) => {...}; returns { at, end, joint(name), carry(name), head(), jointAt(name, t) }',
  'stroke(points, { tool, at, dur, corners, attach })':
    'A free pen line (flat [x, y, ...] or [[x, y], ...])',
  'fill(points, { color, at, dur, dir, attach })':
    'Coloured-pencil hatch, slightly out of the lines',
  'arrow(points, opts) / loop(cx, cy, rx, ry, opts) / underline(x0, x1, y, opts) / ruled(x0, y0, x1, y1, opts) / crossOut(x, y, w, h, { style })':
    'Hand marks: two-stroke arrow, loose circle, hooked underline, ruler line, x/strike/zigzag cross-out',
  'sun(cx, cy, r, { rays, fill, until })': 'Sun doodle with uneven rays and an orange pencil fill',
  'sheet({ x, y, w, h, deg, at, holes, paper, envelope })':
    'A taped-in (or slapped-on at `at`) insert of paper, kraft or sticky: .print(), .rule(), .calendar({ title }) -> { cell(day) }, .tape(), .point(u, v), .frame()',
  'ruler(x, y, { at, until, length })':
    'A clear plastic ruler slid in under a line (in place at `at`, slides out at `until`)',
  'flipbook({ count, at, until })':
    'A thumb riffles the page corner through `count` pages between at and until; .page(k) = the page API of page k (write, stroke, sun, ...), drawn once, no hand',
  'popup({ intent, x, y, w, depth, at, elements, pull, camera })':
    "Breakthrough, rare (<= 1 per ~60-90 s, look C), a toolkit (invent the mechanism that shows the claim; never one twice in a film): intent = the claim the motion shows (required); elements (<= 8, id to move them): block / cutout on the fold (at = rise on a word; props rise, slide), arm { u, length, piece: 'sun'|'disc' (+label), angle }, card { u, v, w, h, text|draw, paper } (x, y, rotate, scale, show), flap { u, v, w, h, hinge, text } (open; covers the pieces listed before it), gauge { u, v, h, level, marks, label } (level), wheel { u, v, r, labels, teeth } (angle), counter { u, v, from } (value), window { u, v, w, h, items } (index), scale { u, v, w, ends, ticks } (value), tag, note; pull { at, tab: tab|ribbon|knob|lever, side: left|right|bottom, dur, ease, motions: [{ target, to: { prop: n }, from, span: [p0, p1], ease, arc, vary }], drive: (p, t) => ({ id: { prop: n } }), focus, callout: loop|trail|notch|none }: the red pen pulls, p 0-1 drives the bound pieces, then marks what moved; examples c3-c7; returns { at, open, pulled, end, notch, intent }",
  'strip({ events, highlight, y, at, until, pen, end })':
    "Breakthrough, rare (<= 1 per ~60-90 s, look B): an accordion timeline strip dragged through the view by a left hand, read panels fold into a pleat stack; events (2-8, in order): { label, note: line | [line, line], year, doodle: 'sun'|'figure'|'loop' }; highlight = red note after a held beat; returns { at, end, events: [{ at, end }] }",
  'tape / coffeeRing / clip / sticky / smudge (..., { at })':
    'Physical traces, static once they appear',
  'keepClear(x, y, w, h)':
    'A subject box the hand keeps off: it turns the wrist, glides around it, never rests on it (figures add theirs)',
  '{ hero, appear, parallel } (options of every pen mark and figure)':
    "One hand draws the key things: every stroke-drawn mark has the nib on it. The hand takes marks in time order; the hero (hero: true, default the largest text) goes first among marks timed together and waits <= 0.6 s for earlier ones; others wait for the hand (returned at/end = real times); a secondary write that would wait > 0.6 s appears by itself, whole, on time. appear: 'bloom' (ink soaks in) | 'pop' | 'type' (letter by letter) = no hand, on purpose; parallel: true = appear 'bloom'",
  'textWidth(text, size, hand) / doneAt()': 'Layout width of a text; time the last mark ends',
  ...VOCAB_METHODS,
  'slots()':
    "With layout (look A: 'hero-left' big figure + big label, 'facing' two figures, 'tall-diagram' tall figure + diagram right, 'wide-strip' three figures on one ground, 'top-down-map' a map fills the page, 'close-up' one object huge, 'landscape' sky band + ground with two things, 'two-column' two drawings with facts under each, 'big-number' a huge number + a drawing): { hero, figures, label, note, thing: [x, y, w, h], ground: [x0, y, x1], columns?, sky? }, seeded nudges; the hero (figure, map, object) >= 25 % page height",
} as const;

function pixelTable(tools: KitTools): Uint32Array {
  const table = new Uint32Array(32);
  INK_TABLE.forEach(([, swatch, hex], index) => {
    table[index] = hexPixel(tools.palette[swatch] ?? hex);
  });
  return table;
}

function paperMarks(params: z.output<typeof sketchPageParams>, seed: number): Mark[] {
  const marks: Mark[] = [];
  const old = { t0: -5, t1: -4.99, held: false };
  if (params.page !== undefined) {
    const tool = params.pageTool;
    writeMarks(marks, String(params.page), {
      x: 902,
      y: 42,
      size: 13,
      hand: 'scrawl',
      tool,
      seed,
      ...old,
    });
    const ring = ellipsePts(907, 35, 13, 11, 16, -0.2, -0.4);
    ring.push((ring[0] ?? 0) + 4, (ring[1] ?? 0) - 3);
    marks.push(strokeMark(ring, { tool, t0: -5, dur: 0.01, held: false, seed: seed + 3 }));
  }
  if (params.margin !== undefined) {
    const x = params.margin;
    marks.push(
      strokeMark([x, 24, x - 4, 512], {
        tool: 'pencil',
        t0: -5,
        dur: 0.01,
        held: false,
        smooth: false,
        seed: seed + 5,
      }),
    );
  }
  return marks;
}

function buildPage(params: z.output<typeof sketchPageParams>, tools: KitTools): SketchPageObject {
  const [width, height] = params.size;
  const seed = params.seed ?? Math.floor(tools.rng() * 2_147_483_647);
  const call = 'kit.fx.sketchPage()';
  const page = new SketchPage({
    width,
    height,
    stock: params.stock,
    pen: params.pen,
    rest: params.rest === 'off' ? null : params.rest,
    restGap: params.restGap,
    duration: params.duration,
  });
  page.addMarks(paperMarks(params, seed % 100_000));
  if (params.torn) {
    page.addLayer({
      key: Number.NEGATIVE_INFINITY,
      from: Number.NEGATIVE_INFINITY,
      draw: (canvas) => {
        paintStubs(canvas, page.toScreen, seed % 1000);
        return null;
      },
    });
  }
  const library = new SketchLibrary();
  params.library.forEach((asset, index) => {
    library.define(parseSketchAsset(asset), `${call} library[${String(index)}]`);
  });
  const { api, seal } = createPageApi({
    page,
    seed,
    resolve: createResolver(params.anchor, call),
    fps: params.boilFps,
    call,
    library,
  });
  const canvas = new InkCanvas(width, height);
  const raster = new Raster(width, height);
  const pixels = new Uint32Array(raster.data.buffer);
  const colors = pixelTable(tools);
  const { mesh, texture } = createQuad(tools, raster, {
    region: [0, 0, 1, 1],
    layer: params.layer,
  });
  mesh.name = 'sketchPage';
  const object = createKitObject(tools.three, {
    kitType: 'sketchPage',
    bounds: emptyBounds(tools),
  });
  object.add(mesh);
  let building = true;
  const fx = asFx(object, (t) => {
    if (!building) seal();
    page.render(canvas, t);
    const { data } = canvas;
    for (let i = 0; i < data.length; i += 1) pixels[i] = colors[data[i] ?? 0] ?? 0;
    texture.needsUpdate = true;
  });
  building = false;
  const slots = (): LayoutSlots => {
    if (params.layout === undefined) {
      throw new KitError(
        'invalid-params',
        `${call}.slots(): pass layout (${LAYOUT_NAMES.join(', ')}) to kit.fx.sketchPage`,
      );
    }
    return layoutSlots(params.layout, seed);
  };
  const built = Object.assign(fx, api, { slots });
  MODELS.set(built, page);
  return built;
}

export const sketchPage = defineFx({
  name: 'sketchPage',
  description:
    'A Sketchbook notebook page (world sketchbook): cartridge, lined or graph paper with the spiral binding; a visible hand draws hand-lettered text, crude stick figures, arrows, loops and pencil fills with line boil. Full-frame 2D page: build it once, scene.add(page) in build() (a page never added renders a blank frame), draw on it in build(), call update(t) every frame.',
  params: sketchPageParams,
  methods: PAGE_METHODS,
  build: buildPage,
});

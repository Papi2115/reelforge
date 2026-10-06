/**
 * `kit.fx.sketchPage`: one page of the Sketchbook notebook as a full-frame 2D raster (index buffer
 * -> palette colours -> screen-space quad, through the same post pass as every look). The scene
 * draws on it in build() with the page methods (write, figure, arrow, ...) and calls
 * `page.update(t)` every frame; the page is repainted from scratch for each t.
 */
import { z } from 'zod';
import { emptyBounds } from '../../../../env/shared.js';
import { asFx, type FxObject } from '../../../../fx/shared.js';
import { anchorParam, createResolver } from '../../../../looks/blueprint/timing.js';
import { hexPixel, Raster } from '../../../../looks/blueprint/raster.js';
import { createQuad } from '../../../../looks/whiteboard/quad.js';
import { createKitObject } from '../../../../object.js';
import { defineFx, type KitTools } from '../../../../registry.js';
import { InkCanvas } from '../../draw/canvas.js';
import { writeMarks, strokeMark, TOOL_NAMES, type Mark } from '../../draw/marks.js';
import { ellipsePts } from '../../draw/paths.js';
import { STOCK_NAMES } from '../../draw/paper.js';
import { INK_TABLE } from '../../inks.js';
import { createPageApi, type PageApi } from '../../page/api.js';
import { SketchPage } from '../../page/model.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../../style.js';

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
  boilFps: z
    .number()
    .min(8)
    .max(12)
    .default(12)
    .describe('Line boil cadence (story pages 12, proofs 8)'),
  seed: z.int().min(0).optional().describe('Seed of every wobble (default: from the shot)'),
  layer: z.int().min(0).max(9).default(0),
  anchor: anchorParam,
});

export type SketchPageObject = FxObject & PageApi;

const PAGE_METHODS = {
  'update(t)': 'Repaints the page for local time t: call it every frame',
  'write(text, { x, y, size, hand, tool, color, at, until, rot })':
    'Hand-lettered text written stroke by stroke (hand print/scrawl/marker/type)',
  'figure({ x, y, h, pose, expression, at, until })':
    'A crude stick person drawn by the hand; pose/expression = object, keys [{ at, to, ease, ... }] or (t) => {...}; returns { at, end, joint(name), carry(name), head(), jointAt(name, t) }',
  'stroke(points, { tool, at, dur, corners, attach })':
    'A free pen line (flat [x, y, ...] or [[x, y], ...])',
  'fill(points, { color, at, dur, dir, attach })':
    'Coloured-pencil hatch, slightly out of the lines',
  'arrow(points, opts) / loop(cx, cy, rx, ry, opts) / underline(x0, x1, y, opts) / ruled(x0, y0, x1, y1, opts) / crossOut(x, y, w, h, { style })':
    'Hand marks: two-stroke arrow, loose circle, hooked underline, ruler line, x/strike/zigzag cross-out',
  'sun(cx, cy, r, { rays, fill, until })': 'Sun doodle with uneven rays and an orange pencil fill',
  'sheet({ x, y, w, h, deg, at, holes })':
    'A taped-in (or slapped-on at `at`) paper insert: .print(), .rule(), .calendar({ title }) -> { cell(day) }, .tape(), .frame()',
  'tape / coffeeRing / clip / sticky / smudge (..., { at })':
    'Physical traces, static once they appear',
  'keepClear(x, y, w, h)':
    'A subject box the hand keeps off while writing nearby (figures add theirs)',
  'textWidth(text, size, hand) / doneAt()': 'Layout width of a text; time the last mark ends',
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
  });
  page.addMarks(paperMarks(params, seed % 100_000));
  const { api, seal } = createPageApi({
    page,
    seed,
    resolve: createResolver(params.anchor, call),
    fps: params.boilFps,
    call,
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
  return Object.assign(fx, api);
}

export const sketchPage = defineFx({
  name: 'sketchPage',
  description:
    'A Sketchbook notebook page (world sketchbook): cartridge, lined or graph paper with the spiral binding; a visible hand draws hand-lettered text, crude stick figures, arrows, loops and pencil fills with line boil. Full-frame 2D page: build it once, draw on it in build(), call update(t) every frame.',
  params: sketchPageParams,
  methods: PAGE_METHODS,
  build: buildPage,
});

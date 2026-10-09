/**
 * `kit.fx.comicPage`: one printed comic page per shot as a full-frame index raster (640x360; a
 * portrait short's frame is taller than wide and gets a 360x640 page, PLAN.md#13.18)
 * (palette indices -> palette colours -> screen-space quad, through the same post pass as every
 * look; ADR-032). The scene lays out panels and lettering in build(), paints each panel's content
 * with a pure painter `(g, t) => ...`, and calls `page.update(t)` every frame; the page is
 * repainted from scratch for each t.
 */
import { z } from 'zod';
import { emptyBounds } from '../../../env/shared.js';
import { asFx, type FxObject } from '../../../fx/shared.js';
import { anchorParam, createResolver } from '../../../looks/blueprint/timing.js';
import { hexPixel, Raster } from '../../../looks/blueprint/raster.js';
import { createQuad } from '../../../looks/whiteboard/quad.js';
import { createKitObject } from '../../../object.js';
import { createArt } from '../art/api.js';
import { defineFx, type KitTools } from '../../../registry.js';
import { createPanelBreak } from '../breakthrough/break.js';
import { createFlashback } from '../breakthrough/flashback.js';
import { createSpread } from '../breakthrough/spread.js';
import { ComicCanvas } from '../draw/canvas.js';
import { INK_TABLE } from '../inks.js';
import { isPortraitPage, pageSafeBox, pageSizeFor } from '../style.js';
import { createStructureApi } from './api.js';
import { createFlowApi } from './flow.js';
import { createLetteringApi } from './api-lettering.js';
import { ComicPageModel } from './model.js';
import { misFor } from './panel.js';

export const comicPageParams = z.object({
  seed: z
    .int()
    .min(0)
    .optional()
    .describe('Seed of gutters, plate offsets, paper and wobble (default: from the shot)'),
  layer: z.int().min(0).max(9).default(0),
  anchor: anchorParam,
  duration: z
    .number()
    .positive()
    .optional()
    .describe('The shot length (ctx.shot.duration): a spread holds until it'),
});

const PAGE_METHODS = {
  'update(t)': 'Repaints the page for local time t: call it every frame',
  'size / format / safe':
    "page.size = [w, h] in page px = the frame: [640, 360], or [360, 640] when ctx.shot.format is 'portrait'; page.format; page.safe = [x, y, w, h] where key content goes (portrait: the central 80 % of the width, below the top 12 %, above the bottom 20 %; landscape: the whole page)",
  portrait:
    "A portrait short (9:16) gets a 360x640 page, read like a webtoon on a phone: stack panels DOWN the page. Presets: 'splash' = one tall panel (a hero, a fall, a tower); '2-stack' / '3-stack' = panels stacked (2-3 beats in reading order); 'splash-strip' = a tall splash over two small panels (the claim, then two details); 'stagger' = three offset panels zig-zagging down (a sequence, a journey); the landscape presets are stood upright (columns become rows: '2-up' = 2 stacked, 'strip' = 3, '3-up-l' = a wide panel over two). page.flow reads 'down' by default (the camera brings each panel's foot to 80 % of the frame); 'across' is a band at mid-height. Balloons and captions letter at size 2 with ~14 letters a line (<= 6 words a balloon) and stay in page.safe; keep sound words and the focal subject inside it too. Spreads become a tall splash (no spine unless fold 140-220 is given); flashback boxes default to the safe middle",
  'panels(layout, { weights, mirror, gutter, seed })':
    "Panels from a preset with hand-ruled uneven gutters: 'splash', '2-up', 'strip' (3 columns), '3-up-l' (tall + 2 stacked), '4-grid' (2x2, rows offset), '4-l' (tall + wide + 2 small), 'splash-inset' (inset breaks the frame), '2-stack' / '3-stack' (rows), 'splash-strip' (a splash over 2 small), 'stagger' (3 offset rows); weights = split fractions (panel size = importance); returns panel handles",
  'panel(quad | (t) => quad, { border, boil, pencils, mis, z })':
    'A custom panel: 4 corners [x0, y0, ..., x3, y3] in page px (page.size: 640x360, portrait 360x640), clockwise from top left; a function of t for gutters that move',
  'panel.draw((g, t) => ...)':
    "Paints the panel's content, clipped to it; t = the panel's clock. g: plate = colour plate out of register (fills), g itself = key plate (ink): poly, rect, ellipse, line, polyline, ink(pts, { closed, w, boil }) boiled ink line, strokeOn, clip(pts, fn), blob(parts, fill) one-outline silhouette, tone(ink, level | (lx, ly) => level, { cell, angle, on }) halftone, dither(a, b, level), pencil(), layer(...), local(fn), speedLines({ x, y, dx, dy, gap }), trail(pts), text(str, x, y, { scale, bold, reveal, slant }), bigLetter(ch, x, y, { size }), standing(text, { x, y0, y1, h0, h1 }) block letters standing in the ground, ground, digits, at(x, y, k), rnd(key, i)",
  'panel.enter({ at, kind, from, dur, rough }) / panel.exit(at)':
    "Entrance: 'cut' | 'slam' (scale 1.14 -> 1 with overshoot) | 'slide' (from a side) | 'pop'; rough: true shows its pencil layout before (panel.rough(fn) adds pencil strokes); exit = until",
  'panel.morph(quad, { at, dur, ease }) / panel.camera([{ at, x, y, zoom, ease }]) / panel.clock({ offset, rate, hold })':
    'Gutters that close; the camera inside the panel (content point x, y at its centre); its own time (offset, slow-motion, hold = freeze)',
  'panel.point(u, v, t) / panel.toPage(x, y, t) / panel.box':
    'Page point inside the quad (0..1); a content point in page px (aim a balloon tail); [x, y, w, h]',
  'camera([{ at, x, y, zoom, ease }]) / shake(at, amp, decay) / press({ at, step, order })':
    'The page camera reading the page like an eye (x, y = page point at the frame centre); a camera hit; the press intro (plates Y, C, M, K land one by one)',
  "balloon(text, { x, y, at, until, kind: 'speech' | 'radio' | 'thought', tail: [x, y] | (t) => [x, y], dots, width })":
    "Speech balloon centred at x, y (page px) popping in at `at`; tail tip at the speaker's mouth ('radio' = lightning tail), thought = cloud with dots toward the head; text wraps at width",
  "caption(text, { x, y, at, tilt, fill: 'yellowPale', type }) / sfx(word, { x, y, at, size, beats, angles, rise, fill, shade })":
    'Caption box (top left at x, y; type = seconds to letter it in); onomatopoeia: big imperfect letters slammed in on uneven beats, centred at x, y, may break the panel frame',
  "stamp(text, { x, y, at, angle, color: 'red', size, wear, inner })":
    'A rubber stamp slammed on the page (worn frame + letters, dropouts where the rubber missed, a small page hit): a code, a date, a verdict',
  "flashback({ intent, when, at, until, cover: 'page' | 'strip', arrange: 'rows' | 'row' | 'stair' | 'pile', box, tilt, enter, beats: [{ at, draw: (g, t, [w, h]) => ..., weight, caption, enter }], stamp: { text, at, x, y } })":
    'Breakthrough: the past as an older sepia print job (palette remap, coarser screen); 1-5 narrated beats revealed panel by panel, the time-stamp caption `when` lettered in; cover page = the whole page re-inked, strip = a torn strip pasted over the present (cover and arrange required, no defaults); type = seconds to letter the captions in (0 = at once); intent (required) = the claim; returns { panels, at, end, until, box }',
  "spread({ intent, art, at, until, assemble: 'merge' | 'unfold' | 'pull-back', pieces: 'grid' | 'columns' | 'halves', delay, dur, focus, fold, insets: [{ box, at, until, draw, kind }], beats })":
    'Breakthrough: a double-page spread, one picture `art` (g, t) across both pages and the fold; merge = panels that turn out to be one picture, unfold = the book opens from the spine, pull-back = a small panel on `focus` whose camera pulls back (assemble required; merge needs pieces); <= 3 insets after it is whole; holds <= 4 s between beats (beats = narration landing); intent required; returns { at, assembled, until, insets }',
  "flow({ intent, direction: 'across' | 'down' | 'diagonal', beats: [{ at, weight, draw: (g, t, [w, h]) => ... }], breadth, gutter, travel, camera: 'read' | 'still', reveal: 'page' | 'beats', seed })":
    'Page flow: 2-5 panels as a strip that runs ACROSS (a long band read sideways), DOWN (a tall narrow column read downward) or DIAGONAL (a stair), longer than the page if it must; the page camera reads it (hold, travel to the next panel just before its beat, hold); panel length = weight; intent (required) = why the page reads this way; vary the direction page to page; returns { panels, boxes } (page px, for captions)',
  'thread({ intent, through: [panel, panel, panel], draw: (g, t) => ..., at, until })':
    'Continuity on the page: one element (a rope, a road, a river, a colour band, a gesture, a thing in flight) drawn in page px OVER 3-5 panels and the gutters between them, carried from panel to panel; intent (required) = what the carried thing means',
  "panelBreak({ intent, at, until, print: 'present' | 'past', when, type, fold, gutters: { kind: 'keep' | 'close' | 'lift' | 'tear', at, dur }, panels: [{ id, box: [x, y, w, h] | quad, shape: 'rect' | 'lean' | 'wedge' | 'shard', lean, draw: (g, t, [w, h]) => ..., at, until, enter: 'cut' | 'slide' | 'slam' | 'pop' | 'drop' | 'swing' | 'grow' | 'unroll', from, dur, border, camera: [{ at, x, y, zoom }] }], moves: [{ target: id | [ids], at, dur, ease, lag, to: { x, y, rotate, scale, box, border } }], drive: (t) => ({ id: { x, y, rotate, scale } }) })":
    'Breakthrough toolkit: INVENT the mechanism whose motion shows the claim (intent, required). 1-5 panels you shape and place (panel-local painters, 0,0 = its top-left); how each arrives (swing on a hinge side, grow from a side, unroll, drop...); moves on the narration beats (x, y = px from its rest place, rotate <= 12 deg, scale, a new box to rearrange or grow to the bleed; several targets with lag = one panel pulls the others after it) or a pure drive(t); gutters close (borders melt into one picture), lift (panels come off the page as loose pieces), tear; the camera inside a panel; print past = the older sepia job of a look back; fold = a spine crease. Needs moves or drive; never the same mechanism twice in a film; returns { at, until, panels: { id: panel } }',
  'note(text, { x, y, at, dur }) / arrow(from, to, opts) / loop(x, y, rx, ry, opts) / tick / strike / highlight':
    'Pencil margin note written letter by letter; two-stroke arrow, loop, tick, strike-through, highlighter (opts { at, dur, color, w })',
  'thumbprint(x, y) / smudge(x, y, { length, angle }) / coffeeRing(x, y, r)':
    'Human traces of the printed page',
  'draw((g, t) => ..., { at, until, over, z })':
    'Free drawing in page coordinates (over or under the panels, or among them by z = panel order)',
  util: 'Pure helpers: seg(t, a, b, ease), track([[t, v, ease], ...], t), lerp, clamp01, pop(t, at, dur), rnd(key, i), range(key, i, a, b), torn(x0, y0, x1, y1, key) = points of a torn cutaway opening',
  'art.<generator>(g, { x, y, size, flip, seed, ... })':
    "OPEN VOCABULARY - draw what YOUR narration names in the comic grammar (never the showcase's Apollo props): person (pose stand/walk/run/point/hold/slump/look-up/wave/sit, expression neutral/happy/sad/angry/surprised/scared, build, skin, hair, hat, outfit, top, bottom, tool), crowd, animal (species deer/horse/dog/wolf/fox/cat/lion/bear/cow/camel/sheep/pig/rabbit, pose), bird, fish (also shark/whale/jellyfish/crab/octopus), insect, reptile, tree, bush, grass, flowers, cactus, seaweed, sky, land, hills, sea, dunes, forest, skyline, interior (room/module/stone/wood), space, backdrop (preset forest/meadow/mountains/ocean/underwater/desert/city/village/room/station/space/night, box), building, vehicle, object (skull, key, barrel, book, clock, ... by defining features), icon, chart (values from the narration), map, sign, effect (impact/sweat/rain/fire/...); x, y = where it stands (fish, insects, flying birds, icons, effects: centre); a bad option lists the valid ones",
  'art.shape(g, parts, { x, y, scale, flip }) / art.sprite(g, { rows, legend, px }, place)':
    "New things from JSON in the ink style: parts { shape: 'ellipse'|'rect'|'poly'|'capsule'|'line'|'dots'|'sprite'|'use'|'gen', fill, shade, hatch, outline, wobble } (model units, 0,0 = where it stands, up = -y); sprite rows of characters with a legend onto the inks",
  'art.defineProp/defineCharacter/defineBackdrop(id, spec) / art.draw(g, id, { x, y, size, flip, ...knobs }) / art.load(assetFile)':
    "Name the film's own things once (spec = { parts } | { sprite } | { gen: 'person', hat: 'brim', ... } | { layers: [{ gen: 'sky', ... }] }) and draw them in every panel; load = a project file assets/comic/*.json { version: 1, world: 'comic', props, characters, backdrops }",
  'layout(beats, { backdrop }) / audit({ until })':
    'Panels from beats [{ at, weight, draw, backdrop }]: the preset is chosen by count and importance (art.suggestLayout(weights) explains it), each panel enters on its beat WITH its establishing backdrop (never an empty ruled panel); audit lists panels empty for > 0.6 s',
} as const;

function pixelTable(tools: KitTools): Uint32Array {
  const table = new Uint32Array(32);
  INK_TABLE.forEach(([, swatch, hex], index) => {
    table[index] = hexPixel(tools.palette[swatch] ?? hex);
  });
  return table;
}

export type ComicPageObject = FxObject &
  ReturnType<typeof createStructureApi> &
  ReturnType<typeof createLetteringApi> &
  ReturnType<typeof createArt> & {
    readonly size: readonly [number, number];
    readonly format: 'landscape' | 'portrait';
    readonly safe: readonly [number, number, number, number];
    readonly flashback: ReturnType<typeof createFlashback>;
    readonly spread: ReturnType<typeof createSpread>;
    readonly panelBreak: ReturnType<typeof createPanelBreak>;
  } & ReturnType<typeof createFlowApi>;

function buildPage(params: z.output<typeof comicPageParams>, tools: KitTools): ComicPageObject {
  const seed = params.seed ?? Math.floor(tools.rng() * 2_147_483_647) % 100_000;
  const call = 'kit.fx.comicPage()';
  const pageSize = pageSizeFor(tools.frame);
  const { width, height } = pageSize;
  const model = new ComicPageModel(seed, misFor(`page${String(seed)}`), pageSize);
  const resolve = createResolver(params.anchor, call);
  const ctx = { model, resolve, call, seed, duration: params.duration };
  const canvas = new ComicCanvas(width, height);
  const raster = new Raster(width, height);
  const pixels = new Uint32Array(raster.data.buffer);
  const colors = pixelTable(tools);
  const { mesh, texture } = createQuad(tools, raster, {
    region: [0, 0, 1, 1],
    layer: params.layer,
  });
  mesh.name = 'comicPage';
  const object = createKitObject(tools.three, { kitType: 'comicPage', bounds: emptyBounds(tools) });
  object.add(mesh);
  let building = true;
  let checked = false;
  const fx = asFx(object, (t) => {
    if (!building && !checked) {
      model.validate(call);
      checked = true;
    }
    model.render(canvas, t);
    const { data } = canvas;
    for (let i = 0; i < data.length; i += 1) pixels[i] = colors[data[i] ?? 0] ?? 0;
    texture.needsUpdate = true;
  });
  building = false;
  const size = [width, height] as const;
  const format = isPortraitPage(pageSize) ? ('portrait' as const) : ('landscape' as const);
  const safe = pageSafeBox(pageSize);
  const lettering = createLetteringApi(ctx);
  const breakthroughs = {
    flashback: createFlashback(ctx, lettering),
    spread: createSpread(ctx),
    panelBreak: createPanelBreak(ctx, lettering),
  };
  const structure = createStructureApi(ctx);
  const open = createArt(ctx, (layout, options) => structure.panels(layout, options));
  const flow = createFlowApi(ctx);
  return Object.assign(fx, {
    ...structure,
    ...lettering,
    ...breakthroughs,
    ...open,
    ...flow,
    size,
    format,
    safe,
  });
}

export const comicPage = defineFx({
  name: 'comicPage',
  description:
    'A printed comic page (world comic): uneven hand-ruled panels on newsprint, each painted with its own clock and camera; ink line art over colour plates printed out of register, halftone screens, speech balloons with tails, captions, onomatopoeia. Full-frame 2D page: build it once, lay it out in build(), call update(t) every frame.',
  params: comicPageParams,
  methods: PAGE_METHODS,
  build: buildPage,
});

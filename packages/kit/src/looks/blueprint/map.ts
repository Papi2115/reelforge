/**
 * `kit.fx.blueprintMap`: a world map on the blueprint sheet from embedded Natural Earth data.
 * Land is rasterised into a country mask, so coastlines, borders and region highlights are
 * crisp 1-px edges at any zoom; views ease between view boxes on cue; markers ping in with
 * labels; routes arc between places and draw themselves with a travelling head.
 */
import { z } from 'zod';
import { boardParams, defineBoard, type BoardContext, type Painter } from './board.js';
import {
  blendView,
  findRegion,
  MAP_VIEWS,
  projection,
  worldCountries,
  type Region,
  type ViewBox,
} from './geo.js';
import type { Area } from './paper.js';
import { bayerOn, polygonSpans, type Point, type Raster, type Snapshot } from './raster.js';
import { drawText, textBox } from './text.js';
import { easeInOutCubic, easeOutCubic, ramp, whenParam } from './timing.js';
import { pointAlong } from './graph-layout.js';
import { paintFrame, routePoints } from './map-parts.js';

const lonLat = z
  .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .describe('[lon, lat] in degrees');
const viewParam = z
  .union([
    z.enum(Object.keys(MAP_VIEWS) as [keyof typeof MAP_VIEWS, ...(keyof typeof MAP_VIEWS)[]]),
    z
      .tuple([z.number(), z.number(), z.number(), z.number()])
      .describe('[west, south, east, north]'),
  ])
  .describe(
    'world, europe, africa, asia, middle-east, north-america, south-america, oceania, or a box',
  );

const mapParams = z.object({
  view: viewParam.default('world'),
  views: z
    .array(z.object({ at: whenParam, view: viewParam }))
    .max(6)
    .default([])
    .describe('Zoom/pan to another view on cue (1 s ease)'),
  markers: z
    .array(
      z.object({
        id: z.string().optional().describe('Name routes can refer to'),
        at: whenParam,
        position: lonLat,
        label: z.string().max(20).default(''),
        color: z.string().default('hot'),
      }),
    )
    .max(16)
    .default([]),
  routes: z
    .array(
      z.object({
        from: z.union([lonLat, z.string()]).describe('[lon, lat] or a marker id'),
        to: z.union([lonLat, z.string()]),
        via: z.array(lonLat).max(8).default([]).describe('Waypoints (no arc when given)'),
        at: whenParam,
        duration: z.number().positive().default(1.5),
        arc: z
          .number()
          .min(0)
          .max(0.6)
          .default(0.18)
          .describe('Bulge of a two-point route (share of its length)'),
        dashed: z.boolean().default(true),
        color: z.string().default('accent'),
      }),
    )
    .max(12)
    .default([]),
  highlights: z
    .array(
      z.object({
        region: z.string().describe("'FRA', 'France' or a continent like 'europe'"),
        at: whenParam,
        color: z.string().default('accent'),
      }),
    )
    .max(12)
    .default([]),
  borders: z.boolean().default(false).describe('Dotted country borders'),
  graticule: z.boolean().default(true).describe('Latitude/longitude lines and edge degrees'),
});

type MapParams = z.output<typeof mapParams>;

const VIEW_TIME = 1;
const PING_TIME = 0.35;

function viewBox(view: MapParams['view']): ViewBox {
  return typeof view === 'string' ? MAP_VIEWS[view] : view;
}

interface MaskCache {
  readonly key: string;
  readonly mask: Uint16Array;
  readonly base: Snapshot;
}

/** Country index + 1 per pixel of the map rectangle (0 = water). */
function countryMask(
  width: number,
  height: number,
  project: (lon: number, lat: number) => [number, number],
  rect: Area,
): Uint16Array {
  const mask = new Uint16Array(width * height);
  const clip = { x0: rect.x, y0: rect.y, x1: rect.x + rect.width, y1: rect.y + rect.height };
  worldCountries().forEach((country, index) => {
    const [west, south, east, north] = country.bounds;
    const [x0, y0] = project(west, north);
    const [x1, y1] = project(east, south);
    if (x1 < clip.x0 || x0 > clip.x1 || y1 < clip.y0 || y0 > clip.y1) return;
    for (const ring of country.rings) {
      const points = ring.map(([lon, lat]) => project(lon, lat));
      polygonSpans([points], clip, (row, from, to) => {
        mask.fill(index + 1, row * width + from, row * width + to + 1);
      });
    }
  });
  return mask;
}

function setupMap(params: MapParams, context: BoardContext): Painter {
  const { theme } = context;
  const views = params.views.map((entry) => ({
    at: context.resolve(entry.at, 0),
    box: viewBox(entry.view),
  }));
  const markers = params.markers.map((marker) => ({ ...marker, t: context.resolve(marker.at, 0) }));
  const ids = new Map(
    markers.flatMap((marker) =>
      marker.id === undefined ? [] : [[marker.id, marker.position] as const],
    ),
  );
  const routes = params.routes.map((route) => ({
    ...route,
    t: context.resolve(route.at, 0),
    path: routePoints(route, ids),
  }));
  const highlights = params.highlights.map((entry) => ({
    region: findRegion(entry.region),
    t: context.resolve(entry.at, 0),
    color: theme.color(entry.color),
  }));
  let cache: MaskCache | undefined;
  return (raster, t, area) => {
    let box = viewBox(params.view);
    for (const view of [...views].sort((a, b) => a.at - b.at)) {
      const k = easeInOutCubic(ramp(t, view.at, VIEW_TIME));
      if (k <= 0) break;
      box = blendView(box, view.box, k);
    }
    const margin = params.graticule ? context.px(16) : 0;
    const rect = {
      x: area.x + margin + (params.graticule ? context.px(10) : 0),
      y: area.y,
      width: area.width - margin - (params.graticule ? context.px(10) : 0),
      height: area.height - margin,
    };
    const proj = projection(box, rect);
    const key = `${box.join(',')}|${String(rect.x)},${String(rect.y)},${String(rect.width)},${String(rect.height)}`;
    if (cache?.key !== key) {
      // Water, graticule and land only change with the view: painted once per view, then copied.
      const mask = countryMask(raster.width, raster.height, proj.project, rect);
      raster.rect(rect.x, rect.y, rect.width, rect.height, theme.deep);
      if (params.graticule) paintFrame(raster, context, proj, box, rect, 'lines');
      paintLand(raster, context, mask, rect, params.borders);
      cache = { key, mask, base: raster.snapshot(rect.x, rect.y, rect.width, rect.height) };
    } else {
      raster.restore(cache.base);
    }
    const mask = cache.mask;
    if (params.graticule) paintFrame(raster, context, proj, box, rect, 'labels');
    for (const highlight of highlights)
      paintHighlight(raster, mask, rect, highlight, t, proj.longitude);
    raster.frame(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2, theme.ink);
    raster.clipped(rect.x, rect.y, rect.width, rect.height, () => {
      for (const route of routes) {
        const k = easeInOutCubic(ramp(t, route.t, route.duration));
        if (k <= 0) continue;
        const points = route.path.map(([lon, lat]) => proj.project(lon, lat));
        const color = theme.color(route.color);
        raster.polyline(points, color, {
          progress: k,
          width: context.px(2),
          ...(route.dashed ? { dash: [context.px(5), context.px(3)] as const } : {}),
        });
        const head = pointAlong(points, k);
        if (k < 1) raster.dot(head[0], head[1], context.px(5) | 1, theme.hot);
      }
      paintMarkers(raster, context, markers, proj.project, t);
    });
  };
}

function paintLand(
  raster: Raster,
  context: BoardContext,
  mask: Uint16Array,
  rect: Area,
  borders: boolean,
): void {
  const { theme } = context;
  const width = raster.width;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const here = mask[y * width + x] ?? 0;
      if (here === 0) continue;
      const left = x > rect.x ? (mask[y * width + x - 1] ?? 0) : here;
      const right = x + 1 < rect.x + rect.width ? (mask[y * width + x + 1] ?? 0) : here;
      const up = y > rect.y ? (mask[(y - 1) * width + x] ?? 0) : here;
      const down = y + 1 < rect.y + rect.height ? (mask[(y + 1) * width + x] ?? 0) : here;
      if (left === 0 || right === 0 || up === 0 || down === 0) raster.set(x, y, theme.ink);
      else if (borders && (right !== here || down !== here) && ((x + y) & 1) === 0)
        raster.set(x, y, theme.dim);
      else raster.set(x, y, x % 3 === 0 && y % 3 === 0 ? theme.grid : theme.paper);
    }
  }
}

function paintHighlight(
  raster: Raster,
  mask: Uint16Array,
  rect: Area,
  highlight: { readonly region: Region; readonly t: number; readonly color: number },
  t: number,
  longitude: (x: number) => number,
): void {
  const k = easeOutCubic(ramp(t, highlight.t, 0.5));
  if (k <= 0) return;
  const members = new Set(highlight.region.countries.map((index) => index + 1));
  const width = raster.width;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const here = mask[y * width + x] ?? 0;
      if (!members.has(here) || longitude(x) > highlight.region.eastLimit) continue;
      if (!bayerOn(x, y, k)) continue;
      const edge =
        !members.has(mask[y * width + x - 1] ?? 0) ||
        !members.has(mask[y * width + x + 1] ?? 0) ||
        !members.has(mask[(y - 1) * width + x] ?? 0) ||
        !members.has(mask[(y + 1) * width + x] ?? 0);
      if (edge || ((x + y) & 1) === 0) raster.set(x, y, highlight.color);
    }
  }
}

function paintMarkers(
  raster: Raster,
  context: BoardContext,
  markers: readonly (MapParams['markers'][number] & { readonly t: number })[],
  project: (lon: number, lat: number) => [number, number],
  t: number,
): void {
  const { theme } = context;
  const taken: { x: number; y: number; width: number; height: number }[] = [];
  for (const marker of markers) {
    const k = ramp(t, marker.t, PING_TIME);
    if (k <= 0) continue;
    const [x, y] = project(marker.position[0], marker.position[1]);
    const color = theme.color(marker.color);
    const ring = Math.round(context.px(4) + (1 - easeOutCubic(k)) * context.px(14));
    raster.circle(x, y, ring, color);
    raster.dot(x, y, context.px(3) | 1, color);
    if (marker.label.length === 0 || k < 1) continue;
    const scale = context.textScale(2);
    const toLeft = x > raster.width * 0.72;
    const anchor: Point = [x + (toLeft ? -1 : 1) * context.px(12), y - context.px(10)];
    let box = textBox([marker.label], anchor[0], anchor[1], {
      scale,
      color: theme.ink,
      align: toLeft ? 'right' : 'left',
      valign: 'middle',
    });
    let shift = 0;
    const pad = context.px(3);
    while (
      taken.some(
        (other) =>
          box.x - pad < other.x + other.width &&
          box.x + box.width + pad > other.x &&
          box.y - pad < other.y + other.height &&
          box.y + box.height + pad > other.y,
      )
    ) {
      shift += box.height + pad * 2;
      box = { ...box, y: box.y + box.height + pad * 2 };
    }
    taken.push(box);
    const labelY = anchor[1] + shift;
    raster.line(x, y, anchor[0] - (toLeft ? -1 : 1) * context.px(2), labelY, color);
    drawText(raster, [marker.label], anchor[0], labelY, {
      scale,
      color: theme.ink,
      align: toLeft ? 'right' : 'left',
      valign: 'middle',
      plate: theme.deep,
      pad,
    });
  }
}

export const blueprintMap = defineBoard({
  name: 'blueprintMap',
  description:
    "Blueprint world map from embedded Natural Earth data: view 'world'/continent/box with `views` zooming on cue, markers ({ position: [lon, lat], label, at }) ping in with labels, routes arc between places or marker ids and draw themselves, highlights fill a country ('FRA'/'France') or continent on a phrase. Full-frame 2D board: call update(t) every frame.",
  params: mapParams.extend(boardParams),
  setup: (params, context) => setupMap(params, context),
});

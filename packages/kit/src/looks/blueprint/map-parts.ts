/** Pieces of the blueprint map: graticule with edge degrees, and route paths (arcs, waypoints). */
import { KitError } from '../../errors.js';
import type { BoardContext } from './board.js';
import type { LonLat, Projection, ViewBox } from './geo.js';
import type { Area } from './paper.js';
import type { Raster } from './raster.js';
import { drawText } from './text.js';

const GRATICULE_STEPS = [5, 10, 15, 30, 45, 60] as const;

/** Graticule step (degrees) giving about `lines` lines over `span` degrees. */
export function graticuleStep(span: number, lines = 6): number {
  return GRATICULE_STEPS.find((step) => span / step <= lines) ?? 60;
}

function degrees(value: number, positive: string, negative: string): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '0';
  return `${String(Math.abs(rounded))}${rounded > 0 ? positive : negative}`;
}

/** Dotted latitude/longitude lines inside the map, or their degrees along the left/bottom edge. */
export function paintFrame(
  raster: Raster,
  context: BoardContext,
  proj: Projection,
  box: ViewBox,
  rect: Area,
  part: 'lines' | 'labels',
): void {
  const { theme } = context;
  const west = proj.longitude(rect.x);
  const east = proj.longitude(rect.x + rect.width);
  const step = graticuleStep(east - west);
  const scale = context.textScale(1);
  const bottom = rect.y + rect.height;
  for (let lon = Math.ceil(west / step) * step; lon <= east; lon += step) {
    const [x] = proj.project(lon, 0);
    const column = Math.round(x);
    if (part === 'lines') {
      for (let y = rect.y; y < bottom; y += 3) raster.set(column, y, theme.grid);
      continue;
    }
    drawText(raster, [degrees(lon, 'E', 'W')], column, bottom + context.px(4), {
      scale,
      color: theme.dim,
      align: 'center',
    });
  }
  const north = box[3] + (rect.height / proj.scale - (box[3] - box[1])) / 2;
  const south = north - rect.height / proj.scale;
  for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step) {
    const [, y] = proj.project(0, lat);
    const row = Math.round(y);
    if (row <= rect.y || row >= bottom) continue;
    if (part === 'lines') {
      for (let x = rect.x; x < rect.x + rect.width; x += 3) raster.set(x, row, theme.grid);
      continue;
    }
    drawText(raster, [degrees(lat, 'N', 'S')], rect.x - context.px(4), row, {
      scale,
      color: theme.dim,
      align: 'right',
      valign: 'middle',
    });
  }
}

/** Points of a route in [lon, lat]: waypoints as given, or a two-point arc bulging northwards. */
export function routePoints(
  route: {
    readonly from: LonLat | string;
    readonly to: LonLat | string;
    readonly via: readonly LonLat[];
    readonly arc: number;
  },
  markers: ReadonlyMap<string, LonLat>,
): LonLat[] {
  const place = (value: LonLat | string): LonLat => {
    if (typeof value !== 'string') return value;
    const found = markers.get(value);
    if (!found) {
      throw new KitError(
        'invalid-params',
        `kit.fx.blueprintMap(): route end "${value}" is not a marker id (ids: ${[...markers.keys()].join(', ') || 'none'})`,
      );
    }
    return found;
  };
  const from = place(route.from);
  const to = place(route.to);
  if (route.via.length > 0 || route.arc === 0) return [from, ...route.via, to];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  // Normal pointing north (positive latitude), so arcs bow like flight paths on a flat map.
  let nx = -dy / (length || 1);
  let ny = dx / (length || 1);
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const control: LonLat = [
    (from[0] + to[0]) / 2 + nx * length * route.arc,
    (from[1] + to[1]) / 2 + ny * length * route.arc,
  ];
  const segments = 24;
  return Array.from({ length: segments + 1 }, (_, index) => {
    const k = index / segments;
    const a = (1 - k) * (1 - k);
    const b = 2 * (1 - k) * k;
    const c = k * k;
    return [
      a * from[0] + b * control[0] + c * to[0],
      a * from[1] + b * control[1] + c * to[1],
    ] as const;
  });
}

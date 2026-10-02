/**
 * `kit.fx.mapAnimated`: a flat voxel map (water with a grid, shallows, beaches, land and
 * highlands) from a region preset, a route drawn as a trail of glowing cubes between start and
 * end, and pins that drop in when the route reaches them, with labels. The map lies in the x/z
 * plane (north = -z); positions are [u, v] in 0..1 (u east, v south) or [lon, lat] (europe).
 */
import { z } from 'zod';
import { colorOf, pickColor } from '../env/shared.js';
import { KitError } from '../errors.js';
import { createKitObject } from '../object.js';
import { defineFx, type KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import { landMask, MAP_REGIONS, valueNoise2, type LandMask } from './map-regions.js';
import { asFx, EASES, easeParam, progress, timeParam, vec2Param } from './shared.js';
import { textBlock, textWidth } from './text.js';
import { createTrail } from './trail.js';

const mapPin = z.object({
  at: vec2Param.describe('Position ([u, v] or [lon, lat], see coords)'),
  label: z.string().max(24).default('').describe('Text above the pin'),
  time: z
    .number()
    .optional()
    .describe('Local time the pin drops (default: when the route reaches it, else start)'),
  color: z.string().default('accent1').describe('Pin head colour (palette name)'),
});

export const mapAnimatedParams = z.object({
  region: z
    .enum(MAP_REGIONS)
    .default('generic')
    .describe("Land preset: 'generic' continent, 'islands' archipelago (both seeded), 'europe'"),
  seed: z.number().int().default(0).describe('Variant of generic/islands land'),
  width: z.number().positive().default(8).describe('Map width in units (depth follows the preset)'),
  columns: z.number().int().min(24).max(128).default(72).describe('Cells across (detail)'),
  coords: z
    .enum(['map', 'lonlat'])
    .default('map')
    .describe("'map' = [u, v] 0..1 (u east, v south); 'lonlat' = [lon, lat] (europe only)"),
  route: z.array(vec2Param).max(32).default([]).describe('Route points, drawn in order'),
  start: timeParam.default(0.5).describe('Local time the route starts drawing'),
  end: timeParam.default(3).describe('Local time the route is complete'),
  ease: easeParam.default('easeInOutCubic'),
  pins: z.array(mapPin).max(16).default([]),
  labelHeight: z.number().positive().default(0.3).describe('Pin label height in units'),
  labelTilt: z
    .number()
    .min(0)
    .max(90)
    .default(45)
    .describe('Labels lean back by this many degrees (readable from high cameras)'),
  routeColor: z.string().default('accent2').describe('Palette name'),
});

export type MapAnimatedParams = z.output<typeof mapAnimatedParams>;

type Point = readonly [number, number];

const PIN_DROP = 0.45;
const PIN_ROWS = 8;
/** Model layers: water (y = 0), coast, land, hills. */
const LAYERS = 4;
/** Value-noise level above which inland cells become hills. */
const HILL_LEVEL = 0.6;

/** Palette slots of the map model. */
const SLOT = { water: 1, grid: 2, shallow: 3, coast: 4, land: 5, high: 6 } as const;

function mapColors(tools: KitTools): string[] {
  const { palette } = tools;
  return [
    pickColor(palette, ['slateBlue', 'tealDark', 'dusk', 'groundAlt']),
    pickColor(palette, ['navy', 'ink', 'night', 'shadow']),
    pickColor(palette, ['teal', 'cornflower', 'accent3']),
    pickColor(palette, ['cream', 'ash', 'sand', 'heroTrim']),
    pickColor(palette, ['green', 'fog', 'sage', 'accent3']),
    pickColor(palette, ['brightTeal', 'steel', 'olive', 'accent1']),
  ];
}

/** Land height in voxels above the water layer of every cell: 0 water, 1 coast, 2 land, 3 hill. */
export function landHeights(mask: LandMask, seed: number): Uint8Array {
  const { columns, rows, land } = mask;
  const at = (x: number, z: number): number =>
    x < 0 || z < 0 || x >= columns || z >= rows ? 0 : (land[z * columns + x] ?? 0);
  const waterWithin = (column: number, row: number, radius: number): boolean => {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1)
        if (at(column + dx, row + dz) === 0) return true;
    }
    return false;
  };
  const heights = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (at(column, row) === 0) continue;
      let height = waterWithin(column, row, 1) ? 1 : 2;
      const hill = valueNoise2(column, row, columns / 10, seed + 7) > HILL_LEVEL;
      if (height === 2 && hill && !waterWithin(column, row, 3)) height = 3;
      heights[row * columns + column] = height;
    }
  }
  return heights;
}

/** Water cells next to land (8-neighbourhood). */
function shallowCells(mask: LandMask): Uint8Array {
  const { columns, rows, land } = mask;
  const shallow = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (land[row * columns + column] === 1) continue;
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = column + dx;
          const z = row + dz;
          if (x >= 0 && z >= 0 && x < columns && z < rows && land[z * columns + x] === 1) {
            shallow[row * columns + column] = 1;
          }
        }
      }
    }
  }
  return shallow;
}

/** Route share 0..1 at which a polyline passes closest to a point. */
export function routeShareAt(route: readonly Point[], point: Point): number {
  if (route.length < 2) return 0;
  const segments = route.slice(1).map((b, index) => {
    const a = route[index] ?? b;
    return { a, dx: b[0] - a[0], dz: b[1] - a[1], length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let best = { distance: Infinity, share: 0 };
  let walked = 0;
  for (const { a, dx, dz, length } of segments) {
    const along = length > 0 ? ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length ** 2 : 0;
    const k = Math.max(0, Math.min(1, along));
    const distance = Math.hypot(a[0] + dx * k - point[0], a[1] + dz * k - point[1]);
    if (distance < best.distance) {
      best = { distance, share: total > 0 ? (walked + k * length) / total : 0 };
    }
    walked += length;
  }
  return best.share;
}

/** First time in [from, to] at which a monotonic curve reaches `share` (bisection). */
export function reachTime(curve: (t: number) => number, from: number, to: number, share: number) {
  let low = from;
  let high = to;
  for (let step = 0; step < 30; step += 1) {
    const middle = (low + high) / 2;
    if (curve(middle) < share - 1e-6) low = middle;
    else high = middle;
  }
  return high;
}

/** Label rows apart, in label heights. */
const LABEL_STEP = 1.8;

export interface LabelSpot {
  readonly x: number;
  readonly z: number;
  readonly width: number;
}

/**
 * Stacking level of every pin label (0 = default height): a label moves up one level while it
 * would overlap an earlier label of the same level (overlapping in x, similar depth z).
 */
export function stackLabels(spots: readonly LabelSpot[], height: number): number[] {
  const placed: (LabelSpot & { readonly level: number })[] = [];
  return spots.map((spot) => {
    let level = 0;
    const clashes = (other: LabelSpot & { readonly level: number }): boolean =>
      other.level === level &&
      Math.abs(other.x - spot.x) < (other.width + spot.width) / 2 + height * 0.5 &&
      Math.abs(other.z - spot.z) < height * 3;
    while (spot.width > 0 && placed.some(clashes)) level += 1;
    placed.push({ ...spot, level });
    return level;
  });
}

function pinModel(tools: KitTools, color: string) {
  const voxels: [number, number, number, number][] = [];
  for (let y = 0; y < 5; y += 1) voxels.push([1, y, 1, 1]);
  for (let y = 5; y < PIN_ROWS; y += 1) {
    for (let x = 0; x < 3; x += 1) for (let z = 0; z < 3; z += 1) voxels.push([x, y, z, 2]);
  }
  return tools.voxel.fromGrid({ size: [3, PIN_ROWS, 3], voxels }, ['heroTrim', color]);
}

export const mapAnimated = defineFx({
  name: 'mapAnimated',
  description:
    "Stylised voxel map (region 'generic' | 'islands' | 'europe') with a route drawn between start and end and pins dropping in when the route reaches them (labels above). Positions [u, v] 0..1, or [lon, lat] with coords 'lonlat' on europe. Lies flat (x/z, north = -z); film from above at an angle. fx.update(t) every frame.",
  params: mapAnimatedParams,
  anchors: { 'pin<i>': 'top of pin i', routeEnd: 'last route point at route height' },
  build(params, tools) {
    const { three } = tools;
    const seed = tools.rng.fork(`seed:${String(params.seed)}`).int(0, 1_000_000);
    const mask = landMask(params.region, params.columns, seed);
    const { columns, rows } = mask;
    const cell = params.width / columns;
    const depth = rows * cell;
    const heights = landHeights(mask, seed);
    const shallow = shallowCells(mask);
    const model = tools.voxel.generate(
      [columns, LAYERS, rows],
      (x, y, z) => {
        const index = z * columns + x;
        const height = heights[index] ?? 0;
        if (y > height) return 0;
        if (height === 0) {
          if (shallow[index] === 1) return SLOT.shallow;
          return x % 8 === 4 || z % 8 === 4 ? SLOT.grid : SLOT.water;
        }
        if (y < height) return SLOT.land;
        return height === 1 ? SLOT.coast : height === 3 ? SLOT.high : SLOT.land;
      },
      mapColors(tools),
    );
    const terrain = tools.voxel.mesh(model, {
      voxelSize: cell,
      pivot: [columns / 2, 0, rows / 2],
      mode: 'greedy',
    });
    const toMap = (point: Point): Point => {
      if (params.coords === 'map') return point;
      if (!mask.project) {
        throw new KitError(
          'invalid-params',
          `kit.fx.mapAnimated(): coords 'lonlat' needs region 'europe' (got '${params.region}')`,
        );
      }
      return mask.project(point[0], point[1]);
    };
    const toLocal = (point: Point, y: number): Vec3 => {
      const [u, v] = toMap(point);
      return [(u - 0.5) * params.width, y, (v - 0.5) * depth];
    };
    const ground = LAYERS * cell;
    const routeY = ground + 0.6 * cell;
    const route = params.route.map(toMap);
    const routePath = params.route.map((point) => toLocal(point, routeY));
    const pinSize = Math.max(cell, params.width / 64);
    const anchors: Record<string, Vec3> = {
      routeEnd: routePath[routePath.length - 1] ?? [0, routeY, 0],
    };
    /** Top of the terrain under a point (pins stand on it). */
    const baseOf = (point: Point): number => {
      const [u, v] = toMap(point);
      const column = Math.min(columns - 1, Math.max(0, Math.floor(u * columns)));
      const row = Math.min(rows - 1, Math.max(0, Math.floor(v * rows)));
      return ((heights[row * columns + column] ?? 0) + 1) * cell;
    };
    const labelStyle = { height: params.labelHeight, color: { color: 'text', glow: true } };
    const levels = stackLabels(
      params.pins.map((pin) => {
        const [x, , zz] = toLocal(pin.at, 0);
        const width = pin.label.length > 0 ? textWidth([pin.label], labelStyle) : 0;
        return { x, z: zz, width };
      }),
      params.labelHeight,
    );
    params.pins.forEach((pin, index) => {
      const [x, , zz] = toLocal(pin.at, 0);
      anchors[`pin${String(index)}`] = [x, baseOf(pin.at) + PIN_ROWS * pinSize, zz];
    });
    const object = createKitObject(three, { kitType: 'mapAnimated', anchors });
    object.add(terrain);
    const trail =
      routePath.length >= 2
        ? createTrail(tools, [routePath], { spacing: cell * 1.6, size: cell * 1.3 })
        : undefined;
    const head = tools.voxel.mesh(tools.voxel.box([2, 2, 2], { color: 'heroTrim', glow: true }), {
      voxelSize: cell * 1.3,
      pivot: 'center',
    });
    head.visible = false;
    if (trail) {
      const color = colorOf(tools, params.routeColor);
      trail.tint(0, () => color);
      object.add(trail.mesh, head);
    }
    const routeProgress = (t: number): number =>
      EASES[params.ease](progress(t, params.start, params.end));
    const pins = params.pins.map((pin, index) => {
      const root = new three.Group();
      const [x, , zz] = toLocal(pin.at, 0);
      const base = baseOf(pin.at);
      root.position.set(x, base, zz);
      root.add(tools.voxel.mesh(pinModel(tools, pin.color), { voxelSize: pinSize }));
      if (pin.label.length > 0) {
        const label = textBlock(tools, [pin.label], { ...labelStyle, anchor: 'bottom' });
        const raise = (levels[index] ?? 0) * params.labelHeight * LABEL_STEP;
        label.position.set(0, PIN_ROWS * pinSize + params.labelHeight * 0.4 + raise, 0);
        label.rotation.x = (-params.labelTilt * Math.PI) / 180;
        root.add(label);
      }
      object.add(root);
      const reach = (): number =>
        reachTime(routeProgress, params.start, params.end, routeShareAt(route, toMap(pin.at)));
      const time = pin.time ?? (route.length >= 2 ? reach() : params.start + index * 0.3);
      return { root, time, base };
    });
    const sampleHead = new three.Matrix4();
    return asFx(object, (t) => {
      const drawn = routeProgress(t);
      if (trail) {
        trail.reveal(0, drawn);
        head.visible = drawn > 0 && drawn < 1;
        const last = trail.cubes(0) - 1;
        trail.mesh.getMatrixAt(Math.min(last, Math.round(drawn * last)), sampleHead);
        head.position.setFromMatrixPosition(sampleHead);
      }
      for (const { root, time, base } of pins) {
        const k = progress(t, time, time + PIN_DROP);
        root.visible = k > 0;
        root.position.y = base + (1 - EASES.easeOutBack(k)) * 1.5;
      }
    });
  },
});

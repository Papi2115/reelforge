/**
 * `kit.props.building` (parametric office/apartment block with rooftop variants) and
 * `kit.props.tower` (skyscraper with setbacks, a light crown and a spire). Facades are bays of
 * windows per floor; each window is lit, lit in the accent colour or dark by a hash of
 * (seed, face, bay, floor), so the same seed lights the same windows in every shot.
 */
import { z } from 'zod';
import { hashCell } from '../env/shared.js';
import { defineProp, type KitTools } from '../registry.js';
import type { VoxelColor } from '../voxel/model.js';
import {
  asProp,
  colorField,
  DARK,
  DARKEST,
  gridPoint,
  METAL,
  pick,
  propShell,
  RED,
  scaleParam,
  seedParam,
  setAnchors,
} from './shared.js';
import { Sketch } from './sketch.js';

/** City-scale voxel: a 3-unit storey is 6 voxels, a window bay 1.5 units. */
const CITY_VOXEL = 1 / 2;
const FLOOR = 6;
const BAY = 3;

export type BuildingSlot =
  | 'wall'
  | 'trim'
  | 'roof'
  | 'glass'
  | 'lit'
  | 'alt'
  | 'door'
  | 'metal'
  | 'beacon'
  | 'crown'
  | 'mark';

const WALLS = [
  ['darkSlate', 'slate', 'plum', 'groundAlt'],
  ['slateBlue', 'steel', 'dusk', 'groundAlt'],
  ['slateGrey', 'ash', 'ice', 'textDim'],
  ['purple', 'charcoal', 'mauve', 'groundAlt'],
] as const;

export const ROOFTOPS = ['flat', 'antenna', 'dish', 'tank', 'helipad'] as const;
type Rooftop = (typeof ROOFTOPS)[number];

function buildingColors(tools: KitTools, wall: string | undefined, seed: number) {
  const chain = WALLS[Math.floor(hashCell(5, 5, 5, seed) * WALLS.length)] ?? WALLS[0];
  const colors: Record<BuildingSlot, VoxelColor> = {
    wall: pick(tools, wall, chain),
    trim: pick(tools, undefined, DARKEST),
    roof: pick(tools, undefined, DARK),
    glass: pick(tools, undefined, ['navy', 'black', 'night', 'shadow']),
    lit: { color: 'keyLight', glow: true },
    alt: { color: 'accent1', glow: true },
    door: pick(tools, undefined, DARKEST),
    metal: pick(tools, undefined, METAL),
    beacon: { color: pick(tools, undefined, RED), glow: true },
    crown: { color: 'accent2', glow: true },
    mark: pick(tools, undefined, ['cream', 'bone', 'sand', 'heroTrim']),
  };
  return colors;
}

/** Bays of a facade `cells` voxels wide (piers at both ends). */
function baysFor(units: number): number {
  return Math.max(1, Math.round((units / CITY_VOXEL - 1) / BAY));
}

interface Box2 {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

/** Calls `paint(x, y, z, face, u)` for every outer wall cell of a footprint, y0..y1. */
function eachFacadeCell(
  box: Box2,
  y0: number,
  y1: number,
  paint: (x: number, y: number, z: number, face: number, u: number) => void,
): void {
  for (let y = y0; y < y1; y += 1) {
    for (let x = box.x0; x < box.x1; x += 1) {
      paint(x, y, box.z1 - 1, 0, x - box.x0);
      paint(x, y, box.z0, 1, box.x1 - 1 - x);
    }
    for (let z = box.z0; z < box.z1; z += 1) {
      paint(box.x0, y, z, 2, z - box.z0);
      paint(box.x1 - 1, y, z, 3, box.z1 - 1 - z);
    }
  }
}

interface WindowRule {
  /** Rows of a storey (0 = floor slab line) that are glass. */
  readonly rows: readonly number[];
  readonly share: number;
  readonly seed: number;
}

/** Glass slot of window cell (face, bay, storey), or 'wall' for piers and slabs. */
function windowSlot(rule: WindowRule, face: number, u: number, y: number): BuildingSlot {
  const storey = Math.floor(y / FLOOR);
  if (u % BAY === 0 || !rule.rows.includes(y % FLOOR)) return 'wall';
  const roll = hashCell(Math.floor(u / BAY) + face * 101, storey, face, rule.seed);
  if (roll >= rule.share) return 'glass';
  return roll < rule.share * 0.18 ? 'alt' : 'lit';
}

function rooftop(sketch: Sketch<BuildingSlot>, kind: Rooftop, box: Box2, y: number): void {
  const cx = Math.floor((box.x0 + box.x1) / 2);
  const cz = Math.floor((box.z0 + box.z1) / 2);
  switch (kind) {
    case 'flat':
      sketch.box('metal', [box.x0 + 2, y, box.z0 + 2], [box.x0 + 4, y + 2, box.z0 + 5]);
      return;
    case 'antenna':
      sketch.box('metal', [cx - 1, y, cz - 1], [cx + 1, y + 1, cz + 1]);
      sketch
        .box('metal', [cx, y + 1, cz], [cx + 1, y + 8, cz + 1])
        .box('beacon', [cx, y + 8, cz], [cx + 1, y + 9, cz + 1]);
      return;
    case 'dish':
      sketch.box('metal', [cx, y, cz], [cx + 1, y + 4, cz + 1]);
      sketch.cylinderZ('mark', [cx + 0.5, y + 4.5], 2.2, cz - 1, cz);
      sketch.box('trim', [cx, y + 4, cz], [cx + 1, y + 5, cz + 1]);
      return;
    case 'tank':
      for (const [dx, dz] of [
        [-2, -2],
        [1, -2],
        [-2, 1],
        [1, 1],
      ] as const) {
        sketch.box('trim', [cx + dx, y, cz + dz], [cx + dx + 1, y + 2, cz + dz + 1]);
      }
      sketch
        .cylinderY('metal', [cx, cz], 2.6, y + 2, y + 6)
        .cylinderY('roof', [cx, cz], 1.6, y + 6, y + 7);
      return;
    case 'helipad':
      sketch.box('trim', [box.x0 + 1, y - 1, box.z0 + 1], [box.x1 - 1, y, box.z1 - 1]);
      sketch.pattern(['M...M', 'M...M', 'MMMMM', 'M...M', 'M...M'], { M: 'mark' }, 'xz', [
        cx - 2,
        y - 1,
        cz - 2,
      ]);
      for (const [x, z] of [
        [box.x0 + 1, box.z0 + 1],
        [box.x1 - 2, box.z0 + 1],
        [box.x0 + 1, box.z1 - 2],
        [box.x1 - 2, box.z1 - 2],
      ] as const) {
        sketch.box('alt', [x, y - 1, z], [x + 1, y, z + 1]);
      }
      return;
  }
}

export const buildingParams = z.object({
  floors: z.number().int().min(1).max(40).default(6).describe('Storeys (3 units each)'),
  width: z
    .number()
    .min(2)
    .max(40)
    .default(8)
    .describe('Width (x) in units (snaps to 1.5-unit bays)'),
  depth: z.number().min(2).max(40).default(8).describe('Depth (z) in units (snaps to bays)'),
  style: z
    .enum(['office', 'apartment'])
    .default('office')
    .describe('office (glass bands, lobby) or apartment (punched windows with sills)'),
  windows: z.number().min(0).max(1).default(0.45).describe('Share of lit windows'),
  rooftop: z
    .enum(ROOFTOPS)
    .default('flat')
    .describe('Roof: flat (AC unit), antenna, dish, tank, helipad'),
  wall: colorField('the walls (default: picked by seed)'),
  seed: seedParam,
  scale: scaleParam,
});

export const building = defineProp({
  name: 'building',
  description:
    'Parametric city building (default 6 storeys of 3 units, 8 x 8 units) with seeded lit windows (glow), an office lobby or apartment windows, and a rooftop: AC unit, antenna, dish, water tank or helipad. A 2-unit person is 2/3 of a storey. Static.',
  params: buildingParams,
  anchors: { roof: 'centre of the roof', entrance: 'bottom centre of the front door (+z)' },
  build(params, tools) {
    const seed = Math.imul(params.seed, 0x9e3779b1) >>> 0;
    const w = baysFor(params.width) * BAY + 1;
    const d = baysFor(params.depth) * BAY + 1;
    const h = params.floors * FLOOR;
    const sketch = new Sketch<BuildingSlot>(
      [w, h + 11, d],
      buildingColors(tools, params.wall, seed),
    );
    const box: Box2 = { x0: 0, x1: w, z0: 0, z1: d };
    sketch.box('wall', [0, 0, 0], [w, h, d]);
    const office = params.style === 'office';
    const rule: WindowRule = {
      rows: office ? [1, 2, 3, 4] : [2, 3, 4],
      share: params.windows,
      seed,
    };
    eachFacadeCell(box, FLOOR, h, (x, y, z, face, u) => {
      sketch.set(windowSlot(rule, face, u, y), x, y, z);
      if (!office && y % FLOOR === 1 && u % BAY !== 0) sketch.set('trim', x, y, z);
    });
    const lobby: WindowRule = { rows: [0, 1, 2, 3, 4], share: office ? 1 : 0.5, seed };
    eachFacadeCell(box, 0, FLOOR, (x, y, z, face, u) => {
      sketch.set(windowSlot(lobby, face, u, y), x, y, z);
    });
    const door = Math.floor(w / 2);
    sketch
      .box('door', [door - 1, 0, d - 1], [door + 1, 4, d])
      .box('trim', [door - 2, 4, d - 1], [door + 2, 5, d + 0]);
    for (let y = FLOOR; y < h; y += FLOOR) sketch.paint('trim', [0, y - 1, 0], [w, y, d]);
    sketch.box('roof', [0, h, 0], [w, h + 1, d]).box('wall', [0, h + 1, 0], [w, h + 2, d]);
    sketch.box(null, [1, h + 1, 1], [w - 1, h + 2, d - 1]);
    rooftop(sketch, params.rooftop, box, h + 1);
    const shell = propShell(tools, 'building', CITY_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    setAnchors(shell.object, {
      roof: gridPoint(body, [w / 2, h + 1, d / 2]),
      entrance: gridPoint(body, [door, 0, d]),
    });
    return asProp(shell.object, {});
  },
});

export const towerParams = z.object({
  floors: z.number().int().min(6).max(60).default(16).describe('Storeys (3 units each)'),
  width: z.number().min(6).max(30).default(10).describe('Base width and depth in units'),
  setbacks: z.number().int().min(0).max(3).default(2).describe('Narrower tiers towards the top'),
  windows: z.number().min(0).max(1).default(0.5).describe('Share of lit windows'),
  spire: z.boolean().default(true).describe('Spire with a red beacon on top'),
  wall: colorField('the frame (default: picked by seed)'),
  seed: seedParam,
  scale: scaleParam,
});

export const tower = defineProp({
  name: 'tower',
  description:
    'Skyscraper (default 16 storeys = 48 units, 10 units wide) with a glass curtain wall of seeded lit windows, setback tiers, a glowing crown and a spire with a beacon. Skyline backdrops, "corporate HQ". Static.',
  params: towerParams,
  anchors: { roof: 'centre of the top tier roof', spire: 'tip of the spire (roof without spire)' },
  build(params, tools) {
    const seed = Math.imul(params.seed, 0x9e3779b1) >>> 0;
    const size = baysFor(params.width) * BAY + 1;
    const tiers = params.setbacks + 1;
    const h = params.floors * FLOOR;
    const spire = params.spire ? 16 : 0;
    const sketch = new Sketch<BuildingSlot>(
      [size, h + 3 + spire, size],
      buildingColors(tools, params.wall, seed),
    );
    const rule: WindowRule = { rows: [1, 2, 3, 4, 5], share: params.windows, seed };
    let top = 0;
    let box: Box2 = { x0: 0, x1: size, z0: 0, z1: size };
    for (let tier = 0; tier < tiers; tier += 1) {
      const inset = tier * BAY;
      if (size - 2 * inset < BAY * 2 + 1) break;
      box = { x0: inset, x1: size - inset, z0: inset, z1: size - inset };
      const y0 = top;
      top = Math.round((h * (tier + 1)) / tiers / FLOOR) * FLOOR;
      sketch.box('wall', [box.x0, y0, box.z0], [box.x1, top, box.z1]);
      eachFacadeCell(box, y0, top, (x, y, z, face, u) => {
        sketch.set(
          y < FLOOR ? (u % BAY === 0 ? 'wall' : 'lit') : windowSlot(rule, face, u, y),
          x,
          y,
          z,
        );
      });
      sketch.box('roof', [box.x0, top, box.z0], [box.x1, top + 1, box.z1]);
      sketch.box('crown', [box.x0, top - 1, box.z0], [box.x1, top, box.z1]);
    }
    const door = Math.floor(size / 2);
    sketch.box('door', [door - 1, 0, size - 1], [door + 1, 4, size]);
    const centre = (box.x0 + box.x1) / 2;
    sketch.box('wall', [box.x0 + 1, top + 1, box.z0 + 1], [box.x1 - 1, top + 3, box.z1 - 1]);
    if (spire > 0) {
      const c = Math.floor(centre);
      sketch.box('metal', [c, top + 3, c], [c + 1, top + 3 + spire - 1, c + 1]);
      sketch.box('beacon', [c, top + 2 + spire, c], [c + 1, top + 3 + spire, c + 1]);
    }
    const shell = propShell(tools, 'tower', CITY_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    setAnchors(shell.object, {
      roof: gridPoint(body, [centre, top + 3, centre]),
      spire: gridPoint(body, [centre, top + 3 + spire, centre]),
    });
    return asProp(shell.object, {});
  },
});

/**
 * `kit.props.container` (shipping container, fits a truck flatbed) and `kit.props.warehouse`
 * (corrugated shed with roller doors, loading dock and a flat or sawtooth roof). Static props;
 * seeded choices (colour, lit windows, roof units) are hashed per cell from `seed`.
 */
import { z } from 'zod';
import { hashCell } from '../env/shared.js';
import { defineProp } from '../registry.js';
import {
  asProp,
  colorField,
  DARK,
  DARKEST,
  GOLD_DARK,
  gridPoint,
  METAL,
  pick,
  propShell,
  RED,
  scaleParam,
  SEA,
  seedParam,
  setAnchors,
} from './shared.js';
import { Sketch } from './sketch.js';

const CONTAINER_VOXEL = 1 / 8;
const CONTAINER = [16, 18, 44] as const;
const CONTAINER_COLORS = [RED, SEA, GOLD_DARK, ['green', 'teal', 'sage', 'accent3'], ['hero']];

export const containerParams = z.object({
  color: colorField('the container (default: picked by seed)'),
  seed: seedParam,
  scale: scaleParam,
});

type ContainerSlot = 'wall' | 'frame' | 'bar' | 'seam';

export const container = defineProp({
  name: 'container',
  description:
    'Corrugated shipping container (5.5 x 2 units, 2.25 tall), doors at the back (-z). Fits a truck flatbed: kit.props.container().on(truck, { at: "cargo" }); stack them with on(other). Colour by `seed` or `color`. Static.',
  params: containerParams,
  anchors: { doors: 'centre of the door end (faces -z)' },
  build(params, tools) {
    const [sx, sy, sz] = CONTAINER;
    const seed = Math.imul(params.seed, 0x9e3779b1) >>> 0;
    const chain = CONTAINER_COLORS[Math.floor(hashCell(1, 2, 3, seed) * CONTAINER_COLORS.length)];
    const sketch = new Sketch<ContainerSlot>([sx, sy, sz], {
      wall: pick(tools, params.color, chain ?? RED),
      frame: pick(tools, undefined, DARK),
      bar: pick(tools, undefined, METAL),
      seam: pick(tools, undefined, DARKEST),
    });
    sketch.box('wall', [0, 0, 0], [sx, sy, sz]);
    for (let z = 2; z < sz - 2; z += 2) {
      sketch
        .box(null, [0, 2, z], [1, sy - 2, z + 1])
        .box(null, [sx - 1, 2, z], [sx, sy - 2, z + 1]);
    }
    for (let x = 2; x < sx - 2; x += 2) sketch.box(null, [x, 2, sz - 1], [x + 1, sy - 2, sz]);
    for (const y of [0, sy - 1]) {
      sketch.paint('frame', [0, y, 0], [sx, y + 1, sz]);
    }
    for (const x of [0, sx - 1]) {
      for (const z of [0, sz - 1]) sketch.paint('frame', [x, 0, z], [x + 1, sy, z + 1]);
    }
    sketch.paint('seam', [sx / 2, 1, 0], [sx / 2 + 1, sy - 1, 1]);
    for (const x of [3, 6, 9, 12]) sketch.paint('bar', [x, 2, 0], [x + 1, sy - 2, 1]);
    const shell = propShell(tools, 'container', CONTAINER_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    setAnchors(shell.object, { doors: gridPoint(body, [sx / 2, sy / 2, 0]) });
    return asProp(shell.object, {});
  },
});

const WAREHOUSE_VOXEL = 1 / 4;

export const warehouseParams = z.object({
  width: z.number().min(4).max(40).default(14).describe('Width (x) in units'),
  depth: z.number().min(4).max(40).default(9).describe('Depth (z) in units'),
  height: z.number().min(2.5).max(12).default(4.5).describe('Wall height in units'),
  doors: z.number().int().min(0).max(8).default(3).describe('Roller doors on the front (+z)'),
  dock: z.boolean().default(true).describe('Raised loading dock in front of the doors'),
  roof: z
    .enum(['flat', 'sawtooth'])
    .default('sawtooth')
    .describe('flat or sawtooth with skylights'),
  wall: colorField('the corrugated walls'),
  seed: seedParam,
  scale: scaleParam,
});

type WarehouseSlot =
  'wall' | 'slab' | 'door' | 'slat' | 'roof' | 'sky' | 'sign' | 'lit' | 'unit' | 'bumper';

function roofLine(sketch: Sketch<WarehouseSlot>, size: readonly number[], kind: string): void {
  const [w, h, d] = [size[0] ?? 0, size[1] ?? 0, size[2] ?? 0];
  sketch.box('roof', [0, h, 0], [w, h + 1, d]);
  if (kind === 'flat') {
    sketch
      .box('wall', [0, h + 1, 0], [w, h + 2, d])
      .box(null, [1, h + 1, 1], [w - 1, h + 2, d - 1]);
    return;
  }
  for (let z = 0; z < d; z += 1) {
    const rise = Math.floor((z % 10) / 2.5);
    if (rise === 0) continue;
    sketch.box('roof', [1, h + 1, z], [w - 1, h + 1 + rise, z + 1]);
    if (z % 10 === 9) sketch.paint('sky', [2, h + 1, z], [w - 2, h + 1 + rise, z + 1]);
  }
}

export const warehouse = defineProp({
  name: 'warehouse',
  description:
    'Warehouse (default 14 x 9 units, 4.5 tall) with corrugated walls, roller doors and a loading dock on the front (+z), lit office windows and a sawtooth (skylights) or flat roof with seeded roof units. For logistics, smuggling, "the depot". Static.',
  params: warehouseParams,
  anchors: {
    dock: 'top of the loading dock, centre front (ground in front of the doors without a dock)',
    roof: 'centre of the roof',
    door: 'bottom centre of the middle roller door',
  },
  build(params, tools) {
    const v = WAREHOUSE_VOXEL;
    const [w, h, d] = [params.width, params.height, params.depth].map((units) =>
      Math.max(8, Math.round(units / v)),
    ) as [number, number, number];
    const dock = params.dock ? 6 : 0;
    const seed = Math.imul(params.seed, 0x9e3779b1) >>> 0;
    const sketch = new Sketch<WarehouseSlot>([w, h + 6, d + dock], {
      wall: pick(tools, params.wall, ['slateGrey', 'ash', 'ice', 'textDim']),
      slab: pick(tools, undefined, DARK),
      door: pick(tools, undefined, METAL),
      slat: pick(tools, undefined, DARK),
      roof: pick(tools, undefined, DARK),
      sky: { color: 'accent1', glow: true },
      sign: 'hero',
      lit: { color: 'keyLight', glow: true },
      unit: pick(tools, undefined, METAL),
      bumper: pick(tools, undefined, DARKEST),
    });
    sketch.box('wall', [0, 0, 0], [w, h, d]);
    for (let x = 2; x < w - 2; x += 2) {
      sketch.box(null, [x, 1, 0], [x + 1, h - 1, 1]).box(null, [x, 1, d - 1], [x + 1, h - 1, d]);
    }
    for (let z = 2; z < d - 2; z += 2) {
      sketch.box(null, [0, 1, z], [1, h - 1, z + 1]).box(null, [w - 1, 1, z], [w, h - 1, z + 1]);
    }
    if (dock > 0) {
      sketch.box('slab', [0, 0, d], [w, 4, d + dock]);
      for (let x = 2; x < w - 2; x += 6)
        sketch.box('bumper', [x, 1, d + dock - 1], [x + 1, 3, d + dock]);
    }
    const doorWidth = 10;
    const bay = params.doors > 0 ? Math.floor((w - 12) / params.doors) : 0;
    const doorBottom = dock > 0 ? 4 : 0;
    const doorTop = Math.min(h - 4, doorBottom + 13);
    const doorCentres = Array.from({ length: params.doors }, (_, index) =>
      Math.round(12 + bay * (index + 0.5)),
    );
    for (const centre of doorCentres) {
      const x0 = centre - doorWidth / 2;
      sketch.box('door', [x0, doorBottom, d - 2], [x0 + doorWidth, doorTop, d]);
      sketch.box(null, [x0, doorBottom, d - 1], [x0 + doorWidth, doorTop, d]);
      for (let y = doorBottom + 1; y < doorTop; y += 2) {
        sketch.paint('slat', [x0, y, d - 2], [x0 + doorWidth, y + 1, d - 1]);
      }
    }
    sketch.box('bumper', [3, doorBottom, d - 1], [7, doorBottom + 9, d]);
    for (let x = 2; x < 10; x += 2) {
      const lit = hashCell(x, 1, 0, seed) < 0.6;
      sketch.box(lit ? 'lit' : 'bumper', [x, h - 6, d - 1], [x + 1, h - 4, d]);
    }
    sketch.box('sign', [Math.round(w / 2) - 8, h - 3, d - 1], [Math.round(w / 2) + 8, h - 1, d]);
    roofLine(sketch, [w, h, d], params.roof);
    for (let index = 0; index < 3; index += 1) {
      const x = 4 + Math.floor(hashCell(index, 7, 1, seed) * (w - 12));
      const z = 4 + Math.floor(hashCell(index, 8, 1, seed) * (d - 10));
      sketch.box('unit', [x, h + 1, z], [x + 4, h + 3, z + 3]);
    }
    const shell = propShell(tools, 'warehouse', v, params.scale);
    const body = shell.mesh(sketch);
    setAnchors(shell.object, {
      dock: gridPoint(body, [w / 2, dock > 0 ? 4 : 0, d + dock / 2]),
      roof: gridPoint(body, [w / 2, h + 1, d / 2]),
      door: gridPoint(body, [doorCentres[Math.floor(params.doors / 2)] ?? w / 2, doorBottom, d]),
    });
    return asProp(shell.object, {});
  },
});

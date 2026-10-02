/**
 * `kit.props.mapTable`: a planning table whose top is a seeded voxel map (sea, coast, land,
 * hills, a dashed route) with push pins. Pins are separate objects, so `mapTable.dropPins(k)`
 * can drop them in one after another as a pure function of k.
 */
import { z } from 'zod';
import { hashCell, WOOD, WOOD_DARK } from '../env/shared.js';
import { defineProp } from '../registry.js';
import type { Vec3 } from '../types.js';
import type { VoxelObject } from '../voxel/mesh.js';
import {
  amountArg,
  asProp,
  colorField,
  gridPoint,
  LAND,
  MEDIUM_VOXEL,
  METAL,
  PAPER,
  pick,
  propShell,
  RED,
  scaleParam,
  SEA,
  seedParam,
  setAnchors,
  SMALL_VOXEL,
} from './shared.js';
import { Sketch } from './sketch.js';

const WIDTH = 48;
const DEPTH = 32;
const TOP = 13;
/** Pins fall from this height (units) in dropPins. */
const DROP_HEIGHT = 1.5;

export const mapTableParams = z.object({
  pins: z
    .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]))
    .max(12)
    .optional()
    .describe(
      'Pin positions [u, v] on the map (0..1 left->right, back->front); default: 4 seeded pins on land',
    ),
  pinColor: z.string().optional().describe('Palette name of the pin heads (default: red)'),
  wood: colorField('the table'),
  seed: seedParam,
  scale: scaleParam,
});

type TableSlot = 'wood' | 'woodDark' | 'sea' | 'shore' | 'land' | 'hill' | 'route';

/** Smooth value noise in 0..1 on the map grid (bilinear between 8-cell lattice points). */
function landNoise(x: number, z: number, seed: number): number {
  const cell = 8;
  const [gx, gz] = [Math.floor(x / cell), Math.floor(z / cell)];
  const [fx, fz] = [(x % cell) / cell, (z % cell) / cell];
  const smooth = (value: number): number => value * value * (3 - 2 * value);
  const at = (ix: number, iz: number): number => hashCell(ix, iz, 0, seed);
  const top = at(gx, gz) + (at(gx + 1, gz) - at(gx, gz)) * smooth(fx);
  const bottom = at(gx, gz + 1) + (at(gx + 1, gz + 1) - at(gx, gz + 1)) * smooth(fx);
  const coarse = top + (bottom - top) * smooth(fz);
  return coarse * 0.8 + hashCell(x, z, 1, seed) * 0.2;
}

function mapSlot(x: number, z: number, seed: number): TableSlot {
  const value = landNoise(x, z, seed);
  if (value < 0.42) return 'sea';
  if (value < 0.47) return 'shore';
  return value > 0.7 ? 'hill' : 'land';
}

function table(sketch: Sketch<TableSlot>, seed: number): void {
  sketch.box('wood', [0, TOP - 1, 0], [WIDTH, TOP + 1, DEPTH]);
  for (let z = 1; z < DEPTH - 1; z += 1) {
    for (let x = 1; x < WIDTH - 1; x += 1) sketch.set(mapSlot(x, z, seed), x, TOP, z);
  }
  for (let x = 6; x < WIDTH - 6; x += 1) {
    const z = Math.round(DEPTH / 2 + Math.sin(x / 6 + seed) * 6);
    if (x % 3 !== 2) sketch.set('route', x, TOP, z);
  }
  for (const x of [1, WIDTH - 4]) {
    for (const z of [1, DEPTH - 4]) sketch.box('woodDark', [x, 0, z], [x + 3, TOP - 1, z + 3]);
  }
  for (const z of [2, DEPTH - 3]) sketch.box('woodDark', [4, 3, z], [WIDTH - 4, 4, z + 1]);
  sketch.box('woodDark', [1, TOP - 2, 1], [WIDTH - 1, TOP - 1, DEPTH - 1]);
}

function defaultPins(seed: number): [number, number][] {
  const pins: [number, number][] = [];
  for (let attempt = 0; attempt < 64 && pins.length < 4; attempt += 1) {
    const u = 0.1 + hashCell(attempt, 0, 9, seed) * 0.8;
    const v = 0.15 + hashCell(attempt, 1, 9, seed) * 0.7;
    if (mapSlot(Math.floor(1 + u * (WIDTH - 2)), Math.floor(1 + v * (DEPTH - 2)), seed) !== 'sea')
      pins.push([u, v]);
  }
  return pins;
}

export const mapTable = defineProp({
  name: 'mapTable',
  description:
    'Planning table (~3 x 2 units, 0.9 tall) with a seeded voxel map on top (sea, coast, land, hills, a dashed route) and push pins. mapTable.dropPins(amount) drops the pins in one by one (0 none .. 1 all). For war rooms, heists, logistics, "where it happened".',
  params: mapTableParams,
  anchors: { map: 'centre of the map surface', 'pin0..pinN': 'head of each pin (in pins order)' },
  methods: {
    'dropPins(amount)': '0 (no pins) .. 1 (all pins in place), staggered; set every frame',
  },
  build(params, tools) {
    const sketch = new Sketch<TableSlot>([WIDTH, TOP + 1, DEPTH], {
      wood: pick(tools, params.wood, WOOD),
      woodDark: pick(tools, undefined, WOOD_DARK),
      sea: pick(tools, undefined, SEA),
      shore: pick(tools, undefined, PAPER),
      land: pick(tools, undefined, LAND),
      hill: pick(tools, undefined, ['brightTeal', 'steel', 'olive', 'accent1']),
      route: pick(tools, undefined, RED),
    });
    table(sketch, params.seed);
    const shell = propShell(tools, 'mapTable', MEDIUM_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    const pinSketch = new Sketch<'needle' | 'head'>([3, 7, 3], {
      needle: pick(tools, undefined, METAL),
      head: pick(tools, params.pinColor, RED),
    });
    pinSketch.box('needle', [1, 0, 1], [2, 4, 2]).box('head', [0, 4, 0], [3, 7, 3]);
    const pinModel = pinSketch.model(tools.voxel);
    const anchors: Record<string, Vec3> = { map: gridPoint(body, [WIDTH / 2, TOP + 1, DEPTH / 2]) };
    const pins: VoxelObject[] = (params.pins ?? defaultPins(params.seed)).map(([u, v], index) => {
      const pin = tools.voxel.mesh(pinModel, { voxelSize: SMALL_VOXEL });
      pin.position.set(...gridPoint(body, [1 + u * (WIDTH - 2), TOP + 1, 1 + v * (DEPTH - 2)]));
      shell.object.add(pin);
      anchors[`pin${String(index)}`] = [
        pin.position.x,
        pin.position.y + 7 * SMALL_VOXEL,
        pin.position.z,
      ];
      return pin;
    });
    setAnchors(shell.object, anchors);
    const restY = pins.map((pin) => pin.position.y);
    const dropPins = (amount: number): void => {
      const k = amountArg('mapTable.dropPins(amount)', amount) * pins.length;
      pins.forEach((pin, index) => {
        const local = Math.min(1, Math.max(0, k - index));
        pin.visible = local > 0;
        pin.position.y = (restY[index] ?? 0) + (1 - local) ** 2 * DROP_HEIGHT;
      });
    };
    const methods: { dropPins(amount: number): void } = { dropPins };
    return asProp(shell.object, methods);
  },
});

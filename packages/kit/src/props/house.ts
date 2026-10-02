/**
 * `kit.props.house` (two-storey house with a gable roof, framed windows lit by seed, a porch
 * and a chimney) and `kit.props.drone` (quadcopter with spinning rotors and a hover bob).
 */
import { z } from 'zod';
import { hashCell } from '../env/shared.js';
import { defineProp } from '../registry.js';
import type { KitObject } from '../object.js';
import {
  asProp,
  colorField,
  DARK,
  DARKEST,
  finiteArg,
  gridPoint,
  METAL,
  PAPER,
  pick,
  propShell,
  RED,
  scaleParam,
  seedParam,
  setAnchors,
  SMALL_VOXEL,
} from './shared.js';
import { Sketch } from './sketch.js';

const HOUSE_VOXEL = 1 / 4;
const STOREY = 12;

export const houseParams = z.object({
  width: z.number().min(5).max(16).default(8).describe('Width (x) in units'),
  depth: z.number().min(5).max(14).default(7).describe('Depth (z) in units'),
  windows: z.number().min(0).max(1).default(0.5).describe('Share of lit windows'),
  wall: colorField('the walls (default: picked by seed)'),
  roof: colorField('the roof (default: picked by seed)'),
  seed: seedParam,
  scale: scaleParam,
});

type HouseSlot = 'wall' | 'roof' | 'trim' | 'glass' | 'lit' | 'door' | 'chimney' | 'step';

const HOUSE_WALLS = [
  PAPER,
  ['slateGrey', 'ash', 'ice', 'textDim'],
  ['slateBlue', 'steel', 'cornflower', 'accent1'],
];
const HOUSE_ROOFS = [RED, DARK, ['violet', 'blood', 'mauve', 'accent4']];

export const house = defineProp({
  name: 'house',
  description:
    'Two-storey suburban house (default 8 x 7 units, ridge ~9.5 high) with a gable roof, framed windows lit by seed, a front door with a step (+z) and a chimney. Neighbourhoods, "at home", break-ins. Static.',
  params: houseParams,
  anchors: { door: 'bottom centre of the front door (+z)', ridge: 'middle of the roof ridge' },
  build(params, tools) {
    const seed = Math.imul(params.seed, 0x9e3779b1) >>> 0;
    const w = Math.round(params.width / HOUSE_VOXEL);
    const d = Math.round(params.depth / HOUSE_VOXEL);
    const eaves = 2 * STOREY;
    const half = Math.ceil(d / 2);
    const pickFrom = (lists: readonly (readonly string[])[], salt: number) =>
      lists[Math.floor(hashCell(salt, 3, 9, seed) * lists.length)] ?? lists[0] ?? PAPER;
    const sketch = new Sketch<HouseSlot>([w + 2, eaves + half + 6, d + 3], {
      wall: pick(tools, params.wall, pickFrom(HOUSE_WALLS, 1)),
      roof: pick(tools, params.roof, pickFrom(HOUSE_ROOFS, 2)),
      trim: pick(tools, undefined, PAPER),
      glass: pick(tools, undefined, ['navy', 'black', 'night', 'shadow']),
      lit: { color: 'keyLight', glow: true },
      door: pick(tools, undefined, DARKEST),
      chimney: pick(tools, undefined, DARK),
      step: pick(tools, undefined, METAL),
    });
    const roofAt = (z: number) => eaves + Math.min(z, d + 1 - z);
    for (let z = 1; z <= d; z += 1) sketch.box('wall', [1, 0, z], [w + 1, roofAt(z), z + 1]);
    for (let z = 0; z <= d + 1; z += 1) {
      const y = roofAt(z) - 1;
      sketch.box('roof', [0, y, z], [w + 2, y + 2, z + 1]);
    }
    let window = 0;
    /** A framed window centred at x (front, axis 'z') or z (sides, axis 'x'). */
    const frame = (x: number, y: number, z: number, face: 'front' | 'side'): void => {
      const slot = hashCell(window, 4, 2, seed) < params.windows ? 'lit' : 'glass';
      window += 1;
      if (face === 'front') {
        sketch.box('trim', [x - 3, y - 1, z], [x + 3, y + 5, z + 1]);
        sketch.box(slot, [x - 2, y, z], [x + 2, y + 4, z + 1]);
      } else {
        sketch.box('trim', [x, y - 1, z - 3], [x + 1, y + 5, z + 3]);
        sketch.box(slot, [x, y, z - 2], [x + 1, y + 4, z + 2]);
      }
    };
    const front = d;
    const cx = Math.floor(w / 2) + 1;
    for (const x of [Math.round(w * 0.22) + 1, Math.round(w * 0.78) + 1])
      frame(x, 3, front, 'front');
    for (const x of [Math.round(w * 0.2) + 1, cx, Math.round(w * 0.8) + 1])
      frame(x, STOREY + 3, front, 'front');
    for (const x of [1, w]) {
      for (const y of [3, STOREY + 3]) frame(x, y, Math.round(d / 2) + 1, 'side');
    }
    sketch.box('door', [cx - 2, 0, front], [cx + 2, 9, front + 1]);
    sketch.box('trim', [cx - 3, 9, front], [cx + 3, 10, front + 1]);
    sketch.box('step', [cx - 4, 0, front + 1], [cx + 4, 1, front + 2]);
    const chimneyZ = Math.round(d * 0.3);
    sketch.box(
      'chimney',
      [w - 5, roofAt(chimneyZ) - 2, chimneyZ],
      [w - 2, eaves + half + 4, chimneyZ + 3],
    );
    const shell = propShell(tools, 'house', HOUSE_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    setAnchors(shell.object, {
      door: gridPoint(body, [cx, 0, front + 1]),
      ridge: gridPoint(body, [w / 2 + 1, roofAt(half) + 1, half]),
    });
    return asProp(shell.object, {});
  },
});

export const droneParams = z.object({
  hover: z.boolean().default(true).describe('Gentle hover bob in update(t)'),
  body: colorField('the body'),
  scale: scaleParam,
});

type DroneSlot = 'body' | 'arm' | 'motor' | 'lens' | 'front' | 'back';

export const drone = defineProp({
  name: 'drone',
  description:
    'Quadcopter drone (~0.9 units across) with four rotors that spin as a function of t, a camera pod and nav lights (green front, red back); hovers gently. Surveillance, deliveries, "eyes in the sky". Call drone.update(t) every frame.',
  params: droneParams,
  anchors: { camera: 'camera lens (faces +z, below the body)' },
  methods: {
    'update(t)': 'spins the rotors and bobs (hover) for time t',
    'spin(t)': 'rotor angles for time t only (no bob)',
  },
  build(params, tools) {
    const sketch = new Sketch<DroneSlot>([30, 8, 30], {
      body: pick(tools, params.body, DARK),
      arm: pick(tools, undefined, DARKEST),
      motor: pick(tools, undefined, METAL),
      lens: { color: 'accent1', glow: true },
      front: { color: pick(tools, undefined, ['green', 'teal', 'mint', 'accent3']), glow: true },
      back: { color: pick(tools, undefined, RED), glow: true },
    });
    sketch.box('body', [10, 3, 10], [20, 6, 20]).box('arm', [11, 6, 11], [19, 7, 19]);
    const motors = [3, 26].flatMap((x) => [3, 26].map((z) => [x, z] as const));
    for (const [mx, mz] of motors) {
      for (let step = 0; step <= 12; step += 1) {
        const x = Math.round(14 + ((mx - 14) * step) / 12);
        const z = Math.round(14 + ((mz - 14) * step) / 12);
        sketch.box('arm', [x, 4, z], [x + 2, 5, z + 2]);
      }
    }
    for (const [x, z] of motors) sketch.box('motor', [x - 1, 4, z - 1], [x + 2, 7, z + 2]);
    sketch.box('arm', [13, 1, 17], [17, 3, 20]).box('lens', [14, 1, 20], [16, 3, 21]);
    sketch.paint('front', [14, 4, 19], [16, 5, 20]).paint('back', [14, 4, 10], [16, 5, 11]);
    const shell = propShell(tools, 'drone', SMALL_VOXEL, params.scale);
    const frame = tools.voxel.group();
    shell.object.add(frame);
    const body = tools.voxel.mesh(sketch.model(tools.voxel), { voxelSize: SMALL_VOXEL });
    frame.add(body);
    const blade = tools.voxel.box(
      [13, 1, 1],
      pick(tools, undefined, ['slateGrey', 'ash', 'ice', 'textDim']),
    );
    const rotors: KitObject[] = motors.map(([x, z]) => {
      const rotor = tools.voxel.mesh(blade, { voxelSize: SMALL_VOXEL, pivot: [6.5, 0, 0.5] });
      rotor.position.set(...gridPoint(body, [x + 0.5, 7, z + 0.5]));
      frame.add(rotor);
      return rotor;
    });
    setAnchors(shell.object, { camera: gridPoint(body, [15, 2, 21]) });
    const spin = (t: number): void => {
      const time = finiteArg('drone.spin(t)', t);
      rotors.forEach((rotor, index) => {
        rotor.rotation.y = (index % 3 === 0 ? 1 : -1) * time * 31 + index;
      });
    };
    spin(0);
    return asProp(shell.object, { spin }, (t) => {
      spin(t);
      frame.position.y = params.hover ? 0.04 * Math.sin(t * 2.4) : 0;
      frame.rotation.z = params.hover ? 0.03 * Math.sin(t * 1.3) : 0;
    });
  },
});

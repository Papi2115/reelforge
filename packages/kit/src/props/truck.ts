/**
 * `kit.props.truck`: a rigid truck facing +z (cab in front) with a box body, a flatbed sized
 * for `kit.props.container()` (container.on(truck, { at: 'cargo' })) or a tank; three axles
 * roll with `truck.drive(t, speed)`.
 */
import { z } from 'zod';
import { defineProp } from '../registry.js';
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
  scaleParam,
  setAnchors,
} from './shared.js';
import { Sketch } from './sketch.js';
import {
  addWheels,
  cutArches,
  driveHooks,
  driveMethods,
  GLASS,
  lightColors,
  speedParam,
  VEHICLE_VOXEL,
  WHITE,
  type DriveMethods,
} from './vehicle-parts.js';

const WIDTH = 24;
const LENGTH = 100;
const WHEEL = 5;
const AXLES = [14, 26, 88] as const;
const CAB = 76;
const DECK = 10;
const HEIGHT = 36;

type Slot = 'paint' | 'body' | 'stripe' | 'trim' | 'metal' | 'glass' | 'head' | 'tail' | 'deck';

export const truckParams = z.object({
  body: z
    .enum(['box', 'flatbed', 'tanker'])
    .default('box')
    .describe('box (cargo box), flatbed (fits kit.props.container on `cargo`) or tanker'),
  paint: colorField('the cab'),
  stripe: colorField('the box stripe'),
  speed: speedParam,
  scale: scaleParam,
});

function cab(sketch: Sketch<Slot>): void {
  const front = LENGTH - 2;
  sketch.box('paint', [1, 7, CAB], [WIDTH - 1, 20, front]);
  sketch.box('paint', [2, 20, CAB + 1], [WIDTH - 2, 31, front - 1]);
  sketch.box('trim', [2, 31, CAB + 1], [WIDTH - 2, 32, front - 3]);
  sketch.paint('glass', [3, 21, front - 2], [WIDTH - 3, 29, front - 1]);
  sketch.paint('glass', [2, 22, front - 10], [WIDTH - 2, 29, front - 3]);
  sketch.paint('trim', [6, 9, front - 1], [WIDTH - 6, 19, front]);
  for (let y = 10; y < 19; y += 2)
    sketch.paint('metal', [6, y, front - 1], [WIDTH - 6, y + 1, front]);
  sketch.box('metal', [1, 4, front], [WIDTH - 1, 8, LENGTH]);
  for (const x of [2, WIDTH - 5]) sketch.paint('head', [x, 11, front - 1], [x + 3, 14, front]);
  for (const x of [0, WIDTH - 2]) sketch.box('trim', [x, 24, front - 4], [x + 2, 28, front - 3]);
  for (const x of [2, WIDTH - 4]) sketch.box('metal', [x, 16, CAB - 2], [x + 2, HEIGHT - 2, CAB]);
}

function cargo(sketch: Sketch<Slot>, body: string): void {
  const end = CAB - 3;
  sketch.box('deck', [1, 8, 2], [WIDTH - 1, DECK, end]);
  if (body === 'box') {
    sketch.box('body', [1, DECK, 2], [WIDTH - 1, HEIGHT - 2, end]);
    sketch.paint('stripe', [1, 14, 2], [WIDTH - 1, 17, end]);
    sketch.paint('trim', [WIDTH / 2, DECK, 2], [WIDTH / 2 + 1, HEIGHT - 2, 3]);
    for (const x of [1, WIDTH - 4]) sketch.paint('tail', [x, 9, 2], [x + 3, 11, 3]);
  } else if (body === 'tanker') {
    sketch.cylinderZ('metal', [WIDTH / 2, 21], 11, 4, end - 1);
    for (const z of [4, end - 2, 24, 48]) sketch.paint('trim', [0, 10, z], [WIDTH, 33, z + 1]);
    sketch.box('trim', [WIDTH / 2 - 2, 32, 10], [WIDTH / 2 + 2, 33, end - 8]);
    for (const x of [1, WIDTH - 4]) sketch.paint('tail', [x, 8, 2], [x + 3, 10, 3]);
  } else {
    for (const x of [1, WIDTH - 2]) sketch.box('trim', [x, DECK, 2], [x + 1, DECK + 1, end]);
    for (let z = 4; z < end; z += 6)
      sketch.paint('trim', [1, DECK - 1, z], [WIDTH - 1, DECK, z + 1]);
    for (const x of [1, WIDTH - 4]) sketch.paint('tail', [x, 8, 2], [x + 3, 10, 3]);
  }
}

export const truck = defineProp({
  name: 'truck',
  description:
    'Rigid truck (~8.3 x 2 units, 3 tall) facing +z: cab with grille and exhaust stacks plus a box body, a flatbed that fits kit.props.container() (container.on(truck, { at: "cargo" })) or a tank. Three axles roll with truck.drive(t, speed).',
  params: truckParams,
  anchors: {
    top: 'centre of the cab roof',
    cargo: 'centre of the load: flatbed deck, box roof or tank top',
  },
  methods: driveMethods,
  build(params, tools) {
    const lights = lightColors(tools);
    const colors: Record<Slot, VoxelColor> = {
      paint: pick(tools, params.paint, ['hero']),
      body: pick(tools, undefined, WHITE),
      stripe: pick(tools, params.stripe, ['brightTeal', 'teal', 'sage', 'accent1']),
      trim: pick(tools, undefined, DARKEST),
      metal: pick(tools, undefined, METAL),
      glass: pick(tools, undefined, GLASS),
      head: lights.head,
      tail: lights.tail,
      deck: pick(tools, undefined, DARK),
    };
    const sketch = new Sketch<Slot>([WIDTH, HEIGHT, LENGTH], colors);
    sketch.box('trim', [3, 5, 2], [WIDTH - 3, 8, LENGTH - 2]);
    cab(sketch);
    cargo(sketch, params.body);
    cutArches(
      sketch,
      AXLES.map((z) => [z, WHEEL] as const),
      WHEEL + 1,
      [
        [0, 6],
        [WIDTH - 6, WIDTH],
      ],
    );
    const shell = propShell(tools, 'truck', VEHICLE_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    const wheels = AXLES.flatMap((z) => [
      { x: 3, y: WHEEL, z },
      { x: WIDTH - 3, y: WHEEL, z },
    ]);
    const roll = addWheels(tools, shell, body, wheels, WHEEL, 4);
    const load = params.body === 'box' ? HEIGHT - 2 : params.body === 'tanker' ? 33 : DECK;
    setAnchors(shell.object, {
      top: gridPoint(body, [WIDTH / 2, 32, CAB + 10]),
      cargo: gridPoint(body, [WIDTH / 2, load, (2 + CAB - 3) / 2]),
    });
    const methods: DriveMethods = driveHooks(roll, 'truck');
    return asProp(shell.object, methods, (t) => {
      methods.drive(t, params.speed);
    });
  },
});

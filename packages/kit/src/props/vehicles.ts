/**
 * `kit.props.car` (sedan, taxi, police) and `kit.props.van`: voxel road vehicles facing +z with
 * rolling wheels (`drive(t, speed)`), glowing head/tail lights and `top`/`cargo` anchors.
 */
import { z } from 'zod';
import { defineProp, type KitTools } from '../registry.js';
import type { VoxelColor } from '../voxel/model.js';
import {
  asProp,
  colorField,
  DARK,
  DARKEST,
  gridPoint,
  pick,
  propShell,
  RED,
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
  signColors,
  speedParam,
  VEHICLE_VOXEL,
  WHITE,
  type DriveMethods,
} from './vehicle-parts.js';

type Slot = 'paint' | 'trim' | 'glass' | 'head' | 'tail' | 'plate' | 'sign' | 'blue' | 'accent';

const CAR = { width: 20, length: 46, wheel: 4, axles: [9, 37] } as const;

export const carParams = z.object({
  style: z
    .enum(['sedan', 'taxi', 'police'])
    .default('sedan')
    .describe('sedan, taxi (yellow, roof sign) or police (two-tone, flashing light bar)'),
  paint: colorField('the body'),
  speed: speedParam,
  siren: z.boolean().default(true).describe('Police: the light bar flashes in update(t)'),
  scale: scaleParam,
});

function cabin(sketch: Sketch<Slot>, back: number, front: number, y0: number, y1: number): void {
  for (let y = y0; y < y1; y += 1) {
    const rise = y - y0;
    const z0 = back + Math.floor(rise * 0.8);
    const z1 = front - rise;
    sketch.box('paint', [2, y, z0], [CAR.width - 2, y + 1, z1]);
    if (y === y0 || y === y1 - 1) continue;
    sketch.paint('glass', [2, y, z0 + 1], [CAR.width - 2, y + 1, z1 - 1]);
    sketch.paint('glass', [3, y, z1 - 1], [CAR.width - 3, y + 1, z1]);
    sketch.paint('glass', [3, y, z0], [CAR.width - 3, y + 1, z0 + 1]);
    const pillar = Math.round((z0 + z1) / 2);
    sketch.paint('paint', [2, y, pillar], [CAR.width - 2, y + 1, pillar + 1]);
  }
}

function carSketch(colors: Record<Slot, VoxelColor>, style: string): Sketch<Slot> {
  const { width, length, wheel, axles } = CAR;
  const sketch = new Sketch<Slot>([width, 18, length], colors);
  sketch.box('paint', [1, 2, 1], [width - 1, 9, length - 1]);
  sketch
    .box('trim', [1, 2, 0], [width - 1, 4, 2])
    .box('trim', [1, 2, length - 2], [width - 1, 4, length]);
  cutArches(
    sketch,
    axles.map((z) => [z, wheel] as const),
    wheel + 1,
    [
      [0, 5],
      [width - 5, width],
    ],
  );
  cabin(sketch, 12, 35, 9, 15);
  for (const x of [2, width - 5]) {
    sketch.paint('head', [x, 6, length - 2], [x + 3, 8, length - 1]);
    sketch.paint('tail', [x, 6, 1], [x + 3, 8, 2]);
  }
  sketch.paint('trim', [6, 4, length - 2], [width - 6, 7, length - 1]);
  sketch.paint('plate', [8, 4, 1], [width - 8, 6, 2]);
  for (const x of [1, width - 2]) sketch.paint('trim', [x, 3, 24], [x + 1, 9, 25]);
  sketch.box('paint', [0, 8, 32], [width, 9, 33]);
  if (style === 'taxi') {
    sketch
      .box('trim', [7, 15, 21], [width - 7, 16, 26])
      .box('sign', [8, 16, 22], [width - 8, 17, 25]);
    for (let z = 4; z < length - 4; z += 2) {
      for (const x of [1, width - 2]) sketch.paint('trim', [x, 6, z], [x + 1, 7, z + 1]);
    }
  } else if (style === 'police') {
    sketch.paint('plate', [1, 2, 14], [width - 1, 8, 34]);
    sketch.box('trim', [5, 15, 21], [width - 5, 16, 26]);
  }
  return sketch;
}

export const car = defineProp({
  name: 'car',
  description:
    'Voxel car (~4 x 1.7 units, 1.5 tall; a 2-unit person stands taller) facing +z: sedan, taxi or police with a flashing light bar. Wheels roll with car.drive(t, speed), which returns the distance to move it by. Rotate (rotation.y = Math.PI / 2) to drive across the screen.',
  params: carParams,
  anchors: {
    top: 'centre of the roof',
    cargo: 'top of the trunk lid',
    hood: 'top of the hood',
  },
  methods: {
    ...driveMethods,
    'update(t)': 'drive(t, speed param); police lights flash',
  },
  build(params, tools) {
    const style = params.style;
    const paintChain =
      style === 'taxi'
        ? (['gold', 'gold', 'peach', 'keyLight'] as const)
        : style === 'police'
          ? DARKEST
          : RED;
    const { sign, blue } = signColors(tools);
    const lights = lightColors(tools);
    const colors: Record<Slot, VoxelColor> = {
      paint: pick(tools, params.paint, paintChain),
      trim: pick(tools, undefined, style === 'police' ? DARK : DARKEST),
      glass: pick(tools, undefined, GLASS),
      head: lights.head,
      tail: lights.tail,
      plate: pick(tools, undefined, WHITE),
      sign,
      blue,
      accent: pick(tools, undefined, RED),
    };
    const shell = propShell(tools, 'car', VEHICLE_VOXEL, params.scale);
    const body = shell.mesh(carSketch(colors, style));
    const wheels = CAR.axles.flatMap((z) => [
      { x: 2.5, y: CAR.wheel, z },
      { x: CAR.width - 2.5, y: CAR.wheel, z },
    ]);
    const roll = addWheels(tools, shell, body, wheels, CAR.wheel);
    const bar = style === 'police' ? policeBar(tools, colors) : [];
    for (const mesh of bar) {
      mesh.position.set(...gridPoint(body, [CAR.width / 2, 16, 23.5]));
      shell.object.add(mesh);
    }
    const flash = (t: number): void => {
      const phase = Math.floor(t * 6) % 2;
      bar.forEach((mesh, index) => {
        mesh.visible = !params.siren || phase === index;
      });
    };
    flash(0);
    setAnchors(shell.object, {
      top: gridPoint(body, [CAR.width / 2, 15, 23.5]),
      cargo: gridPoint(body, [CAR.width / 2, 9, 5]),
      hood: gridPoint(body, [CAR.width / 2, 9, 40]),
    });
    const methods: DriveMethods = driveHooks(roll, 'car');
    return asProp(shell.object, methods, (t) => {
      methods.drive(t, params.speed);
      flash(t);
    });
  },
});

/** Red and blue halves of the police light bar (flashing alternately). */
function policeBar(tools: KitTools, colors: Record<Slot, VoxelColor>) {
  return (['accent', 'blue'] as const).map((slot, index) => {
    const model = tools.voxel.box([4, 1, 3], colors[slot]);
    const mesh = tools.voxel.mesh(model, {
      voxelSize: VEHICLE_VOXEL,
      pivot: [index === 0 ? 4.5 : -0.5, 0, 1.5],
    });
    return mesh;
  });
}

const VAN = { width: 20, length: 50, wheel: 4, axles: [10, 40] } as const;

export const vanParams = z.object({
  paint: colorField('the body'),
  stripe: colorField('the side stripe'),
  speed: speedParam,
  scale: scaleParam,
});

function vanSketch(colors: Record<Slot, VoxelColor>): Sketch<Slot> {
  const { width, length, wheel, axles } = VAN;
  const sketch = new Sketch<Slot>([width, 25, length], colors);
  sketch.box('paint', [1, 2, 1], [width - 1, 13, length - 1]);
  for (let y = 13; y < 24; y += 1) {
    const front = length - 1 - Math.round((y - 13) * 0.7);
    sketch.box('paint', [1, y, 1], [width - 1, y + 1, front]);
    if (y > 13 && y < 21) {
      sketch.paint('glass', [2, y, front - 1], [width - 2, y + 1, front]);
      sketch.paint('glass', [1, y, front - 9], [width - 1, y + 1, front - 2]);
    }
  }
  sketch
    .box('trim', [1, 2, 0], [width - 1, 4, 2])
    .box('trim', [1, 2, length - 2], [width - 1, 4, length]);
  cutArches(
    sketch,
    axles.map((z) => [z, wheel] as const),
    wheel + 1,
    [
      [0, 5],
      [width - 5, width],
    ],
  );
  sketch.paint('accent', [1, 9, 2], [width - 1, 11, length - 10]);
  for (const x of [2, width - 5]) {
    sketch.paint('head', [x, 6, length - 2], [x + 3, 8, length - 1]);
    sketch.paint('tail', [x, 6, 1], [x + 3, 9, 2]);
  }
  sketch.paint('trim', [6, 4, length - 2], [width - 6, 7, length - 1]);
  sketch.paint('trim', [width / 2, 4, 1], [width / 2 + 1, 22, 2]);
  for (const z of [16, 32]) sketch.paint('trim', [width - 2, 3, z], [width - 1, 21, z + 1]);
  return sketch;
}

export const van = defineProp({
  name: 'van',
  description:
    'Boxy delivery van (~4.2 x 1.7 units, 2 tall) facing +z with a side stripe, rear doors and rolling wheels (van.drive(t, speed)). For couriers, stake-outs, "the van outside".',
  params: vanParams,
  anchors: { top: 'centre of the roof', cargo: 'centre of the roof (roof rack)' },
  methods: driveMethods,
  build(params, tools) {
    const lights = lightColors(tools);
    const colors: Record<Slot, VoxelColor> = {
      paint: pick(tools, params.paint, WHITE),
      trim: pick(tools, undefined, DARKEST),
      glass: pick(tools, undefined, GLASS),
      head: lights.head,
      tail: lights.tail,
      plate: pick(tools, undefined, WHITE),
      sign: lights.head,
      blue: lights.head,
      accent: pick(tools, params.stripe, ['hero']),
    };
    const shell = propShell(tools, 'van', VEHICLE_VOXEL, params.scale);
    const body = shell.mesh(vanSketch(colors));
    const wheels = VAN.axles.flatMap((z) => [
      { x: 2.5, y: VAN.wheel, z },
      { x: VAN.width - 2.5, y: VAN.wheel, z },
    ]);
    const roll = addWheels(tools, shell, body, wheels, VAN.wheel);
    const roof = gridPoint(body, [VAN.width / 2, 24, VAN.length / 2 - 4]);
    setAnchors(shell.object, { top: roof, cargo: roof });
    const methods: DriveMethods = driveHooks(roll, 'van');
    return asProp(shell.object, methods, (t) => {
      methods.drive(t, params.speed);
    });
  },
});

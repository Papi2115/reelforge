/**
 * Shared parts of the vehicles (PLAN.md#3.3, batch B): wheels that roll as a pure function of
 * the distance driven, the drive/roll hooks, colour chains and the vehicle voxel size. Vehicles
 * face +z (front = the `front` anchor); rotate them (rotation.y = Math.PI / 2 drives along +x).
 */
import { z } from 'zod';
import type { KitObject } from '../object.js';
import type { KitTools } from '../registry.js';
import type { VoxelColor } from '../voxel/model.js';
import { CHARACTER_VOXEL } from './character-rig.js';
import {
  DARK,
  DARKEST,
  finiteArg,
  GOLD,
  gridPoint,
  METAL,
  pick,
  RED,
  type PropShell,
} from './shared.js';
import { Sketch } from './sketch.js';
import type { VoxelObject } from '../voxel/mesh.js';

/** Vehicles share the character's voxel (a 2-unit person next to a 4-unit car). */
export const VEHICLE_VOXEL = CHARACTER_VOXEL;

export const GLASS = ['teal', 'tealDark', 'cornflower', 'accent1'] as const;
export const WHITE = ['cream', 'bone', 'cream', 'heroTrim'] as const;

export const speedParam = z
  .number()
  .min(-60)
  .max(60)
  .default(0)
  .describe('Driving speed in units/s used by update(t) (wheels roll; 0 = parked)');

export const driveMethods = {
  'drive(t, speed)':
    'rolls the wheels for t seconds at speed units/s and returns the distance t * speed (move the vehicle by it along +z)',
  'roll(distance)': 'wheel angle for an absolute distance driven',
  'update(t)': 'drive(t, speed param)',
} as const;

export interface DriveMethods {
  roll(distance: number): void;
  drive(t: number, speed?: number): number;
}

/** Common light colours (headlights warm white, tail lights red), unlit. */
export function lightColors(tools: KitTools): { head: VoxelColor; tail: VoxelColor } {
  return {
    head: { color: pick(tools, undefined, ['cream', 'gold', 'cream', 'keyLight']), glow: true },
    tail: { color: pick(tools, undefined, RED), glow: true },
  };
}

type WheelSlot = 'tyre' | 'hub' | 'mark';

/** A wheel `width` voxels thick (axle along x) with a two-tone hub so the spin reads. */
function wheelModel(tools: KitTools, radius: number, width: number) {
  const size = radius * 2;
  const sketch = new Sketch<WheelSlot>([width, size, size], {
    tyre: pick(tools, undefined, DARKEST),
    hub: pick(tools, undefined, METAL),
    mark: pick(tools, undefined, DARK),
  });
  sketch.cylinderX('tyre', [radius, radius], radius, 0, width);
  const hub = Math.max(1.2, radius * 0.55);
  for (const x of [0, width - 1]) {
    sketch.cylinderX('hub', [radius, radius], hub, x, x + 1);
    sketch.box('mark', [x, radius, radius - 1], [x + 1, radius + Math.ceil(hub), radius]);
    sketch.box('mark', [x, radius - Math.ceil(hub), radius], [x + 1, radius, radius + 1]);
  }
  return sketch.model(tools.voxel);
}

export interface WheelSpec {
  /** Body grid point of the wheel centre (x = outer face side). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Adds wheels (one group per wheel, spinning about x) to the shell and returns the roll
 * function: angle = distance / radius, so a point on the tyre never slides.
 */
export function addWheels(
  tools: KitTools,
  shell: PropShell,
  body: VoxelObject,
  wheels: readonly WheelSpec[],
  radius: number,
  width = 3,
): (distance: number) => void {
  const model = wheelModel(tools, radius, width);
  const groups: KitObject[] = wheels.map((spec) => {
    const group = tools.voxel.group();
    group.position.set(...gridPoint(body, [spec.x, spec.y, spec.z]));
    group.add(
      tools.voxel.mesh(model, { voxelSize: VEHICLE_VOXEL, pivot: [width / 2, radius, radius] }),
    );
    shell.object.add(group);
    return group;
  });
  const unit = radius * VEHICLE_VOXEL;
  return (distance) => {
    const angle = finiteArg('roll(distance)', distance) / unit;
    for (const group of groups) group.rotation.x = angle;
  };
}

/** drive/roll hooks around a roll function. */
export function driveHooks(roll: (distance: number) => void, kitType: string): DriveMethods {
  return {
    roll,
    drive(t, speed = 1) {
      const distance =
        finiteArg(`${kitType}.drive(t)`, t) * finiteArg(`${kitType}.drive(speed)`, speed);
      roll(distance);
      return distance;
    },
  };
}

/** Wheel arches: clears a cylinder around each wheel through the body's side walls. */
export function cutArches<Slot extends string>(
  sketch: Sketch<Slot>,
  centres: readonly (readonly [number, number])[],
  radius: number,
  sides: readonly (readonly [number, number])[],
): void {
  for (const centre of centres) {
    for (const [x0, x1] of sides) sketch.cylinderX(null, centre, radius, x0, x1);
  }
}

/** Taxi roof sign / police bar colours. */
export function signColors(tools: KitTools): { sign: VoxelColor; blue: VoxelColor } {
  return {
    sign: { color: pick(tools, undefined, GOLD), glow: true },
    blue: {
      color: pick(tools, undefined, ['brightTeal', 'teal', 'cornflower', 'accent1']),
      glow: true,
    },
  };
}

/**
 * `kit.props.clock`: a round wall clock or a twin-bell alarm clock with hour, minute and (ticking)
 * second hands. The time is a pure function: `clock.setTime(h, m, s)` or `clock.update(t)` =
 * the start time plus t * speed seconds.
 */
import { z } from 'zod';
import { defineProp } from '../registry.js';
import type { VoxelObject } from '../voxel/mesh.js';
import {
  asProp,
  colorField,
  DARK,
  DARKEST,
  finiteArg,
  GOLD,
  gridPoint,
  INK,
  METAL,
  PAPER,
  pick,
  propShell,
  scaleParam,
  setAnchors,
  SMALL_VOXEL,
} from './shared.js';
import { Sketch } from './sketch.js';

const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const SECONDS_PER_DAY = 86_400;
const FACE_RADIUS = 11;

export const clockParams = z.object({
  style: z
    .enum(['wall', 'alarm'])
    .default('wall')
    .describe('wall (round, faces +z) or alarm (desk clock with bells and feet)'),
  time: z
    .string()
    .regex(TIME_PATTERN, 'use "HH:MM" or "HH:MM:SS"')
    .default('10:10')
    .describe('Time shown at t = 0, "HH:MM" or "HH:MM:SS"'),
  speed: z
    .number()
    .min(-100_000)
    .max(100_000)
    .default(1)
    .describe(
      'Clock seconds per scene second in update(t) (3600 = an hour per second; 0 = frozen)',
    ),
  frame: colorField('the frame/body'),
  scale: scaleParam,
});

type ClockSlot = 'frame' | 'face' | 'tick' | 'bell' | 'foot';

interface HandSpec {
  readonly width: number;
  /** Voxels from the centre to the tip (plus a 1-voxel tail behind the centre). */
  readonly length: number;
  readonly color: string;
  /** Depth layer in front of the dial (0 = touching it). */
  readonly layer: number;
}

/** "HH:MM[:SS]" (validated by the schema) -> seconds. */
function parseTime(text: string): number {
  const match = TIME_PATTERN.exec(text);
  const [hours, minutes, seconds] = [match?.[1], match?.[2], match?.[3]].map((part) =>
    Number(part ?? 0),
  );
  return (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0);
}

function dial(
  sketch: Sketch<ClockSlot>,
  centre: readonly [number, number],
  front: number,
  depth: number,
): void {
  sketch.cylinderZ('frame', centre, FACE_RADIUS + 3, 0, depth);
  sketch
    .cylinderZ(null, centre, FACE_RADIUS, front, depth)
    .cylinderZ('face', centre, FACE_RADIUS, front - 1, front);
  for (let hour = 0; hour < 12; hour += 1) {
    const angle = (hour / 12) * Math.PI * 2;
    const marks = hour % 3 === 0 ? 3 : 2;
    for (let step = 0; step < marks; step += 1) {
      const radius = FACE_RADIUS - 1.5 - step;
      const x = Math.floor(centre[0] + Math.sin(angle) * radius);
      const y = Math.floor(centre[1] + Math.cos(angle) * radius);
      sketch.paint('tick', [x, y, front - 1], [x + 1, y + 1, front]);
    }
  }
}

function alarmParts(
  sketch: Sketch<ClockSlot>,
  centre: readonly [number, number],
  height: number,
  depth: number,
): void {
  for (const side of [-1, 1]) {
    const bx = centre[0] + side * 8;
    sketch.cylinderZ('bell', [bx, centre[1] + FACE_RADIUS + 2], 4, 2, depth - 2);
    sketch.box('foot', [bx - 1, 0, 2], [bx + 1, 8, depth - 2]);
  }
  sketch.box('bell', [centre[0] - 1, height - 7, 3], [centre[0] + 1, height, depth - 3]);
  sketch.box('bell', [centre[0] - 3, height - 2, 3], [centre[0] + 3, height, depth - 3]);
}

export const clock = defineProp({
  name: 'clock',
  description:
    'Clock with hour, minute and ticking second hands: a round wall clock (~0.9 units) or an alarm clock with twin bells. clock.setTime(h, m, s) poses the hands; clock.update(t) runs from the start time at `speed`. For deadlines, countdowns, "hours later".',
  params: clockParams,
  anchors: { face: 'centre of the dial (faces +z)' },
  methods: {
    'setTime(hours, minutes, seconds)':
      'poses the hands (fractions allowed); call every frame when animating',
    'update(t)': 'setTime(start time + t * speed seconds)',
  },
  build(params, tools) {
    const alarm = params.style === 'alarm';
    const diameter = 2 * FACE_RADIUS + 6;
    const height = alarm ? diameter + 9 : diameter;
    const depth = alarm ? 9 : 6;
    const front = depth - 3;
    const centre: readonly [number, number] = [
      diameter / 2,
      alarm ? diameter / 2 + 3 : diameter / 2,
    ];
    const sketch = new Sketch<ClockSlot>([diameter, height, depth], {
      frame: pick(tools, params.frame, alarm ? ['accent2'] : DARK),
      face: pick(tools, undefined, PAPER),
      tick: pick(tools, undefined, INK),
      bell: pick(tools, undefined, alarm ? GOLD : METAL),
      foot: pick(tools, undefined, DARKEST),
    });
    dial(sketch, centre, front, depth);
    if (alarm) alarmParts(sketch, centre, height, depth);
    const shell = propShell(tools, 'clock', SMALL_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    const handColor = pick(tools, undefined, DARKEST);
    const specs: readonly HandSpec[] = [
      { width: 2, length: FACE_RADIUS - 5, color: handColor, layer: 0 },
      { width: 1, length: FACE_RADIUS - 2, color: handColor, layer: 1 },
      { width: 1, length: FACE_RADIUS - 1, color: 'hero', layer: 2 },
    ];
    const hands: VoxelObject[] = specs.map((spec) => {
      const model = tools.voxel.box([spec.width, spec.length + 1, 1], spec.color);
      const mesh = tools.voxel.mesh(model, {
        voxelSize: SMALL_VOXEL,
        pivot: [spec.width / 2, 1, 0],
      });
      mesh.position.set(...gridPoint(body, [centre[0], centre[1], front + spec.layer]));
      shell.object.add(mesh);
      return mesh;
    });
    const start = parseTime(params.time);
    const setTime = (hours: number, minutes = 0, seconds = 0): void => {
      const total =
        finiteArg('clock.setTime(hours)', hours) * 3600 +
        finiteArg('clock.setTime(minutes)', minutes) * 60 +
        finiteArg('clock.setTime(seconds)', seconds);
      const day = ((total % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
      const turns = [(day / 43_200) % 1, (day / 3600) % 1, Math.floor(day % 60) / 60];
      hands.forEach((mesh, index) => {
        mesh.rotation.z = -2 * Math.PI * (turns[index] ?? 0);
      });
    };
    setTime(0, 0, start);
    setAnchors(shell.object, { face: gridPoint(body, [centre[0], centre[1], front]) });
    const methods: { setTime(hours: number, minutes?: number, seconds?: number): void } = {
      setTime,
    };
    return asProp(shell.object, methods, (t) => {
      setTime(0, 0, start + t * params.speed);
    });
  },
});

/**
 * `kit.props.globe`: a desk globe - a voxel ball painted from a coarse world map, tilted on a
 * half-meridian arc over a round base. `globe.spin(angle)` / `globe.update(t)` turn the ball
 * about its tilted axis as a pure function of t.
 */
import { z } from 'zod';
import { hashCell } from '../env/shared.js';
import { defineProp } from '../registry.js';
import {
  asProp,
  colorField,
  DARKEST,
  finiteArg,
  gridPoint,
  LAND,
  METAL,
  PAPER,
  pick,
  propShell,
  scaleParam,
  setAnchors,
  SMALL_VOXEL,
} from './shared.js';
import { Sketch } from './sketch.js';

/** Equirectangular world map, 10 degrees per cell: columns lon -180..180, rows lat 90..-90. */
const WORLD = [
  '....................................',
  '......#####...######...#########....',
  '..##########..#####..##############.',
  '..###########.###...################',
  '....#########......#################',
  '.....########.....##################',
  '......######.....##############.##..',
  '.......###.......#############..#...',
  '.........##.....########....##.##...',
  '..........####...######......###....',
  '..........#####..#####.........#....',
  '...........####..####.......#####...',
  '...........###....##........####....',
  '...........##.......................',
  '............#.......................',
  '....................................',
  '....................................',
  '####################################',
];
const RADIUS = 11;
const BALL = 2 * RADIUS;

export const globeParams = z.object({
  speed: z
    .number()
    .min(-20)
    .max(20)
    .default(0.5)
    .describe('Spin in radians per second in update(t)'),
  angle: z.number().default(0).describe('Spin angle at t = 0, radians'),
  tilt: z.number().min(-45).max(45).default(23.4).describe('Axis tilt in degrees'),
  sea: colorField('the oceans'),
  land: colorField('the continents'),
  stand: colorField('the arc and base'),
  scale: scaleParam,
});

type BallSlot = 'sea' | 'land' | 'landAlt' | 'ice';
type StandSlot = 'stand' | 'base';

function isLand(latitude: number, longitude: number): boolean {
  const row = Math.min(WORLD.length - 1, Math.floor(((90 - latitude) / 180) * WORLD.length));
  const line = WORLD[row] ?? '';
  const column = Math.min(line.length - 1, Math.floor(((longitude + 180) / 360) * line.length));
  return line[column] === '#';
}

function ball(sketch: Sketch<BallSlot>): void {
  for (let z = 0; z < BALL; z += 1) {
    for (let y = 0; y < BALL; y += 1) {
      for (let x = 0; x < BALL; x += 1) {
        const [dx, dy, dz] = [x + 0.5 - RADIUS, y + 0.5 - RADIUS, z + 0.5 - RADIUS];
        const distance = Math.hypot(dx, dy, dz);
        if (distance > RADIUS) continue;
        const latitude = (Math.asin(dy / distance) * 180) / Math.PI;
        const longitude = (Math.atan2(dx, dz) * 180) / Math.PI;
        let slot: BallSlot = 'sea';
        if (Math.abs(latitude) > 70) slot = 'ice';
        else if (isLand(latitude, longitude))
          slot = hashCell(x, y, z, 31) < 0.12 ? 'landAlt' : 'land';
        sketch.set(slot, x, y, z);
      }
    }
  }
}

/** Base disc, a short column and a half-meridian arc (in the x-y plane, tilted) holding the poles. */
function stand(
  sketch: Sketch<StandSlot>,
  centre: readonly [number, number, number],
  tilt: number,
): void {
  const [cx, cy, cz] = centre;
  sketch.cylinderY('base', [cx, cz], 8, 0, 2).cylinderY('stand', [cx, cz], 2, 2, 4);
  const arc = RADIUS + 2.5;
  const axis = [-Math.sin(tilt), Math.cos(tilt)] as const;
  const side = [Math.cos(tilt), Math.sin(tilt)] as const;
  const z0 = Math.floor(cz) - 1;
  /** A 2x2x2 block centred on (px, py): consecutive dots always share faces. */
  const dot = (px: number, py: number): void => {
    const [x, y] = [Math.round(px) - 1, Math.round(py) - 1];
    sketch.box('stand', [x, y, z0], [x + 2, y + 2, z0 + 2]);
  };
  for (let step = 0; step <= 160; step += 1) {
    const phi = (step / 160) * Math.PI;
    const ax = Math.cos(phi) * axis[0] + Math.sin(phi) * side[0];
    const ay = Math.cos(phi) * axis[1] + Math.sin(phi) * side[1];
    dot(cx + arc * ax, cy + arc * ay);
  }
  for (const sign of [-1, 1]) {
    for (let r = RADIUS - 0.5; r <= arc; r += 0.5)
      dot(cx + sign * r * axis[0], cy + sign * r * axis[1]);
  }
  const foot = cx - arc * axis[0];
  for (let y = 3; y <= cy - arc * axis[1]; y += 0.5) dot(foot, y);
  for (let x = Math.min(foot, cx); x <= Math.max(foot, cx); x += 0.5) dot(x, 3);
}

export const globe = defineProp({
  name: 'globe',
  description:
    'Desk globe (~1 unit tall): a voxel Earth (oceans, continents, polar ice) tilted on a meridian arc over a round base. globe.update(t) spins it at `speed`; globe.spin(angle) sets the angle. For world, travel, global reach.',
  params: globeParams,
  anchors: { ball: 'centre of the ball' },
  methods: {
    'spin(angle)': 'sets the spin angle in radians (about the tilted axis)',
    'update(t)': 'spin(angle + speed * t)',
  },
  build(params, tools) {
    const tilt = (params.tilt * Math.PI) / 180;
    const size = BALL + 10;
    const centre = [size / 2, 4 + RADIUS + 4, 7] as const;
    const standSketch = new Sketch<StandSlot>([size, Math.ceil(centre[1] + RADIUS + 4), 14], {
      stand: pick(tools, params.stand, METAL),
      base: pick(tools, undefined, DARKEST),
    });
    stand(standSketch, centre, tilt);
    const ballSketch = new Sketch<BallSlot>([BALL, BALL, BALL], {
      sea: pick(tools, params.sea, ['slateBlue', 'tealDark', 'cornflower', 'accent1']),
      land: pick(tools, params.land, LAND),
      landAlt: pick(tools, undefined, ['brightTeal', 'teal', 'olive', 'accent1']),
      ice: pick(tools, undefined, PAPER),
    });
    ball(ballSketch);
    const shell = propShell(tools, 'globe', SMALL_VOXEL, params.scale);
    const base = shell.mesh(standSketch);
    const axis = tools.voxel.group();
    axis.position.set(...gridPoint(base, centre));
    axis.rotation.z = tilt;
    const sphere = tools.voxel.mesh(ballSketch.model(tools.voxel), {
      voxelSize: SMALL_VOXEL,
      pivot: 'center',
    });
    axis.add(sphere);
    shell.object.add(axis);
    const spin = (angle: number): void => {
      sphere.rotation.y = finiteArg('globe.spin(angle)', angle);
    };
    spin(params.angle);
    setAnchors(shell.object, { ball: gridPoint(base, centre) });
    const methods: { spin(angle: number): void } = { spin };
    return asProp(shell.object, methods, (t) => {
      spin(params.angle + params.speed * t);
    });
  },
});

/**
 * `kit.env.dioramaCity`: an isometric city block on a floating platform: a two-lane ring road
 * with looping cars around a park and a landmark tower, raised sidewalks with trees, lamps,
 * a traffic light and pedestrians, and a frame of seeded buildings along the back and left
 * edges (lit windows twinkle at night, an aviation beacon blinks, a chimney smokes).
 */
import { z } from 'zod';
import { hashCell } from '../../env/shared.js';
import { defineEnv } from '../../registry.js';
import type { Vec3 } from '../../types.js';
import { DioramaCanvas, type Facing } from './canvas.js';
import { assembleDiorama, commonParams, type Mover } from './diorama.js';
import { GLOW, GlowBuilder, glowColors } from './glow.js';
import { carMover, smokeMover, walkerMover } from './movers.js';
import {
  bench,
  building,
  fountain,
  streetLamp,
  trafficLight,
  tree,
  type RoofDetail,
} from './street.js';
import { loopLength, parseTiles, pingPong, pointOnLoop, type TileRect } from './tiles.js';
import { dioramaColors, type Slot, type TimeOfDay } from './tones.js';

export const CITY_ROWS = [
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'BBssssssssssss',
  'BBsrrrrrrrrrrs',
  'BBsrrrrrrrrrrs',
  'BBsrrgggppprrs',
  'BBsrrgggppprrs',
  'BBsrrgggppprrs',
  'BBsrrgggppprrs',
  'BBsrrrrrrrrrrs',
  'BBsrrrrrrrrrrs',
  'BBssssssssssss',
] as const;

type CityTile = 'lot' | 'sidewalk' | 'road' | 'grass' | 'plaza';

const LEGEND = {
  B: { kind: 'lot', height: 1 },
  s: { kind: 'sidewalk', height: 1 },
  r: { kind: 'road' },
  g: { kind: 'grass', height: 1 },
  p: { kind: 'plaza', height: 1 },
} as const;

/** Lane loops through tile centres: inner lane clockwise, outer lane counter-clockwise. */
export const INNER_LANE: TileRect = { x0: 4.5, z0: 4.5, x1: 11.5, z1: 9.5 };
export const OUTER_LANE: TileRect = { x0: 3.5, z0: 3.5, x1: 12.5, z1: 10.5 };
const CAR_SPEED = 1.6;
const CAR_BODIES: readonly Slot[] = ['shirtA', 'shirtB', 'paper', 'shirtC', 'bodyA'];
const BODIES: readonly Slot[] = ['bodyA', 'bodyB', 'bodyC', 'bodyD'];
const ROOFS: readonly RoofDetail[] = ['ac', 'flat', 'antenna', 'ac', 'chimney', 'flat'];
const LIT: Readonly<Record<TimeOfDay, number>> = { day: 0.75, dusk: 0.55, night: 0.45 };

export const dioramaCityParams = z.object({
  ...commonParams,
  traffic: z.number().int().min(0).max(8).default(5).describe('Cars on the ring road'),
});

function pattern(kind: CityTile, tx: number, tz: number, lx: number, lz: number): Slot {
  const x = tx * 8 + lx;
  const z = tz * 8 + lz;
  if (kind === 'road') {
    const dash = (value: number): boolean => value % 8 < 4;
    const vertical = (x === 32 || x === 96) && z >= 40 && z < 72 && dash(z);
    const horizontal = (z === 32 || z === 80) && x >= 40 && x < 88 && dash(x);
    const zebra = x >= 40 && x < 48 && (z < 40 || z >= 72) && z % 2 === 0 && x % 8 > 0;
    return vertical || horizontal || zebra ? 'roadLine' : 'road';
  }
  if (kind === 'grass') return hashCell(x, 0, z, 17) < 0.14 ? 'grassAlt' : 'grass';
  if (kind === 'plaza') return (x >> 2) % 2 === (z >> 2) % 2 ? 'sidewalk' : 'curb';
  return lx === 7 || lz === 7 ? 'curb' : 'sidewalk';
}

interface Lot {
  readonly tx: number;
  readonly tz: number;
  readonly facing: Facing;
}

/** Building lots (2 x 2 tiles): back strip facing +z, left strip facing +x. */
function lots(): Lot[] {
  const result: Lot[] = [];
  for (let tx = 0; tx < 14; tx += 2) result.push({ tx, tz: 0, facing: 'z' });
  for (let tz = 2; tz < 12; tz += 2) result.push({ tx: 0, tz, facing: 'x' });
  return result;
}

export const dioramaCity = defineEnv({
  name: 'dioramaCity',
  description:
    'Isometric city block diorama (look diorama, 14 x 12 tiles): ring road with looping cars around a park and a landmark tower, sidewalks with trees, lamps, traffic light and pedestrians, a frame of buildings (lit windows at night, blinking beacon, chimney smoke). ctx.camera.set(city.camera({ t })); call city.update(t).',
  params: dioramaCityParams,
  anchors: {
    'building0..building11':
      'roof centre of each frame building (back row left to right, then left row back to front)',
    landmark: 'roof centre of the landmark tower in the middle',
    park: 'centre of the park (fountain)',
    road: 'front road segment, centre',
    crossing: 'zebra crossing on the front road',
  },
  methods: {
    'camera(options)':
      'iso camera pose for ctx.camera.set(): { t, zoom, focus (anchor), offset [x, y], drift }',
    'part(name)': "moving parts: 'car0'..'carN', 'walker0', 'walker1', 'smoke'",
  },
  build(params, tools) {
    const grid = parseTiles<CityTile>(CITY_ROWS, LEGEND);
    const colors = dioramaColors(tools.palette, params.time, params.base ?? 'earth', params.accent);
    const canvas = new DioramaCanvas(grid, colors, 40);
    const seed = params.seed;
    canvas.platform(pattern, (x, y, z) => hashCell(x, y, z, seed) < 0.1, 'curb');
    const s = canvas.sketch;
    const at = (tx: number, tz: number, dx = 0, dz = 0): Vec3 => {
      const [x, y, zz] = canvas.tile(tx, tz);
      return [x + dx, y, zz + dz];
    };
    const glow = new GlowBuilder();
    const optional = (index: number): boolean => hashCell(index, 5, 6, seed) < params.density;
    const night = params.time !== 'day';
    let smoke: Vec3 | undefined;
    lots().forEach((lot, index) => {
      const rank = hashCell(index, 1, 1, seed);
      const height = index === 0 ? 30 : 14 + Math.round(rank * 13);
      const placed = building(s, at(lot.tx, lot.tz, 1, 1), lot.facing, {
        width: 14,
        deep: 13,
        height,
        body: BODIES[(index + seed) % BODIES.length] ?? 'bodyA',
        seed: seed * 31 + index,
        lit: LIT[params.time],
        roof: index === 0 ? 'antenna' : (ROOFS[(index * 5 + seed) % ROOFS.length] ?? 'flat'),
        shop: index % 3 === 1,
      });
      canvas.anchor(`building${String(index)}`, placed.top);
      if (night) {
        glow.add(placed.windows, (t, cell) =>
          blinkWindow(t, cell + index * 13, seed) ? GLOW.amber : GLOW.off,
        );
      }
      glow.add(placed.beacon, (t) => (Math.floor(t * 1.5) % 2 === 0 ? GLOW.red : GLOW.off));
      smoke ??= placed.smoke;
    });
    const landmark = building(s, at(8, 5, 2, 4), 'z', {
      width: 20,
      deep: 20,
      height: 24,
      body: 'bodyC',
      seed: seed + 7,
      lit: LIT[params.time],
      roof: 'flat',
      shop: true,
    });
    canvas.anchor('landmark', landmark.top);
    const [lx, ly, lz] = landmark.top;
    s.box('darkest', [lx - 6, ly, lz + 6], [lx + 6, ly + 5, lz + 7]);
    const sign = Array.from({ length: 10 }, (_, index) => ({
      cell: [lx - 5 + index, ly + 2, lz + 6] as Vec3,
      face: 'z' as const,
    }));
    const signTop = sign.map((cell) => ({
      ...cell,
      cell: [cell.cell[0], cell.cell[1] + 1, cell.cell[2]] as Vec3,
    }));
    glow.add([...sign, ...signTop], (t, cell) => {
      const column = cell % 10;
      return (column + Math.floor(t * 6)) % 10 < 7 ? GLOW.accent : GLOW.dim;
    });
    const water = fountain(s, at(5, 6, 7, 3));
    canvas.anchor('park', water.top);
    glow.add(water.glow, (t, cell) =>
      (Math.floor(t * 3) + cell) % 3 === 0 ? GLOW.white : GLOW.dim,
    );
    tree(s, at(5, 5, 1, 0), seed);
    tree(s, at(5, 7, 1, 7), seed + 1);
    if (optional(1)) tree(s, at(7, 7, 2, 7), seed + 2);
    if (optional(2)) bench(s, at(6, 8, 0, 5), 'z');
    for (let tx = 3; tx < 14; tx += 3) {
      if (optional(10 + tx)) tree(s, at(tx, 11, 1, 2), seed + tx);
      streetLamp(s, at(tx + 1, 11, 4, 1), 'z', 'back');
    }
    for (let tz = 4; tz < 11; tz += 3) streetLamp(s, at(13, tz, 1, 4), 'x', 'back');
    for (let tx = 4; tx < 13; tx += 4) streetLamp(s, at(tx, 2, 4, 1), 'z', 'front');
    const light = trafficLight(s, at(2, 11, 6, 1), 'z');
    glow.add(light.glow, (t, cell) => {
      const phase = (t % 8) / 8;
      const lit = phase < 0.45 ? 0 : phase < 0.55 ? 1 : 2;
      if (cell !== lit) return GLOW.off;
      return [GLOW.green, GLOW.amber, GLOW.red][lit] ?? GLOW.off;
    });
    canvas.anchor('road', at(7, 10, 0, 4));
    canvas.anchor('crossing', at(5, 10, 4, 0));
    const toLocal = (point: Vec3): Vec3 => canvas.toLocal(point);
    const roadY = canvas.tile(3, 3)[1];
    const walkY = canvas.tile(2, 2)[1];
    const movers: Mover[] = [];
    for (let index = 0; index < params.traffic; index += 1) {
      const outer = index % 2 === 1;
      const lane = outer ? OUTER_LANE : INNER_LANE;
      const length = loopLength(lane);
      const offset = (index / Math.max(1, params.traffic)) * length + hashCell(index, 2, 3, seed);
      movers.push(
        carMover(tools, colors, toLocal, {
          name: `car${String(index)}`,
          body: CAR_BODIES[(index + seed) % CAR_BODIES.length] ?? 'shirtA',
          y: roadY,
          path: (t) => {
            const along = offset + CAR_SPEED * t;
            const point = pointOnLoop(lane, outer ? -along : along);
            return outer ? { ...point, heading: point.heading + Math.PI } : point;
          },
        }),
      );
    }
    if (params.density >= 0.3) {
      movers.push(
        walkerMover(tools, colors, toLocal, {
          name: 'walker0',
          shirt: 'shirtB',
          y: walkY,
          path: (t) => pingPong([3.2, 2.6], [12.5, 2.6], 0.7, t, 0.2),
        }),
        walkerMover(tools, colors, toLocal, {
          name: 'walker1',
          shirt: 'shirtC',
          y: walkY,
          path: (t) => pingPong([13.3, 3.4], [13.3, 10.8], 0.6, t, 0.6),
        }),
      );
    }
    if (smoke) {
      movers.push(
        smokeMover(tools, colors, toLocal, {
          name: 'smoke',
          origin: smoke,
          size: 2,
          rise: 14,
          period: 3,
        }),
      );
    }
    return assembleDiorama(tools, {
      kitType: 'dioramaCity',
      canvas,
      backing: colors.road,
      time: params.time,
      lights: params.lights,
      shadow: params.shadow,
      glow: glow.layer(glowColors(tools.palette, params.accent)),
      movers,
    }).diorama;
  },
});

/** Night windows: most stay lit, a few switch every few seconds (seeded). */
function blinkWindow(t: number, cell: number, seed: number): boolean {
  const period = 3 + 5 * hashCell(cell, 0, 11, seed);
  const tick = Math.floor(t / period + hashCell(cell, 0, 12, seed));
  return hashCell(cell, tick, 13, seed) < 0.7;
}

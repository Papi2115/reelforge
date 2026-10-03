/**
 * `kit.env.dioramaServerRoom`: an isometric server room on a floating platform: raised-floor
 * tiles with a perforated cold aisle, two rows of racks with blinking LEDs and cable trays,
 * cooling units, a status wall screen with live bars and a technician pacing the aisle.
 */
import { z } from 'zod';
import { hashCell } from '../../env/shared.js';
import { amountArg } from '../../props/shared.js';
import { defineEnv } from '../../registry.js';
import type { Vec3 } from '../../types.js';
import { DioramaCanvas } from './canvas.js';
import { door, wallScreen } from './decor.js';
import { assembleDiorama, commonParams } from './diorama.js';
import { coolingUnit, rack, standing } from './furniture.js';
import { GLOW, GlowBuilder, glowColors } from './glow.js';
import { walkerMover } from './movers.js';
import { blinkOn, parseTiles, pingPong } from './tiles.js';
import { dioramaColors, type Slot } from './tones.js';

export const SERVER_ROOM_ROWS = [
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
  '..cccccc..',
  '..........',
] as const;

type ServerTile = 'floor' | 'cold';

const LEGEND = { '.': { kind: 'floor' }, c: { kind: 'cold' } } as const;

const WALL_HEIGHT = 18;
const RACK_HEIGHT = 16;
const RACKS_PER_ROW = 6;
const RACK_STRIDE = 7;
const ROW_X = 16;
const ROW_Z = [12, 40] as const;
const SCREEN = { along: 62, bottom: 5, width: 16, height: 10 } as const;

export const dioramaServerRoomParams = z.object({ ...commonParams });

function pattern(kind: ServerTile, _tx: number, _tz: number, lx: number, lz: number): Slot {
  if (lx === 7 || lz === 7) return 'seam';
  if (kind === 'cold' && lx % 2 === 1 && lz % 2 === 1) return 'seam';
  return kind === 'cold' ? 'floorAlt' : 'floor';
}

/** Status board: per column a bar height that steps every 0.5 s (seeded), top cell white. */
function barsBehaviour(seed: number) {
  const columns = SCREEN.width - 2;
  const rows = SCREEN.height - 2;
  return (t: number, index: number): number => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const tick = Math.floor(t * 2);
    const base = 0.35 + 0.5 * hashCell(column, 0, 1, seed);
    const wobble = 0.25 * (hashCell(column, tick, 2, seed) - 0.5);
    const height = Math.max(1, Math.round((base + wobble) * rows));
    if (row === height - 1) return GLOW.white;
    return row < height ? GLOW.accent : GLOW.off;
  };
}

export const dioramaServerRoom = defineEnv({
  name: 'dioramaServerRoom',
  description:
    'Isometric server room diorama (look diorama, 10 x 8 tiles): two rows of 6 racks with blinking LEDs and cable trays, cooling units, a status wall screen with live bars, a pacing technician. ctx.camera.set(room.camera({ t })); call room.update(t); room.alarm(amount) turns every LED into a red alert.',
  params: dioramaServerRoomParams,
  anchors: {
    'rack0..rack11': 'top centre of each rack (back row 0-5 left to right, front row 6-11)',
    rowA: 'front face centre of the back rack row',
    rowB: 'front face centre of the front rack row',
    screen: 'centre of the status wall screen',
    'cooler0..cooler1': 'top of each cooling unit (left wall)',
    door: 'centre of the door',
  },
  methods: {
    'camera(options)':
      'iso camera pose for ctx.camera.set(): { t, zoom, focus (anchor), offset [x, y], drift }',
    'part(name)': "moving parts: 'tech'",
    'alarm(amount)': 'amount >= 0.5: every rack LED flashes red in sync; set every frame',
  },
  build(params, tools) {
    const grid = parseTiles<ServerTile>(SERVER_ROOM_ROWS, LEGEND);
    const colors = dioramaColors(
      tools.palette,
      params.time,
      params.base ?? 'concrete',
      params.accent,
      { wall: 'slateBlue', wallLow: 'indigo', floor: 'slateGrey', floorAlt: 'midSlate' },
    );
    const canvas = new DioramaCanvas(grid, colors, WALL_HEIGHT + 1);
    const seed = params.seed;
    canvas.platform(pattern, (x, y, z) => hashCell(x, y, z, seed) < 0.06);
    canvas.walls(WALL_HEIGHT);
    const s = canvas.sketch;
    const [ox, floorY, oz] = canvas.tile(0, 0);
    const at = (x: number, z: number): Vec3 => [ox + x, floorY, oz + z];
    const glow = new GlowBuilder();
    let alarmOn = false;
    let rackIndex = 0;
    ROW_Z.forEach((rowZ, row) => {
      for (let index = 0; index < RACKS_PER_ROW; index += 1) {
        const placed = rack(s, at(ROW_X + index * RACK_STRIDE, rowZ), 'z', RACK_HEIGHT);
        canvas.anchor(`rack${String(rackIndex)}`, placed.top);
        const id = rackIndex;
        glow.add(placed.glow, (t, cell) => {
          if (alarmOn) return Math.floor(t * 4) % 2 === 0 ? GLOW.red : GLOW.off;
          const kind = cell % 3;
          const rate = 0.6 + 2.4 * hashCell(id, cell, 1, seed);
          const lit = blinkOn(t, rate, hashCell(id, cell, 2, seed), kind === 0 ? 0.85 : 0.5);
          if (!lit) return GLOW.off;
          if (hashCell(id, cell, 3, seed) < 0.08) return GLOW.amber;
          return kind === 1 ? GLOW.accent : GLOW.green;
        });
        rackIndex += 1;
      }
      const x0 = ROW_X;
      const x1 = ROW_X + RACKS_PER_ROW * RACK_STRIDE - 1;
      const [tx0, , tz0] = at(x0, rowZ);
      const [tx1] = at(x1, rowZ);
      const top = floorY + RACK_HEIGHT;
      s.box('metalDark', [tx0, top, tz0 + 1], [tx1, top + 1, tz0 + 5]);
      s.box('accent', [tx0, top + 1, tz0 + 1], [tx1, top + 2, tz0 + 2]);
      s.box('shirtC', [tx0, top + 1, tz0 + 3], [tx1, top + 2, tz0 + 4]);
      canvas.anchor(`row${row === 0 ? 'A' : 'B'}`, [
        (tx0 + tx1) / 2,
        floorY + RACK_HEIGHT / 2,
        tz0 + 6,
      ]);
    });
    const [bx, bTop, bz] = at(ROW_X + RACKS_PER_ROW * RACK_STRIDE + 1, ROW_Z[0] + 2);
    s.box(
      'metalDark',
      [bx, bTop + RACK_HEIGHT + 1, bz],
      [bx + 2, bTop + RACK_HEIGHT + 2, bz + ROW_Z[1] - ROW_Z[0]],
    );
    s.box('metalDark', [bx, bTop, bz], [bx + 1, bTop + RACK_HEIGHT + 1, bz + 1]);
    s.box(
      'metalDark',
      [bx, bTop, bz + ROW_Z[1] - ROW_Z[0] - 1],
      [bx + 1, bTop + RACK_HEIGHT + 1, bz + ROW_Z[1] - ROW_Z[0]],
    );
    const board = wallScreen(s, 'back', SCREEN.along, SCREEN.bottom, SCREEN.width, SCREEN.height);
    canvas.anchor('screen', board.top);
    glow.add(board.glow, barsBehaviour(seed));
    [12, 40].forEach((z, index) => {
      const unit = coolingUnit(s, at(2, z), 'x');
      canvas.anchor(`cooler${String(index)}`, unit.top);
      glow.add(unit.glow, (t, cell) =>
        cell === 0 ? GLOW.green : blinkOn(t, 0.7, index * 0.3) ? GLOW.accent : GLOW.dim,
      );
    });
    canvas.anchor('door', door(s, 'left', 26).top);
    const optional = (index: number): boolean => hashCell(index, 3, 4, seed) < params.density;
    if (optional(1)) standing(s, at(64, 24), 'x', 'shirtB');
    if (optional(2)) s.box('shirtC', ...boxAt(at(5, 30), [2, 4, 2]));
    if (optional(3)) {
      s.box('paper', ...boxAt(at(66, 52), [5, 3, 4]));
      s.box('paper', ...boxAt(lift(at(67, 53), 3), [3, 2, 3]));
    }
    const toLocal = (point: Vec3): Vec3 => canvas.toLocal(point);
    const tech = walkerMover(tools, colors, toLocal, {
      name: 'tech',
      shirt: 'shirtA',
      y: floorY,
      path: (t) => pingPong([2.2, 6.6], [7.6, 6.6], 0.8, t, 0.1),
    });
    const { diorama, repaint } = assembleDiorama(tools, {
      kitType: 'dioramaServerRoom',
      canvas,
      backing: colors.floor,
      time: params.time,
      lights: params.lights,
      shadow: params.shadow,
      glow: glow.layer(glowColors(tools.palette, params.accent)),
      movers: [tech],
    });
    const alarm = (amount: number): void => {
      const next = amountArg('dioramaServerRoom.alarm(amount)', amount) >= 0.5;
      if (next === alarmOn) return;
      alarmOn = next;
      repaint();
    };
    return Object.assign(diorama, { alarm });
  },
});

function boxAt(corner: Vec3, size: Vec3): [Vec3, Vec3] {
  return [corner, [corner[0] + size[0], corner[1] + size[1], corner[2] + size[2]]];
}

function lift(point: Vec3, dy: number): Vec3 {
  return [point[0], point[1] + dy, point[2]];
}

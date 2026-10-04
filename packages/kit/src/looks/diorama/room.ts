/**
 * `kit.env.dioramaRoom`: a cosy isometric bedroom/study on a floating platform: plank floor, a
 * big window and a poster in the cut-away walls, bed, rug with a cat, bookshelf, a desk with a
 * glowing computer and a steaming mug, a lamp and plants.
 */
import { z } from 'zod';
import { hashCell } from '../../env/shared.js';
import { defineEnv } from '../../registry.js';
import type { Vec3 } from '../../types.js';
import { BASE, DioramaCanvas } from './canvas.js';
import { door, poster } from './decor.js';
import { assembleDiorama, commonParams } from './diorama.js';
import { bed, bookshelf, cat, chair, desk, floorLamp, plant, seated } from './furniture.js';
import { GLOW, GlowBuilder, glowColors } from './glow.js';
import { smokeMover } from './movers.js';
import { parseTiles } from './tiles.js';
import { dioramaColors, type Slot } from './tones.js';

export const ROOM_ROWS = [
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
] as const;

type RoomTile = 'planks';

const LEGEND = { '.': { kind: 'planks' } } as const;
const WALL_HEIGHT = 18;
/** Rug in floor voxels (from the tile grid origin): x0, z0, x1, z1 (exclusive). */
const RUG = [20, 24, 46, 46] as const;

export const dioramaRoomParams = z.object({
  ...commonParams,
  occupied: z.boolean().default(true).describe('Someone sits at the desk'),
});

function pattern(_kind: RoomTile, tx: number, tz: number, lx: number, lz: number): Slot {
  const x = tx * 8 + lx;
  const z = tz * 8 + lz;
  const [x0, z0, x1, z1] = RUG;
  if (x >= x0 && x < x1 && z >= z0 && z < z1) {
    const border = x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1;
    const inner = x === x0 + 2 || x === x1 - 3 || z === z0 + 2 || z === z1 - 3;
    return border || inner ? 'rugBorder' : 'rug';
  }
  const row = Math.floor(z / 3);
  if (z % 3 === 2) return 'floorAlt';
  return (x + row * 5) % 12 === 0 ? 'floorAlt' : 'floor';
}

export const dioramaRoom = defineEnv({
  name: 'dioramaRoom',
  description:
    'Cosy isometric room diorama (look diorama, 8 x 7 tiles): plank floor, big window, poster, bed, rug with a cat, bookshelf, desk with a glowing computer and a steaming mug, lamp, plants. ctx.camera.set(room.camera({ t })); call room.update(t).',
  params: dioramaRoomParams,
  anchors: {
    desk: 'desk top centre',
    monitor: 'centre of the computer screen',
    mug: 'the mug on the desk',
    bed: 'top centre of the bed',
    bookshelf: 'top of the bookshelf',
    window: 'centre of the window',
    poster: 'centre of the poster',
    rug: 'centre of the rug',
    cat: 'the cat on the rug',
    lamp: 'top of the floor lamp',
  },
  methods: {
    'camera(options)':
      'iso camera pose for ctx.camera.set(): { t, zoom, focus (anchor), offset [x, y], drift }',
    'part(name)': "moving parts: 'steam'",
  },
  build(params, tools) {
    const grid = parseTiles<RoomTile>(ROOM_ROWS, LEGEND);
    const colors = dioramaColors(tools.palette, params.time, params.base ?? 'wood', params.accent, {
      floor: 'tan',
      floorAlt: 'burntOrange',
      wall: 'wine',
      wallLow: 'purple',
    });
    const canvas = new DioramaCanvas(grid, colors, WALL_HEIGHT + 1);
    const seed = params.seed;
    canvas.platform(pattern, (x, y, z) => hashCell(x, y, z, seed) < 0.05);
    canvas.walls(WALL_HEIGHT);
    canvas.window('back', 6, 6, 16, 9);
    const s = canvas.sketch;
    const [ox, floorY, oz] = canvas.tile(0, 0);
    const at = (x: number, z: number): Vec3 => [ox + x, floorY, oz + z];
    const optional = (index: number): boolean => hashCell(index, 7, 8, seed) < params.density;
    const glow = new GlowBuilder();
    canvas.anchor('window', [ox + 14, BASE + 10.5, oz + 2]);
    canvas.anchor('bookshelf', bookshelf(s, at(26, 2), 'z', seed).top);
    const workDesk = desk(s, at(40, 2), 'z', seed + 1);
    canvas.anchor('desk', workDesk.top);
    canvas.anchor('monitor', [ox + 46, floorY + 8, oz + 4]);
    glow.add(workDesk.glow, (t, cell) => {
      const tick = Math.floor(t * 4);
      return hashCell(cell, tick, 3, seed) < 0.75 ? GLOW.accent : GLOW.dim;
    });
    const chairAt = at(44, 9);
    chair(s, chairAt, 'z');
    if (params.occupied) seated(s, chairAt, 'z', 'shirtB');
    canvas.anchor('poster', poster(s, 'back', 40, 11, 10, 6).top);
    canvas.anchor('bed', bed(s, at(2, 26), 'x').top);
    canvas.anchor('lamp', floorLamp(s, at(3, 21)).top);
    canvas.anchor('cat', cat(s, at(31, 33), 'x').top);
    const [rx0, rz0, rx1, rz1] = RUG;
    canvas.anchor('rug', [ox + (rx0 + rx1) / 2, floorY, oz + (rz0 + rz1) / 2]);
    door(s, 'left', 46);
    plant(s, at(58, 3), true);
    if (optional(1)) plant(s, at(57, 46), true);
    if (optional(2)) plant(s, at(19, 3), false);
    if (optional(3)) s.box('fabric', at(50, 30), [ox + 56, floorY + 3, oz + 36]);
    const mug: Vec3 = [ox + 41, floorY + 5, oz + 5];
    s.box('paper', mug, [mug[0] + 1, mug[1] + 2, mug[2] + 1]);
    canvas.anchor('mug', [mug[0] + 0.5, mug[1] + 2, mug[2] + 0.5]);
    const toLocal = (point: Vec3): Vec3 => canvas.toLocal(point);
    const steam = smokeMover(tools, colors, toLocal, {
      name: 'steam',
      origin: [mug[0], mug[1] + 2, mug[2]],
      size: 1,
      rise: 6,
      period: 2.4,
    });
    return assembleDiorama(tools, {
      kitType: 'dioramaRoom',
      canvas,
      backing: colors.floor,
      time: params.time,
      lights: params.lights,
      shadow: params.shadow,
      glow: glow.layer(glowColors(tools.palette, params.accent)),
      movers: [steam],
    }).diorama;
  },
});

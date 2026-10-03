/**
 * `kit.env.dioramaOffice`: an isometric open-plan office on a floating platform: carpet tiles,
 * windows and a whiteboard in the cut-away walls, four desks with monitors (flickering screens),
 * seated and walking staff, a raised meeting corner, plants, cooler, cabinet, lamp.
 */
import { z } from 'zod';
import { hashCell } from '../../env/shared.js';
import { defineEnv } from '../../registry.js';
import type { Vec3 } from '../../types.js';
import { DioramaCanvas } from './canvas.js';
import { door, whiteboard } from './decor.js';
import { assembleDiorama, commonParams } from './diorama.js';
import {
  cabinet,
  chair,
  desk,
  floorLamp,
  meetingTable,
  plant,
  seated,
  standing,
  waterCooler,
} from './furniture.js';
import { GLOW, GlowBuilder, glowColors } from './glow.js';
import { walkerMover } from './movers.js';
import { parseTiles, pingPong } from './tiles.js';
import { dioramaColors, type Slot } from './tones.js';

export const OFFICE_ROWS = [
  '......mmmm',
  '......mmmm',
  '......mmmm',
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
] as const;

type OfficeTile = 'carpet' | 'meeting';

const LEGEND = {
  '.': { kind: 'carpet' },
  m: { kind: 'meeting', height: 2 },
} as const;

const WALL_HEIGHT = 18;
const SHIRTS: readonly Slot[] = ['shirtA', 'shirtB', 'shirtC'];

export const dioramaOfficeParams = z.object({ ...commonParams });

function pattern(kind: OfficeTile, tx: number, tz: number, lx: number, lz: number): Slot {
  if (kind === 'meeting') return lz % 4 === 3 ? 'woodDark' : 'wood';
  if (lx === 7 || lz === 7) return 'seam';
  return (tx + tz) % 2 === 0 ? 'floor' : 'floorAlt';
}

export const dioramaOffice = defineEnv({
  name: 'dioramaOffice',
  description:
    'Isometric office diorama (look diorama, 10 x 8 tiles): carpet, cut-away walls with windows and a whiteboard, 4 desks with flickering monitors, staff, a raised meeting corner, plants. Frame it with ctx.camera.set(office.camera({ t })); call office.update(t).',
  params: dioramaOfficeParams,
  anchors: {
    'desk0..desk3': 'top centre of each desk (back row left/right, front row left/right)',
    'monitor0..monitor3': 'centre of each desk screen',
    table: 'meeting table top',
    whiteboard: 'centre of the whiteboard',
    window: 'centre of the first window',
    door: 'centre of the door (left wall)',
    cooler: 'top of the water cooler',
    presenter: 'head of the standing presenter',
  },
  methods: {
    'camera(options)':
      'iso camera pose for ctx.camera.set(): { t, zoom, focus (anchor), offset [x, y], drift }',
    'part(name)': "moving parts: 'walker0'",
  },
  build(params, tools) {
    const grid = parseTiles<OfficeTile>(OFFICE_ROWS, LEGEND);
    const colors = dioramaColors(
      tools.palette,
      params.time,
      params.base ?? 'concrete',
      params.accent,
    );
    const canvas = new DioramaCanvas(grid, colors, WALL_HEIGHT + 1);
    const seed = params.seed;
    canvas.platform(pattern, (x, y, z) => hashCell(x, y, z, seed) < 0.06);
    canvas.walls(WALL_HEIGHT);
    canvas.window('back', 4, 7, 11, 8);
    canvas.window('back', 19, 7, 11, 8);
    canvas.window('left', 14, 7, 11, 8);
    const s = canvas.sketch;
    const at = (tx: number, tz: number, dx: number, dz: number): Vec3 => {
      const [x, y, zz] = canvas.tile(tx, tz);
      return [x + dx, y, zz + dz];
    };
    const optional = (index: number): boolean => hashCell(index, 1, 2, seed) < params.density;
    const glow = new GlowBuilder();
    const deskSpots: readonly Vec3[] = [
      at(0, 2, 6, 6),
      at(2, 2, 6, 6),
      at(0, 4, 6, 6),
      at(2, 4, 6, 6),
    ];
    deskSpots.forEach((spot, index) => {
      const placed = desk(s, spot, 'z', seed + index);
      canvas.anchor(`desk${String(index)}`, placed.top);
      canvas.anchor(`monitor${String(index)}`, [spot[0] + 6, spot[1] + 8, spot[2] + 2]);
      glow.add(placed.glow, (t, cell) => {
        const tick = Math.floor(t * 5 + index * 1.7);
        return hashCell(cell, tick, index, seed) < 0.72 ? GLOW.accent : GLOW.dim;
      });
      const chairAt: Vec3 = [spot[0] + 4, spot[1], spot[2] + 7];
      chair(s, chairAt, 'z');
      if (index === 0 || optional(index)) {
        seated(s, chairAt, 'z', SHIRTS[(index + seed) % SHIRTS.length] ?? 'shirtA');
      }
    });
    const table = meetingTable(s, at(6, 0, 6, 8), 'z');
    canvas.anchor('table', table.top);
    glow.add(table.glow, (t) => (Math.floor(t * 1.5) % 4 === 3 ? GLOW.white : GLOW.accent));
    chair(s, at(6, 2, 8, 2), 'z');
    chair(s, at(7, 2, 8, 2), 'z');
    const board = whiteboard(s, 'back', 56, 7, 22, 10);
    canvas.anchor('whiteboard', board.top);
    const presenter = standing(s, at(9, 1, 1, 0), 'x', 'shirtB');
    canvas.anchor('presenter', presenter.top);
    canvas.anchor('window', [2 + 4 + 5.5, canvas.tile(0, 0)[1] + 11, 4]);
    const entrance = door(s, 'left', 46);
    canvas.anchor('door', entrance.top);
    canvas.anchor('cooler', waterCooler(s, at(6, 5, 4, 2)).top);
    cabinet(s, at(0, 0, 2, 4), 'x');
    if (optional(10)) cabinet(s, at(0, 0, 2, 9), 'x');
    plant(s, at(5, 0, 1, 3), true);
    if (optional(11)) plant(s, at(9, 7, 3, 3), true);
    if (optional(12)) plant(s, at(5, 4, 3, 3), false);
    if (optional(13)) plant(s, at(8, 4, 2, 2), false);
    if (optional(14)) floorLamp(s, at(9, 4, 3, 1));
    if (optional(15)) standing(s, at(7, 5, 2, 2), 'z', 'shirtC');
    const toLocal = (point: Vec3): Vec3 => canvas.toLocal(point);
    const movers = [];
    if (params.density >= 0.3) {
      const y = canvas.tile(0, 0)[1];
      movers.push(
        walkerMover(tools, colors, toLocal, {
          name: 'walker0',
          shirt: 'shirtA',
          y,
          path: (t) => pingPong([1.2, 7.2], [5.6, 7.2], 0.9, t, 0.15),
        }),
      );
    }
    return assembleDiorama(tools, {
      kitType: 'dioramaOffice',
      canvas,
      backing: colors.floor,
      time: params.time,
      lights: params.lights,
      shadow: params.shadow,
      glow: glow.layer(glowColors(tools.palette, params.accent)),
      movers,
    }).diorama;
  },
});

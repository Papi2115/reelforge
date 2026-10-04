/**
 * `kit.env.room`: an open diorama room (floor + back and left walls, open towards the camera)
 * with planked floor, wainscot, a glowing window and a rug. One greedy voxel mesh.
 */
import { z } from 'zod';
import { createKitObject } from '../object.js';
import { defineEnv } from '../registry.js';
import { toneOf } from '../variation/ambient.js';
import type { VoxelColor } from '../voxel/model.js';
import { asEnv, colorParam, voxels, WOOD, WOOD_ALT } from './shared.js';

const ROOM_VOXEL = 0.25;
const ROOM_WALL = ['slateBlue', 'slate', 'dusk', 'groundAlt'] as const;
const ROOM_WAINSCOT = ['indigo', 'charcoal', 'plum', 'shadow'] as const;

export const roomParams = z.object({
  width: z.number().min(3).max(24).default(8).describe('Width (x) in units'),
  depth: z.number().min(3).max(24).default(6).describe('Depth (z) in units'),
  height: z.number().min(2).max(12).default(4.5).describe('Wall height in units'),
  wall: z.string().optional().describe('Palette name of the upper walls'),
  wallAlt: z.string().optional().describe('Palette name of the wainscot (lower walls)'),
  floor: z.string().optional().describe('Palette name of the floor planks'),
  floorAlt: z.string().optional().describe('Palette name of alternate floor planks'),
  window: z.boolean().default(true).describe('Glowing window in the back wall'),
  windowColor: z.string().default('accent1').describe('Palette name of the window glow'),
  rug: z.boolean().default(true).describe('Rug in the middle of the floor'),
});

/** Palette slots (1-based model indices). */
const SLOT = {
  floor: 1,
  floorAlt: 2,
  wall: 3,
  wallAlt: 4,
  trim: 5,
  pane: 6,
  rug: 7,
  rugBorder: 8,
} as const;

interface Rect {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

function inRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
}

function onBorder(rect: Rect, x: number, y: number): boolean {
  return x === rect.x0 || x === rect.x1 || y === rect.y0 || y === rect.y1;
}

export const room = defineEnv({
  name: 'room',
  description:
    'Open voxel room (floor, back wall with a glowing window, left wall; open to +z and +x so the camera looks in from the front-right). prop.on(room) stands props on the floor centre. Static.',
  params: roomParams,
  anchors: {
    top: 'floor centre (so prop.on(room) stands on the floor)',
    floor: 'floor centre',
    backWall: 'centre of the back wall, inner face (for posters/screens: mount with align "back")',
    leftWall: 'centre of the left wall, inner face',
    window: 'centre of the window, inner face',
  },
  build(params, tools) {
    const { palette } = tools;
    const sx = voxels(params.width, ROOM_VOXEL);
    const sz = voxels(params.depth, ROOM_VOXEL);
    const sy = voxels(params.height, ROOM_VOXEL) + 1;
    const wainscot = Math.max(2, Math.round((sy - 1) * 0.3));
    const window: Rect = {
      x0: Math.round(sx * 0.45),
      x1: Math.round(sx * 0.82),
      y0: Math.round(sy * 0.38),
      y1: Math.round(sy * 0.82),
    };
    const windowMidX = Math.round((window.x0 + window.x1) / 2);
    const windowMidY = Math.round((window.y0 + window.y1) / 2);
    const rug: Rect = {
      x0: Math.round(sx * 0.3),
      x1: Math.round(sx * 0.72),
      y0: Math.round(sz * 0.35),
      y1: Math.round(sz * 0.8),
    };
    const colors: VoxelColor[] = [
      colorParam(palette, params.floor, WOOD),
      colorParam(palette, params.floorAlt, WOOD_ALT),
      params.wall ?? toneOf(tools.variation, colorParam(palette, undefined, ROOM_WALL)),
      params.wallAlt ?? toneOf(tools.variation, colorParam(palette, undefined, ROOM_WAINSCOT)),
      'heroTrim',
      { color: params.windowColor, glow: true },
      'accent4',
      'heroTrim',
    ];
    const wallCell = (along: number, y: number, isBack: boolean): number => {
      if (isBack && params.window && inRect(window, along, y)) {
        const frame = onBorder(window, along, y) || along === windowMidX || y === windowMidY;
        return frame ? SLOT.trim : SLOT.pane;
      }
      if (y === wainscot) return SLOT.trim;
      return y < wainscot ? SLOT.wallAlt : SLOT.wall;
    };
    const fill = (x: number, y: number, z: number): number => {
      if (y === 0) {
        if (params.rug && inRect(rug, x, z)) return onBorder(rug, x, z) ? SLOT.rugBorder : SLOT.rug;
        return Math.floor(z / 2) % 2 === 0 ? SLOT.floor : SLOT.floorAlt;
      }
      if (z === 0) return wallCell(x, y, true);
      if (x === 0) return wallCell(z, y, false);
      return 0;
    };
    const model = tools.voxel.generate([sx, sy, sz], fill, colors);
    const mesh = tools.voxel.mesh(model, { voxelSize: ROOM_VOXEL });
    const halfX = (sx / 2) * ROOM_VOXEL;
    const halfZ = (sz / 2) * ROOM_VOXEL;
    const wallMid = ((sy + 1) / 2) * ROOM_VOXEL;
    const object = createKitObject(tools.three, {
      kitType: 'room',
      anchors: {
        top: [0, ROOM_VOXEL, 0],
        floor: [0, ROOM_VOXEL, 0],
        backWall: [ROOM_VOXEL / 2, wallMid, -halfZ + ROOM_VOXEL],
        leftWall: [-halfX + ROOM_VOXEL, wallMid, ROOM_VOXEL / 2],
        window: [
          (windowMidX + 0.5) * ROOM_VOXEL - halfX,
          (windowMidY + 0.5) * ROOM_VOXEL,
          -halfZ + ROOM_VOXEL,
        ],
      },
    });
    object.add(mesh);
    return asEnv(object);
  },
});

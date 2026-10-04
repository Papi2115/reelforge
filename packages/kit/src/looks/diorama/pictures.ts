/**
 * Asset pictures in dioramas (PLAN.md#12.11): a billboard on the city landmark's roof and a wall
 * screen in the office, both facing +z (the side the iso camera sees). The frame is drawn into the
 * diorama canvas; the picture is an unlit plane (2 picture pixels per diorama voxel) a hair above
 * the frame's face, so it glows like the other screens and stays in the style palette.
 */
import type * as THREE from 'three';
import type { AssetImage } from '../../assets/handle.js';
import { createPicturePlane } from '../../assets/picture.js';
import type { Sketch } from '../../props/sketch.js';
import type { KitTools } from '../../registry.js';
import type { Vec3 } from '../../types.js';
import { BASE, OVERHANG, WALL, type DioramaCanvas } from './canvas.js';
import { DIORAMA_VOXEL } from './tiles.js';
import type { Slot } from './tones.js';

const DENSITY = 2;
const LIFT = 0.06;
const RIM = 1;

/** A picture slot: centre of the frame's face (canvas grid point) and its inner size in voxels. */
export interface PictureSlot {
  readonly centre: Vec3;
  readonly size: readonly [number, number];
}

/** Billboard on legs standing on the roof at `top` (a roof centre), near its front edge. */
export function rooftopBillboard(s: Sketch<Slot>, top: Vec3): PictureSlot {
  const [x, y, z] = top;
  const width = 18;
  const height = 11;
  const legs = 2;
  const front = z + 7;
  for (const leg of [x - 7, x + 5])
    s.box('darkest', [leg, y, front - 1], [leg + 2, y + legs, front]);
  s.box('darkest', [x - width / 2, y + legs, front - 1], [x + width / 2, y + legs + height, front]);
  return {
    centre: [x, y + legs + height / 2, front],
    size: [width - 2 * RIM, height - 2 * RIM],
  };
}

/** Framed screen on the inner face of the back wall, `along` voxels from its start. */
export function backWallScreen(
  s: Sketch<Slot>,
  along: number,
  bottom: number,
  width: number,
  height: number,
): PictureSlot {
  const x = OVERHANG + along;
  const y = BASE + bottom;
  const z = OVERHANG + WALL;
  s.box('darkest', [x, y, z], [x + width, y + height, z + 1]);
  return {
    centre: [x + width / 2, y + height / 2, z + 1],
    size: [width - 2 * RIM, height - 2 * RIM],
  };
}

/** The picture plane of `slot` in the diorama object's local space. */
export function slotPicture<Kind extends string>(
  tools: KitTools,
  canvas: DioramaCanvas<Kind>,
  slot: PictureSlot,
  asset: AssetImage,
  name: string,
): THREE.Mesh {
  const [w, h] = slot.size;
  const plane = createPicturePlane(tools, {
    name,
    pixels: asset.pixels(w * DENSITY, h * DENSITY),
    pixelSize: DIORAMA_VOXEL / DENSITY,
    lit: false,
  });
  const [cx, cy, cz] = slot.centre;
  plane.mesh.position.set(...canvas.toLocal([cx, cy, cz + LIFT]));
  return plane.mesh;
}

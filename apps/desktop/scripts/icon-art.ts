/**
 * The app icon (CC0, authored here): a pixel-art voxel cube on a transparent background, drawn on
 * a coarse pixel grid and scaled up with nearest-neighbour sampling, plus a minimal ICO container
 * (PNG-compressed entries, supported since Windows Vista).
 */
import type { RgbaImage } from '@reelforge/engine/raster';

type Rgba = readonly [number, number, number, number];
type Point = readonly [number, number];

const OUTLINE: Rgba = [11, 16, 38, 255];
/** [light, dark] voxel tiles of each face. */
const FACES = {
  top: [
    [126, 224, 255, 255],
    [104, 201, 236, 255],
  ],
  left: [
    [58, 123, 213, 255],
    [50, 108, 192, 255],
  ],
  right: [
    [31, 63, 138, 255],
    [26, 54, 122, 255],
  ],
} as const satisfies Record<string, readonly [Rgba, Rgba]>;

interface Face {
  readonly colors: readonly [Rgba, Rgba];
  readonly origin: Point;
  readonly edgeU: Point;
  readonly edgeV: Point;
}

/** (u, v) of `point` in the parallelogram origin + u*edgeU + v*edgeV. */
function faceCoords(face: Face, point: Point): Point {
  const [ux, uy] = face.edgeU;
  const [vx, vy] = face.edgeV;
  const dx = point[0] - face.origin[0];
  const dy = point[1] - face.origin[1];
  const det = ux * vy - uy * vx;
  return [(dx * vy - dy * vx) / det, (ux * dy - uy * dx) / det];
}

/** Cube faces on a `grid`-pixel canvas (layout designed on 32 and scaled). */
function cubeFaces(grid: number): Face[] {
  const scale = grid / 32;
  const at = (x: number, y: number): Point => [x * scale, y * scale];
  const top = at(16, 1.5);
  const left = at(2, 8.5);
  const right = at(30, 8.5);
  const center = at(16, 15.5);
  const down = at(0, 15);
  const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
  return [
    { colors: FACES.top, origin: left, edgeU: minus(top, left), edgeV: minus(center, left) },
    { colors: FACES.left, origin: left, edgeU: minus(center, left), edgeV: down },
    { colors: FACES.right, origin: center, edgeU: minus(right, center), edgeV: down },
  ];
}

/** Colour of the cube at pixel (x, y), or undefined outside it. */
function cubePixel(faces: readonly Face[], tiles: number, x: number, y: number): Rgba | undefined {
  for (const face of faces) {
    const [u, v] = faceCoords(face, [x + 0.5, y + 0.5]);
    if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
    const parity = (Math.floor(u * tiles) + Math.floor(v * tiles)) % 2;
    return parity === 0 ? face.colors[0] : face.colors[1];
  }
  return undefined;
}

/** The cube on a `grid` x `grid` canvas: shaded faces, voxel tiles, 1-pixel outline. */
export function drawVoxelCube(grid: number, tiles: number): RgbaImage {
  const faces = cubeFaces(grid);
  const data = new Uint8Array(grid * grid * 4);
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < grid && y < grid && cubePixel(faces, tiles, x, y) !== undefined;
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const color = cubePixel(faces, tiles, x, y);
      if (color === undefined) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      data.set(edge ? OUTLINE : color, (y * grid + x) * 4);
    }
  }
  return { width: grid, height: grid, data };
}

/** Nearest-neighbour upscale by an integer factor (keeps the pixels crisp). */
export function upscale(image: RgbaImage, factor: number): RgbaImage {
  const width = image.width * factor;
  const height = image.height * factor;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (Math.floor(y / factor) * image.width + Math.floor(x / factor)) * 4;
      data.set(image.data.subarray(source, source + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** Icon sizes: [size, design grid] (16 and 48 from the 16-grid design, the rest from 32). */
export const ICON_SIZES: readonly (readonly [number, 16 | 32])[] = [
  [16, 16],
  [32, 32],
  [48, 16],
  [64, 32],
  [128, 32],
  [256, 32],
];

export function iconImage(size: number, grid: 16 | 32): RgbaImage {
  return upscale(drawVoxelCube(grid, grid === 16 ? 2 : 3), size / grid);
}

export interface IcoEntry {
  readonly size: number;
  readonly png: Uint8Array;
}

/** ICO file with PNG-compressed images (ICONDIR + ICONDIRENTRY[] + data). */
export function icoContainer(entries: readonly IcoEntry[]): Buffer {
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach((entry, index) => {
    if (entry.size < 1 || entry.size > 256) throw new RangeError(`icon size ${String(entry.size)}`);
    const at = 6 + 16 * index;
    header.writeUInt8(entry.size === 256 ? 0 : entry.size, at);
    header.writeUInt8(entry.size === 256 ? 0 : entry.size, at + 1);
    header.writeUInt8(0, at + 2);
    header.writeUInt8(0, at + 3);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(entry.png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });
  return Buffer.concat([header, ...entries.map((entry) => Buffer.from(entry.png))]);
}

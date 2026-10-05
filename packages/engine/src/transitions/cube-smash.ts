/**
 * Cube smash (ADR-028, family `texture`): three voxel cubes fly at the screen (the first at the
 * focus point), each impact flashes and cracks run along the seams of a block wall hidden in the
 * picture, then the blocks fall away with voxel side faces, nearest the impacts first, onto the
 * incoming shot. Pure; every pixel is a copy of A or B or a palette colour.
 */
import { hashOf, unit, type Composition, type Compositor } from './pixels.js';
import { drawPiece, lastValueCache, measurePieces, seamAt, type PieceMap } from './pieces.js';
import { endFrames, focusPixels, lerp, phase } from './wow.js';

const ROW_HEIGHT = 36;
const MIN_BLOCK = 34;
const BLOCK_SPREAD = 34;
const CUBES = 3;
const FLIGHT = 0.16;
const FIRST_IMPACT = 0.16;
const IMPACT_GAP = 0.06;
const CRACK_LENGTH = 0.45;
const FALL_FROM = 0.4;
const FALL_SPREAD = 0.36;
const FALL_LENGTH = 0.2;

/** Seam jitter (px, -2..2) of a seam at a 4-px step along it: cracks are jagged, not ruled. */
function jag(seed: number, seam: number, along: number): number {
  return Math.floor(unit(hashOf(seed ^ 0x68e31da4, seam, along >> 2)) * 5) - 2;
}

/** Block id per pixel: rows of bricks with seeded widths, offset row to row, jagged seams. */
function buildWall(c: Composition): PieceMap {
  const { width, height, seed } = c;
  const ids = new Int32Array(width * height);
  const rows = Math.ceil(height / ROW_HEIGHT) + 1;
  const edges: number[][] = [];
  const firstIds: number[] = [];
  let next = 0;
  for (let row = 0; row < rows; row += 1) {
    const rowEdges: number[] = [];
    let x = -Math.floor(unit(hashOf(seed, row, 1)) * MIN_BLOCK);
    while (x < width + 4) {
      x += MIN_BLOCK + Math.floor(unit(hashOf(seed, row, rowEdges.length + 2)) * BLOCK_SPREAD);
      rowEdges.push(x);
    }
    edges.push(rowEdges);
    firstIds.push(next);
    next += rowEdges.length;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let row = Math.floor(y / ROW_HEIGHT);
      if (y >= (row + 1) * ROW_HEIGHT + jag(seed, row + 1, x)) row += 1;
      else if (row > 0 && y < row * ROW_HEIGHT + jag(seed, row, x)) row -= 1;
      const rowEdges = edges[row] ?? [];
      let block = 0;
      while (
        block < rowEdges.length - 1 &&
        x >= (rowEdges[block] ?? 0) + jag(seed, row * 97 + block, y)
      ) {
        block += 1;
      }
      ids[y * width + x] = (firstIds[row] ?? 0) + block;
    }
  }
  return measurePieces(ids, width, height, next);
}

const wallCache = lastValueCache<PieceMap>();

interface Impact {
  readonly x: number;
  readonly y: number;
  readonly t: number;
  /** Material: top, left and right face colours. */
  readonly faces: readonly [number, number, number];
}

const MATERIALS: readonly (readonly [number, number, number])[] = [
  [0xffb26b, 0xff8c42, 0xc75a24],
  [0x2ec4b6, 0x1f6f8b, 0x12355b],
  [0xff3cac, 0xb0279b, 0x6a1d5e],
];

function impactsOf(c: Composition, fx: number, fy: number): Impact[] {
  const { width, height, seed, tones } = c;
  const first = seed % MATERIALS.length;
  return Array.from({ length: CUBES }, (_, index) => {
    const spread = index === 0 ? 0 : 1;
    const x = fx + spread * (unit(hashOf(seed, index, 3)) - 0.5) * 0.6 * width;
    const y = fy + spread * (unit(hashOf(seed, index, 4)) - 0.5) * 0.5 * height;
    const material = MATERIALS[(first + index) % MATERIALS.length] ?? [0xffffff, 0x888888, 0];
    return {
      x: Math.min(width * 0.92, Math.max(width * 0.08, x)),
      y: Math.min(height * 0.9, Math.max(height * 0.1, y)),
      t: FIRST_IMPACT + IMPACT_GAP * index,
      faces: [tones.nearest(material[0]), tones.nearest(material[1]), tones.nearest(material[2])],
    };
  });
}

export const cubeSmash: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, out, p, seed, tones } = c;
  const [fx, fy] = focusPixels(c);
  const map = wallCache(`${String(width)}x${String(height)}|${String(seed)}`, () => buildWall(c));
  const impacts = impactsOf(c, fx, fy);
  const reach = Math.sqrt(width * width + height * height);
  const nearest = (x: number, y: number): number =>
    Math.sqrt(Math.min(...impacts.map((impact) => (x - impact.x) ** 2 + (y - impact.y) ** 2)));
  const falling: { readonly id: number; readonly fall: number }[] = [];
  const resting = new Uint8Array(map.count);
  for (let id = 0; id < map.count; id += 1) {
    const distance = nearest(map.centreX[id] ?? 0, map.centreY[id] ?? 0) / reach;
    const start = FALL_FROM + FALL_SPREAD * distance + 0.06 * unit(hashOf(seed, id, 6));
    const fall = phase(p, start, start + FALL_LENGTH);
    if (fall > 0) falling.push({ id, fall });
    else resting[id] = 1;
  }
  out.set(b);
  falling.sort((first, second) => second.fall - first.fall || first.id - second.id);
  const side = tones.nearest(0x3c4256);
  for (const { id, fall } of falling) {
    const awayX = (map.centreX[id] ?? fx) - fx;
    drawPiece(
      c,
      map,
      id,
      {
        dx: Math.sign(awayX) * 36 * fall,
        dy: -18 * fall + 1.5 * height * fall * fall,
        turn: 0,
        scale: 1 - 0.25 * fall,
        dim: 0.2 * fall,
        thickness: 2 + 6 * fall,
      },
      { edge: tones.darkest, side },
    );
  }
  const cracks = impacts.map((impact) => reach * 0.6 * phase(p, impact.t, impact.t + CRACK_LENGTH));
  const hit = impacts.find((impact) => p >= impact.t && p < impact.t + 0.05);
  const shake = hit === undefined ? 0 : (Math.floor(p * 90) & 1) === 0 ? 3 : -3;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (resting[map.ids[index] ?? 0] !== 1) continue;
      const cracked = impacts.some(
        (impact, which) => (x - impact.x) ** 2 + (y - impact.y) ** 2 < (cracks[which] ?? 0) ** 2,
      );
      const seam = cracked ? seamAt(map.ids, width, height, x, y) : 0;
      const sy = Math.min(height - 1, Math.max(0, y + shake));
      out[index] =
        seam === 1 ? tones.darkest : seam === 2 ? tones.brightest : (a[sy * width + x] ?? 0);
    }
  }
  for (const impact of impacts) {
    const flight = phase(p, impact.t - FLIGHT, impact.t);
    if (flight > 0 && flight < 1) drawCube(c, impact, fx, fy, flight);
    const flash = phase(p, impact.t, impact.t + 0.06);
    if (flash > 0 && flash < 1) drawBurst(c, impact.x, impact.y, flash);
  }
};

/** A voxel cube (2:1 isometric hexagon) flying from the distance toward its impact point. */
function drawCube(c: Composition, impact: Impact, fx: number, fy: number, q: number): void {
  const { width, height, out, tones } = c;
  const half = 3 + 40 * q ** 2.5;
  const cx = lerp(lerp(fx, width / 2, 0.5), impact.x, q);
  const cy = lerp(lerp(fy, height / 2, 0.5), impact.y, q);
  const [top, left, right] = impact.faces;
  for (let y = Math.max(0, Math.floor(cy - half)); y <= Math.min(height - 1, cy + half); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - half)); x <= Math.min(width - 1, cx + half); x += 1) {
      const u = x + 0.5 - cx;
      const v = y + 0.5 - cy;
      const au = Math.abs(u);
      const slope = au / 2;
      if (au > half || v < -half + slope || v > half - slope) continue;
      const border = Math.min(half - au, v + half - slope, half - slope - v);
      const index = y * width + x;
      if (border < 2) out[index] = tones.darkest;
      else if (v < -slope) out[index] = v > -slope - 1.5 ? tones.brightest : top;
      else out[index] = u < 0 ? left : Math.abs(u) < 1 ? tones.darkest : right;
    }
  }
}

/** An impact flash: eight short brightest-tone rays around the point. */
function drawBurst(c: Composition, cx: number, cy: number, q: number): void {
  const { width, height, out, tones } = c;
  const inner = 6 + 16 * q;
  const outer = inner + 10 * (1 - q);
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7, 0.7],
    [-0.7, 0.7],
    [0.7, -0.7],
    [-0.7, -0.7],
  ] as const;
  for (const [dx, dy] of directions) {
    for (let r = inner; r <= outer; r += 1) {
      for (let w = 0; w < 2; w += 1) {
        const x = Math.round(cx + dx * r + (dy === 0 ? 0 : w));
        const y = Math.round(cy + dy * r + (dy === 0 ? w : 0));
        if (x >= 0 && y >= 0 && x < width && y < height) out[y * width + x] = tones.brightest;
      }
    }
  }
}

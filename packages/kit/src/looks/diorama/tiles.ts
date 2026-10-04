/**
 * Tile logic of the diorama look (pure, no Three.js): a grid of tiles parsed from ASCII rows
 * (kind + floor height in voxels, for steps and raised floors) and the paths movers follow (a
 * rectangular loop for cars, a ping-pong segment for walkers). Every function is pure.
 */

/** Voxels along one tile edge; one tile is one world unit. */
export const TILE_VOXELS = 8;
/** World size of one diorama voxel (the kit's default voxel size). */
export const DIORAMA_VOXEL = 1 / TILE_VOXELS;

export interface TileSpec<Kind extends string> {
  readonly kind: Kind;
  /** Floor height of the tile in voxels above the platform top (steps, raised floors). */
  readonly height?: number;
}

export interface TileGrid<Kind extends string> {
  /** Tiles along x (screen right-down in the iso view). */
  readonly width: number;
  /** Tiles along z (screen left-down in the iso view). */
  readonly depth: number;
  /** Row-major (z, then x) tile kinds. */
  readonly kinds: readonly Kind[];
  /** Row-major floor heights in voxels. */
  readonly heights: readonly number[];
}

/** Rectangle in tiles (lane loops run along its edges). */
export interface TileRect {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
}

/**
 * Parses ASCII rows (row 0 = back edge, z = 0; column 0 = left edge, x = 0) with a legend that
 * maps every character to a tile kind and height. Rows must be equally long.
 */
export function parseTiles<Kind extends string>(
  rows: readonly string[],
  legend: Readonly<Record<string, TileSpec<Kind>>>,
): TileGrid<Kind> {
  const width = rows[0]?.length ?? 0;
  if (rows.length === 0 || width === 0) throw new Error('parseTiles: no rows');
  const kinds: Kind[] = [];
  const heights: number[] = [];
  rows.forEach((row, z) => {
    if (row.length !== width) {
      throw new Error(
        `parseTiles: row ${String(z)} has ${String(row.length)} tiles, expected ${String(width)}`,
      );
    }
    for (const char of row) {
      const spec = legend[char];
      if (spec === undefined) throw new Error(`parseTiles: "${char}" is not in the legend`);
      kinds.push(spec.kind);
      heights.push(spec.height ?? 0);
    }
  });
  return { width, depth: rows.length, kinds, heights };
}

export function inGrid<Kind extends string>(grid: TileGrid<Kind>, tx: number, tz: number): boolean {
  return tx >= 0 && tz >= 0 && tx < grid.width && tz < grid.depth;
}

/** Kind of a tile; undefined outside the grid. */
export function kindAt<Kind extends string>(
  grid: TileGrid<Kind>,
  tx: number,
  tz: number,
): Kind | undefined {
  return inGrid(grid, tx, tz) ? grid.kinds[tz * grid.width + tx] : undefined;
}

/** Floor height of a tile in voxels (0 outside the grid). */
export function heightAt<Kind extends string>(
  grid: TileGrid<Kind>,
  tx: number,
  tz: number,
): number {
  return inGrid(grid, tx, tz) ? (grid.heights[tz * grid.width + tx] ?? 0) : 0;
}

/** Position on a path: point in tiles (x, z) and heading in radians around +y (0 = +x). */
export interface PathPoint {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

/** Length of the rectangular loop through the centres of the rect's border lane. */
export function loopLength(rect: TileRect): number {
  return 2 * (rect.x1 - rect.x0 + (rect.z1 - rect.z0));
}

/**
 * Point at distance `s` (tiles, any real number, wraps) on a clockwise-seen-from-above loop
 * along the rect's edges: +x along z0, +z along x1, -x along z1, -z along x0. Corners turn
 * instantly (pixel-art cars snap their heading).
 */
export function pointOnLoop(rect: TileRect, s: number): PathPoint {
  const width = rect.x1 - rect.x0;
  const depth = rect.z1 - rect.z0;
  const total = loopLength(rect);
  let along = ((s % total) + total) % total;
  if (along < width) return { x: rect.x0 + along, z: rect.z0, heading: 0 };
  along -= width;
  if (along < depth) return { x: rect.x1, z: rect.z0 + along, heading: -Math.PI / 2 };
  along -= depth;
  if (along < width) return { x: rect.x1 - along, z: rect.z1, heading: Math.PI };
  along -= width;
  return { x: rect.x0, z: rect.z1 - along, heading: Math.PI / 2 };
}

/**
 * Walk back and forth between `from` and `to` (tile points) at `speed` tiles/s, starting at
 * `from` shifted by `phase` (0..1 of a round trip). Heading follows the walking direction.
 */
export function pingPong(
  from: readonly [number, number],
  to: readonly [number, number],
  speed: number,
  t: number,
  phase = 0,
): PathPoint {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  if (length === 0 || speed <= 0) return { x: from[0], z: from[1], heading: 0 };
  const cycle = (2 * length) / speed;
  const local = ((((t / cycle + phase) % 1) + 1) % 1) * 2 * length;
  const forward = local <= length;
  const along = forward ? local : 2 * length - local;
  const heading = Math.atan2(forward ? -dz : dz, forward ? dx : -dx);
  return { x: from[0] + (dx * along) / length, z: from[1] + (dz * along) / length, heading };
}

/** Square-wave blink: true for the `duty` share of each period, shifted by `phase` (0..1). */
export function blinkOn(t: number, rate: number, phase: number, duty = 0.5): boolean {
  if (rate <= 0) return true;
  const position = (((t * rate + phase) % 1) + 1) % 1;
  return position < duty;
}

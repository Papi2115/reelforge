/**
 * Automap geometry of a Game B2 level, derived once from the compiled grid (the showcase's
 * automap-data.js, generalised): rooms = 4-connected open cells (doors split them), every edge
 * between an open (or door) cell and a solid one becomes a pen line, merged into runs. Shell walls
 * (connected to the level's border) and interior islands (racks, counters, pillars, low walls)
 * are two line classes. Each line gets seeded hand-ruling: overruns at the corners, a 1-cell
 * restart jog on long walls, an uneven pen speed and its own dash rhythm. Static data: nothing
 * here depends on time. Cached per compiled level.
 */
import { hash3, rng } from '../core/rand.js';
import type { CompiledLevel } from '../level/compile.js';

/** One straight pen line in cells: along-axis span [a0, a1], perpendicular edge q. */
export interface PenLine {
  /** Horizontal (runs along x). */
  readonly h: boolean;
  readonly a0: number;
  readonly a1: number;
  readonly q: number;
  /** +1: the open cell is above / left of the edge, so the pen runs on the open side. */
  readonly side: number;
  /** Area: a room index, or rooms.length + door index for a door's jambs. */
  readonly area: number;
  /** 0 = shell wall, 1 = interior island. */
  readonly cls: 0 | 1;
  /** Corner overruns in px at the start / end (a draftsman's pencil). */
  readonly over0: number;
  readonly over1: number;
  /** Share of the length where a long line restarts 1 px over (0 = none), and the jog. */
  readonly jogAt: number;
  readonly jog: number;
  /** Pen speed factor (0.7-1.3). */
  readonly speed: number;
  /** Dash rhythm of an "ahead" line: px on, period, phase. */
  readonly on: number;
  readonly period: number;
  readonly phase: number;
}

export interface Room {
  readonly cells: readonly (readonly [number, number])[];
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface Door {
  readonly x: number;
  readonly y: number;
  /** 1 = the door plane is vertical (walls above and below), 2 = horizontal. */
  readonly axis: number;
  /** The rooms on its two sides (-1 = none). */
  readonly rooms: readonly [number, number];
}

export interface MapGeometry {
  readonly rooms: readonly Room[];
  readonly doors: readonly Door[];
  /** Room per cell (-1 = wall or door). */
  readonly roomOf: Int16Array;
  /** Lines per area, unordered (the automap orders them from an entry point). */
  readonly lines: readonly (readonly PenLine[])[];
}

const cache = new WeakMap<CompiledLevel, MapGeometry>();

function isDoorCell(level: CompiledLevel, i: number): boolean {
  return level.wallTypes[level.wall[i] ?? 0]?.door === true;
}

function isSolid(level: CompiledLevel, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return true;
  const i = y * level.w + x;
  return (level.wall[i] ?? 0) !== 0 && !isDoorCell(level, i);
}

/** Flood fill of the open cells; doors and walls split rooms. */
function findRooms(level: CompiledLevel): { rooms: Room[]; roomOf: Int16Array } {
  const { w, h } = level;
  const roomOf = new Int16Array(w * h).fill(-1);
  const rooms: Room[] = [];
  for (let start = 0; start < w * h; start += 1) {
    if ((level.wall[start] ?? 1) !== 0 || (roomOf[start] ?? 0) >= 0) continue;
    const id = rooms.length;
    const cells: [number, number][] = [];
    const stack = [start];
    roomOf[start] = id;
    while (stack.length > 0) {
      const i = stack.pop() ?? 0;
      const x = i % w;
      const y = (i - x) / w;
      cells.push([x, y]);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if ((level.wall[j] ?? 1) !== 0 || (roomOf[j] ?? 0) >= 0) continue;
        roomOf[j] = id;
        stack.push(j);
      }
    }
    cells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const xs = cells.map(([x]) => x);
    const ys = cells.map(([, y]) => y);
    rooms.push({
      cells,
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs) + 1,
      y1: Math.max(...ys) + 1,
    });
  }
  return { rooms, roomOf };
}

/** Solid cells reachable from the border through solid cells (the level's shell). */
function shellOf(level: CompiledLevel): Uint8Array {
  const { w, h } = level;
  const shell = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x += 1) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 1) stack.push(y * w, y * w + w - 1);
  while (stack.length > 0) {
    const i = stack.pop() ?? 0;
    const x = i % w;
    const y = (i - x) / w;
    if (shell[i] === 1 || !isSolid(level, x, y)) continue;
    const type = level.wallTypes[level.wall[i] ?? 0];
    if (type !== undefined && type.h < 1) continue;
    shell[i] = 1;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  return shell;
}

function penLine(
  h: boolean,
  a0: number,
  a1: number,
  q: number,
  side: number,
  area: number,
  cls: 0 | 1,
  seed: number,
): PenLine {
  const random = rng(seed);
  const over = (): number => (cls === 0 && random() < 0.4 ? 1 + Math.floor(random() * 2) : 0);
  const over0 = over();
  const over1 = over();
  const long = a1 - a0 >= 4 && random() < 0.55;
  const jogAt = long ? 0.3 + random() * 0.4 : 0;
  const jog = random() < 0.5 ? 1 : -1;
  const speed = 0.7 + random() * 0.6;
  const on = 3 + Math.floor(random() * 2);
  const period = on + 2 + Math.floor(random() * 2);
  const phase = Math.floor(random() * 5);
  return { h, a0, a1, q, side, area, cls, over0, over1, jogAt, jog, speed, on, period, phase };
}

function areaOf(roomOf: Int16Array, doorIndex: ReadonlyMap<number, number>, rooms: number) {
  return (i: number): number => {
    const door = doorIndex.get(i);
    return door === undefined ? (roomOf[i] ?? -1) : rooms + door;
  };
}

function findDoors(level: CompiledLevel, roomOf: Int16Array): Door[] {
  const doors: Door[] = [];
  for (let i = 0; i < level.w * level.h; i += 1) {
    if (!isDoorCell(level, i)) continue;
    const x = i % level.w;
    const y = (i - x) / level.w;
    const axis = level.doorAxis[i] ?? 1;
    const [a, b] =
      axis === 1
        ? [roomOf[i - 1] ?? -1, roomOf[i + 1] ?? -1]
        : [roomOf[i - level.w] ?? -1, roomOf[i + level.w] ?? -1];
    doors.push({ x, y, axis, rooms: [a, b] });
  }
  return doors;
}

/** Edges between open cells and solid ones, merged into runs per (line, side, area, class). */
function findLines(level: CompiledLevel, area: (i: number) => number, areas: number): PenLine[][] {
  const shell = shellOf(level);
  const runs = new Map<string, { h: boolean; q: number; side: number; at: number[] }>();
  const { w, h } = level;
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (isSolid(level, x, y)) continue;
      const owner = area(i);
      if (owner < 0) continue;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isSolid(level, nx, ny)) continue;
        const inside = nx >= 0 && ny >= 0 && nx < w && ny < h;
        const cls: 0 | 1 = inside && shell[ny * w + nx] !== 1 ? 1 : 0;
        const horizontal = dy !== 0;
        const q = horizontal ? (dy < 0 ? y : y + 1) : dx < 0 ? x : x + 1;
        const side = horizontal ? dy : dx;
        const key = `${horizontal ? 'h' : 'v'}|${String(q)}|${String(side)}|${String(owner)}|${String(cls)}`;
        let run = runs.get(key);
        if (run === undefined) {
          run = { h: horizontal, q, side, at: [] };
          runs.set(key, run);
        }
        run.at.push(horizontal ? x : y);
      }
    }
  const lines: PenLine[][] = Array.from({ length: areas }, () => []);
  let seed = 1;
  for (const [key, run] of runs) {
    const parts = key.split('|');
    const owner = Number(parts[3]);
    const cls = Number(parts[4]) === 1 ? 1 : 0;
    run.at.sort((a, b) => a - b);
    let s0 = run.at[0] ?? 0;
    for (let k = 1; k <= run.at.length; k += 1) {
      if (k < run.at.length && run.at[k] === (run.at[k - 1] ?? 0) + 1) continue;
      const end = (run.at[k - 1] ?? 0) + 1;
      const lineSeed = 7000 + Math.floor(hash3(level.seed, seed, 5) * 1e6);
      lines[owner]?.push(penLine(run.h, s0, end, run.q, run.side, owner, cls, lineSeed));
      seed += 1;
      s0 = run.at[k] ?? 0;
    }
  }
  return lines;
}

/** The automap geometry of a level (built once, cached). */
export function mapGeometry(level: CompiledLevel): MapGeometry {
  const hit = cache.get(level);
  if (hit !== undefined) return hit;
  const { rooms, roomOf } = findRooms(level);
  const doors = findDoors(level, roomOf);
  const doorIndex = new Map(doors.map((door, k) => [door.y * level.w + door.x, k]));
  const area = areaOf(roomOf, doorIndex, rooms.length);
  const lines = findLines(level, area, rooms.length + doors.length);
  const geometry = { rooms, doors, roomOf, lines };
  cache.set(level, geometry);
  return geometry;
}

/** The room of a point in cells (-1 = a wall or door cell, or outside). */
export function roomOfPoint(geometry: MapGeometry, level: CompiledLevel, x: number, y: number) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= level.w || cy >= level.h) return -1;
  return geometry.roomOf[cy * level.w + cx] ?? -1;
}

/**
 * Pencil order of an area's lines: a greedy chain from `entry` (cells), each line drawn from its
 * nearer end; returns the lines with their drawing direction and the total weighted length.
 */
export function pencilOrder(
  lines: readonly PenLine[],
  entry: readonly [number, number],
): { readonly order: readonly { line: PenLine; flip: boolean }[]; readonly weight: number } {
  const pool = [...lines].sort((a, b) => a.cls - b.cls);
  const order: { line: PenLine; flip: boolean }[] = [];
  let [px, py] = entry;
  for (const cls of [0, 1] as const) {
    const left = pool.filter((line) => line.cls === cls);
    while (left.length > 0) {
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      let flip = false;
      for (const [k, line] of left.entries()) {
        const [ax, ay, bx, by] = line.h
          ? [line.a0, line.q, line.a1, line.q]
          : [line.q, line.a0, line.q, line.a1];
        const da = Math.abs(ax - px) + Math.abs(ay - py);
        const db = Math.abs(bx - px) + Math.abs(by - py);
        if (da < bestDistance) [best, bestDistance, flip] = [k, da, false];
        if (db < bestDistance) [best, bestDistance, flip] = [k, db, true];
      }
      const [line] = left.splice(best, 1);
      if (line === undefined) break;
      order.push({ line, flip });
      const end = flip ? line.a0 : line.a1;
      [px, py] = line.h ? [end, line.q] : [line.q, end];
    }
  }
  const weight = order.reduce((sum, { line }) => sum + (line.a1 - line.a0) * line.speed, 0);
  return { order, weight };
}

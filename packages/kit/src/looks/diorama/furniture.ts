/**
 * Indoor iso objects of the diorama look, drawn into the canvas through stamps (voxel size 1/8:
 * a tile is 8 voxels, a standing figure 11). Every function returns the canvas point of the
 * object's top centre (for anchors) and the glow cells it owns (screens, LEDs).
 */
import type { Sketch } from '../../props/sketch.js';
import type { Vec3 } from '../../types.js';
import { Stamp, type Facing, type GlowCell } from './canvas.js';
import type { Slot } from './tones.js';

export interface Placed {
  /** Canvas grid point of the top centre. */
  readonly top: Vec3;
  readonly glow: readonly GlowCell[];
}

type Canvas = Sketch<Slot>;

function topOf(stamp: Stamp, height: number): Vec3 {
  return stamp.point(stamp.footprint[0] / 2, height, stamp.footprint[1] / 2);
}

/** Office desk 12 x 6 with a monitor (screen glow 4 x 2), keyboard and a paper or mug. */
export function desk(canvas: Canvas, at: Vec3, facing: Facing, variant = 0): Placed {
  const s = new Stamp(canvas, at, [12, 6], facing);
  for (const [u, v] of [
    [0, 0],
    [11, 0],
    [0, 5],
    [11, 5],
  ] as const)
    s.box('woodDark', [u, 0, v], [u + 1, 4, v + 1]);
  s.box('woodDark', [1, 1, 0], [11, 4, 1]);
  s.box('wood', [0, 4, 0], [12, 5, 6]);
  s.box('metalDark', [5, 5, 1], [7, 6, 2]);
  s.box('darkest', [3, 6, 1], [9, 10, 2]);
  s.box('metal', [4, 5, 3], [8, 6, 4]);
  if (variant % 2 === 0) s.box('paper', [9, 5, 2], [11, 6, 4]);
  else s.box('paper', [10, 5, 3], [11, 7, 4]);
  const glow: GlowCell[] = [];
  for (let y = 7; y < 9; y += 1) for (let u = 4; u < 8; u += 1) glow.push(s.front(u, y, 1));
  return { top: topOf(s, 5), glow };
}

/** Office chair 4 x 4 whose back faces the stamp front. */
export function chair(canvas: Canvas, at: Vec3, facing: Facing): Placed {
  const s = new Stamp(canvas, at, [4, 4], facing);
  s.box('metalDark', [1, 0, 1], [3, 2, 3]);
  s.box('dark', [0, 2, 0], [4, 3, 4]);
  s.box('dark', [0, 3, 3], [4, 7, 4]);
  s.paint('accentDark', [0, 6, 3], [4, 7, 4]);
  return { top: topOf(s, 7), glow: [] };
}

/** Seated figure on a chair at the same `at` (back towards the stamp front). */
export function seated(canvas: Canvas, at: Vec3, facing: Facing, shirt: Slot): Placed {
  const s = new Stamp(canvas, at, [4, 4], facing);
  s.box('pants', [1, 3, -1], [3, 4, 2]);
  s.box(shirt, [0, 3, 1], [4, 7, 3]);
  s.box('skin', [1, 7, 1], [3, 9, 3]);
  s.box('hair', [1, 9, 1], [3, 10, 3]);
  s.box('hair', [1, 8, 2], [3, 9, 3]);
  return { top: topOf(s, 10), glow: [] };
}

/** Standing figure 4 x 2, 11 voxels tall, facing the stamp front. */
export function standing(canvas: Canvas, at: Vec3, facing: Facing, shirt: Slot): Placed {
  const s = new Stamp(canvas, at, [4, 2], facing);
  drawStanding(s, shirt);
  return { top: topOf(s, 11), glow: [] };
}

/** The standing figure in a stamp (also used for walker meshes). */
export function drawStanding(s: Stamp, shirt: Slot): void {
  s.box('darkest', [1, 0, 0], [3, 1, 2]);
  s.box('pants', [1, 1, 0], [3, 4, 2]);
  s.box(shirt, [0, 4, 0], [4, 8, 2]);
  s.paint('skin', [0, 4, 0], [1, 5, 2]);
  s.paint('skin', [3, 4, 0], [4, 5, 2]);
  s.box('skin', [1, 8, 0], [3, 10, 2]);
  s.box('hair', [1, 10, 0], [3, 11, 2]);
  s.box('hair', [1, 9, 0], [3, 10, 1]);
}

/** Potted plant: small 3 x 3 (6 tall) or tall 4 x 4 (9 tall). */
export function plant(canvas: Canvas, at: Vec3, tall: boolean): Placed {
  if (!tall) {
    const s = new Stamp(canvas, at, [3, 3], 'z');
    s.box('pot', [0, 0, 0], [3, 2, 3]);
    s.box('leaf', [0, 2, 0], [3, 4, 3]);
    s.box('leaf', [1, 4, 1], [2, 6, 2]);
    s.set('leafDark', 0, 2, 2).set('leafDark', 2, 3, 0).set('leafDark', 2, 2, 2);
    return { top: topOf(s, 6), glow: [] };
  }
  const s = new Stamp(canvas, at, [4, 4], 'z');
  s.box('pot', [0, 0, 0], [4, 3, 4]);
  s.box('leafDark', [0, 3, 0], [4, 5, 4]);
  s.box('leaf', [0, 5, 0], [4, 7, 4]);
  s.box(null, [0, 6, 0], [1, 7, 1]).box(null, [3, 6, 3], [4, 7, 4]);
  s.box('leaf', [1, 7, 1], [3, 9, 3]);
  s.set('leafDark', 3, 5, 1).set('leafDark', 0, 6, 3).set('leafDark', 2, 8, 2);
  return { top: topOf(s, 9), glow: [] };
}

/** Floor lamp 3 x 3, 11 tall; its shade is the `lamp` slot (glows at dusk and night). */
export function floorLamp(canvas: Canvas, at: Vec3): Placed {
  const s = new Stamp(canvas, at, [3, 3], 'z');
  s.box('metalDark', [0, 0, 0], [3, 1, 3]);
  s.box('metal', [1, 1, 1], [2, 9, 2]);
  s.box('lamp', [0, 9, 0], [3, 11, 3]);
  return { top: topOf(s, 11), glow: [] };
}

/** Filing cabinet 4 x 4, 8 tall. */
export function cabinet(canvas: Canvas, at: Vec3, facing: Facing): Placed {
  const s = new Stamp(canvas, at, [4, 4], facing);
  s.box('metal', [0, 0, 0], [4, 8, 4]);
  s.paint('metalDark', [0, 3, 3], [4, 4, 4]);
  s.paint('metalDark', [0, 6, 3], [4, 7, 4]);
  s.paint('paper', [1, 1, 3], [3, 2, 4]).paint('paper', [1, 4, 3], [3, 5, 4]);
  s.box('paper', [1, 8, 1], [3, 9, 3]);
  return { top: topOf(s, 9), glow: [] };
}

/** Water cooler 3 x 3, 9 tall. */
export function waterCooler(canvas: Canvas, at: Vec3): Placed {
  const s = new Stamp(canvas, at, [3, 3], 'z');
  s.box('metal', [0, 0, 0], [3, 6, 3]);
  s.paint('metalDark', [0, 4, 2], [3, 5, 3]);
  s.box('water', [0, 6, 0], [3, 9, 3]);
  return { top: topOf(s, 9), glow: [] };
}

/** Meeting table 16 x 8 with papers and a laptop (screen glow). */
export function meetingTable(canvas: Canvas, at: Vec3, facing: Facing): Placed {
  const s = new Stamp(canvas, at, [16, 8], facing);
  s.box('woodDark', [6, 0, 3], [10, 4, 5]);
  s.box('wood', [0, 4, 0], [16, 5, 8]);
  s.box('paper', [2, 5, 2], [4, 6, 4]).box('paper', [11, 5, 5], [13, 6, 7]);
  s.box('metalDark', [6, 5, 4], [10, 6, 6]);
  s.box('darkest', [6, 6, 3], [10, 8, 4]);
  const glow = [s.front(7, 6, 3), s.front(8, 6, 3), s.front(7, 7, 3), s.front(8, 7, 3)];
  return { top: topOf(s, 5), glow };
}

/** Server rack 6 x 6, `height` voxels; LED glow cells on the front (3 per unit of 2 voxels). */
export function rack(canvas: Canvas, at: Vec3, facing: Facing, height: number): Placed {
  const s = new Stamp(canvas, at, [6, 6], facing);
  s.box('dark', [0, 0, 0], [6, height, 6]);
  s.box('darkest', [1, 1, 5], [5, height - 1, 6]);
  s.paint('metal', [0, height - 1, 0], [6, height, 6]);
  for (let y = 2; y < height - 2; y += 3) s.paint('metalDark', [5, y, 0], [6, y + 1, 5]);
  const glow: GlowCell[] = [];
  for (let y = 2; y < height - 1; y += 2) {
    s.paint('metalDark', [1, y, 5], [5, y + 1, 6]);
    glow.push(s.front(1, y, 5), s.front(2, y, 5));
    if ((y / 2) % 2 === 0) glow.push(s.front(4, y, 5));
  }
  return { top: topOf(s, height), glow };
}

/** Precision cooling unit 8 x 6, 13 tall, with a status display (2 glow cells). */
export function coolingUnit(canvas: Canvas, at: Vec3, facing: Facing): Placed {
  const s = new Stamp(canvas, at, [8, 6], facing);
  s.box('metal', [0, 0, 0], [8, 13, 6]);
  for (let y = 2; y < 9; y += 2) s.paint('metalDark', [1, y, 5], [7, y + 1, 6]);
  s.paint('darkest', [1, 10, 5], [5, 12, 6]);
  s.paint('metalDark', [0, 12, 0], [8, 13, 6]);
  return { top: topOf(s, 13), glow: [s.front(2, 11, 5), s.front(3, 11, 5)] };
}

/** Bookshelf 8 x 3, 12 tall, books coloured by `seed`. */
export function bookshelf(canvas: Canvas, at: Vec3, facing: Facing, seed: number): Placed {
  const s = new Stamp(canvas, at, [8, 3], facing);
  s.box('woodDark', [0, 0, 0], [8, 12, 3]);
  s.box(null, [1, 1, 1], [7, 11, 3]);
  s.box('wood', [1, 4, 0], [7, 5, 3]).box('wood', [1, 8, 0], [7, 9, 3]);
  const books: readonly Slot[] = ['shirtA', 'shirtB', 'shirtC', 'paper', 'fabricAlt', 'accent'];
  for (const shelf of [1, 5, 9]) {
    for (let u = 1; u < 7; u += 1) {
      const pick = (u * 7 + shelf * 3 + seed) % 11;
      if (pick === 0) continue;
      const tall = pick % 3 === 0 ? 2 : 3;
      s.box(books[pick % books.length] ?? 'paper', [u, shelf, 1], [u + 1, shelf + tall, 3]);
    }
  }
  return { top: topOf(s, 12), glow: [] };
}

/** Bed 10 x 16 with headboard at the stamp back, pillow and blanket. */
export function bed(canvas: Canvas, at: Vec3, facing: Facing): Placed {
  const s = new Stamp(canvas, at, [10, 16], facing);
  s.box('woodDark', [0, 0, 0], [10, 3, 16]);
  s.box('woodDark', [0, 0, 0], [10, 8, 2]);
  s.paint('wood', [0, 7, 0], [10, 8, 2]);
  s.box('paper', [1, 3, 2], [9, 4, 15]);
  s.box('fabric', [2, 4, 3], [8, 5, 6]);
  s.box('fabricAlt', [0, 2, 7], [10, 5, 16]);
  s.paint('rugBorder', [0, 4, 7], [10, 5, 8]);
  return { top: topOf(s, 5), glow: [] };
}

/** Small cat 2 x 4 (lying), facing the stamp front. */
export function cat(canvas: Canvas, at: Vec3, facing: Facing): Placed {
  const s = new Stamp(canvas, at, [2, 4], facing);
  s.box('shirtA', [0, 0, 0], [2, 2, 3]);
  s.box('shirtA', [0, 0, 3], [2, 3, 4]);
  s.set('darkest', 0, 2, 3).set('darkest', 1, 2, 3);
  s.box('shirtA', [1, 0, -1], [2, 1, 0]);
  return { top: topOf(s, 3), glow: [] };
}

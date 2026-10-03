/**
 * Outdoor iso objects of the diorama look (city block): buildings with window grids, roof
 * details and a shop front, trees, street lamps, a traffic light, benches and a fountain.
 */
import { hashCell } from '../../env/shared.js';
import type { Sketch } from '../../props/sketch.js';
import type { Vec3 } from '../../types.js';
import { Stamp, type Facing, type GlowCell } from './canvas.js';
import type { Placed } from './furniture.js';
import type { Slot } from './tones.js';

type Canvas = Sketch<Slot>;

export type RoofDetail = 'flat' | 'ac' | 'antenna' | 'chimney';

export interface BuildingSpec {
  readonly width: number;
  readonly deep: number;
  readonly height: number;
  readonly body: Slot;
  readonly seed: number;
  /** Share of windows drawn lit (static). */
  readonly lit: number;
  readonly roof: RoofDetail;
  /** Shop front with an accent awning on the ground floor. */
  readonly shop: boolean;
}

export interface PlacedBuilding extends Placed {
  /** Glow cells of a few windows on the visible faces (for twinkling at night). */
  readonly windows: readonly GlowCell[];
  /** Blinking aviation light on the antenna. */
  readonly beacon: readonly GlowCell[];
  /** Canvas point where chimney smoke starts (undefined without a chimney). */
  readonly smoke: Vec3 | undefined;
}

const FLOOR = 3;
const GROUND = 4;

function windowSlot(spec: BuildingSpec, a: number, y: number, b: number): Slot {
  return hashCell(a, y, b, spec.seed) < spec.lit ? 'windowLit' : 'windowDark';
}

/** Building: body, window rows every 3 voxels, parapet, roof detail, optional shop front. */
export function building(canvas: Canvas, at: Vec3, facing: Facing, spec: BuildingSpec) {
  const { width: w, deep: d, height: h } = spec;
  const s = new Stamp(canvas, at, [w, d], facing);
  s.box(spec.body, [0, 0, 0], [w, h, d]);
  s.paint('roof', [0, h - 1, 0], [w, h, d]);
  s.box(spec.body, [0, h, 0], [w, h + 1, d]).box(null, [1, h, 1], [w - 1, h + 1, d - 1]);
  s.paint('dark', [0, 0, 0], [w, 1, d]);
  const windows: GlowCell[] = [];
  const sideU = s.visibleSide();
  for (let y = GROUND + 1; y + 2 < h; y += FLOOR) {
    for (let u = 1; u < w - 1; u += 2) {
      s.paint(windowSlot(spec, u, y, 0), [u, y, d - 1], [u + 1, y + 2, d]);
      s.paint(windowSlot(spec, u, y, 1), [u, y, 0], [u + 1, y + 2, 1]);
      if (hashCell(u, y, 7, spec.seed) < 0.18) windows.push(s.front(u, y + 1, d - 1));
    }
    for (let v = 1; v < d - 1; v += 2) {
      s.paint(windowSlot(spec, 0, y, v), [0, y, v], [1, y + 2, v + 1]);
      s.paint(windowSlot(spec, w - 1, y, v), [w - 1, y, v], [w, y + 2, v + 1]);
      if (hashCell(v, y, 9, spec.seed) < 0.18) windows.push(s.side(sideU, y + 1, v));
    }
  }
  if (spec.shop) {
    s.paint('windowLit', [1, 1, d - 1], [w - 1, GROUND - 1, d]);
    const door = Math.floor(w / 2) - 1;
    s.paint('darkest', [door, 1, d - 1], [door + 2, GROUND, d]);
    s.box('accent', [0, GROUND, d], [w, GROUND + 1, d + 1]);
  }
  let smoke: Vec3 | undefined;
  const beacon: GlowCell[] = [];
  if (spec.roof === 'ac')
    s.box('metal', [2, h, 2], [5, h + 2, 4]).box('metalDark', [2, h + 2, 2], [5, h + 3, 4]);
  if (spec.roof === 'antenna') {
    s.box('metal', [w - 3, h, 2], [w - 2, h + 6, 3]);
    beacon.push(s.top(w - 3, h + 5, 2));
  }
  if (spec.roof === 'chimney') {
    s.box('metalDark', [2, h, 2], [4, h + 3, 4]);
    smoke = s.point(3, h + 3, 3);
  }
  return {
    top: s.point(w / 2, h, d / 2),
    glow: [],
    windows,
    beacon,
    smoke,
  } satisfies PlacedBuilding;
}

/** Street tree 5 x 5, 9 tall. */
export function tree(canvas: Canvas, at: Vec3, seed: number): Placed {
  const s = new Stamp(canvas, at, [5, 5], 'z');
  s.box('trunk', [2, 0, 2], [3, 3, 3]);
  s.box('leafDark', [0, 3, 0], [5, 5, 5]);
  s.box('leaf', [0, 5, 0], [5, 7, 5]);
  for (const [u, v] of [
    [0, 0],
    [4, 0],
    [0, 4],
    [4, 4],
  ] as const)
    s.box(null, [u, 3, v], [u + 1, 7, v + 1]);
  s.box('leaf', [1, 7, 1], [4, 9, 4]);
  if (seed % 2 === 0) s.set('leafDark', 3, 8, 3);
  s.set('leafDark', 1, 6, 4).set('leafDark', 4, 5, 2);
  return { top: s.point(2.5, 9, 2.5), glow: [] };
}

/**
 * Street lamp: pole, arm and `lamp` head (glows at dusk/night). `reach` 'front': the pole stands
 * at the stamp back and the arm reaches to its front; 'back': the other way round.
 */
export function streetLamp(
  canvas: Canvas,
  at: Vec3,
  facing: Facing,
  reach: 'front' | 'back',
): Placed {
  const s = new Stamp(canvas, at, [1, 4], facing);
  const pole = reach === 'front' ? 0 : 3;
  const head = 3 - pole;
  s.box('metalDark', [0, 0, pole], [1, 12, pole + 1]);
  s.box('metalDark', [0, 12, 0], [1, 13, 4]);
  s.box('lamp', [0, 11, head], [1, 12, head + 1]);
  return { top: s.point(0.5, 13, 2), glow: [] };
}

/** Traffic light: pole and a 3-lamp head; glow cells bottom (go) to top (stop). */
export function trafficLight(canvas: Canvas, at: Vec3, facing: Facing): Placed {
  const s = new Stamp(canvas, at, [1, 1], facing);
  s.box('metalDark', [0, 0, 0], [1, 7, 1]);
  s.box('darkest', [0, 7, 0], [1, 10, 1]);
  return {
    top: s.point(0.5, 10, 0.5),
    glow: [s.front(0, 7, 0), s.front(0, 8, 0), s.front(0, 9, 0)],
  };
}

/** Park bench 6 x 2. */
export function bench(canvas: Canvas, at: Vec3, facing: Facing): Placed {
  const s = new Stamp(canvas, at, [6, 2], facing);
  s.box('metalDark', [0, 0, 0], [1, 2, 2]).box('metalDark', [5, 0, 0], [6, 2, 2]);
  s.box('wood', [0, 2, 0], [6, 3, 2]);
  s.box('wood', [0, 3, 0], [6, 5, 1]);
  return { top: s.point(3, 3, 1), glow: [] };
}

/** Fountain 10 x 10: basin, water with sparkle cells (glow on top) and a spout. */
export function fountain(canvas: Canvas, at: Vec3): Placed {
  const s = new Stamp(canvas, at, [10, 10], 'z');
  s.box('curb', [0, 0, 0], [10, 2, 10]);
  s.box('water', [1, 1, 1], [9, 2, 9]);
  s.box('curb', [4, 1, 4], [6, 4, 6]);
  s.box('water', [4, 4, 4], [6, 5, 6]);
  const glow: GlowCell[] = [];
  for (const [u, v] of [
    [2, 2],
    [6, 2],
    [3, 7],
    [7, 6],
    [2, 5],
    [7, 3],
  ] as const)
    glow.push(s.top(u, 1, v));
  return { top: s.point(5, 5, 5), glow };
}

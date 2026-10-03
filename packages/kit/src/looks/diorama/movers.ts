/**
 * Moving parts of the dioramas: cars on a lane loop, walking figures, smoke puffs. Each is a
 * small voxel mesh posed absolutely from t (positions snapped to whole voxels, so motion steps
 * like pixel art). Paths are in tile units of the canvas (tiles.ts).
 */
import { Sketch } from '../../props/sketch.js';
import type { KitTools } from '../../registry.js';
import type { Vec3 } from '../../types.js';
import type { VoxelColor } from '../../voxel/model.js';
import { OVERHANG, Stamp } from './canvas.js';
import type { Mover } from './diorama.js';
import { drawStanding } from './furniture.js';
import { DIORAMA_VOXEL, TILE_VOXELS, type PathPoint } from './tiles.js';
import type { Slot } from './tones.js';

type Colors = Readonly<Record<Slot, VoxelColor>>;
type ToLocal = (point: Vec3) => Vec3;

/** Local position of a path point (tiles) at canvas height `y`, snapped to whole voxels. */
function placeOnPath(toLocal: ToLocal, point: PathPoint, y: number): Vec3 {
  const x = Math.round(OVERHANG + point.x * TILE_VOXELS);
  const z = Math.round(OVERHANG + point.z * TILE_VOXELS);
  return toLocal([x, y, z]);
}

/** Car 7 x 4 x 4 (length along +x): wheels, body, glass band, roof, head and tail lights. */
function carSketch(colors: Colors, body: Slot): Sketch<Slot> {
  const s = new Sketch<Slot>([7, 4, 4], colors);
  s.box('darkest', [1, 0, 0], [2, 1, 4]).box('darkest', [5, 0, 0], [6, 1, 4]);
  s.box(body, [0, 1, 0], [7, 3, 4]);
  s.box('windowDark', [2, 3, 0], [5, 4, 4]);
  s.box(body, [3, 3, 0], [4, 4, 4]);
  s.set('lamp', 6, 2, 0).set('lamp', 6, 2, 3);
  s.set('shirtC', 0, 2, 0).set('shirtC', 0, 2, 3);
  return s;
}

export interface CarSpec {
  readonly name: string;
  readonly body: Slot;
  /** Lane path for time t (tile units). */
  path(t: number): PathPoint;
  /** Canvas y of the road surface. */
  readonly y: number;
}

export function carMover(tools: KitTools, colors: Colors, toLocal: ToLocal, spec: CarSpec): Mover {
  const object = tools.voxel.mesh(carSketch(colors, spec.body).model(tools.voxel), {
    voxelSize: DIORAMA_VOXEL,
  });
  object.name = spec.name;
  const pose = (t: number): void => {
    const point = spec.path(t);
    object.position.set(...placeOnPath(toLocal, point, spec.y));
    object.rotation.y = point.heading;
  };
  return { name: spec.name, object, pose };
}

/** Walker frames: legs together and mid-stride (body 4 x 2 at v = 1..3 of a 4-deep canvas). */
function walkerSketch(colors: Colors, shirt: Slot, stride: boolean): Sketch<Slot> {
  const s = new Sketch<Slot>([4, 11, 4], colors);
  drawStanding(new Stamp(s, [0, 0, 1], [4, 2], 'z'), shirt);
  if (stride) {
    s.box(null, [1, 0, 1], [3, 4, 3]);
    s.box('pants', [1, 1, 2], [2, 4, 4]).box('darkest', [1, 0, 2], [2, 1, 4]);
    s.box('pants', [2, 1, 0], [3, 4, 2]).box('darkest', [2, 0, 0], [3, 1, 2]);
  }
  return s;
}

export interface WalkerSpec {
  readonly name: string;
  readonly shirt: Slot;
  path(t: number): PathPoint;
  readonly y: number;
}

export function walkerMover(
  tools: KitTools,
  colors: Colors,
  toLocal: ToLocal,
  spec: WalkerSpec,
): Mover {
  const object = tools.voxel.group();
  object.name = spec.name;
  const frames = [false, true].map((stride) => {
    const mesh = tools.voxel.mesh(walkerSketch(colors, spec.shirt, stride).model(tools.voxel), {
      voxelSize: DIORAMA_VOXEL,
    });
    object.add(mesh);
    return mesh;
  });
  const pose = (t: number): void => {
    const point = spec.path(t);
    object.position.set(...placeOnPath(toLocal, point, spec.y));
    object.rotation.y = point.heading + Math.PI / 2;
    const step = Math.floor(t * 4) % 2 === 0;
    frames.forEach((frame, index) => {
      frame.visible = (index === 1) === step;
    });
  };
  return { name: spec.name, object, pose };
}

const PUFFS = 3;
const PUFF_STEPS = [1, 0.75, 0.5] as const;

export interface SmokeSpec {
  readonly name: string;
  /** Canvas point where the puffs start. */
  readonly origin: Vec3;
  /** Puff edge in voxels (2 for chimneys, 1 for a mug). */
  readonly size: number;
  /** Rise over one puff's life, in voxels. */
  readonly rise: number;
  /** Seconds per puff cycle. */
  readonly period: number;
}

/** Smoke or steam: puffs rise, drift and shrink in voxel steps, looping. */
export function smokeMover(
  tools: KitTools,
  colors: Colors,
  toLocal: ToLocal,
  spec: SmokeSpec,
): Mover {
  const object = tools.voxel.group();
  object.name = spec.name;
  const { size } = spec;
  const model = new Sketch<Slot>([size, size, size], colors).box(
    'metal',
    [0, 0, 0],
    [size, size, size],
  );
  const puffs = Array.from({ length: PUFFS }, () => {
    const mesh = tools.voxel.mesh(model.model(tools.voxel), { voxelSize: DIORAMA_VOXEL });
    object.add(mesh);
    return mesh;
  });
  const [ox, oy, oz] = spec.origin;
  const pose = (t: number): void => {
    puffs.forEach((puff, index) => {
      const k = (((t / spec.period + index / PUFFS) % 1) + 1) % 1;
      const rise = Math.round(k * spec.rise);
      const drift = Math.round(k * spec.rise * 0.35);
      puff.position.set(...toLocal([ox + drift, oy + rise, oz - Math.round(drift / 2)]));
      const step = PUFF_STEPS[Math.min(PUFF_STEPS.length - 1, Math.floor(k * PUFF_STEPS.length))];
      puff.scale.setScalar(step ?? 1);
    });
  };
  return { name: spec.name, object, pose };
}

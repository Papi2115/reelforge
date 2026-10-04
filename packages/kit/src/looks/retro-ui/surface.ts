/**
 * Retro surfaces: a template = a painter (pure `paint(canvas, t)` in UI pixels) shown on an unlit,
 * nearest-filtered plane facing +z. The plane is `width x height` UI pixels of `pixel` units each,
 * centred on the object origin. `update(t)` repaints, uploads only when a pixel changed, and moves
 * the template's named anchors (UI pixel points) into local units, so `ctx.annotate.*` can target
 * `{ object, anchor: 'title' }` and lines/words that move with t. Containers (window, CRT) call a
 * child's painter into their own canvas (`show(child)`) and pass its anchors through.
 */
import type * as THREE from 'three';
import { KitError } from '../../errors.js';
import { createKitObject, isKitObject, type KitObject } from '../../object.js';
import type { KitTools } from '../../registry.js';
import { CLEAR, createCanvas, type PixelCanvas, type Point } from './canvas.js';
import { resolveRoles, type RoleColors } from './colors.js';

/** Named points of a painted frame, in canvas pixels (x right, y down). */
export type AnchorMap = Record<string, Point>;

export interface RetroPainter {
  /** Natural size in UI pixels (the canvas the template paints into on its own). */
  readonly width: number;
  readonly height: number;
  /** Paints the frame at t into `canvas` (any size: layouts follow canvas.width/height). */
  paint(canvas: PixelCanvas, t: number): AnchorMap;
}

/** Default world size of one UI pixel (a 320x180 UI fills the frame at 2 px per UI pixel). */
export const DEFAULT_PIXEL = 0.02;
const DEFAULT_FOV = 50;
const DEFAULT_FRAME_HEIGHT = 360;

const PAINTERS = new WeakMap<object, RetroPainter>();

/** The painter of a retro-UI template (undefined for other objects). */
export function painterOf(value: unknown): RetroPainter | undefined {
  return typeof value === 'object' && value !== null ? PAINTERS.get(value) : undefined;
}

export interface RetroMethods {
  /** Repaints the template for local time t (pure). Call it every frame. */
  update(t: number): void;
  /** Camera distance (along +z, from the plane) at which one UI pixel is `px` frame pixels. */
  fitDistance(px?: number, fov?: number, frameHeight?: number): number;
}

export type RetroObject = KitObject & RetroMethods;

export interface SurfaceSpec {
  readonly kitType: string;
  readonly painter: RetroPainter;
  /** World size of one UI pixel. */
  readonly pixel: number;
  /** Canvas pixels per UI pixel (2 for the CRT's scanlines). */
  readonly density?: number | undefined;
  /** Extra kit objects/meshes added under the object (casings, desks). */
  readonly parts?: readonly THREE.Object3D[] | undefined;
  /** Plane offset from the object origin (units). */
  readonly planeOffset?: readonly [number, number, number] | undefined;
}

export function finiteTime(kitType: string, t: unknown): number {
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  throw new KitError(
    'invalid-params',
    `${kitType}.update(t): t must be a finite time in seconds (got ${String(t)})`,
  );
}

function createTexture(tools: KitTools, canvas: PixelCanvas, data: Uint8Array): THREE.DataTexture {
  const { three } = tools;
  const texture = tools.track(
    new three.DataTexture(data, canvas.width, canvas.height, three.RGBAFormat),
  );
  texture.magFilter = three.NearestFilter;
  texture.minFilter = three.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

/** Writes canvas indices as RGBA rows into a bottom-up texture buffer. */
export function writeRgba(canvas: PixelCanvas, colors: RoleColors, target: Uint8Array): void {
  const { width, height, data } = canvas;
  for (let y = 0; y < height; y += 1) {
    const row = (height - 1 - y) * width;
    for (let x = 0; x < width; x += 1) {
      const index = data[y * width + x] ?? CLEAR;
      target.set(colors.rgba.subarray(index * 4, index * 4 + 4), (row + x) * 4);
    }
  }
}

/** Builds the template object: plane + texture + anchors + update/fitDistance. */
export function createSurface(tools: KitTools, spec: SurfaceSpec): RetroObject {
  const { three } = tools;
  const density = spec.density ?? 1;
  const { painter, pixel } = spec;
  const canvas = createCanvas(painter.width * density, painter.height * density);
  const colors = resolveRoles(tools.palette);
  const rgba = new Uint8Array(canvas.width * canvas.height * 4);
  const texture = createTexture(tools, canvas, rgba);
  const material = tools.track(
    new three.MeshBasicMaterial({ map: texture, alphaTest: 0.5, fog: false }),
  );
  const geometry = tools.track(
    new three.PlaneGeometry(painter.width * pixel, painter.height * pixel),
  );
  const plane = new three.Mesh(geometry, material);
  plane.name = `${spec.kitType}Surface`;
  const [ox, oy, oz] = spec.planeOffset ?? [0, 0, 0];
  plane.position.set(ox, oy, oz);
  const object = createKitObject(three, { kitType: spec.kitType });
  object.add(plane, ...(spec.parts ?? []));
  const shown = new Uint8Array(canvas.data.length).fill(255);
  const toLocal = ([x, y]: Point): [number, number, number] => [
    ox + (x / density - painter.width / 2) * pixel,
    oy + (painter.height / 2 - y / density) * pixel,
    oz + pixel * 0.5,
  ];
  const update = (t: unknown): void => {
    const time = finiteTime(spec.kitType, t);
    canvas.data.fill(CLEAR);
    const anchors = painter.paint(canvas, time);
    for (const [name, point] of Object.entries(anchors)) object.setAnchor(name, toLocal(point));
    let changed = false;
    for (let index = 0; index < shown.length; index += 1) {
      if (shown[index] !== canvas.data[index]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    shown.set(canvas.data);
    writeRgba(canvas, colors, rgba);
    texture.needsUpdate = true;
  };
  const fitDistance = (px = 2, fov = DEFAULT_FOV, frameHeight = DEFAULT_FRAME_HEIGHT): number => {
    const scale = object.scale.y;
    const visible = (frameHeight / px) * pixel * scale;
    return visible / (2 * Math.tan(((fov / 2) * Math.PI) / 180));
  };
  const result = Object.assign(object, { update, fitDistance });
  PAINTERS.set(result, painter);
  update(0);
  return result;
}

/** Validates the child of `show(child)` and hides its own plane (the container paints it). */
export function adoptChild(call: string, child: unknown): RetroPainter {
  const painter = painterOf(child);
  if (painter === undefined || !isKitObject(child)) {
    throw new KitError(
      'invalid-params',
      `${call}: child must be a retro-UI template (kit.props.retroTerminal/retroWindow/retroBrowser/retroDocument)`,
    );
  }
  child.visible = false;
  return painter;
}

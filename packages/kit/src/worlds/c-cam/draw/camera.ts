/**
 * C-CAM camera (PLAN.md#14.6): one cut table for every shot, the world<->screen mapping, foreground
 * pieces in screen and world space and a path-only silhouette. The set-coverage check is in
 * camera-coverage.ts, the cut-table zod schema (source of the `Cut` / `Framing` types) in
 * camera-schema.ts. Pure: nothing here reads a clock; `t` is shot time in seconds.
 *
 * Public API
 *   resolveCut(cuts, t, clock = 'twos'): ResolvedCut      the framing on screen at t (move applied)
 *   cutFramingAt(cut, t): CameraState                       one cut's framing at raw t
 *   clampFraming(framing): CameraState                      zoom/roll clamped to ZOOM_MIN..MAX, +-ROT_MAX
 *   applyCamera(g, framing): CameraRig                      sets the transform; env + mapping helpers
 *   worldToScreen / screenToWorld(cam, x, y): Point         the exact camera mapping (no Paint2D)
 *   visibleRect(cam, frame = FRAME): Rect                   world AABB of the (rolled) frame
 *   fgScreen(g, draw) / fgWorld(g, rig, draw)               foreground in screen / world space
 *   silhouette(g, path, fill = FG_INK.silhouette)           flat ink fill of a closed path
 *   constants ZOOM_MIN, ZOOM_MAX, ROT_MAX, FRAME, SCREEN_ENV, FG_INK; types below.
 *
 * Mapping: screen = (W/2, H/2) + R(rot) * z * (world - (x, y)); + rot = clockwise on screen. This
 * is exactly what `brushes.camera` does to the Paint2D transform (applyCamera reuses it).
 *
 * Clock. Cut SELECTION runs on twos by default (films 1 and 2): framing changes land on the same
 * 1/12 s grid as the poses, so a cut never splits a held pose. A cut at `at` therefore appears on
 * the first 1/12 s step >= at (write `at` as a multiple of 1/12 to land exactly). Film 3 selected
 * on raw t: pass clock 'raw' for its shot lists. The MOVE inside a framing always reads raw t
 * (smooth at 24 fps), held at the start before `at` and at `to` after `end`.
 *
 * Signatures vs the brief: `applyCamera`, `fgScreen`, `fgWorld` take no BrushEnv because none is
 * needed (the camera produces the env, the screen env is fixed); `fgWorld` takes the CameraRig so
 * it re-establishes exactly the clamped camera that applyCamera set; `silhouette` is a plain fill
 * (no ink width), so it takes no env either.
 *
 * Converting the three film dialects (docs/concepts/c-cam-style/films/<film>/js/camera.js):
 *  F1 (samurai) `ST.cutCam(ctx, t, [[at, end, [cx, cy, z, tilt], [b]?], ...])`
 *     -> `{ at, x: cx, y: cy, z, rot: tilt, end, to: { x, y, z, rot } }` (ease defaults to the
 *     film's inOut); without `b`, drop `to` (F1 interpolated a -> a). F1 read missing entries as 0
 *     (`a[k] || 0`): missing tilt = rot 0 = our default, but z is required here (0 was a blank
 *     frame). `ST.cutFrame` -> `resolveCut`, `ST.cutCam` -> `applyCamera(g, resolveCut(...))`;
 *     the returned framing index is `ResolvedCut.index`. Clock: twos (default).
 *  F2 (conclave) shot def `cuts: [[at, name], ...]` + per-name `ST.camera(...)` in the shot body
 *     -> `{ at, name, x, y, z, rot }`, the numbers copied from the shot's own per-name framing;
 *     `ST.cut(t, list)` -> `resolveCut` (`.cut.name`, `.cut.at` = the old `{ name, t0 }`). Clock:
 *     twos. `ST.fg` -> `fgScreen(g, (env) => blob(g, env, pts, FG_INK.screen, { lw: 0, seed }))`;
 *     `ST.fgArm` -> its tube + hand drawn inside `fgScreen`.
 *  F3 (apollo) `ST.cutCam(ctx, t, [{ at, x, y, z, rot }, ...])` -> the same objects, resolved with
 *     clock 'raw'; z becomes required (F3 turned a missing z into scale(0), a blank frame). Fields
 *     given as `ST.key` keyframes: a single key segment becomes `to` + `end` (+ `ease`: the key's
 *     ease, inOut by default as in `core.key`); a multi-segment track becomes consecutive cuts with
 *     the same framing at each key time (the "cut" between them is invisible), or stays keyed in the
 *     scene, which then calls `applyCamera(g, { x, y, z: key(t, keys), rot })` itself.
 *     `ST.fgShape` -> `fgWorld(g, rig, (env) => rough(g, env, pts, FG_INK.world, { seed, lw: 0 }))`
 *     (or `silhouette` for an unroughened edge).
 *  F1 `ST.silhouette(ctx, cam, draw)` (scratch canvas + source-atop + drawImage, not deterministic)
 *     -> `silhouette(g, outlinePath)` under the current camera: fill the figure's outline path.
 */
import { H, W, clamp01, ease, lerp, twos } from '../core.js';
import { camera, tracePath, type BrushEnv, type Pts } from './brushes.js';
import { ROT_MAX, ZOOM_MAX, ZOOM_MIN, type Cut, type Framing } from './camera-schema.js';
import type { Paint2D } from './paint.js';

export { ROT_MAX, ZOOM_MAX, ZOOM_MIN };
export type { Cut, CutEase, Framing } from './camera-schema.js';

/** Which clock picks the framing on screen: 1/12 s steps (films 1-2, default) or raw t (film 3). */
export type CameraClock = 'twos' | 'raw';

/** A fully resolved framing: world point at the frame centre, zoom, roll in degrees. */
export interface CameraState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rot: number;
}

export interface ResolvedCut extends CameraState {
  /** The cut on screen (its `name` and `at` are film 2's `{ name, t0 }`). */
  readonly cut: Cut;
  /** Its position in the table (films 1 and 3 returned this from `cutCam`). */
  readonly index: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned rectangle (world units), `x0 <= x1`, `y0 <= y1`. */
export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface FrameSize {
  readonly w: number;
  readonly h: number;
}

export const FRAME: FrameSize = { w: W, h: H };

/** Brush env for screen-space foreground: film 2's `ST.fg` drew with `ST.LW = 1.4`, no zoom. */
export const SCREEN_ENV: BrushEnv = { zoom: 1, lw: 1.4 };

/** Near-black foreground inks of the films (screen fg: film 2, world fg: film 3, silhouette: film 1). */
export const FG_INK = { screen: '#14110e', world: '#14100c', silhouette: '#1c1715' } as const;

export interface CameraRig {
  /** Brush env of the camera (zoom set, ink width `z ^ -0.55`). */
  readonly env: BrushEnv;
  /** The camera actually applied (after clamping). */
  readonly cam: CameraState;
  toScreen(x: number, y: number): Point;
  toWorld(x: number, y: number): Point;
  /** World AABB of the visible frame. */
  visibleRect(): Rect;
}

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const stateOf = (f: Framing): CameraState => ({ x: f.x, y: f.y, z: f.z, rot: f.rot ?? 0 });

/** Runtime safety net: zoom into [ZOOM_MIN, ZOOM_MAX], roll into [-ROT_MAX, ROT_MAX]; missing rot = 0. */
export function clampFraming(framing: Framing): CameraState {
  return {
    x: framing.x,
    y: framing.y,
    z: clamp(framing.z, ZOOM_MIN, ZOOM_MAX),
    rot: clamp(framing.rot ?? 0, -ROT_MAX, ROT_MAX),
  };
}

/**
 * One cut's framing at raw time t. A move needs `to`, `end > at` and an ease other than 'cut'
 * (default 'inOut'); it holds the start framing up to `at` and exactly `to` from `end` on.
 * A missing `rot` (on either end) is 0, as in film 1.
 */
export function cutFramingAt(cut: Cut, t: number): CameraState {
  const from = stateOf(cut);
  const { to, end } = cut;
  const easeName = cut.ease ?? 'inOut';
  if (to === undefined || end === undefined || !(end > cut.at) || easeName === 'cut') return from;
  if (t <= cut.at) return from;
  const target = stateOf(to);
  if (t >= end) return target;
  const u = ease[easeName](clamp01((t - cut.at) / (end - cut.at)));
  return {
    x: lerp(from.x, target.x, u),
    y: lerp(from.y, target.y, u),
    z: lerp(from.z, target.z, u),
    rot: lerp(from.rot, target.rot, u),
  };
}

/**
 * The framing on screen at shot time t: the last cut whose `at` <= the selection time (twos(t) or
 * t) wins; before the first cut the first is held. Cuts are expected in ascending `at` (the schema
 * enforces it). Throws RangeError on an empty table.
 */
export function resolveCut(
  cuts: readonly Cut[],
  t: number,
  clock: CameraClock = 'twos',
): ResolvedCut {
  const first = cuts[0];
  if (first === undefined) throw new RangeError('cut table is empty');
  const selection = clock === 'twos' ? twos(t) : t;
  let index = 0;
  for (let k = 1; k < cuts.length; k += 1) {
    const candidate = cuts[k];
    if (candidate !== undefined && selection >= candidate.at) index = k;
  }
  const cut = cuts[index] ?? first;
  return { cut, index, ...cutFramingAt(cut, t) };
}

/** World point -> screen pixel under `cam` (taken as given, not clamped). */
export function worldToScreen(cam: CameraState, x: number, y: number): Point {
  const r = toRadians(cam.rot);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = (x - cam.x) * cam.z;
  const dy = (y - cam.y) * cam.z;
  return { x: W / 2 + dx * cos - dy * sin, y: H / 2 + dx * sin + dy * cos };
}

/** Screen pixel -> world point under `cam` (inverse of worldToScreen). */
export function screenToWorld(cam: CameraState, x: number, y: number): Point {
  const r = toRadians(cam.rot);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const sx = x - W / 2;
  const sy = y - H / 2;
  return { x: cam.x + (sx * cos + sy * sin) / cam.z, y: cam.y + (-sx * sin + sy * cos) / cam.z };
}

/**
 * World-space bounding box of the visible frame (camera guide §1): half-width
 * `(w/2 |cos r| + h/2 |sin r|) / z`, half-height `(w/2 |sin r| + h/2 |cos r|) / z` around (x, y).
 * It is also the box of the four rolled frame corners, so "rect inside the set" = "frame inside".
 */
export function visibleRect(cam: CameraState, frame: FrameSize = FRAME): Rect {
  const r = toRadians(cam.rot);
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const halfW = ((frame.w / 2) * cos + (frame.h / 2) * sin) / cam.z;
  const halfH = ((frame.w / 2) * sin + (frame.h / 2) * cos) / cam.z;
  return { x0: cam.x - halfW, y0: cam.y - halfH, x1: cam.x + halfW, y1: cam.y + halfH };
}

/**
 * Sets the camera transform (via `brushes.camera`: identity, centre, roll if non-zero, zoom, world
 * offset) after clamping zoom and roll, and returns its env plus the mapping helpers. Must be the
 * first thing a shot draws: it resets the transform.
 */
export function applyCamera(g: Paint2D, framing: Framing): CameraRig {
  const cam = clampFraming(framing);
  const env = camera(g, cam.x, cam.y, cam.z, cam.rot);
  return {
    env,
    cam,
    toScreen: (x, y) => worldToScreen(cam, x, y),
    toWorld: (x, y) => screenToWorld(cam, x, y),
    visibleRect: () => visibleRect(cam),
  };
}

/** Foreground at the lens in SCREEN space (film 2's `ST.fg`): identity transform, `SCREEN_ENV`. */
export function fgScreen(g: Paint2D, draw: (env: BrushEnv) => void): void {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  draw(SCREEN_ENV);
  g.restore();
}

/**
 * Foreground in WORLD space (film 3's `ST.fgShape`): re-establishes the rig's camera (so it is safe
 * after screen-space or figure-space drawing) and hands `draw` the camera env.
 */
export function fgWorld(g: Paint2D, rig: CameraRig, draw: (env: BrushEnv) => void): void {
  g.save();
  draw(camera(g, rig.cam.x, rig.cam.y, rig.cam.z, rig.cam.rot));
  g.restore();
}

/**
 * Flat ink silhouette of a closed outline under the CURRENT transform: path + fill only. Replaces
 * film 1's scratch-canvas compositing (default colour = film 1's `#1c1715`).
 */
export function silhouette(g: Paint2D, path: Pts, fill: string = FG_INK.silhouette): void {
  g.save();
  tracePath(g, path, true);
  g.fillStyle = fill;
  g.fill('nonzero');
  g.restore();
}

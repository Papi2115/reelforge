/**
 * Isometric camera preset of the diorama look (pure math, no Three.js). The shot camera is a
 * perspective camera, so the preset uses a long lens (narrow fov, far away) that is close to an
 * orthographic projection, frames the diorama's bounds, and snaps the target to whole output
 * pixels in the image plane: a panning diorama moves by whole pixels and its edges never shimmer.
 */
import type { Vec3 } from '../../types.js';

/** 2:1 pixel-art dimetric: ground edges step two pixels across per pixel up. */
export const ISO_ELEVATION = 30;
export const ISO_AZIMUTH = 45;
/** Long lens: lines stay almost parallel, the depth outline still sees the silhouette. */
export const ISO_FOV = 12;

export interface IsoBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

export interface IsoCameraInput {
  /** World bounds to frame (the diorama). */
  readonly bounds: IsoBounds;
  /** World point to centre instead of the bounds centre (an anchor). */
  readonly focus?: Vec3 | undefined;
  /** 1 = the whole diorama fits with `margin`; 2 = twice as close. */
  readonly zoom?: number | undefined;
  /** Degrees around +y from +z (45 = the classic iso corner view). */
  readonly azimuth?: number | undefined;
  /** Degrees above the horizon. */
  readonly elevation?: number | undefined;
  /** Vertical field of view in degrees. */
  readonly fov?: number | undefined;
  /** Output size in pixels [width, height] (for framing and pixel snapping). */
  readonly screen?: readonly [number, number] | undefined;
  /** Shift of the framed subject in frame fractions [x right, y up] (rule of thirds). */
  readonly offset?: readonly [number, number] | undefined;
  /** Horizontal pan in output pixels (snapped). */
  readonly pan?: number | undefined;
  /** Free space around the bounds as a share of the frame (default 0.08). */
  readonly margin?: number | undefined;
}

export interface IsoCameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
}

const DEG = Math.PI / 180;

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Camera basis for an azimuth/elevation: direction from target to camera, right and up. */
export function isoBasis(
  azimuth: number,
  elevation: number,
): { back: Vec3; right: Vec3; up: Vec3 } {
  const yaw = azimuth * DEG;
  const pitch = elevation * DEG;
  const back: Vec3 = [
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ];
  const right: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  // up = back x right
  const up: Vec3 = [
    back[1] * right[2] - back[2] * right[1],
    back[2] * right[0] - back[0] * right[2],
    back[0] * right[1] - back[1] * right[0],
  ];
  return { back, right, up };
}

function corners(bounds: IsoBounds): Vec3[] {
  const result: Vec3[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) result.push([x, y, z]);
    }
  }
  return result;
}

function extent(points: readonly Vec3[], axis: Vec3): readonly [number, number] {
  let low = Infinity;
  let high = -Infinity;
  for (const point of points) {
    const value = dot(point, axis);
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  return [low, high];
}

/** World size of one output pixel at distance `distance` for a vertical fov and height. */
export function pixelWorldSize(distance: number, fov: number, height: number): number {
  return (2 * distance * Math.tan((fov * DEG) / 2)) / height;
}

/** Pose of the iso preset: framed, offset, panned and pixel-snapped. */
export function isoCameraPose(input: IsoCameraInput): IsoCameraPose {
  const azimuth = input.azimuth ?? ISO_AZIMUTH;
  const elevation = input.elevation ?? ISO_ELEVATION;
  const fov = input.fov ?? ISO_FOV;
  const [width, height] = input.screen ?? [640, 360];
  const zoom = input.zoom ?? 1;
  const margin = input.margin ?? 0.08;
  const { back, right, up } = isoBasis(azimuth, elevation);
  const points = corners(input.bounds);
  const [rightLow, rightHigh] = extent(points, right);
  const [upLow, upHigh] = extent(points, up);
  const aspect = width / height;
  const frameHeight =
    Math.max(upHigh - upLow, (rightHigh - rightLow) / aspect) / (1 - 2 * margin) / zoom;
  const distance = frameHeight / 2 / Math.tan((fov * DEG) / 2);
  const pixel = pixelWorldSize(distance, fov, height);
  const [offsetX, offsetY] = input.offset ?? [0, 0];
  const centreRight = input.focus ? dot(input.focus, right) : (rightLow + rightHigh) / 2;
  const centreUp = input.focus ? dot(input.focus, up) : (upLow + upHigh) / 2;
  const centreBack = input.focus
    ? dot(input.focus, back)
    : dot(
        [
          (input.bounds.min[0] + input.bounds.max[0]) / 2,
          (input.bounds.min[1] + input.bounds.max[1]) / 2,
          (input.bounds.min[2] + input.bounds.max[2]) / 2,
        ],
        back,
      );
  // Moving the camera right moves the subject left: subtract the wanted subject offset.
  const lookRight = centreRight - offsetX * frameHeight * aspect - (input.pan ?? 0) * pixel;
  const lookUp = centreUp - offsetY * frameHeight;
  const snappedRight = Math.round(lookRight / pixel) * pixel;
  const snappedUp = Math.round(lookUp / pixel) * pixel;
  const target: Vec3 = [
    right[0] * snappedRight + up[0] * snappedUp + back[0] * centreBack,
    right[1] * snappedRight + up[1] * snappedUp + back[1] * centreBack,
    right[2] * snappedRight + up[2] * snappedUp + back[2] * centreBack,
  ];
  const position: Vec3 = [
    target[0] + back[0] * distance,
    target[1] + back[1] * distance,
    target[2] + back[2] * distance,
  ];
  return { position, target, fov };
}

/** Gentle idle pan in pixels: a slow sine sway of `amplitude` pixels (0 at t = 0). */
export function idlePan(t: number, amplitude: number, period = 12): number {
  return amplitude * Math.sin((2 * Math.PI * t) / period);
}

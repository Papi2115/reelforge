/**
 * Continuity links (PLAN.md#13.2, `CONTINUITY_STYLES` in @reelforge/shared): the transitions that
 * carry a shared object across the cut instead of wiping. The focus is the link's anchor (where the
 * object sits on screen in both shots); the scenes make the object match (scene-build rules), these
 * compositors carry it:
 * - `continuity-zoom-through`: A zooms into the anchor (which drifts to the centre), swaps to B in
 *   an ordered dither at the deepest point, and B — which opens on the object, centred — settles
 *   from a magnified view of its centre to 1x: one continuous camera move through the object;
 * - `continuity-shared-object`: B replaces A from the frame edges inward with a dithered front;
 *   the object at the anchor is the last thing to change, so it holds while the world changes;
 * - `continuity-carry-environment`: the object zone around the anchor turns into B first (a
 *   dithered disc growing from the anchor), then the rest of the (continuing) place follows.
 * Pure functions of (A, B, p, focus); every pixel is a copy of A or B, so the output stays in the
 * style palette. The seed is unused: a link reads the same in every film.
 */
import { bayerThreshold, type Compositor } from './pixels.js';
import {
  easeIn,
  endFrames,
  focusPixels,
  lerp,
  phase,
  scaleLerp,
  smoothstep,
  zoomSample,
  type ZoomView,
} from './wow.js';

/** How far A is magnified into the anchor before the swap. */
const ZOOM_IN = 4;
/** B opens magnified this much on its centre and settles to 1x. */
const SETTLE_FROM = 1.6;
const SWAP_FROM = 0.45;
const SWAP_TO = 0.58;

/** Zoom through: one camera move into the object of A and out of the same object in B. */
export const zoomThrough: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, out, p } = c;
  const [fx, fy] = focusPixels(c);
  const inward = phase(p, 0, SWAP_TO);
  const pullA = smoothstep(inward);
  const viewA: ZoomView = {
    fx,
    fy,
    cx: lerp(fx, width / 2, pullA),
    cy: lerp(fy, height / 2, pullA),
    zoom: scaleLerp(1, ZOOM_IN, easeIn(inward)),
  };
  const centreX = width / 2;
  const centreY = height / 2;
  const viewB: ZoomView = {
    fx: centreX,
    fy: centreY,
    cx: centreX,
    cy: centreY,
    zoom: scaleLerp(SETTLE_FROM, 1, smoothstep(phase(p, SWAP_FROM, 1))),
  };
  const swap = phase(p, SWAP_FROM, SWAP_TO);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const fromB = swap >= 1 || (swap > 0 && bayerThreshold(x >> 1, y >> 1) < swap);
      out[row + x] = fromB
        ? zoomSample(b, width, height, x, y, viewB)
        : zoomSample(a, width, height, x, y, viewA);
    }
  }
};

/** Distance from (fx, fy) to the frame corner farthest from it (px, at least 1). */
function farthestCorner(width: number, height: number, fx: number, fy: number): number {
  const dx = Math.max(fx, width - fx);
  const dy = Math.max(fy, height - fy);
  return Math.max(1, Math.sqrt(dx * dx + dy * dy));
}

/** Width of the dithered front (share of the anchor-to-corner distance). */
const FRONT_BAND = 0.18;

/** Shared object: the world changes around the anchor, edges first, the object last. */
export const sharedObject: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, out, p } = c;
  const [fx, fy] = focusPixels(c);
  const reach = farthestCorner(width, height, fx, fy);
  const front = smoothstep(p) * (1 + FRONT_BAND);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const dy = y + 0.5 - fy;
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - fx;
      const closeness = 1 - Math.sqrt(dx * dx + dy * dy) / reach;
      const fromB = closeness + FRONT_BAND * bayerThreshold(x >> 1, y >> 1) < front;
      out[row + x] = fromB ? (b[row + x] ?? 0) : (a[row + x] ?? 0);
    }
  }
};

/** Radius of the object zone around the anchor (share of the frame height). */
const OBJECT_ZONE = 0.25;
/** Weight of the distance (vs the per-pixel dither) in the order the object zone changes. */
const ZONE_DISTANCE_WEIGHT = 0.6;

/** Carry environment: the object at the anchor changes first, the continuing place after it. */
export const carryEnvironment: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, out, p } = c;
  const [fx, fy] = focusPixels(c);
  const radius = Math.max(1, OBJECT_ZONE * height);
  const objectSwap = phase(p, 0.05, 0.55);
  const restSwap = phase(p, 0.45, 1);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const dy = y + 0.5 - fy;
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - fx;
      const order =
        ZONE_DISTANCE_WEIGHT * (Math.sqrt(dx * dx + dy * dy) / radius) +
        (1 - ZONE_DISTANCE_WEIGHT) * bayerThreshold(x, y);
      const fromB = order < objectSwap || bayerThreshold(x >> 1, y >> 1) < restSwap;
      out[row + x] = fromB ? (b[row + x] ?? 0) : (a[row + x] ?? 0);
    }
  }
};

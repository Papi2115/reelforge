/**
 * The scripted first-person walk: keyframes [at, x, y, yaw, pitch, eye, ease-into-this-key]. The
 * distance walked drives uneven seeded strides, the head-bob and a breathing sway when standing,
 * so the camera is a pure function of t (seek-order independent).
 */
import { clamp01, EASES, rng, type EaseId } from '../core/rand.js';

export interface PathKey {
  readonly at: number;
  readonly x: number;
  readonly y: number;
  /** Heading in degrees: 0 = +x (east), 90 = +y (south, down the grid). */
  readonly yaw: number;
  /** Look down (+) or up (-) in world pixels. */
  readonly pitch: number;
  /** Eye height (0 floor, 1 ceiling; 0.5 = standing). */
  readonly eye: number;
  readonly ease: EaseId;
}

export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly yaw: number;
  /** Heading in radians. */
  readonly a: number;
  readonly pitch: number;
  readonly eye: number;
  /** Head-bob offsets of the hand and horizon, world pixels. */
  readonly bobX: number;
  readonly bobY: number;
  /** 0 standing .. 1 walking. */
  readonly walk: number;
  /** Distance walked so far. */
  readonly dist: number;
}

export interface CameraPath {
  at(t: number, shake?: number, bob?: number): Camera;
  /** Footstep distances already walked at t (minimap footprints). */
  stepsUntil(t: number): number[];
  /** Point and direction at a walked distance. */
  pointAt(dist: number): { x: number; y: number; dx: number; dy: number };
}

export function createPath(keys: readonly PathKey[], seed: number): CameraPath {
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  const first = sorted[0];
  if (first === undefined) throw new Error('a camera path needs at least one key');
  const list = sorted.length === 1 ? [first, { ...first, at: first.at + 1 }] : sorted;
  const cum = [0];
  for (let i = 1; i < list.length; i += 1) {
    const a = list[i - 1] ?? first;
    const b = list[i] ?? first;
    cum.push((cum[i - 1] ?? 0) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = cum[cum.length - 1] ?? 0;
  const strides = [0];
  const random = rng(seed);
  while ((strides[strides.length - 1] ?? 0) < total + 2)
    strides.push((strides[strides.length - 1] ?? 0) + 0.56 + random() * 0.16);

  const raw = (t: number) => {
    let i = 1;
    while (i < list.length - 1 && t > (list[i]?.at ?? 0)) i += 1;
    const a = list[i - 1] ?? first;
    const b = list[i] ?? first;
    const u = clamp01(b.at > a.at ? (t - a.at) / (b.at - a.at) : 1);
    const e = EASES[b.ease](u);
    return {
      x: a.x + (b.x - a.x) * e,
      y: a.y + (b.y - a.y) * e,
      yaw: a.yaw + (b.yaw - a.yaw) * e,
      pitch: a.pitch + (b.pitch - a.pitch) * e,
      eye: a.eye + (b.eye - a.eye) * e,
      dist: (cum[i - 1] ?? 0) + ((cum[i] ?? 0) - (cum[i - 1] ?? 0)) * e,
    };
  };

  const strideAt = (dist: number): { k: number; u: number } => {
    let lo = 0;
    let hi = strides.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if ((strides[mid] ?? 0) <= dist) lo = mid;
      else hi = mid;
    }
    const s0 = strides[lo] ?? 0;
    const s1 = strides[lo + 1] ?? s0 + 1;
    return { k: lo, u: (dist - s0) / (s1 - s0) };
  };

  return {
    at(t, shake = 0, bob = 1) {
      const c = raw(t);
      const speed = (raw(t + 0.04).dist - raw(t - 0.04).dist) / 0.08;
      const walk = clamp01((speed - 0.25) / 0.9) * bob;
      const stride = strideAt(c.dist);
      const lift = Math.sin(Math.PI * stride.u);
      const side = stride.k % 2 ? 1 : -1;
      const breathe = Math.sin((t / 3.7) * Math.PI * 2) * (1 - walk);
      const yaw = c.yaw + walk * side * lift * 0.35;
      return {
        x: c.x,
        y: c.y,
        yaw,
        a: (yaw * Math.PI) / 180,
        pitch: c.pitch + shake,
        eye: c.eye + walk * 0.016 * (lift - 0.5) + breathe * 0.003,
        bobX: walk * side * lift * 4,
        bobY: walk * (1 - lift) * 3 + breathe * 1.2,
        walk,
        dist: c.dist,
      };
    },
    stepsUntil(t) {
      const d = raw(t).dist;
      return strides.filter((s, k) => k > 0 && s <= d);
    },
    pointAt(dist) {
      for (let i = 1; i < list.length; i += 1) {
        if (dist > (cum[i] ?? 0) && i < list.length - 1) continue;
        const a = list[i - 1] ?? first;
        const b = list[i] ?? first;
        const length = (cum[i] ?? 0) - (cum[i - 1] ?? 0);
        const u = length > 0 ? clamp01((dist - (cum[i - 1] ?? 0)) / length) : 0;
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dx: b.x - a.x, dy: b.y - a.y };
      }
      return { x: first.x, y: first.y, dx: 1, dy: 0 };
    },
  };
}

/**
 * A placement on the page: screen = local * s + (ox, oy). The page camera, a panel camera and a
 * child placement (`at`) all compose into one Place; a colour plate is the same Place shifted by
 * the panel's misregistration.
 */
import type { Pts } from './canvas.js';

export class Place {
  constructor(
    readonly s: number,
    readonly ox: number,
    readonly oy: number,
  ) {}

  x(x: number): number {
    return this.ox + x * this.s;
  }

  y(y: number): number {
    return this.oy + y * this.s;
  }

  /** Local -> screen point list. */
  map(pts: Pts): number[] {
    const out = new Array<number>(pts.length);
    for (let i = 0; i < pts.length; i += 2) {
      out[i] = this.ox + (pts[i] ?? 0) * this.s;
      out[i + 1] = this.oy + (pts[i + 1] ?? 0) * this.s;
    }
    return out;
  }

  /** Screen -> local. */
  toLocal(sx: number, sy: number): [number, number] {
    return [(sx - this.ox) / this.s, (sy - this.oy) / this.s];
  }

  /** Child placement: local origin at (x, y) of this one, scaled by k. */
  at(x: number, y: number, k = 1): Place {
    return new Place(this.s * k, this.x(x), this.y(y));
  }

  shift(dx: number, dy: number): Place {
    return new Place(this.s, this.ox + dx, this.oy + dy);
  }

  /** The same content scaled by k about local point (cx, cy) (slams and pops). */
  scaleAbout(cx: number, cy: number, k: number): Place {
    return new Place(this.s * k, this.x(cx) - cx * this.s * k, this.y(cy) - cy * this.s * k);
  }

  /** Line width that grows with zoom, never thinner than 1 px. */
  w(base: number): number {
    return Math.max(1, Math.round(base * this.s));
  }
}

/** The page camera: page point (x, y) at the frame centre, zoom z, optional shake. */
export function cameraPlace(
  width: number,
  height: number,
  x: number,
  y: number,
  zoom: number,
  shake: readonly [number, number] = [0, 0],
): Place {
  return new Place(
    zoom,
    Math.round(width / 2 - x * zoom + shake[0]),
    Math.round(height / 2 - y * zoom + shake[1]),
  );
}

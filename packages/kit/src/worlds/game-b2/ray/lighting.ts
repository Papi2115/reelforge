/**
 * Light and fog of the Game B2 raycaster: per-room point lights (a light only lights its own room,
 * like the showcase's regions, so a dark corridor stays dark next to a lit office) and the
 * Doom-style colormap lookup with Bayer-dithered light and fog levels.
 */
import { BAYER } from '../core/rand.js';
import { FOG_LEVELS, LIGHT_LEVELS, LIGHT_MAX } from '../palette.js';
import type { Sprite } from './sprites-props.js';
import type { Texture } from './texture.js';

/** Lights one room can hold this frame (the level's 12 plus door spill). */
export const LIGHTS_PER_ROOM = 16;

export interface SpriteDraw {
  readonly spr: Sprite;
  readonly region: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
}

/** Packed lights of every room: [x, y, z, intensity, 1/r^2] * count. */
export class RoomLights {
  readonly packed: Float32Array[];
  readonly count: Int32Array;

  constructor(rooms: number) {
    this.packed = Array.from({ length: rooms }, () => new Float32Array(5 * LIGHTS_PER_ROOM));
    this.count = new Int32Array(rooms);
  }

  clear(): void {
    this.count.fill(0);
  }

  add(room: number, x: number, y: number, z: number, intensity: number, inv: number): void {
    const n = this.count[room] ?? LIGHTS_PER_ROOM;
    const packed = this.packed[room];
    if (packed === undefined || n >= LIGHTS_PER_ROOM) return;
    packed.set([x, y, z, intensity, inv], n * 5);
    this.count[room] = n + 1;
  }

  /** Light reaching (x, y, z) in `room`. */
  sum(room: number, x: number, y: number, z: number): number {
    const L = this.packed[room];
    if (L === undefined) return 0;
    let total = 0;
    for (let i = 0, o = 0; i < (this.count[room] ?? 0); i += 1, o += 5) {
      const dx = (L[o] ?? 0) - x;
      const dy = (L[o + 1] ?? 0) - y;
      const dz = (L[o + 2] ?? 0) - z;
      const q = 1 + (dx * dx + dy * dy + dz * dz) * (L[o + 4] ?? 0);
      total += (L[o + 3] ?? 0) / (q * q);
    }
    return total;
  }
}

export interface FrameState {
  /** Open share 0..1 per cell (doors). */
  readonly doorOpen: Float32Array;
  readonly lights: RoomLights;
  /** Current glow level per texture id (0 = the tube is off). */
  readonly glow: Float32Array;
  readonly sprites: readonly SpriteDraw[];
  /** Extra fog 0..1 over everything (fog interludes). */
  readonly fogBoost: number;
  /** The level's textures this frame (animated ones on their current frame). */
  readonly textures: readonly Texture[];
  /** Shot time (sky drift, stars, the underwater shimmer). */
  readonly t: number;
}

/** Colormap lookup with Bayer-dithered light and fog levels. */
export function shade(
  cmap: Uint8Array,
  c: number,
  light: number,
  fog: number,
  x: number,
  y: number,
): number {
  let lf = (light * (LIGHT_LEVELS - 1)) / LIGHT_MAX;
  if (lf > LIGHT_LEVELS - 1) lf = LIGHT_LEVELS - 1;
  else if (lf < 0) lf = 0;
  let li = lf | 0;
  if (lf - li > (BAYER[((y & 3) << 2) | (x & 3)] ?? 0)) li += 1;
  if (li > LIGHT_LEVELS - 1) li = LIGHT_LEVELS - 1;
  let gf = fog * (FOG_LEVELS - 1);
  if (gf > FOG_LEVELS - 1) gf = FOG_LEVELS - 1;
  let gi = gf | 0;
  if (gf - gi > (BAYER[(((y + 1) & 3) << 2) | ((x + 2) & 3)] ?? 0)) gi += 1;
  if (gi > FOG_LEVELS - 1) gi = FOG_LEVELS - 1;
  return cmap[(c * LIGHT_LEVELS + li) * FOG_LEVELS + gi] ?? c;
}

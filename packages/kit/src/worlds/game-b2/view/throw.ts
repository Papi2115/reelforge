/**
 * Thrown items of the Game B2 view (the showcase's cartridge toss, generalised): an item leaves
 * the first-person hand at `release`, flies along an arc into the level (tumbling through eight
 * pixel-snapped frames), lands on a cell or on a sprite with a small bounce and a dust puff at
 * 8.5 fps, then rests there or is gone (into a bin, a pit). The hit sprite flinches. Built at
 * build time from the camera pose at the release, so a frame is a pure function of t.
 */
import { Bmp, rotate } from '../core/bitmap.js';
import { EASES, hash3, lerp, seg } from '../core/rand.js';
import { C } from '../palette.js';
import type { SpriteDraw } from '../ray/lighting.js';
import { sprite, thing, type ItemLook, type Sprite } from '../ray/sprites-props.js';

export interface ThrowEvent {
  /** The hand starts its wind-up. */
  readonly windup: number;
  readonly release: number;
  readonly land: number;
  /** The hand has lowered out of view. */
  readonly end: number;
  readonly item: ItemLook;
  readonly from: readonly [number, number, number];
  readonly to: readonly [number, number, number];
  readonly arc: number;
  readonly stay: boolean;
  /** Tumble direction (+1 / -1). */
  readonly spin: number;
  readonly region: (x: number, y: number) => number;
}

export interface Flinch {
  readonly id: string;
  readonly at: number;
  readonly dx: number;
  readonly dy: number;
}

const BASE_W = 0.2;
const BASE_H = 0.23;
const frameCache = new Map<string, readonly Sprite[]>();
let dustFrames: readonly Sprite[] | undefined;

/** Eight tumble frames of an item (45 degree steps, nearest-neighbour). */
function tumble(item: ItemLook): readonly Sprite[] {
  const key = JSON.stringify(item);
  const hit = frameCache.get(key);
  if (hit !== undefined) return hit;
  const base = thing(20, 23, item).outline(C.VOID);
  const frames = Array.from({ length: 8 }, (_, k) => sprite(k === 0 ? base : rotate(base, k * 45)));
  frameCache.set(key, frames);
  return frames;
}

/** Three frames of a dust puff (sand and grey grains spreading and thinning). */
function dust(): readonly Sprite[] {
  if (dustFrames !== undefined) return dustFrames;
  dustFrames = [0, 1, 2].map((k) => {
    const b = new Bmp(40, 16);
    const count = 34 - k * 9;
    for (let i = 0; i < count; i += 1) {
      const a = hash3(i, 1, 41) * Math.PI;
      const r = (4 + k * 6) * (0.4 + hash3(i, 2, 41) * 0.6);
      const x = 20 + Math.cos(a) * r * 1.6 * (hash3(i, 3, 41) < 0.5 ? -1 : 1);
      const y = 14 - Math.sin(a) * r * 0.7;
      b.px(x, y, hash3(i, 4, 41) < 0.55 ? C.SAND : C.GREY);
      if (k === 0) b.px(x + 1, y, C.SAND_L);
    }
    return sprite(b);
  });
  return dustFrames;
}

/** The item's position at t (world cells, z) and whether it is still in the air. */
export function flightAt(
  event: ThrowEvent,
  t: number,
): { x: number; y: number; z: number; u: number } {
  const u = seg(t, event.release, event.land);
  const [x0, y0, z0] = event.from;
  const [x1, y1, z1] = event.to;
  let z = lerp(z0, z1, u) + event.arc * 4 * u * (1 - u);
  if (u >= 1) z += 0.05 * Math.sin(Math.PI * seg(t, event.land, event.land + 0.16));
  return { x: lerp(x0, x1, u), y: lerp(y0, y1, u), z, u };
}

/** The sprites of the thrown items at t (the item and its dust). */
export function throwSprites(events: readonly ThrowEvent[], t: number, out: SpriteDraw[]): void {
  for (const event of events) {
    if (t < event.release) continue;
    const { x, y, z, u } = flightAt(event, t);
    const frames = tumble(event.item);
    const gone = !event.stay && t >= event.land + 0.06;
    if (!gone) {
      const index =
        u < 1 ? (((Math.floor(u * 9) * event.spin) % 8) + 8) % 8 : event.spin > 0 ? 6 : 2;
      const spr = frames[index] ?? frames[0];
      if (spr !== undefined) {
        const w = (BASE_W * spr.bmp.w) / 22;
        const h = (BASE_H * spr.bmp.h) / 25;
        out.push({ spr, region: event.region(x, y), x, y, z, w, h });
      }
    }
    const k = Math.floor((t - event.land) * 8.5);
    const puff = dust()[k];
    if (t >= event.land && puff !== undefined)
      out.push({
        spr: puff,
        region: event.region(event.to[0], event.to[1]),
        x: event.to[0],
        y: event.to[1] + 0.02,
        z: event.to[2] - 0.03,
        w: 0.7,
        h: 0.28,
      });
  }
}

/** Offset of a flinching sprite at t (knocked along the throw, a hop, settling). */
export function flinchOffset(
  flinches: readonly Flinch[],
  id: string | undefined,
  t: number,
): { dx: number; dy: number; dz: number } | undefined {
  if (id === undefined) return undefined;
  let dx = 0;
  let dy = 0;
  let dz = 0;
  let hit = false;
  for (const flinch of flinches) {
    if (flinch.id !== id || t < flinch.at || t > flinch.at + 0.8) continue;
    const dt = t - flinch.at;
    const knock = 0.09 * Math.exp(-dt * 7) * Math.cos(dt * 26);
    dx += flinch.dx * knock;
    dy += flinch.dy * knock;
    dz += 0.05 * EASES.out(1 - seg(dt, 0, 0.3)) * (dt < 0.3 ? 1 : 0);
    hit = true;
  }
  return hit ? { dx, dy, dz } : undefined;
}

/** True while a flinch makes a clerk shake its head (the first 0.35 s). */
export function flinching(flinches: readonly Flinch[], id: string | undefined, t: number): boolean {
  return id !== undefined && flinches.some((f) => f.id === id && t >= f.at && t < f.at + 0.35);
}

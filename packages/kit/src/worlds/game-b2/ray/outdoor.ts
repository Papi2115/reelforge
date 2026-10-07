/**
 * Floors, ground and sky of an OUTDOOR Game B2 level (indoor levels keep the original `flats`
 * pass untouched): inside the grid the floor of each cell (and the roof of a roofed cell), past
 * the grid the level's ground running on to the horizon haze, above it the sky (gradient,
 * skyline, clouds), then stars and the sun or moon where the sky still shows.
 */
import type { CompiledLevel } from '../level/compile.js';
import { NO_FLOOR, NO_ROOF } from '../level/compile.js';
import type { Camera } from './camera.js';
import { shade, type FrameState } from './lighting.js';
import { azIndex, skyDetails, skyPixel, type SkyPlan } from './sky.js';
import type { WorldBuffers } from './raycast.js';

/** Ground beyond this distance is the horizon haze. */
const GROUND_FAR = 90;
const SKY_DEPTH = 1e9;

const colAz = new Float32Array(512);
const colIdx = new Int32Array(512);

export interface Rays {
  readonly rdx: Float32Array;
  readonly rdy: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly focal: number;
  readonly tanHalf: number;
}

function flatPixel(
  level: CompiledLevel,
  state: FrameState,
  tex: number,
  ci: number,
  wx: number,
  wy: number,
  z: number,
  dist: number,
  x: number,
  y: number,
): number {
  const r = ci < 0 ? 0 : (level.region[ci] ?? 0);
  const room = level.regions[r] ?? level.regions[0];
  const texture = state.textures[tex];
  if (room === undefined || texture === undefined) return 0;
  const cx = Math.floor(wx);
  const cy = Math.floor(wy);
  const c = texture.bmp.d[((((wy - cy) * 64) | 0) & 63) * 64 + ((((wx - cx) * 64) | 0) & 63)] ?? 0;
  const glow = texture.emissive[c] === 1 ? (state.glow[tex] ?? 0) : 0;
  const light =
    glow > 0 ? glow : (room.ambient + state.lights.sum(r, wx, wy, z)) * (z > 0 ? 0.55 : 1);
  let fog = 1 - Math.exp(-dist * room.density);
  if (glow > 0) fog *= 0.35;
  if (state.fogBoost > fog) fog = state.fogBoost;
  return z > 0 ? shade(room.cmap, c, light, fog, 1, 0) : shade(room.cmap, c, light, fog, x, y);
}

/** Paints floors, ground, roofs and sky of an outdoor level into `out`. */
export function outdoorFlats(
  level: CompiledLevel,
  plan: SkyPlan,
  cam: Camera,
  state: FrameState,
  out: WorldBuffers,
  horizon: number,
  rays: Rays,
  t: number,
): void {
  const { buf, depth } = out;
  const { w, h } = level;
  const fogIndex = level.regions[0]?.fogIndex ?? 0;
  for (let x = 0; x < rays.width; x += 1) {
    const k = (2 * (x + 0.5)) / rays.width - 1;
    colAz[x] = cam.a + Math.atan(rays.tanHalf * k);
    colIdx[x] = azIndex(colAz[x] ?? 0);
  }
  for (let y = 0; y < rays.height; y += 1) {
    const dyc = y + 0.5 - horizon;
    const isFloor = dyc > 0;
    const el = -dyc / rays.focal;
    const rowDist = isFloor ? (cam.eye * rays.focal) / dyc : ((1 - cam.eye) * rays.focal) / -dyc;
    for (let x = 0; x < rays.width; x += 1) {
      const p = y * rays.width + x;
      if (Math.abs(dyc) < 0.5) {
        const haze = level.ground >= 0;
        buf[p] = haze ? fogIndex : skyPixel(plan, x, y, 0, colAz[x] ?? 0, colIdx[x] ?? 0, t);
        depth[p] = haze ? GROUND_FAR : SKY_DEPTH;
        continue;
      }
      const wx = cam.x + (rays.rdx[x] ?? 0) * rowDist;
      const wy = cam.y + (rays.rdy[x] ?? 0) * rowDist;
      const cx = Math.floor(wx);
      const cy = Math.floor(wy);
      const inside = cx >= 0 && cy >= 0 && cx < w && cy < h;
      const ci = inside ? cy * w + cx : -1;
      if (!isFloor) {
        const roof = inside ? (level.ceil[ci] ?? NO_ROOF) : NO_ROOF;
        if (roof === NO_ROOF || rowDist > GROUND_FAR) {
          buf[p] = skyPixel(plan, x, y, el, colAz[x] ?? 0, colIdx[x] ?? 0, t);
          depth[p] = SKY_DEPTH;
        } else {
          buf[p] = flatPixel(level, state, roof, ci, wx, wy, 1, rowDist, x, y);
          depth[p] = rowDist;
        }
        continue;
      }
      const tex = inside ? (level.floor[ci] ?? 0) : level.ground;
      if (tex < 0 || (inside && tex === NO_FLOOR)) {
        buf[p] = skyPixel(plan, x, y, el, colAz[x] ?? 0, colIdx[x] ?? 0, t);
        depth[p] = SKY_DEPTH;
      } else if (rowDist > GROUND_FAR) {
        buf[p] = fogIndex;
        depth[p] = GROUND_FAR;
      } else {
        buf[p] = flatPixel(level, state, tex, ci, wx, wy, 0, rowDist, x, y);
        depth[p] = rowDist;
      }
    }
  }
  const put = (px: number, py: number, c: number): void => {
    const xi = Math.round(px);
    const yi = Math.round(py);
    if (xi < 0 || yi < 0 || xi >= rays.width || yi >= rays.height) return;
    const p = yi * rays.width + xi;
    if ((depth[p] ?? 0) >= SKY_DEPTH) buf[p] = c;
  };
  const toScreen = (az: number, el: number): readonly [number, number] | null => {
    const d = Math.atan2(Math.sin(az - cam.a), Math.cos(az - cam.a));
    if (Math.abs(d) > 1.2) return null;
    return [rays.width / 2 + rays.focal * Math.tan(d), horizon - el * rays.focal];
  };
  skyDetails(plan, put, toScreen, t);
}

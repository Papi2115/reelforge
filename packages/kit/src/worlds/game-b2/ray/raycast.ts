/**
 * The Game B2 software raycaster (port of the approved showcase, docs/worlds/game-hud-b2-rpg-v2):
 * a textured-column raycaster on a 320x180 index buffer. Floors and ceilings are cast per pixel,
 * low walls drawn back to front with their caps, doors slide in the middle of their cell,
 * billboards are depth-tested per pixel; every surface is lit and fogged by its own room's mood
 * (a wall by the room it faces). Pure: same level, camera and frame state -> same pixels.
 */
import { wallTextureAt, type CompiledLevel } from '../level/compile.js';
import type { Camera } from './camera.js';
import { shade, type FrameState } from './lighting.js';

export const VIEW_W = 320;
export const VIEW_H = 180;
const TANH = Math.tan((66 * Math.PI) / 360);
/** Focal length in world pixels (66 degree horizontal field of view). */
export const FOCAL = VIEW_W / 2 / TANH;
const MAX_DIST = 44;
const FAR = 1e9;

export interface WorldBuffers {
  readonly buf: Uint8Array;
  readonly depth: Float32Array;
}

export function createWorldBuffers(): WorldBuffers {
  return { buf: new Uint8Array(VIEW_W * VIEW_H), depth: new Float32Array(VIEW_W * VIEW_H) };
}

const rdx = new Float32Array(VIEW_W);
const rdy = new Float32Array(VIEW_W);
/** Fog of the current floor/ceiling row, per room. */
const rowFog = new Float32Array(256);

export function horizonOf(cam: Camera): number {
  return VIEW_H / 2 - cam.pitch + cam.bobY * 0.5;
}

/** Room of a cell (0 outside the grid). */
export function roomAt(level: CompiledLevel, x: number, y: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  return cx >= 0 && cy >= 0 && cx < level.w && cy < level.h
    ? (level.region[cy * level.w + cx] ?? 0)
    : 0;
}

function flats(
  level: CompiledLevel,
  cam: Camera,
  state: FrameState,
  out: WorldBuffers,
  horizon: number,
): void {
  const { buf, depth } = out;
  const { w, h, textures, regions } = level;
  for (let y = 0; y < VIEW_H; y += 1) {
    const dyc = y + 0.5 - horizon;
    const isFloor = dyc > 0;
    const rowDist = isFloor ? (cam.eye * FOCAL) / dyc : ((1 - cam.eye) * FOCAL) / -dyc;
    const zPlane = isFloor ? 0 : 1;
    for (let r = 0; r < regions.length; r += 1)
      rowFog[r] = 1 - Math.exp(-rowDist * (regions[r]?.density ?? 0));
    for (let x = 0; x < VIEW_W; x += 1) {
      const p = y * VIEW_W + x;
      const wx = cam.x + (rdx[x] ?? 0) * rowDist;
      const wy = cam.y + (rdy[x] ?? 0) * rowDist;
      const cx = Math.floor(wx);
      const cy = Math.floor(wy);
      const inside = cx >= 0 && cy >= 0 && cx < w && cy < h;
      const ci = cy * w + cx;
      const room = regions[inside ? (level.region[ci] ?? 0) : 0];
      if (room === undefined) continue;
      if (!inside || rowDist > MAX_DIST || Math.abs(dyc) < 0.5) {
        buf[p] = room.fogIndex;
        depth[p] = MAX_DIST;
        continue;
      }
      const id = isFloor ? (level.floor[ci] ?? 0) : (level.ceil[ci] ?? 0);
      const tex = textures[id];
      if (tex === undefined) continue;
      const c = tex.bmp.d[((((wy - cy) * 64) | 0) & 63) * 64 + ((((wx - cx) * 64) | 0) & 63)] ?? 0;
      const glow = tex.emissive[c] === 1 ? (state.glow[id] ?? 0) : 0;
      const r = level.region[ci] ?? 0;
      const light =
        glow > 0
          ? glow
          : (room.ambient + state.lights.sum(r, wx, wy, zPlane)) * (isFloor ? 1 : 0.55);
      let fog = rowFog[r] ?? 0;
      if (glow > 0) fog *= 0.35;
      if (state.fogBoost > fog) fog = state.fogBoost;
      buf[p] = isFloor
        ? shade(room.cmap, c, light, fog, x, y)
        : shade(room.cmap, c, light, fog, 1, 0);
      depth[p] = rowDist;
    }
  }
}

interface Hit {
  d: number;
  u: number;
  tex: number;
  h: number;
  side: number;
  cap: number;
  exit: number;
  room: number;
}

const HITS: Hit[] = Array.from({ length: 64 }, () => ({
  d: 0,
  u: 0,
  tex: 0,
  h: 1,
  side: 0,
  cap: -1,
  exit: 0,
  room: 0,
}));

/** Walks one ray through the grid; fills HITS (near first) and returns how many. */
function castColumn(
  level: CompiledLevel,
  cam: Camera,
  state: FrameState,
  rx: number,
  ry: number,
): number {
  const { w, h, wall, wallTypes } = level;
  let mapX = Math.floor(cam.x);
  let mapY = Math.floor(cam.y);
  const ddx = rx === 0 ? 1e30 : Math.abs(1 / rx);
  const ddy = ry === 0 ? 1e30 : Math.abs(1 / ry);
  const stepX = rx < 0 ? -1 : 1;
  const stepY = ry < 0 ? -1 : 1;
  let sideX = rx < 0 ? (cam.x - mapX) * ddx : (mapX + 1 - cam.x) * ddx;
  let sideY = ry < 0 ? (cam.y - mapY) * ddy : (mapY + 1 - cam.y) * ddy;
  let room = roomAt(level, cam.x, cam.y);
  let count = 0;
  const push = (hit: Hit): void => {
    const slot = HITS[count];
    if (slot === undefined) return;
    Object.assign(slot, hit);
    count += 1;
  };
  for (let it = 0; it < 120 && count < HITS.length; it += 1) {
    let side: number;
    if (sideX < sideY) {
      sideX += ddx;
      mapX += stepX;
      side = 0;
    } else {
      sideY += ddy;
      mapY += stepY;
      side = 1;
    }
    const dist = side === 0 ? sideX - ddx : sideY - ddy;
    if (dist > MAX_DIST || mapX < 0 || mapY < 0 || mapX >= w || mapY >= h) break;
    const ci = mapY * w + mapX;
    const type = wallTypes[wall[ci] ?? 0];
    if (type === undefined || type.tex.length === 0) {
      room = level.region[ci] ?? room;
      continue;
    }
    const exit = Math.min(sideX, sideY);
    if (type.door) {
      const alongX = level.doorAxis[ci] === 1;
      const r = alongX ? rx : ry;
      if (r === 0) continue;
      const plane = ((alongX ? mapX : mapY) + 0.5 - (alongX ? cam.x : cam.y)) / r;
      if (plane < dist || plane > exit) continue;
      const f = alongX ? cam.y + ry * plane - mapY : cam.x + rx * plane - mapX;
      const open = state.doorOpen[ci] ?? 0;
      if (f < open) continue;
      const u = r > 0 ? f - open : 1 - (f - open);
      push({
        d: plane,
        u,
        tex: type.tex[0] ?? 0,
        h: 1,
        side: alongX ? 0 : 1,
        cap: -1,
        exit: plane,
        room,
      });
      break;
    }
    const wallX = side === 0 ? cam.y + dist * ry : cam.x + dist * rx;
    let u = wallX - Math.floor(wallX);
    if ((side === 0 && rx < 0) || (side === 1 && ry > 0)) u = 1 - u;
    push({
      d: dist,
      u,
      tex: wallTextureAt(type, mapX, mapY),
      h: type.h,
      side,
      cap: type.cap,
      exit,
      room,
    });
    if (type.h >= 1) break;
  }
  return count;
}

function drawHit(
  level: CompiledLevel,
  cam: Camera,
  state: FrameState,
  out: WorldBuffers,
  hit: Hit,
  x: number,
  horizon: number,
): void {
  const tex = level.textures[hit.tex];
  const room = level.regions[hit.room];
  if (tex === undefined || room === undefined) return;
  const { buf, depth } = out;
  const rx = rdx[x] ?? 0;
  const ry = rdy[x] ?? 0;
  const eye = cam.eye;
  const d = Math.max(0.03, hit.d);
  const scale = FOCAL / d;
  const y0 = Math.max(0, Math.ceil(horizon - (hit.h - eye) * scale - 0.5));
  const y1 = Math.min(VIEW_H - 1, Math.floor(horizon + eye * scale - 0.5));
  const tx = Math.min(63, Math.max(0, Math.floor(hit.u * 64)));
  const wx = cam.x + rx * d;
  const wy = cam.y + ry * d;
  const fog = Math.max(state.fogBoost, 1 - Math.exp(-d * room.density));
  const sideMul = hit.side === 1 ? 0.8 : 1;
  const glowNow = state.glow[hit.tex] ?? 0;
  for (let y = y0; y <= y1; y += 1) {
    const z = eye + (horizon - y - 0.5) / scale;
    const ty = Math.min(63, Math.max(0, Math.floor(((hit.h - z) / hit.h) * 64)));
    const c = tex.bmp.d[ty * 64 + tx] ?? 255;
    if (c === 255) continue;
    const glows = tex.emissive[c] === 1 && glowNow > 0;
    const light = glows
      ? glowNow
      : (room.ambient + state.lights.sum(hit.room, wx, wy, z)) * sideMul;
    const p = y * VIEW_W + x;
    buf[p] = shade(room.cmap, c, light, glows ? fog * 0.35 : fog, x, y);
    depth[p] = d;
  }
  if (hit.cap < 0 || eye <= hit.h) return;
  const yFar = horizon - (hit.h - eye) * (FOCAL / hit.exit);
  for (let y = Math.max(0, Math.ceil(yFar - 0.5)); y < y0; y += 1) {
    const rd = ((eye - hit.h) * FOCAL) / (y + 0.5 - horizon);
    const light =
      room.ambient + state.lights.sum(hit.room, cam.x + rx * rd, cam.y + ry * rd, hit.h);
    const p = y * VIEW_W + x;
    buf[p] = shade(
      room.cmap,
      hit.cap,
      light,
      Math.max(state.fogBoost, 1 - Math.exp(-rd * room.density)),
      x,
      y,
    );
    depth[p] = rd;
  }
}

function walls(
  level: CompiledLevel,
  cam: Camera,
  state: FrameState,
  out: WorldBuffers,
  horizon: number,
): void {
  for (let x = 0; x < VIEW_W; x += 1) {
    const count = castColumn(level, cam, state, rdx[x] ?? 0, rdy[x] ?? 0);
    for (let k = count - 1; k >= 0; k -= 1) {
      const hit = HITS[k];
      if (hit !== undefined) drawHit(level, cam, state, out, hit, x, horizon);
    }
  }
}

function billboards(
  level: CompiledLevel,
  cam: Camera,
  state: FrameState,
  out: WorldBuffers,
  horizon: number,
): void {
  const { buf, depth } = out;
  const dirX = Math.cos(cam.a);
  const dirY = Math.sin(cam.a);
  const list = state.sprites
    .map((s) => {
      const dx = s.x - cam.x;
      const dy = s.y - cam.y;
      return { s, dep: dx * dirX + dy * dirY, lat: dx * -dirY + dy * dirX };
    })
    .filter((entry) => entry.dep >= 0.12)
    .sort((a, b) => b.dep - a.dep);
  for (const { s, dep, lat } of list) {
    const room = level.regions[s.region];
    if (room === undefined) continue;
    const bmp = s.spr.bmp;
    const sw = (s.w * FOCAL) / dep;
    const sh = (s.h * FOCAL) / dep;
    const x0 = VIEW_W / 2 + (FOCAL * lat) / dep - sw / 2;
    const yTop = horizon - (s.z + s.h - cam.eye) * (FOCAL / dep);
    const light = room.ambient + state.lights.sum(s.region, s.x, s.y, s.z + s.h * 0.6);
    const fog = Math.max(state.fogBoost, 1 - Math.exp(-dep * room.density));
    const xs0 = Math.max(0, Math.ceil(x0 - 0.5));
    const xs1 = Math.min(VIEW_W - 1, Math.floor(x0 + sw - 0.5));
    const ys0 = Math.max(0, Math.ceil(yTop - 0.5));
    const ys1 = Math.min(VIEW_H - 1, Math.floor(yTop + sh - 0.5));
    for (let xs = xs0; xs <= xs1; xs += 1) {
      const tx = Math.min(bmp.w - 1, Math.floor(((xs + 0.5 - x0) / sw) * bmp.w));
      for (let ys = ys0; ys <= ys1; ys += 1) {
        const p = ys * VIEW_W + xs;
        if (dep >= (depth[p] ?? 0)) continue;
        const ty = Math.min(bmp.h - 1, Math.floor(((ys + 0.5 - yTop) / sh) * bmp.h));
        const c = bmp.d[ty * bmp.w + tx] ?? 255;
        if (c === 255) continue;
        buf[p] =
          s.spr.emissive[c] === 1
            ? shade(room.cmap, c, 1.25, fog * 0.3, xs, ys)
            : shade(room.cmap, c, light, fog, xs, ys);
        depth[p] = dep;
      }
    }
  }
}

/** Renders the level for camera `cam` into `out` (320x180 indices + depth); returns the horizon. */
export function renderWorld(
  level: CompiledLevel,
  cam: Camera,
  state: FrameState,
  out: WorldBuffers,
): number {
  const horizon = horizonOf(cam);
  const dirX = Math.cos(cam.a);
  const dirY = Math.sin(cam.a);
  for (let x = 0; x < VIEW_W; x += 1) {
    const k = (2 * (x + 0.5)) / VIEW_W - 1;
    rdx[x] = dirX - dirY * TANH * k;
    rdy[x] = dirY + dirX * TANH * k;
  }
  out.depth.fill(FAR);
  flats(level, cam, state, out, horizon);
  walls(level, cam, state, out, horizon);
  billboards(level, cam, state, out, horizon);
  return horizon;
}

/** Projects a world point to world-buffer pixels (the hand reaching for a sprite). */
export function project(
  cam: Camera,
  wx: number,
  wy: number,
  wz: number,
): { x: number; y: number; dep: number } {
  const dirX = Math.cos(cam.a);
  const dirY = Math.sin(cam.a);
  const dx = wx - cam.x;
  const dy = wy - cam.y;
  const dep = Math.max(0.05, dx * dirX + dy * dirY);
  const lat = dx * -dirY + dy * dirX;
  return {
    x: VIEW_W / 2 + (FOCAL * lat) / dep,
    y: horizonOf(cam) - (wz - cam.eye) * (FOCAL / dep),
    dep,
  };
}

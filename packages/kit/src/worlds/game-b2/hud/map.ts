/**
 * The minimap of the Game B2 HUD: the real level around the player (walls that face a room,
 * low walls, doors as tan ticks), the footprints of the walk so far (the newest in sand, older
 * ones fading to slate) and the player's arrow. The map is the story's continuity in miniature.
 */
import type { Bmp } from '../core/bitmap.js';
import { drawText } from '../core/font.js';
import { C } from '../palette.js';
import type { Camera, CameraPath } from '../ray/camera.js';
import type { CompiledLevel } from '../level/compile.js';
import { roomAt } from '../ray/raycast.js';
import { plate } from './plate.js';

const CELL = 3;

export function drawMinimap(
  b: Bmp,
  level: CompiledLevel,
  path: CameraPath,
  cam: Camera,
  t: number,
  alpha: number,
): void {
  if (alpha <= 0) return;
  const px = 538;
  const py = 12 - Math.round((1 - alpha) * 80);
  const pw = 86;
  const ph = 66;
  plate(b, px, py, pw, ph);
  const ix = px + 4;
  const iy = py + 4;
  const iw = pw - 8;
  const ih = ph - 8;
  b.rect(ix, iy, iw, ih, C.VOID);
  const ox = ix + iw / 2 - cam.x * CELL;
  const oy = iy + ih / 2 - cam.y * CELL;
  const plot = (x: number, y: number, w: number, h: number, c: number): void => {
    const x0 = Math.max(ix, Math.round(x));
    const y0 = Math.max(iy, Math.round(y));
    const x1 = Math.min(ix + iw, Math.round(x + w));
    const y1 = Math.min(iy + ih, Math.round(y + h));
    if (x1 > x0 && y1 > y0) b.rect(x0, y0, x1 - x0, y1 - y0, c);
  };
  const steps = path.stepsUntil(t);
  // Only the rooms walked so far are on the map (the story so far), plus the one you stand in.
  const visited = new Set([roomAt(level, cam.x, cam.y)]);
  for (const step of steps) {
    const p = path.pointAt(step);
    visited.add(roomAt(level, p.x, p.y));
  }
  const open = (cx: number, cy: number): boolean => {
    if (cx < 0 || cy < 0 || cx >= level.w || cy >= level.h) return false;
    const i = cy * level.w + cx;
    return level.wall[i] === 0 && visited.has(level.region[i] ?? 0);
  };
  const nearOpen = (cx: number, cy: number): boolean =>
    open(cx + 1, cy) || open(cx - 1, cy) || open(cx, cy + 1) || open(cx, cy - 1);
  for (let cy = 0; cy < level.h; cy += 1)
    for (let cx = 0; cx < level.w; cx += 1) {
      const sx = ox + cx * CELL;
      const sy = oy + cy * CELL;
      if (sx + CELL < ix || sy + CELL < iy || sx > ix + iw || sy > iy + ih) continue;
      const i = cy * level.w + cx;
      const type = level.wallTypes[level.wall[i] ?? 0];
      if (type === undefined || type.tex.length === 0) {
        if (open(cx, cy)) plot(sx, sy, CELL, CELL, C.SHADOW);
      } else if (!nearOpen(cx, cy)) continue;
      else if (type.door) {
        plot(sx, sy, CELL, CELL, C.SHADOW);
        if (level.doorAxis[i] === 1) plot(sx + 1, sy, 1, CELL, C.TAN);
        else plot(sx, sy + 1, CELL, 1, C.TAN);
      } else plot(sx, sy, CELL, CELL, type.h < 1 ? C.CHAR : C.SLATE);
    }
  for (let k = Math.max(0, steps.length - 70); k < steps.length; k += 1) {
    const p = path.pointAt(steps[k] ?? 0);
    const length = Math.hypot(p.dx, p.dy) || 1;
    const side = k % 2 ? 0.16 : -0.16;
    const fx = ox + (p.x - (p.dy / length) * side) * CELL;
    const fy = oy + (p.y + (p.dx / length) * side) * CELL;
    if (fx >= ix && fy >= iy && fx < ix + iw && fy < iy + ih)
      b.px(fx, fy, steps.length - k < 18 ? C.SAND : C.SLATE);
  }
  const cx = ix + iw / 2;
  const cy = iy + ih / 2;
  const a = cam.a;
  b.poly(
    [
      cx + Math.cos(a) * 4,
      cy + Math.sin(a) * 4,
      cx + Math.cos(a + 2.4) * 3.2,
      cy + Math.sin(a + 2.4) * 3.2,
      cx + Math.cos(a - 2.4) * 3.2,
      cy + Math.sin(a - 2.4) * 3.2,
    ],
    C.BULB,
  );
  drawText(b, 'N', ix + iw - 7, iy + 2, C.SLATE);
}

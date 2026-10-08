/**
 * The paper of the instruction manual (drawn once on the printed spread): yellowed edges and a
 * yellowed turning corner, the crease with its fold shadow and lit lip, two saddle staples, two
 * coffee rings (the mug set down twice, a drip off the newer one) and a faint thumbprint at the
 * corner pages get turned from.
 */
import { dith, type IndexCanvas } from '../core/canvas.js';
import { hash } from '../core/math.js';
import { AGE, C, RIM, STAIN, type Lut } from '../palette.js';

const W = 640;
const H = 360;
export const CREASE = 290;

function ring(
  cv: IndexCanvas,
  at: readonly [number, number, number, number],
  seed: number,
  arc: readonly [number, number],
  drip: number,
) {
  const [cx, cy, rx, ry] = at;
  const [a0, span] = arc;
  const noise = (ang: number) =>
    Math.sin(ang * 3 + hash(seed, 1, 1) * 6) * 0.5 +
    Math.sin(ang * 7 + hash(seed, 2, 1) * 6) * 0.3 +
    Math.sin(ang * 13 + hash(seed, 3, 1) * 6) * 0.2;
  const apply = (x: number, y: number, table: Lut) => {
    cv.d[y * W + x] = table[cv.d[y * W + x] ?? 0] ?? 0;
  };
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y += 1)
    for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x += 1) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d = Math.hypot(nx, ny);
      if (d > 1) continue;
      const ang = Math.atan2(ny, nx);
      const rel = (((ang - a0) % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2);
      if (rel > span) continue;
      const fade = Math.min(1, rel / 0.5, (span - rel) / 0.5);
      const n = noise(ang);
      const th = ((1.6 + 1.6 * n) * fade + 0.6) / rx;
      if (d > 1 - 1.1 / rx) {
        if (dith(x, y, (0.5 + 0.3 * n) * fade)) apply(x, y, RIM);
      } else if (d > 1 - th && dith(x, y, 0.75 * fade + 0.1)) apply(x, y, STAIN);
    }
  if (drip !== 0) {
    const dx = cx + Math.cos(drip) * (rx + 4);
    const dy = cy + Math.sin(drip) * (ry + 3);
    cv.ellipse(dx, dy, 2.5, 2, C.TAN);
    cv.px(dx + 1, dy + 1, C.TEAK);
  }
}

export function paper(cv: IndexCanvas, seed: number): void {
  for (const [e, level] of [
    [0, 0.5],
    [1, 0.32],
    [2, 0.18],
    [3, 0.1],
    [5, 0.05],
  ] as const) {
    cv.remap(0, e, W, 1, AGE, level);
    cv.remap(0, H - 1 - e, W, 1, AGE, level);
    cv.remap(e, 0, 1, H, AGE, level);
    cv.remap(W - 1 - e, 0, 1, H, AGE, level);
  }
  for (let y = 290; y < H; y += 1)
    for (let x = 560; x < W; x += 1) {
      const d = Math.hypot(W - x, H - y) / 80;
      if (d < 1) cv.remap(x, y, 1, 1, AGE, 0.3 * (1 - d) * (1 - d));
    }
  [0.06, 0.1, 0.16, 0.24, 0.34, 0.5, 0.72].forEach((level, k) => {
    cv.remap(CREASE - 7 + k, 0, 1, H, AGE, level);
  });
  for (let y = 0; y < H; y += 1) {
    const o = y * W + CREASE;
    if (hash(seed, y >> 2, 9) > 0.12) cv.d[o] = cv.d[o] === C.WALNUT_D ? C.WALNUT_D : C.TEAK;
    if (cv.d[o + 1] === C.CREAM && hash(seed, y >> 3, 10) > 0.3) cv.d[o + 1] = C.WHITE;
  }
  cv.remap(CREASE + 2, 0, 2, H, AGE, 0.12);
  [62, 296].forEach((sy, k) => {
    cv.rect(CREASE - 1, sy, 3, 17 + k, C.GREY);
    cv.rect(CREASE - 1, sy, 1, 17 + k, C.WHITE);
    cv.rect(CREASE + 2, sy + 1, 1, 17 + k, C.GREY_D);
    cv.rect(CREASE - 1, sy - 1, 3, 1, C.GREY_D);
    cv.rect(CREASE - 1, sy + 17 + k, 3, 1, C.GREY_D);
  });
  ring(cv, [102, 298, 33, 30], seed + 5, [-2.2, Math.PI * 2 - 0.45], 0.7);
  ring(cv, [129, 309, 33, 30], seed + 6, [3.6, 2.4], 0);
  for (let r = 4; r < 17; r += 2.6)
    for (let a = 0; a < 80; a += 1) {
      if (hash(seed, Math.round(r * 10), a >> 2) < 0.3) continue;
      const ang = (a / 80) * Math.PI * 2;
      const x = Math.round(604 + Math.cos(ang) * r * 0.78);
      const y = Math.round(322 + Math.sin(ang) * r - Math.cos(ang) * r * 0.25);
      if (x >= 0 && y >= 0 && x < W && y < H && dith(x, y, 0.6)) cv.remap(x, y, 1, 1, AGE);
    }
}

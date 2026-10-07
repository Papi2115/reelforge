/* detective-board 2a - light: desk-lamp pool, swinging bulb, street-light stripes through the blinds,
 * desk spill. Light is a continuous value per pixel, quantised into flat bands; a 50 % checker appears only
 * in the middle fifth of each band edge (dither only where light falls off). */
(function () {
  'use strict';
  const D2 = window.D2;
  const { W, H, COOL, ramp, clamp, smooth, noise1 } = D2;

  /** Banded quantisation: flat steps, a 50 % checker only in the middle fifth of each transition. */
  function quant(n, x, y) {
    const base = Math.floor(n);
    const f = n - base;
    if (f > 0.6) return base + 1;
    if (f > 0.4 && ((x + y) & 1) === 1) return base + 1;
    return base;
  }

  // ---------- light ----------
  function poolF(L, wx, wy) {
    const p = L.pool;
    if (p.i <= 0) return 0;
    const dx = wx - p.x;
    const dy = (wy - p.y) * 1.12;
    const d = Math.hypot(dx, dy);
    const de = d * (1 + 0.16 * noise1(Math.atan2(dy, dx) * 2.4 + 9, 17));
    return (1 - smooth(p.r * 0.66, p.r, de)) * p.i;
  }
  function bulbF(L, wx, wy) {
    const b = L.bulb;
    const d = Math.hypot(wx - b.x, (wy - b.y - 40) * 0.95);
    return (1 - smooth(b.r * 0.5, b.r, d)) * b.i;
  }
  function wallN(L, wx, wy) {
    return 3.2 + L.dark - 3.3 * poolF(L, wx, wy) - 3.3 * bulbF(L, wx, wy);
  }
  /** Street light through the blinds of the side window: slanted slats on the left of the wall. */
  function inStripe(wx, wy) {
    if (wx < -20 || wx > 380 || wy < 0 || wy > 900) return false;
    const q = (wy - 0.42 * wx - 60) / 56;
    if (q < 0 || q > 7) return false;
    return q - Math.floor(q) < 0.4 - 0.1 * (wx / 380);
  }
  function deskN(L, u, v) {
    const d = L.desk;
    const dist = Math.hypot(u - d.u, (v - d.v) * 1.6);
    return 2.9 - 2.75 * d.i * (1 - smooth(130, d.r, dist));
  }

  // ---------- lighting of the wall (grid of light values, bilinear, banded) ----------
  const GS = 4;
  const GW = W / GS + 1;
  const GH = H / GS + 1;
  function lightWall(sb, view, L, nOut) {
    const grid = new Float32Array(GW * GH);
    for (let gy = 0; gy < GH; gy += 1)
      for (let gx = 0; gx < GW; gx += 1) grid[gy * GW + gx] = wallN(L, view.vx0 + (gx * GS) / view.z, view.vy0 + (gy * GS) / view.z);
    for (let y = 0; y < H; y += 1) {
      const gy = Math.min(GH - 2, Math.floor(y / GS));
      const fy = y / GS - gy;
      const wy = view.vy0 + (y + 0.5) / view.z;
      for (let x = 0; x < W; x += 1) {
        const gx = Math.min(GW - 2, Math.floor(x / GS));
        const fx = x / GS - gx;
        const a = grid[gy * GW + gx] * (1 - fx) + grid[gy * GW + gx + 1] * fx;
        const c2 = grid[(gy + 1) * GW + gx] * (1 - fx) + grid[(gy + 1) * GW + gx + 1] * fx;
        const n = a * (1 - fy) + c2 * fy;
        nOut[y * W + x] = n;
        let k = clamp(quant(n, x, y), -1, 4);
        const i = y * W + x;
        let c = sb.d[i];
        const wx = view.vx0 + (x + 0.5) / view.z;
        c = k >= 2 && inStripe(wx, wy) ? COOL[c] : ramp(c, k);
        sb.d[i] = c;
      }
    }
  }

  Object.assign(D2, { light: { quant, poolF, bulbF, wallN, inStripe, deskN, lightWall } });
})();

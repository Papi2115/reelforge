/* Rasteriser: near-clipped projection, even-odd scanline fill into palette indices, shaders (flat, lit ramp via the
 * plane light cache, darken LUT, clip-mask writes, per-pixel fn), and strokes re-stamped in screen space. */
'use strict';
(function () {
  const NB = window.NB;
  const { W, H, fb, cam, DARK, LUMA, clamp } = NB;
  const planeClass = NB.planeClass;
  const NEAR = 0.03;
  const markBuf = new Int32Array(W * H);
  let markId = 1;
  let clipMask = null;

  // ---------- scratch buffers ----------
  const MAXV = 256;
  const CX = new Float64Array(MAXV);
  const CY = new Float64Array(MAXV);
  const CZ = new Float64Array(MAXV);
  const KX = new Float64Array(MAXV);
  const KY = new Float64Array(MAXV);
  const KZ = new Float64Array(MAXV);
  const SX = new Float64Array(MAXV);
  const SY = new Float64Array(MAXV);
  const XS = new Float64Array(64);

  // ---------- spans + polygons ----------
  /** Shader kinds: number = palette index; {mat, plane} = lit ramp; {dark:1} = darken under; {glow:idx} = checker on dark px. */
  function span(y, xa, xb, sh) {
    const row = y * W;
    if (typeof sh === 'number') {
      if (!clipMask) fb.fill(sh, row + xa, row + xb + 1);
      else for (let i = row + xa; i <= row + xb; i++) if (clipMask[i]) fb[i] = sh;
      return;
    }
    if (sh.mat) {
      const mat = sh.mat;
      for (let x = xa; x <= xb; x++) {
        const i = row + x;
        if (clipMask && !clipMask[i]) continue;
        fb[i] = mat[planeClass(sh.plane, x, y)];
      }
      return;
    }
    if (sh.dark) {
      for (let i = row + xa; i <= row + xb; i++) {
        if ((clipMask && !clipMask[i]) || markBuf[i] === markId) continue;
        markBuf[i] = markId;
        fb[i] = DARK[fb[i]];
      }
      return;
    }
    if (sh.flat) {
      // flat lit: pick the class at the face centre (passed in), ramp lookup once
      const v = sh.flat;
      if (!clipMask) fb.fill(v, row + xa, row + xb + 1);
      else for (let i = row + xa; i <= row + xb; i++) if (clipMask[i]) fb[i] = v;
      return;
    }
    if (sh.mask) {
      for (let i = row + xa; i <= row + xb; i++) clipMask[i] = sh.mask === 1 ? 1 : 0;
      return;
    }
    if (sh.fn) for (let x = xa; x <= xb; x++) {
      const v = sh.fn(x, y);
      if (v >= 0) fb[row + x] = v;
    }
  }
  function fillPoly(n, sh) {
    if (n < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      if (SY[i] < minY) minY = SY[i];
      if (SY[i] > maxY) maxY = SY[i];
    }
    const y0 = Math.max(0, Math.ceil(minY - 0.5));
    const y1 = Math.min(H - 1, Math.floor(maxY - 0.5));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      let k = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ya = SY[j];
        const yb = SY[i];
        if ((ya <= yc && yb > yc) || (yb <= yc && ya > yc)) XS[k++] = SX[j] + ((yc - ya) * (SX[i] - SX[j])) / (yb - ya);
      }
      for (let a = 1; a < k; a++) {
        const v = XS[a];
        let b = a - 1;
        while (b >= 0 && XS[b] > v) {
          XS[b + 1] = XS[b];
          b--;
        }
        XS[b + 1] = v;
      }
      for (let m = 0; m + 1 < k; m += 2) {
        const xa = Math.max(0, Math.ceil(XS[m] - 0.5));
        const xb = Math.min(W - 1, Math.ceil(XS[m + 1] - 0.5) - 1);
        if (xa <= xb) span(y, xa, xb, sh);
      }
    }
  }
  /** Fill a polygon given directly in screen space (flat array). */
  function poly2(pts, sh) {
    const n = pts.length >> 1;
    for (let i = 0; i < n; i++) {
      SX[i] = pts[2 * i];
      SY[i] = pts[2 * i + 1];
    }
    if (sh && sh.dark) markId++;
    fillPoly(n, sh);
  }
  function toCam(x, y, z, i) {
    const dx = x - cam.px;
    const dy = y - cam.py;
    const dz = z - cam.pz;
    CX[i] = dx * cam.rx + dy * cam.ry + dz * cam.rz;
    CY[i] = dx * cam.ux + dy * cam.uy + dz * cam.uz;
    CZ[i] = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  }
  /** World polygon (flat xyz array) -> near-clipped -> projected -> filled. Returns false when fully clipped. */
  function poly3(pts, sh) {
    const n = pts.length / 3;
    for (let i = 0; i < n; i++) toCam(pts[3 * i], pts[3 * i + 1], pts[3 * i + 2], i);
    let m = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const inJ = CZ[j] > NEAR;
      const inI = CZ[i] > NEAR;
      if (inI !== inJ) {
        const k = (NEAR - CZ[j]) / (CZ[i] - CZ[j]);
        KX[m] = CX[j] + (CX[i] - CX[j]) * k;
        KY[m] = CY[j] + (CY[i] - CY[j]) * k;
        KZ[m++] = NEAR;
      }
      if (inI) {
        KX[m] = CX[i];
        KY[m] = CY[i];
        KZ[m++] = CZ[i];
      }
    }
    if (m < 3) return false;
    for (let i = 0; i < m; i++) {
      SX[i] = cam.cx + (cam.f * KX[i]) / KZ[i];
      SY[i] = cam.cy - (cam.f * KY[i]) / KZ[i];
    }
    if (sh && sh.dark) markId++;
    fillPoly(m, sh);
    return true;
  }
  /** Project one world point; returns [sx, sy, zc] or null when behind the near plane. */
  function proj(x, y, z) {
    toCam(x, y, z, 0);
    if (CZ[0] <= NEAR) return null;
    return [cam.cx + (cam.f * CX[0]) / CZ[0], cam.cy - (cam.f * CY[0]) / CZ[0], CZ[0]];
  }
  /** Screen-space outward offset of a convex polygon (for thick outlines under fills). */
  // ---------- stamped strokes ----------
  const STAMPS = [];
  for (let w = 1; w <= 12; w++) {
    const list = [];
    const r = w / 2;
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - r;
        const dy = y + 0.5 - r;
        if (w < 3 || dx * dx + dy * dy <= r * r + 0.35) list.push(x, y);
      }
    STAMPS.push(list);
  }
  /** mode: palette index | 'dark' | {glow: idx} (checkerboard on dark pixels only) | {lit, plane} */
  function plot(x, y, mode) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (clipMask && !clipMask[i]) return;
    if (typeof mode === 'number') fb[i] = mode;
    else if (mode === 'dark') {
      if (markBuf[i] !== markId) {
        markBuf[i] = markId;
        fb[i] = DARK[fb[i]];
      }
    } else if (mode.glow !== undefined) {
      if (((x + y) & 1) === 0 && markBuf[i] !== markId && LUMA[fb[i]] < 60) {
        markBuf[i] = markId;
        fb[i] = mode.glow;
      }
    } else if (mode.mat) fb[i] = mode.mat[planeClass(mode.plane, x, y)];
  }
  function stampAt(x, y, w, mode) {
    const wi = clamp(Math.round(w), 1, 12);
    const list = STAMPS[wi - 1];
    const ox = Math.round(x - wi / 2);
    const oy = Math.round(y - wi / 2);
    for (let k = 0; k < list.length; k += 2) plot(ox + list[k], oy + list[k + 1], mode);
  }
  function line2(x0, y0, x1, y1, w, mode) {
    const m = w + 2;
    if ((x0 < -m && x1 < -m) || (y0 < -m && y1 < -m) || (x0 > W + m && x1 > W + m) || (y0 > H + m && y1 > H + m)) return;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    if (steps > 4000) return;
    for (let i = 0; i <= steps; i++) stampAt(x0 + (dx * i) / steps, y0 + (dy * i) / steps, w, mode);
  }
  /** Screen polyline (flat array) with constant width. */
  function polyline2(pts, w, mode, closed) {
    if (mode === 'dark' || (mode && mode.glow !== undefined)) markId++;
    const n = pts.length >> 1;
    for (let i = 0; i + 1 < n; i++) line2(pts[2 * i], pts[2 * i + 1], pts[2 * i + 2], pts[2 * i + 3], w, mode);
    if (closed && n > 2) line2(pts[2 * n - 2], pts[2 * n - 1], pts[0], pts[1], w, mode);
  }
  /** World polyline: width in metres -> px (clamped), near-clipped per segment. */
  function polyline3(pts, wm, wmin, wmax, mode, closed) {
    if (mode === 'dark' || (mode && mode.glow !== undefined)) markId++;
    const n = pts.length / 3;
    const total = closed ? n : n - 1;
    for (let s = 0; s < total; s++) {
      const a = s;
      const b = (s + 1) % n;
      toCam(pts[3 * a], pts[3 * a + 1], pts[3 * a + 2], 0);
      toCam(pts[3 * b], pts[3 * b + 1], pts[3 * b + 2], 1);
      let ax = CX[0];
      let ay = CY[0];
      let az = CZ[0];
      let bx = CX[1];
      let by = CY[1];
      let bz = CZ[1];
      if (az <= NEAR && bz <= NEAR) continue;
      if (az <= NEAR) {
        const k = (NEAR - az) / (bz - az);
        ax += (bx - ax) * k;
        ay += (by - ay) * k;
        az = NEAR;
      } else if (bz <= NEAR) {
        const k = (NEAR - bz) / (az - bz);
        bx += (ax - bx) * k;
        by += (ay - by) * k;
        bz = NEAR;
      }
      const w = clamp((wm * cam.f * 2) / (az + bz), wmin, wmax);
      line2(cam.cx + (cam.f * ax) / az, cam.cy - (cam.f * ay) / az, cam.cx + (cam.f * bx) / bz, cam.cy - (cam.f * by) / bz, w, mode);
    }
  }

  function setClip(mask) {
    clipMask = mask;
  }
  function newMask() {
    return new Uint8Array(W * H);
  }
  function beginFrame() {
    NB.nextFrame();
    clipMask = null;
    fb.fill(NB.C.INK);
  }
  /** Face light class at one point (flat-shaded boxes, pins, lamp shade). */
  function classAt(x, y, z, nx, ny, nz) {
    const p = proj(x, y, z);
    const sx = p ? clamp(Math.round(p[0]), 0, W - 1) : 0;
    const sy = p ? clamp(Math.round(p[1]), 0, H - 1) : 0;
    return NB.lightClass(x, y, z, nx, ny, nz, sx, sy);
  }

  Object.assign(NB, { poly2, poly3, proj, plot, stampAt, line2, polyline2, polyline3, setClip, newMask, beginFrame, classAt });
})();

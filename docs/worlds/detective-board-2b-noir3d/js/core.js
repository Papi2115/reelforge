/* detective-board 2b "neon noir 3D" - core: palette, indexed framebuffer, seeded rng, easing,
 * camera + projection, scanline rasteriser, stamped strokes, and the two-light model (warm lamp, cyan neon).
 * Nothing here reads a clock: every frame is a pure function of the global time t handed in by render.js. */
'use strict';
(function () {
  const W = 960;
  const H = 540;

  // 20 inks. Role column is documented in NOTES.md; the palette check counts these exact RGBs.
  const PAL = [
    ['INK', '#07060e'], ['NIGHT', '#11143a'], ['INDIGO', '#1f2763'], ['DUSK', '#34428c'],
    ['SLATE', '#5b67a8'], ['MIST', '#a5b1dd'], ['TEAL_D', '#0b4656'], ['TEAL', '#1b8e98'],
    ['CYAN', '#7af6ea'], ['PLUM', '#3e1e48'], ['RUST', '#8a3f2e'], ['TAN', '#c06e45'],
    ['AMBER', '#e88f2e'], ['PEACH', '#f7d08f'], ['HOTW', '#fff4d8'], ['RED_DK', '#5c0927'],
    ['RED', '#ff2e4a'], ['RED_HOT', '#ff9da6'], ['ICE', '#e4ecff'], ['GRAPH', '#2a2c44'],
  ];
  const C = {};
  PAL.forEach((p, i) => (C[p[0]] = i));
  const RGB = PAL.map((p) => [1, 3, 5].map((k) => parseInt(p[1].slice(k, k + 2), 16)));
  // One step darker for cast shadows ("darken whatever is under").
  const DARK = new Uint8Array(PAL.length);
  const darkPairs = {
    INK: 'INK', NIGHT: 'INK', INDIGO: 'NIGHT', DUSK: 'INDIGO', SLATE: 'DUSK', MIST: 'SLATE',
    TEAL_D: 'NIGHT', TEAL: 'TEAL_D', CYAN: 'TEAL', PLUM: 'NIGHT', RUST: 'PLUM', TAN: 'RUST',
    AMBER: 'TAN', PEACH: 'TAN', HOTW: 'PEACH', RED_DK: 'INK', RED: 'RED_DK', RED_HOT: 'RED',
    ICE: 'MIST', GRAPH: 'INK',
  };
  for (const k in darkPairs) DARK[C[k]] = C[darkPairs[k]];
  const LUMA = RGB.map((c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]);

  const fb = new Uint8Array(W * H);
  const markBuf = new Int32Array(W * H);
  let markId = 1;
  let clipMask = null;

  // ---------- seeded randomness + easing ----------
  function hash(a, b) {
    let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
    return (h ^ (h >>> 15)) >>> 0;
  }
  const rnd = (a, b) => hash(a, b) / 4294967296;
  const sr = (a, b) => rnd(a, b) * 2 - 1;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const E = {
    lin: (k) => k,
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    sine: (k) => 0.5 - 0.5 * Math.cos(Math.PI * k),
    out: (k) => 1 - Math.pow(1 - k, 3),
    in: (k) => k * k * k,
    outBack: (k) => {
      const c = 1.9;
      return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
    },
    quint: (k) => (k < 0.5 ? 16 * Math.pow(k, 5) : 1 - Math.pow(-2 * k + 2, 5) / 2),
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // ---------- camera ----------
  const cam = { px: 0, py: 0, pz: 0, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: 1, f: 900, cx: W / 2, cy: H / 2 };
  const NEAR = 0.03;
  /** pose: {tx,ty,tz, yaw, pitch, dist, f, roll} - yaw/pitch in radians; yaw 0 looks along +z. */
  function setCamera(p) {
    const cp = Math.cos(p.pitch);
    const fx = Math.sin(p.yaw) * cp;
    const fy = Math.sin(p.pitch);
    const fz = Math.cos(p.yaw) * cp;
    cam.px = p.tx - fx * p.dist;
    cam.py = p.ty - fy * p.dist;
    cam.pz = p.tz - fz * p.dist;
    // right = up x fwd, up = fwd x right, then roll about fwd
    let rx = fz;
    let rz = -fx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl;
    rz /= rl;
    const ry = 0;
    const ux = fy * rz - fz * ry;
    const uy = fz * rx - fx * rz;
    const uz = fx * ry - fy * rx;
    const cr = Math.cos(p.roll || 0);
    const sn = Math.sin(p.roll || 0);
    cam.rx = rx * cr + ux * sn;
    cam.ry = ry * cr + uy * sn;
    cam.rz = rz * cr + uz * sn;
    cam.ux = ux * cr - rx * sn;
    cam.uy = uy * cr - ry * sn;
    cam.uz = uz * cr - rz * sn;
    cam.fx = fx;
    cam.fy = fy;
    cam.fz = fz;
    cam.f = p.f;
  }

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

  // ---------- lighting ----------
  /** Light classes: 0 shadow, 1 ambient night, 2 lamp, 3 lamp hot core, 4 neon. Materials are 5-entry ramps. */
  const lamp = (o) => Object.assign({ on: 0, x: 0, y: 2.5, z: -0.4, ax: 0, ay: -1, az: 0, hotDist: 1.9, reach: 3.3 }, o);
  const light = {
    lamps: [
      lamp({ cosHot: Math.cos(0.16), cosLit: Math.cos(0.41), cosEdge: Math.cos(0.422) }),
      lamp({ cosHot: Math.cos(0.2), cosLit: Math.cos(0.5), cosEdge: Math.cos(0.515), hotDist: 0.8, reach: 1.4 }),
    ],
    neonOn: 1, nx: 6, ny: 3, nz: 12,
    occluders: null, // function(Q, dir) -> true when the neon ray reaches Q through the window (set by world.js)
  };
  function lampClass(L, qx, qy, qz, nx, ny, nz, x, y) {
    const vx = qx - L.x;
    const vy = qy - L.y;
    const vz = qz - L.z;
    if (-(vx * nx + vy * ny + vz * nz) <= 0) return 1;
    const d = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const ca = (vx * L.ax + vy * L.ay + vz * L.az) / d;
    if (ca <= L.cosEdge || d >= L.reach) return 1;
    if (ca < L.cosLit) return (ca - L.cosEdge) / (L.cosLit - L.cosEdge) > bayer(x, y) ? 2 : 1;
    if (L.on > 1 && d < L.hotDist) {
      const hotBand = (ca - L.cosHot) / 0.0025;
      if (hotBand >= 1 || (hotBand > 0 && hotBand > bayer(x, y))) return 3;
    }
    return 2;
  }
  /** Light classes: 0 shadow, 1 ambient night, 2 lamp, 3 lamp hot core, 4 neon. Materials are 5-entry ramps. */
  function lightClass(qx, qy, qz, nx, ny, nz, x, y) {
    let cls = 1;
    for (let i = 0; i < light.lamps.length; i++) {
      const L = light.lamps[i];
      if (L.on > 0) cls = Math.max(cls, lampClass(L, qx, qy, qz, nx, ny, nz, x, y));
    }
    if (cls === 1 && light.neonOn && light.occluders) {
      const dx = light.nx - qx;
      const dy = light.ny - qy;
      const dz = light.nz - qz;
      if (dx * nx + dy * ny + dz * nz > 0 && light.occluders(qx, qy, qz, dx, dy, dz)) cls = 4;
    }
    return cls;
  }

  // Per-plane light cache: surfaces close to a plane (cards on the board, papers on the desk) share it.
  const planes = [];
  let frameNo = 1;
  function addPlane(nx, ny, nz, d) {
    planes.push({ nx, ny, nz, d, stamp: new Int32Array(W * H), cls: new Uint8Array(W * H) });
    return planes.length - 1;
  }
  function planeClass(pid, x, y) {
    const pl = planes[pid];
    const i = y * W + x;
    if (pl.stamp[i] === frameNo) return pl.cls[i];
    const sx = x + 0.5 - cam.cx;
    const sy = cam.cy - (y + 0.5);
    const dx = cam.fx * cam.f + cam.rx * sx + cam.ux * sy;
    const dy = cam.fy * cam.f + cam.ry * sx + cam.uy * sy;
    const dz = cam.fz * cam.f + cam.rz * sx + cam.uz * sy;
    const den = pl.nx * dx + pl.ny * dy + pl.nz * dz;
    let c = 1;
    if (den < -1e-9 || den > 1e-9) {
      const tt = (pl.d - (pl.nx * cam.px + pl.ny * cam.py + pl.nz * cam.pz)) / den;
      c = lightClass(cam.px + dx * tt, cam.py + dy * tt, cam.pz + dz * tt, pl.nx, pl.ny, pl.nz, x, y);
    }
    pl.stamp[i] = frameNo;
    pl.cls[i] = c;
    return c;
  }

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
  function offsetPoly(pts, d) {
    const n = pts.length >> 1;
    let area = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) area += pts[2 * j] * pts[2 * i + 1] - pts[2 * i] * pts[2 * j + 1];
    const s = area > 0 ? -1 : 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = (i + n - 1) % n;
      const q = (i + 1) % n;
      const e1x = pts[2 * i] - pts[2 * p];
      const e1y = pts[2 * i + 1] - pts[2 * p + 1];
      const e2x = pts[2 * q] - pts[2 * i];
      const e2y = pts[2 * q + 1] - pts[2 * i + 1];
      const l1 = Math.hypot(e1x, e1y) || 1;
      const l2 = Math.hypot(e2x, e2y) || 1;
      const n1x = (s * e1y) / l1;
      const n1y = (-s * e1x) / l1;
      const n2x = (s * e2y) / l2;
      const n2y = (-s * e2x) / l2;
      let bx = n1x + n2x;
      let by = n1y + n2y;
      const bl = bx * n1x + by * n1y || 1;
      bx /= bl;
      by /= bl;
      const lim = Math.min(4, Math.hypot(bx, by));
      const k = lim / (Math.hypot(bx, by) || 1);
      out.push(pts[2 * i] + bx * d * k, pts[2 * i + 1] + by * d * k);
    }
    return out;
  }

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
    frameNo++;
    clipMask = null;
    fb.fill(C.INK);
  }
  /** Face light class at one point (flat-shaded boxes, pins, lamp shade). */
  function classAt(x, y, z, nx, ny, nz) {
    const p = proj(x, y, z);
    const sx = p ? clamp(Math.round(p[0]), 0, W - 1) : 0;
    const sy = p ? clamp(Math.round(p[1]), 0, H - 1) : 0;
    return lightClass(x, y, z, nx, ny, nz, sx, sy);
  }

  window.NB = {
    W, H, PAL, C, RGB, DARK, LUMA, fb, hash, rnd, sr, clamp, lerp, seg, E, bayer,
    cam, setCamera, light, lightClass, addPlane, planeClass, classAt,
    poly2, poly3, proj, offsetPoly, plot, stampAt, line2, polyline2, polyline3,
    setClip, newMask, beginFrame,
  };
})();

/* detective-board 2b "neon noir 3D" - core: palette, indexed framebuffer, seeded rng, easing, camera,
 * and the light model (two warm lamps, cyan neon through the window) with per-plane light caches.
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

  // ---------- lighting ----------
  /** Light classes: 0 shadow, 1 ambient night, 2 lamp, 3 lamp hot core, 4 neon. Materials are 5-entry ramps. */
  const lamp = (o) => Object.assign({ on: 0, x: 0, y: 2.5, z: -0.4, ax: 0, ay: -1, az: 0, hotDist: 1.9, reach: 3.3 }, o);
  const light = {
    lamps: [
      lamp({ cosHot: Math.cos(0.16), cosLit: Math.cos(0.41), cosEdge: Math.cos(0.422) }),
      lamp({ cosHot: Math.cos(0.11), cosLit: Math.cos(0.42), cosEdge: Math.cos(0.432), hotDist: 0, reach: 1.6 }),
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

  const nextFrame = () => frameNo++;

  window.NB = {
    W, H, PAL, C, RGB, DARK, LUMA, fb, hash, rnd, sr, clamp, lerp, seg, E, bayer,
    cam, setCamera, light, lightClass, addPlane, planeClass, nextFrame,
  };
})();

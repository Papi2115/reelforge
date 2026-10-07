/* Textured-column raycaster on a 320x180 indexed buffer. Floors/ceilings cast per pixel, low and see-through
   walls drawn back-to-front, billboards depth-tested per pixel, Doom-style colormap lighting + fog. */
'use strict';
(function () {
  const RF = window.RF, M = RF.MAP, C = RF.C;
  const W = 320, H = 180;
  const TANH = Math.tan((66 * Math.PI) / 360);
  const F = W / 2 / TANH;
  const MAXD = 44;
  const buf = new Uint8Array(W * H), depth = new Float32Array(W * H);
  const rdx = new Float32Array(W), rdy = new Float32Array(W), az = new Float32Array(W);
  const BAY = new Float32Array(16);
  RF.BAYER.forEach((v, i) => (BAY[i] = v));
  const TEXL = RF.TEX_LIST;
  const SAND_ID = RF.TEX.sand.id;
  const SUNKEN = new Uint8Array(TEXL.length);
  SUNKEN[RF.TEX.pit.id] = 1; SUNKEN[RF.TEX.trench.id] = 1;
  const DESERT = M.REG.length - 1;
  RF.WW = W; RF.WH = H; RF.FOCAL = F; RF.wbuf = buf; RF.wdepth = depth;
  const fogIdx = M.REG.map((r) => RF.nearest(r.fog[0], r.fog[1], r.fog[2]));
  const dawnFog = RF.nearest(206, 178, 146);

  // packed per-region lights for this frame
  const LR = M.REG.map(() => new Float32Array(5 * 12));
  const LN = new Int32Array(M.REG.length);
  function lightSum(r, x, y, z) {
    const L = LR[r];
    let s = 0;
    for (let i = 0, o = 0; i < LN[r]; i++, o += 5) {
      const dx = L[o] - x, dy = L[o + 1] - y, dz = L[o + 2] - z;
      const q = 1 + (dx * dx + dy * dy + dz * dz) * L[o + 4];
      s += L[o + 3] / (q * q);
    }
    return s;
  }
  function shade(cmap, c, l, g, x, y) {
    let lf = (l * 15) / RF.LIGHT_MAX;
    if (lf > 15) lf = 15; else if (lf < 0) lf = 0;
    let li = lf | 0;
    if (lf - li > BAY[((y & 3) << 2) | (x & 3)]) li++;
    if (li > 15) li = 15;
    let gf = g * 7;
    if (gf > 7) gf = 7;
    let gi = gf | 0;
    if (gf - gi > BAY[(((y + 1) & 3) << 2) | ((x + 2) & 3)]) gi++;
    if (gi > 7) gi = 7;
    return cmap[(c * 16 + li) * 8 + gi];
  }
  RF.shadeIdx = shade;

  // ---------------- sky (desert only) ----------------
  const STARS = [];
  const sr = RF.rng(1982);
  for (let i = 0; i < 170; i++) STARS.push({ az: sr() * Math.PI * 2, el: 0.06 + Math.pow(sr(), 1.4) * 0.95, b: sr() });
  function mesaH(a) {
    const u = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const n = RF.vnoise(u * 9, 0, 1, 77);
    const flat = n > 0.55 ? 0.055 + (n - 0.55) * 0.05 : 0.018 + n * 0.03;
    return flat + RF.vnoise(u * 60, 0, 1, 78) * 0.004;
  }
  function skyPixel(x, y, horizon, era, t) {
    const el = (horizon - y - 0.5) / F;
    const b = BAY[((y & 3) << 2) | (x & 3)];
    const m = mesaH(az[x]);
    if (el < m) {
      if (era === 1) return el > m - 0.006 && b < 0.5 ? C.NIGHT : C.NIGHT_D;
      return el > m - 0.008 ? C.SAND : b < 0.5 ? C.DIRT : C.CLAY;
    }
    if (era === 1) {
      if (el > 0.42) return C.NIGHT_D;
      if (el > 0.2) return b < (0.42 - el) / 0.22 ? C.NIGHT : C.NIGHT_D;
      if (el > 0.07) return b < (0.2 - el) / 0.13 ? C.DUSK : C.NIGHT;
      return b < (0.07 - el) / 0.07 ? C.HAZE : C.DUSK;
    }
    if (el > 0.45) return C.HAZE;
    if (el > 0.24) return b < (0.45 - el) / 0.21 ? C.MOON : C.HAZE;
    if (el > 0.09) return b < (0.24 - el) / 0.15 ? C.SAND_L : C.MOON;
    return b < (0.09 - el) / 0.09 ? C.PAPER : C.SAND_L;
  }
  let fogNow = 0;
  function drawSkyDetails(cam, horizon, era, t) {
    const toX = (a) => {
      let d = a - cam.a;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 1.2) return -1;
      return W / 2 + F * Math.tan(d);
    };
    const put = (x, y, c) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const p = y * W + x;
      if (depth[p] > 1e8 && BAY[((y & 3) << 2) | (x & 3)] >= fogNow) buf[p] = c; // fog swallows the stars too
    };
    if (era === 1) {
      STARS.forEach((s, i) => {
        const x = toX(s.az);
        if (x < 0) return;
        const y = horizon - s.el * F;
        if (s.el < mesaH(s.az) + 0.01) return;
        const tw = RF.hash3(Math.floor(t * 3 + i * 0.37), i, 4) < 0.12;
        put(x, y, tw ? C.HAZE : s.b > 0.85 ? C.PAPER : s.b > 0.4 ? C.MOON : C.HAZE);
      });
      const mx = toX(0.38), my = horizon - 0.21 * F;
      if (mx >= 0)
        for (let yy = -5; yy <= 5; yy++)
          for (let xx = -5; xx <= 5; xx++) {
            const inA = xx * xx + yy * yy <= 20, inB = (xx - 2.2) * (xx - 2.2) + (yy + 1) * (yy + 1) <= 17;
            if (inA && !inB) put(mx + xx, my + yy, xx < -3 ? C.MOON : C.PAPER);
          }
    } else {
      const sx = toX(0.42), sy = horizon - 0.035 * F;
      if (sx >= 0) for (let yy = -6; yy <= 0; yy++) for (let xx = -7; xx <= 7; xx++) if (xx * xx + yy * yy * 1.2 <= 46) put(sx + xx, sy + yy, C.PAPER);
    }
  }

  /**
   * The landfill pit is a real hole: a floor ray that enters the pit rectangle continues down to the bottom;
   * if it leaves the rectangle first it hits the far dirt wall. Returns true when it drew the pixel.
   */
  let PX = 0, PY = 0, PEYE = 0.5, PRDX = null, PRDY = null;
  function pitFloor(p, x, y, dyc, s0, wx, wy, r, ws) {
    const P = M.PIT, pd = ws.era === 1 ? P.depth1 : P.depth2;
    const rx = PRDX[x], ry = PRDY[x];
    const s1 = ((PEYE + pd) * F) / dyc;
    const sx = rx > 0 ? (P.x1 - PX) / rx : rx < 0 ? (P.x0 - PX) / rx : 1e9;
    const sy = ry > 0 ? (P.y1 - PY) / ry : ry < 0 ? (P.y0 - PY) / ry : 1e9;
    const sExit = Math.min(sx, sy);
    const cmap = ws.cmaps[r];
    let g;
    if (sExit < s1) {
      const hx = PX + rx * sExit, hy = PY + ry * sExit, z = PEYE - (sExit * dyc) / F;
      const u = sx < sy ? hy - Math.floor(hy) : hx - Math.floor(hx);
      const tex = RF.TEX.pitWall;
      const c = tex.d[Math.min(63, Math.max(0, Math.floor((-z / pd) * 64))) * 64 + (Math.floor(u * 64) & 63)];
      g = Math.max(ws.fogBoost, 1 - Math.exp(-sExit * ws.dens[r]));
      buf[p] = shade(cmap, c, (ws.amb[r] + lightSum(r, hx, hy, z)) * (0.55 + 0.4 * (1 + z / pd)), g, x, y);
      depth[p] = sExit;
      return true;
    }
    const bx = PX + rx * s1, by = PY + ry * s1;
    const tex = TEXL[ws.era === 1 ? RF.TEX.pit.id : RF.TEX.trench.id];
    const c = tex.d[((((by - Math.floor(by)) * 64) | 0) & 63) * 64 + ((((bx - Math.floor(bx)) * 64) | 0) & 63)];
    g = Math.max(ws.fogBoost, 1 - Math.exp(-s1 * ws.dens[r]));
    buf[p] = shade(cmap, c, (ws.amb[r] + lightSum(r, bx, by, -pd)) * 0.5, g, x, y);
    depth[p] = s1;
    return true;
  }

  /** Render the world for camera `cam` and world state `ws` into RF.wbuf. Returns horizon. */
  RF.renderWorld = function (cam, ws) {
    const MW = M.W, MH = M.H, wall = ws.wall, floor = ws.floor, ceil = ws.ceil, region = ws.region;
    const px = cam.x, py = cam.y;
    const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a), rightX = -dirY, rightY = dirX;
    const horizon = H / 2 - cam.pitch + cam.bobY * 0.5;
    const eye = cam.eye;
    const boost = ws.fogBoost;
    PX = px; PY = py; PEYE = eye; PRDX = rdx; PRDY = rdy;
    for (let x = 0; x < W; x++) {
      const k = (2 * (x + 0.5)) / W - 1;
      rdx[x] = dirX + rightX * TANH * k;
      rdy[x] = dirY + rightY * TANH * k;
      az[x] = cam.a + Math.atan(TANH * k);
    }
    LN.fill(0);
    ws.lights.forEach((l) => {
      const n = LN[l.reg];
      if (n >= 12) return;
      LR[l.reg].set([l.x, l.y, l.z, l.I, l.inv], n * 5);
      LN[l.reg] = n + 1;
    });
    const fogOf = (r) => (r === DESERT && ws.era === 2 ? dawnFog : fogIdx[r]);

    // ---- pass 1: floor, ceiling, sky ----
    for (let y = 0; y < H; y++) {
      const dyc = y + 0.5 - horizon;
      const isFloor = dyc > 0;
      const rowDist = isFloor ? (eye * F) / dyc : ((1 - eye) * F) / -dyc;
      const zPlane = isFloor ? 0 : 1;
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        const wx = px + rdx[x] * rowDist, wy = py + rdy[x] * rowDist;
        const cx = Math.floor(wx), cy = Math.floor(wy);
        const inside = cx >= 0 && cy >= 0 && cx < MW && cy < MH;
        const ci = cy * MW + cx;
        const r = inside ? region[ci] : DESERT;
        const texId = isFloor ? (inside ? floor[ci] : SAND_ID) : inside ? ceil[ci] : 255;
        if (texId === 255 || rowDist > MAXD || (!isFloor && Math.abs(dyc) < 0.5)) {
          if (texId === 255 || r === DESERT) {
            let c = skyPixel(x, y, horizon, ws.era, ws.t);
            if (boost > 0 && BAY[((y & 3) << 2) | (x & 3)] < boost) c = fogOf(DESERT);
            buf[p] = c;
            depth[p] = 1e9;
          } else {
            buf[p] = fogOf(r);
            depth[p] = MAXD;
          }
          continue;
        }
        if (isFloor && SUNKEN[texId] && pitFloor(p, x, y, dyc, rowDist, wx, wy, r, ws)) continue;
        const tex = TEXL[texId];
        const tx = ((wx - cx) * 64) | 0, ty = ((wy - cy) * 64) | 0;
        const c = tex.d[(ty & 63) * 64 + (tx & 63)];
        const emis = tex.emis[c] && tex.emisLevel > 0;
        const l = emis ? tex.emisLevel : (ws.amb[r] + lightSum(r, wx, wy, zPlane)) * (isFloor ? 1 : 0.55);
        let g = 1 - Math.exp(-rowDist * ws.dens[r]);
        if (emis) g *= 0.35;
        if (boost > g) g = boost;
        buf[p] = isFloor ? shade(ws.cmaps[r], c, l, g, x, y) : shade(ws.cmaps[r], c, l, g, 1, 0);
        depth[p] = rowDist;
      }
    }
    fogNow = boost;
    drawSkyDetails(cam, horizon, ws.era, ws.t);

    // ---- pass 2: walls, per column, back to front ----
    const hits = [];
    for (let x = 0; x < W; x++) {
      const rx = rdx[x], ry = rdy[x];
      let mapX = Math.floor(px), mapY = Math.floor(py);
      const ddx = rx === 0 ? 1e30 : Math.abs(1 / rx), ddy = ry === 0 ? 1e30 : Math.abs(1 / ry);
      const stepX = rx < 0 ? -1 : 1, stepY = ry < 0 ? -1 : 1;
      let sideX = rx < 0 ? (px - mapX) * ddx : (mapX + 1 - px) * ddx;
      let sideY = ry < 0 ? (py - mapY) * ddy : (mapY + 1 - py) * ddy;
      let prevReg = region[mapY * MW + mapX];
      hits.length = 0;
      for (let it = 0; it < 120; it++) {
        let side;
        if (sideX < sideY) { sideX += ddx; mapX += stepX; side = 0; } else { sideY += ddy; mapY += stepY; side = 1; }
        const dist = side === 0 ? sideX - ddx : sideY - ddy;
        if (dist > MAXD) break;
        if (mapX < 0 || mapY < 0 || mapX >= MW || mapY >= MH) { if (mapX >= 66) continue; break; }
        const ci = mapY * MW + mapX;
        const wtId = wall[ci];
        if (wtId === 0) { prevReg = region[ci]; continue; }
        const info = M.wallTypes[wtId];
        const exit = Math.min(sideX, sideY);
        if (info.door) {
          if (rx === 0) continue;
          const dpl = (mapX + 0.5 - px) / rx;
          if (dpl >= dist && dpl <= exit) {
            const fy = py + ry * dpl - mapY, o = ws.doorOpen[ci];
            if (fy >= o) { hits.push({ d: dpl, u: rx > 0 ? fy - o : 1 - (fy - o), tex: RF.TEX.door.id, h: 1, side: 0, reg: prevReg, cap: -1, exit: dpl }); break; }
          }
          continue;
        }
        const wallX = side === 0 ? py + dist * ry : px + dist * rx;
        let u = wallX - Math.floor(wallX);
        if ((side === 0 && rx < 0) || (side === 1 && ry > 0)) u = 1 - u;
        let texName = info.tex || M.REG[region[ci]].wall;
        if (info.variants) texName = info.variants[Math.floor(RF.hash3(mapX, mapY, 3) * info.variants.length)];
        if (!info.tex && region[ci] === 3) texName = RF.hash3(mapX, mapY, 4) < 0.5 ? 'toyShelf' : 'toyShelf2';
        hits.push({ d: dist, u: u, tex: RF.TEX[texName].id, h: info.h, side: side, reg: prevReg, cap: info.cap === undefined ? -1 : info.cap, exit: exit });
        if (info.h >= 1 && !info.transparent) break;
      }
      for (let k = hits.length - 1; k >= 0; k--) {
        const hit = hits[k];
        const d = Math.max(0.03, hit.d), sc = F / d;
        const yTop = horizon - (hit.h - eye) * sc, yBot = horizon + eye * sc;
        const y0 = Math.max(0, Math.ceil(yTop - 0.5)), y1 = Math.min(H - 1, Math.floor(yBot - 0.5));
        const tex = TEXL[hit.tex];
        const tx = Math.min(63, Math.max(0, Math.floor(hit.u * 64)));
        const wx = px + rx * d, wy = py + ry * d;
        const r = hit.reg, cmap = ws.cmaps[r], amb = ws.amb[r];
        let g = 1 - Math.exp(-d * ws.dens[r]);
        if (boost > g) g = boost;
        const sideMul = hit.side === 1 ? 0.8 : 1;
        for (let y = y0; y <= y1; y++) {
          const z = eye + (horizon - y - 0.5) / sc;
          const ty = Math.min(63, Math.max(0, Math.floor(((hit.h - z) / hit.h) * 64)));
          const c = tex.d[ty * 64 + tx];
          if (c === 255) continue;
          const emis = tex.emis[c] && tex.emisLevel > 0;
          const l = emis ? tex.emisLevel : (amb + lightSum(r, wx, wy, z)) * sideMul;
          const p = y * W + x;
          buf[p] = shade(cmap, c, l, emis ? g * 0.35 : g, x, y);
          depth[p] = d;
        }
        if (hit.cap >= 0 && eye > hit.h) {
          const yFar = horizon - (hit.h - eye) * (F / hit.exit);
          for (let y = Math.max(0, Math.ceil(yFar - 0.5)); y < y0; y++) {
            const rd = ((eye - hit.h) * F) / (y + 0.5 - horizon);
            const l = amb + lightSum(r, px + rx * rd, py + ry * rd, hit.h);
            const p = y * W + x;
            buf[p] = shade(cmap, hit.cap, l, Math.max(boost, 1 - Math.exp(-rd * ws.dens[r])), x, y);
            depth[p] = rd;
          }
        }
      }
    }

    // ---- pass 3: billboards ----
    const list = [];
    ws.sprites.forEach((s) => {
      const dx = s.x - px, dy = s.y - py;
      const dep = dx * dirX + dy * dirY;
      if (dep < 0.12) return;
      list.push({ s: s, dep: dep, lat: dx * rightX + dy * rightY });
    });
    list.sort((a, b) => b.dep - a.dep);
    list.forEach(({ s, dep, lat }) => {
      const bmp = s.spr;
      const sw = (s.w * F) / dep, sh = (s.h * F) / dep;
      const x0 = W / 2 + (F * lat) / dep - sw / 2;
      const yTop = horizon - (s.z + s.h - eye) * (F / dep);
      const cxl = Math.floor(s.x), cyl = Math.floor(s.y);
      const r = cxl >= 0 && cyl >= 0 && cxl < MW && cyl < MH ? region[cyl * MW + cxl] : DESERT;
      const l = ws.amb[r] + lightSum(r, s.x, s.y, s.z + s.h * 0.6);
      let g = 1 - Math.exp(-dep * ws.dens[r]);
      if (boost > g) g = boost;
      const cmap = ws.cmaps[r];
      const xs0 = Math.max(0, Math.ceil(x0 - 0.5)), xs1 = Math.min(W - 1, Math.floor(x0 + sw - 0.5));
      const ys0 = Math.max(0, Math.ceil(yTop - 0.5)), ys1 = Math.min(H - 1, Math.floor(yTop + sh - 0.5));
      for (let xs = xs0; xs <= xs1; xs++) {
        const tx = Math.min(bmp.w - 1, Math.floor(((xs + 0.5 - x0) / sw) * bmp.w));
        for (let ys = ys0; ys <= ys1; ys++) {
          const p = ys * W + xs;
          if (dep >= depth[p]) continue;
          const c = bmp.d[Math.min(bmp.h - 1, Math.floor(((ys + 0.5 - yTop) / sh) * bmp.h)) * bmp.w + tx];
          if (c === 255) continue;
          buf[p] = bmp.emis[c] ? shade(cmap, c, 1.25, g * 0.3, xs, ys) : shade(cmap, c, l, g, xs, ys);
          depth[p] = dep;
        }
      }
    });
    return horizon;
  };
  /** Project a world point to world-buffer coords (for the hand reaching at a sprite). */
  RF.project = function (cam, wx, wy, wz) {
    const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a);
    const dx = wx - cam.x, dy = wy - cam.y;
    const dep = dx * dirX + dy * dirY, lat = dx * -dirY + dy * dirX;
    const horizon = H / 2 - cam.pitch + cam.bobY * 0.5;
    return { x: W / 2 + (F * lat) / dep, y: horizon - (wz - cam.eye) * (F / dep), dep: dep };
  };
})();

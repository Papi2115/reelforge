/* sketchbook - paper: page stocks of the one notebook (lined, cartridge, graph), inserts (index card, kraft envelope,
   calendar sheet, sticky note), and physical marks (spiral, tape, paper clip, coffee ring). */
'use strict';
(function () {
  const SB = window.SB, C = SB.C, W = SB.W, H = SB.H, hash = SB.hash;

  // fibre tile: sparse short fibres, a few specks. Low contrast by design (texture level, never noise).
  const T = 1024, FIB = new Uint8Array(T * T);
  (function () {
    for (let i = 0; i < 2700; i++) {
      let x = hash(i, 1) * T, y = hash(i, 2) * T, a = hash(i, 3) * Math.PI * 2;
      const len = 2.5 + hash(i, 4) * 5.5, bend = (hash(i, 5) - 0.5) * 0.5;
      for (let s = 0; s < len; s += 0.7) {
        FIB[((Math.round(y) & (T - 1)) * T) + (Math.round(x) & (T - 1))] = 1;
        x += Math.cos(a) * 0.7; y += Math.sin(a) * 0.7; a += bend * 0.3;
      }
    }
    for (let i = 0; i < 380; i++) FIB[((hash(i, 8) * T) | 0) * T + ((hash(i, 9) * T) | 0)] = 2;
  })();
  SB.fibreAt = (u, v) => FIB[((v | 0) & (T - 1)) * T + ((u | 0) & (T - 1))];

  // --- notebook page stocks, cached in page space ---
  const PAGE_X = 16; // spiral side: desk shows left of this
  SB.PAGE_X = PAGE_X;
  const cache = {};
  function base(tex, col, fib, ox, oy, tooth) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const f = FIB[(((y + oy) & (T - 1)) * T) + ((x + ox) & (T - 1))];
      let c = col;
      if (f === 1) c = fib;
      else if (f === 2) c = C.SHADE;
      else if (tooth && hash(x, y, 91) < tooth) c = fib;
      tex[y * W + x] = c;
    }
  }
  function spiral(tex) {
    for (let y = 0; y < H; y++) for (let x = 0; x < PAGE_X; x++) tex[y * W + x] = C.DESK;
    for (let y = 0; y < H; y++) { tex[y * W + PAGE_X] = C.SHADE; if (hash(y, 3) < 0.5) tex[y * W + PAGE_X + 1] = C.FIBRE; }
    for (let k = 0; k < 22; k++) {
      const yk = 9 + k * 25.5;
      // punched hole: the next page shows through
      const hole = SB.ellipsePts(33, yk, 4.5, 3.6, 14);
      SB.fillPoly(tex, hole, C.SHADE);
      SB.fillPoly(tex, SB.ellipsePts(33, yk + 1, 3.2, 2.2, 12), C.GRAPH_L);
      // wire coil from the hole over the edge
      const wire = SB.smoothPath([35, yk + 1, 31, yk - 5, 21, yk - 9, 9, yk - 8, 0, yk - 3, -4, yk + 2], null, 1.5);
      const sh = wire.map((v, i) => v + (i % 2 ? 4 : 2));
      let pix = SB.pixelPath(sh, false);
      SB.setMode(2, SB.HARD);
      for (let i = 0; i < pix.length; i += 2) SB.stamp(tex, pix[i], pix[i + 1], SB.roundBrush(2), 0);
      SB.setMode(0);
      pix = SB.pixelPath(wire, false);
      for (let i = 0; i < pix.length; i += 2) SB.stamp(tex, pix[i], pix[i + 1], SB.roundBrush(3), C.GRAPHITE);
      pix = SB.pixelPath(wire.map((v, i) => v - (i % 2 ? 1 : 0)), true);
      for (let i = 2; i < pix.length - 2; i += 2) SB.put(tex, pix[i], pix[i + 1], C.GRAPH_L);
      SB.put(tex, Math.round(19), Math.round(yk - 9), C.PAPER);
    }
  }
  function lined(tex) {
    for (let y = 92; y < H; y += 26) for (let x = PAGE_X + 2; x < W; x++) if (tex[y * W + x] !== C.SHADE || hash(x, y) < 0.5) tex[y * W + x] = C.RULE;
    for (let y = 0; y < H; y++) { tex[y * W + 122] = C.MARGIN; if (hash(y, 12) < 0.12) tex[y * W + 123] = C.MARGIN; }
  }
  function graph(tex) {
    const x0 = 58, y0 = 12;
    for (let y = 0; y < H; y++) for (let x = PAGE_X + 4; x < W; x++) {
      const gx = (x - x0) % 12 === 0, gy = (y - y0) % 12 === 0;
      if (!gx && !gy) continue;
      const major = (gx && ((x - x0) / 12) % 5 === 0) || (gy && ((y - y0) / 12) % 5 === 0);
      if (major || (x + y) % 2 === 0) tex[y * W + x] = C.GRID;
    }
  }
  SB.stock = (name) => {
    if (cache[name]) return cache[name];
    const tex = new Uint8Array(W * H);
    if (name === 'cartridge') base(tex, C.PAPER, C.FIBRE, 311, 87, 0.006);
    else base(tex, C.PAPER, C.FIBRE, name === 'graph' ? 640 : 120, name === 'graph' ? 400 : 512, 0);
    if (name === 'lined') lined(tex);
    if (name === 'graph') graph(tex);
    spiral(tex);
    return (cache[name] = tex);
  };
  // draw a stock into the buffer through the camera
  SB.drawStock = (b, name) => {
    const tex = SB.stock(name), v = SB.view;
    if (v.z === 1 && v.cx === W / 2 && v.cy === H / 2) { b.set(tex); return; }
    for (let y = 0; y < H; y++) {
      const py = Math.floor((y + 0.5 - H / 2) / v.z + v.cy);
      for (let x = 0; x < W; x++) {
        const px = Math.floor((x + 0.5 - W / 2) / v.z + v.cx);
        b[y * W + x] = px < 0 || py < 0 || px >= W || py >= H ? C.DESK : tex[py * W + px];
      }
    }
  };

  // --- inserts: local (u,v) box w x h placed at page (x,y) rotated deg, scaled s; xf/inv maps ---
  SB.placement = (x, y, deg, s, dx, dy) => {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), si = Math.sin(a), k = s || 1;
    const toPage = (u, v) => [x + (u * c - v * si) * k + (dx || 0), y + (u * si + v * c) * k + (dy || 0)];
    const xf = (u, v) => { const p = toPage(u, v); return SB.toS(p[0], p[1]); };
    const inv = (sx, sy) => {
      const vw = SB.view, px = (sx - W / 2) / vw.z + vw.cx - x - (dx || 0), py = (sy - H / 2) / vw.z + vw.cy - y - (dy || 0);
      return [(px * c + py * si) / k, (-px * si + py * c) / k];
    };
    return { xf: xf, inv: inv, toPage: toPage, deg: deg, s: k };
  };
  const quad = (pl, w, h, e) => [...pl.xf(0, 0), ...pl.xf(w, 0), ...pl.xf(w, h), ...pl.xf(0, h)];
  SB.quad = quad;
  SB.dropShadow = (b, pl, w, h, ox, oy, map) => {
    const q = quad(pl, w, h).map((v, i) => v + (i % 2 ? oy : ox));
    SB.setMode(2, map || SB.HARD);
    SB.fillPoly(b, q, 0);
    SB.setMode(0);
  };
  // paper sheet with its own fibres; opts {col, fib, fib2, tooth}
  SB.sheet = (b, pl, w, h, o) => {
    const col = o.col, fib = o.fib, fib2 = o.fib2 != null ? o.fib2 : o.fib, fo = o.fo || 0;
    // the inverse placement is affine: evaluate it once, then step per pixel (no allocation in the loop)
    const o0 = pl.inv(0.5, 0.5), ox = pl.inv(1.5, 0.5), oy = pl.inv(0.5, 1.5);
    const ux = ox[0] - o0[0], vx = ox[1] - o0[1], uy = oy[0] - o0[0], vy = oy[1] - o0[1];
    SB.fillPoly(b, o.poly || quad(pl, w, h), (x, y) => {
      const u = o0[0] + ux * x + uy * y, v = o0[1] + vx * x + vy * y;
      const f = FIB[((((v + 200) | 0) & (T - 1)) * T) + (((u + fo) | 0) & (T - 1))];
      if (f === 1) return fib;
      if (f === 2) return fib2;
      return col;
    });
    if (o.edge !== false) SB.outline(b, o.poly || quad(pl, w, h), o.edge != null ? o.edge : C.SHADE);
  };
  // printed straight line in local coords (no boil)
  SB.printLine = (b, pl, u0, v0, u1, v1, col, skip) => {
    const a = pl.xf(u0, v0), z = pl.xf(u1, v1);
    const pix = SB.pixelPath([a[0], a[1], z[0], z[1]], true);
    for (let i = 0; i < pix.length; i += 2) if (!skip || hash(pix[i], pix[i + 1], 5) > skip) SB.put(b, pix[i], pix[i + 1], col);
  };

  // clear tape strip with torn ends
  SB.tape = (b, x, y, w, h, deg, seed) => {
    const pl = SB.placement(x, y, deg, 1);
    const n = 6;
    // loop: torn left end down, torn right end up
    const left = [], right = [];
    for (let i = 0; i <= n; i++) left.push(...pl.xf(-w / 2 + SB.rnd(-2.2, 2.2, seed, i, 1), -h / 2 + (i / n) * h));
    for (let i = n; i >= 0; i--) right.push(...pl.xf(w / 2 + SB.rnd(-2.2, 2.2, seed, i, 2), -h / 2 + (i / n) * h));
    const loop = left.concat(right);
    SB.setMode(2, SB.TAPE);
    SB.fillPoly(b, loop, 0);
    SB.setMode(0);
    // long edges catch the light
    SB.printLine(b, pl, -w / 2 + 2, -h / 2, w / 2 - 2, -h / 2, C.SHADE, 0.35);
    SB.printLine(b, pl, -w / 2 + 2, h / 2, w / 2 - 2, h / 2, C.SHADE, 0.35);
  };

  // gem paper clip (local units: 16 x 60)
  const CLIP = [4, 16, 4, 44, 5.2, 46.8, 8, 48, 10.8, 46.8, 12, 44, 12, 4, 10.2, -0.2, 6, -2, 1.8, -0.2, 0, 4, 0, 52, 2.3, 57.7, 8, 60, 13.7, 57.7, 16, 52, 16, 22];
  SB.clip = (b, x, y, deg, s) => {
    const pl = SB.placement(x, y, deg, s || 1);
    const pts = [];
    for (let i = 0; i < CLIP.length; i += 2) pts.push(...pl.xf(CLIP[i], CLIP[i + 1]));
    const path = SB.smoothPath(pts, null, 1.5);
    let pix = SB.pixelPath(path.map((v, i) => v + (i % 2 ? 3 : 2)), false);
    SB.setMode(2, SB.HARD);
    for (let i = 0; i < pix.length; i += 2) SB.stamp(b, pix[i], pix[i + 1], SB.roundBrush(2), 0);
    SB.setMode(0);
    pix = SB.pixelPath(path, false);
    for (let i = 0; i < pix.length; i += 2) SB.stamp(b, pix[i], pix[i + 1], SB.roundBrush(3), C.GRAPHITE);
    pix = SB.pixelPath(path.map((v, i) => v - (i % 2 ? 0 : 1)), true);
    for (let i = 0; i < pix.length; i += 2) SB.put(b, pix[i], pix[i + 1], hash(i, 3) < 0.15 ? C.PAPER : C.GRAPH_L);
  };

  // coffee ring: uneven dried edge, faint stain inside, a gap where the mug was lifted
  SB.coffeeRing = (b, cx, cy, r, seed) => {
    const N = 720;
    const gapA = hash(seed, 1) * Math.PI * 2;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const wob = Math.sin(a * 3 + hash(seed, 2) * 6) * 1.6 + Math.sin(a * 7 + hash(seed, 3) * 6) * 0.8;
      const d = Math.abs(((a - gapA + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const strength = SB.clamp01((Math.PI - d) / 0.9);
      const thick = 1 + Math.round(1.6 * (0.5 + 0.5 * Math.sin(a * 2 + seed)) * strength);
      const rr = r + wob;
      for (let k = 0; k < thick; k++) {
        const x = Math.round(SB.toS(cx + Math.cos(a) * (rr - k), cy + Math.sin(a) * (rr - k))[0]), y = Math.round(SB.toS(cx + Math.cos(a) * (rr - k), cy + Math.sin(a) * (rr - k))[1]);
        if (strength > 0.15 && hash(x, y, seed) < 0.25 + strength) SB.put(b, x, y, k === 0 ? C.COFFEE : C.COFFEE_L);
      }
      // stain bleeding inward
      if (hash(seed, i, 7) < 0.5 * strength) {
        const k = 3 + Math.floor(hash(seed, i, 8) * 4);
        const p = SB.toS(cx + Math.cos(a) * (rr - k), cy + Math.sin(a) * (rr - k));
        SB.put(b, Math.round(p[0]), Math.round(p[1]), C.COFFEE_L);
      }
    }
  };

  // sticky note in local coords (w x h), slight bottom curl
  SB.sticky = (b, pl, w, h, lifted) => {
    SB.dropShadow(b, pl, w, h, 3 + (lifted || 0) * 10, 5 + (lifted || 0) * 12, SB.SOFT);
    SB.fillPoly(b, quad(pl, w, h), C.STICKY);
    const band = [...pl.xf(0, h * 0.86), ...pl.xf(w, h * 0.83), ...pl.xf(w, h), ...pl.xf(0, h)];
    SB.fillPoly(b, band, C.STICKY_D);
    SB.printLine(b, pl, 0, 0, w, 0, C.STICKY_D, 0.5);
  };

  // little helper: pre-existing page number in the top-right corner (graphite, circled), boils like all ink
  SB.pageNumber = (list, n, seed, tool) => {
    SB.write(list, String(n), { x: 902, y: 42, size: 13, hand: 'scrawl', tool: tool || 'pencil', t0: -5, seed: seed, handVisible: false });
    const ring = SB.ellipsePts(907, 35, 13, 11, 16, -0.2, -0.4);
    ring.push(ring[0] + 4, ring[1] - 3);
    list.push(SB.stroke(ring, { tool: tool || 'pencil', t0: -5, dur: 0.01, hand: false, seed: seed + 3 }));
  };
})();

/* sketchbook - page-native transitions, all pure in k (0..1) of the transition window:
   flip (page turns over the spiral), riffle (three fast flips), eraser (rubbed out), curl (corner peel into the flipbook),
   crumple (torn out at the spiral and balled up), sticky (a note slapped on, then peeled), drop (torn out, falls away). */
'use strict';
(function () {
  const SB = window.SB, C = SB.C, W = SB.W, H = SB.H, E = SB.ease, hash = SB.hash;
  const SOFT = SB.SOFT, PAPERLIKE = SB.PAPERLIKE;
  const TR = (SB.TRANS = {});

  // corner fold: `top` folds away from `corner` along `dir`, revealing `under`. f = fold distance in px.
  SB.cornerFold = (dst, top, under, k, o) => {
    o = o || {};
    const cx = o.corner ? o.corner[0] : W, cy = o.corner ? o.corner[1] : H;
    let dx = o.dir ? o.dir[0] : -1, dy = o.dir ? o.dir[1] : -0.62;
    const n = Math.hypot(dx, dy);
    dx /= n; dy /= n;
    const reach = Math.max((0 - cx) * dx + (0 - cy) * dy, (W - cx) * dx + (0 - cy) * dy, (0 - cx) * dx + (H - cy) * dy, (W - cx) * dx + (H - cy) * dy);
    const f = k * reach * 1.02;
    const bx0 = o.bounds ? o.bounds[0] : SB.PAGE_X, by0 = o.bounds ? o.bounds[1] : -200, bx1 = o.bounds ? o.bounds[2] : W, by1 = o.bounds ? o.bounds[3] : H;
    const back = o.back != null ? o.back : C.PAPER, crease = o.crease != null ? o.crease : C.SHADE;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, proj = (x - cx) * dx + (y - cy) * dy;
      if (proj < f) {
        const u = under[i];
        dst[i] = f - proj < 14 + 10 * k && PAPERLIKE[u] ? SOFT[u] : u;
        continue;
      }
      const d2 = 2 * (proj - f), px = x - d2 * dx, py = y - d2 * dy;
      const inside = px >= bx0 && px < bx1 && py >= by0 && py < by1;
      if (inside) {
        const edge = px - bx0 < 1.5 || bx1 - px < 1.5 || py - by0 < 1.5 || by1 - py < 1.5;
        const sx = Math.round(px), sy = Math.round(py);
        const ghost = sx >= 0 && sy >= 0 && sx < W && sy < H && !PAPERLIKE[top[sy * W + sx]];
        dst[i] = edge ? C.GRAPH_L : proj - f < 2.5 ? crease : proj - f < 16 ? o.backShade != null ? o.backShade : C.FIBRE : ghost ? (o.ghost != null ? o.ghost : C.FIBRE) : back;
      } else {
        const near = px >= bx0 - 5 && px < bx1 + 5 && py >= by0 - 5 && py < by1 + 7;
        const t = top[i];
        dst[i] = near && PAPERLIKE[t] ? SOFT[t] : t;
      }
    }
    return { f: f, tip: [cx + 2 * f * dx, cy + 2 * f * dy] };
  };

  // the thumb that works the flipbook corner
  SB.drawThumb = (b, frac, at) => {
    const bob = -5 * Math.sin(Math.PI * (frac || 0));
    const ox = at ? at[0] - 930 : 0, oy = at ? at[1] - 508 : 0;
    const f = (u, v) => [u + ox, v + bob + oy];
    const shape = SB.capsule(f, 932, 512, 1010, 566, 25);
    SB.setMode(2, SOFT);
    SB.fillPoly(b, shape.map((v, i) => v + (i % 2 ? 9 : 7)), 0);
    SB.setMode(0);
    SB.fillPoly(b, shape, C.COFFEE_L);
    SB.outline(b, shape, C.COFFEE);
    const nail = SB.capsule(f, 926, 507, 942, 518, 10);
    SB.fillPoly(b, nail, C.FIBRE);
    SB.outline(b, nail, C.COFFEE_L);
  };

  // jagged torn edge near the spiral (x of the tear at row y)
  const tearRows = {};
  const tearX = (y, seed) => {
    let row = tearRows[seed];
    if (!row) {
      row = tearRows[seed] = new Int16Array(H + 2);
      for (let i = 0; i < H + 2; i++) row[i] = 46 + Math.round(hash(Math.floor(i / 4), seed) * 5 + hash(Math.floor(i / 11), seed, 2) * 4);
    }
    return row[y < 0 ? 0 : y > H + 1 ? H + 1 : y];
  };
  // paper remnants left in the spiral after a page is torn out
  SB.tornStubs = (b, ys, seed) => {
    for (const y of ys) {
      const pts = [38, y - 11];
      for (let k = 0; k <= 6; k++) pts.push(48 + hash(k, y | 0, seed) * 9, y - 11 + k * 3.7);
      pts.push(38, y + 11);
      SB.fillPoly(b, pts, C.PAPER);
      SB.outline(b, pts, C.SHADE);
    }
  };

  // ---------- flip: the page turns over the spiral to the left ----------
  function flip(dst, A, B, k) {
    dst.set(B);
    const th = E.inOut(k) * (Math.PI / 2), c = Math.cos(th), s = Math.sin(th);
    if (c < 0.015) return;
    const x0 = 40;
    for (let y = 0; y < H; y++) {
      const yy = (y - H / 2) / (H / 2), span = (W - x0) * c * (1 + 0.05 * s * yy * yy), edge = x0 + span;
      for (let x = x0; x < Math.min(W, edge); x++) {
        const u = (x - x0) / span;
        const sx = Math.round(x0 + u * (W - x0)), sy = Math.round(270 + (y - 270) / (1 + 0.16 * s * u));
        if (sy < 0 || sy >= H || sx >= W) continue;
        const v = A[sy * W + sx];
        dst[y * W + x] = s > 0.6 && PAPERLIKE[v] ? SOFT[v] : v;
      }
      // the lifted edge and its shadow on the page below
      const ex = Math.floor(edge);
      if (ex >= 0 && ex < W) dst[y * W + ex] = C.GRAPH_L;
      const sw = Math.round(30 * s);
      for (let x = ex + 1; x < Math.min(W, ex + 1 + sw); x++) { const v = dst[y * W + x]; if (PAPERLIKE[v]) dst[y * W + x] = SOFT[v]; }
    }
  }
  TR.flip = (dst, A, B, k) => flip(dst, A, B, k);

  // ---------- riffle: three quick flips through blank pages to the graph section ----------
  const blank1 = SB.newBuf(), blank2 = SB.newBuf();
  TR.riffle = (dst, A, B, k) => {
    const segs = [[0, 0.42, A, blank1], [0.34, 0.7, blank1, blank2], [0.62, 1, blank2, B]];
    blank1.set(SB.stock('cartridge'));
    blank2.set(SB.stock('lined'));
    let j = 0;
    for (let i = 0; i < segs.length; i++) if (k >= segs[i][0]) j = i;
    const [a, z, top, under] = segs[j];
    flip(dst, top, under, SB.seg(k, a, z));
  };

  // ---------- eraser: three big rubbing passes, smeared edge, crumbs ----------
  const ERASE = [-90, 40, 1050, 196, -90, 330, 1050, 520];
  TR.eraser = (dst, A, B, k) => {
    const p = E.inOut(k), segs = (ERASE.length >> 1) - 1;
    const lens = [];
    let total = 0;
    for (let i = 0; i < segs; i++) { const l = Math.hypot(ERASE[2 * i + 2] - ERASE[2 * i], ERASE[2 * i + 3] - ERASE[2 * i + 1]); lens.push(l); total += l; }
    let want = p * total;
    const pts = [ERASE[0], ERASE[1]];
    let head = [ERASE[0], ERASE[1]], dir = [1, 0];
    for (let i = 0; i < segs && want > 0; i++) {
      const k2 = Math.min(1, want / lens[i]);
      const x = ERASE[2 * i] + (ERASE[2 * i + 2] - ERASE[2 * i]) * k2, y = ERASE[2 * i + 1] + (ERASE[2 * i + 3] - ERASE[2 * i + 1]) * k2;
      pts.push(x, y);
      head = [x, y];
      dir = [(ERASE[2 * i + 2] - ERASE[2 * i]) / lens[i], (ERASE[2 * i + 3] - ERASE[2 * i + 1]) / lens[i]];
      want -= lens[i];
    }
    const R = 118;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let dmin = 1e9;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2));
        const d = Math.hypot(x - ax - vx * t, y - ay - vy * t);
        if (d < dmin) dmin = d;
      }
      const i = y * W + x, rag = R + hash(Math.floor(x / 6), Math.floor(y / 6), 9) * 10;
      if (dmin < rag) dst[i] = B[i];
      else if (dmin < rag + 9 && hash(x, y, 4) < 0.42) dst[i] = PAPERLIKE[A[i]] ? C.GRAPH_L : C.GRAPHITE;
      else dst[i] = A[i];
    }
    // crumbs behind the eraser
    for (let c = 0; c < 26; c++) {
      const back = 30 + hash(c, 1) * 220, cx = head[0] - dir[0] * back + (hash(c, 2) - 0.5) * 150, cy = head[1] - dir[1] * back + (hash(c, 3) - 0.5) * 150;
      const r = hash(c, 4) < 0.5 ? 2 : 3;
      SB.fillPoly(dst, SB.ellipsePts(cx, cy, r + 1, r, 6, hash(c, 5) * 3), hash(c, 6) < 0.5 ? C.MARGIN : C.GRAPH_L);
    }
    if (k < 0.995) {
      // the eraser block, held along its travel direction
      const a = Math.atan2(dir[1], dir[0]) * 0.25 - 0.35;
      const pl = SB.placement(head[0], head[1], (a * 180) / Math.PI, 1);
      const q = (u0, v0, u1, v1) => [...pl.xf(u0, v0), ...pl.xf(u1, v0), ...pl.xf(u1, v1), ...pl.xf(u0, v1)];
      SB.setMode(2, SOFT);
      SB.fillPoly(dst, q(-56, -26, 64, 34).map((v, i) => v + (i % 2 ? 10 : 8)), 0);
      SB.setMode(0);
      SB.fillPoly(dst, q(-56, -26, 64, 30), C.MARGIN);
      SB.fillPoly(dst, q(-56, 18, 64, 30), C.COFFEE_L);
      SB.fillPoly(dst, q(-10, -26, 64, 30), C.SKY);
      SB.fillPoly(dst, q(-10, 18, 64, 30), C.BIC_L);
      SB.outline(dst, q(-56, -26, 64, 30), C.INK);
      SB.printLine(dst, pl, -10, -26, -10, 30, C.INK);
      SB.printLine(dst, pl, -50, -20, -18, -20, C.PAPER, 0.4);
      const fing = SB.capsule((u, v) => pl.xf(u, v), 10, -40, 56, -36, 13);
      SB.fillPoly(dst, fing, C.COFFEE_L);
      SB.outline(dst, fing, C.COFFEE);
    }
  };

  // ---------- curl: the corner peels under a thumb, the flipbook begins ----------
  TR.curl = (dst, A, B, k) => {
    const r = SB.cornerFold(dst, A, B, E.in(k) * 1.0);
    if (r.f < 340) SB.drawThumb(dst, 0, [Math.max(r.tip[0], 870), Math.max(r.tip[1], 470)]);
  };

  // ---------- crumple: torn out at the spiral, balled up, tossed ----------
  TR.crumple = (dst, A, B, k) => {
    dst.set(B);
    const p1 = SB.seg(k, 0, 0.3), q = SB.seg(k, 0.3, 1);
    const rot = (-4 * E.out(p1) * Math.PI) / 180, lx = 16 * E.out(p1), ly = 22 * E.out(p1);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const PCX = 503, PCY = 270, HX = 457, HY = 272;
    const fs = SB.fsin, fc = SB.fcos;
    if (q <= 0) {
      // tear-off lift only: an affine map, cheap
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ux = x - lx - 500, uy = y - ly - 290;
        const sx = Math.round(ux * cr + uy * sr + 500), sy = Math.round(-ux * sr + uy * cr + 290);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const tx = tearX(sy, 13);
        if (sx < tx) continue;
        dst[y * W + x] = sx < tx + 2 ? C.SHADE : A[sy * W + sx];
      }
      return;
    }
    const m = E.inOut(q), s0 = 1 - 0.18 * q;
    const a = E.inOut(SB.seg(q, 0, 0.7)), b2 = E.in(SB.seg(q, 0.7, 1));
    const ccx = SB.lerp(PCX + lx, 720, a) + 190 * b2, ccy = SB.lerp(PCY + ly, 380, a) + 330 * b2 - 70 * Math.sin(Math.PI * b2);
    // per-angle radius of the ball outline (page rectangle morphing into a lumpy ball)
    const NB = 720, RB = new Float32Array(NB);
    let rmax = 0;
    for (let i = 0; i < NB; i++) {
      const th = (i / NB) * Math.PI * 2 - Math.PI, c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
      const ext = Math.min(HX / Math.max(1e-6, c), HY / Math.max(1e-6, s));
      const blob = 62 * (1 + 0.2 * Math.sin(th * 5 + 1) + 0.1 * Math.sin(th * 9 + 4));
      RB[i] = SB.lerp(ext * s0, blob, m);
      if (RB[i] > rmax) rmax = RB[i];
    }
    const y0 = Math.max(0, Math.floor(ccy - rmax)), y1 = Math.min(H, Math.ceil(ccy + rmax)), x0 = Math.max(0, Math.floor(ccx - rmax)), x1 = Math.min(W, Math.ceil(ccx + rmax));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const dx = x - ccx, dy = y - ccy, r = Math.sqrt(dx * dx + dy * dy), th = SB.fatan2(dy, dx);
      const rho = r / RB[((((th + Math.PI) / (Math.PI * 2)) * NB) | 0) % NB];
      if (rho > 1) continue;
      const ths = th + m * 0.7 * fs(rho * 7 + th * 2);
      const cs = fc(ths), sn = fs(ths), acs = Math.abs(cs), asn = Math.abs(sn);
      const e2 = Math.min(HX / Math.max(1e-6, acs), HY / Math.max(1e-6, asn)) * rho;
      // lifted page coords -> original page coords (undo the tear-off lift)
      const lx2 = PCX + cs * e2 - lx - 500, ly2 = PCY + sn * e2 - ly - 290;
      const sx = Math.round(lx2 * cr + ly2 * sr + 500), sy = Math.round(-lx2 * sr + ly2 * cr + 290);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const tx = tearX(sy, 13);
      if (sx < tx) continue;
      let v = sx < tx + 2 || rho > 0.985 ? C.SHADE : A[sy * W + sx];
      if (m > 0.12) {
        const crease = Math.abs(fs(th * 4 + rho * 9 + fs(th * 7) * 2));
        if (crease < 0.07 * m) v = C.GRAPH_L;
        else if (PAPERLIKE[v] && fs(th * 6 + rho * 11) * 0.5 + 0.5 < m * 0.5) v = SOFT[v];
      }
      dst[y * W + x] = v;
    }
  };

  // ---------- sticky: a note slaps onto the page ("1582"), the view pushes in to read it, it peels off ----------
  const stickyMarks = [];
  SB.write(stickyMarks, '1582', { x: 196, y: 312, size: 150, hand: 'marker', tool: 'marker', len: 17, thick: 5, deg: -42, seed: 551, rot: -4, t0: -5, t1: -4.9, handVisible: false, bfps: 10 });
  stickyMarks.push(SB.stroke([206, 340, 380, 347, 552, 334], { tool: 'marker', len: 10, thick: 3, deg: -42, t0: -5, dur: 0.01, hand: false, seed: 552 }));
  const stickyBuf = SB.newBuf();
  const SW = 680, SH = 392;
  function drawSticky(b, pl, lift, kk) {
    SB.sticky(b, pl, SW, SH, lift);
    SB.drawMarks(b, stickyMarks, kk, (x, y) => pl.xf(x - (W - SW) / 2, y - (H - SH) / 2));
  }
  TR.sticky = (dst, A, B, k) => {
    const a = SB.seg(k, 0, 0.18), land = SB.seg(k, 0.18, 0.34), push = E.inOut(SB.seg(k, 0.36, 0.56)), peel = SB.seg(k, 0.6, 1);
    const z = 1 + 0.47 * push;
    const e = E.in(a);
    const sc = (a < 1 ? 1.3 - 0.3 * e : 1 + 0.025 * Math.sin(land * Math.PI * 2) * (1 - land)) * z;
    const deg = -1.2 + (1 - e) * 8;
    const pl = SB.placement(W / 2 + (1 - e) * 300 - (SW / 2) * sc * Math.cos((deg * Math.PI) / 180) + (SH / 2) * sc * Math.sin((deg * Math.PI) / 180), H / 2 - (1 - e) * 240 - (SW / 2) * sc * Math.sin((deg * Math.PI) / 180) - (SH / 2) * sc * Math.cos((deg * Math.PI) / 180), deg, sc);
    const target = peel > 0 ? stickyBuf : dst;
    // the page under the note, pushed in with the view
    if (z === 1) target.set(A);
    else for (let y = 0; y < H; y++) { const sy = Math.round(H / 2 + (y - H / 2) / z); for (let x = 0; x < W; x++) target[y * W + x] = A[sy * W + Math.round(W / 2 + (x - W / 2) / z)]; }
    drawSticky(target, pl, a < 1 ? 1 - e : 0, k * 2);
    if (peel > 0) SB.cornerFold(dst, stickyBuf, B, E.inOut(peel), { corner: [0, H], dir: [1, -0.55], back: C.STICKY_D, backShade: C.STICKY, crease: C.KRAFT, ghost: C.STICKY_D, bounds: [-60, -60, W + 60, H + 60] });
  };

  // ---------- drop: torn out at the spiral, the page falls away ----------
  TR.drop = (dst, A, B, k) => {
    dst.set(B);
    const e = E.in(k), lift = E.out(SB.seg(k, 0, 0.25));
    const rot = ((5 * e + 1.5 * lift) * Math.PI) / 180, tx = 30 * e + 6 * lift, ty = 640 * e + 10 * lift;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const px0 = W, py0 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ux = x - tx - px0, uy = y - ty - py0;
      const sx = Math.round(ux * cr + uy * sr + px0), sy = Math.round(-ux * sr + uy * cr + py0);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) {
        // shadow of the falling page on the page below
        continue;
      }
      const tx2 = tearX(sy, 29);
      if (sx < tx2) continue;
      dst[y * W + x] = sx < tx2 + 2 ? C.SHADE : A[sy * W + sx];
    }
  };
})();

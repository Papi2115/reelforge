/* sketchbook - ink: timed marks (strokes and pencil fills) that draw themselves, line boil, tools, and the hand
   holding the current pen. Everything is a function of the shot-local time t. */
'use strict';
(function () {
  const SB = window.SB, C = SB.C, E = SB.ease, hash = SB.hash;

  const TOOLS = {
    felt: { col: C.INK, w: 2, kind: 'round', pen: 'felt', speed: 520 },
    fine: { col: C.INK, w: 1, kind: 'round', pen: 'felt', speed: 420 },
    bic: { col: C.BIC, w: 1, kind: 'bic', pen: 'bic', speed: 300 },
    red: { col: C.RED, w: 2, kind: 'round', pen: 'red', speed: 560 },
    marker: { col: C.INK, kind: 'chisel', len: 10, deg: -40, thick: 2, pen: 'marker', speed: 1300 },
    pencil: { col: C.GRAPHITE, w: 1, kind: 'pencil', pen: 'pencil', speed: 380 },
    cpencil: { col: C.ORANGE, w: 2, kind: 'cpencil', pen: 'cpencil', speed: 600 },
    hi: { col: C.HILITE, kind: 'chisel', len: 17, deg: 90, thick: 4, mode: 1, pen: 'hi', speed: 700 },
  };
  SB.TOOLS = TOOLS;

  // ---- building marks ----
  let autoSeed = 1;
  SB.stroke = (pts, o) => {
    const tool = TOOLS[o.tool || 'felt'];
    return {
      type: 'stroke', pts: pts, corners: o.corners || null, fn: o.fn || null, tool: o.tool || 'felt',
      col: o.col != null ? o.col : tool.col, w: o.w || tool.w || 1, len: o.len || tool.len, deg: o.deg != null ? o.deg : tool.deg, thick: o.thick || tool.thick,
      t0: o.t0 || 0, dur: o.dur != null ? o.dur : Math.max(0.04, SB.polyLen(pts || [0, 0]) / (o.speed || tool.speed)),
      seed: o.seed != null ? o.seed : autoSeed++ * 7919, boil: o.boil != null ? o.boil : 1, bfps: o.bfps || 10,
      hand: o.hand !== false, smooth: o.smooth !== false, ease: o.ease || 'hand', pen: o.pen || tool.pen, layer: o.layer || 0,
    };
  };
  SB.fill = (poly, o) => ({
    type: 'fill', poly: poly, polyFn: o.polyFn || null, col: o.col, t0: o.t0 || 0, dur: o.dur != null ? o.dur : 0.4, seed: o.seed != null ? o.seed : autoSeed++ * 7919,
    sp: o.sp || 3, dir: o.dir || 1, hand: o.hand !== false, pen: o.pen || 'cpencil', tool: 'cpencil', layer: o.layer || 0, dense: o.dense || 0,
  });
  // squeeze/stretch the timing of marks list[from..] into [t0, t1] (choreography budgets)
  SB.fitMarks = (list, from, t0, t1) => {
    let a = Infinity, z = -Infinity;
    for (let i = from; i < list.length; i++) { a = Math.min(a, list[i].t0); z = Math.max(z, list[i].t0 + list[i].dur); }
    if (!(z > a)) return t1;
    const k = (t1 - t0) / (z - a);
    for (let i = from; i < list.length; i++) { list[i].t0 = t0 + (list[i].t0 - a) * k; list[i].dur *= k; }
    return t1;
  };
  // write text as timed strokes; returns the end time. o: layout opts + {tool, t0, speed, col, w, boil, bfps, hand, layer}
  SB.write = (list, str, o) => {
    const lay = SB.layoutText(str, o), tool = TOOLS[o.tool || 'felt'], from = list.length;
    const speed = o.speed || tool.speed * (o.hand === 'marker' ? 1 : 0.55);
    let t = o.t0 || 0, lastCi = -1;
    const seed = (o.seed | 0) * 131 + 17, gk = o.gapK != null ? o.gapK : 1;
    for (let i = 0; i < lay.strokes.length; i++) {
      const s = lay.strokes[i];
      if (lastCi >= 0 && s.ci !== lastCi) {
        const wordGap = str.slice(lastCi + 1, s.ci).indexOf(' ') >= 0;
        t += (wordGap ? SB.rnd(0.09, 0.22, seed, i, 1) : SB.rnd(0.015, 0.07, seed, i, 2)) * gk;
      } else if (lastCi >= 0) t += SB.rnd(0.01, 0.045, seed, i, 3) * gk;
      const len = SB.polyLen(s.pts);
      const dur = Math.max(0.035, (len / speed) * SB.rnd(0.85, 1.2, seed, i, 4));
      list.push(SB.stroke(s.pts, { tool: o.tool, corners: s.corners, t0: t, dur: dur, seed: seed + i * 13, col: o.col, w: o.w,
        boil: o.boil, bfps: o.bfps, hand: o.handVisible, layer: o.layer, len: o.len, deg: o.deg, thick: o.thick }));
      t += dur;
      lastCi = s.ci;
    }
    return o.t1 != null ? SB.fitMarks(list, from, o.t0 || 0, o.t1) : t;
  };

  // ---- rendering ----
  function boilPts(m, src, bf, xf) {
    const out = new Array(src.length);
    const p = 0.24 * m.boil;
    for (let i = 0; i < src.length; i += 2) {
      let dx = 0, dy = 0;
      if (p > 0) {
        const hx = hash(m.seed, i, bf, 1), hy = hash(m.seed, i, bf, 2);
        dx = hx < p ? -1 : hx > 1 - p ? 1 : 0;
        dy = hy < p ? -1 : hy > 1 - p ? 1 : 0;
      }
      const s = xf(src[i] + dx, src[i + 1] + dy);
      out[i] = s[0];
      out[i + 1] = s[1];
    }
    return out;
  }
  function markSource(m, t) {
    if (!m.fn) return { pts: m.pts, corners: m.corners };
    const r = m.fn(Math.floor(t * 12 + 1e-6) / 12); // drawn animation steps on twelves
    return r.pts ? r : { pts: r, corners: m.corners };
  }

  function rasterStroke(b, pts, m, complete, started) {
    const T = TOOLS[m.tool], col = m.col;
    if (T.mode === 1) SB.setMode(1);
    if (T.kind === 'chisel') {
      const brush = SB.chiselBrush(m.len, m.deg, m.thick);
      const pix = SB.pixelPath(pts, false);
      for (let i = 0; i < pix.length; i += 2) SB.stamp(b, pix[i], pix[i + 1], brush, col);
      if (m.tool === 'marker' && pix.length) {
        const blot = SB.roundBrush(Math.max(3, Math.round(m.len * 0.34)));
        if (started && hash(m.seed, 78) < 0.5) SB.stamp(b, pix[0], pix[1], blot, col);
        if (complete && hash(m.seed, 77) < 0.35) SB.stamp(b, pix[pix.length - 2], pix[pix.length - 1], blot, col);
      }
    } else if (T.kind === 'round') {
      const brush = SB.roundBrush(m.w);
      const pix = SB.pixelPath(pts, m.w === 1);
      for (let i = 0; i < pix.length; i += 2) SB.stamp(b, pix[i], pix[i + 1], brush, col);
    } else if (T.kind === 'bic') {
      const pix = SB.pixelPath(pts, m.w === 1), brush = SB.roundBrush(m.w);
      for (let i = 0; i < pix.length; i += 2) {
        if (i > 8 && hash(m.seed, (i / 14) | 0, 5) < 0.07 && (i / 2) % 7 < 2) continue; // ballpoint skip
        SB.stamp(b, pix[i], pix[i + 1], brush, col);
      }
      if (complete && pix.length > 8 && hash(m.seed, 9) < 0.35) SB.stamp(b, pix[pix.length - 2], pix[pix.length - 1], SB.roundBrush(2), col);
    } else if (T.kind === 'pencil' || T.kind === 'cpencil') {
      const pix = SB.pixelPath(pts, m.w === 1);
      const brush = SB.roundBrush(m.w);
      for (let i = 0; i < pix.length; i += 2) {
        const x = pix[i], y = pix[i + 1];
        for (let k = 0; k < brush.length; k += 2) {
          const px = x + brush[k], py = y + brush[k + 1], h = hash(px, py, m.seed & 255);
          if (h < 0.14) continue;
          SB.put(b, px, py, T.kind === 'pencil' && m.col === C.GRAPHITE && h < 0.32 ? C.GRAPH_L : col);
        }
      }
    }
    SB.setMode(0);
  }

  // pencil hatch fill, revealed along the hatch sweep. Returns the scribbling tip while active.
  function drawFill(b, m, t, xf) {
    if (t < m.t0) return null;
    const p = m.dur > 0 ? SB.clamp01((t - m.t0) / m.dur) : 1;
    const poly = SB.xformPts(m.polyFn ? m.polyFn(Math.floor(t * 12 + 1e-6) / 12) : m.poly, xf);
    let s0 = Infinity, s1 = -Infinity;
    for (let i = 0; i < poly.length; i += 2) { const s = poly[i] + poly[i + 1] * m.dir; if (s < s0) s0 = s; if (s > s1) s1 = s; }
    const front = s0 + (s1 - s0 + 4) * E.hand(p);
    const sp = m.sp, seed = m.seed, dir = m.dir;
    SB.fillPoly(b, poly, (x, y) => {
      const L = x + y * dir;
      const line = Math.floor(L / sp);
      if (L > front + hash(seed, line, 3) * 5) return -1;
      const along = x - y * dir, chunk = Math.floor((along + hash(seed, line, 4) * 9) / 9);
      const off = hash(seed, line, chunk) < 0.33 ? 1 : 0;
      if ((((L + off) % sp) + sp) % sp !== 0) return m.dense && hash(x, y, seed) < 0.18 ? m.col : -1;
      if (hash(seed, line, chunk, 9) < 0.12) return -1;
      return m.col;
    });
    if (p >= 1) return null;
    // tip: oscillate along the current hatch line inside the shape
    let vmin = Infinity, vmax = -Infinity;
    const n = poly.length >> 1;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = poly[2 * i], ay = poly[2 * i + 1], bx = poly[2 * j], by = poly[2 * j + 1];
      const sa = ax + ay * dir, sb = bx + by * dir;
      if ((sa > front) !== (sb > front)) {
        const k = (front - sa) / (sb - sa), x = ax + (bx - ax) * k, y = ay + (by - ay) * k, v = x - y * dir;
        if (v < vmin) vmin = v;
        if (v > vmax) vmax = v;
      }
    }
    if (vmin === Infinity) return null;
    const v = vmin + (vmax - vmin) * (0.5 + 0.5 * Math.sin(t * Math.PI * 9));
    return [(front + v) / 2, dir * (front - v) / 2];
  }

  // draw a list of marks at time t. Returns the active hand mark tip (latest started) or null.
  SB.drawMarks = (b, list, t, xf, layer) => {
    xf = xf || SB.toS;
    let active = null;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (layer != null && m.layer !== layer) continue;
      if (t < m.t0) continue;
      if (m.type === 'fill') {
        const tip = drawFill(b, m, t, xf);
        if (tip && m.hand && (!active || m.t0 >= active.m.t0)) active = { m: m, tip: tip };
        continue;
      }
      const p = m.dur > 0 ? SB.clamp01((t - m.t0) / m.dur) : 1;
      const src = markSource(m, t);
      const bf = Math.floor(t * m.bfps + 1e-6);
      const sp = boilPts(m, src.pts, bf, xf);
      const path = m.smooth ? SB.smoothPath(sp, src.corners, 2.5) : sp;
      const ep = m.ease === 'lin' ? p : E[m.ease](p);
      const pre = SB.prefix(path, ep);
      rasterStroke(b, pre.pts, m, p >= 1, true);
      if (p < 1 && m.hand && (!active || m.t0 >= active.m.t0)) active = { m: m, tip: pre.tip };
    }
    return active;
  };

  // ---- the hand ----
  function ends(m, xf) {
    if (m._ends) return m._ends;
    let a, z;
    if (m.type === 'fill') {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const pp = m.polyFn ? m.polyFn(m.t0) : m.poly;
      for (let i = 0; i < pp.length; i += 2) { x0 = Math.min(x0, pp[i]); x1 = Math.max(x1, pp[i]); y0 = Math.min(y0, pp[i + 1]); y1 = Math.max(y1, pp[i + 1]); }
      a = [x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.2];
      z = [x0 + (x1 - x0) * 0.8, y0 + (y1 - y0) * 0.8];
    } else {
      const s0 = m.fn ? markSource(m, m.t0) : m, s1 = m.fn ? markSource(m, m.t0 + m.dur) : m;
      a = [s0.pts[0], s0.pts[1]];
      z = [s1.pts[s1.pts.length - 2], s1.pts[s1.pts.length - 1]];
    }
    m._ends = [a, z];
    return m._ends;
  }
  const OFF = (p) => [p[0] + 330, p[1] + 400];
  // pen state from the hand marks of a list: where the tip is, which pen, how high it hovers
  SB.penState = (list, t, active, xf) => {
    xf = xf || SB.toS;
    if (!list._hm) list._hm = list.filter((m) => m.hand).sort((a, b) => a.t0 - b.t0);
    const hm = list._hm;
    if (!hm.length) return null;
    const S = (p) => xf(p[0], p[1]);
    if (active) return { x: active.tip[0], y: active.tip[1], pen: active.m.pen, col: active.m.col, lift: 0 };
    let i = -1;
    for (let k = 0; k < hm.length; k++) if (hm[k].t0 <= t) i = k;
    const ENTER = 0.42, EXIT = 0.4, LONG = 1.5;
    const mk = (p, m, lift) => ({ x: p[0], y: p[1], pen: m.pen, col: m.col, lift: lift });
    const lerpP = (a, z, k) => [a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k];
    if (i < 0) {
      const n = hm[0], st = S(ends(n, xf)[0]);
      if (t < n.t0 - ENTER) return null;
      const k = E.out((t - (n.t0 - ENTER)) / ENTER);
      return mk(lerpP(OFF(st), st, k), n, 1 - k);
    }
    const cur = hm[i], endT = cur.t0 + cur.dur, end = S(ends(cur, xf)[1]);
    if (t < endT) return mk(end, cur, 0);
    const nxt = hm[i + 1];
    const leave = () => {
      const k = (t - endT - 0.15) / EXIT;
      if (k < 0) return mk(end, cur, E.out(SB.clamp01((t - endT) / 0.15)) * 0.6);
      if (k >= 1) return null;
      return mk(lerpP(end, OFF(end), E.in(k)), cur, 0.6 + k);
    };
    if (!nxt) return leave();
    const gap = nxt.t0 - endT, st = S(ends(nxt, xf)[0]);
    if (gap > LONG) {
      if (t >= nxt.t0 - ENTER) { const k = E.out((t - (nxt.t0 - ENTER)) / ENTER); return mk(lerpP(OFF(st), st, k), nxt, 1 - k); }
      return leave();
    }
    if (cur.pen !== nxt.pen) {
      const k = (t - endT) / gap;
      if (k < 0.5) return mk(lerpP(end, OFF(end), E.in(k * 2)), cur, 0.5 + k);
      return mk(lerpP(OFF(st), st, E.out((k - 0.5) * 2)), nxt, 1 - (k - 0.5) * 2);
    }
    const k = (t - endT) / gap;
    return mk(lerpP(end, st, E.inOut(k)), nxt, Math.sin(Math.PI * k) * Math.min(1, gap * 2.5));
  };

  const PENS = {
    felt: { tip: C.INK, tipLen: 5, cone: C.GRAPH_L, coneLen: 17, bw: 4.5, body: C.INK, hi: C.GRAPHITE, band: C.GRAPH_L },
    red: { tip: C.RED, tipLen: 5, cone: C.GRAPH_L, coneLen: 17, bw: 4.5, body: C.RED, hi: C.MARGIN, band: C.INK },
    bic: { tip: C.BIC, tipLen: 3, cone: C.GRAPH_L, coneLen: 15, bw: 4, body: C.FIBRE, hi: C.PAPER, band: C.BIC, tube: C.BIC_L },
    pencil: { tip: C.GRAPHITE, tipLen: 5, cone: C.KRAFT, coneLen: 15, bw: 4.5, body: C.STICKY, hi: C.STICKY_D, band: C.GRAPH_L },
    cpencil: { tip: -1, tipLen: 5, cone: C.KRAFT, coneLen: 15, bw: 4.5, body: -1, hi: C.PAPER, band: -1 },
    marker: { tip: C.INK, tipLen: 7, cone: C.GRAPH_L, coneLen: 20, bw: 8, body: C.PAPER, hi: C.FIBRE, band: C.INK, chisel: 1 },
    hi: { tip: C.HILITE, tipLen: 7, cone: C.STICKY_D, coneLen: 18, bw: 8, body: C.HILITE, hi: C.PAPER, band: C.GRAPHITE, chisel: 1 },
  };
  function capsule(f, u0, v0, u1, v1, r) {
    const out = [], du = u1 - u0, dv = v1 - v0, L = Math.hypot(du, dv), au = du / L, av = dv / L;
    for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI; const c = Math.cos(a), s = Math.sin(a); out.push(...f(u0 + (au * c - av * s) * r, v0 + (av * c + au * s) * r)); }
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI; const c = Math.cos(a), s = Math.sin(a); out.push(...f(u1 + (au * c - av * s) * r, v1 + (av * c + au * s) * r)); }
    return out;
  }
  function outline(b, poly, col) {
    const closed = poly.concat([poly[0], poly[1]]);
    const pix = SB.pixelPath(closed, true);
    for (let i = 0; i < pix.length; i += 2) SB.put(b, pix[i], pix[i + 1], col);
  }
  SB.outline = outline;
  SB.capsule = capsule;

  // draw the hand + pen at a screen tip position
  SB.drawPen = (b, st) => {
    if (!st || SB.noPen) return;
    const P = PENS[st.pen] || PENS.felt;
    const colTip = P.tip < 0 ? st.col : P.tip, colBody = P.body < 0 ? st.col : P.body, colBand = P.band < 0 ? C.INK : P.band;
    const ang = ((50 + (st.x / SB.W) * 14) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    const lift = st.lift || 0;
    const mkF = (ox, oy) => (u, v) => [st.x + ox + u * ca - v * sa, st.y + oy + u * sa + v * ca];
    const shapes = (f) => ({
      palm: capsule(f, 128, 26, 190, 30, 36),
      body: [...f(P.coneLen, -P.bw), ...f(250, -P.bw - 0.5), ...f(250, P.bw + 0.5), ...f(P.coneLen, P.bw)],
      cone: [...f(P.tipLen, -1.3), ...f(P.coneLen, -P.bw), ...f(P.coneLen, P.bw), ...f(P.tipLen, 1.3)],
      tip: P.chisel ? [...f(0, -2.5), ...f(P.tipLen, -2.5), ...f(P.tipLen, 2.5), ...f(1.5, 2.5)] : [...f(0, -0.6), ...f(P.tipLen, -1.4), ...f(P.tipLen, 1.4), ...f(0, 0.6)],
      thumb: capsule(f, 36, 11, 96, 27, 8),
      index: capsule(f, 28, -6, 104, -14, 7),
      middle: capsule(f, 46, 3, 118, 10, 6.5),
    });
    // shadow first (soft remap), offset grows with lift
    const so = 6 + 12 * lift;
    const sh = shapes(mkF(so, so * 1.1));
    SB.setMode(2, SB.SOFT);
    for (const k of ['palm', 'body', 'cone', 'thumb', 'index', 'middle']) SB.fillPoly(b, sh[k], C.PAPER);
    SB.setMode(0);
    const s = shapes(mkF(0, 0));
    SB.fillPoly(b, s.palm, C.COFFEE_L);
    outline(b, s.palm, C.COFFEE);
    SB.fillPoly(b, s.middle, C.COFFEE_L);
    outline(b, s.middle, C.COFFEE);
    SB.fillPoly(b, s.body, colBody);
    const f0 = mkF(0, 0);
    // highlight stripe + band (cap ring / ferrule) so each pen reads as itself
    const hl = [...f0(P.coneLen + 3, -P.bw + 1), ...f0(240, -P.bw + 1)];
    let pix = SB.pixelPath(hl, true);
    for (let i = 0; i < pix.length; i += 2) SB.put(b, pix[i], pix[i + 1], P.hi);
    if (P.tube) { pix = SB.pixelPath([...f0(P.coneLen + 2, 0.5), ...f0(240, 0.5)], true); for (let i = 0; i < pix.length; i += 2) SB.put(b, pix[i], pix[i + 1], P.tube); }
    SB.fillPoly(b, [...f0(150, -P.bw), ...f0(160, -P.bw), ...f0(160, P.bw), ...f0(150, P.bw)], colBand);
    outline(b, s.body, C.INK);
    SB.fillPoly(b, s.cone, P.cone);
    outline(b, s.cone, C.INK);
    SB.fillPoly(b, s.tip, colTip);
    SB.fillPoly(b, s.thumb, C.COFFEE_L);
    outline(b, s.thumb, C.COFFEE);
    SB.fillPoly(b, s.index, C.COFFEE_L);
    outline(b, s.index, C.COFFEE);
    // fingernail on the index tip
    const nail = SB.ellipsePts(0, 0, 3.6, 2.4, 10);
    const nf = [];
    for (let i = 0; i < nail.length; i += 2) nf.push(...f0(31 + nail[i], -9 + nail[i + 1]));
    SB.fillPoly(b, nf, C.FIBRE);
  };
})();

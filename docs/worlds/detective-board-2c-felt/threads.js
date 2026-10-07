/* detective-board 2c "felt" - the red thread. One main thread is laid by one needle from the first knot to the
 * parked needle at the end; theory threads fan out from the jump knot. A thread segment is couched onto the
 * linen: laid behind the needle, tacked down with small cream stitches, knotted at both ends. It can be tugged
 * (puckering the linen), unpicked (tacks pop, holes stay) or come loose. Pure functions of global time T. */
(function () {
  'use strict';
  const F = window.FELT;
  const C = F.C;
  const K = F.K;
  const E = F.ease;
  const TH = (F.TH = {});

  /** Catmull-Rom through control points, resampled every ~step world units; tacks laid out along it. */
  function build(def) {
    const cp = def.pts;
    const raw = [];
    for (let i = 0; i < cp.length - 1; i++) {
      const p0 = cp[Math.max(0, i - 1)];
      const p1 = cp[i];
      const p2 = cp[i + 1];
      const p3 = cp[Math.min(cp.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2.5));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        raw.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    raw.push(cp[cp.length - 1]);
    const n = raw.length;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    const arc = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = raw[i][0];
      ys[i] = raw[i][1];
      if (i) arc[i] = arc[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
    const total = arc[n - 1];
    const rnd = F.prng(def.seed || 7);
    const tacks = [];
    if (def.tack) {
      for (let s = def.tack * (0.45 + rnd() * 0.3); s < total - 6; s += def.tack * (0.75 + rnd() * 0.5)) {
        tacks.push({ s, ang: (rnd() - 0.5) * 0.5, len: 1.7 + rnd() * 0.7, off: (rnd() - 0.5) * 0.8, pop: rnd() });
      }
    }
    return Object.assign({}, def, { xs, ys, arc, total, tacks, n });
  }
  /** Point + unit tangent at arc length s. */
  function at(g, s) {
    const a = g.arc;
    let lo = 0;
    let hi = g.n - 1;
    if (s <= 0) lo = hi = 0;
    else if (s >= g.total) lo = hi = g.n - 1;
    else {
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (a[m] <= s) lo = m;
        else hi = m;
      }
    }
    const i = Math.min(lo, g.n - 2);
    const j = i + 1;
    const l = a[j] - a[i] || 1;
    const k = F.clamp((s - a[i]) / l, 0, 1);
    const dx = (g.xs[j] - g.xs[i]) / l;
    const dy = (g.ys[j] - g.ys[i]) / l;
    return [g.xs[i] + (g.xs[j] - g.xs[i]) * k, g.ys[i] + (g.ys[j] - g.ys[i]) * k, dx, dy];
  }
  TH.at = at;
  TH.build = build;

  /** Arc length laid at time T (needle pushes in small strokes: monotonic cadence on top of the ease). */
  TH.laid = function (g, T) {
    if (T < g.t0) return 0;
    let L = g.total;
    if (T < g.t1) {
      const p = F.prog(T, g.t0, g.t1);
      const n = Math.max(2, Math.round(g.total / 26));
      const q = p + (Math.sin(p * Math.PI * 2 * n) / (Math.PI * 2 * n)) * 0.55;
      L = g.total * (g.ease || E.inOutSine)(F.clamp01(q));
    }
    if (g.unpick && T > g.unpick.t0) L = F.lerp(g.total, g.total * g.unpick.to, E.out(F.prog(T, g.unpick.t0, g.unpick.t1)));
    return L;
  };
  TH.tension = (g, T) => (g.tug ? E.inOut(F.prog(T, g.tug.t0, g.tug.t1)) * (g.unpick && T > g.unpick.t0 ? 0 : 1) : 0);
  TH.looseness = (g, T) => (g.loosen ? E.out(F.prog(T, g.loosen.t0, g.loosen.t1 + 0.35)) : 0);

  /** Displaced point on the thread at arc s (slack behind the needle, tug straightening, loose waves). */
  function shapePoint(g, s, T, L, lastTack) {
    const p = at(g, s);
    let x = p[0];
    let y = p[1];
    const nx = -p[3];
    const ny = p[2];
    const down = ny >= 0 ? 1 : -1;
    // slack between the last tack and the needle
    const slack = g.slack ? g.slack(T) : T < g.t1 ? Math.min(6, (L - lastTack) * 0.16) : 0;
    if (slack && s > lastTack && L > lastTack) {
      const k = (s - lastTack) / (L - lastTack);
      x += nx * down * slack * Math.sin(Math.PI * k);
      y += ny * down * slack * Math.sin(Math.PI * k);
    }
    const loose = TH.looseness(g, T);
    if (loose > 0) {
      const env = Math.sin(Math.PI * F.clamp01(s / g.total));
      const w = Math.sin(s * 0.06 + g.seed) * 3.2 + Math.sin(s * 0.023 + g.seed * 2) * 2.4;
      x += nx * w * env * loose;
      y += ny * w * env * loose;
    }
    const ten = TH.tension(g, T);
    if (ten > 0 && s > g.tug.from) {
      const a = at(g, g.tug.from);
      const b = at(g, g.total);
      const k = (s - g.tug.from) / (g.total - g.tug.from);
      x = F.lerp(x, a[0] + (b[0] - a[0]) * k, ten);
      y = F.lerp(y, a[1] + (b[1] - a[1]) * k, ten);
    }
    return [x, y];
  }

  function lastTackBefore(g, L) {
    let s = 0;
    for (const t of g.tacks) if (t.s < L - 6) s = t.s;
    return s;
  }
  const HOLE = { c: C.LIN0, hi: C.LIN0, lo: C.NIGHT };
  const TACK = { c: C.CREAM_S, hi: C.CREAM, lo: C.LIN3 };
  const IMPRINT = { c: C.LIN1, hi: C.LIN1, lo: C.LIN1 };

  /** Draw one thread segment at time T. cols: thread colours. */
  TH.draw = function (g, T, cols) {
    if (T < g.t0) return;
    const L = TH.laid(g, T);
    const maxL = T >= g.t1 ? g.total : L;
    const z = F.cam.z;
    const loose = TH.looseness(g, T);
    // holes left by unpicked tacks and knots
    for (const t of g.tacks) {
      const popped = (t.s > L && t.s < maxL) || (g.loosen && T > g.loosen.t0 + (g.loosen.t1 - g.loosen.t0) * t.pop);
      if (!popped || z < 0.9) continue;
      const p = at(g, t.s);
      const a = t.ang;
      const ux = -p[3] * Math.cos(a) + p[2] * Math.sin(a);
      const uy = p[2] * Math.cos(a) + p[3] * Math.sin(a);
      F.knot(p[0] + ux * t.len, p[1] + uy * t.len, 0.7, HOLE, { shadow: 0, minR: 0.8, coil: false });
      F.knot(p[0] - ux * t.len, p[1] - uy * t.len, 0.7, HOLE, { shadow: 0, minR: 0.8, coil: false });
    }
    if (g.unpick && T > g.unpick.t0 && z >= 0.9) {
      // the linen remembers where the thread lay: a faint pressed line along the unpicked stretch
      const imp = [];
      for (let s = Math.max(L, g.total * g.unpick.to); s <= g.total; s += 3) {
        const q = at(g, s);
        imp.push(q[0] + 0.8, q[1] + 1);
      }
      if (imp.length > 3) F.stroke(imp, 0.3, IMPRINT, { minR: 0.5 });
      const e = at(g, g.total);
      F.knot(e[0] + 0.8, e[1] - 0.6, 0.55, HOLE, { shadow: 0, minR: 0.5, coil: false });
      F.knot(e[0] - 1.2, e[1] + 0.9, 0.45, HOLE, { shadow: 0, minR: 0.5, coil: false });
    }
    if (L <= 0.5) return;
    const lastTack = lastTackBefore(g, L);
    const step = Math.max(1.5, 2.5 / Math.max(z, 0.4));
    const pts = [];
    for (let s = 0; s < L; s += step) pts.push(...shapePoint(g, s, T, L, lastTack));
    pts.push(...shapePoint(g, L, T, L, lastTack));
    const r = g.r || 1.15;
    F.stroke(pts, r, cols, { twist: true, shadow: 1.6, minR: g.minR === undefined ? (cols === K.RED ? 1.2 : 0.8) : g.minR });
    // couching tacks
    if (g.tack && g.tack * z >= 8.5) {
      for (const t of g.tacks) {
        if (t.s > L - 5) break;
        if (g.loosen && T > g.loosen.t0 + (g.loosen.t1 - g.loosen.t0) * t.pop) continue;
        if (loose > 0.99) continue;
        const grow = F.clamp01((L - 5 - t.s) / 7);
        const sc = T < g.t1 ? E.outBack(grow) : 1;
        const p = shapePoint(g, t.s + t.off, T, L, lastTack);
        const tg = at(g, t.s);
        const a = t.ang + TH.tension(g, T) * 0.35;
        const ux = -tg[3] * Math.cos(a) + tg[2] * Math.sin(a);
        const uy = tg[2] * Math.cos(a) + tg[3] * Math.sin(a);
        const h = t.len * sc;
        F.stroke([p[0] - ux * h, p[1] - uy * h, p[0] + ux * h, p[1] + uy * h], 0.4, cols.tack || TACK, { minR: 0.5, shadow: 0.5 });
      }
    }
    // knots
    if (g.knotStart !== false) {
      const p = at(g, 0);
      const pop = g.knotStartAt !== undefined ? E.outBack(F.prog(T, g.knotStartAt, g.knotStartAt + 0.2)) : 1;
      if (pop > 0) F.knot(p[0], p[1], (g.bigStart ? 3.2 : 2.3) * pop, cols, { shadow: 1.2, minR: 1.2 * pop });
    }
    const unpicked = g.unpick && T > g.unpick.t0;
    if (g.loose && L >= g.total - 0.5) TH.fray(g, T, cols);
    else if (g.knotEnd !== false && T >= g.t1 && !unpicked) {
      const p = at(g, g.total);
      const pop = E.outBack(F.prog(T, g.t1, g.t1 + 0.2));
      const tens = TH.tension(g, T);
      F.knot(p[0], p[1], (g.bigEnd ? 3.4 : 2.4) * pop * (1 - 0.15 * tens), cols, { shadow: 1.2, minR: 1.3 * pop });
    }
    if (unpicked && L > 1) TH.fray(g, T, cols, L);
  };
  /** Frayed loose end: the plies split. */
  TH.fray = function (g, T, cols, Lend) {
    const s = Lend === undefined ? g.total : Lend;
    const p = at(g, s);
    const sway = g.loose ? Math.sin(T * 1.7 + g.seed) * 0.12 : 0;
    for (let k = -1; k <= 1; k++) {
      const a = Math.atan2(p[3], p[2]) + k * 0.32 + sway;
      const len = 5 + (k === 0 ? 2 : 0);
      F.stroke([p[0], p[1], p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len], 0.38, cols, { minR: 0.5, shadow: 0.8 });
    }
  };

  /**
   * Needle state for the segment list at T: {x, y, ang, vis, from} or null. Emerges before t0 at the start, rides
   * the laid end, dives into the end knot after t1. During tug/unpick it pulls back toward the start.
   */
  TH.needle = function (segs, T) {
    for (let i = segs.length - 1; i >= 0; i--) {
      const g = segs[i];
      const em = g.emerge === undefined ? 0.35 : g.emerge;
      if (T < g.t0 - em) continue;
      if (g.park && T >= g.t1) {
        const e = at(g, g.total);
        const dive = E.inOut(F.prog(T, g.t1, g.t1 + 0.5));
        return { x: e[0] + e[2] * 13, y: e[1] + e[3] * 13, ang: Math.atan2(e[3], e[2]), len: 26, from: 0, vis: 1 - 0.45 * dive };
      }
      if (T < g.t0) {
        const p = at(g, 0);
        const k = E.out(F.prog(T, g.t0 - em, g.t0));
        const ang = Math.atan2(p[3], p[2]);
        return { x: p[0] + p[2] * 26 * k, y: p[1] + p[3] * 26 * k, ang, len: 26, from: 1 - k, vis: 1 };
      }
      if (g.unpick && T >= g.tug.t0 - 0.3) {
        if (T > g.unpick.t1 + 0.35) return null;
        const L = TH.laid(g, T);
        const p = at(g, L);
        const ten = TH.tension(g, T);
        const back = Math.atan2(-p[3], -p[2]);
        const em2 = E.out(F.prog(T, g.tug.t0 - 0.3, g.tug.t0));
        const jerk = ten * 4 * (T < g.unpick.t0 ? 1 : 0);
        const ex = p[0] - p[2] * jerk;
        const ey = p[1] - p[3] * jerk;
        const dive = E.in(F.prog(T, g.unpick.t1, g.unpick.t1 + 0.35));
        return { x: ex + Math.cos(back) * 26 * em2, y: ey + Math.sin(back) * 26 * em2, ang: back, len: 26, from: 0, vis: Math.max(0.02, 1 - dive) };
      }
      if (T <= g.t1) {
        const L = TH.laid(g, T);
        const p = at(g, L);
        const bob = Math.sin(L * 0.24) * 0.6;
        return { x: p[0] + p[2] * 26 - p[3] * bob, y: p[1] + p[3] * 26 + p[2] * bob, ang: Math.atan2(p[3], p[2]), len: 26, from: 0, vis: 1 };
      }
      const dv = g.dive === undefined ? 0.32 : g.dive;
      if (T < g.t1 + dv) {
        const p = at(g, g.total);
        const k = E.in(F.prog(T, g.t1, g.t1 + dv));
        const ang = Math.atan2(p[3], p[2]);
        // tip goes into the linen at the knot: the eye end stays, the visible part shortens
        return { x: p[0] + p[2] * 26 * (1 - k), y: p[1] + p[3] * 26 * (1 - k), ang, len: 26, from: 0, vis: Math.max(0.02, 1 - k), sink: true, kx: p[0], ky: p[1] };
      }
      return null;
    }
    return null;
  };
  /** Draw needle state n (tip at x,y; visible portion from `from` to `vis` measured eye->tip). */
  TH.drawNeedle = function (n) {
    if (!n) return;
    if (n.sink) {
      // tip has entered at the knot (kx, ky): draw from eye to the knot only
      const ex = n.kx - Math.cos(n.ang) * 26 * n.vis;
      const ey = n.ky - Math.sin(n.ang) * 26 * n.vis;
      F.needleSpan(ex, ey, n.ang, 26, 0, n.vis);
      return;
    }
    const ex = n.x - Math.cos(n.ang) * n.len;
    const ey = n.y - Math.sin(n.ang) * n.len;
    F.needleSpan(ex, ey, n.ang, n.len, n.from, n.vis);
  };
  /** Eye position of a needle state (where the thread attaches). */
  TH.eye = function (n) {
    if (n.sink) return [n.kx - Math.cos(n.ang) * 26 * n.vis, n.ky - Math.sin(n.ang) * 26 * n.vis];
    return [n.x - Math.cos(n.ang) * n.len, n.y - Math.sin(n.ang) * n.len];
  };
})();

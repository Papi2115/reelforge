/* sketchbook v2 - shot 8 parts: the accordion strip (a long creased paper strip under a fixed view; the part already read
   bunches into a folded stack, in perspective, at the left), tape stuck on it, the left hand that drags it, and a pen
   controller that takes the pen out of the frame while the strip is dragged. Pure functions of the strip offset S and t. */
'use strict';
(function () {
  const SB = window.SB, C = SB.C, E = SB.ease, W = SB.W, H = SB.H, hash = SB.hash, SOFT = SB.SOFT;
  const MASK = new Uint8Array(W * H), STACK = new Uint8Array(W * H);

  // one soft shadow for a set of polygons (overlaps are not darkened twice)
  function softUnion(b, polys) {
    MASK.fill(0);
    for (const p of polys) SB.fillPoly(MASK, p, 1);
    for (let i = 0; i < MASK.length; i++) if (MASK[i]) b[i] = SOFT[b[i]];
  }
  function line(b, a, z, col, skip, seed) {
    const pix = SB.pixelPath([a[0], a[1], z[0], z[1]], true);
    for (let i = 0; i < pix.length; i += 2) if (!skip || hash(pix[i], pix[i + 1], seed || 5) > skip) SB.put(b, pix[i], pix[i + 1], col);
  }

  /* o: {u0, u1 (strip extent), sh (height), widths[] (panel widths, uneven on purpose), xs (screen x where the strip starts
     to fold), fold / foldMax (deg: a fresh fold, a deep pleat), zk (how high folded panels stand), lift ([x, y] screen shift per
     unit of height), y0, tilt (deg), pivot, seed}.
     u = strip coordinate (= screen x when S = 0), v = 0..sh across the strip. */
  SB.accStrip = (o) => {
    const SH = o.sh, XS = o.xs, A = (o.fold * Math.PI) / 180, Y0 = o.y0;
    const ta = (o.tilt * Math.PI) / 180, tc = Math.cos(ta), ts = Math.sin(ta), PX = o.pivot[0], PY = o.pivot[1];
    const c = [o.u0];
    for (let i = 0; c[c.length - 1] < o.u1; i++) {
      const nx = c[c.length - 1] + o.widths[i % o.widths.length];
      c.push(nx > o.u1 - 70 ? o.u1 : nx);
    }
    const n = c.length - 1;
    // the strip wanders a pixel or two at every crease; its edges kink there
    const wander = c.map((_, k) => SB.rnd(-1.6, 1.6, o.seed, k, 1));
    const kinkT = c.map((_, k) => SB.rnd(-0.9, 0.9, o.seed, k, 2)), kinkB = c.map((_, k) => SB.rnd(-0.9, 0.9, o.seed, k, 3));
    // crease positions for a strip offset S: x on screen, z height of the fold (odd creases are the peaks). A panel starts to
    // fold when its left crease passes XS and reaches the fold angle about one panel later; older pleats keep closing
    // toward foldMax, so the read part bunches into a tight stack instead of running off the page.
    const B = (o.foldMax * Math.PI) / 180;
    const angle = (f) => (f <= 1 ? A * E.sine(f) : A + (B - A) * (1 - Math.exp(-(f - 1) * 1.8)));
    const layout = (S) => {
      const x = new Float64Array(n + 1), z = new Float64Array(n + 1), cos = new Float64Array(n), rise = new Float64Array(n);
      let k0 = n;
      while (k0 > 0 && c[k0 - 1] - S >= XS) k0--;
      for (let k = k0; k <= n; k++) x[k] = c[k] - S;
      for (let k = k0; k < n; k++) cos[k] = 1;
      for (let k = k0 - 1; k >= 0; k--) {
        const w = c[k + 1] - c[k], th = angle((XS - (c[k] - S)) / (w * 0.85));
        cos[k] = Math.cos(th);
        x[k] = x[k + 1] - w * cos[k];
        rise[k] = o.zk * w * Math.sin(th);
      }
      for (let k = 1; k < n; k += 2) z[k] = Math.min(rise[k - 1], rise[k]);
      return { S: S, x: x, z: z, cos: cos };
    };
    const tilt = (px, py) => [PX + px * tc - py * ts, PY + px * ts + py * tc];
    // a point raised by z, seen from a little below the page: it lifts up (and a touch left); its shadow falls down-right
    const proj = (x, z, y) => tilt(x - o.lift[0] * z - PX, y - o.lift[1] * z - PY);
    const shade = (x, z, y) => tilt(x + 0.55 * z + 3 - PX, y + 0.3 * z + 5 - PY);
    const panelOf = (u) => { let k = 0; while (k < n - 1 && u >= c[k + 1]) k++; return k; };
    const mapper = (L) => (u, v) => {
      const k = panelOf(u), a = Math.max(0, Math.min(1, (u - c[k]) / (c[k + 1] - c[k])));
      return proj(L.x[k] + (L.x[k + 1] - L.x[k]) * a, L.z[k] + (L.z[k + 1] - L.z[k]) * a, Y0 + wander[k] + (wander[k + 1] - wander[k]) * a + v);
    };
    const corner = (L, k, bottom, fn) => fn(L.x[k], L.z[k], Y0 + wander[k] + (bottom ? SH + kinkB[k] : kinkT[k]));
    const quad = (L, k, fn) => [...corner(L, k, 0, fn), ...corner(L, k + 1, 0, fn), ...corner(L, k + 1, 1, fn), ...corner(L, k, 1, fn)];

    function face(b, L, k, kind) {
      const q = quad(L, k, proj), w = c[k + 1] - c[k];
      const xa = (q[0] + q[6]) / 2, xb = (q[2] + q[4]) / 2, ya = (q[1] + q[3]) / 2, span = xb - xa;
      // shade by the real slope of the face: rising to the right faces the light, falling faces darken as they close
      const fall = (L.z[k] - L.z[k + 1]) / (o.zk * w), dark = fall > 0.7 ? 2 : fall > 0.25 ? 1 : 0;
      const base = [C.PAPER, C.FIBRE, C.SHADE][dark], fib = [C.FIBRE, C.SHADE, C.FIBRE][dark];
      const band = kind === 'flat' && k % 2 === 1;
      SB.fillPoly(b, q, (x, y) => {
        const a = span > 0.5 ? (x - xa) / span : 0.5, u = c[k] + a * w;
        const f = SB.fibreAt(u + 413, y - ya + 300);
        let col = f === 1 ? fib : f === 2 ? C.SHADE : base;
        if (band && a * w < 2) col = C.FIBRE; // the old fold still catches the light a little
        if (kind === 'flat' && STACK[y * W + x]) col = SOFT[col];
        return col;
      });
      const p = (i) => [q[2 * i], q[2 * i + 1]];
      line(b, p(0), p(1), C.SHADE);
      line(b, p(3), p(2), C.SHADE);
      if (kind === 'flat') {
        if (k % 2 === 0 && k > 0) line(b, p(0), p(3), C.GRAPH_L, 0.45, k);
        if (k === n - 1) line(b, p(1), p(2), C.SHADE);
      } else {
        line(b, p(0), p(3), k % 2 === 1 ? C.PAPER : C.GRAPH_L);
        line(b, p(1), p(2), (k + 1) % 2 === 1 ? C.PAPER : C.GRAPH_L);
      }
    }

    // paints the strip; onFace(k) draws the marks of panel k right after its face (stack faces back to front, then all flat ones)
    const draw = (b, L, onFace) => {
      const flat = [], back = [], front = [];
      for (let k = 0; k < n; k++) {
        if (Math.max(L.x[k], L.x[k + 1]) < -40 || Math.min(L.x[k], L.x[k + 1]) > W + 40) continue;
        if (L.cos[k] > 0.985) flat.push(k);
        else if (L.z[k + 1] > L.z[k]) back.push(k);
        else front.push(k);
      }
      const stack = back.concat(front);
      const ground = (x, z, y) => shade(x, 0, y);
      softUnion(b, flat.concat(stack).map((k) => quad(L, k, shade)).concat(stack.map((k) => quad(L, k, ground))));
      STACK.fill(0);
      for (const k of stack) SB.fillPoly(STACK, quad(L, k, shade), 1);
      for (const k of stack) {
        face(b, L, k, back.indexOf(k) >= 0 ? 'back' : 'front');
        if (L.cos[k] > 0.33) onFace(k);
      }
      for (const k of flat) face(b, L, k, 'flat');
      for (const k of flat) onFace(k);
    };

    // clear tape stuck across the strip (follows its folds): centre (uc, vc), w x h, deg, torn ends
    const tape = (b, L, uc, vc, w, h, deg, seed) => {
      const xf = mapper(L), a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      const at = (s, t) => xf(uc + s * ca - t * sa, vc + s * sa + t * ca);
      const loop = [], top = [], bot = [];
      for (let i = 0; i <= 5; i++) loop.push(...at(-w / 2 + SB.rnd(-2.2, 2.2, seed, i, 1), -h / 2 + (i / 5) * h));
      for (let s = -w / 2 + 3; s < w / 2 - 2; s += 6) { const p = at(s, h / 2); loop.push(...p); bot.push(...p); }
      for (let i = 5; i >= 0; i--) loop.push(...at(w / 2 + SB.rnd(-2.2, 2.2, seed, i, 2), -h / 2 + (i / 5) * h));
      for (let s = w / 2 - 3; s > -w / 2 + 2; s -= 6) { const p = at(s, -h / 2); loop.push(...p); top.push(...p); }
      SB.setMode(2, SB.TAPE);
      SB.fillPoly(b, loop, 0);
      SB.setMode(0);
      for (const e of [top, bot]) for (let i = 0; i + 3 < e.length; i += 2) line(b, [e[i], e[i + 1]], [e[i + 2], e[i + 3]], C.SHADE, 0.35, seed);
    };

    return { creases: c, n: n, sh: SH, layout: layout, mapper: mapper, draw: draw, tape: tape, panelOf: panelOf };
  };

  // a graphite thumbprint left where a finger pressed: broken concentric ridges, mapped onto the strip
  SB.accThumbprint = (b, xf, u, v, deg, seed) => {
    const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (let r = 0; r < 5; r++) {
      const rx = 2.2 + r * 1.9, ry = 3 + r * 2.4, N = 10 + r * 6;
      for (let i = 0; i < N; i++) {
        if (hash(seed, r, i) < 0.3) continue;
        const t = (i / N) * Math.PI * 2, x = Math.cos(t) * rx, y = Math.sin(t) * ry;
        const p = xf(u + x * ca - y * sa, v + x * sa + y * ca);
        SB.put(b, Math.round(p[0]), Math.round(p[1]), r === 4 && hash(seed, i, 7) < 0.5 ? C.FIBRE : C.GRAPH_L);
      }
    }
  };

  // the left hand flat on the strip, two fingers pressing; F = fingertip (screen), lift 0 (pressing) .. 1 (in the air)
  SB.dragHand = (b, F, lift) => {
    if (!F || SB.noPen) return;
    const ang = (-62 * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
    const mk = (ox, oy) => (u, v) => [F[0] + ox + u * ca - v * sa, F[1] + oy + u * sa + v * ca];
    const parts = (f) => [
      SB.capsule(f, -142, 2, -480, 12, 29), // forearm
      SB.capsule(f, -76, -3, -122, 1, 33), // palm
      SB.capsule(f, -78, -24, -50, -27, 7), // ring finger, curled under
      SB.capsule(f, -100, 31, -56, 36, 8.5), // thumb
      SB.capsule(f, -72, -9, -8, -7, 7.5), // middle
      SB.capsule(f, -70, 8, -12, 9, 7), // index
    ];
    const so = 5 + 14 * (lift || 0);
    softUnion(b, parts(mk(so, so * 1.1)));
    const f0 = mk(0, 0);
    for (const p of parts(f0)) { SB.fillPoly(b, p, C.COFFEE_L); SB.outline(b, p, C.COFFEE); }
    for (const [u, v] of [[-13, -7], [-16, 9]]) {
      const nail = SB.ellipsePts(0, 0, 3.4, 2.5, 10), nf = [];
      for (let i = 0; i < nail.length; i += 2) nf.push(...f0(u + nail[i], v + nail[i + 1]));
      SB.fillPoly(b, nf, C.FIBRE);
    }
    // knuckle creases
    for (const v of [-9, 9]) { const a = f0(-44, v - 3), z = f0(-44, v + 3); line(b, a, z, C.COFFEE); }
  };

  /* pen over a strip that moves: hm = hand marks sorted by t0, mapAt(t) -> the strip mapping at time t, busy(a, z) -> true if
     the strip is dragged between a and z. Between marks the pen lifts, moves early and hovers (breathing) over the next spot;
     it leaves the frame for a drag or a change of pen. */
  SB.accPen = (hm, t, act, mapAt, busy) => {
    if (act) return { x: act.tip[0], y: act.tip[1], pen: act.m.pen, col: act.m.col, lift: 0 };
    const st = (p, m, lift) => ({ x: p[0], y: p[1], pen: m.pen, col: m.col, lift: lift });
    const first = (m) => mapAt(m.t0)(m.pts[0], m.pts[1]);
    const last = (m) => mapAt(m.t0 + m.dur)(m.pts[m.pts.length - 2], m.pts[m.pts.length - 1]);
    const off = (p) => [p[0] + 330, p[1] + 400];
    const lerp = (a, z, k) => [a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k];
    const enter = (m, k) => { const p = first(m), e = E.out(k); return st(lerp(off(p), p, e), m, 1 - e); };
    let i = -1;
    for (let k = 0; k < hm.length; k++) if (hm[k].t0 <= t) i = k;
    if (i < 0) { const k = SB.seg(t, hm[0].t0 - 0.4, hm[0].t0); return k > 0 ? enter(hm[0], k) : null; }
    const cur = hm[i], endT = cur.t0 + cur.dur, nxt = hm[i + 1];
    if (t < endT) return st(last(cur), cur, 0);
    const out = () => {
      const k = SB.seg(t, endT + 0.03, endT + 0.22), p = last(cur);
      if (k >= 1) return null;
      if (k <= 0) return st(p, cur, 0.4 * E.out(SB.seg(t, endT, endT + 0.03)));
      return st(lerp(p, off(p), E.in(k)), cur, 0.4 + k);
    };
    if (!nxt) return out();
    const gap = nxt.t0 - endT;
    if (busy(endT, nxt.t0) || nxt.pen !== cur.pen) {
      const k = SB.seg(t, nxt.t0 - Math.min(0.24, gap / 2), nxt.t0);
      return k > 0 ? enter(nxt, k) : out();
    }
    // lift off, travel early, then hover over the next spot (a held beat) and land
    const tr = Math.min(0.2, gap * 0.6), a = last(cur), z = first(nxt);
    const t0 = endT + Math.min(0.03, gap * 0.2), k = SB.seg(t, t0, t0 + tr), land = SB.seg(t, nxt.t0 - 0.07, nxt.t0);
    const p = lerp(a, z, E.inOut(k)), bob = k >= 1 ? Math.sin(t * 5.3) * 0.8 : 0;
    return st([p[0], p[1] + bob * (1 - land)], k > 0.5 ? nxt : cur, (0.35 + 0.3 * Math.sin(Math.PI * k)) * Math.min(1, gap * 4) * (1 - land));
  };
})();

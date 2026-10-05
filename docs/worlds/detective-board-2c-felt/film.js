/* detective-board 2c "felt" - one camera path over the one canvas, scene assembly and the magnifier.
 * F.render(T) draws global time T into the indexed framebuffer. Pure: no clocks, no randomness. */
(function () {
  'use strict';
  const F = window.FELT;
  const C = F.C;
  const K = F.K;
  const L = F.L;
  const A = F.A;
  const TH = F.TH;
  const E = F.ease;
  const BY = F.MAIN_BY;
  const THEORY = { c: C.CREAM, hi: C.WHITE, lo: C.CREAM_S, tack: { c: C.CREAM_S, hi: C.CREAM_S, lo: C.LIN3 } };

  // ---------------------------------------------------------------- camera
  const name = K.xf(L.ticket, -46, 33);
  const MOVES = [
    { hold: { x: name[0] + 1, y: name[1] + 4, z: 8 } },
    { t0: 6.05, t1: 8.9, to: { x: 520, y: 596, z: 2 }, ease: E.inOut },
    { t0: 14.0, t1: 16.0, follow: 's3', to: { x: 1012, y: 470, z: 2.5 }, dip: 0.28 },
    { t0: 17.2, t1: 18.45, to: { x: 1158, y: 440, z: 2 }, ease: E.inOut },
    { t0: 23.0, t1: 24.95, follow: 's6', to: { x: 1680, y: 486, z: 2 }, dip: 0.3 },
    { t0: 25.55, t1: 28.9, to: { x: 1720, y: 530, z: 2 }, ease: E.inOutSine },
    { t0: 32.0, t1: 33.0, to: { x: 1726, y: 532, z: 3.5 }, ease: E.inOut },
    { t0: 35.4, t1: 37.75, to: { x: 1700, y: 640, z: 1.25 }, ease: E.inOut },
    { t0: 39.5, t1: 41.75, follow: 's8', to: { x: 1040, y: 906, z: 2 }, dip: 0.25, ahead: 60 },
    { t0: 48.0, t1: 51.3, follow: 's9', to: { x: 1475, y: 1062, z: 2 }, dip: 0.08 },
    { t0: 56.0, t1: 57.75, follow: 's10', to: { x: 2006, y: 902, z: 3 }, dip: 0.2 },
    { t0: 59.45, t1: 63.3, to: { x: 1170, y: 642, z: 0.44 }, ease: E.inOut },
  ];
  F.camera = function (T) {
    let cur = MOVES[0].hold;
    for (let i = 1; i < MOVES.length; i++) {
      const m = MOVES[i];
      if (T < m.t0) break;
      if (T >= m.t1) {
        cur = m.to;
        continue;
      }
      const p = F.prog(T, m.t0, m.t1);
      const lz0 = Math.log(cur.z);
      const lz1 = Math.log(m.to.z);
      if (!m.follow) {
        const e = m.ease(p);
        return { x: F.lerp(cur.x, m.to.x, e), y: F.lerp(cur.y, m.to.y, e), z: Math.exp(F.lerp(lz0, lz1, e)) };
      }
      const g = BY[m.follow];
      const pt = TH.at(g, Math.min(g.total, TH.laid(g, T) + (m.ahead || 30)));
      const a = E.inOutSine(F.clamp01(p / 0.3));
      const b = E.inOutSine(F.clamp01((p - 0.6) / 0.4));
      const x = F.lerp(F.lerp(cur.x, pt[0], a), m.to.x, b);
      const y = F.lerp(F.lerp(cur.y, pt[1], a), m.to.y, b);
      const z = Math.exp(F.lerp(lz0, lz1, E.inOutSine(p))) * (1 - m.dip * Math.sin(Math.PI * p));
      return { x, y, z };
    }
    return cur;
  };

  // ---------------------------------------------------------------- moving parts
  /** Magnifier centre in world space. */
  function lensAt(T) {
    const rest = [L.lens.x, L.lens.y];
    if (T < 25.2) return rest;
    if (T < 25.6) {
      const k = Math.sin(F.prog(T, 25.2, 25.6) * Math.PI);
      return [rest[0] + 3 * k, rest[1] - 2.5 * k];
    }
    const target = K.xf(L.map, 70, 38);
    if (T < 28.9) {
      const p = E.inOutSine(F.prog(T, 25.6, 28.9));
      const f = 0.06 + 0.36 * p;
      const q = A.mapSouthAt(f);
      const w = K.xf(L.map, q[0] + 12, q[1]);
      const blend = E.out(F.clamp01(p / 0.25));
      const settle = F.twang(T - 28.6, 3, 9) * 0;
      return [F.lerp(rest[0], w[0], blend) + settle, F.lerp(rest[1], w[1], blend)];
    }
    // overshoot-and-settle on arrival, then pushed aside before the jump
    const o = F.twang(T - 28.9, 2.2, 7) * 1.6;
    let x = target[0] + o;
    let y = target[1] + o * 0.5;
    if (T > 31.6) {
      const k = E.inOut(F.prog(T, 31.6, 32.35));
      x = F.lerp(x, 1912, k);
      y = F.lerp(y, 352, k);
    }
    return [x, y];
  }
  function lensLift(T) {
    return T > 25.4 && T < 29.1 ? 2 : T > 31.5 && T < 32.5 ? 2.5 : 0;
  }
  function southCount(T) {
    const n = A.mapSouthTotal();
    return Math.floor(n * F.prog(T, 25.5, 28.3) + (T > 25.5 ? 0.6 : 0));
  }
  function crossCount(str, T, t0, t1) {
    const n = F.crossCount(str);
    const p = F.prog(T, t0, t1);
    const q = p + Math.sin(p * Math.PI * 7) * 0.04;
    return Math.floor(n * F.clamp01(q));
  }
  /** Pucker of the linen while the suspect thread is tugged; a little stays after it is unpicked. */
  function fold(T) {
    const g = BY.s8;
    if (T < g.tug.t0) return null;
    const ten = TH.tension(g, T);
    const after = T > g.unpick.t0 ? 0.24 + 0.76 * Math.exp(-(T - g.unpick.t0) * 4.5) * Math.cos((T - g.unpick.t0) * 9) : 0;
    const a = TH.at(g, g.tug.from);
    const b = TH.at(g, g.total);
    return { ax: a[0], ay: a[1], bx: b[0], by: b[1], amp: Math.max(ten, after), width: 34 };
  }

  // ---------------------------------------------------------------- scene
  function drawScene(T) {
    const fd = fold(T);
    const R = L.river;
    const skip = [
      F.coverRect(L.map.x, L.map.y, L.map.rot, [-172, -147, 172, 147]),
      F.coverRect(L.ticket.x, L.ticket.y, L.ticket.rot, [-80, -50, 76, 50]),
      F.coverRect(R.x, R.y, R.rot, [-284, -22, 284, 30]),
      F.coverRect(R.x, R.y, R.rot, [-236, -54, 236, -30]),
    ].filter(Boolean);
    F.drawLinen(fd, skip);
    // cross-stitched into the linen itself
    F.text('D.B. COOPER', L.heading.x, L.heading.y, -0.012, 9, C.CREAM, { kind: 'cross', seed: 501, hi: C.WHITE, lo: C.CREAM_S });
    F.text('1971', L.y1971.x, L.y1971.y, 0.02, 6, C.MUST, { kind: 'cross', seed: 502 });
    F.text('$200,000', L.sum.x, L.sum.y, -0.015, 4, C.RED, { kind: 'cross', seed: 503, count: crossCount('$200,000', T, 18.45, 19.85) });
    F.text('1980', L.y1980.x, L.y1980.y, -0.02, 6, C.MUST, { kind: 'cross', seed: 504 });
    F.text('$5,800', L.sum2.x, L.sum2.y, 0.012, 4, C.RED, { kind: 'cross', seed: 505, count: crossCount('$5,800', T, 51.2, 52.75) });

    A.ticket();
    A.plane(L.plane, 0, 60);
    A.man();
    A.briefcase();
    A.cash();
    L.chutes.forEach((c, i) => {
      const it = K.land(T, c.land, c);
      if (it) A.chute(it, 100 + i * 10);
    });
    A.map(southCount(T), E.outBack(F.prog(T, 33.0, 33.5)));
    drawJumper(T);
    const ls = K.land(T, 36.2, L.liveScrap);
    if (ls) A.scrap(ls, 'live', 'DID HE LIVE?', 401);
    const ds = K.land(T, 36.62, L.dieScrap);
    if (ds) A.scrap(ds, 'die', 'DID HE DIE?', 411);
    L.suspects.forEach((s, i) => {
      let it = s;
      if (i === 1) {
        const g = BY.s8;
        const ten = TH.tension(g, T) + (T > g.unpick.t0 ? 0.3 : 0);
        const a = TH.at(g, g.tug.from);
        const d = Math.hypot(a[0] - s.x, a[1] - s.y);
        it = Object.assign({}, s, { x: s.x + ((a[0] - s.x) / d) * 4 * ten, y: s.y + ((a[1] - s.y) / d) * 4 * ten, rot: s.rot + 0.03 * ten });
        const k = T > g.unpick.t1 ? E.outBack(F.prog(T, g.unpick.t1 + 0.15, g.unpick.t1 + 0.75)) : 0;
        if (k > 0) {
          // swings around its last stitch (bottom-right corner) and lifts off the linen
          const piv = K.xf(it, 38, 50);
          const r = it.rot + 0.2 * k;
          it = Object.assign({}, it, { rot: r, x: piv[0] - (Math.cos(r) * 38 - Math.sin(r) * 50), y: piv[1] - (Math.sin(r) * 38 + Math.cos(r) * 50), lift: 1.6 * k });
        }
      }
      A.suspect(it, i);
    });
    A.river();
    const tg = K.land(T, 56.95, L.tag);
    if (tg) A.tag(tg);

    for (const g of F.FANS) TH.draw(g, T, THEORY);
    for (const g of F.MAIN) TH.draw(g, T, K.RED);
    for (const n of F.fanNeedles(T)) TH.drawNeedle(n);
    TH.drawNeedle(TH.needle(F.MAIN, T));
  }
  /** The tiny parachutist leaves the lowered stair and is pressed onto the map beside the jump knot. */
  function drawJumper(T) {
    if (T < 33.55) return;
    const from = K.xf(L.map, 50, 8);
    const to = K.xf(L.map, 40, -4);
    const k = E.inOut(F.prog(T, 33.55, 34.25));
    const it = { x: F.lerp(from[0], to[0], k), y: F.lerp(from[1], to[1], k) - Math.sin(k * Math.PI) * 6, rot: -0.1 + 0.2 * k, scale: 0.42 };
    const landed = K.land(T, 34.25, it);
    A.chute(Object.assign({}, it, landed || {}, { lift: T < 34.25 ? 3 : (landed && landed.lift) || 0 }), 170);
  }

  // ---------------------------------------------------------------- frame
  const saved = new Uint8Array(F.W * F.H);
  const MAG = 1.75;
  F.render = function (T) {
    const c = F.camera(T);
    F.resetClip();
    F.setCamera(c.x, c.y, c.z);
    drawScene(T);
    const lp = lensAt(T);
    const z = c.z;
    const sx = lp[0] * z - F.cam.ox;
    const sy = lp[1] * z - F.cam.oy;
    const rs = A.LENS_R * z;
    if (sx > -rs * 3 && sx < F.W + rs * 3 && sy > -rs * 3 && sy < F.H + rs * 3) {
      const x0 = Math.max(0, Math.floor(sx - rs));
      const y0 = Math.max(0, Math.floor(sy - rs));
      const x1 = Math.min(F.W, Math.ceil(sx + rs));
      const y1 = Math.min(F.H, Math.ceil(sy + rs));
      if (x0 < x1 && y0 < y1) {
        saved.set(F.fb);
        const ox = F.cam.ox;
        const oy = F.cam.oy;
        F.cam.z = z * MAG;
        F.cam.ox = Math.round(lp[0] * z * MAG - sx);
        F.cam.oy = Math.round(lp[1] * z * MAG - sy);
        F.setClip(x0, y0, x1, y1);
        drawScene(T);
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const dx = x + 0.5 - sx;
            const dy = y + 0.5 - sy;
            if (dx * dx + dy * dy > rs * rs) F.fb[y * F.W + x] = saved[y * F.W + x];
          }
        F.cam.z = z;
        F.cam.ox = ox;
        F.cam.oy = oy;
        F.resetClip();
      }
      A.lens(lp[0], lp[1], lensLift(T));
    }
  };
  /** Indexed framebuffer -> RGBA ImageData. */
  F.toImage = function (img) {
    const d = img.data;
    const fb = F.fb;
    const rgb = F.RGB;
    for (let i = 0, j = 0; i < fb.length; i++, j += 4) {
      const c = rgb[fb[i]];
      d[j] = c[0];
      d[j + 1] = c[1];
      d[j + 2] = c[2];
      d[j + 3] = 255;
    }
  };
  F.shotAt = function (T) {
    let i = 0;
    while (i < F.SHOTS.length - 1 && T >= F.SHOTS[i + 1].start) i++;
    return i;
  };
})();

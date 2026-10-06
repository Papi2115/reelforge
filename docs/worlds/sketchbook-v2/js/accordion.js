/* sketchbook v2 - shot 8: ACCORDION TIMELINE. A long creased paper strip lies across a lined page; a left hand drags it
   right to left while the pen writes the chronology onto it: 45 BC, 325, the 1500s, 1582 (the only red: -10 days), 1752.
   What has been read bunches into a folded stack at the left; a paper clip marks "now" at the strip's end.
   Global film time 56.7-65.2 s (8.5 s): entered by the sticky-note peel, exits with a riffle (js/timeline.js).
   Focal point: the entry being written. Human traces: uneven panel widths, tape at angles over the joins, the pencil
   construction axis with hand-ruled century ticks, a coffee ring under the strip, a sun doodle, a graphite thumbprint
   where the hand pressed. Still moment: 4.6-5.1 s, the pen hovers over the empty spot before 1582. */
'use strict';
(function () {
  const SB = window.SB, C = SB.C, E = SB.ease;
  const SH = 184, Y0 = 156, U_END = 2210, AXIS = 96;
  const ST = SB.accStrip({ u0: -760, u1: U_END, sh: SH, xs: 200, fold: 74, foldMax: 88.5, zk: 0.4, lift: [0.1, 0.42], y0: Y0, tilt: -1, pivot: [480, 248], seed: 801,
    widths: [232, 214, 247, 226, 205, 251, 229, 218, 243, 224, 237, 212, 249, 230] });

  // the drags: hand arrives at g0, presses at p0, drags d0-d1 (strip travel D px); a pull without g0 follows the previous one
  const PULLS = [
    { g0: 2.42, p0: 2.6, d0: 2.65, d1: 2.92, D: 520, ease: E.sine, ant: 3, at: [770, 322] },
    { p0: 3.04, d0: 3.06, d1: 3.36, D: 480, ease: E.out, ant: 0, at: [716, 318] },
    { g0: 6.22, p0: 6.4, d0: 6.45, d1: 6.76, D: 370, ease: (x) => E.back(x, 1.3), ant: 4, at: [650, 326] },
  ];
  const slide = (t) => {
    let s = 0;
    for (const p of PULLS) {
      s += p.D * p.ease(SB.seg(t, p.d0, p.d1));
      if (p.ant) s -= p.ant * Math.sin(Math.PI * SB.seg(t, p.p0, p.d0 + 0.08));
    }
    return s;
  };
  for (const p of PULLS) { p.u = p.at[0] + slide(p.p0); p.v = p.at[1] - Y0; }
  const mapAt = (t) => ST.mapper(ST.layout(slide(t)));
  const grip = (p, t) => mapAt(t)(p.u, p.v);
  const lerp = (a, z, k) => [a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k];
  const handAt = (t) => {
    for (let i = 0; i < PULLS.length; i++) {
      const p = PULLS[i], nx = PULLS[i + 1], chained = nx && nx.g0 == null;
      if (p.g0 != null && t >= p.g0 && t < p.p0) {
        const k = E.out(SB.seg(t, p.g0, p.p0)), g = grip(p, p.p0);
        return { F: lerp([g[0] - 110, g[1] + 300], g, k), lift: 1 - 0.8 * k };
      }
      if (t >= p.p0 && t < p.d1) return { F: grip(p, t), lift: 0.2 * (1 - SB.seg(t, p.p0, p.d0)) };
      if (t >= p.d1 && chained && t < nx.p0) {
        const k = SB.seg(t, p.d1, nx.p0);
        return { F: lerp(grip(p, p.d1), grip(nx, nx.p0), E.inOut(k)), lift: 0.9 * Math.sin(Math.PI * k) };
      }
      if (t >= p.d1 && !chained && t < p.d1 + 0.22) {
        const k = E.in(SB.seg(t, p.d1, p.d1 + 0.22)), g = grip(p, p.d1);
        return { F: lerp(g, [g[0] - 80, g[1] + 320], k), lift: k };
      }
    }
    return null;
  };
  const busy = (a, z) => PULLS.some((p) => (p.g0 != null ? p.g0 : p.p0) < z && p.d1 > a);

  // ---- marks, in strip coordinates (u along, v across) ----
  const L = [];
  const pre = { t0: -5, dur: 0.01, hand: false, tool: 'pencil', bfps: 10 };
  // the pencil construction axis, ruled panel by panel (it never quite lines up across a crease)
  const c = ST.creases;
  for (let k = 0; k + 1 < c.length; k++) {
    const a = c[k] + 3, z = Math.min(c[k + 1] - 3, U_END - 26), v = AXIS + SB.rnd(-1.2, 1.2, 870, k), pts = [];
    if (z <= a) continue;
    for (let u = a; u < z; u += 9) pts.push(u, v + (u - a) * SB.rnd(-0.004, 0.004, 870, k, 2));
    pts.push(z, v + (z - a) * SB.rnd(-0.004, 0.004, 870, k, 2));
    L.push(SB.stroke(pts, Object.assign({}, pre, { smooth: false, boil: 0.5, seed: 871 + k })));
  }
  L.push(SB.stroke([U_END - 36, AXIS - 6, U_END - 25, AXIS, U_END - 36, AXIS + 6], Object.assign({}, pre, { corners: [false, true, false], seed: 890 })));
  SB.write(L, 'now', { x: U_END - 92, y: AXIS - 14, size: 21, hand: 'scrawl', tool: 'pencil', rot: -4, seed: 891, t0: -5, t1: -4.9, handVisible: false });
  // years -> u: hand-placed, roughly to scale; the long middle squeezed, the busy end stretched
  const uOfYear = (y) => (y <= 325 ? 282 + ((y + 45) * 378) / 370 : 660 + ((y - 325) * 670) / 1175);
  for (const y of [100, 200, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400]) {
    const u = uOfYear(y) + SB.rnd(-2, 2, 880, y), len = SB.rnd(4, 7, 880, y, 2), lean = SB.rnd(-1.5, 1.5, 880, y, 3);
    L.push(SB.stroke([u - lean, AXIS - len, u + lean, AXIS + len], Object.assign({}, pre, { smooth: false, seed: 900 + y })));
  }
  SB.write(L, '1000', { x: uOfYear(1000) - 14, y: AXIS + 22, size: 13, hand: 'scrawl', tool: 'pencil', rot: -3, seed: 892, t0: -5, t1: -4.9, handVisible: false });

  const felt = { tool: 'felt', w: 2, bfps: 10, hand: 'print' }, fine = { tool: 'fine', w: 1, bfps: 10, hand: 'print' };
  const wr = (str, u, v, o, t0, t1) => SB.write(L, str, Object.assign({ x: u, y: v, t0: t0, t1: t1 }, o));
  const tick = (u, t0, w, len, seed) => L.push(SB.stroke([u + 0.6, AXIS - len, u - 0.4, AXIS + len], { tool: w > 2 ? 'felt' : 'fine', w: w, t0: t0, dur: 0.04, smooth: false, seed: seed, bfps: 10 }));
  // 45 BC (u 282)
  wr('45 BC', 290, 70, Object.assign({ size: 40, rot: -2, seed: 811 }, felt), 0.18, 0.62);
  tick(282, 0.66, 2, 12, 814);
  wr('Caesar: +1 day', 292, 134, Object.assign({ size: 17, seed: 812 }, fine), 0.78, 1.1);
  wr('every 4 years', 292, 158, Object.assign({ size: 17, seed: 813, rot: 1 }, fine), 1.15, 1.42);
  // 325 (u 660), smaller: a waypoint
  wr('325', 668, 66, Object.assign({ size: 25, rot: -1, seed: 821 }, fine, { w: 2 }), 1.58, 1.76);
  tick(660, 1.8, 2, 9, 824);
  const eq = { x: 670, y: 132, size: 16, seed: 822 };
  wr('equinox: 21 March', eq.x, eq.y, Object.assign({}, eq, fine), 1.86, 2.2);
  const from = L.length;
  SB.sun(L, eq.x + SB.layoutText('equinox: 21 March', Object.assign({ hand: 'print' }, eq)).w + 22, 124, 7, 2.24, { seed: 825, rays: 7, rayScale: 0.45, fill: false, tool: 'fine', bfps: 10 });
  SB.fitMarks(L, from, 2.24, 2.36);
  // the 1500s (u 1330)
  wr('1500s', 1338, 70, Object.assign({ size: 32, rot: -1.5, seed: 831 }, felt), 3.62, 3.88);
  tick(1330, 3.91, 2, 11, 834);
  wr('equinox slipped', 1340, 134, Object.assign({ size: 17, seed: 832 }, fine), 3.96, 4.2);
  wr('~10 days', 1343, 158, Object.assign({ size: 17, seed: 833, rot: 1 }, fine), 4.25, 4.4);
  // 1582 (u 1600): the hero, after a held beat
  wr('1582', 1608, 76, Object.assign({ size: 52, rot: -2.5, seed: 841 }, felt, { w: 3 }), 5.1, 5.46);
  tick(1600, 5.5, 3, 15, 844);
  wr('−10 days', 1612, 146, { size: 30, hand: 'scrawl', tool: 'red', w: 3, rot: -4, seed: 842, bfps: 10 }, 5.8, 6.12);
  // 1752 (u 1930)
  wr('1752', 1938, 70, Object.assign({ size: 36, rot: -1, seed: 851 }, felt), 6.98, 7.18);
  tick(1930, 7.2, 2, 11, 854);
  wr('Britain: −11 days', 1940, 134, Object.assign({ size: 17, seed: 852 }, fine), 7.24, 7.5);

  // marks grouped by the panel they sit on (painted with it, so folded faces hide what is behind them)
  const byPanel = [];
  for (let k = 0; k < ST.n; k++) byPanel.push([]);
  for (const m of L) {
    let a = Infinity, z = -Infinity;
    for (let i = 0; i < m.pts.length; i += 2) { a = Math.min(a, m.pts[i]); z = Math.max(z, m.pts[i]); }
    byPanel[ST.panelOf((a + z) / 2)].push(m);
  }
  const hm = L.filter((m) => m.hand).sort((a, b) => a.t0 - b.t0);
  const TAPES = [[615, 16, 56, 18, 8, 61], [615, 169, 50, 17, -6, 62], [1305, 168, 60, 18, 11, 63], [1978, 15, 54, 18, -9, 64]];
  const press = PULLS[2];

  SB.defineShot('accordion', {
    title: 'Accordion timeline', role: 'C+B',
    note: 'A creased paper strip slides right to left under a dragging hand while the pen writes 45 BC, 325, the 1500s, 1582 (red: -10 days) and 1752 onto it; the read part bunches into a folded stack; a paper clip marks now.',
    render: (b, t) => {
      SB.setView(480, 270, 1);
      SB.drawStock(b, 'lined');
      SB.coffeeRing(b, 872, 372, 47, 17);
      const lay = ST.layout(slide(t)), xf = ST.mapper(lay);
      let act = null;
      ST.draw(b, lay, (k) => {
        const a = SB.drawMarks(b, byPanel[k], t, xf);
        if (a && (!act || a.m.t0 >= act.m.t0)) act = a;
      });
      if (t >= press.d1 + 0.05) SB.accThumbprint(b, xf, press.u + 3, press.v - 6, 24, 66);
      for (const [u, v, w, h, deg, seed] of TAPES) if (u - lay.S > 120) ST.tape(b, lay, u, v, w, h, deg, seed);
      const cp = xf(U_END - 34, -16);
      SB.clip(b, cp[0], cp[1], 5, 1.15);
      const hand = handAt(t);
      if (hand) SB.dragHand(b, hand.F, hand.lift);
      SB.drawPen(b, SB.accPen(hm, t, act, mapAt, busy));
    },
  });
})();

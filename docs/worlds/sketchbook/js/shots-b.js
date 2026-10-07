/* sketchbook - pages 5-8: the flipbook, the envelope, the calendar, the index card. */
'use strict';
(function () {
  const SB = window.SB, C = SB.C, E = SB.ease;
  const DEFS = (SB.SHOT_DEFS = SB.SHOT_DEFS || []);

  // ---------- 5 C: flipbook in the page corner - 1,257 years of a drifting equinox flick past ----------
  (function () {
    const N = 22, Y0 = 325, Y1 = 1582;
    const pages = [];
    const yearOf = (k) => Math.round(Y0 + (k * (Y1 - Y0)) / (N - 1));
    const dayOf = (k) => Math.round(21 - (yearOf(k) - Y0) * 0.00781);
    const cellX = (d) => 128 + (d - 10) * 52;
    function pageMarks(k) {
      if (pages[k]) return pages[k];
      const L = [], sd = 5000 + k * 97, st = { t0: -5, t1: -4.9, handVisible: false, bfps: 0.0001 };
      const o = (x) => Object.assign({}, st, x);
      SB.write(L, 'MARCH', o({ x: 130, y: 404, size: 30, hand: 'print', tool: 'felt', seed: sd + 1, rot: -1 }));
      for (let d = 10; d <= 22; d++) {
        const x = cellX(d);
        L.push(SB.stroke([x, 300 + SB.rnd(-1, 1, sd, d), x + SB.rnd(-1, 1, sd, d, 2), 352], { t0: -5, dur: 0.01, hand: false, smooth: false, seed: sd + d * 3, tool: 'fine', bfps: 0.0001 }));
        SB.write(L, String(d), o({ x: x + 12, y: 334, size: 17, hand: 'print', tool: 'fine', w: 2, seed: sd + d * 5 }));
      }
      L.push(SB.stroke([cellX(10), 300, cellX(23), 299], { t0: -5, dur: 0.01, hand: false, seed: sd + 2, tool: 'fine', bfps: 0.0001 }));
      L.push(SB.stroke([cellX(10), 352, cellX(23), 353], { t0: -5, dur: 0.01, hand: false, seed: sd + 3, tool: 'fine', bfps: 0.0001 }));
      L.push(SB.stroke([cellX(23), 299, cellX(23) + 1, 353], { t0: -5, dur: 0.01, hand: false, seed: sd + 4, tool: 'fine', bfps: 0.0001 }));
      // where the equinox should be: a pencil ring around 21, the same on every page
      const ring = SB.ellipsePts(cellX(21) + 26, 327, 30, 24, 14, 0, -2.2);
      ring.push(ring[0] + 6, ring[1] - 4);
      L.push(SB.stroke(ring, { t0: -5, dur: 0.01, hand: false, tool: 'pencil', w: 2, seed: sd + 6, bfps: 0.0001 }));
      // where it actually falls: the sun
      const d = dayOf(k), sx = cellX(d) + 26;
      SB.sun(L, sx, 242, 22, -5, { seed: sd + 7, rays: 8, rayScale: 0.7, bfps: 0.0001 });
      L.push(SB.stroke([sx, 274, sx + 1, 294], { t0: -5, dur: 0.01, hand: false, tool: 'pencil', seed: sd + 8, bfps: 0.0001 }));
      SB.write(L, 'spring equinox', o({ x: sx - 64, y: 196, size: 17, hand: 'scrawl', tool: 'fine', w: 1, seed: sd + 9, rot: -3 }));
      // the year: the flipbook's loud page number
      SB.write(L, String(yearOf(k)), o({ x: k === 0 ? 620 : 560, y: 150, size: 108, hand: 'marker', tool: 'marker', len: 14, thick: 5, seed: sd + 10, rot: SB.rnd(-4, 3, sd, 11) }));
      if (k === 0) SB.write(L, 'AD', o({ x: 548, y: 150, size: 36, hand: 'marker', tool: 'marker', len: 6, thick: 3, seed: sd + 12 }));
      for (const m of L) { m.hand = false; m.t0 = -5; m.dur = 0.01; m.bfps = 0.0001; }
      return (pages[k] = L);
    }
    const flipStart = 0.32, flipEnd = 4.55;
    const F = (t) => (N - 1) * E.inOut(SB.seg(t, flipStart, flipEnd));
    SB.flipbookPage = (b, k) => {
      SB.setView(480, 270, 1);
      SB.drawStock(b, 'cartridge');
      SB.drawMarks(b, pageMarks(k), 0);
    };
    const tmpA = SB.newBuf(), tmpB = SB.newBuf();
    DEFS[4] = {
      dur: 6.7, title: 'Flipbook: 1,257 years', role: 'C', trans: { type: 'crumple', d: 0.95 },
      note: 'Thumb riffles the page corners: same doodle redrawn on every page, the year flicks 325 -> 1582 while the sun slides from 21 March to 11 March. The pencil ring stays on 21.',
      lines: [[0, 3.4, 'Year after year, the spring equinox crept earlier.'], [3.4, 6.7, 'Too slow for anyone to notice.']],
      render: (b, t) => {
        const f = F(t), k = Math.min(N - 1, Math.floor(f)), frac = f - k;
        if (k >= N - 1 || frac < 0.02) { SB.flipbookPage(b, k); SB.drawThumb(b, 0); return; }
        SB.flipbookPage(tmpA, k);
        SB.flipbookPage(tmpB, k + 1);
        SB.cornerFold(b, tmpA, tmpB, E.inOut(frac));
        SB.drawThumb(b, frac);
      },
    };
  })();

  // ---------- 6 B: back of a kraft envelope: the overshoot, the drift chart ----------
  (function () {
    const L = [];
    const pl = SB.placement(84, 64, -2, 1);
    const EW = 800, EH = 420;
    const P = (u, v) => pl.toPage(u, v);
    const bic = { tool: 'bic', bfps: 8, boil: 0.6 };
    const wr = (str, u, v, o) => { const p = P(u, v); return SB.write(L, str, Object.assign({ x: p[0], y: p[1], rot: -2, hand: 'print' }, bic, o)); };
    const line = (u0, v0, u1, v1, o) => { const a = P(u0, v0), z = P(u1, v1); return SB.ruled(L, a[0], a[1], z[0], z[1], Object.assign({}, bic, o)); };
    SB.pageNumber(L, 6, 106, 'bic');
    // column subtraction, decimal points lined up
    const sz = 24, w365 = SB.textWidth('365', sz, 'print'), wMinus = SB.textWidth('− ', sz, 'print'), w0 = SB.textWidth('0', sz, 'print');
    const ax = 92;
    wr('365.25', ax, 82, { size: sz, seed: 141, t0: 0.22, t1: 0.7 });
    wr('− 365.2422', ax - wMinus, 118, { size: sz, seed: 142, t0: 0.82, t1: 1.46 });
    line(ax - wMinus - 6, 130, ax + w365 + 112, 129, { t0: 1.54, dur: 0.18, seed: 143 });
    wr('0.0078 day', ax + w365 - w0, 162, { size: sz, seed: 144, t0: 1.8, t1: 2.35 });
    const red = { tool: 'red', w: 2, bfps: 8 };
    wr('≈ 11 min a year', ax - 4, 214, { size: 26, seed: 145, t0: 2.48, t1: 3.12 });
    const r0 = P(ax + 4 + SB.textWidth('≈ ', 26, 'print') + 42, 204);
    SB.loop(L, r0[0], r0[1], 54, 25, Object.assign({ t0: 3.2, dur: 0.3, seed: 146, a0: -2.6 }, red));
    // the drift chart: ruled axes, a line that only climbs
    const O = [452, 372], X1 = 760, Y1 = 198;
    line(O[0], O[1], X1, O[1], { t0: 3.66, dur: 0.22, seed: 147 });
    line(O[0], O[1], O[0], Y1, { t0: 3.94, dur: 0.18, seed: 148 });
    for (let i = 1; i <= 5; i++) line(O[0] - 5, O[1] - i * 33, O[0] + 3, O[1] - i * 33, { t0: 4.14 + i * 0.035, dur: 0.03, seed: 149 + i });
    wr('325', O[0] - 16, O[1] + 28, { size: 16, seed: 156, t0: 4.42, t1: 4.62 });
    wr('1582', X1 - 36, O[1] + 28, { size: 16, seed: 157, t0: 4.7, t1: 4.94 });
    wr('days', O[0] - 70, Y1 + 12, { size: 16, seed: 158, t0: 5.0, t1: 5.2, hand: 'scrawl' });
    const end = [X1 - 14, O[1] - 5 * 33];
    line(O[0] + 2, O[1] - 2, end[0], end[1], { t0: 5.34, dur: 1.15, seed: 159, boil: 0.4 });
    // the point: about ten days
    const e = P(end[0], end[1]);
    L.push(SB.stroke(SB.ellipsePts(e[0], e[1], 3.5, 3.5, 8).concat([e[0] + 3, e[1] - 2]), Object.assign({ t0: 6.86, dur: 0.1, seed: 160, w: 3 }, red)));
    wr('≈ 10 days', X1 - 168, Y1 - 4, Object.assign({ size: 30, seed: 161, t0: 7.0, t1: 7.5, w: 2 }, red));
    const tapeA = [P(-4, 6), P(EW + 2, EH - 8)];
    const stubs = [3, 7, 12, 16].map((k) => 9 + k * 25.5);
    DEFS[5] = {
      marks: L, dur: 8.6, pace: 1.07, title: 'The overshoot', role: 'B', trans: { type: 'sticky', d: 1.05 },
      note: 'Kraft envelope taped into the book, maths on its back: 365.25 - 365.2422 = 0.0078 day = about 11 minutes; the drift chart climbs to about 10 days by 1582. Coffee ring. Torn stubs of the last page in the spiral.',
      lines: [[0, 3.5, 'Caesar\'s year was too long by about 11 minutes.'], [3.5, 99, 'From 325 to 1582, that added up to ten whole days.']],
      render: (b, t) => {
        SB.setView(480, 270, 1);
        SB.drawStock(b, 'cartridge');
        SB.tornStubs(b, stubs, 66);
        SB.dropShadow(b, pl, EW, EH, 4, 6);
        SB.sheet(b, pl, EW, EH, { col: C.KRAFT, fib: C.COFFEE_L, fib2: C.KRAFT_D, fo: 333, edge: C.KRAFT_D });
        // flap seams of the envelope back
        SB.printLine(b, pl, 0, 0, 400, 250, C.KRAFT_D, 0.25);
        SB.printLine(b, pl, 400, 250, EW, 0, C.KRAFT_D, 0.25);
        SB.printLine(b, pl, 0, EH, 318, 226, C.KRAFT_D, 0.35);
        SB.printLine(b, pl, EW, EH, 482, 226, C.KRAFT_D, 0.35);
        SB.coffeeRing(b, 802, 104, 50, 7);
        const act = SB.drawMarks(b, L, t);
        SB.tape(b, tapeA[0][0], tapeA[0][1], 70, 22, -38, 3);
        SB.tape(b, tapeA[1][0], tapeA[1][1], 74, 22, -34, 4);
        SB.drawPen(b, SB.penState(L, t, act));
      },
    };
  })();

  // ---------- 7 A: 1582 - Gregory XIII points, the red pen cuts ten days; Britain's page slaps on in 1752 ----------
  (function () {
    const L = [];
    SB.pageNumber(L, 7, 107, 'fine');
    // printed calendar sheets (no boil, no hand)
    const cal = (title, u0, v0, cell, size, nsize, seed) => {
      const M = [];
      const st = { t0: -5, t1: -4.9, handVisible: false, boil: 0, bfps: 1, hand: 'type', tool: 'fine' };
      SB.write(M, title, Object.assign({}, st, { x: u0, y: v0 - 18, size: size, seed: seed, track: 0.5, w: 2 }));
      for (let d = 1; d <= 31; d++) {
        const r = Math.floor((d - 1) / 7), c = (d - 1) % 7;
        SB.write(M, String(d), Object.assign({}, st, { x: u0 + c * cell + 5, y: v0 + r * cell + nsize + 6, size: nsize, seed: seed + d, w: 1 }));
      }
      for (const m of M) { m.hand = false; m.boil = 0; }
      return M;
    };
    const A = { x: 352, y: 52, deg: 1.6, w: 342, h: 306 }, cellA = 44;
    const plA = SB.placement(A.x, A.y, A.deg, 1);
    const calA = cal('OCTOBER 1582', 22, 84, cellA, 21, 13, 700);
    const B = { x: 640, y: 270, deg: -5, w: 236, h: 200 }, cellB = 30;
    const calB = cal('SEPTEMBER 1752', 14, 58, cellB, 14, 11, 760);
    const toPageA = (M) => { for (const m of M) m.pts = SB.xformPts(m.pts, plA.toPage); return M; };
    toPageA(calA);
    const cellCenter = (pl, u0, v0, cell, d) => { const r = Math.floor((d - 1) / 7), c = (d - 1) % 7; return pl.toPage(u0 + c * cell + cell / 2, v0 + r * cell + cell / 2); };
    // Gregory XIII: mitre, crozier, pointing at the sheet
    const F = { x: 176, y: 462, h: 246, seed: 171, bfps: 12, brows: true };
    const point = (t) => E.back(SB.seg(t, 4.6, 4.95), 1.6);
    F.pose = (t) => { const p = point(t); return { lean: 5, head: 2, face: 0.6, look: -0.1, armR: [98 - 6 * p, 88 - 4 * p], armL: [-58, -30], legL: [-12, -4], legR: [10, 3] }; };
    F.expr = (t) => ({ eyes: 'dot', mouth: t > 2.3 && t < 4.4 ? 'tongue' : 'flat', brow: 1 });
    const fig = SB.figure(L, Object.assign({ t0: 0.2, t1: 1.42 }, F));
    const J = fig.J;
    L.push(SB.stroke(null, { fn: (tt) => { const j = J(tt), a = j.legL[2], z = j.legR[2]; return [j.sh[0] - 8, j.sh[1] + 6, a[0] - 18, a[1] - 14, z[0] + 16, z[1] - 16, j.sh[0] + 9, j.sh[1] + 4]; }, t0: 1.44, dur: 0.05, corners: [false, true, true, false], seed: 176, bfps: 12 }));
    const hp = (tt) => { const j = J(tt), a = (j.headA * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return (u, v) => [j.head[0] + (u * c - v * s) * j.hr, j.head[1] + (u * s + v * c) * j.hr]; };
    const mitre = (tt) => { const P = hp(tt); return [...P(-0.92, -0.62), ...P(-0.8, -1.9), ...P(0.02, -2.75), ...P(0.86, -1.9), ...P(0.95, -0.62)]; };
    L.push(SB.stroke(null, { fn: (tt) => { const m = mitre(tt); return { pts: m.concat(m.slice(0, 2)), corners: [false, false, true, false, true, false] }; }, t0: 1.5, dur: 0.26, seed: 172, bfps: 12 }));
    L.push(SB.stroke(null, { fn: (tt) => { const P = hp(tt); return [...P(0.02, -2.6), ...P(0.02, -0.66)]; }, t0: 1.8, dur: 0.08, seed: 173, bfps: 12 }));
    L.push(SB.fill([0, 0], { polyFn: mitre, col: C.STICKY_D, t0: 1.92, dur: 0.2, sp: 2, seed: 174 }));
    // crozier in the left hand
    L.push(SB.stroke(null, { fn: (tt) => { const h = J(tt).armL[2]; return [h[0] + 4, h[1] + 88, h[0], h[1], h[0] - 6, h[1] - 150, h[0] - 2, h[1] - 172, h[0] + 16, h[1] - 176, h[0] + 22, h[1] - 160, h[0] + 10, h[1] - 152, h[0] + 4, h[1] - 160]; }, t0: 2.16, dur: 0.24, seed: 175, bfps: 12 }));
    // the red pen cuts: careful Xs on 5, 6, 7 - then one impatient zigzag through 8-14
    const red = { tool: 'red', w: 2, bfps: 12 };
    let t = 2.5;
    for (const d of [5, 6, 7]) {
      const c = cellCenter(plA, 22, 84, cellA, d), s = 14 - (d - 5) * 1.5;
      L.push(SB.stroke([c[0] - s, c[1] - s, c[0] + s, c[1] + s + 1], Object.assign({ t0: t, dur: 0.07, seed: 180 + d }, red)));
      L.push(SB.stroke([c[0] + s, c[1] - s - 1, c[0] - s + 1, c[1] + s], Object.assign({ t0: t + 0.1, dur: 0.06, seed: 190 + d }, red)));
      t += 0.25 - (d - 5) * 0.04;
    }
    const z = [];
    for (let d = 8; d <= 14; d++) { const c = cellCenter(plA, 22, 84, cellA, d); z.push(c[0] - 10, c[1] - 13, c[0] + 12, c[1] + 12); }
    L.push(SB.stroke(z, Object.assign({}, red, { t0: t + 0.12, dur: 0.34, seed: 199, smooth: false, ease: 'lin', w: 3 })));
    const c4 = cellCenter(plA, 22, 84, cellA, 4), c15 = cellCenter(plA, 22, 84, cellA, 15);
    SB.arrow(L, [c4[0] + 6, c4[1] + 16, c4[0] - 40, c4[1] + 52, c15[0] + 50, c15[1] - 30, c15[0] + 18, c15[1] - 6], Object.assign({}, red, { t0: 3.66, dur: 0.32, seed: 200, head: 13, w: 3 }));
    SB.write(L, 'Gregory XIII', { x: 34, y: 156, size: 20, hand: 'scrawl', tool: 'pencil', rot: -5, seed: 201, t0: 4.14, t1: 4.46 });
    SB.arrow(L, [112, 166, 124, 186, 140, 196], { tool: 'pencil', t0: 4.5, dur: 0.1, seed: 202, head: 8 });
    // 1752: Britain's page slaps on, a strip of tape, two fast strikes
    const slapT = 5.42;
    const slap = (tt) => {
      const k = SB.seg(tt, slapT - 0.2, slapT), s = E.in(k);
      const land = SB.seg(tt, slapT, slapT + 0.28);
      const sc = k < 1 ? 1.3 - 0.3 * s : 1 - 0.035 * Math.sin(land * Math.PI) * (1 - land);
      return SB.placement(B.x + (1 - s) * 90, B.y - (1 - s) * 140, B.deg - (1 - s) * 9, sc);
    };
    const plB = slap(10);
    const calBp = calB.map((m) => Object.assign({}, m, { pts: SB.xformPts(m.pts, plB.toPage) }));
    let tb = 5.9;
    const strike = (a, b2, dt) => {
      const p = cellCenter(plB, 14, 58, cellB, a), q = cellCenter(plB, 14, 58, cellB, b2);
      L.push(SB.stroke([p[0] - 12, p[1] + 2, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 2, q[0] + 12, q[1] - 1], Object.assign({}, red, { t0: tb, dur: dt, seed: 210 + a, w: 3 })));
      tb += dt + 0.09;
    };
    strike(3, 7, 0.16);
    strike(8, 13, 0.14);
    SB.write(L, 'Britain', { x: 744, y: 250, size: 20, hand: 'scrawl', tool: 'pencil', rot: -6, seed: 220, t0: 6.44, t1: 6.76 });
    DEFS[6] = {
      marks: L, dur: 9.0, title: 'Gregory, 1582', role: 'A', trans: { type: 'drop', d: 0.8 },
      note: 'A printed October 1582 sheet taped in. Gregory XIII (mitre, crozier) points; the red pen crosses 5, 6, 7 carefully, then strikes 8-14 at once; 4 -> 15. Britain\'s September 1752 slaps on: 3-13 struck.',
      lines: [[0, 4.9, 'In 1582, Pope Gregory XIII cut ten days: October 4th, then October 15th.'], [4.9, 99, 'Britain waited until 1752, and lost eleven days.']],
      render: (b, tt) => {
        SB.setView(480, 270, 1);
        SB.drawStock(b, 'cartridge');
        SB.dropShadow(b, plA, A.w, A.h, 3, 5);
        SB.sheet(b, plA, A.w, A.h, { col: C.PAPER, fib: C.FIBRE, fo: 71 });
        for (let r = 0; r <= 5; r++) SB.printLine(b, plA, 22, 84 + r * cellA - 4, 22 + 7 * cellA, 84 + r * cellA - 4, C.GRAPH_L);
        for (let c = 0; c <= 7; c++) SB.printLine(b, plA, 22 + c * cellA, 80, 22 + c * cellA, 80 + 5 * cellA, C.GRAPH_L);
        SB.fillPoly(b, SB.xformPts(SB.ellipsePts(70, 16, 5, 5, 10), plA.xf), C.SHADE);
        SB.fillPoly(b, SB.xformPts(SB.ellipsePts(272, 16, 5, 5, 10), plA.xf), C.SHADE);
        SB.drawMarks(b, calA, 10);
        const tA = plA.toPage(A.w / 2, -2);
        SB.tape(b, tA[0], tA[1], 84, 22, 3, 9);
        const act1 = SB.drawMarks(b, L.filter((m) => m.t0 < slapT), tt);
        if (tt >= slapT - 0.2) {
          const p = slap(tt);
          const lift = 1 - SB.seg(tt, slapT - 0.2, slapT);
          SB.dropShadow(b, p, B.w, B.h, 3 + lift * 24, 5 + lift * 30, lift > 0.3 ? SB.SOFT : SB.HARD);
          SB.sheet(b, p, B.w, B.h, { col: C.PAPER, fib: C.FIBRE, fo: 501 });
          for (let r = 0; r <= 5; r++) SB.printLine(b, p, 14, 58 + r * cellB - 4, 14 + 7 * cellB, 58 + r * cellB - 4, C.GRAPH_L);
          for (let c = 0; c <= 7; c++) SB.printLine(b, p, 14 + c * cellB, 54, 14 + c * cellB, 54 + 5 * cellB, C.GRAPH_L);
          const xf = (x, y) => { const q = plB.inv(x, y); return p.xf(q[0], q[1]); };
          SB.drawMarks(b, calBp, 10, xf);
          if (tt >= slapT + 0.3) { const tp = p.toPage(B.w - 12, 8); SB.tape(b, tp[0], tp[1], 60, 20, 40, 11); }
        }
        const act2 = SB.drawMarks(b, L.filter((m) => m.t0 >= slapT), tt);
        SB.drawPen(b, SB.penState(L, tt, act2 || act1));
      },
    };
  })();

  // ---------- 8 PAYOFF: the rule on an index card, clipped in; one red word; a small sun that agrees ----------
  (function () {
    const L = [];
    SB.pageNumber(L, 8, 108, 'fine');
    const pl = SB.placement(236, 96, -1.2, 1);
    const CW = 500, CH = 318;
    const P = (u, v) => pl.toPage(u, v);
    const fine = { tool: 'fine', w: 2, bfps: 10 };
    const wr = (str, u, v, o) => { const p = P(u, v); return SB.write(L, str, Object.assign({ x: p[0], y: p[1], rot: -1.2, hand: 'print' }, fine, o)); };
    wr('LEAP YEARS', 30, 48, { size: 22, seed: 301, t0: 0.25, t1: 0.82, track: 0.4 });
    wr('÷ 4  → leap', 34, 112, { size: 24, seed: 302, t0: 1.02, t1: 1.6 });
    wr('÷ 100 → no leap', 34, 146, { size: 24, seed: 303, t0: 1.82, t1: 2.62 });
    wr('÷ 400 → leap', 34, 180, { size: 24, seed: 304, t0: 2.84, t1: 3.46 });
    wr('1900', 34, 246, { size: 26, seed: 305, t0: 3.9, t1: 4.16 });
    wr('✗', 112, 246, { size: 24, seed: 306, t0: 4.26, t1: 4.36 });
    wr('2000', 178, 246, { size: 26, seed: 307, t0: 4.62, t1: 4.88 });
    wr('✓', 256, 246, { size: 30, seed: 308, t0: 4.95, t1: 5.04 });
    const red = { tool: 'red', w: 3, bfps: 10 };
    wr('Feb 29', 300, 292, Object.assign({ size: 46, hand: 'scrawl', seed: 309, t0: 5.5, t1: 6.08, rot: -5 }, red));
    const s0 = P(296, 304), s1 = P(470, 296);
    L.push(SB.stroke([s0[0], s0[1], s0[0] + 60, s0[1] + 5, s1[0] - 30, s1[1] - 2, s1[0], s1[1] - 10, s1[0] - 8, s1[1] - 16, s1[0] - 14, s1[1] - 6, s1[0] + 10, s1[1] + 4], Object.assign({ t0: 6.16, dur: 0.3, seed: 310 }, red)));
    // a small sun on the page beside the card, smiling: the calendar and the sky agree again
    const sx = 846, sy = 236;
    SB.sun(L, sx, sy, 24, 6.78, { seed: 311, rays: 7, rayScale: 0.75, bfps: 10, fillDur: 0.3 });
    SB.fitMarks(L, L.length - 9, 6.78, 7.42);
    L.push(SB.stroke([sx - 8, sy - 5, sx - 7, sy - 2], { t0: 7.5, dur: 0.04, tool: 'fine', w: 2, seed: 312 }));
    L.push(SB.stroke([sx + 6, sy - 5, sx + 7, sy - 2], { t0: 7.58, dur: 0.04, tool: 'fine', w: 2, seed: 313 }));
    L.push(SB.stroke([sx - 10, sy + 5, sx, sy + 11, sx + 10, sy + 4], { t0: 7.66, dur: 0.1, tool: 'fine', w: 1, seed: 314 }));
    DEFS[7] = {
      marks: L, dur: 8.8, pace: 1.08, title: 'The rule', role: 'payoff',
      note: 'An index card clipped into the book, neat print: the whole rule, 1900 no, 2000 yes. One red word: Feb 29, with a swash. A small sun beside the card smiles. Held quiet frame.',
      lines: [[0, 4.4, 'The fix: century years skip the leap day, unless they divide by 400.'], [4.4, 99, '1900, no. 2000, yes. That\'s why there is a February 29.']],
      render: (b, t) => {
        SB.setView(480, 270, 1);
        SB.drawStock(b, 'lined');
        SB.dropShadow(b, pl, CW, CH, 3, 5);
        SB.sheet(b, pl, CW, CH, { col: C.PAPER, fib: C.FIBRE, fo: 777 });
        SB.printLine(b, pl, 0, 66, CW, 66, C.MARGIN);
        SB.printLine(b, pl, 0, 67, CW, 67, C.MARGIN, 0.6);
        for (let v = 66 + 34; v < CH - 4; v += 34) SB.printLine(b, pl, 0, v + 12, CW, v + 12, C.RULE);
        const act = SB.drawMarks(b, L, t);
        const cp = P(404, -18);
        SB.clip(b, cp[0], cp[1], 7, 1.15);
        SB.drawPen(b, SB.penState(L, t, act));
      },
    };
  })();
})();

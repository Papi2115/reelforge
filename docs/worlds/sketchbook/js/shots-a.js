/* sketchbook - pages 1-4. Each shot: marks built once (data), render(b, t) is a pure function of shot time.
   Choreography is written as time budgets [t0, t1]; the hand's pace inside a budget comes from the seeded writer. */
'use strict';
(function () {
  const SB = window.SB, C = SB.C, E = SB.ease;
  const DEFS = (SB.SHOT_DEFS = SB.SHOT_DEFS || []);
  const basic = (stock, L, extra) => (b, t) => {
    SB.setView(480, 270, 1);
    SB.drawStock(b, stock);
    if (extra) extra(b, t, 'under');
    const act = SB.drawMarks(b, L, t);
    if (extra) extra(b, t, 'over');
    SB.drawPen(b, SB.penState(L, t, act));
  };
  SB.basicPage = basic;

  // ---------- 1 HOOK (C+A): lined page. "365?" slapped down in marker, the red pen inserts ".24" ----------
  (function () {
    const L = [];
    SB.pageNumber(L, 1, 101);
    const rot = -3, ra = (rot * Math.PI) / 180;
    const big = { x: 132, y: 356, size: 172, hand: 'marker', tool: 'marker', rot: rot, seed: 11, len: 19, deg: -42, thick: 3, bfps: 10 };
    SB.write(L, '365', Object.assign({ t0: 0.22, t1: 1.22 }, big));
    const w = SB.layoutText('365', big).w;
    const along = (d) => [132 + d * Math.cos(ra), 356 + d * Math.sin(ra)];
    const q = along(w + 46);
    SB.write(L, '?', { x: q[0], y: q[1] + 2, size: 176, hand: 'marker', tool: 'marker', rot: 6, seed: 12, len: 19, deg: -42, thick: 3, t0: 1.42, t1: 1.72 });
    // the red pen: strike the doubt, a caret into the gap, ".24" above it
    const red = { tool: 'red', w: 3, bfps: 10 };
    const qx = q[0], qy = q[1];
    L.push(SB.stroke([qx - 8, qy - 150, qx + 40, qy - 70, qx + 84, qy - 8], Object.assign({ t0: 2.62, dur: 0.15, seed: 21 }, red)));
    L.push(SB.stroke([qx + 80, qy - 158, qx + 34, qy - 82, qx - 6, qy - 4], Object.assign({ t0: 2.86, dur: 0.14, seed: 22 }, red)));
    const g = along(w + 20);
    const top = g[1] - 170;
    L.push(SB.stroke([g[0] - 15, top - 16, g[0] + 1, top + 8, g[0] + 16, top - 17], Object.assign({ t0: 3.1, dur: 0.14, corners: [false, true, false], seed: 23 }, red)));
    const ins = { x: g[0] - 34, y: top - 44, size: 92, hand: 'scrawl', tool: 'red', w: 4, rot: -5, seed: 25, bfps: 10 };
    SB.write(L, '.24', Object.assign({ t0: 3.36, t1: 3.98 }, ins));
    const iw = SB.layoutText('.24', ins).w;
    SB.underline(L, g[0] - 30, g[0] - 24 + iw + 12, top - 33, Object.assign({ t0: 4.1, dur: 0.17, seed: 26, sag: 3, w: 3 }, red));
    // afterthought in pencil, under the line
    SB.write(L, 'not quite.', { x: 306, y: 455, size: 27, hand: 'scrawl', tool: 'pencil', rot: -2, seed: 27, t0: 4.9, t1: 5.72 });
    const smudge = along(w * 0.62);
    DEFS[0] = {
      marks: L, dur: 7.0, title: 'Hook: 365?', role: 'C+A', trans: { type: 'flip', d: 0.62 },
      note: 'Lined page. Marker slams "365?", one held beat, then the red correcting pen strikes the doubt and inserts ".24". Pencil afterthought.',
      lines: [[0.2, 2.9, 'A year has 365 days.'], [2.9, 7.0, 'Except it doesn\'t. Not quite.']],
      render: basic('lined', L, (b, tt, phase) => {
        if (phase === 'under' && tt > 0.98) SB.smudge(b, smudge[0] + 4, smudge[1] + 30, 40, 10, -16, 5, C.GRAPH_L, 0.6);
      }),
    };
  })();

  // ---------- 2 A: the farmer, the Sun, and a year that does not close ----------
  (function () {
    const L = [];
    SB.pageNumber(L, 2, 102, 'fine');
    const F = { x: 176, y: 452, h: 222, seed: 31, bfps: 12, brows: true };
    const up = (t) => E.inOut(SB.seg(t, 4.7, 5.15));
    const puzzled = (t) => SB.seg(t, 6.86, 6.9);
    F.pose = (t) => {
      const k = up(t), q = puzzled(t);
      return {
        lean: -2 - 4 * k, head: -5 * k + 9 * q, face: 0.55, look: 0.1 - 1.1 * k,
        // points at the Sun once it is drawn; scratches his head when the year comes up short
        armR: q > 0 ? [150, 232] : [SB.lerp(26, 126, k), SB.lerp(10, 118, k)], armL: [-52, -20], legL: [-11, -3], legR: [13, 5],
      };
    };
    F.expr = (t) => (puzzled(t) > 0 ? { eyes: 'dot', mouth: 'o', brow: -1 } : { eyes: 'dot', mouth: 'flat', brow: up(t) > 0.5 ? 1 : 0 });
    const fig = SB.figure(L, Object.assign({ t0: 0.25, t1: 1.85 }, F));
    const J = fig.J;
    // hoe in the left hand
    L.push(SB.stroke(null, { fn: (tt) => { const h = J(tt).armL[2]; return [h[0] - 10, h[1] - 120, h[0], h[1], h[0] + 7, h[1] + 76]; }, t0: 1.92, dur: 0.18, seed: 33, bfps: 12 }));
    L.push(SB.stroke(null, { fn: (tt) => { const h = J(tt).armL[2]; return [h[0] + 7, h[1] + 76, h[0] - 16, h[1] + 80, h[0] - 24, h[1] + 71]; }, t0: 2.16, dur: 0.09, corners: [false, true, false], seed: 34, bfps: 12 }));
    // straw hat follows the head
    const hatP = (tt) => {
      const j = J(tt), a = (j.headA * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hr = j.hr;
      return { P: (u, v) => [j.head[0] + (u * c - v * s) * hr, j.head[1] + (u * s + v * c) * hr] };
    };
    L.push(SB.stroke(null, { fn: (tt) => { const { P } = hatP(tt); return [...P(-2.5, -0.42), ...P(-1.2, -0.62), ...P(0.2, -0.66), ...P(1.5, -0.66), ...P(2.6, -0.5)]; }, t0: 2.32, dur: 0.14, seed: 35, bfps: 12 }));
    L.push(SB.stroke(null, { fn: (tt) => { const { P } = hatP(tt); return [...P(-1.0, -0.56), ...P(-0.78, -1.38), ...P(0.1, -1.66), ...P(0.92, -1.36), ...P(1.1, -0.64)]; }, t0: 2.5, dur: 0.16, seed: 36, bfps: 12 }));
    // ground and field
    L.push(SB.stroke([48, 455, 140, 451, 230, 454, 318, 449, 352, 452], { t0: 2.75, dur: 0.28, seed: 37, bfps: 12 }));
    L.push(SB.fill([46, 458, 350, 454, 356, 500, 44, 502], { col: C.GREEN, t0: 3.08, dur: 0.42, sp: 3, seed: 38, dir: 1 }));
    L.push(SB.fill([0, 0], { polyFn: (tt) => { const { P } = hatP(tt); return [...P(-0.95, -0.6), ...P(-0.72, -1.36), ...P(0.1, -1.62), ...P(0.88, -1.32), ...P(1.05, -0.66)]; }, col: C.STICKY_D, t0: 3.56, dur: 0.2, sp: 2, seed: 39 }));
    // the Sun, then the year as a loop that falls short
    SB.sun(L, 664, 232, 40, 3.85, { seed: 41, bfps: 12, fillDur: 0.36 });
    SB.fitMarks(L, L.length - 11, 3.85, 4.62);
    const ox = 630, oy = 250, rx = 262, ry = 120, rot = -0.07, a0 = (160 * Math.PI) / 180, span = (334 * Math.PI) / 180;
    const orb = (a, wob) => [ox + Math.cos(a) * rx * Math.cos(rot) - Math.sin(a) * ry * Math.sin(rot) + (wob || 0), oy + Math.cos(a) * rx * Math.sin(rot) + Math.sin(a) * ry * Math.cos(rot) + (wob || 0)];
    const e0 = orb(a0);
    L.push(SB.stroke(SB.ellipsePts(e0[0], e0[1], 10, 9.5, 10, 0, 1).concat([e0[0] + 11, e0[1] - 3]), { t0: 4.7, dur: 0.13, seed: 42, tool: 'fine', w: 2 }));
    L.push(SB.fill(SB.ellipsePts(e0[0] + 1, e0[1], 8.5, 8, 10), { col: C.SKY, t0: 4.86, dur: 0.14, sp: 2, seed: 43 }));
    const path = [];
    for (let i = 0; i <= 36; i++) { const p = orb(a0 + 0.035 + (i / 36) * span, SB.rnd(-1.2, 1.2, 44, i)); path.push(p[0], p[1]); }
    const ta = SB.arrow(L, path, { t0: 5.1, dur: 1.0, seed: 45, ease: 'sine', head: 14, bfps: 12 });
    SB.write(L, '365 days', { x: 548, y: 112, size: 25, hand: 'scrawl', tool: 'felt', rot: -3, seed: 46, t0: ta + 0.12, t1: ta + 0.7 });
    // a beat. then the red pen closes the gap and names it
    const red = { tool: 'red', w: 2, bfps: 12 };
    let rt = 7.22;
    for (let d = 0; d < 3; d++) {
      const aa = a0 + span + 0.1 + d * 0.11, ab = aa + 0.065;
      const p1 = orb(aa), p2 = orb(ab);
      L.push(SB.stroke([p1[0], p1[1], p2[0], p2[1]], Object.assign({ t0: rt, dur: 0.05, seed: 47 + d, smooth: false }, red)));
      rt += 0.08 + d * 0.025;
    }
    SB.write(L, '+¼ day', Object.assign({ x: 366, y: 404, size: 36, hand: 'scrawl', rot: -5, seed: 50, t0: 7.56, t1: 8.06, w: 3 }, red));
    // the farmer's question mark
    SB.write(L, '?', { x: 206, y: 196, size: 34, hand: 'scrawl', tool: 'felt', rot: 10, seed: 52, t0: 6.88, t1: 7.02 });
    DEFS[1] = {
      marks: L, dur: 8.8, pace: 1.15, title: 'A quarter day', role: 'A', trans: { type: 'riffle', d: 0.8 },
      note: 'Cartridge page drawing itself: a farmer, the Sun, the year as a loop that stops short. Red dashes close the gap: +1/4 day.',
      lines: [[0, 4.6, 'Earth takes about 365 and a quarter days to go round the Sun.'], [4.6, 99, 'Count only 365, and the dates drift off the seasons.']],
      render: basic('cartridge', L),
    };
  })();

  // ---------- 3 B: graph paper, blue ballpoint, the maths of the quarter ----------
  (function () {
    const L = [];
    SB.pageNumber(L, 3, 103, 'bic');
    const bic = { tool: 'bic', bfps: 8, boil: 0.6 };
    const head = Object.assign({ x: 106, y: 108, size: 21, hand: 'print', seed: 61 }, bic);
    SB.write(L, '1 year = 365.2422 days', Object.assign({ t0: 0.2, t1: 1.62 }, head));
    const span = SB.textSpan('1 year = 365.2422 days', head, 13, 17);
    // highlighter sweep over the fraction that matters (under the ink, overshoots a little)
    L.push(SB.stroke([span.x0 - 6, 100, (span.x0 + span.x1) / 2, 98.5, span.x1 + 10, 99.5], { tool: 'hi', t0: 1.78, dur: 0.3, seed: 62, layer: -1, ease: 'out', bfps: 8 }));
    // four year-boxes, ruled; each holds the leftover quarter days piling up
    const bx = [106, 190, 275, 358], by = 180, bs = 60, fr = [0.2422, 0.4844, 0.7266, 0.9688];
    const ruler0 = 2.12;
    const boxT = [2.4, 2.68, 2.93, 3.22];
    for (let i = 0; i < 4; i++) {
      const x = bx[i] + (i === 2 ? 1 : 0), y = by + (i === 3 ? -1 : 0), o = Object.assign({ seed: 63 + i * 7 }, bic);
      L.push(SB.stroke([x, y, x + bs + (i === 1 ? 2 : 0), y, x + bs, y + bs, x - 1, y + bs + 1, x, y - 2], Object.assign({ t0: boxT[i], dur: 0.22 + i * 0.02, smooth: false, ease: 'lin' }, o)));
    }
    const rulerOut = 3.5;
    const fillT = [3.62, 3.86, 4.12, 4.44];
    for (let i = 0; i < 4; i++) {
      const top = by + bs - bs * fr[i];
      L.push(SB.fill([bx[i] + 2, top, bx[i] + bs - 2, top, bx[i] + bs - 2, by + bs - 2, bx[i] + 2, by + bs - 2], { col: C.BIC_L, t0: fillT[i], dur: 0.16 + i * 0.04, sp: 3, dir: -1, seed: 70 + i, pen: 'bic' }));
    }
    for (let i = 0; i < 4; i++) SB.write(L, 'yr ' + (i + 1), Object.assign({ x: bx[i] + 15 + (i % 2) * 2, y: by + 86, size: 14, hand: 'print', seed: 75 + i, t0: 4.76 + i * [0.1, 0.08, 0.11, 0.09][i] * 1.1 + i * 0.02, t1: 4.86 + i * 0.1 + 0.1 }, bic));
    // the multiplication
    SB.write(L, '0.2422 × 4 = 0.9688', Object.assign({ x: 490, y: 216, size: 21, hand: 'print', seed: 81, t0: 5.25, t1: 6.3 }, bic));
    // beat, then the red pen: about one whole day
    const red = { tool: 'red', w: 2, bfps: 8 };
    const res = { x: 604, y: 296, size: 30, hand: 'print', seed: 83, rot: -2 };
    SB.write(L, '≈ 1 day', Object.assign({ t0: 6.72, t1: 7.2 }, res, red));
    const rw = SB.layoutText('≈ 1 day', res).w;
    SB.loop(L, 604 + rw / 2, 284, rw / 2 + 22, 30, Object.assign({ t0: 7.26, dur: 0.34, seed: 84, a0: -2.9 }, red));
    // the rule it implies, and its name
    const rule = Object.assign({ x: 106, y: 402, size: 23, hand: 'print', seed: 85 }, bic);
    SB.write(L, '+1 day every 4 years', Object.assign({ t0: 7.78, t1: 8.72 }, rule));
    const rlw = SB.layoutText('+1 day every 4 years', rule).w;
    const ul = 8.8;
    SB.ruled(L, 102, 414, 110 + rlw, 413, Object.assign({ t0: ul, dur: 0.2, seed: 86 }, bic));
    const ta = SB.arrow(L, [664, 322, 650, 350, 616, 372], Object.assign({ t0: 9.12, dur: 0.16, seed: 87, head: 12 }, red));
    SB.write(L, 'leap day!', Object.assign({ x: 440, y: 410, size: 36, hand: 'scrawl', seed: 88, rot: -4, t0: ta + 0.04, t1: ta + 0.5, w: 3 }, red));
    // clear plastic ruler: slides in under the boxes and out again; once more for the rule's underline
    const rulerAt = (tt, a, z, y, x1) => {
      const inK = E.out(SB.seg(tt, a - 0.3, a)), outK = E.in(SB.seg(tt, z, z + 0.32));
      if (inK <= 0 || outK >= 1) return null;
      return { x: -560 + (560 + x1) * inK + 760 * outK, y: y };
    };
    const drawRuler = (b, r) => {
      if (!r) return;
      const x0 = r.x, x1 = r.x + 480, y0 = r.y + 1, y1 = r.y + 31;
      SB.setMode(2, SB.SOFT);
      SB.fillPoly(b, [x0 + 4, y1, x1 + 4, y1, x1 + 4, y1 + 4, x0 + 4, y1 + 4], 0);
      SB.fillPoly(b, [x0, y0, x1, y0, x1, y1, x0, y1], 0);
      SB.setMode(0);
      for (let x = Math.ceil(x0); x < x1; x++) { SB.put(b, x, y0, C.GRAPH_L); SB.put(b, x, y1, C.GRAPH_L); }
      for (let k = 0; k * 6 < x1 - x0 - 8; k++) {
        const x = Math.round(x0 + 6 + k * 6), len = k % 10 === 0 ? 9 : k % 5 === 0 ? 6 : 3;
        for (let y = 0; y < len; y++) SB.put(b, x, y0 + 1 + y, C.GRAPHITE);
      }
    };
    DEFS[2] = {
      marks: L, dur: 9.0, pace: 1.3, title: 'The maths', role: 'B', trans: { type: 'eraser', d: 0.8 },
      note: 'Graph paper, blue ballpoint, a clear ruler: 365.2422, four quarter-days filling four boxes, 0.2422 x 4. Red: about one day - the leap day.',
      lines: [[0, 5.2, 'A quarter day a year: in 4 years, that\'s almost one whole day.'], [5.2, 99, 'So: add one day every fourth year. The leap day.']],
      render: (b, tt) => {
        SB.setView(480, 270, 1);
        SB.drawStock(b, 'graph');
        SB.drawMarks(b, L, tt, null, -1);
        const act = SB.drawMarks(b, L, tt, null, 0);
        drawRuler(b, rulerAt(tt, ruler0 + 0.25, rulerOut, 242, 30));
        drawRuler(b, rulerAt(tt, ul, ul + 0.3, 416, 40));
        SB.drawPen(b, SB.penState(L, tt, act));
      },
    };
  })();

  // ---------- 4 A: Caesar, 45 BC, the decree - and a margin note that already doubts it ----------
  (function () {
    const L = [];
    SB.pageNumber(L, 4, 104, 'fine');
    const yr = { x: 404, y: 104, size: 58, hand: 'print', tool: 'felt', w: 3, rot: -2, seed: 91, bfps: 12 };
    SB.write(L, '45 BC', Object.assign({ t0: 0.2, t1: 0.86 }, yr));
    const yw = SB.layoutText('45 BC', yr).w;
    SB.underline(L, 400, 410 + yw, 122, { t0: 0.94, dur: 0.17, seed: 92, w: 2, hook: 0, bfps: 12 });
    SB.underline(L, 414, 400 + yw * 0.82, 131, { t0: 1.16, dur: 0.13, seed: 93, w: 2, hook: 0, bfps: 12 });
    // Caesar: chin up, eyes shut with pride, fist on hip, decree raised (one pump with anticipation)
    const pump = (tt) => 7 * E.inOut(SB.seg(tt, 5.62, 5.78)) - 19 * E.back(SB.seg(tt, 5.78, 6.08), 2.4) + 12 * E.inOut(SB.seg(tt, 6.2, 6.6));
    const F = { x: 236, y: 468, h: 252, seed: 95, bfps: 12, brows: true, belly: 6 };
    F.pose = (tt) => { const l = pump(tt); return { lean: -4, head: -8, face: 0.45, look: -0.35, armR: [128 + l * 0.5, 160 + l * 0.9], armL: [-66, 54], legL: [-9, -2], legR: [14, 7] }; };
    F.expr = () => ({ eyes: 'closed', happy: true, mouth: 'smile', brow: -1 });
    const fig = SB.figure(L, Object.assign({ t0: 1.36, t1: 2.66 }, F));
    const J = fig.J;
    // laurel: two sprays of leaves around the head (green pencil)
    let t = 2.72;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        L.push(SB.stroke(null, {
          fn: (tt) => {
            const j = J(tt), a = ((side < 0 ? 194 - k * 22 : -14 + k * 22) * Math.PI) / 180, r = j.hr * 1.05;
            const cx = j.head[0] + Math.cos(a) * r, cy = j.head[1] + Math.sin(a) * r - j.hr * 0.18;
            const ta = a + (side < 0 ? 1.0 : -1.0), l = j.hr * 0.5;
            const nx = -Math.sin(ta) * 3.2, ny = Math.cos(ta) * 3.2;
            return [cx, cy, cx + Math.cos(ta) * l * 0.5 + nx, cy + Math.sin(ta) * l * 0.5 + ny, cx + Math.cos(ta) * l, cy + Math.sin(ta) * l, cx + Math.cos(ta) * l * 0.5 - nx, cy + Math.sin(ta) * l * 0.5 - ny, cx + 0.5, cy + 0.5];
          },
          t0: t, dur: 0.05, tool: 'cpencil', col: C.GREEN, w: 2, seed: 100 + side * 10 + k, bfps: 12,
        }));
        t += SB.rnd(0.035, 0.07, 101, side, k);
      }
    }
    // tunic: A-line from the shoulders to the knees, and a purple sash across it
    const tun = (tt) => { const j = J(tt); return { s: j.sh, kL: j.legL[1], kR: j.legR[1], h: j.hip }; };
    L.push(SB.stroke(null, { fn: (tt) => { const q = tun(tt); return [q.s[0] - 10, q.s[1] + 5, q.kL[0] - 16, q.kL[1] - 4, q.kR[0] + 14, q.kR[1] - 7, q.s[0] + 11, q.s[1] + 3]; }, t0: 3.28, dur: 0.26, corners: [false, true, true, false], seed: 110, bfps: 12 }));
    const sash = (tt) => { const q = tun(tt); return [q.s[0] - 10, q.s[1] + 2, q.s[0] - 1, q.s[1] - 5, q.h[0] + 17, q.h[1] + 3, q.h[0] + 10, q.h[1] + 17]; };
    L.push(SB.fill([0, 0], { polyFn: sash, col: C.PURPLE, t0: 3.6, dur: 0.24, sp: 2, seed: 111, dir: -1 }));
    // the decree: a scroll hanging from the raised hand, carried by it
    const hand = (tt) => J(tt).armR[2];
    const base = hand(0);
    const sc = [];
    const S0 = [base[0] + 14, base[1] - 2];
    sc.push(SB.stroke(SB.ellipsePts(base[0] + 5, base[1] - 1, 7, 6, 9, 0, 2).concat([base[0] + 11, base[1] - 5]), { t0: 3.86, dur: 0.06, seed: 119, bfps: 12 }));
    const sw = 168, sh = 150;
    sc.push(SB.stroke([S0[0], S0[1], S0[0] + sw, S0[1] - 6], { t0: 3.92, dur: 0.15, seed: 120, smooth: false, bfps: 12 }));
    sc.push(SB.stroke([S0[0] + sw, S0[1] - 6, S0[0] + sw + 8, S0[1] - 1, S0[0] + sw + 1, S0[1] + 5, S0[0] + sw - 6, S0[1] + 1], { t0: 4.1, dur: 0.08, seed: 121, bfps: 12 }));
    sc.push(SB.stroke([S0[0] + 8, S0[1] + 2, S0[0] + 12, S0[1] + sh], { t0: 4.22, dur: 0.12, seed: 122, bfps: 12 }));
    sc.push(SB.stroke([S0[0] + sw - 9, S0[1] + 1, S0[0] + sw - 4, S0[1] + sh - 2], { t0: 4.37, dur: 0.12, seed: 123, bfps: 12 }));
    sc.push(SB.stroke([S0[0] + 6, S0[1] + sh, S0[0] + 88, S0[1] + sh + 6, S0[0] + sw + 4, S0[1] + sh - 3, S0[0] + sw + 10, S0[1] + sh + 5, S0[0] + sw - 2, S0[1] + sh + 11], { t0: 4.52, dur: 0.18, seed: 124, bfps: 12 }));
    const tx = { x: S0[0] + 24, y: S0[1] + 40, size: 16, hand: 'print', tool: 'felt', seed: 125, bfps: 12 };
    SB.write(sc, 'EVERY 4TH', Object.assign({ t0: 4.76, t1: 5.06 }, tx));
    SB.write(sc, 'YEAR:', Object.assign({}, tx, { y: tx.y + 25, seed: 126, t0: 5.1, t1: 5.27 }));
    SB.write(sc, '+1 DAY', Object.assign({}, tx, { y: tx.y + 84, x: tx.x - 2, size: 34, tool: 'red', w: 3, seed: 127, rot: -3, t0: 5.34, t1: 5.6 }));
    SB.carry(sc, (tt) => { const h = hand(tt); return [h[0] - base[0], h[1] - base[1]]; });
    L.push(...sc);
    // who he is
    SB.write(L, 'Julius Caesar', { x: 330, y: 452, size: 21, hand: 'scrawl', tool: 'pencil', rot: -3, seed: 130, t0: 6.12, t1: 6.6 });
    SB.arrow(L, [324, 440, 306, 432, 290, 414], { tool: 'pencil', t0: 6.66, dur: 0.12, seed: 131, head: 9 });
    // the margin: pencil-ruled, and a doubt written in it
    L.push(SB.stroke([756, 24, 752, 512], { tool: 'pencil', t0: -5, dur: 0.01, hand: false, smooth: false, seed: 132 }));
    SB.write(L, 'a bit', { x: 772, y: 212, size: 19, hand: 'scrawl', tool: 'pencil', seed: 133, t0: 6.98, t1: 7.2, rot: -3 });
    SB.write(L, 'too much...', { x: 768, y: 240, size: 19, hand: 'scrawl', tool: 'pencil', seed: 134, t0: 7.28, t1: 7.66, rot: -2 });
    const mx = 800, my = 296;
    L.push(SB.stroke([mx + 1, my + 24, mx + 2, my + 4, mx + 12, my - 18, mx + 22, my + 4, mx + 23, my + 24, mx + 1, my + 24], { tool: 'pencil', t0: 7.76, dur: 0.2, corners: [false, false, true, false, true, false], seed: 135 }));
    L.push(SB.stroke([mx + 2, my + 17, mx + 22, my + 16], { tool: 'pencil', t0: 7.97, dur: 0.03, seed: 138 }));
    L.push(SB.stroke([mx + 12, my - 4, mx + 12, my + 20], { tool: 'pencil', t0: 7.99, dur: 0.05, seed: 136 }));
    SB.write(L, '→ p.7', { x: 834, y: 318, size: 17, hand: 'scrawl', tool: 'pencil', seed: 137, t0: 8.08, t1: 8.34 });
    DEFS[3] = {
      marks: L, dur: 8.6, pace: 1.13, title: 'Caesar, 45 BC', role: 'A', trans: { type: 'curl', d: 0.7 },
      note: 'Cartridge page: Caesar (laurel, sash, decree) raises "+1 DAY". In the pencil-ruled margin a doubt and a tiny mitre: see p.7.',
      lines: [[0, 5.9, 'In 45 BC, Julius Caesar made it law.'], [5.9, 99, 'Close. But a little too much.']],
      render: basic('cartridge', L),
    };
  })();
})();

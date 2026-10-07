/* sketchbook - doodle helpers shared by the pages: two-stroke arrows, loose loops, underlines, smudges, text spans. */
'use strict';
(function () {
  const SB = window.SB;

  // arrow drawn in two strokes: a curved shaft, then a V head. Returns end time.
  SB.arrow = (list, pts, o) => {
    let t = o.t0;
    const shaft = SB.stroke(pts, Object.assign({}, o, { t0: t, dur: o.dur || undefined }));
    list.push(shaft);
    t += shaft.dur + (o.headGap != null ? o.headGap : 0.06);
    const n = pts.length, x = pts[n - 2], y = pts[n - 1], px = pts[n - 4], py = pts[n - 3];
    const a = Math.atan2(y - py, x - px), L = o.head || 12, spread = o.spread || 0.5;
    const h = [x + Math.cos(a + Math.PI - spread) * L, y + Math.sin(a + Math.PI - spread) * L, x + 1, y, x + Math.cos(a + Math.PI + spread * 0.85) * L * 0.9, y + Math.sin(a + Math.PI + spread * 0.85) * L * 0.9];
    list.push(SB.stroke(h, Object.assign({}, o, { t0: t, dur: 0.09, corners: [false, true, false], seed: (o.seed || 1) + 5 })));
    return t + 0.09;
  };
  // a loose loop around something: more than one turn, never closed neatly
  SB.loop = (list, cx, cy, rx, ry, o) => {
    const n = 20, turns = o.turns || 1.12, a0 = o.a0 != null ? o.a0 : -2.4, pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 * turns, k = 1 + (i / n) * (o.grow || 0.08);
      pts.push(cx + Math.cos(a) * rx * k + SB.rnd(-1.5, 1.5, o.seed || 3, i, 1), cy + Math.sin(a) * ry * k + SB.rnd(-1.5, 1.5, o.seed || 3, i, 2));
    }
    const m = SB.stroke(pts, o);
    list.push(m);
    return o.t0 + m.dur;
  };
  // horizontal-ish underline with a little hook at the end
  SB.underline = (list, x0, x1, y, o) => {
    const hook = o.hook != null ? o.hook : 1;
    const pts = [x0, y + 1, (x0 + x1) / 2, y - 1 + (o.sag || 0), x1, y - 2];
    if (hook) pts.push(x1 - 6, y + 2);
    const m = SB.stroke(pts, Object.assign({ corners: hook ? [false, false, true, false] : null }, o));
    list.push(m);
    return o.t0 + m.dur;
  };
  // ruler-straight line (no smoothing, faint boil)
  SB.ruled = (list, x0, y0, x1, y1, o) => {
    const m = SB.stroke([x0, y0, x1, y1], Object.assign({ smooth: false, boil: 0.4, ease: 'lin' }, o));
    list.push(m);
    return o.t0 + m.dur;
  };
  // horizontal extent of characters [from, to) of a laid-out string
  SB.textSpan = (str, o, from, to) => {
    const lay = SB.layoutText(str, o);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of lay.strokes) {
      if (s.ci < from || s.ci >= to) continue;
      for (let i = 0; i < s.pts.length; i += 2) { x0 = Math.min(x0, s.pts[i]); x1 = Math.max(x1, s.pts[i]); y0 = Math.min(y0, s.pts[i + 1]); y1 = Math.max(y1, s.pts[i + 1]); }
    }
    return { x0: x0, x1: x1, y0: y0, y1: y1, w: lay.w };
  };
  // dragged smudge (wet ink or graphite under the side of a hand), static once it appears
  SB.smudge = (b, x, y, w, h, deg, seed, col, density) => {
    const pl = SB.placement(x, y, deg, 1);
    const poly = SB.xformPts(SB.ellipsePts(0, 0, w / 2, h / 2, 16), pl.xf);
    SB.fillPoly(b, poly, (px, py) => {
      const uv = pl.inv(px + 0.5, py + 0.5), r = Math.hypot(uv[0] / (w / 2), uv[1] / (h / 2));
      const streak = SB.hash(Math.round(uv[1] * 0.9), seed, 2) * 0.5 + 0.5;
      return SB.hash(px, py, seed) < (density || 0.5) * (1 - r * r) * streak ? col : -1;
    });
  };
  // offset a mark list by a time-dependent translation (things carried by a hand)
  SB.carry = (marks, off) => {
    for (const m of marks) {
      const src = m.pts, corners = m.corners;
      m.fn = (t) => { const d = off(t); return { pts: src.map((v, i) => v + (i % 2 ? d[1] : d[0])), corners: corners }; };
      m.pts = src;
    }
    return marks;
  };
})();

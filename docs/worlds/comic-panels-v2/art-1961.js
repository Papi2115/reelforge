/* comic-panels v2 showcase - art for the 1961 flashback. Drawn with the normal inks; the shot pushes
 * the frame through the sepia duotone map afterwards (page.js SEPIA), so ink = brown key plate,
 * the tint inks = one tan screen.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, rnd, rndRange, halftone, layer, dither, boil } = CP;
  const { local, inkPoly, inkLine, glove, NO_ROT } = CP.art;

  /** Panel A: the speech, seen from the audience - big dark heads in front, a small lit lectern far off. */
  function hall(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'hall';
    // Drapes behind the rostrum: vertical folds as bands of the tint screen.
    F.rect(-10, -10, 620, 110, layer(halftone(C.CYAN_D, local(K, (lx) => 0.18 + 0.2 * Math.abs(Math.sin(lx / 11 + Math.sin(lx / 37)))), { cell: 4, angle: 0.4 }), C.AGED));
    // The rostrum: a long wooden front with a lit top edge.
    F.poly([200, 58, 600, 54, 600, 100, 200, 100], layer(halftone(C.INK, 0.22, { cell: 3, angle: 0.9 }), C.MOON_D));
    F.poly([200, 58, 600, 54, 600, 58, 200, 62], C.MOON_L);
    inkLine(K, [200, 58, 600, 54], key + 'ros');
    // The lectern and its cluster of microphones, all leaning toward one mouth (drawn 1.3x).
    const S = K.at(412, 6, 1.3);
    const Sf = S.shift(mis[0], mis[1]);
    Sf.poly([-20, 40, 20, 40, 25, 74, -25, 74], C.AGED);
    Sf.poly([-20, 40, 20, 40, 21, 44, -21, 44], C.MOON_L);
    inkPoly(S, [-20, 40, 20, 40, 25, 74, -25, 74], key + 'lec', S.w(1), 0.4);
    // The speaker: frontal, lit from above, dark suit, white shirt; one hand on the lectern edge.
    Sf.poly([-17, 40, -15, 25, -7, 20, 7, 20, 15, 25, 17, 40], C.NIGHT);
    Sf.poly([-3, 20, 3, 20, 1, 31, -1, 31], C.PAPER);
    S.line(0, 22, 0, 30, C.INK, 1);
    Sf.ellipse(0, 11, 5.5, 7, C.SHADE);
    S.poly([-6, 9, -5, 3, 0, 2, 5, 3, 6, 8, 2, 5, -3, 6], C.INK);
    S.rect(-3, 11, 2, 1, C.INK);
    S.rect(2, 11, 2, 1, C.INK);
    S.rect(-1, 15, 3, 1, C.MOON_D);
    inkPoly(S, CP.ellipsePts(0, 11, 5.5, 7, 14), key + 'head', 1, 0.3);
    Sf.ellipse(-15, 40, 3, 2, C.SHADE);
    Sf.ellipse(16, 40, 3, 2, C.SHADE);
    [[-12, 26], [-6, 23], [6, 24], [12, 27]].forEach(([dx, dy], i) => {
      S.line(dx * 0.35, 40, dx, dy, C.INK, 1);
      S.ellipse(dx, dy - 1, 1.5 + (i % 2) * 0.6, 2, C.INK);
    });
    // Audience in the foreground: big dark heads and shoulders, cut by the panel, framing the speaker.
    const heads = [[58, 50, 22, 1.0], [196, 68, 14, 0.92], [318, 60, 17, 1.05], [520, 56, 20, 0.95]];
    heads.forEach(([hx, hy, r, k], i) => {
      const hk = key + 'h' + i;
      const sh = [hx - r * 2.6, 110, hx - r * 2.1, hy + r * 1.05, hx - r * 0.7, hy + r * 0.72, hx + r * 0.8, hy + r * 0.78, hx + r * 2.2, hy + r * 1.15, hx + r * 2.7, 110];
      K.poly(sh, C.CYAN_D);
      K.ellipse(hx, hy, r * 0.8 * k, r, C.CYAN_D);
      // Rim light from the rostrum lamps on the edge of each head that faces the speaker.
      const side = hx < 412 ? 1 : -1;
      const rim = [];
      for (let a = -1.35; a <= 0.3; a += 0.12) rim.push(hx + side * Math.cos(a) * (r * 0.8 * k - 1), hy + Math.sin(a) * (r - 1));
      CP.polyline(boil(K.map(rim), hk, 0.3), C.MOON_M, 1, false);
      K.ellipse(hx - side * r * 0.8 * k, hy + 3, 2.6, 5, C.INK);
      inkPoly(K, CP.ellipsePts(hx, hy, r * 0.8 * k, r, 22), hk, K.w(1), 0.3);
    });
  }

  /** Panel B: the deadline as a hand-ruled line of years that runs out at the Moon. */
  function yearLine(K, mis, t, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'years';
    F.rect(-10, -10, 600, 100, layer(halftone(C.CYAN, 0.07, { cell: 4, angle: 0.26 }), C.PAPER));
    // The Moon, the only round thing on the page: lit from the left, tint screen on the far side.
    const mx = 512;
    const my = 38;
    const mr = 27;
    F.ellipse(mx, my, mr, mr, layer(halftone(C.MOON_M, local(K, (lx) => Math.max(0, (lx - mx + 6) / mr) * 0.75), { cell: 3, angle: 0.78 }), C.MOON_L));
    for (let i = 0; i < 6; i++) {
      const a = rnd(key, i) * 6.28;
      const d = rnd(key, i + 9) * mr * 0.7;
      const cr = 2 + rnd(key, i + 20) * 4;
      F.ellipse(mx + Math.cos(a) * d, my + Math.sin(a) * d, cr, cr * 0.8, C.MOON_M);
    }
    inkPoly(K, CP.ellipsePts(mx, my, mr, mr, 30), key + 'moon', K.w(1.4), 0.4);
    // Years: ruled by hand (uneven steps), appearing in an uneven rhythm.
    const y0 = 50;
    const xs = [];
    let x = 214;
    for (let i = 0; i < 9; i++) {
      xs.push(x);
      x += 28 + rndRange(key, 40 + i, -3, 3);
    }
    const shown = o.years;
    if (shown > 0) {
      const lastX = xs[Math.min(8, Math.floor(shown))];
      const end = shown >= 9 ? xs[8] + 8 : lastX;
      CP.polyline(boil(K.map([xs[0] - 6, y0 + 1, end, y0 - 1]), key + 'rule', 0.4), C.INK, 1, false);
    }
    for (let i = 0; i < 9 && i < shown; i++) {
      const label = String(1961 + i);
      const lx = K.x(xs[i]) - CP.measure('hand', label, 1, i === 0 || i === 8) / 2;
      K.line(xs[i], y0 - 3, xs[i] + (i % 3) - 1, y0 + 3, C.INK, 1);
      CP.text('hand', label, lx, K.y(y0 + 7), C.INK, { key: key + label, bold: i === 0 || i === 8, jitter: 1 });
    }
    if (o.circle > 0) CP.pencilCircle(K.x(xs[8]), K.y(y0 + 10), 17, 9, o.circle, C.INK, key + 'ring', 1);
    if (o.arrow > 0) CP.handArrow(K.x(xs[8] + 18), K.y(y0 + 2), K.x(mx - mr - 5), K.y(my + 8), o.arrow, C.INK, key + 'arrow', 1);
    return { year1969: [K.x(xs[8]), K.y(y0 + 10)] };
  }

  /**
   * Panel C: an engineer's table. Graph paper, a pencil sketch of the box and its keyboard drawing
   * itself on (p 0..1), a slide rule, a coffee ring; the hand follows the pencil tip.
   */
  function draftingTable(K, mis, p, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'draft';
    F.rect(-10, -10, 600, 140, layer(halftone(C.CYAN_D, local(K, (lx, ly) => 0.12 + 0.1 * Math.sin(ly / 3 + Math.sin(lx / 40) * 2)), { cell: 3, angle: 1.2 }), C.AGED));
    const sheet = [66, 12, 430, 6, 436, 124, 70, 130];
    K.poly(sheet.map((v) => v + 3), C.MOON_D);
    F.poly(sheet, C.PAPER);
    // Grid, faint: dotted rules every 10 px.
    const grid = (gx, gy) => ((gx % 10 === 0 && gy % 2 === 0) || (gy % 10 === 0 && gx % 2 === 0) ? C.SHADE : -1);
    K.poly(sheet, local(K, (lx, ly) => grid(Math.floor(lx - 66), Math.floor(ly - 6))));
    inkPoly(K, sheet, key + 'sheet', 1, 0.3);
    CP.coffeeRing(K.x(408), K.y(100), 15, C.AGED, key + 'cup');
    // The sketch: a flat box in perspective, then the keyboard-and-display unit beside it.
    const strokes = [
      [128, 54, 236, 54, 236, 104, 128, 104, 128, 54],
      [128, 54, 146, 40, 254, 40, 236, 54],
      [254, 40, 254, 90, 236, 104],
      [150, 46, 162, 46, 174, 46, 186, 46, 198, 46, 210, 46, 222, 46, 234, 46],
      [282, 32, 336, 32, 336, 108, 282, 108, 282, 32],
      [288, 38, 330, 38, 330, 64, 288, 64, 288, 38],
      [290, 72, 298, 72, 298, 80, 290, 80, 290, 72, 302, 72, 310, 72, 310, 80, 302, 80, 302, 72, 314, 72, 322, 72, 322, 80, 314, 80, 314, 72],
      [290, 86, 298, 86, 298, 94, 290, 94, 290, 86, 302, 86, 310, 86, 310, 94, 302, 94, 302, 86, 314, 86, 322, 86, 322, 94, 314, 94, 314, 86],
    ];
    const weights = [1.4, 0.8, 0.6, 0.5, 1.2, 0.7, 0.9, 0.9];
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    let tip = null;
    strokes.forEach((s, i) => {
      const a = acc / total;
      acc += weights[i];
      const b = acc / total;
      const q = CP.clamp01((p - a) / (b - a));
      if (q <= 0) return;
      const pts = boil(K.map(s.map((v, j) => v + rndRange(key + i, j, -0.7, 0.7))), key + 's' + i, 0.3);
      CP.strokeOn(pts, q, C.CYAN_D, 1);
      // The main outlines are gone over twice, the second pass never quite on the first.
      if (i < 3) CP.strokeOn(pts.map((v, j) => v + (j % 2 ? 1 : 0)), q * 0.9, C.INK, 1);
      if (q < 1) tip = pointAlong(pts, q);
    });
    if (p >= 0.98) {
      CP.text('hand', 'GUIDANCE COMPUTER', K.x(150), K.y(18), C.CYAN_D, { key: key + 'lbl', slant: 1, jitter: 1.4, reveal: Math.floor(Math.min(17, o.label)) });
      if (!tip && o.label < 17) tip = [K.x(150) + o.label * 6.3, K.y(25)];
      if (o.label >= 17) CP.handArrow(K.x(176), K.y(28), K.x(164), K.y(50), CP.clamp01((o.label - 17) / 1.9), C.CYAN_D, key + 'arr', 1);
    }
    // The slide rule lying on the desk, half on the sheet.
    const rule = [392, 112, 590, 76, 592, 88, 394, 124];
    F.poly(rule, C.MOON_L);
    K.poly([470, 96, 486, 93, 488, 106, 472, 109], dither(-1, C.PAPER, 0.5));
    for (let i = 0; i < 25; i++) {
      const rx = 398 + i * 7.6 + (i % 5 ? 0 : 1);
      const ry = 112 - (rx - 392) * (36 / 198);
      K.line(rx, ry, rx, ry + (i % 5 ? 2 : 4), C.INK, 1);
    }
    inkPoly(K, rule, key + 'rule', 1, 0.3);
    K.line(479, 94, 481, 108, C.INK, 1);
    // The hand holds the pencil at the tip of the current stroke; when done it rests, pencil lifted.
    const [tx, ty] = tip || (p <= 0 ? [K.x(130), K.y(56)] : [K.x(372), K.y(112)]);
    // Before the first stroke the hand is still out of frame; it comes in to start drawing.
    const enter = o.enter === undefined ? 1 : o.enter;
    hand(K, (tx - K.ox) / K.s + (1 - enter) * 190, (ty - K.oy) / K.s - (1 - enter) * 110, key);
  }
  function pointAlong(pts, q) {
    let total = 0;
    for (let i = 2; i < pts.length; i += 2) total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    let left = total * q;
    for (let i = 2; i < pts.length; i += 2) {
      const l = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      if (left <= l) return [pts[i - 2] + ((pts[i] - pts[i - 2]) * left) / l, pts[i - 1] + ((pts[i + 1] - pts[i - 1]) * left) / l];
      left -= l;
    }
    return [pts[pts.length - 2], pts[pts.length - 1]];
  }
  /** A right hand from the upper right, pencil tip at (x,y) in K's local space; rolled shirt sleeve. */
  function hand(K, x, y, key) {
    // Pencil: hexagonal barrel, sharpened cone, graphite point.
    K.line(x + 3, y - 4, x + 24, y - 31, C.INK, K.w(4));
    K.line(x + 3, y - 4, x + 24, y - 31, C.YEL, K.w(2));
    K.line(x, y, x + 4, y - 5, C.MOON_L, K.w(2));
    K.line(x, y, x + 1, y - 1, C.INK, 1);
    glove(K, [
      { c: [x + 74, y - 56, x + 150, y - 92, 15], fill: C.MOON_L },
      { c: [x + 46, y - 38, x + 80, y - 58, 11.5], fill: C.AGED },
      { e: [x + 33, y - 27, 15, 11], fill: C.AGED },
      { c: [x + 9, y - 11, x + 27, y - 23, 4.2], fill: C.AGED },
      { c: [x + 15, y - 6, x + 34, y - 16, 4.2], fill: C.AGED },
      { c: [x + 25, y - 3, x + 43, y - 13, 4], fill: C.AGED },
      { c: [x + 36, y - 3, x + 49, y - 12, 3.6], fill: C.AGED },
    ], NO_ROT, C.AGED, key + 'hand');
    // Knuckle creases and the line where the sleeve is rolled.
    K.line(x + 19, y - 13, x + 23, y - 16, C.INK, 1);
    K.line(x + 29, y - 9, x + 33, y - 12, C.INK, 1);
    K.line(x + 66, y - 46, x + 82, y - 70, C.INK, K.w(1));
    K.line(x + 88, y - 64, x + 104, y - 72, C.MOON_M, 1);
    K.poly([x + 30, y - 36, x + 52, y - 46, x + 56, y - 42, x + 36, y - 31], C.SHADE);
  }

  Object.assign(CP.art, { hall, yearLine, draftingTable, hand });
})();

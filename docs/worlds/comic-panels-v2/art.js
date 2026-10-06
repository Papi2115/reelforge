/* comic-panels v2 showcase (from v1) - the subjects, drawn as ink line art over misregistered colour plates.
 * Convention: K = ink placement (key plate), F = K shifted by the panel's plate offset (colour plates).
 * Colour first through F, ink lines last through K, so the paper shows where the plates slipped.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, rnd, rndRange, halftone, layer, dither, boil } = CP;

  /** Paint whose value depends on local (unscaled) coordinates of placement K. */
  function local(K, fn) {
    return (x, y) => fn((x + 0.5 - K.ox) / K.s, (y + 0.5 - K.oy) / K.s, x, y);
  }
  function inkPoly(K, pts, key, w, amp) {
    CP.polyline(boil(K.map(pts), key, amp), C.INK, w || K.w(1), true);
  }
  function inkLine(K, pts, key, w) {
    CP.polyline(boil(K.map(pts), key), C.INK, w || K.w(1), false);
  }
  function mirror(pts) {
    const out = [];
    for (let i = 0; i < pts.length; i += 2) out.push(-pts[i], pts[i + 1]);
    return out;
  }

  // ---------- Lunar Module "Eagle" (front view, sun from the left) ----------
  function lm(K, mis, o) {
    const opt = o || {};
    const key = opt.key || 'lm';
    const F = K.shift(mis[0], mis[1]);
    const w1 = K.w(1);
    const w2 = K.w(1.7);
    // Legs behind the descent stage.
    for (const side of [-1, 1]) {
      const sx = (x) => x * side;
      CP.line(K.x(sx(-28)), K.y(4), K.x(sx(-49)), K.y(37), C.INK, w2);
      CP.line(K.x(sx(-31)), K.y(20), K.x(sx(-46)), K.y(35), C.INK, w1);
      F.ellipse(sx(-50), 39, 7, 2.4, C.MOON_L);
      inkPoly(K, CP.ellipsePts(sx(-50), 39, 7, 2.4, 14), key + side, w1, 0);
      if (opt.probes) K.line(sx(-50), 41, sx(-50) + side * -1, 52, C.INK, w1);
    }
    // Front (ladder) leg - the only leg without a contact probe.
    CP.line(K.x(-1), K.y(22), K.x(0), K.y(38), C.INK, w2);
    for (let y = 26; y < 37; y += 3.4) K.line(-3, y, 3, y, C.INK, w1);
    F.ellipse(0, 40, 6, 2.2, C.MOON_L);
    inkPoly(K, CP.ellipsePts(0, 40, 6, 2.2, 14), key + 'f', w1, 0);
    // Descent stage: gold foil, magenta dots for the orange shadow side.
    const D = [-31, 0, 31, 0, 33, 3, 33, 21, 31, 24, -31, 24, -33, 21, -33, 3];
    const foil = layer(
      halftone(C.MAG, local(K, (lx, ly) => Math.min(0.62, Math.max(0, (lx + 4) / 46) * 0.55 + (ly > 15 ? 0.18 : 0))), { cell: 3, angle: 1.31 }),
      C.YEL,
    );
    F.poly(D, foil);
    F.poly([-11, 3, 11, 3, 11, 22, -11, 22], dither(C.NIGHT, C.MOON_D, 0.25));
    for (let i = 0; i < 7; i++) {
      const x = rndRange(key, i, -29, 27);
      if (x > -13 && x < 11) continue;
      const y = rndRange(key, i + 20, 3, 20);
      K.line(x, y, x + rndRange(key, i + 40, 1.5, 3.5), y + rndRange(key, i + 60, -1, 1.5), C.INK, w1);
    }
    F.poly([-7, 24, 7, 24, 10, 31, -10, 31], C.MOON_M);
    inkPoly(K, [-7, 24, 7, 24, 10, 31, -10, 31], key + 'bell', w1);
    inkPoly(K, D, key + 'D', w1);
    // Ascent stage.
    const A = [-25, 0, 25, 0, 27, -9, 22, -26, 12, -33, -11, -33, -22, -26, -27, -9];
    F.poly(A, layer(halftone(C.MOON_M, local(K, (lx) => Math.max(0, (lx - 2) / 30) * 0.55), { cell: 3, angle: 0.78 }), C.MOON_L));
    F.poly([-27, -9, -22, -26, -17, -24, -19, -7], C.MOON_D);
    F.poly([27, -9, 22, -26, 17, -24, 19, -7], C.NIGHT);
    F.poly([-13, -4, 13, -4, 15, -22, 7, -29, -7, -29, -15, -22], C.PAPER);
    for (const side of [-1, 1]) {
      const win = side < 0 ? [-14, -25, -3, -25, -4, -15] : mirror([-14, -25, -3, -25, -4, -15]);
      K.poly(win, C.NIGHT);
      inkPoly(K, win, key + 'w' + side, w1, 0);
    }
    K.rect(-12, -24, 1.2, 1.2, C.PAPER);
    F.poly([-5, -12, 5, -12, 5, -3, -5, -3], C.MOON_M);
    inkPoly(K, [-5, -12, 5, -12, 5, -3, -5, -3], key + 'h', w1, 0);
    F.rect(-5, -37, 10, 4, C.MOON_M);
    inkPoly(K, [-5, -37, 5, -37, 5, -33, -5, -33], key + 't', w1, 0);
    inkPoly(K, A, key + 'A', w1);
    // Antennas and thruster quads.
    K.line(10, -33, 14, -39, C.INK, w1);
    F.ellipse(16, -41, 5, 4, C.MOON_L);
    inkPoly(K, CP.ellipsePts(16, -41, 5, 4, 12), key + 'rr', w1, 0);
    K.line(22, -26, 28, -34, C.INK, w1);
    F.ellipse(29, -36, 3.5, 3, C.MOON_L);
    inkPoly(K, CP.ellipsePts(29, -36, 3.5, 3, 10), key + 'sb', w1, 0);
    for (const side of [-1, 1]) {
      const x = 28 * side;
      K.line(x, -22, x, -14, C.INK, w1);
      K.line(x - 3, -18, x + 3, -18, C.INK, w1);
      K.rect(x - 1, -19, 2, 2, C.INK);
    }
  }

  /**
   * Eagle's shadow on the ground under a low sun from the left: the front-view silhouette laid flat
   * and stretched to the right (up -> +x), squashed by the oblique view. Origin = under the engine.
   */
  function lmShadow(K, o) {
    const p = (o && o.paint) || C.MOON_D;
    const stretch = (o && o.stretch) || 2.2;
    const squash = (o && o.squash) || 0.34;
    const flat = (pts) => {
      const out = [];
      for (let i = 0; i < pts.length; i += 2) out.push(-pts[i + 1] * stretch + 70, pts[i] * squash);
      return out;
    };
    K.poly(flat([-33, 3, 33, 3, 33, 22, -33, 22]), p);
    K.poly(flat([-27, -9, -22, -26, -11, -33, 11, -33, 22, -26, 27, -9, 25, 3, -25, 3]), p);
    K.poly(flat([-5, -37, 5, -37, 5, -33, -5, -33]), p);
    K.poly(flat([12, -38, 20, -38, 20, -44, 12, -44]), p);
    for (const side of [-1, 1]) {
      const a = flat([side * 28, 6, side * 49, 37]);
      CP.line(K.x(a[0]), K.y(a[1]), K.x(a[2]), K.y(a[3]), p, K.w(2.4));
    }
    const f = flat([0, 22, 0, 38]);
    CP.line(K.x(f[0]), K.y(f[1]), K.x(f[2]), K.y(f[3]), p, K.w(2.4));
    for (const [px, py] of [[-50, 39], [50, 39], [0, 40]]) {
      const q = flat([px, py]);
      K.ellipse(q[0], q[1], 3, 5 * squash + 1, p);
    }
  }

  // ---------- lunar surface ----------
  function surface(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'surf';
    const hyAt = (x) => o.hy + ((x - o.xc) * (x - o.xc)) / (2 * o.R) + (o.tilt || 0) * x;
    const edge = [];
    for (let x = o.x0; x <= o.x1 + 0.1; x += (o.x1 - o.x0) / 24) edge.push(x, hyAt(x));
    const pts = edge.concat([o.x1, o.yb, o.x0, o.yb]);
    const toneTop = o.toneTop === undefined ? 0.12 : o.toneTop;
    const toneBot = o.toneBot === undefined ? 0.45 : o.toneBot;
    F.poly(pts, layer(halftone(C.MOON_M, local(K, (lx, ly) => toneTop + (toneBot - toneTop) * Math.min(1, Math.max(0, (ly - o.hy) / (o.yb - o.hy)))), { cell: o.cell || 4, angle: 0.78 }), C.MOON_L));
    const n = o.craters === undefined ? 14 : o.craters;
    for (let i = 0; i < n; i++) {
      const x = rndRange(key, i, o.x0, o.x1);
      const depth = rnd(key, i + 50);
      const y = hyAt(x) + 4 + depth * depth * (o.yb - hyAt(x) - 6);
      const r = (2 + depth * 22 * (o.craterScale || 1)) * (0.6 + rnd(key, i + 99) * 0.6);
      crater(K, F, x, y, r, r > 11);
    }
    CP.polyline(boil(K.map(edge), key + 'edge', 0.6), C.INK, K.w(1), false);
    return hyAt;
  }
  /** Bowl seen obliquely, sun from the left: the left inner wall is in shadow, a lit lip on the right. */
  function crater(K, F, x, y, r, strong) {
    const ry = r * 0.4;
    const lx = F.x(x + r * 0.36);
    const ly = F.y(y - ry * 0.1);
    const lr = r * F.s * 0.86;
    const lry = ry * F.s * 0.86;
    const shadow = strong ? C.MOON_D : C.MOON_M;
    const floor = strong ? C.MOON_L : layer(halftone(C.MOON_M, 0.3), C.MOON_L);
    F.ellipse(x, y, r, ry, (sx, sy) => {
      const dx = (sx + 0.5 - lx) / lr;
      const dy = (sy + 0.5 - ly) / lry;
      return dx * dx + dy * dy < 1 ? (typeof floor === 'number' ? floor : floor(sx, sy)) : shadow;
    });
    if (strong && r * K.s > 6) {
      const pts = [];
      for (let i = 0; i <= 9; i++) {
        const a = Math.PI * (0.95 + i * 0.11);
        pts.push(x + Math.cos(a) * r, y + Math.sin(a) * ry);
      }
      CP.polyline(K.map(pts), C.INK, 1, false);
    }
  }
  function boulder(K, mis, x, y, r, key) {
    const F = K.shift(mis[0], mis[1]);
    const pts = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd(key, i) * 0.5;
      const rr = r * (0.75 + rnd(key, i + 10) * 0.35);
      pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.62 - (Math.sin(a) < 0 ? r * 0.2 : 0));
    }
    K.ellipse(x + r * 1.5, y + r * 0.45, r * 1.6, r * 0.22, C.NIGHT);
    F.poly(pts, C.MOON_D);
    const lit = [];
    for (let i = 0; i < pts.length; i += 2) lit.push(x + (pts[i] - x) * 0.7 - r * 0.28, y + (pts[i + 1] - y) * 0.72 - r * 0.1);
    F.poly(lit, C.MOON_L);
    inkPoly(K, pts, key, K.w(1), 0.5);
  }

  // ---------- DSKY (display & keyboard) ----------
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  function seg7(K, x, y, w, h, digit, paint) {
    const s = SEG[digit];
    if (!s) return;
    const t = Math.max(1.2, w * 0.2);
    const m = h / 2;
    const bars = {
      a: [x + t * 0.6, y, w - t * 1.2, t], d: [x + t * 0.6, y + h - t, w - t * 1.2, t], g: [x + t * 0.6, y + m - t / 2, w - t * 1.2, t],
      f: [x, y + t * 0.5, t, m - t * 0.6], b: [x + w - t, y + t * 0.5, t, m - t * 0.6],
      e: [x, y + m + t * 0.1, t, m - t * 0.6], c: [x + w - t, y + m + t * 0.1, t, m - t * 0.6],
    };
    for (const ch of s) {
      const [bx, by, bw, bh] = bars[ch];
      K.poly([bx + 0.4, by, bx + bw, by, bx + bw - 0.4, by + bh, bx, by + bh], paint);
    }
  }
  /** o: { prog: lamp lit?, acty: COMP ACTY lit?, code: '1202', verb, noun, progNo, labels: draw lamp text, codeOn } */
  function dsky(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'dsky';
    F.rect(0, 0, 120, 134, layer(halftone(C.MOON_D, 0.18, { cell: 3, angle: 0.4 }), C.MOON_M));
    F.rect(6, 6, 50, 60, C.MOON_D);
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 2; c++) {
        const lx = 9 + c * 23;
        const ly = 9 + r * 8.1;
        const isProg = c === 1 && r === 2;
        const lit = isProg && o.prog;
        F.rect(lx, ly, 21, 6.2, lit ? C.YEL : r > 4 ? C.NIGHT : C.MOON_L);
        if (lit) K.rect(lx - 1, ly - 1, 23, 8.2, CP.dither(-1, C.YEL_P, 0.25));
        if (isProg && o.labels) {
          const tx = K.x(lx + 10.5) - CP.measure('hand', 'PROG') / 2;
          CP.text('hand', 'PROG', tx, K.y(ly + 3.1) - 3, lit ? C.INK : C.MOON_M, { key: 'prog', jitter: 0 });
        }
      }
    }
    F.rect(62, 6, 52, 60, C.NIGHT);
    if (o.acty) F.rect(65, 9, 18, 13, C.DSKY);
    const dg = (str, x, y, w, h) => {
      for (let i = 0; i < str.length; i++) if (str[i] !== ' ') seg7(K, x + i * (w + 2), y, w, h, str[i], C.DSKY);
    };
    dg(o.progNo || '63', 95, 9, 6, 10);
    dg(o.verb || '05', 65, 26, 6, 10);
    dg(o.noun || '09', 95, 26, 6, 10);
    K.rect(64, 39.5, 48, 0.8, C.CYAN_D);
    if (o.codeOn !== false) dg('0' + (o.code || '1202'), 65, 43, 7, 11);
    K.rect(64, 57.5, 48, 0.8, C.CYAN_D);
    // Keyboard: VERB/NOUN column, 5x3 block, CLR.. column (19 keys).
    const keyRect = (x, y, w, h) => {
      F.rect(x, y, w, h, C.MOON_L);
      CP.polyline(K.map([x, y, x + w, y, x + w, y + h, x, y + h]), C.INK, 1, true);
      K.rect(x + 1, y + h - 1.5, w - 2, 1, C.MOON_M);
    };
    keyRect(6, 80, 13, 15);
    keyRect(6, 100, 13, 15);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) keyRect(22 + c * 15.4, 74 + r * 18, 13, 15);
    keyRect(101, 80, 13, 15);
    keyRect(101, 100, 13, 15);
    inkPoly(K, [0, 0, 120, 0, 120, 134, 0, 134], key, K.w(1.2), 0.5);
    inkPoly(K, [6, 6, 56, 6, 56, 66, 6, 66], key + 'l', 1, 0);
    inkPoly(K, [62, 6, 114, 6, 114, 66, 62, 66], key + 'r', 1, 0);
  }
  CP.art = { lm, lmShadow, surface, crater, boulder, dsky, seg7, local, inkPoly, inkLine, mirror };
})();

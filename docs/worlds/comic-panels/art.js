/* comic-panels showcase - the subjects, drawn as ink line art over misregistered colour plates.
 * Convention: K = ink placement (key plate), F = K shifted by the panel's plate offset (colour plates).
 * Colour first through F, ink lines last through K, so the paper shows where the plates slipped.
 */
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

  // ---------- cockpit: the crew from behind, against the triangular windows ----------
  function cockpit(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'cock';
    F.rect(-10, -10, 380, 170, layer(halftone(C.CYAN_D, 0.3, { cell: 4, angle: 0.26 }), C.NIGHT));
    const winL = [34, 12, 168, 12, 168, 100];
    const winR = [192, 12, 326, 12, 192, 100];
    for (const win of [winL, winR]) {
      const mask = CP.maskPoly(K.map(win), CP.getClip());
      const prev = CP.getClip();
      CP.setClip(mask);
      F.rect(20, 0, 320, 120, C.INK);
      surface(K, mis, { x0: 20, x1: 340, hy: 58 + (o.horizonDy || 0), xc: 180, R: 900, tilt: -0.08, yb: 120, craters: 16, key: key + 'win', craterScale: 0.5 });
      CP.setClip(prev);
      inkPoly(K, win, key + win[0], K.w(1.6), 0.5);
    }
    // Centre post with instrument lamps.
    F.rect(172, 4, 16, 130, C.MOON_D);
    for (let i = 0; i < 5; i++) K.rect(176 + (i % 2) * 6, 20 + i * 15, 3, 3, i === 2 && o.alarmLamp ? C.YEL : C.NIGHT);
    // Commander (left) and LM pilot (right), standing, seen from behind: white suits, clear bubble
    // helmets, the brown-and-white comm caps ("Snoopy caps") with black ear cups inside.
    // Armstrong looks out of his window; Aldrin's head is turned down toward the DSKY between them.
    crewBack(K, F, 104, { headDx: -1, headDy: 0, shoulder: 2 }, key + 'cdr');
    crewBack(K, F, 256, { headDx: -8, headDy: 6, shoulder: -3 }, key + 'lmp');
  }
  function crewBack(K, F, cx, o, key) {
    const sh = o.shoulder;
    const suit = [cx - 58, 170, cx - 54, 120 + sh, cx - 30, 104 + sh * 0.5, cx + 30, 104 - sh * 0.5, cx + 54, 120 - sh, cx + 58, 170];
    F.poly(suit, layer(halftone(C.MOON_M, local(K, (lx) => 0.2 + 0.35 * Math.max(0, (lx - cx) / 58)), { cell: 3, angle: 0.78 }), C.MOON_L));
    F.poly([cx - 54, 120 + sh, cx - 30, 104 + sh * 0.5, cx - 18, 106, cx - 40, 126, cx - 50, 170, cx - 58, 170], C.PAPER);
    K.line(cx + 6, 112, cx + 2, 170, C.MOON_M, K.w(1));
    K.line(cx - 24, 136, cx - 30, 170, C.MOON_M, K.w(1));
    inkPoly(K, suit, key + 's', K.w(1), 0.5);
    // Neck ring.
    F.ellipse(cx, 102, 26, 6, C.MOON_M);
    inkPoly(K, CP.ellipsePts(cx, 102, 26, 6, 18), key + 'r', K.w(1), 0.3);
    // Head in the comm cap: brown shell, white crown panel, black ear cups.
    const hx = cx + o.headDx;
    const hy = 80 + o.headDy;
    F.ellipse(hx, hy, 14, 16, C.AGED);
    F.poly([hx - 5, hy - 15, hx + 5, hy - 15, hx + 4, hy - 2, hx - 4, hy - 2], C.PAPER);
    K.ellipse(hx - 14, hy + 3, 3.5, 6, C.INK);
    K.ellipse(hx + 14, hy + 3, 3.5, 6, C.INK);
    inkPoly(K, CP.ellipsePts(hx, hy, 14, 16, 18), key + 'h', K.w(1), 0.4);
    // Clear bubble helmet fixed to the neck ring: only its rim and window reflections show.
    const bx = cx + o.headDx * 0.3;
    inkPoly(K, CP.ellipsePts(bx, 76, 27, 28, 28), key + 'b', K.w(1), 0.3);
    const arc = (a0, a1, rr, paint) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = a0 + ((a1 - a0) * i) / 8;
        pts.push(bx + Math.cos(a) * rr, 76 + Math.sin(a) * rr);
      }
      CP.polyline(K.map(pts), paint, K.w(1.4), false);
    };
    arc(3.5, 4.4, 24, C.PAPER);
    arc(4.65, 4.85, 24, C.PAPER);
  }

  // ---------- Houston: guidance officer at his console ----------
  function houston(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'hou';
    F.rect(-10, -10, 260, 220, layer(halftone(C.CYAN, 0.22, { cell: 4, angle: 0.26 }), C.CYAN_D));
    // Wall projection screen: the descent plot, dim, texture only.
    F.rect(118, 8, 104, 58, C.NIGHT);
    const plot = [];
    for (let i = 0; i <= 20; i++) plot.push(124 + i * 4.6, 18 + 38 * Math.pow(i / 20, 1.6));
    CP.polyline(K.map(plot), C.CYAN, 1, false);
    inkPoly(K, [118, 8, 222, 8, 222, 66, 118, 66], key + 's', K.w(1), 0.4);
    // Console: sloped desk with two monitors.
    F.poly([-10, 128, 240, 112, 240, 200, -10, 200], C.MOON_M);
    F.poly([-10, 128, 240, 112, 240, 124, -10, 142], C.MOON_L);
    for (const mx of [138, 186]) {
      F.poly([mx, 76, mx + 40, 74, mx + 41, 112, mx + 1, 114], C.MOON_D);
      F.poly([mx + 4, 80, mx + 36, 78, mx + 37, 106, mx + 5, 108], C.NIGHT);
      for (let l = 0; l < 4; l++) K.rect(mx + 8, 84 + l * 5, 12 + rnd(key, mx + l) * 14, 1, C.PAPER);
      inkPoly(K, [mx, 76, mx + 40, 74, mx + 41, 112, mx + 1, 114], key + mx, K.w(1), 0.4);
    }
    inkLine(K, [-10, 128, 240, 112], key + 'desk');
    inkLine(K, [-10, 142, 240, 124], key + 'desk2');
    // Steve Bales from behind, lost profile toward his monitors: white shirt, dark hair, glasses,
    // headset with boom mic. A chair back in front of him gives the panel a foreground layer.
    const L = K.at(o.lean || 0, 0, 1);
    const Lf = L.shift(mis[0], mis[1]);
    const body = [30, 200, 34, 140, 46, 124, 70, 118, 96, 120, 110, 132, 114, 200];
    Lf.poly(body, layer(halftone(C.SHADE, local(L, (lx) => 0.15 + 0.5 * Math.max(0, (lx - 60) / 54)), { cell: 3, angle: 0.78 }), C.PAPER));
    inkPoly(L, body, key + 'body', L.w(1), 0.5);
    // Right arm forward onto the desk: short sleeve, forearm, hand by the console keys.
    glove(L, [
      { c: [110, 136, 136, 132, 5], fill: C.SHADE },
      { e: [140, 130, 6, 4], fill: C.SHADE },
      { c: [100, 128, 110, 138, 8], fill: C.PAPER },
    ], NO_ROT, C.SHADE, key + 'arm');
    L.line(64, 140, 60, 196, C.SHADE, 1);
    L.line(88, 132, 92, 180, C.SHADE, 1);
    Lf.rect(64, 104, 16, 16, C.SHADE);
    Lf.poly([58, 120, 70, 114, 86, 114, 90, 122, 74, 124], C.PAPER);
    inkPoly(L, [58, 120, 70, 114, 86, 114, 90, 122, 74, 124], key + 'collar', L.w(1), 0.3);
    Lf.ellipse(73, 92, 13, 15, C.SHADE);
    Lf.ellipse(83, 96, 4, 9, C.AGED);
    Lf.poly([60, 98, 60, 84, 66, 76, 76, 74, 84, 78, 86, 84, 80, 85, 76, 92, 74, 104, 64, 106], C.INK);
    L.rect(65, 79, 6, 1, C.MOON_D);
    L.ellipse(76, 95, 3, 4, C.AGED);
    L.line(78, 92, 87, 93, C.INK, 1);
    L.rect(86, 91, 2, 4, C.INK);
    L.line(62, 80, 72, 75, C.INK, L.w(1.5));
    L.line(72, 75, 76, 90, C.INK, L.w(1.5));
    L.ellipse(76, 95, 3, 4, C.INK);
    L.line(78, 98, 90, 104, C.INK, 1);
    L.rect(89, 103, 3, 2, C.INK);
    inkPoly(L, CP.ellipsePts(73, 92, 13, 15, 18), key + 'head', L.w(1), 0.4);
    // Chair back, foreground.
    F.poly([-10, 160, 30, 150, 36, 200, -10, 200], dither(C.NIGHT, C.MOON_D, 0.3));
    inkPoly(K, [-10, 160, 30, 150, 36, 200, -10, 200], key + 'chair', K.w(1), 0.4);
  }

  // ---------- gloved hands ----------
  // A glove is a union of capsules (fingers) and ellipses (hand back): every part is first inked a
  // little larger, then filled, so overlaps merge into one silhouette with a single outline.
  function capsulePts(x0, y0, x1, y1, r) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = a + Math.PI / 2 + (i / 8) * Math.PI;
      pts.push(x0 + Math.cos(t) * r, y0 + Math.sin(t) * r);
    }
    for (let i = 0; i <= 8; i++) {
      const t = a - Math.PI / 2 + (i / 8) * Math.PI;
      pts.push(x1 + Math.cos(t) * r, y1 + Math.sin(t) * r);
    }
    return pts;
  }
  /** parts: [{c:[x0,y0,x1,y1,r]} | {e:[cx,cy,rx,ry]}], rotated by rot(x,y) about the caller's pivot. */
  function glove(K, parts, rot, fill, key) {
    const shape = (p, grow) => {
      if (p.c) {
        const [x0, y0, x1, y1, r] = p.c;
        return capsulePts(x0, y0, x1, y1, r + grow);
      }
      const [cx, cy, rx, ry] = p.e;
      return CP.ellipsePts(cx, cy, rx + grow, ry + grow, 20);
    };
    const place = (pts) => {
      const out = [];
      for (let i = 0; i < pts.length; i += 2) out.push(...rot(pts[i], pts[i + 1]));
      return K.map(out);
    };
    const grow = 1.4 / K.s;
    parts.forEach((p, i) => CP.poly(boil(place(shape(p, grow)), key + i, 0.4), C.INK));
    parts.forEach((p) => CP.poly(place(shape(p, 0)), p.fill === undefined ? fill : p.fill));
  }
  const NO_ROT = (x, y) => [x, y];

  /** A pressure-suit glove flipping a guarded toggle switch; press 0..1 = lever up..down. */
  function gloveSwitch(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'glove';
    const press = o.press || 0;
    F.rect(-30, -30, 240, 180, layer(halftone(C.MOON_D, 0.28, { cell: 3, angle: 0.5 }), C.MOON_M));
    for (const [sx, sy] of [[10, 10], [150, 12], [12, 100]]) {
      K.ellipse(sx, sy, 2.4, 2.4, C.MOON_D);
      K.line(sx - 1, sy, sx + 1, sy, C.INK);
    }
    // Three guarded toggles; the middle one is the one being thrown.
    for (const [i, sx] of [[0, 34], [1, 80], [2, 126]]) {
      F.rect(sx - 12, 64, 24, 16, C.MOON_D);
      K.rect(sx - 15, 52, 3, 34, C.MOON_L);
      K.rect(sx + 12, 52, 3, 34, C.MOON_L);
      inkPoly(K, [sx - 12, 64, sx + 12, 64, sx + 12, 80, sx - 12, 80], key + 'b' + i, 1, 0);
      const p = i === 1 ? CP.clamp01(press) : i === 0 ? 1 : 0;
      const ang = -Math.PI / 2 + p * Math.PI;
      const tx = sx + Math.cos(ang) * 4;
      const ty = 72 + Math.sin(ang) * 17;
      K.line(sx, 72, tx, ty, C.INK, K.w(4));
      K.line(sx, 72, tx, ty, C.MOON_L, K.w(2));
      K.ellipse(sx, 72, 3, 3, C.MOON_L);
    }
    // Index fingertip rides the lever tip.
    const tipY = 72 + Math.sin(-Math.PI / 2 + CP.clamp01(press) * Math.PI) * 17 - 6;
    const dy = (tipY - 49) * 0.55;
    const suit = layer(halftone(C.MOON_M, local(K, (lx, ly) => 0.12 + 0.4 * CP.clamp01((ly - 20) / 70)), { cell: 3, angle: 0.78 }), C.MOON_L);
    glove(K, [
      { e: [128, 24 + dy, 30, 20] },
      { c: [112, 34 + dy, 82, tipY, 6.5] },
      { c: [120, 42 + dy, 104, 56 + dy, 6.5] },
      { c: [132, 44 + dy, 120, 58 + dy, 6.5] },
      { c: [143, 42 + dy, 134, 54 + dy, 5.5] },
      { c: [106, 16 + dy, 88, 30 + dy, 6] },
      { c: [162, 14 + dy * 0.5, 190, 4, 18], fill: C.PAPER },
    ], NO_ROT, suit, key + 'g');
    K.line(108, 48 + dy, 116, 46 + dy, C.INK, 1);
    K.line(124, 52 + dy, 130, 50 + dy, C.INK, 1);
    K.line(150, 0, 156, 36 + dy * 0.5, C.CYAN, K.w(3));
  }

  /** Glove wrapped round the pistol-grip hand controller - manual control. */
  function gloveStick(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'stick';
    const tilt = o.tilt || 0;
    F.rect(-300, -300, 1200, 800, layer(halftone(C.CYAN, 0.2, { cell: 4 }), C.CYAN_D));
    F.poly([30, 140, 130, 140, 140, 170, 20, 170], C.MOON_D);
    inkPoly(K, [30, 140, 130, 140, 140, 170, 20, 170], key + 'base', K.w(1), 0.3);
    const pivot = [80, 140];
    const rot = (x, y) => {
      const dx = x - pivot[0];
      const dy = y - pivot[1];
      return [pivot[0] + dx * Math.cos(tilt) - dy * Math.sin(tilt), pivot[1] + dx * Math.sin(tilt) + dy * Math.cos(tilt)];
    };
    const R = (pts) => {
      const out = [];
      for (let i = 0; i < pts.length; i += 2) out.push(...rot(pts[i], pts[i + 1]));
      return out;
    };
    const grip = R([68, 140, 92, 140, 96, 60, 90, 30, 72, 28, 64, 50]);
    K.poly(grip, C.NIGHT);
    inkPoly(K, grip, key + 'grip', K.w(1), 0.3);
    K.poly(R([74, 30, 86, 30, 86, 24, 74, 24]), C.RED);
    const suit = layer(halftone(C.MOON_M, 0.25, { cell: 3, angle: 0.78 }), C.MOON_L);
    glove(K, [
      { e: [120, 84, 26, 36] },
      { c: [58, 54, 104, 58, 7.5] },
      { c: [56, 70, 106, 72, 7.5] },
      { c: [58, 86, 106, 87, 7] },
      { c: [62, 101, 104, 100, 6.5] },
      { c: [112, 46, 76, 38, 7] },
      { c: [150, 70, 200, 66, 26], fill: C.PAPER },
    ], rot, suit, key + 'g');
    for (const y of [62, 78, 94]) CP.polyline(K.map(R([66, y, 100, y + 1])), C.INK, 1, false);
    CP.polyline(K.map(R([142, 46, 146, 104])), C.CYAN, K.w(3), false);
  }
  CP.art = { lm, lmShadow, surface, crater, boulder, dsky, seg7, cockpit, houston, gloveSwitch, gloveStick, local, inkPoly, inkLine };
})();

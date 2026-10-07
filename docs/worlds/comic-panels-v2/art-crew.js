/* comic-panels v2 showcase (from v1) - people and hands: the crew, Houston, gloves. */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, rnd, halftone, layer, dither, boil } = CP;
  const { local, inkPoly, inkLine, surface } = CP.art;

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
  Object.assign(CP.art, { cockpit, crewBack, houston, glove, capsulePts, NO_ROT, gloveSwitch, gloveStick });
})();

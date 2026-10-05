/* B1 room layer: the world outside the TV, in square 2x pixels ("room units", 320x180) with a camera.
   Living room at Christmas 1982, the console close-up (insert / pull), the returns counter, the dug-up cartridge. */
'use strict';
(function () {
  const K = B1.core;
  const F = B1.fonts;
  const TV = B1.tv;
  const { C } = K;
  const cam = { ox: 0, oy: 0, s: 2 };
  function setCam(fx, fy, s) { cam.s = s; cam.ox = 320 - fx * s; cam.oy = 180 - fy * s; }
  function X(x) { return Math.round(cam.ox + x * cam.s); }
  function Y(y) { return Math.round(cam.oy + y * cam.s); }
  function rr(x, y, w, h, c) { const x0 = X(x); const y0 = Y(y); K.rect(x0, y0, X(x + w) - x0, Y(y + h) - y0, c); }
  function rd(x, y, w, h, c, lv) { const x0 = X(x); const y0 = Y(y); K.ditherRect(x0, y0, X(x + w) - x0, Y(y + h) - y0, c, lv); }
  function rmap(x, y, w, h, table, lv) { const x0 = X(x); const y0 = Y(y); K.remapRect(x0, y0, X(x + w) - x0, Y(y + h) - y0, table, lv); }
  function rpoly(pts, c, table) { K.poly(pts.map((v, i) => (i % 2 ? cam.oy + v * cam.s : cam.ox + v * cam.s)), c, table); }
  function rline(x0, y0, x1, y1, c, b) { K.line(cam.ox + x0 * cam.s, cam.oy + y0 * cam.s, cam.ox + x1 * cam.s, cam.oy + y1 * cam.s, c, Math.max(1, Math.round((b || 1) * cam.s / 2))); }
  function rell(cx, cy, rx, ry, c) { K.ellipse(cam.ox + cx * cam.s, cam.oy + cy * cam.s, rx * cam.s, ry * cam.s, c); }

  // --- carpet: avocado shag, tufts bigger toward the camera ---
  function shag(y0, y1, seed, n) {
    rr(-40, y0, 400, y1 - y0, C.OLIVE_D);
    for (let i = 0; i < n; i++) {
      const x = -20 + K.hash(seed, i, 1) * 360;
      const y = y0 + K.hash(seed, i, 2) * (y1 - y0);
      const d = (y - y0) / (y1 - y0);
      const h = 1 + Math.round(d * 2.5 + K.hash(seed, i, 3));
      const lean = K.hash(seed, i, 4) > 0.5 ? 1 : 0;
      rr(x, y, 1, h, C.AVOCADO);
      if (lean && h > 1) rr(x + 1, y - 1, 1, 1, C.AVOCADO);
      if (K.hash(seed, i, 5) > 0.93) rr(x + 1, y + 1, 1, h, C.TEAK);
    }
  }
  // --- wood panelling with uneven planks ---
  function panelling(y0, y1, seed) {
    rr(-40, y0, 400, y1 - y0, C.WALNUT);
    let x = -20;
    let i = 0;
    while (x < 340) {
      const w = 15 + Math.floor(K.hash(seed, i, 1) * 9);
      rr(x, y0, 1, y1 - y0, C.WALNUT_D);
      for (let g = 0; g < 3; g++) {
        const gx = x + 3 + Math.floor(K.hash(seed, i, 10 + g) * (w - 5));
        let gy = y0 + Math.floor(K.hash(seed, i, 20 + g) * 10);
        while (gy < y1) {
          const len = 6 + Math.floor(K.hash(seed, i * 7 + g, gy) * 14);
          rr(gx + (Math.floor(gy / 23) % 2), gy, 1, Math.min(len, y1 - gy), C.WALNUT_D);
          gy += len + 4 + Math.floor(K.hash(seed, gy, g) * 9);
        }
      }
      if (K.hash(seed, i, 30) > 0.6) rell(x + w / 2, y0 + 20 + K.hash(seed, i, 31) * 70, 1.6, 1, C.TEAK);
      x += w;
      i++;
    }
  }

  // --- the cartridge, front view: grip ridges, label with art window, Dad's handwriting ---
  // o: { x, y, w, h, hand: 'XMAS 82', stain: 0..1, ink, seed }
  function cartFront(o) {
    const { x, y, w, h } = o;
    rr(x, y, w, h, C.GREY_D);
    rr(x + 1, y, w - 2, 1, C.GREY);
    for (let i = 0; i < 5; i++) rr(x + 3, y + 3 + i * 2.6, w - 6, 1, C.VOID);
    rr(x, y + h - 2, w, 2, C.VOID);
    const lx = x + 4; const ly = y + h * 0.27; const lw = w - 8; const lh = h * 0.66;
    rr(lx, ly, lw, lh, C.CREAM);
    // art window, printed 1 unit off-register to the right
    const ax = lx + 3 + 0.5; const ay = ly + 2.5; const aw = lw - 6; const ah = lh * 0.48;
    rr(ax, ay, aw, ah, C.NIGHT);
    rr(ax, ay + ah * 0.72, aw, ah * 0.28, C.OLIVE_D);
    for (let k = 0; k < aw; k += 3) rr(ax + k, ay + ah * 0.72 - (k % 6 === 0 ? 1 : 0), 3, 1, C.AVOCADO);
    rell(ax + aw * 0.7, ay + ah * 0.33, ah * 0.2, ah * 0.2, C.GOLD);
    rell(ax + aw * 0.7 + ah * 0.09, ay + ah * 0.29, ah * 0.17, ah * 0.17, C.NIGHT);
    [[0.18, 0.2], [0.34, 0.45], [0.5, 0.15]].forEach((p) => rr(ax + aw * p[0], ay + ah * p[1], 1, 1, C.CREAM));
    rr(lx, ay + ah + 1.5, lw, 1.6, C.ORANGE);
    if (o.stain) {
      rmap(lx, ly, lw * 0.5, lh, K.SCAN, o.stain * 0.55);
      rmap(lx + lw * 0.55, ly + lh * 0.6, lw * 0.45, lh * 0.4, K.SCAN, o.stain * 0.35);
    }
    if (o.hand) {
      // masking tape torn off the roll, stuck across the grip at a slant; Dad's marker on it
      const tx = x + 3; const ty = y + 2.5; const tw = w - 5; const th = h * 0.17;
      const ang = -0.045;
      const q = K.quad(X(tx + tw / 2), Y(ty + th / 2), tw * cam.s, th * cam.s, ang);
      K.poly(q.map((v, i) => v + (i % 2 ? cam.s : cam.s * 0.5)), 0, K.SCAN);
      K.poly(q, o.stain ? C.TAN : C.CREAM);
      // torn ends: notch the left and right edges
      for (let k = 0; k < 4; k++) {
        rr(tx - 0.5, ty + 0.5 + k * th / 4 + (k % 2), 1, th / 8, C.GREY_D);
        rr(tx + tw - 0.6, ty + 1 + k * th / 4, 1, th / 9, C.GREY_D);
      }
      if (o.stain) rmap(tx, ty, tw * 0.4, th, K.SCAN, 0.3);
      const size = o.handSize || cam.s * 1.12;
      F.hand(o.hand, { x: X(tx + 3.5), y: Y(ty + 1.4), size, angle: ang - 0.02, seed: 82, c: o.ink === undefined ? C.WALNUT_D : o.ink, slant: 0.22, brush: cam.s >= 3 ? 3 : 2 });
    }
  }

  // --- hand + knit sleeve holding a cartridge by its sides (front view): palm above the top edge, thumb on the
  //     left side, three fingertips wrapped round the right side - Dad's tape stays readable ---
  function gripHand(cx, top, squeeze) {
    const q = squeeze ? 1 : 0;
    rpoly([cx + 2, top - 16, cx + 24, top - 8, cx + 84, top - 84, cx + 52, top - 100], C.ORANGE);
    for (let i = 0; i < 4; i++) rpoly([cx + 4 + i * 2.5, top - 18 - i * 3, cx + 25 + i * 2.5, top - 10 - i * 3, cx + 26 + i * 2.5, top - 12 - i * 3, cx + 5 + i * 2.5, top - 20 - i * 3], C.RUST);
    rpoly([cx - 31, top + 1, cx + 31, top + 1, cx + 27, top - 15, cx - 20, top - 19], C.TAN);
    rpoly([cx + 8, top + 1, cx + 31, top + 1, cx + 27, top - 15, cx + 12, top - 17], C.TEAK);
    rr(cx - 22, top - 13, 9, 1, C.TEAK); rr(cx - 6, top - 15, 7, 1, C.TEAK);
    // thumb, left side
    rr(cx - 35 + q, top - 1, 7, 18, C.TAN); rr(cx - 29 + q, top - 1, 1, 18, C.TEAK); rr(cx - 34 + q, top + 13, 4, 3, C.CREAM);
    // fingertips, right side, uneven
    [[2, 9, 0], [12, 8, 1], [21, 6, 0]].forEach((fg) => {
      rr(cx + 28 - q, top + fg[0], 7 - fg[2], fg[1], C.TAN);
      rr(cx + 28 - q, top + fg[0] + fg[1] - 1, 7 - fg[2], 1, C.TEAK);
    });
  }

  // ===== living room, Christmas 1982 =====
  // the wall calendar (also drawn alone, at the push-in camera, as the first frame of the boss)
  function calendar(cx0, cy0, k25) {
    rr(cx0 + 16, cy0 - 3, 2, 3, C.GREY);
    rr(cx0 + 1, cy0 + 1, 34, 48, C.WALNUT_D);
    rr(cx0, cy0, 34, 48, C.CREAM);
    rr(cx0, cy0, 34, 3, C.TEAK);
    rr(cx0 + 3, cy0 + 5, 28, 14, C.NIGHT);
    rr(cx0 + 3, cy0 + 15, 28, 4, C.CREAM);
    rpoly([cx0 + 6, cy0 + 15, cx0 + 11, cy0 + 9, cx0 + 16, cy0 + 15], C.OLIVE_D);
    rpoly([cx0 + 14, cy0 + 15, cx0 + 21, cy0 + 7, cx0 + 28, cy0 + 15], C.OLIVE_D);
    F.joy('DEC', X(cx0 + 3), Y(cy0 + 21), Math.max(1, Math.round(cam.s / 2)), C.RUST);
    for (let r = 0; r < 4; r++) for (let d = 0; d < 7; d++) rr(cx0 + 4 + d * 4, cy0 + 30 + r * 4.3, 1.4, 1.4, C.TEAK);
    if (k25 > 0) {
      const ccx = X(cx0 + 4.7 + 3 * 4); const ccy = Y(cy0 + 30.7 + 3 * 4.3);
      const rad = 2.6 * cam.s;
      let p0 = null;
      for (let a = 0; a <= 7.0 * k25; a += 0.25) {
        const rr0 = rad * (1 + 0.12 * Math.sin(a * 1.7));
        const p = [ccx + Math.cos(a - 2.2) * rr0 * 1.25, ccy + Math.sin(a - 2.2) * rr0];
        if (p0) K.line(p0[0], p0[1], p[0], p[1], C.RUST, Math.max(1, Math.round(cam.s / 2)));
        p0 = p;
      }
    }
  }
  function livingRoom(t, opts) {
    const o = opts || {};
    panelling(0, 121, 41);
    for (let i = 0; i < 4; i++) rmap(-40, i * 5, 400, 5, K.SCAN, 0.5 - i * 0.12);
    rr(-40, 118, 400, 5, C.TEAK); rr(-40, 118, 400, 1, C.TAN);
    shag(123, 181, 77, 1500);
    calendar(166, 22, o.circle === undefined ? 1 : o.circle);
    // Christmas tree, right edge, cropped by the frame
    const tx = 264; const ty = 21;
    [[14, 22, 18], [30, 40, 28], [48, 58, 38], [66, 80, 47], [86, 104, 56]].forEach((tier, i) => {
      rpoly([tx, ty + tier[0] - 6, tx + tier[2], ty + tier[1], tx - tier[2], ty + tier[1]], C.AVOCADO);
      rpoly([tx + 2, ty + tier[0] - 4, tx + tier[2], ty + tier[1], tx + tier[2] * 0.25, ty + tier[1]], C.OLIVE_D);
      rr(tx - tier[2] + 3, ty + tier[1] - 1, tier[2] * 2 - 6, 1, i % 2 ? C.TEAL_D : C.OLIVE_D);
    });
    rr(tx - 5, ty + 104, 10, 8, C.WALNUT_D);
    rpoly([tx, ty + 3, tx + 2, ty + 8, tx + 6, ty + 8, tx + 3, ty + 11, tx + 4, ty + 15, tx, ty + 12, tx - 4, ty + 15, tx - 3, ty + 11, tx - 6, ty + 8, tx - 2, ty + 8], C.GOLD);
    const bulbs = [[-6, 24], [7, 30], [-15, 41], [3, 47], [18, 52], [-24, 58], [-6, 63], [12, 70], [30, 76], [-30, 78], [-12, 86], [22, 92], [-40, 99], [5, 100], [38, 101]];
    const lit = [C.ORANGE, C.GOLD, C.AQUA, C.CREAM];
    const dim = [C.RUST, C.TEAK, C.TEAL_D, C.TAN];
    bulbs.forEach((b, i) => {
      const rate = 0.55 + K.hash(9, i, 1) * 1.1;
      const on = K.hash(9, i, Math.floor(t * rate + K.hash(9, i, 2) * 3)) > 0.3;
      const k = i % 4;
      rr(tx + b[0], ty + b[1], 2, 2, on ? lit[k] : dim[k]);
    });
    // presents on the carpet; the gap between them is the missing gift (focal point)
    rr(203, 126, 32, 19, C.ORANGE); rr(203, 126, 32, 1, C.GOLD); rr(216, 126, 4, 19, C.CREAM); rr(203, 133, 32, 3, C.CREAM);
    rr(235, 128, 1, 17, C.RUST);
    rr(288, 124, 34, 21, C.TEAL); rr(301, 124, 4, 21, C.GOLD); rr(288, 124, 34, 1, C.AQUA); rr(287, 126, 1, 19, C.TEAL_D);
    tvCabinet(22, 44, t, o);
    console2600(48, 136, 1);
    // joystick + cable drawn by hand
    rr(118, 146, 13, 10, C.VOID); rr(118, 146, 13, 1, C.GREY_D);
    rr(119, 147, 3, 2, C.ORANGE);
    rr(124, 136, 2, 11, C.GREY_D); rr(123, 134, 4, 3, C.VOID);
    let lx = 118; let ly = 154;
    [[110, 158], [101, 157], [96, 152], [100, 146], [104, 144]].forEach((p) => { rline(lx, ly, p[0], p[1], C.VOID, 1); lx = p[0]; ly = p[1]; });
    emptySlot(t, o);
  }
  function tvCabinet(x, y, t, o) {
    rr(x + 6, y + 76, 4, 8, C.WALNUT_D); rr(x + 112, y + 76, 4, 8, C.WALNUT_D);
    rr(x, y, 124, 78, C.TEAK);
    rr(x, y, 124, 2, C.TAN);
    for (let i = 0; i < 6; i++) rr(x + 2 + K.hash(3, i, 1) * 40, y + 6 + i * 12 + K.hash(3, i, 2) * 4, 30 + K.hash(3, i, 3) * 60, 1, C.WALNUT);
    // rabbit ears, not symmetric
    rell(x + 66, y - 2, 9, 3, C.GREY_D);
    rline(x + 62, y - 3, x + 47, y - 22, C.GREY, 1); rline(x + 70, y - 3, x + 92, y - 17, C.GREY, 1);
    rr(x + 46, y - 23, 2, 2, C.CREAM); rr(x + 91, y - 18, 2, 2, C.CREAM);
    // screen + bezel
    rr(x + 8, y + 8, 78, 60, C.GREY_D);
    const sx = x + 12; const sy = y + 12; const sw = 70; const sh = 52;
    K.setClip(X(sx), Y(sy), X(sx + sw) - X(sx), Y(sy + sh) - Y(sy));
    attract(X(sx), Y(sy), X(sx + sw) - X(sx), Y(sy + sh) - Y(sy), t, o);
    TV.crt(X(sx), Y(sy), X(sx + sw) - X(sx), Y(sy + sh) - Y(sy), t, { radius: Math.round(5 * cam.s), hum: false });
    // a thumbprint smudge on the glass
    rmap(sx + 48, sy + 30, 7, 6, K.GHOST, 0.3);
    K.setClip();
    // grille + knobs
    rr(x + 92, y + 22, 26, 46, C.TAN);
    for (let i = 0; i < 9; i++) rr(x + 94 + i * 3, y + 22, 1, 46, C.WALNUT);
    rell(x + 98, y + 13, 3.5, 3.5, C.GREY); rell(x + 98, y + 13, 1.2, 1.2, C.GREY_D);
    rell(x + 111, y + 13, 3, 3, C.GREY); rr(x + 111, y + 10, 1, 3, C.GREY_D);
    rr(x, y + 76, 124, 2, C.WALNUT_D);
  }
  // Attract mode: a 2600 left idle cycles its colours every few seconds (kept low: it is not the subject).
  function attract(px, py, pw, ph, t, o) {
    if (o.garbage) { TV.garbage(px, py, pw, ph, K.frameOf(t), 5); return; }
    const hues = [[C.TEAL, C.TEAL_D], [C.DUSK, C.NIGHT], [C.RUST, C.WALNUT_D], [C.BLUE, C.NIGHT]];
    const k = Math.floor(t / 1.9) % 4;
    const hu = hues[k];
    K.rect(px, py, pw, ph, C.TUBE);
    const bh = Math.max(2, Math.round(ph / 18) & ~1);
    for (let i = 0; i < 5; i++) K.rect(px, py + ph - (i + 1) * bh * 2, pw, bh, i === 0 ? hu[0] : hu[1]);
    const bw = Math.round(pw / 10);
    [[1, 3], [3, 5], [6, 2], [8, 4]].forEach((b) => K.rect(px + b[0] * bw, py + ph * 0.3, bw, b[1] * bh, hu[1]));
    K.rect(px + Math.round(pw * 0.42), py + Math.round(ph * 0.16), bw, bh * 2, hu[0]);
  }
  function console2600(x, y, scale) {
    const s = scale || 1;
    rr(x, y, 62 * s, 16 * s, C.VOID);
    rr(x + 2 * s, y, 58 * s, 1, C.GREY_D);
    for (let i = 0; i < 3; i++) rr(x + 4 * s, y + (3 + i * 2) * s, 18 * s, 1, C.GREY_D);
    rr(x + 26 * s, y + 2 * s, 14 * s, 4 * s, C.TUBE);
    rr(x + 26 * s, y + 2 * s, 14 * s, 1, C.GREY_D);
    rr(x, y + 10 * s, 62 * s, 6 * s, C.TEAK);
    rr(x, y + 10 * s, 62 * s, 1, C.WALNUT);
    for (let i = 0; i < 6; i++) rr(x + (6 + i * 9.4) * s, y + 12 * s, 3 * s, 2 * s, C.GREY);
  }
  function emptySlot(t, o) {
    const k = o.slot === undefined ? 1 : o.slot;
    if (k <= 0) return;
    const x = 243; const y = 120; const w = 38; const h = 25;
    rmap(x + 1, y + 1, w - 2, h - 2, K.SCAN, 0.5);
    const per = 2 * (w + h);
    const show = per * Math.min(1, k);
    const blinkOff = o.blink && Math.floor(o.blink * 6) % 2 === 1;
    if (!blinkOff) {
      // dashes are hand-spaced: 3 on, 2 off, with one longer gap where the pen lifted
      for (let d = 0; d < show; d += 5) {
        if (d === 45) continue;
        for (let q = d; q < Math.min(d + 3, show); q++) {
          let px; let py;
          if (q < w) { px = x + q; py = y; } else if (q < w + h) { px = x + w; py = y + q - w; } else if (q < 2 * w + h) { px = x + w - (q - w - h); py = y + h; } else { px = x; py = y + h - (q - 2 * w - h); }
          rr(px, py, 1, 1, C.CREAM);
        }
      }
    }
    const tk = o.tag === undefined ? 1 : o.tag;
    if (tk > 0) {
      // tag drops and swings to rest (pendulum with decay)
      const sw = tk < 1 ? (1 - tk) * 0.9 : 0;
      const ang = -0.13 + Math.sin(tk * 9) * sw * 0.5;
      const tcx = 254; const tcy = 162 - (1 - Math.min(1, tk * 1.6)) * 14;
      const q = K.quad(X(tcx), Y(tcy), 48 * cam.s, 23 * cam.s, ang);
      K.poly(q.map((v, i) => v + (i % 2 ? 4 : 3)), 0, K.SCAN);
      K.poly(q, C.CREAM);
      const co = Math.cos(ang); const si = Math.sin(ang);
      const P = (lx, ly) => [X(tcx) + (lx * co - ly * si) * cam.s, Y(tcy) + (lx * si + ly * co) * cam.s];
      const hole = P(-20, 0);
      K.ellipse(hole[0], hole[1], 1.6 * cam.s, 1.6 * cam.s, C.OLIVE_D);
      K.line(hole[0], hole[1], X(246), Y(146), C.TAN, Math.round(cam.s / 2));
      const p1 = P(-15, -8);
      F.hand('E.T.', { x: p1[0], y: p1[1], size: cam.s * 0.95, angle: ang, seed: 13, c: C.WALNUT_D, slant: 0.2 });
      const p2 = P(-15, 1);
      F.hand('XMAS 82', { x: p2[0], y: p2[1], size: cam.s * 0.95, angle: ang, seed: 82, c: C.WALNUT_D, slant: 0.22 });
    }
  }

  // ===== console close-up: cartridge goes in (or comes out) =====
  // cartY: top of the cartridge in room units (slot at y=122); grip: hand on; tvGarbage: frame flag
  function consoleCloseup(t, o) {
    shag(0, 181, 31, 2600);
    rmap(-40, 0, 400, 30, K.SCAN, 0.5);
    // TV cabinet corner, top-left, with the screen bottom
    rr(-10, -10, 112, 64, C.TEAK);
    rr(-10, 52, 112, 2, C.WALNUT_D);
    rr(4, -10, 86, 54, C.GREY_D);
    const sx = X(8); const sy = 0; const sw = X(86) - X(8); const shh = Y(40);
    K.setClip(sx, sy, sw, shh);
    if (o.tv === 'garbage') TV.garbage(sx, sy, sw, shh, K.frameOf(t), 21);
    else if (o.tv === 'off') { K.rect(sx, sy, sw, shh, C.TUBE); }
    else attract(sx, sy, sw, shh, t + 3.1, {});
    TV.crt(sx, sy, sw, shh, t, { radius: 10, hum: false });
    K.setClip();
    rr(20, 54, 4, 10, C.WALNUT_D); rr(84, 54, 4, 10, C.WALNUT_D);
    // console, big
    const cx = 34;
    rr(cx, 96, 290, 90, C.VOID);
    rr(cx, 96, 290, 1, C.GREY_D);
    for (let i = 0; i < 6; i++) rr(cx + 8, 100 + i * 3, 104, 1, C.GREY_D);
    rr(cx + 200, 100, 70, 14, C.TUBE);
    for (let i = 0; i < 5; i++) rr(cx + 204, 102 + i * 2.5, 62, 1, C.GREY_D);
    // TV glow on the console top (picks up the screen colour)
    const glow = o.tv === 'garbage' ? [C.ORANGE, C.TEAL, C.MAUVE][K.frameOf(t) % 3] : o.tv === 'off' ? -1 : C.TEAL_D;
    if (glow >= 0) rd(cx, 97, 120, 2, glow, 0.5);
    // slot
    rr(150, 118, 78, 8, C.GREY_D);
    rr(152, 120, 74, 5, C.VOID);
    rr(cx, 134, 290, 30, C.TEAK);
    rr(cx, 134, 290, 1, C.TAN);
    for (let i = 0; i < 7; i++) rr(cx + 2 + K.hash(8, i, 1) * 150, 137 + i * 3.7, 60 + K.hash(8, i, 2) * 120, 1, C.WALNUT);
    for (let i = 0; i < 6; i++) { rr(cx + 22 + i * 44 + (i === 4 ? 2 : 0), 142, 10, 8, C.VOID); rr(cx + 24 + i * 44 + (i === 4 ? 2 : 0), 143 + (i % 2) * 3, 6, 3, C.GREY); }
    rr(cx, 164, 290, 30, C.VOID);
    // cartridge (clipped at the slot: what has gone in is hidden)
    if (o.cartY !== undefined) {
      const cw = 64; const ch = 76;
      const cxx = 157 + (o.cartX || 0);
      K.setClip(0, 0, 640, Y(121));
      cartFront({ x: cxx, y: o.cartY, w: cw, h: ch, hand: 'XMAS 82' });
      K.setClip();
      if (o.grip) gripHand(cxx + cw / 2, o.cartY, o.squeeze);
    }
    if (o.handY !== undefined) gripHand(189 + (o.handX || 0), o.handY, false);
  }

  // ===== the returns counter =====
  function counter(t, o) {
    rr(-40, 0, 400, 112, C.TEAL_D);
    for (let y = 16; y < 108; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < 320; x += 6) rr(x, y, 1, 1, C.TUBE);
    // fluorescent fixture; one tube drops out now and then
    rr(30, 0, 180, 5, C.GREY_D);
    const fl = K.hash(4, Math.floor(t * 9), 0) > 0.94;
    rr(34, 2, 172, 2, fl ? C.TAN : C.CREAM);
    rd(34, 5, 172, 3, C.TEAL, 0.25);
    // RETURNS sign on two chains; the right chain is 2 units longer, so the board hangs crooked (pixel-snapped)
    const sx = 150; const sy = 28; const sw = 82; const slope = 2 / 82;
    for (let y = 5; y < sy; y += 3) rr(sx + 7, y, 1, 2, C.GREY);
    for (let y = 5; y < sy + 2; y += 3) rr(sx + sw - 8, y, 1, 2, C.GREY);
    for (let i = 0; i < sw; i++) {
      const dy = Math.round(i * slope);
      rr(sx + i, sy + dy, 1, 21, i === 0 || i === sw - 1 ? C.TEAK : C.CREAM);
      rr(sx + i, sy + dy, 1, 1, C.TEAK); rr(sx + i, sy + dy + 20, 1, 1, C.TEAK);
      rr(sx + i + 1, sy + dy + 21, 1, 1, C.TUBE);
    }
    const word = 'RETURNS';
    let gx = sx + 10;
    for (let i = 0; i < word.length; i++) {
      gx += F.joy(word[i], X(gx), Y(sy + 5 + Math.round((gx - sx) * slope)), cam.s, C.WALNUT_D) / cam.s + 2;
    }
    // counter top + wood front
    rr(-40, 110, 400, 8, C.TAN);
    rr(-40, 116, 400, 1, C.CREAM);
    rr(-40, 117, 400, 3, C.GREY);
    panelling(120, 181, 91);
    rmap(-40, 120, 400, 6, K.SCAN, 0.5);
    rr(16, 168, 1, 1, C.GREY);
    // service bell
    rr(124, 108, 14, 2, C.GREY_D);
    rell(131, 106, 6, 4, C.GREY); rr(125, 106, 12, 2, C.GREY); rr(130, 100, 2, 2, C.GREY_D);
    rr(128, 103, 2, 1, C.CREAM);
    // receipt, torn edge, curling
    rpoly([150, 110, 176, 109, 177, 111, 174, 112, 175, 114, 151, 113], C.CREAM);
    rr(152, 110, 22, 1, C.WHITE);
    // returned boxes: two stacks, off true; three more land on the right stack (all the same game: the point)
    const drops = o.drops || [];
    const stackA = [[22, 0], [24, 0], [21, 0]];
    const stackB = [[70, 0], [68, 0], [71, 1], [67, 2], [70, 3]];
    [stackA, stackB].forEach((stack) => {
      let by = 110;
      stack.forEach((b, i) => {
        const bh = 13;
        let yy = by - bh;
        if (b[1] > 0) {
          const td = drops[b[1] - 1];
          if (td === undefined || t < td) return;
          const k = K.clamp01((t - td) / 0.2);
          yy -= (1 - K.ease.in(k)) * 60;
          if (k >= 1 && t - td < 0.3) yy += 1;
        }
        retBox(b[0], yy, 38, bh, i + b[0]);
        by -= bh;
      });
    });
    if (o.cartX !== undefined) {
      cartFront({ x: o.cartX, y: 54, w: 48, h: 56, hand: 'XMAS 82', handSize: cam.s * 0.82 });
      rr(o.cartX - 1, 110, 50, 1, C.TEAK);
      if (o.pushHand !== undefined) {
        const hx = o.cartX + 48 + o.pushHand;
        rpoly([hx, 82, hx + 8, 78, hx + 12, 96, hx + 4, 104], C.TAN);
        rpoly([hx + 6, 80, hx + 60, 62, hx + 70, 92, hx + 10, 102], C.ORANGE);
        for (let i = 0; i < 3; i++) rr(hx + 12 + i * 3, 82 - i, 1, 18, C.RUST);
      }
    }
  }
  function retBox(x, y, w, h, i) {
    rr(x, y, w, h, C.CREAM);
    rr(x, y + h - 1, w, 1, C.TAN);
    rr(x + 3, y + 3, 12, h - 6, C.NIGHT);
    rell(x + 11, y + 6, 1.8, 1.8, C.GOLD);
    rr(x + 17, y + 4, w - 21, 3, C.ORANGE);
    rr(x + 17, y + 9, w - 24, 1, C.TEAK);
    if (i % 3 === 1) rr(x + w - 6, y + 2, 3, h - 4, C.TAN);
  }

  // ===== 2014: one cartridge in the dug-up dirt, daylight =====
  function digCloseup(t, o) {
    rr(-40, 0, 400, 190, C.TAN);
    for (let i = 0; i < 900; i++) {
      const x = K.hash(71, i, 1) * 330 - 5; const y = K.hash(71, i, 2) * 185 - 3;
      const r0 = K.hash(71, i, 3);
      if (r0 > 0.82) { rell(x, y, 2.5, 1.6, C.TEAK); rr(x - 1, y + 1, 3, 1, C.WALNUT); } else if (r0 > 0.55) rr(x, y, 1, 1, C.TEAK);
      else if (r0 > 0.5) rr(x, y, 1, 1, C.CREAM);
      else if (r0 > 0.47) { rr(x, y, 2, 1, C.GREY); rr(x, y + 1, 2, 1, C.GREY_D); }
    }
    // a second clod further back (upper left), lighter: depth without another object
    rpoly([26, 56, 64, 38, 100, 46, 116, 64, 84, 78, 36, 74], C.TEAK);
    for (let i = 0; i < 14; i++) rr(36 + K.hash(5, i, 1) * 70, 56 + K.hash(5, i, 2) * 18, 2, 1, C.WALNUT);
    // the cartridge, rotated, shadow first
    const cx = 204; const cy = 98; const ang = -0.16;
    K.poly(K.quad(X(cx + 6), Y(cy + 6), 72 * cam.s, 86 * cam.s, ang), 0, K.SCAN);
    const scratchBuf = o.buf;
    // draw the front-view cartridge into a buffer and rotate-blit it (nearest), so the hand stays the same Dad
    const keep = K.fb;
    scratchBuf.fill(255);
    K.target(scratchBuf);
    const saved = { ox: cam.ox, oy: cam.oy, s: cam.s };
    cam.ox = 0; cam.oy = 0; cam.s = 2;
    cartFront({ x: 0, y: 0, w: 72, h: 86, hand: 'XMAS 82', stain: 1, ink: C.WALNUT, handSize: 3.0 });
    cam.ox = saved.ox; cam.oy = saved.oy; cam.s = saved.s;
    K.target(keep);
    const co = Math.cos(-ang); const si = Math.sin(-ang);
    const hw = 72; const hh = 86;
    const pcx = X(cx); const pcy = Y(cy);
    for (let y = pcy - 110; y < pcy + 110; y++) {
      for (let x = pcx - 110; x < pcx + 110; x++) {
        if (x < 0 || y < 0 || x >= 640 || y >= 360) continue;
        const dx = x + 0.5 - pcx; const dy = y + 0.5 - pcy;
        const sx2 = Math.floor(dx * co - dy * si + hw); const sy2 = Math.floor(dx * si + dy * co + hh);
        if (sx2 < 0 || sy2 < 0 || sx2 >= 144 || sy2 >= 172) continue;
        const v = scratchBuf[sy2 * 640 + sx2];
        if (v !== 255) K.fb[y * 640 + x] = v;
      }
    }
    // dirt still on it: a crust over the lower-left corner + crumbs; one crumb falls late
    rpoly([162, 120, 186, 128, 200, 146, 160, 150, 150, 136], C.TEAK);
    rpoly([166, 126, 182, 131, 190, 143, 166, 146], C.WALNUT);
    for (let i = 0; i < 16; i++) rr(156 + K.hash(72, i, 1) * 38, 124 + K.hash(72, i, 2) * 22, 1, 1, i % 3 ? C.TAN : C.WALNUT_D);
    [[200, 62, 2], [214, 58, 1], [176, 92, 2], [230, 120, 1]].forEach((c) => rr(c[0], c[1], c[2], c[2], C.WALNUT));
    const fk = K.clamp01((t - o.crumbT) / 0.5);
    rr(238 + fk * 3, 66 + K.ease.in(fk) * 52, 2, 2, C.WALNUT);
    // foreground clod, out of focus (flat, dark)
    rpoly([-10, 150, 40, 138, 80, 160, 70, 190, -10, 190], C.WALNUT);
    rpoly([-10, 160, 30, 152, 60, 168, 50, 190, -10, 190], C.WALNUT_D);
  }

  B1.room = { cam, setCam, rr, rd, rmap, rpoly, rline, rell, livingRoom, calendar, consoleCloseup, counter, digCloseup, cartFront, gripHand, X, Y };
})();

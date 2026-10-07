/* comic-panels v2 showcase - Mission Control art for shot 5: the room from the back row, Steve Bales in
 * profile, the CAPCOM console. Screens carry texture only (no invented readouts).
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, rnd, halftone, layer, dither, boil } = CP;
  const { local, inkPoly, inkLine } = CP.art;

  /** Screen with unreadable lines of light (texture, never text); flicker re-rolls line lengths. */
  function screen(K, F, x, y, w, h, key, flick) {
    F.rect(x, y, w, h, C.NIGHT);
    const rows = Math.max(1, Math.floor((h - 4) / 4));
    for (let l = 0; l < rows; l++) {
      const len = (0.25 + rnd(key, l * 13 + (flick || 0)) * 0.6) * (w - 6);
      K.rect(x + 3, y + 3 + l * 4, len, 1, l === 0 ? C.CYAN : C.CYAN_D);
    }
    CP.polyline(K.map([x, y, x + w, y, x + w, y + h, x, y + h]), C.INK, 1, true);
  }

  /** The room from the back: front wall of big screens, three tiers of consoles, rows of backs. */
  function mocrRoom(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'mocr';
    F.rect(-10, -10, 460, 230, layer(halftone(C.CYAN_D, 0.25, { cell: 4, angle: 0.26 }), C.NIGHT));
    // Front wall: one big plot screen flanked by two smaller ones.
    F.rect(120, 14, 196, 70, C.CYAN_D);
    const plot = [];
    for (let i = 0; i <= 24; i++) plot.push(132 + i * 7.2, 26 + 46 * Math.pow(i / 24, 1.7));
    CP.polyline(boil(K.map(plot), key + 'plot', 0.3), C.CYAN, K.w(1), false);
    for (let g = 0; g < 5; g++) K.line(126, 22 + g * 13, 310, 22 + g * 13, dither(-1, C.CYAN, 0.25), 1);
    inkPoly(K, [120, 14, 316, 14, 316, 84, 120, 84], key + 'big', K.w(1), 0.3);
    for (const sx of [28, 344]) {
      F.rect(sx, 26, 60, 44, C.CYAN_D);
      for (let l = 0; l < 4; l++) K.rect(sx + 6, 32 + l * 8, 20 + rnd(key, sx + l) * 28, 2, C.CYAN);
      inkPoly(K, [sx, 26, sx + 60, 26, sx + 60, 70, sx, 70], key + sx, 1, 0.3);
    }
    // Tiers, far to near. Each: console slab with screens facing us, then the backs of the people at it
    // (white shirts), overlapping their own screens. Spacing is uneven, like a real room.
    const tiers = [
      { y: 92, h: 18, s: 0.62, people: [58, 96, 142, 214, 262, 318, 366], bales: 2 },
      { y: 122, h: 24, s: 0.85, people: [30, 104, 160, 246, 330, 396] },
      { y: 160, h: 32, s: 1.2, people: [44, 168, 300, 392] },
    ];
    let balesAt = null;
    tiers.forEach((tr, ti) => {
      F.poly([-10, tr.y, 450, tr.y - 2, 450, tr.y + tr.h, -10, tr.y + tr.h + 2], C.MOON_D);
      F.poly([-10, tr.y, 450, tr.y - 2, 450, tr.y + 3 * tr.s, -10, tr.y + 2 + 3 * tr.s], C.MOON_L);
      let x = 4 + rnd(key + 'x0', ti) * 10;
      let n = 0;
      while (x < 440) {
        const w = (18 + rnd(key + 'w', ti * 40 + n) * 12) * tr.s;
        screen(K, F, x, tr.y + 4 * tr.s, w, tr.h - 7 * tr.s, key + ti + '-' + n, o.flick);
        x += w + (5 + rnd(key + 'g', ti * 40 + n) * 14) * tr.s;
        n++;
      }
      inkLine(K, [-10, tr.y, 450, tr.y - 2], key + 'tier' + ti);
      tr.people.forEach((px, hi) => {
        const r = 7 * tr.s;
        const hx = px + (rnd(key + 'jx', ti * 10 + hi) - 0.5) * 8;
        const hy = tr.y + tr.h * 0.42 + (rnd(key + 'jy', ti * 10 + hi) - 0.5) * 3 * tr.s;
        const lean = (rnd(key + 'lean', ti * 10 + hi) - 0.5) * 5 * tr.s;
        const back = [hx - r * 2.3, tr.y + tr.h + 6, hx - r * 2 + lean, hy + r * 1.2, hx + r * 2 + lean, hy + r * 1.2, hx + r * 2.3, tr.y + tr.h + 6];
        F.poly(back, layer(halftone(C.SHADE, 0.35, { cell: 3, angle: 0.78 }), C.PAPER));
        inkPoly(K, back, key + 'b' + ti + hi, 1, 0.3);
        K.ellipse(hx + lean, hy, r * 0.85, r, C.INK);
        K.ellipse(hx + lean - r * 0.85, hy + r * 0.15, 1.2 * tr.s + 0.5, 2 * tr.s + 0.5, C.SHADE);
        CP.polyline(K.map([hx + lean - r * 0.85, hy, hx + lean - r * 0.3, hy - r * 0.95, hx + lean + r * 0.4, hy - r * 0.95, hx + lean + r * 0.85, hy]), C.MOON_M, 1, false);
        if (tr.bales === hi) balesAt = [K.x(hx + lean), K.y(hy)];
      });
    });
    return balesAt;
  }

  /** Steve Bales in close profile, facing left toward his screens. lean px forward, blink bool. */
  function balesProfile(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'bales';
    F.rect(-120, -200, 400, 500, layer(halftone(C.CYAN_D, 0.3, { cell: 4, angle: 0.26 }), C.NIGHT));
    // His screen, cropped by the panel, lights the face from the front.
    screen(K, F, -96, -60, 70, 64, key + 'scr', o.flick);
    const H = K.at(o.lean || 0, 0, 1);
    const Hf = H.shift(mis[0], mis[1]);
    // Shoulder and arm in a white shirt, then collar and tie.
    const body = [-34, 58, 26, 46, 72, 66, 92, 220, -50, 220];
    Hf.poly(body, layer(halftone(C.SHADE, local(H, (lx) => 0.15 + 0.55 * CP.clamp01((lx + 10) / 90)), { cell: 3, angle: 0.78 }), C.PAPER));
    inkPoly(H, body, key + 'body', H.w(1), 0.4);
    H.line(20, 90, 30, 220, C.SHADE, 1);
    const neck = [-10, 34, 14, 30, 18, 52, -8, 56];
    const face = [28, -6, 26, -22, 16, -33, 0, -37, -14, -33, -21, -24, -23, -12, -26, -5, -25, -1, -31, 8, -33, 11, -28, 14, -27, 17, -24, 19, -27, 22, -25, 26, -24, 32, -18, 37, -8, 39, 4, 35, 14, 30, 22, 22, 28, 10];
    const skin = layer(halftone(C.AGED, local(H, (lx) => CP.clamp01((lx + 4) / 30) * 0.6), { cell: 3, angle: 0.78 }), C.SHADE);
    Hf.poly(neck, skin);
    Hf.poly(face, skin);
    inkPoly(H, neck, key + 'neck', H.w(1), 0.3);
    inkPoly(H, face, key + 'face', H.w(1), 0.35);
    const collar = [-14, 50, 18, 44, 24, 60, -16, 66];
    Hf.poly(collar, C.PAPER);
    inkPoly(H, collar, key + 'collar', 1, 0.3);
    H.poly([-9, 60, -3, 58, -1, 74, -8, 76], C.NIGHT);
    // Short dark hair with a side part.
    H.poly([29, -4, 27, -22, 17, -34, 0, -39, -14, -35, -22, -25, -19, -22, -6, -27, 6, -26, 14, -19, 17, -7, 23, 2, 29, 4], C.INK);
    H.line(-6, -30, 8, -31, C.MOON_D, 1);
    // Ear under the headset cup, band over the skull, boom mic to the mouth.
    H.ellipse(9, 2, 7, 9, C.INK);
    H.ellipse(9, 2, 4, 6, C.MOON_D);
    CP.polyline(H.map([9, -7, 8, -24, 2, -40]), C.MOON_M, H.w(2.4), false);
    CP.polyline(H.map([4, 8, -6, 18, -19, 22]), C.INK, H.w(1.6), false);
    H.ellipse(-20, 22, 3, 2.2, C.INK);
    // Heavy-framed glasses, temple arm to the ear; eye and brow.
    H.poly([-24, -7, -13, -7, -13, 1, -24, 1], dither(C.CYAN_D, C.CYAN, 0.3));
    CP.polyline(H.map([-24, -7, -13, -7, -13, 1, -24, 1]), C.INK, H.w(1.6), true);
    H.line(-13, -5, 3, -3, C.INK, H.w(1.6));
    if (!o.blink) H.rect(-20, -4, 2, 3, C.INK);
    else H.line(-21, -2, -17, -2, C.INK, 1);
    H.line(-24, -11, -13, -12, C.INK, H.w(1.8));
    H.line(-26, 21, -22, 21, C.INK, 1);
    H.line(-29, 13, -27, 15, C.INK, 1);
  }

  /** CAPCOM: a console from behind and to the side, its name plate, the man at it with a headset. */
  function capcom(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'capcom';
    F.rect(-10, -10, 460, 160, layer(halftone(C.CYAN, 0.18, { cell: 4, angle: 0.26 }), C.CYAN_D));
    const desk = [-10, 92, 440, 70, 440, 150, -10, 150];
    F.poly(desk, C.MOON_M);
    F.poly([-10, 92, 440, 70, 440, 78, -10, 100], C.MOON_L);
    inkLine(K, [-10, 92, 440, 70], key + 'desk');
    const bay = [150, 14, 300, 8, 304, 76, 152, 84];
    F.poly(bay, C.MOON_D);
    inkPoly(K, bay, key + 'bay', 1, 0.3);
    screen(K, F, 164, 22, 56, 42, key + 's1', o.flick);
    screen(K, F, 232, 18, 58, 44, key + 's2', o.flick);
    // Name plate on the console edge: the role, lettered on a strip of tape.
    const plate = [196, 80, 252, 77, 253, 87, 197, 90];
    F.poly(plate, C.PAPER);
    inkPoly(K, plate, key + 'plate', 1, 0);
    CP.text('hand', 'CAPCOM', K.x(201), K.y(80), C.INK, { key: key + 'lbl', bold: true, jitter: 0 });
    // The man, from behind, a little left of the bay: shoulders, head, headset.
    const hx = 96;
    const body = [hx - 52, 150, hx - 46, 100, hx - 20, 88, hx + 22, 88, hx + 46, 98, hx + 54, 150];
    F.poly(body, layer(halftone(C.SHADE, local(K, (lx) => 0.2 + 0.4 * CP.clamp01((lx - hx) / 50)), { cell: 3, angle: 0.78 }), C.PAPER));
    inkPoly(K, body, key + 'body', 1, 0.4);
    F.ellipse(hx, 70, 15, 18, C.INK);
    F.ellipse(hx + 14, 72, 3, 6, C.SHADE);
    CP.polyline(K.map([hx - 15, 66, hx - 6, 51, hx + 8, 51, hx + 15, 64]), C.MOON_M, 2, false);
    K.ellipse(hx + 15, 70, 4, 6, C.MOON_D);
    inkPoly(K, CP.ellipsePts(hx, 70, 15, 18, 18), key + 'head', 1, 0.3);
    return [K.x(hx + 8), K.y(56)];
  }

  Object.assign(CP.art, { mocrRoom, balesProfile, capcom, screen });
})();

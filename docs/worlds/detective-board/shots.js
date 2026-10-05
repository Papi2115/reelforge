/* detective-board showcase - five shots, each a pure function render(t) -> indexed frame. */
(function () {
  'use strict';
  const DB = window.DB;
  const { C, E, seg, lerp, clamp, wobble, hash, surf, blitRot, spritePoint, art, pin, string } = DB;

  // ---------- shared helpers ----------
  const labelCache = new Map();
  function labelTape(text, seed) {
    const key = text + seed;
    if (!labelCache.has(key)) {
      const w = DB.typeWidth(text) + 12;
      const s = DB.copy(art.tape(w, 13, seed));
      DB.typeText(s, text, 6, 3, C.BLACK, seed);
      labelCache.set(key, s);
    }
    return labelCache.get(key);
  }
  /** Sprite with shadow at world (wx, wy) seen through camera cam. */
  function place(f, spr, wx, wy, ang, cam, sh, scale) {
    const x = wx - cam.x;
    const y = wy - cam.y;
    if (sh) blitRot(f, spr, x, y, ang, { shadow: { dx: Math.round(sh[0]), dy: Math.round(sh[1]), soft: true }, scale });
    blitRot(f, spr, x, y, ang, { scale });
  }
  function at(spr, wx, wy, ang, lx, ly, cam) {
    const p = spritePoint(spr, wx, wy, ang, lx, ly);
    return [p[0] - cam.x, p[1] - cam.y];
  }
  /** "Slap" landing: hover with a far, soft shadow, drop (ease-in), touch at tl, settle wobble. */
  function land(t, tl, hang) {
    const a = tl - (hang || 0.22);
    if (t < a) return null;
    if (t < tl) {
      const k = E.inQuad(seg(t, a, tl));
      return { scale: 1.07 - 0.07 * k, lift: 1 + 2.4 * (1 - k), wob: 0 };
    }
    return { scale: 1, lift: 1, wob: wobble(t - tl, 24, 8) * 0.012 };
  }
  /** Pin pushed in: falls from height, squashes one frame on impact. Returns lift or null. */
  function pinDrop(t, tl, dur) {
    const a = tl - (dur || 0.3);
    if (t < a) return null;
    if (t < tl) return { lift: 1 + 2.3 * (1 - E.inQuad(seg(t, a, tl))), squash: false };
    return { lift: 1, squash: t - tl < 1 / 15 };
  }
  function vignette(x, y, w, h, amount) {
    const v = Math.hypot((x / w - 0.5) * 1.7, (y / h - 0.5) * 2.1) - 0.58;
    return v > 0 ? v * amount : 0;
  }
  function lampD(x, y, lx, ly, r) {
    const d = Math.hypot(x - lx, y - ly) / r;
    return Math.min(3.2, -0.55 + 2.1 * d * d);
  }
  /** Frame-buffer region from a big background. */
  function background(f, bg, cam) {
    for (let y = 0; y < f.h; y += 1) {
      const sy = clamp(y + cam.y, 0, bg.h - 1);
      const sx = clamp(cam.x, 0, bg.w - f.w);
      f.d.set(bg.d.subarray(sy * bg.w + sx, sy * bg.w + sx + f.w), y * f.w);
    }
  }
  function writing(text, t0, seed, cps) {
    return DB.handTimes(text, t0, seed, cps);
  }
  function upscale(src, k) {
    const out = surf(src.w * k, src.h * k, C.BLACK);
    for (let y = 0; y < out.h; y += 1) {
      const row = ((y / k) | 0) * src.w;
      for (let x = 0; x < out.w; x += 1) out.d[y * out.w + x] = src.d[row + ((x / k) | 0)];
    }
    return out;
  }

  // ---------- shot 1: HOOK - the empty wall ----------
  const S1_DATE = '22 Aug 1911';
  const S1_TIMES = writing(S1_DATE, 2.62, 11, 7.5);
  function shot1(t) {
    const f = surf(320, 180, C.CORK);
    const cam = { x: 0, y: 0 };
    background(f, art.cork(320, 180, 101), cam);
    // a tighter print of the same wall: the pale patch and its four hooks fill it
    const tight = art.crop('s1', art.wall(false), 20, 24, 102, 110);
    const base = art.photo('s1wall', tight, { left: 7, top: 7, right: 7, bottom: 24, curl: 'br', curlSize: 8, seed: 5 });
    const ph = DB.copy(base);
    const bl = ph.h - 9;
    DB.handText(ph, S1_DATE, 13, bl, C.INK, 11, { slant: 0.3, rise: -0.035, reveal: DB.handReveal(S1_TIMES, t, 2.62) });
    // underline: two quick strokes, the second shorter and lower
    const ul = seg(t, 4.42, 4.66);
    const ul2 = seg(t, 4.7, 4.86);
    const boil = Math.floor(t * 10);
    DB.stroke(ph, [11, bl + 4, 36, bl + 3, 66, bl + 1], ul, C.INK, 300 + boil, 0.6);
    DB.stroke(ph, [18, bl + 6, 47, bl + 5], ul2, C.INK, 400 + boil, 0.6);
    const jolt = t >= 2.0 && t < 2.07 ? 1 : 0;
    const angle = -0.03;
    const cx = 112;
    const cy = 84 + jolt;
    place(f, ph, cx, cy, angle, cam, [3, 4]);
    // masking tape across the lower-left corner
    const tp = art.tape(34, 9, 7);
    const [tx, ty] = at(ph, cx, cy, angle, 4, ph.h - 5, cam);
    place(f, tp, tx, ty, 0.62, cam, [1, 2]);
    // red pin dropped into the void, a little high and left of centre
    const [px, py] = at(ph, cx, cy, angle, 55, 50, cam);
    const drop = pinDrop(t, 2.0, 0.55);
    // exit: the string is pulled out of frame, toward the rest of the case
    if (t > 6.2) {
      const k = E.inOutCubic(seg(t, 6.2, 6.85));
      const ex = lerp(px, 350, k);
      const ey = lerp(py, 40, k);
      string(f, px, py, ex, ey, lerp(10, 2, k), 1, 1, 2, 5);
    }
    if (drop) pin(f, px, py, 'red', 0.8, 1, drop.lift, drop.squash);
    const fade = 3.2 * (1 - E.outQuad(seg(t, 0, 0.7))) + 3.4 * E.inQuad(seg(t, 6.65, 7.0));
    const nz = DB.noiseField(320, 180, 11, 26);
    DB.light(f, (x, y) => lampD(x, y, 104, 58, 210) + nz.at(x, y) * 0.8 + vignette(x, y, 320, 180, 2.2) + fade);
    return upscale(f, 2);
  }

  // ---------- shot 2: A-roll - the board, along the string ----------
  const S2 = {
    louvre: { x: 236, y: 196, a: -0.05, land: 0.42 },
    wall: { x: 655, y: 178, a: 0.035, land: 1.82 },
    pic: { x: 1040, y: 196, a: -0.06, land: 3.94 },
    apo: { x: 1126, y: 178, a: 0.045, land: 4.31 },
    card: { x: 1262, y: 290, a: -0.05, land: 4.82 },
  };
  const S2_POET = writing('the poet?', 5.05, 21, 11);
  const S2_REL = writing('released', 6.62, 22, 10);
  function shot2(t) {
    const f = surf(640, 360, C.CORK);
    const board = art.cork(1500, 460, 202);
    // camera rides the string: x along the path, y dips with the string's sag
    const k1 = E.inOutCubic(seg(t, 0.62, 2.12));
    const k2 = E.inOutSine(seg(t, 2.7, 4.42));
    const camCx = lerp(lerp(262, 655, k1), 1110, k2);
    const dip = Math.sin(Math.PI * k1) * 14 + Math.sin(Math.PI * k2) * 10;
    const cam = { x: Math.round(camCx - 320), y: Math.round(28 + dip) };
    background(f, board, cam);

    const L = S2.louvre;
    const lv = art.photo('lv', art.louvre(), { left: 6, top: 6, right: 7, bottom: 9, curl: 'bl', curlSize: 8, seed: 9 });
    const wl = art.photo('s2wall', art.wall(false), { left: 7, top: 7, right: 7, bottom: 20, seed: 13, curl: 'tr', curlSize: 7 });
    const pc = art.photo('pc', art.portrait('picasso'), { left: 5, top: 5, right: 6, bottom: 12, seed: 17 });
    const ap = art.photo('ap', art.portrait('apollinaire'), { left: 5, top: 5, right: 6, bottom: 12, seed: 19, curl: 'br', curlSize: 8 });

    // -- prints, back to front
    const drawPrint = (spr, o, sh) => {
      const l = land(t, o.land);
      if (!l) return false;
      place(f, spr, o.x, o.y, o.a + l.wob, cam, [sh[0] * l.lift, sh[1] * l.lift], l.scale);
      return l.lift <= 1;
    };
    const lvIn = drawPrint(lv, L, [3, 4]);
    if (lvIn) place(f, labelTape('LOUVRE', 31), L.x + 52, L.y + 74, 0.05, cam, [1, 2]);
    const wlCopy = DB.copy(wl);
    DB.handText(wlCopy, '22 Aug', 10, wl.h - 6, C.INK, 33, { slant: 0.28, rise: -0.04 });
    const wlIn = drawPrint(wlCopy, S2.wall, [3, 4]);
    const pcIn = drawPrint(pc, S2.pic, [3, 4]);
    if (pcIn) place(f, labelTape('PICASSO', 35), S2.pic.x - 14, S2.pic.y + 66, -0.03, cam, [1, 2]);
    const apIn = drawPrint(ap, S2.apo, [3, 4]);
    if (apIn) place(f, labelTape('APOLLINAIRE', 36), S2.apo.x + 14, S2.apo.y + 72, 0.04, cam, [1, 2]);

    // -- the index card: a theory, crossed out, corrected
    const cl = land(t, S2.card.land, 0.18);
    if (cl) {
      const cd = DB.copy(art.card(118, 52, 41));
      DB.handText(cd, 'the poet?', 8, 19, C.INK, 21, { slant: 0.22, rise: -0.02, reveal: DB.handReveal(S2_POET, t, 5.05) });
      const boil = Math.floor(t * 10);
      DB.stroke(cd, [5, 16, 28, 14, 50, 13, 54, 11], seg(t, 6.18, 6.36), C.INK, 50 + boil, 0.5);
      DB.handText(cd, 'released', 26, 33, C.INK, 22, { slant: 0.34, rise: -0.05, reveal: DB.handReveal(S2_REL, t, 6.62) });
      place(f, cd, S2.card.x, S2.card.y, S2.card.a + cl.wob, cam, [2 * cl.lift, 3 * cl.lift], cl.scale);
    }

    // -- string and pins
    const pinL = at(lv, L.x, L.y, L.a, 104, 4, cam);
    const pinW = at(wl, S2.wall.x, S2.wall.y, S2.wall.a, 7 + 70, 7 + 62, cam);
    // one pin holds both suspects where their prints overlap
    const pinJ = at(ap, S2.apo.x, S2.apo.y, S2.apo.a, 9, 17, cam);
    const pinC = at(art.card(118, 52, 41), S2.card.x, S2.card.y, S2.card.a, 7, 6, cam);
    const screenCx = camCx - cam.x;
    // segment A: carried from the Louvre pin, attached at 2.06, settles with a twang
    if (t > 0.6) {
      const attachA = 2.06;
      if (t < attachA) {
        // the free end is carried just ahead of the camera, then hooked on the pin
        const k = E.outQuad(seg(t, 0.6, attachA));
        const end = [lerp(Math.max(pinL[0], screenCx + 70), pinW[0], k), lerp(120, pinW[1], k)];
        string(f, pinL[0], pinL[1], end[0], end[1], 26, 1, 2, 3, 71);
      } else string(f, pinL[0], pinL[1], pinW[0], pinW[1], 10 + 18 * wobble(t - attachA, 17, 5.5), 1, 2, 3, 71);
    }
    if (t > 2.72) {
      const attachB = 4.5;
      if (t < attachB) {
        const k = E.inOutSine(seg(t, 2.72, attachB));
        const end = [lerp(pinW[0], pinJ[0], k), lerp(pinW[1] - 10, pinJ[1], k)];
        string(f, pinW[0], pinW[1], end[0], end[1], 30, 1, 2, 3, 72);
      } else string(f, pinW[0], pinW[1], pinJ[0], pinJ[1], 12 + 20 * wobble(t - attachB, 15, 5), 1, 2, 3, 72);
    }
    if (lvIn) pin(f, pinL[0], pinL[1], 'brass', 0.8, 1);
    if (wlIn) pin(f, pinW[0], pinW[1], 'red', 0.8, 1);
    const jd = pinDrop(t, 4.5, 0.2);
    if (jd) pin(f, pinJ[0], pinJ[1], 'brass', 0.8, 1, jd.lift, jd.squash);
    if (cl && cl.lift <= 1) pin(f, pinC[0], pinC[1], 'pearl', 0.8, 1);

    const fade = 3 * (1 - E.outQuad(seg(t, 0, 0.4))) + 3.4 * E.inQuad(seg(t, 8.0, 8.4));
    const nz = DB.noiseField(1500, 460, 12, 90);
    DB.light(f, (x, y) => {
      const wx = x + cam.x;
      const wy = y + cam.y;
      return Math.min(lampD(wx, wy, 330, 160, 520), lampD(wx, wy, 1150, 210, 520)) + nz.at(wx, wy) * 0.45 + vignette(x, y, 640, 360, 2.2) + fade;
    });
    return f;
  }

  DB.shotKit = { place, at, land, pinDrop, vignette, lampD, background, writing, labelTape, upscale };
  DB.shots = [
    {
      id: 1,
      name: 'Hook',
      dur: 7.0,
      render: shot1,
      caption: 'Tuesday, 22 August 1911. On a wall in the Louvre: four iron hooks, and nothing else.',
      note: 'Tight on an absence: the pale patch is the hero; the only red is the pin that lands in the void. Close-up = 2x pixels.',
    },
    {
      id: 2,
      name: 'A-roll',
      dur: 8.4,
      render: shot2,
      caption: 'The police questioned everyone - even Pablo Picasso, and the poet Guillaume Apollinaire. Both were released.',
      note: 'The camera rides the string: Louvre, empty wall, two famous suspects. Two pools of lamp light, dark between.',
    },
  ];
})();

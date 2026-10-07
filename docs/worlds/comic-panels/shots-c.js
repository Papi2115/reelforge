/* comic-panels showcase - shots 4 (C-roll: crowding, then the pause) and 5 (payoff: the landing). */
'use strict';
(function () {
  const CP = window.CP;
  const { C, E, seg, track, lerp, layer, halftone, dither, rnd, rndRange } = CP;
  const { camera, scaleAbout, paper, misFor, panel } = CP.page;
  const A = CP.art;
  const { pop, dissolve } = CP.helpers;
  const clamp01 = CP.clamp01;

  function sky(K, strength) {
    CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.CYAN_D, A.local(K, (lx, ly) => strength * clamp01((ly - 10) / 120)), { cell: 4, angle: 0.26 }), C.NIGHT));
  }
  function mixQuad(a, b, p) {
    return a.map((v, i) => lerp(v, b[i], p));
  }
  function shiftQuad(q, dx) {
    return q.map((v, i) => (i % 2 ? v : v + dx));
  }

  // ===================== SHOT 4 - C-ROLL: the squeeze, the alarm, the pause =====================
  const ROOMY = {
    a: [14, 14, 332, 15, 330, 200, 15, 198],
    b: [346, 14, 626, 16, 625, 198, 345, 200],
    c: [14, 214, 250, 213, 251, 346, 15, 346],
  };
  const TIGHT = {
    a: [9, 9, 300, 11, 297, 206, 10, 203],
    b: [303, 8, 632, 9, 629, 182, 300, 203],
    c: [8, 207, 197, 208, 199, 352, 9, 351],
    d: [202, 213, 631, 186, 632, 352, 203, 351],
  };
  const PAUSE = [70, 64, 604, 66, 602, 300, 72, 297];
  const PAUSE_T = 3.32;

  function shot4(t) {
    if (t >= PAUSE_T) return pauseBeat(t);
    const sh1 = CP.shake(t, 1.86, 4, 0.13, 's4a');
    const sh2 = CP.shake(t, 2.36, 3, 0.11, 's4b');
    const P = camera(320, 180, 1, [sh1[0] + sh2[0], sh1[1] + sh2[1]]);
    paper(P, 'p4');
    const mis = misFor('s4');
    // Gutters close at three different speeds; the fourth panel shoves its way in.
    const qa = mixQuad(ROOMY.a, TIGHT.a, seg(t, 0.3, 2.0, E.inOutCubic));
    const qb = mixQuad(ROOMY.b, TIGHT.b, seg(t, 0.42, 1.8, E.inOutSine));
    const qc = mixQuad(ROOMY.c, TIGHT.c, seg(t, 0.62, 2.2, E.inOutCubic));
    const scroll = t * 150;
    // Intro: the three roomy panels land one after another (hard cuts, uneven beat).
    if (t < 0.06) return null;
    panel(P, qa, 's4a', () => {
      const K = P.at(-scroll, 0, 1);
      sky(K, 0.3);
      A.surface(K, mis, { x0: -60, x1: 1300, hy: 132, xc: 400, R: 6000, tilt: 0, yb: 260, craters: 70, key: 's4surf', craterScale: 0.7 });
      for (let i = 0; i < 9; i++) A.boulder(K, mis, 120 + i * 120 + rnd('s4bx', i) * 60, 150 + rnd('s4by', i) * 40, 6 + rnd('s4br', i) * 7, 's4bo' + i);
      const bob = Math.round(Math.sin(t * 3.1) * 1.5);
      const L = P.at(104, 80 + bob, 0.95);
      CP.speedLines(L.x(0), L.y(-6), 1, 0.02, 12, 70, 30, 40, C.CYAN, 's4sl', t);
      A.lm(L, mis, { probes: true, key: 's4lm' });
    });
    if (t >= 0.16) panel(P, qb, 's4b', () => boulderField(P, t, misFor('s4b')));
    if (t >= 0.3) {
      panel(P, qc, 's4c', () => {
        CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.CYAN_D, 0.35, { cell: 4 }), C.NIGHT));
      });
    }
    if (t >= 1.3) {
      const cx = lerp(qc[0], qc[2], 0.56);
      const cy = lerp(qc[1], qc[7], 0.56);
      CP.balloon(['60 SECONDS.'], cx, cy, qc[0] + 4, qc[1] + 6, { radio: true, scale: pop(t, 1.3, 0.2), key: 's4b60', zoom: 2 });
    }
    const dIn = seg(t, 1.05, 1.5, E.outBack);
    if (dIn > 0) {
      const qd = shiftQuad(TIGHT.d, 440 * (1 - dIn));
      panel(P, qd, 's4d', () => {
        const tilt = (rnd('stick', Math.floor(t * 8)) - 0.5) * 0.16;
        CP.rect(0, 0, CP.W, CP.H, C.CYAN_D);
        A.gloveStick(P.at(qd[0] + 40, qd[1] - 12, 1.0), misFor('s4d'), { key: 's4stick', tilt });
      });
    }
    // The alarm tone: big hand-cut letters, two bursts, the second one smaller and lower.
    const burst = (t0, beats, xs, ys, rots, size, key) => {
      'BEEP'.split('').forEach((ch, i) => {
        const ti = t0 + beats[i];
        if (t < ti) return;
        const s = size * track([[ti, 1.6], [ti + 0.08, 0.92, E.outQuad], [ti + 0.16, 1, E.inOutSine]], t);
        const cy = ys[i];
        const fill = layer(halftone(C.MAG, (x, y) => 0.6 * clamp01((y - cy) / (size * 4)), { cell: 3, angle: 1.3, ox: 1 }), C.YEL);
        CP.bigLetter(ch, xs[i], cy, s, rots[i], fill, { key: key + i, outline: 2, extrude: [3, 3], mis: [1, 1] });
      });
    };
    burst(1.86, [0, 0.05, 0.11, 0.155], [236, 290, 342, 398], [58, 49, 60, 51], [-0.13, 0.05, -0.05, 0.12], 6.5, 'bp1');
    burst(2.36, [0, 0.06, 0.09, 0.17], [446, 488, 528, 571], [312, 322, 315, 326], [0.08, -0.06, 0.1, -0.03], 4.8, 'bp2');
    CP.smudge(P.x(301), P.y(196), 8, 2.2, 's4smudge');
    return null;
  }
  function boulderField(P, t, mis) {
    const K = P.at(300, 0, 1);
    const F = K.shift(mis[0], mis[1]);
    F.rect(0, 0, 340, 200, layer(halftone(C.MOON_M, A.local(K, (lx, ly) => 0.15 + 0.3 * clamp01(ly / 200)), { cell: 4, angle: 0.78 }), C.MOON_L));
    // Boulders come toward the window: each one rides a loop of depth z, sorted far to near.
    const items = [];
    for (let i = 0; i < 16; i++) {
      const z = (rnd('bfz', i) + t * 0.42) % 1;
      items.push({ i, z });
    }
    items.sort((a, b) => a.z - b.z);
    for (const { i, z } of items) {
      const near = z * z;
      const x = 170 + (rnd('bfx', i) - 0.5) * (80 + near * 460);
      const y = 20 + near * 200;
      A.boulder(K, mis, x, y, 2 + near * 26, 'bf' + i);
    }
    // The window's triangular frame in the corner, and its far edge.
    K.poly([0, 0, 120, 0, 0, 90], C.NIGHT);
    A.inkLine(K, [120, 0, 0, 90], 's4win');
  }
  function pauseBeat(t) {
    const P = camera(320, 180, 1);
    paper(P, 'p4');
    const mis = misFor('s4p');
    panel(P, PAUSE, 's4pause', () => {
      const K = P.at(0, 0, 1);
      const F = K.shift(mis[0], mis[1]);
      F.rect(0, 0, 640, 360, layer(halftone(C.MOON_M, 0.07, { cell: 4, angle: 0.78 }), C.MOON_L));
      for (let i = 0; i < 6; i++) A.crater(K, F, 110 + rnd('pc', i) * 460, 90 + rnd('pcy', i) * 190, 3 + rnd('pcr', i) * 5, false);
      // The only detail: Eagle's own shadow, small, creeping left in held steps.
      const step = Math.floor((t - PAUSE_T) / 0.45);
      A.lmShadow(K.at(388 - step, 224, 0.9), { paint: C.MOON_D, stretch: 1.0, squash: 0.62 });
      // ...and the first dust the engine lifts, fanning out from under it.
      for (let i = 0; i < 5; i++) {
        const a = -0.5 + i * 0.25 + rndRange('pd', i + step * 7, -0.06, 0.06);
        const r0 = 14 + rnd('pd', i) * 6;
        K.line(386 - step - Math.cos(a) * r0, 224 + Math.sin(a) * r0 * 0.4, 386 - step - Math.cos(a) * (r0 + 10 + i * 2), 224 + Math.sin(a) * (r0 + 10) * 0.4, C.PAPER, 1);
      }
    }, { boil: 0.3 });
    CP.thumbprint(P.x(618), P.y(330), 'thumb4', C.SHADE);
    dissolve(seg(t, 7.5, 7.15, E.linear), 0.4);
    return null;
  }

  // ===================== SHOT 5 - PAYOFF: the Eagle has landed =====================
  const BIG = [24, 20, 606, 22, 603, 300, 25, 297];
  const INSET = [42, 36, 200, 38, 199, 140, 43, 138];
  const LMX = 408;
  const LMY = 232;
  const ENGINE_STOP = 2.04;

  function shot5(t) {
    const P = camera(320, 180, 1);
    paper(P, 'p5');
    const mis = misFor('s5');
    const lmY = LMY - Math.round(3 * (1 - seg(t, 0.92, 1.02, E.inQuad)));
    const L = P.at(LMX, lmY, 1.9);
    panel(P, BIG, 's5big', () => {
      const K = P.at(0, 0, 1);
      const F = K.shift(mis[0], mis[1]);
      sky(K, 0.4);
      A.surface(K, mis, { x0: 0, x1: 640, hy: 122, xc: 300, R: 5000, tilt: 0.01, yb: 360, craters: 34, key: 's5surf', toneTop: 0.08, toneBot: 0.4 });
      // Low sun from the left: the shadow runs long to the right, out of the panel.
      const gy = 294;
      A.lmShadow(K.at(LMX - 40, gy - 2, 1.9), { paint: dither(C.MOON_M, C.MOON_D, 0.75), stretch: 1.9 });
      dust(K, t, gy);
    });
    // Eagle breaks the panel: drawn after the border, its footpads stand in the bottom margin.
    A.lm(L, mis, { probes: false, key: 's5lm' });
    // Inset: the hand on the switch.
    if (t >= 1.4) {
      const k = pop(t, 1.4, 0.24);
      const Pi = scaleAbout(P, 120, 88, k);
      const pad = Pi.map([36, 30, 206, 32, 205, 146, 37, 144]);
      CP.poly(pad, C.PAPER);
      const press = track([[1.84, 0], [1.92, -0.12, E.outQuad], [2.02, 1.04, E.inQuad], [2.1, 1, E.inOutSine]], t);
      panel(Pi, INSET, 's5inset', () => A.gloveSwitch(Pi.at(34, 32, 0.95), misFor('s5g'), { key: 's5glove', press }));
    }
    // Linked balloons: the call sign first, then the line everyone remembers, lettered larger.
    let b1 = null;
    if (t >= 3.0) b1 = CP.balloon(['HOUSTON, TRANQUILITY', 'BASE HERE.'], P.x(306), P.y(46), undefined, undefined, { scale: pop(t, 3.0, 0.22), key: 's5b1' });
    if (t >= 4.15) {
      const b2 = CP.balloon(['THE EAGLE', 'HAS LANDED.'], P.x(444), P.y(110), L.x(4), L.y(-46), { radio: true, scale: pop(t, 4.15, 0.26), key: 's5b2', zoom: 2 });
      if (t >= 4.4) CP.linkBalloons(b1, b2);
    }
    // Margin note in pencil: the time, with a two-stroke arrow pointing into the panel.
    if (t >= 4.95) {
      CP.handArrow(P.x(512), P.y(338), P.x(470), P.y(318), seg(t, 4.95, 5.3, E.inOutSine), C.PENCIL, 's5arrow', 1);
      if (t >= 5.3) {
        const n = Math.floor(track([[5.3, 0], [5.42, 2.6, E.linear], [5.5, 2.9, E.linear], [5.72, 9.99, E.outQuad]], t));
        CP.text('hand', '20:17 UTC', P.x(520), P.y(332), C.PENCIL, { key: 'utc', reveal: n, slant: 1, jitter: 1.4 });
        if (t >= 5.85) CP.strokeOn(P.map([520, 342, 546, 343, 567, 341]), seg(t, 5.85, 6.0), C.PENCIL, 1);
      }
    }
    CP.thumbprint(P.x(40), P.y(336), 'thumb5', C.SHADE);
    dissolve(Math.min(seg(t, 0, 0.6, E.linear), 1 - seg(t, 7.35, 7.95, E.linear)), 0.6);
    return null;
  }
  /** Engine exhaust blasts dust in flat sheets; in vacuum it stops dead the moment the engine stops. */
  function dust(K, t, gy) {
    const ox = LMX;
    if (t < ENGINE_STOP) {
      // The sheet: a thin dithered haze hugging the ground, with streaks racing out of it.
      const haze = [];
      for (let i = 0; i <= 20; i++) {
        const x = ox - 300 + i * 30;
        haze.push(x, gy - 10 - Math.abs(Math.sin(i * 1.7)) * 6 - (1 - Math.abs(i - 10) / 10) * 8);
      }
      haze.push(ox + 300, gy + 4, ox - 300, gy + 4);
      K.poly(haze, dither(-1, C.PAPER, 0.3));
      for (let i = 0; i < 44; i++) {
        const side = i % 2 ? 1 : -1;
        const speed = rndRange('dust', i + 50, 320, 520);
        const d = ((t * speed) / 300 + rnd('dust', i + 99)) % 1;
        const r0 = 24 + d * 300;
        const len = 8 + rnd('dust', i + 7) * 22;
        const y = gy - 1 - rnd('dust', i + 3) * 14 * (1 - d * 0.5);
        K.line(ox + side * r0, y, ox + side * (r0 + len), y + rndRange('dust', i + 9, -1, 1), C.PAPER, 1);
      }
      return;
    }
    // In vacuum there is nothing to hold the dust up: the grains in flight finish their arcs and
    // the scene is perfectly still.
    const tau = t - ENGINE_STOP;
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1;
      const x = ox + side * (50 + i * 16 + tau * 160);
      const y = gy - 8 - i * 0.8 - 40 * tau + 220 * tau * tau;
      if (y < gy + 2) K.rect(x, y, 2, 1, C.PAPER);
    }
  }

  CP.SHOTS.push(
    {
      title: 'C-roll',
      dur: 7.5,
      render: shot4,
      narration: 'Now the autopilot is taking them into a field of boulders. Armstrong takes manual control and flies on, hunting for a clear spot. Then Houston calls: sixty seconds.',
      note: 'the gutters close in like walls, the alarm is drawn, not heard - then everything is cut away for one almost empty panel: only Eagle\'s shadow, and silence.',
    },
    {
      title: 'payoff',
      dur: 8,
      render: shot5,
      narration: 'Contact light. Engine stop. Then the words Houston had been waiting for: "Houston, Tranquility Base here. The Eagle has landed."',
      note: 'one quiet page: Eagle stands on the panel border, the dust (no air, so it just stops), a gloved hand, and somebody\'s pencilled time in the margin.',
    },
  );
})();

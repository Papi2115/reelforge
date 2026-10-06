/* comic-panels v2 showcase - shot 6 (tension: the squeeze) and shot 8 (the pause panel), from v1 shot 4. */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, E, seg, track, lerp, layer, halftone, rnd, rndRange } = CP;
  const { camera, paper, misFor, panel } = CP.page;
  const A = CP.art;
  const pop = CP.pop;
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

  // ===================== SHOT 6 - TENSION: the squeeze, the alarm; then everything freezes =====================
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
  // Shot 6 clock: the panel push covers the first 0.6 s; the beat is a little slower than v1; at FREEZE
  // the whole page holds its breath (motion stops dead) until the gutters collapse into shot 7.
  const LEAD6 = 0.25;
  const FREEZE = 5.7;
  const E1201 = [242, 150, 372, 146, 375, 214, 240, 211];

  function shot6(tShot) {
    const tm = Math.min(tShot, FREEZE);
    const t = Math.max(0, tm - LEAD6) * 0.82;
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
    panel(P, qa, 's4a', () => {
      const K = P.at(-scroll, 0, 1);
      sky(K, 0.3);
      A.surface(K, mis, { x0: -60, x1: 1300, hy: 132, xc: 400, R: 6000, tilt: 0, yb: 260, craters: 70, key: 's4surf', craterScale: 0.7 });
      for (let i = 0; i < 9; i++) A.boulder(K, mis, 120 + i * 120 + rnd('s4bx', i) * 60, 150 + rnd('s4by', i) * 40, 6 + rnd('s4br', i) * 7, 's4bo' + i);
      const bob = Math.round(Math.sin(tm * 3.1) * 1.5);
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
    // A fifth, smaller panel elbows in over the crossing: the other code, 1201. Same family, same red.
    if (t >= 2.95) {
      const k = track([[2.95, 1.25], [3.05, 0.97, E.outQuad], [3.14, 1, E.inOutSine]], t);
      const q = CP.page.scaleQuad(E1201, 308, 180, k);
      panel(P, q, 's6e', () => {
        CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.CYAN_D, 0.3, { cell: 3 }), C.NIGHT));
        const fill = layer(halftone(C.INK, (x, y) => 0.5 * clamp01((y - 176) / 22), { cell: 3, angle: 0.78 }), C.RED);
        [0, 1, 2, 3].forEach((i) => {
          const ch = '1201'[i];
          CP.bigLetter(ch, lerp(q[0], q[2], 0.2 + i * 0.2), lerp(q[1], q[7], 0.47) + (i % 2 ? 2 : -1), 3.4 * k, [-0.06, 0.04, -0.02, 0.07][i], fill, { key: 'c1201' + i, outline: 2, extrude: [2, 3], mis: [1, -1] });
        });
      }, { border: 3 });
    }
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
  // ===================== SHOT 8 - THE PAUSE: an almost empty panel before the landing =====================
  function shot8(tShot) {
    const t = tShot + PAUSE_T;
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
    return null;
  }

  CP.SHOTS[5] = {
    title: 'squeeze',
    dur: 7,
    render: shot6,
    transIn: { kind: 'push', dur: 0.6 },
    narration: 'And the alarms keep coming - 1202, then 1201. The autopilot is heading for a field of boulders. Armstrong takes manual control. Houston: sixty seconds.',
    note: 'the gutters close in like walls, the alarm is drawn, not heard; a fifth panel elbows in with the second code - then the whole page freezes, holding its breath.',
  };
  CP.SHOTS[7] = {
    title: 'pause',
    dur: 6,
    render: shot8,
    transIn: { kind: 'slide', dir: 'y', dur: 0.7, gutter: 22, ease: E.inOutSine },
    narration: '(silence)',
    note: 'everything is cut away for one almost empty panel: only Eagle\'s own shadow, creeping in held steps, and the first dust.',
  };
})();

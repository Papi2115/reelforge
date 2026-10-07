/* comic-panels v2 showcase - shots 1 (hook) and 2 (descent in panels), from v1. Every value is a function of t. */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, E, seg, track, lerp, layer, halftone } = CP;
  const { camera, scaleAbout, paper, misFor, panel } = CP.page;
  const A = CP.art;
  const clamp01 = CP.clamp01;

  /** Space with a faint cyan screen thickening toward the horizon (print can't do a true black). */
  function sky(K) {
    CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.CYAN_D, A.local(K, (lx, ly) => 0.32 * clamp01((ly - 40) / 200)), { cell: 4, angle: 0.26 }), C.NIGHT));
  }
  const pop = CP.pop;

  // ===================== SHOT 1 - HOOK =====================
  const S1_SPLASH = [14, 12, 627, 13, 626, 347, 13, 346];
  function shot1(t) {
    const hit1 = CP.shake(t, 0.52, 5, 0.14, 's1a');
    const hit2 = CP.shake(t, 3.46, 3, 0.1, 's1b');
    const zoom = lerp(1, 0.985, seg(t, 0, 0.3, E.outQuad));
    const P = camera(320, 180, zoom, [hit1[0] + hit2[0], hit1[1] + hit2[1]]);
    paper(P, 'p1');
    CP.thumbprint(P.x(30), P.y(354), 'thumb1', C.SHADE);
    if (t < 0.3) {
      // Before the slam: only the artist's pencil layout of the splash.
      const pencil = CP.dither(-1, C.PENCIL, 0.35 + t * 1.5);
      CP.polyline(P.map(S1_SPLASH), pencil, 1, true);
      // The layout rough under the ink: horizon arc, a box-and-legs for Eagle, a few gesture lines.
      const arc = [];
      for (let x = 0; x <= 640; x += 40) arc.push(x, 215 + ((x - 180) * (x - 180)) / 2800 - 0.04 * x + (x % 80 ? 1 : -1));
      CP.strokeOn(P.map(arc), seg(t, 0, 0.22), pencil, 1);
      CP.polyline(P.map([412, 100, 500, 102, 498, 148, 414, 146]), pencil, 1, true);
      CP.strokeOn(P.map([420, 146, 384, 178]), seg(t, 0.12, 0.25), pencil, 1);
      CP.strokeOn(P.map([492, 146, 528, 178]), seg(t, 0.14, 0.27), pencil, 1);
      CP.strokeOn(P.map([430, 100, 438, 58, 476, 56, 486, 100]), seg(t, 0.05, 0.2), pencil, 1);
      return null;
    }
    const k = track([[0.3, 1.14], [0.52, 1, E.outBack]], t);
    const Ps = scaleAbout(P, 320, 180, k);
    const mis = misFor('s1');
    const lmY = 112 + t * 2.6;
    const g1 = 7 * seg(t, 2.7, 2.92, E.outCubic);
    const g2 = 12 * seg(t, 2.8, 3.06, E.outBack);
    const swapped = t >= 2.95;
    const flash = t >= 2.95 && t < 3.02;
    const drawSplash = (shiftX) => {
      const K = Ps.at(shiftX, 0, 1);
      sky(K);
      A.surface(K, mis, { x0: -400, x1: 900, hy: 205, xc: 180, R: 1400, tilt: -0.04, yb: 400, craters: 56, key: 's1surf' });
      CP.speedLines(K.x(455), K.y(lmY - 20), 0.1, 1, 13, 96, 42, 52, C.CYAN, 's1sl', t);
      A.lm(K.at(455, lmY, 1.5), mis, { probes: true, key: 's1lm' });
    };
    if (g1 <= 0) {
      panel(Ps, S1_SPLASH, 's1splash', () => drawSplash(0));
    } else {
      // The splash splits: two hand-ruled gutters, uneven and leaning opposite ways.
      const qa = [14, 12, 214 - g1 / 2, 12, 204 - g1 / 2, 347, 13, 346];
      const qb = [214 + g1 / 2, 12, 386 - g2 / 2, 13, 397 - g2 / 2, 347, 204 + g1 / 2, 347];
      const qc = [386 + g2 / 2, 13, 627, 13, 626, 347, 397 + g2 / 2, 347];
      const reframe = -345 * seg(t, 2.78, 3.3, E.inOutCubic);
      panel(Ps, qa, 's1a', () => drawSplash(reframe));
      panel(Ps, qb, 's1b', () => {
        if (!swapped) return drawSplash(0);
        if (flash) return CP.rect(0, 0, CP.W, CP.H, C.PAPER);
        CP.rect(0, 0, CP.W, CP.H, C.NIGHT);
        A.cockpit(Ps.at(147, 92, 1.45), mis, { key: 's1cock', alarmLamp: true, horizonDy: 6 });
      });
      panel(Ps, qc, 's1c', () => {
        if (!swapped) return drawSplash(0);
        if (flash) return CP.rect(0, 0, CP.W, CP.H, C.PAPER);
        CP.rect(0, 0, CP.W, CP.H, C.MOON_D);
        const acty = CP.rnd('acty1', Math.floor(t * 7)) < 0.55;
        A.dsky(Ps.at(333, 52, 2.55), mis, { prog: true, acty, labels: true, code: '1202', key: 's1dsky' });
      });
      CP.smudge(Ps.x(390), Ps.y(318), 9, 1.9, 'smudge1');
    }
    // Caption box rides with the splash.
    if (t >= 0.7) {
      const dy = Math.round(-5 * (1 - seg(t, 0.7, 0.82, E.outQuad)));
      CP.caption(['JULY 20, 1969.'], Ps.x(30), Ps.y(28) + dy, { key: 'cap1', tilt: 1 });
    }
    // "PROGRAM ALARM." - radio balloon from Eagle, during the splash only.
    if (t >= 1.35 && t < 2.62) {
      const sc = t < 2.5 ? pop(t, 1.35, 0.2) : 1 - seg(t, 2.5, 2.6, E.inQuad);
      CP.balloon(['PROGRAM ALARM.'], Ps.x(300), Ps.y(70), Ps.x(436), Ps.y(lmY - 30), { radio: true, scale: sc, key: 'b1' });
    }
    // The number: four hand-cut letters slam in, uneven beat, breaking the top border.
    const beats = [0, 0.07, 0.17, 0.215];
    const xs = [428, 481, 533, 588];
    const ys = [24, 31, 26, 33];
    const rot = [-0.11, 0.05, -0.04, 0.1];
    '1202'.split('').forEach((ch, i) => {
      const t0 = 3.4 + beats[i];
      if (t < t0) return;
      const size = 7 * track([[t0, 1.75], [t0 + 0.1, 0.9, E.outQuad], [t0 + 0.19, 1, E.inOutSine]], t);
      const cx = Ps.x(xs[i]);
      const cy = Ps.y(ys[i]);
      const fill = layer(halftone(C.INK, (x, y) => 0.55 * clamp01((y - cy - 4) / 26), { cell: 3, angle: 0.78 }), C.RED);
      CP.bigLetter(ch, cx, cy, size * Ps.s, rot[i], fill, { key: 'n' + i, outline: 2, extrude: [3, 4], mis: [2, -1] });
    });
    // Refresh: the reader's question, pencilled into the bottom margin under the code.
    if (t >= 5.1) {
      const n = Math.floor(CP.seg(t, 5.1, 5.6, E.outQuad) * 13.99);
      CP.text('hand', 'WHAT IS 1202?', Ps.x(452), Ps.y(349), C.PENCIL, { key: 's1q', reveal: n, slant: 1, jitter: 1.2 });
      if (t >= 5.7) CP.handArrow(Ps.x(544), Ps.y(352), Ps.x(572), Ps.y(336), CP.seg(t, 5.7, 5.95, E.inOutSine), C.PENCIL, 's1qa', 1);
    }
    if (t >= 3.95) {
      const helm = Ps.at(147, 92, 1.45);
      CP.balloon(['IT\'S A 1202.'], Ps.x(288), Ps.y(110), helm.x(100), helm.y(52), { radio: true, scale: pop(t, 3.95, 0.22), key: 'b2' });
    }
    return null;
  }

  // ===================== SHOT 2 - A-ROLL: the descent, read panel by panel =====================
  const S2 = {
    p1: [12, 12, 262, 13, 257, 348, 13, 347],
    p2: [270, 12, 628, 13, 627, 148, 271, 150],
    p3: [271, 159, 389, 158, 391, 348, 270, 347],
    p4: [399, 158, 628, 160, 627, 348, 400, 347],
  };
  function shot2(t) {
    const lmY = track([[0, 36], [2.3, 196, E.inOutSine], [8, 214, E.linear]], t);
    // The reader's eye: hold, travel, hold. Each travel has its own easing and length.
    const cam = [
      [0, 137, 104, 1.45],
      [0.5, 137, 104, 1.45],
      [2.0, 137, 190, 1.45, E.inOutSine],
      [2.6, 449, 80, 2, E.inOutCubic],
      [3.72, 449, 80, 2],
      [4.12, 330, 253, 2, E.outQuart],
      [4.92, 330, 253, 2],
      [5.46, 513, 250, 2, E.inOutCubic],
      [6.42, 513, 250, 2],
      [6.92, 320, 180, 1.0, E.outBackSoft],
      [8.0, 320, 180, 1.0],
    ];
    const cx = track(cam.map((k) => [k[0], k[1], k[4]]), t);
    const cy = track(cam.map((k) => [k[0], k[2], k[4]]), t);
    const cz = track(cam.map((k) => [k[0], k[3], k[4]]), t);
    const P = camera(cx, cy, cz);
    paper(P, 'p2');
    const mis = misFor('s2');
    panel(P, S2.p1, 's2p1', () => {
      const K = P.at(0, 0, 1);
      sky(K);
      A.surface(K, mis, { x0: -40, x1: 300, hy: 214, xc: 120, R: 700, tilt: 0.05, yb: 360, craters: 22, key: 's2surf', craterScale: 0.8 });
      CP.speedLines(K.x(137), K.y(lmY - 16), -0.06, 1, Math.round(11 * (1 - seg(t, 1.9, 2.5))), 74 * K.s, 32 * K.s, 42 * K.s, C.CYAN, 's2sl', t);
      A.lm(K.at(137, lmY, 1.15), mis, { probes: true, key: 's2lm' });
    });
    panel(P, S2.p2, 's2p2', () => {
      A.cockpit(P.at(270, 10, 1.0), misFor('s2b'), { key: 's2cock', horizonDy: -26, alarmLamp: CP.rnd('lamp2', Math.floor(t * 3)) < 0.7 });
    });
    panel(P, S2.p3, 's2p3', () => {
      CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.MOON_D, 0.4, { cell: 3 }), C.MOON_M));
      const acty = CP.rnd('acty2', Math.floor(t * 6)) < 0.5;
      A.dsky(P.at(270, 194, 1.0), misFor('s2c'), { prog: true, acty, labels: P.s > 1.6, code: '1202', key: 's2dsky' });
    });
    panel(P, S2.p4, 's2p4', () => {
      A.houston(P.at(400, 158, 1.0), misFor('s2d'), { key: 's2hou', lean: Math.round(2 * seg(t, 5.5, 5.9, E.outQuad)) });
    });
    CP.thumbprint(P.x(636), P.y(178), 'thumb2', C.SHADE);
    // Lettering is placed in page space, so it travels with the panels and stays crisp at any zoom.
    if (t >= 2.72) {
      const helm = P.at(270, 10, 1.0);
      CP.balloon(['GIVE US A READING', 'ON THE 1202', 'PROGRAM ALARM.'], P.x(456), P.y(46), helm.x(112), helm.y(50), { radio: true, scale: pop(t, 2.72, 0.24), key: 's2b1', zoom: P.s });
    }
    if (t >= 5.42) {
      const dy = Math.round(-4 * (1 - seg(t, 5.42, 5.56, E.outQuad)));
      CP.caption(['HOUSTON. GUIDANCE OFFICER', 'STEVE BALES.'], P.x(405), P.y(165) + dy, { key: 's2cap', tilt: -1, zoom: P.s });
    }
    // No answer yet: the page ends on the question (the flashback interrupts; shot 5 answers it).
    if (t >= 5.95) {
      const hou = P.at(400, 158, 1.0);
      CP.balloon(['GO, OR ABORT?'], P.x(560), P.y(232), undefined, undefined, { scale: pop(t, 5.95, 0.2), key: 's2think', zoom: P.s, thought: true });
      if (t >= 6.1) CP.thoughtDots(P.x(560), P.y(232), hou.x(80), hou.y(84), P.s, 's2dots');
    }
    // Press intro: the colour plates land one after another, black key last.
    const printed = (t >= 0.06 ? 'Y' : '') + (t >= 0.19 ? 'C' : '') + (t >= 0.33 ? 'M' : '') + (t >= 0.47 ? 'K' : '');
    return printed === 'YCMK' ? null : { remap: CP.page.plateRemap(printed) };
  }

  CP.SHOTS[0] = {
    title: 'hook',
    dur: 7,
    render: shot1,
    narration: 'July 20, 1969. Eagle is falling toward the Moon when its computer flashes an alarm the crew has to ask Houston about: 1202.',
    note: 'one splash, slammed in, then cut into a strip by two leaning gutters - the number gets the widest panel and the only red on the page.',
  };
  CP.SHOTS[1] = {
    title: 'descent',
    dur: 8,
    render: shot2,
    transIn: { kind: 'slide', dur: 0.8 },
    narration: 'The crew asks Houston what the alarm means. In Mission Control, guidance officer Steve Bales has seconds to decide: go, or abort.',
    note: 'the camera reads the page like an eye: Eagle, crew, the code, Houston - and the page ends on the question, not the answer.',
  };
})();

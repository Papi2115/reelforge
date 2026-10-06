/* comic-panels v2 showcase - shot 10: quiet epilogue. Out of the window the last grains of dust land and
 * stop dead (no air); a glove rests on the switch it just threw; the line; and somebody's pencil in the
 * empty margin. The film ends on a held page.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, E, seg, track, layer, halftone, rnd, rndRange, clamp01 } = CP;
  const { camera, paper, misFor, panel } = CP.page;
  const A = CP.art;
  const pop = CP.pop;

  const P1 = [14, 14, 626, 12, 624, 212, 16, 214];
  const P2 = [16, 224, 318, 222, 320, 348, 14, 346];
  const WIN = [196, 22, 590, 22, 590, 204];
  const DUST_END = 1.7;
  const B1_T = 2.0;
  const B2_T = 3.15;
  const UTC_T = 4.45;
  const NOTE_T = 5.45;

  /** The view out of the left window: ground, horizon, and grains finishing their arcs. */
  function windowView(t, mis) {
    const K = new CP.Xf(1, 0, 0);
    const F = K.shift(mis[0], mis[1]);
    // Cabin: dark, a screen of cyan for the light bouncing in; instrument edges along the bottom.
    CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.CYAN_D, 0.28, { cell: 4, angle: 0.26 }), C.NIGHT));
    const prev = CP.getClip();
    CP.setClip(CP.maskPoly(K.map(WIN), prev));
    CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.CYAN_D, A.local(K, (lx, ly) => 0.2 * clamp01((ly - 30) / 60)), { cell: 4, angle: 0.26 }), C.NIGHT));
    const hy = A.surface(K, mis, { x0: 180, x1: 600, hy: 86, xc: 380, R: 3000, tilt: -0.02, yb: 230, craters: 22, key: 's10win', craterScale: 0.7 });
    for (let i = 0; i < 4; i++) A.boulder(K, mis, 300 + i * 70 + rnd('s10bx', i) * 30, hy(300 + i * 70) + 30 + rnd('s10by', i) * 60, 4 + rnd('s10br', i) * 5, 's10bo' + i);
    // Dust: each grain flies a clean parabola from where the exhaust threw it, lands, and stays put.
    for (let i = 0; i < 40; i++) {
      const x0 = rndRange('s10d', i, 230, 560);
      const ground = hy(x0) + 12 + rnd('s10d', i + 40) * 90;
      const t0 = -0.35 + rnd('s10d', i + 80) * 0.6;
      const tl = t0 + 0.7 + rnd('s10d', i + 120) * (DUST_END - 0.75);
      const vx = rndRange('s10d', i + 160, 40, 120) * (rnd('s10d', i + 200) < 0.5 ? -1 : 1);
      const tau = Math.min(t, tl) - t0;
      const T = tl - t0;
      const g = 260;
      const vy = (g * T) / 2;
      const x = x0 + vx * tau;
      const y = ground - (vy * tau - (g * tau * tau) / 2);
      if (t < t0) continue;
      if (t < tl) {
        // A short streak behind each grain (where it was a frame ago), then the grain.
        const tp = Math.max(0, tau - 1 / 30);
        CP.line(x0 + vx * tp, ground - (vy * tp - (g * tp * tp) / 2), x, y, C.MOON_L, 1);
        CP.rect(x - 1, y - 1, 2, 2, C.PAPER);
      } else CP.rect(x, ground, 2, 1, C.MOON_D);
    }
    CP.setClip(prev);
    // Window frame and the cabin wall around it.
    CP.polyline(CP.boil(K.map(WIN), 's10frame', 0.4), C.MOON_D, 5, true);
    CP.polyline(CP.boil(K.map(WIN), 's10frame', 0.4), C.INK, 1, true);
    F.poly([0, 178, 150, 186, 196, 214, 0, 214], C.MOON_D);
    for (let i = 0; i < 4; i++) K.rect(18 + i * 30 + rnd('s10l', i) * 6, 192 + (i % 2), 10, 5, i === 1 ? C.YEL : C.NIGHT);
    A.inkLine(K, [0, 178, 150, 186, 196, 214], 's10wall');
  }

  function shot10(t) {
    const P = camera(320, 180, 1);
    paper(P, 'p10');
    panel(P, P1, 's10a', () => windowView(t, misFor('s10a')));
    // The glove has thrown the switch and rests on it; the fingers loosen once, a little after the line.
    const press = track([[0, 1], [3.9, 1], [4.2, 0.9, E.inOutSine]], t);
    panel(P, P2, 's10b', () => {
      CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.MOON_D, 0.28, { cell: 3, angle: 0.5 }), C.MOON_M));
      A.gloveSwitch(P.at(P2[0] + 6, P2[1] - 44, 1.22), misFor('s10b'), { key: 's10g', press });
    });
    // The line, in two linked balloons: the call sign first, then the words, lettered larger.
    let b1 = null;
    if (t >= B1_T) b1 = CP.balloon(['HOUSTON, TRANQUILITY', 'BASE HERE.'], 98, 52, 40, 214, { scale: pop(t, B1_T, 0.22), key: 's10b1' });
    if (t >= B2_T) {
      const b2 = CP.balloon(['THE EAGLE', 'HAS LANDED.'], 150, 134, undefined, undefined, { scale: pop(t, B2_T, 0.26), key: 's10b2', zoom: 2 });
      if (t >= B2_T + 0.24) CP.linkBalloons(b1, b2);
    }
    // The empty margin, and somebody's pencil in it.
    if (t >= UTC_T) {
      const n = Math.floor(track([[UTC_T, 0], [UTC_T + 0.14, 2.6, E.linear], [UTC_T + 0.24, 2.9, E.linear], [UTC_T + 0.55, 9.99, E.outQuad]], t));
      CP.text('hand', '20:17 UTC', 392, 258, C.PENCIL, { key: 's10utc', reveal: n, slant: 1, jitter: 1.4, scale: 2 });
      if (t >= UTC_T + 0.62) CP.strokeOn([392, 278, 450, 279, 506, 276], seg(t, UTC_T + 0.62, UTC_T + 0.8), C.PENCIL, 1);
    }
    if (t >= NOTE_T) {
      const n = Math.floor(seg(t, NOTE_T, NOTE_T + 0.85, E.outQuad) * 27.99);
      CP.text('hand', 'NO AIR. THE DUST', 396, 292, C.PENCIL, { key: 's10n1', reveal: n, slant: 1, jitter: 1.3 });
      CP.text('hand', 'JUST STOPS.', 404, 304, C.PENCIL, { key: 's10n2', reveal: Math.max(0, n - 16), slant: 1, jitter: 1.3 });
      if (t >= NOTE_T + 0.95) CP.handArrow(470, 296, 528, 214, seg(t, NOTE_T + 0.95, NOTE_T + 1.3, E.inOutSine), C.PENCIL, 's10arrow', 1);
    }
    CP.thumbprint(612, 334, 'thumb10', C.SHADE);
    return null;
  }

  CP.SHOTS[9] = {
    title: 'epilogue',
    dur: 8,
    render: shot10,
    transIn: { kind: 'inset', dur: 1.0, x: 518, y: 184, size: 0.16 },
    narration: 'Engine stop. Outside, the dust they threw up falls straight back down - there is no air to hold it. Then: "Houston, Tranquility Base here. The Eagle has landed."',
    note: 'the quietest page: dust that just stops, a glove resting on the switch it threw, the line - and the time, pencilled into the empty margin by a reader.',
  };
})();

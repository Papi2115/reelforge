/* Shots 4-6 (c-cam): the years go by (wide, the beard growing under the year slate, the tally marks, a tilted close-up
   of the shouting), the town loses patience (low angle on the Mayor, insert: the tapping foot, his face), locked in
   (the door from low, extreme close-up on the turning key, the Mayor's smirk, the face at the grille). Grips on fixed
   scenery are solved first in world space: the key sits where the mayor's palm lands, whatever the camera does. */
'use strict';
(function () {
  const ST = window.ST, K = ST.key, S = ST.step, CAST = ST.CAST, tw = ST.twos;

  // where a character's palm lands in world space for draw props p (no lean), side 'aL' | 'aR'
  ST.palmWorld = (ch, p, side, hsz) => {
    const V = ST.view(p.yaw || 0), J = ST.solve(V, ch.D, p.pose), g = ST.palm(J[side], hsz);
    return [p.x + (V.mir ? -1 : 1) * g[0] * p.s, p.y + g[1] * p.s];
  };
  // a wooden ladder between two world points (rails + rungs)
  ST.ladder = (ctx, x0, y0, x1, y1, seed) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = (-dy / L) * 34, ny = (dx / L) * 34;
    [-1, 1].forEach((s, i) => ST.tube(ctx, [x0 + nx * s, y0 + ny * s, x1 + nx * s, y1 + ny * s], [14, 12], '#6b5034', { lw: 5, seed: seed + i, shade: ['#4e3a25', -3, 0] }));
    for (let k = 1; k * 70 < L; k++) { const u = (k * 70) / L; ST.stroke(ctx, [x0 + dx * u - nx, y0 + dy * u - ny, x0 + dx * u + nx, y0 + dy * u + ny], { w: 9, color: '#5a4430', seed: seed + 2 + k, taper: false }); }
  };

  ST.defineShot('years', {
    title: 'Years go by', role: 'the deadlock', note: 'Wide on the table (1268); cut: close on the Tired Cardinal asleep under the year slate as the beard grows and snow falls in the window (1269); cut: extreme close-up, tally marks piling up; cut: tilted push-in on the Stubborn Cardinal still shouting (1271).',
    cuts: [[0, 'wide'], [1.5, 'beard'], [3.25, 'tally'], [4.75, 'shout']],
    render(ctx, t) {
      const tt = tw(t), yr = Math.min(3, Math.floor(tt / 1.6)), T = CAST.tired, B = CAST.stubborn, cut = ST.cut(t, this.cuts).name;
      if (cut === 'wide') ST.camera(ctx, 960, 500, K(t, [[0, 0.96], [1.5, 1.0]]));
      else if (cut === 'beard') ST.camera(ctx, 520, 430, K(t, [[1.5, 1.9], [3.25, 2.05]]));
      else if (cut === 'tally') ST.camera(ctx, K(t, [[3.25, 1570], [4.75, 1610]]), 460, 3.0, -4);
      else ST.camera(ctx, 1250, 520, K(t, [[4.75, 1.9], [7, 2.25]]), 7);
      ST.setHall(ctx, t, { tally: Math.min(70, Math.floor(tt * 11)), year: 1268 + yr, snow: yr === 1, web: Math.min(1, tt / 6), candle: 1 - ((tt / 1.6) % 1) * 0.85 });
      const argue = Math.floor(tt * 3) % 2 === 0;
      ST.conclave(ctx, t, {
        extras: (i) => ((i + Math.floor(tt * 2)) % 3 === 0 ? 'point' : 'mutter'),
        tired: { beard: [0.15, 0.4, 0.7, 1][yr] + (cut === 'beard' ? ((tt - 1.5) / 1.75) * 0.3 : 0), expr: S(t, [[0, 'exhausted'], [1.2, 'asleep'], [3.6, 'exhausted'], [4.2, 'asleep']]), lean: 4 + yr * 3, headDy: 10, pose: ST.seat(T.D, { hL: ST.handAt(T.D, 1, -0.2, 0.66, 0.5), hR: ST.handAt(T.D, -1, -0.2, 0.68, 0.48) }) },
        stubborn: {
          expr: argue ? 'yelling' : 'rage', talk: [[0, 7]], head: ST.shake(t, -1, 0.5), headDy: tt % 1.5 < 0.1 ? -12 : 0,
          pose: ST.seat(B.D, Object.assign(ST.pointAt(B.D, -1, argue ? 0.15 : 0), { hL: ST.handAt(B.D, 1, 0.1, argue ? 0.2 : 0.4, 0.5), kL: argue ? 'fist' : 'flat' })),
        },
        items: ST.tableBallots(ctx, 5 + yr * 4, 640, true),
      });
    },
  });

  ST.defineShot('patience', {
    title: 'The town loses patience', role: 'pressure', note: 'Low angle, slight roll: the Mayor huge left of centre, arms folded, the muttering crowd and the palace behind; insert: his tapping boot on the cobbles; cut: close on his face as the patience snaps.',
    cuts: [[0, 'low'], [2.5, 'foot'], [3.5, 'face']],
    render(ctx, t) {
      const tt = tw(t), TONES = ST.TOWN_TONES, cut = ST.cut(t, this.cuts).name;
      const M = CAST.mayor, R = CAST.roofer, BK = CAST.baker, tap = Math.floor(tt * 6) % 2;
      const mp = {
        x: 720, y: 1420, s: 1.5, t, yaw: 1, head: S(t, [[0, 1], [1.6, 0]]), expr: S(t, [[0, 'disgust'], [3.5, 'rage']]), headDy: tt >= 3.5 && tt < 3.7 ? -14 : 0,
        pose: Object.assign(ST.pose('stand', M.D, null, { fR: ST.footAt(M.D, -1, 0.06, tap ? 0.07 : 0, 0.12) }), M.fold()), layer: { L: 2, R: 2 },
      };
      if (cut === 'low') ST.camera(ctx, K(t, [[0, 940], [2.5, 980]]), 660, K(t, [[0, 1.0], [2.5, 1.06]]), 2);
      else if (cut === 'foot') ST.camera(ctx, 700, 1330, 2.6, -3);
      else ST.camera(ctx, 790, 520, K(t, [[3.5, 1.9], [5, 2.1]]), -3);
      ST.setStreet(ctx, t, {});
      for (let i = 0; i < 11; i++) {
        const tone = TONES[(i + 1) % 4];
        ST.crowdFigure(ctx, { x: 360 + i * 120 + (i % 2) * 40, y: 900 + (i % 2) * 30, s: 1.0 + (i % 2) * 0.1, kind: (i + 2) % 5, yaw: i < 5 ? 1 : -1, t: t + i * 0.13, mode: tt > 0.4 + (i % 4) * 0.3 ? 'mutter' : 'stand', col: tone[0], colD: tone[1], skin: tone[2], seed: 740 + i * 7 });
      }
      const rp = { x: 1600, y: 1062, s: 0.8, t, yaw: -1, expr: S(t, [[0, 'deadpan'], [2.6, 'disgust']]), pose: ST.pose('stand', R.D, null, { hL: ST.handAt(R.D, 1, 0.05, -0.3, 0.25), kL: 'grip', poleL: [1, 0.3, -0.3] }) };
      const g = ST.palmWorld(R, rp, 'aL', 32);
      ST.ladder(ctx, g[0] + 60, 1066, g[0] - 60, g[1] - 300, 760);
      R.draw(ctx, rp);
      BK.draw(ctx, { x: 1260, y: 1050, s: 0.84, t, yaw: -1, loaf: true, jug: true, head: S(t, [[0, -1], [2.0, -2]]), expr: S(t, [[0, 'deadpan'], [2.0, 'disgust']]), talk: [[2.2, 3.4]] });
      M.draw(ctx, mp);
    },
  });

  ST.defineShot('lock', {
    title: 'Locked in', role: 'turn of the screw', note: 'The door from low and tilted as it slams; extreme close-up: the key turns in the lock; the Mayor smirks; cut close: the Stubborn Cardinal glaring through the bars, the camera rolling in.',
    cuts: [[0, 'door'], [0.9, 'key'], [2.25, 'smirk'], [3.0, 'grille']],
    render(ctx, t) {
      const tt = tw(t), cut = ST.cut(t, this.cuts).name;
      if (cut !== 'grille') {
        const M = CAST.mayor, slam = tt < 0.5, turn = Math.min(4, Math.max(0, Math.floor((tt - 1.1) / 0.2)));
        const mp = { x: 560, y: 1190, s: 0.95, t, yaw: 2, head: tt >= 2.25 ? 1 : 2, expr: S(t, [[0, 'focused'], [0.9, 'rage'], [2.25, 'smug']]), pose: ST.pose('stand', M.D, null, { hR: ST.handAt(M.D, -1, -0.15, 0.05, 0.85), kR: 'grip', poleR: [-1, 0.4, -0.5] }) };
        const g = ST.palmWorld(M, mp, 'aR', 40);
        if (cut === 'door') ST.camera(ctx, 940, 640, 0.92, 4);
        else if (cut === 'key') ST.camera(ctx, g[0] + 130, g[1] - 10, K(t, [[0.9, 2.9], [2.25, 3.1]]));
        else ST.camera(ctx, 600, 640, K(t, [[2.25, 2.3], [3, 2.45]]), -2);
        ST.setDoorClose(ctx, t, { keyhole: [g[0] + 200, g[1] + 22], shake: slam ? (Math.floor(tt * 12) % 2 ? 8 : -8) : 0 });
        if (slam) [0, 1, 2].forEach((i) => ST.stroke(ctx, [480 - i * 40, 300 + i * 160, 420 - i * 40, 280 + i * 160], { w: 7, seed: 770 + i, taper: false }));
        ctx.save();
        ctx.beginPath();
        ctx.rect(-4000, -4000, g[0] + 4196, 8000);
        ctx.clip(); // the bit disappears into the keyhole
        ctx.translate(g[0], g[1]);
        ctx.scale(1, Math.cos((turn * Math.PI) / 4)); // the bow turns about the shaft
        ST.bigKey(ctx, 24, 0, 0, 780);
        ctx.restore();
        M.draw(ctx, mp);
        if (cut === 'door') ST.fg(ctx, [1700, 1120, 1760, 300, 1840, 0, 1960, 0, 1960, 1120], 790); // the street corner right at the lens
      } else {
        ST.camera(ctx, 960, 540, K(t, [[3, 1.0], [5, 1.18]]), K(t, [[3, 0], [5, -6]]));
        const B = CAST.stubborn, D = B.D;
        ST.setGrilleClose(ctx, () => B.draw(ctx, {
          x: 960, y: 1650, s: 1.9, t, yaw: 0, expr: S(t, [[3, 'rage'], [3.8, 'yelling']]), talk: [[3.8, 5]], headDy: tt >= 3.8 && tt < 4.0 ? -14 : 0,
          pose: ST.pose('stand', D, null, { hL: ST.handAt(D, 1, 0.16, -0.82, 0.2), hR: ST.handAt(D, -1, 0.16, -0.82, 0.2), kL: 'grip', kR: 'grip', poleL: [1, 0.2, -0.3], poleR: [-1, 0.2, -0.3] }),
        }));
      }
    },
  });
})();

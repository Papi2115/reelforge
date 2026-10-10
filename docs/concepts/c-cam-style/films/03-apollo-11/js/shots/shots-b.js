/* Shots 5-8: the alarm goes off, 1202 and the checklist, mission control says go, the boulders. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST;
  const tw = ST.twos;
  const flash = (tt, t0) => tt >= t0 && Math.floor((tt - t0) * 4) % 2 === 0;

  ST.defineShot('descent', {
    title: 'The alarm', role: 'the scare', note: 'You read the checklist, framed off-centre; cut to an extreme close-up of the master alarm; Dutch-tilted wide: you throw your arms up and flap, the Commander glances over, chewing.',
    render(ctx, t) {
      const tt = tw(t), on = flash(tt, 2.0);
      ST.cutCam(ctx, t, [
        { at: 0, x: [[0, 1200], [2, 1240]], y: 560, z: [[0, 1.35], [2, 1.45]] }, // you reading, framed right
        { at: 2.0, x: 1059, y: 300, z: 3.2, rot: 6 }, // extreme close-up: MASTER ALARM
        { at: 2.6, x: [[2.6, 980], [6, 1020]], y: 560, z: [[2.6, 1.05], [6, 1.2]], rot: -5 }, // Dutch wide: panic
      ]);
      ST.setLM(ctx, t, { scroll: t * 60, k: K(t, [[0, 1], [6, 0.8]]), alarm: on });
      const Y = CAST.you, M = CAST.commander;
      M.draw(ctx, {
        x: 640, y: 1066, s: 0.94, t, yaw: 1, chew: true, head: tt >= 2.6 && tt < 4.4 ? 2 : undefined, look: tt >= 2.6 && tt < 4.4 ? [0.6, 0] : [0, 0], expr: 'deadpan',
        pose: ST.pose('stand', M.D, null, { hL: ST.handAt(M.D, 1, -0.05, 0.55, 0.6), hR: ST.handAt(M.D, -1, -0.05, 0.55, 0.6), kL: 'flat', kR: 'flat' }),
      });
      const panic = tt >= 2.2;
      Y.draw(ctx, {
        x: 1300, y: 1060, s: 0.9, t, yaw: -1, sweat: panic, checklist: panic ? undefined : 0,
        expr: S(t, [[0, 'focused'], [2.0, 'shock'], [2.4, 'scared']]), headDy: tt >= 2.0 && tt < 2.2 ? -18 : 0,
        pose: !panic ? ST.pose('stand', Y.D, null, ST.youRead(Y.D)) : tt < 3.0 ? ST.pose('armsUp', Y.D) : ST.pose('flail', Y.D, (tt * 1.5) % 1),
      });
    },
  });

  ST.defineShot('alarm', {
    title: '1202', role: 'the unknown', note: 'Tilted extreme close-up: the computer shows 1202, PROG lit, the alarm pulsing red. Cut: you flip through the checklist faster and faster, sweating.',
    render(ctx, t) {
      const tt = tw(t), on = flash(tt, 0);
      ST.cutCam(ctx, t, [
        { at: 0, x: [[0, 540], [2.4, 548]], y: 290, z: [[0, 2.4], [2.4, 2.6]], rot: 4 }, // extreme close-up: 1202
        { at: 2.4, x: [[2.4, 1300], [5, 1330]], y: 640, z: [[2.4, 1.45], [5, 1.6]], rot: -6 }, // you flip pages
      ]);
      ST.setPanelWall(ctx, 350);
      ST.dsky(ctx, 200, 170, 1.15, 351, { alarm: true, code: on ? '1202' : '' });
      ST.rect(ctx, 740, 120, 270, 90, on ? C.RED : C.RED_D, { seed: 352, lw: 6 });
      ST.label(ctx, 'MASTER ALARM', 875, 165, { fill: on ? '#f0d8b0' : '#3a1a14', font: "bold 24px 'Arial Black', Arial, sans-serif" });
      if (on) ST.pool(ctx, 870, 170, 900, 600, C.RED, 0.1);
      const Y = CAST.you, fast = tt >= 2.4, page = ((tt * (fast ? 6 : 2.5)) % 1);
      Y.draw(ctx, {
        x: 1420, y: 1560, s: 1.55, t, yaw: -1, sweat: true, checklist: page, look: [-0.3, 0.7],
        expr: S(t, [[0, 'confused'], [2.4, 'scared']]), headDy: fast ? (Math.floor(tt * 12) % 2) * -4 : 0,
        pose: ST.pose('stand', Y.D, null, Object.assign(ST.youRead(Y.D), { hL: [42, Y.D.sy + 80, 120], hR: [-42, Y.D.sy + 80, 120] })),
      });
    },
  });

  ST.defineShot('control', {
    title: 'Mission control', role: 'the calm', note: 'Houston: close-up, the guidance engineer says go; close-up, the Flight Director sips his coffee and nods; pull back past the shoulder of an engineer: thumbs up.',
    render(ctx, t) {
      const tt = tw(t);
      const cut = ST.cutCam(ctx, t, [
        { at: 0, x: 560, y: 520, z: 1.9 }, // close-up: the guidance engineer says go
        { at: 1.6, x: 1180, y: 560, z: [[1.6, 1.8], [2.9, 1.9]] }, // close-up: the Flight Director sips, nods
        { at: 2.9, x: [[2.9, 1000], [5, 960]], y: 600, z: [[2.9, 1.2], [5, 1.05]] }, // pull back: thumbs up
      ]);
      ST.setControl(ctx, t);
      [[180, 0], [760, 1], [1660, 2], [2000, 0]].forEach(([x, kind], i) => ST.crowdFigure(ctx, { x, y: 1060, s: 1.4, kind, yaw: 3, mode: 'work', ph: (tt * 0.8 + i * 0.3) % 1, col: ['#a49c80', '#8e8a7a', '#9a9278'][i % 3], colD: '#5c5a50', skin: '#8a7058', seed: 400 + i * 13 }));
      const G = CAST.guidance, F = CAST.director, go = tt >= 0.3 && tt < 1.6;
      G.draw(ctx, {
        x: 470, y: 1100, s: 0.9, t, yaw: 1, talk: [[0.3, 1.5]], expr: S(t, [[0, 'focused'], [1.6, 'grin']]),
        pose: ST.pose('stand', G.D, null, go ? { hR: ST.handAt(G.D, -1, 0.1, 0.1, 0.7), kR: 'point' } : {}),
      });
      if (go) ST.tag(ctx, 'GO!', 640, 330, 60, -4, 401);
      const sip = tt >= 1.0 && tt < 2.0, thumb = tt >= 2.9, nod = (tt >= 2.1 && tt < 2.3) || (tt >= 2.5 && tt < 2.7);
      F.draw(ctx, {
        x: 1260, y: 1110, s: 1.0, t, yaw: -1, mug: sip ? -40 : 0, steam: !sip, sip, headDy: nod ? 10 : 0,
        expr: S(t, [[0, 'deadpan'], [1.0, 'focused'], [2.1, 'deadpan'], [2.9, 'smug']]), look: [-0.5, 0],
        pose: ST.pose('stand', F.D, null, Object.assign(sip ? ST.directorSip(F.D, 1) : {}, thumb ? { hL: ST.handAt(F.D, 1, 0.3, -0.6, 0.25), kL: 'thumb', poleL: [1, 0.2, -0.3] } : {})),
      });
      ST.controlFront(ctx);
      if (cut === 2) ST.crowdFigure(ctx, { x: 1800, y: 1560, s: 3.2, kind: 1, yaw: 3, mode: 'stand', col: '#14100c', colD: '#14100c', skin: '#14100c', seed: 470 }); // a shoulder in the foreground
      ST.cigSmoke(ctx, 470, 880, t);
    },
  });

  ST.defineShot('window', {
    title: 'The boulders', role: 'the problem', note: 'Over your shoulder, out of the window: the landing area slides closer; tilted cut in on the crater ringed by boulders; reverse on your face at the window, sweating.',
    render(ctx, t) {
      const tt = tw(t);
      const cut = ST.cutCam(ctx, t, [
        { at: 0, x: [[0, 960], [3, 990]], y: [[0, 540], [3, 570]], z: [[0, 1.0], [3, 1.1]] }, // over your shoulder
        { at: 3.0, x: 1000, y: 640, z: [[3, 1.7], [4.6, 1.85]], rot: -4 }, // tilted close: the boulders
        { at: 4.6, x: 960, y: 600, z: 1.4, rot: 3 }, // reverse: your face at the window
      ]);
      if (cut < 2) {
        ST.setWindowPOV(ctx, t);
        CAST.you.draw(ctx, { x: 380, y: 1820, s: 1.7, t, yaw: 3, head: tt >= 3.2 && tt < 3.6 ? -2 : undefined, expr: 'shock', headDy: tt >= 3.2 && tt < 3.4 ? -16 : 0, sweat: true });
        return;
      }
      ST.setLM(ctx, t, { scroll: t * 40, k: 0.7, boulders: 30 });
      CAST.you.draw(ctx, { x: 1100, y: 1500, s: 1.3, t, yaw: -1, look: [-0.5, -0.2], sweat: true, expr: S(t, [[4.6, 'shock'], [5.1, 'scared']]), headDy: tt >= 4.6 && tt < 4.8 ? -14 : 0 });
    },
  });
})();

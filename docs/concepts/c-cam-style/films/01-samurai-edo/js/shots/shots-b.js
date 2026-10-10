/* Shots 4-5: the office (stamp, snore, stare at a sparrow) and the street (the scabbard bump). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, S = ST.step, CAST = ST.CAST;
  const tw = ST.twos;
  const FLOOR = 900;

  ST.defineShot('office', {
    title: 'The office', role: 'peace = paperwork', note: 'Pan along three low desks: the Elder stamps on a beat (vermilion seals pile up), the Clerk sleeps on his papers, you stare out of the window at a sparrow.',
    render(ctx, t) {
      const tt = tw(t);
      const E = CAST.elder, L = CAST.clerk, Y = CAST.you, s = 0.9;
      // the Elder: stamp up, slam, up again (period 0.5 s); each slam leaves a vermilion seal
      const ph = (tt % 0.5) / 0.5, lift = ph < 0.66 ? 1 : 0, slams = Math.floor(tt / 0.5) + (ph >= 0.66 ? 1 : 0);
      const stampPose = (k) => ST.pose('stand', E.D, null, { hR: ST.handAt(E.D, -1, -0.32, 0.6 - 0.5 * k, 0.62), kR: 'grip', poleR: [-1, 0.6, -0.2], hL: [E.D.sw * 0.5, -430, 0.55 * (E.D.l1a + E.D.l2a)], kL: 'flat', poleL: [1, 0.6, -0.3] });
      const pE = { x: 380, y: FLOOR + 250 * s, s, yaw: 1 }, hit = ST.palmWorld(E, pE, stampPose(0), 'R');
      ST.cutCam(ctx, t, [
        [0, 1.5, [hit[0] - 80, hit[1] - 190, 2.0], [hit[0] - 70, hit[1] - 180, 2.25]], // insert: the stamp, the seals
        [1.5, 3.4, [700, 560, 1.12], [1000, 560, 1.12]], // pan along the desks
        [3.4, 4.4, [1700, 420, 2.0], [1710, 415, 2.1]], // close: you left of frame, the sparrow right
        [4.4, 6, [1190, 520, 1.45, 2], [1185, 520, 1.55, 2]], // caught: you and the Clerk snap awake
      ]);
      ST.setOffice(ctx, t);
      ST.seated(ctx, E, { x: 380, s, t, yaw: 1, stamp: true, pose: stampPose(lift), expr: S(t, [[0, 'focused'], [4.2, 'rage']]), look: tt >= 4.2 ? [1, 0] : [0.2, 0.7], head: tt >= 4.2 ? 1 : undefined }, FLOOR, 250);
      ST.lowDesk(ctx, 380, FLOOR, 460, 136, 300);
      ST.papers(ctx, hit[0] + 10, 764, 170, 2, 301);
      for (let i = 0; i < Math.min(slams, 12); i++) ST.rect(ctx, hit[0] - 60 + (i % 4) * 34 + ST.rnd(-3, 3, 302, i), 744 + ST.rnd(-2, 2, 303, i), 24, 9, C.RED, { seed: 304 + i, lw: 2.5, amp: 0.5 });
      ST.papers(ctx, 250, 764, 140, 12, 312);
      // the Clerk, asleep on the job
      const PL = ST.pose('stand', L.D, null, ST.clerkDesk(L.D, -380, 0));
      const awake = tt >= 4.4 && tt < 5.4;
      ST.seated(ctx, L, { x: 930, s, t, yaw: 1, lean: awake ? 2 : 12, headDy: awake ? (tt < 4.6 ? -10 : 0) : 40, pose: PL, expr: S(t, [[0, 'asleep'], [4.4, 'shock'], [4.7, 'confused'], [5.0, 'exhausted'], [5.4, 'asleep']]), look: [0.8, 0] }, FLOOR, 240);
      ST.lowDesk(ctx, 930, FLOOR, 460, 136, 320);
      ST.papers(ctx, 1040, 764, 150, 7, 321);
      const zz = (tt * 1.5) % 1;
      if (!awake) ST.label(ctx, 'z', 1000 + zz * 40, 330 - zz * 80, { size: 40 + zz * 20, fill: '#b1a888', stroke: C.INK, lw: 6, font: `bold ${Math.round(40 + zz * 20)}px Georgia` });
      // you, at the desk nearest the window, looking anywhere but the papers
      const A = Y.D.l1a + Y.D.l2a;
      const PY = ST.pose('stand', Y.D, null, { hL: [Y.D.sw * 0.6, -396, 0.5 * A], hR: [-Y.D.sw * 0.3, -398, 0.52 * A], kL: 'flat', kR: 'grip', poleL: [1, 0.6, -0.3], poleR: [-1, 0.6, -0.3] });
      ST.seated(ctx, Y, { x: 1440, s, t, yaw: 1, head: 2, look: [1, -0.4], pose: PY, noSwords: true, expr: S(t, [[0, 'sad'], [4.4, 'shock'], [4.7, 'miserable']]), headDy: tt >= 4.4 && tt < 4.6 ? -12 : 0 }, FLOOR, 230);
      ST.lowDesk(ctx, 1440, FLOOR, 460, 144, 330);
      ST.papers(ctx, 1330, 756, 150, 11, 331);
      ST.papers(ctx, 1560, 756, 130, 6, 332);
    },
  });

  ST.defineShot('street', {
    title: 'Two swords', role: 'status for show', note: 'You strut down the street, chin up. You turn round to admire yourself - your scabbard end clacks into another samurai\'s. Both freeze. You bow, and bow, and bow.',
    render(ctx, t) {
      const tt = tw(t);
      const Y = CAST.you, R = CAST.rival, sY = 0.9, sR = 0.92;
      // the bump geometry: your scabbard end (facing left, after the turn) lands exactly on his
      const pR0 = { x: 1440, y: 1000, s: sR, yaw: 2 }, standR = ST.pose('stand', R.D), tipR = R.swordEnd(pR0, standR);
      const standY = ST.pose('stand', Y.D), tip0 = Y.swordEnd({ x: 0, y: 1040, s: sY, yaw: -2 }, standY);
      const yx = tipR[0] - tip0[0], yy = 1040 + tipR[1] - tip0[1], mid = (yx + pR0.x) / 2;
      ST.cutCam(ctx, t, [
        [0, 2.4, [yx - 552 + 300, 640, 1.35], [yx + 240, 640, 1.35]], // low, tracking the strut, room ahead of you
        [2.5, 2.9, [tipR[0], tipR[1] - 20, 3.2, -5], [tipR[0], tipR[1] - 20, 3.5, -5]], // extreme close-up: CLACK
        [2.9, 3.8, [mid, 410, 1.5, 4], [mid, 410, 1.6, 4]], // both heads turn: tilted
        [3.8, 6, [mid, 580, 1.2], [mid, 590, 1.04]], // pull back: the apology bows
      ]);
      ST.setStreet(ctx, t);
      ST.crowdFigure(ctx, { x: 1900, y: 880, s: 1.2, kind: 1, yaw: -1, mode: 'stand', col: '#5a4a52', colD: '#45383f', seed: 900 });
      ST.crowdFigure(ctx, { x: -60, y: 900, s: 1.25, kind: 2, yaw: 1, mode: 'stand', col: '#5a5040', colD: '#463e32', seed: 910 });
      const yawR = ST.turn(t, [[0, 2], [3.4, 4]]), yawY = ST.turn(t, [[0, 2], [2.4, 4], [3.8, 2]]), walking = tt < 2.4;
      const bump = tt >= 2.5 && tt < 2.9, sorry = tt >= 4.0 ? Math.floor(tt * 4) % 2 : 0;
      R.draw(ctx, {
        x: pR0.x, y: pR0.y, s: sR, t, yaw: yawR, head: tt >= 2.9 && tt < 3.4 ? -1 : undefined, look: tt >= 2.9 ? [-0.6, 0] : [0.4, -0.2],
        expr: S(t, [[0, 'deadpan'], [2.5, 'shock'], [2.9, 'rage'], [4.6, 'disgust']]), headDy: bump && tt < 2.7 ? -16 : 0,
        pose: tt >= 4.0 ? ST.pose('akimbo', R.D) : standR,
      });
      Y.draw(ctx, {
        x: walking ? yx - 230 * (2.4 - tt) : yx, y: yy, s: sY, t, yaw: yawY, head: tt >= 2.9 && tt < 3.8 ? 1 : undefined, bow: sorry * 32,
        expr: S(t, [[0, 'smug'], [2.5, 'shock'], [2.9, 'scared']]), headDy: bump && tt < 2.7 ? -18 : 0, look: tt < 2.4 ? [0.4, -0.5] : [0.5, 0],
        pose: walking ? ST.pose('walk', Y.D, (tt * 1.4) % 1, { hL: ST.handAt(Y.D, 1, -0.2, 0.62, 0.3), kL: 'grip', poleL: [1, 0.4, -0.5] }) : standY,
      });
      if (bump) {
        const n = Math.floor(tt * 12) % 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + n * 0.4, r = 30 + 26 * ST.hash(940, i, n);
          ST.stroke(ctx, [tipR[0] + Math.cos(a) * 14, tipR[1] + Math.sin(a) * 14, tipR[0] + Math.cos(a) * r, tipR[1] + Math.sin(a) * r], { w: 6, seed: 941 + i });
        }
        ST.label(ctx, 'CLACK', tipR[0], tipR[1] - 90, { size: 54, fill: '#cdbf94', stroke: C.INK, lw: 10, rot: -6 });
      }
    },
  });
})();

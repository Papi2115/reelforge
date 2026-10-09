/* Shots 10-12 (c-cam): the roof comes off (looking up at the Roofer in the gap, the wide reveal, the notebook roof in
   a tilted close-up, the Tired Cardinal waking wet), Gregory and the new rule (past the door jamb, close on "me?", low
   on the Mayor and the key, extreme close-up on the carved stone), the payoff (high wide vote, low close-up on the
   smug Mayor with the key). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST, tw = ST.twos;
  const ROOFLESS = { tally: 70, web: 1, candle: 0.3 };

  ST.defineShot('roof', {
    title: 'The roof comes off', role: 'last resort', note: 'Looking up from the table, tilted: the Roofer prising boards off against the sky; cut wide: rain pours on the conclave; close, tilted: the Stubborn Cardinal under his tiny notebook; close: the Tired one wakes up wet.',
    cuts: [[0, 'up'], [1.75, 'wide'], [3.25, 'hat'], [4.5, 'wake']],
    render(ctx, t) {
      const tt = tw(t), gap = Math.min(0.75, Math.floor(tt / 0.45 + 1) * 0.125), rain = tt >= 3.0, T = CAST.tired, B = CAST.stubborn, R = CAST.roofer, cut = ST.cut(t, this.cuts).name;
      if (cut === 'up') ST.camera(ctx, K(t, [[0, 1820], [1.75, 1760]]), 160, 1.5, -7);
      else if (cut === 'wide') ST.camera(ctx, 960, K(t, [[1.75, 330], [3.25, 350]]), K(t, [[1.75, 0.8], [3.25, 0.84]]));
      else if (cut === 'hat') ST.camera(ctx, 1250, 450, K(t, [[3.25, 2.2], [4.5, 2.35]]), 5);
      else ST.camera(ctx, 650, 450, K(t, [[4.5, 2.2], [6, 2.4]]), -4);
      const cut0 = ST.setHall(ctx, t, Object.assign({ gap, light: !rain }, ROOFLESS));
      ctx.save(); // the Roofer outside, seen through the gap: only what is above the roof line shows
      ctx.beginPath();
      ctx.rect(cut0, -400, 2600, 570 + 22);
      ctx.clip();
      ST.ladder(ctx, 2240, 420, 2140, -300, 800);
      const lifting = Math.floor(tt / 0.45) % 2 === 0 && tt < 3.0;
      R.draw(ctx, { x: 1990, y: 420, s: 0.86, t, yaw: -1, tile: true, expr: S(t, [[0, 'focused'], [3.0, 'smug']]), pose: Object.assign(ST.pose('stand', R.D), lifting ? R.lift : { hL: ST.handAt(R.D, 1, 0.3, -0.1, 0.5), hR: ST.handAt(R.D, -1, 0.3, -0.1, 0.5), poleL: [1, 0.3, -0.3], poleR: [-1, 0.3, -0.3] }) });
      ctx.restore();
      ST.conclave(ctx, t, {
        extras: (i) => (rain && i > 0 ? 'cover' : 'sit'),
        tired: { beard: 1, expr: S(t, [[0, 'asleep'], [4.75, 'shock'], [5.15, 'miserable']]), headDy: tt >= 4.75 && tt < 4.95 ? -22 : tt < 4.75 ? 14 : 0, head: tt >= 4.75 ? 2 : 1 },
        stubborn: {
          expr: S(t, [[0, 'smug'], [3.0, 'shock'], [3.4, 'smug']]), headDy: tt >= 3.0 && tt < 3.2 ? -20 : 0, book: tt >= 3.4 ? 'hat' : 'shut', look: rain ? [0, -0.8] : [0, 0],
          pose: ST.seat(B.D, { hL: ST.handAt(B.D, 1, -0.15, 0.48, 0.55), kL: 'grip' }),
        },
        items: ST.tableBallots(ctx, 10, 650, true),
        after: () => { if (rain) ST.rain(ctx, cut0, 2220, 170, 960, t, 810, 140); },
      });
      if (rain && tt >= 4.75) ST.marks(ctx, 700, 360, -1, 820);
    },
  });

  ST.defineShot('choice', {
    title: 'Gregory the Tenth', role: 'resolution + the new rule', note: 'Past the dark door jamb: Gregory wanders in and the whole table points; close: "me?"; low and tilted: the Mayor raises the key at the planked door; extreme close-up: CUM CLAVE carved in the stone, the gloss under it.',
    cuts: [[0, 'enter'], [0.9, 'me'], [1.75, 'door'], [3.4, 'stone']],
    render(ctx, t) {
      const tt = tw(t), cut = ST.cut(t, this.cuts).name;
      if (cut === 'enter' || cut === 'me') {
        if (cut === 'enter') ST.camera(ctx, 900, 480, K(t, [[0, 0.92], [0.9, 0.95]]));
        else ST.camera(ctx, 400, 560, K(t, [[0.9, 2.1], [1.75, 2.3]]));
        ST.setHall(ctx, t, Object.assign({ gap: 1, sky: ['#5f676a', '#77796e', '#8b8366'] }, ROOFLESS));
        const G = CAST.gregory, B = CAST.stubborn, T = CAST.tired, pointing = tt >= 0.5;
        ST.conclave(ctx, t, {
          extras: () => (pointing ? ['sitpoint', -1] : 'sit'),
          tired: { beard: 1, yaw: -1, expr: pointing ? 'shock' : 'exhausted', pose: ST.seat(T.D, pointing ? ST.pointAt(T.D, -1, 0.1) : {}) },
          stubborn: { yaw: -1, expr: pointing ? 'rage' : 'smug', book: 'shut', pose: ST.seat(B.D, Object.assign({ hL: ST.handAt(B.D, 1, -0.15, 0.48, 0.55), kL: 'grip' }, pointing ? ST.pointAt(B.D, -1, 0.15) : {})) },
          items: ST.tableBallots(ctx, 10, 650, true),
        });
        const walking = tt < 0.9;
        G.draw(ctx, { x: K(t, [[0, -60], [0.9, 260, 'out']]), y: 1060, s: 0.9, t, yaw: walking ? 2 : 1, stick: true, head: walking ? 2 : 0, headDy: tt >= 1.0 && tt < 1.2 ? -20 : 0, expr: S(t, [[0, 'deadpan'], [1.0, 'shock'], [1.4, 'confused']]), pose: walking ? ST.pose('walk', G.D, (tt * 1.6) % 1) : ST.pose('stand', G.D, null, { hL: ST.handAt(G.D, 1, -0.4, 0.3, 0.38), kL: 'point', poleL: [1, 0.5, -0.3] }) });
        if (tt >= 1.0) ST.label(ctx, '?', 330, 380, { size: 90, fill: '#e2d8b8', stroke: C.INK, lw: 10, rot: 8 });
        if (cut === 'enter') ST.fg(ctx, [-40, -40, 180, -40, 160, 300, 190, 1120, -40, 1120], 840); // the door jamb at the lens
      } else {
        if (cut === 'door') ST.camera(ctx, 960, K(t, [[1.75, 560], [3.4, 520]]), K(t, [[1.75, 0.82], [3.4, 0.88]]), -3);
        else ST.camera(ctx, 960, 0, K(t, [[3.4, 1.55], [5, 1.65]]));
        ST.setDoorClose(ctx, t, { planked: true });
        ST.carvedStone(ctx, 960, -60, Math.min(9, Math.floor(Math.max(0, tt - 2.0) / 0.1)), tt >= 3.6 ? '= "WITH A KEY"' : '');
        const M = CAST.mayor;
        M.draw(ctx, { x: 960, y: 1260, s: 1.05, t, yaw: 0, head: S(t, [[1.7, 0], [3.0, -1], [3.6, 0]]), expr: S(t, [[1.7, 'deadpan'], [2.4, 'smug']]), talk: [[3.6, 4.6]], key: -1.45, pose: ST.pose('stand', M.D, null, { hR: ST.handAt(M.D, -1, 0.35, -0.55, 0.2), poleR: [-1, 0.2, -0.3] }) });
      }
    },
  });

  ST.defineShot('payoff', {
    title: 'Survival tip', role: 'payoff', note: 'High wide under the open sky: every hand up at once, ballots flying into the chalice, Gregory in the tiara; cut low and tilted: the Mayor in close-up, smug, swinging the key.',
    cuts: [[0, 'vote'], [1.5, 'mayor']],
    render(ctx, t) {
      const tt = tw(t), voted = tt >= 0.3, T = CAST.tired, B = CAST.stubborn, G = CAST.gregory, M = CAST.mayor, cut = ST.cut(t, this.cuts).name;
      if (cut === 'vote') ST.camera(ctx, 940, K(t, [[0, 400], [1.5, 430]]), K(t, [[0, 0.86], [1.5, 0.9]]));
      else ST.camera(ctx, K(t, [[1.5, 470], [4, 440]]), 640, K(t, [[1.5, 1.8], [4, 2.0]]), -4);
      ST.setHall(ctx, t, Object.assign({ gap: 1, sky: ['#7d8a8e', '#9aa09a', '#b3a57c'] }, ROOFLESS));
      ST.pool(ctx, 1000, 600, 900, 420, '#d2a24e', 0.1);
      G.draw(ctx, { x: 900, y: ST.CONCLAVE.FEET, s: 0.9, t, yaw: 0, pope: true, expr: S(t, [[0, 'shock'], [1.4, 'confused']]), pose: ST.pose('clasp', G.D) });
      ST.conclave(ctx, t, {
        extras: (i) => (i === 1 ? 'none' : voted ? 'vote' : 'sit'),
        tired: { beard: 1, expr: voted ? 'grin' : 'exhausted', pose: ST.seat(T.D, voted ? ST.ballotUp(T.D, -1) : {}) },
        stubborn: { expr: voted ? 'disgust' : 'smug', pose: ST.seat(B.D, voted ? ST.ballotUp(B.D, -1) : {}) },
        items: ST.tableBallots(ctx, 14, 690, 1130),
        after: () => { // ballots in the air, arcing to the chalice
          for (let i = 0; i < 12; i++) {
            const k = ((tt - 0.3) * 0.9 + ST.hash(830, i)) % 1, x0 = [400, 700, 1300, 1600][i % 4], x1 = 1130;
            if (voted) ST.slip(ctx, ST.lerp(x0, x1, k), 560 - Math.sin(k * Math.PI) * (260 + 60 * ST.hash(831, i)) + k * 120, k * 6 + i, 840 + i, 0.9);
          }
        },
      });
      M.draw(ctx, { x: 300, y: 1180, s: 1.0, t, yaw: 1, head: S(t, [[0, 1], [1.5, 0]]), expr: 'smug', key: K(t, [[0, -0.9], [2, -0.6], [4, -0.9]]), pose: ST.pose('stand', M.D, null, { hR: ST.handAt(M.D, -1, 0.0, 0.1, 0.75), poleR: [-1, 0.4, -0.4] }) });
    },
  });
})();

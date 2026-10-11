/* Shots 5-9: the bus in August, the boss yells for an hour, the cash in the freezer, the oven mitts, the man across
   the street. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST;
  const tw = ST.twos;
  const at = (cuts) => cuts.map((c) => c.at);

  const BUS_CUTS = [
    { at: 0, x: 960, y: 520, z: [[0, 1.0], [1.6, 1.05]] }, // wide: squeezed between two retirees, him at the end
    { at: 1.6, x: [[1.6, 1050], [3.0, 1060]], y: 556, z: [[1.6, 2.9], [3.0, 3.1]] }, // extreme close-up: the sweat patch spreads
    { at: 3.0, x: 975, y: 470, z: [[3.0, 2.1], [4.6, 2.3]], rot: 3 }, // you, melting
  ];
  ST.defineShot('bus', {
    title: 'The bus', role: 'the heat', cuts: at(BUS_CUTS),
    note: 'Wide: you on the bus bench in the white linen suit, wedged between a retired lady fanning herself and a man in knee socks; at the far end, a tall man behind a newspaper. Extreme close-up: the sweat patch under your arm spreads. Tilted close-up: you melt, sunglasses sliding.',
    render(ctx, t) {
      const tt = tw(t), bump = (Math.floor(tt * 6) % 3 === 0 ? 1 : 0) * 5;
      const cut = ST.cutCam(ctx, t, BUS_CUTS.map((c) => Object.assign({}, c, { y: typeof c.y === 'number' ? c.y + bump : c.y })));
      ST.setBus(ctx, t, { scroll: t * 320 });
      const Y = CAST.you, G = CAST.agent;
      ST.crowdFigure(ctx, { x: 700, y: 842, s: 2.0, kind: 0, yaw: 0, mode: 'fan', col: '#9a7a86', colD: '#76586a', seed: 640, t });
      ST.crowdFigure(ctx, { x: 1240, y: 842, s: 2.0, kind: 1, yaw: -1, mode: 'stare', col: '#c2b896', colD: '#968c6c', seed: 657, t });
      G.draw(ctx, { x: 1760, y: 846, s: 0.72, t, yaw: 0, paper: 'holes', peek: 'left', paperDy: -150, pose: ST.agentPaper(G.D, -150, true) });
      ST.crowdFigure(ctx, { x: 180, y: 842, s: 1.9, kind: 2, yaw: 1, mode: 'sit', col: '#8a6a48', colD: '#5e4630', seed: 671, t });
      const grow = ST.seg(tt, 1.4, 3.0);
      Y.draw(ctx, {
        x: 975, y: 850, s: 0.92, t, yaw: 0, shades: 1, sweat: true, look: [cut === 2 ? -0.4 : 0.2, 0.1],
        expr: S(t, [[0, 'deadpan'], [1.6, 'miserable'], [3.0, 'exhausted']]), headDy: cut === 2 ? K(t, [[3.0, 0], [4.6, 10]]) : 0,
        pose: ST.sitPose(Y.D, { hL: ST.handAt(Y.D, 1, 0.35, -0.5 + (Math.floor(tt * 6) % 2) * 0.14, 0.3), kL: 'open', poleL: [1, 0.2, -0.3], hR: ST.handAt(Y.D, -1, -0.3, 0.55, 0.35), poleR: [-1, 0.2, -0.2] }),
        after: () => { ST.stain(ctx, 92, -330, 40 + 60 * grow, 50 + 80 * grow, 680, 'rgba(110,90,40,0.5)'); ST.stain(ctx, -60, -300, 24 + 40 * grow, 30 + 50 * grow, 681, 'rgba(110,90,40,0.4)'); },
      });
      ST.busSeat(ctx);
    },
  });

  // the boss behind his desk (drawn standing, the desk front hides the legs): x, y and the shared office pose
  const BP = { x: 910, y: 1000, s: 1.0, yaw: 0 };
  const BOSS_CUTS = [
    { at: 0, x: 980, y: [[0, 560], [1.4, 550]], z: [[0, 1.0], [1.4, 1.05]] }, // wide: the office
    { at: 1.4, x: 905, y: 520, z: [[1.4, 2.1], [2.8, 2.35]], rot: 4 }, // close-up: the Boss, yelling
    { at: 2.8, x: 230, y: 214, z: 3.2 }, // extreme close-up: the clock - an hour goes by
    { at: 3.8, x: 1418, y: 470, z: [[3.8, 2.0], [5, 2.1]], rot: -3 }, // you, an hour later
  ];
  ST.defineShot('boss', {
    title: 'The Boss', role: 'the humiliation', cuts: at(BOSS_CUTS),
    note: 'The back office: wood panelling, a mounted swordfish, blinds. The Boss yells across the desk, cigar in his fist; the Accountant by the freezer pretends to count. Tilted close-up: the yelling, spit flying. Extreme close-up: the clock spins an hour. You, after the hour: wrecked.',
    render(ctx, t) {
      ST.cutCam(ctx, t, BOSS_CUTS);
      const tt = tw(t);
      ST.setOffice(ctx, t, { minutes: K(t, [[0, 5], [2.9, 6], [3.7, 64, 'lin']]) });
      const B = CAST.boss, Y = CAST.you, A = CAST.accountant, pound = Math.floor(tt * 3) % 2;
      B.draw(ctx, Object.assign({}, BP, {
        t, expr: 'yelling', yelling: true, talk: [[0, 5]], cigar: 'hand', headDy: pound * -4, look: [0.5, 0],
        pose: ST.sitPose(B.D, { hR: ST.handAt(B.D, -1, 0.2, pound ? -0.1 : 0.15, 0.6), poleR: [-1, 0.3, -0.3], hL: ST.handAt(B.D, 1, -0.05, 0.45, 0.6), kL: 'flat' }),
      }));
      ST.deskFront(ctx, t);
      A.draw(ctx, { x: 520, y: 1000, s: 0.84, t, yaw: 1, calc: true, sweat: true, expr: 'scared', look: [0.6, 0], head: tt >= 2.0 ? 2 : 1, pose: ST.pose('stand', A.D, null, { hL: ST.handAt(A.D, 1, -0.1, 0.5, 0.55), poleL: [1, 0.5, -0.4] }) });
      const after = tt >= 3.8;
      Y.draw(ctx, {
        x: 1420, y: 1010, s: 0.92, t, yaw: -1, shades: 2, lean: after ? -6 : -2, sweat: after,
        expr: S(t, [[0, 'scared'], [3.8, 'exhausted']]), headDy: after ? 6 : 0,
        pose: ST.pose('clasp', Y.D),
      });
    },
  });

  // the long official form: a paper strip from the accountant's hands down to the floor
  function form(ctx, J, k) {
    const a = J.aL.h, b = J.aR.h, x = (a[0] + b[0]) / 2, y = Math.min(a[1], b[1]) + 20, len = 260 * k;
    ST.rough(ctx, [x - 70, y, x + 70, y, x + 74, y + len, x + 60, y + len + 30, x - 64, y + len + 24, x - 72, y + len], '#d2c9aa', {
      seed: 700, lw: 4, amp: 2, inner: (bb) => { ctx.fillStyle = 'rgba(60,54,40,0.5)'; for (let yy = bb.y0 + 18; yy < bb.y1 - 10; yy += 16) ctx.fillRect(bb.x0 + 14, yy, bb.w * (0.4 + 0.4 * ST.hash(701, yy | 0)), 4); ctx.fillStyle = 'rgba(30,26,20,0.75)'; ctx.fillRect(bb.x0 + 10, bb.y0 + 4, bb.w - 20, 8); },
    });
  }
  const FREEZER_CUTS = [
    { at: 0, x: [[0, 760], [2.4, 790]], y: 560, z: [[0, 1.35], [2.4, 1.45]] }, // the form, the Boss unimpressed
    { at: 2.4, x: 270, y: [[2.4, 660], [4.0, 640]], z: [[2.4, 2.3], [4.0, 2.55]] }, // the lid comes up: frosted cash
    { at: 4.0, x: 905, y: 530, z: [[4.0, 2.0], [5.2, 2.1]] }, // the Boss, satisfied
  ];
  ST.defineShot('freezer', {
    title: 'The freezer', role: 'the bad management', cuts: at(FREEZER_CUTS),
    note: 'The Accountant holds up a long official reporting form that unrolls to the floor; the Boss waves it away. You lift the freezer lid: cold mist, bricks of frosted cash. Close-up: the Boss, pleased with himself.',
    render(ctx, t) {
      ST.cutCam(ctx, t, FREEZER_CUTS);
      const tt = tw(t), lid = K(t, [[2.5, 0], [3.0, 0.62, 'out']]);
      ST.setOffice(ctx, t, { minutes: 64, lid });
      const B = CAST.boss, Y = CAST.you, A = CAST.accountant;
      B.draw(ctx, Object.assign({}, BP, {
        t, cigar: 'mouth', expr: S(t, [[0, 'disgust'], [1.4, 'rage'], [4.0, 'smug']]), talk: tt >= 1.4 && tt < 2.2 ? [[1.4, 2.2]] : undefined, look: [-0.6, 0],
        pose: ST.sitPose(B.D, tt >= 1.4 && tt < 2.4 ? { hR: ST.handAt(B.D, -1, 0.4, Math.floor(tt * 6) % 2 ? 0.0 : 0.2, 0.4), kR: 'open', poleR: [-1, 0.3, -0.3] } : { hL: ST.handAt(B.D, 1, -0.05, 0.45, 0.6), hR: ST.handAt(B.D, -1, -0.05, 0.45, 0.6), kL: 'flat', kR: 'flat' }),
      }));
      ST.deskFront(ctx, t);
      A.draw(ctx, {
        x: 700, y: 1010, s: 0.84, t, yaw: 1, sweat: true, expr: S(t, [[0, 'focused'], [1.4, 'scared']]), talk: [[0.2, 1.4]], look: [0.6, -0.2],
        pose: ST.pose('stand', A.D, null, { hL: ST.handAt(A.D, 1, -0.45, -0.05, 0.6), hR: ST.handAt(A.D, -1, -0.45, -0.05, 0.6), kL: 'grip', kR: 'grip', poleL: [1, 0.3, -0.3], poleR: [-1, 0.3, -0.3] }),
        layer: { L: 2, R: 2 }, after: (J) => form(ctx, J, K(t, [[0.2, 0.4], [1.0, 1.4, 'out']])),
      });
      const YP = { x: 410, y: 1030, s: 0.9, yaw: -1 }, handle = [262, 712 - 189 * lid];
      Y.draw(ctx, Object.assign({}, YP, {
        t, shades: 2, expr: S(t, [[0, 'deadpan'], [3.0, 'grin']]), look: [-0.3, 0.5],
        pose: ST.pose('stand', Y.D, null, tt >= 2.3 ? { hR: ST.reachTo(YP, handle[0], handle[1], -30), kR: 'grip', poleR: [-1, 0.4, -0.4] } : {}),
      }));
    },
  });

  const MITTS_CUTS = [
    { at: 0, x: 720, y: [[0, 640], [1.4, 630]], z: [[0, 2.9], [1.4, 3.1]] }, // extreme close-up: oven mitts, frozen bricks
    { at: 1.4, x: 700, y: 400, z: [[1.4, 2.3], [2.6, 2.45]], rot: -3 }, // the Accountant, glasses fogged
    { at: 2.6, x: [[2.6, 800], [3.8, 820]], y: 560, z: [[2.6, 1.3], [3.8, 1.36]] }, // a brick slips; the Boss drums the desk
  ];
  ST.defineShot('mitts', {
    title: 'Oven mitts', role: 'the gag', cuts: at(MITTS_CUTS),
    note: 'Extreme close-up: two oven mitts fumble frozen bricks of cash on the desk edge. Tilted close-up: the Accountant, glasses fogged white, shivering. Wider: a brick slips and thuds to the floor; the Boss drums his fingers; you hold the freezer lid.',
    render(ctx, t) {
      ST.cutCam(ctx, t, MITTS_CUTS);
      const tt = tw(t), shiver = (Math.floor(tt * 12) % 2) * 3;
      ST.setOffice(ctx, t, { minutes: 70, lid: 0.62 });
      const B = CAST.boss, Y = CAST.you, A = CAST.accountant;
      B.draw(ctx, Object.assign({}, BP, { t, cigar: 'mouth', expr: 'disgust', look: [-0.5, 0.3], pose: ST.sitPose(B.D, { hL: ST.handAt(B.D, 1, -0.05, 0.45 - (Math.floor(tt * 8) % 2) * 0.04, 0.6), hR: ST.handAt(B.D, -1, -0.05, 0.45, 0.6), kL: 'flat', kR: 'flat' }) }));
      const AP = { x: 700 + shiver, y: 930, s: 0.84, yaw: 0 }, slip = tt >= 2.9, fall = ST.seg(tt, 2.9, 3.3), counted = Math.floor(ST.seg(tt, 0.1, 1.4) * 4), flap = Math.floor(tt * 4) % 2;
      A.draw(ctx, Object.assign({}, AP, {
        t, mitts: true, fog: true, sweat: true, expr: S(t, [[0, 'focused'], [1.4, 'miserable'], [2.9, 'shock'], [3.3, 'scared']]), headDy: tt >= 2.9 && tt < 3.1 ? -12 : 0,
        pose: ST.pose('stand', A.D, null, { hL: ST.reachTo(AP, 770 + flap * 16, 666, 40), hR: ST.reachTo(AP, 640 - flap * 20, 666, 40), poleL: [1, 0.3, -0.3], poleR: [-1, 0.3, -0.3] }),
        layer: { L: 2, R: 2 }, after: () => { if (!slip) ST.cashBrick(ctx, 0, -340, 104 / 0.84, 26 / 0.84, 0.1, 730, true); },
      }));
      ST.deskFront(ctx, t);
      for (let i = 0; i < 4; i++) ST.cashBrick(ctx, 590 + i * 6, 690 - i * 22, 104, 26, ST.rnd(-0.1, 0.1, 710, i), 711 + i, true); // to count
      for (let i = 0; i < counted; i++) ST.cashBrick(ctx, 860 + i * 4, 690 - i * 22, 104, 26, 0.05, 720 + i, true); // counted
      if (slip) ST.cashBrick(ctx, 720 + fall * 30, 640 + fall * 330, 104, 26, fall * 2.2, 730, true);
      if (tt >= 3.3 && tt < 3.8) ST.soundWord(ctx, 'THUD', 860, 860, 54, -6);
      Y.draw(ctx, { x: 410, y: 1030, s: 0.9, t, yaw: -1, shades: 2, expr: 'deadpan', look: [0.6, 0], head: 0, pose: ST.pose('stand', Y.D, null, { hR: ST.reachTo({ x: 410, y: 1030, s: 0.9, yaw: -1 }, 262, 595, -30), kR: 'grip', poleR: [-1, 0.4, -0.4] }) });
    },
  });

  const WATCH_CUTS = [
    { at: 0, x: [[0, 1400], [1.6, 1390]], y: 480, z: [[0, 1.8], [1.6, 1.9]] }, // you peek through the blinds
    { at: 1.6, x: [[1.6, 960], [3.4, 920]], y: [[1.6, 600], [3.4, 640]], z: [[1.6, 1.0], [3.4, 1.12]] }, // through the gap: the sedan
    { at: 3.4, x: 1330, y: 470, z: [[3.4, 2.2], [4.8, 2.35]], rot: -4 }, // the slat snaps shut
  ];
  ST.defineShot('watch', {
    title: 'The task force', role: 'the paranoia', cuts: at(WATCH_CUTS),
    note: 'You lift one slat of the blinds with a finger. Through the gap, across the sunny street: a beige sedan, a tall man inside eating a sandwich - he looks up and waves. Tilted close-up: the slat snaps shut, you flatten against the wall.',
    render(ctx, t) {
      const tt = tw(t), cut = ST.cutCam(ctx, t, WATCH_CUTS), Y = CAST.you, G = CAST.agent;
      if (cut === 1) {
        const wave = tt >= 2.6;
        ST.setStreetPOV(ctx, t);
        G.draw(ctx, {
          x: 600, y: 1000, s: 0.74, t, yaw: 0, expr: S(t, [[0, 'deadpan'], [2.6, 'smug']]), look: [0.1, -0.4], sandwich: tt >= 2.2 ? 1 : 0, sandAng: -0.9,
          pose: ST.pose('stand', G.D, null, Object.assign({ hR: ST.handAt(G.D, -1, -0.1, 0.1, 0.5), poleR: [-1, 0.4, -0.4] }, wave ? { hL: ST.handAt(G.D, 1, 0.3, -0.55 + (Math.floor(tt * 6) % 2) * 0.12, 0.3), kL: 'open', poleL: [1, 0.2, -0.3] } : {})),
        });
        // the blinds at the lens: dark slats above and below the gap, your fingertips holding one down
        for (let y = -10; y < 1100; y += 64) if (y < 300 || y > 790) ST.fg(ctx, [-20, y, 1940, y + 6, 1940, y + 34, -20, y + 30], 740 + y, '#2a2119');
        ST.fg(ctx, [-20, 762, 700, 768, 940, 812, 1180, 768, 1940, 762, 1940, 800, 1180, 806, 940, 850, 700, 806, -20, 800], 739, '#3a2e22');
        return;
      }
      const shut = tt >= 3.4;
      ST.setOffice(ctx, t, { minutes: 72, lift: shut ? null : [1405, 120, 40] });
      const YP = { x: 1290, y: 1010, s: 0.92, yaw: shut ? -1 : 1 };
      Y.draw(ctx, Object.assign({}, YP, {
        t, shades: shut ? 1 : 2, sweat: shut, head: shut ? -1 : 2, look: shut ? [0.6, 0] : [0.4, 0], lean: shut ? -5 : 0,
        expr: S(t, [[0, 'focused'], [3.4, 'scared']]), headDy: tt >= 3.4 && tt < 3.6 ? -14 : 0,
        pose: shut ? ST.pose('stand', Y.D, null, { hL: ST.handAt(Y.D, 1, 0.3, 0.6, -0.3), hR: ST.handAt(Y.D, -1, 0.3, 0.6, -0.3), kL: 'flat', kR: 'flat' }) : ST.pose('stand', Y.D, null, { hL: ST.reachTo(YP, 1405, 480, 40), kL: 'point', poleL: [1, 0.2, -0.5] }),
      }));
    },
  });
  // flat dark shape in screen space (the blinds at the lens, fingertips)
  ST.fg = (ctx, pts, seed, col) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const keep = ST.LW;
    ST.LW = 1;
    ST.blob(ctx, pts, col || '#16110d', { seed, lw: 0 });
    ST.LW = keep;
    ctx.restore();
  };
})();

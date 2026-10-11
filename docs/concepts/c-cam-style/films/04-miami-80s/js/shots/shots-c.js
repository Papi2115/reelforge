/* Shots 10-13: the wire, the speedboat runs dry, the courtroom under fluorescent tubes, the cell (the payoff). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST, MI = ST.MIAMI;
  const tw = ST.twos;
  const at = (cuts) => cuts.map((c) => c.at);

  // where the Accountant's wire sits (three-quarter view, facing left) for a figure placed at p: the taped lump
  const wireWorld = (p) => ST.toWorld(p, [31, -460]);
  const YP0 = { x: 690, y: 1060, s: 0.92, yaw: 1 }, AP = { x: 920, y: 1066, s: 0.86, yaw: -1 };
  const WIRE_CUTS = [
    { at: 0, x: [[0, 900], [2.0, 920]], y: 560, z: [[0, 1.0], [2.0, 1.06]] }, // wide: the dock, everyone squints
    { at: 2.0, x: 810, y: 600, z: [[2.0, 1.6], [3.2, 1.7]] }, // the goodbye: he opens his arms, your pat
    { at: 3.2, x: 900, y: 690, z: [[3.2, 3.0], [4.2, 3.2]], rot: 5 }, // extreme close-up: your hand finds the wire
    { at: 4.2, x: 800, y: 470, z: [[4.2, 1.9], [5.4, 2.0]], rot: -3 }, // two faces
  ];
  ST.defineShot('wire', {
    title: 'The wire', role: 'the betrayal', cuts: at(WIRE_CUTS),
    note: 'The marina at sundown: you and the Accountant squint at each other; then both squint at the pelican, who squints back. He opens his arms for a goodbye; you pat his chest - extreme close-up: tape and a cable under the shirt. Two faces: yours drops, his tries a grin, sweating.',
    render(ctx, t) {
      const tt = tw(t), cut = ST.cutCam(ctx, t, WIRE_CUTS);
      ST.setMarina(ctx, t);
      ST.speedboat(ctx, 1760, 950, 1.5, 480, { t, bob: true });
      ST.dock(ctx);
      const Y = CAST.you, A = CAST.accountant, bye = tt >= 2.0, pat = tt >= 2.6 && tt < 4.4, w = wireWorld(AP), recoil = tt >= 4.4;
      const pel = !bye && tt >= 1.1;
      A.draw(ctx, Object.assign({}, AP, {
        t, wire: true, sweat: tt >= 3.2, expr: bye ? S(t, [[2.0, 'sad'], [4.2, 'grin']]) : 'focused', look: pel ? [0.5, -0.8] : [-0.6, 0],
        head: pel ? 1 : undefined, headDy: tt >= 4.2 && tt < 4.4 ? -8 : 0,
        pose: bye && !recoil ? ST.pose('stand', A.D, null, { hL: ST.handAt(A.D, 1, 0.5, -0.4, 0.2), hR: ST.handAt(A.D, -1, 0.5, -0.4, 0.2), kL: 'open', kR: 'open', poleL: [1, 0.2, -0.3], poleR: [-1, 0.2, -0.3] }) : ST.pose('stand', A.D, null, { hL: ST.handAt(A.D, 1, -0.05, 0.5, 0.5) }),
      }));
      const YP = Object.assign({}, YP0, { x: recoil ? 650 : bye ? 720 : YP0.x });
      Y.draw(ctx, Object.assign({}, YP, {
        t, shades: 2, lean: recoil ? -8 : bye ? 5 : 0, expr: bye ? S(t, [[2.0, 'sad'], [3.6, 'confused'], [4.2, 'shock']]) : 'focused', headDy: tt >= 4.2 && tt < 4.4 ? -14 : 0,
        look: pel ? [0.6, -0.8] : [0.6, 0], head: pel ? 2 : undefined,
        pose: pat ? ST.pose('stand', Y.D, null, { hR: ST.reachTo(YP, w[0] + 26, w[1] + 52 + (tt < 3.2 ? (Math.floor(tt * 6) % 2) * 10 : 0), -60), kR: tt >= 3.4 ? 'open' : 'flat', poleR: [-1, 0.4, -0.4] }) : ST.pose('stand', Y.D),
      }));
      if (cut === 2 && tt >= 3.6) ST.soundWord(ctx, '?', w[0] + 60, w[1] - 60, 60, 8);
    },
  });

  // the speedboat's fuel gauge, close: needle from F to E (k 1 -> 0), a red E
  ST.fuelGauge = (ctx, x, y, r, k, seed) => {
    ST.rect(ctx, x - r * 2.6, y - r * 1.6, r * 5.2, r * 3.0, MI.WHITE, { seed, lw: 7, amp: 3, shade: [MI.WHITE_D, 0, 30], mottle: ['rgba(90,80,60,0.25)', 5, 60] });
    ST.blob(ctx, ST.ellipseRing(x, y, r, r, 18), '#2a2826', { lw: 8, seed: seed + 1 });
    ST.blob(ctx, ST.ellipseRing(x, y, r * 0.86, r * 0.86, 18), '#c9bf9c', { lw: 4, seed: seed + 2 });
    for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.15 + 0.7 * (i / 8)); ST.stroke(ctx, [x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78], { w: 5, seed: seed + 3 + i, taper: false }); }
    ST.blob(ctx, [x + Math.cos(Math.PI * 1.15) * r * 0.8, y + Math.sin(Math.PI * 1.15) * r * 0.8, x + Math.cos(Math.PI * 1.27) * r * 0.8, y + Math.sin(Math.PI * 1.27) * r * 0.8, x + Math.cos(Math.PI * 1.27) * r * 0.6, y + Math.sin(Math.PI * 1.27) * r * 0.6, x + Math.cos(Math.PI * 1.15) * r * 0.6, y + Math.sin(Math.PI * 1.15) * r * 0.6], C.RED, { lw: 3, seed: seed + 15 });
    ST.label(ctx, 'E', x + Math.cos(Math.PI * 1.15) * r * 0.45, y + Math.sin(Math.PI * 1.15) * r * 0.45, { size: r * 0.28, fill: C.RED_D, font: `bold ${Math.round(r * 0.28)}px 'Arial Black', Arial, sans-serif` });
    ST.label(ctx, 'F', x + Math.cos(Math.PI * 1.85) * r * 0.45, y + Math.sin(Math.PI * 1.85) * r * 0.45, { size: r * 0.28, fill: C.INK, font: `bold ${Math.round(r * 0.28)}px 'Arial Black', Arial, sans-serif` });
    const a = Math.PI * (1.15 + 0.7 * k);
    ST.stroke(ctx, [x, y, x + Math.cos(a) * r * 0.74, y + Math.sin(a) * r * 0.74], { w: 9, color: C.RED_D, seed: seed + 16, taper: false });
    ST.blob(ctx, ST.ellipseRing(x, y, r * 0.1, r * 0.1, 8), C.INK, { lw: 0, seed: seed + 17 });
  };
  const BOAT_CUTS = [
    { at: 0, x: [[0, 1300], [2.4, 1760]], y: 600, z: 1.0 }, // the getaway: pan with the boat
    { at: 2.4, x: 960, y: 560, z: [[2.4, 1.0], [3.4, 1.08]], rot: 4 }, // extreme close-up: the fuel needle
    { at: 3.4, x: [[3.4, 900], [5.4, 860]], y: 620, z: [[3.4, 1.05], [5.4, 1.15]] }, // dead in the water; the rowboat
  ];
  ST.defineShot('boat', {
    title: 'The getaway', role: 'the escape', cuts: at(BOAT_CUTS),
    note: 'You gun the borrowed speedboat away from the dock, spray flying, the Accountant waving limply. Tilted close: the fuel needle sinks into the red E. Wide on open water: the boat dead and bobbing, you with your hands up; a rowboat drifts in - the tall man at the oars, eating a sandwich.',
    render(ctx, t) {
      const tt = tw(t), cut = ST.cutCam(ctx, t, BOAT_CUTS), Y = CAST.you, G = CAST.agent;
      if (cut === 1) {
        ST.rect(ctx, -400, -300, 2800, 1700, '#8f8a78', { seed: 750, lw: 0, mottle: ['rgba(40,36,24,0.25)', 8, 100] });
        ST.fuelGauge(ctx, 960, 600, 300, K(t, [[2.4, 0.22], [3.2, 0.0, 'out']]) + ST.rnd(-0.02, 0.02, 751, Math.floor(tt * 12)), 752);
        if (tt >= 2.9) ST.soundWord(ctx, 'PUT... PUT...', 1460, 260, 64, -6);
        return;
      }
      if (cut === 0) {
        ST.setMarina(ctx, t);
        const go = ST.seg(tt, 0.5, 2.4), bx = 1760 + 900 * ST.ease.inOut(go) * go;
        ST.speedboat(ctx, bx, 950, 1.5, 480, {
          t, bob: true, spray: go > 0.05 ? 1 : 0, lift: go > 0.05 ? 0.04 : 0,
          inside: (bob) => Y.draw(ctx, { x: bx - 120, y: 860 + bob, s: 0.82, t, yaw: 1, shades: 1, lean: go > 0.05 ? -8 : 0, expr: S(t, [[0, 'focused'], [0.6, 'grin']]), pose: ST.pose('stand', Y.D, null, { hR: ST.handAt(Y.D, -1, -0.1, 0.35, 0.7), hL: ST.handAt(Y.D, 1, -0.1, 0.4, 0.7) }) }),
        });
        ST.dock(ctx);
        CAST.accountant.draw(ctx, { x: 820, y: 1066, s: 0.86, t, yaw: 1, wire: true, sweat: true, expr: 'sad', look: [0.6, 0], pose: ST.pose('stand', CAST.accountant.D, null, { hR: ST.handAt(CAST.accountant.D, -1, 0.2, -0.45 + (Math.floor(tt * 4) % 2) * 0.1, 0.3), kR: 'open', poleR: [-1, 0.2, -0.3] }) });
        return;
      }
      ST.setSea(ctx, t);
      const rx = K(t, [[3.4, -260], [5.4, 520, 'out']]);
      ST.rowboat(ctx, rx, 980, 1.1, 760, t, (bob) => G.draw(ctx, { x: rx - 20, y: 960 + bob, s: 0.62, t, yaw: 1, expr: 'deadpan', look: [0.7, 0], sandwich: 1, sandAng: -0.5, pose: ST.sitPose(G.D, { hL: ST.handAt(G.D, 1, -0.1, 0.4, 0.7) }) }));
      ST.speedboat(ctx, 1300, 920, 1.5, 480, {
        t, bob: true,
        inside: (bob) => Y.draw(ctx, { x: 1220, y: 830 + bob, s: 0.82, t, yaw: -1, shades: 1, sweat: true, expr: S(t, [[3.4, 'exhausted'], [4.2, 'miserable']]), look: [-0.6, 0], pose: tt >= 4.2 ? ST.pose('armsUp', Y.D) : ST.pose('slump', Y.D) }),
      });
    },
  });

  const COURT_CUTS = [
    { at: 0, x: 960, y: [[0, 540], [1.6, 530]], z: [[0, 1.0], [1.6, 1.04]] }, // wide: the courtroom
    { at: 1.6, x: 960, y: 10, z: [[1.6, 3.0], [2.6, 3.15]] }, // extreme close-up: a tube flickers
    { at: 2.6, x: 340, y: 520, z: 2.0, rot: -3 }, // the Accountant on the stand points
    { at: 3.6, x: [[3.6, 1490], [5, 1480]], y: 600, z: [[3.6, 1.9], [5, 2.05]] }, // you, sunburnt, peeling
  ];
  ST.defineShot('court', {
    title: 'Court', role: 'the end', cuts: at(COURT_CUTS),
    note: 'A beige courtroom under buzzing fluorescent tubes: the judge, the bailiff, the Accountant on the stand, you at the defence table in the stained white suit; the tall man by the wall with a sandwich. Extreme close-up: a tube flickers. The Accountant points at you, wire showing. You: sunburnt, peeling.',
    render(ctx, t) {
      const tt = tw(t), cut = ST.cutCam(ctx, t, COURT_CUTS), flick = Math.floor(tt * 8) % 3 === 0;
      ST.setCourt(ctx, t, { tubeOff: flick ? 1 : -1 });
      ST.crowdFigure(ctx, { x: 960, y: 640, s: 1.6, kind: 3, yaw: 0, mode: 'sit', col: '#24201e', colD: '#141210', seed: 800, t });
      ST.judgeBench(ctx);
      ST.crowdFigure(ctx, { x: 600, y: 900, s: 1.7, kind: 4, yaw: 1, mode: 'stand', col: '#a08a5e', colD: '#76643e', seed: 817, t });
      const A = CAST.accountant, Y = CAST.you, G = CAST.agent, point = tt >= 2.6;
      A.draw(ctx, { x: 320, y: 980, s: 0.86, t, yaw: 1, wire: true, sweat: true, expr: S(t, [[0, 'scared'], [2.6, 'focused']]), look: [0.7, 0], pose: point ? ST.pose('point', A.D, -1) : ST.pose('clasp', A.D) });
      ST.witnessBox(ctx);
      G.draw(ctx, { x: 1860, y: 1000, s: 0.86, t, yaw: -1, expr: 'deadpan', look: [-0.6, 0], sandwich: tt >= 1.0 ? 1 : 0, pose: ST.pose('stand', G.D, null, { hR: ST.handAt(G.D, -1, -0.1, 0.0, 0.45), poleR: [-1, 0.4, -0.4] }) });
      const YP = { x: 1480, y: 1062, s: 0.95, yaw: -1 };
      Y.draw(ctx, Object.assign({}, YP, {
        t, stained: true, peel: true, sweat: true, shades: 2, expr: S(t, [[0, 'deadpan'], [2.8, 'shock'], [3.6, 'miserable']]), headDy: tt >= 2.8 && tt < 3.0 ? -12 : 0, look: [-0.7, 0],
        pose: ST.sitPose(Y.D, { hL: ST.reachTo(YP, 1400, 790, 40), hR: ST.reachTo(YP, 1560, 792, -40), kL: 'flat', kR: 'flat' }),
      }));
      ST.defenceTable(ctx);
      if (cut === 1 && flick) ST.soundWord(ctx, 'bzzt', 1120, 80, 40, 6);
    },
  });

  const PAY_CUTS = [
    { at: 0, x: 950, y: [[0, 470], [2.2, 460]], z: [[0, 2.0], [2.2, 2.1]] }, // close-up through the bars
    { at: 2.2, x: [[2.2, 860], [3.6, 960]], y: [[2.2, 500], [3.6, 560]], z: [[2.2, 1.6], [3.6, 1.05]] }, // pull back: your cellmate
    { at: 3.6, x: 950, y: [[3.6, 480], [4.8, 470]], z: [[3.6, 1.7], [4.8, 2.0]] }, // push in: the last look
  ];
  ST.defineShot('payoff', {
    title: 'Survival tip', role: 'the payoff', cuts: at(PAY_CUTS),
    note: 'Close-up through cell bars: you, peeling, put your sunglasses on - indoors, in jail. Pull back: your cellmate on the bunk is the Boss, glaring, with his unlit cigar; Push in on your face.',
    render(ctx, t) {
      const tt = tw(t), cut = ST.cutCam(ctx, t, PAY_CUTS);
      ST.setCell(ctx, t);
      const B = CAST.boss, Y = CAST.you;
      B.draw(ctx, { x: 1480, y: 900, s: 0.92, t, yaw: -1, cigar: 'mouth', tint: false, expr: S(t, [[0, 'rage'], [3.0, 'disgust']]), look: [-0.7, 0], pose: ST.sitPose(B.D, { hL: ST.handAt(B.D, 1, -0.1, 0.6, 0.4), hR: ST.handAt(B.D, -1, -0.1, 0.6, 0.4) }) });
      const shadesOn = tt >= 1.2;
      Y.draw(ctx, {
        x: 950, y: 1010, s: 0.95, t, yaw: 0, stained: true, peel: true, shades: shadesOn ? 1 : 2, head: cut === 1 && tt < 3.2 ? 1 : 0,
        expr: S(t, [[0, 'miserable'], [1.2, 'deadpan'], [4.2, 'smug']]), headDy: tt >= 1.2 && tt < 1.4 ? 6 : 0,
        pose: ST.pose('stand', Y.D, null, tt >= 0.8 && tt < 1.3 ? { hR: ST.handAt(Y.D, -1, 0.2, -0.3, 0.45), poleR: [-1, 0.3, -0.3] } : {}),
      });
      ST.cellBars(ctx, -155, -300, 2400, 1400, 820, 170);
    },
  });
})();

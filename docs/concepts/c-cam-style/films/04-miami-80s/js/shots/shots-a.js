/* Shots 1-4: the poster, the TV myth vs your room, the hotel porch of retirees, the car that will not start.
   render(ctx, t) paints the whole frame for shot time t. Acting is on twos: poses come from ST.twos(t), expressions
   snap, turns walk the ring. Every shot lists its in-shot cut times in `cuts` (for tools/proof.mjs cuts). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST, MI = ST.MIAMI;
  const tw = ST.twos;
  const at = (cuts) => cuts.map((c) => c.at);

  // heavy poster lettering: bone fill, rust extrusion, fat ink outline; letters thud in one by one on twos from t0
  // (a t0 below zero = already standing: the first frame is the poster)
  ST.posterWord = (ctx, word, x, y, size, t, t0, rotBase) => {
    ctx.save();
    ctx.font = `${size}px Impact, 'Arial Black', sans-serif`;
    const widths = [...word].map((ch) => ctx.measureText(ch).width * 0.97), total = widths.reduce((a, b) => a + b, 0);
    let cx = x - total / 2;
    [...word].forEach((ch, i) => {
      const on = tw(t) >= t0 + i * 0.04, lx = cx + widths[i] / 2, rot = rotBase + ST.rnd(-4, 4, 77, i), dy = ST.rnd(-8, 8, 78, i);
      cx += widths[i];
      if (!on) return;
      const drop = tw(t) < t0 + i * 0.04 + 0.09 ? -18 : 0;
      ctx.save();
      ctx.translate(lx, y + dy + drop);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const ex = size * 0.07;
      ctx.lineWidth = size * 0.1;
      ctx.strokeStyle = C.INK;
      ctx.strokeText(ch, ex * 0.7, ex);
      ctx.fillStyle = '#5c2616';
      for (let d = ex; d > 0; d -= 2) ctx.fillText(ch, d * 0.7, d);
      ctx.strokeText(ch, 0, 0);
      ctx.fillStyle = '#cdbf94';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  };
  // a sound word on a slant, ink outline
  ST.soundWord = (ctx, word, x, y, size, rot, col) => ST.label(ctx, word, x, y, { size, fill: col || '#cdbf94', stroke: C.INK, lw: size * 0.18, rot });
  // seated: hips dropped, knees forward (people on a bed, a bench, a bus seat, behind a table)
  ST.sitPose = (D, over) => Object.assign({ hL: ST.handAt(D, 1, -0.1, 0.62, 0.42), hR: ST.handAt(D, -1, -0.1, 0.62, 0.42), fL: ST.footAt(D, 1, 0.08, 0, 0.42), fR: ST.footAt(D, -1, 0.08, 0, 0.4), bob: 0.38, poleL: [1, 0.4, -0.5], poleR: [-1, 0.4, -0.5] }, over || {});
  // the agent hiding behind his newspaper, seated or standing
  ST.agentPaper = (D, dy, sit) => Object.assign({ hL: [118, D.sy + 92 + dy, 150], hR: [-118, D.sy + 92 + dy, 150], kL: 'grip', kR: 'grip', poleL: [1, 0.6, -0.4], poleR: [-1, 0.6, -0.4] }, sit ? { fL: ST.footAt(D, 1, 0.06, 0, 0.42), fR: ST.footAt(D, -1, 0.06, 0, 0.4), bob: 0.4 } : { fL: ST.footAt(D, 1, 0.04, 0, 0.04), fR: ST.footAt(D, -1, 0.04, 0, -0.03) });

  const TITLE_CUTS = [{ at: 0, x: 960, y: [[0, 540], [4, 530]], z: [[0, 1.0], [4, 1.05]] }];
  ST.defineShot('title', {
    title: 'Title', role: 'poster', cuts: at(TITLE_CUTS),
    note: 'The poster: the hotel strip in neon at night, the three of them posing in front of the borrowed car - the Boss, you in the oversized suit and shades, the sweating Accountant - and on the pavement, a tall man behind a newspaper with two eye holes.',
    render(ctx, t) {
      ST.cutCam(ctx, t, TITLE_CUTS);
      ST.setStrip(ctx, t);
      const B = CAST.boss, Y = CAST.you, A = CAST.accountant, G = CAST.agent, tt = tw(t);
      G.draw(ctx, { x: 200, y: 960, s: 0.72, t, yaw: 0, paper: 'holes', peek: 'right', paperDy: -208, pose: ST.agentPaper(G.D, -208, false) });
      ST.sportsCar(ctx, 1660, 1030, 1.9, 60, { t, rust: true });
      B.draw(ctx, { x: 560, y: 1030, s: 0.9, t, yaw: 1, cigar: 'mouth', expr: 'disgust', pose: ST.pose('akimbo', B.D), look: [0.5, 0] });
      A.draw(ctx, { x: 1330, y: 1040, s: 0.86, t, yaw: -1, calc: true, sweat: true, expr: S(t, [[0, 'scared'], [2.6, 'confused']]), look: [-0.6, 0], pose: ST.pose('stand', A.D, null, { hL: ST.handAt(A.D, 1, -0.05, 0.5, 0.5), poleL: [1, 0.5, -0.4] }) });
      const strut = Math.floor(tt * 3) % 2;
      Y.draw(ctx, { x: 940, y: 1050, s: 1.0, t, yaw: 0, shades: 1, expr: 'smug', lean: -3, headDy: strut * -3, pose: ST.pose('akimbo', Y.D, null, { hR: ST.handAt(Y.D, -1, 0.15, 0.55, 0.3), kR: 'open' }) });
      ST.posterWord(ctx, 'WOULD YOU SURVIVE AS A', 960, 84, 90, t, -5, -2);
      ST.posterWord(ctx, 'MIAMI GANGSTER IN THE 80s?', 960, 196, 124, t, -5, 1);
      ST.rough(ctx, [700, 286, 1220, 278, 1228, 338, 694, 346], C.INK, { seed: 79, lw: 6, lineColor: MI.NEON_P });
      ST.label(ctx, 'A DAY IN THE LIFE', 962, 312, { size: 40, fill: '#e2a0b4', rot: -1 });
    },
  });

  const TV_CUTS = [
    { at: 0, x: [[0, 410], [1.6, 412]], y: 552, z: [[0, 3.4], [1.6, 3.7]] }, // the myth on the screen
    { at: 1.6, x: [[1.6, 980], [3.6, 940]], y: 560, z: [[1.6, 1.0], [3.6, 1.06]] }, // pull back: your room, you copying it
    { at: 3.6, x: 1150, y: [[3.6, 470], [5, 480]], z: [[3.6, 2.1], [5, 2.25]], rot: -3 }, // the popsicle drips
  ];
  ST.defineShot('tv', {
    title: 'On TV', role: 'the myth', cuts: at(TV_CUTS),
    note: 'Extreme close-up of the TV: pastel sunset, a hero on a speedboat pointing at the horizon. Pull back: your room - leaking ceiling, cockroach, pizza box - and you on the bed in a vest and boxers, shades on, copying the pose with a popsicle. Close-up: it drips on your vest.',
    render(ctx, t) {
      ST.cutCam(ctx, t, TV_CUTS);
      ST.setRoom(ctx, t);
      const Y = CAST.you, tt = tw(t), drip = ST.seg(tt, 3.8, 4.4);
      const point = ST.handAt(Y.D, -1, -0.12, -0.42 + (Math.floor(tt * 2) % 2) * 0.03, 0.72);
      Y.draw(ctx, {
        x: 1180, y: 990, s: 0.95, t, yaw: -1, outfit: 'under', shades: 1, look: [-0.4, -0.2],
        expr: S(t, [[0, 'smug'], [4.2, 'miserable']]), headDy: tt >= 4.2 && tt < 4.4 ? 8 : 0, head: tt >= 4.2 ? -1 : undefined,
        pose: ST.sitPose(Y.D, Object.assign({ kL: 'flat' }, tt < 4.2 ? { hR: point, poleR: [-1, 0.2, -0.3] } : { hR: ST.handAt(Y.D, -1, 0.0, 0.3, 0.5) })),
        hold: { side: 'R', kind: 'grip', fn: (c, g) => ST.popsicle(c, g[0], g[1] + 4, 0, 112, drip) },
        after: () => { if (tt >= 4.0) ST.stain(ctx, 10, -330, 50 * drip + 10, 40 * drip + 8, 113, 'rgba(150,70,90,0.6)'); }, // the drip lands on the vest
      });
    },
  });

  const HOTEL_CUTS = [
    { at: 0, x: [[0, 960], [2.6, 960]], y: [[0, 520], [2.6, 560]], z: [[0, 1.0], [2.6, 1.08]] }, // wide: you come out
    { at: 2.6, x: [[2.6, 1640], [4.0, 1380]], y: 590, z: 1.9 }, // pan along the porch: retirees, and him
    { at: 4.0, x: 960, y: 520, z: [[4.0, 2.2], [5, 2.3]] }, // you nod, awkward
  ];
  const RETIREES = [[120, 0, 'knit', 1, '#9a7a86', '#76586a'], [330, 1, 'stare', 1, '#c2b896', '#968c6c'], [560, 5, 'fan', 1, '#6a8a88', '#4a6866'], [1500, 0, 'stare', -1, '#8a9a7a', '#68785a']];
  ST.porchPeople = (ctx, t, lookX) => {
    RETIREES.forEach(([x, kind, mode, yaw, col, colD], i) => ST.crowdFigure(ctx, { x, y: 772, s: 1.55, kind, yaw: lookX === undefined ? yaw : lookX > x ? 1 : -1, mode, col, colD, seed: 600 + i * 17, t }));
  };
  ST.defineShot('hotel', {
    title: 'Real life', role: 'setting', cuts: at(HOTEL_CUTS),
    note: 'Day. The same hotel, faded and peeling. You strut out of the door and down the steps in the white suit; the porch of retirees in lawn chairs turns to stare. Pan along them: curlers, knitting, a fan - and a tall man with a newspaper with two eye holes. You nod at them, awkward.',
    render(ctx, t) {
      ST.cutCam(ctx, t, HOTEL_CUTS);
      ST.setPorch(ctx, t);
      const Y = CAST.you, G = CAST.agent, tt = tw(t), walk = ST.seg(tt, 0.3, 2.2);
      const yy = K(t, [[0.3, 790], [2.2, 960, 'lin']]), ys = K(t, [[0.3, 0.8], [2.2, 0.92, 'lin']]);
      ST.porchPeople(ctx, t, tt > 0.6 ? 960 : undefined);
      G.draw(ctx, { x: 1290, y: 770, s: 0.66, t, yaw: 0, paper: 'holes', peek: tt > 3.4 ? 'left' : 'right', paperDy: -150, pose: ST.agentPaper(G.D, -150, true) });
      ST.porchFront(ctx);
      Y.draw(ctx, {
        x: 960, y: yy, s: ys, t, yaw: 0, shades: tt >= 1.0 ? 1 : 2, expr: S(t, [[0, 'smug'], [2.6, 'deadpan'], [4.0, 'confused']]),
        head: tt >= 2.6 && tt < 3.3 ? -1 : tt >= 3.3 && tt < 4.0 ? 1 : undefined, headDy: tt >= 4.2 && Math.floor(tt * 6) % 2 ? 8 : 0,
        pose: walk < 1 && tt >= 0.3 ? ST.pose('walk', Y.D, (tt * 1.6) % 1) : ST.pose('stand', Y.D, null, tt >= 4.0 ? { hR: ST.handAt(Y.D, -1, 0.3, 0.1, 0.4), kR: 'open', poleR: [-1, 0.3, -0.3] } : {}),
      });
    },
  });

  const CAR_CUTS = [
    { at: 0, x: [[0, 960], [1.8, 975]], y: 760, z: [[0, 1.75], [1.8, 1.85]] }, // you in the car, the key
    { at: 1.8, x: 1700, y: 860, z: [[1.8, 2.6], [2.9, 2.75]], rot: 4 }, // the pop-up light: half way, droops
    { at: 2.9, x: [[2.9, 1000], [4.2, 1020]], y: 640, z: [[2.9, 1.05], [4.2, 1.1]] }, // wide: smoke, the porch watching
  ];
  ST.defineShot('car', {
    title: 'The car', role: 'the gag', cuts: at(CAR_CUTS),
    note: 'At the kerb in the borrowed white sports car: you turn the key - CLICK. Extreme close-up: one pop-up headlight rises halfway and droops. Wide: smoke from the bonnet, your forehead on the wheel, the porch watching; the newspaper lowers an inch.',
    render(ctx, t) {
      ST.cutCam(ctx, t, CAR_CUTS);
      ST.setPorch(ctx, t);
      const Y = CAST.you, G = CAST.agent, tt = tw(t), smoke = ST.seg(tt, 2.4, 3.4), slump = tt >= 3.2;
      ST.porchPeople(ctx, t, 1100);
      G.draw(ctx, { x: 1290, y: 770, s: 0.66, t, yaw: 0, paper: 'holes', peek: 'left', paperDy: K(t, [[3.4, -150], [3.8, -110]]), pose: ST.agentPaper(G.D, K(t, [[3.4, -150], [3.8, -110]]), true) });
      ST.porchFront(ctx);
      const turn = tt >= 0.5 && tt < 1.4, YP = { x: 968, y: 1192, s: 0.74, yaw: 1 };
      ST.sportsCar(ctx, 1060, 1050, 2.2, 61, {
        t, smoke, shake: tt >= 0.6 && tt < 0.9, lamp: K(t, [[2.0, 0], [2.3, 0.55, 'out'], [2.6, 0.55], [2.8, 0.2]]),
        inside: () => Y.draw(ctx, Object.assign({}, YP, {
          t, shades: 1, sweat: tt >= 1.4, lean: slump ? 14 : 0, headDy: slump ? 30 : 0,
          expr: S(t, [[0, 'focused'], [1.0, 'confused'], [1.6, 'miserable'], [3.2, 'exhausted']]),
          pose: ST.pose('stand', Y.D, null, { hL: ST.handAt(Y.D, 1, -0.2, 0.25, 0.85), hR: ST.handAt(Y.D, -1, -0.1, turn ? 0.28 + (Math.floor(tt * 6) % 2) * 0.05 : 0.3, 0.8) }),
        })),
      });
      if (tt >= 0.6 && tt < 1.2) ST.soundWord(ctx, 'CLICK', 1220, 640, 60, -8);
      if (tt >= 1.0 && tt < 1.5) ST.soundWord(ctx, 'click', 1260, 720, 40, 6);
    },
  });
})();

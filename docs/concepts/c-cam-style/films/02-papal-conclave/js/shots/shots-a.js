/* Shots 1-3 (c-cam): title poster, the pope is dead (crowd, bell, baker), the vote begins (wide, chalice, notebook). Also the shared
   conclave layout every hall shot reuses. render(ctx, t) paints the whole frame for shot time t; acting on twos. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST, tw = ST.twos;
  const TONES = [['#4a4438', '#3a352c', '#6e5f4c'], ['#5a5040', '#463e32', '#86705a'], ['#526068', '#3a454c', '#98785e'], ['#646238', '#46452a', '#8a6a52']];
  ST.TOWN_TONES = TONES;

  // heavy poster lettering: bone fill, rust extrusion, fat ink outline; letters thud in one by one on twos
  ST.posterWord = (ctx, word, x, y, size, t, t0, rotBase) => {
    ctx.save();
    ctx.font = `${size}px Impact, 'Arial Black', sans-serif`;
    const widths = [...word].map((ch) => ctx.measureText(ch).width * 0.97), total = widths.reduce((a, b) => a + b, 0);
    let cx = x - total / 2;
    [...word].forEach((ch, i) => {
      const on = tw(t) >= t0 + i * 0.06, lx = cx + widths[i] / 2, rot = rotBase + ST.rnd(-4, 4, 77, i), dy = ST.rnd(-10, 10, 78, i);
      cx += widths[i];
      if (!on || ch === ' ') return;
      const drop = tw(t) < t0 + i * 0.06 + 0.09 ? -18 : 0;
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

  // The conclave table, shared by every hall shot. o: { tired, stubborn (draw props merged over the defaults),
  // extras: (i, x) => mode | [mode, yaw], table: true, items(topY), chairs: true, after() (drawn over the table) }
  const TOP = 690, FEET = 880;
  ST.CONCLAVE = { TOP, FEET, TIRED_X: 620, STUB_X: 1290, EXTRAS: [[230, 1], [950, 0], [1700, -1]] };
  ST.conclave = (ctx, t, o) => {
    const T = CAST.tired, B = CAST.stubborn, L = ST.CONCLAVE;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-2000, -2000, 6000, FEET + 2060);
    ctx.clip(); // nothing seated pokes out below the table
    if (o.chairs !== false) { ST.chair(ctx, L.TIRED_X, FEET, 0.8, 600); ST.chair(ctx, L.STUB_X, FEET, 0.82, 604); }
    L.EXTRAS.forEach(([x, yaw], i) => {
      const r = o.extras ? o.extras(i, x) : 'sit', [mode, y] = Array.isArray(r) ? r : [r, yaw];
      ST.crowdFigure(ctx, { x, y: FEET - 40, s: 1.55, kind: 5, yaw: y, t, mode, seed: 700 + i * 17 });
    });
    T.draw(ctx, Object.assign({ x: L.TIRED_X, y: FEET, s: 0.8, t, yaw: 1, expr: 'exhausted', pose: ST.seat(T.D, { hL: ST.handAt(T.D, 1, -0.2, 0.62, 0.55), hR: ST.handAt(T.D, -1, -0.2, 0.64, 0.5) }) }, o.tired || {}));
    B.draw(ctx, Object.assign({ x: L.STUB_X, y: FEET, s: 0.82, t, yaw: -1, expr: 'smug', pose: ST.seat(B.D) }, o.stubborn || {}));
    ctx.restore();
    if (o.table !== false) ST.hallTable(ctx, 60, 1860, TOP, { items: o.items });
    if (o.after) o.after();
  };
  // the notebook lifted clear of the table top while he writes seated
  ST.writeUp = (B, ph) => {
    const w = B.write(ph);
    return Object.assign(w, { hL: [w.hL[0], w.hL[1] - 70, w.hL[2]], hR: [w.hR[0], w.hR[1] - 70, w.hR[2]] });
  };
  // ballots scattered on the table + the chalice
  ST.tableBallots = (ctx, n, seed, chaliceX) => (top) => {
    for (let i = 0; i < n; i++) ST.slip(ctx, 300 + ST.hash(seed, i) * 1300, top + ST.rnd(-6, 10, seed, i, 1), ST.rnd(-0.5, 0.5, seed, i, 2), seed + i * 3, 0.9);
    if (chaliceX) ST.chalice(ctx, chaliceX === true ? 1010 : chaliceX, top + 4, 610);
  };

  ST.defineShot('title', {
    title: 'Title', role: 'poster', note: 'Low angle, off-centre, a hair of tilt: the Stubborn Cardinal looms right of centre, the Tired one small on the left, the Mayor cut by the frame edge with his key.',
    cuts: [[0, 'poster']],
    render(ctx, t) {
      ST.camera(ctx, 960, 540, K(t, [[0, 1.06], [4, 1.0]]), -2);
      ST.setTitle(ctx);
      const T = CAST.tired, B = CAST.stubborn, M = CAST.mayor, tt = tw(t);
      T.draw(ctx, { x: 400, y: 1050, s: 0.6, t, yaw: 1, expr: S(t, [[0, 'exhausted'], [2.6, 'asleep']]), headDy: tt >= 2.6 ? 8 : 0, pose: ST.pose('slump', T.D) });
      M.draw(ctx, { x: 1720, y: 1150, s: 0.95, t, yaw: -1, expr: S(t, [[0, 'deadpan'], [2.2, 'disgust']]), key: -1.2, plank: -1.48, pose: ST.pose('stand', M.D, null, { hR: ST.handAt(M.D, -1, 0.2, -0.2, 0.35), poleR: [-1, 0.3, -0.3], hL: ST.handAt(M.D, 1, 0.55, 0.5, 0.1), poleL: [1, 0.3, -0.4] }) });
      B.draw(ctx, { x: 1130, y: 1160, s: 1.0, t, yaw: -1, head: S(t, [[0, -1], [1.6, 0]]), headDy: -6, expr: 'smug', book: 'shut', pose: ST.pose('akimbo', B.D, null, { hL: ST.handAt(B.D, 1, -0.25, 0.55, 0.4), kL: 'grip', poleL: [1, 0.4, -0.5] }) });
      ST.posterWord(ctx, 'HOW NOT TO', 900, 100, 104, t, 0.1, -3);
      ST.posterWord(ctx, 'CHOOSE A POPE', 900, 250, 168, t, 0.8, 2);
      if (tt >= 1.8) {
        ST.rough(ctx, [640, 362, 1170, 352, 1180, 418, 630, 428], C.INK, { seed: 79, lw: 6, lineColor: C.MUSTARD });
        ST.label(ctx, 'VITERBO  ·  1268', 905, 390, { size: 44, fill: C.MUSTARD, rot: -1 });
      }
    },
  });

  ST.defineShot('death', {
    title: 'The pope has died', role: 'setting', note: 'From behind the bowed crowd (their backs huge in the foreground) up to the palace; cut: extreme close-up on the swinging bell; cut: close on the Baker, sad, loaf in hand.',
    cuts: [[0, 'crowd'], [2.6, 'bell'], [3.8, 'baker']],
    render(ctx, t) {
      const tt = tw(t), swing = 0.42 * Math.sin(tt * Math.PI * 1.6), cut = ST.cut(t, this.cuts).name;
      if (cut === 'crowd') ST.camera(ctx, K(t, [[0, 900], [2.6, 960]]), 560, K(t, [[0, 1.0], [2.6, 1.05]]));
      else if (cut === 'bell') ST.camera(ctx, 1645, 190, K(t, [[2.6, 3.0], [3.8, 3.2]]), -6);
      else ST.camera(ctx, 470, 560, K(t, [[3.8, 2.2], [5, 2.3]]));
      ST.setStreet(ctx, t, { bell: swing, drape: true });
      for (let i = 0; i < 9; i++) {
        const tone = TONES[i % 4];
        ST.crowdFigure(ctx, { x: 520 + i * 120 + (i % 2) * 30, y: 900 + (i % 2) * 34, s: 1.0 + (i % 2) * 0.1, kind: i % 5, yaw: i % 3 === 0 ? 3 : i < 4 ? 1 : -1, t, mode: 'stand', lean: 7, col: tone[0], colD: tone[1], skin: tone[2], seed: 720 + i * 7 });
      }
      const M = CAST.mayor, BK = CAST.baker;
      M.draw(ctx, { x: 1640, y: 1060, s: 0.86, t, yaw: -1, head: S(t, [[0, -1], [2.6, -2]]), expr: S(t, [[0, 'sad'], [3.2, 'deadpan']]), pose: ST.pose('clasp', M.D) });
      BK.draw(ctx, { x: 300, y: 1066, s: 0.9, t, yaw: 1, loaf: true, expr: S(t, [[0, 'deadpan'], [2.0, 'sad']]), head: S(t, [[0, 1], [4.4, 0]]), headDy: tt >= 4.4 ? 6 : 0, pose: ST.pose('stand', BK.D, null, { hR: ST.handAt(BK.D, -1, -0.1, 0.5, 0.4), kR: 'grip' }) });
      if (cut === 'crowd') [[700, 2], [1260, 4]].forEach(([x, kind], i) => ST.crowdFigure(ctx, { x, y: 1560, s: 2.6, kind, yaw: 3, t, mode: 'stand', lean: i ? -4 : 5, col: '#38322a', colD: '#27231d', skin: '#4a4034', seed: 730 + i * 5 }));
    },
  });

  ST.defineShot('hall', {
    title: 'The vote begins', role: 'the task', note: 'High wide on the great hall past a chair back in the foreground; cut: extreme close-up, a ballot drops into the gold chalice; cut: close on the Stubborn Cardinal scratching in his notebook.',
    cuts: [[0, 'wide'], [2.2, 'chalice'], [4.0, 'writer']],
    render(ctx, t) {
      const tt = tw(t), T = CAST.tired, B = CAST.stubborn, cut = ST.cut(t, this.cuts).name;
      if (cut === 'wide') ST.camera(ctx, 980, K(t, [[0, 430], [2.2, 470]]), K(t, [[0, 0.9], [2.2, 0.96]]));
      else if (cut === 'chalice') ST.camera(ctx, 1010, 660, K(t, [[2.2, 2.8], [4, 3.0]]), 3);
      else ST.camera(ctx, K(t, [[4, 1210], [6, 1230]]), 520, K(t, [[4, 2.2], [6, 2.4]]));
      ST.setHall(ctx, t, { candle: 1 });
      ST.conclave(ctx, t, {
        extras: (i) => (tt >= 0.6 + i * 0.5 && cut === 'wide' ? 'vote' : 'sit'),
        tired: { expr: S(t, [[0, 'exhausted'], [1.8, 'asleep']]), headDy: tt >= 1.8 ? 14 : 0, head: 1, pose: ST.seat(T.D, tt >= 0.8 && tt < 1.8 ? ST.ballotUp(T.D, -1) : { hL: ST.handAt(T.D, 1, -0.2, 0.62, 0.55), hR: ST.handAt(T.D, -1, -0.2, 0.64, 0.5) }), after: tt >= 0.8 && tt < 1.8 ? (J) => ST.slip(ctx, ST.palm(J.aR, 34)[0], ST.palm(J.aR, 34)[1] - 20, 0.1, 620) : null },
        stubborn: { book: 'open', stylus: true, head: S(t, [[0, -1], [4.8, -2]]), expr: S(t, [[0, 'smug'], [4.8, 'disgust']]), pose: ST.seat(B.D, ST.writeUp(B, Math.floor(tt * 6) % 2)), layer: { L: 2, R: 2 } },
        items: ST.tableBallots(ctx, 7, 630, true),
        after: () => { if (cut === 'chalice' && tt < 3.0) ST.slip(ctx, 1004, K(t, [[2.2, 520], [3.0, 640, 'lin']]), K(t, [[2.2, 0.6], [3.0, 1.5]]), 640, 0.9); },
      });
      if (cut === 'wide') ST.fg(ctx, [-40, 1120, -30, 640, 40, 560, 170, 560, 230, 640, 240, 1120], 650); // a chair back right at the lens
    },
  });
})();

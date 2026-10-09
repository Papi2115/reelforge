/* A three-shot demo cut: how a film sits on this engine (camera track + Dutch tilt, one hard key per shot, rim light,
   stepped vignettes, a hard cut inside a shot) and the fixed anatomy at work: a solved handshake, a face-contact
   hand, a palm on a counter. Copy this file's pattern for a new film: ST.defineShot(...) for every shot + ST.FILM. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST;
  function deck(ctx) { // a plain deck: sky, rail, planks, one warm pool
    ST.bands(ctx, -600, -400, 2600, 560, ['#c9a46a', '#b58e5a', '#9c7a4e'], 3);
    ST.rect(ctx, -600, 520, 3200, 60, C.TIMBER, { seed: 31, lw: 5 });
    for (let i = 0; i < 7; i++) ST.rect(ctx, -600, 580 + i * 70 * (1 + i * 0.3), 3200, 70 * (1 + i * 0.3), i % 2 ? '#4a3a28' : '#54422e', { seed: 40 + i, lw: 4 });
    ST.pool(ctx, 900, 700, 700, 160, 'rgba(255,200,120,0.08)', 1);
  }
  function hall(ctx) { // a marble hall: wall, two columns, floor
    ctx.fillStyle = '#7d7766';
    ctx.fillRect(-600, -400, 3200, 1400);
    [300, 1500].forEach((x, i) => ST.rect(ctx, x, -400, 140, 1400, C.STONE, { seed: 60 + i, lw: 6, hatch: { c: 'rgba(30,26,20,0.4)', n: 6, len: 60, gap: 8, k: 3, ang: 88 } }));
    ST.rect(ctx, -600, 1000, 3200, 600, C.STONE_D, { seed: 70, lw: 5 });
  }

  ST.defineShot('handshake', {
    title: 'The handshake', role: 'contact', note: 'Push-in with a Dutch roll; the Captain walks in and the two right hands meet on one solved world point (ST.meet), his left hand clamps on top.',
    render(ctx, t) {
      ST.setLight(-1, 'rgba(255,214,150,0.6)');
      ST.shotCam(ctx, t, { x: [[0, 1060], [2.5, 1060], [4, 1000]], y: [[0, 640], [4, 600]], z: [[0, 1.05], [2.5, 1.1], [4, 1.5]], tilt: [[0, 0], [2.5, 0], [3.6, -6]] });
      deck(ctx);
      const Cp = CAST.captain, Rc = CAST.recruit, tt = ST.twos(t), walkIn = ST.ease.out(ST.seg(tt, 0, 1.2)), reach = ST.ease.inOut(ST.seg(tt, 1.0, 1.6));
      const pc = { x: ST.lerp(1700, 1120, walkIn), y: 1080, s: 1.0, t, yaw: tt < 1.2 ? -2 : -1, expr: S(t, [[0, 'grin'], [3.2, 'wink']]), talk: [[1.6, 3.0]] };
      const pr = { x: 640, y: 1500, s: 1.4, t, yaw: 2, sack: true, expr: S(t, [[0, 'scared'], [1.6, 'shock'], [2.0, 'scared']]), gulp: tt >= 2.2 && tt < 2.6 ? 1 : 0, pose: ST.pose('stand', Rc.D, null, ST.recruitCarry(Rc.D)) };
      const m = ST.meet({ a: { ch: Cp, hand: 'R', p: Object.assign({}, pc, { x: 1120, yaw: -1 }) }, b: { ch: Rc, hand: 'R', p: pr }, point: 'mid', move: false });
      // the hands travel in WORLD space from where they hang to the solved contact point, pumping together
      const cp0 = Object.assign({}, pc, { pose: ST.pose(tt < 1.2 ? 'walk' : 'stand', Cp.D, (tt * 1.6) % 1) }), pump = tt >= 1.6 && tt < 3.0 ? (Math.floor(tt * 6) % 2) * 8 : 0;
      const to = (w) => [w[0] + (m.point[0] - w[0]) * reach, w[1] + (m.point[1] + pump - w[1]) * reach];
      const ra = ST.handAtWorld(Cp, cp0, 'R', to(ST.palmWorld(Cp, cp0, 'R'))), rb = ST.handAtWorld(Rc, pr, 'R', to(ST.palmWorld(Rc, pr, 'R')));
      const captain = Object.assign({}, cp0, { pose: Object.assign({}, cp0.pose, ra.over, { kR: reach > 0.9 ? 'grip' : 'open' }) });
      Cp.draw(ctx, reach >= 1 ? ST.captainClamp({ a: captain, point: [m.point[0], m.point[1] + pump] }) : captain);
      Rc.draw(ctx, Object.assign({}, pr, { pose: Object.assign({}, pr.pose, rb.over, { kR: reach > 0.9 ? 'grip' : 'fist' }) }));
      ST.vignette(ctx, 0.9);
    },
  });

  ST.defineShot('senate', {
    title: 'The senate', role: 'face contact', note: 'Oval vignette, key from the left: the Senator thinks with his fist under his chin (a face-contact target), then a hard cut to a close-up as he grins.',
    render(ctx, t) {
      ST.setLight({ x: -1, y: -0.5, rim: 'rgba(255,214,150,0.55)' });
      const Sn = CAST.senator, Y = CAST.you;
      ST.cut(ctx, t, [
        [0, (c, tt) => {
          ST.camera(c, 960, 620, 1.0);
          hall(c);
          ST.bgPerson(c, { who: 'beanpole', x: 900, y: 1000, s: 0.62, t: tt, dir: -1, mode: tt % 2 < 1 ? 'stand' : 'wave', seed: 3100 });
          ST.bgPerson(c, { who: 'barrel', x: 1720, y: 1000, s: 0.7, t: tt, yaw: -1, mode: 'cross', seed: 3140 });
          ST.actor(c, 'you', { x: 560, y: 1000, s: 0.95, t: tt, yaw: 1, expr: 'confused', talk: [[0.4, 1.6]], pose: ST.pose('hug', Y.D) });
          ST.actor(c, 'senator', { x: 1300, y: 1000, s: 1.0, t: tt, yaw: -1, expr: 'smug', pose: ST.pose('stand', Sn.D, null, Object.assign(ST.touch('R', 'chin', 0, 12, 'fist'), { hL: ST.fitArm(Sn.D, 1, [10, Sn.D.sy + 92, Sn.D.sz + 96]) })) });
          ST.vignette(c, 1, 'oval');
        }],
        [2.2, (c, tt) => {
          ST.camera(c, K(tt, [[0, 1290], [1.8, 1300]]), 560, K(tt, [[0, 2.2], [1.8, 2.4]]), 4);
          hall(c);
          ST.actor(c, 'senator', { x: 1300, y: 1000, s: 1.0, t: t, yaw: -1, expr: 'grin', talk: [[0.2, 1.4]], chuckle: tt > 1.4, pose: ST.pose('stand', Sn.D, null, ST.senatorTwiddle(t)) });
          ST.vignette(c, 1.1, 'oval');
        }],
      ]);
    },
  });

  ST.defineShot('counter', {
    title: 'The counter', role: 'reach', note: 'Low over the counter: the Laundromat Owner\'s palm lands on the form in world space (ST.handAtWorld) and slams the stamp; You wait, phone up.',
    render(ctx, t) {
      ST.setLight({ x: 0.2, y: -1, rim: 'rgba(220,236,210,0.5)', shadow: 'rgba(20,24,30,0.4)' });
      ST.shotCam(ctx, t, { x: 960, y: [[0, 560], [4, 600]], z: [[0, 1.0], [4, 1.12]], tilt: 2 });
      ctx.fillStyle = '#6e7768';
      ctx.fillRect(-400, -400, 2800, 1700);
      const W2 = CAST.washer, Y = CAST.you, tt = ST.twos(t), down = tt % 0.6 < 0.2;
      Y.draw(ctx, { x: 520, y: 1060, s: 0.95, t, yaw: 1, expr: 'deadpan', phone: true, pose: ST.pose('hug', Y.D, null, { hR: ST.handAt(Y.D, -1, -0.12, 0.2, 0.6), kR: 'grip', poleR: [-1, 0.6, -0.2] }) });
      const p = { x: 1240, y: 1060, s: 1.0, t, yaw: -2, head: -1, over: true, expr: 'smug', talk: [[2.4, 3.4]], pose: ST.WASHER_STAMP(W2.D, down) };
      const r = ST.handAtWorld(W2, p, 'R', [1000, down ? 752 : 690]); // she stands BEHIND the counter, her palm lands on the form
      W2.draw(ctx, Object.assign(p, { pose: Object.assign({}, p.pose, r.over, { kR: 'grip' }), propR: (c, x, y) => ST.stamp(c, x, y + 10, down) }));
      ST.rect(ctx, 760, 800, 1300, 420, '#7d6a4e', { seed: 81, lw: 8, hatch: { c: 'rgba(20,14,6,0.4)', n: 8, len: 90, gap: 9, k: 2, ang: 8, bend: 0 } }); // the counter
      ST.rect(ctx, 900, 776, 160, 26, C.PAPER, { seed: 82, lw: 4 }); // the form
      ST.vignette(ctx, 0.8);
    },
  });

  ST.FILM = [
    { id: 'handshake', dur: 4.5, lines: [[0.3, 2.0, 'Every captain was elected.'], [2.0, 4.5, 'And every election starts with a handshake.']] },
    { id: 'senate', dur: 4.2, lines: [[0.2, 2.2, 'The Senator is thinking.'], [2.2, 4.2, 'That is never good news.']] },
    { id: 'counter', dur: 4.0, lines: [[0.2, 4.0, 'Form 27-B. Stamped. Again.']] },
  ];
})();

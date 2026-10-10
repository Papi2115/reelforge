/* Shots 6-8: the rice stipend (a bale too big), the market price board, the loan (bow, lower bow, the koban change
   hands - palms solved to meet exactly). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST;
  const tw = ST.twos;
  const BALE = [300, 190];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // you hugging the bale at chest height (both hands on its sides)
  const hug = (D) => ({ hL: ST.handAt(D, 1, -0.25, 0.42, 0.5), hR: ST.handAt(D, -1, -0.25, 0.42, 0.5), kL: 'grip', kR: 'grip', poleL: [1, 0.4, -0.4], poleR: [-1, 0.4, -0.4] });

  ST.defineShot('rice', {
    title: 'Paid in rice', role: 'the stipend', note: 'Storehouse yard: you hold out your palms for coins. The Keeper drops a straw bale of rice into them. Your knees go. You stagger off with it.',
    render(ctx, t) {
      const tt = tw(t);
      ST.cutCam(ctx, t, [
        [0, 1.9, [930, 600, 1.55], [960, 600, 1.6]], // medium: your open palms, the Keeper's bale filling the right edge
        [1.9, 2.3, [1040, 580, 1.15]], // wide: the drop
        [2.3, 3.8, [820, 470, 2.2, -3], [815, 470, 2.4, -3]], // close, tilted: your face under the weight
        [3.8, 6, [1000, 580, 1.0], [900, 580, 1.0]], // wide: you stagger off
      ]);
      ST.setRice(ctx);
      const Y = CAST.you, KP = CAST.keeper, sY = 0.9, sK = 0.95;
      const pK = { x: 1290, y: 1046, s: sK, t, yaw: -2 }, pY0 = { x: 790, y: 1040, s: sY, yaw: 2 };
      const PKhold = ST.pose('stand', KP.D, null, ST.keeperHold(KP.D, -0.05, 0.42, 0.55));
      const kHold = mid(ST.palmWorld(KP, pK, PKhold, 'L'), ST.palmWorld(KP, pK, PKhold, 'R'));
      const PYhug = ST.pose('stand', Y.D, null, Object.assign(hug(Y.D), { bob: 0.02 }));
      const yHold = mid(ST.palmWorld(Y, pY0, PYhug, 'L'), ST.palmWorld(Y, pY0, PYhug, 'R'));
      const give = K(tt, [[1.9, 0], [2.3, 1, 'lin']]), owner = tt < 2.3 ? 'keeper' : 'you';
      const B = [ST.lerp(kHold[0], yHold[0], give), ST.lerp(kHold[1], yHold[1], give) - Math.sin(give * Math.PI) * 40];
      let PK = PKhold;
      if (give > 0 && give < 1) PK = Object.assign({}, PKhold, { hL: ST.reachPalm(KP, pK, PKhold, 'L', [B[0], B[1] + 4], KP.D.sw * 0.5), hR: ST.reachPalm(KP, pK, PKhold, 'R', [B[0], B[1] + 4], -KP.D.sw * 0.5) });
      if (owner === 'you') PK = tt >= 3.6 ? ST.pose('stand', KP.D) : ST.pose('stand', KP.D, null, { hL: ST.handAt(KP.D, 1, -0.1, 0.5, 0.3), hR: ST.handAt(KP.D, -1, -0.1, 0.48, 0.32), kL: 'flat', kR: 'flat' });
      KP.draw(ctx, Object.assign({}, pK, { yaw: ST.turn(t, [[0, -2], [3.6, -3]]), pose: PK, bale: owner === 'keeper' ? BALE : null, expr: S(t, [[0, 'deadpan'], [2.4, 'smug']]), talk: [[0.5, 1.5]] }));
      const leave = tt >= 3.8, sag = owner === 'you' && tt < 3.8 ? 0.07 : 0.04;
      const palmsUp = { hL: ST.handAt(Y.D, 1, -0.3, 0.45, 0.55), hR: ST.handAt(Y.D, -1, -0.3, 0.45, 0.55), kL: 'open', kR: 'open', poleL: [1, 0.4, -0.4], poleR: [-1, 0.4, -0.4] };
      const PY = owner === 'keeper' ? ST.pose('stand', Y.D, null, palmsUp) : leave ? ST.pose('walk', Y.D, (tt * 1.1) % 1, Object.assign(hug(Y.D), { bob: sag })) : ST.pose('stand', Y.D, null, Object.assign(hug(Y.D), { bob: sag }));
      Y.draw(ctx, {
        x: leave ? 790 - 150 * (tt - 3.8) : 790, y: 1040, s: sY, t, yaw: ST.turn(t, [[0, 2], [3.6, 4]]), pose: PY, bale: owner === 'you' ? BALE : null, lean: owner === 'you' ? -4 : 0,
        expr: S(t, [[0, 'grin'], [1.2, 'confused'], [2.3, 'shock'], [2.7, 'miserable']]), headDy: tt >= 2.3 && tt < 2.5 ? 14 : 0, look: tt < 2.3 ? [0.7, 0.4] : [0.2, 0.2],
      });
    },
  });

  ST.defineShot('market', {
    title: 'The market', role: 'prices move', note: 'Rice market: your bale at your feet, the price board flips up, down, up, down. You panic.',
    render(ctx, t) {
      const tt = tw(t);
      const cuts = [
        [0, 1.9, [980, 560, 1.0], [980, 540, 1.06]], // wide: you, the bale, the board (a passer-by crosses in the foreground)
        [1.9, 3.7, [1280, 420, 2.1], [1280, 420, 2.3]], // insert: the board flips, and flips
        [3.7, 6, [860, 560, 1.5, 5], [840, 540, 1.8, 5]], // low, tilted, pushing in on the panic
      ], shot = ST.cutCam(ctx, t, cuts);
      ST.setMarket(ctx, t);
      const flips = [0.9, 1.9, 2.6, 3.2, 3.7, 4.1, 4.5, 4.8, 5.1, 5.4];
      let n = 0, flip = 0;
      flips.forEach((f) => { if (tt >= f) n++; if (tt >= f && tt < f + 0.17) flip = (tt - f) / 0.17; });
      ST.priceBoard(ctx, 1280, 300, n % 2 === 0, flip, 350);
      ST.crowdFigure(ctx, { x: 1700, y: 900, s: 1.2, kind: 0, yaw: -1, mode: tt > 2.5 ? 'point' : 'stand', col: '#4f5a50', colD: '#3c453d', seed: 960 });
      ST.crowdFigure(ctx, { x: 1880, y: 920, s: 1.25, kind: 3, yaw: -1, mode: 'stand', col: '#5a4a40', colD: '#463a32', seed: 970 });
      ST.crowdFigure(ctx, { x: 120, y: 900, s: 1.2, kind: 4, yaw: 1, mode: 'stand', col: '#60563e', colD: '#4a4230', seed: 980 });
      ST.bale(ctx, 520, 960, BALE[0], BALE[1], 351);
      const Y = CAST.you, panic = tt >= 3.7;
      const P = panic ? ST.pose('armsUp', Y.D) : tt >= 2.6 ? ST.pose('stand', Y.D, null, { hR: ST.handAt(Y.D, -1, -0.5, 0.2, 0.4), kR: 'open' }) : ST.pose('stand', Y.D);
      Y.draw(ctx, {
        x: 800, y: 1044, s: 0.92, t, yaw: 1, head: 1, look: [0.8, -0.8], pose: P, bow: 0,
        expr: S(t, [[0, 'confused'], [1.9, 'scared'], [3.7, 'shock'], [4.2, 'yelling']]), headDy: tt >= 3.7 && tt < 3.9 ? -20 : 0, talk: [[4.2, 5.6]],
      });
      if (shot === 0) ST.silhouette(ctx, ST.cutFrame(t, cuts), (c) => ST.crowdFigure(c, { x: K(t, [[0, 1900], [1.9, 1560, 'lin']]), y: 1420, s: 2.3, kind: 2, yaw: -2, mode: 'stand', col: '#000', colD: '#000', seed: 990 }));
    },
  });

  ST.defineShot('loan', {
    title: 'The loan', role: 'merchant in charge', note: 'Lamp-lit shop: you bow, he bows lower. He holds out gold koban on his palm, your hand meets his, the coins change hands. He stays one bow lower and smiles.',
    render(ctx, t) {
      const tt = tw(t);
      const Y = CAST.you, M = CAST.merchant;
      const bowY = K(tt, [[0.4, 0], [0.9, 24, 'out'], [1.6, 24], [2.0, 14], [4.2, 14], [4.6, 6]]);
      const bowM = K(tt, [[0.8, 0], [1.3, 40, 'out'], [1.9, 40], [2.3, 26], [4.4, 26], [4.8, 14]]);
      const offer = K(tt, [[2.2, 0], [2.7, 1, 'out'], [3.9, 1], [4.4, 0]]);
      const pM = { x: 1240, y: 1046, s: 0.92, t, yaw: -2, bow: bowM };
      const PM = ST.pose('stand', M.D, null, { hL: ST.handAt(M.D, 1, -0.25, ST.lerp(0.85, 0.35, offer), ST.lerp(0.15, 0.85, offer)), kL: offer > 0.5 ? 'flat' : 'fist', poleL: [1, 0.5, -0.4], hR: ST.handAt(M.D, -1, -0.2, 0.7, 0.3), kR: 'fist' });
      const taken = tt >= 3.5, coin = ST.palmWorld(M, pM, PM, 'L');
      const xY = K(tt, [[2.1, 660], [2.7, 860], [4.1, 860], [4.6, 760]]), stepping = (tt >= 2.1 && tt < 2.7) || (tt >= 4.1 && tt < 4.6);
      const pY = { x: xY, y: 1040, s: 0.9, t, yaw: 2, bow: bowY }, hilt = { hL: ST.handAt(Y.D, 1, -0.2, 0.62, 0.3), kL: 'grip', poleL: [1, 0.4, -0.5] };
      let PY = stepping ? ST.pose('walk', Y.D, (tt * 2) % 1, hilt) : ST.pose('stand', Y.D, null, hilt);
      const reach = K(tt, [[2.6, 0], [3.1, 1, 'out'], [3.5, 1], [4.0, 0]]);
      if (reach > 0) {
        const rest = ST.palmWorld(Y, pY, PY, 'R'), aim = [ST.lerp(rest[0], coin[0], reach), ST.lerp(rest[1], coin[1] - 16, reach)];
        PY = Object.assign({}, PY, { hR: ST.reachPalm(Y, pY, PY, 'R', aim, -Y.D.sw * 0.4), kR: reach > 0.9 && !taken ? 'open' : 'grip', poleR: [-1, 0.5, -0.4] });
      }
      // the camera frames points solved in world space (the coins, his face); it never moves the contact itself
      const face = ST.figToWorld(pM, true, 0, ST.bowPt([34, -614], M.D.hy, bowM));
      ST.cutCam(ctx, t, [
        [0, 2.1, [1000, 600, 1.12], [990, 610, 1.2]], // wide: you bow, he bows lower
        [2.1, 2.9, [1060, 640, 1.5]], // medium: you step in, he holds out the gold
        [2.9, 3.9, [coin[0], coin[1] - 20, 3.2], [coin[0], coin[1] - 20, 3.5]], // extreme close-up: the hands meet
        [3.9, 5.0, [face[0] - 60, face[1] + 60, 2.3], [face[0] - 40, face[1] + 50, 2.7]], // push in on his smile
        [5.0, 7, [1000, 600, 1.3], [1000, 590, 1.1]], // pull back: one bow lower, clearly in charge
      ]);
      ST.setShop(ctx, t);
      M.draw(ctx, Object.assign({}, pM, { pose: PM, koban: taken || offer < 0.3 ? null : [1, 3], expr: S(t, [[0, 'smug'], [1.0, 'grin'], [2.3, 'focused'], [3.6, 'smug'], [4.6, 'grin']]), talk: [[2.3, 3.0]] }));
      Y.draw(ctx, Object.assign({}, pY, {
        pose: PY, expr: S(t, [[0, 'scared'], [1.3, 'confused'], [3.5, 'grin'], [5.2, 'deadpan']]), look: [0.6, 0.5],
        after: taken ? (J) => { const g = ST.palm(J.aR, Y.hsz); ST.koban(ctx, g[0], g[1] - 14, 3, 597); } : null,
      }));
    },
  });
})();

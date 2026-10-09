/* Shots 9-11: the ledger (your name, a long list), the wrong bow (hat off, Elder furious), the payoff (deep bow,
   slight bow, a cat on your sword). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST;
  const tw = ST.twos;
  const ENTRIES = ['rice loan', 'rice loan', 'interest', 'loan', 'interest', 'new loan', 'interest', 'late fee'];

  // the account book between the merchant's palms (figure space): closed cover, open spread, then folded pages
  // cascading down (n pages unfolded)
  function ledger(ctx, a, b, open, n) {
    const cx = (a[0] + b[0]) / 2, top = Math.min(a[1], b[1]) - 120, w = Math.abs(a[0] - b[0]) - 16, h = 250;
    if (!open) {
      ST.rough(ctx, [cx - w / 2, top, cx + w / 2, top - 6, cx + w / 2 + 4, top + h, cx - w / 2 + 2, top + h + 4], '#6c5a3c', { seed: 610, lw: 6, amp: 2, shade: ['#4e3f2a', -10, 0], hatch: { c: 'rgba(20,12,6,0.5)', n: 3, len: 40, gap: 6, k: 2, ang: 80 } });
      ST.rect(ctx, cx - 26, top + 20, 52, 150, '#b1a888', { seed: 611, lw: 4 });
      ST.label(ctx, 'DEBTS', cx, top + 95, { size: 18, fill: C.INK, rot: 90 });
      return;
    }
    for (let i = n; i >= 1; i--) {
      const y = top + h * i, sk = i % 2 ? 10 : -10;
      ST.rough(ctx, [cx - w / 2 + sk, y, cx + w / 2 + sk, y, cx + w / 2 - sk, y + h, cx - w / 2 - sk, y + h], i % 2 ? '#aa9f80' : '#b4aa8a', { seed: 620 + i, lw: 5, amp: 1.5, mottle: ['rgba(90,70,40,0.2)', 2, 20] });
      for (let k = 0; k < 5; k++) entry(ctx, cx + sk * 0.5, y + 34 + k * 44, w, (i * 5 + k) % ENTRIES.length, 630 + i * 7 + k);
    }
    ST.rough(ctx, [cx - w / 2, top, cx + w / 2, top - 4, cx + w / 2, top + h, cx - w / 2, top + h], '#b4aa8a', { seed: 612, lw: 6, amp: 1.5, mottle: ['rgba(90,70,40,0.2)', 3, 24] });
    ST.label(ctx, 'YOU', cx, top + 40, { size: 50, fill: C.INK });
    ST.stroke(ctx, [cx - w * 0.36, top + 70, cx + w * 0.36, top + 68], { w: 4, seed: 613, taper: false });
    for (let k = 0; k < 4; k++) entry(ctx, cx, top + 100 + k * 40, w, k, 614 + k);
  }
  function entry(ctx, cx, y, w, k, seed) {
    ST.label(ctx, ENTRIES[k], cx - w * 0.4, y, { size: 22, fill: '#2c241c', align: 'left', font: 'italic bold 22px Georgia' });
    for (let j = 0; j < 3 + (k % 3); j++) ST.stroke(ctx, [cx + w * 0.12 + j * 9, y - 10, cx + w * 0.12 + j * 9 + 2, y + 10], { w: 3, seed: seed + j, taper: false });
  }

  ST.defineShot('ledger', {
    title: 'The ledger', role: 'who is really in charge', note: 'Close on the Merchant: a polite little bow (in theory, he ranks below you). Then he opens the book - YOU at the top - and the list unfolds off the bottom of the frame.',
    render(ctx, t) {
      const tt = tw(t);
      const M = CAST.merchant, D = M.D, open = tt >= 1.5, n = tt < 3.0 ? 0 : Math.min(8, Math.floor((tt - 3.0) * 5) + 1);
      const P = ST.pose('stand', D, null, { hL: ST.handAt(D, 1, 0.3, 0.36, 0.5), hR: ST.handAt(D, -1, 0.3, 0.36, 0.5), kL: 'grip', kR: 'grip', poleL: [1, 0.3, -0.5], poleR: [-1, 0.3, -0.5] });
      const pM = { x: 1010, y: 1046, s: 0.92, yaw: 0 }, a = ST.palmWorld(M, pM, P, 'L'), b = ST.palmWorld(M, pM, P, 'R');
      const bx = (a[0] + b[0]) / 2, by = Math.min(a[1], b[1]) - 74; // the YOU heading on the page, in world space
      const shot = ST.cutCam(ctx, t, [
        [0, 1.5, [1110, 560, 1.75], [1090, 555, 1.85]], // over your shoulder, off-centre: the polite nod
        [1.5, 3.0, [bx, by + 40, 3.0], [bx, by + 40, 3.3]], // extreme close-up: YOU at the top of the page
        [3.0, 6, [bx, by + 120, 2.4], [bx + 60, Math.min(by + 230, 830), 1.5]], // pull back down the unfolding list
      ]);
      ST.setShop(ctx, t);
      const nod = tt >= 0.3 && tt < 1.4;
      M.draw(ctx, {
        x: 1010, y: 1046, s: 0.92, t, yaw: 0, pose: P, headDy: nod ? 16 : 0,
        expr: S(t, [[0, 'deadpan'], [1.5, 'grin'], [3.0, 'smug']]), look: tt >= 3.0 || !nod ? [0, 0] : [0.2, 0.7], talk: [[0.4, 1.2]],
        held: (J) => ledger(ctx, ST.palm(J.aL, M.hsz), ST.palm(J.aR, M.hsz), open, n),
      });
      if (shot === 0) CAST.you.draw(ctx, { x: 690, y: 1330, s: 1.25, t, yaw: 3, expr: 'scared' }); // your back, in the foreground
    },
  });

  ST.defineShot('wrongbow', {
    title: 'The wrong bow', role: 'etiquette', note: 'Office gate: the Elder arrives. You bow far too deep - your hat drops off, rolls, and stops against his toe. He looks at it. Then at you.',
    render(ctx, t) {
      const tt = tw(t);
      const Y = CAST.you, E = CAST.elder;
      const walking = tt < 0.9, leaving = tt >= 4.1;
      const ex = walking ? 1290 + 240 * (0.9 - tt) : leaving ? 1290 + 200 * (tt - 4.1) : 1290;
      ST.cutCam(ctx, t, [
        [0, 1.0, [980, 520, 1.04], [980, 520, 1.1]], // wide: the Elder arrives
        [1.0, 1.6, [1000, 520, 1.6, -4]], // closer, tilting: the bow goes too far, the hat goes
        [1.6, 2.4, [1194, 830, 2.6], [1194, 830, 2.8]], // extreme close-up: the hat against his toe
        [2.4, 3.6, [1260, 360, 1.9, -5], [1250, 360, 2.1, -5]], // low, tilted, on the Elder's fury
        [3.6, 5, [980, 520, 1.0], [980, 530, 1.06]], // wide: the whole ruined day
      ]);
      ST.setStreet(ctx, t, { gate: true });
      E.draw(ctx, {
        x: ex, y: 900, s: 0.9, t, yaw: ST.turn(t, [[0, -2], [3.8, -4]]), look: tt >= 1.6 && tt < 2.4 ? [-0.4, 1] : [-0.3, 0],
        expr: S(t, [[0, 'deadpan'], [1.6, 'disgust'], [2.4, 'rage']]), headDy: tt >= 2.4 && tt < 2.6 ? -14 : 0,
        pose: walking || leaving ? ST.pose('walk', E.D, (tt * 1.3) % 1) : ST.pose('stand', E.D),
      });
      const bow = K(tt, [[1.0, 0], [1.3, 96, 'out'], [3.2, 96], [3.8, 18]]), drop = 1.28;
      const pY = { x: 760, y: 900, s: 0.9, t, yaw: 2, bow }, PY = ST.pose('stand', Y.D, null, { hL: ST.handAt(Y.D, 1, -0.05, 0.8, 0.12), hR: ST.handAt(Y.D, -1, -0.05, 0.8, 0.14), kL: 'flat', kR: 'flat' });
      Y.draw(ctx, Object.assign({}, pY, { pose: PY, hat: tt < drop, expr: S(t, [[0, 'scared'], [1.3, 'shock'], [3.2, 'miserable']]), look: [0.4, 0.3] }));
      if (tt >= drop) {
        const c0 = Y.crown(Object.assign({}, pY, { bow: K(drop, [[1.0, 0], [1.3, 96, 'out']]) }), PY), u = ST.clamp01((tt - drop) / 0.3), r = ST.clamp01((tt - drop - 0.3) / 0.7);
        const toe = ex - 96, gx = ST.lerp(c0[0] + 60, toe, ST.ease.out(r)), x = u < 1 ? ST.lerp(c0[0], c0[0] + 60, u) : gx;
        const y = u < 1 ? ST.lerp(c0[1], 884, u * u) : 884 - Math.abs(Math.sin(r * Math.PI * 3)) * 14 * (1 - r);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((u < 1 ? 110 + u * 250 : 360 + Math.sin(r * Math.PI * 4) * (1 - r) * 28) * Math.PI) / 180); // lands upright, rocks
        ctx.scale(0.99, 0.99);
        ST.jingasa(ctx, 0, 14, 190, 161);
        ctx.restore();
      }
    },
  });

  ST.defineShot('payoff', {
    title: 'Survival tip', role: 'payoff', note: 'Shop front: you bow very deep, he bows a little. A stray cat jumps up and sits on the end of your scabbard. You stay down.',
    render(ctx, t) {
      const tt = tw(t);
      const Y = CAST.you, M = CAST.merchant;
      const land = 2.3, sit = tt >= land, tilt = sit ? K(tt, [[land, 30], [land + 0.15, 46], [land + 0.3, 40]]) : 0;
      const pY = { x: 590, y: 1040, s: 0.9, t, yaw: 2, bow: K(tt, [[0.2, 0], [0.7, 74, 'out']]), swordTilt: tilt };
      const PY = ST.pose('stand', Y.D, null, { hL: ST.handAt(Y.D, 1, -0.05, 0.82, 0.12), hR: ST.handAt(Y.D, -1, -0.05, 0.82, 0.14), kL: 'flat', kR: 'flat' });
      const end = Y.swordEnd(pY, PY);
      ST.cutCam(ctx, t, [
        [0, 1.6, [960, 580, 1.04], [940, 580, 1.1]], // wide: the deep bow, the slight bow
        [1.6, 2.3, [520, 820, 1.6]], // the cat gathers and jumps
        [2.3, 3.2, [end[0] + 120, end[1] - 30, 2.3], [end[0] + 120, end[1] - 30, 2.6]], // close: the cat on your sword
        [3.2, 4, [960, 600, 1.2], [960, 600, 1.04]], // pull back: hold
      ]);
      ST.setShopFront(ctx, t);
      M.draw(ctx, { x: 1330, y: 1044, s: 0.92, t, yaw: -2, bow: K(tt, [[0.3, 0], [0.6, 9]]), expr: S(t, [[0, 'smug'], [2.6, 'grin']]), pose: ST.pose('stand', M.D, null, ST.merchantAbacus(M.D)), abacus: Math.floor(tt * 4) });
      Y.draw(ctx, Object.assign({}, pY, { pose: PY, expr: S(t, [[0, 'scared'], [0.7, 'miserable'], [land, 'shock'], [land + 0.3, 'miserable']]), look: [0.3, 0.4] }));
      if (sit) ST.cat(ctx, { x: end[0] + 14, y: end[1] + 2, s: 0.62, t, mode: 'sit', look: [-0.5, 0], lid: 0.6 });
      else if (tt >= 1.8) {
        const u = (tt - 1.8) / (land - 1.8), tip = Y.swordEnd(Object.assign({}, pY, { swordTilt: 30 }), PY);
        ST.cat(ctx, { x: ST.lerp(200, tip[0] + 14, u), y: ST.lerp(1040, tip[1], u) - Math.sin(u * Math.PI) * 120, s: 0.62, t, mode: 'jump' });
      } else if (tt >= 0.4) ST.cat(ctx, { x: ST.lerp(-160, 200, (tt - 0.4) / 1.4), y: 1040, s: 0.62, t, mode: 'walk', ph: (tt * 2.4) % 1 });
    },
  });
})();

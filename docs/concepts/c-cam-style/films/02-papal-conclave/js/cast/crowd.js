/* Background figures: far-plane townsfolk and the other cardinals, simplified on purpose (flat plane colour, no hatching,
   dot eyes) so the hand-built cast reads in front. Still obeys the rig: arms are 2-bone and project through the same
   views, far arm behind the body. kinds: 0 woman+coif, 1 man+cap, 2 fat man+hood, 3 old woman+shawl, 4 lad+hat,
   5 cardinal (rust robe, skullcap). modes: stand | mutter | point | vote | sit | sitpoint | cover (cloth held over the head) | none. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const D = { sw: 30, sy: -250, sz: 0, l1a: 64, l2a: 60, hw: 16, hy: -120, l1l: 64, l2l: 58, elbowOut: 0.8, waist: [34, -160] };
  const BODY = [
    [-30, -262, 30, -262, 64, -40, -64, -40],
    [-28, -262, 28, -262, 32, -130, -32, -130],
    [-38, -262, 38, -262, 52, -150, 0, -120, -52, -150],
    [-34, -262, 34, -262, 56, -50, -56, -50],
    [-24, -262, 24, -262, 28, -136, -28, -136],
    [-32, -264, 32, -264, 46, -150, 54, -24, -54, -24, -46, -150],
  ];
  const HEAD = [[-22, 'coif'], [-20, 'cap'], [-26, 'hood'], [-22, 'shawl'], [-20, 'hat'], [-20, 'zucchetto']];
  const CARD = ['#7e3f2b', '#5c2c1d', '#94735c'];

  function pose(mode, tt, seed) {
    if (mode === 'sit') return ST.seat(D);
    if (mode === 'sitpoint') return ST.seat(D, ST.pointAt(D, -1, 0.1));
    if (mode === 'point') return ST.pose('point', D, null, { hR: ST.handAt(D, -1, 0.1, -0.1, 0.9), kR: 'point' });
    if (mode === 'vote') return ST.pose('stand', D, null, ST.ballotUp(D, -1));
    if (mode === 'cover') return ST.pose('armsUp', D, null, { hL: ST.handAt(D, 1, 0.1, -0.75, 0.25), hR: ST.handAt(D, -1, 0.1, -0.75, 0.25) });
    if (mode === 'mutter') { // a fist that shakes up and down on twos
      const up = Math.floor(tt * 4 + ST.hash(seed, 3) * 4) % 2 === 0;
      return ST.pose('stand', D, null, { hR: ST.handAt(D, -1, 0.15, up ? -0.1 : 0.15, 0.4), poleR: [-1, 0.4, -0.3] });
    }
    return ST.pose('stand', D);
  }

  // m: { x, y, s, kind, yaw, mode, col, colD, skin, seed, t }
  ST.crowdFigure = (ctx, m) => {
    const V = ST.view(m.yaw || 0), mode = m.mode || 'stand', tt = ST.twos(m.t || 0);
    if (mode === 'none') return;
    const P = pose(mode, tt, m.seed), J = ST.solve(V, D, P);
    const card = m.kind === 5, col = card ? CARD[0] : m.col, colD = card ? CARD[1] : m.colD, skin = m.skin || (card ? CARD[2] : '#8a7058'), lw = 5;
    const arm = (j, k) => {
      ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], [20, 16, 14], col, { lw, seed: m.seed + 1 });
      if (mode === 'vote' && k === 1) ST.slip(ctx, j.h[0], j.h[1] - 14, 0.2, m.seed + 9, 0.8);
      ST.blob(ctx, ST.ellipseRing(j.h[0], j.h[1] + 6, 10, 11, 6), skin, { lw: 4, seed: m.seed + 2 });
    };
    ST.figure(ctx, { x: m.x, y: m.y, s: m.s, lean: m.lean || 0 }, V.mir, () => {
      [[J.aL, 0], [J.aR, 1]].forEach(([j, k]) => { if (j.behind) arm(j, k); });
      [J.lL, J.lR].forEach((j) => ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], [20, 16, 14], colD, { lw, seed: m.seed + 3 }));
      [J.lL, J.lR].forEach((j) => ST.blob(ctx, ST.ellipseRing(j.h[0] + (V.v === 2 ? 8 : 0), j.h[1] + 4, V.v === 2 ? 18 : 12, 8, 6), C.INK, { lw: 0, seed: m.seed + 4 }));
      ctx.save();
      ctx.translate(0, J.bob);
      const body = BODY[m.kind].map((v, i) => (i % 2 === 0 && V.v === 2 ? v * 0.7 : v));
      ST.blob(ctx, body, col, { sharp: false, lw, seed: m.seed + 5, shade: [colD, -10, 4] });
      const [hx, kind] = HEAD[m.kind], hy = -290, fx = [0, 10, 18, 0][V.v];
      ST.blob(ctx, ST.ellipseRing(fx * 0.3, hy, 22, 28, 8), skin, { lw, seed: m.seed + 6 });
      if (V.v < 3) {
        ctx.fillStyle = C.INK;
        if (V.v < 2) ctx.fillRect(fx - 10, hy - 6, 4, 5);
        ctx.fillRect(fx + 6, hy - 6, 4, 5);
        ST.stroke(ctx, [fx + 2, hy - 2, fx + 4 + V.v * 4, hy + 8], { w: 3, seed: m.seed + 7 });
        if (mode === 'mutter' && Math.floor(tt * 6 + m.seed) % 2) ST.stroke(ctx, [fx - 4, hy + 14, fx + 8, hy + 12], { w: 4, seed: m.seed + 11, taper: false });
      }
      const hat = { coif: [hx - 4, hy + 4, hx, hy - 24, 4, hy - 34, 26, hy - 20, 24, hy + 2], cap: [hx, hy - 12, hx + 6, hy - 32, 20, hy - 34, 26, hy - 14], hood: [hx - 4, hy + 20, hx - 2, hy - 26, 6, hy - 38, 30, hy - 18, 28, hy + 18], shawl: [hx - 6, hy + 24, hx - 2, hy - 20, 8, hy - 34, 28, hy - 14, 30, hy + 26], hat: [hx - 10, hy - 18, 34, hy - 18, 18, hy - 46, 0, hy - 44], zucchetto: [hx, hy - 16, hx + 8, hy - 30, 4, hy - 34, 18, hy - 30, 22, hy - 16] }[kind];
      ST.blob(ctx, hat, card ? CARD[0] : colD, { lw: 4, seed: m.seed + 8 });
      ctx.restore();
      [[J.aL, 0], [J.aR, 1]].forEach(([j, k]) => { if (!j.behind) arm(j, k); });
      if (mode === 'cover') { // a cloth held up as a roof
        const mx = (J.aL.h[0] + J.aR.h[0]) / 2, top = Math.min(J.aL.h[1], J.aR.h[1]) - 24;
        ST.blob(ctx, [mx - 110, top + 40, mx - 70, top, mx + 70, top, mx + 110, top + 40, mx + 84, top + 60, mx - 84, top + 60], '#8f8a74', { lw: 4, seed: m.seed + 12, shade: ['#6f6a56', 0, 6] });
      }
    });
  };
})();

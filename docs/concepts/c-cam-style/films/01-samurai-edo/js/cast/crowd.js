/* Background townspeople: far-plane figures, simplified on purpose (flat plane colour, no hatching, dot eyes) so the
   hand-built cast reads in front. Still obeys the rig: arms are 2-bone and project through the same views, far arm
   behind the body. kinds: 0 townsman + head cloth, 1 woman + hair bun, 2 porter + straw cone hat, 3 old man + topknot,
   4 boy. modes: 'stand' | 'point'. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const D = { sw: 30, sy: -250, sz: 0, l1a: 64, l2a: 60, hw: 16, hy: -120, l1l: 64, l2l: 58, elbowOut: 0.8, waist: [34, -160] };
  const BODY = [
    [-30, -262, 30, -262, 36, -110, -36, -110], // short kimono
    [-26, -262, 26, -262, 34, -20, -34, -20], // long kimono to the ankles
    [-30, -262, 30, -262, 38, -130, -38, -130],
    [-30, -262, 30, -262, 40, -60, -40, -60],
    [-22, -250, 22, -250, 26, -140, -26, -140],
  ];
  const HATS = ['cloth', 'bun', 'cone', 'knot', 'none'];

  // m: { x, y, s, kind, yaw, mode, col, colD, skin, seed }
  ST.crowdFigure = (ctx, m) => {
    const V = ST.view(m.yaw || 0), mode = m.mode || 'stand';
    const P = mode === 'point' ? ST.pose('point', D, -1) : ST.pose('stand', D);
    const J = ST.solve(V, D, P), col = m.col, skin = m.skin || '#8a7058', lw = 5, k = m.kind === 4 ? 0.82 : 1;
    const arm = (j) => {
      ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], [22, 18, 14], col, { lw, seed: m.seed + 1 });
      ST.blob(ctx, ST.ellipseRing(j.h[0], j.h[1] + 6, 10, 11, 6), skin, { lw: 4, seed: m.seed + 2 });
    };
    ST.figure(ctx, { x: m.x, y: m.y, s: m.s * k }, V.mir, () => {
      [J.aL, J.aR].forEach((j) => { if (j.behind) arm(j); });
      [J.lL, J.lR].forEach((j) => ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], [18, 14, 12], skin, { lw, seed: m.seed + 3 }));
      [J.lL, J.lR].forEach((j) => ST.blob(ctx, ST.ellipseRing(j.h[0] + (V.v === 2 ? 8 : 0), j.h[1] + 4, V.v === 2 ? 18 : 12, 7, 6), '#8f7c4e', { lw: 3, seed: m.seed + 4 }));
      ctx.save();
      ctx.translate(0, J.bob);
      const body = BODY[m.kind].map((v, i) => (i % 2 === 0 && V.v === 2 ? v * 0.7 : v));
      ST.blob(ctx, body, col, { sharp: false, lw, seed: m.seed + 5, shade: [m.colD, -10, 4] });
      ST.stroke(ctx, [-30 * (V.v === 2 ? 0.7 : 1), -170, 30 * (V.v === 2 ? 0.7 : 1), -170], { w: 9, color: m.colD, seed: m.seed + 9, taper: false });
      const hy = -290, fx = [0, 10, 18, 0][V.v];
      ST.blob(ctx, ST.ellipseRing(fx * 0.3, hy, 22, 28, 8), skin, { lw, seed: m.seed + 6 });
      if (V.v < 3) {
        ctx.fillStyle = C.INK;
        if (V.v < 2) ctx.fillRect(fx - 10, hy - 6, 4, 5);
        ctx.fillRect(fx + 6, hy - 6, 4, 5);
        ST.stroke(ctx, [fx + 2, hy - 2, fx + 4 + V.v * 4, hy + 8], { w: 3, seed: m.seed + 7 });
      }
      const hat = HATS[m.kind];
      if (hat === 'cloth') ST.blob(ctx, [-24, hy - 6, -20, hy - 30, 6, hy - 36, 26, hy - 22, 24, hy - 8, 36, hy - 2], C.LINEN_D, { lw: 4, seed: m.seed + 8 });
      if (hat === 'bun') ST.blob(ctx, [-24, hy - 4, -20, hy - 30, 0, hy - 50, 20, hy - 30, 24, hy - 4], '#24201c', { lw: 4, seed: m.seed + 8 });
      if (hat === 'cone') ST.blob(ctx, [-50, hy - 6, 0, hy - 54, 50, hy - 6, 0, hy - 14], '#8f7c4e', { lw: 4, seed: m.seed + 8 });
      if (hat === 'knot') ST.tube(ctx, [-6, hy - 26, 4, hy - 40, 14, hy - 40], [10, 8, 6], '#cfc7b0', { lw: 4, seed: m.seed + 8 });
      ctx.restore();
      [J.aL, J.aR].forEach((j) => { if (!j.behind) arm(j); });
    });
  };
})();

/* Background figures: the row of mission-control engineers and the pad technician, simplified on purpose (flat plane
   colour, no hatching, dot eyes) so the hand-built cast reads in front. Still obeys the rig: arms are 2-bone and
   project through the same views, far arm behind the body. kinds: 0 engineer + tie, 1 engineer + headset,
   2 engineer + glasses, 3 pad technician (white coverall, cap). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const D = { sw: 30, sy: -250, sz: 0, l1a: 64, l2a: 60, hw: 16, hy: -120, l1l: 64, l2l: 58, elbowOut: 0.8, waist: [34, -160] };
  const BODY = [
    [-30, -262, 30, -262, 34, -140, -34, -140],
    [-34, -262, 34, -262, 40, -140, -40, -140],
    [-28, -262, 28, -262, 30, -140, -30, -140],
    [-32, -262, 32, -262, 36, -130, -36, -130],
  ];

  // m: { x, y, s, kind, yaw, mode: 'stand'|'work', ph, col, colD, skin, seed }
  ST.crowdFigure = (ctx, m) => {
    const V = ST.view(m.yaw || 0), mode = m.mode || 'stand', ph = m.ph || 0;
    const P = mode === 'work'
      ? ST.pose('stand', D, null, { hL: ST.handAt(D, 1, -0.1, 0.55, 0.75 + 0.06 * Math.sin(ph * 6.28)), hR: ST.handAt(D, -1, -0.1, 0.6, 0.75 - 0.06 * Math.sin(ph * 6.28)) })
      : ST.pose('stand', D);
    const J = ST.solve(V, D, P), col = m.col, skin = m.skin || '#8a7058', lw = 5;
    const arm = (j) => {
      ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], [20, 16, 14], col, { lw, seed: m.seed + 1 });
      ST.blob(ctx, ST.ellipseRing(j.h[0], j.h[1] + 6, 10, 11, 6), m.kind === 3 ? ST.GLOVE : skin, { lw: 4, seed: m.seed + 2 });
    };
    ST.figure(ctx, { x: m.x, y: m.y, s: m.s, lean: m.lean || 0 }, V.mir, () => {
      [J.aL, J.aR].forEach((j) => { if (j.behind) arm(j); });
      [J.lL, J.lR].forEach((j) => ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], [20, 16, 14], m.colD, { lw, seed: m.seed + 3 }));
      [J.lL, J.lR].forEach((j) => ST.blob(ctx, ST.ellipseRing(j.h[0] + (V.v === 2 ? 8 : 0), j.h[1] + 4, V.v === 2 ? 18 : 12, 8, 6), C.INK, { lw: 0, seed: m.seed + 4 }));
      ctx.save();
      ctx.translate(0, J.bob);
      const body = BODY[m.kind].map((v, i) => (i % 2 === 0 && V.v === 2 ? v * 0.7 : v));
      ST.blob(ctx, body, col, { sharp: false, lw, seed: m.seed + 5, shade: [m.colD, -10, 4] });
      if (m.kind < 3 && V.v < 3) ST.stroke(ctx, [[0, 12, 22][V.v], -258, [0, 12, 22][V.v] + 2, -190], { w: 5, color: C.BLACK, seed: m.seed + 6, taper: false }); // tie
      const hy = -290, fx = [0, 10, 18, 0][V.v];
      ST.blob(ctx, ST.ellipseRing(fx * 0.3, hy, 22, 28, 8), skin, { lw, seed: m.seed + 7 });
      if (V.v < 3) {
        ctx.fillStyle = C.INK;
        if (V.v < 2) ctx.fillRect(fx - 10, hy - 6, 4, 5);
        ctx.fillRect(fx + 6, hy - 6, 4, 5);
        ST.stroke(ctx, [fx + 2, hy - 2, fx + 4 + V.v * 4, hy + 8], { w: 3, seed: m.seed + 8 });
        if (m.kind === 2) ST.stroke(ctx, [fx - 14, hy - 4, fx + 14, hy - 4], { w: 5, color: C.INK, seed: m.seed + 9, taper: false });
      }
      const hat = m.kind === 3 ? [-24, hy - 8, -20, hy - 30, 4, hy - 38, 24, hy - 26, 34, hy - 10] : [-22, hy - 6, -20, hy - 26, 2, hy - 34, 22, hy - 26, 24, hy - 8];
      ST.blob(ctx, hat, m.kind === 3 ? C.LINEN : m.colD, { lw: 4, seed: m.seed + 10 });
      if (m.kind === 1) ST.stroke(ctx, [-22, hy, -20, hy - 32, 22, hy - 32, 22, hy], { w: 5, color: C.BLACK, seed: m.seed + 11, taper: false });
      ctx.restore();
      [J.aL, J.aR].forEach((j) => { if (!j.behind) arm(j); });
    });
  };
})();

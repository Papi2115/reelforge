/* Background figures: retirees on the hotel porch, bus passengers, the judge and the bailiff, simplified on purpose
   (flat plane colour, no hatching, dot eyes) so the hand-built cast reads in front. Still on the rig: 2-bone arms that
   project through the views, far arm behind the body. kinds: 0 retired lady in a housecoat + curlers, 1 retired man in
   a cap, shorts and knee socks, 2 man in a loud shirt, 3 judge (black robe), 4 bailiff (tan uniform, cap), 5 woman with
   big hair. modes: stand | sit | knit | read | fan | point | stare | none. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const D = { sw: 30, sy: -250, sz: 0, l1a: 64, l2a: 60, hw: 16, hy: -120, l1l: 64, l2l: 58, elbowOut: 0.8, waist: [34, -160] };
  const BODY = [
    [-30, -262, 30, -262, 46, -120, 40, -60, -40, -60, -46, -120],
    [-30, -262, 30, -262, 34, -150, -34, -150],
    [-34, -262, 34, -262, 38, -140, -38, -140],
    [-34, -264, 34, -264, 48, -150, 56, -30, -56, -30, -48, -150],
    [-32, -262, 32, -262, 34, -136, -34, -136],
    [-28, -262, 28, -262, 44, -90, -44, -90],
  ];
  const sitPose = (over) => Object.assign({ hL: ST.handAt(D, 1, -0.15, 0.62, 0.4), hR: ST.handAt(D, -1, -0.15, 0.62, 0.4), fL: ST.footAt(D, 1, 0.06, 0, 0.42), fR: ST.footAt(D, -1, 0.06, 0, 0.4), bob: 0.4, poleL: [1, 0.4, -0.5], poleR: [-1, 0.4, -0.5] }, over || {});
  function pose(mode, tt, seed) {
    if (mode === 'sit' || mode === 'read' || mode === 'stare') return sitPose();
    if (mode === 'knit') { const k = Math.floor(tt * 6 + ST.hash(seed, 2) * 6) % 2; return sitPose({ hL: ST.handAt(D, 1, -0.3, 0.3 + k * 0.05, 0.6), hR: ST.handAt(D, -1, -0.3, 0.35 - k * 0.05, 0.6) }); }
    if (mode === 'fan') { const k = Math.floor(tt * 6 + ST.hash(seed, 2) * 6) % 2; return sitPose({ hR: ST.handAt(D, -1, 0.45, -0.05 + k * 0.12, 0.3), poleR: [-1, 0.3, -0.3] }); }
    if (mode === 'point') return ST.pose('stand', D, null, { hR: ST.handAt(D, -1, 0.1, -0.1, 0.9), kR: 'point' });
    return ST.pose('stand', D);
  }
  const SKINS = ['#a8907a', '#9a7a62', '#b39a80', '#8a6a52'];

  // m: { x, y, s, kind, yaw, mode, col, colD, skin, seed, t, lean }
  ST.crowdFigure = (ctx, m) => {
    const V = ST.view(m.yaw || 0), mode = m.mode || 'stand', tt = ST.twos(m.t || 0);
    if (mode === 'none') return;
    const P = pose(mode, tt, m.seed), J = ST.solve(V, D, P);
    const col = m.col, colD = m.colD, skin = m.skin || SKINS[m.seed % 4], lw = 5;
    const arm = (j) => {
      ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], m.kind === 1 || m.kind === 2 ? [20, 14, 12] : [20, 16, 14], m.kind === 1 ? skin : col, { lw, seed: m.seed + 1 });
      ST.blob(ctx, ST.ellipseRing(j.h[0], j.h[1] + 6, 10, 11, 6), skin, { lw: 4, seed: m.seed + 2 });
    };
    ST.figure(ctx, { x: m.x, y: m.y, s: m.s, lean: m.lean || 0 }, V.mir, () => {
      [J.aL, J.aR].forEach((j) => { if (j.behind) arm(j); });
      const legCol = m.kind === 0 || m.kind === 5 ? skin : m.kind === 1 ? skin : colD;
      [J.lL, J.lR].forEach((j) => {
        ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], [20, 16, 14], legCol, { lw, seed: m.seed + 3 });
        if (m.kind === 1) ST.tube(ctx, [(j.e[0] + j.h[0]) / 2, (j.e[1] + j.h[1]) / 2 - 6, j.h[0], j.h[1]], [17, 15], '#cfc7ab', { lw: 4, seed: m.seed + 12 }); // knee socks
      });
      [J.lL, J.lR].forEach((j) => ST.blob(ctx, ST.ellipseRing(j.h[0] + (V.v === 2 ? 8 : 0), j.h[1] + 4, V.v === 2 ? 18 : 12, 8, 6), m.kind === 1 ? '#c9c0a2' : C.INK, { lw: m.kind === 1 ? 3 : 0, seed: m.seed + 4 }));
      ctx.save();
      ctx.translate(0, J.bob);
      const body = BODY[m.kind].map((v, i) => (i % 2 === 0 && V.v === 2 ? v * 0.7 : v));
      ST.blob(ctx, body, col, { lw, seed: m.seed + 5, shade: [colD, -10, 4] });
      if (m.kind === 1) ST.blob(ctx, [-36, -156, 36, -156, 40, -110, -40, -110], '#7d7a62', { lw: 4, seed: m.seed + 13 }); // shorts
      if (m.kind === 4 && V.v < 3) ST.blob(ctx, ST.ellipseRing(18, -230, 7, 8, 6), C.GOLD_D, { lw: 3, seed: m.seed + 14 }); // badge
      const hy = -290, fx = [0, 10, 18, 0][V.v];
      if (m.kind === 5) ST.blob(ctx, ST.ellipseRing(fx * 0.2 - 4, hy - 8, 40, 38, 10), colD, { lw: 4, seed: m.seed + 15 }); // big hair
      ST.blob(ctx, ST.ellipseRing(fx * 0.3, hy, 22, 28, 8), skin, { lw, seed: m.seed + 6 });
      if (V.v < 3) {
        ctx.fillStyle = C.INK;
        if (V.v < 2) ctx.fillRect(fx - 10, hy - 6, 4, 5);
        ctx.fillRect(fx + 6, hy - 6, 4, 5);
        ST.stroke(ctx, [fx + 2, hy - 2, fx + 4 + V.v * 4, hy + 8], { w: 3, seed: m.seed + 7 });
        const mouthY = hy + 16;
        if (mode === 'stare') ST.stroke(ctx, [fx - 6, mouthY + 2, fx + 8, mouthY], { w: 3.5, seed: m.seed + 8, taper: false });
        else ST.stroke(ctx, [fx - 6, mouthY, fx + 2, mouthY + 3, fx + 8, mouthY], { w: 3, seed: m.seed + 8 });
        if (m.kind === 0 || m.kind === 1) ST.stroke(ctx, [fx - 15, hy - 4, fx + 15, hy - 4], { w: 3, color: '#4b463a', seed: m.seed + 9, taper: false }); // glasses
      }
      if (m.kind === 0) for (let i = 0; i < 4; i++) ST.blob(ctx, ST.ellipseRing(-18 + i * 12, hy - 26 + Math.abs(i - 1.5) * 3, 6, 7, 6), i % 2 ? '#a7a08a' : '#8a96a0', { lw: 3, seed: m.seed + 16 + i }); // curlers
      else if (m.kind === 1 || m.kind === 4) ST.blob(ctx, [-24, hy - 10, -20, hy - 34, 18, hy - 36, 24, hy - 12, 40, hy - 8, 20, hy - 14], m.kind === 4 ? '#5d5236' : '#c9bf9c', { lw: 4, seed: m.seed + 10 }); // cap
      else if (m.kind === 3) ST.blob(ctx, [-22, hy - 8, -18, hy - 28, 0, hy - 34, 20, hy - 28, 22, hy - 8], '#bfb9a6', { lw: 3, seed: m.seed + 10 }); // grey hair
      else if (m.kind === 2) ST.blob(ctx, [-22, hy - 8, -20, hy - 30, 4, hy - 34, 22, hy - 26, 22, hy - 8], '#3a2a1c', { lw: 3, seed: m.seed + 10 });
      ctx.restore();
      [J.aL, J.aR].forEach((j) => { if (!j.behind) arm(j); });
      if (mode === 'read' && V.v < 3) ST.newspaper(ctx, (J.aL.h[0] + J.aR.h[0]) / 2, J.aL.h[1] - 30, 120, 0, m.seed + 20);
      if (mode === 'knit' && V.v < 3) { ST.blob(ctx, ST.ellipseRing((J.aL.h[0] + J.aR.h[0]) / 2, J.aL.h[1] + 22, 30, 16, 8), C.RUST_D, { lw: 4, seed: m.seed + 21 }); }
      if (mode === 'fan' && V.v < 3) ST.blob(ctx, [J.aR.h[0], J.aR.h[1], J.aR.h[0] - 30, J.aR.h[1] - 44, J.aR.h[0] + 30, J.aR.h[1] - 44], '#c9bf9c', { lw: 3, seed: m.seed + 22 });
    });
  };
})();

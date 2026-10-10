/* Main 3 - THE ORBITING ASTRONAUT (small role). A soft pear: narrow shoulders, round belly, short arms. Round pudgy
   face with a double chin, a bald dome with a long comb-over whose strands float up in zero gravity, a droopy
   walrus moustache, a red bulb nose with broken veins, sad drooping brows, double bags, a wart on the cheek.
   Beige in-flight coverall with zip, chest pockets, a pen, a ketchup stain. Talks to a toy bear, eats a sandwich
   alone. Default: sad. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_RUDDY, SKIN_D = C.SKIN_RUDDY_D, HAIR = '#7e6a4c', CLOTH = '#968b68', CLOTH_D = '#6e6549', SEED = 410;
  const D = { sw: 52, sy: -520, sz: 10, l1a: 106, l2a: 100, hw: 32, hy: -320, l1l: 156, l2l: 140, elbowOut: 0.7, top: -800, waist: [80, -390], hsz: 36, head: { x: [0, 16, 36, 0], top: -800, bottom: -560, hw: 96 } };
  const NECK = [[0, -540, 0, -578], [8, -538, 14, -576], [16, -534, 32, -572], [0, -540, 0, -578]];

  const COVER = [
    [-26, -556, -64, -544, -74, -500, -80, -440, -96, -380, -94, -330, -62, -310, 0, -306, 62, -310, 94, -330, 96, -380, 80, -440, 74, -500, 64, -544, 26, -556],
    [-16, -558, -58, -546, -70, -500, -76, -440, -88, -380, -86, -330, -56, -310, 14, -306, 70, -312, 100, -340, 104, -392, 92, -446, 78, -500, 58, -546, 22, -558],
    [-4, -560, -36, -548, -48, -500, -46, -430, -50, -370, -46, -326, -24, -310, 50, -310, 80, -340, 90, -390, 80, -440, 56, -500, 42, -546, 18, -560],
    [-26, -556, -66, -544, -76, -500, -82, -440, -96, -380, -94, -330, -62, -310, 0, -308, 62, -310, 94, -330, 96, -380, 82, -440, 76, -500, 66, -544, 26, -556],
  ];

  function coverall(ctx, v) {
    ST.blob(ctx, COVER[v], CLOTH, { lw: 7, seed: SEED + v, shade: [CLOTH_D, -20, 8], mottle: ['rgba(70,60,30,0.3)', 5, 18], hatch: { c: 'rgba(30,26,12,0.5)', n: 8, len: 38, gap: 7, k: 3, ang: -50 } });
    if (v === 3) { ST.stroke(ctx, [-60, -380, 0, -364, 60, -380], { w: 4, seed: SEED + 5 }); ST.stroke(ctx, [0, -548, 2, -460, -2, -370], { w: 3.5, seed: SEED + 6 }); return; }
    const x = [0, 18, 52][v], k = [1, 0.8, 0.35][v];
    ST.stroke(ctx, [x, -552, x + 4, -440, x, -312], { w: 4.5, color: C.STONE_D, seed: SEED + 7, taper: false }); // zip
    if (v < 2) [-1, 1].forEach((s, i) => {
      ST.rect(ctx, x + s * 44 * k - 18 * k, -500, 36 * k, 40, CLOTH_D, { seed: SEED + 8 + i, lw: 4, amp: 1.5 });
      if (s < 0) ST.tube(ctx, [x - 40 * k, -508, x - 38 * k, -470], [6, 6], C.BLACK, { lw: 3, seed: SEED + 10 });
    });
    ST.blob(ctx, [x + 20 * k, -420, x + 34 * k, -426, x + 38 * k, -404, x + 24 * k, -398], C.RUST_D, { lw: 0, seed: SEED + 11 }); // ketchup
    ST.stroke(ctx, [x - 50 * k, -360, x - 10 * k, -348, x + 40 * k, -362], { w: 3.5, seed: SEED + 12 }); // belly fold
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -16, 10], mottle: ['#9a6650', 6, 12], hatch: { c: 'rgba(60,24,12,0.4)', n: 4, len: 18, gap: 5, k: 3, ang: 70 } };
  // comb-over strands, floating up: they wave on twos
  function strands(ctx, t, x0, x1, top) {
    const w = Math.floor(ST.twos(t) * 4) % 2 ? 6 : -6;
    for (let i = 0; i < 5; i++) {
      const x = x0 + ((x1 - x0) * i) / 4;
      ST.stroke(ctx, [x, top + 8, x + 6 + w, top - 30, x - 4 + w * 1.5, top - 62 - i * 4], { w: 4.5, color: HAIR, seed: SEED + 20 + i, taper: false });
    }
  }
  function tash(ctx, x, y, w) {
    ST.blob(ctx, [x - w, y + 18, x - w * 0.8, y - 2, x, y - 8, x + w * 0.8, y - 2, x + w, y + 18, x + w * 0.5, y + 8, x, y + 4, x - w * 0.5, y + 8], HAIR, { lw: 5, seed: SEED + 26, hatch: { c: 'rgba(30,20,10,0.6)', n: 3, len: 12, gap: 4, k: 3, ang: 80 } });
  }
  function nose(ctx, x, y, r) {
    ST.blob(ctx, ST.ellipseRing(x, y, r, r * 0.86, 9), '#b4664f', { lw: 6, seed: SEED + 27, shade: [SKIN_D, -5, 4], patch: ['#c98a70', 3, -5, 0.35] });
    ST.stroke(ctx, [x - r * 0.6, y + 2, x - r * 0.25, y - 1, x - r * 0.1, y - r * 0.4], { w: 2, color: C.RED_D, seed: SEED + 28, taper: false }); // veins
    ST.stroke(ctx, [x + r * 0.15, y + r * 0.35, x + r * 0.45, y + r * 0.1], { w: 2, color: C.RED_D, seed: SEED + 29, taper: false });
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 12 * a[2], 13, f, { skin: SKIN, seed: SEED + 30, lw: 5, side: 0, bags: 2 });
    ST.brow(ctx, a[0], a[1] - 22, 28 * a[2], -1, f, { u: 18, thick: 9, color: HAIR, seed: SEED + 31, droop: 6 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 12 * b[2], 13, f, { skin: SKIN, seed: SEED + 32, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, b[0], b[1] - 22, 28 * b[2], 1, f, { u: 18, thick: 9, color: HAIR, seed: SEED + 33, droop: 6 });
  }
  function headFront(ctx, f, t) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-70, -50, -72, -100, -60, -140, -24, -162, 24, -162, 60, -140, 72, -100, 70, -50, 54, -10 + jaw, 24, 10 + jaw, -24, 10 + jaw, -54, -10 + jaw], SKIN, Object.assign({ seed: SEED + 34 }, FACE));
    ST.stroke(ctx, [-36, 4 + jaw, 0, 18 + jaw, 36, 4 + jaw], { w: 4, seed: SEED + 35 }); // double chin
    [-1, 1].forEach((s, i) => ST.blob(ctx, [s * 64, -104, s * 76, -112, s * 82, -84, s * 70, -66, s * 62, -76], HAIR, { lw: 4, seed: SEED + 36 + i }));
    strands(ctx, t, -30, 30, -150);
    eyes(ctx, f, [-26, -90, 1], [26, -90, 1]);
    ST.mouth(ctx, 0, -28, 40, f, { open: 26, teeth: 'few', seed: SEED + 38, lw: 5 });
    tash(ctx, 0, -46, 34);
    nose(ctx, 0, -62, 18);
    ST.wart(ctx, 46, -56, 4.5, '#7f4a3a', SEED + 39, true);
  }
  function head34(ctx, f, t) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-62, -50, -66, -100, -54, -142, -16, -164, 32, -160, 66, -136, 80, -100, 80, -50, 66, -10 + jaw, 34, 10 + jaw, -14, 10 + jaw, -46, -10 + jaw], SKIN, Object.assign({ seed: SEED + 40 }, FACE));
    ST.stroke(ctx, [-22, 4 + jaw, 14, 18 + jaw, 50, 4 + jaw], { w: 4, seed: SEED + 41 });
    ST.blob(ctx, [-58, -104, -70, -112, -76, -84, -64, -66, -56, -76], HAIR, { lw: 4, seed: SEED + 42 });
    strands(ctx, t, -16, 40, -152);
    eyes(ctx, f, [-6, -90, 1], [46, -90, 0.66]);
    ST.mouth(ctx, 24, -28, 36, f, { open: 24, teeth: 'few', seed: SEED + 43, lw: 5 });
    tash(ctx, 24, -46, 30);
    nose(ctx, 30, -62, 17);
    ST.wart(ctx, -30, -56, 4.5, '#7f4a3a', SEED + 44, true);
  }
  function headProfile(ctx, f, t) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-50, -20, -66, -70, -62, -126, -30, -160, 14, -162, 46, -140, 58, -106, 60, -80, 58, -50, 56, -20 + jaw, 40, 6 + jaw, 10, 16 + jaw, -20, 6], SKIN, Object.assign({ seed: SEED + 45 }, FACE));
    ST.blob(ctx, [-62, -64, -66, -110, -42, -110, -30, -70], HAIR, { lw: 4, seed: SEED + 46 });
    strands(ctx, t, -20, 20, -154);
    ST.blob(ctx, ST.ellipseRing(-14, -84, 14, 20, 8), SKIN, { lw: 5, seed: SEED + 47, shade: [SKIN_D, -4, 2], inner: () => ST.stroke(ctx, [-18, -94, -8, -88, -12, -74], { w: 3, seed: SEED + 55 }) }); // ear
    eyes(ctx, f, [34, -90, 0.72], null);
    ST.mouth(ctx, 50, -28, 16, f, { open: 22, teeth: 'few', seed: SEED + 48, lw: 5 });
    tash(ctx, 54, -46, 18);
    nose(ctx, 66, -62, 16);
  }
  function headBack(ctx, f, t) {
    ST.blob(ctx, [-70, -40, -72, -100, -60, -140, -24, -162, 24, -162, 60, -140, 72, -100, 70, -40, 40, -6, 0, 0, -40, -6], SKIN, Object.assign({ seed: SEED + 49 }, FACE));
    ST.blob(ctx, [-72, -40, -76, -96, -60, -86, -40, -56, 0, -46, 40, -56, 60, -86, 76, -96, 72, -40, 40, -8, 0, -2, -40, -8], HAIR, { lw: 0, seed: SEED + 50, hatch: { c: 'rgba(30,20,10,0.55)', n: 8, len: 14, gap: 4, k: 3, ang: 85 } });
    strands(ctx, t, -24, 24, -150);
    ST.stroke(ctx, [-30, -2, 0, 6, 30, -2], { w: 4, seed: SEED + 51 }); // neck roll
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  const ARM = { cloth: CLOTH, clothD: CLOTH_D, w: [36, 32, 28], bare: 0.8, skin: SKIN, skinD: SKIN_D, hsz: D.hsz, lw: 6, cuff: CLOTH_D, hatch: { c: 'rgba(30,26,12,0.45)', n: 3, len: 22, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: CLOTH, clothD: CLOTH_D, w: [46, 36, 30], shoe: C.BROWN, shoeD: C.BROWN_D, len: 62, sw: 30, lw: 6, splay: 0.3 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, sandwich (bite 0|1, in the right
  //    hand), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'sad', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, p.sandwich !== undefined ? 'grip' : P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      if (sd === 2 && p.sandwich !== undefined) { const g = ST.palm(j, D.hsz); ST.sandwich(ctx, g[0], g[1] - 6, -10, SEED + 60, p.sandwich); }
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 80 + sd }));
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 90 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      ST.tube(ctx, [n[0], n[1] + 6, n[2], n[3] + 16 + (p.headDy || 0)], [60, 56], SKIN, { lw: 6, seed: SEED + 52, shade: [SKIN_D, -8, 0] });
      coverall(ctx, V.v);
      if (V.v < 3) ST.blob(ctx, [n[0] - 26 + V.v * 6, n[1] - 14, n[0] + V.v * 8, n[1] + 14, n[0] + 26 + V.v * 10, n[1] - 14], CLOTH_D, { lw: 5, seed: SEED + 53 }); // collar
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.1 : 1.1, 1.1);
      HEADS[H.V.v](ctx, f, p.t || 0);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  // weightless: knees drawn up, feet drifting, hands loose
  ST.orbiterFloat = (Dd, ph) => {
    const s = Math.sin(ph * Math.PI * 2);
    return { hL: ST.handAt(Dd, 1, 0.25, 0.45 + 0.05 * s, 0.35), hR: ST.handAt(Dd, -1, 0.1, 0.3, 0.6), kL: 'open', poleL: [1, 0.2, -0.4], poleR: [-1, 0.6, -0.4], fL: ST.footAt(Dd, 1, 0.1, 0.28 + 0.04 * s, 0.22), fR: ST.footAt(Dd, -1, 0.06, 0.18 - 0.04 * s, 0.1) };
  };
  ST.CAST.orbiter = { name: 'The Orbiting Astronaut', D, draw, extraRow: ['floating', (Dd) => ({ sandwich: 1, pose: ST.orbiterFloat(Dd, 0.25) })] };
})();

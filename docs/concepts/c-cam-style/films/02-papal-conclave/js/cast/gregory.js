/* Gregory, the chosen one (small role). Back from a long journey and late for everything: a short round egg in a
   dusty grey-blue travel cloak with the hood down, a scrip strap across the chest, a wide pilgrim hat with a shell
   badge, a walking stick. Big moon head: tiny button eyes set far apart, thin brows that sit high (always mildly
   puzzled), a round button nose, rosy cheeks, a gap tooth, a mole, a double chin. As pope (p.pope) the hat becomes
   a tall white tiara with one gold band (the accent). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_SALLOW, SKIN_D = C.SKIN_SALLOW_D, CLOAK = C.GREYBLUE, CLOAK_D = C.GREYBLUE_D, SEED = 1400;
  const D = { sw: 64, sy: -384, sz: 0, l1a: 84, l2a: 78, hw: 32, hy: -180, l1l: 96, l2l: 86, elbowOut: 0.8, top: -640, waist: [92, -260], head: { x: [0, 16, 30, 0], top: -640, bottom: -400, hw: 104 } };
  const NECK = [[0, -404], [10, -404], [22, -400], [0, -404]];

  const CLOAKS = [
    [-30, -404, -70, -392, -96, -350, -112, -280, -116, -200, -104, -120, -84, -70, 84, -70, 104, -120, 116, -200, 112, -280, 96, -350, 70, -392, 30, -404],
    [-22, -406, -64, -394, -88, -352, -102, -280, -104, -200, -94, -120, -76, -70, 92, -70, 114, -120, 126, -200, 120, -280, 100, -350, 64, -394, 22, -406],
    [-14, -410, -52, -396, -70, -350, -76, -280, -74, -200, -66, -120, -56, -70, 82, -70, 100, -120, 108, -200, 98, -290, 74, -360, 40, -400],
    [-30, -404, -70, -392, -96, -350, -112, -280, -116, -200, -104, -120, -84, -70, 84, -70, 104, -120, 116, -200, 112, -280, 96, -350, 70, -392, 30, -404],
  ];
  const STRAP = [[-70, -390, 0, -300, 70, -230], [-56, -392, 20, -300, 96, -236], [-30, -400, 20, -320, 60, -240], [70, -390, 0, -300, -70, -230]];
  const SPLIT = [0, 24, 84, null]; // the cloak's front opening

  function body(ctx, v, pope) {
    ST.blob(ctx, CLOAKS[v], CLOAK, { lw: 8, seed: SEED + v, shade: [CLOAK_D, -24, 8], mottle: ['#4a575e', 5, 22], hatch: { c: 'rgba(16,20,24,0.55)', n: 9, len: 46, gap: 8, k: 3, ang: 80, bend: 0.06 } });
    ST.blob(ctx, [CLOAKS[v][12], -110, CLOAKS[v][14], -76, CLOAKS[v][16], -76, CLOAKS[v][18], -110], 'rgba(90,70,40,0.4)', { lw: 0, seed: SEED + 4 }); // road dust at the hem
    const sx = SPLIT[v];
    if (sx !== null) ST.stroke(ctx, [sx, -330, sx + (v === 2 ? 6 : 2), -200, sx, -76], { w: 4, seed: SEED + 5 });
    if (pope) {
      const m = [[-74, -400, 74, -400, 90, -330, 0, -300, -90, -330], [-60, -402, 80, -400, 100, -330, 20, -300, -76, -330], [-40, -406, 70, -400, 92, -340, 20, -310, -54, -340], [-74, -400, 74, -400, 90, -330, 0, -310, -90, -330]][v];
      ST.blob(ctx, m, C.LINEN, { lw: 7, seed: SEED + 6, shade: [C.LINEN_D, -10, 6], hatch: { c: 'rgba(60,50,30,0.45)', n: 4, len: 24, gap: 6, k: 3, ang: 20 } });
      return;
    }
    ST.stroke(ctx, STRAP[v], { w: 14, color: C.BROWN, seed: SEED + 7, taper: false });
    ST.stroke(ctx, STRAP[v], { w: 3, color: C.BROWN_D, seed: SEED + 8, taper: false });
    if (v === 3) ST.blob(ctx, [-60, -400, 60, -400, 50, -330, 0, -310, -50, -330], CLOAK_D, { lw: 6, seed: SEED + 9, hatch: { c: 'rgba(16,20,24,0.55)', n: 4, len: 24, gap: 6, k: 3, ang: 70 } }); // hood down
    else ST.blob(ctx, [-60, -404, 0, -390, 60, -404, 50, -380, 0, -370, -50, -380], CLOAK_D, { lw: 5, seed: SEED + 10 });
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -16, 8], mottle: ['#a5916a', 5, 12], hatch: { c: 'rgba(60,50,30,0.4)', n: 3, len: 16, gap: 5, k: 3, ang: 75 } };
  function cheek(ctx, x, y) { ST.blob(ctx, ST.ellipseRing(x, y, 16, 10, 7), 'rgba(170,80,60,0.35)', { lw: 0, seed: x | 0 }); }
  function hat(ctx, cx, rx, pope, seed, back) {
    if (pope) {
      ST.blob(ctx, [cx - 50, -128, cx - 34, -220, cx - 4, -262, cx + 28, -222, cx + 50, -128], C.LINEN, { lw: 7, seed, shade: [C.LINEN_D, -10, 6], hatch: { c: 'rgba(60,50,30,0.45)', n: 4, len: 30, gap: 6, k: 3, ang: 80 } });
      ST.rough(ctx, [cx - 50, -150, cx + 50, -150, cx + 48, -130, cx - 48, -130], C.GOLD, { seed: seed + 1, lw: 5, amp: 1.5, shade: [C.GOLD_D, 0, 4] });
      ST.blob(ctx, ST.ellipseRing(cx - 4, -268, 9, 9, 7), C.GOLD, { lw: 5, seed: seed + 2 });
      return;
    }
    ST.blob(ctx, [cx - 58, -132, cx - 52, -184, cx, -200, cx + 52, -184, cx + 58, -132], C.BROWN, { lw: 7, seed, shade: [C.BROWN_D, -10, 6], hatch: { c: 'rgba(20,14,8,0.55)', n: 4, len: 24, gap: 6, k: 3, ang: 70 } });
    ST.blob(ctx, ST.ellipseRing(cx, -134, rx, 22, 14), C.BROWN, { lw: 7, seed: seed + 3, shade: [C.BROWN_D, 0, 8], light: ['#6e5a48', 0, -5] });
    if (rx > 100 && !back) { // the scallop-shell badge, facing us
      ST.blob(ctx, [cx - 14, -150, cx, -172, cx + 14, -150, cx, -144], C.LINEN, { lw: 4, seed: seed + 4 });
      ST.stroke(ctx, [cx, -168, cx, -150], { w: 2, seed: seed + 5, taper: false });
    }
  }
  function headFront(ctx, f, pope) {
    const jaw = f.jaw * 14;
    [[-78, -1], [78, 1]].forEach(([x, s], i) => ST.blob(ctx, [x, -60, x + s * 16, -92, x + s * 20, -66, x + s * 10, -44], SKIN, { lw: 5, seed: SEED + 20 + i, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-70, -10, -80, -60, -76, -110, -56, -146, -20, -162, 20, -162, 56, -146, 76, -110, 80, -60, 70, -10, 40, 12 + jaw, 0, 18 + jaw, -40, 12 + jaw], SKIN, Object.assign({ seed: SEED + 22 }, FACE));
    cheek(ctx, -46, -46);
    cheek(ctx, 46, -46);
    ST.stubble(ctx, [-56, -30, -40, 8 + jaw, 0, 16 + jaw, 40, 8 + jaw, 56, -30, 20, -20, -20, -20], SEED + 23, 22, 'rgba(70,60,40,0.4)');
    ST.eye(ctx, -32, -86, 9, 10, f, { skin: SKIN, seed: SEED + 24, lw: 5, side: 0, bags: 2 });
    ST.eye(ctx, 32, -86, 9, 10, f, { skin: SKIN, seed: SEED + 25, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, -32, -114, 22, -1, f, { u: 14, thick: 7, color: '#6a5a40', seed: SEED + 26, droop: -6 });
    ST.brow(ctx, 32, -114, 22, 1, f, { u: 14, thick: 7, color: '#6a5a40', seed: SEED + 27, droop: -6 });
    ST.mouth(ctx, 0, -26, 26, f, { open: 22, teeth: 'gap', seed: SEED + 28, lw: 5 });
    ST.stroke(ctx, [-30, 10 + jaw, 0, 20 + jaw, 30, 10 + jaw], { w: 4, seed: SEED + 29 }); // double chin
    ST.blob(ctx, ST.ellipseRing(0, -58, 14, 12, 8), SKIN, { lw: 6, seed: SEED + 30, shade: [SKIN_D, -4, 4], patch: ['#c6b38c', 3, -4, 0.35] });
    ST.wart(ctx, 44, -24, 3.5, '#6f5a3a', SEED + 31);
    hat(ctx, 0, 118, pope, SEED + 32);
  }
  function head34(ctx, f, pope) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-66, -60, -82, -92, -84, -66, -74, -44], SKIN, { lw: 5, seed: SEED + 33, shade: [SKIN_D, 4, 2] });
    ST.blob(ctx, [-64, -10, -76, -60, -74, -110, -56, -146, -14, -162, 26, -162, 60, -144, 78, -110, 84, -70, 78, -36, 66, -8, 36, 12 + jaw, 4, 18 + jaw, -34, 10 + jaw], SKIN, Object.assign({ seed: SEED + 34 }, FACE));
    cheek(ctx, -28, -46);
    cheek(ctx, 64, -48);
    ST.stubble(ctx, [-44, -30, -28, 8 + jaw, 14, 16 + jaw, 56, 8 + jaw, 70, -30, 34, -20, -6, -20], SEED + 35, 22, 'rgba(70,60,40,0.4)');
    ST.eye(ctx, -12, -86, 9, 10, f, { skin: SKIN, seed: SEED + 36, lw: 5, side: 0, bags: 2 });
    ST.eye(ctx, 52, -86, 6, 10, f, { skin: SKIN, seed: SEED + 37, lw: 5, side: 1, bags: 1 });
    ST.brow(ctx, -12, -114, 20, -1, f, { u: 14, thick: 7, color: '#6a5a40', seed: SEED + 38, droop: -6 });
    ST.brow(ctx, 52, -114, 14, 1, f, { u: 14, thick: 7, color: '#6a5a40', seed: SEED + 39, droop: -6 });
    ST.mouth(ctx, 26, -26, 24, f, { open: 20, teeth: 'gap', seed: SEED + 40, lw: 5 });
    ST.stroke(ctx, [-6, 10 + jaw, 24, 20 + jaw, 52, 10 + jaw], { w: 4, seed: SEED + 41 });
    ST.blob(ctx, ST.ellipseRing(30, -58, 13, 12, 8), SKIN, { lw: 6, seed: SEED + 42, shade: [SKIN_D, -4, 4], patch: ['#c6b38c', 3, -4, 0.35] });
    ST.wart(ctx, 62, -24, 3.5, '#6f5a3a', SEED + 31);
    hat(ctx, 12, 110, pope, SEED + 43);
  }
  function headProfile(ctx, f, pope) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-56, -10, -72, -60, -72, -110, -54, -146, -12, -164, 30, -156, 60, -130, 72, -100, 74, -80, 80, -64, 74, -50, 72, -30 + jaw, 64, -10 + jaw, 40, 10 + jaw, 6, 16 + jaw, -26, 8], SKIN, Object.assign({ seed: SEED + 44 }, FACE));
    ST.blob(ctx, [-14, -60, -28, -70, -30, -92, -16, -100, -2, -92, -2, -74, -8, -62], SKIN, { lw: 5, seed: SEED + 45, shade: [SKIN_D, -4, 2], inner: () => ST.stroke(ctx, [-8, -90, -20, -84, -14, -70], { w: 3, seed: 7 }) }); // ear
    cheek(ctx, 46, -46);
    ST.eye(ctx, 50, -86, 6, 10, f, { skin: SKIN, seed: SEED + 46, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, 50, -114, 14, 1, f, { u: 14, thick: 7, color: '#6a5a40', seed: SEED + 47, droop: -6 });
    ST.mouth(ctx, 64, -26, 14, f, { open: 18, teeth: 'gap', seed: SEED + 48, lw: 5 });
    ST.stroke(ctx, [52, 8 + jaw, 30, 18 + jaw, 6, 12], { w: 4, seed: SEED + 49 });
    ST.blob(ctx, ST.ellipseRing(82, -60, 12, 11, 8), SKIN, { lw: 6, seed: SEED + 50, shade: [SKIN_D, -4, 4] });
    hat(ctx, 4, 96, pope, SEED + 51);
  }
  function headBack(ctx, f, pope) {
    [[-78, -1], [78, 1]].forEach(([x, s], i) => ST.blob(ctx, [x, -60, x + s * 16, -92, x + s * 20, -66, x + s * 10, -44], SKIN, { lw: 5, seed: SEED + 52 + i, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-70, -10, -80, -60, -76, -110, -56, -146, 0, -164, 56, -146, 76, -110, 80, -60, 70, -10, 0, 4], SKIN, Object.assign({ seed: SEED + 54 }, FACE));
    ST.blob(ctx, [-78, -130, -80, -60, -60, -30, -30, -40, 0, -28, 30, -40, 60, -30, 80, -60, 78, -130], '#6e5a40', { lw: 0, seed: SEED + 55, hatch: { c: 'rgba(30,24,16,0.6)', n: 10, len: 14, gap: 4, k: 3, ang: 85 } });
    hat(ctx, 0, 116, pope, SEED + 56, true);
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  const ARM = { cloth: CLOAK, clothD: CLOAK_D, w: [44, 40, 36], skin: SKIN, skinD: SKIN_D, hsz: 32, lw: 6, cuff: CLOAK_D, hatch: { c: 'rgba(16,20,24,0.5)', n: 3, len: 22, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: C.BROWN, clothD: C.BROWN_D, w: [36, 28, 24], shoe: '#5a4430', shoeD: '#3d2e20', len: 50, sw: 26, lw: 6, splay: 0.45 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, stick (right hand), pope, after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'confused', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, p.stick ? 'grip' : P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      if (sd === 2 && p.stick) { const g = ST.palm(j, ARM.hsz); ST.tube(ctx, [g[0] - 6, g[1] - 110, g[0], g[1], g[0] + 14, 0], [16, 15, 13], C.TIMBER, { lw: 5, seed: SEED + 60 }); }
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 70 + sd }));
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 75 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      body(ctx, V.v, p.pope);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[0], n[1] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.2 : 1.2, 1.2);
      HEADS[H.V.v](ctx, f, p.pope);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.gregory = { name: 'Gregory', D, draw, demo: { stick: true }, extraRow: ['pope', () => ({ pope: true, stick: false, expr: 'shock' })] };
})();

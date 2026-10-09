/* Main 3 - the Mayor of Viterbo, a practical man out of patience. A brick: short, as wide as he is tall, no neck,
   bowed legs. Square block head under a plum chaperon roll with a dangling tail, one heavy black unibrow with a scar
   through it, small deep eyes, a broken flattened nose, a bristly moustache, black stubble to the eyes, a cauliflower
   ear, a missing tooth. Olive knee-length tunic laced at the chest, broad belt with a pouch, grey-blue hose.
   Props: the huge brass key (the one accent) and a plank. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_CLAY, SKIN_D = C.SKIN_CLAY_D, TUNIC = C.OLIVE, TUNIC_D = C.OLIVE_D, HAT = C.PLUM, HAT_D = C.PLUM_D, SEED = 1300;
  const D = { sw: 92, sy: -440, sz: 0, l1a: 96, l2a: 88, hw: 42, hy: -210, l1l: 112, l2l: 100, elbowOut: 0.9, top: -690, waist: [104, -300], head: { x: [0, 18, 34, 0], top: -690, bottom: -452, hw: 100 } };
  const NECK = [[0, -458], [12, -458], [24, -454], [0, -458]];

  const BODY = [
    [-40, -470, -100, -458, -122, -420, -120, -340, -106, -300, -114, -200, -124, -120, 124, -120, 114, -200, 106, -300, 120, -340, 122, -420, 100, -458, 40, -470],
    [-30, -472, -88, -460, -108, -420, -106, -340, -94, -300, -102, -200, -110, -120, 132, -120, 124, -200, 118, -300, 132, -350, 128, -420, 94, -458, 36, -470],
    [-20, -476, -62, -456, -72, -410, -66, -320, -62, -220, -72, -120, 98, -120, 94, -220, 106, -300, 108, -380, 86, -440, 44, -470],
    [-40, -470, -100, -458, -120, -420, -118, -340, -106, -300, -114, -200, -124, -120, 124, -120, 114, -200, 106, -300, 118, -340, 120, -420, 100, -458, 40, -470],
  ];
  const BELT = [[-108, -306, 0, -296, 108, -306], [-96, -306, 30, -294, 120, -304], [-62, -306, 40, -298, 104, -302], [-108, -306, 0, -300, 108, -306]];
  const LACE = [0, 30, 96, null];
  const POUCH = [[-74, -294], [-60, -294], [-30, -294], [74, -294]];

  function body(ctx, v) {
    const b = BODY[v];
    ST.blob(ctx, b, TUNIC, { lw: 8, seed: SEED + v, shade: [TUNIC_D, -24, 8], mottle: ['#56542f', 6, 22], hatch: { c: 'rgba(20,20,8,0.55)', n: 9, len: 46, gap: 8, k: 3, ang: -55 } });
    ST.stroke(ctx, [b[24], -132, (b[24] + b[26]) / 2, -126, b[26], -132], { w: 9, color: C.BROWN_D, seed: SEED + 4, taper: false }); // hem band
    const lx = LACE[v];
    if (lx !== null) {
      ST.stroke(ctx, [lx, -466, lx + (v === 2 ? 6 : 0), -360], { w: 4, seed: SEED + 5, taper: false });
      for (let i = 0; i < 4; i++) ST.stroke(ctx, [lx - 10, -452 + i * 24, lx + 10, -440 + i * 24], { w: 3, color: C.LINEN_D, seed: SEED + 6 + i, taper: false });
    } else ST.stroke(ctx, [0, -460, 2, -310], { w: 3.5, seed: SEED + 10 }); // back seam
    ST.stain(ctx, [50, 70, 40, -40][v], -200, 50, 40, SEED + 11, 'rgba(30,26,10,0.3)');
    const p = POUCH[v];
    if (v !== 3) ST.blob(ctx, [p[0] - 22, p[1], p[0] + 22, p[1], p[0] + 26, p[1] + 50, p[0], p[1] + 60, p[0] - 26, p[1] + 50], C.BROWN, { lw: 5, seed: SEED + 12, shade: [C.BROWN_D, -6, 4] });
    ST.stroke(ctx, BELT[v], { w: 20, color: C.BROWN_D, seed: SEED + 13, taper: false });
    if (v < 3) { const bx = BELT[v][2]; ST.rough(ctx, [bx - 14, -310, bx + 14, -310, bx + 14, -286, bx - 14, -286], '#6e5a2a', { seed: SEED + 14, lw: 4, amp: 1 }); }
  }

  // ---------- head per view (origin = top of the short neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -16, 8], mottle: ['#8e5a42', 6, 12], hatch: { c: 'rgba(50,20,10,0.4)', n: 4, len: 16, gap: 5, k: 3, ang: 70 } };
  const STUB = 'rgba(25,18,14,0.6)';
  function ear(ctx, x, s, seed, cauli) {
    ST.blob(ctx, cauli ? [x, -92, x + s * 22, -100, x + s * 28, -78, x + s * 18, -54, x, -60] : [x, -92, x + s * 16, -98, x + s * 20, -76, x + s * 12, -56, x, -60], SKIN, { lw: 6, seed, shade: [SKIN_D, -s * 4, 2] });
    if (cauli) ST.stroke(ctx, [x + s * 8, -88, x + s * 18, -80, x + s * 10, -70, x + s * 18, -62], { w: 3, seed: seed + 1 });
  }
  function hat(ctx, pts, tail, seed) { // chaperon: a padded roll with a dangling tail
    if (tail) ST.tube(ctx, tail, tail.slice(0, tail.length / 2).map((_, i) => 30 - i * 4), HAT, { lw: 6, seed: seed + 1, shade: [HAT_D, -6, 0], hatch: { c: 'rgba(20,10,14,0.55)', n: 3, len: 20, gap: 5, k: 3, ang: 80 } });
    ST.blob(ctx, pts, HAT, { lw: 7, seed, shade: [HAT_D, -10, 8], light: ['#6b5260', 6, -6], hatch: { c: 'rgba(20,10,14,0.55)', n: 6, len: 22, gap: 6, k: 3, ang: 20 } });
  }
  function tache(ctx, x, y, w, seed) {
    ST.blob(ctx, [x - w, y + 8, x - w * 0.6, y - 6, x, y - 4, x + w * 0.6, y - 6, x + w, y + 8, x + w * 0.5, y + 10, x, y + 6, x - w * 0.5, y + 10], '#241a14', { lw: 4, seed, hatch: { c: 'rgba(120,100,80,0.5)', n: 3, len: 10, gap: 4, k: 3, ang: 80 } });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 14;
    ear(ctx, -70, -1, SEED + 20, true);
    ear(ctx, 70, 1, SEED + 22, false);
    ST.blob(ctx, [-66, -8, -74, -60, -70, -110, -58, -138, -20, -150, 20, -150, 58, -138, 72, -110, 74, -60, 66, -8, 40, 14 + jaw, 0, 18 + jaw, -40, 14 + jaw], SKIN, Object.assign({ seed: SEED + 24 }, FACE));
    ST.stubble(ctx, [-66, -70, -60, 6 + jaw, 0, 18 + jaw, 60, 6 + jaw, 68, -70, 30, -50, -30, -50], SEED + 25, 80, STUB);
    ST.eye(ctx, -26, -90, 10, 10, f, { skin: SKIN, seed: SEED + 26, lw: 5, side: 0, bags: 2 });
    ST.eye(ctx, 26, -90, 10, 11, f, { skin: SKIN, seed: SEED + 27, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, -24, -110, 40, -1, f, { u: 14, thick: 17, color: '#1e1814', seed: SEED + 28, arch: 0.4 });
    ST.brow(ctx, 24, -110, 40, 1, f, { u: 14, thick: 17, color: '#1e1814', seed: SEED + 29, arch: 0.4 });
    ST.stroke(ctx, [18, -126, 26, -104, 34, -84], { w: 3, color: '#c79a80', seed: SEED + 30, taper: false }); // scar
    ST.mouth(ctx, 0, -18, 38, f, { open: 26, teeth: 'gap', seed: SEED + 31, lw: 5 });
    ST.blob(ctx, [-14, -98, 6, -100, 18, -64, 22, -48, 4, -40, -18, -42, -22, -52, -10, -72], SKIN, { lw: 6, seed: SEED + 32, shade: [SKIN_D, -6, 5], patch: ['#b8785e', 4, -10, 0.3] });
    ST.stroke(ctx, [-6, -84, 4, -76, 0, -66], { w: 3, seed: SEED + 33 }); // the break
    tache(ctx, 0, -34, 34, SEED + 34);
    ST.wart(ctx, -44, -40, 4, '#5a3626', SEED + 35);
    hat(ctx, [-82, -118, -76, -150, -40, -172, 10, -176, 56, -168, 84, -144, 84, -114, 40, -126, 0, -122, -40, -126], [70, -130, 92, -100, 96, -60, 90, -20], SEED + 36);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 14;
    ear(ctx, -60, -1, SEED + 38, true);
    ST.blob(ctx, [-60, -8, -68, -60, -66, -110, -52, -140, -12, -152, 26, -150, 58, -136, 70, -110, 72, -90, 80, -70, 76, -40, 68, -8, 44, 14 + jaw, 6, 18 + jaw, -32, 12 + jaw], SKIN, Object.assign({ seed: SEED + 40 }, FACE));
    ST.stubble(ctx, [-54, -70, -46, 6 + jaw, 10, 18 + jaw, 68, 6 + jaw, 74, -70, 40, -50, -20, -50], SEED + 41, 80, STUB);
    ST.eye(ctx, -6, -90, 10, 10, f, { skin: SKIN, seed: SEED + 42, lw: 5, side: 0, bags: 2 });
    ST.eye(ctx, 46, -90, 7, 11, f, { skin: SKIN, seed: SEED + 43, lw: 5, side: 1, bags: 1 });
    ST.brow(ctx, -4, -110, 38, -1, f, { u: 14, thick: 17, color: '#1e1814', seed: SEED + 44, arch: 0.4 });
    ST.brow(ctx, 46, -110, 28, 1, f, { u: 14, thick: 16, color: '#1e1814', seed: SEED + 45, arch: 0.4 });
    ST.stroke(ctx, [40, -126, 46, -104, 52, -84], { w: 3, color: '#c79a80', seed: SEED + 30, taper: false });
    ST.mouth(ctx, 28, -18, 34, f, { open: 24, teeth: 'gap', seed: SEED + 46, lw: 5 });
    ST.blob(ctx, [14, -98, 30, -100, 44, -66, 54, -48, 36, -40, 18, -42, 12, -54], SKIN, { lw: 6, seed: SEED + 47, shade: [SKIN_D, -6, 5], patch: ['#b8785e', 4, -10, 0.3] });
    tache(ctx, 30, -34, 32, SEED + 48);
    ST.wart(ctx, -24, -40, 4, '#5a3626', SEED + 35);
    hat(ctx, [-74, -118, -70, -150, -30, -172, 20, -176, 64, -166, 88, -140, 86, -112, 50, -124, 0, -122, -40, -126], [-58, -126, -84, -96, -90, -56, -84, -20], SEED + 49);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-56, -8, -68, -60, -66, -112, -48, -144, -6, -154, 34, -146, 58, -124, 64, -100, 62, -86, 74, -64, 70, -50, 64, -40, 68, -22 + jaw, 66, -4 + jaw, 58, 12 + jaw, 20, 18 + jaw, -20, 12], SKIN, Object.assign({ seed: SEED + 50 }, FACE));
    ear(ctx, -18, -1, SEED + 51, true);
    ST.stubble(ctx, [-10, -70, -4, 12 + jaw, 56, 14 + jaw, 66, -30, 50, -60], SEED + 52, 60, STUB);
    ST.blob(ctx, [-66, -64, -68, -110, -44, -112, -40, -80, -52, -48], '#241a14', { lw: 0, seed: SEED + 53, hatch: { c: 'rgba(120,100,80,0.4)', n: 3, len: 12, gap: 4, k: 3, ang: 80 } });
    ST.eye(ctx, 40, -90, 7, 11, f, { skin: SKIN, seed: SEED + 54, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, 40, -110, 30, 1, f, { u: 14, thick: 17, color: '#1e1814', seed: SEED + 55, arch: 0.4 });
    ST.mouth(ctx, 58, -18, 16, f, { open: 22, teeth: 'gap', seed: SEED + 56, lw: 5 });
    ST.blob(ctx, [58, -98, 72, -92, 80, -66, 88, -50, 74, -42, 60, -48], SKIN, { lw: 6, seed: SEED + 57, shade: [SKIN_D, -6, 5], patch: ['#b8785e', 4, -10, 0.3] });
    tache(ctx, 66, -34, 20, SEED + 58);
    hat(ctx, [-72, -110, -70, -146, -36, -170, 14, -176, 56, -160, 72, -132, 66, -110, 30, -124, -20, -122], [-60, -118, -88, -88, -96, -50, -92, -14], SEED + 59);
  }
  function headBack(ctx) {
    ear(ctx, -70, -1, SEED + 60, false);
    ear(ctx, 70, 1, SEED + 62, true);
    ST.blob(ctx, [-66, -8, -74, -60, -70, -110, -58, -140, 0, -152, 58, -140, 70, -110, 74, -60, 66, -8, 0, 6], SKIN, Object.assign({ seed: SEED + 64 }, FACE));
    ST.blob(ctx, [-72, -120, -76, -60, -66, -30, -46, -18, -30, -30, -14, -16, 0, -26, 16, -16, 32, -30, 48, -18, 66, -30, 76, -60, 72, -120], '#241a14', { lw: 0, seed: SEED + 65, hatch: { c: 'rgba(120,100,80,0.4)', n: 8, len: 12, gap: 4, k: 3, ang: 85 } });
    ST.stroke(ctx, [-48, -4, 0, 6, 48, -4], { w: 4.5, seed: SEED + 66 }); // neck roll
    hat(ctx, [-84, -114, -80, -148, -40, -172, 10, -176, 56, -168, 84, -144, 84, -114, 0, -104], [-70, -130, -92, -100, -96, -60, -90, -20], SEED + 68);
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  // the huge brass key, its bow centred at the grip; ang = screen direction of the shaft (rad)
  ST.bigKey = (ctx, x, y, ang, seed) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ST.blob(ctx, ST.ellipseRing(-24, 0, 34, 26, 10), C.GOLD, { lw: 6, seed, shade: [C.GOLD_D, -6, 5], inner: () => ST.blob(ctx, ST.ellipseRing(-28, 0, 14, 10, 8), C.INK, { lw: 0, seed: seed + 1 }) });
    ST.rect(ctx, 6, -9, 200, 18, C.GOLD, { seed: seed + 2, lw: 5, amp: 1, shade: [C.GOLD_D, 0, 5] });
    ST.rough(ctx, [176, 8, 210, 8, 210, 56, 196, 56, 196, 40, 186, 40, 186, 56, 176, 56], C.GOLD, { seed: seed + 3, lw: 5, amp: 1, shade: [C.GOLD_D, -4, 4] });
    ctx.restore();
  };
  ST.plank = (ctx, x, y, ang, seed) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ST.rect(ctx, -260, -22, 520, 44, '#6b5034', { seed, lw: 6, shade: ['#4e3a25', 0, 8], hatch: { c: 'rgba(20,12,4,0.5)', n: 6, len: 90, gap: 6, k: 2, ang: 0, bend: 0.02 } });
    [-230, 230].forEach((nx, i) => ST.blob(ctx, ST.ellipseRing(nx, 0, 5, 5, 6), C.INK, { lw: 0, seed: seed + i }));
    ctx.restore();
  };

  // arms folded across the chest, each hand at the other elbow (impatience)
  const fold = () => ({
    hL: [-D.sw * 0.7, D.sy + 0.42 * (D.l1a + D.l2a), 0.34 * (D.l1a + D.l2a)], hR: [D.sw * 0.7, D.sy + 0.36 * (D.l1a + D.l2a), 0.4 * (D.l1a + D.l2a)],
    poleL: [1, 0.8, 0], poleR: [-1, 0.8, 0], kL: 'flat', kR: 'flat',
  });

  const ARM = { cloth: TUNIC, clothD: TUNIC_D, w: [54, 48, 42], skin: SKIN, skinD: SKIN_D, hsz: 40, lw: 7, cuff: C.BROWN_D, hatch: { c: 'rgba(20,20,8,0.5)', n: 3, len: 26, gap: 6, k: 3, ang: 40 } };
  const LEG = { cloth: C.GREYBLUE, clothD: C.GREYBLUE_D, w: [50, 40, 32], shoe: C.BROWN_D, shoeD: '#2a2019', len: 60, sw: 34, lw: 6, splay: 0.5 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, key: shaft angle (rad, right hand),
  // plank: angle (rad, left hand), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'deadpan', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, p.plank !== undefined ? 'grip' : P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, p.key !== undefined ? 'grip' : P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      const g = ST.palm(j, ARM.hsz);
      if (sd === 2 && p.key !== undefined) ST.bigKey(ctx, g[0], g[1], p.key, SEED + 70);
      if (sd === 1 && p.plank !== undefined) ST.plank(ctx, g[0], g[1], p.plank, SEED + 74);
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 80 + sd }));
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 85 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      body(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[0], n[1] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.12 : 1.12, 1.12);
      HEADS[H.V.v](ctx, f);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.mayor = { name: 'The Mayor', D, draw, fold, demo: { key: -1.2 }, extraRow: ['arms folded', () => ({ pose: Object.assign(ST.pose('stand', D), fold()), layer: { L: 2, R: 2 }, key: undefined, expr: 'disgust' })] };
})();

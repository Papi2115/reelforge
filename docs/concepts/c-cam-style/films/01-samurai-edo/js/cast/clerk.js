/* Cast 4 - the Clerk Colleague. Twenty years at the same low desk: round shoulders, caved chest, the head hanging
   forward on a long bent neck. Long droopy face, eyes half shut under swollen lids with triple bags, a lumpy nose,
   grey stubble, a slack lower lip, an ink smear across the cheek, a spare brush stuck behind the ear and loose strands
   escaping a tired topknot. Faded brown kimono with a patched elbow, sleeves tied back with a cord that crosses on
   the back, grey hakama, ink-black fingertips. Default: exhausted. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_OLIVE, SKIN_D = C.SKIN_OLIVE_D, HAIR = '#3a342d', PATE = '#857c62', SEED = 410;
  const KIMO = C.BROWN, KIMO_D = C.BROWN_D, HAKA = C.STONE_D, HAKA_D = '#45413a';
  const D = { sw: 44, sy: -520, sz: 18, l1a: 116, l2a: 108, hw: 26, hy: -320, l1l: 166, l2l: 150, elbowOut: 0.6, top: -790, waist: [56, -394], head: { x: [0, 30, 66, 0], top: -790, bottom: -560, hw: 80 } };
  const NECK = [[0, -548, 0, -584], [14, -546, 30, -578], [30, -540, 66, -566], [0, -548, 0, -584]]; // the long, forward-hung neck

  const KIMONO = [
    [-22, -560, -56, -548, -68, -506, -62, -450, -58, -412, 0, -404, 58, -412, 62, -450, 68, -506, 56, -548, 22, -560],
    [-10, -562, -48, -552, -64, -506, -60, -450, -54, -412, 10, -404, 56, -412, 62, -452, 60, -504, 48, -546, 24, -560],
    [10, -566, -36, -560, -58, -520, -56, -460, -42, -412, 40, -412, 44, -456, 46, -510, 40, -546, 26, -566],
    [-22, -560, -58, -548, -70, -506, -64, -450, -58, -412, 0, -406, 58, -412, 64, -450, 70, -506, 58, -548, 22, -560],
  ];
  const HAKAMA_TOP = [
    [-58, -428, 58, -428, 68, -292, 0, -284, -68, -292],
    [-50, -428, 60, -428, 70, -294, 8, -286, -62, -292],
    [-40, -430, 44, -430, 54, -292, -48, -290],
    [-58, -428, 58, -428, 68, -292, 0, -286, -68, -292],
  ];

  function torso(ctx, v) {
    ST.blob(ctx, KIMONO[v], KIMO, { lw: 7, seed: SEED + v, shade: [KIMO_D, -18, 6], mottle: ['#4d3d2e', 6, 18], hatch: { c: 'rgba(20,14,8,0.55)', n: 8, len: 30, gap: 7, k: 3, ang: -60 } });
    if (v < 3) {
      const x = [0, 18, 36][v];
      ST.stroke(ctx, [x - 18, -562, x - 4, -520, x + 2, -500], { w: 11, color: C.LINEN_D, seed: SEED + 4, taper: false });
      ST.stroke(ctx, [x + 18, -562, x + 2, -510, x - 16, -430], { w: 11, color: C.LINEN_D, seed: SEED + 5, taper: false });
      if (v === 2) ST.stroke(ctx, [-50, -530, -54, -470, -48, -420], { w: 3.5, seed: SEED + 6 }); // hunched back line
      ST.stroke(ctx, [x - 40, -556, x + 4, -470, x + 46, -420], { w: 7, color: '#6c5a3a', seed: SEED + 7, taper: false }); // sleeve cord
    } else {
      [[-56, -548, 50, -430], [56, -548, -50, -430]].forEach((l, i) => ST.stroke(ctx, l, { w: 8, color: '#6c5a3a', seed: SEED + 8 + i, taper: false })); // cord crossing the back
    }
    ST.stroke(ctx, [[-56, -430, 56, -430], [-48, -430, 58, -430], [-40, -432, 44, -432], [-56, -430, 56, -430]][v], { w: 11, color: C.CLAY_D, seed: SEED + 10, taper: false });
    ST.blob(ctx, HAKAMA_TOP[v], HAKA, { lw: 7, seed: SEED + 11 + v, shade: [HAKA_D, -18, 6], hatch: { c: 'rgba(16,14,10,0.5)', n: 6, len: 60, gap: 9, k: 3, ang: 84, bend: 0.03 } });
    if (v === 2) ST.rough(ctx, [-44, -446, -28, -444, -32, -394, -46, -396], HAKA_D, { seed: SEED + 15, lw: 4, amp: 1 });
    ST.blob(ctx, [[20, -480, 46, -478, 44, -456, 22, -458], [30, -480, 54, -478, 52, -456, 30, -458], [10, -480, 34, -478, 32, -456, 12, -458], [-40, -480, -16, -478, -18, -456, -40, -458]][v], C.INK, { lw: 0, seed: SEED + 16 }); // ink blot
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], mottle: ['#867650', 6, 10], hatch: { c: 'rgba(50,44,24,0.45)', n: 4, len: 16, gap: 5, k: 3, ang: 75 } };
  const STUB = 'rgba(70,70,64,0.6)';
  function pate(ctx, pts, seed) {
    ST.blob(ctx, pts, PATE, { lw: 0, seed });
    ST.stubble(ctx, pts, seed + 1, 50, 'rgba(40,36,26,0.55)');
  }
  function hair(ctx, pts, seed) {
    ST.blob(ctx, pts, HAIR, { lw: 5, seed, hatch: { c: 'rgba(130,120,100,0.35)', n: 2, len: 14, gap: 4, k: 3, ang: 80 } });
  }
  function strands(ctx, x, y, seed) {
    [[0, -18, 10, -30], [6, -14, 22, -20], [-4, -16, -14, -28]].forEach((d, i) => ST.stroke(ctx, [x, y, x + d[0], y + d[1], x + d[2], y + d[3]], { w: 2.5, color: HAIR, seed: seed + i, taper: false }));
  }
  function brush(ctx, x, y, s, seed) { // writing brush behind the ear
    ST.tube(ctx, [x - s * 10, y - 40, x + s * 22, y + 24], [9, 9], '#9c8a5a', { lw: 4, seed });
    ST.tube(ctx, [x + s * 22, y + 24, x + s * 28, y + 40], [10, 4], C.INK, { lw: 3, seed: seed + 1 });
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 12 * a[2], 13, f, { skin: SKIN, seed: SEED + 30, lw: 5, side: 0, bags: 2, lidAdd: 0.08 });
    ST.brow(ctx, a[0], a[1] - 24, 28 * a[2], -1, f, { u: 18, thick: 8, color: HAIR, seed: SEED + 31, droop: 6 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 12 * b[2], 13, f, { skin: SKIN, seed: SEED + 32, lw: 5, side: 1, bags: 2, lidAdd: 0.08 });
    ST.brow(ctx, b[0], b[1] - 24, 28 * b[2], 1, f, { u: 18, thick: 8, color: HAIR, seed: SEED + 33, droop: 6 });
  }
  function nose(ctx, pts, seed) {
    ST.blob(ctx, pts, SKIN, { lw: 6, seed, shade: [SKIN_D, -6, 5], patch: ['#b0a078', 4, -10, 0.3] });
  }
  function smear(ctx, x, y, seed) { // ink smear on the cheek
    ST.blob(ctx, [x - 16, y - 2, x + 10, y - 8, x + 16, y + 2, x - 10, y + 8], 'rgba(22,18,14,0.75)', { lw: 0, seed });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 18;
    [-1, 1].forEach((s) => ST.blob(ctx, [s * 44, -112, s * 64, -118, s * 66, -84, s * 52, -66, s * 44, -76], SKIN, { lw: 6, seed: SEED + 34 + s, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-38, -4 + jaw, -46, -60, -48, -116, -40, -150, -12, -166, 16, -166, 40, -150, 48, -116, 46, -60, 38, -4 + jaw, 18, 16 + jaw, 0, 22 + jaw, -18, 16 + jaw], SKIN, Object.assign({ seed: SEED + 37 }, FACE));
    pate(ctx, [-28, -134, -36, -150, -12, -165, 16, -165, 38, -150, 30, -134, 0, -128], SEED + 38);
    hair(ctx, [-49, -100, -46, -144, -30, -136, -38, -96], SEED + 40);
    hair(ctx, [49, -100, 46, -144, 30, -136, 38, -96], SEED + 41);
    ST.tube(ctx, [0, -160, 4, -172, 10, -176], [12, 10, 8], HAIR, { lw: 4, seed: SEED + 42 });
    strands(ctx, 2, -164, SEED + 43);
    brush(ctx, 56, -110, 1, SEED + 46);
    ST.stubble(ctx, [-40, -50, -34, 10 + jaw, 0, 22 + jaw, 34, 10 + jaw, 40, -50, 16, -40, -16, -40], SEED + 48, 70, STUB);
    eyes(ctx, f, [-18, -100, 1], [20, -102, 1]);
    ST.mouth(ctx, 2, -22, 34, f, { open: 30, teeth: 'gap', seed: SEED + 49, lw: 5 });
    ST.stroke(ctx, [-10, -12 + jaw, 4, -6 + jaw, 16, -12 + jaw], { w: 6, seed: SEED + 50 }); // slack lip
    nose(ctx, [-8, -100, 8, -100, 16, -70, 18, -52, 4, -44, -12, -48, -16, -66], SEED + 51);
    smear(ctx, -30, -62, SEED + 52);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 18;
    ST.blob(ctx, [-34, -112, -54, -118, -56, -84, -42, -66, -34, -76], SKIN, { lw: 6, seed: SEED + 53, shade: [SKIN_D, 4, 2] });
    ST.blob(ctx, [-32, -4 + jaw, -42, -60, -44, -116, -34, -152, -2, -168, 28, -162, 50, -142, 58, -114, 56, -96, 62, -74, 56, -60, 50, -4 + jaw, 30, 16 + jaw, 8, 22 + jaw, -12, 14 + jaw], SKIN, Object.assign({ seed: SEED + 54 }, FACE));
    pate(ctx, [-20, -136, -28, -152, -2, -167, 28, -161, 48, -142, 40, -132, 10, -128], SEED + 55);
    hair(ctx, [-45, -100, -42, -146, -24, -136, -32, -94], SEED + 57);
    ST.tube(ctx, [-16, -160, 2, -172, 18, -176], [12, 10, 8], HAIR, { lw: 4, seed: SEED + 58 });
    strands(ctx, -10, -162, SEED + 59);
    brush(ctx, -48, -108, -1, SEED + 62);
    ST.stubble(ctx, [-30, -50, -24, 10 + jaw, 10, 22 + jaw, 50, 10 + jaw, 56, -50, 34, -40, 0, -40], SEED + 64, 64, STUB);
    eyes(ctx, f, [0, -100, 1], [44, -102, 0.64]);
    ST.mouth(ctx, 28, -22, 30, f, { open: 28, teeth: 'gap', seed: SEED + 65, lw: 5 });
    ST.stroke(ctx, [18, -12 + jaw, 30, -6 + jaw, 40, -12 + jaw], { w: 6, seed: SEED + 66 });
    nose(ctx, [20, -102, 32, -102, 44, -70, 52, -52, 38, -44, 22, -48, 18, -66], SEED + 67);
    smear(ctx, -14, -62, SEED + 68);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 18;
    ST.blob(ctx, [-32, -4, -54, -50, -60, -110, -46, -152, -10, -170, 26, -160, 44, -136, 48, -112, 46, -98, 50, -60, 46, -40, 48, -18 + jaw, 38, 4 + jaw, 20, 20 + jaw, -4, 18, -18, 8], SKIN, Object.assign({ seed: SEED + 70 }, FACE));
    pate(ctx, [-26, -160, -6, -169, 24, -160, 42, -134, 22, -128, -8, -136, -24, -146], SEED + 71);
    hair(ctx, [-62, -96, -58, -146, -30, -156, -20, -140, -32, -106, -42, -76], SEED + 73);
    ST.tube(ctx, [-34, -158, -12, -176, 10, -178], [12, 10, 8], HAIR, { lw: 4, seed: SEED + 74 });
    strands(ctx, -30, -162, SEED + 75);
    ST.blob(ctx, [-26, -110, -6, -114, 0, -80, -20, -72], SKIN, { lw: 6, seed: SEED + 78, shade: [SKIN_D, -4, 2] });
    brush(ctx, -18, -108, -1, SEED + 79);
    ST.stubble(ctx, [-4, -50, -2, 6 + jaw, 40, 14 + jaw, 48, -30, 30, -40], SEED + 81, 50, STUB);
    eyes(ctx, f, [30, -100, 0.72], null);
    ST.mouth(ctx, 40, -22, 16, f, { open: 24, teeth: 'gap', seed: SEED + 82, lw: 5 });
    nose(ctx, [40, -106, 54, -100, 70, -64, 70, -48, 54, -44, 44, -58], SEED + 83);
    smear(ctx, 12, -62, SEED + 84);
  }
  function headBack(ctx) {
    [-1, 1].forEach((s) => ST.blob(ctx, [s * 44, -112, s * 64, -118, s * 66, -84, s * 52, -66, s * 44, -76], SKIN, { lw: 6, seed: SEED + 85 + s, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-38, -4, -46, -60, -48, -116, -40, -150, -12, -166, 16, -166, 40, -150, 48, -116, 46, -60, 38, -4, 0, 6], SKIN, Object.assign({ seed: SEED + 88 }, FACE));
    ST.blob(ctx, [-48, -50, -50, -120, -36, -156, 0, -162, 36, -156, 50, -120, 48, -50, 28, -30, 0, -24, -28, -30], HAIR, { lw: 0, seed: SEED + 89, hatch: { c: 'rgba(130,120,100,0.35)', n: 10, len: 16, gap: 4, k: 3, ang: 85 } });
    ST.tube(ctx, [0, -156, 0, -170, 0, -178], [12, 10, 8], HAIR, { lw: 4, seed: SEED + 90 });
    strands(ctx, 0, -160, SEED + 91);
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  const ARM = { cloth: KIMO, clothD: KIMO_D, w: [32, 28, 24], bare: 0.42, skin: SKIN, skinD: SKIN_D, hsz: 32, lw: 6, hair: true, hatch: { c: 'rgba(20,14,8,0.45)', n: 3, len: 22, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: HAKA, clothD: HAKA_D, w: [66, 76, 88], shoe: C.LINEN_D, shoeD: '#5f584a', len: 60, sw: 24, lw: 6, splay: 0.35, hatch: { c: 'rgba(16,14,10,0.45)', n: 3, len: 50, gap: 9, k: 3, ang: 84, bend: 0.03 } };
  // at the desk: both forearms on the desk top in front of him (desk y in body space), brush hand slightly ahead
  ST.clerkDesk = (Dd, deskY, write) => ({ hL: [Dd.sw * 0.6, deskY, 0.62 * (Dd.l1a + Dd.l2a)], hR: [-Dd.sw * 0.4, deskY - 4 - (write || 0) * 10, 0.7 * (Dd.l1a + Dd.l2a)], kL: 'flat', kR: 'grip', poleL: [1, 0.6, -0.3], poleR: [-1, 0.6, -0.3] });

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'exhausted', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 92 + sd }));
      const g = ST.palm(j, ARM.hsz);
      ST.blob(ctx, ST.ellipseRing(g[0] + 4, g[1] + 6, 9, 7, 7), 'rgba(22,18,14,0.8)', { lw: 0, seed: SEED + 95 + sd }); // ink-black fingertips
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 97 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      ST.tube(ctx, [n[0], n[1] + 16, (n[0] + n[2]) / 2 + 4, (n[1] + n[3]) / 2, n[2], n[3] + 12 + (p.headDy || 0)], [32, 28, 30], SKIN, { lw: 6, seed: SEED + 99, shade: [SKIN_D, -6, 0] });
      torso(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.08 : 1.08, 1.08);
      HEADS[H.V.v](ctx, f);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.clerk = { name: 'The Clerk', D, draw, hsz: ARM.hsz, extraRow: ['at the desk', (Dd) => ({ pose: ST.pose('stand', Dd, null, ST.clerkDesk(Dd, -360, 1)) })] };
})();

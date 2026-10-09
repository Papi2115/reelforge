/* Cast 5 - THE GUIDANCE ENGINEER (mission control). A twenty-something stick insect: narrow shoulders, long arms,
   a pencil neck with a big Adam's apple. Long head with a flat-top crew cut, jug ears, heavy black-rimmed glasses
   that magnify his eyes, acne spots, a weak chin, two buck teeth. Dirty white short-sleeved shirt, pocket protector
   stuffed with pens, a skinny tie loosened, headset over the crew cut. The one who says "go". Default: focused. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_SALLOW, SKIN_D = C.SKIN_SALLOW_D, HAIR = '#3a2e22', SEED = 610, SHIRT = '#aea687', SHIRT_D = '#857d62';
  const D = { sw: 44, sy: -566, sz: 4, l1a: 124, l2a: 116, hw: 24, hy: -350, l1l: 180, l2l: 160, elbowOut: 0.6, top: -830, waist: [52, -410], hsz: 34, head: { x: [0, 16, 34, 0], top: -830, bottom: -620, hw: 74 } };
  const NECK = [[0, -584, 0, -638], [6, -582, 14, -634], [14, -578, 32, -628], [0, -584, 0, -638]];

  const SHIRTS = [
    [-22, -594, -58, -584, -66, -540, -62, -470, -60, -410, -56, -360, 0, -352, 56, -360, 60, -410, 62, -470, 66, -540, 58, -584, 22, -594],
    [-14, -596, -54, -586, -62, -540, -58, -470, -56, -410, -50, -360, 10, -352, 56, -360, 62, -410, 60, -470, 58, -540, 46, -586, 18, -596],
    [-4, -598, -32, -588, -40, -540, -36, -470, -34, -410, -32, -360, 30, -356, 40, -410, 42, -470, 40, -540, 32, -588, 12, -598],
    [-22, -594, -60, -584, -68, -540, -64, -470, -60, -410, -56, -360, 0, -354, 56, -360, 60, -410, 64, -470, 68, -540, 60, -584, 22, -594],
  ];

  function shirt(ctx, v) {
    ST.blob(ctx, [-50, -372, 50, -372, 52, -330, -52, -330].map((q, i) => (i % 2 === 0 && v === 2 ? q * 0.7 : q)), C.BROWN, { lw: 6, seed: SEED + 40 + v }); // slacks top
    ST.blob(ctx, SHIRTS[v], SHIRT, { lw: 7, seed: SEED + v, shade: [SHIRT_D, -18, 6], mottle: ['rgba(90,80,50,0.3)', 4, 16], hatch: { c: 'rgba(40,34,20,0.5)', n: 7, len: 34, gap: 7, k: 3, ang: -60 } });
    ST.stroke(ctx, [SHIRTS[v][14], -366, 0, -358, SHIRTS[v][18], -366], { w: 8, color: C.BLACK, seed: SEED + 5, taper: false });
    if (v === 3) { ST.stroke(ctx, [0, -588, -2, -460, 2, -366], { w: 3.5, seed: SEED + 6 }); return; }
    const x = [0, 14, 34][v], k = [1, 0.8, 0.35][v];
    ST.blob(ctx, [x - 4, -572, x + 4, -572, x + 10, -430, x + 2, -416, x - 4, -430], C.OLIVE_D, { lw: 4, seed: SEED + 7 }); // tie, loosened
    ST.blob(ctx, [x - 22, -594, x, -570, x - 14, -562], SHIRT, { lw: 4, seed: SEED + 8 });
    ST.blob(ctx, [x + 22, -594, x, -570, x + 14, -562], SHIRT, { lw: 4, seed: SEED + 9 });
    if (v < 2) {
      ST.rect(ctx, x + 18 * k, -540, 30 * k, 40, C.LINEN, { seed: SEED + 10, lw: 4, amp: 1 }); // pocket protector
      [C.BLACK, C.RUST_D, C.GREYBLUE, C.BLACK].forEach((col, i) => ST.tube(ctx, [x + 22 * k + i * 7 * k, -552, x + 22 * k + i * 7 * k, -526], [5, 5], col, { lw: 2.5, seed: SEED + 11 + i }));
    }
    ST.stain(ctx, x - 30 * k, -470, 30, 26, SEED + 16, 'rgba(80,70,40,0.3)');
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], mottle: ['rgba(150,110,60,0.3)', 5, 8], hatch: { c: 'rgba(60,50,30,0.35)', n: 3, len: 16, gap: 5, k: 3, ang: 75 } };
  const CREW = { lw: 5, hatch: { c: 'rgba(120,100,80,0.5)', n: 5, len: 14, gap: 4, k: 4, ang: 90, bend: 0 } };
  // glasses: thick black rims round magnified eyes (drawn over them)
  function glasses(ctx, a, b, bridge) {
    [a, b].forEach((g, i) => { if (g) ST.inkLine(ctx, ST.curve(ST.ellipseRing(g[0], g[1], g[2], 22, 10), true, 4), { w: 9, closed: true, seed: SEED + 20 + i, color: C.BLACK }); });
    if (bridge) ST.stroke(ctx, bridge, { w: 7, color: C.BLACK, seed: SEED + 22, taper: false });
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 15 * a[2], 17, f, { skin: SKIN, seed: SEED + 23, lw: 5, side: 0, bag: false });
    ST.brow(ctx, a[0], a[1] - 34, 26 * a[2], -1, f, { u: 18, thick: 8, color: HAIR, seed: SEED + 24 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 15 * b[2], 17, f, { skin: SKIN, seed: SEED + 25, lw: 5, side: 1, bag: false });
    ST.brow(ctx, b[0], b[1] - 34, 26 * b[2], 1, f, { u: 18, thick: 8, color: HAIR, seed: SEED + 26 });
  }
  function ear(ctx, x, y, s, seed) {
    ST.blob(ctx, [x, y - 24, x + s * 34, y - 36, x + s * 40, y - 6, x + s * 28, y + 20, x, y + 14], SKIN, { lw: 6, seed, shade: [SKIN_D, -s * 6, 2], inner: () => ST.stroke(ctx, [x + s * 12, y - 20, x + s * 26, y - 12, x + s * 18, y + 8], { w: 3, seed: seed + 1 }) });
  }
  function teeth(ctx, x, y) {
    [-1, 1].forEach((s, i) => ST.blob(ctx, [x + s, y - 4, x + s * 11, y - 4, x + s * 10, y + 10, x + s * 2, y + 11], C.TOOTH, { sharp: true, lw: 3, seed: SEED + 27 + i, shade: [C.TOOTH_D, -2, 0] }));
  }
  function headset(ctx, band, cup, mic) {
    ST.stroke(ctx, band, { w: 7, color: C.BLACK, seed: SEED + 29, taper: false });
    ST.blob(ctx, ST.ellipseRing(cup[0], cup[1], 12, 16, 8), C.BLACK, { lw: 4, seed: SEED + 30 });
    if (mic) ST.stroke(ctx, [cup[0], cup[1] + 10].concat(mic), { w: 5, color: C.BLACK_D, seed: SEED + 31, taper: false });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 16;
    ear(ctx, -44, -88, -1, SEED + 32);
    ear(ctx, 44, -88, 1, SEED + 34);
    ST.blob(ctx, [-36, -16 + jaw, -44, -70, -46, -130, -38, -160, 0, -170, 38, -160, 46, -130, 44, -70, 36, -16 + jaw, 16, 4 + jaw, 0, 8 + jaw, -16, 4 + jaw], SKIN, Object.assign({ seed: SEED + 36 }, FACE));
    ST.blob(ctx, [-46, -140, -48, -196, 48, -196, 46, -140, 30, -150, 0, -146, -30, -150], HAIR, Object.assign({ seed: SEED + 37 }, CREW));
    ST.pores(ctx, -34, -60, 66, 30, 9, SEED + 38, 'rgba(160,60,40,0.6)');
    eyes(ctx, f, [-20, -98, 1], [20, -98, 1]);
    glasses(ctx, [-20, -98, 21], [20, -98, 21], [-2, -102, 2, -102]);
    ST.mouth(ctx, 0, -30, 30, f, { open: 24, teeth: 'none', seed: SEED + 39, lw: 5 });
    teeth(ctx, 0, -30);
    ST.blob(ctx, [-6, -84, 6, -84, 10, -56, 0, -50, -10, -56], SKIN, { lw: 6, seed: SEED + 40, shade: [SKIN_D, -4, 3] });
    headset(ctx, [-48, -110, -50, -170, 0, -204, 50, -170, 48, -110], [50, -96], [44, -40, 20, -28]);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 16;
    ear(ctx, -32, -88, -1, SEED + 41);
    ST.blob(ctx, [-30, -14 + jaw, -40, -70, -42, -132, -32, -162, 6, -172, 40, -160, 52, -128, 54, -96, 58, -72, 50, -16 + jaw, 30, 4 + jaw, 10, 8 + jaw, -10, 4 + jaw], SKIN, Object.assign({ seed: SEED + 42 }, FACE));
    ST.blob(ctx, [-42, -140, -44, -196, 52, -196, 52, -140, 34, -150, 6, -146, -24, -150], HAIR, Object.assign({ seed: SEED + 43 }, CREW));
    ST.pores(ctx, -22, -60, 60, 30, 9, SEED + 44, 'rgba(160,60,40,0.6)');
    eyes(ctx, f, [-2, -98, 1], [38, -98, 0.66]);
    glasses(ctx, [-2, -98, 21], [38, -98, 14], [18, -102, 26, -102]);
    ST.mouth(ctx, 22, -30, 26, f, { open: 22, teeth: 'none', seed: SEED + 45, lw: 5 });
    teeth(ctx, 24, -30);
    ST.blob(ctx, [18, -84, 28, -84, 40, -58, 28, -50, 16, -56], SKIN, { lw: 6, seed: SEED + 46, shade: [SKIN_D, -4, 3] });
    headset(ctx, [-40, -110, -42, -172, 8, -204, 46, -176], [-42, -96], [-30, -40, 6, -28]);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-26, -8, -46, -50, -50, -126, -36, -160, 4, -172, 34, -158, 44, -128, 46, -108, 44, -94, 50, -80, 46, -60, 42, -46, 44, -30, 36, -14 + jaw, 22, 2 + jaw, 4, 8 + jaw, -10, 0], SKIN, Object.assign({ seed: SEED + 47 }, FACE));
    ST.blob(ctx, [-52, -120, -52, -192, 40, -196, 40, -140, 10, -146, -20, -140], HAIR, Object.assign({ seed: SEED + 48 }, CREW));
    ear(ctx, -12, -88, -1, SEED + 49);
    ST.pores(ctx, 0, -64, 30, 26, 6, SEED + 50, 'rgba(160,60,40,0.6)');
    eyes(ctx, f, [28, -98, 0.7], null);
    glasses(ctx, [28, -98, 13], null, [16, -102, -12, -100]);
    ST.mouth(ctx, 34, -28, 14, f, { open: 20, teeth: 'none', seed: SEED + 51, lw: 5 });
    teeth(ctx, 40, -28);
    ST.blob(ctx, [40, -86, 52, -80, 62, -60, 46, -54], SKIN, { lw: 6, seed: SEED + 52, shade: [SKIN_D, -4, 3] });
    headset(ctx, [-16, -110, -20, -180, 4, -204], [-14, -96], [-2, -40, 34, -26]);
  }
  function headBack(ctx) {
    ear(ctx, -44, -88, -1, SEED + 53);
    ear(ctx, 44, -88, 1, SEED + 55);
    ST.blob(ctx, [-36, -10, -44, -70, -46, -130, -38, -160, 0, -170, 38, -160, 46, -130, 44, -70, 36, -10, 0, 0], SKIN, Object.assign({ seed: SEED + 57 }, FACE));
    ST.blob(ctx, [-48, -60, -48, -196, 48, -196, 48, -60, 30, -40, 0, -36, -30, -40], HAIR, Object.assign({ seed: SEED + 58 }, CREW, { lw: 0 }));
    headset(ctx, [-48, -110, -50, -170, 0, -204, 50, -170, 48, -110], [-50, -96], null);
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  function neck(ctx, v, hdy) {
    const n = NECK[v];
    ST.tube(ctx, [n[0], n[1] + 6, n[2], n[3] + 14 + hdy], [28, 26], SKIN, { lw: 6, seed: SEED + 59, shade: [SKIN_D, -5, 0] });
    if (v < 3) ST.stroke(ctx, [n[2] + v * 5, n[3] + 24, n[2] + 10 + v * 5, n[3] + 32, n[2] + 2 + v * 5, n[3] + 40], { w: 4, seed: SEED + 60 });
  }

  const ARM = { cloth: SHIRT, clothD: SHIRT_D, w: [30, 26, 20], bare: 0, skin: SKIN, skinD: SKIN_D, hsz: D.hsz, lw: 6, cuff: SHIRT_D, hatch: { c: 'rgba(40,34,20,0.45)', n: 2, len: 18, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: C.BROWN, clothD: C.BROWN_D, w: [32, 26, 22], shoe: C.BLACK, shoeD: C.BLACK_D, len: 70, sw: 24, lw: 6, splay: 0.3 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'focused', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => { if (l === layer) ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 80 + sd })); });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 90 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      neck(ctx, V.v, p.headDy || 0);
      shirt(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.05 : 1.05, 1.05);
      HEADS[H.V.v](ctx, f);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.guidance = { name: 'The Guidance Engineer', D, draw };
})();

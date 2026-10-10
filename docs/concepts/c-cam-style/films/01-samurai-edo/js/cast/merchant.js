/* Main 2 - the Rice Merchant. A short, soft pear: no neck, round sloping shoulders, a belly that pushes the black
   haori open over a plum pinstriped kimono that falls to the ankles. Big round head, shaved pate with a tiny glossy
   topknot, fat cheeks with a flushed broken-vein patch, small slits of eyes under high thin brows, a bulb nose, a wide
   polite mouth, a double chin, a hairy mole by the lip. Props: the abacus (left hand) and gold koban (right hand).
   Default: smug. Bows from the hip (p.bow) - always a little lower than you. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_RUDDY, SKIN_D = C.SKIN_RUDDY_D, HAIR = '#1f1c1a', PATE = '#9c8a76', SEED = 210;
  const HAORI = C.BLACK, HAORI_D = C.BLACK_D, KIMO = C.PLUM, KIMO_D = C.PLUM_D;
  const D = { sw: 58, sy: -500, sz: 4, l1a: 104, l2a: 98, hw: 30, hy: -300, l1l: 150, l2l: 140, elbowOut: 0.7, top: -760, waist: [80, -380], head: { x: [0, 16, 32, 0], top: -760, bottom: -530, hw: 86 } };
  const NECK = [[0, -524], [12, -524], [24, -520], [0, -524]];

  const HAORI_S = [
    [-34, -536, -80, -522, -98, -470, -104, -400, -98, -330, -86, -296, 0, -290, 86, -296, 98, -330, 104, -400, 98, -470, 80, -522, 34, -536],
    [-24, -538, -72, -524, -90, -470, -94, -400, -88, -330, -78, -296, 20, -290, 100, -296, 116, -340, 116, -410, 100, -472, 66, -526, 30, -538],
    [-12, -540, -50, -526, -66, -470, -66, -400, -58, -330, -50, -296, 70, -294, 96, -336, 100, -404, 80, -470, 44, -526, 16, -540],
    [-34, -536, -82, -522, -100, -470, -104, -400, -98, -330, -86, -296, 0, -292, 86, -296, 98, -330, 104, -400, 100, -470, 82, -522, 34, -536],
  ];
  const OPEN = [[0, 26], [26, 22], [74, 12], null]; // centre x of the open front, half width
  const SKIRT = [
    [-84, -312, 84, -312, 80, -160, 74, -28, -74, -28, -80, -160],
    [-76, -312, 92, -312, 86, -160, 78, -28, -68, -28, -72, -160],
    [-50, -314, 74, -314, 66, -160, 60, -28, -50, -28, -52, -160],
    [-84, -312, 84, -312, 80, -160, 74, -28, -74, -28, -80, -160],
  ];
  const stripes = (ctx, x0, x1, y0, y1, seed) => { for (let x = x0 + 9; x < x1; x += 15) ST.stroke(ctx, [x, y0, x + 1, y1], { w: 2.4, color: 'rgba(170,140,150,0.4)', seed: seed + x, taper: false }); };

  function skirt(ctx, v) {
    const c = ST.blob(ctx, SKIRT[v], KIMO, { lw: 7, seed: SEED + v, shade: [KIMO_D, -18, 6], hatch: { c: 'rgba(16,8,12,0.5)', n: 6, len: 60, gap: 8, k: 3, ang: 86, bend: 0.04 } });
    const b = ST.bbox(c);
    ctx.save();
    ST.path(ctx, c, true);
    ctx.clip();
    stripes(ctx, b.x0, b.x1, b.y0, b.y1, SEED + 5);
    ctx.restore();
    if (v < 3) ST.stroke(ctx, [[-10, -300, -24, -30], [8, -300, -4, -30], [56, -300, 50, -30]][v], { w: 4, seed: SEED + 6 }); // overlap edge
    ST.stain(ctx, [30, 40, 10, -30][v], -90, 50, 30, SEED + 7, 'rgba(30,20,10,0.35)');
  }
  function torso(ctx, v) {
    ST.blob(ctx, HAORI_S[v], HAORI, { lw: 7, seed: SEED + 10 + v, shade: [HAORI_D, -18, 6], light: ['#3d3833', 10, -6], hatch: { c: 'rgba(120,110,90,0.25)', n: 7, len: 34, gap: 7, k: 3, ang: -60 } });
    const o = OPEN[v];
    if (o) {
      const [x, w] = o;
      ST.blob(ctx, [x - w, -532, x + w, -532, x + w + 10, -300, x - w - 10, -300], KIMO, { lw: 5, seed: SEED + 14, shade: [KIMO_D, -6, 3], inner: (bb) => stripes(ctx, bb.x0, bb.x1, bb.y0, bb.y1, SEED + 15) });
      ST.stroke(ctx, [x - w + 4, -532, x + 2, -470, x + w + 4, -532], { w: 10, color: C.LINEN_D, seed: SEED + 16, taper: false }); // collar
      ST.rough(ctx, [x - w - 6, -400, x + w + 6, -400, x + w + 8, -366, x - w - 8, -366], C.BROWN, { seed: SEED + 17, lw: 5, amp: 1 }); // obi
      [-1, 1].forEach((s) => ST.blob(ctx, ST.ellipseRing(x + s * 10, -470, 8, 10, 6), C.LINEN, { lw: 3, seed: SEED + 18 + s })); // haori tie
      if (v < 2) ST.blob(ctx, ST.ellipseRing(x + (v ? 50 : 60), -486, 11, 11, 8), '#7c766a', { lw: 3.5, seed: SEED + 20 }); // crest
    } else {
      ST.blob(ctx, ST.ellipseRing(0, -500, 13, 13, 8), '#7c766a', { lw: 3.5, seed: SEED + 21 });
      ST.stroke(ctx, [0, -486, 2, -300], { w: 3.5, color: '#4a4540', seed: SEED + 22 });
    }
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -16, 8], mottle: ['rgba(150,80,60,0.3)', 6, 10], hatch: { c: 'rgba(70,40,30,0.35)', n: 4, len: 16, gap: 5, k: 3, ang: 70 } };
  function pate(ctx, pts, seed) {
    ST.blob(ctx, pts, PATE, { lw: 0, seed });
    ST.stubble(ctx, pts, seed + 1, 30, 'rgba(50,40,36,0.4)');
  }
  function hair(ctx, pts, seed) {
    ST.blob(ctx, pts, HAIR, { lw: 5, seed, light: ['#45403a', 3, -4] });
  }
  function knot(ctx, pts, seed) {
    ST.tube(ctx, pts, [14, 12, 9], HAIR, { lw: 5, seed, light: ['#504a42', 2, -3] });
  }
  function flush(ctx, x, y, seed) { // broken veins: flat red patch + one stroke
    ST.blob(ctx, ST.ellipseRing(x, y, 18, 11, 8), 'rgba(160,60,45,0.45)', { lw: 0, seed });
    ST.stroke(ctx, [x - 10, y - 2, x - 2, y + 3, x + 8, y - 3], { w: 2, color: '#7c2a20', seed: seed + 1, taper: false });
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 10 * a[2], 9, f, { skin: SKIN, seed: SEED + 30, lw: 5, side: 0, bags: 2 });
    ST.brow(ctx, a[0], a[1] - 26, 24 * a[2], -1, f, { u: 18, thick: 6, color: HAIR, seed: SEED + 31, arch: 1.8 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 10 * b[2], 9, f, { skin: SKIN, seed: SEED + 32, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, b[0], b[1] - 26, 24 * b[2], 1, f, { u: 18, thick: 6, color: HAIR, seed: SEED + 33, arch: 1.8 });
  }
  function nose(ctx, x, y, r, seed) {
    ST.blob(ctx, [x - r, y, x - r * 0.4, y - r * 1.6, x + r * 0.5, y - r * 1.5, x + r * 1.1, y + r * 0.2, x + r * 0.6, y + r, x - r * 0.6, y + r], SKIN, { lw: 6, seed, shade: [SKIN_D, -5, 4], patch: ['rgba(190,110,90,0.6)', 3, -4, 0.4] });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-58, -10 + jaw, -68, -60, -66, -110, -52, -142, -20, -158, 20, -158, 52, -142, 66, -110, 68, -60, 58, -10 + jaw, 30, 16 + jaw, 0, 22 + jaw, -30, 16 + jaw], SKIN, Object.assign({ seed: SEED + 34 }, FACE));
    pate(ctx, [-44, -118, -52, -138, -20, -157, 20, -157, 52, -138, 44, -118, 0, -112], SEED + 35);
    [-1, 1].forEach((s) => ST.blob(ctx, [s * 64, -96, s * 84, -104, s * 84, -70, s * 66, -56], SKIN, { lw: 6, seed: SEED + 36 + s, shade: [SKIN_D, -s * 4, 2] })); // ears
    hair(ctx, [-67, -92, -64, -124, -48, -118, -54, -96], SEED + 37);
    hair(ctx, [67, -92, 64, -124, 48, -118, 54, -96], SEED + 38);
    knot(ctx, [0, -152, 0, -164, 0, -172], SEED + 39);
    flush(ctx, -38, -54, SEED + 40);
    flush(ctx, 40, -56, SEED + 42);
    eyes(ctx, f, [-24, -86, 1], [24, -88, 1]);
    ST.mouth(ctx, 0, -30, 44, f, { open: 26, teeth: 'row', seed: SEED + 44, lw: 5 });
    ST.stroke(ctx, [-34, 4 + jaw, 0, 12 + jaw, 34, 4 + jaw], { w: 4, seed: SEED + 45 }); // double chin
    nose(ctx, 0, -54, 14, SEED + 46);
    ST.wart(ctx, 30, -18, 4.5, '#5a3426', SEED + 47, true);
    ST.pores(ctx, -50, -76, 20, 18, 6, SEED + 48);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-50, -10 + jaw, -62, -60, -60, -112, -44, -144, -8, -158, 30, -154, 58, -136, 70, -106, 74, -64, 64, -12 + jaw, 40, 16 + jaw, 10, 22 + jaw, -22, 14 + jaw], SKIN, Object.assign({ seed: SEED + 50 }, FACE));
    pate(ctx, [-34, -120, -42, -140, -8, -157, 30, -153, 56, -134, 48, -118, 10, -112], SEED + 51);
    ST.blob(ctx, [-56, -96, -76, -104, -76, -70, -58, -56], SKIN, { lw: 6, seed: SEED + 52, shade: [SKIN_D, 4, 2] });
    hair(ctx, [-61, -92, -58, -126, -40, -118, -46, -96], SEED + 53);
    knot(ctx, [-16, -152, 0, -164, 18, -168], SEED + 54);
    flush(ctx, -20, -54, SEED + 55);
    flush(ctx, 52, -56, SEED + 57);
    eyes(ctx, f, [-4, -86, 1], [44, -88, 0.66]);
    ST.mouth(ctx, 22, -30, 38, f, { open: 24, teeth: 'row', seed: SEED + 59, lw: 5 });
    ST.stroke(ctx, [-16, 4 + jaw, 18, 12 + jaw, 50, 4 + jaw], { w: 4, seed: SEED + 60 });
    nose(ctx, 30, -54, 14, SEED + 61);
    ST.wart(ctx, 48, -18, 4.5, '#5a3426', SEED + 62, true);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-40, 0, -64, -40, -70, -100, -56, -142, -16, -160, 24, -152, 48, -128, 56, -100, 58, -70, 66, -48, 60, -30, 62, -14 + jaw, 46, 10 + jaw, 20, 22 + jaw, -10, 16], SKIN, Object.assign({ seed: SEED + 64 }, FACE));
    pate(ctx, [-30, -150, 0, -160, 30, -150, 50, -122, 30, -116, -10, -122, -30, -134], SEED + 65);
    hair(ctx, [-72, -84, -66, -136, -36, -142, -26, -126, -36, -104, -50, -84], SEED + 67);
    knot(ctx, [-44, -146, -20, -164, 8, -166], SEED + 68);
    ST.blob(ctx, [-26, -92, -6, -96, 0, -66, -20, -60], SKIN, { lw: 6, seed: SEED + 69, shade: [SKIN_D, -4, 2] }); // ear
    flush(ctx, 30, -52, SEED + 70);
    eyes(ctx, f, [36, -88, 0.72], null);
    ST.mouth(ctx, 48, -30, 20, f, { open: 22, teeth: 'row', seed: SEED + 72, lw: 5 });
    ST.stroke(ctx, [10, 14 + jaw, 30, 16 + jaw, 46, 8 + jaw], { w: 4, seed: SEED + 73 });
    nose(ctx, 60, -56, 13, SEED + 74);
  }
  function headBack(ctx) {
    ST.blob(ctx, [-56, -6, -68, -60, -66, -110, -52, -142, -20, -158, 20, -158, 52, -142, 66, -110, 68, -60, 56, -6, 0, 4], SKIN, Object.assign({ seed: SEED + 76 }, FACE));
    ST.blob(ctx, [-68, -60, -66, -118, -40, -146, 0, -152, 40, -146, 66, -118, 68, -60, 40, -34, 0, -28, -40, -34], HAIR, { lw: 0, seed: SEED + 77, light: ['#3b3632', 4, -4], hatch: { c: 'rgba(120,110,90,0.3)', n: 8, len: 16, gap: 4, k: 3, ang: 85 } });
    knot(ctx, [0, -144, 0, -160, 0, -170], SEED + 78);
    [-1, 1].forEach((s) => ST.stroke(ctx, [s * 30, -12, 0, -4, -s * 30, -12], { w: 3.5, seed: SEED + 79 + s })); // fat folds at the nape
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  const ARM = { cloth: HAORI, clothD: HAORI_D, w: [40, 38, 36], bare: 0.82, skin: SKIN, skinD: SKIN_D, hsz: 34, lw: 6, hatch: { c: 'rgba(120,110,90,0.25)', n: 3, len: 22, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: KIMO_D, clothD: '#2c2026', w: [40, 30, 24], shoe: C.LINEN_D, shoeD: '#5f584a', len: 58, sw: 26, lw: 6, splay: 0.4 };
  // presenting: right hand forward at chest height, palm up (the koban on it); left hand holds the abacus at the belly
  ST.merchantOffer = (Dd, out) => ({ hR: ST.handAt(Dd, -1, -0.2, 0.35, 0.55 + 0.35 * (out || 0)), kR: 'flat', poleR: [-1, 0.5, -0.4] });
  ST.merchantAbacus = (Dd) => ({ hL: ST.handAt(Dd, 1, -0.45, 0.62, 0.55), kL: 'grip', poleL: [1, 0.4, -0.4] });

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, bow, layer {L,R}, abacus (tick number),
  //    koban ([side 1 = left | 2 = right, count] on that palm), held(J) (a prop under the near hands), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'smug', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {}, bow = p.bow || 0, hy = D.hy + J.bob;
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      const g = ST.palm(j, ARM.hsz);
      ST.sode(ctx, V, j, 70, HAORI, HAORI_D, SEED + 90 + sd);
      if (sd === 1 && p.abacus !== undefined) ST.abacus(ctx, g[0] + 40, g[1], 150, 0, SEED + 93, p.abacus);
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 94 + sd }));
      if (p.koban && p.koban[0] === sd) ST.koban(ctx, g[0], g[1] - 18, p.koban[1], SEED + 97);
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      ST.bowed(ctx, hy, bow, () => armsAt(0));
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 98 + sg })));
      skirt(ctx, V.v);
      if (bow) ST.blob(ctx, ST.ellipseRing(0, hy + 4, 70, 40, 10), KIMO, { lw: 6, seed: SEED + 99 });
      ST.bowed(ctx, hy, bow, () => {
        ctx.save();
        ctx.translate(0, J.bob);
        torso(ctx, V.v);
        ctx.restore();
        armsAt(1);
        const H = ST.headView(V.yaw, p.head);
        ctx.save();
        ctx.translate(n[0], n[1] + J.bob + (p.headDy || 0));
        ctx.scale(H.flip ? -1.1 : 1.1, 1.1);
        HEADS[H.V.v](ctx, f);
        ctx.restore();
        if (p.held) p.held(J);
        armsAt(2);
        if (p.after) p.after(J);
      });
    });
  }
  ST.CAST.merchant = { name: 'The Rice Merchant', D, draw, hsz: ARM.hsz, demo: { abacus: 0 }, extraRow: ['offer + abacus', (Dd) => ({ koban: [2, 3], abacus: 1, pose: ST.pose('stand', Dd, null, Object.assign(ST.merchantOffer(Dd, 1), ST.merchantAbacus(Dd))) })] };
})();

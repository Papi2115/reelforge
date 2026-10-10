/* Main 1 - You, the young samurai. A thin, nervous lad with narrow sloped shoulders and a long neck: shaved grey
   pate with a small oiled topknot lying forward, side hair, a round soft face with a small chin, big worried eyes
   with double bags, a tiny upturned nose, peach-fuzz moustache, spots on the forehead, a shaving nick on the pate.
   Grey-blue kimono with a pale crest, olive pinstriped hakama, the two swords at the left hip, dirty tabi.
   Default: scared. Bows from the hip (p.bow). Optional jingasa hat (p.hat). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_SALLOW, SKIN_D = C.SKIN_SALLOW_D, HAIR = '#2a2521', PATE = '#8d8a76', SEED = 110;
  const KIMO = C.GREYBLUE, KIMO_D = C.GREYBLUE_D, HAKA = C.OLIVE, HAKA_D = C.OLIVE_D;
  const D = { sw: 46, sy: -540, sz: 6, l1a: 114, l2a: 106, hw: 26, hy: -330, l1l: 172, l2l: 152, elbowOut: 0.6, top: -810, waist: [58, -404], head: { x: [0, 18, 38, 0], top: -810, bottom: -600, hw: 78 } };
  const NECK = [[0, -560, 0, -612], [8, -558, 16, -608], [16, -556, 34, -602], [0, -560, 0, -612]];
  const SWORDS = { g: [44, -436, 34], h: [30, -472, 124], e: [60, -350, -246], g2: [30, -432, 42], h2: [18, -458, 108], e2: [40, -384, -150] };

  const KIMONO = [
    [-24, -576, -60, -562, -70, -520, -66, -460, -62, -418, 0, -412, 62, -418, 66, -460, 70, -520, 60, -562, 24, -576],
    [-14, -578, -54, -564, -66, -520, -62, -460, -58, -418, 10, -412, 64, -418, 70, -462, 64, -520, 46, -564, 22, -578],
    [-6, -582, -38, -568, -50, -520, -48, -460, -44, -418, 44, -418, 50, -470, 46, -524, 34, -570, 14, -582],
    [-24, -576, -62, -562, -72, -520, -68, -460, -62, -418, 0, -414, 62, -418, 68, -460, 72, -520, 62, -562, 24, -576],
  ];
  const HAKAMA_TOP = [
    [-62, -440, 62, -440, 70, -300, 0, -292, -70, -300],
    [-54, -440, 64, -440, 72, -302, 8, -294, -64, -300],
    [-42, -442, 46, -442, 56, -300, -50, -298],
    [-62, -440, 62, -440, 70, -300, 0, -294, -70, -300],
  ];
  const LAPEL = [[24, 0], [20, 18], [8, 40], null]; // [half neck width, centre x]

  function torso(ctx, v) {
    ST.blob(ctx, KIMONO[v], KIMO, { lw: 7, seed: SEED + v, shade: [KIMO_D, -18, 6], mottle: ['#485459', 5, 18], hatch: { c: 'rgba(14,18,22,0.55)', n: 7, len: 34, gap: 7, k: 3, ang: -60 } });
    const l = LAPEL[v];
    if (l) {
      const [w, x] = l;
      ST.stroke(ctx, [x - w, -578, x - w * 0.3, -540, x + 2, -512], { w: 13, color: C.LINEN, seed: SEED + 4, taper: false });
      ST.stroke(ctx, [x + w, -578, x + w * 0.2, -520, x - w * 0.9, -440], { w: 13, color: C.LINEN, seed: SEED + 5, taper: false });
      ST.stroke(ctx, [x + w + 8, -578, x + w * 0.2 + 8, -514, x - w * 0.9 + 6, -436], { w: 4.5, seed: SEED + 6 });
      [[x + 38, -528], [x - 36, -526]].slice(0, v === 0 ? 2 : v === 1 ? 1 : 0).forEach(([cx, cy], i) => ST.blob(ctx, ST.ellipseRing(cx, cy, 9, 9, 8), '#8f927f', { lw: 3.5, seed: SEED + 7 + i, inner: () => ST.stroke(ctx, [cx - 5, cy, cx + 5, cy], { w: 2, seed: SEED + 9, taper: false }) }));
    } else {
      ST.stroke(ctx, [0, -570, 2, -500, -2, -430], { w: 3.5, seed: SEED + 10 });
      ST.blob(ctx, ST.ellipseRing(0, -548, 10, 10, 8), '#8f927f', { lw: 3.5, seed: SEED + 11 });
    }
    ST.stroke(ctx, [[-60, -444, 60, -444], [-52, -444, 62, -444], [-42, -446, 46, -446], [-60, -444, 60, -444]][v], { w: 12, color: C.MUSTARD_D, seed: SEED + 12, taper: false }); // obi edge
    ST.blob(ctx, HAKAMA_TOP[v], HAKA, { lw: 7, seed: SEED + 13 + v, shade: [HAKA_D, -18, 6], mottle: ['#575530', 4, 18], hatch: { c: 'rgba(20,20,8,0.5)', n: 6, len: 60, gap: 9, k: 3, ang: 84, bend: 0.03 } });
    const xs = [[-40, -14, 14, 40], [-30, -2, 30, 54], [-20, 14, 40], [-40, -14, 14, 40]][v];
    xs.forEach((x, i) => ST.stroke(ctx, [x, -428, x + (x > 0 ? 6 : -6), -300], { w: 3, color: 'rgba(30,28,10,0.6)', seed: SEED + 18 + i, taper: false })); // pinstripe pleats
    if (v < 2) { const x = v === 0 ? 0 : 14; ST.stroke(ctx, [x - 30, -432, x, -420, x + 30, -432], { w: 7, color: HAKA_D, seed: SEED + 23, taper: false }); }
    if (v === 2) ST.rough(ctx, [-48, -458, -30, -456, -34, -404, -50, -406], HAKA_D, { seed: SEED + 24, lw: 4, amp: 1 }); // stiff back panel
    ST.stain(ctx, [20, 30, 30, -20][v], -480, 40, 26, SEED + 25, 'rgba(40,30,15,0.3)');
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], mottle: ['rgba(150,100,60,0.3)', 6, 8], hatch: { c: 'rgba(60,50,30,0.35)', n: 3, len: 16, gap: 5, k: 3, ang: 75 } };
  function ear(ctx, x, y, s, seed) {
    ST.blob(ctx, [x, y - 22, x + s * 26, y - 30, x + s * 32, y - 6, x + s * 22, y + 18, x, y + 12], SKIN, { lw: 6, seed, shade: [SKIN_D, -s * 6, 2], inner: () => ST.stroke(ctx, [x + s * 9, y - 18, x + s * 20, y - 10, x + s * 14, y + 6], { w: 3, seed: seed + 1 }) });
  }
  function pate(ctx, pts, seed) { // the shaved crown: flat grey-blue with stubble dashes and a nick
    ST.blob(ctx, pts, PATE, { lw: 0, seed });
    ST.stubble(ctx, pts, seed + 1, 40, 'rgba(40,44,46,0.45)');
  }
  function hair(ctx, pts, seed) {
    ST.blob(ctx, pts, HAIR, { lw: 5, seed, hatch: { c: 'rgba(120,110,90,0.35)', n: 2, len: 14, gap: 4, k: 3, ang: 80 } });
  }
  function knot(ctx, pts, seed) { // the oiled topknot with its paper tie
    ST.tube(ctx, pts, [18, 16, 11], HAIR, { lw: 5, seed, light: ['#4b443c', 2, -3] });
    ST.stroke(ctx, [pts[0] + 4, pts[1] - 10, pts[0] + 2, pts[1] + 8], { w: 6, color: C.LINEN, seed: seed + 1, taper: false });
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 13 * a[2], 16, f, { skin: SKIN, seed: SEED + 30, lw: 5, side: 0, bags: 2 });
    ST.brow(ctx, a[0], a[1] - 26, 26 * a[2], -1, f, { u: 18, thick: 7, color: HAIR, seed: SEED + 31 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 14 * b[2], 17, f, { skin: SKIN, seed: SEED + 32, lw: 5, side: 1, bags: b[2] < 1 ? 1 : 2 });
    ST.brow(ctx, b[0], b[1] - 28, 28 * b[2], 1, f, { u: 18, thick: 7, color: HAIR, seed: SEED + 33 });
  }
  function nose(ctx, pts, seed) {
    ST.blob(ctx, pts, SKIN, { lw: 6, seed, shade: [SKIN_D, -5, 4], patch: ['#c6b38c', 3, -8, 0.3] });
  }
  function headFront(ctx, f, hat) {
    const jaw = f.jaw * 16;
    ear(ctx, -46, -84, -1, SEED + 34);
    ear(ctx, 46, -86, 1, SEED + 36);
    ST.blob(ctx, [-40, -14 + jaw, -50, -56, -52, -104, -44, -140, -14, -158, 16, -158, 44, -140, 52, -104, 50, -56, 40, -14 + jaw, 20, 6 + jaw, 0, 12 + jaw, -20, 6 + jaw], SKIN, Object.assign({ seed: SEED + 38 }, FACE));
    pate(ctx, [-32, -126, -42, -142, -14, -157, 16, -157, 42, -142, 32, -126, 0, -120], SEED + 39);
    hair(ctx, [-53, -100, -50, -136, -32, -128, -40, -94], SEED + 41);
    hair(ctx, [53, -100, 50, -136, 32, -128, 40, -94], SEED + 42);
    knot(ctx, [0, -148, 1, -160, 0, -168], SEED + 43);
    ST.stroke(ctx, [18, -146, 26, -140], { w: 3.5, color: C.RUST, seed: SEED + 45, taper: false }); // shaving nick
    ST.pores(ctx, -24, -122, 46, 8, 5, SEED + 46, 'rgba(140,60,40,0.6)');
    eyes(ctx, f, [-19, -90, 1], [20, -92, 1]);
    ST.stubble(ctx, [-16, -46, 18, -46, 14, -38, -12, -38], SEED + 47, 14, 'rgba(50,40,30,0.5)');
    ST.mouth(ctx, 2, -30, 30, f, { open: 26, teeth: 'gap', seed: SEED + 48, lw: 5 });
    nose(ctx, [-5, -76, 8, -78, 13, -58, 5, -50, -9, -52, -11, -60], SEED + 49);
    ST.wart(ctx, -32, -44, 3.2, '#9a6a4a', SEED + 50);
    if (hat) ST.jingasa(ctx, 0, -160, 190, SEED + 51);
  }
  function head34(ctx, f, hat) {
    const jaw = f.jaw * 16;
    ear(ctx, -32, -82, -1, SEED + 52);
    ST.blob(ctx, [-34, -14 + jaw, -46, -56, -48, -104, -38, -142, -6, -158, 26, -154, 50, -134, 56, -104, 54, -84, 60, -62, 54, -16 + jaw, 34, 6 + jaw, 8, 12 + jaw, -14, 4 + jaw], SKIN, Object.assign({ seed: SEED + 54 }, FACE));
    pate(ctx, [-22, -128, -32, -146, -4, -157, 26, -153, 48, -136, 40, -124, 10, -120], SEED + 55);
    hair(ctx, [-48, -100, -44, -138, -24, -128, -32, -92], SEED + 57);
    knot(ctx, [-18, -152, 0, -168, 22, -170], SEED + 58);
    ST.pores(ctx, -6, -122, 44, 8, 5, SEED + 60, 'rgba(140,60,40,0.6)');
    eyes(ctx, f, [-2, -90, 1], [42, -92, 0.62]);
    ST.stubble(ctx, [8, -46, 44, -46, 40, -38, 10, -38], SEED + 61, 12, 'rgba(50,40,30,0.5)');
    ST.mouth(ctx, 28, -30, 26, f, { open: 24, teeth: 'gap', seed: SEED + 62, lw: 5 });
    nose(ctx, [22, -78, 34, -78, 48, -58, 40, -50, 24, -52, 20, -62], SEED + 63);
    ST.wart(ctx, -16, -44, 3.2, '#9a6a4a', SEED + 64);
    if (hat) ST.jingasa(ctx, 8, -160, 190, SEED + 51);
  }
  function headProfile(ctx, f, hat) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-30, -8, -52, -44, -60, -100, -46, -140, -10, -158, 26, -150, 44, -126, 50, -104, 46, -92, 54, -76, 52, -60, 46, -48, 48, -30, 42, -14 + jaw, 28, 2 + jaw, 6, 8 + jaw, -12, 0], SKIN, Object.assign({ seed: SEED + 66 }, FACE));
    pate(ctx, [-26, -150, -8, -158, 26, -150, 42, -128, 30, -122, 0, -128, -20, -136], SEED + 67);
    hair(ctx, [-62, -96, -58, -140, -30, -148, -18, -132, -30, -104, -40, -76], SEED + 69);
    knot(ctx, [-34, -150, -12, -168, 16, -170], SEED + 70);
    ear(ctx, -18, -82, -1, SEED + 72);
    eyes(ctx, f, [30, -90, 0.72], null);
    ST.mouth(ctx, 40, -32, 16, f, { open: 22, teeth: 'gap', seed: SEED + 74, lw: 5 });
    nose(ctx, [44, -80, 56, -76, 66, -60, 60, -52, 48, -54], SEED + 75);
    ST.pores(ctx, 14, -124, 24, 8, 3, SEED + 76, 'rgba(140,60,40,0.6)');
    if (hat) ST.jingasa(ctx, 6, -160, 190, SEED + 51);
  }
  function headBack(ctx, f, hat) {
    ear(ctx, -44, -84, -1, SEED + 77);
    ear(ctx, 44, -84, 1, SEED + 79);
    ST.blob(ctx, [-40, -8, -50, -56, -52, -104, -44, -140, -10, -158, 16, -158, 44, -140, 52, -104, 50, -56, 40, -8, 0, 2], SKIN, Object.assign({ seed: SEED + 81 }, FACE));
    ST.blob(ctx, [-52, -60, -54, -118, -40, -146, 0, -152, 40, -146, 54, -118, 52, -60, 30, -36, 0, -30, -30, -36], HAIR, { lw: 0, seed: SEED + 82, hatch: { c: 'rgba(120,110,90,0.3)', n: 10, len: 16, gap: 4, k: 3, ang: 85 } });
    knot(ctx, [0, -144, 0, -162, 0, -172], SEED + 83);
    ST.stroke(ctx, [-12, -22, -10, 8], { w: 3.5, seed: SEED + 85 });
    ST.stroke(ctx, [12, -22, 10, 8], { w: 3.5, seed: SEED + 86 });
    if (hat) ST.jingasa(ctx, 0, -160, 190, SEED + 51);
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  function neck(ctx, v, hdy) {
    const n = NECK[v];
    ST.tube(ctx, [n[0], n[1] + 10, (n[0] + n[2]) / 2, (n[1] + n[3]) / 2, n[2], n[3] + 14 + hdy], [32, 26, 28], SKIN, { lw: 6, seed: SEED + 87, shade: [SKIN_D, -6, 0] });
    if (v < 3) ST.stroke(ctx, [n[2] + v * 5, n[3] + 30, n[2] + 7 + v * 5, n[3] + 36, n[2] + 2 + v * 5, n[3] + 42], { w: 4, seed: SEED + 88 }); // Adam's apple
  }

  const ARM = { cloth: KIMO, clothD: KIMO_D, w: [34, 32, 30], bare: 0.78, skin: SKIN, skinD: SKIN_D, hsz: 32, lw: 6, hatch: { c: 'rgba(14,18,22,0.45)', n: 3, len: 22, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: HAKA, clothD: HAKA_D, w: [74, 86, 100], shoe: C.LINEN_D, shoeD: '#5f584a', len: 62, sw: 24, lw: 6, splay: 0.3, hatch: { c: 'rgba(20,20,8,0.45)', n: 3, len: 50, gap: 9, k: 3, ang: 84, bend: 0.03 } };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, bow (deg, profile views), layer {L,R}, hat,
  //    noSwords, swordTilt, bale ([w, h] between the palms), after(J) (drawn in the upper-body frame, so palms line up)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'scared', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {}, bow = p.bow || 0, hy = D.hy + J.bob;
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      ST.sode(ctx, V, j, 80, KIMO, KIMO_D, SEED + 92 + sd);
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 94 + sd }));
    });
    const swords = (front) => { if (!p.noSwords) ST.daisho(ctx, V, SWORDS, front, { tilt: p.swordTilt }); };
    const baleBehind = J.aL.behind && J.aR.behind; // back view: the bale is in front of him, hidden by his body
    const bale = () => { const a = ST.palm(J.aL, ARM.hsz), b = ST.palm(J.aR, ARM.hsz); ST.bale(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 10, p.bale[0], p.bale[1], SEED + 89); };
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      ST.bowed(ctx, hy, bow, () => { swords(false); armsAt(0); if (p.bale && baleBehind) bale(); });
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 96 + sg })));
      if (bow) ST.blob(ctx, ST.ellipseRing(-6, hy + 6, 52, 44, 10), HAKA, { lw: 6, seed: SEED + 99, shade: [HAKA_D, -10, 4] }); // seat: the hinge
      ST.bowed(ctx, hy, bow, () => {
        ctx.save();
        ctx.translate(0, J.bob);
        neck(ctx, V.v, p.headDy || 0);
        torso(ctx, V.v);
        ctx.restore();
        armsAt(1);
        const H = ST.headView(V.yaw, p.head);
        ctx.save();
        ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
        ctx.scale(H.flip ? -1.1 : 1.1, 1.1);
        HEADS[H.V.v](ctx, f, p.hat);
        ctx.restore();
        swords(true);
        if (p.bale && !baleBehind) bale();
        armsAt(2);
        if (p.after) p.after(J);
      });
    });
  }
  // world position of the katana's scabbard end (for whatever sits on it)
  function swordEnd(p, P) {
    const V = ST.view(p.yaw || 0), J = ST.solve(V, D, P), e = ST.swordEnd(V, SWORDS, p.swordTilt);
    return ST.figToWorld(p, V.mir, (p.lean || 0) + (P.lean || 0), ST.bowPt(e, D.hy + J.bob, p.bow || 0));
  }
  // world position of the crown (where the hat sits), for a hat that falls off
  function crown(p, P) {
    const V = ST.view(p.yaw || 0), J = ST.solve(V, D, P), n = NECK[V.v];
    return ST.figToWorld(p, V.mir, (p.lean || 0) + (P.lean || 0), ST.bowPt([n[2] + 7, n[3] + J.bob - 176], D.hy + J.bob, p.bow || 0));
  }
  ST.CAST.you = { name: 'You (the young samurai)', D, draw, hsz: ARM.hsz, swordEnd, crown, extraRow: ['bow 40 (side) + hat', () => ({ bow: 40, hat: true })] };
})();

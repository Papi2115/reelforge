/* Main 4 - THE FLIGHT DIRECTOR. A barrel on short legs: thick sloped shoulders, a gut over the belt that leads in
   profile, a bull neck. Big bald dome with a grey horseshoe fringe, jowls, a heavy brow ridge, a fleshy nose with
   broken veins (flat red patch + a stroke), a cleft-less double chin, stubble, a cigarette burn mark on the collar.
   Dirty white short-sleeved shirt with sleeves rolled even higher, sweat patches, a skinny black tie, a pen pocket,
   grey-blue slacks, a headset with one earpiece and a mic boom. Coffee mug always in hand. Default: deadpan. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_RUDDY, SKIN_D = C.SKIN_RUDDY_D, HAIR = '#8f897a', SEED = 510, SHIRT = '#b2a989', SHIRT_D = '#8a8166';
  const D = { sw: 70, sy: -540, sz: 10, l1a: 112, l2a: 104, hw: 40, hy: -320, l1l: 158, l2l: 142, elbowOut: 0.8, top: -800, waist: [92, -380], hsz: 38, head: { x: [0, 18, 36, 0], top: -800, bottom: -580, hw: 86 } };
  const NECK = [[0, -556, 0, -592], [8, -554, 14, -590], [16, -550, 30, -586], [0, -556, 0, -592]];

  const SHIRTS = [
    [-30, -570, -84, -558, -104, -520, -100, -460, -106, -400, -96, -344, -60, -330, 0, -326, 60, -330, 96, -344, 106, -400, 100, -460, 104, -520, 84, -558, 30, -570],
    [-20, -572, -80, -560, -100, -520, -96, -460, -100, -400, -90, -344, -54, -330, 14, -326, 72, -332, 106, -356, 116, -410, 104, -470, 96, -524, 70, -560, 24, -572],
    [-6, -574, -46, -562, -62, -520, -58, -460, -54, -400, -50, -350, -30, -330, 60, -330, 96, -360, 108, -410, 92, -470, 70, -520, 52, -560, 22, -574],
    [-30, -570, -86, -558, -106, -520, -102, -460, -106, -400, -96, -344, -60, -330, 0, -328, 60, -330, 96, -344, 106, -400, 102, -460, 106, -520, 86, -558, 30, -570],
  ];
  const PANTS = [[-80, -350, 80, -350, 84, -300, -84, -300], [-74, -350, 84, -350, 88, -300, -78, -300], [-48, -350, 60, -350, 62, -300, -52, -300], [-80, -350, 80, -350, 84, -300, -84, -300]];
  const BELT = [[-92, -346, 0, -338, 92, -346], [-86, -346, 16, -336, 98, -350], [-50, -348, 40, -340, 70, -350], [-92, -346, 0, -340, 92, -346]];

  function shirt(ctx, v) {
    ST.blob(ctx, PANTS[v], C.GREYBLUE_D, { lw: 7, seed: SEED + 40 + v, shade: ['#2b343a', -10, 4] });
    ST.blob(ctx, SHIRTS[v], SHIRT, { lw: 7, seed: SEED + v, shade: [SHIRT_D, -22, 8], mottle: ['rgba(90,80,50,0.3)', 5, 18], hatch: { c: 'rgba(40,34,20,0.5)', n: 9, len: 38, gap: 7, k: 3, ang: -60 } });
    ST.stroke(ctx, BELT[v], { w: 12, color: C.BLACK, seed: SEED + 5, taper: false });
    if (v === 3) { ST.stroke(ctx, [-40, -560, 0, -548, 40, -560], { w: 4, seed: SEED + 6 }); ST.stain(ctx, 0, -470, 70, 60, SEED + 7, 'rgba(90,80,40,0.35)'); return; }
    const x = [0, 20, 54][v], k = [1, 0.8, 0.35][v];
    ST.blob(ctx, [x - 4, -560, x + 4, -560, x + 8, -380, x, -364, x - 8, -380], C.BLACK, { lw: 4, seed: SEED + 8 }); // tie
    ST.rect(ctx, x - 9, -470, 18, 6, C.STONE, { seed: SEED + 9, lw: 2, amp: 0.5 }); // tie clip
    ST.blob(ctx, [x - 30, -572, x - 2, -548, x - 20, -540], SHIRT, { lw: 4, seed: SEED + 10 }); // collar
    ST.blob(ctx, [x + 30, -572, x + 2, -548, x + 20, -540], SHIRT, { lw: 4, seed: SEED + 11 });
    if (v < 2) {
      ST.rect(ctx, x - 70 * k, -520, 34 * k, 36, SHIRT_D, { seed: SEED + 12, lw: 4, amp: 1.5 });
      [0, 1].forEach((i) => ST.tube(ctx, [x - 62 * k + i * 12 * k, -530, x - 61 * k + i * 12 * k, -506], [5, 5], i ? C.GREYBLUE : C.BLACK, { lw: 2.5, seed: SEED + 13 + i }));
      ST.stain(ctx, x + 70 * k, -500, 40, 50, SEED + 15, 'rgba(110,96,50,0.35)'); // sweat patch
    }
    ST.stroke(ctx, [x - 30 * k, -400, x + 20 * k, -380, x + 70 * k, -396], { w: 3.5, seed: SEED + 16 }); // gut fold
    ST.blob(ctx, ST.ellipseRing(x + 22 * k, -556, 4, 3, 6), '#3a2a1c', { lw: 0, seed: SEED + 17 }); // burn mark
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -16, 10], mottle: ['#9a6650', 6, 12], hatch: { c: 'rgba(60,24,12,0.4)', n: 4, len: 18, gap: 5, k: 3, ang: 70 } };
  const STUB = 'rgba(60,50,40,0.55)';
  const FRINGE = { lw: 5, seed: SEED + 20, hatch: { c: 'rgba(40,36,30,0.55)', n: 3, len: 14, gap: 4, k: 3, ang: 80 } };
  function headset(ctx, band, cup, mic) {
    ST.stroke(ctx, band, { w: 8, color: C.BLACK, seed: SEED + 21, taper: false });
    ST.blob(ctx, ST.ellipseRing(cup[0], cup[1], 14, 18, 8), C.BLACK, { lw: 4, seed: SEED + 22 });
    if (mic) { ST.stroke(ctx, [cup[0], cup[1] + 12].concat(mic), { w: 5, color: C.BLACK_D, seed: SEED + 23, taper: false }); ST.blob(ctx, ST.ellipseRing(mic[mic.length - 2], mic[mic.length - 1], 7, 6, 6), C.BLACK, { lw: 3, seed: SEED + 24 }); }
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 11 * a[2], 12, f, { skin: SKIN, seed: SEED + 25, lw: 5, side: 0, bags: 2 });
    ST.brow(ctx, a[0], a[1] - 22, 32 * a[2], -1, f, { u: 18, thick: 11, color: HAIR, seed: SEED + 26 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 12 * b[2], 13, f, { skin: SKIN, seed: SEED + 27, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, b[0], b[1] - 22, 32 * b[2], 1, f, { u: 18, thick: 11, color: HAIR, seed: SEED + 28 });
  }
  function nose(ctx, pts, vx, vy) {
    ST.blob(ctx, pts, '#b26a52', { lw: 6, seed: SEED + 29, shade: [SKIN_D, -6, 5], patch: ['#c98a70', 4, -8, 0.3] });
    ST.blob(ctx, ST.ellipseRing(vx, vy, 9, 6, 7), 'rgba(150,40,30,0.45)', { lw: 0, seed: SEED + 30 });
    ST.stroke(ctx, [vx - 6, vy, vx + 2, vy - 3, vx + 7, vy + 2], { w: 2, color: C.RED_D, seed: SEED + 31, taper: false });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-60, -20 + jaw, -68, -70, -66, -130, -44, -164, 0, -172, 44, -164, 66, -130, 68, -70, 60, -20 + jaw, 40, 6 + jaw, 0, 14 + jaw, -40, 6 + jaw], SKIN, Object.assign({ seed: SEED + 32 }, FACE));
    ST.stubble(ctx, [-58, -50, -50, 0 + jaw, 0, 14 + jaw, 50, 0 + jaw, 58, -50, 30, -40, -30, -40], SEED + 33, 70, STUB);
    [-1, 1].forEach((s, i) => ST.blob(ctx, [s * 64, -92, s * 70, -130, s * 56, -152, s * 54, -128, s * 58, -100], HAIR, Object.assign({}, FRINGE, { seed: SEED + 34 + i })));
    [-1, 1].forEach((s, i) => ST.blob(ctx, [s * 64, -100, s * 80, -106, s * 84, -76, s * 70, -60], SKIN, { lw: 5, seed: SEED + 36 + i, shade: [SKIN_D, -4 * s, 2] })); // ears
    ST.stroke(ctx, [-50, -6 + jaw, -36, 8 + jaw], { w: 3.5, seed: SEED + 38 }); // jowls
    ST.stroke(ctx, [50, -6 + jaw, 36, 8 + jaw], { w: 3.5, seed: SEED + 39 });
    [-140, -150].forEach((y, i) => ST.stroke(ctx, [-24, y + i * 2, 0, y - 4, 24, y], { w: 3, seed: SEED + 40 + i }));
    eyes(ctx, f, [-24, -98, 1], [24, -98, 1]);
    ST.mouth(ctx, 0, -30, 46, f, { open: 28, teeth: 'few', seed: SEED + 42, lw: 5 });
    nose(ctx, [-12, -92, 12, -92, 18, -66, 22, -54, 0, -48, -22, -54, -18, -66], 6, -60);
    headset(ctx, [-70, -96, -60, -160, 0, -184, 60, -160, 70, -96], [72, -86], [60, -40, 30, -28]);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-54, -20 + jaw, -62, -70, -60, -130, -36, -166, 10, -172, 50, -160, 70, -128, 76, -96, 74, -70, 70, -20 + jaw, 48, 6 + jaw, 12, 14 + jaw, -30, 6 + jaw], SKIN, Object.assign({ seed: SEED + 43 }, FACE));
    ST.stubble(ctx, [-44, -50, -38, 0 + jaw, 12, 14 + jaw, 62, 0 + jaw, 70, -50, 44, -40, -14, -40], SEED + 44, 70, STUB);
    ST.blob(ctx, [-58, -56, -66, -118, -46, -138, -40, -96, -46, -56], HAIR, FRINGE);
    ST.blob(ctx, [-50, -100, -66, -106, -70, -76, -54, -60], SKIN, { lw: 5, seed: SEED + 45, shade: [SKIN_D, 4, 2] });
    ST.stroke(ctx, [-34, -6 + jaw, -20, 8 + jaw], { w: 3.5, seed: SEED + 46 });
    eyes(ctx, f, [-2, -98, 1], [48, -98, 0.64]);
    ST.mouth(ctx, 28, -30, 40, f, { open: 26, teeth: 'few', seed: SEED + 47, lw: 5 });
    nose(ctx, [16, -92, 32, -92, 42, -66, 48, -54, 28, -48, 12, -54, 14, -66], 32, -60);
    headset(ctx, [-58, -96, -46, -164, 10, -186, 56, -164], [-60, -86], [-44, -40, 0, -26]);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-44, -10, -66, -60, -68, -126, -44, -164, 2, -174, 40, -156, 56, -126, 58, -104, 54, -90, 60, -60, 56, -30 + jaw, 46, 4 + jaw, 20, 16 + jaw, -10, 10, -30, 2], SKIN, Object.assign({ seed: SEED + 48 }, FACE));
    ST.stubble(ctx, [0, -50, 6, 6 + jaw, 50, 2 + jaw, 56, -40, 30, -44], SEED + 49, 50, STUB);
    ST.blob(ctx, [-64, -60, -70, -112, -52, -120, -42, -96, -48, -62], HAIR, FRINGE);
    headset(ctx, [-20, -100, -26, -170, -10, -186], [-16, -86], [-4, -40, 44, -28]);
    eyes(ctx, f, [34, -98, 0.72], null);
    ST.mouth(ctx, 46, -30, 18, f, { open: 22, teeth: 'few', seed: SEED + 50, lw: 5 });
    nose(ctx, [50, -96, 64, -90, 74, -66, 78, -50, 60, -46, 50, -56], 66, -60);
  }
  function headBack(ctx) {
    ST.blob(ctx, [-60, -14, -68, -70, -66, -130, -44, -164, 0, -172, 44, -164, 66, -130, 68, -70, 60, -14, 0, 0], SKIN, Object.assign({ seed: SEED + 51 }, FACE));
    ST.blob(ctx, [-68, -40, -72, -110, -50, -100, -30, -66, 0, -58, 30, -66, 50, -100, 72, -110, 68, -40, 30, -10, 0, -6, -30, -10], HAIR, Object.assign({}, FRINGE, { lw: 0 }));
    headset(ctx, [-70, -96, -60, -160, 0, -184, 60, -160, 70, -96], [-72, -86], null);
    [-1, 1].forEach((s, i) => ST.stroke(ctx, [s * 40, -2, s * 6, 6], { w: 4, seed: SEED + 52 + i })); // neck rolls
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  const ARM = { cloth: SHIRT, clothD: SHIRT_D, w: [46, 40, 32], bare: 0, skin: SKIN, skinD: SKIN_D, hsz: D.hsz, lw: 6, cuff: SHIRT_D, hair: true, hatch: { c: 'rgba(40,34,20,0.45)', n: 3, len: 20, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: C.GREYBLUE_D, clothD: '#2b343a', w: [52, 42, 36], shoe: C.BLACK, shoeD: C.BLACK_D, len: 70, sw: 30, lw: 6, splay: 0.4 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, mug (tilt deg; in the right hand),
  //    steam, sip (mug at the lips: the mug arm goes in front of the face), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'deadpan', { talk: p.talk, look: p.look });
    const n = NECK[V.v], hasMug = p.mug !== undefined, lay = Object.assign({}, p.layer, p.sip && !J.aR.behind ? { R: 2 } : {});
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, hasMug ? 'grip' : P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      if (sd === 2 && hasMug) { const g = ST.palm(j, D.hsz); ST.mug(ctx, g[0] + 6, g[1] - 4, p.mug, SEED + 60, p.steam ? Math.floor(ST.twos(p.t || 0) * 3) % 2 : 0); }
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k === 'thumb' ? 'none' : k || 'fist', seed: SEED + 80 + sd }));
      if (k === 'thumb') ST.thumbsUp(ctx, j.h[0], j.h[1], D.hsz, SKIN, SKIN_D, SEED + 84 + sd);
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 90 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      ST.tube(ctx, [n[0], n[1] + 6, n[2], n[3] + 18 + (p.headDy || 0)], [70, 66], SKIN, { lw: 6, seed: SEED + 54, shade: [SKIN_D, -8, 0] });
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
  // the sip: mug raised to just under the chin in front of the face (the wrist stays below the head box)
  ST.directorSip = (Dd, up) => ({ hR: ST.handAt(Dd, -1, -0.4, 0.2 - up * 0.29, 0.42), poleR: [-1, 0.8, -0.2] });
  ST.CAST.director = { name: 'The Flight Director', D, draw, demo: { mug: 0, steam: true }, extraRow: ['sip / thumb', (Dd) => ({ mug: -40, sip: true, pose: ST.pose('stand', Dd, null, Object.assign(ST.directorSip(Dd, 1), { hL: ST.handAt(Dd, 1, 0.3, -0.7, 0.2), kL: 'thumb', poleL: [1, 0.2, -0.3] })) })] };
})();

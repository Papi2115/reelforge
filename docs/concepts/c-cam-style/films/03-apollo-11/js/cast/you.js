/* Main 1 - YOU, the lunar module pilot. A gangly worrier swimming in a pressure suit a size too big: narrow sloped
   shoulders inside wide suit shoulders, long neck poking out of the steel neck ring. Long oval face, weak chin, big
   unequal worried eyes, a long thin nose with a bump, an overbite with one snaggle tooth, a mole with a hair, a
   shaving nick with a scrap of plaster, double bags. Comm cap worn crooked, sweat on the brow. Default: scared.
   Suit: grubby off-white, stained knees, hose connectors on the chest, a checklist pocket on the thigh. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_SALLOW, SKIN_D = C.SKIN_SALLOW_D, SUIT = '#a8a28a', SUIT_D = '#7f7a64', SEED = 110;
  const D = { sw: 56, sy: -548, sz: 6, l1a: 118, l2a: 112, hw: 30, hy: -340, l1l: 170, l2l: 152, elbowOut: 0.7, top: -800, waist: [70, -404], hsz: 40, head: { x: [0, 18, 40, 0], top: -800, bottom: -596, hw: 70 } };
  const NECK = [[0, -566, 0, -616], [8, -564, 16, -612], [16, -560, 36, -606], [0, -566, 0, -616]]; // base x,y -> head x,y
  const RING = [0, 12, 26, 0];

  const SUITS = [
    [-30, -588, -78, -576, -100, -540, -100, -490, -88, -440, -80, -400, -86, -350, -60, -322, 0, -316, 60, -322, 86, -350, 80, -400, 88, -440, 100, -490, 100, -540, 78, -576, 30, -588],
    [-20, -590, -74, -578, -96, -540, -96, -490, -86, -440, -78, -400, -82, -350, -56, -322, 10, -316, 64, -322, 84, -352, 80, -400, 88, -446, 92, -500, 84, -546, 60, -580, 22, -592],
    [-6, -594, -44, -582, -62, -540, -60, -480, -52, -430, -50, -380, -54, -340, -34, -322, 40, -320, 58, -344, 62, -394, 70, -450, 72, -510, 58, -562, 30, -590],
    [-30, -588, -80, -576, -102, -540, -102, -490, -90, -440, -82, -400, -88, -350, -60, -322, 0, -318, 60, -322, 88, -350, 82, -400, 90, -440, 102, -490, 102, -540, 80, -576, 30, -588],
  ];
  const BELT = [[-82, -404, 0, -394, 82, -404], [-78, -404, 12, -394, 82, -402], [-50, -400, 20, -394, 62, -398], [-84, -404, 0, -396, 84, -404]];

  function suit(ctx, v) {
    ST.blob(ctx, SUITS[v], SUIT, { lw: 8, seed: SEED + v, shade: [SUIT_D, -22, 8], mottle: ['rgba(90,80,50,0.28)', 6, 18], hatch: { c: 'rgba(40,36,24,0.5)', n: 9, len: 40, gap: 7, k: 3, ang: -55 } });
    ST.stroke(ctx, BELT[v], { w: 7, color: SUIT_D, seed: SEED + 5, taper: false });
    if (v === 3) { ST.stroke(ctx, [0, -580, 4, -480, -2, -340], { w: 4.5, seed: SEED + 6 }); ST.stain(ctx, 30, -460, 50, 40, SEED + 7, 'rgba(60,50,30,0.3)'); return; }
    const x = [0, 18, 46][v], k = [1, 0.8, 0.4][v];
    ST.stroke(ctx, [x - 4, -578, x + 2, -480, x - 2, -404], { w: 4, seed: SEED + 8 }); // closure seam
    [[-34, -486, C.GREYBLUE], [-16, -470, C.RUST_D], [16, -470, C.GREYBLUE], [34, -486, C.RUST_D]].forEach(([dx, y, col], i) => {
      if (v === 2 && i < 2) return;
      ST.blob(ctx, ST.ellipseRing(x + dx * k, y, 9 * (v === 2 ? 0.6 : 1), 9, 8), col, { lw: 4, seed: SEED + 10 + i, light: ['rgba(230,220,190,0.3)', 2, -2] });
    });
    if (v < 2) ST.rect(ctx, x - 70 * k, -540, 38 * k, 22, C.MUSTARD_D, { seed: SEED + 15, lw: 3, amp: 1 }); // name tape
    ST.stain(ctx, x + 30 * k, -430, 40, 30, SEED + 16, 'rgba(70,58,30,0.3)');
    if (v === 2) ST.stroke(ctx, [-40, -520, -48, -440, -40, -380], { w: 3.5, seed: SEED + 17 });
  }
  function ring(ctx, v) {
    ST.blob(ctx, ST.ellipseRing(RING[v], -584, v === 2 ? 30 : 44, 12, 12), C.STONE, { lw: 6, seed: SEED + 18, shade: [C.STONE_D, 0, 4] });
  }

  // ---------- head per view (origin = top of the neck); the comm cap covers the skull and ears ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], mottle: ['rgba(150,110,60,0.3)', 6, 8], hatch: { c: 'rgba(60,50,30,0.35)', n: 3, len: 16, gap: 5, k: 3, ang: 75 } };
  const CAP = { lw: 6, shade: ['#7e7862', -6, 6], hatch: { c: 'rgba(40,34,20,0.45)', n: 4, len: 18, gap: 5, k: 3, ang: 80 } };
  function cap(ctx, side, top, cups, dx) { // side strips (linen) + brown crown + ear cups; dx = crooked tilt
    ST.blob(ctx, side, '#a49d82', Object.assign({ seed: SEED + 20 }, CAP));
    ST.blob(ctx, top, C.BROWN, { lw: 6, seed: SEED + 21, shade: [C.BROWN_D, -8, 6], hatch: { c: 'rgba(20,12,6,0.5)', n: 3, len: 20, gap: 5, k: 3, ang: 20 } });
    cups.forEach(([x, y, r], i) => ST.blob(ctx, ST.ellipseRing(x + dx, y, r * 0.75, r, 9), C.BLACK, { lw: 5, seed: SEED + 22 + i, light: ['rgba(200,190,160,0.25)', 3, -3] }));
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 14 * a[2], 17, f, { skin: SKIN, seed: SEED + 24, lw: 5, side: 0, bags: 2 });
    ST.brow(ctx, a[0], a[1] - 26, 30 * a[2], -1, f, { u: 18, thick: 9, color: '#5d4e30', seed: SEED + 25 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 12 * b[2], 15, f, { skin: SKIN, seed: SEED + 26, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, b[0], b[1] - 24, 28 * b[2], 1, f, { u: 18, thick: 9, color: '#5d4e30', seed: SEED + 27 });
  }
  function nick(ctx, x, y) { // shaving nick under a scrap of plaster
    ST.rough(ctx, [x - 8, y - 6, x + 8, y - 8, x + 9, y + 5, x - 7, y + 6], '#c0b089', { seed: SEED + 28, lw: 3, amp: 1 });
    ST.stroke(ctx, [x - 4, y - 2, x + 4, y + 2], { w: 2.5, color: C.RUST_D, seed: SEED + 29 });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-40, -16 + jaw, -46, -60, -48, -104, -40, -140, -10, -156, 22, -154, 44, -138, 48, -104, 46, -60, 38, -16 + jaw, 18, 6 + jaw, 0, 12 + jaw, -20, 6 + jaw], SKIN, Object.assign({ seed: SEED + 30 }, FACE));
    cap(ctx, [-50, -36, -58, -100, -50, -146, -16, -170, 22, -170, 54, -148, 60, -100, 54, -36, 42, -36, 46, -100, 32, -118, 0, -124, -32, -116, -42, -100, -40, -36], [-46, -126, -38, -154, -12, -174, 24, -174, 52, -150, 56, -128, 20, -136, -20, -134], [[-56, -78, 22], [58, -80, 22]], -2);
    ST.stroke(ctx, [-44, -36, -26, -2 + jaw, 0, 4 + jaw, 28, -2 + jaw, 46, -36], { w: 5, color: C.BROWN_D, seed: SEED + 31, taper: false }); // chin strap
    ST.pores(ctx, -38, -66, 22, 14, 6, SEED + 32, 'rgba(140,80,40,0.5)');
    eyes(ctx, f, [-19, -86, 1.08], [21, -88, 0.95]);
    ST.mouth(ctx, 2, -24, 34, f, { open: 28, teeth: 'snag', seed: SEED + 33, lw: 5 });
    ST.blob(ctx, [-6, -80, 6, -82, 10, -62, 16, -44, 6, -36, -8, -38, -10, -50], SKIN, { lw: 6, seed: SEED + 34, shade: [SKIN_D, -5, 4], patch: ['#c6b38c', 3, -8, 0.3] });
    ST.stroke(ctx, [4, -66, 10, -62], { w: 3, seed: SEED + 35 }); // the bump
    ST.wart(ctx, -28, -44, 3.5, '#7f6a4a', SEED + 36, true);
    nick(ctx, 24, -30);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-34, -14 + jaw, -44, -60, -46, -104, -36, -142, -4, -158, 30, -152, 52, -132, 56, -104, 52, -84, 60, -62, 54, -16 + jaw, 34, 6 + jaw, 8, 12 + jaw, -14, 4 + jaw], SKIN, Object.assign({ seed: SEED + 37 }, FACE));
    cap(ctx, [-44, -36, -54, -100, -44, -148, -10, -172, 28, -170, 56, -146, 58, -112, 46, -116, 30, -124, -2, -124, -26, -114, -34, -96, -30, -36], [-40, -128, -32, -156, -4, -176, 30, -172, 56, -148, 58, -128, 24, -136, -14, -134], [[-46, -78, 22]], -2);
    ST.stroke(ctx, [-34, -36, -14, -2 + jaw, 20, 6 + jaw], { w: 5, color: C.BROWN_D, seed: SEED + 38, taper: false });
    ST.pores(ctx, -24, -66, 22, 14, 6, SEED + 39, 'rgba(140,80,40,0.5)');
    eyes(ctx, f, [-1, -86, 1.08], [42, -88, 0.62]);
    ST.mouth(ctx, 28, -24, 30, f, { open: 26, teeth: 'snag', seed: SEED + 40, lw: 5 });
    ST.blob(ctx, [24, -80, 34, -80, 44, -60, 52, -44, 42, -36, 28, -38, 22, -52], SKIN, { lw: 6, seed: SEED + 41, shade: [SKIN_D, -5, 4], patch: ['#c6b38c', 3, -8, 0.3] });
    ST.wart(ctx, -12, -44, 3.5, '#7f6a4a', SEED + 42, true);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-30, -8, -52, -44, -58, -100, -44, -140, -8, -158, 26, -150, 44, -126, 48, -104, 46, -90, 52, -74, 50, -58, 44, -46, 48, -30, 40, -12 + jaw, 26, 2 + jaw, 4, 10 + jaw, -14, 0], SKIN, Object.assign({ seed: SEED + 43 }, FACE));
    cap(ctx, [-30, -20, -62, -60, -64, -120, -40, -164, 0, -176, 34, -164, 46, -128, 30, -120, 6, -118, -10, -96, -6, -20], [-50, -130, -34, -166, 0, -178, 34, -166, 48, -132, 10, -132, -20, -124], [[-22, -76, 22]], 0);
    ST.stroke(ctx, [-8, -30, 8, 2 + jaw, 30, 6 + jaw], { w: 5, color: C.BROWN_D, seed: SEED + 44, taper: false });
    eyes(ctx, f, [30, -86, 0.72], null);
    ST.mouth(ctx, 38, -26, 16, f, { open: 22, teeth: 'snag', seed: SEED + 45, lw: 5 });
    ST.blob(ctx, [42, -84, 54, -78, 64, -56, 70, -42, 56, -38, 46, -44], SKIN, { lw: 6, seed: SEED + 46, shade: [SKIN_D, -5, 4], patch: ['#c6b38c', 3, -8, 0.3] });
    ST.stroke(ctx, [56, -66, 62, -62], { w: 3, seed: SEED + 47 });
    nick(ctx, 16, -24);
  }
  function headBack(ctx) {
    ST.blob(ctx, [-38, -8, -46, -56, -48, -104, -38, -140, -10, -158, 22, -156, 44, -138, 48, -104, 46, -56, 38, -8, 0, 2], SKIN, Object.assign({ seed: SEED + 48 }, FACE));
    cap(ctx, [-52, -30, -60, -100, -50, -148, -14, -172, 22, -172, 54, -148, 60, -100, 52, -30, 0, -20], [-46, -126, -38, -154, -12, -174, 24, -174, 52, -150, 56, -126, 0, -132], [[-56, -78, 22], [58, -80, 22]], 2);
    ST.stroke(ctx, [-12, -18, -10, 8], { w: 3.5, seed: SEED + 49 });
    ST.stroke(ctx, [12, -18, 10, 8], { w: 3.5, seed: SEED + 50 });
  }
  const HEADS = [headFront, head34, headProfile, headBack];
  const SWEAT = [[[-2, -114], [-40, -62], [40, -56]], [[16, -116], [-30, -62], [54, -52]], [[30, -114], [8, -60]], []];
  const HELMET = [[2, -70], [10, -70], [16, -70], [0, -70]];

  function neck(ctx, v, hdy) {
    const n = NECK[v];
    ST.tube(ctx, [n[0], n[1] + 4, (n[0] + n[2]) / 2, (n[1] + n[3]) / 2, n[2], n[3] + 14 + hdy], [34, 28, 30], SKIN, { lw: 6, seed: SEED + 51, shade: [SKIN_D, -6, 0] });
    if (v < 3) ST.stroke(ctx, [n[2] + v * 5, n[3] + 24, n[2] + 8 + v * 5, n[3] + 30, n[2] + 2 + v * 5, n[3] + 36], { w: 4, seed: SEED + 52 }); // Adam's apple
  }

  const ARM = { cloth: SUIT, clothD: SUIT_D, w: [50, 44, 38], skin: ST.GLOVE, skinD: ST.GLOVE_D, hsz: D.hsz, lw: 7, cuff: C.STONE, hatch: { c: 'rgba(40,36,24,0.45)', n: 3, len: 24, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: SUIT, clothD: SUIT_D, w: [54, 46, 40], shoe: '#8d8874', shoeD: '#66624f', len: 76, sw: 36, lw: 7, splay: 0.3, hatch: { c: 'rgba(60,50,30,0.4)', n: 3, len: 30, gap: 6, k: 3, ang: 70 } };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, sweat, helmet (1 clear, 2 gold visor), helmetDy,
  //    checklist (page 0..1, held between the palms), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'scared', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k === 'thumb' ? 'none' : k || 'fist', seed: SEED + 80 + sd }));
      if (k === 'thumb') ST.thumbsUp(ctx, j.h[0], j.h[1], D.hsz, ST.GLOVE, ST.GLOVE_D, SEED + 84 + sd);
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 90 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      neck(ctx, V.v, p.headDy || 0);
      suit(ctx, V.v);
      ring(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.1 : 1.1, 1.1);
      HEADS[H.V.v](ctx, f);
      if (p.sweat) ST.sweat(ctx, SWEAT[H.V.v], p.t || 0, SEED + 53);
      if (p.helmet) ST.helmet(ctx, HELMET[H.V.v][0], HELMET[H.V.v][1] + (p.helmetDy || 0), 96, 104, { visor: p.helmet === 2, vx: [0, 14, 26, 0][H.V.v], seed: SEED + 54 });
      ctx.restore();
      if (p.checklist !== undefined && V.v !== 3) ST.checklist(ctx, (J.aL.h[0] + J.aR.h[0]) / 2, (J.aL.h[1] + J.aR.h[1]) / 2 + 30, 170, p.checklist, SEED + 60);
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  // holding the checklist open in front of the chest with both hands
  ST.youRead = (Dd) => ({ hL: [42, Dd.sy + 150, 112], hR: [-42, Dd.sy + 150, 112], kL: 'grip', kR: 'grip', poleL: [1, 0.6, -0.4], poleR: [-1, 0.6, -0.4] });
  ST.CAST.you = { name: 'You (lunar module pilot)', D, draw, extraRow: ['checklist', (Dd) => ({ checklist: 0.3, sweat: true, pose: ST.pose('stand', Dd, null, ST.youRead(Dd)) })] };
})();

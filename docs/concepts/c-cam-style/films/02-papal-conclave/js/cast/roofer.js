/* Townsperson - the Roofer. A lanky lad, all shins and elbows: narrow chest, knobbly long arms with the shirt sleeves
   rolled, a short clay jerkin, a scuffed leather apron with a hammer in the loop. Long thin face under a floppy
   mustard cap, big buck teeth, a sunburnt nose, jug ears, a scraggly chin tuft, spots, one eye bigger than the other.
   Props: a roof tile held in both hands, or the ladder on his shoulder. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_RUDDY, SKIN_D = C.SKIN_RUDDY_D, JERK = C.CLAY, JERK_D = C.CLAY_D, SEED = 1500;
  const D = { sw: 50, sy: -520, sz: 6, l1a: 118, l2a: 110, hw: 26, hy: -300, l1l: 160, l2l: 146, elbowOut: 0.8, top: -780, waist: [64, -330], head: { x: [0, 18, 40, 0], top: -780, bottom: -560, hw: 76 } };
  const NECK = [[0, -540, 0, -578], [8, -540, 14, -576], [18, -538, 34, -572], [0, -540, 0, -578]];

  const JERKIN = [
    [-24, -552, -58, -538, -66, -500, -62, -420, -58, -340, -66, -276, 66, -276, 58, -340, 62, -420, 66, -500, 58, -538, 24, -552],
    [-18, -554, -52, -540, -60, -500, -56, -420, -52, -340, -58, -276, 72, -276, 68, -340, 70, -420, 72, -500, 56, -538, 18, -552],
    [-10, -556, -36, -542, -44, -500, -42, -420, -38, -340, -44, -276, 50, -276, 50, -340, 56, -420, 52, -500, 40, -540, 14, -554],
    [-24, -552, -58, -538, -66, -500, -62, -420, -58, -340, -66, -276, 66, -276, 58, -340, 62, -420, 66, -500, 58, -538, 24, -552],
  ];
  const APRON = [[-46, -330, 46, -330, 54, -200, -54, -200], [-30, -330, 64, -330, 70, -200, -36, -200], [10, -330, 56, -330, 66, -200, 24, -206], null];

  function body(ctx, v) {
    ST.blob(ctx, JERKIN[v], JERK, { lw: 7, seed: SEED + v, shade: [JERK_D, -16, 6], mottle: ['#7a4e37', 5, 16], hatch: { c: 'rgba(30,16,8,0.55)', n: 7, len: 34, gap: 7, k: 3, ang: -50 } });
    if (v < 3) {
      const x = [0, 26, 48][v];
      ST.stroke(ctx, [x - 14, -548, x, -500, x + 14, -548], { w: 4, seed: SEED + 4 }); // open neck
      ST.rough(ctx, [x - 28, -470, x - 4, -474, x - 2, -440, x - 26, -438], C.MUSTARD_D, { seed: SEED + 5, lw: 4, amp: 2 }); // patch
    } else ST.stroke(ctx, [0, -546, 2, -290], { w: 3.5, seed: SEED + 6 });
    ST.stroke(ctx, [[-62, -334, 0, -326, 62, -334], [-54, -334, 10, -326, 70, -332], [-40, -336, 6, -330, 52, -334], [-62, -334, 0, -330, 62, -334]][v], { w: 12, color: C.BROWN_D, seed: SEED + 7, taper: false });
    const a = APRON[v];
    if (!a) return;
    ST.rough(ctx, a, '#5e4532', { seed: SEED + 8, lw: 6, amp: 2, shade: ['#45321f', -8, 4], hatch: { c: 'rgba(20,12,4,0.5)', n: 4, len: 30, gap: 6, k: 3, ang: 75 } });
    ST.stain(ctx, (a[0] + a[2]) / 2, -250, 40, 30, SEED + 9, 'rgba(20,14,8,0.35)');
    const hx = (a[0] + a[2]) / 2 + 20; // the hammer in the apron loop
    ST.tube(ctx, [hx, -320, hx + 4, -220], [12, 11], C.TIMBER, { lw: 4, seed: SEED + 10 });
    ST.rough(ctx, [hx - 22, -334, hx + 26, -334, hx + 26, -316, hx - 22, -316], C.STONE_D, { seed: SEED + 11, lw: 4, amp: 1 });
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], mottle: ['#9c5f4a', 5, 10], hatch: { c: 'rgba(70,25,15,0.4)', n: 3, len: 16, gap: 5, k: 3, ang: 75 } };
  function ear(ctx, x, s, seed) {
    ST.blob(ctx, [x, -110, x + s * 28, -122, x + s * 32, -90, x + s * 22, -64, x, -72], SKIN, { lw: 6, seed, shade: [SKIN_D, -s * 5, 2], inner: () => ST.stroke(ctx, [x + s * 8, -104, x + s * 20, -98, x + s * 14, -80], { w: 3, seed: seed + 1 }) });
  }
  function cap(ctx, pts, seed) { ST.blob(ctx, pts, C.MUSTARD, { lw: 6, seed, shade: [C.MUSTARD_D, -10, 6], hatch: { c: 'rgba(40,30,8,0.5)', n: 4, len: 20, gap: 5, k: 3, ang: 30 } }); }
  function spots(ctx, x, y) { [[0, 0], [14, 10], [-6, 18]].forEach(([dx, dy], i) => ST.blob(ctx, ST.ellipseRing(x + dx, y + dy, 3.5, 3, 6), '#9a4a3a', { lw: 2, seed: SEED + 12 + i })); }
  function tuft(ctx, x, jaw) { ST.blob(ctx, [x - 10, 4 + jaw, x + 10, 4 + jaw, x + 4, 30 + jaw, x - 2, 34 + jaw], '#5a4430', { lw: 4, seed: SEED + 15, hatch: { c: 'rgba(20,14,8,0.5)', n: 2, len: 12, gap: 4, k: 2, ang: 90 } }); }
  function headFront(ctx, f) {
    const jaw = f.jaw * 16;
    ear(ctx, -46, -1, SEED + 16);
    ear(ctx, 46, 1, SEED + 18);
    ST.blob(ctx, [-40, -10, -50, -60, -52, -120, -40, -160, -12, -176, 16, -176, 42, -160, 52, -120, 50, -60, 40, -10, 18, 10 + jaw, 0, 14 + jaw, -18, 10 + jaw], SKIN, Object.assign({ seed: SEED + 20 }, FACE));
    spots(ctx, -30, -50);
    ST.eye(ctx, -18, -102, 10, 11, f, { skin: SKIN, seed: SEED + 21, lw: 5, side: 0, bags: 1 });
    ST.eye(ctx, 20, -104, 13, 15, f, { skin: SKIN, seed: SEED + 22, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, -18, -124, 24, -1, f, { u: 14, thick: 9, color: '#5a4430', seed: SEED + 23 });
    ST.brow(ctx, 20, -128, 26, 1, f, { u: 14, thick: 9, color: '#5a4430', seed: SEED + 24 });
    tuft(ctx, 0, jaw);
    ST.mouth(ctx, 0, -24, 30, f, { open: 26, teeth: 'row', seed: SEED + 25, lw: 5, under: [[-0.2, -12], [0.2, -12]] });
    ST.blob(ctx, [-8, -100, 8, -100, 16, -60, 12, -44, -12, -44, -16, -60], '#b5624d', { lw: 6, seed: SEED + 26, shade: [SKIN_D, -6, 5], patch: ['#c98a70', 3, -10, 0.3] });
    cap(ctx, [-58, -138, -50, -176, -10, -196, 40, -192, 70, -170, 74, -150, 50, -150, 30, -146, -20, -144], SEED + 27);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 16;
    ear(ctx, -34, -1, SEED + 28);
    ST.blob(ctx, [-34, -10, -44, -60, -46, -120, -34, -160, -6, -178, 24, -176, 48, -158, 56, -124, 54, -104, 60, -86, 56, -60, 48, -10, 26, 10 + jaw, 6, 14 + jaw, -14, 8 + jaw], SKIN, Object.assign({ seed: SEED + 30 }, FACE));
    spots(ctx, -18, -50);
    ST.eye(ctx, -4, -102, 10, 11, f, { skin: SKIN, seed: SEED + 31, lw: 5, side: 0, bags: 1 });
    ST.eye(ctx, 40, -104, 9, 15, f, { skin: SKIN, seed: SEED + 32, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, -4, -124, 22, -1, f, { u: 14, thick: 9, color: '#5a4430', seed: SEED + 33 });
    ST.brow(ctx, 40, -128, 18, 1, f, { u: 14, thick: 9, color: '#5a4430', seed: SEED + 34 });
    tuft(ctx, 16, jaw);
    ST.mouth(ctx, 22, -24, 28, f, { open: 24, teeth: 'row', seed: SEED + 35, lw: 5, under: [[-0.1, -12], [0.3, -12]] });
    ST.blob(ctx, [12, -100, 26, -100, 40, -62, 38, -44, 16, -44, 12, -60], '#b5624d', { lw: 6, seed: SEED + 36, shade: [SKIN_D, -6, 5], patch: ['#c98a70', 3, -10, 0.3] });
    cap(ctx, [-50, -140, -42, -178, 0, -198, 50, -190, 78, -166, 80, -146, 56, -150, 30, -146, -16, -144], SEED + 37);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-28, -8, -48, -50, -54, -120, -40, -164, -6, -180, 26, -170, 42, -146, 46, -116, 54, -98, 50, -76, 44, -60, 46, -36 + jaw, 40, -12 + jaw, 24, 8 + jaw, 2, 10 + jaw, -14, 0], SKIN, Object.assign({ seed: SEED + 38 }, FACE));
    ear(ctx, -16, -1, SEED + 39);
    spots(ctx, 8, -48);
    ST.eye(ctx, 30, -104, 8, 14, f, { skin: SKIN, seed: SEED + 40, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, 30, -128, 18, 1, f, { u: 14, thick: 9, color: '#5a4430', seed: SEED + 41 });
    tuft(ctx, 18, jaw);
    ST.mouth(ctx, 40, -26, 16, f, { open: 22, teeth: 'row', seed: SEED + 42, lw: 5, under: [[0.6, -12]] });
    ST.blob(ctx, [44, -104, 56, -98, 70, -64, 62, -50, 46, -52], '#b5624d', { lw: 6, seed: SEED + 43, shade: [SKIN_D, -6, 5] });
    cap(ctx, [-52, -146, -44, -180, 0, -196, 44, -184, 70, -160, 66, -146, 30, -150, -10, -150], SEED + 44);
  }
  function headBack(ctx) {
    ear(ctx, -44, -1, SEED + 45);
    ear(ctx, 44, 1, SEED + 47);
    ST.blob(ctx, [-40, -8, -50, -60, -52, -120, -40, -160, 0, -178, 40, -160, 52, -120, 50, -60, 40, -8, 0, 4], SKIN, Object.assign({ seed: SEED + 49 }, FACE));
    ST.blob(ctx, [-52, -150, -54, -80, -44, -40, -24, -50, -10, -34, 8, -48, 24, -36, 44, -48, 54, -80, 52, -150], '#5a4430', { lw: 0, seed: SEED + 50, hatch: { c: 'rgba(20,14,8,0.6)', n: 8, len: 14, gap: 4, k: 3, ang: 85 } });
    cap(ctx, [-60, -136, -52, -176, -10, -196, 44, -190, 66, -160, 62, -136, 0, -130], SEED + 51);
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  // a curved clay roof tile, centred at x, y (two-handed carry)
  ST.roofTile = (ctx, x, y, seed) => ST.blob(ctx, [x - 54, y - 14, x - 30, y - 30, x + 30, y - 30, x + 54, y - 14, x + 50, y + 16, x - 50, y + 16], '#8a4a32', { lw: 6, seed, shade: ['#663523', -8, 6], light: ['#a8644a', 4, -5], hatch: { c: 'rgba(40,16,8,0.5)', n: 3, len: 30, gap: 6, k: 2, ang: 0 } });

  const ARM = { cloth: C.LINEN, clothD: C.LINEN_D, w: [32, 28, 24], bare: 0.25, skin: SKIN, skinD: SKIN_D, hsz: 32, lw: 6, cuff: C.LINEN_D, hair: true, hatch: { c: 'rgba(60,50,30,0.5)', n: 3, len: 20, gap: 5, k: 3, ang: 30 } };
  const LEG = { cloth: C.BROWN, clothD: C.BROWN_D, w: [32, 24, 20], shoe: '#3d2f24', shoeD: '#2a2019', len: 66, sw: 22, lw: 6, splay: 0.3 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, tile (two hands), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'deadpan', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, p.tile ? 'grip' : P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, p.tile ? 'grip' : P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const tileLayer = Math.max(arms[0][3], arms[1][3]);
    const armsAt = (layer) => {
      if (p.tile && layer === tileLayer) { const a = ST.palm(J.aL, ARM.hsz), b = ST.palm(J.aR, ARM.hsz); ST.roofTile(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 10, SEED + 60); }
      arms.forEach(([j, k, sd, l]) => { if (l === layer) ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 70 + sd })); });
    };
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 75 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      const nk = NECK[V.v];
      ST.tube(ctx, [nk[0], nk[1] + 10, nk[2], nk[3] + 14 + (p.headDy || 0)], [30, 28], SKIN, { lw: 6, seed: SEED + 80, shade: [SKIN_D, -5, 0] });
      body(ctx, V.v);
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
  const lift = { hL: [D.sw * 0.4, D.sy - 0.3 * (D.l1a + D.l2a), 0.75 * (D.l1a + D.l2a)], hR: [-D.sw * 0.4, D.sy - 0.3 * (D.l1a + D.l2a), 0.75 * (D.l1a + D.l2a)], poleL: [1, 0.3, -0.3], poleR: [-1, 0.3, -0.3] };
  ST.CAST.roofer = { name: 'The Roofer', D, draw, lift, extraRow: ['tile up', () => ({ tile: true, pose: Object.assign(ST.pose('stand', D), lift), expr: 'smug' })] };
})();

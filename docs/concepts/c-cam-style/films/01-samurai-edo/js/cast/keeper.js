/* Cast 5 - the Storehouse Keeper (hands out the rice stipend). A squat barrel of a labourer: shoulders as wide as he
   is tall-ish, short bowed legs in tight dark leggings, long hairy forearms. Square block of a head bound with a
   twisted linen headband, flat wide nose, heavy jaw with a gap in the teeth, a cauliflower ear, black stubble, a
   sweat stain. Indigo-grey work jacket with a big round mark on the back, rope sash, straw sandals. Default: deadpan. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_CLAY, SKIN_D = C.SKIN_CLAY_D, HAIR = '#1f1b18', PATE = '#7e6650', SEED = 510;
  const JACK = '#3f4a52', JACK_D = '#2c353b';
  const D = { sw: 64, sy: -480, sz: 4, l1a: 112, l2a: 106, hw: 34, hy: -290, l1l: 140, l2l: 130, elbowOut: 0.75, top: -720, waist: [80, -350], head: { x: [0, 14, 28, 0], top: -720, bottom: -500, hw: 82 } };
  const NECK = [[0, -504], [10, -504], [20, -500], [0, -504]];

  const JACKET = [
    [-40, -514, -96, -500, -108, -456, -102, -380, -98, -300, -100, -250, 0, -244, 100, -250, 98, -300, 102, -380, 108, -456, 96, -500, 40, -514],
    [-30, -516, -88, -502, -100, -456, -96, -380, -92, -300, -94, -250, 14, -244, 104, -250, 104, -300, 104, -384, 100, -458, 80, -504, 30, -516],
    [-14, -520, -58, -506, -74, -456, -72, -380, -66, -300, -68, -250, 60, -248, 76, -300, 80, -384, 74, -460, 50, -508, 20, -520],
    [-40, -514, -98, -500, -110, -456, -104, -380, -98, -300, -100, -250, 0, -246, 100, -250, 98, -300, 104, -380, 110, -456, 98, -500, 40, -514],
  ];

  function torso(ctx, v) {
    ST.blob(ctx, JACKET[v], JACK, { lw: 8, seed: SEED + v, shade: [JACK_D, -20, 8], mottle: ['#36414a', 6, 22], hatch: { c: 'rgba(10,14,18,0.55)', n: 9, len: 40, gap: 8, k: 3, ang: -60 } });
    if (v < 3) {
      const x = [0, 20, 52][v];
      ST.blob(ctx, [x - 22, -514, x + 22, -514, x + 10, -330, x - 10, -330], SKIN, { lw: 5, seed: SEED + 4, shade: [SKIN_D, -6, 4], hatch: { c: 'rgba(30,18,10,0.6)', n: 4, len: 10, gap: 4, k: 3, ang: 70 } }); // chest hair in the open front
      ST.stroke(ctx, [x - 24, -516, x - 12, -420, x - 8, -250], { w: 16, color: JACK_D, seed: SEED + 5, taper: false });
      ST.stroke(ctx, [x + 24, -516, x + 12, -420, x + 8, -250], { w: 16, color: JACK_D, seed: SEED + 6, taper: false });
    } else {
      ST.blob(ctx, ST.ellipseRing(0, -420, 50, 50, 14), C.LINEN_D, { lw: 6, seed: SEED + 7, inner: () => ST.bale(ctx, 0, -420, 64, 40, SEED + 8) }); // the store's mark: a rice bale
    }
    ST.stroke(ctx, [[-100, -320, 0, -306, 100, -320], [-92, -320, 20, -306, 104, -318], [-66, -322, 20, -310, 78, -320], [-100, -320, 0, -308, 100, -320]][v], { w: 14, color: '#8a7650', seed: SEED + 9, taper: false });
    ST.stain(ctx, [-50, -40, 30, 40][v], -470, 50, 40, SEED + 10, 'rgba(20,24,28,0.4)'); // sweat
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 8, shade: [SKIN_D, -16, 8], mottle: ['rgba(120,70,40,0.35)', 6, 12], hatch: { c: 'rgba(60,36,20,0.4)', n: 4, len: 16, gap: 5, k: 3, ang: 70 } };
  const STUB = 'rgba(28,22,18,0.6)';
  function band(ctx, pts, seed) { // twisted linen headband
    ST.stroke(ctx, pts, { w: 16, color: C.LINEN, seed, taper: false });
    for (let i = 2; i < pts.length - 2; i += 2) ST.stroke(ctx, [pts[i] - 6, pts[i + 1] - 9, pts[i] + 6, pts[i + 1] + 9], { w: 3, seed: seed + i, taper: false });
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 10 * a[2], 10, f, { skin: SKIN, seed: SEED + 30, lw: 5, side: 0, bags: 1 });
    ST.brow(ctx, a[0], a[1] - 20, 30 * a[2], -1, f, { u: 18, thick: 12, color: HAIR, seed: SEED + 31, arch: 0.4 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 10 * b[2], 10, f, { skin: SKIN, seed: SEED + 32, lw: 5, side: 1, bags: 1 });
    ST.brow(ctx, b[0], b[1] - 20, 30 * b[2], 1, f, { u: 18, thick: 12, color: HAIR, seed: SEED + 33, arch: 0.4 });
  }
  function nose(ctx, x, y, w, seed) { // flat and wide
    ST.blob(ctx, [x - w, y, x - w * 0.4, y - 26, x + w * 0.4, y - 26, x + w, y, x + w * 0.5, y + 10, x - w * 0.5, y + 10], SKIN, { lw: 6, seed, shade: [SKIN_D, -5, 4] });
    [-1, 1].forEach((s) => ST.stroke(ctx, [x + s * w * 0.5, y + 2, x + s * w * 0.2, y + 6], { w: 3, seed: seed + s, taper: false }));
  }
  function caulEar(ctx, x, y, s, seed) {
    ST.blob(ctx, [x, y - 22, x + s * 24, y - 26, x + s * 30, y, x + s * 20, y + 18, x, y + 12], SKIN, { lw: 6, seed, shade: [SKIN_D, -s * 5, 2], patch: ['rgba(90,50,40,0.45)', 0, 0, 0.5] });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 16;
    caulEar(ctx, -56, -76, -1, SEED + 34);
    caulEar(ctx, 56, -76, 1, SEED + 36);
    ST.blob(ctx, [-60, -8 + jaw, -62, -60, -58, -112, -46, -140, -14, -150, 16, -150, 46, -140, 58, -112, 62, -60, 60, -8 + jaw, 30, 12 + jaw, 0, 16 + jaw, -30, 12 + jaw], SKIN, Object.assign({ seed: SEED + 38 }, FACE));
    ST.blob(ctx, [-40, -132, -14, -149, 16, -149, 40, -132, 0, -124], PATE, { lw: 0, seed: SEED + 39 });
    ST.tube(ctx, [0, -144, 0, -158, 2, -164], [12, 10, 8], HAIR, { lw: 4, seed: SEED + 40 });
    band(ctx, [-60, -112, -20, -122, 20, -122, 60, -112], SEED + 41);
    ST.stubble(ctx, [-56, -46, -50, 6 + jaw, 0, 16 + jaw, 50, 6 + jaw, 56, -46, 20, -30, -20, -30], SEED + 46, 80, STUB);
    eyes(ctx, f, [-22, -84, 1], [24, -86, 1]);
    ST.mouth(ctx, 0, -20, 46, f, { open: 30, teeth: 'gap', seed: SEED + 47, lw: 6 });
    nose(ctx, 0, -42, 22, SEED + 48);
    ST.wart(ctx, 38, -36, 4, '#5e3828', SEED + 50);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 16;
    caulEar(ctx, -44, -76, -1, SEED + 51);
    ST.blob(ctx, [-52, -8 + jaw, -56, -60, -52, -112, -38, -142, -2, -152, 30, -148, 56, -134, 68, -110, 70, -60, 66, -8 + jaw, 40, 12 + jaw, 12, 16 + jaw, -20, 12 + jaw], SKIN, Object.assign({ seed: SEED + 53 }, FACE));
    ST.blob(ctx, [-30, -134, -2, -151, 30, -147, 54, -132, 14, -124], PATE, { lw: 0, seed: SEED + 54 });
    ST.tube(ctx, [-10, -146, 4, -158, 18, -162], [12, 10, 8], HAIR, { lw: 4, seed: SEED + 55 });
    band(ctx, [-54, -110, -10, -122, 30, -122, 70, -112], SEED + 56);
    ST.stubble(ctx, [-48, -46, -40, 6 + jaw, 12, 16 + jaw, 62, 6 + jaw, 68, -46, 34, -30, -6, -30], SEED + 61, 80, STUB);
    eyes(ctx, f, [-4, -84, 1], [46, -86, 0.66]);
    ST.mouth(ctx, 24, -20, 40, f, { open: 28, teeth: 'gap', seed: SEED + 62, lw: 6 });
    nose(ctx, 30, -42, 20, SEED + 63);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-44, 0, -62, -50, -62, -110, -46, -142, -10, -154, 26, -146, 46, -124, 54, -100, 56, -60, 62, -40, 56, -24, 60, -8 + jaw, 48, 12 + jaw, 20, 18 + jaw, -14, 12], SKIN, Object.assign({ seed: SEED + 65 }, FACE));
    ST.blob(ctx, [-24, -146, -10, -153, 26, -145, 44, -124, 10, -126], PATE, { lw: 0, seed: SEED + 66 });
    ST.blob(ctx, [-62, -60, -60, -120, -40, -132, -30, -100, -40, -60], HAIR, { lw: 5, seed: SEED + 67 });
    ST.tube(ctx, [-34, -146, -14, -160, 6, -162], [12, 10, 8], HAIR, { lw: 4, seed: SEED + 68 });
    caulEar(ctx, -22, -76, -1, SEED + 69);
    band(ctx, [-64, -104, -20, -120, 30, -122, 56, -112], SEED + 70);
    ST.stubble(ctx, [-6, -46, -2, 10 + jaw, 50, 14 + jaw, 56, -30, 30, -34], SEED + 75, 60, STUB);
    eyes(ctx, f, [34, -84, 0.72], null);
    ST.mouth(ctx, 48, -20, 20, f, { open: 24, teeth: 'gap', seed: SEED + 76, lw: 6 });
    nose(ctx, 58, -42, 12, SEED + 77);
  }
  function headBack(ctx) {
    caulEar(ctx, -56, -76, -1, SEED + 79);
    caulEar(ctx, 56, -76, 1, SEED + 81);
    ST.blob(ctx, [-60, -6, -62, -60, -58, -112, -46, -140, -14, -150, 16, -150, 46, -140, 58, -112, 62, -60, 60, -6, 0, 6], SKIN, Object.assign({ seed: SEED + 83 }, FACE));
    ST.blob(ctx, [-60, -50, -60, -118, -40, -142, 0, -148, 40, -142, 60, -118, 60, -50, 30, -30, 0, -26, -30, -30], HAIR, { lw: 0, seed: SEED + 84, hatch: { c: 'rgba(120,110,90,0.3)', n: 10, len: 16, gap: 4, k: 3, ang: 85 } });
    ST.tube(ctx, [0, -140, 0, -156, 0, -164], [12, 10, 8], HAIR, { lw: 4, seed: SEED + 85 });
    band(ctx, [-62, -112, -20, -116, 20, -116, 62, -112], SEED + 86);
    ST.blob(ctx, [-4, -114, -30, -96, -18, -86, 2, -108, 26, -90, 34, -100], C.LINEN, { lw: 4, seed: SEED + 91 }); // the knot
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  const ARM = { cloth: JACK, clothD: JACK_D, w: [46, 40, 36], bare: 0.3, skin: SKIN, skinD: SKIN_D, hsz: 40, lw: 7, hair: true, hatch: { c: 'rgba(10,14,18,0.45)', n: 3, len: 24, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: C.BLACK, clothD: C.BLACK_D, w: [48, 34, 26], shoe: '#8f7c4e', shoeD: '#6a5a36', len: 62, sw: 28, lw: 6, splay: 0.5 };
  // holding the bale out in front: both hands at its sides, chest height (wide = half the bale width in arm units)
  ST.keeperHold = (Dd, wide, down, fwd) => ({ hL: ST.handAt(Dd, 1, wide, down, fwd), hR: ST.handAt(Dd, -1, wide, down, fwd), kL: 'grip', kR: 'grip', poleL: [1, 0.3, -0.4], poleR: [-1, 0.3, -0.4] });

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, bale ([w, h]: held between the palms,
  //    over the far hand, under the near one), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'deadpan', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => { if (l === layer) ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 92 + sd })); });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 95 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      ST.tube(ctx, [n[0], n[1] + 24, n[0] + V.v * 2, n[1] - 14], [74, 70], SKIN, { lw: 6, seed: SEED + 98, shade: [SKIN_D, -6, 0] });
      torso(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[0], n[1] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.1 : 1.1, 1.1);
      HEADS[H.V.v](ctx, f);
      ctx.restore();
      if (p.bale) { const a = ST.palm(J.aL, ARM.hsz), b = ST.palm(J.aR, ARM.hsz); ST.bale(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 10, p.bale[0], p.bale[1], SEED + 99); }
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.keeper = { name: 'The Storehouse Keeper', D, draw, hsz: ARM.hsz, extraRow: ['bale', (Dd) => ({ bale: [230, 150], pose: ST.pose('stand', Dd, null, ST.keeperHold(Dd, -0.05, 0.42, 0.5)) })] };
})();

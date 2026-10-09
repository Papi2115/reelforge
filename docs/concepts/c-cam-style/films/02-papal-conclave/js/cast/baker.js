/* Townsperson - the Baker. A broad, short, top-heavy woman: shoulders like a door, huge floury forearms with the
   sleeves shoved up, a mustard dress under a flour-caked linen apron, a knotted linen headscarf. Square heavy face,
   small hard eyes, a flour smear across one cheek, a hairy mole, a faint moustache, a missing tooth, a double chin.
   Props: the single loaf (right hand) and a water jug (left hand). Unimpressed by cardinals. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_RUDDY, SKIN_D = C.SKIN_RUDDY_D, DRESS = C.MUSTARD_D, DRESS_D = '#584819', SEED = 1600;
  const D = { sw: 76, sy: -430, sz: 4, l1a: 92, l2a: 86, hw: 40, hy: -196, l1l: 104, l2l: 94, elbowOut: 0.9, top: -650, waist: [92, -300], head: { x: [0, 18, 34, 0], top: -650, bottom: -440, hw: 90 } };
  const NECK = [[0, -448], [12, -448], [24, -444], [0, -448]];

  const DRESSES = [
    [-36, -460, -92, -446, -108, -410, -100, -330, -90, -290, -110, -180, -126, -24, 126, -24, 110, -180, 90, -290, 100, -330, 108, -410, 92, -446, 36, -460],
    [-28, -462, -84, -448, -98, -410, -92, -330, -80, -290, -98, -180, -112, -24, 136, -24, 122, -180, 104, -290, 122, -340, 120, -410, 88, -446, 30, -460],
    [-18, -466, -58, -448, -70, -404, -64, -320, -60, -280, -76, -170, -88, -24, 100, -24, 92, -170, 84, -270, 112, -330, 108, -400, 76, -446, 30, -464],
    [-36, -460, -92, -446, -108, -410, -100, -330, -90, -290, -110, -180, -126, -24, 126, -24, 110, -180, 90, -290, 100, -330, 108, -410, 92, -446, 36, -460],
  ];
  const APRONS = [
    [-74, -400, 74, -400, 82, -300, 96, -60, -96, -60, -82, -300],
    [-54, -400, 96, -400, 104, -300, 116, -60, -66, -60, -60, -300],
    [30, -400, 104, -392, 104, -300, 94, -60, 20, -60, 30, -300],
    null,
  ];

  function body(ctx, v) {
    ST.blob(ctx, DRESSES[v], DRESS, { lw: 8, seed: SEED + v, shade: [DRESS_D, -22, 8], mottle: ['#665420', 5, 22], hatch: { c: 'rgba(30,24,6,0.55)', n: 9, len: 50, gap: 8, k: 3, ang: 84, bend: 0.06 } });
    const a = APRONS[v];
    if (a) {
      ST.blob(ctx, a, C.LINEN, { lw: 6, seed: SEED + 5 + v, shade: [C.LINEN_D, -14, 6], mottle: ['rgba(220,214,190,0.55)', 6, 20], hatch: { c: 'rgba(60,50,30,0.45)', n: 6, len: 40, gap: 7, k: 3, ang: 82 } });
      ST.stain(ctx, (a[0] + a[2]) / 2 + 10, -200, 60, 40, SEED + 9, 'rgba(70,40,20,0.3)');
    } else ST.stroke(ctx, [-6, -300, 0, -290, 6, -300, 0, -270], { w: 5, color: C.LINEN_D, seed: SEED + 10, taper: false }); // apron bow at the back
    ST.stroke(ctx, [[-92, -296, 0, -288, 92, -296], [-82, -296, 20, -286, 108, -296], [-60, -298, 30, -292, 90, -290], [-92, -296, 0, -290, 92, -296]][v], { w: 9, color: C.LINEN_D, seed: SEED + 11, taper: false });
    if (v < 3) ST.stroke(ctx, [[-30, -458, 0, -430, 30, -458], [-12, -458, 20, -430, 46, -456], [40, -462, 60, -436, 70, -446], null][v], { w: 4.5, seed: SEED + 12 }); // neckline
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -16, 8], mottle: ['#9c5f4a', 6, 12], hatch: { c: 'rgba(70,25,15,0.4)', n: 3, len: 16, gap: 5, k: 3, ang: 70 } };
  function scarf(ctx, pts, knot, seed) {
    ST.blob(ctx, pts, C.LINEN, { lw: 7, seed, shade: [C.LINEN_D, -10, 6], hatch: { c: 'rgba(60,50,30,0.5)', n: 5, len: 22, gap: 5, k: 3, ang: 30 } });
    if (knot) [[-1, 0], [1, 1]].forEach(([s, i]) => ST.blob(ctx, [knot[0], knot[1], knot[0] + s * 30, knot[1] - 22, knot[0] + s * 34, knot[1] + 4], C.LINEN, { lw: 5, seed: seed + 2 + i, shade: [C.LINEN_D, -4, 3] }));
  }
  function flour(ctx, x, y) { ST.blob(ctx, [x - 12, y - 4, x + 6, y - 10, x + 12, y + 2, x - 2, y + 9], 'rgba(225,218,196,0.45)', { lw: 0, seed: SEED + 13 }); }
  function headFront(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-60, -10, -68, -60, -66, -110, -52, -140, -16, -152, 18, -152, 52, -140, 66, -110, 68, -60, 60, -10, 34, 12 + jaw, 0, 18 + jaw, -34, 12 + jaw], SKIN, Object.assign({ seed: SEED + 20 }, FACE));
    flour(ctx, 34, -52);
    ST.eye(ctx, -24, -88, 9, 10, f, { skin: SKIN, seed: SEED + 21, lw: 5, side: 0, bags: 2 });
    ST.eye(ctx, 24, -88, 9, 10, f, { skin: SKIN, seed: SEED + 22, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, -24, -108, 26, -1, f, { u: 14, thick: 10, color: '#4e3a2a', seed: SEED + 23 });
    ST.brow(ctx, 24, -108, 26, 1, f, { u: 14, thick: 10, color: '#4e3a2a', seed: SEED + 24 });
    ST.stubble(ctx, [-20, -40, 20, -40, 22, -30, -22, -30], SEED + 25, 14, 'rgba(70,40,30,0.45)'); // faint moustache
    ST.mouth(ctx, 0, -24, 34, f, { open: 24, teeth: 'gap', seed: SEED + 26, lw: 5 });
    ST.stroke(ctx, [-32, 8 + jaw, 0, 18 + jaw, 32, 8 + jaw], { w: 4, seed: SEED + 27 });
    ST.blob(ctx, [-10, -82, 10, -82, 18, -56, 10, -44, -10, -44, -18, -56], SKIN, { lw: 6, seed: SEED + 28, shade: [SKIN_D, -5, 4], patch: ['#c08a70', 3, -8, 0.3] });
    ST.wart(ctx, -40, -34, 5, '#6a3a28', SEED + 29, true);
    scarf(ctx, [-74, -50, -76, -120, -56, -160, 0, -174, 56, -160, 76, -120, 74, -50, 60, -60, 58, -126, 0, -138, -58, -126, -60, -60], [0, -168], SEED + 30);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-54, -10, -62, -60, -60, -110, -46, -140, -8, -152, 26, -150, 56, -136, 68, -110, 74, -80, 70, -50, 62, -10, 40, 12 + jaw, 6, 18 + jaw, -28, 12 + jaw], SKIN, Object.assign({ seed: SEED + 32 }, FACE));
    flour(ctx, 50, -52);
    ST.eye(ctx, -6, -88, 9, 10, f, { skin: SKIN, seed: SEED + 33, lw: 5, side: 0, bags: 2 });
    ST.eye(ctx, 42, -88, 6, 10, f, { skin: SKIN, seed: SEED + 34, lw: 5, side: 1, bags: 1 });
    ST.brow(ctx, -6, -108, 24, -1, f, { u: 14, thick: 10, color: '#4e3a2a', seed: SEED + 35 });
    ST.brow(ctx, 42, -108, 18, 1, f, { u: 14, thick: 10, color: '#4e3a2a', seed: SEED + 36 });
    ST.mouth(ctx, 24, -24, 30, f, { open: 22, teeth: 'gap', seed: SEED + 37, lw: 5 });
    ST.stroke(ctx, [-8, 8 + jaw, 24, 18 + jaw, 54, 8 + jaw], { w: 4, seed: SEED + 38 });
    ST.blob(ctx, [14, -82, 30, -82, 44, -56, 36, -44, 16, -44, 10, -56], SKIN, { lw: 6, seed: SEED + 39, shade: [SKIN_D, -5, 4], patch: ['#c08a70', 3, -8, 0.3] });
    ST.wart(ctx, -22, -34, 5, '#6a3a28', SEED + 29, true);
    scarf(ctx, [-70, -50, -72, -120, -50, -160, 10, -174, 60, -158, 78, -116, 76, -80, 66, -110, 10, -136, -54, -126, -56, -60], [6, -168], SEED + 40);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-50, -10, -64, -60, -64, -110, -46, -142, -6, -154, 32, -146, 54, -120, 60, -96, 70, -76, 62, -60, 64, -40, 62, -22 + jaw, 56, -4 + jaw, 40, 12 + jaw, 6, 16 + jaw, -24, 8], SKIN, Object.assign({ seed: SEED + 42 }, FACE));
    flour(ctx, 30, -52);
    ST.eye(ctx, 40, -88, 6, 10, f, { skin: SKIN, seed: SEED + 43, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, 40, -108, 18, 1, f, { u: 14, thick: 10, color: '#4e3a2a', seed: SEED + 44 });
    ST.mouth(ctx, 54, -24, 14, f, { open: 20, teeth: 'gap', seed: SEED + 45, lw: 5 });
    ST.stroke(ctx, [46, 10 + jaw, 24, 18 + jaw, 4, 12], { w: 4, seed: SEED + 46 });
    scarf(ctx, [-70, -40, -72, -110, -50, -156, 0, -172, 44, -160, 62, -126, 56, -110, 20, -134, -30, -126, -40, -60, -50, -30], [-40, -150], SEED + 47);
  }
  function headBack(ctx) {
    ST.blob(ctx, [-60, -10, -68, -60, -66, -110, -52, -140, 0, -152, 52, -140, 66, -110, 68, -60, 60, -10, 0, 4], SKIN, Object.assign({ seed: SEED + 49 }, FACE));
    ST.stroke(ctx, [-40, -6, 0, 4, 40, -6], { w: 4.5, seed: SEED + 50 });
    scarf(ctx, [-76, -30, -78, -110, -56, -160, 0, -176, 56, -160, 78, -110, 76, -30, 40, -14, 0, -10, -40, -14], [0, -172], SEED + 51);
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  // round dark loaf / water jug centred at the grip (figure space)
  ST.loaf = (ctx, x, y, seed) => {
    ST.blob(ctx, ST.ellipseRing(x, y, 56, 36, 10), '#7a4a26', { lw: 6, seed, shade: ['#5a341a', -8, 8], light: ['#9a6a3e', 6, -8], mottle: ['rgba(220,200,150,0.35)', 4, 8] });
    [-18, 6, 28].forEach((dx, i) => ST.stroke(ctx, [x + dx - 12, y - 22, x + dx + 2, y - 10, x + dx + 8, y + 2], { w: 3.5, seed: seed + 1 + i }));
  };
  ST.jug = (ctx, x, y, seed) => {
    ST.blob(ctx, [x - 20, y - 70, x + 20, y - 70, x + 22, y - 54, x + 40, y - 20, x + 36, y + 30, x - 36, y + 30, x - 40, y - 20, x - 22, y - 54], C.STONE_D, { lw: 6, seed, shade: ['#45413a', -8, 6], hatch: { c: 'rgba(20,18,14,0.45)', n: 3, len: 30, gap: 6, k: 3, ang: 80 } });
    ST.blob(ctx, ST.ellipseRing(x, y - 70, 20, 6, 8), '#2b3034', { lw: 4, seed: seed + 1 });
  };

  const ARM = { cloth: DRESS, clothD: DRESS_D, w: [56, 50, 46], bare: 0.1, skin: SKIN, skinD: SKIN_D, hsz: 40, lw: 7, cuff: DRESS_D, hatch: { c: 'rgba(30,24,6,0.5)', n: 3, len: 26, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: '#3d3a2c', clothD: '#2a281e', w: [40, 32, 26], shoe: C.BROWN_D, shoeD: '#2a2019', len: 54, sw: 30, lw: 6, splay: 0.45 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, loaf (right), jug (left), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'deadpan', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, p.jug ? 'grip' : P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, p.loaf ? 'grip' : P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      const g = ST.palm(j, ARM.hsz);
      if (sd === 2 && p.loaf) ST.loaf(ctx, g[0], g[1] - 6, SEED + 60);
      if (sd === 1 && p.jug) ST.jug(ctx, g[0], g[1] + 20, SEED + 64);
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 70 + sd }));
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 75 + sg })));
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
  const serve = { hR: [-D.sw * 0.4, D.sy + 0.5 * (D.l1a + D.l2a), 0.62 * (D.l1a + D.l2a)], poleR: [-1, 0.4, -0.5] };
  ST.CAST.baker = { name: 'The Baker', D, draw, serve, demo: { loaf: true, jug: true }, extraRow: ['serving', () => ({ pose: Object.assign(ST.pose('stand', D), serve), expr: 'disgust' })] };
})();

/* Main 4 - THE AGENT, the federal task force in one tired man. A tall plank (axis: height and stiffness): straight
   up and down, square shoulders, long legs. A long rectangular head under a flat-top brush cut, ears flat to the
   skull, tiny patient eyes, a long upper lip, a square jaw with a dimple, a shaving nick, a mole by the nose. Grey
   short-sleeved shirt, a narrow black tie, grey slacks, black shoes. Never hurries; always behind a newspaper or
   eating a sandwich. Default: deadpan. He is in the background of almost every shot. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_GREY, SKIN_D = C.SKIN_GREY_D, HAIR = '#3a3128', SHIRT = '#8f9290', SHIRT_D = '#666a68', SEED = 710;
  const D = { sw: 62, sy: -604, sz: 6, l1a: 126, l2a: 118, hw: 34, hy: -370, l1l: 190, l2l: 176, elbowOut: 0.7, top: -890, waist: [72, -470], hsz: 38, head: { x: [0, 12, 24, 0], top: -890, bottom: -652, hw: 64 } };
  const NECK = [[0, -622, 0, -666], [6, -620, 10, -662], [10, -616, 20, -658], [0, -622, 0, -666]];
  const OX = [0, 16, 40, 0], OK = [1, 0.8, 0.4, 0];

  const SHIRTS = [
    [-30, -642, -86, -632, -98, -600, -92, -520, -86, -440, -86, -380, -60, -368, 0, -366, 60, -368, 86, -380, 86, -440, 92, -520, 98, -600, 86, -632, 30, -642],
    [-22, -644, -82, -634, -94, -600, -88, -520, -82, -440, -82, -380, -54, -368, 10, -366, 66, -368, 90, -382, 90, -444, 92, -524, 90, -602, 74, -634, 24, -644],
    [-10, -646, -46, -636, -58, -600, -54, -520, -50, -440, -52, -380, -36, -368, 30, -366, 50, -380, 54, -440, 60, -520, 58, -600, 44, -634, 18, -646],
    [-30, -642, -86, -632, -98, -600, -92, -520, -86, -440, -86, -380, -60, -368, 0, -366, 60, -368, 86, -380, 86, -440, 92, -520, 98, -600, 86, -632, 30, -642],
  ];
  function shirt(ctx, v) {
    ST.blob(ctx, [SHIRTS[v][14] - 4, -384, SHIRTS[v][18] + 4, -384, SHIRTS[v][18] + 6, -350, SHIRTS[v][14] - 6, -350], '#55574f', { lw: 6, seed: SEED + 40 });
    ST.blob(ctx, SHIRTS[v], SHIRT, { lw: 7, seed: SEED + v, shade: [SHIRT_D, -18, 8], mottle: ['rgba(50,54,50,0.25)', 4, 18], hatch: { c: 'rgba(30,32,30,0.45)', n: 6, len: 46, gap: 7, k: 3, ang: 85, bend: 0.05 } });
    ST.stroke(ctx, [SHIRTS[v][14], -374, OX[v], -370, SHIRTS[v][18], -374], { w: 10, color: C.BLACK, seed: SEED + 5, taper: false });
    if (v === 3) return;
    const x = OX[v], k = OK[v];
    ST.blob(ctx, [x - 5, -636, x + 5, -636, x + 7, -470, x, -456, x - 7, -470], C.BLACK, { lw: 3.5, seed: SEED + 6 });
    ST.rect(ctx, x - 8, -540, 16, 5, ST.METAL, { seed: SEED + 7, lw: 2, amp: 0.5 }); // tie clip
    [-1, 1].forEach((s, i) => { if (v === 2 && s < 0) return; ST.blob(ctx, [x + s * 4, -642, x + s * 30 * k, -646, x + s * 24 * k, -620], SHIRT, { lw: 4, seed: SEED + 8 + i }); });
    if (v < 2) { ST.rect(ctx, x + 26 * k, -592, 34 * k, 36, SHIRT_D, { seed: SEED + 10, lw: 3, amp: 1 }); ST.tube(ctx, [x + 36 * k, -600, x + 36 * k, -580], [6, 6], C.BLACK, { lw: 2.5, seed: SEED + 11 }); }
    ST.stain(ctx, x - 40 * k, -430, 40, 30, SEED + 12, 'rgba(120,110,60,0.3)'); // mustard drip
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], mottle: ['rgba(110,100,80,0.3)', 5, 10], hatch: { c: 'rgba(50,46,36,0.35)', n: 3, len: 16, gap: 5, k: 3, ang: 72 } };
  const CUT = { lw: 5, shade: ['#221c16', -6, 6], hatch: { c: 'rgba(130,120,100,0.4)', n: 6, len: 14, gap: 4, k: 4, ang: 90, bend: 0 } };
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 8 * a[2], 8, f, { skin: SKIN, seed: SEED + 30, lw: 4.5, side: 0, bags: 1, lidAdd: 0.1 });
    ST.brow(ctx, a[0], a[1] - 18, 30 * a[2], -1, f, { u: 12, thick: 11, color: HAIR, seed: SEED + 31, arch: 0 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 8 * b[2], 8, f, { skin: SKIN, seed: SEED + 32, lw: 4.5, side: 1, bags: 1, lidAdd: 0.1 });
    ST.brow(ctx, b[0], b[1] - 18, 30 * b[2], 1, f, { u: 12, thick: 11, color: HAIR, seed: SEED + 33, arch: 0 });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 14;
    [-1, 1].forEach((s, i) => ST.blob(ctx, [s * 48, -110, s * 60, -114, s * 60, -84, s * 50, -72], SKIN, { lw: 5, seed: SEED + 34 + i, shade: [SKIN_D, -s * 3, 2] }));
    ST.blob(ctx, [-46, -12 + jaw, -50, -60, -50, -150, -44, -184, 44, -184, 50, -150, 50, -60, 46, -12 + jaw, 26, 10 + jaw, 0, 14 + jaw, -26, 10 + jaw], SKIN, Object.assign({ seed: SEED + 36 }, FACE));
    ST.blob(ctx, [-50, -158, -50, -206, 50, -206, 50, -158, 40, -172, -40, -172], HAIR, Object.assign({ seed: SEED + 37 }, CUT));
    eyes(ctx, f, [-20, -112, 1], [20, -112, 1]);
    ST.mouth(ctx, 0, -28, 30, f, { open: 22, teeth: 'row', seed: SEED + 38, lw: 5 });
    ST.blob(ctx, [-6, -112, 6, -112, 10, -72, 14, -60, 0, -56, -14, -60, -10, -72], SKIN, { lw: 6, seed: SEED + 39, shade: [SKIN_D, -5, 4] });
    ST.stroke(ctx, [-2, 0 + jaw, 0, 8 + jaw, 2, 0 + jaw], { w: 3, seed: SEED + 40 }); // dimple
    ST.wart(ctx, 18, -66, 3, '#6a5e4a', SEED + 41);
    ST.stroke(ctx, [24, -18 + jaw, 30, -12 + jaw], { w: 2.5, color: C.RED_D, seed: SEED + 42, taper: false }); // shaving nick
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-38, -110, -50, -114, -50, -84, -40, -72], SKIN, { lw: 5, seed: SEED + 43, shade: [SKIN_D, 3, 2] });
    ST.blob(ctx, [-40, -12 + jaw, -44, -60, -44, -150, -38, -184, 50, -184, 58, -150, 60, -90, 64, -66, 56, -12 + jaw, 36, 10 + jaw, 10, 14 + jaw, -18, 10 + jaw], SKIN, Object.assign({ seed: SEED + 44 }, FACE));
    ST.blob(ctx, [-44, -156, -44, -206, 56, -206, 58, -158, 46, -172, -34, -172], HAIR, Object.assign({ seed: SEED + 45 }, CUT));
    eyes(ctx, f, [0, -112, 1], [40, -112, 0.66]);
    ST.mouth(ctx, 26, -28, 26, f, { open: 20, teeth: 'row', seed: SEED + 46, lw: 5 });
    ST.blob(ctx, [20, -112, 30, -112, 38, -72, 46, -60, 32, -56, 20, -60], SKIN, { lw: 6, seed: SEED + 47, shade: [SKIN_D, -5, 4] });
    ST.wart(ctx, 42, -66, 3, '#6a5e4a', SEED + 41);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-44, -10, -50, -60, -50, -150, -44, -184, 40, -184, 46, -150, 46, -116, 52, -100, 52, -66, 46, -50, 50, -34, 46, -14 + jaw, 34, 10 + jaw, 6, 14 + jaw, -20, 4], SKIN, Object.assign({ seed: SEED + 48 }, FACE));
    ST.blob(ctx, [-50, -156, -50, -206, 42, -206, 46, -160, 30, -172, -36, -168], HAIR, Object.assign({ seed: SEED + 49 }, CUT));
    ST.blob(ctx, [-14, -110, -26, -114, -26, -84, -16, -72], SKIN, { lw: 5, seed: SEED + 50, shade: [SKIN_D, 3, 2] });
    eyes(ctx, f, [32, -112, 0.72], null);
    ST.mouth(ctx, 38, -28, 14, f, { open: 18, teeth: 'row', seed: SEED + 51, lw: 5 });
    ST.blob(ctx, [46, -114, 56, -100, 66, -70, 66, -60, 52, -56, 46, -66], SKIN, { lw: 6, seed: SEED + 52, shade: [SKIN_D, -5, 4] });
  }
  function headBack(ctx) {
    [-1, 1].forEach((s, i) => ST.blob(ctx, [s * 48, -110, s * 60, -114, s * 60, -84, s * 50, -72], SKIN, { lw: 5, seed: SEED + 53 + i, shade: [SKIN_D, -s * 3, 2] }));
    ST.blob(ctx, [-46, -8, -50, -60, -50, -150, -44, -184, 44, -184, 50, -150, 50, -60, 46, -8, 0, 0], SKIN, Object.assign({ seed: SEED + 55 }, FACE));
    ST.blob(ctx, [-50, -100, -50, -206, 50, -206, 50, -100, 30, -92, -30, -92], HAIR, Object.assign({ seed: SEED + 56 }, CUT));
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  const ARM = { cloth: SHIRT, clothD: SHIRT_D, w: [40, 36, 30], bare: 0, skin: SKIN, skinD: SKIN_D, hsz: D.hsz, lw: 6, cuff: SHIRT_D, hair: true };
  const LEG = { cloth: '#5d5f5a', clothD: '#43453f', w: [52, 44, 36], shoe: C.BLACK, shoeD: C.BLACK_D, shoeL: 'rgba(200,200,190,0.3)', len: 78, sw: 30, lw: 6.5, splay: 0.2, hatch: { c: 'rgba(20,20,18,0.35)', n: 2, len: 40, gap: 6, k: 2, ang: 88, bend: 0 } };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, paper (newspaper held open in front;
  //    'holes' = with eye holes), sandwich (bite 0|1, in the right hand), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0);
    const P = p.pose || (p.paper ? ST.pose('stand', D, null, { hL: [118, D.sy + 92 + (p.paperDy || 0), 150], hR: [-118, D.sy + 92 + (p.paperDy || 0), 150], kL: 'grip', kR: 'grip', poleL: [1, 0.6, -0.4], poleR: [-1, 0.6, -0.4] }) : ST.pose('stand', D));
    const J = ST.solve(V, D, P), f = ST.face(p.t || 0, SEED, p.expr || 'deadpan', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.paper ? { L: 2, R: 2 } : p.layer || {}, sand = p.sandwich !== undefined;
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, sand ? 'grip' : P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      if (sd === 2 && sand) { const g = ST.palm(j, D.hsz); ST.sandwich(ctx, g[0], g[1] - 6, ST.figAng(V.mir, p.sandAng || -0.3), SEED + 60, p.sandwich); }
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 80 + sd }));
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 90 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      ST.tube(ctx, [n[0], n[1] + 6, n[2], n[3] + 14 + (p.headDy || 0)], [46, 42], SKIN, { lw: 6, seed: SEED + 94, shade: [SKIN_D, -6, 0] });
      shirt(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.06 : 1.06, 1.06);
      HEADS[H.V.v](ctx, f);
      ctx.restore();
      if (p.paper && V.v !== 3) { const a = J.aL.h, b = J.aR.h; ST.newspaper(ctx, (a[0] + b[0]) / 2, D.sy + 52 + J.bob + (p.paperDy || 0), V.v === 2 ? 150 : 300, 0, SEED + 64, p.paper === 'holes' ? p.peek || 'right' : false); }
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.agent = { name: 'The Agent', D, draw, demo: { sandwich: 0 }, extraRow: ['newspaper', () => ({ paper: 'holes', paperDy: -208, sandwich: undefined })] };
})();

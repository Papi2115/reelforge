/* Main 2 - the Tired Cardinal. A drooping pear: narrow sloped shoulders, a long neck stooped forward, the weight all
   sunk into a low belly. A long horse face with a droopy nose, sagging cheeks, enormous double bags, lids that never
   open past half, jug ears, a bald dome with three wisps, the skullcap slipping off to one side. Faded rust cassock
   with a sagging sash, short cape. Grows a grey beard while the vote drags on (p.beard 0..1). Exhausted, always. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_GREY, SKIN_D = C.SKIN_GREY_D, RED = '#7a4434', RED_D = '#57301f', HAIR = '#a59f92', SEED = 1200;
  const D = { sw: 58, sy: -556, sz: 14, l1a: 126, l2a: 116, hw: 28, hy: -320, l1l: 168, l2l: 150, elbowOut: 0.6, top: -836, waist: [86, -380], head: { x: [0, 22, 56, 0], top: -836, bottom: -636, hw: 78 } };
  const NECK = [[0, -580, 0, -640], [10, -578, 22, -636], [22, -574, 56, -628], [0, -580, 0, -640]]; // base x,y -> head x,y

  const CASSOCK = [
    [-30, -592, -60, -576, -70, -540, -72, -460, -88, -360, -110, -260, -118, -160, -112, -24, 112, -24, 118, -160, 110, -260, 88, -360, 72, -460, 70, -540, 60, -576, 30, -592],
    [-22, -594, -54, -578, -64, -540, -66, -460, -80, -360, -98, -260, -104, -160, -100, -24, 120, -24, 128, -160, 124, -260, 100, -360, 76, -460, 64, -540, 52, -576, 18, -594],
    [-10, -600, -44, -588, -62, -552, -68, -470, -62, -380, -66, -260, -72, -140, -70, -24, 96, -24, 104, -140, 110, -250, 96, -340, 66, -420, 50, -500, 44, -560, 28, -596],
    [-30, -592, -60, -576, -70, -540, -72, -460, -88, -360, -110, -260, -118, -160, -112, -24, 112, -24, 118, -160, 110, -260, 88, -360, 72, -460, 70, -540, 60, -576, 30, -592],
  ];
  const CAPE = [
    [-30, -598, -66, -584, -86, -546, -92, -498, -60, -484, 0, -474, 60, -484, 92, -498, 86, -546, 66, -584, 30, -598],
    [-22, -600, -60, -586, -78, -548, -84, -500, -50, -484, 20, -472, 80, -484, 100, -502, 88, -548, 60, -586, 18, -600],
    [-14, -604, -52, -592, -70, -556, -74, -508, -40, -490, 30, -480, 76, -490, 84, -520, 64, -566, 30, -600],
    [-30, -598, -66, -584, -86, -546, -92, -498, -50, -480, 0, -476, 50, -480, 92, -498, 86, -546, 66, -584, 30, -598],
  ];
  const SASH = [[-90, -372, 0, -350, 90, -372], [-82, -370, 20, -346, 104, -364], [-62, -376, 30, -350, 102, -340], [-90, -372, 0, -358, 90, -372]];
  const CLOSE = [0, 26, 82, null];

  function body(ctx, v) {
    ST.blob(ctx, CASSOCK[v], RED, { lw: 7, seed: SEED + v, shade: [RED_D, -22, 8], mottle: ['#6a3a2c', 6, 22], hatch: { c: 'rgba(30,12,6,0.55)', n: 10, len: 60, gap: 8, k: 3, ang: 86, bend: 0.06 } });
    const cx = CLOSE[v];
    if (cx !== null) for (let i = 0; i < 9; i++) ST.blob(ctx, ST.ellipseRing(cx + (v === 2 ? 10 * Math.sin(i / 3) : 0), -460 + i * 48, 4.5, 4.5, 6), RED_D, { lw: 3, seed: SEED + 10 + i });
    else ST.stroke(ctx, [0, -580, 2, -360, -2, -40], { w: 3.5, seed: SEED + 19 }); // back seam
    if (v === 2) ST.stroke(ctx, [70, -300, 92, -250, 84, -200], { w: 3.5, seed: SEED + 20 }); // belly fold
    ST.stain(ctx, [30, 50, 60, -20][v], -300, 44, 60, SEED + 21, 'rgba(40,24,12,0.3)');
    const s = SASH[v];
    ST.stroke(ctx, s, { w: 22, color: RED_D, seed: SEED + 22, taper: false });
    ST.stroke(ctx, s, { w: 3, color: '#3a1d12', seed: SEED + 23, taper: false });
    if (v < 3) ST.tube(ctx, [s[4] - 14, s[5] + 6, s[4] - 6, s[5] + 70, s[4] - 14, s[5] + 130], [20, 18, 16], RED_D, { lw: 5, seed: SEED + 24 }); // sash tail
    ST.blob(ctx, CAPE[v], RED, { lw: 7, seed: SEED + 30 + v, shade: [RED_D, -12, 8], hatch: { c: 'rgba(30,12,6,0.5)', n: 5, len: 26, gap: 6, k: 3, ang: v === 3 ? 80 : 30 } });
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], mottle: ['#958a72', 6, 12], hatch: { c: 'rgba(50,45,30,0.4)', n: 4, len: 18, gap: 5, k: 3, ang: 78 } };
  function ear(ctx, x, s, seed) {
    ST.blob(ctx, [x, -116, x + s * 30, -128, x + s * 36, -96, x + s * 28, -56, x, -66], SKIN, { lw: 6, seed, shade: [SKIN_D, -s * 6, 2], inner: () => ST.stroke(ctx, [x + s * 10, -110, x + s * 24, -104, x + s * 18, -78], { w: 3, seed: seed + 1 }) });
  }
  function wisps(ctx, x) {
    [-14, 0, 14].forEach((d, i) => ST.stroke(ctx, [x + d, -186, x + d + 8, -206, x + d + 22, -212], { w: 3, color: '#4a463e', seed: SEED + 40 + i, taper: false }));
  }
  function liver(ctx, x, y, r, seed) { ST.blob(ctx, ST.ellipseRing(x, y, r, r * 0.8, 7), 'rgba(110,85,50,0.45)', { lw: 0, seed }); }
  function cap(ctx, x, y, rot, seed) { // the skullcap, slipping
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ST.blob(ctx, [-40, 6, -30, -18, 0, -26, 30, -18, 40, 6, 0, 0], RED, { lw: 6, seed, shade: [RED_D, -6, 4], light: ['#93533e', 4, -4] });
    ctx.restore();
  }
  function beard(ctx, b, x, jaw, w) { // grey beard growing down from the chin as the years go by
    if (b <= 0.02) return;
    const L = 16 + 150 * b;
    ST.blob(ctx, [x - w, -40, x - w * 1.05, -6 + jaw, x - w * 0.7, L * 0.6 + jaw, x - 6, L + jaw, x + 10, L * 0.9 + jaw, x + w * 0.75, L * 0.55 + jaw, x + w * 1.05, -6 + jaw, x + w, -40, x, -26 + jaw], '#9d978a', { lw: 6, seed: SEED + 45, shade: ['#77736a', -8, 6], hatch: { c: 'rgba(40,38,32,0.55)', n: 5 + Math.round(b * 6), len: 22, gap: 4, k: 3, ang: 82, bend: 0.1 } });
  }
  function headFront(ctx, f, b) {
    const jaw = f.jaw * 18;
    ear(ctx, -54, -1, SEED + 50);
    ear(ctx, 54, 1, SEED + 52);
    ST.blob(ctx, [-46, -6, -58, -50, -60, -110, -52, -158, -26, -184, 6, -188, 34, -180, 54, -156, 60, -110, 58, -50, 46, -6, 24, 14 + jaw, 0, 20 + jaw, -24, 14 + jaw], SKIN, Object.assign({ seed: SEED + 54 }, FACE));
    wisps(ctx, -6);
    liver(ctx, 26, -160, 9, SEED + 55);
    liver(ctx, -30, -150, 6, SEED + 56);
    ST.stubble(ctx, [-50, -50, -42, 4 + jaw, 0, 18 + jaw, 44, 4 + jaw, 52, -50, 20, -34, -20, -34], SEED + 57, 46, 'rgba(70,66,58,0.55)');
    ST.stroke(ctx, [-44, -76, -42, -40, -32, -10 + jaw], { w: 4, seed: SEED + 58 }); // sagging cheeks
    ST.stroke(ctx, [44, -76, 42, -40, 32, -10 + jaw], { w: 4, seed: SEED + 59 });
    ST.eye(ctx, -22, -104, 12, 13, f, { skin: SKIN, seed: SEED + 60, lw: 5, side: 0, bags: 2, lidAdd: 0.12 });
    ST.eye(ctx, 22, -106, 12, 14, f, { skin: SKIN, seed: SEED + 61, lw: 5, side: 1, bags: 2, lidAdd: 0.12 });
    ST.brow(ctx, -22, -128, 28, -1, f, { u: 14, thick: 8, color: '#77736a', seed: SEED + 62, droop: 8 });
    ST.brow(ctx, 22, -130, 28, 1, f, { u: 14, thick: 8, color: '#77736a', seed: SEED + 63, droop: 8 });
    beard(ctx, b, 0, jaw, 40);
    ST.mouth(ctx, 0, -16, 30, f, { open: 30, teeth: 'gap', seed: SEED + 64, lw: 5 });
    ST.blob(ctx, [-8, -106, 8, -106, 14, -64, 20, -42, 6, -32, -10, -34, -18, -44, -12, -64], SKIN, { lw: 6, seed: SEED + 65, shade: [SKIN_D, -6, 5], patch: ['#b8ae96', 4, -12, 0.3] });
    cap(ctx, 24, -182, 0.38, SEED + 66);
  }
  function head34(ctx, f, b) {
    const jaw = f.jaw * 18;
    ear(ctx, -42, -1, SEED + 67);
    ST.blob(ctx, [-40, -6, -52, -50, -56, -112, -48, -160, -18, -186, 16, -188, 42, -176, 58, -150, 62, -116, 60, -100, 66, -78, 62, -48, 56, -6, 32, 14 + jaw, 6, 20 + jaw, -20, 12 + jaw], SKIN, Object.assign({ seed: SEED + 68 }, FACE));
    wisps(ctx, 6);
    liver(ctx, 34, -160, 9, SEED + 55);
    ST.stubble(ctx, [-34, -50, -26, 4 + jaw, 14, 18 + jaw, 56, 4 + jaw, 60, -50, 32, -34, -6, -34], SEED + 69, 46, 'rgba(70,66,58,0.55)');
    ST.stroke(ctx, [-30, -76, -28, -40, -18, -10 + jaw], { w: 4, seed: SEED + 70 });
    ST.eye(ctx, -6, -104, 12, 13, f, { skin: SKIN, seed: SEED + 71, lw: 5, side: 0, bags: 2, lidAdd: 0.12 });
    ST.eye(ctx, 46, -106, 8, 14, f, { skin: SKIN, seed: SEED + 72, lw: 5, side: 1, bags: 1, lidAdd: 0.12 });
    ST.brow(ctx, -6, -128, 26, -1, f, { u: 14, thick: 8, color: '#77736a', seed: SEED + 73, droop: 8 });
    ST.brow(ctx, 46, -130, 18, 1, f, { u: 14, thick: 8, color: '#77736a', seed: SEED + 74, droop: 8 });
    beard(ctx, b, 20, jaw, 38);
    ST.mouth(ctx, 26, -16, 28, f, { open: 28, teeth: 'gap', seed: SEED + 75, lw: 5 });
    ST.blob(ctx, [14, -108, 28, -108, 38, -66, 50, -42, 38, -32, 20, -34, 14, -50], SKIN, { lw: 6, seed: SEED + 76, shade: [SKIN_D, -6, 5], patch: ['#b8ae96', 4, -12, 0.3] });
    cap(ctx, 30, -184, 0.3, SEED + 77);
  }
  function headProfile(ctx, f, b) {
    const jaw = f.jaw * 18;
    ST.blob(ctx, [-30, -4, -54, -40, -62, -110, -50, -164, -12, -190, 26, -184, 48, -160, 54, -130, 52, -110, 58, -96, 56, -60, 48, -40, 50, -20 + jaw, 40, -2 + jaw, 20, 8 + jaw, -6, 4], SKIN, Object.assign({ seed: SEED + 78 }, FACE));
    wisps(ctx, 0);
    liver(ctx, 10, -168, 9, SEED + 55);
    ST.blob(ctx, [-60, -70, -62, -116, -40, -112, -32, -72, -44, -52], HAIR, { lw: 0, seed: SEED + 79, hatch: { c: 'rgba(30,28,24,0.6)', n: 3, len: 12, gap: 4, k: 3, ang: 80 } });
    ear(ctx, -20, -1, SEED + 80);
    ST.stubble(ctx, [-4, -50, 0, 6 + jaw, 40, 8 + jaw, 54, -30, 30, -40], SEED + 81, 40, 'rgba(70,66,58,0.55)');
    ST.eye(ctx, 34, -104, 8, 13, f, { skin: SKIN, seed: SEED + 82, lw: 5, side: 1, bags: 2, lidAdd: 0.12 });
    ST.brow(ctx, 36, -128, 18, 1, f, { u: 14, thick: 8, color: '#77736a', seed: SEED + 83, droop: 8 });
    beard(ctx, b, 30, jaw, 28);
    ST.mouth(ctx, 42, -18, 18, f, { open: 26, teeth: 'gap', seed: SEED + 84, lw: 5 });
    ST.blob(ctx, [44, -112, 58, -106, 70, -70, 82, -40, 70, -30, 54, -34, 48, -56], SKIN, { lw: 6, seed: SEED + 85, shade: [SKIN_D, -6, 5], patch: ['#b8ae96', 4, -12, 0.3] });
    cap(ctx, 0, -186, 0.25, SEED + 86);
  }
  function headBack(ctx) {
    ear(ctx, -50, -1, SEED + 87);
    ear(ctx, 50, 1, SEED + 89);
    ST.blob(ctx, [-44, -6, -56, -50, -58, -110, -50, -158, 0, -188, 50, -158, 58, -110, 56, -50, 44, -6, 0, 6], SKIN, Object.assign({ seed: SEED + 91 }, FACE));
    ST.blob(ctx, [-56, -60, -58, -100, -30, -92, 0, -88, 30, -92, 58, -100, 56, -60, 40, -18, 0, -6, -40, -18], HAIR, { lw: 0, seed: SEED + 92, hatch: { c: 'rgba(30,28,24,0.6)', n: 10, len: 14, gap: 4, k: 3, ang: 85 } });
    liver(ctx, -20, -150, 8, SEED + 55);
    cap(ctx, -18, -184, -0.3, SEED + 95);
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  function neck(ctx, v, hdy) {
    const n = NECK[v];
    ST.tube(ctx, [n[0], n[1] + 10, (n[0] + n[2]) / 2, (n[1] + n[3]) / 2, n[2], n[3] + 14 + hdy], [38, 30, 32], SKIN, { lw: 6, seed: SEED + 96, shade: [SKIN_D, -6, 0] });
    if (v < 3) ST.stroke(ctx, [n[2] - 4 + v * 6, n[3] + 30, n[2] + 4 + v * 6, n[3] + 36, n[2] + v * 6, n[3] + 44], { w: 4, seed: SEED + 97 }); // Adam's apple
  }

  const ARM = { cloth: RED, clothD: RED_D, w: [36, 32, 30], skin: SKIN, skinD: SKIN_D, hsz: 34, lw: 6, cuff: RED_D, hatch: { c: 'rgba(30,12,6,0.5)', n: 3, len: 24, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: RED_D, clothD: '#3d2116', w: [34, 26, 22], shoe: C.BROWN, shoeD: C.BROWN_D, len: 70, sw: 24, lw: 6, splay: 0.35 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, beard 0..1, after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'exhausted', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => { if (l === layer) ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'open', seed: SEED + 100 + sd })); });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 105 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      neck(ctx, V.v, p.headDy || 0);
      body(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.1 : 1.1, 1.1);
      HEADS[H.V.v](ctx, f, p.beard || 0);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.tired = { name: 'The Tired Cardinal', D, draw, extraRow: ['beard 1', () => ({ beard: 1, expr: 'asleep' })] };
})();

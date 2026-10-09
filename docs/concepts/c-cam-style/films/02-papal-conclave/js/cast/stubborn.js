/* Main 1 - the Stubborn Cardinal. A wedge of ego: a barrel chest pushed out under the rust shoulder-cape, narrow hips,
   short legs, the chin carried high. Big pear head wider at the jowls, a huge hooked nose with a red-veined tip, one
   brow cocked for good, an underbite tooth, a hairy wart on the jutting chin, grey tufts under the skullcap.
   Rust cassock, dirty linen rochet with a ragged lace hem. Prop: a tiny notebook of grievances and a stylus. Smug. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = '#bf8b6b', SKIN_D = '#91604a', RED = C.RUST, RED_D = C.RUST_D, HAIR = '#8d877a', SEED = 1100;
  const D = { sw: 106, sy: -462, sz: 6, l1a: 104, l2a: 96, hw: 34, hy: -232, l1l: 122, l2l: 108, elbowOut: 0.9, top: -712, waist: [118, -330], head: { x: [0, 20, 40, 0], top: -712, bottom: -470, hw: 96 } };
  const NECK = [[0, -490], [14, -490], [30, -488], [0, -490]];

  const CASSOCK = [
    [-40, -498, -100, -484, -128, -446, -132, -380, -114, -290, -96, -200, -94, -110, -100, -24, 100, -24, 94, -110, 96, -200, 114, -290, 132, -380, 128, -446, 100, -484, 40, -498],
    [-30, -500, -88, -486, -114, -450, -116, -384, -100, -294, -84, -200, -84, -110, -92, -24, 112, -24, 106, -110, 108, -200, 132, -300, 154, -380, 138, -446, 96, -484, 40, -498],
    [-24, -504, -58, -480, -68, -430, -62, -340, -52, -240, -56, -120, -64, -24, 96, -24, 92, -120, 96, -220, 124, -300, 148, -380, 126, -452, 72, -490, 26, -504],
    [-40, -498, -100, -484, -126, -446, -128, -380, -112, -290, -96, -200, -94, -110, -100, -24, 100, -24, 94, -110, 96, -200, 112, -290, 128, -380, 126, -446, 100, -484, 40, -498],
  ];
  const ROCHET = [
    [-118, -380, 118, -380, 100, -260, 100, -160, -100, -160, -100, -260],
    [-104, -380, 146, -380, 116, -260, 104, -160, -88, -160, -84, -260],
    [-60, -380, 144, -380, 108, -260, 92, -160, -56, -160, -52, -260],
    [-116, -380, 116, -380, 100, -260, 100, -160, -100, -160, -100, -260],
  ];
  const CAPE = [
    [-44, -500, -108, -488, -142, -450, -150, -390, -122, -360, -60, -370, 0, -360, 60, -370, 122, -360, 150, -390, 142, -450, 108, -488, 44, -500],
    [-34, -502, -96, -490, -128, -452, -134, -392, -108, -364, -40, -370, 44, -358, 120, -368, 164, -390, 152, -450, 102, -490, 40, -500],
    [-30, -506, -68, -486, -82, -440, -80, -390, -44, -368, 40, -362, 112, -366, 158, -390, 140, -454, 80, -494, 30, -506],
    [-44, -500, -108, -488, -142, -450, -150, -390, -110, -358, 0, -352, 110, -358, 150, -390, 142, -450, 108, -488, 44, -500],
  ];
  const CLOSE = [0, 44, 118, null]; // buttons on the centre line, shifted toward the facing side, on the front edge in profile

  function body(ctx, v) {
    ST.blob(ctx, CASSOCK[v], RED, { lw: 8, seed: SEED + v, shade: [RED_D, -24, 8], mottle: ['#723622', 5, 24], hatch: { c: 'rgba(30,10,6,0.55)', n: 9, len: 56, gap: 8, k: 3, ang: 84, bend: 0.06 } });
    const r = ROCHET[v];
    ST.blob(ctx, r, C.LINEN, { lw: 6, seed: SEED + 5 + v, shade: [C.LINEN_D, -18, 6], mottle: ['rgba(110,90,50,0.35)', 4, 18], hatch: { c: 'rgba(60,50,30,0.5)', n: 6, len: 40, gap: 7, k: 3, ang: 80, bend: 0.05 } });
    const x0 = r[8], x1 = r[6];
    for (let i = 0; i < 9; i++) { // ragged lace hem: little zigzag teeth
      const x = x0 + ((x1 - x0) * (i + 0.5)) / 9;
      ST.stroke(ctx, [x - 8, -160, x, -146 - (i % 2) * 4, x + 8, -160], { w: 3, seed: SEED + 10 + i, taper: false });
    }
    const cx = CLOSE[v];
    if (cx !== null) for (let i = 0; i < 4; i++) ST.blob(ctx, ST.ellipseRing(cx - (v === 2 ? 14 : 0) - i * (v === 2 ? 4 : 0), -126 + i * 26, 5, 5, 6), RED_D, { lw: 3, seed: SEED + 20 + i });
    else ST.stroke(ctx, [0, -360, 2, -150], { w: 3.5, seed: SEED + 24 }); // back seam
    ST.blob(ctx, CAPE[v], RED, { lw: 7, seed: SEED + 30 + v, shade: [RED_D, -16, 8], light: ['#9a5236', 6, -6], hatch: { c: 'rgba(30,10,6,0.55)', n: 6, len: 30, gap: 6, k: 3, ang: v === 3 ? 80 : 20 } });
    if (cx !== null) for (let i = 0; i < 5; i++) ST.blob(ctx, ST.ellipseRing(cx + (v === 2 ? -6 + i * 3 : 0), -486 + i * 24, 5, 5, 6), RED_D, { lw: 3, seed: SEED + 35 + i });
    ST.stain(ctx, [-60, -10, -20, 0][v], -270, 50, 34, SEED + 40, 'rgba(60,40,20,0.3)'); // soup down the rochet
  }

  // ---------- head per view (origin = top of the neck); x+ = the way he faces ----------
  const FACE = { lw: 7, shade: [SKIN_D, -16, 8], mottle: ['#9c5f4a', 6, 12], hatch: { c: 'rgba(70,25,15,0.4)', n: 4, len: 16, gap: 5, k: 3, ang: 70 } };
  const BROW = '#433d35';
  function cap(ctx, pts, seed) {
    ST.blob(ctx, pts, RED, { lw: 6, seed, shade: [RED_D, -8, 5], light: ['#9a5236', 4, -5] });
  }
  function tuft(ctx, pts, seed) {
    ST.blob(ctx, pts, HAIR, { lw: 4, seed, hatch: { c: 'rgba(30,28,24,0.6)', n: 2, len: 12, gap: 4, k: 3, ang: 80 } });
  }
  function nose(ctx, pts, seed, tipX, tipY) {
    ST.blob(ctx, pts, SKIN, { lw: 6, seed, shade: [SKIN_D, -6, 5], patch: ['#c08a70', 4, -10, 0.3] });
    ST.blob(ctx, [tipX - 12, tipY - 8, tipX + 10, tipY - 10, tipX + 12, tipY + 6, tipX - 10, tipY + 8], 'rgba(160,50,40,0.45)', { lw: 0, seed: seed + 1 });
    ST.stroke(ctx, [tipX - 7, tipY, tipX, tipY + 3, tipX + 7, tipY - 2], { w: 1.8, color: '#8e2e26', seed: seed + 2, taper: false });
    ST.pores(ctx, tipX - 12, tipY - 18, 24, 14, 5, seed + 3);
  }
  function brows(ctx, f, a, b, u) { // a: near/left [x, y, w], b: far/right (cocked high for good) or null
    ST.brow(ctx, a[0], a[1], a[2], -1, f, { u, thick: 14, color: BROW, seed: SEED + 50 });
    if (b) ST.brow(ctx, b[0], b[1] - 8, b[2], 1, f, { u, thick: 15, color: BROW, seed: SEED + 51, arch: 1.8 });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 14;
    [[-70, -1], [72, 1]].forEach(([x, s], i) => ST.blob(ctx, [x, -60, x + s * 16, -96, x + s * 20, -70, x + s * 10, -46], SKIN, { lw: 5, seed: SEED + 52 + i, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-60, -10, -76, -50, -70, -100, -56, -136, -28, -156, 8, -160, 40, -152, 62, -130, 72, -98, 78, -52, 66, -10, 40, 12 + jaw, 0, 22 + jaw, -40, 12 + jaw], SKIN, Object.assign({ seed: SEED + 54 }, FACE));
    tuft(ctx, [-70, -96, -74, -128, -54, -134, -56, -100], SEED + 55);
    tuft(ctx, [72, -98, 76, -130, 56, -136, 58, -102], SEED + 56);
    ST.stubble(ctx, [-60, -40, -44, 6 + jaw, 0, 20 + jaw, 46, 6 + jaw, 64, -40, 30, -24, -30, -24], SEED + 57, 26, 'rgba(70,50,40,0.45)');
    ST.stroke(ctx, [-52, -40, -48, -14, -34, 2 + jaw], { w: 4, seed: SEED + 58 }); // jowls
    ST.stroke(ctx, [56, -40, 52, -14, 38, 2 + jaw], { w: 4, seed: SEED + 59 });
    ST.eye(ctx, -24, -90, 11, 12, f, { skin: SKIN, seed: SEED + 60, lw: 5, side: 0, bags: 2 });
    ST.eye(ctx, 26, -92, 12, 14, f, { skin: SKIN, seed: SEED + 61, lw: 5, side: 1, bags: 2 });
    brows(ctx, f, [-24, -112, 30], [26, -116, 32], 15);
    ST.mouth(ctx, 2, -16, 36, f, { open: 26, teeth: 'snag', seed: SEED + 62, lw: 5, under: [[0.3, 10]] });
    nose(ctx, [-10, -90, 10, -90, 22, -60, 28, -42, 10, -32, -10, -32, -26, -42, -20, -60], SEED + 63, 0, -42);
    ST.wart(ctx, 16, 8 + jaw, 5, '#8a5040', SEED + 64, true);
    cap(ctx, [-58, -128, -44, -160, 0, -172, 44, -162, 62, -130, 30, -140, 0, -144, -30, -140], SEED + 65);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-58, -60, -74, -96, -78, -70, -66, -46], SKIN, { lw: 5, seed: SEED + 66, shade: [SKIN_D, 4, 2] }); // near ear
    ST.blob(ctx, [-56, -12, -70, -52, -68, -100, -52, -138, -18, -160, 20, -160, 50, -146, 66, -120, 70, -100, 66, -86, 74, -62, 74, -30, 62, -4, 34, 16 + jaw, 4, 22 + jaw, -28, 10 + jaw], SKIN, Object.assign({ seed: SEED + 67 }, FACE));
    tuft(ctx, [-66, -96, -72, -128, -50, -136, -50, -100], SEED + 68);
    ST.stubble(ctx, [-48, -40, -30, 6 + jaw, 20, 20 + jaw, 66, 6 + jaw, 70, -40, 40, -24, -10, -24], SEED + 57, 26, 'rgba(70,50,40,0.45)');
    ST.stroke(ctx, [-40, -40, -38, -14, -24, 4 + jaw], { w: 4, seed: SEED + 69 });
    ST.eye(ctx, -6, -90, 11, 12, f, { skin: SKIN, seed: SEED + 70, lw: 5, side: 0, bags: 2 });
    ST.eye(ctx, 54, -92, 8, 14, f, { skin: SKIN, seed: SEED + 71, lw: 5, side: 1, bags: 1 });
    brows(ctx, f, [-6, -112, 28], [54, -116, 22], 15);
    ST.mouth(ctx, 32, -16, 32, f, { open: 24, teeth: 'snag', seed: SEED + 72, lw: 5, under: [[0.3, 10]] });
    nose(ctx, [22, -92, 36, -92, 56, -60, 74, -42, 56, -32, 34, -34, 24, -50], SEED + 73, 54, -42);
    ST.wart(ctx, 40, 10 + jaw, 5, '#8a5040', SEED + 64, true);
    cap(ctx, [-52, -132, -36, -162, 10, -172, 50, -158, 66, -128, 30, -140, -10, -142], SEED + 74);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-50, -12, -66, -56, -66, -104, -46, -146, -6, -164, 34, -156, 58, -130, 64, -104, 62, -92, 70, -78, 72, -60, 66, -46, 70, -30 + jaw, 76, -14 + jaw, 88, 0 + jaw, 82, 16 + jaw, 52, 24 + jaw, 12, 16, -24, 6], SKIN, Object.assign({ seed: SEED + 75 }, FACE));
    tuft(ctx, [-62, -60, -66, -100, -50, -126, -40, -100, -48, -66], SEED + 76);
    ST.blob(ctx, [-10, -64, -22, -72, -24, -92, -12, -100, 0, -92, 0, -76, -4, -66], SKIN, { lw: 5, seed: SEED + 77, shade: [SKIN_D, -4, 2], inner: () => ST.stroke(ctx, [-6, -90, -16, -84, -12, -72], { w: 3, seed: 9 }) }); // ear
    ST.stubble(ctx, [6, -40, 14, 14, 70, 20, 80, -6, 40, -24], SEED + 78, 20, 'rgba(70,50,40,0.45)');
    ST.eye(ctx, 42, -90, 8, 13, f, { skin: SKIN, seed: SEED + 79, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, 44, -120, 22, 1, f, { u: 15, thick: 15, color: BROW, seed: SEED + 80, arch: 1.8 });
    ST.mouth(ctx, 64, -20, 16, f, { open: 22, teeth: 'snag', seed: SEED + 81, lw: 5, under: [[0.6, 10]] });
    nose(ctx, [56, -96, 72, -94, 90, -66, 106, -46, 92, -36, 70, -40, 60, -56], SEED + 82, 86, -46);
    ST.wart(ctx, 76, 10 + jaw, 5, '#8a5040', SEED + 64, true);
    cap(ctx, [-44, -138, -26, -166, 20, -170, 54, -146, 56, -132, 10, -146, -30, -142], SEED + 83);
  }
  function headBack(ctx) {
    [[-72, -1], [72, 1]].forEach(([x, s], i) => ST.blob(ctx, [x, -60, x + s * 16, -96, x + s * 18, -70, x + s * 8, -46], SKIN, { lw: 5, seed: SEED + 84 + i, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-60, -10, -74, -56, -70, -104, -54, -138, 0, -158, 54, -138, 70, -104, 74, -56, 60, -10, 0, 2], SKIN, Object.assign({ seed: SEED + 86 }, FACE));
    ST.blob(ctx, [-72, -120, -74, -60, -50, -34, -20, -44, 0, -36, 22, -44, 50, -34, 74, -60, 72, -120, 0, -132], HAIR, { lw: 0, seed: SEED + 87, hatch: { c: 'rgba(30,28,24,0.6)', n: 10, len: 14, gap: 4, k: 3, ang: 85 } });
    [-22, -8].forEach((y, i) => ST.stroke(ctx, [-46 + i * 8, y, 0, y + 8, 46 - i * 8, y], { w: 4.5, seed: SEED + 88 + i })); // neck rolls
    cap(ctx, [-56, -128, -44, -160, 0, -170, 44, -160, 56, -128, 0, -122], SEED + 90);
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  // the tiny notebook of grievances (figure space, centred on the palm); open shows cramped scribbles
  function notebook(ctx, x, y, open) {
    if (open) {
      ST.rough(ctx, [x - 46, y - 30, x + 46, y - 30, x + 46, y + 30, x - 46, y + 30], C.BROWN_D, { seed: SEED + 96, lw: 5, amp: 1.5 });
      ST.rough(ctx, [x - 40, y - 26, x, y - 22, x + 40, y - 26, x + 40, y + 22, x, y + 26, x - 40, y + 22], C.LINEN, { seed: SEED + 91, lw: 5, amp: 1.5 });
      ST.stroke(ctx, [x, y - 22, x, y + 26], { w: 3, seed: SEED + 92, taper: false });
      for (let i = 0; i < 4; i++) [-1, 1].forEach((s) => ST.stroke(ctx, [x + s * 6, y - 12 + i * 9, x + s * 18, y - 14 + i * 9, x + s * 34, y - 11 + i * 9], { w: 2, seed: SEED + 93 + i, taper: false }));
    } else {
      ST.rough(ctx, [x - 24, y - 32, x + 24, y - 32, x + 24, y + 30, x - 24, y + 30], C.BROWN, { seed: SEED + 97, lw: 5, amp: 1.5, shade: [C.BROWN_D, -4, 0] });
      ST.stroke(ctx, [x - 16, y - 6, x + 16, y - 6], { w: 4, color: C.LINEN_D, seed: SEED + 98, taper: false });
    }
  }
  // the open notebook perched on the skullcap as a tiny roof (head space)
  function bookHat(ctx) {
    ST.blob(ctx, [-70, -150, 0, -196, 70, -150, 62, -140, 0, -180, -62, -140], C.LINEN, { sharp: true, lw: 5, seed: SEED + 95, shade: [C.LINEN_D, 0, 4] });
    ST.stroke(ctx, [-60, -146, 0, -186, 60, -146], { w: 6, color: C.BROWN_D, seed: SEED + 96, taper: false });
  }
  function stylus(ctx, j) {
    const a = (j.ang * Math.PI) / 180, g = ST.palm(j, 34);
    ST.stroke(ctx, [g[0] - Math.cos(a) * 10, g[1] + Math.sin(a) * 10, g[0] + Math.cos(a) * 46 + Math.sin(a) * 20, g[1] - Math.sin(a) * 46 + Math.cos(a) * 20], { w: 6, color: C.TIMBER, seed: SEED + 99, taper: false });
  }

  // writing in the notebook: book in the left hand at the chest, stylus hand scratching beside it (ph 0/1)
  const write = (ph) => ({
    hL: [D.sw * 0.1, D.sy + 0.62 * (D.l1a + D.l2a), 0.55 * (D.l1a + D.l2a)], hR: [-D.sw * 0.25 + ph * 10, D.sy + 0.56 * (D.l1a + D.l2a), 0.6 * (D.l1a + D.l2a)],
    poleL: [1, 0.4, -0.5], poleR: [-1, 0.4, -0.5], kL: 'grip', kR: 'grip',
  });

  const ARM = { cloth: RED, clothD: RED_D, w: [52, 44, 36], skin: SKIN, skinD: SKIN_D, hsz: 34, lw: 7, cuff: C.LINEN, hatch: { c: 'rgba(30,10,6,0.5)', n: 3, len: 26, gap: 6, k: 3, ang: 40 } };
  const LEG = { cloth: RED_D, clothD: '#45200f', w: [40, 30, 24], shoe: C.BLACK, shoeD: C.BLACK_D, shoeL: '#45403c', len: 54, sw: 30, lw: 6, splay: 0.35 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, book: 'shut'|'open'|'hat', stylus, after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'smug', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      if (sd === 1 && p.book && p.book !== 'hat') { const g = ST.palm(j, ARM.hsz); notebook(ctx, g[0], g[1] + 4, p.book === 'open'); }
      if (sd === 2 && p.stylus) stylus(ctx, j);
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 100 + sd }));
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 105 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      body(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[0], n[1] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.15 : 1.15, 1.15);
      HEADS[H.V.v](ctx, f);
      if (p.book === 'hat') bookHat(ctx);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.stubborn = { name: 'The Stubborn Cardinal', D, draw, write, extraRow: ['notebook', () => ({ book: 'open', stylus: true, pose: ST.pose('stand', D, null, write(0)) })] };
})();

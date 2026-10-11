/* Main 2 - THE BOSS. A low, wide block: shoulders as wide as a sofa, a gut that rests on his belt, no neck, short
   thick legs (axis: width). A small head for that body: slicked-back black hair with grey wings, heavy jowls and a
   double chin, small mean eyes behind amber-tinted aviators, a big pored nose, five o'clock shadow, a cigar he never
   lights. Muddy-teal silk shirt with a flat palm-leaf print, collar open over chest hair and his one real luxury, a
   thick gold chain (the accent). Cream slacks, white tasselled loafers. Default: disgust. He yells; spit flies. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_OLIVE, SKIN_D = C.SKIN_OLIVE_D, HAIR = '#1c1714', SHIRT = '#4f706c', SHIRT_D = '#38524f', LEAF = '#3a5652', SEED = 310;
  const D = { sw: 104, sy: -500, sz: 10, l1a: 106, l2a: 98, hw: 46, hy: -270, l1l: 140, l2l: 126, elbowOut: 0.9, top: -740, waist: [118, -380], hsz: 44, head: { x: [0, 12, 24, 0], top: -740, bottom: -536, hw: 86 } };
  const NECK = [[0, -556], [10, -554], [20, -550], [0, -556]];
  const OX = [0, 22, 60, 0], OK = [1, 0.8, 0.35, 0];

  const SHIRTS = [
    [-44, -562, -114, -548, -138, -512, -134, -460, -128, -400, -140, -340, -130, -280, -60, -264, 0, -262, 60, -264, 130, -280, 140, -340, 128, -400, 134, -460, 138, -512, 114, -548, 44, -562],
    [-34, -564, -106, -550, -132, -512, -128, -460, -120, -400, -128, -340, -118, -282, -48, -264, 14, -262, 80, -268, 132, -292, 152, -350, 144, -410, 140, -470, 126, -520, 96, -552, 38, -564],
    [-16, -566, -60, -552, -76, -512, -70, -450, -66, -390, -70, -320, -62, -276, 20, -264, 92, -280, 128, -330, 132, -390, 112, -450, 92, -510, 66, -550, 28, -566],
    [-44, -562, -114, -548, -138, -512, -134, -460, -128, -400, -140, -340, -130, -280, -60, -264, 0, -262, 60, -264, 130, -280, 140, -340, 128, -400, 134, -460, 138, -512, 114, -548, 44, -562],
  ];
  const HIPS = [[-104, -296, 104, -296, 108, -258, -108, -258], [-92, -296, 112, -300, 116, -258, -96, -258], [-50, -296, 96, -300, 98, -258, -54, -258], [-104, -296, 104, -296, 108, -258, -108, -258]];
  const BELT = [[-128, -284, 0, -270, 128, -284], [-116, -286, 20, -270, 134, -294], [-60, -286, 50, -276, 120, -292], [-128, -284, 0, -274, 128, -284]];

  function leaves(ctx, bb, seed) {
    for (let i = 0; i < 9; i++) {
      const x = bb.x0 + ST.hash(seed, i, 1) * bb.w, y = bb.y0 + ST.hash(seed, i, 2) * bb.h, a = ST.rnd(-1, 1, seed, i, 3);
      ST.blob(ctx, [x, y, x + 30 * Math.cos(a) - 8, y + 30 * Math.sin(a) - 10, x + 52 * Math.cos(a), y + 52 * Math.sin(a), x + 26 * Math.cos(a) + 8, y + 26 * Math.sin(a) + 10], LEAF, { lw: 0, seed: seed + i });
    }
  }
  function shirt(ctx, v) {
    ST.blob(ctx, HIPS[v], '#b4a986', { lw: 7, seed: SEED + 40 + v, shade: ['#8a8064', -12, 4] });
    ST.blob(ctx, SHIRTS[v], SHIRT, { lw: 8, seed: SEED + v, shade: [SHIRT_D, -26, 8], inner: (bb) => leaves(ctx, bb, SEED + 10 + v), hatch: { c: 'rgba(16,24,22,0.45)', n: 8, len: 44, gap: 7, k: 3, ang: -60 } });
    ST.stroke(ctx, BELT[v], { w: 14, color: C.BROWN_D, seed: SEED + 5, taper: false });
    if (v === 3) { ST.stain(ctx, 0, -470, 120, 90, SEED + 6, 'rgba(20,30,28,0.4)'); return; }
    const x = OX[v], k = OK[v];
    if (v < 2) ST.rough(ctx, [BELT[v][2] - 16, -286, BELT[v][2] + 16, -286, BELT[v][2] + 16, -262, BELT[v][2] - 16, -262], '#8a7a4a', { seed: SEED + 7, lw: 4, amp: 1 });
    ST.blob(ctx, [x - 34 * k, -562, x + 34 * k, -562, x + 16 * k, -480, x - 16 * k, -480], SKIN, { lw: 5, seed: SEED + 8, shade: [SKIN_D, -6, 4], hatch: { c: 'rgba(20,14,10,0.7)', n: 4, len: 14, gap: 4, k: 4, ang: 80 } });
    ST.stroke(ctx, [x - 30 * k, -556, x - 14 * k, -506, x, -496, x + 14 * k, -506, x + 30 * k, -556], { w: 9, color: C.GOLD, seed: SEED + 9, taper: false }); // the chain
    [-1, 1].forEach((s, i) => { if (v === 2 && s < 0) return; ST.blob(ctx, [x + s * 34 * k, -564, x + s * 70 * k, -540, x + s * 30 * k, -500], SHIRT, { lw: 5, seed: SEED + 20 + i, shade: [SHIRT_D, -s * 5, 4] }); }); // collar
    for (let i = 0; i < 4; i++) ST.blob(ctx, ST.ellipseRing(x + 2, -460 + i * 44, 5, 5, 6), '#c9bf9c', { lw: 2.5, seed: SEED + 22 + i });
    ST.stain(ctx, x - 60 * k, -380, 50, 40, SEED + 26, 'rgba(20,30,28,0.35)');
  }

  // ---------- head per view (origin = top of the collar) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -16, 8], mottle: ['#887650', 6, 12], hatch: { c: 'rgba(40,30,14,0.4)', n: 4, len: 16, gap: 5, k: 3, ang: 70 } };
  const STUB = 'rgba(20,16,12,0.55)';
  const HAIRO = { lw: 5, light: ['rgba(200,200,190,0.3)', 6, -6], hatch: { c: 'rgba(120,120,110,0.4)', n: 4, len: 30, gap: 5, k: 3, ang: 0, bend: 0.05 } };
  function tint(ctx, a, b, k) { // amber aviators: tinted glass over the eyes, gold wire frame
    const lens = (x, y, w, s) => ST.blob(ctx, [x - w, y - 12, x + w, y - 14, x + w * 0.9, y + 10, x, y + 20, x - w * 0.85, y + 12], 'rgba(150,100,40,0.42)', { lw: 4, seed: s, lineColor: '#7a6224', light: ['rgba(240,210,150,0.3)', 4, -4] });
    lens(a[0], a[1], 20 * a[2] * k, SEED + 30);
    if (b) { lens(b[0], b[1], 20 * b[2] * k, SEED + 31); ST.stroke(ctx, [a[0] + 18 * a[2], a[1] - 9, b[0] - 18 * b[2], b[1] - 9], { w: 4, color: '#7a6224', seed: SEED + 32, taper: false }); }
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 9 * a[2], 9, f, { skin: SKIN, seed: SEED + 33, lw: 5, side: 0, bags: 2, lidAdd: 0.08 });
    ST.brow(ctx, a[0], a[1] - 20, 34 * a[2], -1, f, { u: 14, thick: 15, color: HAIR, seed: SEED + 34, arch: 0.2 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 9 * b[2], 9, f, { skin: SKIN, seed: SEED + 35, lw: 5, side: 1, bags: 2, lidAdd: 0.08 });
    ST.brow(ctx, b[0], b[1] - 20, 34 * b[2], 1, f, { u: 14, thick: 15, color: HAIR, seed: SEED + 36, arch: 0.2 });
  }
  function nose(ctx, pts) {
    ST.blob(ctx, pts, SKIN, { lw: 6, seed: SEED + 37, shade: [SKIN_D, -6, 5], patch: ['#a99470', 4, -8, 0.3] });
    const b = ST.bbox(pts);
    ST.pores(ctx, b.x0 + b.w * 0.2, b.y0 + b.h * 0.45, b.w * 0.6, b.h * 0.4, 8, SEED + 38, 'rgba(60,40,20,0.5)');
  }
  function cigar(ctx, p, x, y, f) { if (p.cigar === 'mouth' && f.jaw < 0.3) ST.cigar(ctx, x, y, 0.35, SEED + 39); }
  function headFront(ctx, f, p) {
    const jaw = f.jaw * 15;
    [-1, 1].forEach((s, i) => ST.blob(ctx, [s * 64, -96, s * 82, -102, s * 84, -74, s * 70, -58], SKIN, { lw: 5, seed: SEED + 41 + i, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-62, -14 + jaw, -72, -50, -66, -96, -56, -130, -24, -148, 22, -148, 54, -130, 66, -96, 72, -50, 62, -14 + jaw, 40, 10 + jaw, 0, 18 + jaw, -40, 10 + jaw], SKIN, Object.assign({ seed: SEED + 43 }, FACE));
    ST.stubble(ctx, [-64, -50, -56, 6 + jaw, 0, 18 + jaw, 56, 6 + jaw, 64, -50, 30, -36, -30, -36], SEED + 44, 110, STUB);
    ST.stroke(ctx, [-30, 2 + jaw, 0, 12 + jaw, 30, 2 + jaw], { w: 3.5, seed: SEED + 45 }); // double chin
    ST.blob(ctx, [-60, -104, -56, -136, -26, -156, 20, -156, 52, -140, 62, -106, 50, -122, 20, -134, -20, -134, -48, -122], HAIR, Object.assign({ seed: SEED + 46 }, HAIRO));
    [-1, 1].forEach((s, i) => ST.blob(ctx, [s * 54, -96, s * 64, -100, s * 62, -122, s * 52, -116], '#8a857a', { lw: 3, seed: SEED + 47 + i })); // grey wings
    eyes(ctx, f, [-26, -86, 1], [26, -86, 1]);
    ST.mouth(ctx, 0, -22, 46, f, { open: 30, teeth: 'row', seed: SEED + 49, lw: 5 });
    nose(ctx, [-14, -88, 14, -88, 22, -62, 30, -48, 12, -38, -12, -38, -30, -48, -22, -62]);
    if (p.yelling && f.jaw > 0.4) ST.spit(ctx, 0, -10, p.t || 0, SEED + 50);
    cigar(ctx, p, 18, -20, f);
    if (p.tint !== false) tint(ctx, [-26, -86, 1], [26, -86, 1], 1);
  }
  function head34(ctx, f, p) {
    const jaw = f.jaw * 15;
    ST.blob(ctx, [-52, -96, -70, -102, -72, -74, -58, -58], SKIN, { lw: 5, seed: SEED + 51, shade: [SKIN_D, 4, 2] });
    ST.blob(ctx, [-54, -12 + jaw, -64, -50, -60, -96, -48, -132, -14, -150, 30, -148, 60, -128, 72, -96, 80, -60, 74, -14 + jaw, 50, 10 + jaw, 12, 18 + jaw, -30, 10 + jaw], SKIN, Object.assign({ seed: SEED + 52 }, FACE));
    ST.stubble(ctx, [-50, -50, -44, 6 + jaw, 12, 18 + jaw, 70, 6 + jaw, 76, -50, 44, -36, -16, -36], SEED + 53, 110, STUB);
    ST.stroke(ctx, [-12, 2 + jaw, 14, 12 + jaw, 44, 2 + jaw], { w: 3.5, seed: SEED + 54 });
    ST.blob(ctx, [-58, -96, -56, -134, -24, -158, 24, -158, 58, -142, 70, -110, 54, -124, 24, -136, -14, -132, -38, -110, -46, -86], HAIR, Object.assign({ seed: SEED + 55 }, HAIRO));
    ST.blob(ctx, [-48, -92, -56, -100, -52, -122, -40, -112], '#8a857a', { lw: 3, seed: SEED + 56 });
    eyes(ctx, f, [-4, -86, 1], [46, -86, 0.66]);
    ST.mouth(ctx, 28, -22, 40, f, { open: 28, teeth: 'row', seed: SEED + 57, lw: 5 });
    nose(ctx, [14, -88, 34, -88, 46, -62, 56, -48, 36, -38, 12, -40, 6, -52]);
    if (p.yelling && f.jaw > 0.4) ST.spit(ctx, 46, -10, p.t || 0, SEED + 58);
    cigar(ctx, p, 44, -20, f);
    if (p.tint !== false) tint(ctx, [-4, -86, 1], [46, -86, 0.66], 1);
  }
  function headProfile(ctx, f, p) {
    const jaw = f.jaw * 15;
    ST.blob(ctx, [-50, -8, -66, -50, -64, -100, -48, -136, -8, -150, 32, -140, 50, -118, 54, -98, 60, -80, 62, -56, 58, -36, 60, -14 + jaw, 46, 12 + jaw, 16, 20 + jaw, -16, 12, -36, 4], SKIN, Object.assign({ seed: SEED + 59 }, FACE));
    ST.stubble(ctx, [-8, -50, 0, 12 + jaw, 52, 10 + jaw, 58, -40, 30, -40], SEED + 60, 80, STUB);
    ST.blob(ctx, [-66, -96, -62, -134, -30, -158, 16, -156, 46, -136, 52, -116, 30, -130, 0, -134, -26, -124, -40, -96, -48, -62, -62, -66], HAIR, Object.assign({ seed: SEED + 61 }, HAIRO));
    ST.blob(ctx, [-22, -96, -38, -102, -42, -74, -30, -58], SKIN, { lw: 5, seed: SEED + 62, shade: [SKIN_D, 4, 2] });
    eyes(ctx, f, [34, -86, 0.72], null);
    ST.mouth(ctx, 46, -22, 20, f, { open: 24, teeth: 'row', seed: SEED + 63, lw: 5 });
    nose(ctx, [48, -90, 64, -82, 76, -60, 82, -46, 62, -38, 50, -46]);
    if (p.yelling && f.jaw > 0.4) ST.spit(ctx, 62, -14, p.t || 0, SEED + 64);
    cigar(ctx, p, 54, -20, f);
    if (p.tint !== false) tint(ctx, [36, -86, 0.6], null, 1);
  }
  function headBack(ctx) {
    [-1, 1].forEach((s, i) => ST.blob(ctx, [s * 64, -96, s * 82, -102, s * 84, -74, s * 70, -58], SKIN, { lw: 5, seed: SEED + 65 + i, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-62, -10, -72, -50, -66, -96, -56, -130, -24, -148, 22, -148, 54, -130, 66, -96, 72, -50, 62, -10, 0, 0], SKIN, Object.assign({ seed: SEED + 67 }, FACE));
    ST.blob(ctx, [-64, -100, -58, -136, -26, -156, 20, -156, 54, -138, 64, -100, 56, -70, 0, -60, -56, -70], HAIR, Object.assign({ seed: SEED + 68 }, HAIRO));
    [-1, 1].forEach((s, i) => ST.stroke(ctx, [s * 44, -16, s * 8, -6], { w: 4, seed: SEED + 69 + i })); // neck rolls
  }
  const HEADS = [headFront, head34, headProfile, headBack];
  const SWEAT = [[[-40, -112], [50, -110]], [[-20, -112], [60, -106]], [[20, -118]], []];

  const ARM = { cloth: SHIRT, clothD: SHIRT_D, w: [62, 54, 44], bare: 0.15, skin: SKIN, skinD: SKIN_D, hsz: D.hsz, lw: 7, cuff: SHIRT_D, hair: true, hatch: { c: 'rgba(16,24,22,0.45)', n: 3, len: 24, gap: 6, k: 3, ang: 40 } };
  const LEG = { cloth: '#b4a986', clothD: '#8a8064', w: [70, 58, 48], shoe: '#cfc6a6', shoeD: '#9e9678', shoeL: 'rgba(255,250,230,0.4)', len: 80, sw: 38, lw: 7, splay: 0.45 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, yelling (spit), cigar ('mouth' | 'hand'
  //    = in the right hand), tint (false = no glasses), sweat, after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'disgust', { talk: p.talk, look: p.look, talkAmp: 1 });
    const n = NECK[V.v], lay = p.layer || {}, inHand = p.cigar === 'hand';
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, inHand ? 'grip' : P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      if (sd === 2 && inHand) { const g = ST.palm(j, D.hsz); ST.cigar(ctx, g[0] - 10, g[1], ST.figAng(V.mir, -0.6), SEED + 70); }
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 80 + sd }));
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 90 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      shirt(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[0], n[1] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.08 : 1.08, 1.08);
      HEADS[H.V.v](ctx, f, p);
      if (p.sweat) ST.sweat(ctx, SWEAT[H.V.v], p.t || 0, SEED + 95);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.boss = { name: 'The Boss', D, draw, demo: { cigar: 'mouth' }, extraRow: ['yelling', (Dd) => ({ expr: 'yelling', yelling: true, cigar: 'hand', pose: ST.pose('point', Dd, 1) })] };
})();

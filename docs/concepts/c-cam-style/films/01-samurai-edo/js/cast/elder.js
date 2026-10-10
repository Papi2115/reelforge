/* Main 3 - the Elder Official. A tall, gaunt, rigid post of a man inside a stiff soot-green kamishimo: the shoulder
   wings stick out like a roof (wide in front, a narrow blade in profile, a flat board at the back). Long skull, thin
   grey topknot on a liver-spotted pate, enormous bristling grey brows, one eye squeezed, a long hooked nose, deep
   lines from nose to chin, sagging jowls, a thin down-turned mouth with a snaggle tooth. Rust kimono under the
   kamishimo, two swords. Prop: the seal stamp. Default: disgust. Bows from the hip (p.bow). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_CLAY, SKIN_D = C.SKIN_CLAY_D, HAIR = '#7a766b', HAIR_D = '#55514a', BROW = '#cfc8b2', PATE = '#94775f', SEED = 310;
  const KAMI = C.OLIVE_D, KAMI_D = '#2f2e1c', KIMO = C.RUST, KIMO_D = C.RUST_D;
  const D = { sw: 50, sy: -590, sz: 4, l1a: 124, l2a: 116, hw: 26, hy: -350, l1l: 182, l2l: 164, elbowOut: 0.6, top: -860, waist: [60, -430], head: { x: [0, 16, 34, 0], top: -860, bottom: -640, hw: 76 } };
  const NECK = [[0, -616, 0, -650], [8, -614, 14, -648], [14, -612, 30, -644], [0, -616, 0, -650]];
  const SWORDS = { g: [48, -466, 34], h: [32, -500, 126], e: [62, -380, -252], g2: [32, -462, 42], h2: [20, -488, 110], e2: [44, -414, -152] };

  const KIMONO = [
    [-22, -626, -56, -612, -64, -560, -62, -490, -58, -446, 0, -440, 58, -446, 62, -490, 64, -560, 56, -612, 22, -626],
    [-14, -628, -50, -614, -60, -560, -58, -490, -54, -446, 10, -440, 58, -446, 62, -492, 58, -560, 42, -614, 20, -628],
    [-6, -632, -36, -618, -46, -560, -44, -490, -40, -446, 40, -446, 44, -496, 40, -560, 30, -620, 12, -632],
    [-22, -626, -58, -612, -66, -560, -64, -490, -58, -446, 0, -442, 58, -446, 64, -490, 66, -560, 58, -612, 22, -626],
  ];
  const WINGS = [ // the kataginu: stiff winged vest, over the kimono, V open in front
    [-134, -630, -24, -616, -10, -470, -36, -446, -56, -446, -62, -560, -122, -594],
    [-118, -632, -18, -618, 0, -470, -30, -446, -54, -446, -60, -560, -108, -596],
    [-30, -640, 24, -628, 30, -560, 34, -450, -40, -450, -42, -560, -46, -622],
    [-136, -630, 136, -630, 124, -594, 62, -560, 58, -446, -58, -446, -62, -560, -124, -594],
  ];
  const HAKAMA_TOP = [
    [-60, -466, 60, -466, 70, -320, 0, -312, -70, -320],
    [-52, -466, 62, -466, 72, -322, 8, -314, -64, -320],
    [-40, -468, 44, -468, 54, -320, -48, -318],
    [-60, -466, 60, -466, 70, -320, 0, -314, -70, -320],
  ];
  const wingOpts = (v) => ({ lw: 7, seed: SEED + 30 + v, shade: [KAMI_D, -14, 6], hatch: { c: 'rgba(10,10,4,0.55)', n: 4, len: 36, gap: 7, k: 3, ang: 70 } });
  const mirror = (pts) => pts.map((q, i) => (i % 2 === 0 ? -q : q));

  function wings(ctx, v) {
    if (v === 3 || v === 2) { ST.blob(ctx, WINGS[v], KAMI, wingOpts(v)); return; }
    const w = WINGS[v], x = v === 0 ? 0 : 16;
    ST.blob(ctx, w, KAMI, wingOpts(v));
    ST.blob(ctx, v === 0 ? mirror(w) : mirror(w).map((q, i) => (i % 2 === 0 ? q * 0.62 + x * 1.6 : q)), KAMI, wingOpts(v + 4));
    if (v === 0) [-1, 1].forEach((s) => ST.blob(ctx, ST.ellipseRing(s * 46, -580, 10, 10, 8), '#8f927f', { lw: 3.5, seed: SEED + 40 + s }));
  }
  // the stiff wing tips again, over the near arm's shoulder joint (the arm comes out from under them)
  function wingTips(ctx, v) {
    const tip = [-134, -630, -48, -622, -50, -594, -122, -594], x = v === 0 ? 0 : 16;
    ST.blob(ctx, v === 0 ? tip : tip.map((q, i) => (i % 2 === 0 ? q * 0.86 + 6 : q)), KAMI, wingOpts(v + 8));
    ST.blob(ctx, mirror(tip).map((q, i) => (i % 2 === 0 ? (v === 0 ? q : q * 0.62 + x * 1.6) : q)), KAMI, wingOpts(v + 12));
  }
  function torso(ctx, v) {
    ST.blob(ctx, KIMONO[v], KIMO, { lw: 7, seed: SEED + v, shade: [KIMO_D, -16, 6], hatch: { c: 'rgba(20,8,4,0.5)', n: 6, len: 30, gap: 7, k: 3, ang: -60 } });
    if (v < 3) { const x = [0, 14, 34][v]; ST.stroke(ctx, [x + 18, -628, x + 4, -560, x - 14, -470], { w: 11, color: C.LINEN_D, seed: SEED + 4, taper: false }); }
    wings(ctx, v);
    ST.blob(ctx, HAKAMA_TOP[v], KAMI, { lw: 7, seed: SEED + 10 + v, shade: [KAMI_D, -18, 6], hatch: { c: 'rgba(10,10,4,0.5)', n: 6, len: 60, gap: 9, k: 3, ang: 84, bend: 0.03 } });
    if (v < 2) { const x = v === 0 ? 0 : 14; ST.stroke(ctx, [x - 30, -458, x, -446, x + 30, -458], { w: 7, color: KAMI_D, seed: SEED + 15, taper: false }); }
    if (v === 2) ST.rough(ctx, [-44, -486, -26, -484, -30, -430, -46, -432], KAMI_D, { seed: SEED + 16, lw: 4, amp: 1 });
    ST.stain(ctx, [-20, -10, 0, 20][v], -400, 44, 30, SEED + 17, 'rgba(20,20,10,0.35)');
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], mottle: ['#8a5a44', 6, 12], hatch: { c: 'rgba(40,36,28,0.45)', n: 4, len: 18, gap: 5, k: 3, ang: 80 } };
  function pate(ctx, pts, seed) {
    ST.blob(ctx, pts, PATE, { lw: 0, seed });
    ST.blob(ctx, ST.ellipseRing(pts[2] + 22, pts[3] + 14, 9, 6, 7), 'rgba(110,90,60,0.5)', { lw: 0, seed: seed + 1 }); // liver spot
  }
  function hair(ctx, pts, seed) {
    ST.blob(ctx, pts, HAIR, { lw: 5, seed, shade: [HAIR_D, -4, 3], hatch: { c: 'rgba(60,56,44,0.5)', n: 2, len: 14, gap: 4, k: 3, ang: 80 } });
  }
  function knot(ctx, pts, seed) {
    ST.tube(ctx, pts, [11, 9, 7], HAIR, { lw: 4, seed, shade: [HAIR_D, -2, 2] });
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 11 * a[2], 11, f, { skin: SKIN, seed: SEED + 50, lw: 5, side: 0, bags: 2, lidAdd: 0.1 });
    ST.brow(ctx, a[0], a[1] - 22, 40 * a[2], -1, f, { u: 18, thick: 18, color: BROW, seed: SEED + 51, arch: 0.6 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 12 * b[2], 13, f, { skin: SKIN, seed: SEED + 52, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, b[0], b[1] - 24, 42 * b[2], 1, f, { u: 18, thick: 18, color: BROW, seed: SEED + 53, arch: 0.6 });
  }
  function nose(ctx, pts, seed) {
    ST.blob(ctx, pts, SKIN, { lw: 6, seed, shade: [SKIN_D, -6, 5], patch: ['#b8846a', 4, -14, 0.3] });
  }
  function headFront(ctx, f) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-44, 4 + jaw, -50, -50, -50, -120, -40, -166, -10, -184, 20, -184, 44, -166, 52, -120, 52, -50, 46, 4 + jaw, 24, 22 + jaw, 0, 26 + jaw, -24, 22 + jaw], SKIN, Object.assign({ seed: SEED + 54 }, FACE));
    pate(ctx, [-32, -150, -40, -166, -10, -183, 20, -183, 44, -166, 34, -150, 0, -144], SEED + 55);
    hair(ctx, [-53, -100, -50, -150, -36, -146, -42, -96], SEED + 57);
    hair(ctx, [54, -100, 52, -150, 38, -146, 44, -96], SEED + 58);
    knot(ctx, [0, -176, 1, -188, 0, -194], SEED + 59);
    eyes(ctx, f, [-20, -112, 1], [22, -114, 1]);
    [[-1, -26], [1, 28]].forEach(([s, x]) => ST.stroke(ctx, [x + s * 4, -80, x + s * 12, -40, x + s * 8, -6 + jaw], { w: 4.5, seed: SEED + 60 + s }));
    [[-48, -30], [48, -30]].forEach(([x, y], i) => ST.stroke(ctx, [x, y, x * 0.96, y + 26 + jaw, x * 0.7, y + 40 + jaw], { w: 4, seed: SEED + 62 + i })); // jowls
    ST.mouth(ctx, 2, -24, 30, f, { open: 26, teeth: 'snag', seed: SEED + 64, lw: 5, under: [[0.4, 9]] });
    nose(ctx, [-8, -124, 8, -126, 14, -80, 24, -56, 10, -46, -8, -50, -14, -80], SEED + 65);
    ST.wart(ctx, -34, -60, 4.5, '#5a3a2a', SEED + 66, true);
    ST.pores(ctx, 24, -80, 22, 18, 7, SEED + 67);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-36, 4 + jaw, -44, -50, -46, -120, -34, -168, 0, -186, 30, -182, 52, -162, 60, -120, 58, -100, 64, -80, 60, -50, 54, 4 + jaw, 32, 22 + jaw, 8, 26 + jaw, -16, 20 + jaw], SKIN, Object.assign({ seed: SEED + 68 }, FACE));
    pate(ctx, [-24, -152, -30, -168, 0, -185, 30, -181, 50, -162, 42, -150, 10, -144], SEED + 69);
    hair(ctx, [-47, -100, -44, -152, -28, -146, -34, -96], SEED + 71);
    knot(ctx, [-12, -178, 4, -190, 18, -192], SEED + 72);
    eyes(ctx, f, [-2, -112, 1], [44, -114, 0.64]);
    ST.stroke(ctx, [10, -80, 2, -40, 8, -6 + jaw], { w: 4.5, seed: SEED + 73 });
    ST.stroke(ctx, [-40, -30, -42, -4 + jaw, -30, 12 + jaw], { w: 4, seed: SEED + 74 });
    ST.mouth(ctx, 28, -24, 26, f, { open: 24, teeth: 'snag', seed: SEED + 75, lw: 5, under: [[0.4, 9]] });
    nose(ctx, [20, -126, 34, -126, 46, -82, 60, -56, 46, -46, 26, -50, 20, -80], SEED + 76);
    ST.wart(ctx, -18, -60, 4.5, '#5a3a2a', SEED + 77, true);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-34, -4, -56, -60, -58, -126, -42, -170, -6, -188, 28, -178, 44, -152, 48, -124, 46, -110, 50, -60, 44, -40, 48, -22 + jaw, 40, 0 + jaw, 24, 22 + jaw, 0, 24, -18, 10], SKIN, Object.assign({ seed: SEED + 78 }, FACE));
    pate(ctx, [-30, -172, -4, -187, 28, -177, 42, -150, 24, -146, -6, -152, -24, -160], SEED + 79);
    hair(ctx, [-60, -96, -56, -150, -34, -160, -22, -144, -36, -110, -44, -80], SEED + 81);
    knot(ctx, [-32, -172, -10, -192, 14, -194], SEED + 82);
    ST.blob(ctx, [-24, -116, -4, -120, 2, -84, -18, -76], SKIN, { lw: 6, seed: SEED + 83, shade: [SKIN_D, -4, 2] }); // long-lobed ear
    eyes(ctx, f, [30, -112, 0.72], null);
    ST.stroke(ctx, [20, -74, 14, -40, 22, -10 + jaw], { w: 4.5, seed: SEED + 84 });
    ST.mouth(ctx, 40, -24, 14, f, { open: 22, teeth: 'snag', seed: SEED + 85, lw: 5 });
    nose(ctx, [40, -130, 52, -124, 72, -80, 80, -56, 64, -50, 50, -58, 44, -90], SEED + 86);
  }
  function headBack(ctx) {
    ST.blob(ctx, [-44, 0, -52, -50, -52, -120, -42, -166, -10, -184, 20, -184, 44, -166, 52, -120, 52, -50, 44, 0, 0, 8], SKIN, Object.assign({ seed: SEED + 87 }, FACE));
    ST.blob(ctx, [-53, -40, -54, -130, -36, -170, 0, -178, 36, -170, 54, -130, 53, -40, 30, -20, 0, -14, -30, -20], HAIR, { lw: 0, seed: SEED + 88, shade: [HAIR_D, -6, 4], hatch: { c: 'rgba(60,56,44,0.5)', n: 10, len: 16, gap: 4, k: 3, ang: 85 } });
    knot(ctx, [0, -170, 0, -186, 0, -194], SEED + 89);
    [-1, 1].forEach((s) => ST.stroke(ctx, [s * 14, -8, s * 12, 18], { w: 3.5, seed: SEED + 90 + s }));
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  const ARM = { cloth: KIMO, clothD: KIMO_D, w: [34, 30, 28], bare: 0.8, skin: SKIN, skinD: SKIN_D, hsz: 32, lw: 6, hatch: { c: 'rgba(20,8,4,0.45)', n: 3, len: 24, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: KAMI, clothD: KAMI_D, w: [72, 84, 98], shoe: C.LINEN_D, shoeD: '#5f584a', len: 62, sw: 24, lw: 6, splay: 0.25, hatch: { c: 'rgba(10,10,4,0.45)', n: 3, len: 50, gap: 9, k: 3, ang: 84, bend: 0.03 } };
  // stamping: right hand up (lift 0..1) above a desk point in front of the belly
  ST.elderStamp = (Dd, lift) => ({ hR: ST.handAt(Dd, -1, -0.3, 0.55 - 0.45 * lift, 0.62), kR: 'grip', poleR: [-1, 0.6, -0.2] });

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, bow, layer {L,R}, stamp (in the right hand), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'disgust', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {}, bow = p.bow || 0, hy = D.hy + J.bob;
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      ST.sode(ctx, V, j, 76, KIMO, KIMO_D, SEED + 92 + sd);
      if (sd === 2 && p.stamp) ST.hanko(ctx, ST.palm(j, ARM.hsz), SEED + 94);
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 95 + sd }));
    });
    const swords = (front) => ST.daisho(ctx, V, SWORDS, front);
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      ST.bowed(ctx, hy, bow, () => { swords(false); armsAt(0); });
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 97 + sg })));
      if (bow) ST.blob(ctx, ST.ellipseRing(-6, hy + 6, 52, 44, 10), KAMI, { lw: 6, seed: SEED + 99 });
      ST.bowed(ctx, hy, bow, () => {
        ctx.save();
        ctx.translate(0, J.bob);
        ST.tube(ctx, [n[0], n[1] + 16, n[2], n[3] + 10 + (p.headDy || 0)], [36, 32], SKIN, { lw: 6, seed: SEED + 98, shade: [SKIN_D, -6, 0] });
        torso(ctx, V.v);
        ctx.restore();
        armsAt(1);
        const H = ST.headView(V.yaw, p.head);
        ctx.save();
        ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
        ctx.scale(H.flip ? -1.05 : 1.05, 1.05);
        HEADS[H.V.v](ctx, f);
        ctx.restore();
        swords(true);
        armsAt(2);
        if (V.v < 2) { ctx.save(); ctx.translate(0, J.bob); wingTips(ctx, V.v); ctx.restore(); } // wings ride over the shoulder joints
        if (p.after) p.after(J);
      });
    });
  }
  ST.CAST.elder = { name: 'The Elder Official', D, draw, hsz: ARM.hsz, demo: { stamp: true }, extraRow: ['stamp up', (Dd) => ({ stamp: true, pose: ST.pose('stand', Dd, null, ST.elderStamp(Dd, 1)) })] };
})();

/* Cast 6 - the Passer-by Samurai (the scabbard bump). A slab: thick neck wider than his head, big chest pushing a
   black crested haori, grey striped hakama, the two swords. Square head on that neck, low forehead under the shaved
   pate, one solid brow across both eyes, small mean eyes, a broken flattened nose, a white scar through the cheek,
   an underbite with two lower teeth over the lip, blue jowls. Default: rage. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_RUDDY, SKIN_D = C.SKIN_RUDDY_D, HAIR = '#1c1916', PATE = '#8a7a66', SEED = 610;
  const HAORI = C.BLACK, HAORI_D = C.BLACK_D, HAKA = C.STONE, HAKA_D = C.STONE_D;
  const D = { sw: 62, sy: -560, sz: 4, l1a: 118, l2a: 110, hw: 30, hy: -340, l1l: 172, l2l: 156, elbowOut: 0.7, top: -830, waist: [74, -420], head: { x: [0, 16, 32, 0], top: -830, bottom: -600, hw: 86 } };
  const NECK = [[0, -588], [10, -588], [22, -584], [0, -588]];
  const SWORDS = { g: [56, -446, 40], h: [40, -480, 132], e: [70, -362, -250], g2: [40, -442, 48], h2: [26, -468, 114], e2: [52, -396, -152] };

  const HAORI_S = [
    [-44, -600, -96, -586, -110, -540, -106, -470, -96, -420, -90, -380, 0, -372, 90, -380, 96, -420, 106, -470, 110, -540, 96, -586, 44, -600],
    [-32, -602, -86, -588, -102, -540, -98, -470, -88, -420, -82, -380, 14, -372, 94, -380, 104, -424, 114, -476, 108, -540, 80, -590, 34, -602],
    [-14, -606, -56, -592, -70, -540, -68, -470, -60, -420, -56, -380, 60, -378, 72, -424, 88, -480, 80, -540, 54, -592, 20, -606],
    [-44, -600, -98, -586, -112, -540, -108, -470, -98, -420, -90, -380, 0, -374, 90, -380, 98, -420, 108, -470, 112, -540, 98, -586, 44, -600],
  ];
  const HAKAMA_TOP = [
    [-70, -452, 70, -452, 82, -310, 0, -302, -82, -310],
    [-62, -452, 72, -452, 84, -312, 8, -304, -74, -310],
    [-48, -454, 54, -454, 66, -310, -58, -308],
    [-70, -452, 70, -452, 82, -310, 0, -304, -82, -310],
  ];
  const OPEN = [0, 24, 66, null];

  function torso(ctx, v) {
    ST.blob(ctx, HAKAMA_TOP[v], HAKA, { lw: 7, seed: SEED + v, shade: [HAKA_D, -18, 6], hatch: { c: 'rgba(20,18,12,0.5)', n: 6, len: 60, gap: 9, k: 3, ang: 84, bend: 0.03 } });
    const st = [[-50, -22, 6, 34, 60], [-40, -10, 20, 50], [-30, 0, 30], [-50, -22, 6, 34, 60]][v];
    st.forEach((x, i) => ST.stroke(ctx, [x, -440, x + (x > 0 ? 6 : -6), -312], { w: 5, color: '#5a554a', seed: SEED + 4 + i, taper: false }));
    ST.blob(ctx, HAORI_S[v], HAORI, { lw: 8, seed: SEED + 10 + v, shade: [HAORI_D, -20, 6], light: ['#3d3833', 10, -6], hatch: { c: 'rgba(120,110,90,0.25)', n: 8, len: 36, gap: 7, k: 3, ang: -60 } });
    const x = OPEN[v];
    if (x !== null) {
      ST.blob(ctx, [x - 20, -598, x + 20, -598, x + 26, -380, x - 26, -380], C.GREYBLUE_D, { lw: 5, seed: SEED + 15 });
      ST.stroke(ctx, [x - 18, -598, x, -540, x + 18, -598], { w: 10, color: C.LINEN_D, seed: SEED + 16, taper: false });
      ST.stroke(ctx, [x - 26, -470, x, -478, x + 26, -470], { w: 6, color: C.LINEN_D, seed: SEED + 17, taper: false }); // haori tie
      [[-56, -540], [56, -540]].slice(0, v === 0 ? 2 : v === 1 ? 1 : 0).forEach(([cx, cy], i) => ST.blob(ctx, ST.ellipseRing(x + cx * (v ? 1.3 : 1), cy, 12, 12, 8), '#8f927f', { lw: 3.5, seed: SEED + 18 + i, inner: () => ST.stroke(ctx, [x + cx - 6, cy - 6, x + cx + 6, cy + 6], { w: 2.5, seed: SEED + 20, taper: false }) }));
    } else ST.blob(ctx, ST.ellipseRing(0, -560, 14, 14, 8), '#8f927f', { lw: 3.5, seed: SEED + 21 });
    ST.stain(ctx, [40, 30, 10, -30][v], -430, 40, 26, SEED + 22, 'rgba(90,80,60,0.3)');
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 8, shade: [SKIN_D, -16, 8], mottle: ['rgba(130,60,40,0.3)', 6, 12], hatch: { c: 'rgba(70,40,30,0.4)', n: 4, len: 16, gap: 5, k: 3, ang: 70 } };
  const JOWL = 'rgba(50,60,70,0.55)';
  function pate(ctx, pts, seed) { ST.blob(ctx, pts, PATE, { lw: 0, seed }); ST.stubble(ctx, pts, seed + 1, 30, 'rgba(40,44,46,0.45)'); }
  function knot(ctx, pts, seed) { ST.tube(ctx, pts, [16, 14, 10], HAIR, { lw: 5, seed, light: ['#45403a', 2, -3] }); }
  function unibrow(ctx, pts, f, seed) { ST.stroke(ctx, pts.map((q, i) => (i % 2 ? q - f.bl[0] * 8 + (i === 3 ? f.bl[1] * 6 : 0) : q)), { w: 16, color: HAIR, seed, taper: false }); }
  function scar(ctx, x0, y0, x1, y1, seed) { ST.stroke(ctx, [x0, y0, (x0 + x1) / 2 + 3, (y0 + y1) / 2, x1, y1], { w: 4, color: '#c79a82', seed, taper: false }); }
  function nose(ctx, pts, seed) { ST.blob(ctx, pts, SKIN, { lw: 6, seed, shade: [SKIN_D, -6, 5], patch: ['rgba(190,110,90,0.5)', 3, -6, 0.4] }); }
  const eye = (ctx, f, x, y, k, side) => ST.eye(ctx, x, y, 9 * k, 9, f, { skin: SKIN, seed: SEED + 30 + side, lw: 5, side, bags: 1, lidAdd: 0.08 });
  function headFront(ctx, f) {
    const jaw = f.jaw * 14;
    [-1, 1].forEach((s) => ST.blob(ctx, [s * 58, -96, s * 78, -102, s * 78, -70, s * 62, -58], SKIN, { lw: 6, seed: SEED + 33 + s, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-64, -6 + jaw, -64, -70, -60, -120, -50, -140, -20, -150, 20, -150, 50, -140, 60, -120, 64, -70, 64, -6 + jaw, 36, 14 + jaw, 0, 18 + jaw, -36, 14 + jaw], SKIN, Object.assign({ seed: SEED + 36 }, FACE));
    pate(ctx, [-46, -122, -50, -138, -20, -149, 20, -149, 50, -138, 46, -122, 0, -116], SEED + 37);
    ST.blob(ctx, [-63, -70, -60, -120, -46, -118, -50, -70], HAIR, { lw: 5, seed: SEED + 39 });
    ST.blob(ctx, [63, -70, 60, -120, 46, -118, 50, -70], HAIR, { lw: 5, seed: SEED + 40 });
    knot(ctx, [0, -144, 0, -158, 0, -166], SEED + 41);
    ST.stubble(ctx, [-60, -40, -54, 4 + jaw, 0, 16 + jaw, 54, 4 + jaw, 60, -40, 20, -26, -20, -26], SEED + 42, 90, JOWL);
    eye(ctx, f, -22, -88, 1, 0);
    eye(ctx, f, 22, -88, 1, 1);
    unibrow(ctx, [-44, -104, -10, -100, 10, -100, 44, -104], f, SEED + 43);
    ST.mouth(ctx, 0, -22, 44, f, { open: 28, teeth: 'few', seed: SEED + 44, lw: 6, under: [[-0.4, 12], [0.35, 10]] });
    nose(ctx, [-12, -88, 10, -90, 18, -58, 8, -44, -14, -46, -20, -60], SEED + 45);
    scar(ctx, 34, -70, 50, -36, SEED + 46);
  }
  function head34(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-48, -96, -68, -102, -68, -70, -52, -58], SKIN, { lw: 6, seed: SEED + 47, shade: [SKIN_D, 4, 2] });
    ST.blob(ctx, [-56, -6 + jaw, -58, -70, -54, -120, -40, -142, -6, -152, 30, -148, 56, -134, 68, -110, 72, -70, 70, -6 + jaw, 44, 14 + jaw, 12, 18 + jaw, -26, 14 + jaw], SKIN, Object.assign({ seed: SEED + 48 }, FACE));
    pate(ctx, [-36, -124, -40, -140, -6, -151, 30, -147, 54, -132, 48, -120, 10, -116], SEED + 49);
    ST.blob(ctx, [-57, -70, -54, -122, -38, -118, -42, -70], HAIR, { lw: 5, seed: SEED + 51 });
    knot(ctx, [-14, -146, 2, -160, 20, -164], SEED + 52);
    ST.stubble(ctx, [-50, -40, -44, 4 + jaw, 12, 16 + jaw, 64, 4 + jaw, 70, -40, 34, -26, -6, -26], SEED + 53, 80, JOWL);
    eye(ctx, f, 0, -88, 1, 0);
    eye(ctx, f, 46, -88, 0.62, 1);
    unibrow(ctx, [-20, -104, 10, -100, 30, -100, 58, -104], f, SEED + 54);
    ST.mouth(ctx, 28, -22, 40, f, { open: 26, teeth: 'few', seed: SEED + 55, lw: 6, under: [[-0.3, 12], [0.35, 10]] });
    nose(ctx, [20, -90, 40, -90, 52, -58, 42, -44, 20, -46, 16, -60], SEED + 56);
    scar(ctx, -24, -70, -10, -36, SEED + 57);
  }
  function headProfile(ctx, f) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-56, 0, -70, -60, -66, -118, -50, -144, -12, -154, 26, -146, 48, -124, 52, -104, 50, -96, 58, -70, 56, -40, 64, -18 + jaw, 56, 6 + jaw, 30, 18 + jaw, -14, 12], SKIN, Object.assign({ seed: SEED + 58 }, FACE));
    pate(ctx, [-30, -146, -10, -153, 26, -145, 46, -122, 20, -118, -14, -126], SEED + 59);
    ST.blob(ctx, [-70, -70, -66, -124, -40, -134, -30, -110, -42, -70], HAIR, { lw: 5, seed: SEED + 61 });
    knot(ctx, [-40, -146, -16, -162, 10, -166], SEED + 62);
    ST.blob(ctx, [-30, -96, -10, -100, -4, -68, -24, -60], SKIN, { lw: 6, seed: SEED + 63, shade: [SKIN_D, -4, 2] });
    ST.stubble(ctx, [-8, -40, -4, 8 + jaw, 56, 12 + jaw, 60, -30, 34, -30], SEED + 64, 60, JOWL);
    eye(ctx, f, 34, -88, 0.72, 1);
    unibrow(ctx, [18, -102, 34, -100, 44, -100, 54, -104], f, SEED + 65);
    ST.mouth(ctx, 50, -22, 22, f, { open: 22, teeth: 'few', seed: SEED + 66, lw: 6, under: [[0.2, 12]] });
    nose(ctx, [46, -92, 62, -86, 70, -60, 64, -48, 50, -50], SEED + 67);
    scar(ctx, 6, -74, 20, -40, SEED + 68);
  }
  function headBack(ctx) {
    [-1, 1].forEach((s) => ST.blob(ctx, [s * 58, -96, s * 78, -102, s * 78, -70, s * 62, -58], SKIN, { lw: 6, seed: SEED + 69 + s, shade: [SKIN_D, -s * 4, 2] }));
    ST.blob(ctx, [-64, -4, -64, -70, -60, -120, -50, -140, -20, -150, 20, -150, 50, -140, 60, -120, 64, -70, 64, -4, 0, 6], SKIN, Object.assign({ seed: SEED + 72 }, FACE));
    ST.blob(ctx, [-64, -50, -62, -120, -40, -142, 0, -148, 40, -142, 62, -120, 64, -50, 34, -30, 0, -24, -34, -30], HAIR, { lw: 0, seed: SEED + 73, light: ['#3b3632', 4, -4], hatch: { c: 'rgba(120,110,90,0.3)', n: 10, len: 16, gap: 4, k: 3, ang: 85 } });
    knot(ctx, [0, -140, 0, -156, 0, -166], SEED + 74);
    [-1, 1].forEach((s) => ST.stroke(ctx, [s * 40, -10, 0, 0, -s * 40, -10], { w: 4, seed: SEED + 75 + s }));
  }
  const HEADS = [headFront, head34, headProfile, headBack];

  const ARM = { cloth: HAORI, clothD: HAORI_D, w: [46, 42, 40], bare: 0.82, skin: SKIN, skinD: SKIN_D, hsz: 38, lw: 7, hatch: { c: 'rgba(120,110,90,0.25)', n: 3, len: 24, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: HAKA, clothD: HAKA_D, w: [80, 90, 104], shoe: C.LINEN_D, shoeD: '#5f584a', len: 66, sw: 28, lw: 7, splay: 0.35, hatch: { c: 'rgba(20,18,12,0.45)', n: 3, len: 50, gap: 9, k: 3, ang: 84, bend: 0.03 } };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, bow, layer {L,R}, noSwords, after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'rage', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {}, bow = p.bow || 0, hy = D.hy + J.bob;
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      ST.sode(ctx, V, j, 84, HAORI, HAORI_D, SEED + 90 + sd);
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k || 'fist', seed: SEED + 93 + sd }));
    });
    const swords = (front) => { if (!p.noSwords) ST.daisho(ctx, V, SWORDS, front); };
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      ST.bowed(ctx, hy, bow, () => { swords(false); armsAt(0); });
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 96 + sg })));
      if (bow) ST.blob(ctx, ST.ellipseRing(-6, hy + 6, 60, 46, 10), HAKA, { lw: 6, seed: SEED + 99 });
      ST.bowed(ctx, hy, bow, () => {
        ctx.save();
        ctx.translate(0, J.bob);
        ST.tube(ctx, [n[0], n[1] + 24, n[0] + V.v * 2, n[1] - 20], [104, 96], SKIN, { lw: 7, seed: SEED + 98, shade: [SKIN_D, -8, 0] });
        torso(ctx, V.v);
        ctx.restore();
        armsAt(1);
        const H = ST.headView(V.yaw, p.head);
        ctx.save();
        ctx.translate(n[0], n[1] + J.bob + (p.headDy || 0));
        ctx.scale(H.flip ? -1.12 : 1.12, 1.12);
        HEADS[H.V.v](ctx, f);
        ctx.restore();
        swords(true);
        armsAt(2);
        if (p.after) p.after(J);
      });
    });
  }
  function swordEnd(p, P) {
    const V = ST.view(p.yaw || 0), J = ST.solve(V, D, P), e = ST.swordEnd(V, SWORDS, 0);
    return ST.figToWorld(p, V.mir, (p.lean || 0) + (P.lean || 0), ST.bowPt(e, D.hy + J.bob, p.bow || 0));
  }
  ST.CAST.rival = { name: 'The Passer-by Samurai', D, draw, hsz: ARM.hsz, swordEnd };
})();

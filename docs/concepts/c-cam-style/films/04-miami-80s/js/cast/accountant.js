/* Main 3 - THE ACCOUNTANT, your best friend. A pear (axis: narrow sloping shoulders, wide soft hips) on skinny legs in
   too-short slacks, white socks and sandals. A cloud of permed curls behind a high shiny forehead, a big droopy
   moustache that hides his mouth, small rimless glasses halfway down a long thin nose, a weak chin, a nervous blink.
   Mustard short-sleeved polyester shirt with sweat rings, a brown tie, a pocket protector full of pens. Default:
   scared. Later he wears a wire: a taped lump and a cable peeking out between two buttons. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_SALLOW, SKIN_D = C.SKIN_SALLOW_D, PERM = '#6a4a2c', PERM_D = '#4a321c', SHIRT = '#a08a46', SHIRT_D = '#776634', SEED = 510;
  const D = { sw: 54, sy: -560, sz: 6, l1a: 116, l2a: 108, hw: 44, hy: -330, l1l: 166, l2l: 152, elbowOut: 0.7, top: -830, waist: [80, -420], hsz: 36, head: { x: [0, 14, 28, 0], top: -834, bottom: -608, hw: 92 } };
  const NECK = [[0, -576, 0, -620], [6, -574, 12, -616], [12, -570, 24, -612], [0, -576, 0, -620]];
  const OX = [0, 16, 40, 0], OK = [1, 0.8, 0.4, 0];

  const SHIRTS = [
    [-24, -596, -60, -586, -78, -556, -84, -500, -102, -446, -120, -392, -112, -346, -86, -320, 0, -314, 86, -320, 112, -346, 120, -392, 102, -446, 84, -500, 78, -556, 60, -586, 24, -596],
    [-18, -598, -56, -588, -74, -556, -80, -500, -96, -446, -112, -392, -104, -346, -78, -320, 10, -314, 88, -320, 118, -350, 126, -398, 108, -450, 88, -504, 76, -558, 54, -588, 22, -598],
    [-8, -600, -38, -588, -52, -556, -56, -500, -66, -446, -80, -392, -76, -346, -56, -320, 30, -316, 70, -324, 96, -352, 100, -398, 80, -450, 60, -504, 54, -558, 40, -590, 18, -600],
    [-24, -596, -60, -586, -78, -556, -84, -500, -102, -446, -120, -392, -112, -346, -86, -320, 0, -316, 86, -320, 112, -346, 120, -392, 102, -446, 84, -500, 78, -556, 60, -586, 24, -596],
  ];
  const HIPS = [[-90, -342, 90, -342, 94, -300, -94, -300], [-82, -342, 94, -344, 98, -300, -86, -300], [-58, -342, 72, -344, 76, -300, -62, -300], [-90, -342, 90, -342, 94, -300, -94, -300]];
  function shirt(ctx, v, wire) {
    ST.blob(ctx, SHIRTS[v], SHIRT, { lw: 7, seed: SEED + v, shade: [SHIRT_D, -20, 8], mottle: ['rgba(80,60,20,0.25)', 5, 18], hatch: { c: 'rgba(50,40,14,0.45)', n: 7, len: 36, gap: 7, k: 3, ang: -50 } });
    ST.blob(ctx, HIPS[v], '#6b5843', { lw: 7, seed: SEED + 4 + v, shade: ['#4d3e2e', -10, 4] });
    ST.stroke(ctx, [HIPS[v][0] - 4, -338, OX[v], -330, HIPS[v][2] + 4, -338], { w: 10, color: C.BLACK, seed: SEED + 8, taper: false });
    if (v === 3) { ST.stain(ctx, 0, -500, 80, 70, SEED + 9, 'rgba(90,70,20,0.35)'); return; }
    const x = OX[v], k = OK[v];
    [-1, 1].forEach((s, i) => { if (v === 2 && s < 0) return; ST.stain(ctx, x + s * 72 * k, -520, 40, 46, SEED + 10 + i, 'rgba(110,80,20,0.4)'); }); // sweat rings
    ST.blob(ctx, [x - 6, -590, x + 6, -590, x + 10, -440, x, -422, x - 10, -440], C.BROWN, { lw: 4, seed: SEED + 12 });
    [-1, 1].forEach((s, i) => { if (v === 2 && s < 0) return; ST.blob(ctx, [x + s * 4, -594, x + s * 30 * k, -598, x + s * 24 * k, -572], SHIRT, { lw: 4, seed: SEED + 13 + i }); });
    if (v < 2) { // pocket protector + pens
      ST.rect(ctx, x + 26 * k, -548, 30 * k, 34, '#c9c2a8', { seed: SEED + 15, lw: 3, amp: 0.5 });
      [C.RED_D, C.BLACK, C.GREYBLUE].forEach((col, i) => ST.tube(ctx, [x + (30 + i * 9) * k, -566, x + (30 + i * 9) * k, -540], [6, 6], col, { lw: 2.5, seed: SEED + 16 + i }));
    }
    if (wire) { // the wire: a gap between buttons, tape, a cable
      ST.blob(ctx, [x + 4, -476, x + 26 * k + 6, -478, x + 24 * k + 6, -446, x + 6, -444], '#c4b48c', { lw: 3.5, seed: SEED + 19 });
      ST.stroke(ctx, [x + 14 * k + 6, -462, x + 30 * k, -430, x + 20 * k, -396, x + 40 * k, -360], { w: 4.5, color: C.INK, seed: SEED + 20, taper: false });
      ST.blob(ctx, ST.ellipseRing(x + 14 * k + 6, -462, 6, 5, 6), C.BLACK, { lw: 2.5, seed: SEED + 21 });
    }
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], light: ['rgba(235,225,190,0.35)', 6, -10], mottle: ['rgba(140,110,60,0.25)', 5, 10], hatch: { c: 'rgba(60,50,30,0.35)', n: 3, len: 16, gap: 5, k: 3, ang: 72 } };
  function perm(ctx, cx, cy, rx, ry, seed) { // the cloud of curls: scalloped ring + curl ticks
    const pts = [];
    for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, r = i % 2 ? 1 : 1.12; pts.push(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r); }
    ST.blob(ctx, pts, PERM, { lw: 6, seed, step: 5, shade: [PERM_D, -12, 8], inner: (bb) => { for (let i = 0; i < 26; i++) { const x = bb.x0 + ST.hash(seed, i, 1) * bb.w, y = bb.y0 + ST.hash(seed, i, 2) * bb.h; ST.stroke(ctx, [x - 6, y, x, y - 6, x + 6, y], { w: 3, color: PERM_D, seed: seed + i, taper: false }); } } });
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 10 * a[2], 11, f, { skin: SKIN, seed: SEED + 30, lw: 5, side: 0, bags: 2 });
    ST.brow(ctx, a[0], a[1] - 22, 28 * a[2], -1, f, { u: 18, thick: 8, color: PERM, seed: SEED + 31, arch: 0.8 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 10 * b[2], 11, f, { skin: SKIN, seed: SEED + 32, lw: 5, side: 1, bags: 2 });
    ST.brow(ctx, b[0], b[1] - 22, 28 * b[2], 1, f, { u: 18, thick: 8, color: PERM, seed: SEED + 33, arch: 0.8 });
  }
  function specs(ctx, a, b, k, fog) { // small rimless glasses that sit low on the nose (fogged white over the freezer)
    const g = (x, y, w, s) => ST.blob(ctx, ST.ellipseRing(x, y + 8, w, 12, 9), fog ? '#d6dbd2' : 'rgba(200,210,200,0.14)', { lw: 3, seed: s, lineColor: '#5d5a50', light: ['rgba(240,240,230,0.35)', 3, -3] });
    g(a[0], a[1], 16 * a[2] * k, SEED + 34);
    if (b) { g(b[0], b[1], 16 * b[2] * k, SEED + 35); ST.stroke(ctx, [a[0] + 15 * a[2], a[1] + 4, b[0] - 15 * b[2], b[1] + 4], { w: 3, color: '#5d5a50', seed: SEED + 36, taper: false }); }
  }
  const tache = (ctx, x, w, seed) => ST.blob(ctx, [x - w, -18, x - w * 0.8, -40, x - w * 0.3, -50, x, -46, x + w * 0.3, -50, x + w * 0.8, -40, x + w, -18, x + w * 0.9, -6, x + w * 0.6, -24, x, -32, x - w * 0.6, -24, x - w * 0.9, -6], PERM_D, { lw: 4.5, seed, hatch: { c: 'rgba(150,110,70,0.5)', n: 3, len: 12, gap: 4, k: 3, ang: 80 } });
  function headFront(ctx, f, fog) {
    const jaw = f.jaw * 14;
    perm(ctx, 0, -130, 94, 76, SEED + 37);
    ST.blob(ctx, [-48, -20 + jaw, -54, -70, -56, -120, -46, -160, -16, -178, 18, -178, 46, -160, 56, -120, 54, -70, 46, -22 + jaw, 24, 0 + jaw, 0, 6 + jaw, -24, 0 + jaw], SKIN, Object.assign({ seed: SEED + 38 }, FACE));
    [-1, 1].forEach((s, i) => ST.stroke(ctx, [s * -22, -150 + i * 12, 0, -154 + i * 12, s * 22, -150 + i * 12], { w: 3, seed: SEED + 39 + i })); // forehead lines
    eyes(ctx, f, [-22, -100, 1], [22, -100, 1]);
    ST.mouth(ctx, 0, -20, 30, f, { open: 22, teeth: 'few', seed: SEED + 41, lw: 5 });
    ST.blob(ctx, [-6, -102, 8, -102, 12, -66, 16, -54, 4, -48, -10, -50, -12, -60], SKIN, { lw: 6, seed: SEED + 42, shade: [SKIN_D, -5, 4], patch: ['#c6b48c', 3, -8, 0.3] });
    tache(ctx, 0, 34, SEED + 43);
    specs(ctx, [-22, -100, 1], [22, -100, 1], 1, fog);
  }
  function head34(ctx, f, fog) {
    const jaw = f.jaw * 14;
    perm(ctx, -16, -132, 90, 76, SEED + 44);
    ST.blob(ctx, [-40, -18 + jaw, -48, -70, -50, -122, -38, -162, -6, -180, 28, -176, 52, -156, 62, -120, 64, -92, 70, -64, 60, -24 + jaw, 38, 0 + jaw, 12, 6 + jaw, -16, 0 + jaw], SKIN, Object.assign({ seed: SEED + 45 }, FACE));
    ST.stroke(ctx, [-6, -150, 18, -154, 40, -150], { w: 3, seed: SEED + 46 });
    eyes(ctx, f, [-2, -100, 1], [42, -100, 0.66]);
    ST.mouth(ctx, 28, -20, 26, f, { open: 20, teeth: 'few', seed: SEED + 47, lw: 5 });
    ST.blob(ctx, [20, -102, 32, -102, 42, -68, 52, -54, 38, -48, 22, -50, 18, -60], SKIN, { lw: 6, seed: SEED + 48, shade: [SKIN_D, -5, 4], patch: ['#c6b48c', 3, -8, 0.3] });
    tache(ctx, 30, 28, SEED + 49);
    specs(ctx, [-2, -100, 1], [42, -100, 0.66], 1, fog);
  }
  function headProfile(ctx, f, fog) {
    const jaw = f.jaw * 14;
    perm(ctx, -30, -126, 76, 74, SEED + 50);
    ST.blob(ctx, [-36, -10, -50, -60, -52, -120, -36, -162, 0, -180, 32, -170, 48, -146, 52, -118, 50, -104, 58, -86, 56, -66, 52, -50, 54, -34, 46, -18 + jaw, 30, 0 + jaw, 10, 4 + jaw, -14, -2], SKIN, Object.assign({ seed: SEED + 51 }, FACE));
    eyes(ctx, f, [34, -100, 0.72], null);
    ST.mouth(ctx, 40, -20, 14, f, { open: 18, teeth: 'few', seed: SEED + 52, lw: 5 });
    ST.blob(ctx, [44, -104, 56, -96, 70, -66, 74, -54, 58, -48, 48, -56], SKIN, { lw: 6, seed: SEED + 53, shade: [SKIN_D, -5, 4] });
    tache(ctx, 46, 18, SEED + 54);
    specs(ctx, [42, -100, 0.6], null, 1, fog);
    ST.stroke(ctx, [30, -96, -20, -100], { w: 3, color: '#5d5a50', seed: SEED + 55, taper: false }); // the arm of the glasses
  }
  function headBack(ctx) {
    ST.blob(ctx, [-48, -10, -54, -70, -56, -120, -46, -160, -16, -178, 18, -178, 46, -160, 56, -120, 54, -70, 46, -10, 0, 0], SKIN, Object.assign({ seed: SEED + 56 }, FACE));
    perm(ctx, 0, -110, 96, 92, SEED + 57);
  }
  const HEADS = [headFront, head34, headProfile, headBack];
  const SWEAT = [[[-30, -146], [30, -144], [-48, -80]], [[-10, -146], [52, -136]], [[30, -146]], []];

  const ARM = { cloth: SHIRT, clothD: SHIRT_D, w: [36, 32, 26], bare: 0, skin: SKIN, skinD: SKIN_D, hsz: D.hsz, lw: 6, cuff: SHIRT_D };
  const LEG = { cloth: '#6b5843', clothD: '#4d3e2e', w: [64, 40, 28], skin: '#c8c1a8', skinD: '#9a937c', shoe: C.BROWN, shoeD: C.BROWN_D, len: 66, sw: 26, lw: 6, splay: 0.5 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, sweat, wire, mitts (oven mitts on both
  //    hands), calc (calculator in the left hand), fog (glasses fogged), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'scared', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, p.calc ? 'grip' : P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      if (sd === 1 && p.calc) { const g = ST.palm(j, D.hsz); ST.calculator(ctx, g[0], g[1] - 10, 0.9, 0, SEED + 60); }
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: p.mitts ? 'none' : k || 'fist', seed: SEED + 80 + sd }));
      if (p.mitts) ST.mitt(ctx, j.h[0], j.h[1], j.ang, D.hsz * 1.35, SEED + 62 + sd);
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 90 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      ST.tube(ctx, [n[0], n[1] + 6, n[2], n[3] + 14 + (p.headDy || 0)], [38, 34], SKIN, { lw: 6, seed: SEED + 94, shade: [SKIN_D, -6, 0] });
      shirt(ctx, V.v, p.wire);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.06 : 1.06, 1.06);
      HEADS[H.V.v](ctx, f, !!p.fog);
      if (p.sweat) ST.sweat(ctx, SWEAT[H.V.v], p.t || 0, SEED + 96);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.accountant = { name: 'The Accountant', D, draw, demo: { sweat: true }, extraRow: ['mitts + wire', (Dd) => ({ mitts: true, wire: true, pose: ST.pose('clasp', Dd) })] };
})();

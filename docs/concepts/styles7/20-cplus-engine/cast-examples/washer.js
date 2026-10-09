/* REGRESSION 3 - the Laundromat Owner from film 13 (c-plus), body + head ported to the contract. Short, wide, planted
   like a fire hydrant: a faded mustard housecoat with flat brown flowers under a sagging grey cardigan, a sash, pink
   slippers. Box jaw, a bulb nose, mismatched eyes magnified by thick glasses (the left lens twice as thick), pencilled
   brows, too-white dentures, lipstick that misses, chin whiskers, a hairy mole, rouge, a plum scarf over curlers.
   Signature: the stamp slam with the whole body; looking over her glasses (p.over).
   What broke in film 13 and what changed here:
   - ARMS FROM UNDER THE CHIN: shoulders at y -404 while her real chin sits at -388: the arms grew out of the jaw
     and in reaches across the counter the near arm crossed the face. Shoulders now sit on the coat (sw 70, sy -368).
   - REACHING ACROSS THE COUNTER: the hand was a body-space guess forced to layer 2; now ST.handAtWorld puts the palm
     on the counter point (the stamp) in world space, the guard stays on.
   - JAW: the dentures' hole could open 58 px - past her own chin. The lower lip now hangs off J (the jaw rule). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SK = '#ab9f88', SK_D = '#7e735e', COAT = '#9a874c', COAT_D = '#6f6236', CARD = '#6e7272', CARD_D = '#4c5050', SEED = 2810;
  const SCARF = '#5a3d4c', SCARF_D = '#3c2833', HSEED = 2910;
  const D = { sw: 70, sy: -368, sz: 0, l1a: 96, l2a: 90, hw: 34, hy: -200, l1l: 104, l2l: 96, elbowOut: 0.8, top: -640, waist: [84, -270] };
  const NECK = [[0, -420], [10, -420], [18, -418], [0, -420]];
  const COATS = [
    [-30, -430, -76, -418, -90, -384, -86, -320, -94, -260, -110, -180, -116, -110, 0, -98, 116, -110, 110, -180, 94, -260, 86, -320, 90, -384, 76, -418, 30, -430],
    [-18, -432, -68, -420, -84, -384, -80, -320, -88, -260, -102, -180, -106, -110, 10, -98, 120, -110, 116, -180, 102, -260, 92, -320, 86, -380, 66, -416, 32, -432],
    [-16, -434, -44, -420, -54, -384, -52, -320, -58, -260, -68, -180, -74, -110, 80, -110, 74, -180, 78, -260, 82, -320, 70, -384, 46, -420, 16, -434],
    [-30, -430, -76, -418, -90, -384, -86, -320, -94, -260, -110, -180, -116, -110, 0, -100, 116, -110, 110, -180, 94, -260, 86, -320, 90, -384, 76, -418, 30, -430],
  ];
  const CARDS = [
    [[-30, -430, -78, -418, -92, -380, -96, -250, -60, -246, -40, -330, -22, -400], [30, -430, 78, -418, 92, -380, 96, -250, 60, -246, 40, -330, 22, -400]],
    [[-18, -432, -70, -420, -86, -380, -90, -250, -50, -246, -20, -330, 0, -400], [44, -432, 74, -418, 94, -380, 100, -250, 74, -246, 60, -330, 50, -400]],
    [[-16, -434, -46, -420, -56, -380, -60, -250, 40, -250, 46, -320, 30, -400]],
    [[-30, -430, -78, -418, -92, -380, -96, -250, 96, -250, 92, -380, 78, -418, 30, -430]],
  ];
  const SASH = [[-90, -272, 0, -262, 90, -272], [-80, -272, 20, -262, 100, -270], [-56, -272, 10, -266, 80, -280], [-90, -272, 0, -266, 90, -272]];
  function flowers(ctx, bb, seed) {
    for (let i = 0; i < 10; i++) {
      const x = bb.x0 + ST.hash(seed, i, 1) * bb.w, y = bb.y0 + ST.hash(seed, i, 2) * bb.h;
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + i; ST.blotch(ctx, ST.ellipseRing(x + Math.cos(a) * 10, y + Math.sin(a) * 10, 8, 6, 6), 'rgba(110,70,40,0.5)'); }
    }
    ST.blotch(ctx, [bb.cx + 10, bb.y1 - 90, bb.cx + 44, bb.y1 - 94, bb.cx + 40, bb.y1 - 60, bb.cx + 12, bb.y1 - 56], 'rgba(60,40,20,0.45)'); // coffee
  }
  function coat(ctx, v, A) {
    ST.torso(ctx, A, COATS[v], COAT, { lw: 9, seed: SEED + v, lit: [COAT_D, 29], inner: (bb) => flowers(ctx, bb, SEED + 30 + v), hatch: { c: 'rgba(40,30,8,0.45)', n: 7, len: 50, gap: 8, k: 3, ang: 82, bend: 0.08 } });
    ST.stroke(ctx, SASH[v], { w: 11, color: COAT_D, seed: SEED + 6, taper: false });
    CARDS[v].forEach((c, i) => ST.blob(ctx, A.fit(c), CARD, { lw: 8, seed: SEED + 8 + i, lit: [CARD_D, 12], hatch: { c: 'rgba(20,24,24,0.5)', n: 6, len: 18, gap: 5, k: 3, ang: 85 }, inner: (bb) => ST.blotch(ctx, [bb.x0 + 4, bb.y1 - 40, bb.x1 - 4, bb.y1 - 44, bb.x1, bb.y1, bb.x0, bb.y1], 'rgba(30,30,24,0.3)') }));
    if (v < 2) { const x = v === 0 ? 4 : 30; ST.blob(ctx, [x, -268, x - 24, -242, x - 10, -232, x + 2, -260, x + 18, -230, x + 28, -244], COAT_D, { lw: 5, seed: SEED + 12 }); }
  }

  // ---------- head (origin = top of the collar) ----------
  const FACE = { lw: 10, lit: [SK_D, 22], mottle: ['#9d917a', 7, 12], hatch: { c: 'rgba(60,50,40,0.35)', n: 4, len: 14, gap: 5, k: 3, ang: 70 } };
  function curlers(ctx, xs, y, seed) { xs.forEach((x, i) => ST.blob(ctx, [x - 11, y - 13, x + 11, y - 13, x + 13, y + 11, x - 13, y + 11], '#a08ea0', { lw: 5, seed: seed + i, shade: ['#76687a', -3, 0], hatch: { c: 'rgba(40,30,40,0.6)', n: 1, len: 14, gap: 5, k: 3, ang: 90, bend: 0 } })); }
  function scarfBack(ctx, pts, seed) {
    ST.blob(ctx, pts, SCARF, { lw: 9, seed, lit: [SCARF_D, 16], hatch: { c: 'rgba(20,10,16,0.5)', n: 6, len: 30, gap: 6, k: 3, ang: 60 }, inner: (bb) => {
      for (let i = 0; i < 6; i++) ST.blob(ctx, ST.ellipseRing(bb.x0 + ST.hash(seed, i) * bb.w, bb.y0 + ST.hash(seed, i, 2) * bb.h, 7, 7, 6), 'rgba(170,140,90,0.45)', { lw: 0, seed: seed + i }); // faded polka dots
    } });
  }
  function knot(ctx, x, y, seed) { ST.blob(ctx, [x - 30, y + 6, x - 22, y - 26, x, y - 8, x + 22, y - 28, x + 30, y + 6, x, y + 14], SCARF, { lw: 7, seed, shade: [SCARF_D, -4, 4] }); }
  function eye(ctx, cx, cy, k, f, side, seed) { // magnified eye behind a lens: k scales the eye (thick lens = big eye)
    const w = 12 * k, h = 11 * k * f.eye;
    ST.socketEye(ctx, [cx - w, cy, cx - w * 0.3, cy - h, cx + w * 0.5, cy - h * 0.9, cx + w, cy, cx + w * 0.3, cy + h * 0.8, cx - w * 0.5, cy + h * 0.8], { pupil: [cx + f.look[0] * w * 0.4, cy + f.look[1] * h * 0.4], pr: 4.2 * k * f.pup, lid: f.lid * 0.85, sq: f.sq[side], skin: SK, lw: 3 + k * 1.5, seed });
  }
  function lens(ctx, cx, cy, r, thick, seed) {
    ST.blob(ctx, ST.ellipseRing(cx, cy, r, r * 0.92, 12), 'rgba(210,214,200,0.16)', { lw: 8, seed, double: false, light: ['rgba(255,255,255,0.3)', 5, -5] });
    if (thick && !ST.SIL) ST.inkLine(ctx, ST.curve(ST.ellipseRing(cx, cy, r * 0.7, r * 0.64, 10), true), { w: 3, closed: true, seed: seed + 1, color: 'rgba(30,26,20,0.5)' });
  }
  function pencil(ctx, cx, cy, w, side, f, seed) { // brows pencilled on: thin, too high, and not level
    const [raise] = side < 0 ? f.bl : f.br, y = cy - raise * 10 + (side > 0 ? -10 : 0);
    ST.stroke(ctx, [cx - w / 2, y + 8, cx, y - 10, cx + w / 2, y + 4], { w: 3.2, color: '#4a3236', seed, taper: false });
  }
  function bulb(ctx, x, y, k, seed) {
    ST.blob(ctx, [x - 8 * k, y - 40, x + 8 * k, y - 40, x + 10 * k, y - 20, x - 10 * k, y - 20], SK, { lw: 6, seed, shade: [SK_D, -3, 2] });
    ST.blob(ctx, ST.ellipseRing(x, y, 22 * k, 18, 12), '#b48c7a', { lw: 8, seed: seed + 1, shade: [SK_D, -6, 6], patch: ['rgba(255,235,210,0.25)', 4, -8, 0.35] });
    if (!ST.SIL) [-8, 8].forEach((d, i) => ST.stroke(ctx, [x + d * k - 3, y + 10, x + d * k + 3, y + 12], { w: 4, seed: seed + 2 + i }));
  }
  // dentures: shut = a thin lipsticked line; open = one perfect, too-white, too-big row with pink gum. The lower lip
  // hangs off the jaw.
  function mouth(ctx, x, y, w, f, seed, J) {
    const s = f.mouth, hw = w / 2;
    ST.blotch(ctx, [x - hw * 0.9, y - 6, x, y - 12, x + hw * 0.8, y - 4, x + hw * 0.6, y + 12, x - hw * 0.7, y + 10], 'rgba(160,50,60,0.55)'); // lipstick, off target
    const open = f.vis ? f.vis !== 'M' : ['open', 'yell', 'snarl', 'grin', 'smile', 'smirk'].includes(s);
    if (!open) {
      const dn = s === 'frown' ? 8 : 0;
      ST.stroke(ctx, [x - hw, y + dn, x - hw * 0.3, y - 2, x + hw * 0.4, y - 1, x + hw, y + dn], { w: 5, seed, taper: false });
      return;
    }
    const lo = J.y(y + 16), wide = f.vis === 'O' ? 0.6 : 1;
    ST.hole(ctx, [x - hw * wide, y - 6, x, y - 12, x + hw * wide, y - 6, x + hw * 0.6 * wide, lo, x - hw * 0.6 * wide, lo], { lw: 6, seed, inner: (bb) => {
      ST.rect(ctx, bb.x0, bb.y0 - 2, bb.w, 8, '#c57a80', { seed: seed + 1, lw: 0 });
      for (let i = 0; i < 7; i++) { const tx = bb.x0 + 4 + i * ((bb.w - 8) / 6.5); ST.rect(ctx, tx, bb.y0 + 4, (bb.w - 8) / 7, 15, '#ece5d0', { seed: seed + 2 + i, lw: 2, amp: 0.5, double: false }); }
    } });
  }
  function whiskers(ctx, x, J, seed, mole) { // chin whiskers hang off the jaw; the hairy mole sits on the cheek
    const y = J.y(22);
    if (!ST.SIL) [[-8, 0], [0, 4], [9, 1]].forEach(([dx, dy], i) => ST.stroke(ctx, [x + dx, y + dy, x + dx + 2, y + dy + 9], { w: 2, seed: seed + i, taper: false }));
    ST.wart(ctx, x + (mole === undefined ? 30 : mole), J.y(-18), 5, '#4e3c28', seed + 4, true);
  }
  function rouge(ctx, xs, y) { xs.forEach((x) => ST.blotch(ctx, ST.ellipseRing(x, y, 15, 10, 9), 'rgba(190,80,90,0.38)')); }
  function shades(ctx, x0, x1, y, nx, ny) {
    const s = ST.lightDir(ctx)[0] >= 0 ? -1 : 1;
    ST.castShade(ctx, [x0, y, x1, y, x1, y + 18, x0, y + 22]); // under the scarf edge
    ST.castShade(ctx, [nx + s * 14, ny - 10, nx + s * 34, ny + 4, nx + s * 24, ny + 28, nx + s * 4, ny + 22]);
  }
  function front(ctx, f, o) {
    const J = o.J, og = o.p.over ? 22 : 0;
    scarfBack(ctx, [-76, -20, -90, -110, -74, -176, -20, -204, 30, -204, 80, -176, 92, -110, 78, -20], HSEED);
    ST.blob(ctx, J.pts([-56, -144, -62, -90, -64, -30, -62, 12, -50, 32, 50, 32, 62, 12, 64, -30, 62, -90, 56, -144, 26, -152, -26, -152]), SK, Object.assign({ seed: HSEED + 1, inner: () => shades(ctx, -64, 64, -138, 4, -60) }, FACE));
    [[-66, -40], [68, -42]].forEach(([x, y], i) => ST.blob(ctx, ST.ellipseRing(x, y, 9, 9, 7), '#b9a66a', { lw: 4, seed: HSEED + 2 + i })); // clip-on earrings
    curlers(ctx, [-42, -14, 14, 42], -142, HSEED + 4);
    ST.blob(ctx, [-70, -140, -46, -176, 0, -188, 46, -176, 72, -140, 52, -152, 0, -164, -52, -152], SCARF, { lw: 7, seed: HSEED + 9, shade: [SCARF_D, 0, 6] });
    knot(ctx, 0, -192, HSEED + 10);
    rouge(ctx, [-40, 42], -48);
    pencil(ctx, -28, -128, 30, -1, f, HSEED + 11);
    pencil(ctx, 30, -128, 28, 1, f, HSEED + 12);
    eye(ctx, -28, -96, 1.7, f, 0, HSEED + 13);
    eye(ctx, 30, -98, 1, f, 1, HSEED + 17);
    bulb(ctx, 2, -54, 1, HSEED + 21);
    lens(ctx, -28, -96 + og, 32, true, HSEED + 25);
    lens(ctx, 32, -98 + og, 30, false, HSEED + 27);
    ST.stroke(ctx, [-2, -98 + og, 4, -102 + og], { w: 6, seed: HSEED + 29, taper: false });
    if (!ST.SIL) ST.stroke(ctx, [-60, -96 + og, -70, -50, -56, 20], { w: 2.5, color: '#9a8640', seed: HSEED + 30, taper: false }); // glasses chain
    mouth(ctx, 2, -12, 52, f, HSEED + 31, J);
    whiskers(ctx, 4, J, HSEED + 40);
    ST.stroke(ctx, J.pts([-46, -50, -50, -10, -42, 20]), { w: 3.4, seed: HSEED + 45 });
    ST.stroke(ctx, J.pts([48, -52, 52, -12, 44, 18]), { w: 3.4, seed: HSEED + 46 });
  }
  function threeQ(ctx, f, o) {
    const J = o.J, og = o.p.over ? 22 : 0;
    scarfBack(ctx, [-86, -20, -100, -110, -84, -176, -30, -206, 22, -206, 70, -176, 80, -110, 64, -20], HSEED + 50);
    ST.blob(ctx, J.pts([-50, -146, -58, -90, -60, -30, -58, 14, -42, 34, 56, 32, 72, 12, 74, -30, 70, -70, 74, -96, 64, -146, 30, -154, -20, -154]), SK, Object.assign({ seed: HSEED + 51, inner: () => shades(ctx, -60, 76, -140, 44, -60) }, FACE));
    ST.blob(ctx, ST.ellipseRing(-58, -40, 9, 9, 7), '#b9a66a', { lw: 4, seed: HSEED + 52 });
    curlers(ctx, [-32, -6, 22, 48], -142, HSEED + 53);
    ST.blob(ctx, [-62, -140, -38, -178, 8, -190, 52, -176, 76, -140, 56, -152, 8, -164, -44, -152], SCARF, { lw: 7, seed: HSEED + 58, shade: [SCARF_D, 0, 6] });
    knot(ctx, 8, -194, HSEED + 59);
    rouge(ctx, [-24, 56], -48);
    pencil(ctx, -8, -128, 28, -1, f, HSEED + 60);
    pencil(ctx, 50, -128, 18, 1, f, HSEED + 61);
    eye(ctx, -8, -96, 1.7, f, 0, HSEED + 62);
    eye(ctx, 50, -98, 0.7, f, 1, HSEED + 66);
    bulb(ctx, 42, -54, 0.9, HSEED + 70);
    lens(ctx, -8, -96 + og, 30, true, HSEED + 74);
    lens(ctx, 52, -98 + og, 20, false, HSEED + 76);
    mouth(ctx, 34, -12, 46, f, HSEED + 78, J);
    whiskers(ctx, 30, J, HSEED + 86);
  }
  function profile(ctx, f, o) {
    const J = o.J, og = o.p.over ? 22 : 0;
    ST.blob(ctx, J.pts([-50, 20, -66, -40, -66, -110, -46, -146, 4, -154, 40, -138, 52, -110, 54, -84, 60, -66, 56, -36, 60, -10, 62, 14, 50, 32, 10, 34, -30, 28]), SK, Object.assign({ seed: HSEED + 90, inner: () => shades(ctx, 0, 60, -140, 64, -60) }, FACE));
    scarfBack(ctx, [-100, -20, -110, -100, -90, -170, -36, -204, 30, -192, 54, -150, 36, -130, 4, -140, -26, -90, -36, -20], HSEED + 91);
    curlers(ctx, [18, 42], -140, HSEED + 92);
    knot(ctx, 4, -198, HSEED + 95);
    rouge(ctx, [26], -48);
    pencil(ctx, 36, -128, 18, 1, f, HSEED + 96);
    eye(ctx, 40, -98, 0.8, f, 1, HSEED + 97);
    bulb(ctx, 66, -54, 0.8, HSEED + 101);
    lens(ctx, 46, -98 + og, 18, false, HSEED + 105);
    ST.stroke(ctx, [30, -100 + og, -20, -104], { w: 5, seed: HSEED + 107, taper: false });
    mouth(ctx, 52, -12, 20, f, HSEED + 108, J);
    whiskers(ctx, 46, J, HSEED + 116, 4); // film 13 put the mole 16 px in front of her profile
  }
  function back(ctx) {
    ST.blob(ctx, [-30, 30, -34, -10, 34, -10, 30, 30], SK, { lw: 8, seed: HSEED + 120, shade: [SK_D, -6, 0] });
    scarfBack(ctx, [-80, -10, -94, -100, -78, -176, -20, -206, 34, -204, 84, -170, 94, -100, 80, -10, 30, 6, -30, 6], HSEED + 121);
    ST.blob(ctx, [0, -10, -30, -26, -34, 10, 0, 0, 30, -24, 34, 12], SCARF_D, { lw: 6, seed: HSEED + 122 }); // the back tie
    knot(ctx, 0, -200, HSEED + 123);
  }
  const JAW = [{ pivot: -8, drop: 20, span: 8 }, { pivot: -8, drop: 20, span: 8 }, { pivot: -8, drop: 16, span: 8 }, { pivot: 0, drop: 0 }];
  const FACEPTS = [
    { nose: [2, -54], mouth: [2, -8], chin: [0, 28], forehead: [0, -122], cheek: [[-40, -46], [42, -48]], ear: [[-62, -50], [64, -52]] },
    { nose: [42, -54], mouth: [34, -8], chin: [26, 28], forehead: [16, -122], cheek: [[-24, -46], [56, -48]], ear: [[-56, -50]] },
    { nose: [70, -54], mouth: [52, -8], chin: [36, 28], forehead: [30, -122], cheek: [[26, -46]], ear: [[-40, -60]] },
    null,
  ];
  // the rubber stamp (drawn at the palm before the hand closes over it)
  ST.stamp = (ctx, x, y, inked) => {
    ST.blob(ctx, ST.ellipseRing(x, y - 36, 15, 15, 8), C.BROWN, { lw: 5, seed: 711, shade: [C.BROWN_D, -3, 3] });
    ST.rect(ctx, x - 5, y - 28, 10, 28, C.BROWN_D, { seed: 712, lw: 4 });
    ST.rect(ctx, x - 26, y, 52, 17, inked ? C.RED : C.BLACK, { seed: 713, lw: 5 });
  };
  const ARM = { cloth: CARD, clothD: CARD_D, w: [44, 40, 34], skin: SK, skinD: SK_D, hsz: 36, lw: 8, cuff: '#c4beb0', hatch: { c: 'rgba(20,24,24,0.5)', n: 4, len: 18, gap: 5, k: 3, ang: 30 } };
  const LEG = { cloth: '#a68e74', clothD: '#7c6852', w: [34, 30, 28], shoe: '#a07272', shoeD: '#765050', len: 58, sw: 34, lw: 8, splay: 0.5, hatch: { c: 'rgba(60,40,30,0.5)', n: 3, len: 14, gap: 4, k: 3, ang: 10 } };
  // the stamp: right hand up (down = 0) or slammed (down = 1) - the whole body drops into the slam
  ST.WASHER_STAMP = (Dd, down) => ST.pose('stand', Dd, null, { hR: ST.handAt(Dd, -1, -0.15, down ? 0.62 : 0.02, 0.6), kR: 'grip', poleR: [-1, 0.6, -0.3], bob: down ? 0.06 : 0, lean: down ? 5 : 0 });
  ST.defineCharacter({
    id: 'washer', name: 'The Laundromat Owner', seed: SEED, D, neck: NECK, torso: coat, heads: [front, threeQ, profile, back],
    jaw: JAW, face: FACEPTS, arm: ARM, leg: LEG, expr0: 'bored',
    extraRows: [['stamp slam', (Dd) => ({ over: true, pose: ST.WASHER_STAMP(Dd, 1), propR: (c, x, y) => ST.stamp(c, x, y + 10, true) })]],
  });
})();

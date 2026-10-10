/* REGRESSION 4 - "You", the newcomer from film 12 (c-plus), ported to the contract. Pear-shaped modern guy: narrow
   sloping shoulders, the phone shoulder (right) hiked up, a soft belly, thin legs, head pushed forward. No chin (the
   face slides into a double chin), bulging eyes with pin pupils, worry lines instead of brows, a cold-red button nose,
   red jug ears, straight modern teeth, a cold sore, stubble, a cowlick. Hoodie with a sweat ring and a stained pocket.
   Uses the shared face kit (ST.eye / ST.brow / ST.mouth) like film 12 did.
   What broke in film 12 and what changed here:
   - ARMS (flail, hug): D.shY lifted the right shoulder anchor 12 px while the hoodie was drawn level: the arm root
     sat 12-20 px off the drawn shoulder. Now the hoodie is drawn through ST.torso / A.fit: one tilt for both.
   - HUG + PHONE: the phone hand was forced in front of everything (layer 2) and could cross the face; now it is a
     normal guarded hand at chest height with the phone drawn at its palm, in front of the chin.
   - FLAIL: raised hands are guarded continuously (no jump at the head box edge) and pass behind the head. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = '#b8957a', SKIN_D = '#8a6650', COLD = '#c0584a', HAIR = '#2e2219', SEED = 3010;
  const D = { sw: 58, sy: -540, sz: 0, shY: [8, -12], l1a: 116, l2a: 108, hw: 34, hy: -330, l1l: 162, l2l: 150, elbowOut: 0.7, top: -808, waist: [86, -390], hk: 1.18 };
  const NECK = [[0, -590], [16, -588], [34, -582], [0, -590]];
  const BODY = [
    [-30, -604, -62, -592, -80, -556, -92, -480, -104, -400, -100, -330, -40, -312, 0, -310, 40, -314, 98, -330, 104, -400, 94, -480, 80, -548, 62, -576, 30, -596],
    [-24, -604, -60, -588, -78, -550, -86, -470, -90, -390, -86, -326, -20, -308, 50, -312, 96, -330, 110, -400, 100, -470, 76, -540, 52, -576, 18, -598],
    [-16, -606, -46, -590, -60, -540, -64, -460, -62, -380, -58, -320, 10, -306, 70, -318, 96, -380, 98, -440, 80, -500, 52, -560, 26, -598],
    [-30, -596, -62, -576, -80, -548, -94, -480, -104, -400, -100, -330, 0, -310, 100, -330, 104, -400, 92, -480, 80, -556, 62, -592, 30, -604],
  ];
  const HOOD = [
    [-58, -592, -54, -628, -6, -644, 46, -626, 56, -590, 0, -578],
    [-54, -594, -52, -630, -4, -646, 40, -626, 38, -592, -6, -580],
    [-60, -560, -70, -612, -44, -644, -8, -634, -2, -598, -32, -560],
    [-62, -604, -56, -520, -20, -462, 24, -466, 58, -526, 62, -600, 0, -614],
  ];
  function hoodie(ctx, v, A) {
    const n = NECK[v];
    ST.tube(ctx, [n[0], n[1] + 18, n[0] + v * 4, n[1] - 14], [62, 58], SKIN, { lw: 6, seed: SEED + 95, lit: [SKIN_D, 8] }); // the neck
    if (v < 3) ST.blob(ctx, A.fit(HOOD[v]), C.HOOD_D, { lw: 6, seed: SEED + 4 + v, shade: ['#2c353c', 8, 4] });
    ST.torso(ctx, A, BODY[v], C.HOOD, { lw: 7, seed: SEED + v, lit: [C.HOOD_D, 30], mottle: ['#4d5a63', 6, 22], hatch: { c: 'rgba(10,14,18,0.55)', n: 9, len: 42, gap: 7, k: 3, ang: -62 } });
    const B = BODY[v];
    ST.tornHem(ctx, B[10] + 6, -326, B[18] - 6, -326, SEED + 8, 6); // the frayed rib band
    if (v === 3) {
      ST.blob(ctx, A.fit(HOOD[3]), C.HOOD_D, { lw: 6, seed: SEED + 9, shade: ['#2c353c', 10, 6], inner: () => ST.stroke(ctx, [-30, -596, 0, -500, 30, -596], { w: 4, seed: SEED + 10 }) });
      ST.sweat(ctx, 0, -560, 70, 34, SEED + 11);
      return;
    }
    const cx = [0, 30, 66][v], pw = [58, 48, 10][v];
    ST.blob(ctx, [cx - pw, -440, cx + pw, -436, cx + pw + 12, -352, cx - pw - 12, -350], C.HOOD_D, { lw: 5, seed: SEED + 12 + v, mottle: ['rgba(40,30,15,0.4)', 3, 14] });
    if (v < 2) { // drawstrings: one long and chewed, one short; the phone's outline in the pocket
      ST.tube(ctx, [cx - 16, -596, cx - 20, -560, cx - 17, -506], [6, 5, 7], C.LINEN_D, { lw: 3, seed: SEED + 15 });
      ST.tube(ctx, [cx + 14, -596, cx + 16, -570], [6, 5], C.LINEN_D, { lw: 3, seed: SEED + 16 });
      ST.rough(ctx, [cx + 10, -428, cx + 40, -428, cx + 40, -380, cx + 10, -380], 'rgba(20,24,28,0.35)', { seed: SEED + 17, lw: 0 });
    }
    ST.sweat(ctx, cx, -578, 56, 22, SEED + 18); // the sweat ring at the collar
    ST.stain(ctx, cx - 34, -490, 44, 30, SEED + 19, 'rgba(70,50,20,0.45)');
    ST.smear(ctx, cx + 30, -470, 40, 1.2, SEED + 20);
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, lit: [SKIN_D, 22], mottle: ['#a9856b', 6, 10], hatch: { c: 'rgba(60,35,25,0.4)', n: 4, len: 16, gap: 5, k: 3, ang: 75 } };
  const STUB = 'rgba(40,30,24,0.55)';
  function jugEar(ctx, x, y, s, seed) { // a big flat jug ear standing straight out, glowing red
    ST.blob(ctx, [x, y - 30, x + s * 34, y - 44, x + s * 46, y - 10, x + s * 36, y + 22, x + s * 6, y + 18], SKIN, { lw: 6, seed, lit: [SKIN_D, 10], patch: [COLD, s * 8, 0, 0.55], inner: () => ST.stroke(ctx, [x + s * 12, y - 26, x + s * 30, y - 20, x + s * 26, y + 8], { w: 3.5, seed: seed + 1 }) });
  }
  function hair(ctx, pts, seed, cow) {
    ST.blob(ctx, pts, HAIR, { lw: 6, seed, lit: ['#1b130d', 10], hatch: { c: 'rgba(140,120,90,0.35)', n: 4, len: 22, gap: 4, k: 3, ang: 20 } });
    if (cow) ST.blob(ctx, [cow[0] - 6, cow[1] + 10, cow[0] + 2, cow[1] - 24, cow[0] + 16, cow[1] - 34, cow[0] + 30, cow[1] - 30, cow[0] + 14, cow[1] - 20, cow[0] + 10, cow[1] + 8], HAIR, { lw: 5, seed: seed + 3 }); // the cowlick: one tuft
  }
  // the soft double chin under the jaw: a skin tier (not a loose line), it hangs off the jaw
  function dchin(ctx, J, pts, seed) { ST.blob(ctx, J.pts(pts), SKIN, { lw: 4, seed, lit: [SKIN_D, 6, false] }); }
  function worry(ctx, x, y, w, f) { // bare forehead worry lines instead of brows; they climb when the brows would rise
    if (ST.SIL) return;
    const r = Math.max(f.bl[0], f.br[0]) * 8;
    for (let i = 0; i < 3; i++) ST.stroke(ctx, [x - w / 2, y - i * 10 - r, x - w / 6, y - i * 10 - 4 - r, x + w / 6, y - i * 10 + 2 - r, x + w / 2, y - i * 10 - 3 - r], { w: 3, seed: SEED + 30 + i });
  }
  function bulgeEyes(ctx, f, a, b) {
    [[a, 0, SEED + 32, -1], [b, 1, SEED + 34, 1]].forEach(([e, side, seed, sg]) => {
      if (!e) return;
      ST.eye(ctx, e[0], e[1], 18 * e[2], 18, f, { kind: 'bulge', skin: SKIN, seed, lw: 6, side, bags: 2, lidAdd: -0.3 });
      ST.browShadow(ctx, e[0], e[1], 18 * e[2], 18, 12, 0.3);
      ST.brow(ctx, e[0], e[1] - 28, 16 * e[2], sg, f, { u: 18, thick: 4, color: 'rgba(46,34,25,0.7)', seed: seed + 1 });
    });
  }
  function button(ctx, x, y, s) { // tiny upturned button nose, cold red, nostrils showing
    ST.noseShadow(ctx, [x - 9, y + 4, x - 5, y - 8, x + 7, y - 8, x + 11, y + 4, x + 3, y + 10, x - 4, y + 10], 10);
    ST.blob(ctx, [x - 10 * s, y + 4, x - 6 * s, y - 9, x + 6 * s, y - 9, x + 11 * s, y + 4, x + 4 * s, y + 10, x - 5 * s, y + 10], '#b8655a', { lw: 5, seed: SEED + 36, shade: ['#94403a', 4, 3] });
    if (ST.SIL) return;
    ctx.fillStyle = C.INK;
    [[-4, 5], [5, 5]].forEach(([dx, dy]) => { if (s > 0.5 || dx > 0) ctx.fillRect(x + dx * s - 2, y + dy - 1.5, 4, 3); });
  }
  function headFront(ctx, f, o) {
    const J = o.J;
    jugEar(ctx, -66, -84, -1, SEED + 40);
    jugEar(ctx, 66, -86, 1, SEED + 42);
    ST.blob(ctx, J.pts([-60, -6, -66, -60, -70, -112, -60, -152, -30, -178, 12, -182, 48, -170, 68, -140, 72, -100, 68, -56, 58, -10, 30, 8, 0, 12, -32, 8]), SKIN, Object.assign({ seed: SEED + 44 }, FACE));
    dchin(ctx, J, [-42, 0, -10, 10, 24, 10, 48, -2, 30, 18, -8, 22], SEED + 45); // the double chin, no chin above it
    ST.stubble(ctx, J.pts([-62, -40, -52, 0, -30, 6, -36, -30]), SEED + 46, 26, STUB);
    ST.stubble(ctx, J.pts([62, -40, 52, 0, 34, 6, 40, -30]), SEED + 47, 22, STUB);
    hair(ctx, [-66, -116, -68, -150, -42, -184, 10, -194, 52, -180, 72, -148, 70, -122, 56, -136, 44, -152, 22, -156, 6, -146, -14, -156, -34, -148, -52, -136], SEED + 48, [24, -186]);
    worry(ctx, 4, -126, 50, f);
    bulgeEyes(ctx, f, [-32, -90, 1], [34, -88, 1]);
    button(ctx, 2, -56, 1);
    ST.mouth(ctx, 2, -26, 24, f, { J, teeth: 'row', seed: SEED + 50, lw: 5 });
    ST.wart(ctx, 14, J.y(-22), 3.5, '#b0584c', SEED + 51); // cold sore
    ST.wart(ctx, 26, -140, 4, '#b06a58', SEED + 52); // pimple
  }
  function head34(ctx, f, o) {
    const J = o.J;
    jugEar(ctx, -54, -82, -1, SEED + 53);
    ST.blob(ctx, J.pts([-50, -4, -60, -60, -64, -112, -52, -154, -18, -180, 26, -182, 60, -164, 74, -130, 76, -100, 72, -80, 74, -58, 66, -14, 40, 6, 10, 12, -20, 8]), SKIN, Object.assign({ seed: SEED + 54 }, FACE));
    dchin(ctx, J, [-26, 2, 8, 12, 40, 8, 62, -4, 46, 14, 8, 20], SEED + 55);
    ST.stubble(ctx, J.pts([-48, -40, -40, 0, -16, 8, -20, -30]), SEED + 56, 24, STUB);
    hair(ctx, [-62, -100, -64, -150, -32, -186, 22, -194, 62, -172, 78, -138, 72, -118, 60, -134, 46, -146, 30, -150, 12, -142, -8, -150, -30, -140, -46, -110], SEED + 57, [30, -188]);
    worry(ctx, 26, -126, 44, f);
    bulgeEyes(ctx, f, [-6, -90, 1], [52, -88, 0.68]);
    button(ctx, 44, -56, 0.8);
    ST.mouth(ctx, 34, -26, 22, f, { J, teeth: 'row', seed: SEED + 58, lw: 5 });
    ST.wart(ctx, 46, J.y(-22), 3.5, '#b0584c', SEED + 59);
  }
  function headProfile(ctx, f, o) {
    const J = o.J;
    ST.blob(ctx, J.pts([-40, 0, -64, -50, -70, -110, -54, -156, -12, -182, 30, -176, 54, -148, 58, -112, 54, -96, 58, -78, 62, -64, 70, -56, 62, -46, 58, -36, 60, -20, 52, -14, 40, -4, 26, 4, 6, 6]), SKIN, Object.assign({ seed: SEED + 60 }, FACE));
    dchin(ctx, J, [6, 0, 28, 4, 46, -4, 38, 10, 14, 12], SEED + 61);
    ST.stubble(ctx, J.pts([-6, -44, 0, 2, 30, 4, 30, -30]), SEED + 62, 26, STUB);
    hair(ctx, [-72, -60, -76, -120, -52, -170, 0, -194, 44, -174, 54, -150, 30, -152, 18, -140, -4, -146, -24, -120, -40, -84], SEED + 63, [6, -190]);
    jugEar(ctx, -20, -84, -1, SEED + 64);
    worry(ctx, 40, -128, 26, f);
    bulgeEyes(ctx, f, [40, -92, 0.7], null);
    ST.mouth(ctx, 50, -28, 12, f, { J, teeth: 'row', seed: SEED + 65, lw: 5 });
    ST.blob(ctx, [56, -70, 70, -66, 74, -54, 62, -48], COLD, { lw: 5, seed: SEED + 66 }); // the button, side on
  }
  function headBack(ctx) {
    jugEar(ctx, -64, -84, -1, SEED + 67);
    jugEar(ctx, 64, -84, 1, SEED + 68);
    ST.blob(ctx, [-56, -4, -66, -60, -70, -112, -58, -154, 0, -184, 58, -154, 70, -112, 66, -60, 56, -4, 0, 6], SKIN, Object.assign({ seed: SEED + 69 }, FACE));
    hair(ctx, [-64, -50, -70, -116, -50, -170, 0, -194, 50, -170, 70, -116, 64, -50, 44, -60, 22, -46, 0, -58, -22, -46, -44, -60], SEED + 70, [-10, -190]);
    ST.stroke(ctx, [-30, -2, 0, 6, 30, -2], { w: 4, seed: SEED + 71 }); // the neck roll
  }
  const JAW = [{ pivot: -24, drop: 18, span: 8 }, { pivot: -24, drop: 18, span: 8 }, { pivot: -26, drop: 14, span: 8 }, { pivot: 0, drop: 0 }];
  const FACEPTS = [
    { nose: [2, -56], mouth: [2, -22], chin: [0, 8], forehead: [4, -128], cheek: [[-44, -44], [46, -42]], ear: [[-74, -84], [74, -86]] },
    { nose: [44, -56], mouth: [34, -22], chin: [20, 8], forehead: [26, -128], cheek: [[-28, -44], [62, -40]], ear: [[-62, -82]] },
    { nose: [66, -58], mouth: [52, -26], chin: [30, 2], forehead: [40, -130], cheek: [[30, -44]], ear: [[-30, -84]] },
    null,
  ];
  // the phone: cracked dark slab, pale screen with a crossed-out signal (the newcomer's accent object)
  ST.phone = (ctx, gx, gy, seed, lit) => {
    ST.blob(ctx, [gx - 22, gy - 72, gx + 22, gy - 72, gx + 22, gy + 6, gx - 22, gy + 6], '#1f2124', { sharp: true, lw: 5, seed: seed || 621, noRim: true });
    ST.rect(ctx, gx - 16, gy - 64, 32, 60, lit === false ? '#33373a' : C.SCREEN, { seed: (seed || 621) + 1, lw: 0 });
    if (ST.SIL) return;
    if (lit !== false) {
      ctx.fillStyle = C.INK;
      [4, 8, 12].forEach((h, i) => ctx.fillRect(gx - 10 + i * 7, gy - 22 - h, 4, h));
      ST.stroke(ctx, [gx - 12, gy - 42, gx + 12, gy - 18], { w: 4, color: C.RED, seed: (seed || 621) + 2, taper: false });
    }
    ST.stroke(ctx, [gx - 16, gy - 60, gx + 2, gy - 38, gx - 6, gy - 20], { w: 2, color: 'rgba(20,20,20,0.7)', seed: (seed || 621) + 3, taper: false }); // the crack
  };
  function hold(ctx, side, j, g, p) { if (side === 'R' && p.phone) ST.phone(ctx, g[0], g[1] + 12, SEED + 72, p.phone !== 'off'); }
  function after(ctx, J) { // muddy knees
    if (!ST.SIL) [[J.lL, 1], [J.lR, -1]].forEach(([j, sg]) => ST.stain(ctx, j.e[0], j.e[1] + 6, 40, 30, SEED + 93 + sg, 'rgba(60,45,25,0.55)'));
  }
  const ARM = { cloth: C.HOOD, clothD: C.HOOD_D, w: [38, 34, 32], skin: SKIN, skinD: SKIN_D, hsz: 36, lw: 6, cuff: '#4a5760', hatch: { c: 'rgba(10,14,18,0.5)', n: 3, len: 24, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: C.DENIM, clothD: C.DENIM_D, w: [48, 34, 28], shoe: '#a39c84', shoeD: '#6f6a58', shoeL: '#bdb69c', len: 70, sw: 34, lw: 6, splay: 0.15 };
  ST.defineCharacter({
    id: 'you', name: 'You (the newcomer)', seed: SEED, D, neck: NECK, torso: hoodie, heads: [headFront, head34, headProfile, headBack],
    jaw: JAW, face: FACEPTS, arm: ARM, leg: LEG, hold, after, shadowW: 170, expr0: 'deadpan',
    extraRows: [['hug + phone', (Dd) => ({ phone: true, pose: ST.pose('hug', Dd, null, { hR: ST.handAt(Dd, -1, -0.12, 0.2, 0.6), kR: 'grip', poleR: [-1, 0.6, -0.2] }) })]],
  });
})();

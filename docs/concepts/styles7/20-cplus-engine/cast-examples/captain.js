/* REGRESSION 1 - the Captain from film 15 (c-plus), ported to the character contract. Brief (film 15 BRIEFS.md):
   belly-first pear on tiny feet, leaning back; a purple veiny plum nose, jowls in tiers over the cravat, one lazy
   left eye, one brow parked high, a grin wider than the face with one gold tooth, tiny ears in a grubby wig.
   What broke in film 15 and what changed here:
   - OPEN MOUTH: `jaw = f.jaw * 10` moved the jowls / chin blob / chin stroke / wart while the skin outline and the
     mouth stayed put -> the jaw tier came loose and the cravat showed through. Now ONE skin outline (skull + jowl tier
     + chin) goes through J.pts, the mouth's lower edge, chin, jowls and wart through J.y (the jaw rule).
   - ARMS UNDER THE CHIN: shoulders sat at y -480, 30 px above his real chin line (-452): the arms sprouted from under
     the jowls. Shoulders now sit on the coat below the chin (sw 84, sy -430).
   - HANDSHAKE: the hands were body-space guesses and missed by ~240 px on the deck. Use ST.meet (+ ST.captainClamp
     for his left hand on top). Signature mop: a face-contact target (the cheek), the guard stays on for the other hand. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = '#c98466', SKIN_D = '#91543e', NOSE = '#9a4a56', NOSE_D = '#6a2e3c', WIG = '#a29c8c', WIG_D = '#6e6a5e', SEED = 1210;
  const COAT = '#5a3e4c', COAT_D = '#3b2833', VEST = '#9d8238', VEST_D = '#6d5a24';
  const D = { sw: 84, sy: -430, sz: 6, l1a: 104, l2a: 98, hw: 30, hy: -250, l1l: 128, l2l: 118, elbowOut: 0.8, top: -810, waist: [96, -330], hk: 1.2, lean: -3 };
  const NECK = [[0, -500], [12, -500], [28, -496], [0, -500]];

  const COATS = [
    [-40, -512, -88, -496, -104, -450, -108, -380, -126, -280, -140, -160, -150, -96, -60, -110, 0, -100, 60, -112, 150, -96, 140, -160, 126, -280, 108, -380, 104, -450, 88, -496, 40, -512],
    [-30, -514, -80, -500, -96, -450, -100, -380, -116, -280, -128, -160, -136, -96, -20, -106, 60, -100, 156, -98, 146, -160, 132, -280, 116, -380, 100, -450, 76, -500, 32, -514],
    [-20, -518, -60, -502, -74, -450, -80, -380, -96, -280, -112, -160, -124, -98, 0, -104, 108, -100, 100, -170, 84, -280, 60, -380, 50, -450, 40, -506, 10, -518],
    [-40, -512, -90, -496, -106, -450, -110, -380, -128, -280, -142, -160, -152, -96, -40, -108, 0, -96, 40, -108, 152, -96, 142, -160, 128, -280, 110, -380, 106, -450, 90, -496, 40, -512],
  ];
  const VESTS = [
    [-40, -500, 40, -500, 80, -430, 96, -340, 80, -270, 0, -248, -80, -270, -96, -340, -80, -430],
    [-8, -502, 56, -502, 104, -430, 122, -340, 100, -270, 30, -248, -26, -270, -40, -340, -30, -430],
    [30, -504, 50, -500, 96, -440, 124, -360, 112, -290, 64, -262, 40, -290, 40, -420],
    null,
  ];
  function coat(ctx, v, A) {
    ST.torso(ctx, A, COATS[v], COAT, { lw: 11, seed: SEED + v, lit: [COAT_D, 30], mottle: ['#4a3240', 6, 26], hatch: { c: 'rgba(12,6,10,0.6)', n: 12, len: 60, gap: 8, k: 3, ang: 84, bend: 0.06 } });
    ST.tornHem(ctx, COATS[v][16] + 10, -102, COATS[v][28] - 10, -102, SEED + 4, 9);
    ST.stain(ctx, [60, 80, -40, -60][v], -200, 70, 50, SEED + 5, 'rgba(20,8,14,0.4)');
    if (VESTS[v]) {
      ST.blob(ctx, A.fit(VESTS[v]), VEST, { lw: 9, seed: SEED + 6 + v, lit: [VEST_D, 20], mottle: ['rgba(70,50,10,0.4)', 5, 14], hatch: { c: 'rgba(40,28,6,0.55)', n: 5, len: 24, gap: 6, k: 3, ang: -50 } });
      const bx = [0, 30, 86][v], kx = [0, 3, 7][v];
      for (let i = 0; i < 5; i++) {
        const y = -476 + i * 44, x = bx + kx * i + (i === 2 ? 6 : 0);
        ST.blob(ctx, ST.ellipseRing(x, y, 7, 7, 6), C.GOLD_D, { lw: 3, seed: SEED + 10 + i });
        if (i < 4) [-1, 1].forEach((s) => ST.stroke(ctx, [x + s * 4, y + 10, x + s * 16, y + 22, x + s * 6, y + 34], { w: 2.5, seed: SEED + 15 + i })); // strain lines
      }
      ST.sweat(ctx, [-70, -52, 40, 0][v], -430, 48, 58, SEED + 20);
      ST.blob(ctx, [bx - 26, -506, bx + 26, -506, bx + 20, -470, bx, -446, bx - 18, -470], '#b2a888', { lw: 6, seed: SEED + 21, lit: ['#827a60', 6, false] }); // grubby cravat
      ST.stain(ctx, bx + 6, -470, 18, 14, SEED + 22, 'rgba(110,40,30,0.5)');
    }
    if (v < 2) [[-40, -500, -64, -300, -64, -104], [40, -500, 64, -300, 64, -104]].forEach((l, i) => ST.stroke(ctx, v === 1 ? l.map((q, j) => (j % 2 ? q : q + 34)) : l, { w: 4, seed: SEED + 23 + i }));
    if (v === 3) ST.stroke(ctx, [0, -300, 2, -100], { w: 4, seed: SEED + 25 });
    const sash = [[-100, -320, 0, -296, 100, -320], [-92, -320, 30, -294, 124, -316], [-74, -324, 30, -306, 112, -330], [-102, -320, 0, -304, 102, -320]][v];
    ST.stroke(ctx, sash, { w: 18, color: C.RUST, seed: SEED + 26, taper: false });
    ST.stroke(ctx, sash.map((q, j) => (j % 2 ? q + 5 : q)), { w: 3, color: C.RUST_D, seed: SEED + 27, taper: false });
  }

  // the battered tricorn (also lands on the Recruit in the payoff). v = head view, y0 = hat base, k = scale
  ST.tricorn = (ctx, v, y0, k) => {
    ctx.save();
    ctx.translate(0, y0);
    ctx.scale(k, k);
    const HAT = [
      [-110, 14, -70, -40, -10, -60, 66, -44, 108, 10, 46, -6, 2, 24, -46, -2],
      [-92, 12, -56, -42, 12, -60, 78, -36, 112, 6, 58, -6, 16, 20, -38, -4],
      [-90, 16, -48, -46, 28, -58, 80, -12, 98, 18, 32, -2, -20, 2],
      [-110, 14, -70, -44, 0, -60, 70, -44, 110, 14, 0, 2],
    ][v];
    ST.blob(ctx, HAT, '#25211e', { lw: 10, seed: SEED + 30 + v, lit: ['#120f0d', 14], hatch: { c: 'rgba(120,110,90,0.3)', n: 3, len: 22, gap: 5, k: 3, ang: 20 } });
    const edge = [[-110, 14, -46, -2, 2, 24, 46, -6, 108, 10], [-92, 12, -38, -4, 16, 20, 58, -6, 112, 6], [-90, 16, -20, 2, 32, -2, 98, 18], [-110, 14, 0, 2, 110, 14]][v];
    ST.stroke(ctx, edge, { w: 6, color: C.GOLD_D, seed: SEED + 34, taper: false, scratch: 2 });
    if (v < 3) ST.blob(ctx, ST.ellipseRing([30, 40, 50][v], -30, 7, 5, 6), '#0a0807', { lw: 2, seed: SEED + 35 }); // moth hole
    ctx.restore();
  };

  // ---------- head (origin = top of the neck, i.e. the cravat) ----------
  const EX = { // lid: upper lid, bL: the normal brow (raise, knit), mouth, sweat
    grin: { lid: 0.35, bL: [0, 0], mouth: 'grin', sweat: 0 },
    smug: { lid: 0.5, bL: [-4, 4], mouth: 'smirk', sweat: 0 },
    wink: { lid: 0.35, bL: [-8, 6], mouth: 'grin', sweat: 0, wink: true },
    anxious: { lid: 0.1, bL: [10, -6], mouth: 'wobble', sweat: 1 },
    scared: { lid: 0, bL: [14, -8], mouth: 'yell', sweat: 1 },
    miserable: { lid: 0.5, bL: [6, -10], mouth: 'frown', sweat: 0.5 },
    focused: { lid: 0.55, bL: [-8, 8], mouth: 'flat', sweat: 0 },
    deadpan: { lid: 0.45, bL: [0, 0], mouth: 'flat', sweat: 0 },
    confused: { lid: 0.2, bL: [8, -4], mouth: 'twist', sweat: 0 },
  };
  function eyeR(ctx, x, y, f, ex, k) { // the working eye: small, wet, heavy-lidded
    const c = ST.curve([x - 13 * k, y, x - 4 * k, y - 9, x + 9 * k, y - 8, x + 14 * k, y + 1, x + 4 * k, y + 8, x - 8 * k, y + 7], true, 3);
    ST.path(ctx, c, true);
    ctx.fillStyle = ST.SIL || '#ddd2b4';
    ctx.fill();
    if (ST.SIL) return;
    ctx.save();
    ST.path(ctx, c, true);
    ctx.clip();
    ctx.fillStyle = C.INK;
    ctx.beginPath();
    ctx.arc(x + f.look[0] * 6 * k, y + f.look[1] * 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    const lid = ex.wink ? 1 : Math.max(ex.lid, f.blink);
    ctx.fillStyle = SKIN;
    ctx.fillRect(x - 16 * k, y - 12, 32 * k, lid * 20);
    ctx.restore();
    ST.inkLine(ctx, c, { w: 4.5, closed: true, seed: SEED + 40 });
    ST.stroke(ctx, ex.wink ? [x - 14 * k, y + 2, x, y + 7, x + 14 * k, y + 1] : [x - 14 * k, y - 10 + lid * 18, x + 14 * k, y - 9 + lid * 18], { w: 5, seed: SEED + 41, taper: false });
    ST.stroke(ctx, [x - 10 * k, y + 13, x + 2, y + 17, x + 12 * k, y + 12], { w: 2.5, seed: SEED + 42 });
  }
  function eyeL(ctx, x, y, f, ex, k) { // the lazy eye: bigger, lid lower, pupil parked at the outer corner
    const c = ST.curve([x - 14 * k, y - 1, x - 4 * k, y - 11, x + 10 * k, y - 10, x + 16 * k, y + 1, x + 6 * k, y + 10, x - 9 * k, y + 8], true, 3);
    ST.path(ctx, c, true);
    ctx.fillStyle = ST.SIL || '#e3d6b2';
    ctx.fill();
    if (ST.SIL) return;
    ctx.save();
    ST.path(ctx, c, true);
    ctx.clip();
    ctx.fillStyle = 'rgba(190,90,70,0.35)';
    ctx.fillRect(x - 16 * k, y + 2, 34 * k, 12);
    ctx.fillStyle = C.INK;
    ctx.beginPath();
    ctx.arc(x + 9 * k, y + 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    const lid = Math.max(ex.lid + 0.18, f.blink);
    ctx.fillStyle = SKIN;
    ctx.fillRect(x - 17 * k, y - 13, 36 * k, lid * 22);
    ctx.restore();
    ST.inkLine(ctx, c, { w: 4.5, closed: true, seed: SEED + 43 });
    ST.stroke(ctx, [x - 15 * k, y - 11 + lid * 20, x + 16 * k, y - 10 + lid * 20], { w: 5, seed: SEED + 44, taper: false });
    [16, 23].forEach((d, i) => ST.stroke(ctx, [x - 12 * k, y + d - 4, x + 2, y + d, x + 14 * k, y + d - 5], { w: 2.5, seed: SEED + 45 + i }));
  }
  function brows(ctx, xr, xl, y, f, ex, k) {
    const [rs, kn] = ex.bL;
    ST.stroke(ctx, [xr - 18 * k, y - rs + 4, xr, y - rs - 4 + f.twitch * -5, xr + 16 * k, y - rs + kn], { w: 13, color: '#3a352c', seed: SEED + 47 });
    if (xl !== null) ST.stroke(ctx, [xl - 16 * k, y - 18, xl, y - 34, xl + 18 * k, y - 22], { w: 12, color: '#3a352c', seed: SEED + 48 }); // parked high, always
  }
  function nose(ctx, x, y, k, seed) {
    const pts = [x - 26 * k, y - 6, x - 14 * k, y - 34, x + 6 * k, y - 40, x + 26 * k, y - 22, x + 32 * k, y + 6, x + 18 * k, y + 22, x - 4 * k, y + 24, x - 24 * k, y + 14];
    ST.blob(ctx, pts, NOSE, { lw: 8, seed, lit: [NOSE_D, 12], mottle: ['rgba(90,30,50,0.45)', 4, 7] });
    if (ST.SIL) return;
    [[-14, -10, -4, -2, -10, 6], [8, -24, 16, -14, 12, -4], [14, 4, 22, 10]].forEach((l, i) => ST.stroke(ctx, l.map((q, j) => (j % 2 ? y + q : x + q * k)), { w: 2.2, color: '#5c1f2c', seed: seed + 1 + i, taper: false }));
    ST.pores(ctx, x - 12 * k, y - 8, 24 * k, 18, 8, seed + 4, 'rgba(40,10,20,0.55)');
    ctx.fillStyle = 'rgba(255,230,210,0.55)';
    ctx.fillRect(x + 4 * k, y - 26, 6, 4);
    ST.hardShadow(ctx, [x - 30 * k, y + 10, x - 8 * k, y + 26, x - 10 * k, y + 40, x - 36 * k, y + 26], x, 0.4);
  }
  // the mouth: the upper lip is fixed at y, the lower edge hangs off the jaw (J.y)
  function mouth(ctx, x, y, f, ex, k, J) {
    const shape = f.vis ? { A: 'yell', E: 'grin', I: 'grin', O: 'O', F: 'flat', M: 'smirk' }[f.vis] : ex.mouth;
    const W = 48 * k;
    if (shape === 'grin' || shape === 'yell' || shape === 'O' || shape === 'wobble') {
      const h0 = { grin: 12, yell: 14, O: 12, wobble: 8 }[shape], w = shape === 'O' ? W * 0.45 : W, lo = J.y(y + h0);
      const top = shape === 'grin' ? -10 : -4, corner = shape === 'grin' ? -16 : shape === 'wobble' ? 2 : 4;
      const pts = shape === 'wobble'
        ? [x - w, y + corner, x - w * 0.5, y - 6, x, y + 2, x + w * 0.5, y - 6, x + w, y + corner, x + w * 0.5, lo, x - w * 0.5, lo]
        : [x - w, y + corner, x - w * 0.4, y + top, x + w * 0.4, y + top - 2, x + w, y + corner - 2, x + w * 0.5, lo, x - w * 0.5, lo + 2];
      ST.hole(ctx, pts, { lw: 5, seed: SEED + 58, inner: () => {
        for (let i = -3; i <= 3; i++) {
          const tx = x + i * w * 0.27, gold = i === 1;
          ST.blob(ctx, [tx - w * 0.12, y + top - 6, tx + w * 0.12, y + top - 4, tx + w * 0.1, y + top + 12 + (i % 2) * 3, tx - w * 0.1, y + top + 11], gold ? C.GOLD : '#c9b77e', { sharp: true, lw: 3, seed: SEED + 50 + i, shade: [gold ? C.GOLD_D : '#93824e', -2, 1], light: gold ? ['#f2d580', 2, -2] : null, double: false });
        }
      } });
      if (shape === 'grin' && !ST.SIL) [-1, 1].forEach((s, i) => ST.stroke(ctx, [x + s * (w + 4), y - 30, x + s * (w + 12), y - 14, x + s * (w + 6), y + 6], { w: 3.5, seed: SEED + 59 + i })); // cheeks pushed up
    } else {
      const sag = { smirk: [-14, 6], frown: [10, 12], flat: [2, 2], twist: [-8, 10] }[shape] || [0, 0];
      ST.stroke(ctx, [x - W * 0.8, y + sag[1], x - W * 0.2, y + 4, x + W * 0.4, y + 2, x + W * 0.85, y + sag[0]], { w: 5.5, seed: SEED + 61, taper: false });
    }
  }
  function jowls(ctx, J) { // two tiers of chin hanging over the cravat - they hang off the jaw
    ST.blob(ctx, ST.ellipseRing(0, J.y(14), 62, 22, 12), SKIN, { lw: 8, seed: SEED + 62, lit: [SKIN_D, 10] });
    ST.blob(ctx, ST.ellipseRing(4, J.y(32), 40, 14, 10), SKIN, { lw: 7, seed: SEED + 64, lit: [SKIN_D, 8] });
    ST.stroke(ctx, J.pts([-30, 24, 0, 30, 28, 24]), { w: 3, seed: SEED + 65 });
  }
  function sweatBeads(ctx, pts, amt, t) { if (amt > 0) ST.beads(ctx, pts, Math.floor(ST.twos(t) * 4) % 3, SEED + 66); }
  function wig(ctx, side, x, y, low) { // a sausage-curl roll on one side
    for (let i = 0; i < 3; i++) ST.blob(ctx, ST.ellipseRing(x, y + i * 26 + low, 22, 15, 9), WIG, { lw: 7, seed: SEED + 70 + i + side * 3, lit: [WIG_D, 8], hatch: { c: 'rgba(60,56,46,0.5)', n: 2, len: 14, gap: 4, k: 3, ang: 0 } });
  }
  // ONE skin outline per view: skull + jowl tier + chin (film 15 drew the chin tier as separate loose blobs)
  const SKULL = [
    [-58, -20, -66, -70, -60, -120, -42, -150, -6, -164, 30, -160, 56, -138, 66, -100, 68, -60, 62, -20, 58, 8, 36, 32, 0, 40, -34, 32, -56, 8],
    [-50, -20, -60, -70, -56, -122, -36, -152, 6, -166, 44, -156, 66, -130, 76, -96, 80, -60, 72, -20, 70, 12, 40, 32, 0, 34, -30, 26, -44, 6],
    [-40, -16, -62, -66, -62, -120, -40, -156, 0, -168, 36, -152, 52, -120, 56, -100, 54, -40, 52, -14, 58, 6, 52, 36, 12, 40, -14, 24],
  ];
  function headFront(ctx, f, o) {
    const J = o.J, ex = o.ex;
    wig(ctx, 0, -66, -110, 8);
    wig(ctx, 1, 68, -112, -2);
    ST.blob(ctx, J.pts(SKULL[0]), SKIN, { lw: 11, seed: SEED + 76, lit: [SKIN_D, 22], mottle: ['rgba(170,80,60,0.35)', 7, 10] });
    jowls(ctx, J);
    ST.blob(ctx, [-60, -96, -64, -76, -54, -76], SKIN, { lw: 5, seed: SEED + 78 }); // tiny ear
    ST.hardShadow(ctx, [-56, -120, 0, -112, 60, -118, 60, -104, 0, -98, -56, -106], 2, 0.35); // under the hat brim
    if (!ST.SIL) [[-40, -54], [44, -50]].forEach(([x, y], i) => [0, 1, 2].forEach((j) => ST.stroke(ctx, [x - 10 + j * 6, y - 4, x - 4 + j * 6, y + 2, x + j * 6, y - 3], { w: 1.8, color: '#9c2f2a', seed: SEED + 79 + i * 3 + j, taper: false }))); // broken veins
    eyeR(ctx, -26, -94, f, ex, 1);
    eyeL(ctx, 28, -96, f, ex, 1);
    brows(ctx, -26, 28, -116, f, ex, 1);
    mouth(ctx, 2, -28, f, ex, 1, J);
    nose(ctx, 2, -64, 1, SEED + 85);
    ST.wart(ctx, 18, J.y(6), 5, '#8a4a3a', SEED + 86, true);
    sweatBeads(ctx, [[-30, -136], [20, -140], [52, -110]], ex.sweat, o.t);
    if (!o.measure && !o.p.noHat) ST.tricorn(ctx, 0, -146, 1);
  }
  function head34(ctx, f, o) {
    const J = o.J, ex = o.ex;
    wig(ctx, 0, -60, -108, 8);
    ST.blob(ctx, J.pts(SKULL[1]), SKIN, { lw: 11, seed: SEED + 87, lit: [SKIN_D, 22], mottle: ['rgba(170,80,60,0.35)', 7, 10] });
    ST.blob(ctx, J.pts([-40, 6, -20, 30, 30, 34, 66, 14, 30, 10]), SKIN, { lw: 8, seed: SEED + 88, lit: [SKIN_D, 10] });
    ST.stroke(ctx, J.pts([-20, 28, 20, 38, 56, 24]), { w: 3, seed: SEED + 89 });
    ST.hardShadow(ctx, [-50, -120, 10, -112, 74, -118, 74, -104, 10, -98, -50, -106], 12, 0.35);
    eyeR(ctx, -4, -94, f, ex, 1);
    eyeL(ctx, 58, -96, f, ex, 0.6);
    brows(ctx, -4, 58, -116, f, ex, 0.8);
    mouth(ctx, 30, -28, f, ex, 0.82, J);
    nose(ctx, 34, -62, 0.78, SEED + 90);
    sweatBeads(ctx, [[-14, -136], [36, -140]], ex.sweat, o.t);
    if (!o.measure && !o.p.noHat) ST.tricorn(ctx, 1, -146, 1);
  }
  function headProfile(ctx, f, o) {
    const J = o.J, ex = o.ex;
    wig(ctx, 0, -56, -104, 10);
    ST.blob(ctx, J.pts(SKULL[2]), SKIN, { lw: 11, seed: SEED + 91, lit: [SKIN_D, 20], mottle: ['rgba(170,80,60,0.35)', 7, 10] });
    ST.blob(ctx, J.pts([-10, 0, 30, 8, 56, 0, 50, 36, 10, 40]), SKIN, { lw: 8, seed: SEED + 92, lit: [SKIN_D, 10] });
    ST.stroke(ctx, [-26, -100, -14, -104, -10, -88, -20, -80], { w: 5, seed: SEED + 93 }); // tiny ear, a nub
    eyeR(ctx, 30, -98, f, ex, 0.7);
    brows(ctx, 30, null, -118, f, ex, 0.7);
    mouth(ctx, 44, -24, f, ex, 0.4, J);
    nose(ctx, 64, -62, 0.86, SEED + 94);
    sweatBeads(ctx, [[20, -140]], ex.sweat, o.t);
    if (!o.measure && !o.p.noHat) ST.tricorn(ctx, 2, -146, 1);
  }
  function headBack(ctx, f, o) {
    ST.blob(ctx, [-60, -20, -68, -70, -62, -120, -42, -150, 0, -164, 42, -150, 62, -120, 68, -70, 60, -20, 0, -6], SKIN, { lw: 11, seed: SEED + 95, lit: [SKIN_D, 20] });
    ST.blob(ctx, [-70, -50, -70, -120, -46, -152, 0, -166, 46, -152, 70, -120, 70, -50, 40, -36, 0, -30, -40, -36], WIG, { lw: 0, seed: SEED + 96, lit: [WIG_D, 12], hatch: { c: 'rgba(60,56,46,0.5)', n: 10, len: 18, gap: 4, k: 3, ang: 0 } });
    ST.tube(ctx, [0, -36, 4, 0, -2, 40], [22, 18, 12], WIG_D, { lw: 6, seed: SEED + 97 });
    ST.blob(ctx, [0, -40, -22, -54, -24, -24, 0, -36, 22, -52, 24, -22], '#1c1916', { lw: 5, seed: SEED + 98 });
    if (!o.measure && !o.p.noHat) ST.tricorn(ctx, 3, -146, 1);
  }
  const JAW = [{ pivot: -26, drop: 26, span: 8 }, { pivot: -26, drop: 24, span: 8 }, { pivot: -22, drop: 22, span: 8 }, { pivot: 0, drop: 0 }];
  const FACE = [
    { nose: [2, -64], mouth: [2, -24], chin: [0, 32], forehead: [0, -130], cheek: [[-44, -50], [46, -48]], ear: [[-58, -86]] },
    { nose: [34, -62], mouth: [30, -24], chin: [24, 28], forehead: [12, -132], cheek: [[-18, -50], [62, -48]], ear: [[-46, -92]] },
    { nose: [64, -62], mouth: [44, -22], chin: [34, 30], forehead: [28, -136], cheek: [[24, -50]], ear: [[-18, -92]] },
    null,
  ];

  const ARM = { cloth: COAT, clothD: COAT_D, w: [46, 42, 44], skin: SKIN, skinD: SKIN_D, hsz: 36, lw: 9, cuff: '#7a6430', hatch: { c: 'rgba(12,6,10,0.55)', n: 3, len: 30, gap: 7, k: 3, ang: 30 } };
  const LEG = { cloth: '#8e8670', clothD: '#625c4a', w: [40, 26, 18], shoe: '#25211e', shoeD: '#120f0d', shoeL: '#4a443e', len: 52, sw: 26, lw: 8, splay: 0.5 };
  function hold(ctx, side, j, g, p) { // the spyglass in the right hand, drawn before the hand closes over it
    if (side === 'R' && p.spyglass) [[-50, 20, 30], [20, 80, 24], [80, 130, 19]].forEach(([a, b, w], i) => ST.tube(ctx, [g[0] + a, g[1] - a * 0.1, g[0] + b, g[1] - b * 0.1], [w, w], i === 1 ? '#2a2420' : '#5e4630', { lw: 6, seed: SEED + 100 + i, lit: ['#2a1e14', 6], double: true }));
  }
  function holdOver(ctx, side, j, g, p) { // the filthy hanky over the left hand
    if (side === 'L' && p.hanky) ST.blob(ctx, [g[0] - 20, g[1] - 16, g[0] + 22, g[1] - 22, g[0] + 30, g[1] + 20, g[0] + 4, g[1] + 46, g[0] - 24, g[1] + 22], '#b8ae8c', { lw: 6, seed: SEED + 104, lit: ['#857c60', 8], mottle: ['rgba(90,60,30,0.45)', 3, 10] });
  }
  const ch = ST.defineCharacter({
    id: 'captain', name: 'The Captain', seed: SEED, D, neck: NECK, torso: coat, heads: [headFront, head34, headProfile, headBack],
    jaw: JAW, face: FACE, arm: ARM, leg: LEG, hold, holdOver, shadowW: 230, expr: EX, expr0: 'grin',
    extraRows: [['mop (touch cheek)', (Dd) => ({ hanky: true, pose: ST.pose('stand', Dd, null, ST.touch('L', 'cheek', 6, -14, 'grip')) })]],
  });
  // the signature two-handed handshake: after ST.meet, his left hand clamps on top of the shaken hands (in front)
  ST.captainClamp = (m) => {
    const r = ST.handAtWorld(ch, m.a, 'L', [m.point[0] + 4, m.point[1] - 22]);
    return Object.assign({}, m.a, { pose: Object.assign({}, m.a.pose, r.over, { kL: 'flat', poleL: [1, 0.5, 0.2] }), layer: { L: 2, R: 2 } });
  };
})();

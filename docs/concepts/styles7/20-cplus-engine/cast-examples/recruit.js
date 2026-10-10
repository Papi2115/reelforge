/* The Recruit from film 15 (c-plus), ported to the contract - the other half of the deck handshake regression.
   Gangly, hunched, a neck as long as his head with an Adam's apple like a swallowed egg, the sack shoulder pulled
   up. Bulging eyes, two wisps for brows, a sunburnt button nose, buck teeth over a chin that slides into the neck.
   Changes: torso through ST.torso / A.fit; the mouth's lower edge and the "chin that isn't there" hang off the jaw
   (J); the gulp goes through the contract's headDy hook; the sack is drawn at the solved left palm (behind).
   Glitches the validators found in film 15's drawing: the back-view head floated ~30 px above the neck, and a shirt
   fold stroke hung in the air beside the profile torso. Both fixed. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = '#c09a72', SKIN_D = '#8e6a4a', BURN = 'rgba(190,80,60,0.45)', HAIR = '#7a6638', HAIR_D = '#4e4022', SEED = 1110;
  const SHIRT = '#b2a682', SHIRT_D = '#7d7356', SLOP = '#6f684e', SLOP_D = '#4c4734';
  const D = { sw: 44, sy: -520, sz: 8, shY: [-8, 0], l1a: 116, l2a: 108, hw: 22, hy: -316, l1l: 168, l2l: 148, elbowOut: 0.55, top: -870, waist: [50, -380], hk: 1.25 };
  const BASE = [[0, -540], [8, -538], [18, -534], [0, -540]]; // neck base on the shirt
  const NECK = [[0, -628], [22, -622], [50, -612], [0, -628]]; // head origin, top of the long neck

  const SHIRTS = [
    [-22, -556, -56, -540, -70, -500, -64, -440, -72, -390, -66, -346, -20, -338, 30, -344, 70, -350, 74, -396, 66, -446, 70, -514, 58, -560, 24, -560],
    [-12, -558, -50, -544, -64, -500, -60, -440, -66, -392, -58, -344, 4, -336, 52, -344, 76, -356, 74, -404, 66, -460, 64, -520, 46, -562, 20, -562],
    [-4, -562, -36, -548, -52, -500, -48, -440, -52, -392, -44, -346, 20, -338, 52, -350, 62, -400, 52, -456, 46, -520, 30, -560, 10, -566],
    [-24, -560, -58, -544, -72, -500, -66, -440, -72, -392, -66, -346, -10, -340, 40, -344, 70, -352, 72, -398, 66, -446, 68, -510, 56, -556, 22, -558],
  ];
  const SLOPS = [
    [-56, -384, 58, -384, 84, -190, 52, -176, 30, -186, 8, -190, 2, -262, -6, -190, -28, -184, -50, -176, -84, -190],
    [-48, -384, 62, -384, 88, -194, 56, -180, 34, -190, 14, -194, 6, -262, -2, -192, -24, -186, -42, -178, -76, -192],
    [-36, -386, 46, -386, 72, -196, 40, -182, 10, -190, -24, -184, -58, -196],
    [-58, -384, 56, -384, 84, -190, 50, -176, 28, -186, 6, -190, 0, -264, -8, -190, -30, -184, -52, -176, -84, -190],
  ];
  // the long neck with its Adam's apple; gulp 0..1 stretches the neck and drops the apple
  function neck(ctx, v, p) {
    const b = BASE[v], n = NECK[v], gulp = p.gulp || 0, ay = n[1] + 46 + gulp * 26, hdy = (p.headDy || 0) - gulp * 10;
    ST.tube(ctx, [b[0], b[1] + 10, (b[0] + n[0]) / 2, (b[1] + n[1]) / 2, n[0], n[1] + 16 + hdy], [34, 28, 30], SKIN, { lw: 8, seed: SEED + 100, lit: [SKIN_D, 8] });
    ST.hardShadow(ctx, [n[0] - 18, n[1] + 10, n[0] + 18, n[1] + 10, n[0] + 14, n[1] + 40, n[0] - 14, n[1] + 36], n[0], 0.45);
    if (v < 3) ST.blob(ctx, ST.ellipseRing(n[0] + [0, 6, 16][v], ay, 9, 12, 8), SKIN, { lw: 4, seed: SEED + 101, lit: [SKIN_D, 4] });
  }
  function torso(ctx, v, A, p) {
    neck(ctx, v, p);
    ST.blob(ctx, SLOPS[v], SLOP, { lw: 10, seed: SEED + v, lit: [SLOP_D, 22], mottle: ['rgba(30,26,14,0.3)', 5, 18], hatch: { c: 'rgba(16,14,6,0.55)', n: 7, len: 46, gap: 7, k: 3, ang: 82 } });
    ST.tornHem(ctx, SLOPS[v][10] - 4, -184, SLOPS[v][2] + 4, -190, SEED + 4, 6);
    if (v !== 3) ST.clothPatch(ctx, [-40, 30, 20, null][v], -250, 34, 30, '#857a58', SEED + 5);
    ST.torso(ctx, A, SHIRTS[v], SHIRT, { lw: 10, seed: SEED + 8 + v, lit: [SHIRT_D, 24], mottle: ['rgba(80,64,30,0.35)', 6, 16], hatch: { c: 'rgba(40,30,12,0.55)', n: 9, len: 34, gap: 6, k: 3, ang: -62, cross: true } });
    const sw = [[-50, -496], [-42, -498], [30, -496], [50, -496]][v];
    ST.sweat(ctx, sw[0], sw[1], 44, 52, SEED + 12);
    if (v === 0) ST.sweat(ctx, 52, -494, 40, 48, SEED + 18);
    ST.stroke(ctx, [[-62, -380, 0, -366, 64, -384], [-56, -380, 10, -366, 70, -386], [-44, -382, 14, -370, 54, -386], [-64, -382, 0, -370, 62, -382]][v], { w: 8, color: '#7e6c46', seed: SEED + 13, taper: false });
    if (v === 3) { ST.stroke(ctx, [2, -550, -4, -460, 2, -350], { w: 3, seed: SEED + 14 }); return; }
    const x = [0, 20, 44][v];
    ST.blob(ctx, A.fit([x - 30, -560, x + 24, -562, x + 6, -530, x - 6, -530]), C.RUST, { lw: 6, seed: SEED + 15, lit: [C.RUST_D, 6, false] });
    ST.blob(ctx, [x - 8, -534, x + 8, -534, x + 16, -480, x + 4, -470, x - 10, -482], C.RUST, { lw: 5, seed: SEED + 16, lit: [C.RUST_D, 5, false] });
    if (v < 2) ST.stroke(ctx, [x + 26, -470, x + 40, -440, x + 30, -400], { w: 3, seed: SEED + 17 }); // a fold (film 15 also drew it off the shirt in profile)
  }

  // ---------- head (origin = top of the neck); every part drawn here, nothing shared ----------
  const EX = { // e: eye scale, pup: pupil radius, lidT: upper lid cover, lidB: lower lid, mouth, brow: wisp lift
    deadpan: { e: 1, pup: 3.4, lidT: 0.32, lidB: 0, mouth: 'flat', brow: 0 },
    scared: { e: 1.08, pup: 2.4, lidT: 0, lidB: 0, mouth: 'grimace', brow: 10 },
    shock: { e: 1.22, pup: 1.8, lidT: 0, lidB: 0, mouth: 'O', brow: 18 },
    confused: { e: 1, pup: 3, lidT: 0.18, lidB: 0.25, mouth: 'twist', brow: 6 },
    miserable: { e: 1, pup: 3.2, lidT: 0.45, lidB: 0, mouth: 'frown', brow: 4 },
    hopeful: { e: 1.05, pup: 3.6, lidT: 0.05, lidB: 0.1, mouth: 'smile', brow: 8 },
  };
  function eye(ctx, x, y, r, f, ex, seed, cut) {
    const R = r * ex.e, c = ST.curve(ST.ellipseRing(x, y, R, R * 1.06, 10), true, 3);
    ST.path(ctx, c, true);
    ctx.fillStyle = ST.SIL || '#e2d9bc';
    ctx.fill();
    if (ST.SIL) return;
    ctx.save();
    ST.path(ctx, c, true);
    ctx.clip();
    ctx.fillStyle = 'rgba(180,90,70,0.3)'; // bloodshot rim
    ctx.beginPath();
    ctx.ellipse(x, y + R * 0.7, R, R * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.INK;
    ctx.beginPath();
    ctx.arc(x + f.look[0] * R * 0.55, y + f.look[1] * R * 0.5, ex.pup, 0, Math.PI * 2);
    ctx.fill();
    const lt = Math.max(ex.lidT, f.blink), lb = ex.lidB;
    ctx.fillStyle = SKIN;
    if (lt > 0.02) ctx.fillRect(x - R - 2, y - R - 4, 2 * R + 4, lt * 2.1 * R + 4);
    if (lb > 0.02) ctx.fillRect(x - R - 2, y + R * (1.05 - 2 * lb), 2 * R + 4, R * 2);
    if (cut) ctx.fillRect(cut > 0 ? x + R * 0.55 : x - R * 2, y - R * 2, R * 1.5, R * 4);
    ctx.restore();
    ST.inkLine(ctx, c, { w: 5, closed: true, seed });
    if (lt > 0.02) ST.stroke(ctx, [x - R, y - R + lt * 2.1 * R, x, y - R + lt * 2.1 * R + 3, x + R, y - R + lt * 2.1 * R], { w: 4.5, seed: seed + 1, taper: false });
  }
  function wisps(ctx, x, y, w, lift, tw, seed) { // almost no brows: two thin wisps
    ST.stroke(ctx, [x - w / 2, y - lift + 2, x, y - lift - 3 - tw * 6, x + w / 2, y - lift + 1], { w: 2.5, color: HAIR, seed, scratch: 0.4 });
  }
  function mouth(ctx, x, y, f, ex, k, J) { // buck teeth hang from the upper lip whatever the mouth does
    const shape = f.vis ? { A: 'open', E: 'wide', I: 'wide', O: 'O', F: 'flat', M: 'flat' }[f.vis] : ex.mouth;
    const W = 20 * k, h0 = { open: 4, wide: 4, O: 4, flat: 0, grimace: 6, twist: 4, frown: 0, smile: 6 }[shape] || 0;
    if (h0 > 0 || J.d > 3) {
      const ww = shape === 'O' ? W * 0.6 : shape === 'wide' || shape === 'grimace' ? W * 1.25 : W, lo = J.y(y + h0 + 2);
      ST.hole(ctx, [x - ww, y, x - ww * 0.4, y - 3, x + ww * 0.4, y - 2, x + ww, y + (shape === 'twist' ? -6 : 0), x + ww * 0.6, lo, x - ww * 0.5, lo - 1], { lw: 4, seed: SEED + 40 });
    } else {
      const sag = shape === 'frown' ? 7 : shape === 'smile' ? -6 : 1;
      ST.stroke(ctx, [x - W, y + sag, x - W * 0.3, y + 3, x + W * 0.4, y + 2, x + W, y + sag + 2], { w: 4, seed: SEED + 41, taper: false });
    }
    [[-1, 0], [1, 1]].forEach(([s, i]) => ST.blob(ctx, [x + s * 1 * k, y - 6, x + s * 12 * k, y - 7, x + s * 11 * k, y + 15, x + s * 2 * k, y + 16], '#d8c99a', { sharp: true, lw: 3.5, seed: SEED + 43 + i, shade: ['#a99560', -s * 2, 2], double: false }));
    ST.stroke(ctx, J.pts([x - W * 0.6, y + 22, x, y + 25, x + W * 0.6, y + 21]), { w: 2.5, seed: SEED + 45 }); // the chin that isn't there
  }
  function ear(ctx, x, y, s, seed) {
    ST.blob(ctx, [x, y - 26, x + s * 30, y - 50, x + s * 50, y - 36, x + s * 50, y + 4, x + s * 30, y + 28, x, y + 16], SKIN, { lw: 7, seed, lit: [SKIN_D, 10], inner: () => {
      ST.blob(ctx, [x + s * 12, y - 22, x + s * 32, y - 36, x + s * 40, y - 6, x + s * 22, y + 12], 'rgba(200,90,70,0.45)', { lw: 0, seed: seed + 1 });
      ST.stroke(ctx, [x + s * 14, y - 20, x + s * 34, y - 30, x + s * 38, y], { w: 3, seed: seed + 2 });
    } });
  }
  function acne(ctx, pts, seed) {
    if (ST.SIL) return;
    pts.forEach(([x, y], i) => { ST.blob(ctx, ST.ellipseRing(x, y, 4, 3.5, 6), '#b8584a', { lw: 0, seed: seed + i }); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(x - 1, y - 2, 2, 2); });
  }
  function fringe(ctx, pts, seed) {
    ST.blob(ctx, pts, HAIR, { lw: 8, seed, lit: [HAIR_D, 10], hatch: { c: 'rgba(30,22,6,0.6)', n: 6, len: 26, gap: 5, k: 3, ang: 80, bend: 0.1 } });
  }
  function headFront(ctx, f, o) {
    const J = o.J, ex = o.ex;
    ear(ctx, -46, -96, -1, SEED + 50);
    ear(ctx, 48, -100, 1, SEED + 52);
    ST.blob(ctx, J.pts([-46, -30, -54, -80, -52, -130, -40, -168, -10, -186, 24, -184, 46, -166, 56, -128, 54, -80, 44, -34, 24, -8, 6, 2, -14, 0, -32, -12]), SKIN, { lw: 10, seed: SEED + 54, lit: [SKIN_D, 20], mottle: ['rgba(150,96,60,0.3)', 6, 9] });
    ST.blob(ctx, [-30, -72, -12, -76, -8, -56, -30, -54], BURN, { lw: 0, seed: SEED + 55, deco: true });
    ST.blob(ctx, [16, -76, 38, -72, 36, -52, 16, -56], BURN, { lw: 0, seed: SEED + 56, deco: true });
    ST.hardShadow(ctx, [-46, -132, -10, -128, 30, -134, 54, -128, 54, -112, 20, -116, -20, -112, -50, -116], 4, 0.35); // fringe shadow
    eye(ctx, -20, -102, 18, f, ex, SEED + 57, 0);
    eye(ctx, 21, -104, 21, f, ex, SEED + 59, 0);
    wisps(ctx, -20, -130, 22, ex.brow, f.twitch, SEED + 61);
    wisps(ctx, 22, -134, 22, ex.brow, 0, SEED + 62);
    ST.blob(ctx, [-9, -74, 9, -76, 13, -60, 6, -54, -8, -54, -13, -62], '#c97a5c', { lw: 5, seed: SEED + 63, lit: [SKIN_D, 5, false] });
    if (!ST.SIL) { ctx.fillStyle = C.INK; ctx.fillRect(-6, -60, 4, 4); ctx.fillRect(3, -60, 4, 4); }
    ST.hardShadow(ctx, [-12, -56, 4, -50, 2, -44, -12, -48], 0, 0.4);
    mouth(ctx, 2, -42, f, ex, 1, J);
    acne(ctx, [[-34, -46], [30, -40], [-6, -150]], SEED + 64);
    fringe(ctx, [-52, -120, -50, -160, -30, -190, 6, -198, 40, -188, 58, -160, 58, -118, 46, -134, 40, -112, 26, -136, 14, -114, 0, -138, -14, -114, -26, -138, -38, -116], SEED + 68);
    ST.stroke(ctx, [30, -194, 44, -226, 50, -210], { w: 5, color: HAIR_D, seed: SEED + 69 }); // cowlick
  }
  function head34(ctx, f, o) {
    const J = o.J, ex = o.ex;
    ear(ctx, -30, -96, -1, SEED + 70);
    ST.blob(ctx, J.pts([-34, -30, -44, -80, -46, -132, -32, -170, 0, -188, 34, -182, 56, -160, 64, -128, 62, -100, 66, -78, 58, -36, 40, -8, 22, 2, 2, 0, -18, -14]), SKIN, { lw: 10, seed: SEED + 72, lit: [SKIN_D, 20], mottle: ['rgba(150,96,60,0.3)', 6, 9] });
    ST.blob(ctx, [32, -76, 56, -72, 54, -52, 32, -56], BURN, { lw: 0, seed: SEED + 73, deco: true });
    ST.hardShadow(ctx, [-40, -132, 0, -128, 40, -134, 64, -128, 64, -112, 30, -116, -10, -112, -44, -116], 12, 0.35);
    eye(ctx, 2, -102, 19, f, ex, SEED + 74, 0);
    eye(ctx, 46, -104, 15, f, ex, SEED + 76, 1);
    wisps(ctx, 2, -130, 22, ex.brow, f.twitch, SEED + 78);
    ST.blob(ctx, [26, -76, 42, -78, 50, -62, 44, -54, 30, -56, 26, -64], '#c97a5c', { lw: 5, seed: SEED + 79, lit: [SKIN_D, 5, false] });
    if (!ST.SIL) { ctx.fillStyle = C.INK; ctx.fillRect(38, -60, 4, 4); }
    mouth(ctx, 30, -42, f, ex, 0.8, J);
    acne(ctx, [[-16, -46], [-2, -150]], SEED + 80);
    fringe(ctx, [-46, -120, -44, -162, -20, -192, 18, -198, 50, -184, 66, -150, 64, -118, 52, -134, 44, -112, 32, -136, 20, -114, 6, -138, -8, -114, -22, -138, -34, -116], SEED + 82);
    ST.stroke(ctx, [36, -194, 50, -228, 56, -212], { w: 5, color: HAIR_D, seed: SEED + 83 });
  }
  function headProfile(ctx, f, o) {
    const J = o.J, ex = o.ex;
    ST.blob(ctx, J.pts([-30, -10, -54, -60, -62, -120, -48, -168, -10, -190, 26, -180, 44, -150, 50, -116, 48, -92, 52, -78, 48, -62, 56, -50, 52, -36, 38, -32, 34, -18, 22, -4, 4, 0, -14, -2]), SKIN, { lw: 10, seed: SEED + 84, lit: [SKIN_D, 20], mottle: ['rgba(150,96,60,0.3)', 6, 9] });
    ST.hardShadow(ctx, [-50, -128, 0, -124, 50, -130, 50, -112, 0, -110, -50, -112], 0, 0.35);
    eye(ctx, 34, -104, 16, f, ex, SEED + 86, 0);
    wisps(ctx, 34, -132, 18, ex.brow, f.twitch, SEED + 87);
    ST.blob(ctx, [48, -84, 60, -80, 66, -68, 60, -62, 48, -64], '#c97a5c', { lw: 5, seed: SEED + 88 });
    if (J.d > 3 || ex.mouth === 'O' || ex.mouth === 'grimace') ST.hole(ctx, [36, -38, 50, -40, 48, J.y(-30), 36, J.y(-30)], { lw: 4, seed: SEED + 89 });
    ST.blob(ctx, [44, -44, 58, -46, 57, -24, 46, -26], '#d8c99a', { sharp: true, lw: 3.5, seed: SEED + 90, shade: ['#a99560', -2, 2], double: false }); // buck teeth jut forward
    ST.stroke(ctx, J.pts([44, -20, 32, -16, 26, -4, 12, 4]), { w: 3, seed: SEED + 91 });
    ear(ctx, -14, -96, -1, SEED + 85);
    fringe(ctx, [-64, -104, -62, -150, -30, -192, 10, -200, 40, -180, 54, -146, 46, -124, 36, -136, 28, -118, 14, -140, -4, -130, -20, -146, -40, -120, -52, -96], SEED + 92);
  }
  function headBack(ctx) {
    ear(ctx, -46, -96, -1, SEED + 93);
    ear(ctx, 48, -98, 1, SEED + 95);
    ST.blob(ctx, [-46, -30, -54, -80, -52, -130, -40, -168, -10, -186, 24, -184, 46, -166, 56, -128, 54, -80, 44, -30, 22, 0, 0, 16, -22, 0], SKIN, { lw: 10, seed: SEED + 97, lit: [SKIN_D, 18] }); // the nape reaches the neck (film 15's back head floated 30 px above it)
    ST.blob(ctx, [-56, -60, -58, -130, -40, -176, -10, -198, 24, -196, 50, -172, 60, -130, 58, -60, 44, -50, 30, -64, 16, -44, 0, -60, -16, -44, -30, -62, -44, -48], HAIR, { lw: 0, seed: SEED + 98, lit: [HAIR_D, 12], hatch: { c: 'rgba(30,22,6,0.6)', n: 10, len: 30, gap: 5, k: 3, ang: 86, bend: 0.1 } });
    ST.stroke(ctx, [26, -182, 44, -226, 50, -210], { w: 5, color: HAIR_D, seed: SEED + 99 }); // the cowlick grows out of the hair
  }
  const JAW = [{ pivot: -38, drop: 24, span: 8 }, { pivot: -38, drop: 22, span: 8 }, { pivot: -34, drop: 18, span: 8 }, { pivot: 0, drop: 0 }];
  const FACE = [
    { nose: [0, -64], mouth: [2, -36], chin: [2, -6], forehead: [4, -150], cheek: [[-34, -64], [36, -64]], ear: [[-62, -96], [64, -100]] },
    { nose: [38, -66], mouth: [30, -36], chin: [24, -6], forehead: [16, -150], cheek: [[-14, -64], [54, -62]], ear: [[-46, -96]] },
    { nose: [58, -72], mouth: [44, -32], chin: [24, -4], forehead: [30, -150], cheek: [[24, -62]], ear: [[-30, -96]] },
    null,
  ];
  // the sack over the left shoulder: gripped at the palm, hangs behind the back (drawn before the body)
  function behind(ctx, J, A, p) {
    if (!p.sack) return;
    const g = ST.palm(J.aL, 34), s = A.V.v === 0 ? 1 : -1, P = (dx, dy) => [g[0] + s * dx, g[1] + dy];
    ST.blob(ctx, [].concat(P(-10, -6), P(30, -56), P(90, -66), P(124, -14), P(114, 100), P(46, 146), P(-16, 108)), '#9a8e68', { lw: 10, seed: SEED + 102, lit: ['#6c6044', 18], mottle: ['rgba(60,46,20,0.4)', 5, 18], hatch: { c: 'rgba(40,30,12,0.55)', n: 5, len: 30, gap: 6, k: 3, ang: 70 } });
    ST.clothPatch(ctx, g[0] + s * 60, g[1] + 50, 30, 26, '#7a6c4a', SEED + 103);
  }

  const ARM = { cloth: SHIRT, clothD: SHIRT_D, w: [34, 30, 26], bare: 0.5, skin: SKIN, skinD: SKIN_D, hsz: 34, lw: 8, hatch: { c: 'rgba(40,30,12,0.5)', n: 3, len: 22, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: SLOP_D, clothD: '#38342a', w: [40, 24, 18], skin: SKIN, skinD: SKIN_D, shoe: '#3d2f24', shoeD: '#2a2019', len: 70, sw: 24, lw: 8, splay: -0.3 };
  ST.recruitCarry = (Dd) => ({ hL: [Dd.sw + 10, Dd.sy - 40, 40], kL: 'grip', poleL: [1, 0.6, 0.2] });
  ST.defineCharacter({
    id: 'recruit', name: 'The Recruit', seed: SEED, D, neck: NECK, torso, heads: [headFront, head34, headProfile, headBack],
    jaw: JAW, face: FACE, arm: ARM, leg: LEG, behind, shadowW: 150, expr: EX, expr0: 'scared', headDy: (p) => -(p.gulp || 0) * 10,
    extraRows: [['sack', (Dd) => ({ sack: true, pose: ST.pose('stand', Dd, null, ST.recruitCarry(Dd)) })]],
  });
})();

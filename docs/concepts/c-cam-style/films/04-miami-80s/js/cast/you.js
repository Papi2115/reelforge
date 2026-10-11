/* Main 1 - YOU, a small-time gofer who has seen too much TV. Short and soft, swimming in a borrowed white linen suit
   whose shoulder pads stick out like a coat hanger (the exaggeration axis: a tiny man under huge shoulders). Round
   baby face, chubby sunburnt cheeks, a peeling pink snub nose, a feathered mullet, ears that stick out, worried
   eyebrows, a wispy moustache that is not working, a chipped tooth. Dusty-pink T-shirt, a fake gold chain going green,
   sockless loafers, aviator sunglasses worn at the wrong moments. Default: deadpan, very easily scared.
   Outfits: 'suit' (default), 'under' (stained vest + striped boxers, bare feet). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_RUDDY, SKIN_D = C.SKIN_RUDDY_D, BURN = '#c06a55', HAIR = '#5c3f26', HAIR_D = '#3d2a19', SEED = 110;
  const SUIT = '#bcb293', SUIT_D = '#8d8468', TEE = '#b07c76', TEE_D = '#87585a', CHAIN = '#9c8c3c';
  const D = { sw: 96, sy: -462, sz: 6, l1a: 102, l2a: 96, hw: 34, hy: -268, l1l: 138, l2l: 126, elbowOut: 0.8, top: -706, waist: [104, -350], hsz: 38, head: { x: [0, 14, 28, 0], top: -712, bottom: -506, hw: 76 } };
  const NECK = [[0, -494, 0, -522], [6, -492, 12, -520], [12, -488, 24, -516], [0, -494, 0, -522]];
  const OX = [0, 18, 44, 0], OK = [1, 0.8, 0.4, 0];

  const JACKET = [
    [-28, -512, -110, -500, -128, -470, -116, -430, -100, -380, -96, -320, -100, -252, -60, -240, 0, -244, 60, -240, 100, -252, 96, -320, 100, -380, 116, -430, 128, -470, 110, -500, 28, -512],
    [-22, -514, -104, -502, -122, -470, -110, -430, -94, -380, -90, -320, -94, -252, -50, -240, 10, -244, 70, -242, 106, -256, 104, -322, 108, -384, 116, -436, 118, -474, 96, -504, 26, -514],
    [-12, -516, -66, -504, -84, -470, -74, -420, -66, -360, -66, -300, -70, -252, -20, -240, 46, -244, 66, -262, 64, -330, 70, -390, 74, -450, 66, -494, 30, -514],
    [-28, -512, -112, -500, -128, -470, -116, -430, -100, -380, -96, -320, -100, -252, -60, -240, 0, -242, 60, -240, 100, -252, 96, -320, 100, -380, 116, -430, 128, -470, 112, -500, 28, -512],
  ];
  const VEST = [
    [-24, -500, -60, -492, -74, -466, -80, -400, -88, -320, -86, -262, 0, -256, 86, -262, 88, -320, 80, -400, 74, -466, 60, -492, 24, -500],
    [-18, -502, -56, -494, -70, -466, -74, -400, -80, -320, -78, -262, 10, -256, 90, -264, 96, -324, 88, -404, 78, -468, 56, -494, 22, -502],
    [-8, -504, -40, -494, -52, -460, -54, -400, -58, -320, -56, -262, 30, -258, 70, -270, 80, -330, 70, -400, 58, -460, 44, -494, 20, -504],
    [-24, -500, -60, -492, -74, -466, -80, -400, -88, -320, -86, -262, 0, -256, 86, -262, 88, -320, 80, -400, 74, -466, 60, -492, 24, -500],
  ];
  const BOXERS = [[-88, -284, 88, -284, 96, -196, 18, -192, 0, -212, -18, -192, -96, -196], [-84, -284, 92, -286, 100, -198, 26, -192, 8, -212, -10, -192, -88, -196], [-58, -286, 74, -288, 82, -198, 0, -192, -64, -198], [-88, -284, 88, -284, 96, -196, 18, -192, 0, -204, -18, -192, -96, -196]];

  function suit(ctx, v, stained) {
    ST.blob(ctx, JACKET[v], SUIT, { lw: 8, seed: SEED + v, shade: [SUIT_D, -24, 8], mottle: ['rgba(110,96,60,0.25)', 6, 22], hatch: { c: 'rgba(60,52,30,0.45)', n: 8, len: 44, gap: 7, k: 3, ang: 70 } });
    if (v === 3) {
      ST.stroke(ctx, [0, -500, 2, -252], { w: 4, seed: SEED + 5 });
      ST.stain(ctx, -40, -440, 90, 70, SEED + 6, 'rgba(120,96,50,0.35)'); // sweat
      return;
    }
    const x = OX[v], k = OK[v];
    ST.blob(ctx, [x - 26 * k, -512, x + 26 * k, -512, x + 30 * k, -420, x + 16 * k, -310, x - 16 * k, -310, x - 30 * k, -420], TEE, { lw: 5, seed: SEED + 7, shade: [TEE_D, -8, 4] });
    ST.stroke(ctx, [x - 16 * k, -500, x - 4 * k, -468, x + 6 * k, -470, x + 16 * k, -500], { w: 4.5, color: CHAIN, seed: SEED + 8, taper: false });
    [-1, 1].forEach((s, i) => { // lapels
      if (v === 2 && s < 0) return;
      ST.blob(ctx, [x + s * 26 * k, -514, x + s * 58 * k, -476, x + s * 38 * k, -430, x + s * 24 * k, -380, x + s * 18 * k, -312, x + s * 30 * k, -420], SUIT, { lw: 5, seed: SEED + 9 + i, shade: [SUIT_D, -s * 6, 4] });
    });
    ST.blob(ctx, ST.ellipseRing(x - 6 * k, -340, 7, 7, 6), SUIT_D, { lw: 3, seed: SEED + 12 }); // the one button
    ST.stroke(ctx, [x + 50 * k, -440, x + 80 * k, -436], { w: 4, seed: SEED + 13, taper: false }); // breast pocket
    ST.stain(ctx, x - 60 * k, -330, 40, 34, SEED + 14, 'rgba(90,70,30,0.3)');
    if (stained) { ST.stain(ctx, x + 50 * k, -400, 70, 60, SEED + 15, 'rgba(70,50,30,0.4)'); ST.stain(ctx, x - 50 * k, -470, 60, 50, SEED + 16, 'rgba(120,96,50,0.4)'); }
  }
  function under(ctx, v) {
    ST.blob(ctx, BOXERS[v], '#6c7a80', { lw: 6, seed: SEED + 17, shade: ['#4c585e', -10, 4], inner: (bb) => { ctx.strokeStyle = 'rgba(200,190,160,0.5)'; ctx.lineWidth = 6 * ST.LW; ctx.beginPath(); for (let x = bb.x0 + 12; x < bb.x1; x += 26) { ctx.moveTo(x, bb.y0); ctx.lineTo(x + 4, bb.y1); } ctx.stroke(); } });
    ST.blob(ctx, VEST[v], '#b9b096', { lw: 7, seed: SEED + 18, shade: ['#8e866c', -16, 8], mottle: ['rgba(110,96,60,0.3)', 5, 18], hatch: { c: 'rgba(60,52,30,0.4)', n: 6, len: 30, gap: 6, k: 3, ang: 80 } });
    if (v < 3) {
      ST.stroke(ctx, [OX[v] - 20 * OK[v], -500, OX[v], -470, OX[v] + 20 * OK[v], -500], { w: 4, seed: SEED + 19 });
      ST.stain(ctx, OX[v] + 20 * OK[v], -330, 60, 40, SEED + 20, 'rgba(150,90,40,0.35)'); // a sauce stain
    }
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -14, 8], mottle: ['rgba(150,70,50,0.28)', 6, 10], hatch: { c: 'rgba(80,30,20,0.35)', n: 3, len: 16, gap: 5, k: 3, ang: 72 } };
  const HAIRO = { lw: 5, shade: [HAIR_D, -6, 6], hatch: { c: 'rgba(30,18,8,0.45)', n: 5, len: 16, gap: 4, k: 3, ang: 70 } };
  function ear(ctx, x, s, seed) { ST.blob(ctx, [x, -98, x + s * 22, -112, x + s * 28, -84, x + s * 16, -56, x, -64], SKIN, { lw: 5, seed, shade: [SKIN_D, -s * 5, 2], patch: [BURN, s * 4, -2, 0.4] }); }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 12 * a[2], 13, f, { skin: SKIN, seed: SEED + 30, lw: 5, side: 0 });
    ST.brow(ctx, a[0], a[1] - 24, 30 * a[2], -1, f, { u: 18, thick: 9, color: HAIR, seed: SEED + 31, arch: 1.2, droop: 6 });
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 11 * b[2], 12, f, { skin: SKIN, seed: SEED + 32, lw: 5, side: 1 });
    ST.brow(ctx, b[0], b[1] - 24, 28 * b[2], 1, f, { u: 18, thick: 9, color: HAIR, seed: SEED + 33, arch: 1.2, droop: 6 });
  }
  function tache(ctx, x, y, w) { for (let i = 0; i < 7; i++) { const u = -1 + (2 * i) / 6; ST.stroke(ctx, [x + u * w, y - 4, x + u * w * 1.08, y + 3], { w: 3, color: HAIR, seed: SEED + 34 + i, taper: false }); } }
  function nose(ctx, pts, peel) {
    ST.blob(ctx, pts, SKIN, { lw: 6, seed: SEED + 42, shade: [SKIN_D, -5, 4], patch: [BURN, 2, -4, 0.62] });
    if (peel) { const b = ST.bbox(pts); [[0.35, 0.28], [0.62, 0.55]].forEach(([u, w], i) => { const x = b.x0 + b.w * u, y = b.y0 + b.h * w; ST.blob(ctx, [x - 6, y, x + 2, y - 4, x + 7, y + 1, x + 1, y + 3], '#d9c4a6', { sharp: true, lw: 1.8, seed: SEED + 43 + i }); }); }
  }
  // aviators: on = over the eyes, up = pushed up into the hair
  function shades(ctx, a, b, mode, k) {
    const y = mode === 2 ? -132 - a[1] : 0, lens = (x, yy, w, s) => ST.blob(ctx, [x - w, yy - 12, x + w, yy - 14, x + w * 0.9, yy + 8, x, yy + 18, x - w * 0.8, yy + 10], '#2d2723', { lw: 5, seed: s, light: ['rgba(230,190,150,0.35)', 5, -5], shade: ['rgba(120,70,60,0.5)', -4, 6] });
    lens(a[0], a[1] + y, 17 * a[2] * k, SEED + 46);
    if (b) { lens(b[0], b[1] + y, 16 * b[2] * k, SEED + 47); ST.stroke(ctx, [a[0] + 14 * a[2], a[1] + y - 8, b[0] - 14 * b[2], b[1] + y - 8], { w: 4, color: C.GOLD_D, seed: SEED + 48, taper: false }); }
  }
  function headFront(ctx, f, p) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-60, -96, -78, -44, -72, 0, -52, -16], HAIR, Object.assign({ seed: SEED + 50 }, HAIRO)); // the mullet behind
    ST.blob(ctx, [60, -96, 78, -44, 72, 0, 52, -16], HAIR, Object.assign({ seed: SEED + 51 }, HAIRO));
    ear(ctx, -60, -1, SEED + 52); ear(ctx, 60, 1, SEED + 53);
    ST.blob(ctx, [-56, -20 + jaw, -66, -64, -64, -110, -52, -142, -20, -158, 18, -158, 50, -142, 64, -110, 66, -64, 56, -20 + jaw, 34, 6 + jaw, 0, 12 + jaw, -34, 6 + jaw], SKIN, Object.assign({ seed: SEED + 54 }, FACE));
    [-1, 1].forEach((s, i) => ST.blob(ctx, ST.ellipseRing(s * 38, -54, 16, 10, 7), 'rgba(190,80,60,0.35)', { lw: 0, seed: SEED + 55 + i })); // burnt cheeks
    ST.blob(ctx, [-66, -96, -66, -128, -50, -156, -16, -172, 22, -172, 54, -156, 68, -128, 66, -96, 56, -112, 40, -136, 6, -140, -28, -134, -50, -114], HAIR, Object.assign({ seed: SEED + 57 }, HAIRO));
    eyes(ctx, f, [-24, -92, 1], [24, -92, 1]);
    ST.mouth(ctx, 0, -26, 32, f, { open: 26, teeth: 'snag', seed: SEED + 58, lw: 5 });
    tache(ctx, 0, -38, 18);
    nose(ctx, [-8, -90, 8, -90, 14, -64, 18, -52, 6, -46, -10, -46, -18, -54, -12, -66], p.peel);
    if (p.shades) shades(ctx, [-24, -90, 1], [24, -90, 1], p.shades, 1);
  }
  function head34(ctx, f, p) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-50, -96, -72, -40, -66, 2, -40, -14], HAIR, Object.assign({ seed: SEED + 60 }, HAIRO));
    ear(ctx, -48, -1, SEED + 61);
    ST.blob(ctx, [-48, -18 + jaw, -58, -64, -58, -112, -44, -144, -10, -160, 26, -158, 54, -140, 66, -110, 70, -76, 70, -40, 60, -18 + jaw, 40, 6 + jaw, 12, 12 + jaw, -22, 6 + jaw], SKIN, Object.assign({ seed: SEED + 62 }, FACE));
    ST.blob(ctx, ST.ellipseRing(-14, -54, 16, 10, 7), 'rgba(190,80,60,0.35)', { lw: 0, seed: SEED + 63 });
    ST.blob(ctx, ST.ellipseRing(52, -54, 10, 9, 7), 'rgba(190,80,60,0.35)', { lw: 0, seed: SEED + 64 });
    ST.blob(ctx, [-58, -94, -60, -130, -40, -158, -4, -174, 32, -170, 60, -150, 70, -120, 60, -110, 46, -134, 14, -140, -16, -132, -34, -112, -44, -90], HAIR, Object.assign({ seed: SEED + 65 }, HAIRO));
    eyes(ctx, f, [-4, -92, 1], [44, -92, 0.66]);
    ST.mouth(ctx, 26, -26, 28, f, { open: 24, teeth: 'snag', seed: SEED + 66, lw: 5 });
    tache(ctx, 28, -38, 15);
    nose(ctx, [16, -84, 32, -84, 42, -62, 36, -48, 20, -48, 12, -58], p.peel);
    if (p.shades) shades(ctx, [-4, -90, 1], [44, -90, 0.66], p.shades, 1);
  }
  function headProfile(ctx, f, p) {
    const jaw = f.jaw * 16;
    ST.blob(ctx, [-36, -100, -74, -60, -76, -4, -50, 6, -30, -20], HAIR, Object.assign({ seed: SEED + 67 }, HAIRO));
    ST.blob(ctx, [-44, -14, -58, -60, -60, -110, -44, -144, -8, -160, 28, -152, 48, -130, 54, -108, 52, -92, 60, -76, 56, -40, 52, -18 + jaw, 34, 4 + jaw, 6, 10 + jaw, -20, 0], SKIN, Object.assign({ seed: SEED + 68 }, FACE));
    ST.blob(ctx, ST.ellipseRing(28, -54, 14, 10, 7), 'rgba(190,80,60,0.35)', { lw: 0, seed: SEED + 69 });
    ST.blob(ctx, [-62, -94, -62, -132, -40, -162, -2, -174, 32, -164, 52, -138, 52, -118, 34, -128, 10, -138, -16, -128, -30, -100, -40, -70, -56, -64], HAIR, Object.assign({ seed: SEED + 70 }, HAIRO));
    ear(ctx, -24, -1, SEED + 71);
    eyes(ctx, f, [32, -92, 0.72], null);
    ST.mouth(ctx, 42, -26, 16, f, { open: 22, teeth: 'snag', seed: SEED + 72, lw: 5 });
    tache(ctx, 46, -38, 9);
    nose(ctx, [48, -84, 60, -76, 70, -56, 62, -48, 50, -52], p.peel);
    if (p.shades) shades(ctx, [34, -90, 0.6], null, p.shades, 1);
  }
  function headBack(ctx, f, p) {
    ear(ctx, -60, -1, SEED + 73); ear(ctx, 60, 1, SEED + 74);
    ST.blob(ctx, [-56, -14, -66, -64, -64, -110, -52, -142, -20, -158, 18, -158, 50, -142, 64, -110, 66, -64, 56, -14, 0, 0], SKIN, Object.assign({ seed: SEED + 75 }, FACE));
    ST.blob(ctx, [-66, -96, -66, -128, -50, -156, -16, -172, 22, -172, 54, -156, 68, -128, 66, -96, 70, -40, 64, 6, 30, 12, 0, 4, -30, 12, -64, 6, -70, -40], HAIR, Object.assign({ seed: SEED + 76 }, HAIRO)); // the full mullet
    if (p.shades === 2) ST.stroke(ctx, [-50, -138, 0, -144, 50, -138], { w: 4, color: C.GOLD_D, seed: SEED + 77, taper: false });
  }
  const HEADS = [headFront, head34, headProfile, headBack];
  const SWEAT = [[[-6, -130], [-50, -76], [50, -70]], [[14, -132], [-34, -70], [64, -62]], [[30, -130], [8, -66]], []];

  const ARM_SUIT = { cloth: SUIT, clothD: SUIT_D, w: [54, 44, 36], bare: 0.6, skin: SKIN, skinD: SKIN_D, hsz: D.hsz, lw: 7, cuff: '#aaa181', hair: true, hatch: { c: 'rgba(60,52,30,0.4)', n: 3, len: 24, gap: 6, k: 3, ang: 40 } };
  const ARM_BARE = { cloth: SKIN, clothD: SKIN_D, w: [38, 32, 28], skin: SKIN, skinD: SKIN_D, hsz: D.hsz, lw: 6.5, hair: true };
  const LEG_SUIT = { cloth: SUIT, clothD: SUIT_D, w: [50, 44, 40], shoe: '#d0c8a8', shoeD: '#9a9278', shoeL: 'rgba(255,250,230,0.4)', len: 68, sw: 30, lw: 7, splay: 0.4, hatch: { c: 'rgba(60,52,30,0.35)', n: 2, len: 30, gap: 6, k: 3, ang: 80 } };
  const LEG_BARE = { cloth: SKIN, clothD: SKIN_D, w: [40, 32, 26], shoe: SKIN, shoeD: SKIN_D, len: 66, sw: 28, lw: 6.5, splay: 0.45 };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, outfit ('suit' | 'under'), stained,
  //    sweat, peel, shades (1 on | 2 pushed up), hold { side 'L'|'R', fn(ctx, palm[x, y], mir) } drawn under the hand, after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'deadpan', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {}, uw = p.outfit === 'under', hold = p.hold;
    const hs = (sd) => hold && (hold.side === 'L' ? 1 : 2) === sd;
    const arms = [[J.aL, hs(1) ? hold.kind || 'grip' : P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, hs(2) ? hold.kind || 'grip' : P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      if (hs(sd)) hold.fn(ctx, ST.palm(j, D.hsz), V.mir, j);
      ST.drawArm(ctx, j, Object.assign({}, uw ? ARM_BARE : ARM_SUIT, { hand: k || 'fist', seed: SEED + 80 + sd }));
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, uw ? LEG_BARE : LEG_SUIT, { seed: SEED + 90 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      ST.tube(ctx, [n[0], n[1] + 6, n[2], n[3] + 14 + (p.headDy || 0)], [50, 46], SKIN, { lw: 6, seed: SEED + 94, shade: [SKIN_D, -8, 0] });
      if (uw) under(ctx, V.v); else suit(ctx, V.v, p.stained);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.12 : 1.12, 1.12);
      HEADS[H.V.v](ctx, f, p);
      if (p.sweat) ST.sweat(ctx, SWEAT[H.V.v], p.t || 0, SEED + 96);
      ctx.restore();
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.you = {
    name: 'You (the gofer)', D, draw,
    demo: { shades: 2 },
    extraRow: ['vest + shades', (Dd) => ({ outfit: 'under', shades: 1, pose: ST.pose('akimbo', Dd) })],
  };
})();

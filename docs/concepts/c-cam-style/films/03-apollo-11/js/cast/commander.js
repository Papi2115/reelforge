/* Main 2 - THE COMMANDER. A wardrobe of a test pilot: wide square shoulders, no waist, short thick legs, a neck as
   wide as his head. Block head, heavy square jaw with a cleft and an old stitched scar, a flattened boxer's nose,
   small heavy-lidded eyes under one straight low brow line, crow's feet, deep cheek lines, a dark five o'clock
   shadow up to the cheekbones. Comm cap worn tight and straight. Chews gum, blows a bubble. Default: deadpan.
   Suit: the same off-white pressure suit, cleaner than yours, a mustard name tape, grey-blue hose connectors. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_RUDDY, SKIN_D = C.SKIN_RUDDY_D, SUIT = '#aba58f', SUIT_D = '#817b66', SEED = 310;
  const D = { sw: 70, sy: -552, sz: 8, l1a: 114, l2a: 108, hw: 36, hy: -340, l1l: 164, l2l: 150, elbowOut: 0.75, top: -800, waist: [84, -404], hsz: 42, head: { x: [0, 18, 36, 0], top: -800, bottom: -598, hw: 78 } };
  const NECK = [[0, -570, 0, -612], [8, -568, 14, -610], [14, -564, 30, -604], [0, -570, 0, -612]];
  const RING = [0, 12, 24, 0];

  const SUITS = [
    [-34, -590, -96, -582, -118, -548, -114, -490, -104, -440, -100, -400, -102, -350, -70, -322, 0, -318, 70, -322, 102, -350, 100, -400, 104, -440, 114, -490, 118, -548, 96, -582, 34, -590],
    [-24, -592, -92, -584, -114, -548, -110, -490, -100, -440, -96, -400, -98, -350, -64, -322, 12, -318, 74, -322, 96, -352, 94, -404, 98, -450, 102, -504, 94, -552, 70, -584, 26, -594],
    [-8, -596, -54, -586, -72, -546, -68, -480, -60, -420, -60, -370, -62, -338, -40, -322, 46, -320, 66, -344, 70, -400, 76, -456, 78, -516, 64, -566, 34, -592],
    [-34, -590, -98, -582, -120, -548, -116, -490, -106, -440, -102, -400, -104, -350, -70, -322, 0, -320, 70, -322, 104, -350, 102, -400, 106, -440, 116, -490, 120, -548, 98, -582, 34, -590],
  ];
  const BELT = [[-100, -404, 0, -396, 100, -404], [-96, -404, 14, -396, 96, -402], [-60, -400, 24, -394, 70, -398], [-102, -404, 0, -398, 102, -404]];

  function suit(ctx, v) {
    ST.blob(ctx, SUITS[v], SUIT, { lw: 8, seed: SEED + v, shade: [SUIT_D, -24, 8], mottle: ['rgba(90,80,50,0.2)', 4, 18], hatch: { c: 'rgba(40,36,24,0.5)', n: 9, len: 44, gap: 7, k: 3, ang: -65 } });
    ST.stroke(ctx, BELT[v], { w: 8, color: SUIT_D, seed: SEED + 5, taper: false });
    if (v === 3) { ST.stroke(ctx, [0, -582, -4, -470, 2, -340], { w: 4.5, seed: SEED + 6 }); ST.stroke(ctx, [-60, -560, -40, -500, -64, -440], { w: 3.5, seed: SEED + 7 }); return; }
    const x = [0, 20, 50][v], k = [1, 0.8, 0.4][v];
    ST.stroke(ctx, [x + 2, -580, x - 2, -480, x + 2, -404], { w: 4, seed: SEED + 8 });
    [[-40, -470], [-22, -470], [22, -470], [40, -470]].forEach(([dx, y], i) => {
      if (v === 2 && i < 2) return;
      ST.blob(ctx, ST.ellipseRing(x + dx * k, y, 10 * (v === 2 ? 0.6 : 1), 10, 8), C.GREYBLUE, { lw: 4, seed: SEED + 10 + i, light: ['rgba(230,220,190,0.3)', 2, -2] });
    });
    if (v < 2) ST.rect(ctx, x + 30 * k, -546, 46 * k, 22, C.MUSTARD, { seed: SEED + 15, lw: 3, amp: 1 }); // name tape
    ST.stroke(ctx, [x - 60 * k, -430, x - 40 * k, -410, x - 62 * k, -392], { w: 3.5, seed: SEED + 16 }); // a fold
  }
  function ring(ctx, v) {
    ST.blob(ctx, ST.ellipseRing(RING[v], -588, v === 2 ? 34 : 50, 13, 12), C.STONE, { lw: 6, seed: SEED + 18, shade: [C.STONE_D, 0, 4] });
  }

  // ---------- head per view (origin = top of the neck) ----------
  const FACE = { lw: 7, shade: [SKIN_D, -16, 8], mottle: ['#9a6650', 6, 12], hatch: { c: 'rgba(60,24,12,0.4)', n: 4, len: 18, gap: 5, k: 3, ang: 70 } };
  const STUB = 'rgba(30,22,18,0.65)';
  function cap(ctx, side, top, cups) {
    ST.blob(ctx, side, '#a59e84', { lw: 6, seed: SEED + 20, shade: ['#7e7862', -6, 6], hatch: { c: 'rgba(40,34,20,0.45)', n: 4, len: 18, gap: 5, k: 3, ang: 80 } });
    ST.blob(ctx, top, C.BROWN_D, { lw: 6, seed: SEED + 21, shade: ['#2c2219', -8, 6], hatch: { c: 'rgba(120,100,70,0.35)', n: 3, len: 20, gap: 5, k: 3, ang: 20 } });
    cups.forEach(([x, y], i) => ST.blob(ctx, ST.ellipseRing(x, y, 16, 22, 9), C.BLACK, { lw: 5, seed: SEED + 22 + i, light: ['rgba(200,190,160,0.25)', 3, -3] }));
  }
  function eyes(ctx, f, a, b) {
    ST.eye(ctx, a[0], a[1], 11 * a[2], 12, f, { skin: SKIN, seed: SEED + 24, lw: 5, side: 0, bags: 2, lidAdd: 0.08 });
    ST.brow(ctx, a[0], a[1] - 20, 34 * a[2], -1, f, { u: 14, thick: 14, color: '#2e241c', seed: SEED + 25, arch: 0.2 });
    ST.stroke(ctx, [a[0] - 16 * a[2], a[1] + 2, a[0] - 26 * a[2], a[1] - 4], { w: 3, seed: SEED + 26 }); // crow's feet
    if (!b) return;
    ST.eye(ctx, b[0], b[1], 10 * b[2], 12, f, { skin: SKIN, seed: SEED + 27, lw: 5, side: 1, bags: 2, lidAdd: 0.08 });
    ST.brow(ctx, b[0], b[1] - 20, 34 * b[2], 1, f, { u: 14, thick: 14, color: '#2e241c', seed: SEED + 28, arch: 0.2 });
    ST.stroke(ctx, [b[0] + 16 * b[2], b[1] + 2, b[0] + 26 * b[2], b[1] - 4], { w: 3, seed: SEED + 29 });
  }
  // gum: the mouth shifts side to side on twos with a cheek bulge; bubble grows from the lips
  function chewing(p) { return p.chew ? Math.floor(ST.twos(p.t || 0) * 6) % 2 : -1; }
  function mouth(ctx, f, x, y, w, ch, bubble, cheekX) {
    const dx = ch === 1 ? 5 : ch === 0 ? -4 : 0;
    if (ch >= 0) ST.blob(ctx, ST.ellipseRing(cheekX * (ch ? 1 : -1) + x, y - 10, 10, 8, 7), SKIN_D, { lw: 0, seed: SEED + 30 });
    ST.mouth(ctx, x + dx, y, w, f, { open: 26, teeth: 'row', seed: SEED + 31, lw: 5 });
    ST.gumBubble(ctx, x + dx + 4, y + 2, bubble * 78, SEED + 32);
  }
  function headFront(ctx, f, ch, bubble) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-58, -14 + jaw, -62, -60, -62, -110, -54, -146, -18, -160, 20, -160, 54, -148, 62, -112, 62, -60, 58, -14 + jaw, 36, 10 + jaw, 0, 16 + jaw, -36, 10 + jaw], SKIN, Object.assign({ seed: SEED + 33 }, FACE));
    ST.stubble(ctx, [-56, -60, -50, 4 + jaw, 0, 18 + jaw, 50, 4 + jaw, 58, -60, 30, -44, -30, -44], SEED + 34, 120, STUB);
    cap(ctx, [-58, -30, -66, -100, -58, -150, -20, -170, 20, -170, 58, -150, 66, -100, 58, -30, 50, -30, 54, -104, 40, -118, 0, -122, -40, -118, -54, -104, -50, -30], [-56, -124, -48, -156, -18, -174, 20, -174, 50, -156, 58, -124, 0, -132], [[-66, -80], [66, -80]]);
    ST.stroke(ctx, [-52, -30, -30, 6 + jaw, 0, 12 + jaw, 30, 6 + jaw, 52, -30], { w: 5, color: C.BROWN_D, seed: SEED + 35, taper: false });
    eyes(ctx, f, [-24, -90, 1], [24, -90, 1]);
    ST.stroke(ctx, [-34, -58, -40, -36, -34, -14 + jaw], { w: 3.5, seed: SEED + 36 }); // cheek lines
    ST.stroke(ctx, [34, -58, 40, -36, 34, -14 + jaw], { w: 3.5, seed: SEED + 37 });
    ST.blob(ctx, [-10, -88, 10, -88, 14, -64, 24, -50, 12, -40, -12, -40, -24, -50, -14, -64], SKIN, { lw: 6, seed: SEED + 38, shade: [SKIN_D, -6, 5], patch: ['#c08a6e', 4, -8, 0.3] });
    ST.stroke(ctx, [-4, -2 + jaw, 0, 8 + jaw, 4, -2 + jaw], { w: 3, seed: SEED + 39 }); // chin cleft
    ST.stroke(ctx, [18, 0 + jaw, 30, -10 + jaw], { w: 3, color: '#6a3a2a', seed: SEED + 40, taper: false }); // scar
    mouth(ctx, f, 0, -24, 46, ch, bubble, 34);
  }
  function head34(ctx, f, ch, bubble) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-50, -12 + jaw, -58, -60, -58, -112, -48, -148, -10, -162, 30, -158, 58, -140, 66, -110, 64, -84, 70, -60, 66, -14 + jaw, 46, 10 + jaw, 12, 16 + jaw, -24, 10 + jaw], SKIN, Object.assign({ seed: SEED + 41 }, FACE));
    ST.stubble(ctx, [-46, -60, -40, 4 + jaw, 12, 18 + jaw, 64, 4 + jaw, 68, -60, 44, -44, -18, -44], SEED + 42, 120, STUB);
    cap(ctx, [-52, -30, -62, -104, -52, -152, -12, -172, 30, -170, 62, -148, 66, -116, 52, -120, 30, -124, -10, -124, -34, -112, -42, -96, -38, -30], [-50, -126, -42, -158, -10, -176, 30, -174, 60, -150, 64, -126, 10, -134], [[-56, -80]]);
    ST.stroke(ctx, [-40, -30, -14, 6 + jaw, 24, 14 + jaw], { w: 5, color: C.BROWN_D, seed: SEED + 43, taper: false });
    eyes(ctx, f, [-4, -90, 1], [44, -90, 0.66]);
    ST.stroke(ctx, [-18, -58, -24, -36, -18, -14 + jaw], { w: 3.5, seed: SEED + 44 });
    ST.blob(ctx, [18, -88, 34, -88, 40, -64, 52, -50, 42, -40, 20, -40, 12, -50, 20, -64], SKIN, { lw: 6, seed: SEED + 45, shade: [SKIN_D, -6, 5], patch: ['#c08a6e', 4, -8, 0.3] });
    ST.stroke(ctx, [22, -2 + jaw, 26, 8 + jaw, 30, -2 + jaw], { w: 3, seed: SEED + 46 });
    mouth(ctx, f, 26, -24, 40, ch, bubble, 26);
  }
  function headProfile(ctx, f, ch, bubble) {
    const jaw = f.jaw * 14;
    ST.blob(ctx, [-44, -10, -64, -50, -66, -110, -50, -148, -10, -162, 30, -154, 50, -130, 54, -108, 50, -94, 58, -84, 56, -60, 52, -46, 56, -34, 62, -16 + jaw, 56, 4 + jaw, 30, 14 + jaw, 0, 12, -24, 2], SKIN, Object.assign({ seed: SEED + 47 }, FACE));
    ST.stubble(ctx, [-4, -60, 4, 8 + jaw, 54, 6 + jaw, 58, -40, 30, -46], SEED + 48, 90, STUB);
    cap(ctx, [-40, -16, -70, -60, -72, -124, -48, -168, -6, -178, 34, -166, 52, -132, 32, -124, 8, -122, -8, -98, -2, -16], [-58, -130, -44, -168, -6, -180, 34, -168, 52, -134, 10, -132, -24, -126], [[-24, -80]]);
    ST.stroke(ctx, [-4, -24, 14, 8 + jaw, 40, 12 + jaw], { w: 5, color: C.BROWN_D, seed: SEED + 49, taper: false });
    eyes(ctx, f, [34, -90, 0.72], null);
    ST.blob(ctx, [48, -90, 62, -86, 70, -64, 76, -52, 60, -46, 50, -52], SKIN, { lw: 6, seed: SEED + 50, shade: [SKIN_D, -6, 5], patch: ['#c08a6e', 4, -8, 0.3] });
    ST.stroke(ctx, [30, -54, 22, -34, 30, -16], { w: 3.5, seed: SEED + 51 });
    mouth(ctx, f, 46, -26, 18, ch, bubble, 0);
  }
  function headBack(ctx) {
    ST.blob(ctx, [-56, -8, -62, -60, -62, -110, -54, -146, -18, -160, 20, -160, 54, -148, 62, -110, 62, -60, 56, -8, 0, 4], SKIN, Object.assign({ seed: SEED + 52 }, FACE));
    cap(ctx, [-62, -26, -68, -100, -58, -152, -20, -172, 20, -172, 58, -152, 68, -100, 62, -26, 0, -18], [-56, -124, -48, -156, -18, -176, 20, -176, 50, -156, 58, -124, 0, -132], [[-68, -80], [68, -80]]);
    [-1, 1].forEach((s, i) => ST.stroke(ctx, [s * 30, -16, s * 26, 8], { w: 4, seed: SEED + 53 + i })); // thick nape folds
  }
  const HEADS = [headFront, head34, headProfile, headBack];
  const HELMET = [[2, -72], [10, -72], [16, -72], [0, -72]];

  const ARM = { cloth: SUIT, clothD: SUIT_D, w: [56, 48, 42], skin: ST.GLOVE, skinD: ST.GLOVE_D, hsz: D.hsz, lw: 7, cuff: C.STONE, hatch: { c: 'rgba(40,36,24,0.45)', n: 3, len: 24, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: SUIT, clothD: SUIT_D, w: [62, 52, 46], shoe: '#8d8874', shoeD: '#66624f', len: 80, sw: 40, lw: 7, splay: 0.3, hatch: { c: 'rgba(60,50,30,0.4)', n: 3, len: 30, gap: 6, k: 3, ang: 70 } };

  // p: x, y, s, t, yaw, head, headDy, expr, talk, look, pose, lean, layer {L,R}, chew, bubble (0..1), helmet (1|2),
  //    beforeHand(J) (props drawn under the hands, e.g. the control stick), after(J)
  function draw(ctx, p) {
    const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
    const f = ST.face(p.t || 0, SEED, p.expr || 'deadpan', { talk: p.talk, look: p.look });
    const n = NECK[V.v], lay = p.layer || {};
    const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)], [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
    const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => {
      if (l !== layer) return;
      ST.drawArm(ctx, j, Object.assign({}, ARM, { hand: k === 'thumb' ? 'none' : k || 'fist', seed: SEED + 80 + sd }));
      if (k === 'thumb') ST.thumbsUp(ctx, j.h[0], j.h[1], D.hsz, ST.GLOVE, ST.GLOVE_D, SEED + 84 + sd);
    });
    ST.figure(ctx, Object.assign({}, p, { lean: (p.lean || 0) + (P.lean || 0) }), V.mir, () => {
      armsAt(0);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, LEG, { seed: SEED + 90 + sg })));
      ctx.save();
      ctx.translate(0, J.bob);
      ST.tube(ctx, [n[0], n[1] + 4, n[2], n[3] + 16 + (p.headDy || 0)], [64, 58], SKIN, { lw: 6, seed: SEED + 60, shade: [SKIN_D, -8, 0] });
      suit(ctx, V.v);
      ring(ctx, V.v);
      ctx.restore();
      armsAt(1);
      const H = ST.headView(V.yaw, p.head);
      ctx.save();
      ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0));
      ctx.scale(H.flip ? -1.1 : 1.1, 1.1);
      HEADS[H.V.v](ctx, f, chewing(p), p.bubble || 0);
      if (p.helmet) ST.helmet(ctx, HELMET[H.V.v][0], HELMET[H.V.v][1], 100, 106, { visor: p.helmet === 2, vx: [0, 14, 26, 0][H.V.v], seed: SEED + 61 });
      ctx.restore();
      if (p.beforeHand) p.beforeHand(J);
      armsAt(2);
      if (p.after) p.after(J);
    });
  }
  ST.CAST.commander = { name: 'The Commander', D, draw, demo: { chew: true }, extraRow: ['bubble', (Dd) => ({ bubble: 0.7, pose: ST.pose('stand', Dd, null, { hL: ST.handAt(Dd, 1, 0.3, -0.7, 0.2), kL: 'thumb', poleL: [1, 0.2, -0.3] }) })] };
})();

/* sketchbook v2 - shot 5 (C): POP-UP PAGE. Global film time 33.4-41.4 s (8.0 s); entered by the corner curl from
   Caesar, exits with a page flip into the flipbook (js/timeline.js). Built on the 2.5D camera in js/popup-kit.js.
   Focal point: the paper sun leaving its pencilled notch above the MARCH 21 block (the date stays, the season goes).
   Human traces: pencil construction left on the card (compass arc, guide line with ticks), the block glued 3 px off its
   guide, a glue smear past a glue tab, tape holding the card into the book, a crooked hand-written tag; the red pen
   only on the gap. Beats: closed kraft card -> the pencil hand lifts the cover (dip, lift, overshoot, settle) and the
   block and the sun rise from the fold -> held still -> a beat -> the red pen pulls the tab: the sun slides off its
   notch -> red loop on the empty notch, an arrow along the drift -> held. */
'use strict';
(function () {
  const SB = window.SB, C = SB.C, E = SB.ease, PU = SB.POP;
  const rad = (d) => (d * Math.PI) / 180;
  const X3 = [1, 0, 0];

  // ---- the card (page px; Z = height off the page) ----
  const X0 = 380, X1 = 792, YC = 272, D = 196; // crease along Y = YC; base Y in [YC, YC + D]; cover just as deep
  const BX0 = 616, BX1 = 718, BA = 30, BH = 72; // the MARCH 21 block: foot X, depth off the crease, height
  const PX = 600, PS = 8, R = 160, SR = 24; // sun arm: brad on the backdrop (X, s) behind the block, length; sun radius
  const A0 = 22.7, A1 = -19; // arm angle from upright: sitting in its notch / drifted
  const TAB_Y = 404, TAB_IN = 30, TRAVEL = 52; // pull tab under the base, sticking out on the left
  const EDGE_X = 742; // where the hand lifts the cover

  // ---- choreography (shot time) ----
  const IN = 0.36, DIP = 0.72, LIFT = 0.86, LET = 1.24, LAND = 1.84; // pencil hand opens the card
  const RED_IN = 3.98, PRESS = 4.4, PULL = 4.52, PULLED = 5.5, HOVER = 5.6; // red pen pulls the tab
  const fold = (t) => {
    if (t <= LIFT) return 0;
    if (t <= LET) return 55 * E.in(SB.seg(t, LIFT, LET)); // peeled up, slow then fast
    return 55 + 35 * E.back(SB.seg(t, LET, LAND), 3); // let go: swings past upright, settles at 90
  };
  const tabOut = (t) => -3 * E.out(SB.seg(t, PRESS, PULL)) + (TRAVEL + 3) * E.inOut(SB.seg(t, PULL, PULLED));
  const armAngle = (t) => A0 - ((A0 - A1) * tabOut(t)) / TRAVEL; // the linkage itself is linear

  // ---- geometry for a fold angle (deg) and an arm angle (deg) ----
  function geo(phi, al) {
    const f = rad(phi), c = Math.cos(f), s = Math.sin(f), d = [0, c, s], inN = [0, s, -c];
    const off = (e) => PU.plane([0, YC + e * s, -e * c], X3, d, inN);
    const yB = YC + BA + BH * c, zB = BH * s, yC = YC + BH * c;
    const g = {
      phi: phi,
      cover: PU.plane([0, YC, 0], X3, d), back: off(0), arm: off(1.5), sun: off(5),
      front: PU.plane([BX0, yB, zB], X3, [0, -c, -s]), top: PU.plane([BX0, yC, zB], X3, [0, 1, 0]),
      left: PU.plane([BX0, YC, 0], [0, 0, 1], [0, 1, 0]), right: PU.plane([BX1, YC, 0], [0, 1, 0], [0, 0, 1]),
      leftUV: [0, 0, 0, BA, zB, BA + BH * c, zB, BH * c], rightUV: [0, 0, BA, 0, BA + BH * c, zB, BH * c, zB],
      box: [], sunC: [PX + R * Math.sin(rad(al)), PS + R * Math.cos(rad(al))], spin: rad(A0 - al),
    };
    for (const x of [BX0, BX1]) g.box.push([x, YC, 0], [x, YC + BA, 0], [x, yB, zB], [x, yC, zB]);
    g.cornerTR = PU.proj(BX1, yB, zB);
    return g;
  }
  const BASE = PU.plane([0, 0, 0], X3, [0, 1, 0]); // the page itself: identity

  // ---- marks: the page, the base, the backdrop, the block, the tag, the red pen ----
  const PAGE = [];
  SB.pageNumber(PAGE, 5, 105, 'pencil');
  const still = { t0: -5, dur: 0.01, hand: false };
  const GY = YC + BA + 3; // pencil guide for the block's front foot; the block went down 3 px right of it
  const BASEM = [
    SB.stroke([BX0 - 26, GY, BX1 + 20, GY - 1], Object.assign({ tool: 'pencil', smooth: false, seed: 4511 }, still)),
    SB.stroke([BX0 - 3, GY - 4, BX0 - 3, GY + 4], Object.assign({ tool: 'pencil', smooth: false, seed: 4512 }, still)),
    SB.stroke([BX1 - 3, GY - 4, BX1 - 2, GY + 5], Object.assign({ tool: 'pencil', smooth: false, seed: 4513 }, still)),
  ];
  // the maker's note on the card's floor: hidden while the card is shut, revealed by the opening
  SB.write(BASEM, 'same date, same season', { x: 414, y: 386, size: 21, hand: 'scrawl', tool: 'pencil', rot: -3, seed: 4502, t0: -5, t1: -4.9, handVisible: false });
  // backdrop (u = X, v = height up the card): compass arc of the sun's path, and the sun traced round in its notch
  const BACKM = [];
  const arc = [];
  for (let i = 0; i <= 24; i++) { const a = rad(-34 + (i / 24) * 72); arc.push(PX + R * Math.sin(a), PS + R * Math.cos(a)); }
  BACKM.push(SB.stroke(arc, Object.assign({ tool: 'pencil', seed: 4521, bfps: 12 }, still)));
  const N0 = [PX + R * Math.sin(rad(A0)), PS + R * Math.cos(rad(A0))];
  const ghost = SB.ellipsePts(N0[0], N0[1], SR + 2.5, SR + 2, 18, 0, 2.2);
  ghost.push(ghost[0] + 3, ghost[1] + 4);
  BACKM.push(SB.stroke(ghost, Object.assign({ tool: 'pencil', seed: 4522, bfps: 12 }, still)));
  // printed block face (u across, v down from the top edge)
  const FRONT = [];
  const type = { t0: -5, t1: -4.9, handVisible: false, boil: 0, bfps: 1, hand: 'type', tool: 'fine' };
  const BW = BX1 - BX0;
  SB.write(FRONT, 'MARCH', Object.assign({}, type, { x: (BW - SB.textWidth('MARCH', 11, 'type') - 4.4) / 2, y: 16, size: 11, seed: 4531, col: C.PAPER, w: 1, track: 0.4 }));
  SB.write(FRONT, '21', Object.assign({}, type, { x: (BW - SB.textWidth('21', 36, 'type')) / 2, y: 64, size: 36, seed: 4532, w: 3 }));
  for (const m of FRONT) { m.hand = false; m.boil = 0; }
  // the tag, tied to the block and lying crooked on the base
  const TAG = SB.placement(716, 354, -9, 1);
  const TAGM = [];
  SB.write(TAGM, 'spring', { x: 15, y: 18, size: 13, hand: 'scrawl', tool: 'fine', seed: 4541, t0: -5, t1: -4.9, handVisible: false, bfps: 12 });
  SB.write(TAGM, 'equinox', { x: 12, y: 35, size: 13, hand: 'scrawl', tool: 'fine', seed: 4542, t0: -5, t1: -4.9, handVisible: false, bfps: 12 });
  // red pen: a loop round the empty notch, an arrow along the drift (built on the settled card)
  const RED = [];
  const gN = geo(90, A0);
  const nS = gN.back.xf(N0[0], N0[1]);
  SB.loop(RED, nS[0] + 1, nS[1], 38, 35, { tool: 'red', w: 3, t0: 5.74, dur: 0.28, seed: 4551, a0: -0.9, bfps: 10 });
  // the arrow runs along the sun's own track, from the empty notch to where the sun went
  const drift = [];
  for (let i = 0; i <= 8; i++) { const a = rad(A0 - 14 - (i / 8) * (A0 - A1 - 29)); drift.push(...gN.back.xf(PX + (R + 4) * Math.sin(a), PS + (R + 4) * Math.cos(a) + SB.rnd(-0.8, 0.8, 4553, i))); }
  SB.arrow(RED, drift, { tool: 'red', w: 3, t0: 6.12, dur: 0.2, seed: 4552, head: 13, bfps: 10, ease: 'out' });

  // ---- cut paper pieces ----
  const RAYS = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + SB.rnd(-0.12, 0.12, 4561, i) - 0.2, hw = SB.rnd(0.17, 0.23, 4562, i), len = SB.rnd(8, 13, 4563, i);
    RAYS.push([a - hw, SR - 2, a + SB.rnd(-0.05, 0.05, 4564, i), SR + len, a + hw, SR - 2]);
  }
  const DISC = SB.ellipsePts(0, 0, SR, SR, 30);
  const sunUV = (g, pts) => { const o = [], c = Math.cos(g.spin), s = Math.sin(g.spin); for (let i = 0; i < pts.length; i += 2) o.push(g.sunC[0] + pts[i] * c - pts[i + 1] * s, g.sunC[1] + pts[i] * s + pts[i + 1] * c); return o; };
  const polar = (r) => { const o = []; for (let i = 0; i < r.length; i += 2) o.push(Math.cos(r[i]) * r[i + 1], Math.sin(r[i]) * r[i + 1]); return o; };
  const armUV = (g) => SB.capsule((u, v) => [u, v], PX, PS, g.sunC[0], g.sunC[1], 5.5);
  const to3 = (pl, uv) => { const o = []; for (let i = 0; i < uv.length; i += 2) o.push(pl.at(uv[i], uv[i + 1])); return o; };
  // glue smear: an uneven blob that ran past the left glue tab
  const SMEAR = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const r = SB.rnd(0.65, 1.15, 4571, i); SMEAR.push(BX0 - 17 + Math.cos(a) * 11 * r, YC + 21 + Math.sin(a) * 7 * r); }

  function drawTab(b, t) {
    const e = X0 - TAB_IN - tabOut(t);
    const poly = SB.capsule((u, v) => [u, v], e + 10, TAB_Y + 10, X0 + 40, TAB_Y + 10, 10);
    SB.fillPoly(b, poly, C.KRAFT);
    SB.outline(b, poly, C.KRAFT_D);
    // printed arrow: pull this way
    PU.line(b, BASE, e + 9, TAB_Y + 10, e + 27, TAB_Y + 10, C.KRAFT_D);
    PU.line(b, BASE, e + 9, TAB_Y + 10, e + 14, TAB_Y + 6, C.KRAFT_D);
    PU.line(b, BASE, e + 9, TAB_Y + 10, e + 14, TAB_Y + 14, C.KRAFT_D);
  }
  function drawBaseThings(b, t) {
    PU.shade(b, [[X0 + 3, YC + 4, X1 + 3, YC + 4, X1 + 3, YC + D + 4, X0 + 3, YC + D + 4]], SB.SOFT);
    drawTab(b, t);
    PU.face(b, BASE, PU.rect(X0, YC, X1, YC + D), { col: C.PAPER, fib: C.FIBRE, fo: 41, edge: C.SHADE });
    // glue tabs of the block, folded flat and glued down either side of its foot
    for (const [x, dir] of [[BX0, -1], [BX1, 1]]) {
      const p = [x, YC + 3, x + dir * 11, YC + 7, x + dir * 11, YC + BA - 5, x, YC + BA - 1];
      SB.fillPoly(b, p, C.PAPER);
      SB.outline(b, p, C.SHADE);
    }
    PU.shade(b, [SMEAR], SB.SOFT);
    const rim = SB.pixelPath(SMEAR.concat(SMEAR.slice(0, 2)), true);
    for (let i = 0; i < rim.length; i += 2) if (SB.hash(rim[i], rim[i + 1], 4572) < 0.55) SB.put(b, rim[i], rim[i + 1], C.SHADE);
    SB.drawMarks(b, BASEM, t);
    SB.tape(b, X0 + 8, YC + D - 3, 58, 20, -38, 4581);
    SB.tape(b, X1 - 6, YC + D - 6, 54, 20, 33, 4582);
    // the tag
    const tq = SB.quad(TAG, 69, 44), tag = [...TAG.xf(0, 9), ...TAG.xf(9, 0), ...tq.slice(2, 6), ...TAG.xf(0, 44)];
    PU.shade(b, [tag.map((v, i) => v + (i % 2 ? 3 : 2))], SB.SOFT);
    SB.fillPoly(b, tag, C.COFFEE_L);
    SB.outline(b, tag, C.KRAFT_D);
    const hole = TAG.xf(8, 9);
    SB.fillPoly(b, SB.ellipsePts(hole[0], hole[1], 4, 4, 10), C.KRAFT);
    SB.fillPoly(b, SB.ellipsePts(hole[0], hole[1], 1.8, 1.8, 8), C.PAPER);
    SB.drawMarks(b, TAGM, t, TAG.xf);
  }
  function drawBlock(b, g) {
    if (g.phi < 0.5) return;
    const faces = [[g.left, g.leftUV, 901], [g.right, g.rightUV, 902], [g.top, PU.rect(0, 0, BW, BA), 903], [g.front, PU.rect(0, 0, BW, BH), 904]];
    for (const [pl, uv, fo] of faces) {
      if (!pl.facing) continue;
      PU.face(b, pl, uv, { col: C.PAPER, fib: C.FIBRE, fo: fo, shade: PU.shadeOf(pl), edge: C.GRAPH_L });
    }
    if (g.front.facing) {
      PU.flat(b, g.front, PU.rect(1, 1, BW - 1, 21), C.GRAPHITE);
      SB.drawMarks(b, FRONT, 10, g.front.xf);
    }
  }
  function drawSun(b, g) {
    const arm = armUV(g);
    PU.face(b, g.arm, arm, { col: C.KRAFT, fib: C.COFFEE_L, fib2: C.KRAFT_D, fo: 313, edge: C.KRAFT_D, shade: PU.shadeOf(g.arm) });
    const br = PU.uvPoly(g.arm, SB.ellipsePts(PX, PS, 4.5, 4.5, 10));
    SB.fillPoly(b, br, C.GRAPH_L);
    SB.outline(b, br, C.GRAPHITE);
    for (const r of RAYS) PU.flat(b, g.sun, sunUV(g, polar(r)), C.ORANGE, C.COFFEE);
    PU.flat(b, g.sun, sunUV(g, DISC), C.ORANGE, C.COFFEE);
  }
  function drawThread(b, g) {
    if (g.phi < 4) return;
    const a = g.cornerTR, z = TAG.xf(8, 9), m = [(a[0] + z[0]) / 2 + 3, (a[1] + z[1]) / 2 + 9];
    const pix = SB.pixelPath(SB.smoothPath([a[0], a[1], m[0], m[1], z[0], z[1]], null, 2), true);
    for (let i = 0; i < pix.length; i += 2) SB.put(b, pix[i], pix[i + 1], C.GRAPHITE);
    SB.fillPoly(b, SB.ellipsePts(a[0], a[1], 1.6, 1.6, 6), C.GRAPHITE);
  }

  function render(b, t) {
    SB.setView(480, 270, 1);
    SB.drawStock(b, 'cartridge');
    SB.drawMarks(b, PAGE, t);
    const g = geo(fold(t), armAngle(t));
    drawBaseThings(b, t);
    const coverPts = to3(g.cover, PU.rect(X0, 0, X1, D));
    // shadows on the page and the base, and the inside of the crease
    if (g.phi > 0.5) PU.shade(b, [PU.shadowOn(BASE, coverPts), PU.shadowOn(BASE, g.box), [X0, YC, X1, YC, X1, YC + 3, X0, YC + 3]], SB.SOFT);
    if (g.back.facing) {
      PU.face(b, g.back, PU.rect(X0, 0, X1, D), { col: C.PAPER, fib: C.FIBRE, fo: 517, shade: PU.shadeOf(g.back), edge: C.SHADE });
      SB.drawMarks(b, BACKM, t, g.back.xf);
      const clip = [X0, 0, X1, D];
      PU.shade(b, [PU.shadowOn(g.back, g.box, clip), PU.shadowOn(g.back, to3(g.arm, armUV(g)), clip), PU.shadowOn(g.back, to3(g.sun, sunUV(g, DISC)), clip)], SB.SOFT);
      drawSun(b, g);
      drawBlock(b, g);
      drawThread(b, g);
    } else {
      drawBlock(b, g);
      drawThread(b, g);
      PU.face(b, g.cover, PU.rect(X0, 0, X1, D), { col: C.KRAFT, fib: C.COFFEE_L, fib2: C.KRAFT_D, fo: 233, shade: PU.shadeOf(g.cover), edge: C.KRAFT_D });
    }
    const act = SB.drawMarks(b, RED, t);
    SB.drawPen(b, hand(t, act));
  }

  // ---- the hand: the pencil lifts the cover; the red pen pulls the tab, then marks the gap ----
  const OFF = (p) => [p[0] + 330, p[1] + 400];
  const mix = (a, z, k) => [a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k];
  const edgeAt = (phi) => PU.proj(EDGE_X, YC + D * Math.cos(rad(phi)), D * Math.sin(rad(phi)));
  const tabTip = (t) => [X0 - TAB_IN - tabOut(t) + 4, TAB_Y + 10];
  const pen = (p, name, lift) => ({ x: p[0], y: p[1], pen: name, col: name === 'red' ? C.RED : C.GRAPHITE, lift: lift });
  function hand(t, act) {
    if (t < IN) return null;
    const e0 = edgeAt(0), under = [e0[0] + 6, e0[1] + 8];
    if (t < DIP) { const k = E.out(SB.seg(t, IN, DIP)); return pen(mix(OFF(e0), under, k), 'pencil', 1 - 0.8 * k); }
    if (t < LIFT) { const k = E.inOut(SB.seg(t, DIP, LIFT)); return pen(mix(under, [e0[0] + 1, e0[1] + 2], k), 'pencil', 0.2 * (1 - k)); }
    if (t < LET) return pen(edgeAt(fold(t)), 'pencil', 0);
    if (t < LET + 0.5) { const k = SB.seg(t, LET, LET + 0.5), r = edgeAt(fold(LET)); return pen(mix(r, OFF(r), E.in(k)), 'pencil', 0.2 + k); }
    if (t < RED_IN) return null;
    const t0 = tabTip(RED_IN);
    if (t < PRESS) { const k = E.out(SB.seg(t, RED_IN, PRESS)); return pen(mix(OFF(t0), t0, k), 'red', 1 - k); }
    if (t < PULLED) return pen(tabTip(t), 'red', 0);
    const tp = tabTip(PULLED);
    if (t < HOVER) return pen(tp, 'red', 0.15 * SB.seg(t, PULLED, HOVER));
    const st = [RED[0].pts[0], RED[0].pts[1]];
    if (t < RED[0].t0) { const k = SB.seg(t, HOVER, RED[0].t0); return pen(mix(tp, st, E.inOut(k)), 'red', 0.15 + Math.sin(Math.PI * k) * 0.8); }
    return SB.penState(RED, t, act);
  }

  SB.defineShot('popup', {
    title: 'Pop-up page', role: 'C',
    note: 'A kraft card taped into the book. The pencil lifts its cover: a MARCH 21 block and a paper sun on a hinged arm rise from the fold, the sun in its pencilled notch. Hold. The red pen pulls the tab: the sun slides off its notch; red loop on the empty notch, arrow along the drift.',
    render: render,
  });
})();

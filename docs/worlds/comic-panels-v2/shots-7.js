/* comic-panels v2 showcase - shot 7: what the alarm meant, as a page in the same comic grammar.
 * Left: the definition (the two codes, one family). Right: the reasoning as a hand-ticked checklist on a
 * clipboard; the last line "ABORT" is struck out and corrected to "GO" in highlighter.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, E, seg, track, layer, halftone, dither, rotPts, clamp01 } = CP;
  const { camera, paper, misFor, panel } = CP.page;

  const PL = [14, 14, 214, 16, 212, 346, 12, 344];
  const PR = [224, 12, 628, 14, 626, 346, 226, 344];
  const CODE1_T = 0.75;
  const CODE2_T = 1.08;
  const BRACKET_T = 1.5;
  const DEF_T = 1.95;
  const ITEMS = [
    { text: 'COMPUTER RESTARTS', tick: 2.85 },
    { text: 'KEY JOBS KEPT', tick: 3.42 },
    { text: 'STILL STEERING', tick: 4.18 },
  ];
  const STRIKE_T = 4.95;
  const GO_T = 5.42;
  const HILITE_T = 5.78;

  /** The clipboard, in its own rotated frame: o = origin on the page, a = angle. */
  function clipboard(t, mis) {
    const ox = 268;
    const oy = 36;
    const ang = -0.032;
    const R = (pts) => rotPts(pts.map((v, i) => v + (i % 2 ? oy : ox)), ox, oy, ang);
    const Rf = (pts) => R(pts).map((v, i) => v + mis[i % 2]);
    const board = [0, 0, 318, 0, 318, 300, 0, 300];
    CP.poly(R(board).map((v) => v + 4), C.INK);
    CP.poly(Rf(board), layer(halftone(C.MOON_D, 0.16, { cell: 3, angle: 1.1 }), C.AGED));
    CP.polyline(R(board), C.INK, 1, true);
    const sheet = [16, 26, 302, 26, 302, 292, 26, 292, 16, 282];
    CP.poly(R(sheet), C.PAPER);
    // Ruled lines and a margin, printed in the faint plates.
    for (let y = 72; y < 286; y += 24) CP.polyline(R([20, y, 298, y]), dither(-1, C.CYAN, 0.5), 1, false);
    CP.polyline(R([52, 30, 52, 288]), dither(-1, C.MAG, 0.6), 1, false);
    // Dog-eared corner.
    CP.poly(R([16, 282, 26, 292, 26, 282]), C.SHADE);
    CP.polyline(R(sheet), C.INK, 1, true);
    // The clip.
    CP.poly(Rf([116, -8, 202, -8, 196, 20, 122, 20]), C.MOON_L);
    CP.poly(R([132, -4, 186, -4, 182, 8, 136, 8]), C.MOON_M);
    CP.polyline(R([116, -8, 202, -8, 196, 20, 122, 20]), C.INK, 1, true);
    const at = (x, y) => R([x, y]);
    // Heading.
    const [hx, hy] = at(60, 38);
    CP.text('hand', 'PROGRAM ALARM', hx, hy, C.INK, { key: 's7head', bold: true, scale: 2, jitter: 2 });
    const [cx, cy] = at(70 + CP.measure('hand', 'PROGRAM ALARM ', 2, true), 38);
    CP.text('hand', '1202', cx, cy, C.RED, { key: 's7headc', bold: true, scale: 2, jitter: 1 });
    // Items, ticked one by one in pencil, each tick a little different.
    ITEMS.forEach((it, i) => {
      const [bx, by] = at(28, 80 + i * 48);
      CP.polyline([bx, by, bx + 14, by, bx + 14, by + 14, bx, by + 14], C.INK, 1, true);
      const [tx, ty] = at(60, 81 + i * 48);
      CP.text('hand', it.text, tx, ty, C.INK, { key: 's7i' + i, bold: true, scale: 2, jitter: 2 });
      if (t >= it.tick) CP.tick(bx + 2, by + 7, seg(t, it.tick, it.tick + 0.16, E.inQuad), C.PENCIL, 's7t' + i);
    });
    // The last line: ABORT, struck out, corrected to GO.
    const [bx, by] = at(28, 224);
    CP.polyline([bx, by, bx + 14, by, bx + 14, by + 14, bx, by + 14], C.INK, 1, true);
    const [ax, ay] = at(60, 225);
    const goAt = at(150, 219);
    if (t >= HILITE_T) CP.highlighter(goAt[0] - 6, goAt[1] - 3, goAt[0] + 44, goAt[1] + 18, seg(t, HILITE_T, HILITE_T + 0.22, E.outQuad), C.YEL, 's7hl');
    CP.text('hand', 'ABORT', ax, ay, C.INK, { key: 's7abort', bold: true, scale: 2, jitter: 2 });
    if (t >= STRIKE_T) CP.strike(ax, ay + 7, ax + CP.measure('hand', 'ABORT', 2, true), seg(t, STRIKE_T, STRIKE_T + 0.3, E.linear), C.INK, 's7strike');
    if (t >= GO_T) {
      const n = Math.floor(track([[GO_T, 0], [GO_T + 0.1, 1, E.linear], [GO_T + 0.26, 2.99, E.outQuad]], t));
      CP.text('hand', 'GO', goAt[0], goAt[1], C.INK, { key: 's7go', bold: true, scale: 3, jitter: 2, reveal: n, slant: 1 });
    }
    CP.thumbprint(at(276, 262)[0], at(276, 262)[1], 's7thumb', C.SHADE);
  }

  function definition(t, mis) {
    const K = new CP.Xf(1, 0, 0);
    const F = K.shift(mis[0], mis[1]);
    F.rect(0, 0, 230, 360, layer(halftone(C.CYAN_D, (x, y) => 0.18 + 0.2 * clamp01((y - 40) / 300), { cell: 4, angle: 0.26 }), C.NIGHT));
    const slam = (t0, ch, x, y, size, rot, key) => {
      if (t < t0) return;
      const k = track([[t0, 1.6], [t0 + 0.08, 0.93, E.outQuad], [t0 + 0.16, 1, E.inOutSine]], t);
      const fill = layer(halftone(C.INK, (px, py) => 0.5 * clamp01((py - y - 2) / (size * 5)), { cell: 3, angle: 0.78 }), C.RED);
      CP.bigLetter(ch, x, y, size * k, rot, fill, { key, outline: 2, extrude: [2, 3], mis: [1, -1] });
    };
    [0, 1, 2, 3].forEach((i) => slam(CODE1_T + [0, 0.05, 0.12, 0.16][i], '1202'[i], 46 + i * 40, 74 + (i % 2) * 4, 5, [-0.08, 0.05, -0.03, 0.09][i], 's7a' + i));
    [0, 1, 2, 3].forEach((i) => slam(CODE2_T + [0, 0.06, 0.1, 0.17][i], '1201'[i], 60 + i * 30, 150 - (i % 2) * 3, 3.6, [0.06, -0.05, 0.04, -0.08][i], 's7b' + i));
    // Pencil bracket tying the two codes together, and its note.
    if (t >= BRACKET_T) {
      const p = seg(t, BRACKET_T, BRACKET_T + 0.3, E.inOutSine);
      CP.strokeOn(CP.boil([26, 52, 20, 56, 20, 106, 14, 112, 20, 118, 20, 166, 27, 170], 's7br', 0.4), p, C.MOON_L, 1);
      if (t >= BRACKET_T + 0.32) CP.text('hand', 'SAME FAMILY', 40, 188, C.PAPER, { key: 's7fam', bold: true, slant: 1, jitter: 1.4, reveal: Math.floor(seg(t, BRACKET_T + 0.32, BRACKET_T + 0.7) * 11.99) });
    }
    if (t >= DEF_T) {
      const dy = Math.round(-4 * (1 - seg(t, DEF_T, DEF_T + 0.14, E.outQuad)));
      CP.caption(['EXECUTIVE OVERFLOW:', 'NO ROOM LEFT', 'FOR NEW JOBS.'], 28, 250 + dy, { key: 's7def', tilt: -1 });
    }
  }

  function shot7(t) {
    const P = camera(320, 180, 1);
    paper(P, 'p7');
    panel(P, PL, 's7l', () => definition(t, misFor('s7l')));
    panel(P, PR, 's7r', () => {
      CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.CYAN_D, 0.22, { cell: 4, angle: 0.4 }), C.CYAN));
      clipboard(t, misFor('s7r'));
    });
    CP.smudge(219, 330, 7, 1.7, 's7smudge');
    return null;
  }

  CP.SHOTS[6] = {
    title: 'alarm explained',
    dur: 8,
    render: shot7,
    transIn: { kind: 'collapse', dur: 0.5, y: 196 },
    narration: 'So what did 1202 mean? Executive overflow: no room left for new jobs. But the computer restarts, keeps the key jobs and is still steering. Not abort. Go.',
    note: 'the explainer is still a comic page: the codes slammed like sound effects on the left, the reasoning as a hand-ticked checklist on the right, and the one correction that matters.',
  };
})();

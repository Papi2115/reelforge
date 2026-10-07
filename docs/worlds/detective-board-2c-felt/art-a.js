/* detective-board 2c "felt" - cluster A items: the ticket, the man, the 727, briefcase, cash, parachutes.
 * Felt cut-outs and paper labels, drawn procedurally in item space. */
(function () {
  'use strict';
  const F = window.FELT;
  const C = F.C;
  const K = F.K;
  const L = F.L;
  const A = (F.A = {});

  // ------------------------------------------------------------ the ticket (torn stub edge on the right)
  A.TICKET = { name: [-76, 27], k0: [-79, 38.5], u1: [-14, 38.5] };
  A.ticket = function () {
    const it = L.ticket;
    const shape = K.tornRect('ticket', 168, 108, 4.5, 5, 11, 'r');
    K.pc(it, shape, 0, 0, { col: C.CREAM, tex: 'paper', lift: 1.3, seed: 21 });
    const ink = C.INK;
    K.tx(it, 'NORTHWEST ORIENT', -76, -44, 1, ink, { seed: 3 });
    K.tx(it, 'FLIGHT 305', -76, -32, 1, ink, { seed: 4 });
    K.tx(it, 'PORTLAND-SEATTLE', -76, -20, 1, ink, { seed: 5 });
    K.tx(it, 'NOV 24 1971', -75, -8, 1, ink, { seed: 6 });
    K.tx(it, 'PASSENGER', -76, 15, 1, C.CREAM_S, { seed: 7, jump: false });
    K.tx(it, 'DAN COOPER', -76, 27, 1, ink, { seed: 8 });
    // printed rule under the airline name, a little crooked
    K.stitches(it, [[-76, -35.5, 18, -35.8]], 0.32, { c: C.CREAM_S, hi: C.CREAM_S, lo: C.CREAM_S }, undefined, { minR: 0.5 });
    // rust running stitch holding the paper to the linen (left, top, bottom; the torn edge is left free)
    const run = K.run('ticket-run', [[66, -49], [-79, -49], [-79, 49], [66, 49]], 4.2, 3.1, 31, false);
    K.stitches(it, run, 0.55, K.RUSTT, undefined, { shadow: 0.4 });
  };

  // ------------------------------------------------------------ the man in the dark suit (anonymous silhouette)
  A.MAN = { k1: [-22, 30] };
  const manBody = F.poly([[-68, 96], [-66, 44], [-60, 24], [-46, 12], [-26, 5], [-13, 0], [13, 0], [25, 5], [45, 11], [59, 22], [66, 40], [70, 96]]);
  const manHead = F.union([{ s: F.ell(24, 30), x: 0, y: 0 }, { s: F.ell(4.5, 7), x: -23.5, y: -1 }, { s: F.ell(4.5, 7), x: 24, y: 0 }]);
  const manHair = F.poly([[-25, -8], [-23, -22], [-12, -31], [4, -32], [19, -26], [26, -10], [20, -16], [3, -20], [-14, -17]]);
  const shirt = F.poly([[-12, 0], [12, 0], [1, 36]]);
  const tie = F.poly([[-4, 6], [4, 6], [6, 38], [0, 47], [-6, 38]]);
  const tieKnot = F.poly([[-5, 0], [5, 0], [4, 7], [-4, 7]]);
  const lens = F.rect(15, 9, 3);
  A.man = function () {
    const it = L.man;
    K.pc(it, manBody, 0, 0, { col: C.NIGHT, light: C.NIGHT_L, lift: 2.4, seed: 41 });
    K.pc(it, shirt, 0, 0, { col: C.CREAM, lift: 0, thick: 0, fuzz: 0.5, seed: 42, tex: 'flat' });
    K.pc(it, tieKnot, 0, 0, { col: C.INK, lift: 0.6, thick: 0.5, seed: 43, light: C.NIGHT });
    K.pc(it, tie, 0, 0, { col: C.INK, lift: 0.8, seed: 44, light: C.NIGHT });
    // lapel seams, dark thread
    const lapL = K.run('lapL', [[-13, 1], [-25, 30], [-6, 46]], 3.2, 2.2, 45, false);
    const lapR = K.run('lapR', [[13, 1], [24, 27], [7, 44]], 3.4, 2.4, 46, false);
    K.stitches(it, lapL, 0.5, K.DARKT);
    K.stitches(it, lapR, 0.5, K.DARKT);
    K.pc(it, manHead, 1, -29, { col: C.NIGHT, light: C.NIGHT_L, lift: 1.8, seed: 47 });
    K.pc(it, manHair, 1, -29, { col: C.INK, light: C.NIGHT, lift: 0.8, seed: 48 });
    K.pc(it, lens, -10, -31, { col: C.INK, lift: 0.7, thick: 0.4, seed: 49, tex: 'flat', fuzz: 0.25, rot: 0.04 });
    K.pc(it, lens, 12, -30, { col: C.INK, lift: 0.7, thick: 0.4, seed: 50, tex: 'flat', fuzz: 0.25, rot: -0.03 });
    K.stitches(it, [[-2.5, -31.5, 4.5, -31]], 0.6, { c: C.INK, hi: C.INK, lo: C.INK });
    // one cream stitch on each lens: the glint
    K.stitches(it, [[-14, -33.5, -11, -34.5], [8.5, -32.6, 11.2, -33.4]], 0.55, K.CREAM);
  };

  // ------------------------------------------------------------ Boeing 727 (side view, nose right, T-tail)
  const P = {
    fus: F.poly([[-124, -7], [-112, -10], [-90, -11], [60, -12], [86, -11], [100, -9], [110, -6], [117, -2], [121, 2], [118, 6], [110, 9], [94, 11], [-60, 11], [-84, 10], [-104, 6], [-118, 1], [-125, -3]]),
    fin: F.poly([[-74, -9], [-97, -47], [-112, -58], [-125, -58], [-119, -40], [-113, -9]]),
    stab: F.poly([[-134, -62], [-102, -61], [-96, -57], [-131, -56]]),
    intake: F.ell(10, 4.5),
    nacelle: F.rect(38, 10, 4.5),
    wing: F.poly([[22, 6], [-10, 6], [-46, 23], [-35, 24], [-2, 14], [17, 12]]),
    cockpit: F.poly([[99, -7], [107, -5.5], [109, -2.5], [99, -3]]),
    stair: F.rect(26, 3.2, 1),
  };
  /** it: transform; stair 0 = closed, 1 = fully lowered. */
  A.plane = function (it, stair, seed) {
    const sd = seed || 60;
    const felt = { col: C.STEEL, light: C.WHITE, seed: sd, fibreLight: 0.1, fibreDensity: 0.2 };
    K.pc(it, P.stab, 0, 0, Object.assign({}, felt, { lift: 1.6, seed: sd + 1 }));
    K.pc(it, P.fin, 0, 0, Object.assign({}, felt, { lift: 1.6, seed: sd + 2 }));
    // lowered stair hangs under the tail (drawn below the fuselage)
    if (stair > 0) {
      const a = 0.95 * stair;
      const hx = -96;
      const hy = 9;
      const cu = Math.cos(Math.PI - a);
      const sv = Math.sin(Math.PI - a);
      K.pc(it, P.stair, hx + cu * 13, hy + sv * 13, { col: C.STEEL_S, lift: 1.2, seed: sd + 3, rot: -a, fuzz: 0.5 });
    }
    K.pc(it, P.fus, 0, 0, Object.assign({}, felt, { lift: 2.2, seed: sd + 4 }));
    K.pc(it, P.intake, -82, -12, { col: C.STEEL_S, lift: 0.8, seed: sd + 5 });
    K.pc(it, P.nacelle, -95, -2.5, { col: C.STEEL_S, lift: 1.1, seed: sd + 6 });
    K.pc(it, P.wing, 0, 0, Object.assign({}, felt, { lift: 1.4, seed: sd + 7 }));
    K.pc(it, P.cockpit, 0, 0, { col: C.NIGHT, lift: 0, thick: 0, fuzz: 0.2, tex: 'flat', seed: sd + 8 });
    const win = K.cached('plane-win', () => {
      const rnd = F.prng(77);
      const out = [];
      for (let u = -62; u < 88; u += 6.6 + rnd() * 1.4) out.push([u, -3.8 + (rnd() - 0.5) * 0.7, u + 2.6, -3.8 + (rnd() - 0.5) * 0.7]);
      return out;
    });
    K.stitches(it, win, 0.75, K.INKK);
    if (stair <= 0) K.stitches(it, [[-118, 8.3, -97, 9.6]], 0.45, { c: C.STEEL_S, hi: C.STEEL_S, lo: C.STEEL_S });
  };

  // ------------------------------------------------------------ briefcase with a woven label
  A.BRIEF = { k2: [0, -63] };
  const brief = {
    body: F.rect(132, 86, 7),
    handle: F.poly([[-24, -42], [-22, -60], [-14, -66], [14, -66], [22, -60], [24, -42], [17, -42], [16, -55], [11, -59], [-11, -59], [-16, -55], [-17, -42]]),
    clasp: F.rect(13, 8, 1.5),
    tape: F.rect(104, 16, 1),
  };
  A.briefcase = function () {
    const it = L.briefcase;
    K.pc(it, brief.handle, 0, 0, { col: C.RUST_S, light: C.RUST, lift: 1.4, seed: 81 });
    K.pc(it, brief.body, 0, 0, { col: C.RUST, light: C.MUST, lift: 2.6, seed: 82 });
    const seam = K.run('brief-seam', K.rectPts(120, 74), 4.6, 2.8, 83, true);
    K.stitches(it, seam, 0.55, K.CREAM, undefined, { shadow: 0.3 });
    K.pc(it, brief.clasp, -38, -36, { col: C.MUST, lift: 0.9, seed: 84, tex: 'flat', fuzz: 0.3 });
    K.pc(it, brief.clasp, 39, -35, { col: C.MUST, lift: 0.9, seed: 85, tex: 'flat', fuzz: 0.3 });
    const tape = { x: K.xf(it, -5, 17)[0], y: K.xf(it, -5, 17)[1], rot: it.rot - 0.05 };
    K.pc(tape, brief.tape, 0, 0, { col: C.CREAM, tex: 'tape', lift: 0.9, seed: 86 });
    K.tx(tape, 'A BOMB, HE SAID', -45, -3.5, 1, C.INK, { seed: 87 });
    K.stitches(tape, [[-50, -6, -49.4, 6], [-47, -6.5, -47.5, 5.8], [49, -6, 49.6, 6.2]], 0.5, K.RUSTT);
  };

  // ------------------------------------------------------------ $200,000: three bank notes and a paper band
  A.CASH = { k3: [1, -20] };
  const bill = F.rect(92, 42, 2);
  const band = F.rect(15, 47, 0.5);
  A.cash = function () {
    const it = L.cash;
    K.pc(it, bill, -5, -7, { col: C.SAGE, light: C.CREAM_S, lift: 1.2, seed: 91, rot: -0.05 });
    K.pc(it, bill, 4, -2, { col: C.SAGE, light: C.CREAM_S, lift: 1.2, seed: 92, rot: 0.04 });
    K.pc(it, bill, 0, 3, { col: C.SAGE, light: C.CREAM_S, lift: 1.3, seed: 93 });
    const top = { x: K.xf(it, 0, 3)[0], y: K.xf(it, 0, 3)[1], rot: it.rot };
    const frame = K.run('bill-frame', K.rectPts(80, 30), 3.2, 1.9, 94, true);
    K.stitches(top, frame, 0.45, { c: C.SAGE_S, hi: C.SAGE_S, lo: C.SAGE_S });
    const oval = K.cached('bill-oval', () => {
      const pts = [];
      for (let k = 0; k < 14; k++) pts.push([Math.cos((k / 14) * Math.PI * 2) * 9, Math.sin((k / 14) * Math.PI * 2) * 10]);
      return pts;
    });
    K.stitches(top, K.run('bill-ovalrun', oval, 2.6, 1.7, 95, true), 0.45, { c: C.SAGE_S, hi: C.SAGE_S, lo: C.SAGE_S });
    K.pc(it, band, 1, 3, { col: C.MUST, light: C.CREAM, lift: 0.8, seed: 96, tex: 'paper', rot: 0.03 });
  };

  // ------------------------------------------------------------ parachute (canopy, gores, lines, pack)
  const canopy = K.cached('canopy', () => {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = Math.PI + (k / 16) * Math.PI;
      pts.push([Math.cos(a) * 19, Math.sin(a) * 15]);
    }
    // scalloped hem, right to left
    for (let k = 1; k < 6; k++) pts.push([19 - k * 6.33, k % 2 ? 3 : 0.6]);
    return F.poly(pts);
  });
  const pack = F.rect(9, 8, 1.5);
  A.CHUTE = { pack: [0, 26] };
  /** it with lift from K.land */
  A.chute = function (it, seed) {
    const sd = seed || 100;
    const lines = [[-18, 1.5, 0, 22], [-7, 2.5, 0, 22], [7, 2.5, 0, 22], [18, 1.5, 0, 22]];
    K.stitches(it, lines, 0.32, K.CREAM, undefined, { minR: 0.5 });
    K.pc(it, pack, 0, 26, { col: C.RUST_S, light: C.RUST, lift: 0.8 + Math.max(0, it.lift || 0) * 0.5, seed: sd + 1 });
    K.pc(it, canopy, 0, 0, { col: C.TEAL, light: C.TEAL_L, lift: 1.6 + (it.lift || 0), seed: sd + 2 });
    const gores = [[0, -14.5, -8, 1.5], [0, -14.5, 8, 1.5]];
    K.stitches(it, gores, 0.42, K.TEALT);
  };
})();

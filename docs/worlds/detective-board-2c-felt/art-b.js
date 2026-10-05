/* detective-board 2c "felt" - clusters B..E: the felt map, the button-magnifier, theory scraps, suspects,
 * the Columbia River bank, the 2016 tag. Geography on the map is lon/lat projected (F.geo), simplified. */
(function () {
  'use strict';
  const F = window.FELT;
  const C = F.C;
  const K = F.K;
  const L = F.L;
  const A = F.A;
  const G = F.geo;
  const TEAL3 = { c: C.TEAL, hi: C.TEAL_L, lo: C.TEAL_S };

  // ------------------------------------------------------------ the map
  const coast = [[-124.7, 48.3], [-124.6, 48.0], [-124.35, 47.6], [-124.15, 47.2], [-124.1, 46.98], [-123.86, 46.96], [-123.98, 46.88], [-124.06, 46.7], [-124.05, 46.35], [-123.98, 46.25], [-123.93, 46.18], [-123.95, 45.9], [-123.97, 45.5], [-124.05, 45.0], [-124.1, 44.7]];
  const M = {
    base: K.pinked('map-base', 350, 300, 7),
    sea: F.poly([[-170, -146], [-34, -146], [-36, -128], [-62, -121], [-95, -124], [-121, -131]].concat(coast.map((p) => G(p[0], p[1]))).concat([[-170, 146]]), [-168, -40, -94, 140]),
    sound: F.poly([[-40, -146], [-12, -146], [-4, -128], [4, -112], [6, -96], [3, -84], [5, -70], [0, -58], [-8, -50], [-16, -40], [-21, -42], [-13, -52], [-8, -62], [-6, -74], [-10, -88], [-6, -98], [-12, -104], [-16, -94], [-20, -100], [-14, -114], [-24, -124], [-34, -128]]),
    columbia: [[170, 54], [120, 70], [80, 76], [33, 72], [0, 76], [-9, 78], [-16, 62], [-21, 40], [-44, 34], [-66, 32], [-81, 30]],
    seattle: G(-122.33, 47.61),
    portland: G(-122.68, 45.52),
    north: [[-9.9, 86.4], [-17, 50], [-14, 2], [-4, -45], [9.4, -80.8]],
    south: [[9.4, -80.8], [20, -52], [27, -31], [46, 6], [72, 46], [100, 94], [122, 142], [136, 166]],
    tape: F.rect(50, 13, 1),
    tapeP: F.rect(57, 13, 1),
    tapeR: F.rect(62, 13, 1),
    tapeM: F.rect(74, 14, 1),
  };
  A.MAP = { seattle: M.seattle, jump: [27, -31], jet: [74, 42], stub: [-150, -100] };
  /** southStitches: how many stitches of the southbound route are sewn. stair 0..1. */
  A.map = function (southCount, stair) {
    const it = L.map;
    K.pc(it, M.base, 0, 0, { col: C.MUST, light: C.CREAM, lift: 2.2, seed: 201, fibreDensity: 0.2, fibreLight: 0.2 });
    K.pc(it, M.sea, 0, 0, { col: C.TEAL, light: C.TEAL_L, lift: 0.9, thick: 0.5, seed: 202 });
    K.pc(it, M.sound, 0, 0, { col: C.TEAL, light: C.TEAL_L, lift: 0.7, thick: 0.4, seed: 203 });
    const col = K.cached('columbia-pts', () => M.columbia);
    const pts = [];
    for (const p of col) pts.push(...K.xf(it, p[0], p[1]));
    F.stroke(pts, 1.7, TEAL3, { minR: 0.7 });
    const north = K.run('route-n', M.north, 4.2, 3.4, 204, false);
    K.stitches(it, north, 0.6, K.RUSTT, undefined, { shadow: 0.35 });
    const south = K.run('route-s', M.south, 4.4, 3.2, 205, false);
    if (southCount > 0) K.stitches(it, south, 0.6, K.RUSTT, southCount, { shadow: 0.35 });
    for (const c of [M.seattle, M.portland]) {
      const w = K.xf(it, c[0], c[1]);
      F.knot(w[0], w[1], 2.4, K.INKK, { shadow: 0.6, minR: 1 });
    }
    const tS = { x: K.xf(it, 44, -92)[0], y: K.xf(it, 44, -92)[1], rot: it.rot - 0.04 };
    K.pc(tS, M.tape, 0, 0, { col: C.CREAM, tex: 'tape', lift: 0.8, seed: 206 });
    K.tx(tS, 'SEATTLE', -20.5, -3.5, 1, C.INK, { seed: 207 });
    const tP = { x: K.xf(it, 46, 104)[0], y: K.xf(it, 46, 104)[1], rot: it.rot + 0.05 };
    K.pc(tP, M.tapeP, 0, 0, { col: C.CREAM, tex: 'tape', lift: 0.8, seed: 208 });
    K.tx(tP, 'PORTLAND', -23.5, -3.5, 1, C.INK, { seed: 209 });
    const tR = { x: K.xf(it, 66, -60)[0], y: K.xf(it, 66, -60)[1], rot: it.rot - 0.08 };
    K.pc(tR, M.tapeR, 0, 0, { col: C.CREAM, tex: 'tape', lift: 1, seed: 210 });
    K.tx(tR, 'REFUELLED', -26.5, -3.5, 1, C.INK, { seed: 211 });
    // sewing pin through the refuel tape
    const pa = K.xf(tR, 26, -8);
    const pb = K.xf(tR, 8, 9);
    F.stroke([pa[0], pa[1], pb[0], pb[1]], 0.35, { c: C.STEEL, hi: C.WHITE, lo: C.STEEL_S }, { minR: 0.5, shadow: 0.8 });
    F.knot(pa[0], pa[1], 2.3, K.MUSTT, { shadow: 1.2, minR: 1 });
    // the torn ticket stub
    const stub = { x: K.xf(it, A.MAP.stub[0], A.MAP.stub[1])[0], y: K.xf(it, A.MAP.stub[0], A.MAP.stub[1])[1], rot: it.rot + 0.13 };
    K.pc(stub, K.tornRect('stub', 50, 30, 3.5, 4, 212, 'l'), 0, 0, { col: C.CREAM, tex: 'paper', lift: 1.2, seed: 213 });
    K.tx(stub, '305', -14, -7, 2, C.INK, { seed: 214, jump: false });
    K.stitches(stub, [[17, -12, 21, -8], [21, -12, 17, -8], [17, 8, 21, 12], [21, 8, 17, 12]], 0.45, K.RUSTT);
    // the small jet seen from above, nose south; its aft stair extends behind the tail when lowered
    A.topJet({ x: K.xf(it, A.MAP.jet[0], A.MAP.jet[1])[0], y: K.xf(it, A.MAP.jet[0], A.MAP.jet[1])[1], rot: it.rot - 0.62 }, stair);
    const tM = { x: K.xf(it, 150, 180)[0], y: K.xf(it, 150, 180)[1], rot: it.rot + 0.03 };
    if (southCount >= south.length) {
      K.pc(tM, M.tapeM, 0, 0, { col: C.CREAM, tex: 'tape', lift: 0.9, seed: 215 });
      K.tx(tM, 'MEXICO CITY', -32.5, -3.5, 1, C.INK, { seed: 216 });
    }
  };
  const JET = {
    body: F.rect(7, 62, 3.5),
    wing: F.poly([[-3, 8], [-27, -9], [-27, -13.5], [-3, -3], [3, -3], [27, -13.5], [27, -9], [3, 8]]),
    stab: F.poly([[-1.5, -25], [-11, -33], [-11, -35.5], [0, -31.5], [11, -35.5], [11, -33], [1.5, -25]]),
    pod: F.rect(3.4, 10, 1.6),
    stair: F.rect(5, 13, 0.8),
  };
  A.JET_TAIL = [0, -31];
  /** Top-down 727 (nose +v). stair 0..1 slides the lowered aft stair out behind the tail. */
  A.topJet = function (it, stair) {
    const felt = { col: C.STEEL, light: C.WHITE, fibreLight: 0.1, fibreDensity: 0.2 };
    if (stair > 0.02) {
      const sv = -31 - 6.5 * stair;
      K.pc(it, JET.stair, 0, sv, Object.assign({}, felt, { col: C.STEEL_S, lift: 1.4, seed: 236, fibre: false }));
      const rungs = [];
      for (let k = 0; k < 4; k++) rungs.push([-2, sv - 4.8 + k * 3.1, 2, sv - 4.8 + k * 3.1 + 0.2]);
      K.stitches(it, rungs, 0.42, K.CREAM);
    }
    K.pc(it, JET.wing, 0, 0, Object.assign({}, felt, { lift: 1.6, seed: 231 }));
    K.pc(it, JET.pod, -5.6, -19, Object.assign({}, felt, { col: C.STEEL_S, lift: 0.8, seed: 232 }));
    K.pc(it, JET.pod, 5.6, -19, Object.assign({}, felt, { col: C.STEEL_S, lift: 0.8, seed: 233 }));
    K.pc(it, JET.body, 0, 0, Object.assign({}, felt, { lift: 1.8, seed: 234 }));
    K.pc(it, JET.stab, 0, 0, Object.assign({}, felt, { lift: 1.2, seed: 235 }));
    K.stitches(it, [[0, -22, 0, -28.5], [-0.6, 24, 0.6, 27.5]], 0.5, K.INKK);
  };
  A.mapSouthTotal = () => K.run('route-s', M.south, 4.4, 3.2, 205, false).length;
  /** Local map point at a fraction along the southbound route. */
  A.mapSouthAt = function (k) {
    const s = M.south;
    let total = 0;
    const seg = [];
    for (let i = 0; i < s.length - 1; i++) {
      const l = Math.hypot(s[i + 1][0] - s[i][0], s[i + 1][1] - s[i][1]);
      seg.push(l);
      total += l;
    }
    let d = k * total;
    let i = 0;
    while (i < seg.length - 1 && d > seg[i]) {
      d -= seg[i];
      i++;
    }
    const f = d / seg[i];
    return [s[i][0] + (s[i + 1][0] - s[i][0]) * f, s[i][1] + (s[i + 1][1] - s[i][1]) * f];
  };

  // ------------------------------------------------------------ button-magnifier (rim + handle; lens content in film.js)
  const rim = F.ring(34, 40);
  const rimHoles = [[-3.5, -37], [3.5, -37]];
  const handle = F.rect(11, 50, 3);
  A.LENS_R = 34;
  A.lens = function (x, y, lift) {
    const it = { x, y, rot: 0 };
    const h = { x: x + 48, y: y + 48, rot: -Math.PI / 4 };
    K.pc(h, handle, 0, 0, { col: C.RUST_S, light: C.RUST, lift: 2.5 + lift, seed: 241 });
    const wrap = [[-5.5, -12, 5.5, -9], [-5.5, -6, 5.5, -3], [-5.5, 0, 5.5, 3], [-5.5, 6, 5.5, 9]];
    K.stitches(h, wrap, 0.6, K.CREAM);
    K.pc(it, rim, 0, 0, { col: C.MUST, light: C.CREAM, lift: 3 + lift, seed: 242, tex: 'flat', fuzz: 0.25, thick: 1.2 });
    for (const p of rimHoles) {
      const w = K.xf(it, p[0], p[1]);
      F.knot(w[0], w[1], 0.9, { c: C.MUST_S, hi: C.MUST_S, lo: C.RUST_S }, { shadow: 0, minR: 0.5 });
    }
    const g = [[-24, -15, -16, -23], [-27, -5, -26, -10]];
    K.stitches(it, g, 0.7, { c: C.WHITE, hi: C.WHITE, lo: C.CREAM });
  };

  // ------------------------------------------------------------ theory scraps
  A.scrap = function (it, key, text, seed) {
    const w = F.textWidth(text, 2) + 18;
    K.pc(it, K.tornRect(key, w, 30, 3.5, 5, seed, 'tlbr'), 0, 0, { col: C.CREAM, tex: 'paper', lift: 1.6 + (it.lift || 0), seed });
    K.tx(it, text, -w / 2 + 9, -7, 2, C.INK, { seed: seed + 1 });
  };

  // ------------------------------------------------------------ suspects: mugshot cards with stitched height lines
  const bust = F.poly([[-33, 44], [-31, 16], [-22, 5], [-9, 1], [9, 1], [22, 5], [31, 16], [34, 44]]);
  const sHead = F.ell(15, 18);
  const hatBrim = F.rect(42, 5, 2);
  const hatCrown = F.rect(26, 14, 3);
  const partHair = F.poly([[-16, -8], [-14, -18], [-4, -22], [10, -21], [17, -12], [16, -4], [9, -13], [-3, -15], [-11, -11]]);
  const card = F.rect(84, 106, 1.5);
  /** Card-local knot points (where theory / main threads end). */
  A.SUSPECT_KNOTS = [[30, -42], [31, 30], [33, -12]];
  A.suspect = function (it, i) {
    const s = L.suspects[i];
    const col = C[s.col];
    K.pc(it, K.tornRect('card' + i, 84, 106, 2, 6, 290 + i, i === 1 ? 'b' : 'r'), 0, 0, { col: C.CREAM, tex: 'paper', lift: 1.4 + (it.lift || 0), seed: 291 + i * 3 });
    const lines = [];
    for (let k = 0; k < 5; k++) lines.push([-36, -40 + k * 15 + (k === 3 ? 0.6 : 0), 36, -40 + k * 15 - (k === 1 ? 0.5 : 0)]);
    K.stitches(it, lines, 0.28, { c: C.CREAM_S, hi: C.CREAM_S, lo: C.CREAM_S }, undefined, { minR: 0.5 });
    const b = { x: K.xf(it, 0, 14)[0], y: K.xf(it, 0, 14)[1], rot: it.rot, scale: 0.84 * (it.scale || 1) };
    K.pc(b, bust, 0, 0, { col, lift: 1.2, seed: 260 + i * 5, fuzz: 0.6 });
    K.pc(b, sHead, 0, -18, { col, lift: 1.4, seed: 261 + i * 5, fuzz: 0.6 });
    if (s.kind === 'hat') {
      K.pc(b, hatCrown, 1, -38, { col: C.NIGHT, light: C.NIGHT_L, lift: 1, seed: 262 });
      K.pc(b, hatBrim, 0, -31, { col: C.NIGHT, light: C.NIGHT_L, lift: 1.2, seed: 263, rot: -0.04 });
    } else if (s.kind === 'part') K.pc(b, partHair, 0, -18, { col: C.NIGHT, light: C.NIGHT_L, lift: 0.8, seed: 272 });
    if (i === 1) K.stitches(it, [[36, 47, 40, 52]], 0.45, K.CREAM);
    if (i === 0) {
      const tp = { x: K.xf(it, -2, 44)[0], y: K.xf(it, -2, 44)[1], rot: it.rot + 0.03 };
      K.pc(tp, F.rect(52, 12, 1), 0, 0, { col: C.CREAM, tex: 'tape', lift: 0.8, seed: 299 });
      K.tx(tp, 'SUSPECT', -20.5, -3.5, 1, C.INK, { seed: 298 });
    }
  };

  // ------------------------------------------------------------ the Columbia River bank, 1980
  const RV = K.cached('river', () => {
    const top = [];
    const bot = [];
    for (let u = -300; u <= 300; u += 15) {
      top.push([u, -30 + 4 * Math.sin(u * 0.03) + (u % 45 === 0 ? 1.5 : 0)]);
      bot.push([u, 36 + 3 * Math.sin(u * 0.021 + 1)]);
    }
    const sand = [];
    const sbot = [];
    for (let u = -250; u <= 250; u += 14) {
      sand.push([u, -64 + 6 * Math.sin(u * 0.02 + 0.5) + (u > 20 && u < 90 ? -4 : 0)]);
      sbot.push([u, -24 + 3 * Math.sin(u * 0.05)]);
    }
    const ripples = [];
    for (let r = 0; r < 4; r++) {
      const pts = [];
      const u0 = -260 + r * 37;
      for (let u = u0; u < u0 + 150 + r * 60; u += 9) pts.push([u, -10 + r * 10 + 2.2 * Math.sin(u * 0.09 + r)]);
      ripples.push(pts);
    }
    return {
      water: F.poly(top.concat(bot.reverse()), [-286, -24, 286, 32]),
      sand: F.poly(sand.concat(sbot.reverse()), [-238, -56, 238, -28]),
      ripples,
      lip: F.poly([[22, -34], [36, -41], [52, -38], [70, -42], [82, -35], [76, -29], [28, -29]]),
    };
  });
  const note = F.rect(30, 15, 1);
  const boy = {
    torso: F.poly([[-6, -24], [7, -26], [12, -6], [-4, -2]]),
    leg: F.poly([[-6, -6], [12, -8], [15, 2], [-10, 4]]),
    arm: F.poly([[6, -22], [22, -10], [20, -6], [4, -17]]),
    head: F.ell(7, 8),
    hair: F.poly([[-7, -3], [-5, -8], [3, -9], [8, -4], [2, -5]]),
  };
  A.RIVER = { k7: [52, -44] };
  A.river = function () {
    const it = L.river;
    K.pc(it, RV.water, 0, 0, { col: C.TEAL, light: C.TEAL_L, lift: 1.2, seed: 301 });
    RV.ripples.forEach((pts, r) => K.stitches(it, K.run('rip' + r, pts, 5, 3.5, 302 + r, false), 0.55, K.TEALT));
    K.pc(it, RV.sand, 0, 0, { col: C.MUST, light: C.CREAM, lift: 1.8, seed: 306 });
    for (const [du, dv, r, sd] of [[40, -45, -0.18, 307], [58, -47, 0.1, 308], [49, -41, -0.05, 309]]) {
      K.pc(it, note, du, dv, { col: C.SAGE, light: C.CREAM_S, lift: 1, seed: sd, rot: r, fibreDensity: 0.15 });
      const n = { x: K.xf(it, du, dv)[0], y: K.xf(it, du, dv)[1], rot: it.rot + r };
      K.stitches(n, K.run('note-fr', K.rectPts(24, 11), 2.2, 1.3, 318, true), 0.3, { c: C.SAGE_S, hi: C.SAGE_S, lo: C.SAGE_S }, undefined, { minR: 0.5 });
    }
    K.pc(it, RV.lip, 0, 0, { col: C.MUST, light: C.CREAM, lift: 0.8, seed: 310 });
    // the boy, kneeling at the water's edge (anonymous felt figure)
    const b = { x: K.xf(it, -64, -66)[0], y: K.xf(it, -64, -66)[1], rot: it.rot };
    K.pc(b, boy.leg, 0, 0, { col: C.NIGHT_L, light: C.LIN1, lift: 1.2, seed: 311 });
    K.pc(b, boy.torso, 0, 0, { col: C.RUST, light: C.MUST, lift: 1.4, seed: 312 });
    K.pc(b, boy.arm, 0, 0, { col: C.RUST, light: C.MUST, lift: 1, seed: 313 });
    K.pc(b, boy.head, 2, -32, { col: C.CREAM_S, light: C.CREAM, lift: 1.1, seed: 314 });
    K.pc(b, boy.hair, 2, -32, { col: C.NIGHT, light: C.NIGHT_L, lift: 0.5, seed: 315 });
    const tC = { x: K.xf(it, 150, 10)[0], y: K.xf(it, 150, 10)[1], rot: it.rot - 0.05 };
    K.pc(tC, F.rect(92, 13, 1), 0, 0, { col: C.CREAM, tex: 'tape', lift: 0.9, seed: 316 });
    K.tx(tC, 'COLUMBIA RIVER', -41.5, -3.5, 1, C.INK, { seed: 317 });
  };

  // ------------------------------------------------------------ the 2016 tag, blanket-stitched in teal
  const tagShape = F.rect(150, 72, 3);
  A.TAG = { k8: [-71, 2] };
  A.tag = function (it) {
    K.pc(it, tagShape, 0, 0, { col: C.CREAM, tex: 'tape', lift: 1.5 + (it.lift || 0), seed: 331 });
    const bl = K.blanket('tag-bl', K.rectPts(142, 64), 5.2, 4, 332);
    K.stitches(it, bl, 0.5, TEAL3);
    K.tx(it, 'FBI', -62, -26, 2, C.INK, { seed: 333, jump: false });
    K.tx(it, 'CASE SUSPENDED', -61, -6, 1, C.INK, { seed: 334 });
    K.tx(it, '2016', -62, 8, 2, C.INK, { seed: 335, jump: false });
  };
})();

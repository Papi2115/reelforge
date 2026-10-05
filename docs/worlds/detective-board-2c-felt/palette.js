/* detective-board 2c "felt" - palette, ramps, hashing and easing.
 * Everything here is pure: no clocks, no Math.random. Classic script (file:// friendly). */
(function () {
  'use strict';
  const F = (window.FELT = {});
  F.W = 960;
  F.H = 540;
  F.FPS = 30;

  // 24 colours. Roles are documented in NOTES.md.
  const HEX = [
    '#1c1a20', // 0 INK        typewriter ink, sunglasses, deepest shadow
    '#2c2a33', // 1 NIGHT      dark suit felt, shadow on dark linen
    '#46434f', // 2 NIGHT_L    dark felt fibres, faded ink
    '#4a453e', // 3 LIN0       linen weave gaps, needle holes
    '#625c52', // 4 LIN1       linen thread shade, shadows on linen
    '#78715f', // 5 LIN2       linen base (60 %)
    '#8f8774', // 6 LIN3       linen crowns, slubs
    '#c4b592', // 7 CREAM_S    paper shade, cream thread underside
    '#e5d8b6', // 8 CREAM      paper labels, cream thread
    '#f6efda', // 9 WHITE      needle glint, thread sheen
    '#a4722b', // 10 MUST_S
    '#d6a03f', // 11 MUST      mustard felt, brass, cross-stitched years
    '#793824', // 12 RUST_S
    '#ad5532', // 13 RUST      briefcase, route stitches
    '#245759', // 14 TEAL_S
    '#3b867f', // 15 TEAL      sea, river, parachutes
    '#74ae9f', // 16 TEAL_L    water ripples, canopy light
    '#536943', // 17 SAGE_S
    '#809b60', // 18 SAGE      bank notes
    '#8a1b23', // 19 RED_S     red thread underside
    '#d42b2f', // 20 RED       THE thread (connections, key numbers) - nothing else
    '#ef6b58', // 21 RED_L     red thread sheen
    '#6b7380', // 22 STEEL_S
    '#c0c6ce', // 23 STEEL     needle, aircraft felt
  ];
  const C = {
    INK: 0, NIGHT: 1, NIGHT_L: 2, LIN0: 3, LIN1: 4, LIN2: 5, LIN3: 6, CREAM_S: 7, CREAM: 8, WHITE: 9,
    MUST_S: 10, MUST: 11, RUST_S: 12, RUST: 13, TEAL_S: 14, TEAL: 15, TEAL_L: 16, SAGE_S: 17, SAGE: 18,
    RED_S: 19, RED: 20, RED_L: 21, STEEL_S: 22, STEEL: 23,
  };
  F.C = C;
  F.HEX = HEX;
  F.RGB = HEX.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

  function ramp(pairs) {
    const r = new Uint8Array(HEX.length);
    for (let i = 0; i < HEX.length; i++) r[i] = i;
    for (const [a, b] of pairs) r[C[a]] = C[b];
    return r;
  }
  F.DARK = ramp([
    ['INK', 'INK'], ['NIGHT', 'INK'], ['NIGHT_L', 'NIGHT'], ['LIN0', 'NIGHT'], ['LIN1', 'LIN0'], ['LIN2', 'LIN1'],
    ['LIN3', 'LIN2'], ['CREAM_S', 'LIN3'], ['CREAM', 'CREAM_S'], ['WHITE', 'CREAM'], ['MUST_S', 'RUST_S'],
    ['MUST', 'MUST_S'], ['RUST_S', 'NIGHT'], ['RUST', 'RUST_S'], ['TEAL_S', 'NIGHT'], ['TEAL', 'TEAL_S'],
    ['TEAL_L', 'TEAL'], ['SAGE_S', 'LIN0'], ['SAGE', 'SAGE_S'], ['RED_S', 'RUST_S'], ['RED', 'RED_S'],
    ['RED_L', 'RED'], ['STEEL_S', 'LIN0'], ['STEEL', 'STEEL_S'],
  ]);
  F.LIGHT = ramp([
    ['INK', 'NIGHT'], ['NIGHT', 'NIGHT_L'], ['NIGHT_L', 'LIN1'], ['LIN0', 'LIN1'], ['LIN1', 'LIN2'], ['LIN2', 'LIN3'],
    ['LIN3', 'CREAM_S'], ['CREAM_S', 'CREAM'], ['CREAM', 'WHITE'], ['WHITE', 'WHITE'], ['MUST_S', 'MUST'],
    ['MUST', 'CREAM'], ['RUST_S', 'RUST'], ['RUST', 'MUST'], ['TEAL_S', 'TEAL'], ['TEAL', 'TEAL_L'],
    ['TEAL_L', 'WHITE'], ['SAGE_S', 'SAGE'], ['SAGE', 'CREAM_S'], ['RED_S', 'RED'], ['RED', 'RED_L'],
    ['RED_L', 'WHITE'], ['STEEL_S', 'STEEL'], ['STEEL', 'WHITE'],
  ]);

  /** Integer hash -> [0,1). Deterministic, seeded by up to three ints. */
  F.hash = function (a, b, c) {
    let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  /** Seeded PRNG for pure builders (mulberry32). */
  F.prng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  F.clamp01 = clamp01;
  F.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  F.lerp = (a, b, k) => a + (b - a) * k;
  /** 0..1 progress of t inside [t0, t1]. */
  F.prog = (t, t0, t1) => clamp01((t - t0) / (t1 - t0));
  F.ease = {
    linear: (x) => x,
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    out: (x) => 1 - Math.pow(1 - x, 3),
    in: (x) => x * x * x,
    outBack: (x) => {
      const c1 = 1.9;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
    /** anticipation: dips below 0 before rising. */
    antic: (x) => {
      const c = 1.6;
      return x * x * ((c + 1) * x - c);
    },
  };
  /** Decaying wobble (twang) after time 0: amplitude 1 -> 0. */
  F.twang = function (dt, freq, decay) {
    if (dt < 0) return 0;
    return Math.sin(dt * freq * Math.PI * 2) * Math.exp(-dt * decay);
  };
})();

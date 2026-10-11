/* Dancing Plague - core: frame size, seeded hash, easing, keyframes, acting clocks (talk, blink), gritty palette.
   Pure: nothing here reads a clock. */
'use strict';
(function () {
  const ST = (window.ST = {});
  ST.W = 1920;
  ST.H = 1080;
  ST.FPS = 24; // playback / export rate
  ST.ANIM = 12; // characters hold every pose for two frames ("on twos")

  // Shots register by id; the film table (film.js) owns order, durations and narration.
  ST.SHOT_DEFS = {};
  ST.defineShot = (id, def) => { ST.SHOT_DEFS[id] = def; };
  // Characters register by id: ST.CAST[id] = { name, D (rig dimensions), draw(ctx, p) }.
  ST.CAST = {};

  // ---- seeded hash: integers in, [0,1) out ----
  function mix(h) {
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
  }
  ST.hash = (a, b, c, d) => {
    let h = mix((a | 0) + 0x9e3779b9);
    h = mix(h ^ ((b | 0) + 0x85ebca6b));
    h = mix(h ^ ((c | 0) + 0xc2b2ae35));
    h = mix(h ^ ((d | 0) + 0x27d4eb2f));
    return h / 4294967296;
  };
  ST.rnd = (lo, hi, a, b, c, d) => lo + (hi - lo) * ST.hash(a, b, c, d);
  // smooth 1-D value noise in [0,1)
  ST.noise1 = (seed, x) => {
    const i = Math.floor(x), f = x - i, k = f * f * (3 - 2 * f);
    return ST.hash(seed, i) * (1 - k) + ST.hash(seed, i + 1) * k;
  };

  // ---- easing / interpolation ----
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  ST.clamp01 = clamp01;
  ST.lerp = (a, b, k) => a + (b - a) * k;
  ST.seg = (t, a, b) => clamp01((t - a) / (b - a));
  ST.ease = {
    lin: (x) => clamp01(x),
    inOut: (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    out: (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); },
    back: (x) => { x = clamp01(x); const s = 2.2; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
  };
  // characters animate on twos: every pose holds for 1/12 s
  ST.twos = (t) => Math.floor(t * ST.ANIM + 1e-6) / ST.ANIM;

  // keyframed number: keys [[time, value, easeName?], ...]; eases into each key
  ST.key = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t < t1) {
        const [t0, v0] = keys[i - 1];
        return ST.lerp(v0, v1, ST.ease[e || 'inOut']((t - t0) / (t1 - t0)));
      }
    }
    return keys[keys.length - 1][1];
  };
  // snapped value: the last key whose time has passed (pose swaps, expression changes)
  ST.step = (t, keys) => {
    let v = keys[0][1];
    for (const k of keys) if (t >= k[0]) v = k[1];
    return v;
  };

  // jaw flap while talking: spans [[from,to],...]; syllables on twos, mouth shut between words
  ST.talk = (t, seed, spans) => {
    const tt = ST.twos(t);
    for (const [a, b] of spans) {
      if (tt < a || tt >= b) continue;
      const f = Math.floor((tt - a) * ST.ANIM);
      if (ST.hash(seed, f, 7) < 0.22) return 0.05;
      return 0.25 + 0.7 * ST.hash(seed, f, 3);
    }
    return 0;
  };
  // slow blinks: one per ~3.4 s at a hashed moment, lids close for 3 frames at 12 fps
  ST.blink = (t, seed) => {
    const P = 3.4, k = Math.floor(t / P), bt = k * P + 0.4 + ST.hash(seed, k, 11) * 2.4;
    const d = ST.twos(t) - bt;
    if (d < 0 || d >= 0.25) return 0;
    return d < 0.17 ? 1 : 0.6;
  };

  // ---- palette: olive, clay, grey-blue, mustard, rust. Nothing pastel; whites are dirty. ----
  ST.C = {
    INK: '#16120e', EYE: '#d9d0b4', MOUTH: '#2c110d', TONGUE: '#7f3b33', TOOTH: '#cdbd8c', TOOTH_D: '#a08f5c',
    SKIN_RUDDY: '#b07a62', SKIN_RUDDY_D: '#86533f', SKIN_SALLOW: '#b4a17a', SKIN_SALLOW_D: '#8a7954',
    SKIN_CLAY: '#a26c52', SKIN_CLAY_D: '#784a36', SKIN_OLIVE: '#9b8a62', SKIN_OLIVE_D: '#71633f',
    SKIN_GREY: '#a39880', SKIN_GREY_D: '#7a705b',
    OLIVE: '#646238', OLIVE_D: '#46452a', CLAY: '#8a5a40', CLAY_D: '#65402d', GREYBLUE: '#526068', GREYBLUE_D: '#3a454c',
    MUSTARD: '#9b8236', MUSTARD_D: '#735f26', RUST: '#83402a', RUST_D: '#5f2c1c', BROWN: '#5a4736', BROWN_D: '#3f3125',
    LINEN: '#ada385', LINEN_D: '#867d62', BLACK: '#2a2623', BLACK_D: '#1b1816', PLUM: '#55404a', PLUM_D: '#3c2c34',
    FUR: '#6e5640', FUR_D: '#4e3c2c', STONE: '#7d7766', STONE_D: '#5d584a', TIMBER: '#3d2e22', PLASTER: '#9c9273',
    RED: '#b02e26', RED_D: '#7c1f19', GOLD: '#c29632', GOLD_D: '#8e6c22', FIRE: '#e0a443', FIRE_D: '#b9722c',
  };
})();

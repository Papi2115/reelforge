/* comic-panels v2 showcase - the two faces. "Inkhand" (lettering) was drawn for the v1 showcase;
 * "Forge Display" glyphs are copied from packages/engine/src/text/font-display.ts (our own CC0 font).
 * Both caps-only, 7 rows cap height.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { rnd } = CP;

  // Inkhand: 1-px strokes, slightly leaning bowls, kicked legs; alternates make repeated letters differ.
  const INKHAND = {
    A: '..#../.#.#./.#.#./#...#/#####/#...#/#...#',
    B: '####./#...#/#..#./####./#...#/#...#/####.',
    C: '.###./#...#/#..../#..../#..../#...#/.###.',
    D: '###../#..#./#...#/#...#/#...#/#..#./###..',
    E: '#####/#..../#..../####./#..../#..../#####',
    F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#..##/#...#/#...#/.####',
    H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '#/#/#/#/#/#/#',
    J: '..###/...#./...#./...#./#..#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
    L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
    N: '#...#/##..#/##..#/#.#.#/#..##/#..##/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
    R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.',
    T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/.#.#./.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
    X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
    Z: '#####/....#/...#./..#../.#.../#..../#####',
    0: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    1: '.#./##./.#./.#./.#./.#./###',
    2: '.###./#...#/....#/...#./..#../.#.../#####',
    3: '####./....#/....#/.###./....#/....#/####.',
    4: '...#./..##./.#.#./#..#./#####/...#./...#.',
    5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '.###./#..../#..../####./#...#/#...#/.###.',
    7: '#####/....#/...#./..#../..#../.#.../.#...',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
    9: '.###./#...#/#...#/.####/....#/....#/.###.',
    '.': './././././././#',
    ',': '../../../../../.#/.#/#.',
    '!': '#/#/#/#/#/./#',
    '?': '.###./#...#/....#/..##./..#../...../..#..',
    "'": '#/#/./././././.',
    '-': '..../..../..../####/..../..../....',
    ':': './#/././././#',
  };
  const INKHAND_ALT = {
    A: '..#../..##./.#.#./.#..#/#####/#...#/#...#',
    E: '####./#..../#..../###../#..../#..../#####',
    O: '.##../#..#./#...#/#...#/#...#/#..#./.##..',
    R: '###../#..#./#..#./###../#.#../#..#./#...#',
    S: '.###./#...#/#..../.###./....#/#...#/.###.',
    T: '#####/..#../..#../..#../..#../..#../.##..',
  };
  // Forge Display (CC0, packages/engine/src/text/font-display.ts): the whole A-Z and 0-9 set.
  const DISPLAY = {
    A: '..###../.##.##./##...##/##...##/#######/##...##/##...##',
    B: '#####./##..##/##..##/#####./##..##/##..##/#####.',
    C: '.####./##..##/##..../##..../##..../##..##/.####.',
    D: '####../##.##./##..##/##..##/##..##/##.##./####..',
    E: '######/##..../##..../#####./##..../##..../######',
    F: '######/##..../##..../#####./##..../##..../##....',
    G: '.####./##..##/##..../##.###/##..##/##..##/.#####',
    H: '##..##/##..##/##..##/######/##..##/##..##/##..##',
    I: '####/.##./.##./.##./.##./.##./####',
    J: '..####/....##/....##/....##/##..##/##..##/.####.',
    K: '##..##/##.##./####../###.../####../##.##./##..##',
    L: '##..../##..../##..../##..../##..../##..../######',
    M: '##...##/###.###/#######/##.#.##/##...##/##...##/##...##',
    N: '##...##/###..##/####.##/##.####/##..###/##...##/##...##',
    O: '.#####./##...##/##...##/##...##/##...##/##...##/.#####.',
    P: '#####./##..##/##..##/#####./##..../##..../##....',
    Q: '.#####./##...##/##...##/##...##/##.#.##/##..##./.###.##',
    R: '#####./##..##/##..##/#####./####../##.##./##..##',
    S: '.####./##..##/##..../.####./....##/##..##/.####.',
    T: '######/..##../..##../..##../..##../..##../..##..',
    U: '##..##/##..##/##..##/##..##/##..##/##..##/.####.',
    V: '##..##/##..##/##..##/##..##/##..##/.####./..##..',
    W: '##...##/##...##/##...##/##.#.##/#######/###.###/##...##',
    X: '##..##/##..##/.####./..##../.####./##..##/##..##',
    Y: '##..##/##..##/##..##/.####./..##../..##../..##..',
    Z: '######/....##/...##./..##../.##.../##..../######',
    // Plain zero: the engine's slashed zero reads as an 8 once the letter is warped.
    '0': '.####./##..##/##..##/##..##/##..##/##..##/.####.',
    '1': '..##../.###../..##../..##../..##../..##../.####.',
    '2': '.####./##..##/....##/..###./.##.../##..../######',
    '3': '.####./##..##/....##/..###./....##/##..##/.####.',
    '4': '...##./..###./.####./##.##./######/...##./...##.',
    '5': '######/##..../#####./....##/....##/##..##/.####.',
    '6': '.####./##..../##..../#####./##..##/##..##/.####.',
    '7': '######/....##/...##./..##../..##../..##../..##..',
    '8': '.####./##..##/##..##/.####./##..##/##..##/.####.',
    '9': '.####./##..##/##..##/.#####/....##/...##./.###..',
    '!': '##/##/##/##/##/../##',
    '.': '../../../../../##/##',
  };
  function compile(map) {
    const out = {};
    for (const ch of Object.keys(map)) {
      const rows = map[ch].split('/');
      const w = rows[0].length;
      const bits = new Uint8Array(w * rows.length);
      rows.forEach((r, y) => {
        for (let x = 0; x < w; x++) bits[y * w + x] = r[x] === '#' ? 1 : 0;
      });
      out[ch] = { w, h: rows.length, bits };
    }
    return out;
  }
  const FONTS = {
    hand: { glyphs: compile(INKHAND), alt: compile(INKHAND_ALT), space: 3, spacing: 1, cap: 7 },
    display: { glyphs: compile(DISPLAY), alt: {}, space: 4, spacing: 1, cap: 7 },
  };

  function glyphFor(font, ch, key, i) {
    const f = FONTS[font];
    if (f.alt[ch] && rnd(key, i * 7 + 3) < 0.45) return f.alt[ch];
    return f.glyphs[ch] || f.glyphs['?'];
  }
  function measure(font, text, scale, bold) {
    const f = FONTS[font];
    const s = scale || 1;
    const b = bold ? s : 0;
    let w = 0;
    for (const ch of text) w += ch === ' ' ? f.space * s : (f.glyphs[ch] ? f.glyphs[ch].w : 5) * s + b + f.spacing * s;
    return Math.max(0, w - f.spacing * s);
  }
  /** Smart bold: a stem pixel thickens to the right only where a one-pixel gap would survive. */
  function boldBit(g, x, y) {
    if (x < g.w && g.bits[y * g.w + x]) return true;
    const left = x - 1 >= 0 && x - 1 < g.w && g.bits[y * g.w + x - 1];
    if (!left) return false;
    const next = x + 1 < g.w && g.bits[y * g.w + x + 1];
    return !next;
  }
  /**
   * Draws text with a hand-lettered baseline: every glyph may ride +-jitter px, seeded by key.
   * opt: scale, jitter, slant (px shift per 4 rows, pencil), outline (palette index), reveal (chars shown).
   */
  function text(font, str, x, y, paint, opt) {
    const o = opt || {};
    const s = o.scale || 1;
    const f = FONTS[font];
    const key = o.key || str;
    const jitter = o.jitter === undefined ? 1 : o.jitter;
    const shown = o.reveal === undefined ? str.length : o.reveal;
    let cx = Math.round(x);
    let n = 0;
    for (const ch of str) {
      if (n >= shown) break;
      n++;
      if (ch === ' ') {
        cx += f.space * s;
        continue;
      }
      const g = glyphFor(font, ch, key, n);
      // Digits sit steadier than letters: a wobbling 0 reads as a lower-case o.
      const amp = /[0-9]/.test(ch) ? 0.45 : 0.8;
      const dy = jitter ? Math.round((rnd(key, n) * 2 - 1) * jitter * amp) : 0;
      const dx = jitter && rnd(key, n + 50) < 0.15 ? -1 : 0;
      const gy = Math.round(y) + dy;
      if (o.outline !== undefined) {
        for (let yy = -1; yy <= g.h * s; yy++) {
          for (let xx = -1; xx <= g.w * s; xx++) {
            if (inked(g, xx, yy, s, 1)) CP.plot(cx + dx + xx, gy + yy, o.outline);
          }
        }
      }
      const gw = g.w + (o.bold ? 1 : 0);
      for (let gyy = 0; gyy < g.h; gyy++) {
        const sl = o.slant ? Math.round(((g.h - gyy) / 4) * o.slant) : 0;
        for (let gxx = 0; gxx < gw; gxx++) {
          if (o.bold ? !boldBit(g, gxx, gyy) : !g.bits[gyy * g.w + gxx]) continue;
          CP.rect(cx + dx + gxx * s + sl, gy + gyy * s, s, s, paint);
        }
      }
      cx += gw * s + f.spacing * s;
    }
  }
  function inked(g, x, y, s, r) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        const gx = Math.floor((x + ox) / s);
        const gy = Math.floor((y + oy) / s);
        if (gx >= 0 && gy >= 0 && gx < g.w && gy < g.h && g.bits[gy * g.w + gx]) return true;
      }
    }
    return false;
  }

  CP.FONTS = FONTS;
  CP.text = text;
  CP.measure = measure;
  CP.glyphFor = glyphFor;
})();

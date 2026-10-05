/* detective-board 2a - two pixel faces (both CC0, ReelForge-authored).
 * TYPE: typewriter caps 5x7 in a 6-px cell; glyphs from "Forge Mono" (packages/engine/src/text/font-mono.ts)
 *       plus $ ? ' & for this world. Uneven ink, the odd jumped letter.
 * HAND: "Ballpoint" (from the first detective-board showcase, completed here with K J Q X Z $ : / !):
 *       1-px strokes, 8-px caps, per-note slant, baseline drift, irregular write-on cadence. */
(function () {
  'use strict';
  const D2 = window.D2;

  const TYPE_GLYPHS = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
    B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.###./#...#/#..../#..../#..../#...#/.###.',
    D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####',
    F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.####',
    H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '.###./..#../..#../..#../..#../..#../.###.',
    J: '..###/...#./...#./...#./...#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
    L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
    N: '#...#/#...#/##..#/#.#.#/#..##/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
    R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.',
    T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.',
    X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/#...#/.#.#./..#../..#../..#..',
    Z: '#####/....#/...#./..#../.#.../#..../#####',
    0: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    1: '..#../.##../..#../..#../..#../..#../.###.',
    2: '.###./#...#/....#/...#./..#../.#.../#####',
    3: '#####/...#./..#../...#./....#/#...#/.###.',
    4: '...#./..##./.#.#./#..#./#####/...#./...#.',
    5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '..##./.#.../#..../####./#...#/#...#/.###.',
    7: '#####/....#/...#./..#../.#.../.#.../.#...',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
    9: '.###./#...#/#...#/.####/....#/...#./.##..',
    '.': '...../...../...../...../...../.##../.##..',
    ',': '...../...../...../...../.##../..#../.#...',
    ':': '...../.##../.##../...../.##../.##../.....',
    '-': '...../...../...../.###./...../...../.....',
    '/': '....#/....#/...#./..#../.#.../#..../#....',
    $: '..#../.####/#.#../.###./..#.#/####./..#..',
    '?': '.###./#...#/....#/...#./..#../...../..#..',
    "'": '..#../..#../.#.../...../...../...../.....',
    '&': '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#',
  };

  // [top row relative to cap line, rows]; baseline is row 7 (rows 8.. are descenders).
  const HAND_GLYPHS = {
    a: [3, '.##./#..#/#..#/#.##/.#.#'],
    b: [0, '#.../#.../#.../#.#./##.#/#..#/#..#/.##.'],
    c: [3, '.##./#..#/#.../#.../.###'],
    d: [0, '...#/...#/...#/.###/#..#/#..#/#.##/.#.#'],
    e: [3, '.##./#..#/###./#.../.###'],
    f: [0, '..##/.#../.#../###./.#../.#../.#../.#../#...'],
    g: [3, '.###/#..#/#..#/.###/...#/#..#/.##.'],
    h: [0, '#.../#.../#.../#.#./##.#/#..#/#..#/#..#'],
    i: [1, '#./../#./#./#./#./.#'],
    j: [1, '..#/.../..#/..#/..#/..#/..#/..#/#.#/.#.'],
    k: [0, '#.../#.../#.../#..#/#.#./##../#.#./#..#'],
    l: [0, '#./#./#./#./#./#./#./.#'],
    m: [3, '.#.#./#.#.#/#.#.#/#.#.#/#.#.#'],
    n: [3, '#.#./##.#/#..#/#..#/#..#'],
    o: [3, '.##./#..#/#..#/#..#/.##.'],
    p: [3, '#.#./##.#/#..#/#..#/###./#.../#...'],
    q: [3, '.##./#..#/#..#/#..#/.###/...#/...#'],
    r: [3, '#.#/##./#../#../#..'],
    s: [3, '.##/#../.#./..#/##.'],
    t: [1, '.#../.#../####/.#../.#../.#.#/..#.'],
    u: [3, '#..#/#..#/#..#/#.##/.#.#'],
    v: [3, '#...#/#...#/.#.#./.#.#./..#..'],
    w: [3, '#...#/#...#/#.#.#/#.#.#/.#.#.'],
    x: [3, '#...#/.#.#./..#../.#.#./#...#'],
    y: [3, '#..#/#..#/#..#/.###/...#/#..#/.##.'],
    z: [3, '####/..#./.#../#.../####'],
    A: [0, '..#../..#../.#.#./.#.#./#...#/#####/#...#/#...#'],
    B: [0, '###./#..#/#..#/###./#..#/#..#/#..#/###.'],
    C: [0, '.###/#.../#.../#.../#.../#.../#.../.###'],
    D: [0, '###../#..#./#...#/#...#/#...#/#...#/#..#./###..'],
    E: [0, '####/#.../#.../###./#.../#.../#.../####'],
    F: [0, '####/#.../#.../###./#.../#.../#.../#...'],
    G: [0, '.###/#.../#.../#.../#.##/#..#/#..#/.##.'],
    H: [0, '#..#/#..#/#..#/####/#..#/#..#/#..#/#..#'],
    I: [0, '###/.#./.#./.#./.#./.#./.#./###'],
    J: [0, '..##/...#/...#/...#/...#/...#/#..#/.##.'],
    K: [0, '#..#/#..#/#.#./##../##../#.#./#..#/#..#'],
    L: [0, '#.../#.../#.../#.../#.../#.../#.../####'],
    M: [0, '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#/#...#'],
    N: [0, '#..#/##.#/##.#/#.##/#.##/#..#/#..#/#..#'],
    O: [0, '.##./#..#/#..#/#..#/#..#/#..#/#..#/.##.'],
    P: [0, '###./#..#/#..#/#..#/###./#.../#.../#...'],
    Q: [0, '.##../#..#./#..#./#..#./#..#./#.##./#..#./.##.#'],
    R: [0, '###./#..#/#..#/#..#/###./#.#./#..#/#..#'],
    S: [0, '.###/#.../#.../.##./...#/...#/...#/###.'],
    T: [0, '#####/..#../..#../..#../..#../..#../..#../..#..'],
    U: [0, '#..#/#..#/#..#/#..#/#..#/#..#/#..#/.##.'],
    V: [0, '#...#/#...#/#...#/#...#/.#.#./.#.#./.#.#./..#..'],
    W: [0, '#...#/#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.'],
    X: [0, '#...#/#...#/.#.#./..#../..#../.#.#./#...#/#...#'],
    Y: [0, '#...#/#...#/.#.#./..#../..#../..#../..#../..#..'],
    Z: [0, '####/...#/...#/..#./.#../#.../#.../####'],
    0: [0, '.##./#..#/#..#/#..#/#..#/#..#/#..#/.##.'],
    1: [0, '..#./.##./#.#./..#./..#./..#./..#./..#.'],
    2: [0, '.##./#..#/...#/...#/..#./.#../#.../####'],
    3: [0, '###./...#/...#/.##./...#/...#/...#/###.'],
    4: [0, '..#./.##./#.#./#.#./####/..#./..#./..#.'],
    5: [0, '####/#.../#.../###./...#/...#/...#/###.'],
    6: [0, '..#./.#../#.../###./#..#/#..#/#..#/.##.'],
    7: [0, '####/...#/..#./.###/..#./.#../.#../.#..'],
    8: [0, '.##./#..#/#..#/.##./#..#/#..#/#..#/.##.'],
    9: [0, '.##./#..#/#..#/.###/...#/...#/..#./.#..'],
    '.': [7, '#'],
    ',': [7, '.#/#.'],
    '?': [0, '.##./#..#/...#/..#./.#../.#../..../.#..'],
    '!': [0, '#/#/#/#/#/#/./#'],
    '-': [4, '###'],
    "'": [0, '#/#'],
    ':': [3, '#/./././#'],
    '/': [0, '...#/...#/..#./..#./.#../.#../#.../#...'],
    $: [-1, '..#./.###/#.#./#.#./.##./..##/..#./###./..#.'],
  };

  function compile(table, isHand) {
    const out = {};
    for (const key of Object.keys(table)) {
      const entry = table[key];
      const top = isHand ? entry[0] : 0;
      const rows = (isHand ? entry[1] : entry).split('/');
      const w = rows[0].length;
      rows.forEach((r) => {
        if (r.length !== w) throw new Error('font glyph ' + key + ': uneven rows');
      });
      out[key] = { w, top, rows };
    }
    return out;
  }
  const TYPE = compile(TYPE_GLYPHS, false);
  const HAND = compile(HAND_GLYPHS, true);

  /** Typewriter caps at integer scale. opts: scale, fade (worn-ink colour), clean (no wear). */
  function typeText(s, text, x, y, color, seed, opts) {
    const o = opts || {};
    const sc = o.scale || 1;
    const fade = o.fade === undefined ? D2.C.PAPER_DD : o.fade;
    let cx = Math.round(x);
    const str = String(text).toUpperCase();
    for (let i = 0; i < str.length; i += 1) {
      const g = TYPE[str[i]];
      if (g) {
        const strike = D2.hash(seed, i, 7);
        const jump = o.clean ? 0 : strike > 0.94 ? -1 : strike < 0.04 ? 1 : 0;
        const light = !o.clean && strike > 0.62 && strike < 0.72;
        g.rows.forEach((row, ry) => {
          for (let rx = 0; rx < g.w; rx += 1) {
            if (row[rx] !== '#') continue;
            const worn = !o.clean && D2.hash(seed + i, rx, ry) < (light ? 0.28 : 0.04);
            D2.rect(s, cx + rx * sc, y + (ry + jump) * sc, sc, sc, worn ? fade : color);
          }
        });
      }
      cx += 6 * sc;
    }
    return cx - x;
  }
  const typeWidth = (text, scale) => (String(text).length * 6 - 1) * (scale || 1);

  function handLayout(text, seed) {
    const xs = [];
    let x = 0;
    for (let i = 0; i < text.length; i += 1) {
      xs.push(x);
      const ch = text[i];
      if (ch === ' ') x += 4 + (D2.hash(seed, i, 3) < 0.4 ? 1 : 0);
      else {
        const g = HAND[ch];
        x += (g ? g.w : 4) + 1 + (D2.hash(seed, i, 4) < 0.22 ? 1 : 0);
      }
    }
    return { xs, width: x - 1 };
  }
  /**
   * Ballpoint handwriting, baseline at y. opts: slant (px/row), rise (px/px), reveal (chars written,
   * fractional = pen inside that letter), scale (integer, marker weight).
   */
  function handText(s, text, x, y, color, seed, opts) {
    const o = opts || {};
    const slant = o.slant === undefined ? 0.25 : o.slant;
    const rise = o.rise || 0;
    const sc = o.scale || 1;
    const reveal = o.reveal === undefined ? text.length : o.reveal;
    const lay = handLayout(text, seed);
    for (let i = 0; i < text.length && i < reveal; i += 1) {
      const g = HAND[text[i]];
      if (!g) continue;
      const partial = reveal - i < 1 ? reveal - i : 1;
      const cols = Math.ceil(g.w * partial);
      const bob = D2.hash(seed, i, 9) < 0.2 ? (D2.hash(seed, i, 10) < 0.5 ? -1 : 1) : 0;
      const gx = x + lay.xs[i] * sc;
      const base = y + Math.round(lay.xs[i] * sc * rise) + bob * sc;
      g.rows.forEach((row, ry) => {
        const r = g.top + ry;
        const shift = Math.round((7 - r) * slant * sc);
        for (let rx = 0; rx < cols; rx += 1) {
          if (row[rx] === '#') D2.rect(s, gx + rx * sc + shift, base + (r - 7) * sc, sc, sc, color);
        }
      });
    }
    return lay.width * sc;
  }
  /** Time (s) each character of a hand line is finished; irregular cadence, pauses at spaces. */
  function handTimes(text, t0, seed, cps) {
    const times = [];
    let t = t0;
    for (let i = 0; i < text.length; i += 1) {
      t += (1 / cps) * (0.6 + 0.8 * D2.hash(seed, i, 21));
      if (text[i] === ' ') t += 0.06 + 0.12 * D2.hash(seed, i, 22);
      times.push(t);
    }
    return times;
  }
  function handReveal(times, t, t0) {
    if (t <= t0) return 0;
    let prev = t0;
    for (let i = 0; i < times.length; i += 1) {
      if (t < times[i]) return i + (t - prev) / (times[i] - prev);
      prev = times[i];
    }
    return times.length;
  }

  /** Embossed label-maker tape: navy strip, raised white caps, V-cut ends. Returns a sprite. */
  function labelTape(text, seed, chars) {
    const n = chars === undefined ? text.length : Math.floor(chars);
    const w = typeWidth(text) + 12;
    const s = D2.surf(w, 13);
    D2.rect(s, 0, 0, w, 13, D2.C.NAVY);
    D2.rect(s, 0, 12, w, 1, D2.C.NIGHT);
    for (let x = 2; x < w - 2; x += 1) if (D2.hash(seed, x, 77) < 0.1) D2.px(s, x, 1, D2.C.BLUE);
    // V-notched cut ends
    for (let y = 0; y < 13; y += 1) {
      const cut = Math.abs(6 - y) < 3 ? 0 : Math.abs(6 - y) < 5 ? 1 : 2;
      for (let k = 0; k < cut; k += 1) {
        D2.px(s, k, y, D2.T);
        D2.px(s, w - 1 - k, y, D2.T);
      }
    }
    const part = text.slice(0, n);
    // embossed: white letter with a navy-dark drop to the lower right
    typeText(s, part, 7, 4, D2.C.NIGHT, seed, { clean: true });
    typeText(s, part, 6, 3, D2.C.WHITE, seed, { clean: true });
    return s;
  }

  Object.assign(D2, { typeText, typeWidth, handText, handLayout, handTimes, handReveal, labelTape, HAND, TYPE });
})();

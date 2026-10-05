/* detective-board showcase - two hand-built pixel faces.
 * TYPE: typewriter caps, 5x7 in a 6-px cell; glyph data copied from ReelForge "Forge Mono"
 *       (packages/engine/src/text/font-mono.ts, our own CC0 font) and rendered with uneven
 *       ink and the occasional jumped letter.
 * HAND: "Ballpoint", authored for this world (CC0): 1-px pen strokes, 8-px caps, 5-px
 *       x-height, 3-px descenders, proportional; drawn with per-note slant, baseline drift
 *       and per-letter bob so no two notes sit the same way. */
(function () {
  'use strict';
  const DB = window.DB;

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
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
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
    L: [0, '#.../#.../#.../#.../#.../#.../#.../####'],
    M: [0, '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#/#...#'],
    N: [0, '#..#/##.#/##.#/#.##/#.##/#..#/#..#/#..#'],
    O: [0, '.##./#..#/#..#/#..#/#..#/#..#/#..#/.##.'],
    P: [0, '###./#..#/#..#/#..#/###./#.../#.../#...'],
    R: [0, '###./#..#/#..#/#..#/###./#.#./#..#/#..#'],
    S: [0, '.###/#.../#.../.##./...#/...#/...#/###.'],
    T: [0, '#####/..#../..#../..#../..#../..#../..#../..#..'],
    U: [0, '#..#/#..#/#..#/#..#/#..#/#..#/#..#/.##.'],
    V: [0, '#...#/#...#/#...#/#...#/.#.#./.#.#./.#.#./..#..'],
    W: [0, '#...#/#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.'],
    Y: [0, '#...#/#...#/.#.#./..#../..#../..#../..#../..#..'],
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
    '-': [4, '###'],
    "'": [0, '#/#'],
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

  /** Typewriter caps. Uneven ink: some strikes light (faded pixels), a few letters jump 1 px. */
  function typeText(s, text, x, y, color, seed, faded) {
    const fade = faded === undefined ? DB.C.GREY : faded;
    let cx = Math.round(x);
    const str = text.toUpperCase();
    for (let i = 0; i < str.length; i += 1) {
      const g = TYPE[str[i]];
      if (g) {
        const strike = DB.hash(seed, i, 7);
        const jump = strike > 0.93 ? -1 : strike < 0.05 ? 1 : 0;
        const light = strike > 0.62 && strike < 0.8;
        g.rows.forEach((row, ry) => {
          for (let rx = 0; rx < g.w; rx += 1) {
            if (row[rx] !== '#') continue;
            const worn = DB.hash(seed + i, rx, ry) < (light ? 0.42 : 0.08);
            DB.px(s, cx + rx, y + ry + jump, worn ? fade : color);
          }
        });
      }
      cx += 6;
    }
    return cx - x;
  }
  function typeWidth(text) {
    return text.length * 6 - 1;
  }

  /** Total advance of `text` in the hand face (same seeded spacing as handText). */
  function handLayout(text, seed) {
    const xs = [];
    let x = 0;
    for (let i = 0; i < text.length; i += 1) {
      xs.push(x);
      const ch = text[i];
      if (ch === ' ') x += 4 + (DB.hash(seed, i, 3) < 0.4 ? 1 : 0);
      else {
        const g = HAND[ch];
        x += (g ? g.w : 4) + 1 + (DB.hash(seed, i, 4) < 0.22 ? 1 : 0);
      }
    }
    return { xs, width: x - 1 };
  }

  /**
   * Ballpoint handwriting with its baseline at y. opts: slant (px per row), rise (px per px),
   * reveal (chars written so far, fractional = pen inside that letter).
   */
  function handText(s, text, x, y, color, seed, opts) {
    const o = opts || {};
    const slant = o.slant === undefined ? 0.25 : o.slant;
    const rise = o.rise || 0;
    const reveal = o.reveal === undefined ? text.length : o.reveal;
    const lay = handLayout(text, seed);
    for (let i = 0; i < text.length && i < reveal; i += 1) {
      const g = HAND[text[i]];
      if (!g) continue;
      const partial = reveal - i < 1 ? reveal - i : 1;
      const cols = Math.ceil(g.w * partial);
      const bob = DB.hash(seed, i, 9) < 0.18 ? (DB.hash(seed, i, 10) < 0.5 ? -1 : 1) : 0;
      const gx = x + lay.xs[i];
      const base = y + Math.round(lay.xs[i] * rise) + bob;
      g.rows.forEach((row, ry) => {
        const r = g.top + ry;
        const shift = Math.round((7 - r) * slant);
        for (let rx = 0; rx < cols; rx += 1) {
          if (row[rx] === '#') DB.px(s, gx + rx + shift, base - 7 + r, color);
        }
      });
    }
    return lay.width;
  }
  /** Time (s) at which each character of a handwritten line is finished; irregular cadence. */
  function handTimes(text, t0, seed, cps) {
    const times = [];
    let t = t0;
    for (let i = 0; i < text.length; i += 1) {
      const base = 1 / cps;
      t += base * (0.65 + 0.7 * DB.hash(seed, i, 21));
      if (text[i] === ' ') t += 0.05 + 0.1 * DB.hash(seed, i, 22);
      times.push(t);
    }
    return times;
  }
  /** Fractional "reveal" for handText at time t. */
  function handReveal(times, t, t0) {
    if (t <= t0) return 0;
    let prev = t0;
    for (let i = 0; i < times.length; i += 1) {
      if (t < times[i]) return i + (t - prev) / (times[i] - prev);
      prev = times[i];
    }
    return times.length;
  }

  Object.assign(DB, { typeText, typeWidth, handText, handLayout, handTimes, handReveal, HAND, TYPE });
})();

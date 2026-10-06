/* "Bezel 5x7" - a new proportional caps face for this world (CC0, drawn for this showcase).
   Rounded early-80s terminal letters, dotted zero, flat-topped A. Plus a seeded irregular typewriter. */
'use strict';
(function () {
  const RF = window.RF;
  const G = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    D: ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    0: ['.###.', '#...#', '#...#', '#.#.#', '#...#', '#...#', '.###.'],
    1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
    2: ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
    3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    7: ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    '.': ['.', '.', '.', '.', '.', '.', '#'],
    ',': ['..', '..', '..', '..', '..', '.#', '#.'],
    ':': ['.', '.', '#', '.', '.', '#', '.'],
    "'": ['#', '#', '.', '.', '.', '.', '.'],
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
    '-': ['....', '....', '....', '####', '....', '....', '....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
    '~': ['.....', '.....', '.#...', '#.#.#', '...#.', '.....', '.....'],
    '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
    '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
    ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
    '·': ['.', '.', '.', '#', '.', '.', '.'],
    '→': ['......', '...#..', '....#.', '######', '....#.', '...#..', '......'],
    '✓': ['.....', '....#', '....#', '...#.', '#.#..', '.#...', '.....'],
    '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
    ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  };
  const GLYPHS = {};
  for (const ch of Object.keys(G)) {
    const rows = G[ch];
    GLYPHS[ch] = { w: rows[0].length, bits: rows.map((r) => [...r].map((v) => v === '#')) };
  }
  const SPACE = 3;
  RF.FONT_H = 7;

  function advance(ch) {
    if (ch === ' ') return SPACE + 1;
    const g = GLYPHS[ch];
    return g ? g.w + 1 : SPACE + 1;
  }
  RF.textWidth = function (str, scale) {
    let w = 0;
    for (const ch of str) w += advance(ch);
    return Math.max(0, w - 1) * (scale || 1);
  };
  /**
   * Draw `str` (one line). opts: count (chars to show), jitter (seed -> baseline wobble in px),
   * shadow (colour of a 1-step drop shadow), bold.
   */
  RF.drawText = function (bmp, str, x, y, c, scale, opts) {
    scale = scale || 1;
    const o = opts || {};
    const count = o.count === undefined ? 1e9 : o.count;
    let cx = Math.round(x), i = 0;
    for (const ch of str) {
      if (i++ >= count) break;
      const g = GLYPHS[ch];
      if (g) {
        const jy = o.jitter ? Math.round((RF.hash3(o.jitter, i, 7) - 0.5) * 2 * (o.jitterAmp || 1)) : 0;
        for (let gy = 0; gy < 7; gy++)
          for (let gx = 0; gx < g.w; gx++) {
            if (!g.bits[gy][gx]) continue;
            const px = cx + gx * scale, py = Math.round(y) + gy * scale + jy;
            if (o.shadow !== undefined) bmp.rect(px + scale, py + scale, scale, scale, o.shadow);
            bmp.rect(px, py, scale + (o.bold ? 1 : 0), scale, c);
          }
      }
      cx += advance(ch) * scale;
    }
    return cx;
  };
  /** Multi-line text with a total char budget (typewriter); returns caret {x,y}. */
  RF.drawLines = function (bmp, text, x, y, c, scale, lineGap, count, opts) {
    const lines = text.split('\n');
    let left = count === undefined ? 1e9 : count;
    let caret = { x: x, y: y };
    lines.forEach((line, li) => {
      const ly = y + li * lineGap;
      const n = Math.max(0, Math.min(line.length, left));
      const jitter = opts && opts.jitter ? opts.jitter + li * 31 : 0;
      if (n > 0) RF.drawText(bmp, line, x, ly, c, scale, Object.assign({}, opts, { count: n, jitter: jitter }));
      if (left >= 0) caret = { x: x + (n > 0 ? RF.textWidth(line.slice(0, n), scale) + scale : 0), y: ly };
      left -= line.length + 1; // the newline costs one beat
    });
    return caret;
  };
  /**
   * Irregular typewriter: per-char reveal times (seeded). Punctuation holds, words come in small bursts,
   * one "thinking" stall per line. Never uniform.
   */
  RF.typeTimes = function (text, seed, t0, rate) {
    const r = RF.rng(seed);
    const out = [];
    let t = t0;
    const stallAt = Math.floor(text.length * (0.35 + r() * 0.3));
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      let d = (rate || 0.034) * (0.55 + r() * 0.9);
      if (ch === ' ') d *= 1.6;
      if (ch === '\n') d = 0.16 + r() * 0.08;
      if (i > 0 && '.,:'.includes(text[i - 1])) d += text[i - 1] === ',' ? 0.1 : 0.2 + r() * 0.08;
      if (i === stallAt && ch === ' ') d += 0.12;
      t += d;
      out.push(t);
    }
    return out;
  };
  RF.typedCount = function (times, t) {
    let n = 0;
    while (n < times.length && times[n] <= t) n++;
    return n;
  };
})();

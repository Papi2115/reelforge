/* B1 fonts (all drawn here, CC0):
   - Joy 5x6: rounded menu caps, used at 2x (12 px) for UI labels.
   - Score Block: 2600-style score digits/letters on a 4-5 x 5 grid, drawn with wide cells.
   - Box Art: Joy made bold + italic-sheared + extruded, for boss name cards (cartridge-box lettering).
   - Dad Hand: stroke font (polylines) with seeded jitter, slant and rotation: sticky notes and labels. */
'use strict';
(function () {
  const K = B1.core;
  const J = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#'], B: ['####.', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.####', '#....', '#....', '#....', '#....', '.####'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '####.', '#....', '#....', '#....'],
    G: ['.####', '#....', '#..##', '#...#', '#...#', '.###.'], H: ['#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '###'], J: ['..###', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '###..', '#..#.', '#...#', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#..#.', '#...#'],
    S: ['.####', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#...#', '.#.#.', '..#..', '..#..', '.#.#.', '#...#'],
    Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '...#.', '..#..', '.#...', '#....', '#####'],
    0: ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'], 1: ['.#.', '##.', '.#.', '.#.', '.#.', '###'],
    2: ['.##.', '#..#', '..#.', '.#..', '#...', '####'], 3: ['###.', '...#', '.##.', '...#', '...#', '###.'],
    4: ['#..#', '#..#', '####', '...#', '...#', '...#'], 5: ['####', '#...', '###.', '...#', '...#', '###.'],
    6: ['.##.', '#...', '###.', '#..#', '#..#', '.##.'], 7: ['####', '...#', '..#.', '.#..', '.#..', '.#..'],
    8: ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'], 9: ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],
    '.': ['.', '.', '.', '.', '.', '#'], ',': ['.', '.', '.', '.', '#', '#'], ':': ['.', '#', '.', '.', '#', '.'],
    "'": ['#', '#', '.', '.', '.', '.'], '-': ['...', '...', '###', '...', '...', '...'],
    '?': ['###.', '...#', '..#.', '.#..', '....', '.#..'], '!': ['#', '#', '#', '#', '.', '#'],
    '/': ['...#', '..#.', '..#.', '.#..', '.#..', '#...'], '·': ['.', '.', '#', '.', '.', '.'],
    '²': ['##.', '..#', '.#.', '###', '...', '...'], ' ': ['..', '..', '..', '..', '..', '..'],
  };
  function joyWidth(str, s) {
    let w = 0;
    for (const ch of str) w += ((J[ch] || J[' '])[0].length + 1) * s;
    return w - s;
  }
  // Joy text at integer scale s. opts.wobble: seeded baseline jitter (+-1 px) per glyph.
  function joy(str, x, y, s, c, opts) {
    const o = opts || {};
    let cx = Math.round(x);
    let i = 0;
    for (const ch of str) {
      const g = J[ch] || J[' '];
      const dy = o.wobble ? Math.round((K.hash(o.wobble, i, 11) - 0.5) * 2) : 0;
      for (let r = 0; r < 6; r++) {
        const row = g[r];
        for (let k = 0; k < row.length; k++) if (row[k] === '#') K.rect(cx + k * s, y + r * s + dy, s, s, c);
      }
      cx += (g[0].length + 1) * s;
      i++;
    }
    return cx - s - x;
  }

  // Score Block: 2600 score kernel. Cells are wide (cw > ch looks like the console's double-wide pixels).
  const S = {
    0: ['####', '#..#', '#..#', '#..#', '####'], 1: ['.##.', '..#.', '..#.', '..#.', '.###'],
    2: ['####', '...#', '####', '#...', '####'], 3: ['####', '...#', '.###', '...#', '####'],
    4: ['#..#', '#..#', '####', '...#', '...#'], 5: ['####', '#...', '####', '...#', '####'],
    6: ['####', '#...', '####', '#..#', '####'], 7: ['####', '...#', '..#.', '..#.', '..#.'],
    8: ['####', '#..#', '####', '#..#', '####'], 9: ['####', '#..#', '####', '...#', '####'],
    C: ['####', '#...', '#...', '#...', '####'], O: ['####', '#..#', '#..#', '#..#', '####'],
    N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'], T: ['#####', '..#..', '..#..', '..#..', '..#..'],
    I: ['###', '.#.', '.#.', '.#.', '###'], U: ['#..#', '#..#', '#..#', '#..#', '####'],
    E: ['####', '#...', '###.', '#...', '####'], '?': ['####', '...#', '.##.', '....', '.#..'],
    ' ': ['..', '..', '..', '..', '..'],
  };
  function scoreWidth(str, cw) {
    let w = 0;
    for (const ch of str) w += ((S[ch] || S[' '])[0].length + 1) * cw;
    return w - cw;
  }
  function score(str, x, y, cw, ch, c) {
    let cx = Math.round(x);
    for (const g0 of str) {
      const g = S[g0] || S[' '];
      for (let r = 0; r < 5; r++) for (let k = 0; k < g[r].length; k++) if (g[r][k] === '#') K.rect(cx + k * cw, y + r * ch, cw, ch, c);
      cx += (g[0].length + 1) * cw;
    }
    return cx - cw - x;
  }
  // One score glyph clipped to a window (for odometer rolls).
  function scoreGlyph(ch0, x, y, cw, ch, c, y0, y1) {
    const g = S[ch0] || S[' '];
    for (let r = 0; r < 5; r++) {
      const ry = y + r * ch;
      const a = Math.max(ry, y0);
      const b = Math.min(ry + ch, y1);
      if (b <= a) continue;
      for (let k = 0; k < g[r].length; k++) if (g[r][k] === '#') K.rect(x + k * cw, a, cw, b - a, c);
    }
  }

  // Box Art: bold Joy at scale s, sheared like italic box lettering, with an extrusion and a dark keyline.
  function boxMask(str, s) {
    const w0 = joyWidth(str, s) + str.length * Math.ceil(s / 2) + s + 4;
    const h0 = 6 * s;
    const shearMax = Math.ceil(h0 / 4);
    const w = w0 + shearMax + 4;
    const m = new Uint8Array(w * h0);
    let cx = 0;
    for (const ch of str) {
      const g = J[ch] || J[' '];
      for (let r = 0; r < 6; r++) {
        for (let k = 0; k < g[r].length; k++) {
          if (g[r][k] !== '#') continue;
          for (let yy = r * s; yy < r * s + s; yy++) {
            const sh = Math.floor((h0 - 1 - yy) / 4);
            for (let xx = cx + k * s; xx < cx + k * s + s + Math.ceil(s / 2); xx++) m[yy * w + xx + sh] = 1;
          }
        }
      }
      cx += (g[0].length + 1) * s + Math.ceil(s / 2);
    }
    return { m, w, h: h0 };
  }
  function boxArt(str, x, y, s, fillC, extC, keyC) {
    const { m, w, h } = boxMask(str, s);
    x = Math.round(x); y = Math.round(y);
    const ext = Math.max(2, Math.round(s * 0.7));
    for (let yy = -1; yy <= h + ext; yy++) {
      for (let xx = -1; xx <= w + ext; xx++) {
        let key = false;
        for (let d = 0; d <= ext && !key; d++) {
          for (let oy = -1; oy <= 1 && !key; oy++) {
            for (let ox = -1; ox <= 1 && !key; ox++) {
              const sx = xx - d - ox; const sy = yy - d - oy;
              if (sx >= 0 && sy >= 0 && sx < w && sy < h && m[sy * w + sx]) key = true;
            }
          }
        }
        if (key) K.px(x + xx, y + yy, keyC);
      }
    }
    for (let d = ext; d >= 1; d--) {
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (m[yy * w + xx]) K.px(x + xx + d, y + yy + d, extC);
    }
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (m[yy * w + xx]) K.px(x + xx, y + yy, fillC);
    return w;
  }

  // Dad Hand: strokes on a 4x6 unit grid; '|' separates strokes.
  const HS = {
    A: '0,6 2,0 4,6|1,4 3,4', B: '0,6 0,0 3,0 4,1 3,3 0,3|3,3 4,4 4,5 3,6 0,6', C: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5',
    D: '0,0 0,6 2,6 4,4 4,2 2,0 0,0', E: '4,0 0,0 0,6 4,6|0,3 3,3', F: '4,0 0,0 0,6|0,3 3,3',
    G: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3 2,3', H: '0,0 0,6|4,0 4,6|0,3 4,3', I: '2,0 2,6|1,0 3,0|1,6 3,6',
    J: '4,0 4,5 3,6 1,6 0,5', K: '0,0 0,6|4,0 0,4|1,3 4,6', L: '0,0 0,6 4,6', M: '0,6 0,0 2,3 4,0 4,6',
    N: '0,6 0,0 4,6 4,0', O: '2,0 0,1 0,5 2,6 4,5 4,1 2,0', P: '0,6 0,0 3,0 4,1 4,2 3,3 0,3',
    Q: '2,0 0,1 0,5 2,6 4,5 4,1 2,0|2,4 4,6', R: '0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6',
    S: '4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5', T: '0,0 4,0|2,0 2,6', U: '0,0 0,5 1,6 3,6 4,5 4,0',
    V: '0,0 2,6 4,0', W: '0,0 1,6 2,3 3,6 4,0', X: '0,0 4,6|4,0 0,6', Y: '0,0 2,3 4,0|2,3 2,6', Z: '0,0 4,0 0,6 4,6',
    0: '2,0 0,1 0,5 2,6 4,5 4,1 2,0', 1: '1,1 2,0 2,6', 2: '0,1 1,0 3,0 4,1 4,2 0,6 4,6',
    3: '0,0 4,0 2,2 3,2 4,3 4,5 3,6 1,6 0,5', 4: '3,6 3,0 0,4 4,4', 5: '4,0 0,0 0,3 3,2 4,3 4,5 3,6 0,6',
    6: '4,0 2,0 0,2 0,5 1,6 3,6 4,5 4,4 3,3 0,3', 7: '0,0 4,0 1,6',
    8: '2,3 0,2 0,1 1,0 3,0 4,1 4,2 2,3 0,4 0,5 1,6 3,6 4,5 4,4 2,3', 9: '4,3 1,3 0,2 0,1 1,0 3,0 4,1 4,4 3,6 1,6',
    ':': '2,1.6 2,2.2|2,4.8 2,5.4', '.': '2,5.4 2,6', "'": '2,0 1.6,1.6', '-': '1,3.2 3,3', '?': '0,1 1,0 3,0 4,1 4,2 2,3 2,4|2,5.5 2,6',
    '!': '2,0 2,4|2,5.5 2,6', '·': '2,3 2,3.4',
  };
  const HSP = {};
  Object.keys(HS).forEach((k) => { HSP[k] = HS[k].split('|').map((s) => s.split(' ').map((p) => p.split(',').map(Number))); });

  // Returns the path segments of a handwritten string in px (before drawing), so callers can animate stroke-on.
  function handPaths(str, o) {
    const u = o.size || 2.2;
    const slant = o.slant === undefined ? 0.18 : o.slant;
    const seed = o.seed || 1;
    const ang = o.angle || 0;
    const co = Math.cos(ang); const si = Math.sin(ang);
    const paths = [];
    let cx = 0;
    let i = 0;
    for (const ch of str) {
      if (ch === ' ') { cx += 3.2 + K.hash(seed, i, 5) * 0.8; i++; continue; }
      const strokes = HSP[ch];
      if (!strokes) { i++; continue; }
      const sq = 0.86 + K.hash(seed, i, 6) * 0.22;
      const base = (K.hash(seed, i, 8) - 0.5) * 0.7;
      strokes.forEach((st, si2) => {
        const pts = st.map((p, pi) => {
          const jx = (K.hash(seed, i * 31 + si2 * 7 + pi, 1) - 0.5) * 0.5;
          const jy = (K.hash(seed, i * 31 + si2 * 7 + pi, 2) - 0.5) * 0.5;
          const lx = cx + p[0] * sq + jx + (6 - p[1]) * slant;
          const ly = p[1] + jy + base;
          return [o.x + (lx * co - ly * si) * u, o.y + (lx * si + ly * co) * u];
        });
        paths.push(pts);
      });
      cx += 4 * sq + 1.5 + K.hash(seed, i, 9) * 0.5;
      i++;
    }
    return { paths, width: cx * u };
  }
  // Draw handwriting; o.reveal (0..1) draws strokes progressively (pen order).
  function hand(str, o) {
    const { paths, width } = handPaths(str, o);
    const total = paths.reduce((a, p) => a + p.length - 1, 0);
    const lim = o.reveal === undefined ? Infinity : Math.floor(total * o.reveal + 0.0001);
    let n = 0;
    for (const p of paths) {
      for (let k = 0; k + 1 < p.length; k++) {
        if (n >= lim) return width;
        K.line(p[k][0], p[k][1], p[k + 1][0], p[k + 1][1], o.c, o.brush || 2);
        n++;
      }
    }
    return width;
  }
  // A hand stroke between two points with a mid-bow (underline, strike, arrow shaft): 2-pass, slightly off.
  function handStroke(x0, y0, x1, y1, o) {
    const seed = o.seed || 3;
    const bow = (K.hash(seed, 1, 1) - 0.5) * (o.bow || 3);
    const steps = 8;
    const rev = o.reveal === undefined ? 1 : o.reveal;
    let px0 = x0; let py0 = y0;
    for (let i = 1; i <= Math.ceil(steps * rev); i++) {
      const k = Math.min(1, i / steps);
      const nx = -(y1 - y0); const ny = x1 - x0;
      const len = Math.hypot(nx, ny) || 1;
      const b = Math.sin(k * Math.PI) * bow;
      const qx = x0 + (x1 - x0) * k + (nx / len) * b;
      const qy = y0 + (y1 - y0) * k + (ny / len) * b;
      K.line(px0, py0, qx, qy, o.c, o.brush || 2);
      px0 = qx; py0 = qy;
    }
  }

  B1.fonts = { joy, joyWidth, score, scoreWidth, scoreGlyph, boxArt, boxMask, hand, handPaths, handStroke };
})();

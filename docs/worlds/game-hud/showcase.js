/* ReelForge world showcase: game-hud ("the film as a video-game level"). Subject: Y2K.
 * Standalone: no network, no libraries. Every frame is a pure function of (shot, t):
 * no Math.random / Date / timers in the render path; "random" = integer hash of (seed, index).
 * 640x360 indexed framebuffer, 16-colour palette, ordered 4x4 Bayer dithering. */
'use strict';
(function () {
  const W = 640;
  const H = 360;
  const FPS = 30;

  // ---------------------------------------------------------------- palette
  const PALETTE = [
    ['#0d110e', 'ink'],
    ['#18201a', 'night'],
    ['#253228', 'deep moss'],
    ['#3a4d3c', 'moss'],
    ['#5d7556', 'fern'],
    ['#9cc583', 'phosphor'],
    ['#d9f2bd', 'phosphor light'],
    ['#2a241e', 'cabinet brown'],
    ['#54483a', 'umber'],
    ['#8c7c63', 'putty'],
    ['#c7b897', 'beige plastic'],
    ['#efe6cf', 'paper'],
    ['#e0522a', 'bug vermilion'],
    ['#f0a345', 'amber'],
    ['#2d4566', 'midnight'],
    ['#7d9fb8', 'haze'],
  ];
  const INK = 0, NIGHT = 1, DEEP = 2, MOSS = 3, FERN = 4, PHOS = 5, PHOS_L = 6, BROWN = 7;
  const UMBER = 8, PUTTY = 9, BEIGE = 10, PAPER = 11, BUG = 12, AMBER = 13, MIDNIGHT = 14, HAZE = 15;
  /** One step darker for every colour (shadows, dims, fades). */
  const SHADE = [INK, INK, NIGHT, DEEP, MOSS, FERN, PHOS, INK, BROWN, UMBER, PUTTY, BEIGE, BROWN, UMBER, NIGHT, MIDNIGHT];
  const LUT = new Uint32Array(16);
  PALETTE.forEach(([hex], i) => {
    const v = parseInt(hex.slice(1), 16);
    LUT[i] = (255 << 24) | ((v & 255) << 16) | (((v >> 8) & 255) << 8) | ((v >> 16) & 255);
  });

  // ---------------------------------------------------------------- determinism helpers
  function hash(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e37, 0x165667b1) ^ Math.imul((c | 0) + 0x7f4a, 0x61c88647);
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, u) => a + (b - a) * u;
  const outBack = (u, s = 1.9) => 1 + (s + 1) * (u - 1) ** 3 + s * (u - 1) ** 2;
  const outQuint = (u) => 1 - (1 - u) ** 5;
  const outCubic = (u) => 1 - (1 - u) ** 3;
  const inCubic = (u) => u * u * u;
  const inOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
  const step = (t, period, n) => Math.floor(t / period) % n;

  /** Irregular typewriter: characters revealed by time t (seeded cadence, pauses after spaces/punctuation). */
  function typed(s, t, t0, seed, cps) {
    if (t < t0) return 0;
    let acc = t0;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      let d = (1 / cps) * (0.5 + 1.0 * hash(seed, i, 3));
      if (ch === ' ') d *= 1.7;
      if (',.:;?'.includes(ch)) d += 0.11;
      if (hash(seed, i, 9) < 0.09) d += 0.16; // a hesitation, like a finger looking for the key
      acc += d;
      if (acc > t) return i;
    }
    return s.length;
  }
  /** Screen shake with exponential decay, re-rolled at 30 fps (integer pixels). */
  function shake(t, t0, amp, decay, seed) {
    if (t < t0) return [0, 0];
    const e = amp * Math.exp(-(t - t0) * decay);
    if (e < 0.5) return [0, 0];
    const f = Math.floor((t - t0) * FPS);
    return [Math.round((hash(seed, f, 1) * 2 - 1) * e), Math.round((hash(seed, f, 2) * 2 - 1) * e * 0.6)];
  }

  // ---------------------------------------------------------------- framebuffer + primitives
  // Two render targets: the screen (640x360, HUD + UI, crisp) and the game world (320x180, blitted 2x,
  // so world pixels and world dithering are chunky while HUD text stays sharp).
  const fb = new Uint8Array(W * H);
  const tmp = new Uint8Array(W * H);
  const WW = 320;
  const WH = 180;
  const wb = new Uint8Array(WW * WH);
  let BUF = fb, BW = W, BH = H;
  let CX0 = 0, CY0 = 0, CX1 = W, CY1 = H;
  let ALPHA = 1; // global dithered opacity for fades
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const on = (x, y, v) => v * 16 > BAYER[((y & 3) << 2) | (x & 3)] + 0.5;
  function setClip(x, y, w, h) { CX0 = Math.max(0, x); CY0 = Math.max(0, y); CX1 = Math.min(BW, x + w); CY1 = Math.min(BH, y + h); }
  function noClip() { CX0 = 0; CY0 = 0; CX1 = BW; CY1 = BH; }
  function beginWorld() { BUF = wb; BW = WW; BH = WH; noClip(); wb.fill(INK); }
  function endWorld() {
    for (let y = 0; y < H; y += 1) {
      const src = (y >> 1) * WW, dst = y * W;
      for (let x = 0; x < W; x += 1) fb[dst + x] = wb[src + (x >> 1)];
    }
    BUF = fb; BW = W; BH = H; noClip();
  }
  function px(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < CX0 || y < CY0 || x >= CX1 || y >= CY1) return;
    if (ALPHA < 1 && !on(x, y, ALPHA)) return;
    BUF[y * BW + x] = c;
  }
  function rect(x, y, w, h, c) {
    x = Math.round(x); y = Math.round(y);
    const x0 = Math.max(CX0, x), y0 = Math.max(CY0, y), x1 = Math.min(CX1, x + w), y1 = Math.min(CY1, y + h);
    for (let j = y0; j < y1; j += 1) {
      const r = j * BW;
      for (let i = x0; i < x1; i += 1) if (ALPHA >= 1 || on(i, j, ALPHA)) BUF[r + i] = c;
    }
  }
  /** Rectangle drawn with dithered coverage v (0..1). */
  function rectD(x, y, w, h, c, v) {
    x = Math.round(x); y = Math.round(y);
    const x0 = Math.max(CX0, x), y0 = Math.max(CY0, y), x1 = Math.min(CX1, x + w), y1 = Math.min(CY1, y + h);
    for (let j = y0; j < y1; j += 1) for (let i = x0; i < x1; i += 1) if (on(i, j, v)) BUF[j * BW + i] = c;
  }
  /** Darken existing pixels one palette step with dithered coverage v. */
  function shadeRect(x, y, w, h, v) {
    x = Math.round(x); y = Math.round(y);
    const x0 = Math.max(CX0, x), y0 = Math.max(CY0, y), x1 = Math.min(CX1, x + w), y1 = Math.min(CY1, y + h);
    for (let j = y0; j < y1; j += 1) for (let i = x0; i < x1; i += 1) if (on(i, j, v)) BUF[j * BW + i] = SHADE[BUF[j * BW + i]];
  }
  /** Vertical gradient through colour stops [[pos 0..1, colour], ...] with Bayer dithering. */
  function gradV(x, y, w, h, stops) {
    for (let j = 0; j < h; j += 1) {
      const f = h > 1 ? j / (h - 1) : 0;
      let k = 0;
      while (k < stops.length - 2 && f > stops[k + 1][0]) k += 1;
      const [p0, c0] = stops[k], [p1, c1] = stops[k + 1];
      const u = clamp((f - p0) / (p1 - p0));
      const yy = y + j;
      if (yy < CY0 || yy >= CY1) continue;
      for (let i = Math.max(CX0, x); i < Math.min(CX1, x + w); i += 1) BUF[yy * BW + i] = on(i, yy, u) ? c1 : c0;
    }
  }
  /** Radial dithered darkening towards the edges of the current target. */
  function vignette(strength, cx, cy) {
    for (let y = 0; y < BH; y += 1) for (let x = 0; x < BW; x += 1) {
      const dx = (x - cx) / (BW * 0.62), dy = (y - cy) / (BH * 0.62);
      const v = clamp((dx * dx + dy * dy - 0.2) * 1.6) * strength;
      if (v > 0 && on(x, y, v)) BUF[y * BW + x] = SHADE[BUF[y * BW + x]];
    }
  }
  function line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      px(x0, y0, c);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** Filled ellipse (rows), optional dithered coverage v. */
  function ellipse(cx, cy, rx, ry, c, v) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const hw = rx * Math.sqrt(1 - dy * dy);
      const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
      if (v === undefined) rect(x0, y, x1 - x0, 1, c); else rectD(x0, y, x1 - x0, 1, c, v);
    }
  }
  /** A hand stroke: wobbling polyline, partially drawn up to `progress`, 1 or 2 px thick. */
  function handStroke(x0, y0, x1, y1, c, seed, wob, progress, thick) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(len / 7));
    const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const u = i / n;
      const off = (i === 0 || i === n ? 0.3 : 1) * (hash(seed, i, 5) - 0.5) * wob + Math.sin(u * 3.1) * wob * 0.35;
      pts.push([lerp(x0, x1, u) + nx * off, lerp(y0, y1, u) + ny * off]);
    }
    const lastSeg = progress * n;
    for (let i = 0; i < n && i < lastSeg; i += 1) {
      const u = clamp(lastSeg - i);
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const ex = lerp(ax, bx, u), ey = lerp(ay, by, u);
      line(ax, ay, ex, ey, c);
      if (thick) line(ax, ay + 1, ex, ey + 1, c);
    }
  }
  /** Grease-pencil loop: not closed, overlaps itself, radius wobbles. */
  function handLoop(cx, cy, rx, ry, c, seed, progress) {
    const a0 = -2.3 + hash(seed, 1, 1) * 0.4, sweep = Math.PI * 2 * 1.12;
    const n = 44;
    let prev = null;
    for (let i = 0; i <= n * progress; i += 1) {
      const u = i / n, a = a0 + sweep * u;
      const r = 1 + (hash(seed, Math.floor(u * 6), 2) - 0.5) * 0.12 + u * 0.07;
      const p = [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
      if (prev) { line(prev[0], prev[1], p[0], p[1], c); line(prev[0] + 1, prev[1], p[0] + 1, p[1], c); }
      prev = p;
    }
  }
  /** Shift the screen (screen shake); revealed edge filled with `fill`. */
  function shiftFb(dx, dy, fill) {
    if (!dx && !dy) return;
    tmp.set(fb);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const sx = x - dx, sy = y - dy;
      fb[y * W + x] = sx < 0 || sy < 0 || sx >= W || sy >= H ? fill : tmp[sy * W + sx];
    }
  }

  // ---------------------------------------------------------------- fonts
  // "Forge Mono" 5x7 (copied from packages/engine/src/text/font-mono.ts, our own CC0 font).
  const MONO_SRC = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.###./#...#/#..../#..../#..../#...#/.###.', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '.###./..#../..#../..#../..#../..#../.###.', J: '..###/...#./...#./...#./...#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/#...#/##..#/#.#.#/#..##/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/#...#/.#.#./..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.',
    2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '#####/...#./..#../...#./....#/#...#/.###.',
    4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '..##./.#.../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/...#./.##..',
    '.': '...../...../...../...../...../.##../.##..', ',': '...../...../...../...../...../.##../..#../.#...',
    ':': '...../.##../.##../...../.##../.##../.....', '!': '..#../..#../..#../..#../..#../...../..#..',
    '?': '.###./#...#/....#/...#./..#../...../..#..', "'": '..#../..#../...../...../...../...../.....',
    '-': '...../...../...../.###./...../...../.....', '+': '...../..#../..#../#####/..#../..#../.....',
    '=': '...../...../#####/...../#####/...../.....', '/': '....#/....#/...#./..#../.#.../#..../#....',
    '(': '...#./..#../.#.../.#.../.#.../..#../...#.', ')': '.#.../..#../...#./...#./...#./..#../.#...',
    '*': '...../#.#.#/.###./#####/.###./#.#.#/.....', _: '...../...../...../...../...../...../#####',
    $: '..#../.####/#.#../.###./..#.#/####./..#..', '>': '.#.../..#../...#./....#/...#./..#../.#...',
    '→': '...../..#../...#./#####/...#./..#../.....',
  };
  // "Cartridge Display" 8x12 (cell 8, cap 12): chamfered arcade caps with 2-px stems. Authored here, CC0.
  const DISPLAY_SRC = {
    A: '..###../.#####./##...##/##...##/##...##/##...##/#######/#######/##...##/##...##/##...##/##...##',
    B: '######./#######/##...##/##...##/##..##./######./#######/##...##/##...##/##...##/#######/######.',
    C: '.######/#######/##...../##...../##...../##...../##...../##...../##...../##...../#######/.######',
    D: '#####../######./##..###/##...##/##...##/##...##/##...##/##...##/##...##/##..###/######./#####..',
    E: '#######/#######/##...../##...../##...../######./######./##...../##...../##...../#######/#######',
    F: '#######/#######/##...../##...../##...../######./######./##...../##...../##...../##...../##.....',
    G: '.######/#######/##...../##...../##...../##..###/##..###/##...##/##...##/##...##/#######/.######',
    H: '##...##/##...##/##...##/##...##/##...##/#######/#######/##...##/##...##/##...##/##...##/##...##',
    I: '######/######/..##../..##../..##../..##../..##../..##../..##../..##../######/######',
    J: '..#####/..#####/....##./....##./....##./....##./....##./....##./##..##./##..##./######./.####..',
    K: '##...##/##...##/##..##./##.##../####.../###..../###..../####.../##.##../##..##./##...##/##...##',
    L: '##...../##...../##...../##...../##...../##...../##...../##...../##...../##...../#######/#######',
    M: '##...##/###.###/#######/##.#.##/##.#.##/##...##/##...##/##...##/##...##/##...##/##...##/##...##',
    N: '##...##/###..##/###..##/####.##/####.##/##.####/##.####/##..###/##..###/##...##/##...##/##...##',
    O: '.#####./#######/##...##/##...##/##...##/##...##/##...##/##...##/##...##/##...##/#######/.#####.',
    P: '######./#######/##...##/##...##/##...##/#######/######./##...../##...../##...../##...../##.....',
    Q: '.#####./#######/##...##/##...##/##...##/##...##/##...##/##.#.##/##.####/##..##./######./.####.#',
    R: '######./#######/##...##/##...##/##...##/#######/######./##.##../##..##./##..##./##...##/##...##',
    S: '.######/#######/##...../##...../###..../.#####./..#####/.....##/.....##/.....##/#######/######.',
    T: '######/######/..##../..##../..##../..##../..##../..##../..##../..##../..##../..##..',
    U: '##...##/##...##/##...##/##...##/##...##/##...##/##...##/##...##/##...##/##...##/#######/.#####.',
    V: '##...##/##...##/##...##/##...##/##...##/##...##/##...##/.##.##./.##.##./.##.##./..###../...#...',
    W: '##...##/##...##/##...##/##...##/##...##/##...##/##.#.##/##.#.##/##.#.##/#######/###.###/.#...#.',
    X: '##...##/##...##/.##.##./.##.##./..###../..###../..###../..###../.##.##./.##.##./##...##/##...##',
    Y: '##...##/##...##/##...##/.##.##./.##.##./..###../..###../..###../..###../..###../..###../..###..',
    Z: '#######/#######/.....##/....###/...###./..###../.###.../###..../##...../##...../#######/#######',
    0: '.#####./#######/##...##/##...##/##..###/##.#.##/##.#.##/###..##/##...##/##...##/#######/.#####.',
    1: '..##../.###../####../..##../..##../..##../..##../..##../..##../..##../######/######',
    2: '.#####./#######/##...##/.....##/.....##/....###/..####./.###.../##...../##...../#######/#######',
    3: '######./#######/.....##/.....##/.....##/..####./..#####/.....##/.....##/.....##/#######/######.',
    4: '##...##/##...##/##...##/##...##/##...##/#######/#######/.....##/.....##/.....##/.....##/.....##',
    5: '#######/#######/##...../##...../######./#######/.....##/.....##/.....##/##...##/#######/.#####.',
    6: '.######/#######/##...../##...../##...../######./#######/##...##/##...##/##...##/#######/.#####.',
    7: '#######/#######/.....##/.....##/....##./....##./...##../...##../..##.../..##.../..##.../..##...',
    8: '.#####./#######/##...##/##...##/##...##/.#####./#######/##...##/##...##/##...##/#######/.#####.',
    9: '.#####./#######/##...##/##...##/##...##/#######/.######/.....##/.....##/.....##/######./#####..',
    ':': '../../../##/##/../../../##/##/../..',
    '.': '../../../../../../../../../../##/##',
    '$': '...#.../.######/##.#.../##.#.../##.#.../.#####./...#.##/...#.##/...#.##/######./...#.../...#...',
    '-': '...../...../...../...../...../#####/#####/...../...../...../...../.....',
    '=': '...../...../...../#####/#####/...../...../#####/#####/...../...../.....',
    '+': '....../....../....../..##../..##../######/######/..##../..##../....../....../......',
    '?': '.#####./#######/##...##/.....##/....##./...##../..##.../..##.../......./......./..##.../..##...',
  };
  function compileFont(src, spacing, space, cap) {
    const glyphs = {};
    for (const [ch, s] of Object.entries(src)) {
      const rows = s.split('/');
      glyphs[ch] = { w: rows[0].length, rows };
    }
    return { glyphs, spacing, space, cap };
  }
  const MONO = compileFont(MONO_SRC, 1, 6, 7);
  const DISP = compileFont(DISPLAY_SRC, 1, 5, 12);
  MONO.fixed = 6;
  function advance(font, ch) {
    if (font.fixed) return font.fixed;
    if (ch === ' ') return font.space;
    const g = font.glyphs[ch];
    return (g ? g.w : 5) + font.spacing;
  }
  function textWidth(font, s, scale = 1) {
    let w = 0;
    for (const ch of s) w += advance(font, ch) * scale;
    return w - font.spacing * scale;
  }
  /** Draws text; o: { scale, count (typewriter), shadow colour, wobble seed (per-glyph 1px baseline jitter), colours[] per char }. */
  function text(font, s, x, y, c, o = {}) {
    const scale = o.scale || 1;
    const count = o.count === undefined ? s.length : o.count;
    let cx = Math.round(x);
    for (let i = 0; i < s.length && i < count; i += 1) {
      const ch = s[i];
      const g = font.glyphs[ch];
      const col = o.colours ? o.colours[i] : c;
      const jy = o.wobble ? (hash(o.wobble, i, 4) < 0.22 ? 1 : 0) : 0;
      if (g) {
        for (let r = 0; r < g.rows.length; r += 1) for (let k = 0; k < g.w; k += 1) {
          if (g.rows[r][k] !== '#') continue;
          const gx = cx + k * scale, gy = Math.round(y) + (r + jy) * scale;
          if (o.shadow !== undefined) rect(gx + scale, gy + scale, scale, scale, o.shadow);
          rect(gx, gy, scale, scale, col);
        }
      }
      cx += advance(font, ch) * scale;
    }
    return cx - Math.round(x);
  }
  // shadows must not overwrite neighbouring ink: draw shadow pass first when requested
  function textS(font, s, x, y, c, shadow, o = {}) {
    text(font, s, x + (o.scale || 1), y + (o.scale || 1), shadow, { ...o, shadow: undefined, colours: undefined });
    text(font, s, x, y, c, { ...o, shadow: undefined });
  }

  // ---------------------------------------------------------------- sprites
  const KEY = { k: INK, n: NIGHT, H: PAPER, h: PUTTY, s: BEIGE, S: PUTTY, l: HAZE, w: HAZE, W: MIDNIGHT, t: MOSS, u: UMBER, U: BROWN, P: PAPER, G: PHOS, f: FERN, a: AMBER, b: BUG, d: DEEP, m: MOSS, i: INK };
  function sprite(rows, x, y, flip, map) {
    const m = map || KEY;
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r += 1) for (let k = 0; k < rows[r].length; k += 1) {
      const ch = rows[r][k];
      if (ch === '.') continue;
      px(x + (flip ? w - 1 - k : k), y + r, m[ch]);
    }
  }
  // The hero: a 1999 COBOL programmer. Bald crown, white side hair, big glasses, short-sleeve shirt + tie,
  // folded green-bar printout under the arm. Facing right. 15 px wide; torso 14 rows + legs 8 rows.
  const HERO_TOP = [
    '.....kkkkk.....',
    '....ksssssk....',
    '...kHssssssk...',
    '...kHssssssSk..',
    '...kHsskkkkkkk.',
    '...kHsskllklk..',
    '...kHsskkkkkk..',
    '....kssssssSk..',
    '....kSsssskk...',
    '.....kkSSkk....',
    '..kkkwwttwk....',
    '.kPGPkwwtwwk...',
    '.kPPPkwwtwwkk..',
    '.kGPPkWwtwwkssk',
    '..kkkWWwtwwkkk.',
    '....kkkkkkkk...',
  ];
  const HERO_LEGS = {
    stand: [
      '....kuUuuuk....', '....kuUkuuk....', '....kuUkuuk....', '....kuUkuuk....',
      '....kuUkuuk....', '....kUUkuuk....', '....kkkkkkkk...', '....kkkkkkkkk..',
    ],
    run1: [
      '....kuuuuuk....', '...kUUuuuuuk...', '..kUUk..kuuuk..', '..kUk....kuuk..',
      '.kUk.....kuuk..', '.kUk......kuuk.', 'kkk.......kkkkk', 'kk.............',
    ],
    run2: [
      '....kuuuuuk....', '....kuUuuuk....', '....kuUUuk.....', '...kuuk.kUk....',
      '...kuuk.kUUk...', '..kkkkk..kUk...', '........kkkk...', '...............',
    ],
    run3: [
      '....kuuuuuk....', '...kuuuUUUUk...', '..kuuk..kUUUk..', '..kuk....kUUk..',
      '.kuuk.....kUUk.', '.kuk.......kUk.', 'kkk........kkkk', 'kk.............',
    ],
    run4: [
      '....kuuuuuk....', '....kUuuuuk....', '....kUuuuk.....', '...kUUk.kuk....',
      '...kUUk.kuuk...', '..kkkkk..kuk...', '........kkkk...', '...............',
    ],
    air: [
      '....kuuuuuk....', '...kuuUUuuuk...', '..kuuk.kUUuuk..', '..kuuk..kkkUk..',
      '..kkkk....kkk..', '...............', '...............', '...............',
    ],
    crouch: [
      '...kuuuUuuuk...', '..kuuk..kUUUk..', '.kkkkk...kkkkk.', '...............',
      '...............', '...............', '...............', '...............',
    ],
  };
  /** feetY = ground line; squash = rows the torso sinks (crouch/landing). */
  function drawHero(x, feetY, legs, opts = {}) {
    const legRows = HERO_LEGS[legs];
    const legH = legs === 'crouch' ? 3 : legs === 'air' ? 5 : 8;
    const top = feetY - legH - HERO_TOP.length + (opts.bob || 0);
    let torso = HERO_TOP;
    if (opts.glint) torso = torso.map((r, i) => (i === 5 ? r.replace('kllk', 'kHlk') : r));
    sprite(torso, x, top, false);
    sprite(legRows.slice(0, legH), x, top + HERO_TOP.length - 1, false);
  }

  // ---------------------------------------------------------------- film timeline + HUD
  const SHOT_DUR = [7, 8, 8, 8, 7];
  const SHOT_START = SHOT_DUR.reduce((acc, d, i) => (acc.push(i ? acc[i - 1] + SHOT_DUR[i - 1] : 0), acc), []);
  const TOTAL = SHOT_START[4] + SHOT_DUR[4];
  const PROGRESS_END = TOTAL - 1.6; // the bar arrives a beat before the film ends, so the last flag can land
  const CHAPTERS = [
    { at: 0, name: '1999' },
    { at: SHOT_START[2], name: 'AUDIT' },
    { at: SHOT_START[3], name: 'MIDNIGHT' },
    { at: SHOT_START[4], name: '2000' },
    { at: PROGRESS_END, name: '' },
  ];
  // Facts the narration states, in order. Score = how many the viewer has heard.
  const FACTS = [
    { at: SHOT_START[0] + 4.75, label: '2 DIGITS' },
    { at: SHOT_START[1] + 2.95, label: 'SAVE MEMORY' },
    { at: SHOT_START[2] + 3.1, label: 'READ AS 1900' },
    { at: SHOT_START[2] + 5.75, label: 'CODE CHECKED' },
    { at: SHOT_START[3] + 5.55, label: '1 JAN 2000' },
    { at: SHOT_START[4] + 2.6, label: '$300 BILLION' },
    { at: SHOT_START[4] + 3.75, label: 'KEPT RUNNING' },
  ];
  const BAR_X0 = 106, BAR_X1 = 404, HUD_Y = 24;
  const barX = (filmT) => Math.round(lerp(BAR_X0, BAR_X1, clamp(filmT / PROGRESS_END)));
  const HEAD_ICON = ['.ss.', 'Hsss', 'Hkkk', '.ss.', 'kwwk'];

  function drawFlag(x, y, raise, colour) {
    // pole 1x10, cloth 5x4 that climbs the pole as `raise` goes 0..1
    rect(x, y, 1, 10, PUTTY);
    const cy = Math.round(lerp(y + 6, y, raise));
    const c = raise > 0.01 ? colour : MOSS;
    rect(x + 1, cy, 5, 3, c);
    rect(x + 1, cy + 3, 3, 1, c);
  }
  /** o: { boot: seconds since the HUD started booting (default: fully on), alpha, bossBar } */
  function drawHud(filmT, o = {}) {
    const boot = o.boot === undefined ? 99 : o.boot;
    if (boot <= 0) return;
    const prevAlpha = ALPHA;
    ALPHA = o.alpha === undefined ? 1 : o.alpha;
    const y = HUD_Y;
    // chapter flag + label
    let chapter = CHAPTERS[0];
    for (const ch of CHAPTERS) if (filmT >= ch.at && ch.name) chapter = ch;
    if (boot > 0.12) {
      drawFlag(40, y, outBack(seg(boot, 0.12, 0.42)), PHOS);
      const since = filmT - chapter.at;
      const n = chapter.at === 0 ? typed(chapter.name, boot, 0.3, 21, 14) : typed(chapter.name, since, 0.55, 22, 11);
      textS(MONO, chapter.name, 50, y + 2, PHOS_L, INK, { count: n });
    }
    // progress track: draws itself left to right with two hitches (loading), then shows film progress
    if (boot > 0.34) {
      const load = boot < 1.2 ? (seg(boot, 0.34, 0.55) * 0.42 + seg(boot, 0.66, 0.78) * 0.4 + seg(boot, 0.95, 1.08) * 0.18) : 1;
      const trackEnd = Math.round(lerp(BAR_X0, BAR_X1, load));
      for (let x = BAR_X0; x <= trackEnd; x += 2) px(x, y + 6, MOSS);
      const fx = Math.min(trackEnd, barX(filmT));
      rect(BAR_X0, y + 5, fx - BAR_X0 + 1, 3, PHOS);
      rect(BAR_X0, y + 8, fx - BAR_X0 + 1, 1, FERN);
      // checkpoint flags on the track (passed ones raised)
      CHAPTERS.forEach((ch, i) => {
        if (i === 0) return;
        const cx = barX(ch.at);
        if (cx > trackEnd) return;
        const raise = outBack(seg(filmT, ch.at + 0.45, ch.at + 0.8));
        rect(cx, y + 1, 1, 8, raise > 0 ? PUTTY : MOSS);
        if (raise > 0) { rect(cx + 1, Math.round(lerp(y + 5, y + 1, raise)), 3, 2, PHOS); }
        else rect(cx + 1, y + 5, 2, 1, MOSS);
      });
      if (load >= 1) sprite(HEAD_ICON, fx - 2, y - 2, false);
    }
    // score: two digits, deliberately (the counter itself only has room for two)
    if (boot > 0.7) {
      let score = 0, last = null;
      for (const f of FACTS) if (filmT >= f.at) { score += 1; last = f; }
      textS(MONO, 'FACTS', 532, y + 2, PUTTY, INK);
      const digits = String(score).padStart(2, '0');
      const pop = last ? filmT - last.at : 9;
      const lift = pop < 0.22 ? -Math.round(3 * Math.sin((pop / 0.22) * Math.PI)) : 0;
      textS(DISP, digits, 568, y - 2 + lift, PHOS_L, INK);
      if (last && pop < 2.6) {
        // typed in, held, then backspaced away (no fade: a HUD line is either there or not)
        const label = '+1 ' + last.label;
        const n = typed(label, pop, 0.04, 31 + score, 34) - typed(label, pop, 1.7, 61 + score, 30);
        const lx = 584 - textWidth(MONO, label);
        textS(MONO, label, lx, y + 16 + Math.round(outCubic(seg(pop, 0, 0.3)) * 2), PHOS, INK, { count: n });
      }
    }
    ALPHA = prevAlpha;
  }

  /** Stage-transition blinds: uneven bands that close (or open) with seeded delays. */
  function blinds(t, t0, dur, closing, seed) {
    if (t < t0 && closing) return;
    let y = 0, i = 0;
    while (y < H) {
      const bh = 14 + Math.floor(hash(seed, i, 1) * 12);
      const d = hash(seed, i, 2) * dur * 0.4;
      const u = seg(t, t0 + d, t0 + d + dur * 0.6);
      const cov = closing ? inCubic(u) : 1 - outCubic(u);
      rect(0, y, W, Math.ceil(cov * bh), INK);
      y += bh; i += 1;
    }
  }

  // ---------------------------------------------------------------- world of 1999 (shots 2 + 3), world units (320x180)
  const GROUND = 150;
  const SKYLINE = (() => {
    const out = [];
    let x = -40, i = 0;
    while (x < 800) {
      const w = 7 + Math.floor(hash(11, i, 1) * 16);
      const h = 12 + Math.floor(hash(11, i, 2) * 36) + (i % 7 === 3 ? 18 : 0);
      out.push({ x, w, h, i });
      x += w + (hash(11, i, 3) < 0.35 ? 2 + Math.floor(hash(11, i, 4) * 6) : 0);
      i += 1;
    }
    return out;
  })();
  function drawSkyline(offset, baseY, colour, amber, umber) {
    for (const b of SKYLINE) {
      const x = Math.round(b.x - offset);
      if (x > BW || x + b.w < 0) continue;
      rect(x, baseY - b.h, b.w, b.h, colour);
      if (b.i % 5 === 1) rect(x + 2, baseY - b.h - 3, 1, 3, colour); // an antenna here and there
      for (let wy = baseY - b.h + 3; wy < baseY - 3; wy += 4) for (let wx = x + 2; wx < x + b.w - 2; wx += 3) {
        const r = hash(b.i, wx - x, wy);
        if (r < amber) px(wx, wy, AMBER);
        else if (r < amber + umber) px(wx, wy, UMBER);
      }
    }
  }
  function drawBank(x, base) {
    rect(x, base - 2, 46, 2, MOSS); rect(x + 2, base - 4, 42, 2, MOSS); // steps
    rect(x + 4, base - 26, 38, 22, DEEP);
    for (let c = 0; c < 5; c += 1) { rect(x + 5 + c * 8, base - 26, 4, 22, FERN); rect(x + 8 + c * 8, base - 26, 1, 22, MOSS); }
    rect(x + 2, base - 35, 42, 9, FERN);
    text(MONO, 'BANK', x + 12, base - 34, DEEP);
    for (let r = 0; r < 7; r += 1) rect(x + 2 + r * 3, base - 36 - r, 42 - r * 6, 1, MOSS); // pediment
  }
  function drawTower(x, base) {
    rect(x + 8, base - 52, 5, 52, MOSS); rect(x + 8, base - 52, 1, 52, FERN);
    rect(x + 1, base - 63, 19, 11, MOSS); rect(x + 3, base - 60, 15, 3, AMBER);
    for (let k = 0; k < 3; k += 1) rect(x + 6 + k * 4, base - 60, 1, 3, MOSS);
    rect(x, base - 65, 21, 2, FERN); rect(x + 10, base - 71, 1, 6, PUTTY);
    rect(x - 22, base - 13, 62, 13, DEEP); rect(x - 22, base - 13, 62, 1, MOSS); // terminal
    text(MONO, 'AIRPORT', x - 12, base - 10, MOSS);
  }
  function drawPylon(x, base) {
    const hgt = 58, top = base - hgt;
    line(x, base, x + 7, top + 3, FERN); line(x + 14, base, x + 7, top + 3, FERN);
    for (let k = 0; k < 5; k += 1) {
      const y0 = base - k * 11, y1 = base - (k + 1) * 11;
      const w0 = lerp(7, 1, (base - y0) / hgt), w1 = lerp(7, 1, (base - y1) / hgt);
      line(x + 7 - w0, y0, x + 7 + w1, y1, MOSS); line(x + 7 + w0, y0, x + 7 - w1, y1, MOSS);
    }
    rect(x - 3, top + 8, 21, 1, FERN); rect(x, top + 2, 15, 1, FERN);
  }
  function drawWires(x0, x1, base) {
    for (const [dy, sag] of [[-50, 6], [-56, 5]]) {
      let prev = null;
      for (let k = 0; k <= 20; k += 1) {
        const u = k / 20, x = lerp(x0, x1, u), y = base + dy + Math.sin(u * Math.PI) * sag;
        if (prev) line(prev[0], prev[1], x, y, MOSS);
        prev = [x, y];
      }
    }
  }
  const PRINT_LINES = ['05 YR PIC 99.', 'MOVE YR TO OUT-YR.', 'ADD 1 TO YR.', '* TODO: 4 DIGITS', 'IF YR > 99'];
  /** Ground = fanfold green-bar printout: tractor holes, perforations, faint printed COBOL. */
  function drawPaperGround(camX, top) {
    // the page lies in the dark: low values throughout, only its top edge catches light
    rect(0, top, WW, WH - top, UMBER);
    for (let y = top + 5; y < WH; y += 1) if (Math.floor((y - top - 5) / 4) % 2 === 0) rectD(0, y, WW, 1, MOSS, 0.5);
    rect(0, top, WW, 1, BEIGE); rect(0, top + 1, WW, 1, PUTTY);
    const off = ((Math.round(camX) % 8) + 8) % 8;
    for (let x = -off; x < WW; x += 8) rect(x + 2, top + 3, 2, 2, INK);
    const p0 = Math.floor(camX / 128);
    for (let p = p0; p <= p0 + 3; p += 1) {
      const x = Math.round(p * 128 - camX);
      for (let y = top + 2; y < WH; y += 2) px(x, y, BROWN);
      const s = PRINT_LINES[((p % PRINT_LINES.length) + PRINT_LINES.length) % PRINT_LINES.length];
      text(MONO, s, x + 9 + Math.floor(hash(p, 3, 3) * 18), top + (p % 2 ? 11 : 20), BROWN); // faint dot-matrix print
    }
  }
  function cameraX(t) {
    // speed profile: ease in, cruise, brake to a stop (hold), start again; integrated at 240 Hz
    let x = 0;
    const dt = 1 / 240;
    for (let s = 0; s < t; s += dt) {
      const v = 64 * inOutCubic(seg(s, 0, 0.7)) * (1 - outCubic(seg(s, 4.55, 5.25))) + 78 * inCubic(seg(s, 6.75, 7.6));
      x += v * dt;
    }
    return x;
  }
  const HERO_SX = 70;
  /** Distance-driven run cycle with uneven frame holds (4, 5, 3, 6 world px). */
  function runFrame(dist) {
    const strides = [4, 5, 3, 6];
    let d = ((dist % 18) + 18) % 18;
    for (let k = 0; k < 4; k += 1) { if (d < strides[k]) return ['run1', 'run2', 'run3', 'run4'][k]; d -= strides[k]; }
    return 'run1';
  }
  const JUMP_PRESS = 2.42, JUMP_OFF = 2.5, JUMP_LAND = 3.12, BLOCK_HIT = 2.81, JUMP_H = 24;
  const BLOCK_WX = Math.round(cameraX(BLOCK_HIT) + HERO_SX) + 1;
  const BUG_E0 = cameraX(5.3) + 326;
  const BUG_HOPS = [5.72, 6.1, 6.42, 6.9, 7.24, 7.62];
  const BUG_STEP = [14, 11, 13, 9, 12, 10];
  function bugX(t, camX) {
    let x = BUG_E0;
    BUG_HOPS.forEach((h, i) => { x -= BUG_STEP[i] * outCubic(seg(t, h, h + 0.16)); });
    return Math.round(x - camX);
  }
  function drawBug(x, t) {
    const hopping = BUG_HOPS.some((h) => t >= h && t < h + 0.16);
    const walk = hopping ? step(t, 0.08, 2) : 0;
    text(DISP, '00', x, GROUND - 15, BUG);
    const legs = [['b.b', '.b.'], ['.b.', 'b.b']];
    sprite(legs[walk], x + 2, GROUND - 3, false); sprite(legs[1 - walk], x + 10, GROUND - 3, false);
  }
  function drawLevel(t, camX, frozen) {
    gradV(0, 0, WW, GROUND, [[0, INK], [0.5, NIGHT], [1, DEEP]]);
    drawSkyline(camX * 0.25 + 20, GROUND - 1, DEEP, 0.012, 0.13);
    // far away, the city's millennium clock: the boss of shot 4, still only a sign on a tower
    const fx = Math.round(236 - camX * 0.25);
    rect(fx, 66, 22, GROUND - 66, DEEP); rect(fx + 10, 40, 2, 8, DEEP);
    rect(fx - 6, 48, 34, 14, BROWN); rect(fx - 6, 48, 34, 1, UMBER);
    text(MONO, '1999', fx - 1, 52, UMBER);
    const mid = camX * 0.55;
    drawBank(Math.round(116 - mid), GROUND);
    drawTower(Math.round(262 - mid), GROUND);
    drawPylon(Math.round(372 - mid), GROUND); drawPylon(Math.round(462 - mid), GROUND);
    drawWires(Math.round(379 - mid), Math.round(469 - mid), GROUND);
    drawWires(Math.round(469 - mid), Math.round(559 - mid), GROUND);
    drawPaperGround(camX, GROUND);
    // the "19" block: a beige plastic key the hero bumps; the 19 flies off and is gone
    const bx = Math.round(BLOCK_WX - camX), by = 92;
    const bump = t >= BLOCK_HIT ? -Math.round(3 * Math.sin(seg(t, BLOCK_HIT, BLOCK_HIT + 0.16) * Math.PI)) : 0;
    const used = t >= BLOCK_HIT;
    rect(bx - 1, by + bump - 1, 15, 14, INK);
    rect(bx, by + bump, 13, 12, used ? UMBER : BEIGE);
    rect(bx, by + bump + 10, 13, 2, used ? BROWN : PUTTY);
    rect(bx, by + bump, 13, 1, used ? PUTTY : PAPER);
    if (!used) text(MONO, '19', bx + 1, by + 2, DEEP);
    if (used && !frozen) {
      const u = seg(t, BLOCK_HIT, BLOCK_HIT + 0.95);
      if (u < 1) {
        ALPHA = 1 - u * u;
        textS(MONO, '19', bx + 1 + u * 40, by - 3 - 38 * u + 30 * u * u, PAPER, INK);
        ALPHA = 1;
      }
    }
  }
  function heroState(t, camX) {
    const running = () => {
      const f = runFrame(camX);
      return { legs: f, lift: 0, bob: f === 'run2' || f === 'run4' ? 1 : 0 };
    };
    if (t < JUMP_PRESS) return running();
    if (t < JUMP_OFF) return { legs: 'crouch', lift: 0, bob: 2 }; // input-lag squash before take-off
    if (t < JUMP_LAND) {
      const u = seg(t, JUMP_OFF, JUMP_LAND);
      return { legs: 'air', lift: Math.round(4 * JUMP_H * u * (1 - u)), bob: 0 };
    }
    if (t < JUMP_LAND + 0.08) return { legs: 'crouch', lift: 0, bob: 2 };
    if (t < 5.25) return running();
    if (t < 6.75) return { legs: 'stand', lift: 0, bob: step(t - 5.25, 0.7, 2) };
    return running();
  }

  // ---------------------------------------------------------------- shot 1: hook / title (screen space)
  function shot1(t) {
    rect(0, 0, W, H, INK);
    if (t < 0.5) { // CRT power-on: a line, then the raster opens
      const u = seg(t, 0.05, 0.28), v = seg(t, 0.28, 0.5);
      const hw = Math.round(outQuint(u) * W / 2), hh = Math.max(1, Math.round(outCubic(v) * H / 2));
      if (v < 1) rect(W / 2 - hw, H / 2 - hh, hw * 2, hh * 2, v > 0 ? NIGHT : PHOS_L);
      return;
    }
    for (let y = 1; y < H; y += 2) rectD(0, y, W, 1, NIGHT, 0.5); // raster lines of a lit tube
    const X = 56, Y = 104, S = 8;
    textS(MONO, 'STAGE', X + 3, Y - 20, PUTTY, INK, { count: typed('STAGE', t, 0.62, 1, 9) });
    if (t > 0.6 && t < 2.6 && step(t, 0.27, 2) === 0) rect(X + 3 + 6 * typed('STAGE', t, 0.62, 1, 9), Y - 20, 5, 7, PUTTY);
    // 1999: digits drop in with uneven stagger; the third sits 1 px low (worn print)
    const delays = [0.95, 1.07, 1.2, 1.31];
    const xs = [X + 3, X + 56, X + 120, X + 184];
    const dissolve = seg(t, 2.65, 3.4);
    for (let i = 0; i < 4; i += 1) {
      const u = seg(t, delays[i], delays[i] + 0.24 + i * 0.035);
      if (u <= 0) continue;
      const dy = Math.round((1 - outBack(u, 2.4)) * -16) + (i === 2 ? 1 : 0);
      const ch = '1999'[i];
      if (i < 2) {
        // the century dims, then is eaten by the Bayer pattern: the program never stored it
        const dim = seg(t, 2.1, 2.55);
        ALPHA = 1 - dissolve;
        text(DISP, ch, xs[i], Y + dy, dim > 0.5 ? UMBER : dim > 0 ? PUTTY : PHOS_L, { scale: S });
        ALPHA = 1;
        if (dissolve > 0.6) for (let k = 0; k < 52; k += 3) px(xs[i] + k, Y + 100, MOSS); // the empty slot left behind
      } else {
        text(DISP, ch, xs[i], Y + dy, PHOS_L, { scale: S });
      }
    }
    // hand-made underline under the 99 (two strokes) + label in the accent
    if (t > 3.5) {
      handStroke(xs[2] - 3, Y + 108, xs[3] + 58, Y + 106, BUG, 7, 4, outCubic(seg(t, 3.5, 3.78)), true);
      handStroke(xs[3] + 44, Y + 113, xs[3] + 62, Y + 109, BUG, 8, 2, seg(t, 3.86, 3.96), false);
      text(MONO, '2 DIGITS', xs[2] + 1, Y + 120, BUG, { count: typed('2 DIGITS', t, 4.02, 4, 16) });
    }
    // title, low and to the right, after the image has made its point
    if (t > 5.05) {
      const tx = 418, ty = 246;
      text(DISP, 'Y2K', tx, ty, PAPER, { scale: 2, count: typed('Y2K', t, 5.05, 5, 10) });
      text(MONO, 'THE BUG THAT ALMOST', tx + 1, ty + 32, PUTTY, { count: typed('THE BUG THAT ALMOST', t, 5.4, 6, 26) });
      text(MONO, 'BROKE THE WORLD', tx + 1, ty + 42, PUTTY, { count: typed('BROKE THE WORLD', t, 6.02, 7, 24) });
    }
    vignette(0.9, W * 0.42, H * 0.48); // the tube falls off towards its corners
    drawHud(SHOT_START[0] + t, { boot: t - 4.1 });
    blinds(t, 6.45, 0.55, true, 101);
  }

  // ---------------------------------------------------------------- shot 2: A-roll level
  function shot2(t) {
    const camX = cameraX(t);
    beginWorld();
    drawLevel(t, camX, false);
    if (t > 5.3) drawBug(bugX(t, camX), t);
    const hs = heroState(t, camX);
    drawHero(HERO_SX, GROUND - hs.lift, hs.legs, { bob: hs.bob, glint: t > 6.05 && t < 6.12 });
    if (t > JUMP_LAND && t < JUMP_LAND + 0.3) { // landing dust
      const u = seg(t, JUMP_LAND, JUMP_LAND + 0.3);
      for (let k = 0; k < 3; k += 1) px(HERO_SX + 1 - k * 2 - u * 4, GROUND - 1 - (k % 2) - u * 2, BEIGE);
    }
    endWorld();
    blinds(t, 0, 0.5, false, 202);
    drawHud(SHOT_START[1] + t);
    blinds(t, 7.45, 0.55, true, 203);
  }

  // ---------------------------------------------------------------- shot 3: B-roll inventory (UI over the paused world)
  function slotDigit(ch, x, y, w, h, colour, scale) {
    text(DISP, ch, x + Math.round((w - textWidth(DISP, ch, scale)) / 2), y + Math.round((h - 12 * scale) / 2), colour, { scale });
  }
  function rollSlot(from, to, u, x, y, w, h, cFrom, cTo, scale) {
    setClip(x, y, w, h);
    const off = Math.round(u * h);
    slotDigit(from, x, y - off, w, h, cFrom, scale);
    slotDigit(to, x, y + h - off, w, h, cTo, scale);
    noClip();
  }
  function panel(x, y, w, h) {
    shadeRect(x + 4, y + 4, w, h, 1);
    rect(x, y, w, h, NIGHT);
    rect(x, y, w, 1, FERN); rect(x, y + h - 1, w, 1, DEEP); rect(x, y, 1, h, MOSS); rect(x + w - 1, y, 1, h, DEEP);
  }
  const CURSOR = ['k.....', 'kPk...', 'kPPk..', 'kPPPk.', 'kPPPPk', 'kPPPk.', 'kPPk..', 'kPk...', 'k.....'];
  function shot3(t) {
    beginWorld();
    drawLevel(6.2, cameraX(6.2), true);
    drawHero(HERO_SX, GROUND, 'stand', {});
    drawBug(bugX(6.2, cameraX(6.2)), 6.2);
    endWorld();
    const dim = seg(t, 0.05, 0.45);
    shadeRect(0, 0, W, H, dim); shadeRect(0, 0, W, H, dim * 0.85); shadeRect(0, 300, W, 60, dim * 0.6);
    // item card (left, big): slides in with overshoot
    const cx = Math.round(lerp(-330, 41, outBack(seg(t, 0.3, 0.72), 1.3))), cy = 62;
    panel(cx, cy, 300, 182);
    text(MONO, 'ITEM', cx + 12, cy + 10, FERN);
    text(DISP, 'YEAR FIELD', cx + 12, cy + 22, PAPER, { count: typed('YEAR FIELD', t, 0.85, 31, 15) });
    // four slots; the program only keeps the last two
    const sx = cx + 14, sy = cy + 48, sw = 30, sh = 46;
    const roll = seg(t, 2.05, 2.3), roll10 = seg(t, 2.16, 2.5);
    for (let k = 0; k < 4; k += 1) {
      const x = sx + k * 35 + (k === 3 ? 1 : 0);
      rect(x, sy, sw, sh, INK);
      if (k < 2) {
        for (let d = 0; d < sw; d += 3) { px(x + d, sy, MOSS); px(x + d, sy + sh - 1, MOSS); }
        for (let d = 0; d < sh; d += 3) { px(x, sy + d, MOSS); px(x + sw - 1, sy + d, MOSS); }
      } else {
        rect(x, sy, sw, 1, FERN); rect(x, sy + sh - 1, sw, 1, FERN); rect(x, sy, 1, sh, FERN); rect(x + sw - 1, sy, 1, sh, FERN);
        if (t > 1.15) rollSlot('9', '0', k === 3 ? roll : outBack(roll10, 1.2), x + 1, sy + 1, sw - 2, sh - 2, PHOS_L, PHOS_L, 3);
      }
    }
    text(MONO, 'PIC 99', sx + 72, sy + sh + 6, FERN);
    // the arithmetic, typed with a human cadence
    const l1 = 'ADD ONE YEAR', l2 = 'READ AS';
    const n1 = typed(l1, t, 1.45, 33, 13);
    text(MONO, l1, sx + 150, sy + 6, PUTTY, { count: n1 });
    if (t > 1.45 && t < 2.05 && step(t, 0.25, 2) === 0) rect(sx + 150 + 6 * n1, sy + 6, 5, 7, PUTTY);
    if (t > 2.5) text(MONO, '99 → 00', sx + 150, sy + 18, PHOS_L, { count: typed('99 → 00', t, 2.5, 37, 12) });
    if (t > 2.75) {
      text(MONO, l2, sx, sy + 86, PUTTY, { count: typed(l2, t, 2.75, 34, 16) });
      if (t > 3.1) {
        const u = outBack(seg(t, 3.1, 3.36), 2.6);
        text(DISP, '1900', sx + 62, sy + 80 + Math.round((1 - u) * 6), BUG, { scale: 2 });
      }
      // grease-pencil loop on the glass around 1900, drawn by hand after a beat
      if (t > 3.62) handLoop(sx + 92, sy + 92, 40, 17, PAPER, 9, outCubic(seg(t, 3.62, 4.0)));
    }
    // right panel: systems checked, cursor with input lag
    const pX = Math.round(lerp(660, 374, outQuint(seg(t, 0.5, 0.95)))), pY = 92;
    panel(pX, pY, 212, 146);
    text(MONO, 'CHECKED', pX + 12, pY + 10, FERN);
    const items = ['BANKS', 'AIRLINES', 'POWER'];
    const ticks = [4.4, 4.98, 5.74];
    const rowY = (i) => pY + 30 + i * 28 + (i === 2 ? 2 : 0);
    items.forEach((name, i) => {
      const ry = rowY(i);
      rect(pX + 30, ry, 11, 11, INK);
      rect(pX + 30, ry, 11, 1, PUTTY); rect(pX + 30, ry + 10, 11, 1, PUTTY); rect(pX + 30, ry, 1, 11, PUTTY); rect(pX + 40, ry, 1, 11, PUTTY);
      text(DISP, name, pX + 50, ry, t >= ticks[i] ? PAPER : PUTTY);
      if (t >= ticks[i]) {
        handStroke(pX + 31, ry + 4, pX + 35, ry + 9, PHOS_L, 20 + i, 1, seg(t, ticks[i], ticks[i] + 0.06), true);
        handStroke(pX + 35, ry + 9, pX + 45, ry - 4, PHOS_L, 30 + i, 2, seg(t, ticks[i] + 0.06, ticks[i] + 0.17), true);
      }
    });
    // cursor: arrives at each row before the tick, overshoots, settles
    const arrive = [4.05, 4.72, 5.38];
    let row = 0;
    for (let i = 0; i < 3; i += 1) if (t >= arrive[i]) row = i;
    if (t > 3.95) {
      const from = row === 0 ? rowY(0) - 10 : rowY(row - 1);
      const yy = lerp(from, rowY(row), outBack(seg(t, arrive[row], arrive[row] + 0.18), 2.2));
      sprite(CURSOR, pX + 18, Math.round(yy) + 1, false);
    }
    if (t > 6.0) text(MONO, 'LINE BY LINE', pX + 50, pY + 122, PUTTY, { count: typed('LINE BY LINE', t, 6.0, 36, 14) });
    drawHud(SHOT_START[2] + t);
    blinds(t, 7.45, 0.55, true, 303);
  }

  // ---------------------------------------------------------------- shot 4: C-roll boss (world units)
  function shot4(t) {
    const FLOOR = 159;
    const ROLL = 3.05, REVEAL = 5.15;
    beginWorld();
    gradV(0, 0, WW, FLOOR, [[0, INK], [0.55, NIGHT], [1, MIDNIGHT]]);
    drawSkyline(190, FLOOR - 2, NIGHT, 0.03, 0.1);
    // the building that carries the millennium clock, its office lights on all night
    rect(160, 118, 132, FLOOR - 118, DEEP);
    rect(160, 118, 132, 1, MOSS);
    for (let wy = 123; wy < FLOOR - 4; wy += 6) for (let wx = 164; wx < 288; wx += 5) {
      const r = hash(wx, wy, 44);
      if (r < 0.14) rect(wx, wy, 2, 3, AMBER); else if (r < 0.32) rect(wx, wy, 2, 3, UMBER);
    }
    const bxx = 150, byy = 54, sw = 34, sh = 52, gap = 3;
    const hw = 4 * (sw + gap) - gap + 10;
    rect(bxx - 5, byy - 5, hw, sh + 10, BROWN);
    rect(bxx - 5, byy - 5, hw, 1, UMBER);
    for (const [ex, ey] of [[0, 0], [hw - 3, 0], [0, sh + 7], [hw - 3, sh + 7]]) px(bxx - 4 + ex, byy - 4 + ey, PUTTY);
    rect(bxx + 30, byy + sh + 5, 4, 118 - byy - sh - 5, BROWN); rect(bxx + 118, byy + sh + 5, 4, 118 - byy - sh - 5, BROWN);
    const secs = t < 0.9 ? 57 : t < 1.95 ? 58 : t < ROLL ? 59 : 0;
    textS(DISP, secs ? '23:59:' + secs : '00:00:00', bxx, byy - 20, secs ? PUTTY : PAPER, INK);
    const roll1 = seg(t, ROLL, ROLL + 0.16), roll10 = seg(t, ROLL + 0.09, ROLL + 0.36);
    const fix1 = seg(t, REVEAL, REVEAL + 0.22), fix10 = seg(t, REVEAL + 0.13, REVEAL + 0.44);
    for (let k = 0; k < 4; k += 1) {
      const x = bxx + k * (sw + gap) + (k === 1 ? -1 : 0);
      rect(x, byy, sw, sh, INK);
      if (k < 2) {
        // the century: never stored, so it is only a ghost, until the fixed code writes 20
        rollSlot(k === 0 ? '1' : '9', k === 0 ? '2' : '0', k === 0 ? outBack(fix10, 1.1) : fix1, x, byy, sw, sh, DEEP, PHOS_L, 4);
      } else {
        rollSlot('9', '0', k === 3 ? roll1 : outBack(roll10, 1.4), x, byy, sw, sh, BUG, t >= REVEAL ? PHOS_L : BUG, 4);
      }
      rect(x, byy + sh / 2, sw, 1, BROWN); // the split of an odometer window
    }
    if (t > REVEAL + 0.5) text(MONO, '1 JAN 2000', bxx, byy + sh + 7, PAPER, { count: typed('1 JAN 2000', t, REVEAL + 0.5, 41, 12) });
    // the hero, small, low and left, looking up at it; braces when it hits
    const brace = t > ROLL + 0.03 && t < ROLL + 0.22;
    drawHero(46, FLOOR, brace ? 'crouch' : 'stand', { bob: brace ? 2 : 0, glint: t > 6.6 && t < 6.67 });
    rect(0, FLOOR, WW, WH - FLOOR, NIGHT);
    rect(0, FLOOR, WW, 1, MOSS);
    for (let x = 3; x < WW; x += 8) rect(x, FLOOR + 2, 2, 2, DEEP);
    // silence before the reveal: the edges go dark, only the 00 holds
    const hush = seg(t, ROLL + 0.55, ROLL + 0.95) * (1 - seg(t, REVEAL - 0.1, REVEAL + 0.5));
    if (hush > 0) vignette(hush * 1.4, 225, 80);
    endWorld();
    const [sx, sy] = shake(t, ROLL, 9, 4.2, 404);
    shiftFb(Math.round(sx / 2) * 2, Math.round(sy / 2) * 2, INK);
    drawHud(SHOT_START[3] + t);
    // boss bar: the bug's strength = code nobody fixed; it drains when the fixed code holds
    const bb = outBack(seg(t, 0.25, 0.6), 1.5);
    if (bb > 0) {
      const lx = 364, ly = 44, full = 220;
      textS(MONO, 'BOSS: MILLENNIUM BUG', lx, ly, PUTTY, INK, { count: typed('BOSS: MILLENNIUM BUG', t, 0.3, 42, 30) });
      const w = Math.round(full * bb * (1 - seg(t, REVEAL + 0.55, REVEAL + 1.3)));
      rect(lx, ly + 10, full, 6, INK);
      rect(lx, ly + 10, w, 5, BUG); rect(lx, ly + 15, w, 1, BROWN);
      for (let x = lx + 22; x < lx + full; x += 22) rect(x, ly + 10, 1, 6, INK);
    }
    blinds(t, 0, 0.45, false, 401);
    blinds(t, 7.45, 0.55, true, 402);
  }

  // ---------------------------------------------------------------- shot 5: payoff (world units + quiet UI text)
  /** The developer asleep at the desk, face down on folded arms; built from shaded ellipses (closer camera). */
  function drawSleeper(x, breath) {
    const y = -breath;
    rect(x + 46, 88, 9, 43, BROWN); rect(x + 46, 88, 2, 43, UMBER); rect(x + 47, 86, 7, 2, BROWN); // chair back
    ellipse(x + 31, 114 + y, 20, 17, INK); ellipse(x + 31, 114 + y, 19, 16, HAZE); // hunched back, pale blue oxford shirt
    ellipse(x + 26, 120 + y, 13, 10, MIDNIGHT, 0.5); // shadow side of the shirt
    rect(x + 43, 104 + y, 1, 18, PAPER); rect(x + 44, 108 + y, 1, 12, PAPER); // window light along the shoulder
    rect(x + 30, 100 + y, 6, 1, PAPER); // and across the top of the back
    ellipse(x + 13, 115 + y, 9, 9, INK); ellipse(x + 13, 115 + y, 8, 8, BEIGE); // head, bald crown, face down
    ellipse(x + 10, 119 + y, 5, 3, PUTTY, 0.4); // underside in shadow
    rect(x + 13, 107 + y, 3, 1, PAPER); rect(x + 16, 108 + y, 2, 1, PAPER); // window light on the crown
    rect(x + 18, 111 + y, 2, 8, PAPER); rect(x + 17, 113 + y, 1, 5, PAPER); rect(x + 20, 112 + y, 1, 6, PUTTY); // white hair at the back
    rect(x + 13, 113 + y, 2, 4, PUTTY); px(x + 13, 114 + y, BROWN); // ear
    ellipse(x + 20, 125, 22, 6, INK); ellipse(x + 20, 125, 21, 5, HAZE); // folded arms on the desk
    rect(x + 2, 125, 30, 1, MIDNIGHT); rect(x + 8, 127, 22, 1, MIDNIGHT); rect(x + 18, 121, 14, 1, PAPER);
    ellipse(x + 1, 126, 3, 3, INK); ellipse(x + 1, 126, 2, 2, BEIGE); // a hand
  }
  function shot5(t) {
    beginWorld();
    gradV(0, 0, WW, WH, [[0, NIGHT], [1, INK]]);
    // window, upper right: first light of 1 January 2000
    const wx = 204, wy = 26, ww = 90, wh = 64;
    gradV(wx, wy, ww, wh, [[0, MIDNIGHT], [0.45, HAZE], [0.85, BEIGE], [1, AMBER]]);
    setClip(wx, wy, ww, wh);
    drawSkyline(70, wy + wh, MIDNIGHT, 0.02, 0);
    noClip();
    rect(wx - 2, wy - 2, ww + 4, 2, BROWN); rect(wx - 3, wy + wh, ww + 6, 3, UMBER);
    rect(wx - 2, wy, 2, wh, BROWN); rect(wx + ww, wy, 2, wh, BROWN); rect(wx + 44, wy, 2, wh, BROWN); rect(wx, wy + 31, ww, 2, BROWN);
    for (let y = wy + wh + 3; y < 131; y += 1) { // window light falling across the wall
      const lx = Math.round(wx - (y - wy - wh) * 1.1);
      rectD(lx, y, 74, 1, DEEP, 0.55 - (y - wy - wh) / 110);
    }
    // desk, full width
    rect(0, 131, WW, WH - 131, BROWN);
    rect(0, 131, WW, 1, UMBER);
    shadeRect(0, 150, WW, 30, 0.5);
    // the monitor: beige CRT with the one changed line on screen
    const mx = 12, my = 44;
    rect(mx + 34, my + 84, 44, 3, PUTTY); rect(mx + 28, my + 86, 56, 1, UMBER);
    rect(mx, my, 114, 84, BEIGE); rect(mx + 110, my, 4, 84, PUTTY); rect(mx, my + 78, 114, 6, PUTTY); rect(mx, my, 114, 1, PAPER);
    px(mx + 102, my + 81, PHOS); // power LED
    rect(mx + 6, my + 6, 100, 68, INK);
    rect(mx + 7, my + 7, 98, 66, NIGHT);
    for (let y = my + 8; y < my + 73; y += 2) rectD(mx + 7, y, 98, 1, INK, 0.3); // raster
    // a blank sticky note, stuck on crooked
    const nx = mx + 90, ny = my + 60;
    for (let r = 0; r < 12; r += 1) rect(nx + Math.floor(r / 5), ny + r, 12, 1, PAPER);
    rect(nx + 3, ny + 4, 6, 1, PUTTY); rect(nx + 3, ny + 7, 4, 1, PUTTY);
    const sx = mx + 9, sy = my + 13;
    text(MONO, '* YEAR: 4 DIGITS', sx, sy, FERN);
    text(MONO, '05 YR PIC 99.', sx, sy + 16, MOSS);
    rect(sx - 1, sy + 19, textWidth(MONO, '05 YR PIC 99.') + 2, 1, PHOS);
    const fixed = '05 YR PIC 9(4).';
    text(MONO, fixed, sx, sy + 27, PHOS_L, { colours: fixed.split('').map((_, i) => (i >= 10 && i <= 13 ? AMBER : PHOS_L)) });
    if (step(t, 0.53, 2) === 0) rect(sx, sy + 41, 5, 7, PHOS);
    // mug with steam (8 fps), pencil cup carrying the checkpoint flag
    const kx = 198;
    rect(kx, 120, 10, 11, BEIGE); rect(kx + 10, 122, 3, 6, BEIGE); rect(kx + 10, 123, 2, 4, BROWN);
    rect(kx, 120, 10, 1, UMBER); rect(kx + 8, 121, 2, 10, PUTTY);
    for (let k = 0; k < 2; k += 1) {
      const f = step(t + k * 0.45, 0.125, 8);
      const yy = 116 - ((f + k * 3) % 8);
      px(kx + 3 + k * 3 + (f % 3 === 0 ? 1 : 0), yy, PUTTY);
    }
    rect(215, 117, 8, 14, UMBER); rect(215, 117, 8, 1, PUTTY);
    rect(217, 107, 1, 10, FERN); rect(221, 110, 1, 7, PUTTY);
    rect(218, 101, 1, 16, PUTTY);
    const raise = outBack(seg(t, 4.35, 4.75), 2.2);
    const fy = Math.round(lerp(108, 101, raise));
    rect(219, fy, 5, 3, raise > 0 ? PHOS : MOSS); rect(219, fy + 3, 3, 1, raise > 0 ? PHOS : MOSS);
    // the developer, asleep: back and head rise with each breath, the arms stay on the desk
    drawSleeper(138, step(t, 1.35, 2));
    endWorld();
    // the quiet summary under the window (screen-space UI)
    const lx = 462, ly = 204;
    text(DISP, 'LEVEL COMPLETE', lx, ly, PAPER, { count: typed('LEVEL COMPLETE', t, 1.0, 51, 9) });
    const r1 = 'EST. COST  $300 BILLION', r2 = 'THE WORLD  KEPT RUNNING';
    if (t > 2.4) text(MONO, r1, lx, ly + 22, PUTTY, { count: typed(r1, t, 2.4, 52, 22), wobble: 53 });
    if (t > 3.45) text(MONO, r2, lx, ly + 34, PUTTY, { count: typed(r2, t, 3.45, 54, 20), wobble: 55 });
    blinds(t, 0, 0.6, false, 501);
    const fadeOut = seg(t, 6.25, 6.95);
    drawHud(SHOT_START[4] + t, { alpha: 1 - fadeOut });
    if (fadeOut > 0) { shadeRect(0, 0, W, H, fadeOut); shadeRect(0, 0, W, H, fadeOut * 0.7); }
  }

  // ---------------------------------------------------------------- shots + UI
  const SHOTS = [
    {
      id: 'hook', label: 'Hook', render: shot1,
      caption: '1999. The world ran on computers that wrote the year with two digits.',
      note: 'Cold open on the year losing its century: "19" is eaten by the dither, "99" stays. HUD boots late, with hitches.',
    },
    {
      id: 'level', label: 'A-roll', render: shot2,
      caption: 'Memory was expensive, so programmers dropped the "19" to save it. 1999 was just 99.',
      note: 'The level is printed on green-bar paper. The hero bumps a key and the "19" flies away; the 00 walks in from the right.',
    },
    {
      id: 'inventory', label: 'B-roll', render: shot3,
      caption: 'Add one to 99 and you get 00, which code could read as 1900. Banks, airlines and power companies checked their code, line by line.',
      note: 'Game paused over the level. Item card = the year field (2 of 4 slots). Grease-pencil loop on 1900; the POWER tick hesitates.',
    },
    {
      id: 'boss', label: 'C-roll', render: shot4,
      caption: 'Midnight, 1 January 2000. 99 rolled over to 00... and the fixed code read it as 2000.',
      note: 'Low angle on the millennium clock. 99 to 00 is the attack (shake with decay), then a held hush; the 20 rolls in, the boss bar drains.',
    },
    {
      id: 'payoff', label: 'Payoff', render: shot5,
      caption: 'The fix cost an estimated 300 billion dollars. The reward: the world kept running.',
      note: 'Not a fanfare: dawn, a sleeping developer, the one changed line on screen. The last checkpoint flag sits in the pencil cup.',
    },
  ];

  const canvas = document.getElementById('screen');
  const ctx2d = canvas.getContext('2d');
  const image = ctx2d.createImageData(W, H);
  const pixels = new Uint32Array(image.data.buffer);
  function render(shotIndex, t) {
    fb.fill(INK);
    noClip();
    ALPHA = 1;
    SHOTS[shotIndex].render(t);
    for (let i = 0; i < fb.length; i += 1) pixels[i] = LUT[fb[i]];
    ctx2d.putImageData(image, 0, 0);
  }
  window.__showcase = { render, durations: SHOT_DUR, palette: PALETTE };

  // UI (outside the render path: the clock lives here; render() only ever sees a frame-quantised t)
  let shot = 0, t = 0, playing = true, last = null;
  const scrub = document.getElementById('scrub');
  const timeLabel = document.getElementById('time');
  const caption = document.getElementById('caption');
  const note = document.getElementById('note');
  const buttons = Array.from(document.querySelectorAll('[data-shot]'));
  const playBtn = document.getElementById('play');
  const capToggle = document.getElementById('show-caption');
  function fit() {
    const k = Math.max(1, Math.floor(Math.min((window.innerWidth - 48) / W, (window.innerHeight - 230) / H)));
    canvas.style.width = W * k + 'px';
    canvas.style.height = H * k + 'px';
  }
  function select(i) {
    shot = i; t = 0;
    buttons.forEach((b, k) => b.classList.toggle('active', k === i));
    scrub.max = String(SHOT_DUR[i]);
    caption.textContent = SHOTS[i].caption;
    note.textContent = SHOTS[i].note;
    draw();
  }
  function draw() {
    const tq = Math.floor(t * FPS + 1e-6) / FPS;
    render(shot, tq);
    scrub.value = String(tq);
    timeLabel.textContent = tq.toFixed(2) + ' / ' + SHOT_DUR[shot].toFixed(2) + ' s';
  }
  function tick(now) {
    if (playing && last !== null) {
      t += Math.min(0.1, (now - last) / 1000);
      if (t >= SHOT_DUR[shot]) t %= SHOT_DUR[shot];
      draw();
    }
    last = now;
    window.requestAnimationFrame(tick);
  }
  function setPlaying(p) { playing = p; playBtn.textContent = p ? 'Pause (space)' : 'Play (space)'; }
  buttons.forEach((b, i) => b.addEventListener('click', () => select(i)));
  playBtn.addEventListener('click', () => setPlaying(!playing));
  scrub.addEventListener('input', () => { setPlaying(false); t = Number(scrub.value); draw(); });
  capToggle.addEventListener('change', () => { caption.hidden = !capToggle.checked; });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    const n = Number(e.key);
    if (n >= 1 && n <= 5) select(n - 1);
    if (e.key === 'ArrowRight') { setPlaying(false); t = Math.min(SHOT_DUR[shot] - 1 / FPS, t + 1 / FPS); draw(); }
    if (e.key === 'ArrowLeft') { setPlaying(false); t = Math.max(0, t - 1 / FPS); draw(); }
  });
  window.addEventListener('resize', fit);
  fit();
  select(0);
  if (!window.__SHOWCASE_STILL__) window.requestAnimationFrame(tick);
})();

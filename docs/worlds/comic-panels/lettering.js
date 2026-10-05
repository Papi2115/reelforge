/* comic-panels showcase - pixel lettering, balloons, captions, onomatopoeia, hand marks.
 * "Inkhand" (lettering) is drawn for this showcase; "Forge Display" glyphs are copied from
 * packages/engine/src/text/font-display.ts (our own CC0 font). Both caps-only, 7 rows cap height.
 */
'use strict';
(function () {
  const CP = window.CP;
  const { C, rnd, rndRange, poly, polyline, line, ellipsePts } = CP;

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
  // Forge Display (CC0, packages/engine/src/text/font-display.ts) - only the glyphs this page uses.
  const DISPLAY = {
    A: '..###../.##.##./##...##/##...##/#######/##...##/##...##',
    B: '#####./##..##/##..##/#####./##..##/##..##/#####.',
    E: '######/##..../##..../#####./##..../##..../######',
    G: '.####./##..##/##..../##.###/##..##/##..##/.#####',
    O: '.#####./##...##/##...##/##...##/##...##/##...##/.#####.',
    P: '#####./##..##/##..##/#####./##..../##..../##....',
    R: '#####./##..##/##..##/#####./####../##.##./##..##',
    S: '.####./##..##/##..../.####./....##/##..##/.####.',
    T: '######/..##../..##../..##../..##../..##../..##..',
    // Plain zero: the engine's slashed zero reads as an 8 once the letter is warped.
    '0': '.####./##..##/##..##/##..##/##..##/##..##/.####.',
    '1': '..##../.###../..##../..##../..##../..##../.####.',
    '2': '.####./##..##/....##/..###./.##.../##..../######',
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

  // ---------- balloons ----------
  const LINE_H = 10;
  /**
   * Speech balloon centred at (cx,cy) holding lines; tail tip at (tx,ty).
   * opt: radio (lightning tail for transmissions), scale (pop), key, reveal, small.
   * Returns the balloon's bounds for linking.
   */
  /** Integer text scale for a camera zoom: never larger than the zoom, so text never overflows. */
  function textScale(z) {
    return Math.max(1, Math.floor(z + 1e-6));
  }
  function balloon(lines, cx, cy, tx, ty, opt) {
    const o = opt || {};
    const z = o.zoom || 1;
    const k = (o.scale === undefined ? 1 : o.scale) * z;
    if (k <= 0.05) return null;
    const ts = textScale(z);
    const key = o.key || lines.join('|');
    const tw = Math.max.apply(null, lines.map((l) => measure('hand', l, 1, true)));
    const th = lines.length * LINE_H - 3;
    const rx = (tw / 2) * 1.2 + 7;
    const ry = (th / 2) * 1.25 + 7;
    if (tx !== undefined) drawTail(cx, cy, rx * k, ry * k, tx, ty, !!o.radio, key);
    const outer = ellipsePts(cx, cy, rx * k + 1, ry * k + 1, 44, key, 0.025);
    const inner = ellipsePts(cx, cy, rx * k, ry * k, 44, key, 0.025);
    poly(outer, C.INK);
    poly(inner, C.PAPER);
    if (tx !== undefined) drawTailInside(cx, cy, rx * k, ry * k, tx, ty, !!o.radio, key);
    if (k > 0.85 * z) {
      const lh = LINE_H * ts;
      const block = lines.length * lh - 3 * ts;
      lines.forEach((l, i) => {
        const lw = measure('hand', l, ts, true);
        const lx = cx - lw / 2 + (rnd(key, 40 + i) < 0.5 ? 0 : 1);
        const ly = cy - block / 2 + i * lh;
        text('hand', l, lx, ly, C.INK, { key: key + i, bold: true, scale: ts, jitter: ts });
      });
    }
    return { cx, cy, rx: rx * k, ry: ry * k };
  }
  function tailGeometry(cx, cy, rx, ry, tx, ty) {
    const ang = Math.atan2((ty - cy) / ry, (tx - cx) / rx);
    const bx = cx + Math.cos(ang) * rx * 0.8;
    const by = cy + Math.sin(ang) * ry * 0.8;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    const half = Math.min(rx, ry) * 0.28 + 2;
    return { bx, by, nx, ny, half };
  }
  function tailPoints(cx, cy, rx, ry, tx, ty, radio, key, shrink) {
    const g = tailGeometry(cx, cy, rx, ry, tx, ty);
    const h = g.half - shrink;
    if (!radio) {
      // A curved, tapering tail: base offset toward one side, tip slightly hooked.
      const mx = (g.bx + tx) / 2 + g.nx * h * 0.9;
      const my = (g.by + ty) / 2 + g.ny * h * 0.9;
      return [g.bx + g.nx * h, g.by + g.ny * h, mx + g.nx * 1, my + g.ny * 1, tx, ty, mx - g.nx * (h * 0.3), my - g.ny * (h * 0.3), g.bx - g.nx * h * 0.4, g.by - g.ny * h * 0.4];
    }
    // Lightning tail: three zig-zag segments for a radio voice.
    const pts = [];
    const steps = [0, 0.38, 0.62, 1];
    const side = [];
    for (let i = 0; i < steps.length; i++) {
      const p = steps[i];
      const zig = i === 0 || i === 3 ? 0 : (i % 2 ? 1 : -1) * (6 + rnd(key, 90 + i) * 3);
      const width = (1 - p) * h + 0.6;
      const px = g.bx + (tx - g.bx) * p + g.nx * zig;
      const py = g.by + (ty - g.by) * p + g.ny * zig;
      side.push([px, py, width]);
    }
    for (const [px, py, wd] of side) pts.push(px + g.nx * wd, py + g.ny * wd);
    for (let i = side.length - 1; i >= 0; i--) {
      const [px, py, wd] = side[i];
      pts.push(px - g.nx * wd, py - g.ny * wd);
    }
    return pts;
  }
  function drawTail(cx, cy, rx, ry, tx, ty, radio, key) {
    const pts = tailPoints(cx, cy, rx, ry, tx, ty, radio, key, 0);
    poly(pts, C.PAPER);
    polyline(pts, C.INK, 1, true);
  }
  function drawTailInside(cx, cy, rx, ry, tx, ty, radio, key) {
    // Re-open the joint so the tail flows out of the balloon without an ink seam.
    const g = tailGeometry(cx, cy, rx, ry, tx, ty);
    const pts = tailPoints(cx, cy, rx, ry, tx, ty, radio, key, 1);
    const cut = [];
    for (let i = 0; i < pts.length; i += 2) {
      const d = Math.hypot(pts[i] - g.bx, pts[i + 1] - g.by);
      if (d < Math.hypot(rx, ry) * 0.4) cut.push(pts[i], pts[i + 1]);
    }
    if (cut.length >= 6) poly(cut, C.PAPER);
  }
  /** The little ink connector between two balloons of the same speaker. */
  function linkBalloons(a, b) {
    if (!a || !b) return;
    const ang = Math.atan2(b.cy - a.cy, b.cx - a.cx);
    const x0 = a.cx + Math.cos(ang) * a.rx * 0.85;
    const y0 = a.cy + Math.sin(ang) * a.ry * 0.85;
    const x1 = b.cx - Math.cos(ang) * b.rx * 0.85;
    const y1 = b.cy - Math.sin(ang) * b.ry * 0.85;
    const nx = -Math.sin(ang) * 2.5;
    const ny = Math.cos(ang) * 2.5;
    poly([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], C.PAPER);
    line(x0 + nx, y0 + ny, x1 + nx, y1 + ny, C.INK);
    line(x0 - nx, y0 - ny, x1 - nx, y1 - ny, C.INK);
  }

  /** Caption box: yellow, hand-cut (corners off by a pixel), text left aligned. */
  function caption(lines, x, y, opt) {
    const o = opt || {};
    const key = o.key || lines.join('|');
    const ts = textScale(o.zoom || 1);
    const tw = Math.max.apply(null, lines.map((l) => measure('hand', l, ts, true)));
    const w = tw + 12 * ts;
    const h = lines.length * LINE_H * ts + 7 * ts;
    const tilt = o.tilt || 0;
    const j = (i) => Math.round(rndRange(key, i, -1, 1));
    const pts = [x + j(1), y + j(2) + tilt, x + w + j(3), y + j(4), x + w + j(5), y + h + j(6), x + j(7), y + h + j(8) + tilt];
    poly(pts.map((v) => v + 2), C.INK); // hard drop shadow, print style
    poly(pts, o.fill === undefined ? C.YEL_P : o.fill);
    polyline(pts, C.INK, 1, true);
    lines.forEach((l, i) => text('hand', l, x + 6 * ts, y + 5 * ts + i * LINE_H * ts, C.INK, { key: key + i, reveal: o.reveal, bold: true, scale: ts, jitter: ts }));
    return { x, y, w, h };
  }

  // ---------- onomatopoeia ----------
  /**
   * One big imperfect letter: display glyph scaled by `size` px per cell, rotated, warped by a seeded
   * low-frequency wobble (cut-paper edge), black outline + extruded shadow, fill paint misregistered.
   */
  function bigLetter(ch, cx, cy, size, angle, fill, opt) {
    const o = opt || {};
    const g = FONTS.display.glyphs[ch];
    if (!g || size <= 0.2) return;
    const key = o.key || ch;
    const ow = o.outline === undefined ? 2 : o.outline;
    const ext = o.extrude || [3, 3];
    const mis = o.mis || [1, -1];
    const half = Math.hypot(g.w, g.h) * size * 0.5 + ow + 6;
    const x0 = Math.floor(cx - half);
    const y0 = Math.floor(cy - half);
    const bw = Math.ceil(half * 2) + 8;
    const bh = bw;
    const m = new Uint8Array(bw * bh);
    const ca = Math.cos(-angle);
    const sa = Math.sin(-angle);
    const ph1 = rnd(key, 1) * 6.28;
    const ph2 = rnd(key, 2) * 6.28;
    for (let yy = 0; yy < bh; yy++) {
      for (let xx = 0; xx < bw; xx++) {
        const dx = x0 + xx + 0.5 - cx;
        const dy = y0 + yy + 0.5 - cy;
        let lx = (dx * ca - dy * sa) / size + g.w / 2;
        let ly = (dx * sa + dy * ca) / size + g.h / 2;
        lx += 0.08 * Math.sin(ly * 1.3 + ph1);
        ly += 0.06 * Math.sin(lx * 1.1 + ph2);
        const gx = Math.floor(lx);
        const gy = Math.floor(ly);
        if (gx >= 0 && gy >= 0 && gx < g.w && gy < g.h && g.bits[gy * g.w + gx]) m[yy * bw + xx] = 1;
      }
    }
    const at = (xx, yy) => (xx >= 0 && yy >= 0 && xx < bw && yy < bh ? m[yy * bw + xx] : 0);
    const dil = new Uint8Array(bw * bh);
    for (let yy = 0; yy < bh; yy++) {
      for (let xx = 0; xx < bw; xx++) {
        if (!m[yy * bw + xx]) continue;
        for (let a = -ow; a <= ow; a++) {
          for (let b = -ow; b <= ow; b++) {
            const X = xx + a;
            const Y = yy + b;
            if (a * a + b * b <= ow * ow + 1 && X >= 0 && Y >= 0 && X < bw && Y < bh) dil[Y * bw + X] = 1;
          }
        }
      }
    }
    // Extrusion (solid ink block behind, pointing down-right), then outline, then misregistered fill.
    const steps = Math.max(Math.abs(ext[0]), Math.abs(ext[1]), 1);
    for (let yy = 0; yy < bh; yy++) {
      for (let xx = 0; xx < bw; xx++) {
        for (let k = 0; k <= steps; k++) {
          const X = xx - Math.round((ext[0] * k) / steps);
          const Y = yy - Math.round((ext[1] * k) / steps);
          if (X >= 0 && Y >= 0 && X < bw && Y < bh && dil[Y * bw + X]) {
            CP.plot(x0 + xx, y0 + yy, C.INK);
            break;
          }
        }
      }
    }
    for (let yy = 0; yy < bh; yy++) {
      for (let xx = 0; xx < bw; xx++) {
        if (at(xx - mis[0], yy - mis[1]) && at(xx, yy)) CP.plot(x0 + xx, y0 + yy, fill);
        else if (at(xx, yy)) CP.plot(x0 + xx, y0 + yy, C.PAPER);
      }
    }
  }

  // ---------- hand marks ----------
  /** Two-stroke hand-drawn arrow: a bowed shaft, then a separate head that does not quite meet it. */
  function handArrow(x0, y0, x1, y1, p, paint, key, w) {
    const bow = rndRange(key, 1, 0.12, 0.22) * (rnd(key, 2) < 0.5 ? -1 : 1);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const s = i / 16;
      const b = Math.sin(s * Math.PI) * bow * len;
      pts.push(x0 + (x1 - x0) * s + nx * b + Math.round(rndRange(key, 10 + i, -0.4, 0.4)), y0 + (y1 - y0) * s + ny * b);
    }
    CP.strokeOn(pts, seg01(p, 0, 0.7), paint, w || 1);
    const hp = seg01(p, 0.78, 1);
    if (hp > 0) {
      const ax = pts[pts.length - 4];
      const ay = pts[pts.length - 3];
      const ang = Math.atan2(y1 - ay, x1 - ax);
      const hl = 6 + rnd(key, 30) * 2;
      const ex = x1 + 1;
      const ey = y1 - 1;
      const head = [ex + Math.cos(ang + 2.55) * hl, ey + Math.sin(ang + 2.55) * hl, ex, ey, ex + Math.cos(ang - 2.4) * hl, ey + Math.sin(ang - 2.4) * hl];
      CP.strokeOn(head, hp, paint, w || 1);
    }
  }
  function seg01(p, a, b) {
    return p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a);
  }
  /** A thumbprint left in the margin: broken concentric loops in a pale ink. */
  function thumbprint(cx, cy, key, paint) {
    for (let r = 2; r < 13; r += 2) {
      const steps = 40;
      for (let i = 0; i < steps; i++) {
        if (rnd(key, r * 100 + i) < 0.22) continue;
        const a = (i / steps) * Math.PI * 2;
        const wob = 1 + 0.08 * Math.sin(a * 2 + r);
        CP.plot(cx + Math.cos(a) * r * 0.82 * wob, cy + Math.sin(a) * r * wob, paint);
      }
    }
  }
  /** Ink smudge: a dragged blot, dithered so it reads as a stain, not a shape. */
  function smudge(cx, cy, len, ang, key) {
    for (let i = 0; i < 26; i++) {
      const s = i / 26;
      const r = (1 - s) * 3.2 + 0.6;
      const x = cx + Math.cos(ang) * len * s + rndRange(key, i, -1, 1);
      const y = cy + Math.sin(ang) * len * s + rndRange(key, i + 40, -1, 1);
      CP.ellipse(x, y, r, r * 0.8, CP.dither(-1, C.INK, 0.75 - s * 0.6));
    }
  }
  /** Speed lines along direction (dx,dy) that stop `gap` px before the subject at (sx,sy). */
  function speedLines(sx, sy, dx, dy, count, len, spread, gap, paint, key, phase) {
    const l = Math.hypot(dx, dy);
    const ux = dx / l;
    const uy = dy / l;
    // Lines hug the subject (a small, uneven gap) and re-roll their length on a 10 fps cadence,
    // like redrawn ink, instead of sliding.
    const roll = Math.floor((phase || 0) * 10);
    for (let i = 0; i < count; i++) {
      const off = (rnd(key, i) * 2 - 1) * spread;
      const edge = 1 - Math.pow(Math.abs(off) / (spread || 1), 2) * 0.35;
      const near = gap * edge + rnd(key, i + 100) * 5;
      const ln = len * (0.35 + rnd(key, i * 31 + roll) * 0.8);
      const bx = sx - ux * near - uy * off;
      const by = sy - uy * near + ux * off;
      line(bx, by, bx - ux * ln, by - uy * ln, paint, rnd(key, i + 400) < 0.25 ? 2 : 1);
    }
  }

  CP.FONTS = FONTS;
  CP.text = text;
  CP.measure = measure;
  CP.balloon = balloon;
  CP.linkBalloons = linkBalloons;
  CP.caption = caption;
  CP.bigLetter = bigLetter;
  CP.handArrow = handArrow;
  CP.thumbprint = thumbprint;
  CP.smudge = smudge;
  CP.speedLines = speedLines;
  CP.LINE_H = LINE_H;
})();

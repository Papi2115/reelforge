/* comic-panels v2 showcase - balloons, captions, onomatopoeia, hand marks (v1 code + new marks). */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, rnd, rndRange, poly, polyline, line, ellipsePts, text, measure } = CP;
  const FONTS = CP.FONTS;

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
    if (o.thought) cloud(cx, cy, rx * k, ry * k, key);
    else {
      poly(ellipsePts(cx, cy, rx * k + 1, ry * k + 1, 44, key, 0.025), C.INK);
      poly(ellipsePts(cx, cy, rx * k, ry * k, 44, key, 0.025), C.PAPER);
    }
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
  /** Thought balloon: a scalloped cloud - bumps of uneven size around an ellipse, one shared outline. */
  function cloud(cx, cy, rx, ry, key) {
    const n = 11;
    const bumps = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(key, 70 + i) * 0.25;
      const r = Math.min(rx, ry) * (0.34 + rnd(key, 80 + i) * 0.14);
      bumps.push([cx + Math.cos(a) * (rx - r * 0.2), cy + Math.sin(a) * (ry - r * 0.2), r]);
    }
    for (const [x, y, r] of bumps) CP.ellipse(x, y, r + 1, r + 1, C.INK);
    CP.ellipse(cx, cy, rx + 1, ry + 1, C.INK);
    for (const [x, y, r] of bumps) CP.ellipse(x, y, r, r, C.PAPER);
    CP.ellipse(cx, cy, rx, ry, C.PAPER);
  }
  /** The trail of shrinking bubbles from a thought balloon to the thinker's head. */
  function thoughtDots(cx, cy, tx, ty, z, key) {
    for (let i = 0; i < 3; i++) {
      const s = 0.42 + i * 0.22;
      const r = (4 - i * 1.2) * Math.max(1, z * 0.8);
      const x = lerpN(cx, tx, s) + rndRange(key, i, -2, 2);
      const y = lerpN(cy, ty, s) + rndRange(key, i + 5, -2, 2);
      CP.ellipse(x, y, r + 1, r + 1, C.INK);
      CP.ellipse(x, y, r, r, C.PAPER);
    }
  }
  function lerpN(a, b, s) {
    return a + (b - a) * s;
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

  CP.seg01 = seg01;
  CP.balloon = balloon;
  CP.thoughtDots = thoughtDots;
  CP.linkBalloons = linkBalloons;
  CP.caption = caption;
  CP.bigLetter = bigLetter;
  CP.handArrow = handArrow;
  CP.thumbprint = thumbprint;
  CP.smudge = smudge;
  CP.speedLines = speedLines;
  CP.LINE_H = LINE_H;
})();

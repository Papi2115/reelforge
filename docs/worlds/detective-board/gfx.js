/* detective-board showcase - indexed-colour software rasteriser.
 * Everything here is a pure function of its arguments: no clocks, no Math.random.
 * Surfaces hold palette indices (0..15); 255 = transparent. */
(function () {
  'use strict';
  const DB = (window.DB = window.DB || {});
  const W = 640;
  const H = 360;
  const T = 255;

  // Evidence-room palette: cool night shadows against a lamp-warm cork, cool faded photo
  // tones, a blue-black ballpoint ink and ONE hard red for the string and key marks.
  const PAL = [
    '#0c0b11', // 0  black - deepest shadow
    '#1c1a26', // 1  night - room shadow, vignette
    '#393543', // 2  slate - graphite, iron hooks, photo darks
    '#553624', // 3  cork dark - cork grain, desk wood
    '#835532', // 4  cork - board base
    '#ad7843', // 5  cork light - lit cork, coffee stain
    '#dca462', // 6  brass - lamp hot cork, brass pins, pencil
    '#e6d9ba', // 7  paper - notes, photo borders
    '#bcab8b', // 8  paper shade - card back, folds
    '#878476', // 9  photo grey
    '#4b636c', // 10 photo teal dark
    '#86a39c', // 11 photo teal light, map sea
    '#22344c', // 12 ink - ballpoint handwriting
    '#d8281c', // 13 RED - string + key marks only
    '#701510', // 14 red dark - string shadow side, pin shade
    '#f8f2de', // 15 hot white - lamp highlight
  ];
  const C = {
    BLACK: 0, NIGHT: 1, SLATE: 2, CORK_D: 3, CORK: 4, CORK_L: 5, BRASS: 6, PAPER: 7,
    PAPER_D: 8, GREY: 9, TEAL_D: 10, TEAL_L: 11, INK: 12, RED: 13, RED_D: 14, WHITE: 15,
  };
  // One step darker / lighter for every colour (lighting ramps).
  const DARK = [0, 0, 1, 2, 3, 4, 5, 8, 9, 2, 2, 10, 1, 14, 1, 7];
  const LIGHT = [1, 2, 9, 4, 5, 6, 15, 15, 7, 8, 11, 11, 10, 13, 13, 15];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

  // ---------- seeded randomness ----------
  function hash(a, b, c) {
    let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ Math.imul((c | 0) + 0x9e3779b9, 0xc2b2ae35), 0x27d4eb2f) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d) >>> 0;
    h ^= h >>> 12;
    return (h >>> 0) / 4294967296;
  }
  // ---------- easing & timing ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    inQuad: (k) => k * k,
    outQuad: (k) => 1 - (1 - k) * (1 - k),
    outCubic: (k) => 1 - Math.pow(1 - k, 3),
    inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  };
  /** Damped oscillation around 0 starting at amplitude 1 (string twang, photo wobble). */
  function wobble(t, freq, damp) {
    if (t <= 0) return 1;
    return Math.exp(-damp * t) * Math.cos(freq * t);
  }

  // ---------- surfaces ----------
  function surf(w, h, fill) {
    const d = new Uint8Array(w * h);
    d.fill(fill === undefined ? T : fill);
    return { w, h, d };
  }
  function px(s, x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < s.w && y < s.h) s.d[y * s.w + x] = c;
  }
  function get(s, x, y) {
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return T;
    return s.d[y * s.w + x];
  }
  function shade(s, x, y, steps) {
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    const i = y * s.w + x;
    let c = s.d[i];
    if (c === T) return;
    if (steps > 0) for (let n = 0; n < steps; n += 1) c = DARK[c];
    else for (let n = 0; n < -steps; n += 1) c = LIGHT[c];
    s.d[i] = c;
  }
  function rect(s, x, y, w, h, c) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(s.w, Math.round(x + w));
    const y1 = Math.min(s.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy += 1) s.d.fill(c, yy * s.w + x0, yy * s.w + Math.max(x0, x1));
  }
  /** Ordered-dither fill: `level` 0..1 share of pixels set to `c`. */
  function dither(s, x, y, w, h, c, level) {
    for (let yy = Math.max(0, y); yy < Math.min(s.h, y + h); yy += 1)
      for (let xx = Math.max(0, x); xx < Math.min(s.w, x + w); xx += 1)
        if (bayer(xx, yy) < level) s.d[yy * s.w + xx] = c;
  }
  function line(s, x0, y0, x1, y1, c) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      px(s, x0, y0, c);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  function disc(s, cx, cy, rx, ry, c) {
    ry = ry === undefined ? rx : ry;
    for (let y = Math.floor(-ry); y <= Math.ceil(ry); y += 1)
      for (let x = Math.floor(-rx); x <= Math.ceil(rx); x += 1)
        if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) px(s, cx + x, cy + y, c);
  }
  function ring(s, cx, cy, r, c, from, to) {
    const n = Math.max(12, Math.ceil(r * 7));
    const a0 = from === undefined ? 0 : from;
    const a1 = to === undefined ? Math.PI * 2 : to;
    for (let i = 0; i <= n; i += 1) {
      const a = lerp(a0, a1, i / n);
      px(s, cx + Math.cos(a) * r, cy + Math.sin(a) * r, c);
    }
  }
  /** Scanline polygon fill; pts = [x0,y0,x1,y1,...]. */
  function poly(s, pts, c) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      minY = Math.min(minY, pts[i]);
      maxY = Math.max(maxY, pts[i]);
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y += 1) {
      const xs = [];
      for (let i = 0; i < pts.length; i += 2) {
        const ax = pts[i];
        const ay = pts[i + 1];
        const bx = pts[(i + 2) % pts.length];
        const by = pts[(i + 3) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) rect(s, Math.round(xs[k]), y, Math.round(xs[k + 1]) - Math.round(xs[k]), 1, c);
    }
  }
  function blit(dst, src, x, y) {
    x = Math.round(x);
    y = Math.round(y);
    for (let sy = 0; sy < src.h; sy += 1) {
      const dy = y + sy;
      if (dy < 0 || dy >= dst.h) continue;
      for (let sx = 0; sx < src.w; sx += 1) {
        const dx = x + sx;
        if (dx < 0 || dx >= dst.w) continue;
        const c = src.d[sy * src.w + sx];
        if (c !== T) dst.d[dy * dst.w + dx] = c;
      }
    }
  }
  function copy(src) {
    return { w: src.w, h: src.h, d: new Uint8Array(src.d) };
  }

  // ---------- pixel-exact rotation (Paeth three-shear) ----------
  // Every pixel moves as a whole, nothing is resampled, so 1 px handwriting stays legible.
  function shearPair(angle) {
    return [-Math.tan(angle / 2), Math.sin(angle)];
  }
  function rotFwd(x, y, a, b) {
    const x1 = x + Math.round(a * y);
    const y2 = y + Math.round(b * x1);
    return [x1 + Math.round(a * y2), y2];
  }
  function rotInv(X, Y, a, b) {
    const x1 = X - Math.round(a * Y);
    const y = Y - Math.round(b * x1);
    return [x1 - Math.round(a * y), y];
  }
  /** World position of sprite-local point (lx, ly) for a sprite drawn at centre (cx, cy). */
  function spritePoint(src, cx, cy, angle, lx, ly) {
    const [a, b] = shearPair(angle);
    const [X, Y] = rotFwd(Math.round(lx) - (src.w >> 1), Math.round(ly) - (src.h >> 1), a, b);
    return [Math.round(cx) + X, Math.round(cy) + Y];
  }
  /**
   * Draws `src` rotated about its centre to (cx, cy).
   * opts.shadow = {dx, dy, soft}: instead of drawing, darkens dst one step under the
   * offset silhouette (soft = dithered one-pixel penumbra).
   * opts.squash = vertical scale (landing squash), opts.lift = darken-free scale (pop-in).
   */
  function blitRot(dst, src, cx, cy, angle, opts) {
    const o = opts || {};
    const [a, b] = shearPair(angle);
    const pxv = src.w >> 1;
    const pyv = src.h >> 1;
    const sc = o.scale || 1;
    const sh = o.shadow;
    const offX = sh ? sh.dx : 0;
    const offY = sh ? sh.dy : 0;
    const r = Math.ceil(Math.hypot(src.w, src.h) * 0.5 * sc) + 3;
    const cX = Math.round(cx + offX);
    const cY = Math.round(cy + offY);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Exact rotation decides the outline (clean stair-steps); Paeth decides which pixel shows
    // inside it, so content pixels are never duplicated or dropped.
    const inside = (X, Y) => {
      const ex = (X * cos + Y * sin) / sc + pxv;
      const ey = (-X * sin + Y * cos) / sc + pyv;
      if (ex < -0.5 || ey < -0.5 || ex >= src.w - 0.5 || ey >= src.h - 0.5) return T;
      const [x, y] = rotInv(X, Y, a, b);
      const sx = clamp(Math.floor(x / sc) + pxv, 0, src.w - 1);
      const sy = clamp(Math.floor(y / sc) + pyv, 0, src.h - 1);
      return src.d[sy * src.w + sx];
    };
    for (let Y = -r; Y <= r; Y += 1) {
      const dy = cY + Y;
      if (dy < 0 || dy >= dst.h) continue;
      for (let X = -r; X <= r; X += 1) {
        const dx = cX + X;
        if (dx < 0 || dx >= dst.w) continue;
        const c = inside(X, Y);
        if (sh) {
          if (c !== T) shade(dst, dx, dy, sh.steps || 1);
          else if (sh.soft && ((dx + dy) & 1) === 0 && inside(X - 1, Y - 1) !== T) shade(dst, dx, dy, 1);
        } else if (c !== T) dst.d[dy * dst.w + dx] = c;
      }
    }
  }

  // ---------- organic light: cached value noise so lamp pools are not perfect ellipses ----------
  const noiseCache = new Map();
  function noiseField(w, h, seed, cell) {
    const key = w + 'x' + h + ':' + seed + ':' + cell;
    if (noiseCache.has(key)) return noiseCache.get(key);
    const field = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      const gy = Math.floor(y / cell);
      const fy = E.inOutSine(y / cell - gy);
      for (let x = 0; x < w; x += 1) {
        const gx = Math.floor(x / cell);
        const fx = E.inOutSine(x / cell - gx);
        const a = lerp(hash(seed, gx, gy), hash(seed, gx + 1, gy), fx);
        const b = lerp(hash(seed, gx, gy + 1), hash(seed, gx + 1, gy + 1), fx);
        field[y * w + x] = lerp(a, b, fy) - 0.5;
      }
    }
    const out = { w, h, at: (x, y) => field[clamp(y | 0, 0, h - 1) * w + clamp(x | 0, 0, w - 1)] };
    noiseCache.set(key, out);
    return out;
  }

  // ---------- lighting pass ----------
  /** darkFn(x, y) -> D in steps (negative = brighter); ordered dither between steps. */
  function light(s, darkFn) {
    for (let y = 0; y < s.h; y += 1) {
      for (let x = 0; x < s.w; x += 1) {
        const i = y * s.w + x;
        let c = s.d[i];
        if (c === T) continue;
        const D = darkFn(x, y);
        // narrowed threshold: flat bands of light with short dithered transitions
        const steps = Math.floor(D + bayer(x, y));
        if (steps > 0) for (let n = 0; n < steps; n += 1) c = DARK[c];
        else for (let n = 0; n < -steps; n += 1) c = LIGHT[c];
        s.d[i] = c;
      }
    }
  }

  // ---------- hand marks ----------
  /** Polyline drawn up to `progress` (0..1 of its length) with 10 fps line boil. */
  function stroke(s, pts, progress, c, boilSeed, boil) {
    if (progress <= 0) return;
    let total = 0;
    const lens = [];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const l = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
      lens.push(l);
      total += l;
    }
    let left = total * clamp(progress, 0, 1);
    const jit = (i, axis) => {
      if (!boil || i === 0 || i === pts.length / 2 - 1) return 0;
      return Math.round((hash(boilSeed, i, axis) - 0.5) * 2 * boil);
    };
    for (let k = 0; k < lens.length && left > 0; k += 1) {
      const x0 = pts[k * 2] + jit(k, 1);
      const y0 = pts[k * 2 + 1] + jit(k, 2);
      let x1 = pts[k * 2 + 2] + jit(k + 1, 1);
      let y1 = pts[k * 2 + 3] + jit(k + 1, 2);
      if (left < lens[k]) {
        const f = left / lens[k];
        x1 = lerp(x0, x1, f);
        y1 = lerp(y0, y1, f);
      }
      line(s, x0, y0, x1, y1, c);
      left -= lens[k];
    }
  }

  function present(ctx, s) {
    if (!present.lut) {
      present.lut = new Uint32Array(256);
      PAL.forEach((hex, i) => {
        const v = parseInt(hex.slice(1), 16);
        present.lut[i] = (0xff << 24) | ((v & 0xff) << 16) | (v & 0xff00) | (v >> 16);
      });
      present.lut[T] = present.lut[0];
    }
    if (!present.img || present.img.width !== s.w) present.img = ctx.createImageData(s.w, s.h);
    const out = new Uint32Array(present.img.data.buffer);
    for (let i = 0; i < s.d.length; i += 1) out[i] = present.lut[s.d[i]];
    ctx.putImageData(present.img, 0, 0);
  }

  Object.assign(DB, {
    W, H, T, PAL, C, DARK, LIGHT, bayer, hash, clamp, seg, lerp, E, wobble,
    surf, px, get, shade, rect, dither, line, disc, ring, poly, blit, copy,
    blitRot, spritePoint, light, stroke, present, noiseField,
  });
})();

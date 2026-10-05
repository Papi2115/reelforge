/* detective-board 2a "Wall in a dark room" - indexed-colour software rasteriser.
 * Pure functions only: no clocks, no Math.random. Surfaces hold palette indices; 255 = transparent. */
(function () {
  'use strict';
  const D2 = (window.D2 = window.D2 || {});
  const W = 640;
  const H = 360;
  const T = 255;

  // 24 colours. Warm cork + aged paper under a desk lamp, falling off into cool plum/navy shadow;
  // cool blue only for the street light through the blinds; RED only for string and key marks.
  const PAL = [
    '#09080c', // 0  BLACK    deepest shadow, pupils of the room
    '#15131b', // 1  NIGHT    room shadow
    '#241e27', // 2  SHADOW   cork in shadow, desk underside
    '#3a3140', // 3  DUSK     paper in shadow, far wall
    '#4b2e22', // 4  CORK_DD  cork deep, seams, desk wood dark
    '#6d4229', // 5  CORK_D   cork dark, speckles
    '#93603a', // 6  CORK     cork base (lamp-lit mid)
    '#b98551', // 7  CORK_L   lit cork, desk wood highlight
    '#e2b56f', // 8  BRASS    lamp-hot cork, pins, bulb glow, manila
    '#8d8070', // 9  PAPER_DD paper deep shade, faded print
    '#c2b293', // 10 PAPER_D  paper shade, folds, sand
    '#e8dcbd', // 11 PAPER    notes, photo borders
    '#fbf5e2', // 12 WHITE    hot highlight, label-tape letters
    '#d22f22', // 13 RED      string, key marks, the stamp - nothing else
    '#74191a', // 14 RED_D    string underside, pin shade
    '#222f47', // 15 INK      ballpoint, photo darks
    '#3b6168', // 16 TEAL_D   photo water/sky dark
    '#7ba49c', // 17 TEAL     photo water/sky
    '#4e6a3d', // 18 GREEN_D  banknotes dark
    '#8ea766', // 19 GREEN    banknotes
    '#2a3a60', // 20 NAVY     night outside, label tape, cool light in shadow
    '#6c87b6', // 21 BLUE     blind stripes, glass
    '#5a5560', // 22 GRAPH    graphite, pencil, iron
    '#a39e98', // 23 STEEL    aluminium, magnifier rim
  ];
  const C = {
    BLACK: 0, NIGHT: 1, SHADOW: 2, DUSK: 3, CORK_DD: 4, CORK_D: 5, CORK: 6, CORK_L: 7, BRASS: 8,
    PAPER_DD: 9, PAPER_D: 10, PAPER: 11, WHITE: 12, RED: 13, RED_D: 14, INK: 15, TEAL_D: 16, TEAL: 17,
    GREEN_D: 18, GREEN: 19, NAVY: 20, BLUE: 21, GRAPH: 22, STEEL: 23,
  };
  // one light step darker / lighter per colour (warm falls off to cool plum, then navy-black)
  const DARK = [0, 0, 1, 2, 2, 4, 5, 6, 7, 3, 9, 10, 11, 14, 2, 1, 15, 16, 2, 18, 1, 20, 3, 22];
  const LIGHT = [1, 2, 3, 22, 5, 6, 7, 8, 12, 10, 11, 12, 12, 13, 13, 20, 17, 17, 19, 19, 21, 21, 23, 11];
  // deep shadow collapses texture: every cork tone -> one shadow, every paper tone -> one dusk (no grain)
  const DEEP3 = [0, 0, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 14, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3];
  const DEEP4 = [0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 0, 0, 2, 0, 2, 0, 2, 0, 2];
  // a cool street-light stripe falling on a surface that is in shadow: flat navy on cork, blue on paper
  const COOL = [1, 1, 20, 20, 20, 20, 20, 20, 20, 21, 21, 21, 21, 14, 20, 1, 20, 21, 20, 21, 20, 21, 1, 21];
  /** Colour c moved k light steps (k > 0 darker, k < 0 lighter); 3+ steps collapse texture. */
  function ramp(c, k) {
    if (k >= 4) return DEEP4[c];
    if (k === 3) return DEEP3[c];
    if (k > 0) for (let n = 0; n < k; n += 1) c = DARK[c];
    else for (let n = 0; n < -k; n += 1) c = LIGHT[c];
    return c;
  }

  // ---------- seeded randomness ----------
  function hash(a, b, c) {
    let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ Math.imul((c | 0) + 0x9e3779b9, 0xc2b2ae35), 0x27d4eb2f) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d) >>> 0;
    h ^= h >>> 12;
    return (h >>> 0) / 4294967296;
  }
  /** Smooth 1-D value noise in -0.5..0.5. */
  function noise1(x, seed) {
    const i = Math.floor(x);
    const f = x - i;
    const k = f * f * (3 - 2 * f);
    return hash(seed, i, 0) * (1 - k) + hash(seed, i + 1, 0) * k - 0.5;
  }
  /** Smooth 2-D value noise in -0.5..0.5 (cell size 1). */
  function noise2(x, y, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const kx = fx * fx * (3 - 2 * fx);
    const ky = fy * fy * (3 - 2 * fy);
    const a = hash(seed, ix, iy) * (1 - kx) + hash(seed, ix + 1, iy) * kx;
    const b = hash(seed, ix, iy + 1) * (1 - kx) + hash(seed, ix + 1, iy + 1) * kx;
    return a * (1 - ky) + b * ky - 0.5;
  }

  // ---------- easing & timing ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, v) => {
    const k = clamp((v - a) / (b - a), 0, 1);
    return k * k * (3 - 2 * k);
  };
  const E = {
    linear: (k) => k,
    inQuad: (k) => k * k,
    outQuad: (k) => 1 - (1 - k) * (1 - k),
    outCubic: (k) => 1 - Math.pow(1 - k, 3),
    inCubic: (k) => k * k * k,
    inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
    inOutQuint: (k) => (k < 0.5 ? 16 * k * k * k * k * k : 1 - Math.pow(-2 * k + 2, 5) / 2),
    outBack: (k) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2),
  };
  /** Damped oscillation starting at 1 (twang, wobble). */
  function wobble(dt, freq, damp) {
    if (dt <= 0) return 1;
    return Math.exp(-damp * dt) * Math.cos(freq * dt);
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
  /** Darken (steps > 0) or lighten (steps < 0) an existing pixel along the ramps. */
  function shade(s, x, y, steps) {
    x = Math.round(x);
    y = Math.round(y);
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
    for (let yy = y0; yy < y1; yy += 1) if (x1 > x0) s.d.fill(c, yy * s.w + x0, yy * s.w + x1);
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
    let guard = 0;
    for (;;) {
      px(s, x0, y0, c);
      if ((x0 === x1 && y0 === y1) || guard > 8000) return;
      guard += 1;
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
  function ring(s, cx, cy, rx, ry, c, from, to) {
    const n = Math.max(16, Math.ceil(Math.max(rx, ry) * 7));
    const a0 = from === undefined ? 0 : from;
    const a1 = to === undefined ? Math.PI * 2 : to;
    for (let i = 0; i <= n; i += 1) {
      const a = lerp(a0, a1, i / n);
      px(s, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, c);
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
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.round(xs[k]);
        rect(s, xa, y, Math.round(xs[k + 1]) - xa, 1, c);
      }
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

  // ---------- pixel-exact rotation (Paeth three-shear inside an exact outline) ----------
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
  /** Destination position of sprite-local point (lx, ly) for a sprite centred at (cx, cy). */
  function spritePoint(src, cx, cy, angle, lx, ly) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = lx - src.w / 2;
    const y = ly - src.h / 2;
    return [cx + x * cos - y * sin, cy + x * sin + y * cos];
  }
  /**
   * Draws `src` rotated about its centre to (cx, cy). opts.shadow = {dx, dy, steps}: darkens dst
   * under the offset silhouette instead of drawing. opts.sy = vertical squash (landing).
   */
  function blitRot(dst, src, cx, cy, angle, opts) {
    const o = opts || {};
    const sh = o.shadow;
    const sy = o.sy || 1;
    const [a, b] = shearPair(angle);
    const pxv = src.w >> 1;
    const pyv = src.h >> 1;
    const r = Math.ceil(Math.hypot(src.w, src.h) * 0.5 * Math.max(1, sy)) + 2;
    const cX = Math.round(cx + (sh ? sh.dx : 0));
    const cY = Math.round(cy + (sh ? sh.dy : 0));
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const straight = Math.abs(angle) < 1e-4 && sy === 1;
    for (let Y = -r; Y <= r; Y += 1) {
      const dy = cY + Y;
      if (dy < 0 || dy >= dst.h) continue;
      for (let X = -r; X <= r; X += 1) {
        const dx = cX + X;
        if (dx < 0 || dx >= dst.w) continue;
        let c;
        if (straight) {
          c = get(src, X + pxv, Y + pyv);
        } else {
          const ex = X * cos + (Y / sy) * sin + pxv;
          const ey = -X * sin + (Y / sy) * cos + pyv;
          if (ex < -0.5 || ey < -0.5 || ex >= src.w - 0.5 || ey >= src.h - 0.5) continue;
          const [x, y] = rotInv(X, Math.round(Y / sy), a, b);
          c = src.d[clamp(y + pyv, 0, src.h - 1) * src.w + clamp(x + pxv, 0, src.w - 1)];
        }
        if (c === T) continue;
        if (sh) shade(dst, dx, dy, sh.steps || 1);
        else dst.d[dy * dst.w + dx] = c;
      }
    }
  }

  /** Polyline drawn up to `progress` (0..1 of its length), optional seeded boil (px). */
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

  // ---------- palette helpers ----------
  const RGB = PAL.map((hex) => {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  });
  let nearestLut = null;
  /** Nearest palette index for an RGB triple (5-bit LUT, built once). */
  function nearest(r, g, b) {
    if (!nearestLut) {
      nearestLut = new Uint8Array(32768);
      for (let i = 0; i < 32768; i += 1) {
        const R = ((i >> 10) & 31) * 8 + 4;
        const G = ((i >> 5) & 31) * 8 + 4;
        const B = (i & 31) * 8 + 4;
        let best = 0;
        let bd = Infinity;
        for (let p = 0; p < RGB.length; p += 1) {
          const dr = R - RGB[p][0];
          const dg = G - RGB[p][1];
          const db = B - RGB[p][2];
          const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        nearestLut[i] = best;
      }
    }
    return nearestLut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
  }

  function present(ctx, s) {
    if (!present.lut) {
      present.lut = new Uint32Array(256);
      RGB.forEach((c, i) => {
        present.lut[i] = (0xff << 24) | (c[2] << 16) | (c[1] << 8) | c[0];
      });
      present.lut[T] = present.lut[0];
    }
    if (!present.img) present.img = ctx.createImageData(s.w, s.h);
    const out = new Uint32Array(present.img.data.buffer);
    for (let i = 0; i < s.d.length; i += 1) out[i] = present.lut[s.d[i]];
    ctx.putImageData(present.img, 0, 0);
  }

  Object.assign(D2, {
    W, H, T, PAL, RGB, C, DARK, LIGHT, COOL, DEEP3, DEEP4, ramp, hash, noise1, noise2, clamp, seg, lerp, smooth, E, wobble,
    surf, px, get, shade, rect, line, disc, ring, poly, blit, copy, blitRot, spritePoint, stroke, nearest, present,
  });
})();

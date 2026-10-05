/* game-hud B2 "First-person RPG" - core: palette, hashing, easing, indexed bitmaps, hand strokes.
   Everything the renderer draws is a palette index; nothing here reads a clock or Math.random. */
'use strict';
(function () {
  const RF = (window.RF = {});

  // 32 colours. Order = ramps (dark -> light) so lookups stay readable.
  const PALETTE = [
    ['VOID', '08070a'], ['SHADOW', '16131b'],
    ['UMBER', '2c1e18'], ['BROWN', '4e3325'], ['WOOD', '7d5336'], ['TAN', 'b07b49'], ['TUNGSTEN', 'e2a85f'], ['BULB', 'ffde9c'],
    ['MOSS_D', '10201a'], ['MOSS', '1f3b2d'], ['GREEN', '3a634b'], ['SAGE', '6d9d6a'], ['FLUO', 'b5dd8f'], ['TUBE', 'ecfbd2'],
    ['NIGHT_D', '0d1428'], ['NIGHT', '1a2546'], ['DUSK', '2f4471'], ['HAZE', '57729f'], ['MOON', '95afd1'],
    ['DIRT_D', '39292c'], ['DIRT', '6a5049'], ['SAND', 'a5846a'], ['SAND_L', 'd8b98f'], ['PAPER', 'f5e7c6'],
    ['CHAR', '2b292a'], ['SLATE', '504c4b'], ['GREY', '87817b'], ['PUTTY', 'c4bdb0'],
    ['ACCENT', 'ff4d7a'], ['ACCENT_D', '9b2546'], ['CLAY', 'b4603c'], ['PLUM', '3d2b47'],
  ];
  const C = {};
  RF.PAL = PALETTE.map(([name, hex], i) => {
    C[name] = i;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  });
  RF.PAL_HEX = PALETTE.map((p) => '#' + p[1]);
  RF.PAL_NAMES = PALETTE.map((p) => p[0]);
  RF.C = C;
  const T = (RF.T = 255); // transparent

  // ---------- hashing / PRNG (seeded, integer maths only) ----------
  function hash3(a, b, c) {
    let h = ((a | 0) * 73856093) ^ ((b | 0) * 19349663) ^ ((c | 0) * 83492791);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  RF.hash3 = hash3;
  RF.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** Smooth value noise in [0,1) on an integer lattice of size `cell`. */
  RF.vnoise = function (x, y, cell, seed) {
    const gx = x / cell, gy = y / cell;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash3(x0, y0, seed), b = hash3(x0 + 1, y0, seed);
    const c = hash3(x0, y0 + 1, seed), d = hash3(x0 + 1, y0 + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };

  // ---------- easing / time helpers ----------
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  RF.clamp01 = clamp01;
  RF.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  RF.lerp = (a, b, u) => a + (b - a) * u;
  RF.seg = (t, a, b) => clamp01((t - a) / (b - a));
  RF.ease = {
    lin: (u) => u,
    hold: () => 0,
    in: (u) => u * u * u,
    out: (u) => 1 - (1 - u) * (1 - u) * (1 - u),
    inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    sine: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u),
    outBack: (u) => {
      const c1 = 1.9, c3 = c1 + 1;
      return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
    },
  };
  /** 4x4 ordered dither thresholds in (0,1). */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  RF.BAYER = BAYER;
  RF.bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

  // ---------- nearest colour + lighting colormaps (Doom-style COLORMAP, built once) ----------
  function nearest(r, g, b) {
    let best = 0, bestD = 1e18;
    for (let i = 0; i < RF.PAL.length; i++) {
      if (i === C.ACCENT || i === C.ACCENT_D) continue; // lighting never invents accent pixels
      const p = RF.PAL[i];
      const rm = (p[0] + r) / 2;
      const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  RF.nearest = nearest;
  RF.LIGHT_LEVELS = 16;
  RF.FOG_LEVELS = 8;
  RF.LIGHT_MAX = 1.3;
  /** cmap[(c*16 + light)*8 + fog] -> palette index. Accent keeps its own ramp so the point stays readable. */
  RF.makeColormap = function (tint, fog) {
    const out = new Uint8Array(32 * 16 * 8);
    for (let c = 0; c < 32; c++) {
      const p = RF.PAL[c];
      for (let li = 0; li < 16; li++) {
        const l = (li / 15) * RF.LIGHT_MAX;
        for (let gi = 0; gi < 8; gi++) {
          const g = gi / 7;
          let idx;
          if ((c === C.ACCENT || c === C.ACCENT_D) && g < 0.6 && l > 0.32) idx = l > 0.7 ? c : C.ACCENT_D;
          else {
            const r = Math.min(255, p[0] * l * tint[0]) * (1 - g) + fog[0] * g;
            const gg = Math.min(255, p[1] * l * tint[1]) * (1 - g) + fog[1] * g;
            const b = Math.min(255, p[2] * l * tint[2]) * (1 - g) + fog[2] * g;
            idx = nearest(r, gg, b);
          }
          out[(c * 16 + li) * 8 + gi] = idx;
        }
      }
    }
    return out;
  };
  /** c -> darker index, for menus dimming the world behind them. */
  RF.makeDimMap = function (k, tint) {
    const out = new Uint8Array(256);
    for (let c = 0; c < 32; c++) {
      const p = RF.PAL[c];
      out[c] = nearest(p[0] * k * tint[0], p[1] * k * tint[1], p[2] * k * tint[2]);
    }
    return out;
  };

  // ---------- indexed bitmap ----------
  function Bmp(w, h, fill) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h).fill(fill === undefined ? T : fill);
  }
  RF.Bmp = Bmp;
  const B = Bmp.prototype;
  B.px = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  };
  B.get = function (x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : T;
  };
  B.rect = function (x, y, w, h, c) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w)), y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) this.d.fill(c, yy * this.w + x0, yy * this.w + Math.max(x0, x1));
  };
  B.frame = function (x, y, w, h, c) {
    this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c);
  };
  /** Ordered-dither fill: `level` share of pixels get c2. */
  B.dither = function (x, y, w, h, c1, c2, level) {
    for (let yy = Math.floor(y); yy < y + h; yy++)
      for (let xx = Math.floor(x); xx < x + w; xx++) this.px(xx, yy, RF.bayer(xx, yy) < level ? c2 : c1);
  };
  B.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  B.ellipse = function (cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.px(x, y, c);
      }
  };
  /** Scanline polygon fill; pts = [x0,y0,x1,y1,...]. */
  B.poly = function (pts, c) {
    let minY = 1e9, maxY = -1e9;
    for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
    const n = pts.length / 2;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c);
    }
  };
  /** Copy opaque pixels; opts.map remaps indices, opts.flip mirrors. */
  B.blit = function (src, x, y, opts) {
    const map = opts && opts.map, flip = opts && opts.flip;
    x = Math.round(x); y = Math.round(y);
    for (let sy = 0; sy < src.h; sy++) {
      const dy = y + sy;
      if (dy < 0 || dy >= this.h) continue;
      for (let sx = 0; sx < src.w; sx++) {
        const c = src.d[sy * src.w + (flip ? src.w - 1 - sx : sx)];
        if (c === T) continue;
        const dx = x + sx;
        if (dx < 0 || dx >= this.w) continue;
        this.d[dy * this.w + dx] = map ? map[c] : c;
      }
    }
  };
  /** Nearest-neighbour scaled blit (sprites that grow/shrink). */
  B.blitScaled = function (src, x, y, scale, map) {
    const w = Math.round(src.w * scale), h = Math.round(src.h * scale);
    x = Math.round(x); y = Math.round(y);
    for (let dy = 0; dy < h; dy++) {
      const py = y + dy;
      if (py < 0 || py >= this.h) continue;
      const sy = Math.min(src.h - 1, Math.floor(dy / scale));
      for (let dx = 0; dx < w; dx++) {
        const px = x + dx;
        if (px < 0 || px >= this.w) continue;
        const c = src.d[sy * src.w + Math.min(src.w - 1, Math.floor(dx / scale))];
        if (c !== T) this.d[py * this.w + px] = map ? map[c] : c;
      }
    }
  };
  /** Add a 1-px outline around opaque pixels (in place). */
  B.outline = function (c, onlyBelow) {
    const src = this.d.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== T) continue;
        const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && src[yy * this.w + xx] !== T;
        if (onlyBelow ? n(x, y - 1) : n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.d[y * this.w + x] = c;
      }
    return this;
  };
  /** Rotated copy (nearest, pixel-snapped) - used for slightly crooked notes and the tumbling cartridge. */
  RF.rotate = function (src, deg) {
    const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const w = Math.ceil(Math.abs(src.w * ca) + Math.abs(src.h * sa)) + 2;
    const h = Math.ceil(Math.abs(src.w * sa) + Math.abs(src.h * ca)) + 2;
    const out = new Bmp(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - w / 2, dy = y + 0.5 - h / 2;
        const sx = Math.floor(dx * ca + dy * sa + src.w / 2), sy = Math.floor(-dx * sa + dy * ca + src.h / 2);
        if (sx >= 0 && sy >= 0 && sx < src.w && sy < src.h) out.d[y * w + x] = src.d[sy * src.w + sx];
      }
    return out;
  };
  /**
   * Hand-drawn stroke: a polyline with seeded perpendicular wobble, drawn up to `progress` (0..1).
   * Two strokes with different seeds make the "arrow drawn in two strokes" trace.
   */
  RF.handStroke = function (bmp, pts, c, seed, wobble, progress, thick) {
    const r = RF.rng(seed);
    const segs = [];
    let total = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const len = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
      segs.push([pts[i], pts[i + 1], pts[i + 2], pts[i + 3], len]);
      total += len;
    }
    const limit = total * (progress === undefined ? 1 : progress);
    let done = 0;
    for (const [ax, ay, bx, by, len] of segs) {
      const steps = Math.max(1, Math.ceil(len));
      const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
      const w0 = (r() - 0.5) * wobble, w1 = (r() - 0.5) * wobble;
      for (let s = 0; s <= steps; s++) {
        if (done + (s / steps) * len > limit) return;
        const u = s / steps, bow = Math.sin(Math.PI * u) * (w0 + (w1 - w0) * u);
        const x = ax + (bx - ax) * u + nx * bow, y = ay + (by - ay) * u + ny * bow;
        bmp.px(x, y, c);
        if (thick) bmp.px(x + 1, y, c);
      }
      done += len;
    }
  };
})();

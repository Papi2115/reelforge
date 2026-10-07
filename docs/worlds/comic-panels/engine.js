/* comic-panels showcase - tiny indexed-colour rasterizer.
 * Everything draws into a 640x360 Uint8Array of palette indices; the page converts it to RGBA once
 * per frame. No Math.random, no Date: every "random" value is rnd(key, i) - a hash of a string seed.
 */
'use strict';
(function () {
  const W = 640;
  const H = 360;

  // 16 inks: a cheap four-colour print job on yellowed newsprint, plus a spot red and a grey run.
  const PALETTE = [
    '#1b1714', // 0 INK      key plate - line art, lettering
    '#252a3f', // 1 NIGHT    space, deep interior shadow
    '#f1e5c9', // 2 PAPER    newsprint, balloons
    '#dccba5', // 3 SHADE    paper fibres, gutter wear, thumbprint
    '#b49d76', // 4 AGED     foxing, page edge
    '#3e86a0', // 5 CYAN     process cyan
    '#24546a', // 6 CYAN_D   cyan over cyan: interiors, Houston
    '#c35a70', // 7 MAG      process magenta (faded) - foil shading, onomatopoeia shade
    '#e2b13b', // 8 YEL      process yellow - gold foil, caution lamp
    '#efd690', // 9 YEL_P    caption boxes
    '#d8381f', // 10 RED     spot red - the alarm, nothing else
    '#aaa497', // 11 MOON_L  regolith lit / suit white
    '#7a7569', // 12 MOON_M  regolith mid
    '#4c4840', // 13 MOON_D  regolith shadow
    '#93c86b', // 14 DSKY    electroluminescent green of the DSKY
    '#8b8d94', // 15 PENCIL  graphite margin notes
  ];
  const C = {
    INK: 0, NIGHT: 1, PAPER: 2, SHADE: 3, AGED: 4, CYAN: 5, CYAN_D: 6, MAG: 7,
    YEL: 8, YEL_P: 9, RED: 10, MOON_L: 11, MOON_M: 12, MOON_D: 13, DSKY: 14, PENCIL: 15,
  };
  const RGB = PALETTE.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));

  const fb = new Uint8Array(W * H);
  let clip = null;

  // ---------- seeded randomness ----------
  function hashString(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  /** Deterministic [0,1) from a string key and an integer index. */
  function rnd(key, index) {
    let x = (hashString(key) ^ Math.imul((index | 0) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  const rndRange = (key, i, a, b) => a + (b - a) * rnd(key, i);
  const rndInt = (key, i, a, b) => Math.floor(rndRange(key, i, a, b + 1));

  // ---------- easing & timing ----------
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const E = {
    linear: (p) => p,
    inQuad: (p) => p * p,
    outQuad: (p) => 1 - (1 - p) * (1 - p),
    inCubic: (p) => p * p * p,
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    outQuart: (p) => 1 - Math.pow(1 - p, 4),
    inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
    outBack: (p) => {
      const s = 1.9;
      const q = p - 1;
      return 1 + (s + 1) * q * q * q + s * q * q;
    },
    outBackSoft: (p) => {
      const s = 0.9;
      const q = p - 1;
      return 1 + (s + 1) * q * q * q + s * q * q;
    },
  };
  /** Progress of t through [a,b], eased. */
  function seg(t, a, b, ease) {
    const p = clamp01((t - a) / (b - a));
    return (ease || E.linear)(p);
  }
  const lerp = (a, b, p) => a + (b - a) * p;
  /** Keyframe track: [[time, value, easeIntoThisKey], ...] */
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1];
        const [t1, v1, ease] = keys[i];
        return lerp(v0, v1, (ease || E.inOutCubic)((t - t0) / (t1 - t0)));
      }
    }
    return keys[keys.length - 1][1];
  }
  /** Decaying, frame-stepped shake (30 fps steps so it reads as a camera hit, not noise). */
  function shake(t, t0, amp, decay, key) {
    if (t < t0) return [0, 0];
    const age = t - t0;
    const a = amp * Math.exp(-age / decay);
    if (a < 0.5) return [0, 0];
    const f = Math.floor(t * 30);
    return [Math.round((rnd(key, f * 2) * 2 - 1) * a), Math.round((rnd(key, f * 2 + 1) * 2 - 1) * a)];
  }

  // ---------- raster core ----------
  function clear(c) {
    fb.fill(c);
  }
  function setClip(mask) {
    clip = mask;
  }
  function getClip() {
    return clip;
  }
  function span(y, x0, x1, paint) {
    if (y < 0 || y >= H) return;
    if (x0 < 0) x0 = 0;
    if (x1 > W - 1) x1 = W - 1;
    const row = y * W;
    if (typeof paint === 'number') {
      for (let x = x0; x <= x1; x++) {
        const i = row + x;
        if (!clip || clip[i]) fb[i] = paint;
      }
    } else {
      for (let x = x0; x <= x1; x++) {
        const i = row + x;
        if (clip && !clip[i]) continue;
        const c = paint(x, y);
        if (c >= 0) fb[i] = c;
      }
    }
  }
  function plot(x, y, paint) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    span(y, x, x, paint);
  }
  function rect(x, y, w, h, paint) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + w) - 1;
    const y1 = Math.round(y + h) - 1;
    for (let yy = y0; yy <= y1; yy++) span(yy, x0, x1, paint);
  }
  /** Even-odd scanline polygon fill; pts = [x0,y0,x1,y1,...] in screen pixels. */
  function poly(pts, paint, target) {
    const n = pts.length / 2;
    if (n < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      if (pts[i] < minY) minY = pts[i];
      if (pts[i] > maxY) maxY = pts[i];
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(H - 1, Math.ceil(maxY));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2];
        const ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2];
        const by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k] - 0.5);
        const xb = Math.floor(xs[k + 1] - 0.5);
        if (xb < xa) continue;
        if (target) {
          const a = Math.max(0, xa);
          const b = Math.min(W - 1, xb);
          for (let x = a; x <= b; x++) target[y * W + x] = 1;
        } else span(y, xa, xb, paint);
      }
    }
  }
  function maskPoly(pts, intersectWith) {
    const m = new Uint8Array(W * H);
    poly(pts, 0, m);
    if (intersectWith) for (let i = 0; i < m.length; i++) m[i] &= intersectWith[i];
    return m;
  }
  function ellipsePts(cx, cy, rx, ry, steps, wobbleKey, wobbleAmp) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      let k = 1;
      if (wobbleKey) {
        k += wobbleAmp * Math.sin(a * 3 + rnd(wobbleKey, 1) * 6.28) + wobbleAmp * 0.6 * Math.sin(a * 5 + rnd(wobbleKey, 2) * 6.28);
      }
      pts.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
    }
    return pts;
  }
  function ellipse(cx, cy, rx, ry, paint) {
    if (rx <= 0 || ry <= 0) return;
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (dy < -1 || dy > 1) continue;
      const dx = rx * Math.sqrt(1 - dy * dy);
      const xa = Math.ceil(cx - dx - 0.5);
      const xb = Math.floor(cx + dx - 0.5);
      if (xb >= xa) span(y, xa, xb, paint);
    }
  }
  /** Bresenham line, square brush of width w. */
  function line(x0, y0, x1, y1, paint, w) {
    w = w || 1;
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((w - 1) / 2);
    for (;;) {
      if (w === 1) plot(x0, y0, paint);
      else rect(x0 - off, y0 - off, w, w, paint);
      if (x0 === x1 && y0 === y1) break;
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
  function polyline(pts, paint, w, closed) {
    const n = pts.length / 2;
    for (let i = 0; i < n - (closed ? 0 : 1); i++) {
      const j = (i + 1) % n;
      line(pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1], paint, w);
    }
  }
  /** Partial polyline: draws the first fraction p of its length (for strokes that "draw on"). */
  function strokeOn(pts, p, paint, w) {
    if (p <= 0) return;
    let total = 0;
    for (let i = 2; i < pts.length; i += 2) total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    let left = total * clamp01(p);
    for (let i = 2; i < pts.length && left > 0; i += 2) {
      const l = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      const k = Math.min(1, left / l);
      line(pts[i - 2], pts[i - 1], lerp(pts[i - 2], pts[i], k), lerp(pts[i - 1], pts[i + 1], k), paint, w);
      left -= l;
    }
  }

  // ---------- print textures ----------
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /** Ordered dither between two inks; level 0 = all a, 1 = all b. level may be fn(x,y). */
  function dither(a, b, level) {
    return (x, y) => {
      const l = typeof level === 'number' ? level : level(x, y);
      return BAYER4[(y & 3) * 4 + (x & 3)] < l * 16 ? b : a;
    };
  }
  /** Halftone screen: dots of `ink` on a grid rotated by `angle`; tone 0..1 (may be fn). bg -1 = transparent. */
  function halftone(ink, tone, opt) {
    const o = opt || {};
    const cell = o.cell || 4;
    const ang = o.angle === undefined ? 0.26 : o.angle;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const ox = o.ox || 0;
    const oy = o.oy || 0;
    const bg = o.bg === undefined ? -1 : o.bg;
    return (x, y) => {
      const X = x + 0.5 - ox;
      const Y = y + 0.5 - oy;
      const u = (X * ca + Y * sa) / cell;
      const v = (-X * sa + Y * ca) / cell;
      const fu = u - Math.floor(u) - 0.5;
      const fv = v - Math.floor(v) - 0.5;
      const tv = typeof tone === 'number' ? tone : tone(x, y);
      if (tv <= 0) return bg;
      return fu * fu + fv * fv < tv * 0.32 ? ink : bg;
    };
  }
  /** Layered paint: first non-transparent wins. */
  function layer() {
    const paints = Array.prototype.slice.call(arguments);
    return (x, y) => {
      for (const p of paints) {
        const c = typeof p === 'number' ? p : p(x, y);
        if (c >= 0) return c;
      }
      return -1;
    };
  }

  // ---------- view transforms ----------
  /** A placement: screen = (local * s) + (ox, oy). mis = colour-plate misregistration in px. */
  function Xf(s, ox, oy) {
    this.s = s;
    this.ox = ox;
    this.oy = oy;
  }
  Xf.prototype.x = function (x) {
    return this.ox + x * this.s;
  };
  Xf.prototype.y = function (y) {
    return this.oy + y * this.s;
  };
  Xf.prototype.map = function (pts) {
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) {
      out[i] = this.ox + pts[i] * this.s;
      out[i + 1] = this.oy + pts[i + 1] * this.s;
    }
    return out;
  };
  /** Child placement: local origin at (x,y) of this space, scaled by k. */
  Xf.prototype.at = function (x, y, k) {
    return new Xf(this.s * (k || 1), this.x(x), this.y(y));
  };
  Xf.prototype.shift = function (dx, dy) {
    return new Xf(this.s, this.ox + dx, this.oy + dy);
  };
  Xf.prototype.poly = function (pts, paint) {
    poly(this.map(pts), paint);
  };
  Xf.prototype.outline = function (pts, paint, w, closed) {
    polyline(this.map(pts), paint, w || 1, closed !== false);
  };
  Xf.prototype.line = function (x0, y0, x1, y1, paint, w) {
    line(this.x(x0), this.y(y0), this.x(x1), this.y(y1), paint, w || 1);
  };
  Xf.prototype.rect = function (x, y, w, h, paint) {
    poly(this.map([x, y, x + w, y, x + w, y + h, x, y + h]), paint);
  };
  Xf.prototype.ellipse = function (cx, cy, rx, ry, paint) {
    ellipse(this.x(cx), this.y(cy), rx * this.s, ry * this.s, paint);
  };
  /** Ink line width that grows with zoom, never thinner than 1 px. */
  Xf.prototype.w = function (base) {
    return Math.max(1, Math.round(base * this.s));
  };

  /** Line boil: seeded 1 px wobble of a point list, re-rolled on a 10 fps cadence. */
  let boilFrame = 0;
  function setBoilFrame(t) {
    boilFrame = Math.floor(t * 10);
  }
  function boil(pts, key, amp) {
    const a = amp === undefined ? 1 : amp;
    const out = pts.slice();
    for (let i = 0; i < out.length; i++) out[i] += Math.round((rnd(key, boilFrame * 97 + i) * 2 - 1) * a * 0.75);
    return out;
  }

  window.CP = {
    W, H, PALETTE, RGB, C, fb, rnd, rndRange, rndInt, hashString, E, seg, lerp, track, clamp01, shake,
    clear, setClip, getClip, span, plot, rect, poly, maskPoly, ellipsePts, ellipse, line, polyline, strokeOn,
    dither, halftone, layer, BAYER4, Xf, setBoilFrame, boil,
  };
})();

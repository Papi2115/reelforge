/* B1 v2 "Boss-fight montage" (10 shots) - core: indexed framebuffer, palette, primitives, seeded hash, easing.
   Everything here is pure: no clocks, no Math.random. A frame is a function of (shot, t). */
'use strict';
(function () {
  const W = 640;
  const H = 360;

  // 23 inks: an early-80s living room seen through an NTSC 2600 picture.
  const PAL = [
    ['VOID', '#0b090d'], ['TUBE', '#17131d'], ['NIGHT', '#2a2340'], ['DUSK', '#533a5e'], ['MAUVE', '#9c5c74'],
    ['WALNUT_D', '#2c1a12'], ['WALNUT', '#50301e'], ['TEAK', '#84522c'], ['TAN', '#bf8d57'], ['CREAM', '#efd9ae'],
    ['WHITE', '#fff3dc'], ['RUST', '#92381a'], ['ORANGE', '#d9651f'], ['GOLD', '#eba73a'], ['TEAL_D', '#163c43'],
    ['TEAL', '#2a8783'], ['AQUA', '#82c9b5'], ['OLIVE_D', '#39401a'], ['AVOCADO', '#77812d'], ['GREY_D', '#403d47'],
    ['GREY', '#8a8591'], ['BLUE', '#4a68bd'], ['CRIMSON', '#e3304a'],
  ];
  const C = {};
  PAL.forEach((p, i) => { C[p[0]] = i; });
  const RGB = PAL.map((p) => [parseInt(p[1].slice(1, 3), 16), parseInt(p[1].slice(3, 5), 16), parseInt(p[1].slice(5, 7), 16)]);
  const RGBA32 = new Uint32Array(RGB.map((c) => (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]));

  function lut(pairs) {
    const out = PAL.map((_, i) => i);
    Object.keys(pairs).forEach((k) => { out[C[k]] = C[pairs[k]]; });
    return out;
  }
  // One step down each ramp: scanlines, shadows, tube falloff.
  const SCAN = lut({
    TUBE: 'VOID', NIGHT: 'TUBE', DUSK: 'NIGHT', MAUVE: 'DUSK', WALNUT_D: 'VOID', WALNUT: 'WALNUT_D', TEAK: 'WALNUT',
    TAN: 'TEAK', CREAM: 'TAN', WHITE: 'CREAM', RUST: 'WALNUT', ORANGE: 'RUST', GOLD: 'ORANGE', TEAL_D: 'TUBE',
    TEAL: 'TEAL_D', AQUA: 'TEAL', OLIVE_D: 'WALNUT_D', AVOCADO: 'OLIVE_D', GREY_D: 'TUBE', GREY: 'GREY_D', BLUE: 'NIGHT',
    CRIMSON: 'RUST',
  });
  // Chroma that smears to the right onto dark pixels (NTSC colour bleed). -1 = no bleed.
  const BLEED = PAL.map(() => -1);
  [['ORANGE', 'RUST'], ['GOLD', 'RUST'], ['CRIMSON', 'RUST'], ['TEAL', 'TEAL_D'], ['AQUA', 'TEAL_D'], ['BLUE', 'NIGHT'],
    ['AVOCADO', 'OLIVE_D'], ['MAUVE', 'DUSK'], ['TAN', 'WALNUT'], ['CREAM', 'WALNUT']].forEach((p) => { BLEED[C[p[0]]] = C[p[1]]; });
  const DARK = PAL.map(() => false);
  ['VOID', 'TUBE', 'NIGHT', 'WALNUT_D', 'TEAL_D', 'OLIVE_D', 'GREY_D'].forEach((k) => { DARK[C[k]] = true; });
  // Burn-in: a ghost only shows on dark glass.
  const GHOST = lut({ VOID: 'TUBE', TUBE: 'NIGHT', WALNUT_D: 'WALNUT', TEAL_D: 'TEAL_D', NIGHT: 'DUSK' });
  // The crash: everything drains toward the dark end of its ramp.
  const DRAIN = lut({
    NIGHT: 'TUBE', DUSK: 'GREY_D', MAUVE: 'GREY_D', WALNUT_D: 'TUBE', WALNUT: 'GREY_D', TEAK: 'GREY_D', TAN: 'GREY_D',
    CREAM: 'GREY', WHITE: 'GREY', RUST: 'GREY_D', ORANGE: 'GREY_D', GOLD: 'GREY', TEAL_D: 'TUBE', TEAL: 'GREY_D',
    AQUA: 'GREY', OLIVE_D: 'TUBE', AVOCADO: 'GREY_D', BLUE: 'GREY_D', CRIMSON: 'GREY_D',
  });

  let fb = new Uint8Array(W * H);
  const main = fb;
  let clip = { x0: 0, y0: 0, x1: W, y1: H };

  function target(buf) { fb = buf || main; core.fb = fb; }
  function setClip(x, y, w, h) {
    clip = x === undefined ? { x0: 0, y0: 0, x1: W, y1: H }
      : { x0: Math.max(0, Math.round(x)), y0: Math.max(0, Math.round(y)), x1: Math.min(W, Math.round(x + w)), y1: Math.min(H, Math.round(y + h)) };
  }
  function fill(c) { fb.fill(c); }
  function px(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x >= clip.x0 && x < clip.x1 && y >= clip.y0 && y < clip.y1) fb[y * W + x] = c;
  }
  function rect(x, y, w, h, c) {
    const x0 = Math.max(clip.x0, Math.round(x));
    const y0 = Math.max(clip.y0, Math.round(y));
    const x1 = Math.min(clip.x1, Math.round(x + w));
    const y1 = Math.min(clip.y1, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) fb.fill(c, yy * W + x0, yy * W + Math.max(x0, x1));
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dith(x, y, level) { return BAYER[((y & 3) << 2) | (x & 3)] < level * 16; }
  function ditherRect(x, y, w, h, c, level) {
    const x0 = Math.max(clip.x0, Math.round(x));
    const y0 = Math.max(clip.y0, Math.round(y));
    const x1 = Math.min(clip.x1, Math.round(x + w));
    const y1 = Math.min(clip.y1, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (dith(xx, yy, level)) fb[yy * W + xx] = c;
  }
  // Remap pixels through a LUT inside a rect (optionally dithered).
  function remapRect(x, y, w, h, table, level) {
    const x0 = Math.max(clip.x0, Math.round(x));
    const y0 = Math.max(clip.y0, Math.round(y));
    const x1 = Math.min(clip.x1, Math.round(x + w));
    const y1 = Math.min(clip.y1, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        if (level === undefined || dith(xx, yy, level)) fb[yy * W + xx] = table[fb[yy * W + xx]];
      }
    }
  }
  function line(x0, y0, x1, y1, c, brush) {
    const b = brush || 1;
    const off = Math.floor(b / 2);
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (b === 1) px(x0, y0, c); else rect(x0 - off, y0 - off, b, b, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // Even-odd scanline polygon fill; pts = [x0,y0,x1,y1,...] in px. table = optional LUT instead of a colour.
  function poly(pts, c, table) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
    const n = pts.length / 2;
    const xs = [];
    for (let y = Math.max(clip.y0, Math.floor(minY)); y < Math.min(clip.y1, Math.ceil(maxY)); y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2]; const ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2]; const by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(clip.x0, Math.ceil(xs[k] - 0.5));
        const xb = Math.min(clip.x1 - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) fb[y * W + x] = table ? table[fb[y * W + x]] : c;
      }
    }
  }
  function ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const d = (y + 0.5 - cy) / ry;
      if (Math.abs(d) > 1) continue;
      const hw = rx * Math.sqrt(1 - d * d);
      rect(Math.round(cx - hw), y, Math.round(cx + hw) - Math.round(cx - hw), 1, c);
    }
  }
  // Rotated rectangle (centre-anchored), returns corner list for reuse.
  function quad(cx, cy, w, h, ang) {
    const co = Math.cos(ang); const si = Math.sin(ang);
    const out = [];
    [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].forEach((p) => {
      out.push(cx + p[0] * co - p[1] * si, cy + p[0] * si + p[1] * co);
    });
    return out;
  }

  // --- seeded hash (deterministic noise; replaces any randomness) ---
  function hash(a, b, c) {
    let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    x = (x + Math.imul(c | 0, -2048144777)) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    x ^= x >>> 16;
    x = Math.imul(x, 0x85ebca6b);
    x ^= x >>> 13;
    return (x >>> 0) / 4294967296;
  }
  function sid(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h | 0;
  }
  function rnd(seed, i, j) { return hash(seed, i || 0, j || 0); }
  function rint(seed, i, lo, hi) { return lo + Math.floor(hash(seed, i, 7) * (hi - lo + 1)); }

  // --- time helpers ---
  const FPS = 30;
  function frameOf(t) { return Math.round(t * FPS); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  const ease = {
    lin: (k) => k,
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: (k) => 1 - Math.pow(1 - k, 3),
    in: (k) => k * k * k,
    outBack: (k) => { const s = 1.9; const q = k - 1; return 1 + (s + 1) * q * q * q + s * q * q; },
  };
  // Screen shake that decays; integer offsets that hold for 2 frames (CRT jitter is not per-pixel smooth).
  function shake(t, t0, amp, decay, seed) {
    if (t < t0) return { x: 0, y: 0 };
    const k = Math.exp(-(t - t0) * (decay || 9));
    if (k < 0.08) return { x: 0, y: 0 };
    const f = Math.floor(frameOf(t) / 2);
    return {
      x: Math.round((hash(seed, f, 1) - 0.5) * 2 * amp * k),
      y: Math.round((hash(seed, f, 2) - 0.5) * 2 * amp * k * 0.6),
    };
  }
  // Irregular typewriter: how many chars of str are visible at t (started at t0).
  function typed(str, t, t0, seed, cps) {
    let at = t0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      at += (1 / (cps || 22)) * (0.55 + 0.9 * hash(seed, i, 3)) + (ch === ' ' ? 0.04 : 0) + (/[.:,?!]/.test(ch) ? 0.1 : 0);
      if (t < at) return i;
    }
    return str.length;
  }

  // Nearest-neighbour blit of a full-frame buffer into rect (dx, dy, dw, dh), clipped. Used by the v2 seams
  // (pull-back into a TV, manual pages sliding in). src index 255 = transparent.
  function blitScaled(src, dx, dy, dw, dh) {
    const x0 = Math.max(clip.x0, Math.round(dx));
    const y0 = Math.max(clip.y0, Math.round(dy));
    const x1 = Math.min(clip.x1, Math.round(dx + dw));
    const y1 = Math.min(clip.y1, Math.round(dy + dh));
    for (let y = y0; y < y1; y++) {
      const sy = Math.min(H - 1, Math.floor(((y + 0.5 - dy) / dh) * H));
      for (let x = x0; x < x1; x++) {
        const v = src[sy * W + Math.min(W - 1, Math.floor(((x + 0.5 - dx) / dw) * W))];
        if (v !== 255) fb[y * W + x] = v;
      }
    }
  }
  // Rotated + translated blit of a full-frame buffer (rotation about the frame centre). Pixels that map outside
  // the source are left untouched. Returns nothing; at ang = 0 and offset 0 it is an exact copy.
  function blitRotated(src, ox, oy, ang) {
    const co = Math.cos(-ang); const si = Math.sin(-ang);
    const cx = W / 2 + ox; const cy = H / 2 + oy;
    for (let y = clip.y0; y < clip.y1; y++) {
      for (let x = clip.x0; x < clip.x1; x++) {
        const rx = x + 0.5 - cx; const ry = y + 0.5 - cy;
        const sx = Math.floor(rx * co - ry * si + W / 2); const sy = Math.floor(rx * si + ry * co + H / 2);
        if (sx >= 0 && sy >= 0 && sx < W && sy < H) fb[y * W + x] = src[sy * W + sx];
      }
    }
  }

  function present(ctx, image) {
    const out = new Uint32Array(image.data.buffer);
    for (let i = 0; i < main.length; i++) out[i] = RGBA32[main[i]];
    ctx.putImageData(image, 0, 0);
  }
  function newBuffer() { return new Uint8Array(W * H); }

  const core = {
    W, H, FPS, PAL, C, RGB, SCAN, BLEED, DARK, GHOST, DRAIN, fb, main,
    target, setClip, fill, px, rect, dith, ditherRect, remapRect, line, poly, ellipse, quad,
    hash, sid, rnd, rint, frameOf, clamp01, seg, lerp, ease, shake, typed, present, newBuffer, blitScaled, blitRotated,
  };
  window.B1 = { core };
})();

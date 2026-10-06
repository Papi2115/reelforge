/* B1 TV layer: the inside of the CRT. 160x180 "2600 units" (tu), each 4x2 px (wide pixels).
   Sprites obey the console's rule: 8-ish bits wide, ONE colour per row. Playfield = 16 px blocks.
   crt() is the only post pass: NTSC colour bleed, scanlines, a slow hum bar, tube corners. */
'use strict';
(function () {
  const K = B1.core;
  const { C } = K;
  const view = { ox: 0, oy: 0 };
  function at(ox, oy) { view.ox = ox; view.oy = oy; }
  function r(x, y, w, h, c) { K.rect(view.ox + x * 4, view.oy + y * 2, w * 4, h * 2, c); }
  function dr(x, y, w, h, c, level) { K.ditherRect(view.ox + x * 4, view.oy + y * 2, w * 4, h * 2, c, level); }
  // Horizontal colour bands (the 2600 changes colour per line): stops = [[y, c], ...] top-down.
  function bands(x, y0, w, stops) {
    for (let i = 0; i < stops.length; i++) {
      const a = stops[i][0];
      const b = i + 1 < stops.length ? stops[i + 1][0] : y0;
      if (b > a) r(x, a, w, b - a, stops[i][1]);
    }
  }
  // Sprite: rows of '#'/'.', colours = per-row palette index (or one index). stretch = NUSIZ-style 1/2/4.
  function spr(rows, colours, x, y, o) {
    const opt = o || {};
    const st = opt.stretch || 1;
    const rh = opt.rowH || 1;
    const w = rows[0].length;
    for (let i = 0; i < rows.length; i++) {
      const c = Array.isArray(colours) ? colours[Math.min(i, colours.length - 1)] : colours;
      if (c < 0) continue;
      const row = rows[i];
      for (let k = 0; k < w; k++) {
        const bit = opt.flip ? row[w - 1 - k] : row[k];
        if (bit === '#') r(x + k * st, y + i * rh, st, rh, c);
      }
    }
  }
  // Sprite with squash: drawn with a vertical scale (input-lag crouch / landing).
  function sprSquash(rows, colours, x, y, sq, o) {
    const h = rows.length;
    const nh = Math.max(1, Math.round(h * sq));
    const out = [];
    const cols = [];
    for (let i = 0; i < nh; i++) {
      const src = Math.min(h - 1, Math.floor((i / nh) * h));
      out.push(rows[src]);
      cols.push(Array.isArray(colours) ? colours[Math.min(src, colours.length - 1)] : colours);
    }
    spr(out, cols, x, y + (h - nh) * ((o && o.rowH) || 1), o);
  }

  // A cartridge as the console would draw it: 6 bits wide, label stripe colour varies.
  const CART = ['.####.', '######', '#....#', '#....#', '#....#', '#....#', '######'];
  function cart(x, y, stripe, o) {
    const opt = o || {};
    const k = opt.scale || 1;
    const body = opt.body === undefined ? C.GREY_D : opt.body;
    const label = opt.label === undefined ? C.CREAM : opt.label;
    spr(CART, body, x, y, { stretch: k, rowH: k });
    // label fill as a second "player" layered on top
    r(x + k, y + 2 * k, 4 * k, k, label);
    r(x + k, y + 3 * k, 4 * k, 2 * k, stripe);
    r(x + k, y + 5 * k, 4 * k, k, label);
  }

  // --- CRT post on a screen rect (px) ---
  function crt(x0, y0, w, h, t, o) {
    const opt = o || {};
    const fb = K.fb;
    const W = K.W;
    const x1 = Math.min(K.W, x0 + w); const y1 = Math.min(K.H, y0 + h);
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    w = x1 - x0; h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const row = new Uint8Array(w);
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) row[x] = fb[y * W + x0 + x];
      if (opt.bleed !== false) {
        for (let x = 1; x < w; x++) {
          const c = row[x];
          if (!K.DARK[c]) continue;
          const b1 = K.BLEED[row[x - 1]];
          const b2 = x > 1 ? K.BLEED[row[x - 2]] : -1;
          const b = b1 >= 0 ? b1 : b2;
          if (b >= 0 && b !== c) fb[y * W + x0 + x] = b;
        }
      }
      const odd = ((y - y0) & 1) === 1;
      if (odd && opt.scan !== false) for (let x = x0; x < x1; x++) fb[y * W + x] = K.SCAN[fb[y * W + x]];
    }
    // hum bar: a soft darker band rolling down (period ~7 s), thin dither.
    if (opt.hum !== false) {
      const period = 7.3;
      const yb = y0 - 40 + ((t % period) / period) * (h + 80);
      for (let y = Math.max(y0, Math.floor(yb)); y < Math.min(y1, Math.floor(yb + 26)); y++) {
        const k = 1 - Math.abs((y - yb) / 13 - 1);
        for (let x = x0; x < x1; x++) if (K.dith(x, y, k * 0.35)) fb[y * W + x] = K.SCAN[fb[y * W + x]];
      }
    }
    // tube: rounded corners + falloff at the edges.
    const rad = opt.radius === undefined ? 22 : opt.radius;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dx = Math.max(0, Math.max(x0 + rad - x - 0.5, x - (x1 - rad) + 0.5));
        const dy = Math.max(0, Math.max(y0 + rad - y - 0.5, y - (y1 - rad) + 0.5));
        const d = Math.hypot(dx, dy) - rad;
        const edge = Math.min(x - x0, x1 - 1 - x, (y - y0) * 1.4, (y1 - 1 - y) * 1.4);
        if (d > 0) fb[y * W + x] = C.VOID;
        else if (d > -3 || edge < 3) fb[y * W + x] = K.SCAN[fb[y * W + x]];
        else if ((d > -9 || edge < 9) && K.dith(x, y, 0.5)) fb[y * W + x] = K.SCAN[fb[y * W + x]];
      }
    }
  }

  // Garbage frame: what a 2600 shows while a cartridge is rocked in the slot (seeded per frame).
  function garbage(x0, y0, w, h, f, seed) {
    const cols = [C.ORANGE, C.TEAL, C.MAUVE, C.GOLD, C.BLUE, C.AVOCADO, C.TUBE, C.CREAM, C.GREY_D];
    let y = y0;
    let i = 0;
    while (y < y0 + h) {
      const bh = 2 * (1 + Math.floor(K.hash(seed, f, i) * 9));
      const c = cols[Math.floor(K.hash(seed, f, i + 99) * cols.length)];
      K.rect(x0, y, w, Math.min(bh, y0 + h - y), c);
      // playfield-block glitches on some bands
      if (K.hash(seed, f, i + 7) > 0.55) {
        for (let b = 0; b < w / 16; b++) if (K.hash(seed, f * 13 + b, i) > 0.6) K.rect(x0 + b * 16, y, 16, Math.min(bh, y0 + h - y), C.VOID);
      }
      y += bh;
      i++;
    }
  }

  B1.tv = { view, at, r, dr, bands, spr, sprSquash, cart, CART, crt, garbage };
})();

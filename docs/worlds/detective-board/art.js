/* detective-board showcase - pixel-art "photos", paper and board props.
 * Pure builders: same arguments -> same sprite. Results are cached by key. */
(function () {
  'use strict';
  const DB = window.DB;
  const { C, T, surf, px, rect, line, disc, ring, poly, hash, shade } = DB;
  // Sprites are rotated later, and an ordered (Bayer) pattern turns into moire bands when
  // sheared, so everything painted inside a sprite uses seeded film grain instead.
  const bayer = (x, y) => hash(4242, x, y);
  function dither(s, x, y, w, h, c, level) {
    for (let yy = Math.max(0, y); yy < Math.min(s.h, y + h); yy += 1)
      for (let xx = Math.max(0, x); xx < Math.min(s.w, x + w); xx += 1) if (bayer(xx, yy) < level) s.d[yy * s.w + xx] = c;
  }
  const cache = new Map();
  const cached = (key, build) => {
    if (!cache.has(key)) cache.set(key, build());
    return cache.get(key);
  };

  function vgrad(s, x, y, w, h, top, bottom) {
    for (let yy = 0; yy < h; yy += 1)
      for (let xx = 0; xx < w; xx += 1) px(s, x + xx, y + yy, yy / h + (bayer(x + xx, y + yy) - 0.5) * 0.45 > 0.5 ? bottom : top);
  }
  /** Old-print falloff: darker, grainier corners. */
  function printVignette(s, strength, seed) {
    for (let y = 0; y < s.h; y += 1)
      for (let x = 0; x < s.w; x += 1) {
        const dx = (x / s.w - 0.5) * 2;
        const dy = (y / s.h - 0.5) * 2;
        const v = Math.max(0, Math.hypot(dx, dy) - 0.75) * strength;
        if (bayer(x, y) < v) shade(s, x, y, 1);
        if (hash(seed, x, y) < 0.004) shade(s, x, y, hash(seed, y, x) < 0.5 ? 1 : -1);
      }
  }

  // ---------- illustrations (faded photo tones only: 1,2,7,8,9,10,11) ----------
  function louvre() {
    return cached('louvre', () => {
      const s = surf(196, 112, C.GREY);
      vgrad(s, 0, 0, 196, 50, C.TEAL_L, C.PAPER);
      rect(s, 0, 50, 196, 46, C.PAPER);
      // long wing: mansard roof with dormers, two window rows, ground arcade
      poly(s, [0, 58, 0, 47, 196, 47, 196, 58], C.TEAL_D);
      line(s, 0, 47, 196, 47, C.SLATE);
      rect(s, 0, 58, 196, 38, C.GREY);
      line(s, 0, 58, 196, 58, C.PAPER);
      line(s, 0, 74, 196, 74, C.PAPER_D);
      for (let x = 3; x < 196; x += 9) {
        if (x > 104 && x < 156) continue;
        rect(s, x + 1, 50, 3, 5, C.PAPER_D);
        px(s, x + 2, 49, C.TEAL_D);
        rect(s, x + 1, 62, 3, 8, C.SLATE);
        rect(s, x + 1, 78, 3, 7, C.SLATE);
        rect(s, x, 88, 5, 8, C.SLATE);
        px(s, x, 88, C.GREY);
        px(s, x + 4, 88, C.GREY);
      }
      // central pavilion (off-centre on purpose) with its tall square dome and lantern
      rect(s, 108, 34, 44, 62, C.PAPER_D);
      for (let x = 111; x < 150; x += 7) {
        line(s, x, 36, x, 95, C.PAPER);
        rect(s, x + 2, 40, 3, 9, C.SLATE);
        rect(s, x + 2, 60, 3, 10, C.SLATE);
      }
      poly(s, [126, 82, 134, 82, 134, 96, 126, 96], C.SLATE);
      disc(s, 130, 82, 4, 4, C.SLATE);
      line(s, 106, 34, 153, 34, C.SLATE);
      poly(s, [110, 33, 150, 33, 144, 14, 116, 14], C.TEAL_D);
      for (let x = 119; x < 143; x += 5) line(s, x, 15, x + (x < 130 ? -3 : 3), 32, C.SLATE);
      rect(s, 124, 8, 12, 6, C.TEAL_D);
      rect(s, 128, 3, 4, 5, C.SLATE);
      // plaza and one period street lamp for scale
      vgrad(s, 0, 96, 196, 16, C.PAPER_D, C.GREY);
      line(s, 0, 96, 196, 96, C.SLATE);
      line(s, 33, 66, 33, 104, C.SLATE);
      rect(s, 31, 61, 5, 6, C.SLATE);
      px(s, 33, 63, C.PAPER);
      line(s, 30, 104, 36, 104, C.SLATE);
      printVignette(s, 1.0, 11);
      return s;
    });
  }

  /** The Salon Carre wall: pale patch + four iron hooks (framed = false), or the frame back. */
  function wall(framed) {
    return cached('wall' + framed, () => {
      const s = surf(140, 168, C.GREY);
      for (let y = 0; y < 168; y += 1)
        for (let x = 0; x < 140; x += 1) {
          const weave = (x % 4 === 0 ? 0.22 : 0) + Math.max(0, (y - 120) / 48) * 0.4;
          if (bayer(x, y) < weave) px(s, x, y, C.TEAL_D);
        }
      // neighbouring frames, cropped by the print edge: only their gilt edges show
      const sideFrame = (x0, w) => {
        rect(s, x0, 14, w, 128, C.PAPER_D);
        line(s, x0, 14, x0 + w - 1, 14, C.PAPER);
        for (let y = 18; y < 140; y += 4) px(s, x0 + (x0 < 0 ? w - 3 : 2), y, C.GREY);
        line(s, x0 + (x0 < 0 ? w - 1 : 0), 14, x0 + (x0 < 0 ? w - 1 : 0), 141, C.SLATE);
        rect(s, x0 + (x0 < 0 ? 0 : 6), 20, w - 6, 116, C.SLATE);
        dither(s, x0 + (x0 < 0 ? 0 : 6), 20, w - 6, 116, C.TEAL_D, 0.3);
      };
      sideFrame(-8, 20);
      sideFrame(128, 20);
      // dado rail and wainscot
      line(s, 0, 150, 139, 150, C.PAPER_D);
      line(s, 0, 151, 139, 151, C.SLATE);
      rect(s, 0, 152, 140, 16, C.TEAL_D);
      dither(s, 0, 152, 140, 16, C.SLATE, 0.4);
      // the pale rectangle: wall fabric that the sun never reached
      rect(s, 44, 38, 54, 78, C.TEAL_L);
      for (let i = 0; i < 40; i += 1) px(s, 45 + hash(77, i, 1) * 52, 39 + hash(77, i, 2) * 76, hash(77, i, 3) < 0.5 ? C.PAPER_D : C.GREY);
      line(s, 44, 116, 97, 116, C.GREY);
      line(s, 98, 39, 98, 116, C.GREY);
      if (framed) {
        rect(s, 38, 32, 66, 90, C.PAPER_D);
        line(s, 38, 32, 103, 32, C.PAPER);
        line(s, 38, 32, 38, 121, C.PAPER);
        line(s, 103, 33, 103, 121, C.SLATE);
        line(s, 39, 121, 103, 121, C.SLATE);
        for (let i = 35; i < 119; i += 3) {
          px(s, 40, i, C.GREY);
          px(s, 101, i, C.GREY);
        }
        rect(s, 44, 38, 54, 78, C.SLATE);
        dither(s, 44, 38, 54, 78, C.TEAL_D, 0.35);
        line(s, 44, 38, 97, 38, C.BLACK);
        // glass: a lamp reflection in the top corner; nothing of the painting itself is drawn
        line(s, 46, 58, 62, 40, C.GREY);
        line(s, 46, 62, 66, 40, C.TEAL_L);
        line(s, 47, 64, 69, 40, C.GREY);
        line(s, 52, 66, 72, 44, C.TEAL_D);
        line(s, 38, 123, 103, 123, C.TEAL_D);
      } else {
        // iron hooks: a stem, a curl, a lit edge and a short cast shadow
        const hook = (x, y) => {
          px(s, x, y - 2, C.BLACK);
          px(s, x, y - 1, C.BLACK);
          px(s, x, y, C.BLACK);
          px(s, x + 1, y + 1, C.BLACK);
          px(s, x + 2, y, C.BLACK);
          px(s, x - 1, y - 2, C.PAPER);
          px(s, x + 1, y - 1, C.TEAL_D);
          px(s, x + 1, y + 2, C.TEAL_D);
          px(s, x + 2, y + 1, C.TEAL_D);
        };
        hook(49, 44);
        hook(91, 45);
        hook(48, 107);
        hook(92, 106);
      }
      printVignette(s, 1.4, framed ? 23 : 21);
      return s;
    });
  }

  /** Head-and-shoulders portrait print. who: picasso | apollinaire | peruggia. */
  function portrait(who) {
    return cached('portrait-' + who, () => {
      const s = surf(92, 108, C.TEAL_L);
      const mug = who === 'peruggia';
      const apo = who === 'apollinaire';
      if (mug) {
        // police photo: flat backdrop, a measuring scale down the left edge
        rect(s, 0, 0, 92, 108, C.PAPER_D);
        dither(s, 0, 0, 92, 108, C.GREY, 0.12);
        line(s, 8, 4, 8, 104, C.GREY);
        for (let y = 6; y < 104; y += 4) line(s, 3, y, y % 20 === 6 ? 8 : 6, y, C.SLATE);
      } else {
        // plain studio backdrop, darker toward the floor
        vgrad(s, 0, 0, 92, 108, C.TEAL_L, C.GREY);
      }
      const cx = apo ? 47 : mug ? 46 : 44;
      const cy = 50;
      const rx = apo ? 16 : 13;
      const ry = apo ? 18 : 17;
      // body: dark coat, lit left shoulder, lapels, white collar, tie
      poly(s, [2, 108, 10, 86, cx - 12, 76, cx + 13, 76, 84, 88, 92, 108], C.SLATE);
      line(s, 10, 86, cx - 12, 77, C.GREY);
      dither(s, 50, 84, 42, 24, C.BLACK, 0.3);
      poly(s, [cx - 11, 77, cx - 2, 104, cx - 6, 104, cx - 14, 84], C.BLACK);
      poly(s, [cx + 12, 77, cx + 3, 104, cx + 7, 104, cx + 15, 84], C.BLACK);
      poly(s, [cx - 8, 76, cx, 90, cx + 9, 76], C.PAPER);
      if (apo) poly(s, [cx - 4, 82, cx + 5, 82, cx + 3, 86, cx - 3, 86], C.BLACK);
      else poly(s, [cx - 1, 82, cx + 2, 82, cx + 3, 100, cx - 2, 100], C.BLACK);
      // neck with the chin's shadow
      rect(s, cx - 6, cy + 12, 13, 14, C.GREY);
      dither(s, cx - 6, cy + 12, 13, 5, C.SLATE, 0.5);
      // ears, then the head, lit from the left
      disc(s, cx - rx, cy + 1, 1.5, 3, C.PAPER_D);
      disc(s, cx + rx, cy + 1, 1.5, 3, C.GREY);
      disc(s, cx, cy, rx, ry, C.PAPER_D);
      for (let y = -ry; y <= ry; y += 1)
        for (let x = 1; x <= rx; x += 1) {
          const i = (cy + y) * s.w + cx + x;
          if (s.d[i] === C.PAPER_D && bayer(cx + x, cy + y) < (x - 1) / rx + Math.max(0, y - ry * 0.5) / ry) s.d[i] = C.GREY;
        }
      if (apo) {
        // heavy jaw and a second chin
        for (let x = -9; x <= 9; x += 1) px(s, cx + x, cy + ry - 2 + Math.round((x * x) / 40), C.GREY);
      }
      // eyes in shadowed sockets, brows, nose shadow on the far side, mouth
      const eyeY = cy - 1;
      const eye = (x, big) => {
        rect(s, x - 1, eyeY - 1, 5, 3, C.GREY);
        rect(s, x, eyeY, big ? 3 : 2, big ? 2 : 1, C.BLACK);
        if (big) px(s, x, eyeY, C.PAPER);
      };
      eye(cx - 7, who === 'picasso');
      eye(cx + 4, who === 'picasso');
      line(s, cx - 8, eyeY - 3, cx - 4, eyeY - 4, C.SLATE);
      line(s, cx + 4, eyeY - 4, cx + 8, eyeY - 3, C.SLATE);
      line(s, cx + 1, eyeY + 1, cx + 2, eyeY + 7, C.GREY);
      line(s, cx - 1, eyeY + 8, cx + 2, eyeY + 8, C.GREY);
      if (mug) {
        // the moustache every account of him mentions
        poly(s, [cx - 8, eyeY + 12, cx - 3, eyeY + 9, cx + 4, eyeY + 9, cx + 9, eyeY + 12, cx + 7, eyeY + 13, cx, eyeY + 11, cx - 6, eyeY + 13], C.BLACK);
        line(s, cx - 2, eyeY + 15, cx + 3, eyeY + 15, C.GREY);
      } else if (apo) {
        line(s, cx - 2, eyeY + 12, cx + 3, eyeY + 12, C.SLATE);
      } else {
        line(s, cx - 3, eyeY + 12, cx + 2, eyeY + 12, C.SLATE);
        px(s, cx + 3, eyeY + 11, C.SLATE);
      }
      // hair
      if (who === 'picasso') {
        // dark hair with the forelock falling across the forehead
        poly(s, [cx - 13, cy - 4, cx - 13, cy - 13, cx - 5, cy - 18, cx + 8, cy - 17, cx + 13, cy - 9, cx + 13, cy - 4, cx + 9, cy - 10, cx + 1, cy - 11, cx - 9, cy - 7], C.BLACK);
        poly(s, [cx - 1, cy - 12, cx + 4, cy - 11, cx - 6, cy - 3, cx - 8, cy - 4], C.BLACK);
        px(s, cx - 4, cy - 15, C.SLATE);
      } else if (apo) {
        // short hair high on a big round head
        poly(s, [cx - 16, cy - 5, cx - 14, cy - 13, cx - 6, cy - 17, cx + 7, cy - 17, cx + 14, cy - 12, cx + 16, cy - 5, cx + 12, cy - 10, cx, cy - 13, cx - 12, cy - 10], C.SLATE);
        line(s, cx - 6, cy - 16, cx + 6, cy - 16, C.BLACK);
      } else {
        // slicked and parted
        poly(s, [cx - 13, cy - 5, cx - 12, cy - 14, cx - 3, cy - 18, cx + 9, cy - 16, cx + 13, cy - 6, cx + 10, cy - 11, cx - 4, cy - 13, cx - 10, cy - 9], C.BLACK);
        line(s, cx - 4, cy - 13, cx - 2, cy - 18, C.GREY);
      }
      printVignette(s, mug ? 0.9 : 1.8, who.length * 7);
      return s;
    });
  }

  function crop(key, src, x, y, w, h) {
    return cached('crop-' + key, () => {
      const s = surf(w, h, T);
      for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) s.d[yy * w + xx] = src.d[(y + yy) * src.w + x + xx];
      return s;
    });
  }

  // ---------- paper objects ----------
  /** A print with a paper border; curl = 'br' | 'bl' | 'tr' | null, size of the lifted corner. */
  function photo(key, img, opts) {
    const o = opts || {};
    return cached('photo-' + key, () => {
      const l = o.left || 6;
      const t = o.top || 6;
      const r = o.right || 7;
      const b = o.bottom || 8;
      const s = surf(img.w + l + r, img.h + t + b, C.PAPER);
      DB.blit(s, img, l, t);
      line(s, l, t + img.h, l + img.w - 1, t + img.h, C.PAPER_D);
      for (let i = 0; i < s.w * s.h * 0.004; i += 1) {
        const x = Math.floor(hash(o.seed || 3, i, 1) * s.w);
        const y = Math.floor(hash(o.seed || 3, i, 2) * s.h);
        if (s.d[y * s.w + x] === C.PAPER) s.d[y * s.w + x] = C.PAPER_D;
      }
      if (o.curl) curl(s, o.curl, o.curlSize || 10);
      return s;
    });
  }
  /** Lifted corner: the cut shows the board, the flap shows the back of the print. */
  function curl(s, corner, n) {
    const fx = corner === 'br' || corner === 'tr';
    const fy = corner === 'br' || corner === 'bl';
    const L = Math.max(3, Math.round(n * 0.7));
    for (let j = 0; j <= n + 1; j += 1)
      for (let i = 0; i <= n + 1; i += 1) {
        const x = fx ? s.w - 1 - i : i;
        const y = fy ? s.h - 1 - j : j;
        const k = i + j;
        if (k < n) s.d[y * s.w + x] = T;
        else if (i <= n && j <= n && k < n + L) s.d[y * s.w + x] = k === n ? C.WHITE : k === n + L - 1 ? C.GREY : C.PAPER_D;
        else if (i <= n + 1 && j <= n + 1 && k === n + L) shade(s, x, y, 1);
      }
  }
  /** Index card with faint ruling. */
  function card(w, h, seed, ruled) {
    const s = surf(w, h, C.PAPER);
    if (ruled !== false) {
      line(s, 0, 9, w - 1, 9, C.TEAL_L);
      for (let y = 21; y < h - 3; y += 12) for (let x = 0; x < w; x += 1) if (hash(seed, x, y) > 0.08) px(s, x, y, C.TEAL_L);
    }
    for (let i = 0; i < 4; i += 1) px(s, Math.floor(hash(seed, i, 5) * w), Math.floor(hash(seed, i, 6) * h), C.PAPER_D);
    return s;
  }
  /** Masking tape strip with torn ends. */
  function tape(w, h, seed) {
    return cached('tape' + w + 'x' + h + '-' + seed, () => {
      const s = surf(w, h, C.PAPER);
      dither(s, 0, 0, w, h, C.PAPER_D, 0.22);
      line(s, 0, h - 1, w - 1, h - 1, C.PAPER_D);
      for (let y = 0; y < h; y += 1) {
        const cutL = Math.floor(hash(seed, y, 1) * 3);
        const cutR = Math.floor(hash(seed, y, 2) * 3);
        for (let x = 0; x < cutL; x += 1) s.d[y * w + x] = T;
        for (let x = 0; x < cutR; x += 1) s.d[y * w + w - 1 - x] = T;
      }
      return s;
    });
  }

  // ---------- board and desk ----------
  function cork(w, h, seed) {
    return cached('cork' + w + 'x' + h + '-' + seed, () => {
      const s = surf(w, h, C.CORK);
      for (let y = 0; y < h; y += 1)
        for (let x = 0; x < w; x += 1) {
          // granules ~2 px wide, denser in slow blotches; low contrast so it reads as texture
          const g = hash(seed, (x + (y & 1)) >> 1, y >> 1);
          const n = hash(seed + 5, x, y);
          const blot = hash(seed + 1, x >> 4, y >> 4) * 0.6 + hash(seed + 2, (x + 9) >> 5, (y + 7) >> 5) * 0.4;
          if (g < 0.035 + blot * 0.07 && n < 0.8) s.d[y * w + x] = C.CORK_D;
          else if (g > 0.975 - blot * 0.02 && n < 0.7) s.d[y * w + x] = C.CORK_L;
        }
      // old pin holes from earlier cases: dark dot, lit lower lip
      for (let i = 0; i < (w * h) / 2600; i += 1) {
        const x = Math.floor(hash(seed, i, 41) * w);
        const y = Math.floor(hash(seed, i, 42) * h);
        px(s, x, y, C.NIGHT);
        px(s, x, y + 1, C.CORK_L);
      }
      return s;
    });
  }
  function desk(w, h, seed) {
    return cached('desk' + w + 'x' + h + '-' + seed, () => {
      const s = surf(w, h, C.CORK_D);
      for (let y = 0; y < h; y += 1) {
        const wave = Math.sin(y * 0.09 + hash(seed, y >> 5, 0) * 6) * 3;
        for (let x = 0; x < w; x += 1) {
          const g = Math.sin((y + wave + Math.sin(x * 0.013 + y * 0.002) * 6) * 0.55);
          if (g > 0.9 && hash(seed, x >> 2, y) < 0.75) s.d[y * w + x] = C.NIGHT;
          else if (g < -0.95 && hash(seed, x, y) < 0.35) s.d[y * w + x] = C.CORK;
        }
      }
      return s;
    });
  }

  // ---------- pins, string, marks (drawn straight into the frame) ----------
  /** Push-pin head at (x, y); kind red | brass | pearl. (sx, sy) shadow direction; lift = height. */
  function pin(s, x, y, kind, sx, sy, lift, squash) {
    const h = lift === undefined ? 1 : lift;
    const r = 3 + Math.max(0, h - 1) * 0.9;
    const ox = Math.round(sx * h * 1.6);
    const oy = Math.round(sy * h * 1.6);
    // needle shadow + head shadow (softer and farther the higher it is)
    if (h <= 1.05) for (let k = 1; k <= 4; k += 1) shade(s, Math.round(x + sx * k * 1.4), Math.round(y + sy * k * 1.4), 1);
    for (let yy = -4; yy <= 4; yy += 1)
      for (let xx = -4; xx <= 4; xx += 1) {
        if (xx * xx + yy * yy > (h > 1.4 ? 14 : 10)) continue;
        if (h > 1.4 && ((x + xx + y + yy) & 1)) continue;
        shade(s, x + ox + xx, y + oy + yy, 1);
      }
    const col = kind === 'red' ? [C.RED, C.RED_D] : kind === 'brass' ? [C.BRASS, C.CORK_D] : [C.PAPER, C.GREY];
    const ry = squash ? r * 0.7 : r;
    const rx = squash ? r * 1.25 : r;
    disc(s, x, y, rx, ry, col[1]);
    disc(s, x - 0.5, y - 0.6, rx - 0.9, ry - 0.9, col[0]);
    px(s, x - Math.round(rx * 0.45), y - Math.round(ry * 0.45), C.WHITE);
    if (r > 4) px(s, x - Math.round(rx * 0.45) + 1, y - Math.round(ry * 0.45), C.WHITE);
  }
  /**
   * Red string from (x0,y0) to (x1,y1), hanging by `sag` px at mid-span (parabola), drawn up to
   * `reach` (0..1 of the way). Twists of the yarn every few px; shadow offset (sx, sy).
   */
  function string(s, x0, y0, x1, y1, sag, reach, sx, sy, seed) {
    const len = Math.hypot(x1 - x0, y1 - y0) + Math.abs(sag);
    const n = Math.max(2, Math.ceil(len * 1.4));
    const upto = Math.round(n * (reach === undefined ? 1 : reach));
    const pts = [];
    for (let i = 0; i <= upto; i += 1) {
      const u = i / n;
      pts.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + sag * 4 * u * (1 - u)]);
    }
    // shadow once per pixel (samples overlap), then the yarn with a dark fleck where it twists;
    // flecks are indexed along the string so they ride with it when the camera moves
    let last = -1;
    for (const [x, y] of pts) {
      const X = Math.round(x + sx);
      const Y = Math.round(y + sy);
      if (Y * s.w + X === last) continue;
      last = Y * s.w + X;
      shade(s, X, Y, 1);
    }
    // two pixels thick: lit top in red, underside in dark red, so it reads as yarn, not a line
    pts.forEach(([x, y]) => px(s, x, y + 1, C.RED_D));
    pts.forEach(([x, y], i) => px(s, x, y, hash(seed, i >> 1, 3) < 0.06 ? C.RED_D : C.RED));
    return pts.length ? pts[pts.length - 1] : [x0, y0];
  }

  Object.assign(DB, {
    art: { louvre, wall, portrait, photo, crop, card, tape, cork, desk },
    pin,
    string,
  });
})();

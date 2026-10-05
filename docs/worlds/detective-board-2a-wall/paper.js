/* detective-board 2a - paper goods: cards, prints, sticky notes, ruled index cards, hand marks.
 * Every builder is pure (seeded); results are memoised by key. */
(function () {
  'use strict';
  const D2 = window.D2;
  const { C, T, hash, surf, px, rect, line, disc, poly, stroke } = D2;

  const memoStore = new Map();
  /** Memoise a pure sprite builder by key (bounded: oldest entries dropped). */
  function memo(key, build) {
    if (memoStore.has(key)) return memoStore.get(key);
    const value = build();
    memoStore.set(key, value);
    if (memoStore.size > 400) memoStore.delete(memoStore.keys().next().value);
    return value;
  }

  /**
   * Plain sheet: fill, paper thickness on the lower/right edge, a few nicks, sparse fibres and age spots.
   * o: { fill, shade, curl: 'br'|'bl'|'tr'|'tl', curlSize, dogEar: corner, lines: true (index card), torn: 'top'|'bottom' }
   */
  function sheet(w, h, seed, o) {
    const opt = o || {};
    const fill = opt.fill === undefined ? C.PAPER : opt.fill;
    const shadeC = opt.shade === undefined ? C.PAPER_D : opt.shade;
    const s = surf(w, h, fill);
    // index-card rules (blue), first rule a little heavier
    if (opt.lines) {
      for (let y = 13; y < h - 3; y += 7) {
        for (let x = 1; x < w - 1; x += 1) if (hash(seed, x, y) > 0.05) px(s, x, y, y === 13 ? C.BLUE : C.PAPER_D);
      }
    }
    // fibres and foxing: sparse, clustered toward the edges (age), never a full-surface grain
    for (let i = 0; i < (w * h) / 90; i += 1) {
      const x = Math.floor(hash(seed, i, 1) * w);
      const y = Math.floor(hash(seed, i, 2) * h);
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (edge < 6 || hash(seed, i, 3) < 0.25) px(s, x, y, shadeC);
    }
    // thickness: lower and right edge one shade darker
    rect(s, 0, h - 1, w, 1, shadeC);
    rect(s, w - 1, 0, 1, h, shadeC);
    // nicks along the edges
    for (let i = 0; i < (w + h) / 18; i += 1) {
      const k = hash(seed, i, 9);
      const along = Math.floor(hash(seed, i, 10) * (k < 0.5 ? w : h));
      if (k < 0.25) px(s, along, 0, T);
      else if (k < 0.5) px(s, along, h - 1, T);
      else if (k < 0.75) px(s, 0, along, T);
      else px(s, w - 1, along, T);
    }
    if (opt.torn) tornEdge(s, opt.torn, seed);
    if (opt.dogEar) dogEar(s, opt.dogEar, 7 + Math.floor(hash(seed, 5, 5) * 4), shadeC);
    if (opt.curl) curl(s, opt.curl, opt.curlSize || 9, shadeC);
    return s;
  }
  function cornerXY(s, corner) {
    return [corner[1] === 'r' ? s.w - 1 : 0, corner[0] === 'b' ? s.h - 1 : 0, corner[1] === 'r' ? -1 : 1, corner[0] === 'b' ? -1 : 1];
  }
  /** Folded-over corner: the flap shows the paper's back. */
  function dogEar(s, corner, n, shadeC) {
    const [cx, cy, dx, dy] = cornerXY(s, corner);
    for (let a = 0; a < n; a += 1)
      for (let b = 0; b < n - a; b += 1) px(s, cx + dx * a, cy + dy * b, T);
    for (let a = 0; a < n; a += 1)
      for (let b = 0; b < n - a; b += 1) px(s, cx + dx * (n - b), cy + dy * (n - a), a + b === n - 1 ? C.PAPER_DD : shadeC);
  }
  /** Lifted corner: a rolled lip with a highlight, the rest of the corner gone (shows the wall). */
  function curl(s, corner, n, shadeC) {
    const [cx, cy, dx, dy] = cornerXY(s, corner);
    for (let a = 0; a < n; a += 1)
      for (let b = 0; b < n - a; b += 1) px(s, cx + dx * a, cy + dy * b, T);
    for (let a = 0; a <= n; a += 1) {
      const b = n - a;
      px(s, cx + dx * a, cy + dy * b, C.WHITE);
      px(s, cx + dx * a, cy + dy * (b + 1), shadeC);
      if (a > 1 && a < n - 1) px(s, cx + dx * (a + 1), cy + dy * (b + 1), shadeC);
    }
  }
  function tornEdge(s, side, seed) {
    for (let x = 0; x < s.w; x += 1) {
      const depth = 1 + Math.floor(hash(seed, x >> 1, 44) * 3);
      for (let k = 0; k < depth; k += 1) px(s, x, side === 'top' ? k : s.h - 1 - k, T);
      px(s, x, side === 'top' ? depth : s.h - 1 - depth, C.PAPER_D);
    }
  }

  /** Print: white border around an image surface (drawn by `paint(img)`), optional wear. */
  function print(w, h, border, seed, paint, o) {
    const opt = o || {};
    const s = sheet(w, h, seed, Object.assign({ fill: C.PAPER }, opt));
    const bottom = opt.bottom === undefined ? border : opt.bottom;
    const img = surf(w - border * 2, h - border - bottom, C.INK);
    paint(img);
    // faded print: a handful of light scratches
    for (let i = 0; i < 4; i += 1) {
      const x = Math.floor(hash(seed, i, 61) * img.w);
      const y0 = Math.floor(hash(seed, i, 62) * img.h);
      const len = 3 + Math.floor(hash(seed, i, 63) * 8);
      for (let k = 0; k < len; k += 1) if (hash(seed, i, k) > 0.3) px(img, x + (k >> 2), y0 + k, C.PAPER_DD);
    }
    D2.blit(s, img, border, border);
    // keep curl/dog-ear on top of the image
    if (opt.curl) curl(s, opt.curl, opt.curlSize || 9, C.PAPER_D);
    if (opt.dogEar) dogEar(s, opt.dogEar, 8, C.PAPER_D);
    return s;
  }

  /** Coffee ring with a gap where the mug lip lifted. */
  function coffeeRing(s, cx, cy, r, seed) {
    const n = Math.ceil(r * 8);
    const gapAt = hash(seed, 1, 1) * Math.PI * 2;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const da = Math.abs(((a - gapAt + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da < 0.5) continue;
      const rr = r + (hash(seed, i >> 2, 2) < 0.3 ? 1 : 0);
      px(s, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, C.CORK_L);
      if (hash(seed, i, 3) < 0.45) px(s, cx + Math.cos(a) * (rr - 1), cy + Math.sin(a) * (rr - 1), C.PAPER_DD);
    }
  }
  /** Thumbprint: a few concentric broken arcs in a faint tone. */
  function thumbprint(s, cx, cy, seed, color) {
    for (let k = 1; k < 5; k += 1) {
      const n = 10 + k * 7;
      for (let i = 0; i < n; i += 1) {
        if (hash(seed, k, i) < 0.35) continue;
        const a = (i / n) * Math.PI * 2;
        px(s, cx + Math.cos(a) * k * 1.4, cy + Math.sin(a) * k * 1.9, color);
      }
    }
  }
  /** Tick in two strokes (short down-stroke, long up-stroke), progress 0..1. */
  function tick(s, x, y, size, progress, color, seed) {
    const a = D2.clamp(progress / 0.35, 0, 1);
    const b = D2.clamp((progress - 0.42) / 0.58, 0, 1);
    stroke(s, [x, y, x + size * 0.35, y + size * 0.45], a, color, seed, 0);
    stroke(s, [x + size * 0.35, y + size * 0.45, x + size * 0.7, y - size * 0.1, x + size, y - size * 0.55], b, color, seed, 0);
    if (a > 0) stroke(s, [x + 1, y, x + size * 0.35 + 1, y + size * 0.45], a, color, seed, 0);
  }
  /** Strike-through: one wavy pen line through the x-height, drawn left to right. */
  function strike(s, x0, x1, y, progress, color, seed) {
    const pts = [];
    for (let x = x0; x <= x1; x += 4) pts.push(x, y + Math.round((hash(seed, x, 5) - 0.5) * 1.6));
    pts.push(x1, y);
    stroke(s, pts, progress, color, seed, 0);
  }
  /** Scribbled underline in `n` passes, each slightly offset. */
  function underline(s, x0, x1, y, progress, color, seed, n) {
    const passes = n || 2;
    for (let p = 0; p < passes; p += 1) {
      const k = D2.clamp(progress * passes - p, 0, 1);
      const dy = p * 2 + Math.round(hash(seed, p, 7) * 1);
      const a = x0 + Math.round(hash(seed, p, 8) * 3);
      const b = x1 - Math.round(hash(seed, p, 9) * 4);
      stroke(s, [a, y + dy, (a + b) / 2, y + dy + (p ? -1 : 1), b, y + dy - p], k, color, seed + p, 0);
    }
  }
  /** Sticky note (brass yellow) with a curled lower edge. */
  function sticky(w, h, seed) {
    const s = sheet(w, h, seed, { fill: C.BRASS, shade: C.CORK_L });
    rect(s, 0, 0, w, 3, C.CORK_L);
    for (let x = 0; x < w; x += 1) if (hash(seed, x, 2) < 0.5) px(s, x, 3, C.CORK_L);
    for (let x = 2; x < w - 2; x += 1) px(s, x, h - 2, x % 5 === 0 ? C.WHITE : C.BRASS);
    return s;
  }
  /** Dashed hand-drawn ellipse (pencil), dash lengths vary, reveal 0..1 around the loop. */
  function dashedOval(s, cx, cy, rx, ry, progress, color, seed) {
    const n = Math.ceil((rx + ry) * 3.2);
    const upto = Math.floor(n * progress);
    let on = true;
    let left = 4;
    for (let i = 0; i < upto; i += 1) {
      const a = -1.9 + (i / n) * Math.PI * 2.08;
      const wob = 1 + 0.05 * Math.sin(a * 3 + seed);
      if (on) {
        px(s, cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob, color);
        px(s, cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob + 1, color);
      }
      left -= 1;
      if (left <= 0) {
        on = !on;
        left = on ? 5 + Math.floor(hash(seed, i, 3) * 6) : 3 + Math.floor(hash(seed, i, 4) * 3);
      }
    }
  }

  Object.assign(D2, { memo, sheet, print, coffeeRing, thumbprint, tick, strike, underline, sticky, dashedOval, curl, dogEar });
  // small shared shapes used by several props
  D2.shapes = {
    /** Twenty-dollar bill seen flat: green note, darker border, centre oval; worn = paper showing. */
    bill(s, x, y, w, h, worn) {
      rect(s, x, y, w, h, C.GREEN);
      rect(s, x, y, w, 1, C.GREEN_D);
      rect(s, x, y + h - 1, w, 1, C.GREEN_D);
      rect(s, x, y, 1, h, C.GREEN_D);
      rect(s, x + w - 1, y, 1, h, C.GREEN_D);
      if (h > 6) disc(s, x + w / 2, y + h / 2, Math.max(1, h / 4), Math.max(1, h / 3.2), C.GREEN_D);
      if (worn) for (let i = 0; i < w; i += 3) px(s, x + i, y + (i % 2) + 1, C.PAPER_D);
    },
  };
})();

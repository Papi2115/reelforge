/* Shot 8 - INTERMISSION TALLY SCREEN: Doom's end-of-level screen as the recap of the E.T. chapter.
   FOCAL POINT: the UNSOLD stamp (the only accent on screen) thumping onto the plate's lower-right corner (~x368 y248),
   half on the plate, half on the painting - it breaks the plate's edge. Before it lands, the eye follows whichever
   counter is moving (MADE, then SOLD, then TIME/PAR); the painted dock is texture, the plate is support.
   HUMAN TRACES (u = local seconds):
   1. counters tick on a seeded, uneven cadence: MADE stalls mid-count, SOLD brakes before it stops, rows hold for
      different lengths before the next one starts (0.85-5.2)
   2. hand-set row labels with +-1 px baseline jitter, the SOLD row one pixel off the grid (0.75+)
   3. pencil underline in two strokes under the SOLD number (3.0+)
   4. a coffee ring on the plate, mostly off its lower-left corner (always, under the melt from 0.0)
   5. misregistered stamp: rotated -8 deg, a ghost second impression, ink thinning toward one end, a smudge drag (6.3+)
   6. thump: shadow anticipation, overshoot-and-settle, screen shake with decay (6.14-6.75), after a 0.7 s still beat of
      silence (5.5-6.2); the landing is held 0.74 s before the fade
   7. the painting: rust under the girts, oil stains, a tipped retail box, a crooked hand-lettered RETURNS card
   FACTS on screen: CHRISTMAS 1982, ~5 WEEKS (certain); 4,000,000 MADE, 1,500,000 SOLD and PAR ~6 MONTHS are commonly
   cited figures, shown only with EST. beside them ([verify] in the report). No logos, quotes or faces.
   Contract: RF.TALLY = { dur, lines, render(screen, u, unders) } - frame = f(u); unders.enter/exit are 640x360 indexed. */
'use strict';
(function () {
  const RF = window.RF, C = RF.C, E = RF.ease, seg = RF.seg;
  const W = 640, H = 360, DUR = 8.0;
  const MELT_END = 0.6, IMPACT = 6.3, OUT0 = 7.2;
  const PLATE = { x: 34, y: 26, w: 306, h: 272 };
  const VX = 254, EST_X = 264; // value column (right-aligned) and the EST. column
  const STAMP_C = [368, 248];

  // ---------------- count-up schedules (seeded, never uniform) ----------------
  /** Tick times in [t0,t1]: jittered gaps, an optional stall, an optional brake on the last ticks. */
  function ticks(seed, t0, t1, n, stallAt, brake) {
    const r = RF.rng(seed), gaps = [];
    for (let k = 0; k < n; k++) {
      let g = 0.55 + r() * 0.95;
      if (k === stallAt) g += 3.4;
      if (brake && k > n - 4) g *= 1 + (k - (n - 4)) * 0.85;
      gaps.push(g);
    }
    const sum = gaps.reduce((a, b) => a + b, 0);
    let t = t0;
    return gaps.map((g) => (t += (g / sum) * (t1 - t0)));
  }
  /** Big counter values: decelerating, never round until the last tick lands on the target. */
  function bigValues(seed, n, target) {
    const out = [];
    let prev = 0;
    for (let k = 0; k < n; k++) {
      const p = 1 - Math.pow(1 - (k + 1) / n, 1.7);
      const v = k === n - 1 ? target : Math.min(target - 1, Math.max(prev + 1, Math.round(target * p * (0.965 + RF.hash3(seed, k, 3) * 0.03))));
      out.push(v);
      prev = v;
    }
    return out;
  }
  const commas = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const unit = (v, one, many, done) => (done ? '~' : '') + v + ' ' + (v === 1 ? one : many);
  const ROWS = [
    { label: 'MADE', y: 108, at: 0.75, times: ticks(811, 0.85, 1.75, 17, 9, false), est: true, jit: 71 },
    { label: 'SOLD', y: 136, at: 2.05, times: ticks(823, 2.12, 2.8, 12, -1, true), est: true, jit: 72 },
    { label: 'TIME', y: 172, at: 3.62, times: ticks(837, 3.72, 4.42, 5, 2, false), est: false, jit: 73 },
    { label: 'PAR', y: 198, at: 4.7, times: ticks(851, 4.76, 5.12, 6, -1, false), est: true, jit: 74 },
  ];
  ROWS[0].vals = bigValues(5, ROWS[0].times.length, 4000000);
  ROWS[1].vals = bigValues(6, ROWS[1].times.length, 1500000);
  ROWS[2].vals = [1, 2, 3, 4, 5];
  ROWS[3].vals = [1, 2, 3, 4, 5, 6];
  ROWS[0].fmt = ROWS[1].fmt = (v) => commas(v);
  ROWS[2].fmt = (v, done) => unit(v, 'WEEK', 'WEEKS', done);
  ROWS[3].fmt = (v, done) => unit(v, 'MONTH', 'MONTHS', done);

  // ---------------- built once, lazily (pure; independent of script order) ----------------
  let K = null;
  function build() {
    const art = RF.TALLY_ART.paint();
    const base = new RF.Bmp(W, H, C.VOID);
    base.d.set(art.d);
    const P = PLATE;
    RF.HUD.plate(base, P.x, P.y, P.w, P.h);
    // the panel: the painting seen through smoked glass (Doom's darkened map painting)
    const ghost = RF.makeDimMap(0.3, [0.9, 0.95, 1.1]);
    const px0 = P.x + 7, py0 = P.y + 7, px1 = P.x + P.w - 7, py1 = P.y + P.h - 7;
    for (let y = py0; y < py1; y++)
      for (let x = px0; x < px1; x++) base.d[y * W + x] = RF.bayer(x, y) < 0.62 ? C.SHADOW : ghost[art.d[y * W + x]];
    base.rect(px0, py0, px1 - px0, 1, C.VOID);
    base.rect(px0, py0, 1, py1 - py0, C.VOID);
    RF.drawText(base, 'CHRISTMAS 1982', 54, 44, C.TUNGSTEN, 3, { shadow: C.VOID });
    RF.drawText(base, 'FINISHED', 56, 71, C.SAND, 2, { jitter: 70 });
    RF.handStroke(base, [54, 93, 170, 94, 318, 92], C.SLATE, 79, 2, 1);
    coffeeRing(base, px0, py0, px1, py1);
    const stamp = buildStamp();
    // the stamp's footprint (rubber block) for its approaching shadow
    const block = new RF.Bmp(stamp.raw.w, stamp.raw.h, C.VOID);
    K = {
      base: base, stamp: stamp.ink, shadow: RF.rotate(block, -8),
      work: new RF.Bmp(W, H, C.VOID),
      dimShadow: RF.makeDimMap(0.55, [1, 1, 1]),
      melt: meltDelays(),
    };
  }
  function coffeeRing(b, x0, y0, x1, y1) {
    const cx = x0 + 9, cy = y1 - 6, R = 19;
    for (let a = 0; a < 360; a += 0.8) {
      const r = R + Math.sin(a * 0.05) * 0.9;
      const x = cx + Math.cos((a * Math.PI) / 180) * r, y = cy + Math.sin((a * Math.PI) / 180) * r * 0.94;
      if (x < x0 || y < y0 || x >= x1 || y >= y1 || RF.hash3(Math.floor(a), 3, 5) > 0.82) continue;
      b.px(x, y, C.BROWN);
      if (a > 280 || a < 20) b.px(x + 1, y, C.UMBER); // the heavier side where the cup sat longest
    }
  }
  function buildStamp() {
    const word = 'UNSOLD', S = 4;
    const w = RF.textWidth(word, S) + 24, h = 7 * S + 18;
    const ink = new RF.Bmp(w, h);
    ink.frame(0, 0, w, h, C.ACCENT); ink.frame(1, 1, w - 2, h - 2, C.ACCENT); ink.frame(4, 4, w - 8, h - 8, C.ACCENT);
    RF.drawText(ink, word, 12, 9, C.ACCENT, S);
    const raw = new RF.Bmp(w + 8, h + 6);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (ink.d[y * w + x] === RF.T) continue;
        if (RF.hash3(x, y, 41) < 0.4) raw.px(x + 5, y + 1, C.ACCENT_D); // the bounce: a second, offset impression
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (ink.d[y * w + x] === RF.T) continue;
        const thin = 0.04 + 0.34 * Math.pow(x / w, 3) + (RF.vnoise(x, y, 6, 43) > 0.72 ? 0.3 : 0); // pressure falls off
        if (RF.hash3(x, y, 42) < thin) continue;
        raw.px(x + 1, y + 3, RF.hash3(x, y, 44) < 0.08 ? C.ACCENT_D : C.ACCENT);
      }
    for (let k = 0; k < 9; k++) raw.px(1 - (k >> 2), h + 1 - k * 0.6, C.ACCENT_D); // smudge where it slid
    return { ink: RF.rotate(raw, -8), raw: raw };
  }
  /** Doom's wipe start offsets: a clamped random walk, each column at most one step from its neighbour. */
  function meltDelays() {
    const n = W / 4, d = [];
    let v = RF.hash3(1, 2, 3) * 0.26;
    for (let i = 0; i < n; i++) {
      v = RF.clamp(v + (Math.floor(RF.hash3(i, 9, 81) * 3) - 1) * 0.0165, 0, 0.26);
      d.push(v);
    }
    return d;
  }

  // ---------------- per frame ----------------
  function drawRows(b, u) {
    ROWS.forEach((row, i) => {
      if (u < row.at) return;
      const y = row.y + (i === 1 ? 1 : 0);
      RF.drawText(b, row.label, 54, y, C.SAND, 2, { jitter: row.jit });
      const k = RF.typedCount(row.times, u);
      const done = k === row.times.length;
      const v = k === 0 ? 0 : row.vals[k - 1];
      const txt = row.fmt(v, done);
      const live = u < row.times[row.times.length - 1] + 0.12; // the running counter is the brightest thing on the plate
      drawValue(b, txt, VX, y, live ? C.BULB : C.PAPER);
      if (row.est) RF.drawText(b, 'EST.', EST_X, y, C.SAND, 2);
    });
    // pencil: someone underlined how few sold (two strokes, the second one shorter)
    const sw = valueWidth('1,500,000');
    const p1 = seg(u, 3.0, 3.24), p2 = seg(u, 3.3, 3.42);
    if (p1 > 0) RF.handStroke(b, [VX - sw - 3, 154, VX - sw * 0.4, 155, VX + 3, 153], C.GREY, 91, 2.2, p1);
    if (p2 > 0) RF.handStroke(b, [VX - 4, 156, VX - sw * 0.55, 157, VX - sw + 6, 156], C.GREY, 92, 2.6, p2);
  }
  /** Scaled, centred blit of the rotated stamp; `map` (optional) turns it into a shadow on what is below. */
  function drawStamp(b, src, scale, cx, cy, shade) {
    const w = Math.round(src.w * scale), h = Math.round(src.h * scale);
    const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    for (let dy = 0; dy < h; dy++) {
      const y = y0 + dy;
      if (y < 0 || y >= H) continue;
      const sy = Math.min(src.h - 1, Math.floor(dy / scale));
      for (let dx = 0; dx < w; dx++) {
        const x = x0 + dx;
        if (x < 0 || x >= W) continue;
        const c = src.d[sy * src.w + Math.min(src.w - 1, Math.floor(dx / scale))];
        if (c === RF.T) continue;
        b.d[y * W + x] = shade ? shade[b.d[y * W + x]] : c;
      }
    }
  }
  function stampLayer(b, u) {
    if (u < 6.14) return;
    if (u < IMPACT) {
      // anticipation: only the shadow of the descending block, shrinking and sharpening
      const a = E.in(seg(u, 6.14, IMPACT));
      drawStamp(b, K.shadow, 1.45 - 0.45 * a, STAMP_C[0] + 14 * (1 - a), STAMP_C[1] + 11 * (1 - a), K.dimShadow);
      return;
    }
    const dt = u - IMPACT;
    const s = 1 + 0.11 * Math.exp(-dt * 15) * Math.cos(dt * 36); // overshoot, dip, settle
    drawStamp(b, K.stamp, s, STAMP_C[0], STAMP_C[1], null);
  }
  function shakeAt(u) {
    const dt = u - IMPACT;
    if (dt < 0 || dt > 0.5) return [0, 0];
    const a = Math.exp(-dt * 9);
    return [Math.round(1.6 * a * Math.sin(dt * 44 + 1)), Math.round(3.4 * a * Math.cos(dt * 57))];
  }
  /** Copy src -> dst shifted by (dx,dy); the edge rows/columns repeat (no VOID gaps). */
  function copyShifted(dst, src, dx, dy) {
    if (!dx && !dy) { dst.d.set(src.d); return; }
    for (let y = 0; y < H; y++) {
      const sy = RF.clamp(y - dy, 0, H - 1);
      for (let x = 0; x < W; x++) dst.d[y * W + x] = src.d[sy * W + RF.clamp(x - dx, 0, W - 1)];
    }
  }
  /** Doom's screen melt: the previous frame slides down in uneven 4-px columns, revealing the tally. */
  function melt(screen, enter, u) {
    const s = u / MELT_END;
    for (let c = 0; c < W / 4; c++) {
      const p = RF.clamp01((s - K.melt[c]) / (1 - 0.26));
      const off = Math.round(H * Math.pow(p, 1.5));
      if (off >= H) continue;
      for (let y = off; y < H; y++) {
        const src = (y - off) * W, dst = y * W;
        for (let x = c * 4; x < c * 4 + 4; x++) screen.d[dst + x] = enter ? enter.d[src + x] : C.VOID;
      }
    }
  }
  /** Bayer dissolve through VOID into the night the next shot starts on (palette-safe, no hue shifts). */
  function fadeOut(screen, exit, u) {
    const d = screen.d;
    const into = u >= 7.6 && exit;
    const q = into ? seg(u, 7.6, 7.84) : seg(u, OUT0, 7.5);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x, hit = RF.bayer(x, y) < q;
        if (into) d[i] = hit ? exit.d[i] : C.VOID;
        else if (hit) d[i] = C.VOID;
      }
  }
  /** Values with a real descending comma (the Bezel comma sits on the baseline and reads as a period at 2x). */
  function valueWidth(txt) {
    let w = 0;
    for (const ch of txt) w += ch === ',' ? 6 : RF.textWidth(ch, 2) + 2;
    return w - 2;
  }
  function drawValue(b, txt, xRight, y, c) {
    let x = xRight - valueWidth(txt);
    for (const ch of txt) {
      if (ch === ',') {
        [[x + 2, y + 10], [x + 2, y + 12], [x, y + 14]].forEach(([px, py]) => { b.rect(px + 2, py + 2, 2, 2, C.VOID); b.rect(px, py, 2, 2, c); });
        x += 6;
      } else x = RF.drawText(b, ch, x, y, c, 2, { shadow: C.VOID });
    }
  }

  RF.TALLY = {
    dur: DUR,
    lines: [
      { t0: 0.8, t1: 3.0, say: 'Millions made. Far fewer sold.' },
      { t0: 3.4, t1: 5.3, say: 'Built in about five weeks.' },
      { t0: 6.45, t1: 7.9, say: 'And the stores sent it back.' },
    ],
    render: function (screen, uIn, unders) {
      if (!K) build();
      const u = RF.clamp(uIn, 0, DUR);
      const enter = unders && unders.enter, exit = unders && unders.exit;
      if (u >= 7.84 && exit) { screen.d.set(exit.d); return screen; }
      const w = K.work;
      w.d.set(K.base.d);
      drawRows(w, u);
      stampLayer(w, u);
      const sh = shakeAt(u);
      copyShifted(screen, w, sh[0], sh[1]);
      if (u < MELT_END) melt(screen, enter, u);
      if (u >= OUT0) fadeOut(screen, exit, u);
      return screen;
    },
  };
})();

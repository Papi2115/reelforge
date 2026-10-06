/* comic-panels v2 showcase - new hand marks for v2: pencil loop, strike-through, tick, highlighter,
 * coffee ring, worn rubber stamp; plus small shared helpers (rotPts, pop). All seeded, no randomness.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { rnd, rndRange } = CP;

  /** Pencil loop drawn in one stroke that overshoots its start instead of closing (p = 0..1 drawn). */
  function pencilCircle(cx, cy, rx, ry, p, paint, key, w) {
    const pts = [];
    const a0 = rndRange(key, 1, -2.6, -1.9);
    const turns = 1.12 + rnd(key, 2) * 0.1;
    for (let i = 0; i <= 40; i++) {
      const s = i / 40;
      const a = a0 + s * turns * Math.PI * 2;
      const grow = 1 + s * 0.12 + 0.05 * Math.sin(a * 2 + rnd(key, 3) * 6);
      pts.push(cx + Math.cos(a) * rx * grow, cy + Math.sin(a) * ry * grow + s * 2);
    }
    CP.strokeOn(pts, p, paint, w || 1);
  }
  /** Crossed out: two quick, slightly rising strokes, the second one shorter. */
  function strike(x0, y, x1, p, paint, key) {
    const r = (i) => rndRange(key, i, -1.5, 1.5);
    CP.strokeOn([x0 - 3, y + 2 + r(1), x1 + 3, y - 2 + r(2)], CP.seg01(p, 0, 0.55), paint, 2);
    CP.strokeOn([x1 + 1, y + 1 + r(3), x0 + 4, y - 1 + r(4)], CP.seg01(p, 0.62, 1), paint, 1);
  }
  /** A pencil tick: short down-stroke, long flick up to the right. */
  function tick(x, y, p, paint, key) {
    const k = 1 + rnd(key, 1) * 0.25;
    CP.strokeOn([x, y, x + 3 * k, y + 5 * k, x + 11 * k, y - 6 * k + rndRange(key, 2, -1, 1)], p, paint, 2);
  }
  /** Highlighter swipe behind a word: a dithered band with ragged ends, slightly tilted. */
  function highlighter(x0, y0, x1, y1, p, paint, key) {
    const xe = x0 + (x1 - x0) * CP.clamp01(p);
    const tilt = rndRange(key, 1, -0.03, 0.03);
    for (let x = Math.round(x0); x <= xe; x++) {
      const dy = (x - x0) * tilt;
      const top = y0 + dy + (rnd(key, x) < 0.2 ? 1 : 0);
      const bot = y1 + dy - (rnd(key, x + 999) < 0.2 ? 1 : 0);
      for (let y = Math.round(top); y <= bot; y++) CP.plot(x, y, paint);
    }
  }
  /** A coffee ring: an uneven brown annulus, darker on one side, with a gap where the cup lifted. */
  function coffeeRing(cx, cy, r, paint, key) {
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      if (Math.abs(Math.sin((a - rnd(key, 1) * 6) / 2)) < 0.1) continue;
      const w = 1 + (Math.sin(a + rnd(key, 2) * 6) > 0.3 ? 1 : 0);
      const rr = r * (1 + 0.03 * Math.sin(a * 3));
      for (let k = 0; k < w; k++) CP.plot(cx + Math.cos(a) * (rr - k), cy + Math.sin(a) * (rr - k) * 0.96, paint);
    }
  }
  /**
   * Rubber stamp: a worn frame and display letters in one ink, with seeded dropouts where the
   * rubber did not touch the paper. k = scale (slams from >1 to 1).
   */
  function rubberStamp(str, cx, cy, k, ang, ink, key, opt) {
    const o = opt || {};
    const w = (o.w || 92) * k;
    const h = (o.h || 40) * k;
    const box = rotPts([cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2], cx, cy, ang);
    const thin = (x, y) => CP.noise2(key + 'ink', x, y, 3) < (o.wear || 0.28);
    const worn = (x, y) => (thin(x, y) || rnd(key + 'dot', (x * 7 + y * 13) % 997) < 0.08 ? -1 : ink);
    CP.polyline(box, worn, Math.max(2, Math.round(2 * k)), true);
    if (o.inner) CP.polyline(rotPts([cx - w / 2 + 4 * k, cy - h / 2 + 4 * k, cx + w / 2 - 4 * k, cy - h / 2 + 4 * k, cx + w / 2 - 4 * k, cy + h / 2 - 4 * k, cx - w / 2 + 4 * k, cy + h / 2 - 4 * k], cx, cy, ang), worn, 1, true);
    const pitch = (o.pitch || 20) * k;
    str.split('').forEach((ch, i) => {
      const off = (i - (str.length - 1) / 2) * pitch;
      CP.bigLetter(ch, cx + Math.cos(ang) * off, cy + Math.sin(ang) * off, (o.size || 3.4) * k, ang + rndRange(key, 30 + i, -0.04, 0.04), worn, { key: key + i, outline: 0, extrude: [0, 0], mis: [0, 0] });
    });
  }
  function rotPts(pts, cx, cy, a) {
    const out = [];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] - cx;
      const y = pts[i + 1] - cy;
      out.push(cx + x * ca - y * sa, cy + x * sa + y * ca);
    }
    return out;
  }
  /** Pop-in scale with an overshoot (0 -> 1.1 -> 1), used by balloons across shots. */
  function pop(t, t0, dur) {
    return CP.track([[t0, 0], [t0 + dur * 0.62, 1.1, CP.E.outQuad], [t0 + dur, 1, CP.E.inOutSine]], t);
  }

  Object.assign(CP, { pencilCircle, strike, tick, highlighter, coffeeRing, rubberStamp, rotPts, pop });
})();

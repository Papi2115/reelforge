/* comic-panels v2 showcase - shot 9: DOUBLE-PAGE SPREAD (new scene type).
 * The page turns onto a four-panel page that is secretly one picture. Then the gutters shrink away one
 * by one (different speeds), the borders thin out, the margins slide off the edges: the panels merge
 * into one image that bleeds off every edge. Then nothing moves - a held silence - and late in the hold
 * a tiny pencilled margin note appears. The title is lettering built INTO the landscape.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, E, seg, lerp, W, H } = CP;
  const { paper, pencils } = CP.page;
  const A = CP.art;

  const MERGE = [1.05, 2.45];
  // Gutters: [x top, x bottom, width, start, end] - each closes on its own beat.
  const VGUT = [
    [203, 199, 11, 1.15, 2.05],
    [401, 405, 9, 1.32, 2.3],
  ];
  // The horizontal gutter goes first, so no sliver of paper is ever left floating in the sky.
  const HGUT = [112, 116, 10, 1.05, 1.7];
  // Before the merge each panel is its own drawing, a little out of register with its neighbours;
  // it slides into place as the gutters beside it close.
  const OFFSET = [[-9, 5], [2, -7], [6, 5], [11, -4]];
  const NOTE_T = 5.6;
  const GLINT = [4.1, 4.17];

  function shot9(t) {
    const m = seg(t, MERGE[0], MERGE[1], E.inOutSine);
    // The image grows a little as the margins leave, so its edges always bleed once merged.
    const s = lerp(0.955, 1.03, m);
    const K = new CP.Xf(s, W / 2 - 320 * s, H / 2 - 186 * s + 6);
    const mis = [Math.round(lerp(2, 1, m)), Math.round(lerp(1, -1, m))];
    const glint = t >= GLINT[0] && t < GLINT[1];
    A.vista(K, mis, { key: 's9', glint });
    // Spine of the book: the faintest crease down the middle of the spread.
    CP.rect(320, 0, 1, H, (x, y) => (CP.BAYER4[(y & 3) * 4 + (x & 3)] < 3 ? C.MOON_D : -1));

    // --- page furniture that the merge removes ---
    const margin = Math.round(lerp(14, -3, m));
    const bw = m < 0.55 ? 2 : m < 0.85 ? 1 : 0;
    const gw = (g) => (g > 3 ? 2 : g > 1.2 ? 1 : 0);
    const close = VGUT.map(([, , , a, b]) => seg(t, a, b, E.inOutCubic));
    const gutters = [];
    VGUT.forEach(([xt, xb, w], i) => {
      const g = w * (1 - close[i]);
      if (g > 1.2) gutters.push({ xt, xb, g });
    });
    const hClose = seg(t, HGUT[3], HGUT[4], E.inOutCubic);
    const hg = HGUT[2] * (1 - hClose);
    if (margin > 0 || gutters.length || hg > 1.2) {
      const saved = CP.fb.slice();
      // Panel of a pixel: 0 left, 1 top middle, 2 bottom middle, 3 right; each with its own offset.
      const gx = (i, y) => lerp(VGUT[i][0], VGUT[i][1], y / H);
      const reg = [close[0], Math.min(close[0], close[1], hClose), Math.min(close[0], close[1], hClose), close[1]];
      const off = OFFSET.map(([dx, dy], i) => [Math.round(dx * (1 - reg[i])), Math.round(dy * (1 - reg[i]))]);
      for (let y = 0; y < H; y++) {
        const a = gx(0, y);
        const b = gx(1, y);
        for (let x = 0; x < W; x++) {
          const pi = x < a ? 0 : x >= b ? 3 : y < lerp(HGUT[0], HGUT[1], (x - a) / (b - a)) ? 1 : 2;
          const [dx, dy] = off[pi];
          if (dx === 0 && dy === 0) continue;
          const sx = Math.min(W - 1, Math.max(0, x - dx));
          const sy = Math.min(H - 1, Math.max(0, y - dy));
          CP.fb[y * W + x] = saved[sy * W + sx];
        }
      }
      const shifted = CP.fb.slice();
      paper(new CP.Xf(1, 0, 0), 'p9');
      const keep = new Uint8Array(W * H);
      const x0 = margin;
      const x1 = W - margin;
      const y0 = margin;
      const y1 = H - margin;
      CP.poly([x0, y0, x1, y0, x1, y1, x0, y1], 0, keep);
      const cut = new Uint8Array(W * H);
      gutters.forEach(({ xt, xb, g }) => CP.poly([xt - g / 2, y0, xt + g / 2, y0, xb + g / 2, y1, xb - g / 2, y1], 0, cut));
      if (hg > 1.2) {
        const xa = lerp(VGUT[0][0], VGUT[0][1], HGUT[0] / H);
        const xbR = lerp(VGUT[1][0], VGUT[1][1], HGUT[1] / H);
        CP.poly([xa, HGUT[0] - hg / 2, xbR, HGUT[1] - hg / 2, xbR, HGUT[1] + hg / 2, xa, HGUT[0] + hg / 2], 0, cut);
      }
      const fb = CP.fb;
      for (let i = 0; i < fb.length; i++) if (keep[i] && !cut[i]) fb[i] = shifted[i];
      if (bw > 0) CP.polyline(CP.boil([x0, y0, x1, y0, x1, y1, x0, y1], 's9frame', 0.4), C.INK, bw, true);
      gutters.forEach(({ xt, xb, g }, i) => {
        const w = gw(g);
        if (w) {
          CP.line(xt - g / 2, y0, xb - g / 2, y1, C.INK, w);
          CP.line(xt + g / 2, y0, xb + g / 2, y1, C.INK, w);
        }
        if (m < 0.15) pencils([xt - g / 2, y0, xt + g / 2, y0, xb + g / 2, y1, xb - g / 2, y1], 's9pen' + i);
      });
      if (hg > 1.2 && gw(hg)) {
        const xa = lerp(VGUT[0][0], VGUT[0][1], HGUT[0] / H);
        const xbR = lerp(VGUT[1][0], VGUT[1][1], HGUT[1] / H);
        CP.line(xa, HGUT[0] - hg / 2, xbR, HGUT[1] - hg / 2, C.INK, gw(hg));
        CP.line(xa, HGUT[0] + hg / 2, xbR, HGUT[1] + hg / 2, C.INK, gw(hg));
      }
      if (margin > 4) CP.thumbprint(26, 352, 'thumb9', C.SHADE);
    }

    // --- the margin note, pencilled small near the spine, late in the silence ---
    if (t >= NOTE_T) {
      const n = Math.floor(seg(t, NOTE_T, NOTE_T + 0.9, E.outQuad) * 18.99);
      CP.text('hand', 'SEA OF TRANQUILITY', 334, 40, C.PENCIL, { key: 's9note', slant: 1, jitter: 1.3, reveal: n });
      if (t >= NOTE_T + 1.0) CP.handArrow(352, 52, 340, 118, seg(t, NOTE_T + 1.0, NOTE_T + 1.35, E.inOutSine), C.PENCIL, 's9arrow', 1);
    }
    return null;
  }

  CP.SHOTS[8] = {
    title: 'spread',
    dur: 9,
    render: shot9,
    transIn: { kind: 'turn', dur: 0.9, slope: 0.22 },
    narration: '(silence) ... Tranquility Base.',
    note: 'the page turns onto four panels that turn out to be one picture: the gutters close, the borders and margins leave, and the image bleeds off every edge. Then: nothing moves.',
  };
})();

/* comic-panels v2 showcase - art for the double-page spread (shot 9): one vista of the landing site.
 * The title is part of the landscape: block letters standing in the regolith, lit by the same low sun
 * as Eagle, casting the same long shadows to the right, half buried at the base.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, rnd, rndRange, halftone, layer, dither, boil, lerp } = CP;
  const A = CP.art;

  /** One standing block letter: base centre (bx,by) in screen px, cap height h, extrusion (ex,ey). */
  function blockLetter(ch, bx, by, h, key, opt) {
    const o = opt || {};
    const g = CP.FONTS.display.glyphs[ch];
    if (!g) return 0;
    const cw = (h / 7) * (o.squeeze || 0.86);
    const ch2 = h / 7;
    const w = Math.round(g.w * cw);
    const hh = Math.round(h);
    const x0 = Math.round(bx - w / 2);
    const y0 = Math.round(by - hh);
    const lean = o.lean || 0;
    const m = new Uint8Array(w * hh);
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < w; x++) {
        const gx = Math.min(g.w - 1, Math.floor(x / cw));
        const gy = Math.min(6, Math.floor(y / ch2));
        m[y * w + x] = g.bits[gy * g.w + gx];
      }
    }
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < hh && m[y * w + x] === 1;
    const ex = o.ex || 4;
    const ey = o.ey || -3;
    const steps = Math.max(Math.abs(ex), Math.abs(ey));
    const sx = (x, y) => x0 + x + Math.round(lean * (hh - y));
    // Long shadow on the ground, to the right and a little away (same sun as Eagle).
    const shadow = dither(-1, C.MOON_D, 0.75);
    for (let y = 0; y < hh; y++) {
      const up = hh - y;
      for (let x = 0; x < w; x++) {
        if (!m[y * w + x]) continue;
        CP.plot(x0 + x + Math.round(up * 1.5), by - Math.round(up * 0.16), shadow);
        CP.plot(x0 + x + Math.round(up * 1.5) + 1, by - Math.round(up * 0.16), shadow);
      }
    }
    // Ink outline: the union of face + extrusion, grown by one pixel.
    for (let k = 0; k <= steps; k++) {
      const dx = Math.round((ex * k) / steps);
      const dy = Math.round((ey * k) / steps);
      for (let y = 0; y < hh; y++) {
        for (let x = 0; x < w; x++) {
          if (!m[y * w + x]) continue;
          CP.rect(sx(x, y) + dx - 1, y0 + y + dy - 1, 3, 3, C.INK);
        }
      }
    }
    // Extrusion (the unlit side), then the lit face with a screen that darkens toward the ground.
    for (let k = steps; k >= 1; k--) {
      const dx = Math.round((ex * k) / steps);
      const dy = Math.round((ey * k) / steps);
      for (let y = 0; y < hh; y++) {
        for (let x = 0; x < w; x++) if (m[y * w + x]) CP.plot(sx(x, y) + dx, y0 + y + dy, k === steps ? C.INK : C.MOON_D);
      }
    }
    const face = layer(halftone(C.MOON_M, (px, py) => 0.45 * CP.clamp01((py - y0 - hh * 0.8) / (hh * 0.2)), { cell: 3, angle: 0.78 }), C.PAPER);
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < w; x++) {
        if (!at(x, y)) continue;
        const edge = !at(x, y - 1) && y > 0 ? C.MOON_L : -1;
        CP.plot(sx(x, y), y0 + y, edge >= 0 ? edge : face);
      }
    }
    // Regolith drifted against the base: the letters stand IN the ground, not on it.
    const drift = [];
    for (let i = 0; i <= 8; i++) drift.push(x0 - 4 + (i / 8) * (w + 10), by + 1 - Math.sin((i / 8) * Math.PI) * (1 + rnd(key, i) * 1.5));
    drift.push(x0 + w + 6, by + 3, x0 - 4, by + 3);
    CP.poly(drift, layer(halftone(C.MOON_M, 0.25, { cell: 3, angle: 0.78 }), C.MOON_L));
    CP.polyline(drift.slice(0, 18), C.INK, 1, false);
    return w;
  }

  /** The title as a row of standing letters receding to the right; returns their screen extent. */
  function title(K, text, o) {
    const n = text.length;
    let x = K.x(o.x0);
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = i / (n - 1);
      const h = lerp(o.h0, o.h1, p) * K.s;
      const by = lerp(K.y(o.y0), K.y(o.y1), p) + Math.round(rndRange(o.key, i, -1.5, 1.5));
      if (text[i] === ' ') {
        x += h * 0.55;
        continue;
      }
      const g = CP.FONTS.display.glyphs[text[i]];
      const w = Math.round(g.w * (h / 7) * 0.7);
      out.push({ ch: text[i], bx: x + w / 2, by, h, lean: rndRange(o.key, i + 50, -0.025, 0.025) });
      x += w + Math.max(6, h * 0.36);
    }
    // Far letters first, so nearer ones (and their shadows) overlap correctly.
    for (let i = out.length - 1; i >= 0; i--) {
      const L = out[i];
      blockLetter(L.ch, L.bx, L.by, L.h, o.key + i, { lean: L.lean, squeeze: 0.7, ex: Math.round(2 + L.h / 16), ey: -Math.round(1 + L.h / 24) });
    }
    return out;
  }

  /** The whole vista in spread space (640x360 at scale 1, bleeding past every edge). */
  function vista(K, mis, o) {
    const F = K.shift(mis[0], mis[1]);
    const key = o.key || 'vista';
    // Black sky: daylight on the Moon, but no stars register next to sunlit ground.
    CP.rect(0, 0, CP.W, CP.H, layer(halftone(C.CYAN_D, A.local(K, (lx, ly) => 0.22 * CP.clamp01((ly - 70) / 70)), { cell: 4, angle: 0.26 }), C.NIGHT));
    // Low ridge on the horizon.
    const ridge = [];
    for (let x = -40; x <= 690; x += 15) ridge.push(x, 132 + x * 0.014 - 4 - 5 * CP.noise2(key + 'r', x, 0, 60) - 3 * Math.sin(x / 23));
    ridge.push(690, 160, -40, 160);
    F.poly(ridge, layer(halftone(C.MOON_D, 0.35, { cell: 3, angle: 0.78 }), C.MOON_M));
    CP.polyline(boil(K.map(ridge.slice(0, ridge.length - 4)), key + 'ridge', 0.4), C.INK, 1, false);
    const hy = A.surface(K, mis, { x0: -40, x1: 690, hy: 138, xc: 300, R: 9000, tilt: 0.014, yb: 400, craters: 46, key: key + 's', toneTop: 0.1, toneBot: 0.42, craterScale: 1.1 });
    // Foreground: the dark rim of a crater we stand at, bottom left, cropped by the page edge.
    const rim = [-40, 300, 30, 318, 110, 334, 180, 352, 200, 400, -40, 400];
    F.poly(rim, layer(halftone(C.NIGHT, 0.35, { cell: 4, angle: 0.78 }), C.MOON_D));
    CP.polyline(boil(K.map(rim.slice(0, 8)), key + 'rim', 0.5), C.INK, K.w(1.5), false);
    for (let i = 0; i < 5; i++) A.boulder(K, mis, 20 + i * 34 + rnd(key + 'b', i) * 10, 312 + i * 6, 5 + rnd(key + 'br', i) * 6, key + 'bo' + i);
    // The title, standing in the mid-ground.
    title(K, 'TRANQUILITY BASE', { key: key + 'T', x0: 46, y0: 218, y1: 188, h0: 32, h1: 20 });
    // Eagle on the right third, its shadow running long to the right, out of the spread.
    const ex = o.lmX || 526;
    const ey = o.lmY || 262;
    A.lmShadow(K.at(ex - 34, ey + 1, 1.35), { paint: dither(C.MOON_M, C.MOON_D, 0.8), stretch: 2.1 });
    A.lm(K.at(ex, ey - 54, 1.35), mis, { probes: true, key: key + 'lm' });
    if (o.glint) K.rect(ex - 30, ey - 34, 2, 2, C.PAPER);
    return { hy, eagle: [K.x(ex), K.y(ey - 60)] };
  }

  Object.assign(CP.art, { vista, title, blockLetter });
})();

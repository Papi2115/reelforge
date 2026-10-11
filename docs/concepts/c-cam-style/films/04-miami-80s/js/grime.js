/* Grime brushes for sets: everything dirty is a drawn flat shape or hatching, never a texture or filter.
   stain, peel (plaster fallen off to show brick), crack, cobbles, crooked half-timbered house, shutters, puddle. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;

  // flat irregular stain (damp, soot, piss, wine) with a darker rim stroke on one side
  ST.stain = (ctx, x, y, w, h, seed, col) => {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, r = 0.6 + 0.45 * ST.hash(seed, i, 1);
      pts.push(x + Math.cos(a) * w * 0.5 * r, y + Math.sin(a) * h * 0.5 * r + (Math.sin(a) > 0 ? h * 0.25 * ST.hash(seed, i, 2) : 0));
    }
    ST.blob(ctx, pts, col || 'rgba(40,30,15,0.22)', { lw: 0, seed });
  };
  // peeled plaster: a jagged hole in the render showing brick courses, ink edge
  ST.peel = (ctx, x, y, w, h, seed) => {
    const pts = ST.wobble([x, y, x + w * 0.6, y - h * 0.1, x + w, y + h * 0.3, x + w * 0.8, y + h, x + w * 0.2, y + h * 0.85], Math.min(w, h) * 0.12, seed, 26);
    ST.blob(ctx, pts, '#7a4e3a', { sharp: true, lw: 0, seed });
    ctx.save();
    ST.path(ctx, pts, true);
    ctx.clip();
    ST.bricks(ctx, x - 4, y - h * 0.2, w + 8, h * 1.3, { bh: 16, bw: 38, seed, line: 'rgba(30,18,12,0.55)', tone: 'rgba(0,0,0,0.18)', density: 0.3 });
    ctx.restore();
    ST.inkLine(ctx, pts, { w: 4, closed: true, seed });
  };
  ST.crack = (ctx, x, y, len, seed, ang) => {
    const pts = [x, y];
    let cx = x, cy = y;
    const a0 = ang === undefined ? 1.2 : ang;
    for (let i = 1; i < 5; i++) {
      const a = a0 + ST.rnd(-0.6, 0.6, seed, i);
      cx += Math.cos(a) * len / 4;
      cy += Math.sin(a) * len / 4;
      pts.push(cx, cy);
    }
    ST.inkLine(ctx, pts, { w: 3.5, seed });
  };
  // cobbled ground in perspective rows: flat stones with ink edges, smaller toward the horizon
  ST.cobbles = (ctx, x0, y0, x1, y1, seed, col, colD) => {
    ST.rect(ctx, x0, y0, x1 - x0, y1 - y0, colD || '#4b4538', { seed, lw: 0 });
    for (let r = 0, y = y0; y < y1; r++) {
      const k = 0.35 + 0.65 * ((y - y0) / (y1 - y0)), h = 26 * k + 6, w = 70 * k + 14;
      for (let x = x0 - ST.hash(seed, r) * w; x < x1; x += w) {
        const j = ST.hash(seed, r, x | 0);
        ST.blob(ctx, ST.ellipseRing(x + w / 2, y + h / 2, w * 0.44, h * 0.4, 7), j < 0.2 ? '#5f574a' : col || '#6c6455', { lw: 3, seed: seed + r * 31 + (x | 0) });
      }
      y += h;
    }
  };
  // crooked half-timbered house: plaster panels, heavy dark beams (posts, rails, braces), jettied upper floor that
  // overhangs and leans, small leaded windows with shutters, a steep roof. lean: px the top drifts sideways.
  ST.house = (ctx, x, base, w, h, o) => {
    const seed = o.seed || 1, lean = o.lean || 0, floors = o.floors || 3, fh = h / floors, plaster = o.plaster || '#857a5c';
    const L = (y) => x + lean * ((base - y) / h), Rr = (y) => x + w + lean * ((base - y) / h) + (o.jetty || 14) * Math.floor((base - y) / fh);
    const top = base - h;
    ST.rough(ctx, [L(base), base, Rr(base), base, Rr(top), top, L(top), top], plaster, { seed, lw: 6, shade: ['rgba(0,0,0,0.2)', -24, 0], mottle: ['rgba(60,50,30,0.22)', 6, 40], hatch: { c: 'rgba(30,24,12,0.35)', n: 8, len: 40, gap: 8, k: 3, ang: 80 } });
    ST.rough(ctx, [L(base), base, Rr(base), base, Rr(base - fh * 0.35), base - fh * 0.35, L(base - fh * 0.35), base - fh * 0.35], 'rgba(40,32,18,0.3)', { seed: seed + 5, lw: 0 }); // splash grime
    for (let i = 0; i < 5; i++) ST.stain(ctx, L(base) + w * ST.rnd(0.1, 0.9, seed, i), base - h * ST.rnd(0.1, 0.8, seed, i, 1), 60 + 50 * ST.hash(seed, i, 2), 40 + 40 * ST.hash(seed, i, 3), seed + i);
    if (o.peel !== false) [0, 1].forEach((k) => ST.peel(ctx, L(base) + w * ST.rnd(0.1, 0.75, seed, 7, k), base - fh * (k + ST.rnd(0.3, 0.7, seed, 8, k)), 60 + 40 * k, 44 + 20 * k, seed + 9 + k));
    const bw = o.beam || 18;
    for (let f = 0; f < floors; f++) {
      const yb = base - f * fh, yt = yb - fh;
      ST.beam(ctx, L(yb) - 6, yb, Rr(yb) + 6, yb, bw, seed + 20 + f);
      const posts = Math.max(2, Math.round(w / 110));
      for (let k = 0; k <= posts; k++) {
        const u = k / posts, xb = L(yb) + (Rr(yb) - L(yb)) * u, xt = L(yt) + (Rr(yt) - L(yt)) * u;
        ST.beam(ctx, xb, yb, xt, yt, bw * 0.85, seed + 30 + f * 10 + k);
        if (k < posts && ST.hash(seed, f, k) < 0.28) ST.beam(ctx, xb + 8, yb - 6, L(yt) + (Rr(yt) - L(yt)) * ((k + 1) / posts) - 8, yt + 8, bw * 0.6, seed + 60 + f * 10 + k);
        else if (k < posts && f > 0) ST.window(ctx, (xb + L(yt) + (Rr(yt) - L(yt)) * ((k + 0.5) / posts)) / 2 + (Rr(yb) - L(yb)) / posts / 4, yb - fh * 0.62, Math.min(60, w / posts * 0.45), fh * 0.38, seed + 70 + f * 10 + k, o.lit);
      }
    }
    ST.beam(ctx, L(top) - 10, top, Rr(top) + 10, top, bw * 1.2, seed + 90);
    const rh = o.roof || h * 0.45, rx = (L(top) + Rr(top)) / 2 + (o.roofLean || 0);
    ST.rough(ctx, [L(top) - 30, top, rx, top - rh, Rr(top) + 30, top], o.roofCol || '#5a3c30', { seed: seed + 91, lw: 6, shade: ['rgba(0,0,0,0.25)', -20, 0], hatch: { c: 'rgba(20,10,6,0.5)', n: 8, len: 40, gap: 9, k: 3, ang: 15, bend: 0.02 } });
    return { left: L, right: Rr, top, roofTop: top - rh };
  };
  // small leaded window: dark (or warmly lit) panes, lead cross, crooked shutters
  ST.window = (ctx, cx, cy, w, h, seed, lit) => {
    ST.rect(ctx, cx - w / 2 - w * 0.5, cy - h / 2, w * 0.45, h, C.OLIVE_D, { seed: seed + 1, lw: 4, hatch: { c: 'rgba(10,10,4,0.5)', n: 2, len: h * 0.6, gap: 6, k: 3, ang: 90, bend: 0 } });
    ST.rect(ctx, cx - w / 2, cy - h / 2, w, h, lit ? '#c98f3e' : '#2b2a25', { seed, lw: 5, amp: 1.5 });
    ctx.strokeStyle = lit ? '#6b4a20' : '#4b4a40';
    ctx.lineWidth = 2.5 * ST.LW;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) { ctx.moveTo(cx - w / 2 + (w * i) / 3, cy - h / 2); ctx.lineTo(cx - w / 2 + (w * i) / 3, cy + h / 2); }
    ctx.moveTo(cx - w / 2, cy); ctx.lineTo(cx + w / 2, cy);
    ctx.stroke();
  };
  ST.puddle = (ctx, x, y, w, seed, sky) => {
    ST.blob(ctx, ST.wobble(ST.ellipseRing(x, y, w, w * 0.18, 10), w * 0.06, seed, 20), sky || '#6f7268', { lw: 4, seed, light: ['rgba(220,215,190,0.25)', 6, -2] });
  };
  // a cluster of flies over muck: tiny dashes jittering on twos
  ST.flies = (ctx, x, y, t, seed) => {
    ctx.fillStyle = C.INK;
    const tt = Math.floor(ST.twos(t) * 12);
    for (let i = 0; i < 6; i++) ctx.fillRect(x + ST.rnd(-40, 40, seed, i, tt), y + ST.rnd(-30, 30, seed, i, tt + 7), 4, 3);
  };
})();

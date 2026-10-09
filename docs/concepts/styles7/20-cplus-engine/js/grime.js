/* Grime: everything dirty is a drawn flat shape or scratchy hatching, never a texture or filter. One signature per
   brush (the films disagreed; ported characters were converted). Clothes: sweat, smear, torn hem, stitched patch,
   grime patch. Walls / floors: stain, peel, crack, puddle, flies, tar drips, carved letters, chalk tallies. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;

  // ---- clothes (call inside the garment's own space) ----
  // sweat stain: a flat damp patch w x h with two tide-mark rings
  ST.sweat = (ctx, x, y, w, h, seed) => {
    const ring = (k, col, lw) => ST.blob(ctx, ST.wobble(ST.ellipseRing(x, y, (w / 2) * k, (h / 2) * k, 9), Math.min(w, h) * 0.06, seed + k * 10, 12), col, { lw, seed: seed + k * 10, lineColor: 'rgba(60,40,20,0.35)', scratch: 0.5, double: false });
    ring(1, 'rgba(70,50,20,0.28)', 2);
    ring(0.62, 'rgba(70,50,20,0.22)', 1.5);
  };
  // grease smear: two or three dragged finger stripes
  ST.smear = (ctx, x, y, len, ang, seed, col) => {
    if (ST.SIL) return;
    for (let i = 0; i < 3; i++) {
      const ox = x + i * 9 * Math.sin(ang), oy = y - i * 9 * Math.cos(ang), l = len * (0.7 + 0.3 * ST.hash(seed, i));
      ST.stroke(ctx, [ox, oy, ox + Math.cos(ang) * l, oy + Math.sin(ang) * l], { w: 9, color: col || 'rgba(30,20,10,0.32)', seed: seed + i });
    }
  };
  // a stitched patch: a crooked rectangle (centre x, y) of another cloth, ink edge, stitch ticks round it
  ST.clothPatch = (ctx, x, y, w, h, col, seed) => {
    const pts = ST.wobble([x - w / 2, y - h / 2, x + w / 2, y - h / 2 - 3, x + w / 2 + 2, y + h / 2, x - w / 2, y + h / 2 + 2], 2, seed, 14);
    ST.blob(ctx, pts, col, { sharp: true, lw: 4, seed, hatch: { c: 'rgba(20,14,6,0.4)', n: 2, len: w * 0.5, gap: 4, k: 2, ang: 30 } });
    if (ST.SIL) return;
    ctx.strokeStyle = 'rgba(20,14,6,0.8)';
    ctx.lineWidth = 2 * ST.LW;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) {
      const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[(2 * i + 2) % 8], by = pts[(2 * i + 3) % 8], u = (k + 0.5) / 4;
      const px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
      ctx.moveTo(px - 3, py - 3);
      ctx.lineTo(px + 3, py + 3);
    }
    ctx.stroke();
  };
  // torn hem: ragged ink teeth along the edge (x0, y0) -> (x1, y1) + a few loose threads hanging off it
  ST.tornHem = (ctx, x0, y0, x1, y1, seed, n) => {
    if (ST.SIL) return; // a decoration along an edge: not part of the silhouette
    const pts = [];
    for (let i = 0; i <= n * 2; i++) {
      const u = i / (n * 2), dip = i % 2 ? 10 + 10 * ST.hash(seed, i) : 0;
      pts.push(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + dip);
    }
    ST.inkLine(ctx, pts, { w: 4, seed, taper: false });
    for (let i = 0; i < 3; i++) {
      const u = ST.hash(seed, i, 5), x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + 8;
      ST.stroke(ctx, [x, y, x + ST.rnd(-6, 6, seed, i, 6), y + 14, x + ST.rnd(-8, 8, seed, i, 7), y + 26], { w: 2.5, seed: seed + 10 + i });
    }
  };
  // grime: a flat dirty patch + scratchy cross-hatching inside it
  ST.grime = (ctx, x, y, w, h, seed, col) => {
    ST.blob(ctx, ST.wobble(ST.ellipseRing(x, y, w / 2, h / 2, 8), Math.min(w, h) * 0.12, seed, 16), col || 'rgba(40,30,12,0.3)', { lw: 0, seed, deco: true, hatch: { c: 'rgba(20,14,6,0.45)', n: 3, len: Math.min(w, h) * 0.6, gap: 5, k: 3, ang: 50, cross: true } });
  };

  // ---- walls, wood, floors ----
  // flat irregular stain (damp, soot, wine, gravy) - drawn inside the shape it sits on
  ST.stain = (ctx, x, y, w, h, seed, col) => {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, r = 0.6 + 0.45 * ST.hash(seed, i, 1);
      pts.push(x + Math.cos(a) * w * 0.5 * r, y + Math.sin(a) * h * 0.5 * r + (Math.sin(a) > 0 ? h * 0.25 * ST.hash(seed, i, 2) : 0));
    }
    ST.blob(ctx, pts, col || 'rgba(40,30,15,0.22)', { lw: 0, seed, deco: true });
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
    const pts = [x, y], a0 = ang === undefined ? 1.2 : ang;
    let cx = x, cy = y;
    for (let i = 1; i < 5; i++) {
      const a = a0 + ST.rnd(-0.6, 0.6, seed, i);
      cx += (Math.cos(a) * len) / 4;
      cy += (Math.sin(a) * len) / 4;
      pts.push(cx, cy);
    }
    ST.inkLine(ctx, pts, { w: 3.5, seed });
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
  // tar drips running down from a seam
  ST.tarDrip = (ctx, x, y, len, seed) => {
    for (let i = 0; i < 3; i++) {
      const dx = ST.rnd(-20, 20, seed, i), l = len * ST.rnd(0.4, 1, seed, i, 1);
      ST.stroke(ctx, [x + dx, y, x + dx + 2, y + l * 0.6, x + dx, y + l], { w: 7, color: '#17130f', seed: seed + i, taper: false });
      ST.blob(ctx, ST.ellipseRing(x + dx, y + l + 3, 5, 6, 6), '#17130f', { lw: 0, seed: seed + 5 + i });
    }
  };
  // letters cut into wood: dark incision with a pale lower edge (one flat offset copy, no effects)
  ST.carve = (ctx, str, x, y, size, rot, col) => {
    ST.label(ctx, str, x + 2, y + 2, { size, rot, fill: 'rgba(230,200,150,0.35)', font: `bold ${size}px Georgia, serif` });
    ST.label(ctx, str, x, y, { size, rot, fill: col || 'rgba(16,10,6,0.85)', font: `bold ${size}px Georgia, serif` });
  };
  // chalk tally marks (groups of five), n marks
  ST.tally = (ctx, x, y, n, seed, col) => {
    for (let i = 0; i < n; i++) {
      const g = Math.floor(i / 5), k = i % 5, gx = x + g * 70;
      if (k < 4) ST.stroke(ctx, [gx + k * 12, y, gx + k * 12 + ST.rnd(-3, 3, seed, i), y + 44], { w: 4, color: col || '#d8d2bc', seed: seed + i, taper: false, scratch: 0.6 });
      else ST.stroke(ctx, [gx - 6, y + 34, gx + 46, y + 8], { w: 4, color: col || '#d8d2bc', seed: seed + i, taper: false, scratch: 0.6 });
    }
  };
})();

/* Edo set brushes, built only from C's brushes (rough, rect, beam, blob, tube, hatch, pool, bricks, stain, peel):
   tiled roof, shoji screen, tatami floor, plank wall, lattice front, noren curtain, plaster storehouse wall with
   a tiled base, dirt road, low desk, paper stack, a sparrow on a branch. Grime as flat shapes. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const WOOD = '#4e3b2b', WOOD_D = '#36281d', PAPER = '#a69c7e', PAPER_LIT = '#c9a463';

  // tiled roof: a slab from (x0..x1) with its eave at yEave, rising by rise; rows of round tiles and end caps
  ST.roof = (ctx, x0, x1, yEave, rise, seed, o) => {
    o = o || {};
    const col = o.col || '#3f4144', ov = o.over === undefined ? 40 : o.over;
    ST.rough(ctx, [x0 - ov, yEave, x0 + 20, yEave - rise, x1 - 20, yEave - rise, x1 + ov, yEave, x1 + ov, yEave + 20, x0 - ov, yEave + 20], col, { seed, lw: 6, amp: 2, shade: ['rgba(0,0,0,0.25)', 0, -12], hatch: { c: 'rgba(10,10,12,0.4)', n: 6, len: 40, gap: 9, k: 3, ang: 8, bend: 0.02 } });
    ctx.strokeStyle = 'rgba(14,14,16,0.6)';
    ctx.lineWidth = 3 * ST.LW;
    ctx.beginPath();
    for (let x = x0 - ov + 24; x < x1 + ov; x += 30) { ctx.moveTo(x, yEave + 2); ctx.lineTo(x + (x - (x0 + x1) / 2) * 0.04, yEave - rise + 6); }
    ctx.stroke();
    for (let x = x0 - ov + 9; x < x1 + ov; x += 30) ST.blob(ctx, ST.ellipseRing(x, yEave + 14, 11, 10, 7), '#2f3134', { lw: 3, seed: seed + (x | 0) });
    if (o.moss) ST.stain(ctx, x0 + (x1 - x0) * 0.3, yEave - rise * 0.4, 90, 24, seed + 3, 'rgba(70,80,40,0.45)');
  };
  // shoji: wooden frame + lattice over paper; lit = warm glow behind, torn = a few ripped panes
  ST.shoji = (ctx, x, y, w, h, seed, o) => {
    o = o || {};
    ST.rect(ctx, x, y, w, h, o.lit ? PAPER_LIT : PAPER, { seed, lw: 6, amp: 1.5, mottle: ['rgba(90,70,40,0.18)', 4, 30] });
    const cols = Math.max(2, Math.round(w / 52)), rows = Math.max(3, Math.round(h / 70));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (ST.hash(seed, r, c) < (o.torn || 0)) {
      const px = x + (c * w) / cols + 6, py = y + (r * h) / rows + 6;
      const cw = w / cols - 16, ch = h / rows - 16, j = (a, b) => ST.rnd(-6, 6, seed, r * 31 + c, a * 7 + b);
      ST.blob(ctx, [px + j(0, 0), py + j(0, 1), px + cw * 0.5, py + 10 + j(1, 1), px + cw + j(2, 0), py + j(2, 1), px + cw - 10, py + ch * 0.5, px + cw * 0.7, py + ch * 0.8 + j(3, 1), px + cw * 0.2, py + ch * 0.6, px + 4, py + ch * 0.3], o.lit ? '#e6cc8e' : '#2c2620', { sharp: true, lw: 2.5, seed: seed + r * 9 + c });
    }
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 6 * ST.LW;
    ctx.beginPath();
    for (let c = 1; c < cols; c++) { ctx.moveTo(x + (c * w) / cols, y); ctx.lineTo(x + (c * w) / cols + ST.rnd(-1.5, 1.5, seed, c), y + h); }
    for (let r = 1; r < rows; r++) { ctx.moveTo(x, y + (r * h) / rows); ctx.lineTo(x + w, y + (r * h) / rows + ST.rnd(-1.5, 1.5, seed, r, 1)); }
    ctx.stroke();
    ST.rect(ctx, x - 10, y - 10, w + 20, 16, WOOD, { seed: seed + 1, lw: 5 });
    ST.rect(ctx, x - 10, y + h - 6, w + 20, 16, WOOD, { seed: seed + 2, lw: 5 });
    ST.stain(ctx, x + w * 0.3, y + h * 0.7, w * 0.4, h * 0.2, seed + 3, 'rgba(70,50,20,0.22)');
  };
  // tatami floor between y0 (back) and y1 (front): mats with dark cloth borders, wider toward the camera
  ST.tatami = (ctx, x0, x1, y0, y1, seed) => {
    ST.rect(ctx, x0, y0, x1 - x0, y1 - y0, '#8e8657', { seed, lw: 0, amp: 1 });
    const rows = 3;
    let y = y0;
    for (let r = 0; r < rows; r++) {
      const h = ((y1 - y0) * (0.22 + 0.13 * r)) / 0.87, mw = h * 1.9;
      for (let x = x0 - ST.hash(seed, r) * mw; x < x1; x += mw) ST.rect(ctx, x + 4, y + 3, mw - 8, h - 6, r % 2 ? '#857d50' : '#918a5c', { seed: seed + r * 17 + (x | 0), lw: 4, amp: 1.5, hatch: { c: 'rgba(60,54,24,0.4)', n: 4, len: mw * 0.3, gap: 6, k: 4, ang: 0, bend: 0 } });
      ST.stroke(ctx, [x0, y, x1, y], { w: 9, color: '#2b2a20', seed: seed + 50 + r, taper: false });
      y += h;
    }
    ST.stain(ctx, (x0 + x1) / 2 - 200, y1 - 60, 160, 40, seed + 60, 'rgba(50,40,20,0.3)');
  };
  // vertical plank wall with grain, knots and a damp line at the bottom
  ST.planks = (ctx, x0, y0, x1, y1, seed, col) => {
    ST.rect(ctx, x0, y0, x1 - x0, y1 - y0, col || WOOD, { seed, lw: 6, shade: ['rgba(0,0,0,0.2)', -20, 0], hatch: { c: 'rgba(14,10,6,0.45)', n: Math.round((x1 - x0) / 60), len: 60, gap: 6, k: 2, ang: 90, bend: 0.04 } });
    ctx.strokeStyle = 'rgba(12,8,4,0.6)';
    ctx.lineWidth = 3 * ST.LW;
    ctx.beginPath();
    for (let x = x0 + 46; x < x1; x += 46 + ST.rnd(-6, 6, seed, x | 0)) { ctx.moveTo(x, y0); ctx.lineTo(x + ST.rnd(-2, 2, seed, x | 0, 1), y1); }
    ctx.stroke();
    ST.rect(ctx, x0, y1 - (y1 - y0) * 0.12, x1 - x0, (y1 - y0) * 0.12, 'rgba(20,16,10,0.3)', { seed: seed + 1, lw: 0 });
  };
  // lattice front (koshi): close vertical slats over a dark interior
  ST.lattice = (ctx, x, y, w, h, seed) => {
    ST.rect(ctx, x, y, w, h, '#211a14', { seed, lw: 5 });
    for (let sx = x + 8; sx < x + w - 6; sx += 18) ST.rect(ctx, sx, y + 2, 9, h - 4, '#5c4632', { seed: seed + (sx | 0), lw: 2.5, amp: 0.6 });
    ST.rect(ctx, x - 6, y - 10, w + 12, 14, WOOD, { seed: seed + 1, lw: 4 });
  };
  // noren: split cloth curtain over a doorway; panels sway on twos; mark = a flat round sign on the middle panels
  ST.noren = (ctx, x, y, w, h, col, seed, t, mark) => {
    ST.beam(ctx, x - 16, y, x + w + 16, y, 12, seed, WOOD_D);
    const n = 4, pw = w / n, tt = ST.twos(t || 0);
    for (let i = 0; i < n; i++) {
      const sway = Math.sin(tt * 2.1 + i * 1.3) * 7, px = x + i * pw;
      ST.blob(ctx, [px + 3, y + 4, px + pw - 3, y + 4, px + pw - 3 + sway, y + h, px + 3 + sway, y + h], col, { sharp: true, lw: 5, seed: seed + i, shade: ['rgba(0,0,0,0.25)', -8, 0], hatch: { c: 'rgba(10,10,10,0.35)', n: 2, len: h * 0.4, gap: 6, k: 2, ang: 90, bend: 0 } });
    }
    if (mark) ST.blob(ctx, ST.ellipseRing(x + w / 2, y + h * 0.42, pw * 0.5, pw * 0.5, 12), C.LINEN_D, { lw: 4, seed: seed + 9, inner: () => mark(x + w / 2, y + h * 0.42, pw * 0.5) });
  };
  // white plaster storehouse wall: plaster above, tiled base with the diagonal white grid (namako), peels and stains
  ST.kura = (ctx, x0, x1, yTop, yBase, seed) => {
    ST.rough(ctx, [x0, yTop, x1, yTop, x1, yBase, x0, yBase], '#a49b82', { seed, lw: 6, shade: ['rgba(0,0,0,0.18)', -30, 0], mottle: ['rgba(80,70,40,0.2)', 8, 50], hatch: { c: 'rgba(40,34,20,0.3)', n: 10, len: 50, gap: 8, k: 3, ang: 80 } });
    const by = yBase - (yBase - yTop) * 0.3;
    ST.rect(ctx, x0, by, x1 - x0, yBase - by, '#3a3d40', { seed: seed + 1, lw: 6 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, by, x1 - x0, yBase - by);
    ctx.clip();
    ctx.strokeStyle = '#8a8676';
    ctx.lineWidth = 7 * ST.LW;
    ctx.beginPath();
    for (let d = -(yBase - by); d < x1 - x0; d += 64) { ctx.moveTo(x0 + d, by); ctx.lineTo(x0 + d + (yBase - by), yBase); ctx.moveTo(x0 + d + (yBase - by), by); ctx.lineTo(x0 + d, yBase); }
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 3; i++) ST.peel(ctx, x0 + (x1 - x0) * ST.rnd(0.1, 0.8, seed, i), yTop + (by - yTop) * ST.rnd(0.2, 0.7, seed, i, 1), 70 + 30 * i, 46, seed + 5 + i);
    for (let i = 0; i < 4; i++) ST.stain(ctx, x0 + (x1 - x0) * ST.rnd(0.05, 0.95, seed, i, 3), by - 40, 120, 90, seed + 9 + i, 'rgba(40,34,18,0.28)');
  };
  // packed dirt road: flat earth, ruts, a few stones and a puddle
  ST.dirt = (ctx, x0, y0, x1, y1, seed) => {
    ST.rect(ctx, x0, y0, x1 - x0, y1 - y0, '#6b5a40', { seed, lw: 0 });
    for (let i = 0; i < 3; i++) ST.stroke(ctx, [x0, y0 + (y1 - y0) * (0.3 + 0.25 * i), (x0 + x1) / 2, y0 + (y1 - y0) * (0.32 + 0.25 * i), x1, y0 + (y1 - y0) * (0.29 + 0.25 * i)], { w: 5, color: 'rgba(40,30,18,0.45)', seed: seed + i, taper: false });
    for (let i = 0; i < 14; i++) ST.blob(ctx, ST.ellipseRing(ST.rnd(x0, x1, seed, i), ST.rnd(y0 + 10, y1, seed, i, 1), 12, 7, 6), '#57493a', { lw: 3, seed: seed + 10 + i });
    ST.hatch(ctx, { x0, y0, w: x1 - x0, h: y1 - y0 }, { c: 'rgba(40,30,18,0.4)', n: 16, len: 40, gap: 6, k: 3, ang: 4, bend: 0.05 }, seed + 30);
  };
  // low writing desk seen from the front: top board, a front board that hides the kneeling legs, two legs; y = floor
  ST.lowDesk = (ctx, x, y, w, h, seed) => {
    ST.rect(ctx, x - w / 2, y - h, w, 22, WOOD, { seed, lw: 6, light: ['#6b5440', 0, -6] });
    ST.rect(ctx, x - w / 2 + 16, y - h + 20, w - 32, h - 34, '#3f3024', { seed: seed + 1, lw: 5, hatch: { c: 'rgba(10,6,2,0.45)', n: 4, len: 50, gap: 6, k: 2, ang: 0, bend: 0.02 } }); // front board
    [-1, 1].forEach((s) => ST.rect(ctx, x + s * (w / 2 - 30) - 14, y - h + 20, 28, h - 20, WOOD_D, { seed: seed + 2 + s, lw: 5 }));
    ST.stain(ctx, x - w * 0.2, y - h + 10, 60, 14, seed + 5, 'rgba(10,8,6,0.45)');
  };
  // a stack of documents (lop-sided), bottom centre (x, y)
  ST.papers = (ctx, x, y, w, n, seed) => {
    for (let i = 0; i < n; i++) {
      const dx = ST.rnd(-10, 10, seed, i), yy = y - i * 9;
      ST.rough(ctx, [x - w / 2 + dx, yy, x + w / 2 + dx, yy - ST.rnd(-3, 3, seed, i, 1), x + w / 2 + dx + 3, yy - 9, x - w / 2 + dx + 2, yy - 10], i % 3 === 1 ? '#9d9274' : '#b1a888', { seed: seed + i, lw: 3, amp: 0.8 });
    }
    ST.stroke(ctx, [x - w * 0.3, y - n * 9 + 2, x + w * 0.2, y - n * 9 + 4], { w: 7, color: C.RUST_D, seed: seed + 50, taper: false }); // tie cord
  };
  // a sparrow on a bare branch (the thing you would rather be looking at); hop = 0/1 on twos
  ST.sparrow = (ctx, x, y, hop, seed) => {
    ST.stroke(ctx, [x - 140, y + 14, x - 40, y + 10, x + 60, y + 18, x + 120, y + 6], { w: 9, color: WOOD_D, seed, taper: false });
    const by = y - (hop ? 14 : 0);
    ST.blob(ctx, [x - 30, by, x - 22, by - 22, x + 6, by - 30, x + 24, by - 18, x + 20, by, x - 4, by + 6], '#6e5a42', { lw: 4, seed: seed + 1, shade: ['#4e3f2e', -4, 3], hatch: { c: 'rgba(30,20,10,0.5)', n: 2, len: 10, gap: 3, k: 3, ang: 30 } });
    ST.blob(ctx, [x - 30, by - 4, x - 54, by - 14, x - 50, by + 2], '#4e3f2e', { lw: 3, seed: seed + 2 });
    ST.blob(ctx, [x + 22, by - 20, x + 34, by - 16, x + 22, by - 12], C.MUSTARD_D, { lw: 2.5, seed: seed + 3 });
    ctx.fillStyle = C.INK;
    ctx.fillRect(x + 12, by - 22, 4, 4);
    if (!hop) [[-4, 6], [6, 6]].forEach(([dx, dy], i) => ST.stroke(ctx, [x + dx, by + dy - 2, x + dx + 2, y + 10], { w: 2.5, seed: seed + 4 + i, taper: false }));
  };
})();

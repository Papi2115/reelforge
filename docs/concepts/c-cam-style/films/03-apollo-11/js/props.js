/* Apollo props - shared drawing code for held objects and suit hardware only (no characters): helmet bubble, thumbs-up
   hand, flight checklist, coffee mug, sandwich, toy bear, modern phone, control stick, sweat drops, gum bubble, and a
   placement helper (the body-space hand target that lands on a given world point). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const DEG = [0, 45, 90, 180];
  ST.GLOVE = '#9f9a84';
  ST.GLOVE_D = '#76725f';

  // bubble helmet in head space: clear shell (flat light crescent, ink rim), optional gold visor pulled down
  ST.helmet = (ctx, cx, cy, rx, ry, o) => {
    o = o || {};
    const ring = ST.ellipseRing(cx, cy, rx, ry, 16);
    if (o.visor) {
      const vx = o.vx || 0;
      ST.blob(ctx, [cx - rx * 0.86 + vx, cy - ry * 0.5, cx + vx, cy - ry * 0.98, cx + rx * 0.86 + vx, cy - ry * 0.5, cx + rx * 0.8 + vx, cy + ry * 0.08, cx + vx, cy + ry * 0.2, cx - rx * 0.8 + vx, cy + ry * 0.08], C.GOLD, { lw: 6, seed: (o.seed || 5) + 2, shade: [C.GOLD_D, -14, 10], light: ['rgba(240,220,160,0.45)', 10, -12], hatch: { c: 'rgba(60,40,10,0.35)', n: 3, len: 30, gap: 7, k: 2, ang: -30 } });
    }
    ST.path(ctx, ST.curve(ring, true, 6), true);
    ctx.fillStyle = 'rgba(190,200,190,0.10)';
    ctx.fill();
    ST.blob(ctx, [cx - rx * 0.72, cy - ry * 0.55, cx - rx * 0.4, cy - ry * 0.86, cx - rx * 0.2, cy - ry * 0.8, cx - rx * 0.52, cy - ry * 0.4], 'rgba(235,232,210,0.38)', { lw: 0, seed: (o.seed || 5) + 1 });
    ST.inkLine(ctx, ST.curve(ring, true, 6), { w: 6, closed: true, seed: o.seed || 5 });
  };

  // a gloved (or bare) fist with the thumb up, wrist at (x, y) under it (the forearm points up), thumb to screen-up
  ST.thumbsUp = (ctx, x, y, sz, col, colD, seed) => {
    ST.blob(ctx, [x - sz * 0.5, y - sz * 0.92, x + sz * 0.46, y - sz * 0.96, x + sz * 0.5, y - sz * 0.1, x + sz * 0.1, y + sz * 0.12, x - sz * 0.46, y - sz * 0.08], col, { lw: 6, seed, shade: [colD, sz * 0.14, 4] });
    for (let i = 0; i < 3; i++) ST.stroke(ctx, [x + sz * 0.1, y - sz * (0.7 - i * 0.22), x + sz * 0.48, y - sz * (0.72 - i * 0.22)], { w: 3.5, seed: seed + 2 + i });
    ST.tube(ctx, [x - sz * 0.22, y - sz * 0.8, x - sz * 0.24, y - sz * 1.22, x - sz * 0.16, y - sz * 1.5], [sz * 0.36, sz * 0.32, sz * 0.27], col, { lw: 6, seed: seed + 6, shade: [colD, -4, 0] });
  };

  // flight checklist: ring-bound card book. page in [0,1) = a page mid-flip (0 = flat). Centre (x, y), size w.
  ST.checklist = (ctx, x, y, w, page, seed) => {
    const h = w * 0.7, hw = w / 2;
    ST.rect(ctx, x - hw - 6, y - h / 2 - 6, w + 12, h + 12, C.OLIVE_D, { seed, lw: 6 });
    ST.rect(ctx, x - hw, y - h / 2, hw - 3, h, '#bdb393', { seed: seed + 1, lw: 4, hatch: { c: 'rgba(40,34,20,0.5)', n: 4, len: hw * 0.6, gap: 9, k: 3, ang: 0, bend: 0 } });
    ST.rect(ctx, x + 3, y - h / 2, hw - 3, h, '#bdb393', { seed: seed + 2, lw: 4, hatch: { c: 'rgba(40,34,20,0.5)', n: 4, len: hw * 0.6, gap: 9, k: 3, ang: 0, bend: 0 } });
    ST.rect(ctx, x + hw - 2, y - h * 0.38, 16, h * 0.18, C.MUSTARD, { seed: seed + 3, lw: 3 }); // index tab
    if (page > 0.02) {
      const ex = x + hw * Math.cos(page * Math.PI), lift = Math.sin(page * Math.PI) * h * 0.18;
      ST.blob(ctx, [x, y - h / 2, ex, y - h / 2 - lift, ex, y + h / 2 - lift, x, y + h / 2], '#cfc6a6', { sharp: true, lw: 4, seed: seed + 4, shade: ['rgba(80,70,40,0.4)', page < 0.5 ? -10 : 10, 0] });
    }
    for (let i = 0; i < 4; i++) ST.blob(ctx, ST.ellipseRing(x, y - h * 0.36 + i * h * 0.24, 5, 9, 6), C.STONE_D, { lw: 3, seed: seed + 5 + i });
  };

  // coffee mug gripped at (x, y); tilt in degrees (toward the drinker); steam unless sipping
  ST.mug = (ctx, x, y, tilt, seed, steam) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((tilt * Math.PI) / 180);
    ST.tube(ctx, [30, -26, 50, -10, 30, 12], [12, 12, 12], C.MUSTARD_D, { lw: 5, seed: seed + 1 });
    ST.blob(ctx, [-30, -44, 32, -44, 30, 30, 0, 36, -28, 30], C.MUSTARD, { sharp: true, lw: 6, seed, shade: [C.MUSTARD_D, -10, 0], mottle: ['rgba(60,40,10,0.3)', 2, 8] });
    ST.blob(ctx, ST.ellipseRing(1, -44, 31, 8, 10), '#2e2014', { lw: 5, seed: seed + 2 });
    ctx.restore();
    if (steam) [0, 1].forEach((i) => ST.stroke(ctx, [x - 8 + i * 16, y - 60, x + 4 + i * 16 + steam * 8, y - 92, x - 6 + i * 16, y - 126], { w: 3, color: 'rgba(200,195,170,0.6)', seed: seed + 3 + i }));
  };

  // sandwich (two bread slices, a lettuce edge), bite = a bite taken out of the right corner
  ST.sandwich = (ctx, x, y, rot, seed, bite) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot * Math.PI) / 180);
    const corner = bite ? [40, -6, 30, 4, 34, 14] : [46, 12];
    ST.blob(ctx, [-46, 12, -44, 26, 44, 28].concat(corner), '#b39a62', { sharp: true, lw: 5, seed: seed + 1, shade: ['#8a7344', -6, 4] });
    ST.stroke(ctx, [-46, 8, -20, 14, 6, 6, 30, 14], { w: 8, color: C.OLIVE, seed: seed + 2, taper: false });
    ST.blob(ctx, [-48, 6, -40, -14, 0, -20, 40, -14, 46, 6].concat(bite ? [32, 8, 26, -2] : []), '#b9a068', { lw: 6, seed, shade: ['#8a7344', -8, 6], mottle: ['rgba(90,60,20,0.35)', 3, 6] });
    ctx.restore();
  };

  // a small worn toy bear (button eyes, a patched ear); floats and turns in weightlessness
  ST.toyBear = (ctx, x, y, k, rot, seed) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(k, k);
    [[-30, 30], [30, 30]].forEach(([a, b], i) => ST.blob(ctx, ST.ellipseRing(a, b + 34, 14, 18, 8), C.FUR, { lw: 5, seed: seed + i }));
    ST.blob(ctx, ST.ellipseRing(0, 40, 32, 38, 10), C.FUR, { lw: 6, seed: seed + 2, shade: [C.FUR_D, -8, 6], patch: ['#8a7058', 0, 8, 0.45] });
    [[-26, -36], [26, -36]].forEach(([a, b], i) => ST.blob(ctx, ST.ellipseRing(a, b, 13, 13, 8), i ? C.MUSTARD_D : C.FUR, { lw: 5, seed: seed + 3 + i }));
    ST.blob(ctx, ST.ellipseRing(0, -10, 32, 30, 10), C.FUR, { lw: 6, seed: seed + 5, shade: [C.FUR_D, -8, 6] });
    ST.blob(ctx, ST.ellipseRing(0, 0, 13, 10, 8), '#8a7058', { lw: 4, seed: seed + 6 });
    ctx.fillStyle = C.INK;
    [[-12, -18], [12, -18], [0, -4]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 4.5, 0, Math.PI * 2); ctx.fill(); });
    ST.stroke(ctx, [-20, 40, -8, 44, 2, 36], { w: 3, seed: seed + 7 }); // a stitched tear
    ctx.restore();
  };

  // a modern phone, for comparison only: black slab, a grid of flat app tiles
  ST.phone = (ctx, x, y, k, seed) => {
    const w = 150 * k, h = 300 * k;
    ST.rect(ctx, x - w / 2, y - h / 2, w, h, '#1f1d1b', { seed, lw: 6, amp: 1 });
    ST.rect(ctx, x - w / 2 + 10 * k, y - h / 2 + 22 * k, w - 20 * k, h - 44 * k, '#3a4a50', { seed: seed + 1, lw: 3, amp: 1 });
    const tiles = [C.MUSTARD, C.GREYBLUE, C.OLIVE, C.CLAY, C.PLUM, C.LINEN_D];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      ctx.fillStyle = tiles[(r * 3 + c + seed) % tiles.length];
      ctx.fillRect(x - w / 2 + 22 * k + c * 38 * k, y - h / 2 + 40 * k + r * 44 * k, 26 * k, 26 * k);
    }
  };

  // control stick: fixed base, the grip ends at the palm (so the hand closes over it)
  ST.controlStick = (ctx, base, grip, seed) => {
    ST.tube(ctx, [base[0], base[1], grip[0], grip[1] + 30], [22, 16], C.STONE_D, { lw: 5, seed });
    ST.blob(ctx, [grip[0] - 18, grip[1] - 34, grip[0] + 18, grip[1] - 34, grip[0] + 22, grip[1] + 34, grip[0] - 22, grip[1] + 34], C.BLACK, { lw: 5, seed: seed + 1, hatch: { c: 'rgba(120,110,90,0.4)', n: 2, len: 20, gap: 6, k: 3, ang: 0, bend: 0 } });
    ST.blob(ctx, ST.ellipseRing(base[0], base[1], 46, 16, 10), C.BLACK_D, { lw: 5, seed: seed + 2 });
  };

  // sweat drops (head space): each spawn point drips down and restarts, on twos
  ST.sweat = (ctx, pts, t, seed) => {
    const tt = ST.twos(t);
    pts.forEach(([x, y], i) => {
      const ph = (tt * 0.9 + ST.hash(seed, i)) % 1, dy = ph * 24, r = 4 + 1.5 * ST.hash(seed, i, 2);
      ST.blob(ctx, [x, y + dy - r * 2.2, x + r, y + dy, x, y + dy + r, x - r, y + dy], '#c4c6b4', { lw: 3, seed: seed + i, light: ['rgba(255,255,240,0.5)', 2, -2] });
    });
  };

  // gum bubble at the lips: dull rose, flat highlight, ink rim. r = 0 nothing
  ST.gumBubble = (ctx, x, y, r, seed) => {
    if (r < 2) return;
    ST.blob(ctx, ST.ellipseRing(x + r * 0.15, y, r, r * 0.94, 14), '#9c5d63', { lw: 6, seed, shade: ['#7a434a', -r * 0.2, r * 0.2], light: ['rgba(230,200,190,0.35)', r * 0.25, -r * 0.25] });
  };

  // body-space hand target that projects onto world point (wx, wy). free = the coordinate the view cannot see:
  // body z for front/back, body x for 3/4 and profile.
  ST.reachTo = (p, wx, wy, free) => {
    const V = ST.view(p.yaw || 0), a = (DEG[V.v] * Math.PI) / 180, fx = ((wx - p.x) / p.s) * (V.mir ? -1 : 1), fy = (wy - p.y) / p.s;
    if (V.v === 0 || V.v === 3) { const x = (V.v === 0 ? fx : -fx) * (V.mir ? -1 : 1); return [x, fy, free]; }
    const x = V.mir ? -free : free;
    return [free, fy, (fx - x * Math.cos(a)) / Math.sin(a)];
  };
})();

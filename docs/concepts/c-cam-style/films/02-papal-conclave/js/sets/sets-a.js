/* Sets A - Viterbo outside: the town of towers in silhouette, the papal palace (grey stone, crenellations, a loggia of
   arches, the big door), the bell tower with the funeral bell, the title poster. World units = 1920x1080 at zoom 1.
   Grime as flat shapes only; one warm light per set. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;

  // Viterbo skyline: low roofs broken by tall thin family towers
  ST.towers = (ctx, base, col, seed) => {
    const pts = [-400, base];
    let x = -400;
    for (let i = 0; x < 2400; i++) {
      const w = 70 + ST.hash(seed, i) * 110, h = 60 + ST.hash(seed, i, 1) * 90;
      pts.push(x, base - h + 30);
      if (ST.hash(seed, i, 2) < 0.35) { // a tower with crenels
        const tx = x + w * 0.2, th = 240 + ST.hash(seed, i, 3) * 220, tw = 44 + ST.hash(seed, i, 4) * 26, c = base - th;
        pts.push(tx, base - h + 30, tx, c - 14, tx + tw * 0.25, c - 14, tx + tw * 0.25, c, tx + tw * 0.5, c, tx + tw * 0.5, c - 14, tx + tw * 0.75, c - 14, tx + tw * 0.75, c, tx + tw, c, tx + tw, c - 14, tx + tw + 8, c - 14, tx + tw + 8, base - h + 30);
      } else pts.push(x + w * 0.5, base - h);
      pts.push(x + w, base - h + 30);
      x += w;
    }
    pts.push(2400, base);
    ST.blob(ctx, pts, col, { sharp: true, lw: 5, seed });
  };

  // big arched door; state: 'open' (dark mouth) | 'shut' | 'planked' (shut + plank nailed across); drape = funeral cloth
  ST.palaceDoor = (ctx, x, base, w, h, o) => {
    const top = base - h, arch = [x - w / 2, base, x - w / 2, top + w * 0.4, x - w * 0.3, top + w * 0.1, x, top, x + w * 0.3, top + w * 0.1, x + w / 2, top + w * 0.4, x + w / 2, base];
    ST.blob(ctx, arch.map((v, i) => (i % 2 ? v - (v < base ? 26 : 0) : v + (v - x) * 0.22)), C.STONE_D, { lw: 6, seed: o.seed + 1, hatch: { c: 'rgba(20,18,12,0.5)', n: 5, len: 30, gap: 7, k: 3, ang: 60 } });
    if (o.state === 'open') return ST.blob(ctx, arch, '#1c1915', { lw: 7, seed: o.seed + 2 });
    ST.blob(ctx, arch, '#3e2e20', { lw: 7, seed: o.seed + 2, hatch: { c: 'rgba(10,6,2,0.55)', n: 6, len: h * 0.5, gap: 10, k: 2, ang: 90, bend: 0 } });
    ST.stroke(ctx, [x, top + 6, x, base], { w: 6, seed: o.seed + 3, taper: false });
    [0.35, 0.7].forEach((k, i) => ST.stroke(ctx, [x - w / 2 + 6, top + h * k, x + w / 2 - 6, top + h * k + 3], { w: 8, color: '#2a2622', seed: o.seed + 4 + i, taper: false }));
    for (let i = 0; i < 10; i++) ST.blob(ctx, ST.ellipseRing(x - w / 2 + 18 + (i % 5) * ((w - 36) / 4), top + h * (i < 5 ? 0.35 : 0.7), 5, 5, 6), '#55524b', { lw: 2, seed: o.seed + 6 + i });
    ST.blob(ctx, [x + 26, base - h * 0.5 - 16, x + 38, base - h * 0.5 - 16, x + 34, base - h * 0.5 + 12, x + 30, base - h * 0.5 + 12], C.INK, { lw: 0, seed: o.seed + 16 }); // keyhole
    if (o.state === 'planked') [-0.1, 0.12].forEach((r, i) => ST.plank(ctx, x, base - h * (0.42 - i * 0.24), r, o.seed + 20 + i));
    if (o.drape) ST.blob(ctx, [x - w * 0.62, top - 30, x + w * 0.62, top - 30, x + w * 0.5, top + 40, x + w * 0.2, top + 10, x, top + 60, x - w * 0.2, top + 10, x - w * 0.5, top + 40], C.BLACK, { lw: 6, seed: o.seed + 30, shade: [C.BLACK_D, 0, 6] });
  };

  // the papal palace: grey stone block, crenellations, gothic windows, a loggia on the right, the big door
  ST.palace = (ctx, x, base, w, h, o) => {
    const top = base - h, seed = o.seed || 300;
    const outline = [x, base, x, top - 34];
    for (let i = 0; i < 12; i++) { const b = x + (w * (i + 1)) / 12; outline.push(b, i % 2 ? top : top - 34, b, i % 2 ? top - 34 : top); }
    outline.push(x + w, base);
    ST.rough(ctx, outline, '#77736a', { seed, lw: 7, amp: 4, shade: ['rgba(0,0,0,0.2)', -30, 0], mottle: ['rgba(60,56,40,0.25)', 8, 50], hatch: { c: 'rgba(25,24,18,0.35)', n: 10, len: 46, gap: 8, k: 3, ang: 80 } });
    ST.bricks(ctx, x, top, w, h, { bh: 34, bw: 90, seed: seed + 1, tone: 'rgba(0,0,0,0.12)', density: 0.2 });
    for (let i = 0; i < 6; i++) ST.stain(ctx, x + w * ST.rnd(0.05, 0.95, seed, i), top + h * ST.rnd(0.2, 0.8, seed, i, 1), 80, 60, seed + 10 + i, 'rgba(40,36,20,0.22)');
    ST.rough(ctx, [x, base, x + w, base, x + w, base - 90, x, base - 90], 'rgba(40,32,18,0.28)', { seed: seed + 20, lw: 0 }); // splash grime
    [0.16, 0.36].forEach((k, i) => { // gothic windows
      const wx = x + w * k, wy = top + h * 0.22;
      ST.rough(ctx, [wx - 34, wy + 130, wx - 34, wy + 30, wx, wy, wx + 34, wy + 30, wx + 34, wy + 130], '#24221e', { seed: seed + 30 + i, lw: 6, amp: 1.5 });
      ST.stroke(ctx, [wx, wy + 8, wx, wy + 130], { w: 5, color: '#55524b', seed: seed + 32 + i, taper: false });
    });
    const lx = x + w * 0.62, lw = w * 0.34; // loggia: a row of arches on slim columns
    ST.rough(ctx, [lx, top + h * 0.12, lx + lw, top + h * 0.12, lx + lw, top + h * 0.5, lx, top + h * 0.5], '#2c2a25', { seed: seed + 40, lw: 6 });
    for (let i = 0; i < 4; i++) {
      const ax = lx + (lw * (i + 0.5)) / 4, aw = lw / 8;
      ST.blob(ctx, [ax - aw * 1.1, top + h * 0.5, ax - aw * 1.1, top + h * 0.24, ax, top + h * 0.17, ax + aw * 1.1, top + h * 0.24, ax + aw * 1.1, top + h * 0.5, ax + aw * 0.8, top + h * 0.5, ax + aw * 0.8, top + h * 0.26, ax, top + h * 0.21, ax - aw * 0.8, top + h * 0.26, ax - aw * 0.8, top + h * 0.5], '#8a857a', { sharp: true, lw: 4, seed: seed + 41 + i });
    }
    ST.peel(ctx, x + w * 0.08, base - 220, 90, 60, seed + 50);
    ST.crack(ctx, x + w * 0.55, top + 60, 150, seed + 51);
    ST.palaceDoor(ctx, o.doorX || x + w * 0.5, base, 210, 300, { seed: seed + 60, state: o.door || 'shut', drape: o.drape });
  };

  // the bell tower with its bell swinging in the open belfry (swing in radians)
  ST.bellTower = (ctx, x, base, w, h, swing, seed) => {
    const top = base - h;
    ST.rough(ctx, [x, base, x, top, x + w * 0.2, top, x + w * 0.2, top - 26, x + w * 0.4, top - 26, x + w * 0.4, top, x + w * 0.6, top, x + w * 0.6, top - 26, x + w * 0.8, top - 26, x + w * 0.8, top, x + w, top, x + w, base], '#6e6a60', { seed, lw: 7, shade: ['rgba(0,0,0,0.22)', -20, 0], hatch: { c: 'rgba(25,24,18,0.35)', n: 8, len: 50, gap: 8, k: 3, ang: 80 } });
    ST.bricks(ctx, x, top, w, h, { bh: 30, bw: 60, seed: seed + 1, density: 0.2 });
    const bx = x + w / 2, by = top + 60;
    ST.rough(ctx, [bx - w * 0.32, top + 170, bx - w * 0.32, top + 50, bx, top + 24, bx + w * 0.32, top + 50, bx + w * 0.32, top + 170], '#1e1c18', { seed: seed + 2, lw: 6 });
    ST.beam(ctx, bx - w * 0.34, by, bx + w * 0.34, by, 12, seed + 3);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(swing);
    ST.blob(ctx, [-12, 4, -16, 30, -32, 70, -44, 96, 44, 96, 32, 70, 16, 30, 12, 4], C.GOLD, { lw: 6, seed: seed + 4, shade: [C.GOLD_D, -8, 6], light: ['#d9b45a', 6, -4] });
    ST.blob(ctx, ST.ellipseRing(0, 100, 9, 9, 6), C.INK, { lw: 0, seed: seed + 5 });
    ctx.restore();
    if (Math.abs(swing) > 0.25) [0, 1, 2].forEach((i) => ST.stroke(ctx, [bx + Math.sign(swing) * (70 + i * 16), by + 20 + i * 4, bx + Math.sign(swing) * (82 + i * 16), by + 60 + i * 2], { w: 5, color: C.INK, seed: seed + 6 + i, taper: false })); // the clang
  };

  // ---------- title: dusk over Viterbo, the town of towers ----------
  ST.setTitle = (ctx) => {
    ST.bands(ctx, -200, -200, 2200, 800, ['#33383d', '#474843', '#615b48', '#7f6c48', '#9c7c43'], 1.1);
    ST.pool(ctx, 980, 780, 720, 260, '#b98a3e', 0.18);
    ST.towers(ctx, 800, '#2c2925', 7);
    ST.rough(ctx, [560, 1100, 560, 640, 600, 640, 600, 610, 660, 610, 660, 640, 1260, 640, 1260, 610, 1320, 610, 1320, 640, 1360, 640, 1360, 1100], '#24211d', { seed: 21, lw: 5 }); // the palace in silhouette
    ST.window(ctx, 760, 760, 40, 54, 30, true);
    ST.rect(ctx, -200, 1000, 2400, 200, '#1c1a17', { seed: 31, lw: 0 });
  };

  // ---------- the street before the palace; o: { bell (swing), door, drape, night } ----------
  ST.setStreet = (ctx, t, o) => {
    o = o || {};
    ST.bands(ctx, -400, -300, 2700, 600, ['#4d565c', '#5f6460', '#76705c', '#8e7d58'], 3);
    ST.pool(ctx, 960, 560, 420, 200, '#d2a24e', 0.16);
    ST.towers(ctx, 600, '#4b4a45', 11);
    ST.palace(ctx, 420, 820, 1120, 560, { seed: 300, door: o.door, drape: o.drape, doorX: 760 });
    ST.bellTower(ctx, 1560, 820, 170, 760, o.bell || 0, 340);
    ST.house(ctx, -420, 840, 520, 470, { seed: 50, lean: -16, roof: 190, floors: 2 });
    ST.house(ctx, 1760, 840, 560, 480, { seed: 80, lean: 14, roof: 200, floors: 2, plaster: '#7c7357' });
    ST.cobbles(ctx, -400, 820, 2700, 1700, 97, '#6a6252', '#433d31'); // deep enough for low angles
    ST.puddle(ctx, 1320, 1020, 130, 99, '#6f7268');
    ST.stain(ctx, 300, 1040, 220, 40, 100, 'rgba(50,38,20,0.35)');
    ST.flies(ctx, 320, 1000, t, 101);
  };
})();

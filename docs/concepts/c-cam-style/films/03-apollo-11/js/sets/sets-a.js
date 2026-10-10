/* Sets A - title poster (the Moon rising over a lunar ridge) and the white room at the top of the launch tower.
   World units = 1920x1080 frame at zoom 1. One warm light per set, grime as flat shapes. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, M = ST.MOON;

  // big moon disc: grey with flat dark maria, a few craters, the shadow side as a flat crescent
  ST.moonDisc = (ctx, x, y, r, seed) => {
    const ring = ST.ellipseRing(x, y, r, r, 24);
    ST.blob(ctx, ring, '#9b968a', { lw: 8, seed, shade: ['#6d695f', -r * 0.16, r * 0.04] });
    ctx.save();
    ST.path(ctx, ST.curve(ring, true, 8), true);
    ctx.clip();
    [[-0.3, -0.35, 0.32], [0.2, -0.1, 0.24], [-0.05, 0.3, 0.2], [0.42, 0.35, 0.14]].forEach(([a, b, s], i) => ST.blob(ctx, ST.wobble(ST.ellipseRing(x + a * r, y + b * r, s * r * 1.3, s * r, 10), s * r * 0.15, seed + i, 40), '#77736a', { lw: 0, seed: seed + 5 + i }));
    for (let i = 0; i < 9; i++) ST.blob(ctx, ST.ellipseRing(x + ST.rnd(-0.8, 0.8, seed, i) * r, y + ST.rnd(-0.8, 0.8, seed, i, 1) * r, 14 + 30 * ST.hash(seed, i, 2), 12 + 26 * ST.hash(seed, i, 2), 9), '#7c776d', { lw: 3, seed: seed + 20 + i, shade: ['#5c584f', -8, -3], light: ['#b3ad9f', 5, 4] });
    ST.hatch(ctx, { x0: x - r, y0: y - r, w: r * 2, h: r * 2 }, { c: 'rgba(40,38,32,0.3)', n: 14, len: 60, gap: 9, k: 3, ang: 70 }, seed + 40);
    ctx.restore();
  };

  ST.setTitle = (ctx, t) => {
    ST.bands(ctx, -200, -200, 2200, 1100, ['#121419', '#171a1f', '#1c2025', '#22262a'], 2.1);
    ST.stars(ctx, -200, -200, 2400, 1100, 120, 11);
    ST.pool(ctx, 1500, 420, 520, 420, '#c98f3e', 0.07);
    ST.moonDisc(ctx, 1500, 470, 360, 12);
    ST.earth(ctx, 170, 470, 56, 13);
    ST.moonGround(ctx, -200, 840, 2200, 1200, 14, { craters: 10, scale: 0.6 });
    ST.lander(ctx, 1640, 880, 0.32, 15);
  };

  // white room at the top of the launch tower: dirty panelled walls, the capsule hull with its hatch open on the
  // right, a window onto the steel tower and a dawn sky, one warm work lamp, floor grating
  ST.setPad = (ctx, t) => {
    ST.rect(ctx, -300, -200, 2500, 1400, '#958d72', { seed: 20, lw: 0, mottle: ['rgba(60,50,30,0.25)', 10, 90] });
    for (let i = 0; i < 6; i++) ST.metalPanel(ctx, -260 + i * 300, 60, 290, 700, 21 + i, '#a39b7e');
    // window: dawn bands, the rust-red tower truss, a sliver of sea
    ST.rect(ctx, 120, 150, 520, 360, '#20201c', { seed: 30, lw: 9 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(128, 158, 504, 344);
    ctx.clip();
    ST.bands(ctx, 120, 150, 640, 510, ['#4a4e52', '#6f6b5c', '#9a835a', '#b58d4c'], 1.3);
    ST.rect(ctx, 120, 440, 520, 70, '#3c4a4c', { seed: 31, lw: 0 });
    [[180, 160, 210, 520], [560, 160, 590, 520]].forEach(([a, b, c, d], i) => ST.beam(ctx, (a + c) / 2, b, (a + c) / 2, d, 26, 32 + i, C.RUST));
    for (let k = 0; k < 2; k++) { ST.beam(ctx, 195, 170 + k * 170, 575, 330 + k * 170, 14, 40 + k, C.RUST_D); ST.beam(ctx, 575, 170 + k * 170, 195, 330 + k * 170, 14, 44 + k, C.RUST_D); }
    ctx.restore();
    ST.stroke(ctx, [380, 154, 380, 506], { w: 8, seed: 34, taper: false });
    // stencils and a sign
    ST.rect(ctx, 760, 210, 260, 90, '#c9bf9c', { seed: 35, lw: 5 });
    ST.label(ctx, 'NO SMOKING', 890, 255, { size: 40, fill: C.RUST_D, rot: -1 });
    ST.stain(ctx, 900, 420, 160, 90, 36, 'rgba(60,50,20,0.3)');
    // capsule hull on the right with the open hatch
    ST.blob(ctx, [1280, -200, 2200, -200, 2200, 1200, 1420, 1200, 1340, 700, 1300, 300], '#8e8a7b', { lw: 8, seed: 37, shade: ['#66635a', -40, 0], hatch: { c: 'rgba(30,28,24,0.45)', n: 10, len: 60, gap: 9, k: 3, ang: 75 } });
    ST.rect(ctx, 1460, 220, 420, 460, '#1d1c1a', { seed: 38, lw: 10 });
    ST.rect(ctx, 1500, 520, 360, 120, '#3a3730', { seed: 39, lw: 5 }); // couch edge inside
    ctx.fillStyle = 'rgba(25,24,20,0.7)';
    for (let i = 0; i < 9; i++) { ctx.fillRect(1440 + i * 50, 196, 7, 7); ctx.fillRect(1440 + i * 50, 700, 7, 7); }
    ST.stroke(ctx, [1360, 760, 1420, 820, 1400, 900], { w: 4, seed: 40 });
    // floor grating, the lamp and its pool
    ST.rect(ctx, -300, 860, 2500, 400, '#4f4b40', { seed: 41, lw: 6 });
    ST.bricks(ctx, -300, 860, 2500, 300, { bh: 30, bw: 30, seed: 42, line: 'rgba(15,12,8,0.6)', density: 0.05 });
    ST.pool(ctx, 760, 520, 620, 420, C.FIRE, 0.08);
    ST.beam(ctx, 760, -200, 760, 70, 10, 43, C.BLACK);
    ST.blob(ctx, [700, 70, 820, 70, 800, 120, 720, 120], C.BLACK, { lw: 5, seed: 44 });
    ST.blob(ctx, ST.ellipseRing(760, 122, 40, 9, 10), C.FIRE, { lw: 4, seed: 45 });
  };
})();

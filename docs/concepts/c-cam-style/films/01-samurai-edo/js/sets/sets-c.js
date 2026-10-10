/* Sets C - the rice market (stalls and the price board), the merchant's shop inside (lamp-lit counting room) and
   the shop front outside. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;

  // ---------- market: canvas awnings over stalls, baskets of rice, a crowd line; the price board is drawn by the shot ----------
  ST.setMarket = (ctx, t) => {
    ST.bands(ctx, -400, -300, 2400, 420, ['#78857f', '#8f9584', '#a79e7d'], 7.2);
    ST.pool(ctx, 1600, 160, 460, 260, '#e3c27a', 0.2);
    for (let i = 0; i < 5; i++) ST.roof(ctx, -460 + i * 560, -460 + i * 560 + 480, 260 + ST.rnd(-14, 14, 300, i), 64, 301 + i, { col: '#46484a', over: 16 });
    ST.planks(ctx, -400, 270, 2400, 820, 306, '#4e3c2b');
    const stalls = [[-260, C.OLIVE], [1380, C.CLAY]];
    stalls.forEach(([x, col], i) => {
      ST.beam(ctx, x, 820, x, 430, 22, 310 + i);
      ST.beam(ctx, x + 520, 820, x + 520, 430, 22, 312 + i);
      ST.blob(ctx, [x - 40, 430, x + 560, 430, x + 580, 500, x + 260, 520, x - 60, 500], col, { lw: 6, seed: 314 + i, shade: ['rgba(0,0,0,0.25)', 0, 10], hatch: { c: 'rgba(14,10,6,0.4)', n: 6, len: 40, gap: 8, k: 3, ang: 80, bend: 0.02 } });
      ST.rect(ctx, x - 10, 700, 540, 40, '#5a4632', { seed: 316 + i, lw: 6 });
      for (let k = 0; k < 4; k++) {
        const bx = x + 50 + k * 130;
        ST.blob(ctx, [bx - 56, 700, bx - 46, 640, bx + 46, 640, bx + 56, 700], '#6c5a3c', { lw: 5, seed: 320 + i * 4 + k, hatch: { c: 'rgba(30,20,10,0.5)', n: 3, len: 20, gap: 5, k: 3, ang: 20 } });
        ST.blob(ctx, [bx - 44, 642, bx - 20, 616, bx + 22, 614, bx + 44, 642], '#b4ab8c', { lw: 4, seed: 330 + i * 4 + k, mottle: ['rgba(90,80,50,0.3)', 3, 6] });
      }
    });
    ST.dirt(ctx, -400, 820, 2400, 1200, 340);
    ST.stain(ctx, 300, 940, 300, 50, 341, 'rgba(30,20,10,0.35)');
    ST.flies(ctx, 140, 640, t, 342);
  };
  // the price board: a framed sign "RICE" with one flipping panel (up arrow / down arrow); flip 0..1 = mid-turn
  ST.priceBoard = (ctx, x, y, up, flip, seed) => {
    ST.beam(ctx, x - 150, y + 420, x - 150, y - 40, 24, seed);
    ST.beam(ctx, x + 150, y + 420, x + 150, y - 40, 24, seed + 1);
    ST.rect(ctx, x - 190, y - 60, 380, 330, '#5a4632', { seed: seed + 2, lw: 7, hatch: { c: 'rgba(14,10,6,0.4)', n: 4, len: 60, gap: 8, k: 2, ang: 90, bend: 0 } });
    ST.rect(ctx, x - 170, y - 44, 340, 80, '#a59a7c', { seed: seed + 3, lw: 5 });
    ST.label(ctx, 'RICE', x, y - 2, { size: 64, fill: C.INK });
    const k = Math.abs(Math.cos(flip * Math.PI)), h = 180 * Math.max(0.08, k);
    ST.rect(ctx, x - 130, y + 150 - h / 2, 260, h, '#a59a7c', { seed: seed + 4, lw: 5 });
    if (k > 0.3) {
      const d = up ? -1 : 1, cy = y + 150, hh = (h / 2) * 0.7;
      ST.blob(ctx, [x - 70, cy - d * hh * 0.1, x, cy + d * hh, x + 70, cy - d * hh * 0.1, x + 30, cy - d * hh * 0.1, x + 30, cy - d * hh, x - 30, cy - d * hh, x - 30, cy - d * hh * 0.1], up ? C.OLIVE : C.RUST, { sharp: true, lw: 5, seed: seed + 5 });
    }
    ST.stain(ctx, x + 90, y + 220, 70, 40, seed + 6, 'rgba(30,20,10,0.4)');
  };

  // ---------- the merchant's counting room: raised tatami, account books on hooks, the desk, a paper lamp ----------
  ST.setShop = (ctx, t) => {
    ST.planks(ctx, -400, -300, 2400, 560, 400, '#3e2f22');
    ST.pool(ctx, 1660, 520, 640, 420, '#e0a443', 0.12);
    // account books hanging in a row on a rail, fat and well thumbed
    ST.beam(ctx, 300, 120, 1300, 120, 14, 401);
    for (let i = 0; i < 9; i++) {
      const x = 330 + i * 106, h = 180 + ST.rnd(-20, 30, 402, i);
      ST.stroke(ctx, [x + 40, 120, x + 40, 140], { w: 4, seed: 403 + i, taper: false });
      ST.rect(ctx, x + 6, 140, 70, h, i % 3 === 0 ? '#7c6c48' : '#8f8160', { seed: 404 + i, lw: 5, amp: 1, hatch: { c: 'rgba(40,30,12,0.4)', n: 2, len: 30, gap: 5, k: 3, ang: 0, bend: 0 } });
    }
    ST.rect(ctx, 1640, 80, 360, 300, '#2b241c', { seed: 420, lw: 6 });
    ST.shoji(ctx, 1660, 100, 320, 260, 421, { lit: true });
    // raised floor edge and its tatami, the low counting desk with the screen
    ST.tatami(ctx, -400, 2400, 560, 780, 422);
    ST.rect(ctx, -400, 770, 2800, 50, '#3a2b1e', { seed: 423, lw: 6, light: ['#5a4632', 0, -8] });
    ST.lattice(ctx, 1260, 470, 300, 150, 424);
    ST.rect(ctx, 1230, 610, 360, 70, '#4e3b2b', { seed: 425, lw: 6 });
    ST.abacus(ctx, 1410, 600, 220, -4, 426, Math.floor(ST.twos(t) * 3));
    ST.papers(ctx, 1300, 604, 110, 4, 427);
    // the paper lamp (andon) on the floor: the one warm light
    ST.rough(ctx, [1600, 780, 1610, 600, 1720, 600, 1730, 780], C.FIRE, { seed: 430, lw: 6, shade: [C.FIRE_D, -10, 0], mottle: ['rgba(140,80,30,0.25)', 3, 20] });
    [1612, 1664, 1716].forEach((x, i) => ST.stroke(ctx, [x, 602, x + (i - 1) * 4, 778], { w: 6, color: C.BLACK, seed: 432 + i, taper: false }));
    ST.stroke(ctx, [1606, 690, 1724, 690], { w: 5, color: C.BLACK, seed: 435, taper: false });
    ST.rect(ctx, 1590, 590, 150, 20, C.BLACK, { seed: 431, lw: 4 });
    // earthen floor of the entrance, where customers stand
    ST.rect(ctx, -400, 820, 2800, 400, '#5a4c3a', { seed: 432, lw: 0, hatch: { c: 'rgba(30,22,12,0.4)', n: 14, len: 50, gap: 7, k: 3, ang: 4, bend: 0.05 } });
    ST.stain(ctx, 600, 960, 280, 60, 433, 'rgba(20,14,8,0.35)');
  };

  // ---------- shop front outside: lattice, noren with the rice-bale mark, a hanging sign, the street ----------
  ST.setShopFront = (ctx, t) => {
    ST.bands(ctx, -400, -300, 2400, 300, ['#76847f', '#8c9384', '#a39c7e'], 9.3);
    ST.pool(ctx, 500, 120, 420, 240, '#e3c27a', 0.2);
    ST.planks(ctx, -400, 160, 2400, 860, 450, '#4f3d2c');
    ST.roof(ctx, -400, 2400, 190, 90, 451, { col: '#45474a', moss: true });
    ST.lattice(ctx, -340, 380, 760, 420, 452);
    ST.lattice(ctx, 1640, 380, 660, 420, 453);
    ST.rect(ctx, 860, 240, 380, 120, '#2b241c', { seed: 454, lw: 6 });
    ST.label(ctx, 'RICE · LOANS', 1050, 300, { size: 52, fill: '#b9a676' });
    ST.rect(ctx, 600, 400, 960, 460, '#1d1814', { seed: 455, lw: 6 });
    ST.noren(ctx, 640, 400, 880, 230, C.GREYBLUE_D, 456, t, (cx, cy, r) => ST.bale(ctx, cx, cy, r * 1.3, r * 0.8, 457));
    ST.dirt(ctx, -400, 860, 2400, 1200, 460);
    ST.stain(ctx, 1200, 1000, 260, 50, 461, 'rgba(30,20,10,0.35)');
  };
})();

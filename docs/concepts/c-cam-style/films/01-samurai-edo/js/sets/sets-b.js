/* Sets B - the lord's office (desks, papers, the window with the sparrow), the town street (also the office gate),
   the rice storehouse yard. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;

  // ---------- office: plank walls, posts, a row of shoji, hanging duty boards, the open window on the right ----------
  ST.setOffice = (ctx, t) => {
    ST.planks(ctx, -400, -300, 2400, 780, 100, '#4a3a2a');
    ST.shoji(ctx, -300, 60, 1100, 560, 101, { torn: 0.06 });
    ST.pool(ctx, 1700, 380, 520, 420, '#d9b06a', 0.14);
    // the window: sky, a bare branch, the sparrow; you would rather be out there
    ST.bands(ctx, 1500, 80, 1940, 560, ['#7d8a86', '#949a88', '#a8a07e'], 1.2);
    ST.sparrow(ctx, 1730, 330, Math.floor(ST.twos(t) * 2.5) % 3 === 0 ? 1 : 0, 102);
    ST.rect(ctx, 1480, 60, 480, 30, '#36281d', { seed: 103, lw: 5 });
    ST.rect(ctx, 1480, 550, 480, 36, '#36281d', { seed: 104, lw: 5 });
    ST.shoji(ctx, 1930, 70, 240, 480, 105, { lit: true });
    [-360, 880, 1470, 2180].forEach((x, i) => ST.beam(ctx, x, -300, x, 790, 36, 106 + i));
    ST.beam(ctx, -400, 40, 2400, 40, 30, 111);
    // duty boards: wooden tags on a rail, ink strokes for names
    ST.beam(ctx, 930, 150, 1420, 150, 14, 112);
    for (let i = 0; i < 8; i++) {
      const x = 950 + i * 58, h = 120 + ST.rnd(-14, 14, 113, i);
      ST.rect(ctx, x, 160, 42, h, '#9a8a64', { seed: 114 + i, lw: 4, amp: 1 });
      ST.stroke(ctx, [x + 21, 180, x + 20, 160 + h * 0.6, x + 22, 160 + h - 20], { w: 5, seed: 124 + i });
    }
    ST.stain(ctx, 1100, 420, 260, 200, 132, 'rgba(30,22,10,0.35)');
    ST.tatami(ctx, -400, 2400, 770, 1200, 133);
  };

  // ---------- town street by day: row of shopfronts, roofs, noren, a barrel, the dirt road. o.gate: office gate ----------
  ST.setStreet = (ctx, t, o) => {
    o = o || {};
    ST.bands(ctx, -400, -300, 2400, 500, ['#76847f', '#8c9384', '#a39c7e'], 2.8);
    ST.pool(ctx, 300, 160, 420, 260, '#e3c27a', 0.2);
    for (let i = 0; i < 6; i++) ST.roof(ctx, -500 + i * 520, -500 + i * 520 + 440, 210 + ST.rnd(-20, 20, 140, i), 70, 141 + i, { col: '#4a4c4e', over: 20 });
    const fronts = [[-420, 380], [0, 560], [600, 460], [1100, 560], [1700, 600]];
    fronts.forEach(([x, w], i) => {
      ST.planks(ctx, x, 250, x + w, 860, 150 + i, i % 2 ? '#4f3d2c' : '#5a4632');
      if (i % 2 === 0) ST.lattice(ctx, x + 40, 450, w - 80, 300, 160 + i);
      ST.roof(ctx, x, x + w, 260, 60, 165 + i, { moss: i === 2 });
    });
    ST.noren(ctx, 1170, 420, 420, 260, C.GREYBLUE_D, 170, t, (cx, cy, r) => ST.stroke(ctx, [cx - r * 0.6, cy, cx + r * 0.6, cy], { w: 10, color: C.GREYBLUE_D, seed: 171, taper: false }));
    if (o.gate) {
      ST.beam(ctx, 560, 860, 560, 120, 60, 175);
      ST.beam(ctx, 1080, 860, 1080, 120, 60, 176);
      ST.beam(ctx, 480, 150, 1160, 150, 50, 177);
      ST.roof(ctx, 500, 1140, 120, 70, 178, { col: '#3a3c3e' });
      ST.rect(ctx, 590, 190, 460, 670, '#2c241c', { seed: 179, lw: 6, hatch: { c: 'rgba(80,60,40,0.3)', n: 8, len: 80, gap: 10, k: 2, ang: 90, bend: 0 } });
      ST.rect(ctx, 760, 240, 120, 200, '#a59a7c', { seed: 180, lw: 4, inner: () => [0, 1, 2].forEach((k) => ST.stroke(ctx, [790 + k * 30, 260, 792 + k * 30, 420], { w: 5, seed: 181 + k })) });
    }
    ST.dirt(ctx, -400, 860, 2400, 1200, 185);
    ST.puddle(ctx, 1500, 1010, 150, 186, '#7d8678');
    // rain barrel with buckets
    ST.rough(ctx, [-150, 880, -140, 720, 40, 720, 50, 880], '#5c4834', { seed: 187, lw: 6, hatch: { c: 'rgba(20,12,6,0.5)', n: 4, len: 60, gap: 8, k: 2, ang: 90, bend: 0 } });
    [-110, -40, -2].forEach((x, i) => ST.rough(ctx, [x, 720, x - 4, 670, x + 54, 670, x + 50, 720], '#6c5a3c', { seed: 188 + i, lw: 4 }));
    ST.flies(ctx, 1960, 840, t, 191);
  };

  // ---------- rice storehouse yard: the plaster kura with its iron door, stacked bales, a beam scale ----------
  ST.setRice = (ctx) => {
    ST.bands(ctx, -400, -300, 2400, 300, ['#7a8680', '#909483', '#a69e7e'], 5.1);
    ST.pool(ctx, 1500, 120, 420, 240, '#e3c27a', 0.2);
    ST.roof(ctx, -300, 2300, 150, 110, 200, { col: '#3e4042' });
    ST.kura(ctx, -300, 2300, 160, 860, 201);
    ST.rect(ctx, 1040, 330, 380, 530, '#2b2722', { seed: 202, lw: 7, hatch: { c: 'rgba(120,110,90,0.25)', n: 6, len: 80, gap: 10, k: 2, ang: 90, bend: 0 } });
    [1060, 1240].forEach((x, i) => ST.rect(ctx, x, 350, 160, 490, '#3d3a34', { seed: 203 + i, lw: 5, inner: () => [0, 1, 2, 3].forEach((k) => ST.blob(ctx, ST.ellipseRing(x + 30 + (k % 2) * 100, 400 + Math.floor(k / 2) * 340, 8, 8, 6), '#6a655a', { lw: 3, seed: 205 + k })) }));
    ST.dirt(ctx, -400, 860, 2400, 1200, 210);
    // the bale stack: three rows, the bottom ones dirty
    const rows = [[6, 1000], [5, 880], [4, 760]];
    rows.forEach(([n, y], r) => { for (let i = 0; i < n; i++) ST.bale(ctx, -260 + r * 70 + i * 150, y - 70, 170, 120, 211 + r * 10 + i); });
    ST.bale(ctx, 1700, 940, 180, 124, 240);
    ST.bale(ctx, 1860, 920, 180, 124, 241);
  };
})();

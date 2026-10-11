/* Sets A - the strip at night (title poster: the hotel front in neon, palms, the borrowed car at the kerb)
   and your room in that hotel by day (peeling pink wallpaper, blinds, a ceiling fan, the bed, the TV and its picture).
   World units = 1920x1080 frame at zoom 1, drawn wider for camera coverage. One warm light per set. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, MI = ST.MIAMI;

  ST.setStrip = (ctx, t) => {
    ST.bands(ctx, -400, -400, 2400, 940, ['#1a1722', '#211c2b', '#2a2232', '#352838', '#3f2e3a'], 3.3);
    ST.stars(ctx, -400, -400, 2800, 600, 50, 31, '#8a8296');
    ST.palmTree(ctx, 2050, 900, 820, 33, -60, t, true);
    ST.palmTree(ctx, -80, 900, 760, 34, 70, t, true);
    ST.pool(ctx, 900, 780, 900, 420, C.FIRE, 0.08);
    const f = ST.decoFacade(ctx, 200, 880, 1560, 600, { seed: 40, col: '#7a5a5c', colD: '#5a4044', trim: MI.TEAL_D, night: true, fin: 1560, finRise: 70, flicker: t });
    ST.neon(ctx, [210, f.top + 20, 1700, f.top + 20, 1745, f.top + 60], ST.rgb(MI.NEON_P), true, 41);
    ST.neon(ctx, [210, f.top + 600 * 0.21 + 6, 1752, f.top + 600 * 0.21 + 6], ST.rgb(MI.NEON_T), true, 44);
    // the entrance: lit doors under a teal canopy
    ST.rect(ctx, 780, 700, 240, 180, '#c39553', { seed: 47, lw: 6, amp: 1.5 });
    ST.stroke(ctx, [900, 700, 900, 880], { w: 5, seed: 48, taper: false });
    ST.rough(ctx, [740, 660, 1060, 660, 1090, 704, 710, 704], MI.TEAL_D, { seed: 49, lw: 6, amp: 1.5, shade: ['#2a403c', 0, 10] });
    // pavement, kerb, the street with neon smeared in it
    ST.rect(ctx, -400, 880, 2800, 80, '#57534d', { seed: 50, lw: 5, hatch: { c: 'rgba(20,18,16,0.4)', n: 8, len: 50, gap: 8, k: 2, ang: 0, bend: 0 } });
    ST.rect(ctx, -400, 958, 2800, 16, '#77736a', { seed: 51, lw: 4 });
    ST.rect(ctx, -400, 972, 2800, 500, '#262523', { seed: 52, lw: 0 });
    [[MI.NEON_P, 300, 0.16], [MI.NEON_T, 1100, 0.12], [MI.NEON_P, 1620, 0.14]].forEach(([col, x, a], i) => ST.blob(ctx, [x - 120, 990, x + 120, 990, x + 90, 1300, x - 90, 1300], ST.rgb(col).replace('rgb', 'rgba').replace(')', `,${a})`), { lw: 0, seed: 53 + i }));
    ST.puddle(ctx, 640, 1110, 120, 56, '#3d3442');
  };

  // what is on TV: the myth, cleaner and brighter than anything in the film (the one deliberately "pretty" picture)
  ST.tvPicture = (ctx, bb, t) => {
    const tt = ST.twos(t || 0);
    ST.bands(ctx, bb.x0 - 20, bb.y0 - 20, bb.x1 + 20, bb.cy + 20, ['#7a5f96', '#b87596', '#d68e86', '#e2ae78'], 1.1);
    ST.blob(ctx, ST.ellipseRing(bb.cx + 10, bb.cy + 6, 46, 46, 14), '#e8c27a', { lw: 0, seed: 61 });
    ctx.fillStyle = '#b87596';
    for (let i = 0; i < 4; i++) ctx.fillRect(bb.cx - 50, bb.cy - 14 + i * 11, 120, 4);
    ST.bands(ctx, bb.x0 - 20, bb.cy + 20, bb.x1 + 20, bb.y1 + 20, ['#4d9a96', '#3f8582', '#356f6e'], 2.2 + tt);
    [[bb.x0 + 20, 0.9], [bb.x1 - 24, 1]].forEach(([px, k], i) => {
      ctx.save(); ctx.translate(px, bb.cy + 26); ctx.scale(k * 0.16, k * 0.16); ST.palmTree(ctx, 0, 0, 700, 62 + i, i ? -80 : 80, 0, true); ctx.restore();
    });
    const bx = bb.x0 + 30 + ((tt * 40) % (bb.w + 40)) - 20, by = bb.cy + 40;
    ctx.fillStyle = '#1b1820';
    ST.path(ctx, [bx - 40, by, bx + 34, by, bx + 48, by - 8, bx - 36, by - 10], true); ctx.fill();
    ST.path(ctx, [bx - 6, by - 10, bx - 2, by - 40, bx + 4, by - 44, bx + 8, by - 40, bx + 10, by - 10], true); ctx.fill(); // the hero, standing
    ST.path(ctx, [bx + 6, by - 36, bx + 20, by - 46, bx + 22, by - 42, bx + 8, by - 32], true); ctx.fill(); // pointing at the horizon
    ctx.fillStyle = 'rgba(230,240,230,0.7)';
    for (let i = 0; i < 4; i++) ctx.fillRect(bx - 44 - i * 10, by - 2 + (i % 2) * 3, 8, 3);
  };

  // your room in the hotel: o: { tvOn }
  ST.setRoom = (ctx, t, o) => {
    o = o || {};
    const tt = ST.twos(t || 0);
    ST.rect(ctx, -400, -300, 2800, 1300, '#97716c', { seed: 70, lw: 0, mottle: ['rgba(80,40,36,0.2)', 12, 90] });
    ctx.fillStyle = 'rgba(200,170,160,0.16)';
    for (let x = -400; x < 2400; x += 64) ctx.fillRect(x, -300, 22, 1300); // wallpaper stripes
    ST.rect(ctx, -400, -300, 2800, 320, '#7a6a5a', { seed: 71, lw: 6, mottle: ['rgba(40,30,20,0.25)', 6, 80] });
    ST.rect(ctx, -400, 10, 2800, 24, '#6a5a4a', { seed: 72, lw: 5 });
    ST.stain(ctx, 1500, 80, 360, 200, 73, 'rgba(90,60,30,0.35)'); // the leak
    ST.stain(ctx, 600, 300, 160, 120, 74, 'rgba(60,40,30,0.25)');
    ST.peel(ctx, 1300, 380, 120, 80, 75);
    ST.peel(ctx, -160, 520, 90, 70, 76);
    ST.crack(ctx, 760, 40, 200, 77, 1.3);
    // the window with half-open blinds; outside: white sky and a palm
    ST.rect(ctx, 20, 150, 520, 470, '#3a3028', { seed: 78, lw: 8 });
    ctx.save(); ctx.beginPath(); ctx.rect(32, 162, 496, 446); ctx.clip();
    ST.bands(ctx, 20, 150, 540, 620, ['#c9c2a6', '#c2b896', '#b8ae8a'], 2);
    ST.palmTree(ctx, 380, 700, 420, 79, -40, t, false);
    ST.blinds(ctx, 32, 162, 496, 300, 80);
    ctx.restore();
    // slatted sun across the wall and the bed: the one warm light
    ctx.fillStyle = 'rgba(230,180,100,0.14)';
    for (let i = 0; i < 6; i++) { ST.path(ctx, [620 + i * 70, 460 + i * 34, 1500 + i * 70, 700 + i * 34, 1500 + i * 70, 724 + i * 34, 620 + i * 70, 484 + i * 34], true); ctx.fill(); }
    ST.ceilingFan(ctx, 1200, 70, t, 82, 0.9);
    // a curling poster of a speedboat over the bed (no words)
    ST.rough(ctx, [1180, 200, 1560, 196, 1566, 430, 1186, 440], '#8aa09a', { seed: 83, lw: 5, amp: 2, inner: () => { ctx.fillStyle = '#c7867e'; ctx.fillRect(1180, 200, 400, 120); ST.blob(ctx, [1260, 380, 1460, 380, 1500, 366, 1270, 360], '#2a2632', { lw: 0, seed: 84 }); } });
    ST.stroke(ctx, [1560, 196, 1540, 236, 1566, 250], { w: 4, seed: 85 }); // curled corner
    // a cockroach on the wall, on twos
    const rx = 1700 + (tt * 46) % 260, ry = 520 - (tt * 30) % 160;
    ST.blob(ctx, ST.ellipseRing(rx, ry, 14, 8, 7, -0.6), '#3a2414', { lw: 3, seed: 86 });
    [-1, 1].forEach((s, i) => ST.stroke(ctx, [rx + 12, ry - 6, rx + 30, ry - 20 + s * 8], { w: 2, seed: 87 + i, taper: false }));
    // floor (carpet) and the bed
    ST.rect(ctx, -400, 900, 2800, 600, '#5a4636', { seed: 88, lw: 6, mottle: ['rgba(30,20,10,0.3)', 9, 70], hatch: { c: 'rgba(20,12,6,0.35)', n: 10, len: 40, gap: 6, k: 3, ang: 10 } });
    ST.stain(ctx, 700, 1060, 220, 70, 89, 'rgba(30,18,10,0.4)');
    ST.rough(ctx, [880, 520, 1780, 520, 1780, 820, 880, 820], '#7a5c3a', { seed: 90, lw: 7, amp: 2, hatch: { c: 'rgba(30,18,8,0.5)', n: 10, len: 70, gap: 6, k: 3, ang: 90, bend: 0.03 } }); // rattan headboard
    ST.rough(ctx, [840, 760, 1840, 760, 1860, 900, 820, 900], '#b5ad92', { seed: 91, lw: 7, amp: 4, shade: ['#8a8268', 0, 18], hatch: { c: 'rgba(60,54,36,0.45)', n: 8, len: 70, gap: 8, k: 3, ang: 30 } });
    ST.blob(ctx, [1560, 700, 1760, 690, 1780, 770, 1570, 780], '#c4bc9e', { lw: 6, seed: 92, shade: ['#9a9276', -10, 6] }); // pillow
    ST.rough(ctx, [1620, 860, 1800, 850, 1810, 880, 1626, 890], '#c4b080', { seed: 93, lw: 5, amp: 1 }); // pizza box
    ST.rect(ctx, 820, 900, 1040, 70, '#4a3828', { seed: 94, lw: 6 });
    // dresser and the TV
    ST.rough(ctx, [220, 660, 660, 660, 660, 940, 220, 940], '#5c4432', { seed: 95, lw: 7, amp: 2, shade: ['#3e2e22', -14, 0], hatch: { c: 'rgba(20,12,6,0.4)', n: 4, len: 60, gap: 6, k: 2, ang: 0, bend: 0.02 } });
    [720, 810].forEach((y, i) => ST.stroke(ctx, [240, y, 640, y + 2], { w: 4, seed: 96 + i, taper: false }));
    ST.tvSet(ctx, 440, 590, 1.1, 98, o.tvOn === false ? null : (bb) => ST.tvPicture(ctx, bb, t));
    ST.blob(ctx, [560, 650, 600, 650, 598, 600, 562, 600], '#a0623c', { lw: 4, seed: 99 }); // soda can
  };
  ST.tvScreenWorld = () => [440 + -29 * 1.1, 590 + -35 * 1.1];
})();

/* Sets C - mission control (smoky room, wall screens, rows of consoles), the command module cabin in lunar orbit
   (cramped, round porthole onto the Moon below), and the lunar surface by the lander. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, M = ST.MOON;

  // a console seen from behind/three-quarter: sloped top, a dim screen, buttons, an ashtray or a cup
  ST.console = (ctx, x, y, w, seed, front) => {
    ST.rough(ctx, [x, y, x + w, y, x + w + 20, y + 160, x - 20, y + 160], C.GREYBLUE_D, { seed, lw: 6, shade: ['#2c353a', -16, 0], hatch: { c: 'rgba(10,12,14,0.45)', n: 4, len: 50, gap: 8, k: 3, ang: 80 } });
    if (!front) return;
    ST.rough(ctx, [x + 20, y - 120, x + w - 20, y - 120, x + w - 10, y + 6, x + 10, y + 6], '#3b464c', { seed: seed + 1, lw: 6 });
    for (let i = 0; i < 3; i++) {
      const sx = x + 40 + i * ((w - 80) / 3);
      ST.rect(ctx, sx, y - 100, (w - 120) / 3, 70, '#1c2420', { seed: seed + 2 + i, lw: 4 });
      ctx.fillStyle = 'rgba(140,170,110,0.55)';
      for (let r = 0; r < 4; r++) ctx.fillRect(sx + 8, y - 90 + r * 14, ((w - 120) / 3 - 16) * ST.rnd(0.3, 0.9, seed, i, r), 4);
    }
  };
  ST.setControl = (ctx, t) => {
    ST.rect(ctx, -400, -300, 2700, 1700, '#2a2a28', { seed: 120, lw: 0 });
    // the wall of screens: a moon chart with the track drawn on it, side screens with plots
    ST.rect(ctx, -300, 20, 2500, 420, '#1a1c1c', { seed: 121, lw: 8 });
    ST.rect(ctx, 520, 50, 880, 360, '#2e3a36', { seed: 122, lw: 6 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(526, 56, 868, 348);
    ctx.clip();
    for (let i = 0; i < 12; i++) ST.blob(ctx, ST.ellipseRing(ST.rnd(540, 1380, 123, i), ST.rnd(70, 390, 123, i, 1), 20 + 40 * ST.hash(123, i, 2), 14 + 26 * ST.hash(123, i, 2), 9), 'rgba(140,170,120,0.25)', { lw: 2, seed: 124 + i, lineColor: 'rgba(150,180,120,0.6)' });
    ST.stroke(ctx, [560, 360, 800, 280, 1040, 220, 1240, 200, 1300, 210], { w: 6, color: '#c6b56c', seed: 140, taper: false });
    ctx.restore();
    [[-200, 50, 620], [1430, 50, 640]].forEach(([x, y, w], i) => {
      ST.rect(ctx, x, y, w, 360, '#2b3330', { seed: 141 + i, lw: 6 });
      ST.stroke(ctx, [x + 40, y + 300, x + w * 0.3, y + 220, x + w * 0.6, y + 240, x + w - 40, y + 120], { w: 5, color: 'rgba(150,180,120,0.7)', seed: 143 + i, taper: false });
    });
    // smoke haze: two flat translucent bands
    [[260, 0.1], [520, 0.07]].forEach(([y, a], i) => ST.blob(ctx, [-300, y, 600, y - 40, 1300, y + 30, 2300, y - 20, 2300, y + 140, -300, y + 160], `rgba(170,165,140,${a})`, { lw: 0, seed: 145 + i }));
    ST.rect(ctx, -400, 860, 2700, 500, '#3a3630', { seed: 147, lw: 6 });
    // back row of consoles
    for (let i = 0; i < 5; i++) ST.console(ctx, -200 + i * 480, 560, 400, 150 + i * 10, true);
    ST.pool(ctx, 1400, 700, 600, 380, C.FIRE, 0.08);
  };
  // the front console row (drawn over the people standing behind it)
  ST.controlFront = (ctx) => {
    for (let i = 0; i < 3; i++) ST.console(ctx, -300 + i * 800, 900, 800, 200 + i * 10, false);
    ST.blob(ctx, ST.ellipseRing(420, 900, 40, 12, 10), '#6d6a5a', { lw: 4, seed: 230 }); // ashtray
    ST.tube(ctx, [440, 896, 480, 890], [8, 8], C.LINEN, { lw: 3, seed: 231 });
  };
  ST.cigSmoke = (ctx, x, y, t) => {
    const w = Math.floor(ST.twos(t) * 3) % 3;
    ST.stroke(ctx, [x, y, x + 10 + w * 4, y - 40, x - 6 - w * 3, y - 90, x + 12, y - 150], { w: 4, color: 'rgba(190,185,160,0.5)', seed: 232 + w, taper: false });
  };

  // command module cabin: curved walls, panels of switches, the round porthole with the Moon far below, a lamp
  ST.setCM = (ctx, t) => {
    ST.rect(ctx, -400, -300, 2700, 1700, '#4a4a42', { seed: 160, lw: 0 });
    ST.blob(ctx, ST.ellipseRing(960, 560, 1100, 700, 20), M.WALL, { lw: 9, seed: 161, shade: ['rgba(0,0,0,0.25)', -60, 30], mottle: ['rgba(40,38,30,0.2)', 8, 80], hatch: { c: 'rgba(20,20,16,0.35)', n: 10, len: 60, gap: 9, k: 3, ang: 70 } });
    ST.switches(ctx, 120, 140, 10, 3, 48, 162);
    ST.switches(ctx, 1360, 160, 9, 3, 48, 163);
    ST.gauge(ctx, 400, 420, 50, 0.3, 164);
    const px = 1460, py = 560;
    ST.blob(ctx, ST.ellipseRing(px, py, 200, 200, 18), '#0d0f12', { lw: 0, seed: 165 });
    ctx.save();
    ST.path(ctx, ST.curve(ST.ellipseRing(px, py, 196, 196, 18), true, 6), true);
    ctx.clip();
    ST.stars(ctx, px - 200, py - 200, 400, 140, 10, 166, '#77736a');
    ST.moonGround(ctx, px - 400, py - 40 + Math.sin(t * 0.3) * 4, px + 400, py + 300, 167, { craters: 16, scale: 0.35 });
    ctx.restore();
    ST.inkLine(ctx, ST.curve(ST.ellipseRing(px, py, 200, 200, 18), true, 6), { w: 34, closed: true, seed: 168, color: '#2b2b27' });
    ST.inkLine(ctx, ST.curve(ST.ellipseRing(px, py, 218, 218, 18), true, 6), { w: 8, closed: true, seed: 169 });
    ST.rect(ctx, -400, 940, 2700, 400, '#34332d', { seed: 170, lw: 6 }); // couch frames
    ST.tube(ctx, [200, 900, 700, 960, 1200, 930], [40, 40, 40], '#5c5a4c', { lw: 6, seed: 171 });
    ST.pool(ctx, 760, 380, 700, 460, C.FIRE, 0.08);
  };
  // crumbs and a pencil drifting (on twos)
  ST.floaters = (ctx, t, x, y) => {
    const tt = ST.twos(t);
    for (let i = 0; i < 7; i++) ST.blob(ctx, ST.ellipseRing(x + ST.rnd(-160, 160, 171, i) + tt * 10 * ST.rnd(-1, 1, 172, i), y + ST.rnd(-90, 90, 173, i) - tt * 8, 5, 4, 6), '#b39a62', { lw: 2.5, seed: 174 + i });
    ctx.save();
    ctx.translate(x + 220 - tt * 12, y - 160 + tt * 6);
    ctx.rotate(0.4 + tt * 0.3);
    ST.tube(ctx, [-40, 0, 40, 0], [10, 10], C.MUSTARD, { lw: 4, seed: 180 });
    ctx.restore();
  };

  // lunar surface by the lander: black sky, Earth, the ground. o: { lander: [x, y, k] }
  ST.setSurface = (ctx, t, o) => {
    ST.rect(ctx, -400, -300, 2700, 1700, '#0b0c0f', { seed: 190, lw: 0 });
    ST.earth(ctx, 1600, 170, 54, 191);
    ST.moonGround(ctx, -400, 620, 2300, 1400, 192, { craters: 18 });
    ST.pool(ctx, 140, 120, 150, 150, '#e8dcb0', 0.07);
    ST.blob(ctx, ST.ellipseRing(140, 120, 40, 40, 12), '#e6dcb8', { lw: 0, seed: 194 }); // the sun, the one light
    if (o && o.lander) ST.lander(ctx, o.lander[0], o.lander[1], o.lander[2], 193, { flame: o.flame });
  };
})();

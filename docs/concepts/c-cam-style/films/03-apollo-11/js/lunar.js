/* Lunar set brushes - built only from C's brushes (blob, tube, rough, rect, hatch, pool, bands, stars, label):
   moon ground with craters, boulders with long flat shadows, Earth, the lander seen from outside, switch banks,
   round gauges, the guidance computer (DSKY), metal wall panels with rivets and tape, a dent in thin skin. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  ST.MOON = { GROUND: '#7a766a', GROUND_D: '#5d5a50', GROUND_L: '#99958a', WALL: '#686759', WALL_D: '#4d4c42', PANEL: '#45463f', SCREEN: '#9aac67', FOIL: '#b88e34' };
  const M = ST.MOON;

  // crater: a pale raised rim, a darker bowl inside it, shadow on the inner wall facing the sun (sun from the left)
  ST.crater = (ctx, x, y, rx, seed) => {
    const ry = rx * 0.32, lw = Math.min(6, 2 + rx / 30);
    ST.blob(ctx, ST.wobble(ST.ellipseRing(x, y, rx, ry, 14), rx * 0.015, seed, 60), M.GROUND_L, { lw, seed });
    ST.blob(ctx, ST.wobble(ST.ellipseRing(x + rx * 0.04, y + ry * 0.1, rx * 0.84, ry * 0.72, 14), rx * 0.015, seed + 1, 60), M.GROUND_D, { lw: lw * 0.7, seed: seed + 1, shade: ['#45433b', -rx * 0.22, ry * 0.12], hatch: rx > 60 ? { c: 'rgba(30,28,24,0.4)', n: 4, len: rx * 0.25, gap: 7, k: 3, ang: 10, bend: 0.1 } : null });
  };
  // boulder: rough lump, hatched shadow side, and a flat black shadow thrown to the right (low sun)
  ST.boulder = (ctx, x, y, r, seed) => {
    ST.blob(ctx, [x - r * 0.6, y + r * 0.12, x + r * 2.2, y + r * 0.02, x + r * 2.5, y + r * 0.34, x - r * 0.4, y + r * 0.42], '#34322d', { sharp: true, lw: 0, seed });
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (i / 7) * Math.PI, k = 0.75 + 0.35 * ST.hash(seed, i);
      pts.push(x + Math.cos(a) * r * k, y + Math.sin(a) * r * 0.9 * k);
    }
    pts.push(x + r * 0.9, y + r * 0.2, x - r * 0.9, y + r * 0.2);
    ST.blob(ctx, pts, '#8a8578', { sharp: true, lw: Math.min(7, 2 + r / 12), seed: seed + 1, shade: ['#5b584e', r * 0.35, 0], hatch: { c: 'rgba(30,28,24,0.5)', n: 2, len: r * 0.6, gap: 6, k: 3, ang: 70 } });
  };
  // the moon floor from horizon y0 down to y1: flat grey, rows of craters getting bigger toward us, pebbles
  ST.moonGround = (ctx, x0, y0, x1, y1, seed, o) => {
    o = o || {};
    ST.rough(ctx, [x0, y0, x0 + (x1 - x0) * 0.4, y0 - 8, x1, y0 + 6, x1, y1, x0, y1], o.col || M.GROUND, { seed, lw: 6, amp: 4, hatch: { c: 'rgba(40,38,32,0.35)', n: 14, len: 70, gap: 9, k: 2, ang: 4, bend: 0.05 }, mottle: ['rgba(60,58,50,0.25)', 10, 80] });
    const n = o.craters || 14;
    for (let i = 0; i < n; i++) {
      const k = ST.hash(seed, i, 1), y = y0 + 20 + k * k * (y1 - y0 - 40);
      ST.crater(ctx, x0 + ST.hash(seed, i, 2) * (x1 - x0), y, 20 + 180 * k * k * (o.scale || 1), seed + 10 + i);
    }
    ctx.fillStyle = '#4c4a42';
    for (let i = 0; i < 60; i++) { const k = ST.hash(seed, i, 5); ctx.fillRect(x0 + ST.hash(seed, i, 6) * (x1 - x0), y0 + k * (y1 - y0), 3 + k * 8, 2 + k * 4); }
  };
  ST.earth = (ctx, x, y, r, seed) => {
    ST.blob(ctx, ST.ellipseRing(x, y, r, r, 16), '#4f6670', { lw: 5, seed, shade: ['#1f262b', -r * 0.45, r * 0.1] });
    ctx.save();
    ST.path(ctx, ST.curve(ST.ellipseRing(x, y, r, r, 16), true, 5), true);
    ctx.clip();
    ST.blob(ctx, [x - r * 0.4, y - r * 0.5, x + r * 0.1, y - r * 0.6, x + r * 0.2, y, x - r * 0.1, y + r * 0.4, x - r * 0.5, y], C.OLIVE, { lw: 0, seed: seed + 1 });
    [[0.3, -0.2], [-0.2, 0.5]].forEach(([a, b], i) => ST.stroke(ctx, [x + a * r - r * 0.3, y + b * r, x + a * r, y + b * r - r * 0.12, x + a * r + r * 0.3, y + b * r], { w: r * 0.12, color: '#b9b49e', seed: seed + 2 + i }));
    ctx.restore();
  };

  // the lander from outside: gold-foil descent stage on four legs, grey angular cabin above. k = scale, (x, y) = feet
  ST.lander = (ctx, x, y, k, seed, o) => {
    o = o || {};
    const P = (a, b) => [x + a * k, y + b * k];
    [[-1, 0], [1, 1]].forEach(([s, i]) => {
      ST.tube(ctx, [].concat(P(s * 120, -170), P(s * 210, -30)), [14 * k, 12 * k], C.STONE, { lw: 5, seed: seed + i });
      ST.tube(ctx, [].concat(P(s * 150, -110), P(s * 80, -60)), [8 * k, 8 * k], C.STONE_D, { lw: 4, seed: seed + 2 + i });
      ST.blob(ctx, ST.ellipseRing(x + s * 214 * k, y - 18 * k, 34 * k, 12 * k, 10), C.STONE, { lw: 5, seed: seed + 4 + i, shade: [C.STONE_D, 0, 4] });
    });
    ST.blob(ctx, [].concat(P(-46, -110), P(46, -110), P(64, -40), P(-64, -40)), '#3a3631', { sharp: true, lw: 5, seed: seed + 6 }); // engine bell
    ST.blob(ctx, [].concat(P(-150, -270), P(150, -270), P(170, -200), P(150, -120), P(-150, -120), P(-170, -200)), M.FOIL, { sharp: true, lw: 7, seed: seed + 7, shade: [C.GOLD_D, -30, 0], light: ['rgba(240,210,140,0.35)', 20, -10], hatch: { c: 'rgba(70,40,10,0.5)', n: 10, len: 40 * k, gap: 7, k: 3, ang: 60, bend: 0.4 } });
    ST.rect(ctx, x - 60 * k, y - 250 * k, 50 * k, 110 * k, '#3a3631', { seed: seed + 8, lw: 4 }); // ladder bay
    for (let i = 0; i < 5; i++) ST.stroke(ctx, [].concat(P(-56, -240 + i * 22), P(-14, -240 + i * 22)), { w: 4, color: C.STONE, seed: seed + 9 + i, taper: false });
    ST.blob(ctx, [].concat(P(-130, -270), P(-110, -380), P(-40, -420), P(80, -420), P(140, -370), P(140, -270)), '#8d8a7c', { sharp: true, lw: 7, seed: seed + 15, shade: ['#66645a', -24, 0], hatch: { c: 'rgba(30,28,24,0.45)', n: 6, len: 40 * k, gap: 7, k: 3, ang: 80 } });
    [[-90, -370, -50, -400, -40, -330], [-30, -400, 10, -400, -10, -330]].forEach((w, i) => ST.blob(ctx, [].concat(P(w[0], w[1]), P(w[2], w[3]), P(w[4], w[5])), '#1d1e20', { sharp: true, lw: 5, seed: seed + 16 + i }));
    ST.tube(ctx, [].concat(P(100, -420), P(130, -480)), [6 * k, 6 * k], C.STONE_D, { lw: 4, seed: seed + 18 });
    ST.blob(ctx, ST.ellipseRing(x + 140 * k, y - 492 * k, 30 * k, 12 * k, 10, -0.4), C.LINEN, { lw: 4, seed: seed + 19 }); // dish
    if (o.flame) ST.blob(ctx, [].concat(P(-40, -46), P(40, -46), P(0, -46 + 80 * o.flame)), '#d8c9a0', { sharp: true, lw: 4, seed: seed + 20 });
  };

  // metal wall: flat grey panel with rivet rows, scuffs, a strip of tape, a stain
  ST.metalPanel = (ctx, x, y, w, h, seed, col) => {
    ST.rect(ctx, x, y, w, h, col || M.WALL, { seed, lw: 6, amp: 1.5, shade: ['rgba(0,0,0,0.18)', -18, 0], mottle: ['rgba(40,38,30,0.2)', 4, 40], hatch: { c: 'rgba(20,20,16,0.35)', n: 5, len: 40, gap: 8, k: 3, ang: 80 } });
    ctx.fillStyle = 'rgba(25,24,20,0.6)';
    for (let i = 8; i < w - 8; i += 34) { ctx.fillRect(x + i, y + 8, 5, 5); ctx.fillRect(x + i, y + h - 13, 5, 5); }
    if (ST.hash(seed, 2) < 0.6) ST.rect(ctx, x + w * ST.rnd(0.1, 0.6, seed, 3), y + h * ST.rnd(0.2, 0.7, seed, 4), 60, 16, 'rgba(170,160,120,0.7)', { seed: seed + 5, lw: 2, amp: 1 });
    ST.stain(ctx, x + w * ST.rnd(0.2, 0.8, seed, 6), y + h * ST.rnd(0.3, 0.8, seed, 7), 50, 34, seed + 8, 'rgba(40,30,15,0.25)');
  };
  // a bank of toggle switches, some up, some down, a few under guards
  ST.switches = (ctx, x, y, cols, rows, sp, seed) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, cx = x + c * sp, cy = y + r * sp, up = ST.hash(seed, i) < 0.5;
      ST.blob(ctx, ST.ellipseRing(cx, cy, sp * 0.2, sp * 0.2, 7), C.BLACK, { lw: 3, seed: seed + i });
      ST.stroke(ctx, [cx, cy, cx + 2, cy + (up ? -sp * 0.38 : sp * 0.38)], { w: 6, color: C.STONE, seed: seed + 40 + i, taper: false });
      if (ST.hash(seed, i, 3) < 0.15) ST.stroke(ctx, [cx - sp * 0.32, cy + sp * 0.2, cx - sp * 0.32, cy - sp * 0.4, cx + sp * 0.32, cy - sp * 0.4, cx + sp * 0.32, cy + sp * 0.2], { w: 3, color: C.STONE_D, seed: seed + 80 + i, taper: false });
    }
  };
  // round gauge: dial, ticks, a red low zone, the needle at angle a (rad, 0 = straight up), a stencilled label
  ST.gauge = (ctx, x, y, r, a, seed, label) => {
    ST.blob(ctx, ST.ellipseRing(x, y, r + 14, r + 14, 14), C.BLACK, { lw: 6, seed });
    ST.blob(ctx, ST.ellipseRing(x, y, r, r, 14), '#c2b996', { lw: 4, seed: seed + 1, shade: ['#9a9174', -r * 0.1, r * 0.08] });
    ctx.save();
    ctx.strokeStyle = C.RED_D;
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, -Math.PI / 2 - 2.4, -Math.PI / 2 - 1.6);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i <= 10; i++) {
      const b = -2.4 + (4.8 * i) / 10, s = Math.sin(b), c = -Math.cos(b);
      ST.stroke(ctx, [x + s * r * 0.72, y + c * r * 0.72, x + s * r * 0.92, y + c * r * 0.92], { w: i % 5 ? 3 : 5, seed: seed + 2 + i, taper: false });
    }
    ST.tube(ctx, [x, y, x + Math.sin(a) * r * 0.82, y - Math.cos(a) * r * 0.82], [r * 0.08, r * 0.03], C.INK, { lw: 0, seed: seed + 20 });
    ST.blob(ctx, ST.ellipseRing(x, y, r * 0.09, r * 0.09, 7), C.STONE, { lw: 3, seed: seed + 21 });
    if (label) ST.label(ctx, label, x, y + r * 0.36, { fill: C.INK, font: `bold ${Math.round(r * 0.12)}px 'Arial Black', Arial, sans-serif` });
  };
  // the guidance computer (DSKY): status lights, a small display, a keypad. o: { alarm (bool, lights on), code
  // (display text), press (key index being pressed, -1 none) }. (x, y) = top-left, k = scale
  ST.dsky = (ctx, x, y, k, seed, o) => {
    o = o || {};
    const R = (a, b, w, h, col, sd, opt) => ST.rect(ctx, x + a * k, y + b * k, w * k, h * k, col, Object.assign({ seed: seed + sd, lw: 4, amp: 1 }, opt));
    R(0, 0, 400, 470, M.PANEL, 0, { lw: 7, shade: ['rgba(0,0,0,0.25)', -14, 0], hatch: { c: 'rgba(10,10,8,0.4)', n: 4, len: 40, gap: 8, k: 3, ang: 80 } });
    ['UPLINK', 'TEMP', 'PROG', 'RESTART', 'KEY REL', 'OPR ERR'].forEach((s, i) => {
      const lit = o.alarm && (s === 'PROG' || s === 'KEY REL'), cx = 30 + (i % 2) * 85, cy = 24 + Math.floor(i / 2) * 50;
      R(cx, cy, 76, 38, lit ? C.FIRE : '#6d6a5a', 10 + i, { lw: 3 });
      ST.label(ctx, s, x + (cx + 38) * k, y + (cy + 19) * k, { size: 11 * k, fill: lit ? C.INK : '#3b3a32', font: `bold ${Math.round(12 * k)}px Arial, sans-serif` });
    });
    R(214, 20, 166, 160, '#1d211b', 20, { lw: 5 });
    ['PROG', 'VERB', 'NOUN'].forEach((s, i) => ST.label(ctx, s, x + (240 + (i % 2) * 80) * k, y + (36 + Math.floor(i / 2) * 50) * k, { size: 10 * k, fill: '#55603c', font: `bold ${Math.round(11 * k)}px Arial, sans-serif` }));
    ST.label(ctx, o.code || '', x + 297 * k, y + 140 * k, { fill: M.SCREEN, font: `bold ${Math.round(40 * k)}px 'Courier New', monospace` });
    const keys = ['VERB', '+', '7', '8', '9', 'CLR', 'NOUN', '-', '4', '5', '6', 'PRO', '0', '1', '2', '3', 'ENTR', 'RSET'];
    keys.forEach((s, i) => {
      const c = i % 6, r = Math.floor(i / 6), bx = 20 + c * 61, by = 214 + r * 82, down = o.press === i ? 4 : 0;
      R(bx, by + down, 54, 66, '#2a2a26', 30 + i, { lw: 4, light: down ? null : ['rgba(200,190,160,0.18)', 3, -3] });
      ST.label(ctx, s, x + (bx + 27) * k, y + (by + 33 + down) * k, { fill: '#cfc6a6', font: `bold ${Math.round((s.length > 2 ? 12 : 20) * k)}px Arial, sans-serif` });
    });
  };
  // thin skin: a dent pushed in at (x, y); wob 0..1 = ripple rings still shaking
  ST.dent = (ctx, x, y, r, wob, seed) => {
    ST.blob(ctx, ST.ellipseRing(x, y, r, r * 0.8, 12), 'rgba(20,20,16,0.3)', { lw: 0, seed, light: ['rgba(220,215,190,0.25)', -r * 0.25, -r * 0.2] });
    ST.stroke(ctx, [x - r * 0.8, y - r * 0.3, x - r * 0.2, y - r * 0.7, x + r * 0.6, y - r * 0.5], { w: 3.5, seed: seed + 1 });
    for (let i = 1; i <= 2; i++) if (wob > 0) {
      const rr = r * (1 + i * 0.5 + wob * 0.3);
      ST.inkLine(ctx, ST.curve(ST.wobble(ST.ellipseRing(x, y, rr, rr * 0.8, 10), 3 * wob, seed + i + Math.floor(wob * 6), 30), true, 6), { w: 3, closed: true, seed: seed + 5 + i });
    }
  };
})();

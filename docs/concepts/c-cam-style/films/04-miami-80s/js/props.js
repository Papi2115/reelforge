/* Miami props - shared drawing code for held objects only (no characters): sweat and spit drops, frozen cash bricks,
   oven mitts, the newspaper (with eye holes), the submarine sandwich, cigar, calculator, binoculars, popsicle, car key,
   plus placement helpers (body-space wrist target for a world point, figure <-> world points, mirrored prop angles).
   Every prop is centred on its grip point; angles are screen radians (0 = +x). Cash is plain banded paper: no figures. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const DEG = [0, 45, 90, 180];
  const at = (ctx, x, y, ang, k, fn) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0); if (k && k !== 1) ctx.scale(k, k); fn(); ctx.restore(); };
  ST.at = at;

  // sweat drops (head space): each drips down and restarts, on twos
  ST.sweat = (ctx, pts, t, seed) => {
    const tt = ST.twos(t);
    pts.forEach(([x, y], i) => {
      const ph = (tt * 0.9 + ST.hash(seed, i)) % 1, dy = ph * 24, r = 4 + 1.5 * ST.hash(seed, i, 2);
      ST.blob(ctx, [x, y + dy - r * 2.2, x + r, y + dy, x, y + dy + r, x - r, y + dy], '#c4c6b4', { lw: 3, seed: seed + i, light: ['rgba(255,255,240,0.5)', 2, -2] });
    });
  };
  // spit spray from a yelling mouth toward +x (head space), new drops every frame on twos
  ST.spit = (ctx, x, y, t, seed) => {
    const f = Math.floor(ST.twos(t) * 12);
    for (let i = 0; i < 7; i++) {
      const d = 20 + 70 * ST.hash(seed, f, i), a = ST.rnd(-0.5, 0.5, seed, f, i + 9);
      ST.blob(ctx, ST.ellipseRing(x + Math.cos(a) * d, y + Math.sin(a) * d, 3.5, 3, 5), '#c8cbb8', { lw: 2, seed: seed + i });
    }
  };

  // a brick of banded paper money (plain grey-green, a paper band, no numbers); frost = white rime on top
  ST.cashBrick = (ctx, x, y, w, h, rot, seed, frost) => at(ctx, x, y, rot, 1, () => {
    ST.rect(ctx, -w / 2, -h / 2, w, h, '#7d8a6c', { seed, lw: 4.5, amp: 1, shade: ['#5c674f', -6, 4], hatch: { c: 'rgba(30,40,24,0.45)', n: 2, len: w * 0.5, gap: 4, k: 3, ang: 0, bend: 0 } });
    ST.rect(ctx, -w * 0.12, -h / 2 - 2, w * 0.24, h + 4, '#c9bf9c', { seed: seed + 1, lw: 3, amp: 0.5 });
    if (frost) {
      ST.stroke(ctx, [-w / 2 + 2, -h / 2 + 2, 0, -h / 2 + 1, w / 2 - 2, -h / 2 + 3], { w: 6, color: '#dfe3d8', seed: seed + 2, taper: false });
      ctx.fillStyle = 'rgba(230,236,226,0.85)';
      for (let i = 0; i < 5; i++) ctx.fillRect(-w / 2 + 6 + ST.hash(seed, i, 1) * (w - 12), -h / 2 + 5 + ST.hash(seed, i, 2) * (h - 10), 4, 3);
    }
  });
  // oven mitt over the hand at the wrist: quilted, too big, scorched. ang = forearm direction (deg, 0 = down), as ST.hand
  ST.mitt = (ctx, x, y, ang, sz, seed) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((-ang * Math.PI) / 180);
    ST.blob(ctx, [-sz * 0.55, -sz * 0.2, sz * 0.55, -sz * 0.2, sz * 0.66, sz * 0.7, sz * 0.42, sz * 1.35, -sz * 0.4, sz * 1.38, -sz * 0.66, sz * 0.72], '#a7743e', { lw: 6, seed, shade: ['#7a5228', -sz * 0.14, 4], mottle: ['rgba(60,30,10,0.35)', 3, sz * 0.18], hatch: { c: 'rgba(60,34,12,0.5)', n: 4, len: sz * 0.5, gap: 6, k: 3, ang: 45, bend: 0 } });
    ST.tube(ctx, [sz * 0.5, sz * 0.3, sz * 0.9, sz * 0.78], [sz * 0.42, sz * 0.36], '#a7743e', { lw: 5.5, seed: seed + 1, shade: ['#7a5228', -4, 0] });
    ST.rect(ctx, -sz * 0.6, -sz * 0.36, sz * 1.2, sz * 0.26, '#c9bf9c', { seed: seed + 2, lw: 4, amp: 1 });
    ctx.restore();
  };

  // broadsheet newspaper held open (centre x, y), columns of grey scribble, one photo block; holes = two eye holes cut out
  ST.newspaper = (ctx, x, y, w, rot, seed, holes) => at(ctx, x, y, rot, 1, () => {
    const h = w * 0.7;
    ST.blob(ctx, [-w / 2, -h / 2, -2, -h / 2 + 6, w / 2, -h / 2, w / 2 + 4, h / 2, 2, h / 2 - 4, -w / 2 - 4, h / 2], '#c6bd9f', { sharp: true, lw: 5, seed, shade: ['#9a9277', -10, 4], mottle: ['rgba(120,100,60,0.2)', 3, w * 0.1] });
    ST.stroke(ctx, [0, -h / 2 + 6, 0, h / 2 - 4], { w: 3, seed: seed + 1 });
    ctx.fillStyle = 'rgba(60,54,40,0.55)';
    [-1, 1].forEach((s) => { for (let c = 0; c < 2; c++) for (let r = 0; r < 9; r++) ctx.fillRect(s > 0 ? 12 + c * (w / 4 - 4) : -w / 2 + 12 + c * (w / 4 - 4), -h / 2 + 34 + r * (h - 60) / 9, (w / 4 - 22) * (0.6 + 0.4 * ST.hash(seed, c, r + (s > 0 ? 20 : 0))), 4); });
    ctx.fillStyle = 'rgba(30,26,20,0.75)';
    ctx.fillRect(-w / 2 + 12, -h / 2 + 10, w - 24, 14); // headline bar
    ST.rect(ctx, 16, h * 0.04, w / 4 - 12, h * 0.34, '#6f6a5a', { seed: seed + 2, lw: 3, amp: 1 });
    if (holes) [-w * 0.2, w * 0.2].forEach((hx, i) => { // two eye holes with two eyes behind them, looking sideways
      ST.blob(ctx, ST.ellipseRing(hx * 0.6, -h * 0.12, 14, 12, 8), C.INK, { lw: 3, seed: seed + 3 + i });
      ST.blob(ctx, ST.ellipseRing(hx * 0.6, -h * 0.12 + 1, 10, 8, 8), C.EYE, { lw: 0, seed: seed + 5 + i });
      ctx.fillStyle = C.INK;
      ctx.fillRect(hx * 0.6 + (holes === 'left' ? -8 : 3), -h * 0.12 - 2, 5, 5);
    });
  });
  // submarine sandwich held at the middle; bite = a bite missing at the +x end
  ST.sandwich = (ctx, x, y, rot, seed, bite) => at(ctx, x, y, rot, 1, () => {
    ST.stroke(ctx, [-76, 4, -30, 10, 20, 2, 70, 8], { w: 12, color: C.OLIVE, seed: seed + 1, taper: false });
    ST.stroke(ctx, [-70, 12, 0, 16, 64, 12], { w: 8, color: '#a8584a', seed: seed + 2, taper: false });
    const end = bite ? [64, -6, 50, 2, 58, 14] : [80, 0];
    ST.blob(ctx, [-82, 0, -70, -26, 0, -34, 70, -26].concat(end, [70, 24, 0, 30, -70, 24]), '#b8945c', { lw: 6, seed, shade: ['#8a6a3a', -8, 6], mottle: ['rgba(90,60,20,0.3)', 3, 8] });
    ST.stroke(ctx, [-80, 0, 0, -4, 76, 0], { w: 3.5, seed: seed + 3 });
  });
  ST.cigar = (ctx, x, y, ang, seed, lit) => at(ctx, x, y, ang, 1, () => {
    ST.tube(ctx, [0, 0, 70, 0], [16, 13], '#5a3a22', { lw: 4.5, seed, shade: ['#3c2616', 0, 4] });
    ST.rect(ctx, 12, -9, 12, 18, C.GOLD_D, { seed: seed + 1, lw: 3, amp: 0.5 });
    ST.blob(ctx, ST.ellipseRing(72, 0, 5, 7, 6), lit ? C.FIRE : '#7d756a', { lw: 3, seed: seed + 2 });
  });
  // a desk calculator (display with flat bars, no digits)
  ST.calculator = (ctx, x, y, k, rot, seed) => at(ctx, x, y, rot, k, () => {
    ST.rect(ctx, -46, -66, 92, 132, '#3b3833', { seed, lw: 5, amp: 1, shade: ['#26231f', -6, 4] });
    ST.rect(ctx, -36, -56, 72, 26, '#5d6b52', { seed: seed + 1, lw: 3, amp: 0.5 });
    ctx.fillStyle = 'rgba(30,40,24,0.7)';
    for (let i = 0; i < 4; i++) ctx.fillRect(-26 + i * 15, -48, 10, 12);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) ST.rect(ctx, -34 + c * 24, -20 + r * 20, 18, 14, r === 3 && c === 2 ? C.CLAY : '#9a958a', { seed: seed + 2 + r * 3 + c, lw: 2, amp: 0.5 });
  });
  ST.binoculars = (ctx, x, y, k, seed) => at(ctx, x, y, 0, k, () => {
    [-24, 24].forEach((dx, i) => { ST.rect(ctx, dx - 18, -28, 36, 56, C.BLACK, { seed: seed + i, lw: 5, amp: 1 }); ST.blob(ctx, ST.ellipseRing(dx, -30, 16, 7, 8), '#3c4a4c', { lw: 4, seed: seed + 3 + i, light: ['rgba(220,230,220,0.4)', 3, -2] }); });
    ST.rect(ctx, -8, -12, 16, 20, C.BLACK_D, { seed: seed + 5, lw: 3, amp: 0.5 });
  });
  // a melting popsicle on its stick (grip at the stick)
  ST.popsicle = (ctx, x, y, ang, seed, melt) => at(ctx, x, y, ang, 1, () => {
    ST.rect(ctx, -8, -64, 16, 80, '#c2a878', { seed, lw: 3, amp: 0.5 });
    ST.blob(ctx, [-26, -60, -28, -130, -16, -146, 16, -146, 28, -130, 26, -60], '#b0607a', { lw: 5, seed: seed + 1, shade: ['#86465c', -6, 4], light: ['rgba(240,200,210,0.4)', 4, -4] });
    ST.stroke(ctx, [-12, -120, -10, -80], { w: 3, color: 'rgba(250,220,230,0.6)', seed: seed + 3, taper: false });
    if (melt) ST.blob(ctx, [10, -62, 18, -62, 16, -46 + melt * 30, 13, -40 + melt * 30, 10, -46 + melt * 30], '#b0607a', { lw: 3, seed: seed + 2 });
  });
  // car key on a ring with a little plastic palm-tree fob
  ST.carKey = (ctx, x, y, ang, seed) => at(ctx, x, y, ang, 1, () => {
    ST.blob(ctx, ST.ellipseRing(-10, 0, 14, 14, 8), 'rgba(0,0,0,0)', { lw: 4, seed, lineColor: C.STONE_D });
    ST.rough(ctx, [4, -10, 30, -10, 30, 10, 4, 10], C.BLACK, { seed: seed + 1, lw: 3, amp: 0.5 });
    ST.rough(ctx, [30, -5, 70, -5, 70, 0, 64, 2, 60, 5, 30, 5], ST.METAL || '#8e8b7e', { seed: seed + 2, lw: 3, amp: 0.5 });
    ST.blob(ctx, [-14, 10, -4, 10, -2, 40, -16, 40], '#5f8a84', { lw: 3, seed: seed + 3 });
  });

  ST.METAL = '#8e8b7e';
  ST.METAL_D = '#636157';
  // a screen angle for a prop drawn inside a (possibly mirrored) figure
  ST.figAng = (mir, a) => (mir ? Math.PI - a : a);
  // body-space wrist target that projects onto world point (wx, wy); free = the coordinate the view cannot see
  ST.reachTo = (p, wx, wy, free) => {
    const V = ST.view(p.yaw || 0), a = (DEG[V.v] * Math.PI) / 180, fx = ((wx - p.x) / p.s) * (V.mir ? -1 : 1), fy = (wy - p.y) / p.s;
    if (V.v === 0 || V.v === 3) { const x = (V.v === 0 ? fx : -fx) * (V.mir ? -1 : 1); return [x, fy, free]; }
    const x = V.mir ? -free : free;
    return [free, fy, (fx - x * Math.cos(a)) / Math.sin(a)];
  };
  // figure-space point -> world and back (no lean)
  ST.toWorld = (p, q) => [p.x + p.s * q[0] * (ST.view(p.yaw || 0).mir ? -1 : 1), p.y + p.s * q[1]];
  ST.toFig = (p, w) => [((w[0] - p.x) / p.s) * (ST.view(p.yaw || 0).mir ? -1 : 1), (w[1] - p.y) / p.s];
})();

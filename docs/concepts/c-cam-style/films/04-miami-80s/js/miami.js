/* Miami set brushes (no characters): Art Deco hotel front (eyebrow ledges, racing stripes, a stepped fin with the sign,
   window AC boxes, peeling pastel), neon tube, palm tree, the borrowed white sports car, the agent's beige sedan, the
   speedboat and a rowboat, flat sea bands, dock planks, venetian blinds, ceiling fan, CRT TV, plastic flamingo,
   fluorescent tube, wall clock, chest freezer full of frosted cash, mounted swordfish, cell bars. The pastels are faded
   and dirty on purpose: nothing clean, nothing pure. All flat shapes; animation only by t on twos. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const MI = (ST.MIAMI = {
    PINK: '#b08680', PINK_D: '#86625e', TEAL: '#5a827c', TEAL_D: '#3f5f5a', MINT: '#9aa98c', PEACH: '#b8906a', SAND: '#b3a27c',
    NEON_P: '#d0718c', NEON_T: '#6fb0a6', ASPHALT: '#3b3a37', WHITE: '#c6bea2', WHITE_D: '#968f76',
  });

  // neon tube along pts: a stepped halo (two flat translucent strokes) + the tube + a pale core. on = lit
  ST.neon = (ctx, pts, col, on, seed) => {
    if (on) [[34, 0.1], [18, 0.16]].forEach(([w, a], i) => ST.stroke(ctx, pts, { w, color: col.replace('rgb', 'rgba').replace(')', `,${a})`), seed: seed + i, taper: false }));
    ST.stroke(ctx, pts, { w: 9, color: on ? col : '#5a4a4c', seed: seed + 2, taper: false });
    if (on) ST.stroke(ctx, pts, { w: 3, color: 'rgba(250,235,230,0.8)', seed: seed + 3, taper: false });
  };
  const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)})`;
  ST.rgb = rgb;

  // Art Deco hotel front. o: { seed, col, colD, trim, night (lit windows, lit sign), flicker (t: one letter stutters), fin (x), finRise }
  ST.decoFacade = (ctx, x, base, w, h, o) => {
    const seed = o.seed || 1, col = o.col || MI.PINK, colD = o.colD || MI.PINK_D, trim = o.trim || MI.TEAL, top = base - h;
    ST.rough(ctx, [x, base, x + w, base, x + w, top + 40, x + w - 40, top, x, top], col, { seed, lw: 7, amp: 4, shade: [colD, -36, 0], mottle: ['rgba(70,40,30,0.22)', 10, 70], hatch: { c: 'rgba(60,34,26,0.35)', n: 12, len: 50, gap: 8, k: 3, ang: 82 } });
    [0.18, 0.21, 0.24].forEach((k, i) => ST.rect(ctx, x, top + h * k, w, 12, i === 1 ? trim : colD, { seed: seed + 2 + i, lw: 3, amp: 1.5 })); // racing stripes
    const rows = 3, cols = Math.max(3, Math.round(w / 230));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const wx = x + 70 + c * ((w - 140) / cols), wy = top + h * 0.32 + r * h * 0.19, ww = (w - 140) / cols - 70;
      const lit = o.night && ST.hash(seed, r, c) < 0.45;
      ST.rect(ctx, wx, wy, ww, h * 0.11, lit ? '#b98d4a' : '#2c2a27', { seed: seed + 10 + r * 9 + c, lw: 5, amp: 1.5 });
      ST.rough(ctx, [wx - 16, wy - 10, wx + ww + 16, wy - 10, wx + ww + 24, wy + 2, wx - 24, wy + 2], colD, { seed: seed + 40 + r * 9 + c, lw: 4, amp: 1, shade: ['rgba(0,0,0,0.3)', 0, 6] }); // eyebrow ledge
      if (ST.hash(seed, r, c, 5) < 0.3) { // a rattling window AC box
        ST.rect(ctx, wx + ww * 0.55, wy + h * 0.06, ww * 0.38, h * 0.06, '#8d8a7c', { seed: seed + 70 + r * 9 + c, lw: 4, amp: 1, hatch: { c: 'rgba(30,30,24,0.6)', n: 2, len: 20, gap: 4, k: 3, ang: 0, bend: 0 } });
        ST.stain(ctx, wx + ww * 0.74, wy + h * 0.14, 30, 60, seed + 90 + r + c, 'rgba(60,40,30,0.3)');
      }
    }
    for (let i = 0; i < 6; i++) ST.stain(ctx, x + w * ST.rnd(0.05, 0.95, seed, i, 1), top + h * ST.rnd(0.3, 0.95, seed, i, 2), 60 + 80 * ST.hash(seed, i, 3), 50 + 60 * ST.hash(seed, i, 4), seed + 100 + i, 'rgba(60,40,30,0.25)');
    [0, 1, 2].forEach((k) => ST.peel(ctx, x + w * ST.rnd(0.08, 0.85, seed, k, 6), top + h * ST.rnd(0.35, 0.85, seed, k, 7), 50 + 30 * k, 36 + 10 * k, seed + 110 + k));
    ST.crack(ctx, x + w * 0.3, top + 30, 140, seed + 120, 1.4);
    // the stepped fin running down the front, the sign letters stacked on it
    const fx = o.fin === undefined ? x + w * 0.5 : o.fin, ft = top - (o.finRise === undefined ? h * 0.28 : o.finRise);
    const sign = o.sign || 'HOTEL', n = sign.length, fb = ft + 110 + n * 64;
    ST.rough(ctx, [fx - 56, fb, fx - 56, ft + 70, fx - 40, ft + 70, fx - 40, ft + 30, fx - 22, ft + 30, fx - 22, ft, fx + 22, ft, fx + 22, ft + 30, fx + 40, ft + 30, fx + 40, ft + 70, fx + 56, ft + 70, fx + 56, fb], colD, { seed: seed + 130, lw: 6, shade: ['rgba(0,0,0,0.25)', -18, 0], hatch: { c: 'rgba(40,24,20,0.35)', n: 3, len: 40, gap: 6, k: 3, ang: 85 } });
    [...sign].forEach((ch, i) => {
      const lit = o.night && !(i === 1 && Math.floor(ST.twos(o.flicker || 0) * 6) % 5 === 0);
      ST.label(ctx, ch, fx, ft + 110 + i * 64, { size: 52, fill: lit ? '#f0c8d0' : '#6a5458', stroke: lit ? MI.NEON_P : '#3a2c2e', lw: 9, font: "bold 52px Impact, 'Arial Black', sans-serif" });
    });
    return { top, fin: fx };
  };

  ST.palmTree = (ctx, x, base, h, seed, lean, t, dark) => {
    const l = lean || 0, tx = x + l, ty = base - h, sw = Math.sin(ST.twos(t || 0) * 2 + seed) * 6;
    ST.tube(ctx, [x, base, x + l * 0.3, base - h * 0.4, x + l * 0.75, base - h * 0.75, tx, ty], [34, 28, 24, 20], dark ? '#1c1a1c' : '#6e5a42', { lw: dark ? 0 : 5, seed, hatch: dark ? null : { c: 'rgba(30,20,10,0.55)', n: 8, len: 22, gap: 4, k: 2, ang: 0, bend: 0.2 } });
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.42 + sw * 0.01, L = h * (0.32 + 0.1 * ST.hash(seed, i)), ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.6 + L * 0.35;
      ST.blob(ctx, [tx, ty, (tx + ex) / 2 + Math.sin(a) * 18, (ty + ey) / 2 - 30, ex, ey, (tx + ex) / 2 - Math.sin(a) * 8, (ty + ey) / 2 + 4], dark ? '#1c1a1c' : i % 2 ? '#4b5a34' : '#3d4a2b', { lw: dark ? 0 : 4.5, seed: seed + 10 + i, hatch: dark ? null : { c: 'rgba(20,24,10,0.5)', n: 2, len: 30, gap: 5, k: 3, ang: (a * 180) / Math.PI + 60 } });
    }
  };

  // the borrowed white sports car, side view facing +x, wheels on y. o: { smoke 0..1, t, shake, rust, lamp 0..1 (the pop-up light half up) }.
  // inside() draws the driver in WORLD space, clipped to the side window.
  ST.sportsCar = (ctx, x, y, k, seed, o) => {
    o = o || {};
    const T0 = ctx.getTransform();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    const shake = o.shake ? (Math.floor(ST.twos(o.t || 0) * 12) % 2) * 3 : 0;
    ctx.translate(0, -shake);
    ST.blob(ctx, ST.ellipseRing(0, 6 + shake, 360, 22, 12), 'rgba(20,16,12,0.45)', { lw: 0, seed: seed + 1 });
    ST.rough(ctx, [-340, -40, -320, -96, -220, -100, -150, -176, 40, -176, 130, -96, 300, -80, 350, -50, 346, -12, -336, -10], MI.WHITE, {
      seed: seed + 3, lw: 7, amp: 2, shade: [MI.WHITE_D, 0, 14], light: ['rgba(250,245,225,0.35)', 0, -8], mottle: ['rgba(90,80,60,0.2)', 4, 30],
    });
    // the side window: dark cabin, the driver (clipped to the glass), then the glass glare
    const WIN = [-136, -166, 30, -166, 104, -100, -196, -100];
    ctx.save();
    ST.path(ctx, WIN, true);
    ctx.clip();
    ctx.fillStyle = '#23211f';
    ctx.fillRect(-220, -180, 340, 90);
    if (o.inside) { ctx.save(); ctx.setTransform(T0); o.inside(); ctx.restore(); }
    ctx.restore();
    ST.blob(ctx, WIN, 'rgba(150,160,150,0.12)', { sharp: true, lw: 5, seed: seed + 4 });
    ST.stroke(ctx, [-30, -160, -90, -104], { w: 6, color: 'rgba(240,240,225,0.35)', seed: seed + 5, taper: false });
    ST.stroke(ctx, [-330, -56, 340, -44], { w: 10, color: C.BLACK, seed: seed + 6, taper: false }); // side stripe
    ST.stroke(ctx, [-40, -96, -36, -16], { w: 3.5, seed: seed + 7 }); // door seam
    if (o.lamp) { // the pop-up headlight: one side only, half way, then it droops
      ST.blob(ctx, ST.ellipseRing(300, -84, 22, 14, 8), '#8f8b7c', { lw: 3.5, seed: seed + 15 });
      ctx.save(); ctx.translate(280, -76); ctx.rotate(-o.lamp * 1.1); ST.rect(ctx, 0, -12, 54, 14, MI.WHITE, { seed: seed + 8, lw: 3.5, amp: 0.5 }); ctx.restore();
    } else ST.rect(ctx, 280, -76, 50, 12, '#2d2b28', { seed: seed + 8, lw: 3, amp: 0.5 }); // pop-up lamp lid
    if (o.rust !== false) { ST.stain(ctx, -280, -30, 60, 26, seed + 9, 'rgba(120,60,30,0.5)'); ST.blob(ctx, [150, -60, 190, -64, 196, -40, 160, -36], 'rgba(0,0,0,0.12)', { lw: 3, seed: seed + 10 }); }
    [-230, 230].forEach((wx, i) => {
      ST.blob(ctx, ST.ellipseRing(wx, -16, 62, 62, 14), '#1a1816', { lw: 6, seed: seed + 11 + i });
      ST.blob(ctx, ST.ellipseRing(wx, -16, 30, 30, 10), '#8f8b7c', { lw: 4, seed: seed + 13 + i, shade: ['#5f5c52', -4, 4] });
    });
    if (o.smoke) for (let i = 0; i < 5; i++) {
      const ph = (ST.twos(o.t || 0) * 0.8 + i * 0.2) % 1, r = (10 + 24 * ph) * o.smoke;
      ST.blob(ctx, ST.ellipseRing(250 + i * 10 + ph * 30, -96 - ph * 160, r, r * 0.8, 9), i % 2 ? 'rgba(170,165,150,0.7)' : 'rgba(130,126,114,0.7)', { lw: 2.5, seed: seed + 20 + i, lineColor: 'rgba(40,36,30,0.7)' });
    }
    ctx.restore();
  };
  // the agent's beige sedan (side view facing -x)
  ST.sedan = (ctx, x, y, k, seed) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ST.blob(ctx, ST.ellipseRing(0, 6, 360, 22, 12), 'rgba(20,16,12,0.45)', { lw: 0, seed });
    ST.rough(ctx, [-320, -110, -200, -200, 160, -200, 250, -110, 330, -100, 340, -16, -340, -16, -340, -100], '#a79a76', { seed: seed + 1, lw: 7, amp: 2, shade: ['#7a7055', 0, 14], mottle: ['rgba(60,50,30,0.25)', 4, 30] });
    ST.rough(ctx, [-180, -190, -20, -190, -20, -116, -230, -116], '#2a2824', { seed: seed + 2, lw: 5, amp: 1 });
    ST.rough(ctx, [0, -190, 150, -190, 220, -116, 0, -116], '#2a2824', { seed: seed + 3, lw: 5, amp: 1 });
    [-220, 220].forEach((wx, i) => { ST.blob(ctx, ST.ellipseRing(wx, -16, 56, 56, 14), '#1a1816', { lw: 6, seed: seed + 4 + i }); ST.blob(ctx, ST.ellipseRing(wx, -16, 26, 26, 10), '#8f8b7c', { lw: 4, seed: seed + 6 + i }); });
    ST.rect(ctx, -346, -76, 40, 22, '#cfc6a6', { seed: seed + 8, lw: 3, amp: 0.5 });
    ST.stroke(ctx, [-20, -112, -16, -24], { w: 3.5, seed: seed + 9 });
    ctx.restore();
  };

  // speedboat, side view facing +x, waterline at y. o: { t, bob, spray 0..1, inside() (people in the cockpit) }
  ST.speedboat = (ctx, x, y, k, seed, o) => {
    o = o || {};
    const bob = o.bob ? Math.sin(ST.twos(o.t || 0) * 3) * 6 : 0, tilt = o.lift || 0, T0 = ctx.getTransform();
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(k, k);
    ctx.rotate(-tilt);
    ST.rect(ctx, -392, -200, 46, 170, '#2a2826', { seed: seed + 1, lw: 5, amp: 1 }); // outboard
    ST.rough(ctx, [40, -128, 92, -206, 146, -206, 132, -128], 'rgba(150,170,160,0.35)', { seed: seed + 4, lw: 5, amp: 1 }); // windscreen
    if (o.inside) { ctx.save(); ctx.setTransform(T0); o.inside(bob); ctx.restore(); }
    ST.blob(ctx, [-360, -130, 280, -130, 440, -98, 340, 12, -340, 12], MI.WHITE, { sharp: true, lw: 7, seed: seed + 2, shade: [MI.WHITE_D, 0, 16], mottle: ['rgba(90,80,60,0.2)', 3, 30] });
    ST.stroke(ctx, [-356, -66, 300, -66, 400, -84], { w: 16, color: MI.TEAL, seed: seed + 3, taper: false });
    ST.stroke(ctx, [-356, -40, 330, -40], { w: 6, color: MI.TEAL_D, seed: seed + 6, taper: false });
    ST.stain(ctx, -200, -20, 140, 24, seed + 5, 'rgba(70,60,40,0.3)');
    if (o.spray) for (let i = 0; i < 6; i++) ST.blob(ctx, ST.ellipseRing(-400 - i * 44, -20 - 40 * ST.hash(seed, i, Math.floor(ST.twos(o.t || 0) * 12)), 30 * o.spray, 20 * o.spray, 8), '#c9cdc2', { lw: 3.5, seed: seed + 10 + i });
    ctx.restore();
  };
  ST.rowboat = (ctx, x, y, k, seed, t, inside) => {
    const bob = Math.sin(ST.twos(t || 0) * 2.4 + 1) * 5, T0 = ctx.getTransform();
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(k, k);
    if (inside) { ctx.save(); ctx.setTransform(T0); inside(bob); ctx.restore(); }
    ST.tube(ctx, [60, -110, 260, 30], [14, 12], C.TIMBER, { lw: 4, seed: seed + 2 }); // the oar
    ST.blob(ctx, [250, 20, 300, 50, 280, 70, 236, 40], C.TIMBER, { lw: 4, seed: seed + 3 });
    ST.blob(ctx, [-240, -110, 240, -110, 196, 12, -196, 12], '#6e5640', { sharp: true, lw: 7, seed, shade: [C.FUR_D, 0, 14], hatch: { c: 'rgba(30,20,10,0.5)', n: 5, len: 140, gap: 6, k: 2, ang: 0, bend: 0.02 } });
    ST.stroke(ctx, [-224, -76, 224, -76], { w: 4, seed: seed + 1 });
    ST.stroke(ctx, [-210, -40, 210, -40], { w: 4, seed: seed + 4 });
    ctx.restore();
  };

  // flat sea: bands with wavy seams that shift on twos; foam ticks
  ST.sea = (ctx, x0, y0, x1, y1, t, seed, cols) => {
    const tt = ST.twos(t || 0);
    ST.bands(ctx, x0, y0, x1, y1, cols || ['#4d6e6c', '#456361', '#3d5856', '#354c4a'], seed + tt * 0.6);
    ctx.strokeStyle = 'rgba(200,210,195,0.45)';
    ctx.lineWidth = 3 * ST.LW;
    ctx.beginPath();
    for (let i = 0; i < 30; i++) {
      const fx = x0 + ST.hash(seed, i, 1) * (x1 - x0) + ((tt * 30 * (1 + ST.hash(seed, i, 3))) % 80), fy = y0 + 20 + ST.hash(seed, i, 2) * (y1 - y0 - 40);
      ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + 14, fy - 6, fx + 30, fy);
    }
    ctx.stroke();
  };
  ST.planks = (ctx, x0, y0, x1, y1, seed, col) => {
    ST.rect(ctx, x0, y0, x1 - x0, y1 - y0, col || '#7a6448', { seed, lw: 6, shade: ['rgba(0,0,0,0.2)', 0, 20], hatch: { c: 'rgba(30,20,10,0.4)', n: 14, len: 120, gap: 5, k: 2, ang: 0, bend: 0.02 } });
    ctx.strokeStyle = 'rgba(30,22,12,0.7)';
    ctx.lineWidth = 3 * ST.LW;
    ctx.beginPath();
    for (let y = y0 + 40, r = 0; y < y1; y += 40 + r * 6, r++) { ctx.moveTo(x0, y); ctx.lineTo(x1, y + ST.rnd(-3, 3, seed, r)); }
    ctx.stroke();
  };

  // venetian blinds over a window rect. lift: [x, w, h] a slat gap held open by a finger (taskforce shot)
  ST.blinds = (ctx, x, y, w, h, seed, lift, slat) => {
    const sh = slat || 26;
    for (let i = 0, yy = y; yy < y + h; i++, yy += sh) {
      const gap = lift && yy > y + h * 0.4 && yy < y + h * 0.4 + lift[2];
      ST.rough(ctx, [x, yy, x + w, yy + 2, x + w, yy + sh - 6, x, yy + sh - 8], '#c2b898', { seed: seed + i, lw: 3, amp: 0.8, shade: ['#948b6f', 0, 5] });
      if (gap) ST.rect(ctx, lift[0] - lift[1] / 2, yy - 4, lift[1], sh + 8, '#ece3c4', { seed: seed + 50 + i, lw: 2.5, amp: 0.5 });
    }
    ST.stroke(ctx, [x + w * 0.2, y - 10, x + w * 0.2, y + h], { w: 3, color: '#6a6250', seed: seed + 90, taper: false });
    ST.stroke(ctx, [x + w * 0.8, y - 10, x + w * 0.8, y + h], { w: 3, color: '#6a6250', seed: seed + 91, taper: false });
  };
  ST.ceilingFan = (ctx, x, y, t, seed, k) => {
    const a = ST.twos(t || 0) * 2.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k || 1, k || 1);
    ST.stroke(ctx, [0, -300, 0, -20], { w: 8, color: '#3a332a', seed, taper: false });
    for (let i = 0; i < 4; i++) {
      const c = Math.cos(a + (i * Math.PI) / 2);
      ST.blob(ctx, [0, -6, c * 220, -12, c * 230, 8, 0, 8], '#5c4630', { sharp: true, lw: 4, seed: seed + 1 + i });
    }
    ST.blob(ctx, ST.ellipseRing(0, 0, 30, 18, 10), C.GOLD_D, { lw: 4, seed: seed + 6 });
    ctx.restore();
  };
  // CRT TV in a wood case with rabbit ears; screen(bb) paints the picture (clipped)
  ST.tvSet = (ctx, x, y, k, seed, screen) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    [-1, 1].forEach((s, i) => ST.stroke(ctx, [s * 20, -150, s * 90, -280], { w: 4, color: C.STONE_D, seed: seed + i, taper: false }));
    ST.rect(ctx, -150, -150, 300, 230, '#5a4130', { seed: seed + 2, lw: 7, shade: ['#3d2c20', -12, 6], hatch: { c: 'rgba(20,10,4,0.45)', n: 4, len: 60, gap: 5, k: 2, ang: 0, bend: 0.03 } });
    const bb = { x0: -128, y0: -128, x1: 70, y1: 58, w: 198, h: 186, cx: -29, cy: -35 };
    ctx.save();
    ST.path(ctx, ST.curve(ST.ellipseRing(bb.cx, bb.cy, 104, 96, 14), true, 6), true);
    ctx.clip();
    ctx.fillStyle = '#20231f';
    ctx.fillRect(bb.x0 - 10, bb.y0 - 10, bb.w + 20, bb.h + 20);
    if (screen) screen(bb);
    ctx.fillStyle = 'rgba(30,40,30,0.18)';
    for (let yy = bb.y0; yy < bb.y1; yy += 6) ctx.fillRect(bb.x0 - 10, yy, bb.w + 20, 2);
    ctx.restore();
    ST.inkLine(ctx, ST.curve(ST.ellipseRing(bb.cx, bb.cy, 104, 96, 14), true, 6), { w: 7, closed: true, seed: seed + 3 });
    [[110, -100], [110, -50]].forEach(([kx, ky], i) => ST.blob(ctx, ST.ellipseRing(kx, ky, 16, 16, 8), '#2a2420', { lw: 4, seed: seed + 4 + i }));
    ctx.restore();
  };
  ST.flamingo = (ctx, x, base, k, seed) => {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(k, k);
    ST.stroke(ctx, [-6, 0, -4, -120], { w: 4, color: '#3a3430', seed, taper: false });
    ST.stroke(ctx, [8, 0, 6, -120], { w: 4, color: '#3a3430', seed: seed + 1, taper: false });
    ST.blob(ctx, [-50, -150, 0, -180, 50, -160, 40, -120, -20, -116], MI.NEON_P, { lw: 5, seed: seed + 2, shade: ['#9a4e64', -6, 6] });
    ST.tube(ctx, [30, -160, 50, -230, 30, -270, 56, -280], [14, 12, 12, 12], MI.NEON_P, { lw: 4.5, seed: seed + 3 });
    ST.blob(ctx, [56, -288, 80, -280, 74, -266, 58, -268], C.INK, { lw: 3, seed: seed + 4 });
    ctx.restore();
  };
  // fluorescent ceiling tube; on = lit (flicker is decided by the caller)
  ST.fluoro = (ctx, x, y, w, on, seed) => {
    if (on) ST.pool(ctx, x, y + 60, w * 0.8, 140, '#d8e0cc', 0.06);
    ST.rect(ctx, x - w / 2, y - 20, w, 34, '#7d7b72', { seed, lw: 5, amp: 1 });
    ST.rect(ctx, x - w / 2 + 14, y + 6, w - 28, 18, on ? '#dfe6d4' : '#8a8f84', { seed: seed + 1, lw: 3.5, amp: 0.5 });
  };
  ST.wallClock = (ctx, x, y, r, minutes, seed) => {
    ST.blob(ctx, ST.ellipseRing(x, y, r, r, 16), '#c9bf9c', { lw: 7, seed, shade: ['#9a9277', -6, 6] });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ST.stroke(ctx, [x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9], { w: 3.5, seed: seed + 1 + i, taper: false }); }
    const ma = (minutes / 60) * Math.PI * 2 - Math.PI / 2, ha = ((minutes / 60 + 3) / 12) * Math.PI * 2 - Math.PI / 2;
    ST.stroke(ctx, [x, y, x + Math.cos(ha) * r * 0.5, y + Math.sin(ha) * r * 0.5], { w: 8, seed: seed + 20, taper: false });
    ST.stroke(ctx, [x, y, x + Math.cos(ma) * r * 0.8, y + Math.sin(ma) * r * 0.8], { w: 5, seed: seed + 21, taper: false });
  };
  // chest freezer: white enamel, lid angle open 0..1; inside: frosted cash bricks and cold mist
  ST.freezer = (ctx, x, y, w, h, open, seed, t) => {
    const lid = open || 0;
    if (lid > 0.05) {
      ST.rough(ctx, [x, y, x + w, y, x + w - 20, y - h * 0.9 * lid, x + 20, y - h * 0.9 * lid], '#b8b4a0', { seed: seed + 1, lw: 6, amp: 1, shade: ['#8e8a76', 0, 10] });
      ST.rect(ctx, x + 16, y - 6, w - 32, 30, '#4a5a5a', { seed: seed + 2, lw: 4, amp: 1 });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - (r === 2 ? 1 : 0); c++) ST.cashBrick(ctx, x + 70 + c * ((w - 120) / 3) + (r % 2) * 40, y - 6 - r * 24, 104, 26, ST.rnd(-0.08, 0.08, seed, r, c), seed + 10 + r * 5 + c, true); // stuffed past the rim
      const tt = ST.twos(t || 0);
      for (let i = 0; i < 4; i++) { const ph = (tt * 0.7 + i * 0.25) % 1; ST.stroke(ctx, [x + w * (0.2 + i * 0.2), y - 20 - ph * 120, x + w * (0.25 + i * 0.2), y - 60 - ph * 120, x + w * (0.2 + i * 0.2), y - 100 - ph * 120], { w: 5, color: `rgba(220,228,220,${0.6 * (1 - ph)})`, seed: seed + 30 + i, taper: false }); }
    }
    ST.rough(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], '#bdb8a2', { seed, lw: 7, amp: 2, shade: ['#8e8a76', -20, 0], mottle: ['rgba(100,90,60,0.25)', 4, 30], hatch: { c: 'rgba(50,46,30,0.3)', n: 4, len: 40, gap: 7, k: 3, ang: 80 } });
    if (lid <= 0.05) ST.rect(ctx, x - 6, y - 16, w + 12, 24, '#c6c1aa', { seed: seed + 3, lw: 5, amp: 1 });
    ST.rect(ctx, x + w * 0.4, y + 20, w * 0.2, 12, C.STONE_D, { seed: seed + 4, lw: 3, amp: 0.5 });
    ST.stain(ctx, x + w * 0.2, y + h * 0.7, 60, 30, seed + 5, 'rgba(90,70,30,0.35)');
  };
  ST.swordfish = (ctx, x, y, k, seed) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ST.rect(ctx, -60, -40, 120, 80, '#4a3424', { seed, lw: 5 }); // plaque
    ST.blob(ctx, [-240, 0, -150, -40, 60, -46, 170, -10, 180, 6, 60, 30, -150, 30], '#5c727a', { lw: 6, seed: seed + 1, shade: ['#3e4f55', 0, 10], light: ['rgba(200,210,200,0.3)', 0, -6] });
    ST.stroke(ctx, [170, -4, 380, -10], { w: 7, color: '#4a5c62', seed: seed + 2 }); // the bill
    ST.blob(ctx, [-240, 0, -310, -70, -290, 0, -310, 66], '#4e636a', { sharp: true, lw: 5, seed: seed + 3 });
    ST.blob(ctx, [-60, -44, -20, -120, 30, -44], '#4e636a', { sharp: true, lw: 5, seed: seed + 4 });
    ST.blob(ctx, ST.ellipseRing(130, -8, 8, 8, 6), C.EYE, { lw: 3, seed: seed + 5 });
    ctx.fillStyle = C.INK; ctx.fillRect(130, -10, 4, 4);
    ctx.restore();
  };
  ST.cellBars = (ctx, x0, y0, x1, y1, seed, gap) => {
    for (let x = x0, i = 0; x <= x1; x += gap || 120, i++) ST.tube(ctx, [x, y0, x + ST.rnd(-3, 3, seed, i), y1], [26, 26], '#4c4f4a', { lw: 6, seed: seed + i, shade: ['#2e302c', -8, 0], light: ['rgba(200,205,190,0.25)', 6, 0] });
    [y0 + 60, y1 - 120].forEach((yy, i) => ST.rect(ctx, x0 - 40, yy, x1 - x0 + 80, 30, '#4c4f4a', { seed: seed + 50 + i, lw: 6, amp: 1 }));
  };
})();

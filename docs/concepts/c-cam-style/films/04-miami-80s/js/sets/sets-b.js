/* Sets B - the same hotel by day (faded pink front, the porch of retirees in lawn chairs, the bus stop, the car at the
   kerb), the bus (a bench along the windows, the city sliding past), the boss's back office (wood panelling, swordfish,
   clock, blinds, the chest freezer, the desk) and the street seen through a gap in its blinds (the agent's sedan). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, MI = ST.MIAMI;
  ST.PORCH_CHAIRS = [120, 330, 560, 1290, 1500];

  ST.lawnChair = (ctx, x, base, seed) => {
    ST.rough(ctx, [x - 54, base - 250, x + 54, base - 250, x + 58, base - 120, x - 58, base - 120], 'rgba(120,150,140,0.85)', { seed, lw: 5, amp: 1, inner: (bb) => { ctx.fillStyle = 'rgba(210,200,170,0.5)'; for (let y = bb.y0 + 10; y < bb.y1; y += 22) ctx.fillRect(bb.x0, y, bb.w, 8); } });
    ST.stroke(ctx, [x - 58, base - 250, x - 60, base], { w: 5, color: ST.METAL, seed: seed + 1, taper: false });
    ST.stroke(ctx, [x + 58, base - 250, x + 60, base], { w: 5, color: ST.METAL, seed: seed + 2, taper: false });
  };
  ST.busStop = (ctx, x, base, seed) => {
    ST.stroke(ctx, [x, base, x, base - 420], { w: 10, color: '#4c4f4a', seed, taper: false });
    ST.rect(ctx, x - 60, base - 470, 120, 90, '#c9bf9c', { seed: seed + 1, lw: 5, amp: 1 });
    ST.rect(ctx, x - 40, base - 452, 80, 40, MI.TEAL_D, { seed: seed + 2, lw: 3, amp: 0.5 }); // a bus pictogram
    [-22, 22].forEach((d, i) => ST.blob(ctx, ST.ellipseRing(x + d, base - 410, 8, 8, 6), C.INK, { lw: 0, seed: seed + 3 + i }));
  };

  ST.setPorch = (ctx, t) => {
    ST.bands(ctx, -400, -400, 2400, 300, ['#c9bf9e', '#c2b693', '#b9ab86'], 5.1);
    ST.decoFacade(ctx, -700, 760, 860, 560, { seed: 140, col: MI.MINT, colD: '#76846a', trim: MI.PINK_D, fin: -200, finRise: 60, sign: 'INN' });
    ST.decoFacade(ctx, 1760, 760, 900, 600, { seed: 160, col: MI.PEACH, colD: '#8a6a4a', trim: MI.TEAL_D, fin: 2200, finRise: 60, sign: 'BAR' });
    ST.palmTree(ctx, -120, 760, 900, 101, 80, t, false);
    ST.pool(ctx, 960, 560, 1200, 520, C.FIRE, 0.07);
    ST.decoFacade(ctx, 140, 760, 1640, 660, { seed: 102, col: MI.PINK, colD: MI.PINK_D, trim: MI.TEAL, fin: 1640, finRise: 110 });
    ST.rect(ctx, 870, 520, 180, 240, '#2b2724', { seed: 103, lw: 7, amp: 1.5 }); // the open door
    ST.rough(ctx, [820, 480, 1100, 480, 1124, 524, 796, 524], MI.TEAL_D, { seed: 104, lw: 6, amp: 1.5, shade: ['#2a403c', 0, 10] });
    ST.rect(ctx, -400, 740, 2800, 40, '#b8ae92', { seed: 105, lw: 5, hatch: { c: 'rgba(60,50,30,0.35)', n: 10, len: 30, gap: 6, k: 2, ang: 90, bend: 0 } }); // terrace tiles
    ST.PORCH_CHAIRS.forEach((x, i) => ST.lawnChair(ctx, x, 770, 106 + i * 3));
    ST.palmTree(ctx, 2000, 840, 980, 120, -70, t, false);
    ST.rect(ctx, -400, 810, 2800, 100, '#9a9282', { seed: 121, lw: 5, hatch: { c: 'rgba(40,36,28,0.35)', n: 10, len: 50, gap: 9, k: 2, ang: 0, bend: 0 } });
    ST.rect(ctx, -400, 905, 2800, 18, '#b4ac98', { seed: 122, lw: 4 });
    ST.rect(ctx, -400, 920, 2800, 600, '#5c5a54', { seed: 123, lw: 0, mottle: ['rgba(30,28,24,0.25)', 8, 90] });
    ST.crack(ctx, 300, 1000, 260, 124, 0.3);
    ST.crack(ctx, 1500, 1080, 220, 125, -0.2);
    ST.busStop(ctx, 120, 900, 126);
  };
  // the porch's low front wall (hides the seated legs) and the steps; the plastic flamingo stands on it
  ST.porchFront = (ctx) => {
    [[-400, 860], [1060, 1340]].forEach(([x, w], i) => ST.rough(ctx, [x, 730, x + w, 730, x + w, 815, x, 815], MI.MINT, { seed: 130 + i, lw: 6, amp: 1.5, shade: ['#76846a', 0, 12], mottle: ['rgba(60,60,40,0.25)', 6, 40] }));
    [0, 1].forEach((k) => ST.rect(ctx, 860 + k * 10, 760 + k * 26, 200 - k * 20, 26, '#a8a08a', { seed: 133 + k, lw: 4, amp: 1 }));
    ST.stain(ctx, 300, 790, 120, 30, 135, 'rgba(60,50,30,0.35)');
    ST.flamingo(ctx, 1760, 730, 0.75, 136);
  };

  // the bus: o: { scroll }
  ST.setBus = (ctx, t, o) => {
    const sc = (o && o.scroll) || 0;
    ST.rect(ctx, -400, -300, 2800, 1300, '#7a7766', { seed: 140, lw: 0, mottle: ['rgba(40,40,30,0.25)', 10, 90] });
    for (let i = 0; i < 5; i++) {
      const wx = -360 + i * 560;
      ST.rect(ctx, wx, 150, 500, 340, '#2a2924', { seed: 141 + i, lw: 7 });
      ctx.save(); ctx.beginPath(); ctx.rect(wx + 10, 160, 480, 320); ctx.clip();
      ST.bands(ctx, wx, 150, wx + 500, 360, ['#d0c7a8', '#c6bb98'], 3 + i);
      for (let b = -2; b < 6; b++) {
        const bx = wx + ((b * 260 - sc) % 1560 + 1560) % 1560 - 300, col = [MI.PINK, MI.MINT, MI.PEACH, MI.TEAL][(b + 8) % 4];
        ST.rect(ctx, bx, 230 + (b % 2) * 30, 220, 300, col, { seed: 150 + ((b + 8) % 4), lw: 5, amp: 1 });
        ctx.fillStyle = 'rgba(40,36,30,0.6)';
        for (let r = 0; r < 3; r++) ctx.fillRect(bx + 20, 270 + (b % 2) * 30 + r * 60, 180, 20);
      }
      ST.rect(ctx, wx, 420, 500, 80, '#77736a', { seed: 160 + i, lw: 0 });
      ctx.restore();
      ST.stroke(ctx, [wx + 30, 170, wx + 120, 300], { w: 8, color: 'rgba(255,250,230,0.18)', seed: 170 + i, taper: false });
    }
    for (let i = 0; i < 9; i++) ST.rect(ctx, -380 + i * 320, 60, 290, 70, [MI.TEAL_D, '#8a6a48', MI.PINK_D][i % 3], { seed: 180 + i, lw: 4, amp: 1 }); // ad cards (no words)
    ST.stroke(ctx, [-400, 30, 2400, 34], { w: 14, color: ST.METAL, seed: 190, taper: false });
    for (let i = 0; i < 10; i++) { const x = -300 + i * 270; ST.stroke(ctx, [x, 34, x, 110], { w: 5, color: C.BLACK, seed: 191 + i, taper: false }); ST.blob(ctx, ST.ellipseRing(x, 124, 18, 16, 8), 'rgba(0,0,0,0)', { lw: 5, seed: 201 + i }); }
    ctx.fillStyle = 'rgba(230,190,110,0.12)';
    for (let i = 0; i < 5; i++) { const wx = -360 + i * 560; ST.path(ctx, [wx + 40, 840, wx + 520, 840, wx + 620, 1300, wx + 140, 1300], true); ctx.fill(); }
    ST.rough(ctx, [-400, 500, 2400, 500, 2400, 690, -400, 690], '#4f6e6a', { seed: 210, lw: 7, amp: 2, shade: ['#3a5450', 0, 14], hatch: { c: 'rgba(20,30,28,0.45)', n: 14, len: 60, gap: 8, k: 3, ang: 90, bend: 0.02 } });
    ST.rect(ctx, -400, 820, 2800, 600, '#4a4740', { seed: 212, lw: 6, mottle: ['rgba(20,18,14,0.3)', 8, 80] });
  };
  ST.busSeat = (ctx) => ST.rough(ctx, [-400, 700, 2400, 700, 2400, 760, -400, 760], '#456360', { seed: 213, lw: 7, amp: 2, shade: ['#2f4644', 0, 12] });

  // the back office: o: { minutes (clock), lift [x, w, h] (a slat held open), lid (freezer 0..1) }
  ST.setOffice = (ctx, t, o) => {
    o = o || {};
    ST.rect(ctx, -400, -300, 2800, 1300, '#5e4632', { seed: 220, lw: 0, mottle: ['rgba(30,20,10,0.25)', 10, 90] });
    ctx.strokeStyle = 'rgba(25,16,8,0.6)';
    ctx.lineWidth = 4 * ST.LW;
    ctx.beginPath();
    for (let x = -380; x < 2400; x += 120) { ctx.moveTo(x, -300); ctx.lineTo(x + ST.rnd(-3, 3, 221, x), 900); }
    ctx.stroke();
    ST.rect(ctx, -400, -300, 2800, 300, '#4a3a2a', { seed: 222, lw: 6 });
    ST.rect(ctx, -400, 560, 2800, 30, '#3e2e20', { seed: 223, lw: 5 }); // dado rail
    ST.stain(ctx, 1900, 120, 200, 260, 224, 'rgba(20,12,4,0.35)');
    // window with blinds onto the street
    ST.rect(ctx, 1290, 150, 540, 500, '#2c241c', { seed: 225, lw: 8 });
    ctx.save(); ctx.beginPath(); ctx.rect(1302, 162, 516, 476); ctx.clip();
    ST.bands(ctx, 1290, 150, 1830, 650, ['#d3c9a8', '#c8bd98', '#bdb08a'], 4);
    ST.blinds(ctx, 1302, 162, 516, 476, 226, o.lift, 26);
    ctx.restore();
    ST.swordfish(ctx, 640, 250, 0.9, 230);
    ST.rough(ctx, [880, 170, 1150, 166, 1154, 360, 884, 364], '#3a2a1c', { seed: 236, lw: 6, amp: 1, inner: () => { ST.bands(ctx, 894, 180, 1140, 350, ['#8a6a7a', '#b0806a', '#4f706c'], 7); ST.blob(ctx, ST.ellipseRing(1016, 290, 30, 30, 10), '#c2985a', { lw: 0, seed: 237 }); } }); // a sunset painting
    ST.wallClock(ctx, 230, 210, 70, o.minutes || 0, 240);
    ST.ceilingFan(ctx, 960, 30, t, 260, 0.8);
    ST.rect(ctx, -400, 900, 2800, 600, '#4c5244', { seed: 270, lw: 6, mottle: ['rgba(20,24,16,0.3)', 9, 80] });
    ST.stain(ctx, 400, 1000, 260, 70, 271, 'rgba(20,16,8,0.4)');
    ST.rough(ctx, [1880, 520, 2140, 520, 2140, 940, 1880, 940], '#6c6a5c', { seed: 272, lw: 6, amp: 1.5, hatch: { c: 'rgba(20,20,14,0.4)', n: 3, len: 60, gap: 6, k: 2, ang: 0, bend: 0 } }); // filing cabinet
    [640, 760, 880].forEach((y, i) => ST.rect(ctx, 1960, y, 100, 14, ST.METAL, { seed: 273 + i, lw: 3, amp: 0.5 }));
    ST.pool(ctx, 900, 640, 700, 380, C.FIRE, 0.09);
    ST.rough(ctx, [770, 380, 1050, 380, 1080, 760, 740, 760], '#5a2a26', { seed: 276, lw: 7, amp: 2, shade: ['#3e1c18', -16, 0], hatch: { c: 'rgba(20,6,4,0.4)', n: 4, len: 50, gap: 6, k: 3, ang: 80 } }); // leather chair back
    ST.freezer(ctx, 40, 720, 440, 210, o.lid || 0, 280, t);
    // a potted palm
    ST.rough(ctx, [1660, 820, 1780, 820, 1764, 920, 1676, 920], '#7a4a32', { seed: 290, lw: 5, amp: 1 });
    ctx.save(); ctx.translate(1720, 830); ctx.scale(0.42, 0.42); ST.palmTree(ctx, 0, 0, 700, 291, 30, t, false); ctx.restore();
  };
  // the desk front down to the floor and what is on it (drawn after the boss)
  ST.deskFront = (ctx, t, o) => {
    o = o || {};
    ST.rough(ctx, [520, 700, 1300, 700, 1320, 744, 500, 744], '#3a2a1c', { seed: 300, lw: 7, amp: 1.5, light: ['rgba(200,160,110,0.2)', 0, -5] });
    ST.rough(ctx, [530, 744, 1290, 744, 1290, 990, 530, 990], '#4a3424', { seed: 301, lw: 7, amp: 2, shade: ['#33241a', 0, 18], hatch: { c: 'rgba(20,12,4,0.4)', n: 6, len: 80, gap: 6, k: 2, ang: 0, bend: 0.02 } });
    ST.rect(ctx, 820, 780, 180, 90, '#3e2c1e', { seed: 302, lw: 5, amp: 1 });
    ST.rough(ctx, [580, 690, 700, 686, 710, 702, 576, 706], '#c9bf9c', { seed: 303, lw: 3.5, amp: 1 }); // papers
    ST.blob(ctx, ST.ellipseRing(1180, 694, 40, 12, 10), '#6d6a5a', { lw: 4, seed: 304 }); // ashtray
    ST.rough(ctx, [1220, 650, 1270, 650, 1276, 700, 1214, 700], C.BLACK, { seed: 305, lw: 4, amp: 1 }); // phone
    ST.tube(ctx, [1230, 640, 1262, 640], [16, 16], C.BLACK, { lw: 4, seed: 306 });
    if (o.form) ST.rough(ctx, o.form, '#d2c9aa', { seed: 307, lw: 4, amp: 1, inner: (bb) => { ctx.fillStyle = 'rgba(60,54,40,0.55)'; for (let y = bb.y0 + 16; y < bb.y1 - 6; y += 14) ctx.fillRect(bb.x0 + 10, y, bb.w * 0.7, 3); } });
  };

  // the street outside the office, seen through a gap in the blinds: a beige sedan, the agent inside with his lunch
  ST.setStreetPOV = (ctx, t) => {
    ST.bands(ctx, -400, -300, 2400, 500, ['#d3c9a8', '#cbbf9a', '#c2b48c'], 6);
    ST.decoFacade(ctx, -300, 700, 1100, 560, { seed: 310, col: MI.MINT, colD: '#76846a', trim: MI.PINK_D, fin: 500, finRise: 60, sign: 'BAR' });
    ST.decoFacade(ctx, 900, 700, 1300, 620, { seed: 330, col: MI.PEACH, colD: '#8a6a4a', trim: MI.TEAL_D, fin: 1800, finRise: 80, sign: 'SHOP' });
    ST.pool(ctx, 960, 600, 1100, 400, C.FIRE, 0.07);
    ST.palmTree(ctx, 1520, 780, 760, 350, -40, t, false);
    ST.rect(ctx, -400, 700, 2800, 90, '#9a9282', { seed: 351, lw: 5 });
    ST.rect(ctx, -400, 786, 2800, 600, '#5c5a54', { seed: 352, lw: 0 });
    ST.sedan(ctx, 1180, 1000, 1.9, 353);
  };
})();

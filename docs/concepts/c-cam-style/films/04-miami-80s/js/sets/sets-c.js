/* Sets C - the marina at the end of the day (dock, pylons, a pelican, the borrowed speedboat), the open water where
   the boat dies, the courtroom (fluorescent tubes, the bench, the witness stand, the defence table) and the cell. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, MI = ST.MIAMI;

  ST.pelican = (ctx, x, y, k, seed, t) => {
    const nod = Math.floor(ST.twos(t || 0) * 2 + seed) % 5 === 0 ? 6 : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ST.blob(ctx, [-60, -10, -20, -60, 40, -50, 60, -10, 20, 20, -40, 16], '#8a8474', { lw: 5, seed, shade: ['#625d50', -6, 6], hatch: { c: 'rgba(40,36,28,0.45)', n: 3, len: 30, gap: 5, k: 3, ang: 20 } });
    ST.tube(ctx, [30, -46, 40, -100, 54, -116], [22, 18, 18], '#a29c8a', { lw: 4.5, seed: seed + 1 });
    ST.blob(ctx, [50, -124 + nod, 140, -96 + nod, 136, -84 + nod, 80, -78 + nod, 52, -100 + nod], '#b49c5e', { lw: 4, seed: seed + 2 });
    ST.blob(ctx, ST.ellipseRing(52, -116 + nod, 6, 6, 6), C.EYE, { lw: 2.5, seed: seed + 3 });
    ctx.fillStyle = C.INK; ctx.fillRect(52, -118 + nod, 3, 3);
    ctx.restore();
  };
  const pylon = (ctx, x, top, bottom, seed) => ST.tube(ctx, [x, top, x + 4, bottom], [40, 44], '#5a4632', { lw: 6, seed, hatch: { c: 'rgba(20,12,4,0.5)', n: 4, len: 40, gap: 5, k: 2, ang: 90, bend: 0.05 } });

  ST.setMarina = (ctx, t) => {
    ST.bands(ctx, -400, -400, 3200, 560, ['#b39c86', '#bf9f84', '#c8a684', '#b98f7a'], 8.2);
    ST.pool(ctx, 1640, 380, 700, 300, C.FIRE, 0.1);
    ST.blob(ctx, ST.ellipseRing(1640, 380, 70, 70, 14), '#ddb47a', { lw: 0, seed: 400 });
    for (let i = 0; i < 18; i++) { const bx = -380 + i * 200, bh = 60 + 140 * ST.hash(401, i); ST.rect(ctx, bx, 520 - bh, 150, bh + 10, '#8a7c78', { seed: 402 + i, lw: 0 }); } // the skyline, far
    ST.sea(ctx, -400, 510, 3200, 1400, t, 420);
    [[260, 600, 0.3], [620, 590, 0.24]].forEach(([x, y, k], i) => ST.speedboat(ctx, x, y, k, 430 + i * 10, { t, bob: true }));
    [100, 1340].forEach((x, i) => pylon(ctx, x, 380 + i * 10, 900, 450 + i));
    ST.pelican(ctx, 1340, 400, 0.9, 460, t);
  };
  ST.dock = (ctx) => {
    ST.planks(ctx, -400, 800, 1180, 1400, 470, '#7a6448');
    [-200, 300, 800].forEach((x, i) => ST.stroke(ctx, [x, 800, x + 6, 1400], { w: 5, seed: 471 + i, taper: false }));
    ST.rect(ctx, -400, 780, 1580, 30, '#5c4a34', { seed: 474, lw: 6 });
    ST.tube(ctx, [1060, 800, 1180, 860, 1300, 880], [12, 12, 12], '#9a8a62', { lw: 4, seed: 475 }); // the mooring rope
    ST.blob(ctx, ST.ellipseRing(1050, 806, 26, 12, 8), C.STONE_D, { lw: 4, seed: 476 }); // cleat
  };

  ST.setSea = (ctx, t) => {
    ST.bands(ctx, -400, -400, 2400, 460, ['#a9a088', '#b8ab8c', '#c4b48f'], 9.4);
    ST.pool(ctx, 1500, 260, 600, 260, C.FIRE, 0.08);
    for (let i = 0; i < 8; i++) ST.rect(ctx, -380 + i * 70, 430 - 30 * ST.hash(480, i), 50, 30 * ST.hash(480, i) + 6, '#8e8a7c', { seed: 481 + i, lw: 0 });
    ST.sea(ctx, -400, 440, 2400, 1400, t, 490, ['#577573', '#4d6a68', '#44605e', '#3b5452']);
    const tt = ST.twos(t || 0);
    [[1300, 200], [1420, 160]].forEach(([x, y], i) => { const f = Math.floor(tt * 6 + i) % 2 ? 10 : -6; ST.stroke(ctx, [x - 30, y + f, x, y, x + 30, y + f], { w: 5, seed: 495 + i }); }); // gulls
  };

  // the courtroom: o: { tubeOff: index of the flickering tube when it is off }
  ST.setCourt = (ctx, t, o) => {
    o = o || {};
    ST.rect(ctx, -400, -300, 2800, 1300, '#8a8470', { seed: 500, lw: 0, mottle: ['rgba(50,46,30,0.2)', 8, 90] });
    ST.rect(ctx, -400, 420, 2800, 500, '#6a5338', { seed: 501, lw: 6, hatch: { c: 'rgba(20,12,4,0.35)', n: 14, len: 90, gap: 6, k: 2, ang: 90, bend: 0 } });
    ST.rect(ctx, -400, -300, 2800, 260, '#9a9480', { seed: 502, lw: 6 });
    ST.stain(ctx, 300, 120, 200, 140, 503, 'rgba(60,54,30,0.3)');
    ST.rect(ctx, 1420, 130, 220, 150, '#6a5636', { seed: 504, lw: 6, shade: ['#4a3c26', -8, 8] }); // a plain plaque
    ST.wallClock(ctx, 1530, 205, 50, 22, 505);
    [400, 960, 1520].forEach((x, i) => ST.fluoro(ctx, x, -10, 380, i !== o.tubeOff, 510 + i));
    ST.rough(ctx, [620, 330, 1300, 330, 1320, 380, 600, 380], '#4a3424', { seed: 520, lw: 7, amp: 1.5 }); // bench top
    ST.rect(ctx, -400, 900, 2800, 600, '#4e4a40', { seed: 525, lw: 6, mottle: ['rgba(20,18,14,0.25)', 8, 80] });
  };
  ST.judgeBench = (ctx) => ST.rough(ctx, [600, 376, 1320, 376, 1320, 820, 600, 820], '#4f3a28', { seed: 521, lw: 7, amp: 2, shade: ['#36261a', -20, 0], hatch: { c: 'rgba(20,12,4,0.4)', n: 6, len: 90, gap: 6, k: 2, ang: 90, bend: 0 } });
  ST.witnessBox = (ctx) => ST.rough(ctx, [120, 640, 520, 640, 520, 900, 120, 900], '#5a4430', { seed: 522, lw: 7, amp: 2, shade: ['#3e2e20', -14, 0] });
  ST.defenceTable = (ctx) => {
    ST.rough(ctx, [1040, 800, 2000, 800, 2010, 840, 1030, 840], '#4a3424', { seed: 523, lw: 7, amp: 1.5 });
    ST.rough(ctx, [1050, 840, 1990, 840, 1990, 1100, 1050, 1100], '#5a4430', { seed: 524, lw: 7, amp: 2, shade: ['#3e2e20', 0, 16] });
    ST.rough(ctx, [1500, 790, 1640, 786, 1646, 802, 1496, 806], '#c9bf9c', { seed: 526, lw: 3.5, amp: 1 });
  };

  ST.setCell = (ctx, t) => {
    ST.rect(ctx, -400, -300, 2800, 1300, '#7f8a7c', { seed: 540, lw: 0 });
    ST.bricks(ctx, -400, -300, 2800, 1200, { bh: 70, bw: 150, seed: 541, line: 'rgba(30,34,28,0.45)', tone: 'rgba(0,0,0,0.08)', density: 0.2, lw: 3 });
    ST.stain(ctx, 1500, 200, 300, 260, 542, 'rgba(50,46,30,0.3)');
    ST.rect(ctx, 1240, 60, 300, 160, '#c9c0a2', { seed: 543, lw: 7 });
    for (let i = 0; i < 4; i++) ST.stroke(ctx, [1270 + i * 76, 64, 1272 + i * 76, 216], { w: 12, color: '#3a3c38', seed: 544 + i, taper: false });
    ctx.fillStyle = 'rgba(230,190,110,0.13)';
    for (let i = 0; i < 4; i++) { ST.path(ctx, [1270 + i * 76, 220, 1330 + i * 76, 220, 1050 + i * 120, 900, 960 + i * 120, 900], true); ctx.fill(); }
    ST.rect(ctx, -400, 880, 2800, 600, '#5a5a52', { seed: 548, lw: 6, mottle: ['rgba(20,20,16,0.25)', 8, 80] });
    ST.rough(ctx, [1100, 740, 1900, 740, 1900, 796, 1100, 796], '#6e7068', { seed: 549, lw: 6, amp: 1, shade: ['#4e5048', 0, 10] }); // the bunk
    ST.rough(ctx, [1120, 704, 1880, 700, 1880, 746, 1120, 750], '#9a9480', { seed: 550, lw: 5, amp: 2 }); // thin mattress
    [1120, 1880].forEach((x, i) => ST.stroke(ctx, [x, 796, x, 900], { w: 12, color: '#4e5048', seed: 551 + i, taper: false }));
    ST.crack(ctx, 300, 300, 200, 553, 1.0);
  };
})();

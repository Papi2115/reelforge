/* Sets C - close on the palace door: the heavy planked door in its stone arch, the keyhole where the mayor's key goes,
   the barred judas-window a cardinal glares through, and the carved stone over the door ("CUM CLAVE"). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;

  // door close-up; o: { keyhole: [x, y], planked, shake (px), carve: letters shown of "CUM CLAVE", grille: false }
  ST.setDoorClose = (ctx, t, o) => {
    o = o || {};
    ST.rect(ctx, -300, -300, 2520, 1700, '#6e6a60', { seed: 500, lw: 0, mottle: ['#656157', 8, 90] });
    ST.bricks(ctx, -300, -300, 2520, 1700, { bh: 80, bw: 190, seed: 501, density: 0.2, tone: 'rgba(0,0,0,0.1)' });
    ST.stain(ctx, 300, 600, 260, 300, 502, 'rgba(30,34,20,0.25)');
    ST.peel(ctx, 1640, 420, 150, 100, 503);
    ST.rough(ctx, [470, 1200, 470, 300, 560, 130, 960, 40, 1360, 130, 1450, 300, 1450, 1200], C.STONE_D, { seed: 504, lw: 8, hatch: { c: 'rgba(20,18,12,0.5)', n: 8, len: 50, gap: 8, k: 3, ang: 60 } });
    const sx = o.shake || 0;
    ctx.save();
    ctx.translate(sx, 0);
    ST.rough(ctx, [530, 1200, 530, 320, 610, 180, 960, 100, 1310, 180, 1390, 320, 1390, 1200], '#3e2e20', { seed: 505, lw: 8, hatch: { c: 'rgba(10,6,2,0.55)', n: 10, len: 300, gap: 12, k: 2, ang: 90, bend: 0 } });
    [700, 840, 1080, 1220].forEach((x, i) => ST.stroke(ctx, [x, 160 + Math.abs(960 - x) * 0.3, x + 2, 1200], { w: 5, color: '#241a12', seed: 506 + i, taper: false }));
    [420, 820].forEach((y, i) => {
      ST.stroke(ctx, [540, y, 1380, y + 4], { w: 22, color: '#2a2622', seed: 510 + i, taper: false });
      for (let k = 0; k < 8; k++) ST.blob(ctx, ST.ellipseRing(580 + k * 110, y + 1, 9, 9, 6), '#55524b', { lw: 3, seed: 512 + i * 10 + k });
    });
    if (o.grille !== false) ST.grilleFrame(ctx, 960, 270, 200, 130);
    const [kx, ky] = o.keyhole || [1180, 640];
    ST.rough(ctx, [kx - 46, ky - 70, kx + 46, ky - 70, kx + 46, ky + 70, kx - 46, ky + 70], '#2a2622', { seed: 520, lw: 6 });
    ST.blob(ctx, [kx - 10, ky - 26, kx + 10, ky - 26, kx + 8, ky + 28, kx - 8, ky + 28], C.INK, { lw: 0, seed: 521 });
    ST.blob(ctx, ST.ellipseRing(kx, ky - 22, 14, 14, 8), C.INK, { lw: 0, seed: 522 });
    ctx.restore();
    if (o.planked) [-0.08, 0.1].forEach((r, i) => ST.plank(ctx, 960 + i * 20, 560 + i * 180, r, 530 + i));
    ST.cobbles(ctx, -300, 1200, 2220, 1400, 540, '#6a6252', '#433d31');
  };

  // the carved stone over the door: letters appear one by one (n of "CUM CLAVE"), the gloss below
  ST.carvedStone = (ctx, x, y, n, gloss) => {
    ST.rough(ctx, [x - 330, y - 70, x + 330, y - 76, x + 336, y + 70, x - 326, y + 76], '#8a857a', { seed: 550, lw: 7, shade: ['#6c675d', -10, 6], hatch: { c: 'rgba(25,24,18,0.35)', n: 6, len: 50, gap: 8, k: 3, ang: 80 } });
    const word = 'CUM CLAVE'.slice(0, n);
    ST.label(ctx, word, x - 4, y + 4, { font: "bold 96px Georgia, 'Times New Roman', serif", fill: '#3a3630' });
    ST.label(ctx, word, x, y, { font: "bold 96px Georgia, 'Times New Roman', serif", fill: '#5c574c' });
    if (gloss) {
      ST.rough(ctx, [x - 300, y + 96, x + 300, y + 90, x + 306, y + 176, x - 296, y + 182], C.INK, { seed: 551, lw: 6, lineColor: C.MUSTARD });
      ST.label(ctx, gloss, x, y + 136, { size: 64, fill: C.MUSTARD, rot: -1 });
    }
  };

  // barred judas-window in the door (wide shots)
  ST.grilleFrame = (ctx, x, y, w, h) => {
    ST.rect(ctx, x - w / 2, y - h / 2, w, h, '#14110e', { seed: 561, lw: 6 });
    for (let i = 1; i < 4; i++) ST.stroke(ctx, [x - w / 2 + (w * i) / 4, y - h / 2, x - w / 2 + (w * i) / 4 + 2, y + h / 2], { w: 10, color: '#3b3a36', seed: 562 + i, taper: false });
  };

  // the judas-window close-up: wood all round, an opening with bars in front of the face
  ST.setGrilleClose = (ctx, drawFace) => {
    ST.rect(ctx, -300, -300, 2520, 1700, '#3e2e20', { seed: 570, lw: 0, hatch: { c: 'rgba(10,6,2,0.55)', n: 14, len: 400, gap: 14, k: 2, ang: 90, bend: 0 } });
    ST.rect(ctx, 520, 200, 880, 640, '#14110e', { seed: 571, lw: 0 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(520, 200, 880, 640);
    ctx.clip();
    drawFace();
    ctx.restore();
    for (let i = 1; i < 5; i++) ST.tube(ctx, [520 + i * 176, 190, 522 + i * 176, 850], [34, 34], '#3b3a36', { lw: 7, seed: 572 + i, light: ['#5d5a52', 6, 0], hatch: { c: 'rgba(10,8,6,0.4)', n: 3, len: 20, gap: 5, k: 2, ang: 0 } });
    ST.tube(ctx, [510, 520, 1410, 522], [30, 30], '#3b3a36', { lw: 7, seed: 578, light: ['#5d5a52', 0, -6] });
    [[440, 120, 1040, 80], [440, 840, 1040, 80], [440, 200, 80, 640], [1400, 200, 80, 640]].forEach(([x, y, w, h], i) => ST.rect(ctx, x, y, w, h, '#2e2218', { seed: 579 + i, lw: 7, hatch: { c: 'rgba(10,6,2,0.5)', n: 3, len: 40, gap: 6, k: 2, ang: 90 } }));
  };
})();

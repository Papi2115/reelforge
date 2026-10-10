/* Sets A - title poster (Edo at dusk), your room at dawn, the daydream. World units = 1920x1080 frame at zoom 1.
   One warm light per set as stepped pools, grime as flat shapes. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;

  // ---------- title: dusk over Edo, the castle keep and the town roofs in silhouette ----------
  ST.setTitle = (ctx) => {
    ST.bands(ctx, -200, -200, 2200, 760, ['#34363a', '#454540', '#5e5643', '#7a6643', '#957640'], 2.3);
    ST.pool(ctx, 1380, 640, 640, 230, '#b98a3e', 0.18);
    const keep = [[1260, 600, 360], [1290, 520, 300], [1320, 450, 240], [1350, 390, 180]];
    ST.rough(ctx, [1180, 760, 1220, 640, 1700, 640, 1740, 760], '#2b2a26', { seed: 11, lw: 6 });
    keep.forEach(([x, y, w], i) => {
      ST.rect(ctx, x, y, w, 70, '#3a3833', { seed: 12 + i, lw: 5 });
      ST.rough(ctx, [x - 40, y + 10, x + 20, y - 26, x + w - 20, y - 26, x + w + 40, y + 10], '#22211f', { seed: 16 + i, lw: 5 });
    });
    for (let i = 0; i < 9; i++) {
      const x = -200 + i * 260 + ST.rnd(-40, 40, 20, i), y = 700 + ST.rnd(-20, 30, 21, i);
      ST.rough(ctx, [x - 30, y + 80, x + 10, y, x + 230, y + 4, x + 270, y + 80], i % 2 ? '#262522' : '#2e2c28', { seed: 22 + i, lw: 5 });
    }
    ST.rough(ctx, [-200, 780, 2200, 780, 2200, 1200, -200, 1200], '#1f1c19', { seed: 31, lw: 6, hatch: { c: 'rgba(80,60,40,0.3)', n: 8, len: 90, gap: 9, k: 2, ang: 2, bend: 0 } });
  };

  // ---------- your room at dawn: plaster and posts, the lit shoji, tatami, the sword rack and the futon ----------
  ST.setHouse = (ctx, t, gleam) => {
    ST.rough(ctx, [-300, -200, 2300, -200, 2300, 780, -300, 780], '#7c7258', { seed: 40, lw: 0, mottle: ['rgba(50,40,20,0.2)', 8, 70], hatch: { c: 'rgba(30,24,12,0.3)', n: 12, len: 60, gap: 8, k: 3, ang: 80 } });
    ST.pool(ctx, 520, 420, 700, 420, '#d9a14a', 0.12);
    ST.shoji(ctx, 260, 100, 520, 600, 41, { lit: true, torn: 0.07 });
    ST.peel(ctx, 1000, 180, 120, 70, 42);
    ST.stain(ctx, 1240, 560, 220, 160, 43, 'rgba(40,30,12,0.3)');
    [-60, 900, 1980].forEach((x, i) => ST.beam(ctx, x, -200, x, 790, 34, 44 + i));
    ST.beam(ctx, -300, 40, 2300, 40, 30, 47);
    // alcove with a cheap scroll (an ink mountain) and a cracked vase
    ST.rect(ctx, 1260, 90, 600, 640, '#6e6550', { seed: 48, lw: 6, shade: ['rgba(0,0,0,0.25)', 30, 0] });
    ST.rect(ctx, 1480, 130, 150, 400, '#a59a7c', { seed: 49, lw: 4, inner: () => ST.stroke(ctx, [1500, 420, 1540, 330, 1560, 370, 1600, 280, 1620, 420], { w: 5, seed: 50 }) });
    ST.crack(ctx, 1300, 200, 120, 51, 1.4);
    ST.tatami(ctx, -300, 2300, 770, 1200, 52);
    // the sword rack: two lacquered legs, two swords, one catching the dawn
    [1440, 1760].forEach((x, i) => ST.rough(ctx, [x - 20, 800, x - 10, 640, x + 10, 640, x + 20, 800], C.BLACK, { seed: 53 + i, lw: 5 }));
    ST.rackSword(ctx, 1420, 660, 420, 55, 0);
    ST.rackSword(ctx, 1460, 720, 320, 58, gleam || 0);
    ST.pool(ctx, 1560, 700, 260, 80, '#d9a14a', 0.1);
  };
  // the futon under you: mattress first, quilt after the figure. hipX/hipY = where your hips are (world)
  ST.futonBase = (ctx, x, y, pillowX) => {
    ST.blob(ctx, [x - 420, y + 40, x - 400, y - 10, x + 420, y - 14, x + 450, y + 36, x + 430, y + 70, x - 410, y + 74], '#8f8564', { lw: 6, seed: 60, shade: ['#6c6448', -10, 10], hatch: { c: 'rgba(40,34,16,0.4)', n: 6, len: 60, gap: 8, k: 3, ang: 4 } });
    ST.blob(ctx, ST.ellipseRing(pillowX, y - 22, 86, 30, 10), '#6a5a3c', { lw: 6, seed: 61, hatch: { c: 'rgba(30,20,10,0.5)', n: 4, len: 30, gap: 6, k: 3, ang: 80 } }); // buckwheat pillow
  };
  // quilt: covers from 'reach' (world x where it starts on the body) to the foot end; patched, stained
  ST.futonQuilt = (ctx, x, y, reach) => {
    ST.blob(ctx, [reach, y - 60, reach + 60, y - 120, x + 200, y - 130, x + 440, y - 90, x + 470, y + 20, x + 300, y + 60, reach + 20, y + 54, reach - 30, y], C.GREYBLUE_D, { lw: 7, seed: 62, shade: ['#2c353b', -14, 10], mottle: ['#34404a', 5, 30], hatch: { c: 'rgba(10,14,18,0.5)', n: 9, len: 50, gap: 8, k: 3, ang: -20 } });
    ST.rough(ctx, [x + 200, y - 90, x + 290, y - 96, x + 296, y - 30, x + 206, y - 24], C.MUSTARD_D, { seed: 63, lw: 4, amp: 2 }); // patch
    for (let i = 0; i < 4; i++) ST.stroke(ctx, [x + 212 + i * 22, y - 92, x + 214 + i * 22, y - 84], { w: 2, seed: 64 + i, taper: false });
  };

  // ---------- the daydream: flat sunset bands, a huge mustard sun, a black ridge, wind-bent grass ----------
  ST.setDream = (ctx, t) => {
    ST.bands(ctx, -300, -300, 2300, 820, ['#3c2f36', '#5c3a30', '#83472c', '#9b6232', '#a87a3a'], 4.1);
    ST.blob(ctx, ST.ellipseRing(960, 560, 330, 330, 24), '#c99a42', { lw: 0, seed: 70 });
    ST.pool(ctx, 960, 560, 600, 360, '#d6aa52', 0.12);
    ST.rough(ctx, [-300, 820, 200, 640, 520, 720, 900, 600, 1300, 700, 1700, 620, 2300, 760, 2300, 1300, -300, 1300], '#1c1715', { seed: 71, lw: 0 });
    const k = Math.floor(ST.twos(t) * 6) % 2;
    for (let i = 0; i < 30; i++) {
      const x = -260 + i * 86, y = 860 + ST.rnd(-20, 30, 72, i);
      ST.stroke(ctx, [x, y + 60, x + 10 + k * 8, y, x + 30 + k * 14, y - 30], { w: 6, color: '#1c1715', seed: 73 + i });
    }
  };
  // two figures as flat ink silhouettes (the dream) - drawn on a scratch canvas, then filled with ink
  let scratch = null;
  ST.silhouette = (ctx, cam, draw) => {
    if (!scratch) { scratch = document.createElement('canvas'); scratch.width = ST.W; scratch.height = ST.H; }
    const s = scratch.getContext('2d');
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.clearRect(0, 0, ST.W, ST.H);
    ST.camera(s, cam[0], cam[1], cam[2], cam[3]);
    draw(s);
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-atop';
    s.fillStyle = '#1c1715';
    s.fillRect(0, 0, ST.W, ST.H);
    s.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  };
})();

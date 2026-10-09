/* Sets B - the great hall of the palace where the cardinals sit: big grey stone blocks, two tall arched windows, a
   faded fresco of the crossed keys, a timber roof overhead (which the town later takes away), an iron candle stand as
   the one warm light, the long table with its dirty cloth, high-backed chairs. Time-passing props: tally marks
   scratched on the wall, a slate with the year, candle stubs, cobwebs, the season in the window. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const ROOF_Y = 170, FLOOR = 880;

  // the timber roof seen from below: rafters + boards; gap 0..1 = how much of it the town has removed (from the right)
  ST.hallRoof = (ctx, gap, sky) => {
    ST.rect(ctx, -300, -300, 2520, ROOF_Y + 300, '#3a2c20', { seed: 400, lw: 0, hatch: { c: 'rgba(10,6,2,0.45)', n: 14, len: 120, gap: 9, k: 2, ang: 0, bend: 0 } });
    ST.rect(ctx, 2200, -300, 500, ROOF_Y + 300, '#3a2c20', { seed: 403, lw: 0, hatch: { c: 'rgba(10,6,2,0.45)', n: 4, len: 120, gap: 9, k: 2, ang: 0, bend: 0 } }); // set extension for the looking-up camera
    const cut = 2220 - gap * 2400;
    if (gap > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cut, -300, 2600, ROOF_Y + 300);
      ctx.clip();
      ST.bands(ctx, cut - 10, -300, 2700, ROOF_Y, sky || ['#4b545a', '#5d6462', '#6f7068'], 4);
      ctx.restore();
      ST.stroke(ctx, [cut, -300, cut + 12, 40, cut - 6, ROOF_Y], { w: 7, seed: 401, taper: false }); // ragged edge
    }
    for (let i = 0; i < 9; i++) { const x = -200 + i * 290; if (x < cut || gap === 0) ST.beam(ctx, x, -300, x + 40, ROOF_Y, 30, 402 + i); }
    ST.beam(ctx, -300, ROOF_Y, 2700, ROOF_Y + 6, 44, 412);
    return cut;
  };

  // o: { gap, sky, tally (count), year, web 0..1, snow, candle 0..1 (wax left), light }
  ST.setHall = (ctx, t, o) => {
    o = o || {};
    ST.rect(ctx, -300, ROOF_Y, 2520, FLOOR - ROOF_Y, '#6f6b60', { seed: 420, lw: 0, mottle: ['#666257', 8, 90] });
    ST.rect(ctx, 2200, ROOF_Y, 500, FLOOR - ROOF_Y, '#6f6b60', { seed: 419, lw: 0 }); // set extension for the cameras
    ST.bricks(ctx, -300, ROOF_Y, 3000, FLOOR - ROOF_Y, { bh: 60, bw: 150, seed: 421, density: 0.16, tone: 'rgba(0,0,0,0.1)', line: 'rgba(22,18,14,0.4)' });
    ST.stain(ctx, 520, 300, 300, 200, 422, 'rgba(30,34,20,0.25)');
    ST.stain(ctx, 1500, 700, 260, 140, 423, 'rgba(30,26,16,0.25)');
    ST.peel(ctx, 1260, 260, 140, 90, 424);
    ST.crack(ctx, 860, 200, 180, 425);
    [260, 1660].forEach((wx, i) => { // tall arched windows with the season outside
      const w = 150, top = 250, base = 600;
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx - w / 2, top - 40, w, base - top + 40);
      ctx.clip();
      ST.bands(ctx, wx - w / 2, top - 60, wx + w / 2, base, o.snow ? ['#8a8e8c', '#9c9f98'] : ['#56656c', '#6f7a72'], 2 + i);
      if (o.snow) for (let k = 0; k < 14; k++) ctx.fillRect(wx - w / 2 + ST.hash(426, k, i) * w, top - 40 + ((ST.hash(427, k, i) * 400 + ST.twos(t) * 60) % 390), 5, 5);
      ctx.restore();
      ST.rough(ctx, [wx - w / 2, base, wx - w / 2, top + 20, wx, top - 46, wx + w / 2, top + 20, wx + w / 2, base], 'rgba(0,0,0,0)', { seed: 428 + i, lw: 16 });
      ST.stroke(ctx, [wx, top - 40, wx, base], { w: 8, seed: 430 + i, taper: false });
      ST.rect(ctx, wx - w / 2 - 20, base, w + 40, 24, C.STONE, { seed: 432 + i, lw: 5 });
    });
    // faded fresco: crossed keys on a dull roundel
    ST.blob(ctx, ST.ellipseRing(960, 330, 120, 110, 14), 'rgba(120,80,50,0.35)', { lw: 4, seed: 434, lineColor: 'rgba(22,18,14,0.5)' });
    [-0.7, 0.7].forEach((r, i) => { ctx.save(); ctx.translate(960, 330); ctx.rotate(r); ctx.scale(0.5, 0.5); ctx.globalAlpha = 0.3; ST.bigKey(ctx, -100, 0, 0, 435 + i * 4); ctx.restore(); });
    ctx.globalAlpha = 1;
    if (o.tally) { // scratched tally marks, bundled in fives
      ctx.strokeStyle = 'rgba(30,24,18,0.75)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let i = 0; i < o.tally; i++) {
        const g = Math.floor(i / 5), k = i % 5, gx = 1380 + (g % 6) * 46, gy = 400 + Math.floor(g / 6) * 46;
        if (k < 4) { ctx.moveTo(gx + k * 8, gy); ctx.lineTo(gx + k * 8 + 2, gy + 32); } else { ctx.moveTo(gx - 4, gy + 26); ctx.lineTo(gx + 34, gy + 6); }
      }
      ctx.stroke();
    }
    if (o.year) { // the slate with the year chalked on it
      ST.stroke(ctx, [590, 236, 620, 196, 650, 236], { w: 3, seed: 440, taper: false });
      ST.rect(ctx, 540, 236, 160, 84, '#2f3330', { seed: 441, lw: 6, amp: 1.5 });
      ST.label(ctx, String(o.year), 620, 280, { font: "bold 40px Georgia, serif", fill: '#cfc9b4' });
    }
    if (o.web) ST.cobweb(ctx, 1920, ROOF_Y + 24, 180 * o.web, -1, 445);
    if (o.web) ST.cobweb(ctx, 0, ROOF_Y + 24, 140 * o.web, 1, 446);
    ST.rect(ctx, -300, FLOOR, 2520, 500, '#4a463d', { seed: 450, lw: 6, hatch: { c: 'rgba(15,10,4,0.45)', n: 12, len: 140, gap: 9, k: 2, ang: 2, bend: 0 } });
    ST.rect(ctx, 2200, FLOOR, 500, 500, '#4a463d', { seed: 449, lw: 0 });
    ST.rough(ctx, [-300, FLOOR, 2220, FLOOR, 2220, FLOOR + 40, -300, FLOOR + 40], 'rgba(20,16,10,0.3)', { seed: 451, lw: 0 });
    ST.candleStand(ctx, 140, 960, o.candle === undefined ? 1 : o.candle, t, o.light !== false);
    return ST.hallRoof(ctx, o.gap || 0, o.sky);
  };

  ST.cobweb = (ctx, x, y, r, dir, seed) => {
    if (r < 8) return;
    ctx.strokeStyle = 'rgba(200,196,180,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2); ctx.moveTo(x, y); ctx.lineTo(x + dir * Math.cos(a) * r, y + Math.sin(a) * r); }
    for (let k = 1; k <= 3; k++) for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * (Math.PI / 2), a1 = ((i + 1) / 4) * (Math.PI / 2), rr = (r * k) / 3.4 + ST.rnd(-4, 4, seed, k, i);
      ctx.moveTo(x + dir * Math.cos(a0) * rr, y + Math.sin(a0) * rr);
      ctx.quadraticCurveTo(x + dir * Math.cos((a0 + a1) / 2) * rr * 0.8, y + Math.sin((a0 + a1) / 2) * rr * 0.8, x + dir * Math.cos(a1) * rr, y + Math.sin(a1) * rr);
    }
    ctx.stroke();
  };

  // iron candle stand: the one warm light; wax 0..1 (how much candle is left)
  ST.candleStand = (ctx, x, base, wax, t, lit) => {
    if (lit) ST.pool(ctx, x, base - 360, 420, 360, '#e0a443', 0.07);
    ST.stroke(ctx, [x, base, x + 4, base - 300], { w: 10, color: '#2a2622', seed: 460, taper: false });
    ST.stroke(ctx, [x - 40, base, x, base - 30, x + 40, base], { w: 8, color: '#2a2622', seed: 461, taper: false });
    ST.rect(ctx, x - 40, base - 312, 88, 14, '#2a2622', { seed: 462, lw: 4 });
    const h = 20 + 90 * wax;
    ST.rect(ctx, x - 11, base - 312 - h, 22, h, '#c2b48a', { seed: 463, lw: 5, shade: ['#9c8f68', -4, 0] });
    ST.blob(ctx, [x - 18, base - 300, x - 12, base - 314, x + 14, base - 314, x + 22, base - 296, x + 18, base - 270], '#c2b48a', { lw: 4, seed: 464 }); // drips
    if (!lit) return;
    const fl = ST.hash(9, Math.floor(ST.twos(t) * 12)) * 8, fy = base - 312 - h;
    ST.blob(ctx, [x, fy - 40 - fl, x + 11, fy - 12, x, fy - 2, x - 11, fy - 12], C.FIRE, { lw: 4, seed: 465, patch: ['#f0d08a', 0, 6, 0.45] });
  };

  // high-backed chair (drawn before the seated figure); x = seat centre, floor y, k = figure scale
  ST.chair = (ctx, x, floor, k, seed) => {
    ST.rough(ctx, [x - 90 * k, floor - 200 * k, x - 80 * k, floor - 620 * k, x - 40 * k, floor - 660 * k, x + 40 * k, floor - 660 * k, x + 80 * k, floor - 620 * k, x + 90 * k, floor - 200 * k], '#4a3826', { seed, lw: 6, shade: ['#33261a', -14 * k, 0], hatch: { c: 'rgba(15,8,2,0.5)', n: 5, len: 80 * k, gap: 8, k: 2, ang: 88, bend: 0 } });
    ST.stroke(ctx, [x - 60 * k, floor - 600 * k, x, floor - 630 * k, x + 60 * k, floor - 600 * k], { w: 5, seed: seed + 1, taper: false });
  };

  // the long table in front of seated figures: top surface + dirty cloth; draws the items via o.items(topY)
  ST.hallTable = (ctx, x0, x1, top, o) => {
    o = o || {};
    ST.rough(ctx, [x0 + 30, top, x1 - 30, top, x1, top + 46, x0, top + 46], '#5a4430', { seed: 470, lw: 6, light: ['#6e5640', 0, -6], hatch: { c: 'rgba(15,8,2,0.45)', n: 8, len: 120, gap: 7, k: 2, ang: 0, bend: 0 } });
    const cloth = [x0 - 6, top + 40, x1 + 6, top + 40, x1 + 12, top + 150];
    for (let i = 12; i >= 0; i--) cloth.push(x0 + ((x1 - x0) * i) / 12 + 6, top + 150 + (i % 2 ? 14 : 0) + ST.rnd(-4, 4, 471, i));
    cloth.push(x0 - 12, top + 150);
    ST.blob(ctx, cloth, C.LINEN_D, { sharp: true, lw: 6, seed: 472, shade: ['#6c6450', -20, 6], mottle: ['rgba(90,70,40,0.35)', 8, 30], hatch: { c: 'rgba(40,34,20,0.45)', n: 10, len: 60, gap: 8, k: 3, ang: 88, bend: 0.05 } });
    ST.rough(ctx, [x0 + 4, top + 150, x1 - 4, top + 150, x1 - 10, FLOOR + 60, x0 + 10, FLOOR + 60], '#3a2c20', { seed: 473, lw: 6, hatch: { c: 'rgba(10,6,2,0.5)', n: 8, len: 60, gap: 9, k: 2, ang: 90, bend: 0 } });
    ST.stain(ctx, (x0 + x1) / 2 - 140, top + 80, 90, 40, 474, 'rgba(90,40,30,0.3)'); // wine
    if (o.items) o.items(top + 22);
  };

  // the ballot chalice (the gold accent in the hall)
  ST.chalice = (ctx, x, y, seed) => {
    ST.blob(ctx, [x - 40, y - 70, x + 40, y - 70, x + 30, y - 30, x + 8, y - 16, x + 10, y - 2, x + 30, y + 6, x - 30, y + 6, x - 10, y - 2, x - 8, y - 16, x - 30, y - 30], C.GOLD, { sharp: false, lw: 6, seed, shade: [C.GOLD_D, -8, 6], light: ['#d9b45a', 6, -6] });
    ST.blob(ctx, ST.ellipseRing(x, y - 70, 40, 9, 10), C.GOLD_D, { lw: 5, seed: seed + 1 });
  };

  // rain: slanted dashes moving on twos, inside [x0, x1] above floorY
  ST.rain = (ctx, x0, x1, y0, y1, t, seed, n) => {
    const tt = ST.twos(t);
    ctx.strokeStyle = 'rgba(190,200,205,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < (n || 80); i++) {
      const x = x0 + ST.hash(seed, i) * (x1 - x0), y = y0 + ((ST.hash(seed, i, 1) * (y1 - y0) + tt * 1400) % (y1 - y0));
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y + 34);
    }
    ctx.stroke();
  };
})();

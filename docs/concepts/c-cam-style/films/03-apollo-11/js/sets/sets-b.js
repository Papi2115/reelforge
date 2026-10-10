/* Sets B - inside the lander: the cramped grey cabin with two triangular windows, the centre panel (computer,
   switches, master alarm), cables, tape and scuffs; the view out of a window; a close panel wall for inserts.
   One warm light: the cabin floodlight. During the alarm the red master-alarm light adds a flashing red pool. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, M = ST.MOON;
  const WIN_L = [240, 130, 770, 130, 740, 480, 300, 450], WIN_R = [1150, 130, 1680, 130, 1620, 450, 1180, 480];

  // what is outside a window: black sky over moon ground. scroll = ground slides sideways, k = approach (1 = high)
  ST.windowView = (ctx, bb, scroll, k, seed, boulders) => {
    ST.rect(ctx, bb.x0 - 10, bb.y0 - 10, bb.w + 20, bb.h + 20, '#0d0f12', { seed, lw: 0 });
    ST.stars(ctx, bb.x0, bb.y0, bb.w, bb.h * 0.3, 14, seed + 1, '#6e6b5e');
    const hy = bb.y0 + bb.h * (0.34 - 0.12 * (1 - k));
    ctx.save();
    ctx.translate(bb.cx, hy);
    ctx.scale(1 / k, 1 / k);
    ctx.translate(-bb.cx - scroll, -hy);
    ST.moonGround(ctx, bb.x0 - 1400, hy, bb.x1 + 1400, hy + 900 * k + 400, seed + 2, { craters: 70, scale: 0.7, col: '#a29d8e' });
    if (boulders) for (let i = 0; i < boulders; i++) {
      const q = ST.hash(seed, i, 7);
      ST.boulder(ctx, bb.x0 - 300 + ST.hash(seed, i, 8) * (bb.w + 600) + scroll, hy + 30 + q * q * 500, 14 + 60 * q * q, seed + 50 + i);
    }
    ctx.restore();
  };
  // a window: a flat metal bezel (outer shape) round the glass (the same shape pulled in toward its centre)
  function windowAt(ctx, pts, seed, view) {
    const n = pts.length / 2, cx = pts.filter((v, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / n, cy = pts.filter((v, i) => i % 2 === 1).reduce((a, b) => a + b, 0) / n;
    const glass = pts.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * 0.9 : cy + (v - cy) * 0.88));
    ST.blob(ctx, pts, '#56564c', { sharp: true, lw: 7, seed, shade: ['rgba(0,0,0,0.3)', -10, 10], hatch: { c: 'rgba(15,15,12,0.4)', n: 4, len: 40, gap: 8, k: 3, ang: 30 } });
    ctx.save();
    ST.path(ctx, glass, true);
    ctx.clip();
    view(ST.bbox(glass));
    ctx.restore();
    ST.inkLine(ctx, ST.wobble(glass, 2, seed + 1, 60), { w: 8, closed: true, seed: seed + 1 });
  }

  // o: { scroll, k (approach), boulders, alarm (true while the red light is lit) }
  ST.setLM = (ctx, t, o) => {
    o = o || {};
    ST.rect(ctx, -400, -300, 2700, 1700, M.WALL_D, { seed: 60, lw: 0 });
    [[-400, 60, 650, 640], [1720, 60, 680, 640], [-400, 560, 2700, 300]].forEach(([x, y, w, h], i) => ST.metalPanel(ctx, x, y, w, h, 61 + i));
    ST.metalPanel(ctx, 230, -300, 1460, 400, 64);
    [WIN_L, WIN_R].forEach((w, i) => windowAt(ctx, w, 70 + i, (bb) => ST.windowView(ctx, bb, (o.scroll || 0) + i * 500, o.k || 1, 80 + i, o.boulders)));
    // centre panel: computer, switches, gauges, the master alarm
    ST.rect(ctx, 790, 110, 340, 470, M.PANEL, { seed: 90, lw: 7, shade: ['rgba(0,0,0,0.2)', -14, 0] });
    ST.dsky(ctx, 820, 300, 0.5, 91, { alarm: o.alarm });
    ST.switches(ctx, 1040, 330, 2, 6, 38, 92);
    ST.gauge(ctx, 880, 200, 48, 0.4, 93);
    ST.gauge(ctx, 1040, 200, 48, -0.6, 94);
    ST.rect(ctx, 996, 264, 126, 44, o.alarm ? C.RED : C.RED_D, { seed: 95, lw: 5 });
    ST.label(ctx, 'MASTER', 1059, 277, { fill: o.alarm ? '#f0d8b0' : '#3a1a14', font: "bold 14px 'Arial Black', Arial, sans-serif" });
    ST.label(ctx, 'ALARM', 1059, 296, { fill: o.alarm ? '#f0d8b0' : '#3a1a14', font: "bold 14px 'Arial Black', Arial, sans-serif" });
    // side and lower switch banks, cables, tape, a scrawled note
    ST.switches(ctx, -40, 640, 12, 2, 46, 96);
    ST.switches(ctx, 1480, 640, 12, 2, 46, 97);
    [[180, -60, 520, 40, 900, -40], [1050, -40, 1400, 50, 1760, -60]].forEach((pts, i) => ST.tube(ctx, pts, [16, 16, 16], C.BLACK, { lw: 4, seed: 98 + i }));
    ST.rect(ctx, 300, 560, 120, 30, 'rgba(180,170,130,0.8)', { seed: 100, lw: 3, amp: 1 });
    ST.stroke(ctx, [312, 570, 340, 580, 362, 566, 400, 578], { w: 2.5, seed: 101, taper: false });
    ST.stain(ctx, 1820, 380, 120, 80, 102, 'rgba(30,24,10,0.3)');
    // the floor and the light
    ST.rect(ctx, -400, 900, 2700, 500, '#3b3a33', { seed: 103, lw: 6, hatch: { c: 'rgba(10,10,8,0.5)', n: 10, len: 80, gap: 10, k: 2, ang: 5, bend: 0 } });
    ST.pool(ctx, 960, 400, 900, 520, C.FIRE, 0.07);
    ST.blob(ctx, [900, 100, 1020, 100, 1000, 130, 920, 130], C.BLACK, { lw: 5, seed: 104 });
    if (o.alarm) ST.pool(ctx, 1059, 287, 700, 500, C.RED, 0.09);
  };
  // looking out of the window: one big triangle of glass over the landing area - a crater ringed by boulders
  ST.setWindowPOV = (ctx, t) => {
    ST.rect(ctx, -400, -300, 2700, 1700, M.WALL_D, { seed: 110, lw: 0, mottle: ['rgba(20,20,16,0.3)', 8, 120] });
    const pts = [-60, 40, 1980, 40, 1460, 1060, 420, 1060];
    windowAt(ctx, pts, 111, (bb) => {
      ST.windowView(ctx, bb, 0, 0.8, 112, 0);
      ST.crater(ctx, 1000, 650, 300, 113);
      for (let i = 0; i < 34; i++) {
        const a = ST.hash(114, i) * Math.PI * 2, d = 0.4 + 0.9 * ST.hash(114, i, 1);
        ST.boulder(ctx, 1000 + Math.cos(a) * 380 * d, 650 + Math.sin(a) * 140 * d, 14 + 40 * ST.hash(114, i, 2) * d, 115 + i);
      }
    });
    ST.rect(ctx, 520, 1000, 180, 40, 'rgba(180,170,130,0.8)', { seed: 116, lw: 3, amp: 1 }); // tape on the sill
  };

  // close panel wall for inserts: rows of switches and a stencil, grime
  ST.setPanelWall = (ctx, seed) => {
    ST.rect(ctx, -400, -300, 2700, 1700, M.PANEL, { seed, lw: 0, mottle: ['rgba(20,20,16,0.3)', 10, 120] });
    for (let i = 0; i < 4; i++) ST.metalPanel(ctx, -300 + i * 640, -200, 620, 1500, seed + 1 + i, '#55554b');
    ST.switches(ctx, 1500, 100, 6, 3, 70, seed + 6);
    ST.pool(ctx, 900, 400, 1100, 700, C.FIRE, 0.06);
  };
})();

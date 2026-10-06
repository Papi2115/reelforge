/* Native-res "painted close-ups" and menus: the calendar (S2), quest log + inventory (S4),
   the returns-desk conversation (S6), quiet quest complete (S8). */
'use strict';
(function () {
  const RF = window.RF, C = RF.C, E = RF.ease, seg = RF.seg, HUD = RF.HUD, Bmp = RF.Bmp;
  const OV = (RF.OV = {});

  // ---------------- S2 calendar close-up ----------------
  const crossT = [];
  for (let k = 0; k < 31; k++) {
    const base = 10.05 + 2.75 * Math.sqrt(k / 31);
    crossT.push(base + (RF.hash3(k, 7, 7) - 0.5) * 0.05);
  }
  const sticky = (() => {
    const b = new Bmp(60, 32, C.SAND_L);
    b.rect(0, 0, 60, 4, C.TUNGSTEN);
    RF.drawText(b, 'XMAS!', 5, 8, C.BROWN, 2, { jitter: 4 });
    RF.handStroke(b, [5, 26, 30, 25, 52, 27], C.BROWN, 12, 2, 1, true);
    return RF.rotate(b, -6);
  })();
  const GX = 10, GY = 34, CW = 20, CH = 19;
  function calendarPaper(t) {
    const b = new Bmp(170, 154);
    b.rect(0, 0, 168, 152, C.PAPER);
    b.rect(168, 2, 2, 152, C.SAND); b.rect(2, 152, 168, 2, C.SAND);
    b.rect(0, 0, 168, 22, C.BROWN);
    RF.drawText(b, '1982', 10, 4, C.PAPER, 2);
    b.ellipse(84, 4, 3, 3, C.CLAY); b.px(83, 3, C.SAND_L);
    'SMTWTFS'.split('').forEach((d, i) => RF.drawText(b, d, GX + 8 + i * CW, 25, C.GREY, 1));
    for (let i = 0; i <= 7; i++) b.rect(GX + i * CW, GY, 1, 5 * CH, C.SAND_L);
    for (let j = 0; j <= 5; j++) b.rect(GX, GY + j * CH, 7 * CW + 1, 1, C.SAND_L);
    // a coffee ring, mostly off the corner of the page
    for (let a = 250; a < 370; a += 1.5) {
      const r = 21 + Math.sin(a * 0.07) * 0.8;
      const x = 2 + Math.cos((a * Math.PI) / 180) * r, y = 152 + Math.sin((a * Math.PI) / 180) * r;
      if (RF.hash3(Math.floor(a), 1, 4) < 0.85) { b.px(x, y, C.SAND); if (a > 300) b.px(x + 1, y, C.SAND); }
    }
    for (let d = 1; d <= 31; d++) {
      const k = d - 1, col = k % 7, row = Math.floor(k / 7);
      const x = GX + col * CW, y = GY + row * CH;
      RF.drawText(b, String(d), x + 3, y + 3, C.CHAR, 1);
      const p = seg(t, crossT[k], crossT[k] + 0.09);
      if (p > 0) {
        const j = (RF.hash3(d, 2, 2) - 0.5) * 3;
        RF.handStroke(b, [x + 4, y + 6 + j, x + 17, y + 17], C.SLATE, 100 + d, 2.5, Math.min(1, p * 1.8), true);
        if (p > 0.55) RF.handStroke(b, [x + 16 + j, y + 5, x + 5, y + 16], C.SLATE, 200 + d, 2.5, (p - 0.55) / 0.45, true);
      }
    }
    // the point: the five rows, bracketed in the accent, about five weeks
    const bp = seg(t, 12.95, 13.35);
    if (bp > 0) {
      RF.handStroke(b, [152, GY + 3, 158, GY + 4, 159, GY + 46, 163, GY + 48, 159, GY + 50, 158, GY + 92, 150, GY + 94], C.ACCENT, 31, 2, bp, true);
      const lbl = '~5 WEEKS';
      const n = Math.floor(seg(t, 13.3, 13.62) * lbl.length);
      RF.drawText(b, lbl.slice(0, n), 58, GY + 5 * CH + 4, C.ACCENT, 2, { jitter: 9, jitterAmp: 1 });
    }
    b.blit(sticky, 104, -3);
    return RF.rotate(b, -1.6);
  }
  OV.calendar = function (s, t) {
    if (t < 9.62 || t >= 14.5) return 0;
    const up = E.outBack(seg(t, 9.62, 9.92)), down = E.in(seg(t, 14.25, 14.5));
    const dy = Math.round((1 - up) * 26 + down * 60);
    const x = 30, y = 58 + dy;
    HUD.plate(s, x, y, 214, 172);
    s.rect(x + 5, y + 5, 204, 162, C.UMBER);
    for (let xx = x + 5; xx < x + 209; xx += 9) s.rect(xx, y + 5, 1, 162, C.SHADOW);
    const paper = calendarPaper(t);
    s.blit(paper, x + 16, y + 4);
    return 1 - down;
  };

  // ---------------- S4 quest log + inventory ----------------
  const ICONS = (() => {
    const cart = RF.cartridge(30, 35, false);
    cart.outline(C.VOID);
    const cal = new Bmp(30, 30, C.PAPER);
    cal.rect(0, 0, 30, 7, C.BROWN);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) cal.rect(2 + k * 5, 10 + r * 5, 3, 3, C.SAND_L);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) if (r * 6 + k < 19) { cal.px(2 + k * 5, 10 + r * 5, C.SLATE); cal.px(4 + k * 5, 12 + r * 5, C.SLATE); }
    cal.rect(28, 9, 1, 20, C.ACCENT);
    const box = new Bmp(32, 26, C.TAN);
    box.rect(28, 0, 4, 26, C.WOOD); box.rect(0, 0, 28, 2, C.SAND_L); box.rect(12, 0, 4, 6, C.SAND_L);
    RF.drawText(box, 'E.T.', 6, 12, C.BROWN, 1);
    return [cart, cal, box];
  })();
  const ITEMS = [
    ['E.T. CARTRIDGE', 'ATARI 2600 · 1982'],
    ['DEADLINE', 'ABOUT FIVE WEEKS'],
    ['WAREHOUSE STOCK', 'BETTING ON A HIT'],
  ];
  const SEL = [[24.55, 0], [26.95, 1], [28.4, 2]];
  const OBJ = 'SELL E.T. FOR CHRISTMAS.';
  const objTimes = RF.typeTimes(OBJ, 4242, 25.95, 0.045);
  OV.menuOpen = (t) => (t < 24 || t >= 31 ? 0 : E.outBack(seg(t, 24.0, 24.3)) * (1 - E.in(seg(t, 30.4, 30.7))));
  OV.menuDim = (t) => (t < 24 || t >= 31 ? 0 : seg(t, 24.0, 24.2) * (1 - seg(t, 30.65, 30.9)));
  OV.menu = function (s, t) {
    const o = OV.menuOpen(t);
    if (o <= 0) return;
    const x = 26, w = 588, hFull = 270, h = Math.max(4, Math.round(hFull * o)), y = 44 + Math.round((hFull - h) / 2);
    HUD.plate(s, x, y, w, h);
    if (h < hFull - 6) return;
    s.rect(x + 6, y + 20, w - 12, h - 26, C.SHADOW);
    s.rect(x + 6, y + 20, w - 12, 1, C.VOID);
    RF.drawText(s, 'QUEST LOG', x + 16, y + 7, C.BULB, 1, { shadow: C.VOID });
    RF.drawText(s, 'INVENTORY', 432, y + 7, C.BULB, 1, { shadow: C.VOID });
    RF.drawText(s, 'PAUSED', x + w - 56, y + 7, C.PAPER, 1, { shadow: C.VOID });
    const lx = 50;
    RF.drawText(s, 'NOW', lx, y + 34, C.SAND, 1);
    const ch = 'CHRISTMAS 1982';
    RF.drawText(s, ch.slice(0, Math.floor(seg(t, 25.45, 25.85) * ch.length)), lx, y + 46, C.PAPER, 3);
    if (t > 25.8) {
      const pop = E.outBack(seg(t, 25.8, 26.0));
      const bs = Math.round(12 * pop);
      s.frame(lx + 1 + (12 - bs) / 2, y + 84 + (12 - bs) / 2, bs, bs, C.ACCENT);
      s.frame(lx + 2 + (12 - bs) / 2, y + 85 + (12 - bs) / 2, bs - 2, bs - 2, C.ACCENT);
      const n = RF.typedCount(objTimes, t);
      RF.drawText(s, OBJ.slice(0, n), lx + 22, y + 83, C.PAPER, 2);
      if (n < OBJ.length && (t * 3.3) % 1 < 0.6) s.rect(lx + 24 + RF.textWidth(OBJ.slice(0, n), 2), y + 83, 3, 14, C.BULB);
    }
    RF.handStroke(s, [lx, y + 116, lx + 180, y + 117, lx + 330, y + 115], C.SLATE, 77, 2, 1);
    RF.drawText(s, 'DONE', lx, y + 128, C.SAND, 1);
    [['1982 · THE DEADLINE', 24.7], ['1982 · THE WAREHOUSE', 25.18]].forEach(([label, tt], i) => {
      const yy = y + 143 + i * 15 + (i === 1 ? 1 : 0);
      RF.drawText(s, label, lx + 16, yy, C.PUTTY, 1);
      const p = seg(t, tt, tt + 0.16);
      if (p > 0) RF.handStroke(s, [lx + 1, yy + 3, lx + 4, yy + 7, lx + 11, yy - 2], C.SAGE, 90 + i, 1.5, p, true);
    });
    RF.drawText(s, 'AHEAD', lx, y + 188, C.SAND, 1);
    [118, 84, 146].forEach((len, i) => s.rect(lx + 16, y + 202 + i * 13, len, 6, C.CHAR));
    // inventory grid: uneven gaps, one slot a pixel low
    const slots = [[432, 70], [484, 70], [537, 71], [432, 123], [484, 123], [537, 123]];
    slots.forEach(([sx, sy], i) => {
      s.rect(sx, y + sy - 44 + 14, 46, 46, C.VOID);
      s.frame(sx, y + sy - 44 + 14, 46, 46, C.CHAR);
      const icon = ICONS[i];
      if (icon) s.blit(icon, sx + 23 - (icon.w >> 1), y + sy - 30 + 23 - (icon.h >> 1));
      else s.rect(sx + 22, y + sy - 30 + 22, 2, 2, C.CHAR);
    });
    let cur = 0, prev = 0, tc = SEL[0][0];
    SEL.forEach(([tt, k]) => { if (t >= tt) { prev = cur; cur = k; tc = tt; } });
    if (t >= SEL[0][0]) {
      const u = E.outBack(seg(t, tc, tc + 0.2));
      const ax = RF.lerp(slots[prev][0], slots[cur][0], u), ay = RF.lerp(slots[prev][1], slots[cur][1], u) + y - 30;
      [[0, 0, 1, 1], [46, 0, -1, 1], [0, 46, 1, -1], [46, 46, -1, -1]].forEach(([ox, oy, sx2, sy2]) => {
        s.rect(ax + ox - (sx2 < 0 ? 4 : 0) - 1, ay + oy - (sy2 < 0 ? 1 : 0) - 1, 5, 2, C.BULB);
        s.rect(ax + ox - (sx2 < 0 ? 1 : 0) - 1, ay + oy - (sy2 < 0 ? 4 : 0) - 1, 2, 5, C.BULB);
      });
      const item = ITEMS[cur];
      const n = Math.floor(seg(t, tc + 0.12, tc + 0.7) * (item[0].length + item[1].length));
      RF.drawText(s, item[0].slice(0, n), 432, y + 162, C.BULB, 1);
      RF.drawText(s, item[1].slice(0, Math.max(0, n - item[0].length)), 432, y + 176, C.PAPER, 1);
    }
    RF.drawText(s, 'DEV NOTE: NO PITS', 470, y + 236, C.SLATE, 1);
    RF.drawText(s, 'IN THIS BUILD', 470, y + 247, C.SLATE, 1);
  };

  // ---------------- S6 the returns desk (a boss you talk to) ----------------
  const LANDS = [40.5, 41.75, 42.6, 44.15, 45.05];
  OV.boss = function (s, t) {
    if (t < 40.75 || t >= 47.95) return;
    const out = seg(t, 47.55, 47.95);
    const x = 262, y = 16 - Math.round(out * 30);
    const name = 'RETURNS DESK';
    RF.drawText(s, name.slice(0, Math.floor(seg(t, 40.75, 41.2) * name.length)), x, y, C.PAPER, 1, { shadow: C.VOID });
    const bw = Math.round(190 * E.out(seg(t, 40.9, 41.2)));
    s.rect(x, y + 11, bw, 9, C.VOID);
    s.frame(x, y + 11, bw, 9, C.PUTTY);
    let v = 0;
    LANDS.forEach((lt) => (v += 0.2 * E.outBack(seg(t, lt + 0.1, lt + 0.35))));
    const fw = Math.round(Math.min(1, v) * (bw - 4));
    if (fw > 0) s.rect(x + 2, y + 13, fw, 5, C.ACCENT);
    if (bw > 150) RF.drawText(s, 'UNSOLD', x + 198, y + 12, C.SAND, 1, { shadow: C.VOID });
  };
  const OPTS = ['SELL IT', 'MARK IT DOWN', 'SEND IT BACK'];
  const PRESS = [43.7, 44.6, 45.35], STRIKE = [44.0, 44.8], MOVE = [43.35, 44.35, 45.15];
  OV.options = function (s, t) {
    if (t < 43.2 || t >= 45.95) return;
    const open = E.outBack(seg(t, 43.2, 43.34)) * (1 - seg(t, 45.8, 45.95));
    const hFull = 82, h = Math.max(3, Math.round(hFull * open));
    const x = 28, w = 250, y = 312 - hFull + Math.round((hFull - h) / 2);
    HUD.dialogueBox(s, x, y, w, h, h > hFull - 4 ? 'CLERK' : '');
    if (h < hFull - 2) return;
    let cur = 0, from = 0, tm = MOVE[0];
    MOVE.forEach((mt, i) => { if (t >= mt) { from = cur; cur = i; tm = mt; } });
    OPTS.forEach((o, i) => {
      const yy = y + 13 + i * 21 + (i === 1 ? 1 : 0);
      const struck = i < 2 && t > STRIKE[i];
      const chosen = i === 2 && t > PRESS[2];
      RF.drawText(s, o, x + 34, yy, chosen ? C.BULB : struck ? C.SLATE : C.PAPER, 2);
      if (struck) {
        const tw = RF.textWidth(o, 2);
        RF.handStroke(s, [x + 30, yy + 8, x + 36 + tw * 0.5, yy + 6, x + 40 + tw, yy + 7], C.CLAY, 300 + i, 2, seg(t, STRIKE[i], STRIKE[i] + 0.2), true);
      }
    });
    if (t >= MOVE[0]) {
      const u = E.outBack(seg(t, tm, tm + 0.16));
      const cy = RF.lerp(y + 13 + from * 21, y + 13 + cur * 21, u);
      const press = PRESS.some((p) => t > p && t < p + 0.1) ? 3 : 0;
      RF.drawText(s, '>', x + 14 + press, cy, C.BULB, 2);
    }
  };

  // ---------------- S7->S8 fog interlude: the market refills, nothing else ----------------
  OV.interlude = function (s, t) {
    if (t < 57.0 || t >= 59.95) return;
    const fade = seg(t, 57.0, 57.25) * (1 - seg(t, 59.6, 59.95));
    if (fade <= 0) return;
    const lv = RF.marketAt(t);
    const x0 = 118, y0 = 146;
    const label = 'MARKET';
    RF.drawText(s, label.slice(0, Math.ceil(fade * label.length)), x0, y0 - 22, C.BROWN, 2);
    let x = x0;
    for (let k = 0; k < 12; k++) {
      const w = 14 + (k % 3 === 1 ? 2 : 0) + (k === 7 ? 1 : 0);
      if (k / 12 < fade) {
        const fill = lv - k;
        s.frame(x, y0, w, 18, C.SAND);
        if (fill >= 1) s.rect(x + 2, y0 + 2, w - 4, 14, C.GREEN);
        else if (fill > 0.3) s.rect(x + 2, y0 + 2 + Math.round((1 - fill) * 14), w - 4, Math.round(fill * 14), C.SAGE);
      }
      x += w + (k % 4 === 2 ? 5 : 3);
    }
  };

  // ---------------- S8 quiet quest complete ----------------
  OV.complete = function (s, t) {
    if (t < 63.0) return;
    const head = 'QUEST COMPLETE', sub = 'HOW THEY GOT THERE';
    const n = Math.floor(seg(t, 63.0, 63.55) * head.length);
    RF.drawText(s, head.slice(0, n), 300, 112, C.UMBER, 2);
    RF.handStroke(s, [300, 131, 370, 132, 466, 130], C.BROWN, 801, 2, seg(t, 63.7, 63.95), true);
    const m = Math.floor(seg(t, 64.1, 64.6) * sub.length);
    RF.drawText(s, sub.slice(0, m), 302, 139, C.BROWN, 1);
  };
})();

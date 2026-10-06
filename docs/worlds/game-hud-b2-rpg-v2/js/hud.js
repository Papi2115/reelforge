/* HUD at native 640x360: woodgrain plates (the 1980s console veneer), black ribbed insets, Bezel type.
   Every element carries story data: year compass, story minimap with footprints, MARKET health, quest toasts. */
'use strict';
(function () {
  const RF = window.RF, C = RF.C, E = RF.ease, seg = RF.seg;
  const SW = 640, SH = 360;
  const GRAIN = new Uint8Array(SW * SH);
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const g = Math.sin(y * 0.9 + RF.vnoise(x * 0.07, y * 0.22, 1, 5) * 5.5 + x * 0.015);
      GRAIN[y * SW + x] = g > 0.6 ? C.BROWN : g < -0.86 ? C.TAN : C.WOOD;
    }
  const HUD = (RF.HUD = {});
  /** Woodgrain plate with a chamfered black edge (each plate is a slightly different cut of the veneer). */
  HUD.plate = function (b, x, y, w, h) {
    x = Math.round(x); y = Math.round(y);
    for (let yy = y + 1; yy < y + h - 1; yy++) for (let xx = x + 1; xx < x + w - 1; xx++) if (xx >= 0 && yy >= 0 && xx < SW && yy < SH) b.d[yy * SW + xx] = GRAIN[yy * SW + xx];
    b.rect(x + 1, y + 1, w - 2, 1, C.TAN);
    b.rect(x + 1, y + h - 2, w - 2, 1, C.UMBER);
    b.rect(x + w - 2, y + 1, 1, h - 2, C.UMBER);
    b.rect(x + 1, y, w - 2, 1, C.VOID); b.rect(x + 1, y + h - 1, w - 2, 1, C.VOID);
    b.rect(x, y + 1, 1, h - 2, C.VOID); b.rect(x + w - 1, y + 1, 1, h - 2, C.VOID);
  };
  /** Black ribbed inset (the console's ribbed top). */
  HUD.inset = function (b, x, y, w, h) {
    for (let yy = 0; yy < h; yy++) b.rect(x, y + yy, w, 1, yy % 3 === 2 ? C.SHADOW : C.VOID);
    b.rect(x, y, w, 1, C.CHAR);
  };
  const caretOn = (t) => (t * 3.3) % 1 < 0.6;

  // ---------------- compass: year + heading tape + objective marker ----------------
  function yearRoll(b, t, x, y) {
    const i = RF.locAt(t);
    const cur = i >= 0 ? RF.LOCS[i] : null;
    const prev = i > 0 ? RF.LOCS[i - 1] : null;
    if (!cur) return;
    const u = E.outBack(seg(t, cur[0], cur[0] + 0.42));
    const clip = new RF.Bmp(46, 18);
    const dir = prev && +prev[1] > +cur[1] ? -1 : 1; // going back in time rolls downwards
    if (prev && u < 1) RF.drawText(clip, prev[1], 2, 2 - dir * 18 * u, C.BULB, 2);
    RF.drawText(clip, cur[1], 2, 2 + dir * 18 * (1 - u), C.BULB, 2);
    b.blit(clip, x, y);
  }
  HUD.compass = function (b, t, cam, alpha) {
    if (alpha <= 0) return;
    const y0 = 14 - Math.round((1 - alpha) * 34);
    HUD.plate(b, 20, y0, 212, 26);
    HUD.inset(b, 25, y0 + 4, 46, 18);
    yearRoll(b, t, 25, y0 + 4);
    const tx = 76, tw = 150, ty = y0 + 4;
    HUD.inset(b, tx, ty, tw, 18);
    const bearing = cam.yaw + 90;
    const PX = tw / 124;
    for (let deg = 0; deg < 360; deg += 15) {
      let rel = deg - bearing;
      rel = ((rel + 540) % 360) - 180;
      if (Math.abs(rel) > 60) continue;
      const x = Math.round(tx + tw / 2 + rel * PX);
      if (deg % 90 === 0) {
        const ch = ['N', 'E', 'S', 'W'][deg / 90];
        RF.drawText(b, ch, x - 2, ty + 6, deg === 0 ? C.PAPER : C.PUTTY, 1);
      } else b.rect(x, ty + (deg % 45 === 0 ? 9 : 11), 1, deg % 45 === 0 ? 5 : 3, C.SLATE);
    }
    const tg = RF.targetAt(t);
    let tb = (Math.atan2(tg[2] - cam.y, tg[1] - cam.x) * 180) / Math.PI + 90;
    let rel = ((tb - bearing + 540) % 360) - 180;
    rel = RF.clamp(rel, -58, 58);
    const mx = Math.round(tx + tw / 2 + rel * PX);
    b.poly([mx - 3, ty + 3, mx, ty, mx + 3, ty + 3, mx, ty + 6], C.SAND_L);
    b.rect(tx + tw / 2, ty + 15, 1, 3, C.BULB);
    b.rect(tx + tw / 2 - 1, ty + 16, 3, 2, C.BULB);
    // location under the plate, typed when it changes
    const i = RF.locAt(t);
    if (i >= 0 && RF.LOCS[i][2] && alpha > 0.9) {
      const loc = RF.LOCS[i];
      const n = Math.floor(seg(t, loc[0] + 0.3, loc[0] + 0.3 + loc[2].length * 0.045) * loc[2].length);
      RF.drawText(b, loc[2].slice(0, n), 24, y0 + 30, C.PUTTY, 1, { shadow: C.VOID });
    }
  };

  // ---------------- MARKET bar + status effects ----------------
  HUD.market = function (b, t, alpha) {
    const lv = RF.marketAt(t);
    let y = 58;
    if (lv >= 0 && alpha > 0) {
      const appear = seg(t, 31.8, 32.5);
      b.rect(22, y - 2, 140, 11, C.VOID);
      b.rect(22, y - 2, 140, 1, C.CHAR);
      RF.drawText(b, 'MARKET', 25, y, C.SAND, 1);
      let x = 66;
      for (let k = 0; k < 12; k++) {
        const w = 6 + (k % 3 === 1 ? 1 : 0);
        const shown = appear * 12 * (1 + 0.15 * Math.sin(k)) > k;
        if (shown) {
          const fill = lv - k;
          let c = fill >= 1 ? C.FLUO : fill > 0 ? C.SAGE : C.CHAR;
          if (fill <= 0 && fill > -1.2 && t > 34 && (t * 7) % 1 < 0.5 && lv < 11.95) c = C.CLAY; // the segment you just lost
          b.rect(x, y, w, 6, c);
        }
        x += w + (k % 4 === 2 ? 3 : 2);
      }
      y += 14;
    }
    RF.STATUS.forEach((s) => {
      if (t < s.t0 || t >= s.t1 || alpha <= 0) return;
      const pop = E.outBack(seg(t, s.t0, s.t0 + 0.25));
      const out = seg(t, s.t1 - 0.3, s.t1);
      if (out >= 1) return;
      b.rect(22, y - 2, 11, 11, C.VOID);
      const ix = 24, iy = y;
      if (s.icon === 'hourglass') {
        b.poly([ix, iy, ix + 7, iy, ix + 3.5, iy + 3.5], C.TUNGSTEN);
        b.poly([ix + 3.5, iy + 3.5, ix + 7, iy + 7, ix, iy + 7], C.TUNGSTEN);
        b.rect(ix + 2, iy + 5, 3, 2, C.BULB);
      } else for (let k = 0; k < 3; k++) for (let xx = 0; xx < 8; xx++) b.px(ix + xx, iy + k * 3 + (xx % 4 < 2 ? 0 : 1), C.FLUO);
      const label = s.label.slice(0, Math.floor(pop * s.label.length * (1 - out)));
      RF.drawText(b, label, 37, y, s.icon === 'hourglass' ? C.TUNGSTEN : C.FLUO, 1, { shadow: C.VOID });
      y += 14;
    });
  };

  // ---------------- minimap: the story so far, with footprints ----------------
  HUD.minimap = function (b, t, cam, alpha) {
    if (alpha <= 0) return;
    const M = RF.MAP;
    const px = 538, py = 12 - Math.round((1 - alpha) * 80), pw = 86, ph = 66;
    HUD.plate(b, px, py, pw, ph);
    const ix = px + 4, iy = py + 4, iw = pw - 8, ih = ph - 8;
    b.rect(ix, iy, iw, ih, C.VOID);
    const S = 3;
    const curReg = M.regionOfX(Math.floor(cam.x));
    const wall = RF.MAP.era(t) === 1 ? M.wall : M.wall2014;
    const isOpen = (cx, cy) => cx >= 0 && cy >= 0 && cx < M.W && cy < M.H && wall[cy * M.W + cx] !== M.WT.auto && M.regionOfX(cx) <= curReg;
    const ox = ix + iw / 2 - cam.x * S, oy = iy + ih / 2 - cam.y * S;
    const c0 = Math.floor((ix - ox) / S) - 1, c1 = Math.ceil((ix + iw - ox) / S) + 1;
    const r0 = Math.floor((iy - oy) / S) - 1, r1 = Math.ceil((iy + ih - oy) / S) + 1;
    const plot = (x, y, w, h, c) => {
      const x0 = Math.max(ix, Math.round(x)), y0 = Math.max(iy, Math.round(y));
      const x1 = Math.min(ix + iw, Math.round(x + w)), y1 = Math.min(iy + ih, Math.round(y + h));
      if (x1 > x0 && y1 > y0) b.rect(x0, y0, x1 - x0, y1 - y0, c);
    };
    for (let cy = r0; cy <= r1; cy++)
      for (let cx = c0; cx <= c1; cx++) {
        if (cx < 0 || cy < 0 || cx >= M.W || cy >= M.H) continue;
        const id = wall[cy * M.W + cx];
        const sx = ox + cx * S, sy = oy + cy * S;
        if (M.regionOfX(cx) > curReg) continue;
        if (id === M.WT.empty) plot(sx, sy, S, S, cx >= 75 && cx <= 81 && cy >= 16 && cy <= 24 ? C.DIRT_D : C.SHADOW);
        else if (id === M.WT.auto) {
          if (isOpen(cx + 1, cy) || isOpen(cx - 1, cy) || isOpen(cx, cy + 1) || isOpen(cx, cy - 1)) plot(sx, sy, S, S, C.SLATE);
        } else if (id === M.WT.door) plot(sx + 1, sy, 1, S, C.TAN);
        else plot(sx, sy, S, S, C.CHAR);
      }
    const steps = RF.stepsUntil(t);
    const from = Math.max(0, steps.length - 70);
    for (let k = from; k < steps.length; k++) {
      const p = RF.positionAtDist(steps[k]);
      const len = Math.hypot(p.dx, p.dy) || 1;
      const side = k % 2 ? 0.16 : -0.16;
      const fx = ox + (p.x - (p.dy / len) * side) * S, fy = oy + (p.y + (p.dx / len) * side) * S;
      if (fx >= ix && fy >= iy && fx < ix + iw && fy < iy + ih) b.px(fx, fy, steps.length - k < 18 ? C.SAND : C.SLATE);
    }
    const cx = ix + iw / 2, cy = iy + ih / 2, a = cam.a;
    const tip = [cx + Math.cos(a) * 4, cy + Math.sin(a) * 4];
    const l = [cx + Math.cos(a + 2.4) * 3.2, cy + Math.sin(a + 2.4) * 3.2], r = [cx + Math.cos(a - 2.4) * 3.2, cy + Math.sin(a - 2.4) * 3.2];
    b.poly([tip[0], tip[1], l[0], l[1], r[0], r[1]], C.BULB);
    RF.drawText(b, 'N', ix + iw - 7, iy + 2, C.SLATE, 1);
  };

  // ---------------- toasts (quest / item), type in, backspace out ----------------
  HUD.toasts = function (b, t) {
    RF.TOASTS.forEach((o) => {
      if (t < o.t0 || t >= o.t1) return;
      const back = seg(t, o.t1 - 0.45, o.t1 - 0.1);
      const n = Math.floor(RF.typedCount(o.times, t) * (1 - back));
      const body = o.body.slice(0, n);
      const hw = RF.textWidth(o.head, 1), bw = RF.textWidth(o.body, 1);
      const w = Math.max(hw, bw) + 16;
      const x = 624 - w, y = 86;
      const pop = E.outBack(seg(t, o.t0, o.t0 + 0.2)) * (1 - seg(t, o.t1 - 0.12, o.t1));
      if (pop <= 0.02) return;
      const h = Math.round(28 * pop);
      HUD.plate(b, x, y, w, Math.max(4, h));
      if (h < 26) return;
      b.rect(x + 3, y + 13, w - 6, 12, C.VOID);
      RF.drawText(b, o.head, x + 7, y + 4, o.head === 'QUEST UPDATED' || o.head === 'NEW QUEST' ? C.BULB : C.PAPER, 1);
      RF.drawText(b, body, x + 7, y + 16, C.PAPER, 1);
      if (n < o.body.length && caretOn(t)) b.rect(x + 8 + RF.textWidth(body, 1), y + 16, 2, 7, C.BULB);
    });
  };

  // ---------------- dialogue box ----------------
  HUD.dialogueBox = function (b, x, y, w, h, speaker) {
    b.rect(x, y, w, h, C.SHADOW);
    b.frame(x - 1, y - 1, w + 2, h + 2, C.VOID);
    for (let xx = x; xx < x + w; xx++) for (let yy = y; yy < y + 4; yy++) b.d[yy * SW + xx] = GRAIN[yy * SW + xx];
    b.rect(x, y + 4, w, 1, C.UMBER);
    b.rect(x + w - 1, y + 5, 1, h - 5, C.CHAR);
    if (speaker) {
      const tw = RF.textWidth(speaker, 1) + 14;
      HUD.plate(b, x + 9, y - 13, tw, 15);
      RF.drawText(b, speaker, x + 16, y - 9, C.BULB, 1);
    }
  };
  HUD.dialogue = function (b, t) {
    const lines = RF.LINES;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const prev = lines[i - 1], next = lines[i + 1];
      const chainIn = prev && l.t0 - prev.t1 < 0.35;
      const chainOut = next && next.t0 - l.t1 < 0.35;
      const end = chainOut ? next.t0 : l.t1 + 0.12;
      if (t < l.t0 || t >= end) continue;
      const parts = l.text.split('\n');
      const textW = Math.max(...parts.map((p) => RF.textWidth(p, 2)));
      const w = Math.max(230, textW + 34), x = 28, hFull = 22 + parts.length * 19;
      const open = chainIn ? 1 : E.outBack(seg(t, l.t0, l.t0 + 0.14));
      const close = chainOut ? 0 : seg(t, l.t1, l.t1 + 0.12);
      const h = Math.max(3, Math.round(hFull * open * (1 - close)));
      const y = 312 - hFull + Math.round((hFull - h) / 2);
      HUD.dialogueBox(b, x, y, w, h, h > hFull - 4 ? l.speaker : '');
      if (h < hFull - 2) return;
      const n = RF.typedCount(l.times, t);
      const caret = RF.drawLines(b, l.text, x + 16, y + 13, C.PAPER, 2, 19, n);
      if (t < l.t1 && caretOn(t)) b.rect(caret.x + 2, caret.y, 3, 14, C.BULB);
      return;
    }
  };
  RF.HUD_W = SW; RF.HUD_H = SH;
})();

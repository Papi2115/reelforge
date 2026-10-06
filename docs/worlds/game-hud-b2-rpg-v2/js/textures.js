/* Wall / floor / ceiling textures, 64x64 palette indices, generated once from fixed seeds.
   Uneven by design: stains, cracks, offset cartons, worn paint. */
'use strict';
(function () {
  const RF = window.RF, C = RF.C, T = RF.T, S = 64;
  const TEX = (RF.TEX = {});
  const TEX_LIST = (RF.TEX_LIST = []);
  function reg(name, bmp, emis, level) {
    bmp.name = name;
    bmp.emis = new Uint8Array(256);
    (emis || []).forEach((c) => (bmp.emis[c] = 1));
    bmp.emisLevel = level === undefined ? 1.25 : level;
    bmp.id = TEX_LIST.length;
    TEX_LIST.push(bmp);
    TEX[name] = bmp;
    return bmp;
  }
  const newTex = (fill) => new RF.Bmp(S, S, fill === undefined ? C.SLATE : fill);
  const n2 = (x, y, cell, seed) => RF.vnoise(x, y, cell, seed) * 0.75 + RF.hash3(x, y, seed + 99) * 0.25;
  /** Shade ramp pick by noise value. */
  function noisy(b, ramp, cell, seed, x0, y0, w, h) {
    for (let y = y0 || 0; y < (y0 || 0) + (h || S); y++)
      for (let x = x0 || 0; x < (x0 || 0) + (w || S); x++) {
        const v = n2(x, y, cell, seed);
        b.px(x, y, ramp[Math.min(ramp.length - 1, Math.floor(v * ramp.length))]);
      }
  }

  // ---------------- corridor (1983, nobody looks after it) ----------------
  function corrWall(seed) {
    const b = newTex();
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const v = RF.vnoise(x, y * 0.45, 20, seed); // streaky, vertical damp
        b.px(x, y, v < 0.3 || (v < 0.36 && RF.bayer(x, y) < 0.5) ? C.CHAR : C.SLATE);
        if (RF.hash3(x, y, seed + 3) < 0.012) b.px(x, y, C.GREY);
      }
    for (let x = 0; x < S; x++) {
      const top = 6 + RF.vnoise(x, 0, 9, seed + 5) * 10;
      for (let y = 0; y < top; y++) b.px(x, y, y > top - 2 && RF.bayer(x, y) < 0.5 ? C.SLATE : C.DIRT_D);
    }
    [9, 23, 44].forEach((x, i) => { const len = 10 + ((seed + i * 7) % 20); for (let y = 10; y < 10 + len; y++) b.px(x + (y > 20 ? 1 : 0), y, C.DIRT_D); });
    RF.handStroke(b, [36, 18, 38, 27, 34, 36, 39, 45], C.CHAR, seed + 1, 3, 1);
    b.rect(0, 0, 1, S, C.SHADOW);
    b.rect(0, 55, S, 1, C.SHADOW);
    b.rect(0, 56, S, 8, C.CHAR);
    b.rect(0, 56, S, 1, C.GREY);
    return b;
  }
  reg('corrWall', corrWall(11));
  const tally = corrWall(23);
  // chalk tally: four strokes and the gate - five (weeks), long before the viewer knows why
  [16, 23, 29, 36].forEach((x, i) => RF.handStroke(tally, [x, 22 + (i % 2), x + 1, 42 - (i === 2 ? 2 : 0)], C.PAPER, 40 + i, 2, 1, true));
  RF.handStroke(tally, [11, 38, 43, 25], C.PAPER, 47, 3, 1, true);
  tally.px(44, 37, C.GREY); tally.px(46, 38, C.GREY);
  reg('corrTally', tally);

  // ---------------- doors ----------------
  function door(base, hi, lo) {
    const b = newTex(base);
    b.rect(0, 0, S, 3, lo); b.rect(0, 0, 3, S, lo); b.rect(61, 0, 3, S, lo);
    [[7, 6, 50, 22], [7, 34, 50, 18]].forEach(([x, y, w, h]) => {
      b.rect(x, y, w, 1, hi); b.rect(x, y, 1, h, hi);
      b.rect(x, y + h - 1, w, 1, lo); b.rect(x + w - 1, y, 1, h, lo);
    });
    b.rect(54, 28, 4, 5, C.CHAR);
    b.rect(3, 56, 58, 6, lo);
    for (let i = 0; i < 6; i++) RF.handStroke(b, [10 + i * 8, 52 + (i % 3), 15 + i * 8, 55], lo, 300 + i, 1, 1);
    [[5, 5], [58, 5], [5, 58], [58, 58]].forEach(([x, y]) => b.px(x, y, hi));
    return b;
  }
  reg('door', door(C.GREY, C.PUTTY, C.SLATE));

  // ---------------- office 1982: wood panelling, tungsten ----------------
  function officeWall(seed) {
    const b = newTex(C.WOOD);
    for (let x = 0; x < S; x++) {
      const board = x >> 3;
      const dark = RF.hash3(board, seed, 1) < 0.3;
      for (let y = 0; y < S; y++) {
        const low = y > 40;
        const g = Math.sin((y + board * 13) * 0.33 + RF.vnoise(x * 3, y, 9, board + seed) * 6);
        let c = dark || low ? C.BROWN : C.WOOD;
        if (g > 0.78) c = c === C.WOOD ? C.BROWN : C.UMBER;
        else if (g < -0.93 && !low) c = C.TAN;
        if ((x & 7) === 0) c = C.UMBER;
        b.px(x, y, c);
      }
    }
    b.rect(0, 38, S, 1, C.TAN); b.rect(0, 39, S, 2, C.UMBER);
    b.rect(0, 60, S, 4, C.UMBER);
    b.ellipse(13 + (seed % 30), 18 + (seed % 9), 2, 1.4, C.UMBER);
    return b;
  }
  reg('officeWall', officeWall(3));
  const cal = officeWall(8);
  cal.poly([17, 6, 47, 7, 46, 43, 16, 42], C.PAPER);
  cal.rect(18, 8, 27, 6, C.BROWN);
  RF.drawText(cal, '1982', 21, 8, C.PAPER, 1);
  for (let r = 0; r < 5; r++)
    for (let k = 0; k < 7; k++) {
      const x = 18 + k * 4, y = 17 + r * 5;
      cal.px(x + 1, y + 1, C.SAND);
      if (r * 7 + k < 23) { cal.px(x + 1, y + 1, C.BROWN); cal.px(x + 2, y + 2, C.BROWN); cal.px(x + 2, y + 1, C.WOOD); }
    }
  cal.rect(31, 4, 2, 3, C.CHAR);
  cal.rect(40, 36, 8, 7, C.SAND_L);
  reg('officeCal', cal);
  const poster = officeWall(5);
  poster.rect(9, 7, 34, 40, C.NIGHT);
  poster.frame(9, 7, 34, 40, C.PUTTY);
  for (let i = 0; i < 18; i++) poster.px(11 + RF.hash3(i, 1, 2) * 30, 9 + RF.hash3(i, 2, 2) * 34, C.MOON);
  poster.ellipse(29, 22, 8, 8, C.MOON);
  poster.ellipse(32, 20, 6, 6.5, C.HAZE);
  poster.poly([14, 40, 22, 30, 25, 40], C.PUTTY);
  poster.rect(8, 6, 4, 3, C.SAND_L); poster.rect(40, 45, 4, 3, C.SAND_L);
  // hand-drawn arrow to the door, two strokes, the head overshoots
  RF.handStroke(poster, [45, 30, 61, 32], C.PAPER, 71, 2, 1, true);
  RF.handStroke(poster, [55, 26, 62, 32, 54, 37], C.PAPER, 72, 2, 1, true);
  reg('officePoster', poster);
  const cub = newTex(C.GREY);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) if ((x + y * 2) % 3 === 0 || RF.hash3(x, y, 61) < 0.12) cub.px(x, y, C.SLATE);
  cub.rect(0, 0, S, 4, C.PUTTY); cub.rect(0, 4, S, 1, C.CHAR);
  cub.rect(38, 14, 11, 13, C.PAPER); cub.rect(42, 13, 2, 2, C.CLAY);
  for (let i = 0; i < 4; i++) cub.rect(40, 17 + i * 2, 4 + ((i * 3) % 5), 1, C.GREY);
  reg('cubicle', cub);

  // ---------------- warehouse: pallet racking, cartons stencilled E.T. ----------------
  function carton(b, x, y, w, h, seed) {
    b.rect(x, y, w, h, C.TAN);
    b.rect(x + w - 3, y, 3, h, C.WOOD);
    b.rect(x, y + h - 1, w, 1, C.WOOD);
    b.rect(x + (w >> 1) - 1, y, 3, 4, C.SAND_L);
    b.rect(x, y, w - 3, 1, C.SAND_L);
    if (w > 18 && h > 11) RF.drawText(b, 'E.T.', x + 3 + (seed % 3), y + h - 9, C.BROWN, 1);
  }
  function shelf(seed) {
    const b = newTex(C.SHADOW);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (RF.bayer(x, y) < 0.3) b.px(x, y, C.VOID);
    [[3, 19], [23, 40], [44, 60]].forEach(([top, bottom], lvl) => {
      let x = 4 + Math.floor(RF.hash3(seed, lvl, 1) * 3);
      for (let k = 0; k < 2; k++) {
        const r = RF.hash3(seed, lvl, k + 5);
        const w = r < 0.15 ? 15 : 25 + Math.floor(RF.hash3(seed, lvl, k) * 3);
        const h = 13 + Math.floor(RF.hash3(seed, k, lvl) * 4);
        if (!(r > 0.9 && k === 1)) carton(b, x, bottom - h, w, h, seed + lvl);
        x += w + 2 + Math.floor(RF.hash3(seed, k, 9) * 3);
      }
    });
    [0, 20, 41, 61].forEach((y) => { b.rect(0, y, S, 3, C.CLAY); b.rect(0, y, S, 1, C.TAN); b.rect(0, y + 2, S, 1, C.BROWN); });
    [0, 61].forEach((x) => {
      b.rect(x, 0, 3, S, C.DUSK); b.rect(x + 1, 0, 1, S, C.HAZE);
      for (let y = 2; y < S; y += 4) b.px(x + 1, y, C.NIGHT);
    });
    return b;
  }
  reg('whShelf', shelf(1));
  reg('whShelf2', shelf(7));
  reg('whShelf3', shelf(12));
  function shelfEnd(sign) {
    const b = newTex(C.SHADOW);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (RF.bayer(x, y) < 0.4) b.px(x, y, C.VOID);
    for (let y = 4; y < S; y += 15) { b.line(4, y, 58, y + 13, C.DUSK); b.line(58, y, 4, y + 13, C.DUSK); }
    [[2, 5], [56, 6]].forEach(([x, w]) => { b.rect(x, 0, w, S, C.DUSK); b.rect(x + 1, 0, 1, S, C.HAZE); });
    if (sign) {
      b.poly([16, 18, 46, 17, 47, 40, 17, 41], C.PAPER);
      b.rect(29, 16, 6, 3, C.SAND_L);
      RF.drawText(b, 'E.T.', 21, 21, C.CHAR, 1, { bold: true });
      RF.handStroke(b, [20, 33, 41, 33], C.CHAR, 81, 2, 1);
      RF.handStroke(b, [36, 29, 42, 33, 36, 37], C.CHAR, 82, 1, 1);
    }
    return b;
  }
  reg('whShelfEnd', shelfEnd(false));
  reg('whShelfSign', shelfEnd(true));
  const corr = newTex(C.GREY);
  for (let x = 0; x < S; x++) {
    const ph = x % 6, base = [C.PUTTY, C.GREY, C.GREY, C.SLATE, C.SLATE, C.GREY][ph];
    const rust = RF.hash3(x >> 1, 4, 4) > 0.82;
    for (let y = 0; y < S; y++) b2(x, y, base, rust);
  }
  function b2(x, y, base, rust) {
    let c = base;
    if (rust && y > 10 + RF.hash3(x >> 1, 5, 5) * 20 && y < 54) c = RF.hash3(x, y, 6) < 0.5 ? C.DIRT : C.CLAY;
    if (y === 9 && x % 8 === 3) c = C.CHAR;
    corr.px(x, y, c);
  }
  noisy(corr, [C.SLATE, C.GREY, C.SLATE], 6, 9, 0, 56, S, 8);
  reg('whWall', corr);

  // ---------------- toy store: clones (same pictogram, new paint) ----------------
  const BOX_COLS = [C.GREEN, C.DUSK, C.CLAY, C.TUNGSTEN, C.SAGE, C.HAZE, C.PLUM, C.WOOD];
  const DARKER = {};
  DARKER[C.GREEN] = C.MOSS; DARKER[C.DUSK] = C.NIGHT; DARKER[C.CLAY] = C.BROWN; DARKER[C.TUNGSTEN] = C.TAN;
  DARKER[C.SAGE] = C.GREEN; DARKER[C.HAZE] = C.DUSK; DARKER[C.PLUM] = C.SHADOW; DARKER[C.WOOD] = C.BROWN;
  function pictogram(b, kind, x, y, c) {
    if (kind === 0) b.poly([x, y + 5, x + 3, y, x + 6, y + 5], c); // ship
    else if (kind === 1) { b.frame(x, y, 6, 6, c); b.rect(x + 2, y + 2, 2, 2, c); } // maze
    else b.ellipse(x + 3, y + 3, 3, 3, c); // blob
  }
  function box(b, x, y, w, h, col, kind, band) {
    b.rect(x, y, w, h, col);
    b.rect(x + w - 1, y, 1, h, DARKER[col]);
    b.rect(x, y, w - 1, 3, band);
    if (w >= 8 && h >= 12) pictogram(b, kind, x + ((w - 7) >> 1), y + 5, C.PAPER);
  }
  function toyShelf(seed, packed) {
    const b = newTex(C.PUTTY);
    for (let y = 1; y < S; y += 4) for (let x = 2; x < S; x += 4) b.px(x, y, C.GREY);
    const kind = seed % 3;
    [[2, 21], [25, 43], [47, 61]].forEach(([top, bottom], lvl) => {
      let x = 1;
      let i = 0;
      while (x < S - 4) {
        const r = RF.rng(seed * 100 + lvl * 10 + i);
        const w = 7 + Math.floor(r() * (packed ? 3 : 5));
        const h = Math.min(bottom - top, 12 + Math.floor(r() * 6));
        const col = BOX_COLS[Math.floor(r() * BOX_COLS.length)];
        box(b, x, bottom - h, Math.min(w, S - x), h, col, packed && r() < 0.4 ? (kind + 1) % 3 : kind, r() < 0.5 ? C.PAPER : C.SAND_L);
        if (packed && r() < 0.5 && bottom - h - 6 > top) box(b, x + 1, bottom - h - 6, w + 2, 6, BOX_COLS[(i + 3) % 8], kind, C.PAPER);
        x += w + (packed ? 0 : r() < 0.3 ? 2 : 1);
        i++;
      }
      b.rect(0, bottom + 1, S, 2, C.GREY); b.rect(0, bottom + 3, S, 1, C.PAPER);
    });
    if (packed) {
      b.rect(30, 44, 25, 10, C.PAPER); b.rect(30, 53, 25, 1, C.SAND);
      RF.drawText(b, 'SALE', 31, 46, C.CLAY, 1, { jitter: seed + 3 });
    }
    return b;
  }
  reg('toyShelf', toyShelf(4, false));
  reg('toyShelf2', toyShelf(5, false));
  reg('toyPacked', toyShelf(6, true));
  reg('toyPacked2', toyShelf(10, true));

  // ---------------- returns: cinderblock, counter ----------------
  const cb = newTex(C.PUTTY);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const row = y >> 3, off = row & 1 ? 8 : 0;
      let c = RF.hash3(x, y, 21) < 0.18 ? C.GREY : C.PUTTY;
      if (RF.hash3((x + off) >> 4, row, 22) < 0.18 && RF.hash3(x, y, 23) < 0.5) c = C.SAND;
      if ((y & 7) === 7 || ((x + off) & 15) === 0) c = C.GREY;
      if (y >= 44 && y < 48) c = C.CLAY;
      cb.px(x, y, c);
    }
  RF.handStroke(cb, [6, 30, 20, 27, 31, 33], C.SLATE, 91, 2, 1);
  reg('retWall', cb);
  const counter = newTex(C.WOOD);
  for (let x = 0; x < S; x++) for (let y = 0; y < S; y++) if (x % 11 === 0 || RF.hash3(x, y >> 2, 31) < 0.08) counter.px(x, y, C.BROWN);
  counter.rect(0, 0, S, 6, C.TAN); counter.rect(0, 0, S, 1, C.SAND_L); counter.rect(0, 6, S, 1, C.UMBER);
  counter.rect(0, 54, S, 10, C.CHAR);
  counter.rect(9, 22, 12, 9, C.PAPER); counter.rect(14, 21, 2, 2, C.SAND_L); // a taped slip, slightly off
  reg('counter', counter);

  // ---------------- desert: fence, tape ----------------
  const fence = newTex(T);
  for (let y = 4; y < S; y++) for (let x = 0; x < S; x++) if ((x + y) % 7 === 0 || (x - y + 70) % 7 === 0) fence.px(x, y, C.GREY);
  fence.rect(0, 2, S, 2, C.PUTTY); fence.rect(0, 0, 2, S, C.SLATE);
  reg('fence', fence);
  const tape = newTex(T);
  tape.rect(0, 4, 3, 60, C.WOOD); tape.rect(0, 4, 1, 60, C.TAN);
  for (let x = 0; x < S; x++) {
    const sag = Math.round(3 * Math.sin((Math.PI * x) / S));
    for (let y = 8; y < 14; y++) tape.px(x, y + sag, (x + y) % 8 < 4 ? C.TUNGSTEN : C.VOID);
  }
  reg('tape', tape);

  // ---------------- floors ----------------
  const conc = newTex(); noisy(conc, [C.CHAR, C.SLATE, C.SLATE, C.GREY], 10, 41);
  RF.handStroke(conc, [3, 40, 18, 44, 30, 39], C.CHAR, 42, 2, 1);
  reg('concrete', conc);
  const concSand = newTex(); noisy(concSand, [C.CHAR, C.SLATE, C.SLATE, C.GREY], 10, 41);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - 22, y - 30) + RF.vnoise(x, y, 6, 5) * 14;
    if (d < 22 || (d < 34 && RF.hash3(x, y, 44) < 0.25)) concSand.px(x, y, d < 14 ? C.SAND_L : C.SAND);
  }
  reg('concreteSand', concSand);
  const carpet = newTex(); noisy(carpet, [C.MOSS_D, C.MOSS, C.MOSS, C.GREEN], 3, 51); reg('carpet', carpet);
  const whf = newTex(); noisy(whf, [C.SLATE, C.GREY, C.GREY, C.SLATE], 12, 52); whf.rect(0, 0, S, 1, C.CHAR); whf.rect(0, 0, 1, S, C.CHAR);
  reg('whFloor', whf);
  const whl = newTex(); whl.blit(whf, 0, 0);
  for (let x = 0; x < S; x++) for (let y = 29; y < 34; y++) if (RF.hash3(x, y, 53) > 0.12 + (x > 40 ? 0.25 : 0)) whl.px(x, y, C.TUNGSTEN);
  reg('whLine', whl);
  const tile = newTex();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const chk = ((x >> 4) + (y >> 4)) & 1;
    tile.px(x, y, RF.hash3(x, y, 54) < 0.1 ? C.GREY : chk ? C.PUTTY : C.SAND_L);
  }
  reg('storeTile', tile);
  const rt = newTex();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const chk = ((x >> 5) + (y >> 5)) & 1;
    rt.px(x, y, RF.hash3(x, y, 55) < 0.06 ? C.SAND : chk ? C.GREY : C.PUTTY);
  }
  reg('retTile', rt);
  function sand(seed, tracks) {
    const b = newTex();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const rip = Math.sin(x * 0.21 + y * 0.09 + RF.vnoise(x, y, 16, seed) * 5);
      b.px(x, y, rip > 0.86 ? C.SAND_L : RF.hash3(x, y, seed) < 0.03 ? C.DIRT : C.SAND);
    }
    if (tracks) [14, 44].forEach((y0) => { for (let x = 0; x < S; x++) for (let y = y0; y < y0 + 6; y++) if ((x + (y0 >> 2)) % 5 < 2) b.px(x, y, C.DIRT); });
    return b;
  }
  reg('sand', sand(61, false));
  reg('sandTracks', sand(62, true));
  const pit = newTex(C.DIRT_D);
  const pr = RF.rng(64);
  for (let i = 0; i < 70; i++) {
    const x = pr() * 64, y = pr() * 64, k = pr();
    if (k < 0.45) pit.rect(x, y, 6 + pr() * 8, 4 + pr() * 5, pr() < 0.6 ? C.TAN : C.WOOD);
    else if (k < 0.8) { pit.rect(x, y, 4, 5, C.CHAR); pit.px(x + 1, y + 2, C.PAPER); }
    else pit.rect(x, y, 3 + pr() * 4, 2, [C.DUSK, C.CLAY, C.GREEN][Math.floor(pr() * 3)]);
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (RF.hash3(x, y, 65) < 0.2) pit.px(x, y, C.DIRT_D);
  reg('pit', pit);
  const trench = newTex(); noisy(trench, [C.DIRT_D, C.DIRT, C.DIRT], 9, 66);
  for (let k = 0; k < 5; k++) RF.handStroke(trench, [4 + k * 12, 6, 7 + k * 12, 58], C.DIRT_D, 67 + k, 3, 1, true);
  const tr = RF.rng(68);
  for (let i = 0; i < 9; i++) { const x = tr() * 58, y = tr() * 58; trench.rect(x, y, 4, 5, C.CHAR); trench.px(x + 1, y + 1, C.SAND); }
  reg('trench', trench);

  const pw = newTex(C.DIRT);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const band = Math.sin(y * 0.45 + RF.vnoise(x, y, 12, 81) * 3);
    pw.px(x, y, band > 0.6 ? C.DIRT_D : band < -0.8 ? C.SAND : RF.hash3(x, y, 82) < 0.08 ? C.DIRT_D : C.DIRT);
  }
  const pwr = RF.rng(83);
  for (let i = 0; i < 9; i++) { const x = pwr() * 60, y = 20 + pwr() * 40; pw.rect(x, y, 5, 3, pwr() < 0.5 ? C.CHAR : C.TAN); }
  reg('pitWall', pw);

  // ---------------- ceilings (emissive tubes / panels) ----------------
  const cc = newTex(); noisy(cc, [C.SHADOW, C.CHAR, C.CHAR], 9, 71); cc.rect(0, 40, S, 3, C.SLATE); reg('corrCeil', cc);
  const oc = () => { const b = newTex(C.GREY); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (RF.hash3(x, y, 72) < 0.05) b.px(x, y, C.SLATE); return b; };
  reg('offCeil', oc());
  const ol = oc(); ol.rect(10, 18, 44, 28, C.TUNGSTEN); ol.rect(12, 20, 40, 24, C.BULB);
  reg('offLight', ol, [C.BULB, C.TUNGSTEN]);
  const wc = newTex(C.SHADOW);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (y < 3 || RF.hash3(x, y, 73) < 0.04) wc.px(x, y, y === 0 ? C.SLATE : C.CHAR);
  reg('whCeil', wc);
  function tube(base, w) {
    const b = new RF.Bmp(S, S); b.blit(base, 0, 0);
    b.rect(4, 26, 56, 10, C.SLATE); b.rect(6, 28, 52, 6, C.CHAR);
    for (let i = 0; i < w; i++) b.rect(7, 29 + i * 3, 50, 2, C.TUBE);
    return b;
  }
  reg('whTube', tube(wc, 1), [C.TUBE]);
  reg('whTubeFlicker', tube(wc, 1), [C.TUBE]);
  const sc = newTex(C.PUTTY);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (y === 0 || RF.hash3(x, y, 74) < 0.05) sc.px(x, y, C.GREY);
  reg('storeCeil', sc);
  reg('storeTube', tube(sc, 2), [C.TUBE]);
  const rc = newTex(C.GREY);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (RF.hash3(x, y, 75) < 0.06) rc.px(x, y, C.SLATE);
  reg('retCeil', rc);
  reg('retTubeFlicker', tube(rc, 1), [C.TUBE]);
})();

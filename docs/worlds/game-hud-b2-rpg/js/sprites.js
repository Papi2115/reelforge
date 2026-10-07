/* Billboard sprites + the first-person hand. Drawn once from shapes, then outlined; all seeded. */
'use strict';
(function () {
  const RF = window.RF, C = RF.C, T = RF.T, Bmp = RF.Bmp;
  const SPR = (RF.SPR = {});
  function reg(name, bmp, emis) {
    bmp.emis = new Uint8Array(256);
    (emis || []).forEach((c) => (bmp.emis[c] = 1));
    SPR[name] = bmp;
    return bmp;
  }

  // ---------------- the cartridge (generic 2600-style shell, our own label) ----------------
  function cartridge(w, h, dirty, seed, band) {
    const b = new Bmp(w, h);
    const s = w / 46;
    b.rect(0, 0, w, h, C.CHAR);
    b.rect(0, 0, w, 1, C.SLATE); b.rect(0, 0, 1, h, C.SLATE);
    for (let y = Math.round(2 * s); y < Math.round(11 * s); y += Math.max(2, Math.round(2 * s))) b.rect(1, y, w - 2, 1, C.SLATE);
    const lx = Math.round(4 * s), ly = Math.round(13 * s), lw = w - 2 * lx, lh = Math.round(27 * s);
    b.rect(lx, ly, lw, lh, C.PAPER);
    b.rect(lx, ly, lw, Math.max(1, Math.round(6 * s)), band === undefined ? C.ACCENT : band);
    b.rect(lx, ly + lh - Math.max(1, Math.round(4 * s)), lw, Math.max(1, Math.round(2 * s)), C.DUSK);
    if (w >= 40) {
      RF.drawText(b, 'E.T.', lx + 4, ly + Math.round(9 * s), C.VOID, 1);
      b.ellipse(lx + lw - 8, ly + Math.round(12 * s), 3.5, 3.5, C.SAND_L); // a moon, not a logo
      b.ellipse(lx + lw - 7, ly + Math.round(11 * s), 3, 3, C.PAPER);
    } else b.rect(lx + 2, ly + Math.round(10 * s), Math.max(2, lw - 6), 1, C.VOID);
    b.rect(0, h - 1, w, 1, C.SHADOW);
    if (dirty) {
      const r = RF.rng(seed || 5);
      for (let i = 0; i < w * h * 0.16; i++) {
        const x = r() * w, y = r() * h;
        if (w >= 40 && x > lx + 2 && x < lx + 22 && y > ly + 7 && y < ly + 19) continue; // the name stays readable
        b.px(x, y, r() < 0.6 ? C.DIRT : C.SAND);
      }
      for (let x = 0; x < w; x++) for (let y = h - 6 - Math.round(3 * Math.sin(x * 0.4)); y < h; y++) if (RF.hash3(x, y, 9) < 0.7) b.px(x, y, C.DIRT);
    }
    return b;
  }
  RF.cartridge = cartridge;
  const smallCart = cartridge(14, 16, false);
  smallCart.outline(C.VOID);
  const mutedCart = cartridge(14, 16, false, 0, C.CLAY); // every other copy stays CLAY; only ours gets the accent
  mutedCart.outline(C.VOID);

  // ---------------- S1: the bulb and the sand ----------------
  const bulb = new Bmp(12, 48);
  for (let y = 0; y < 34; y++) bulb.px(y > 18 ? 5 : 6, y, y % 3 ? C.CHAR : C.SLATE);
  bulb.poly([3, 34, 9, 34, 11.5, 40, 0.5, 40], C.SLATE);
  bulb.rect(2, 35, 2, 4, C.GREY);
  bulb.rect(0, 39, 12, 1, C.CHAR);
  bulb.ellipse(6, 43, 3.2, 4, C.BULB);
  bulb.rect(4, 40, 4, 1, C.TUNGSTEN);
  bulb.px(6, 47, C.TUNGSTEN);
  reg('bulb', bulb, [C.BULB, C.TUNGSTEN]);
  const bulbOff = new Bmp(12, 48);
  bulbOff.blit(bulb, 0, 0);
  for (let i = 0; i < bulbOff.d.length; i++) if (bulbOff.d[i] === C.BULB || bulbOff.d[i] === C.TUNGSTEN) bulbOff.d[i] = C.GREY;
  reg('bulbOff', bulbOff);

  const pile = new Bmp(64, 26);
  pile.blit(RF.rotate(smallCart, -28), 8, 0);
  for (let x = 0; x < 64; x++) {
    const hx = 17 * Math.exp(-Math.pow((x - 31) / 17, 2)) + 3 * RF.vnoise(x, 0, 5, 3) + (x < 26 ? 2 : 0);
    for (let y = Math.round(26 - hx); y < 26; y++) {
      const depth = y - (26 - hx);
      let c = depth < 2 ? C.SAND_L : depth < hx * 0.6 ? C.SAND : C.DIRT;
      if (x > 40 && depth > 1 && RF.bayer(x, y) < 0.5) c = C.DIRT;
      pile.px(x, y, c);
    }
  }
  for (let i = 0; i < 14; i++) pile.px(46 + i * 1.3 + RF.hash3(i, 1, 1) * 2, 24 + RF.hash3(i, 2, 1) * 2, C.SAND);
  reg('sandPile', pile);

  // ---------------- S2: programmer at the desk, from behind (no face) ----------------
  function progDesk(frame) {
    const b = new Bmp(96, 72);
    b.rect(4, 49, 6, 23, C.BROWN); b.rect(82, 49, 8, 23, C.BROWN);
    b.rect(4, 42, 88, 4, C.TAN); b.rect(4, 46, 88, 3, C.WOOD); b.rect(4, 42, 88, 1, C.SAND_L);
    // CRT: screen faces him, so it faces us
    b.rect(54, 13, 29, 29, C.PUTTY); b.rect(79, 13, 4, 29, C.GREY); b.rect(54, 40, 29, 2, C.GREY);
    b.rect(58, 17, 19, 16, C.VOID); b.rect(59, 18, 17, 14, C.GREEN);
    [9, 13, 6, 11, 4].forEach((len, i) => b.rect(61 + (i === 3 ? 2 : 0), 20 + i * 2 + (i > 2 ? 1 : 0), len, 1, C.FLUO));
    b.rect(50, 39, 30, 3, C.PUTTY);
    for (let k = 0; k < 9; k++) b.px(52 + k * 3, 40, C.GREY);
    // paper stack + mug with a coffee ring beside it
    b.rect(9, 36, 22, 6, C.PAPER); b.rect(10, 35, 20, 1, C.SAND_L); b.rect(12, 38, 14, 1, C.SAND);
    b.rect(35, 33, 7, 9, C.PUTTY); b.rect(42, 35, 2, 4, C.PUTTY); b.rect(36, 33, 5, 1, C.BROWN);
    // chair back and him
    const dx = frame ? 1 : 0;
    b.ellipse(23 + dx, 41, 4, 7, C.DUSK); b.ellipse(55 - dx, 41, 4, 7, C.DUSK);
    b.poly([24, 26, 54, 26, 57, 52, 21, 52], C.DUSK);
    b.poly([26, 27, 38, 26, 37, 50, 24, 50], C.HAZE);
    b.rect(35, 22, 7, 6, C.WOOD);
    b.ellipse(38 + (frame ? 0.5 : 0), 15, 8, 9.5, C.BROWN);
    for (let i = 0; i < 14; i++) b.px(32 + RF.hash3(i, 3, 3) * 12, 8 + RF.hash3(i, 4, 3) * 13, i % 3 ? C.UMBER : C.WOOD);
    b.px(29, 16, C.TAN); b.px(29, 17, C.WOOD); b.px(47, 16, C.TAN);
    b.poly([25, 44, 53, 44, 52, 66, 26, 66], C.CHAR);
    b.rect(26, 44, 27, 1, C.SLATE);
    b.rect(37, 66, 4, 4, C.CHAR); b.rect(27, 70, 24, 2, C.SLATE);
    b.outline(C.VOID);
    return b;
  }
  reg('prog0', progDesk(0), [C.GREEN, C.FLUO]);
  reg('prog1', progDesk(1), [C.GREEN, C.FLUO]);

  // ---------------- S3: warehouse props ----------------
  const fallen = new Bmp(34, 20);
  fallen.poly([2, 7, 26, 5, 31, 2, 7, 3], C.SAND_L);
  fallen.poly([2, 7, 26, 5, 27, 18, 3, 19], C.TAN);
  fallen.poly([26, 5, 31, 2, 32, 15, 27, 18], C.WOOD);
  RF.drawText(fallen, 'E.T.', 7, 9, C.BROWN, 1);
  fallen.outline(C.UMBER);
  reg('cartonFallen', fallen);
  const pallet = new Bmp(48, 44);
  pallet.rect(2, 38, 44, 6, C.WOOD);
  for (let x = 4; x < 46; x += 9) pallet.rect(x, 39, 2, 4, C.UMBER);
  [[3, 24, 21, 14], [25, 25, 20, 13], [12, 10, 22, 14]].forEach(([x, y, w, h], i) => {
    pallet.rect(x, y, w, h, C.TAN); pallet.rect(x + w - 3, y, 3, h, C.WOOD); pallet.rect(x, y, w, 1, C.SAND_L);
    RF.drawText(pallet, 'E.T.', x + 2 + i, y + 4, C.BROWN, 1);
  });
  RF.handStroke(pallet, [4, 12, 44, 30], C.PUTTY, 5, 3, 1);
  pallet.outline(C.UMBER);
  reg('pallet', pallet);

  // ---------------- S5: store props ----------------
  function saleSign(rot, seed) {
    const b = new Bmp(30, 34);
    b.rect(6, 0, 1, 21, C.CHAR); b.rect(23, 0, 1, 21, C.CHAR);
    b.rect(1, 20, 28, 11, C.PAPER); b.rect(1, 30, 28, 1, C.SAND);
    RF.drawText(b, 'SALE', 4, 22, C.CLAY, 1, { jitter: seed, bold: true });
    return RF.rotate(b, rot);
  }
  reg('sale0', saleSign(-4, 3));
  reg('sale1', saleSign(3, 8));
  const bin = new Bmp(64, 36);
  const br = RF.rng(77);
  for (let i = 0; i < 26; i++) {
    const w = 7 + br() * 7, h = 9 + br() * 6;
    const bx = new Bmp(Math.ceil(w), Math.ceil(h), [C.GREEN, C.DUSK, C.CLAY, C.TUNGSTEN, C.SAGE, C.HAZE, C.PLUM][i % 7]);
    bx.rect(0, 0, bx.w, 2, C.PAPER);
    bin.blit(RF.rotate(bx, (br() - 0.5) * 70), 2 + br() * 50, br() * 12);
  }
  bin.rect(0, 14, 64, 22, T);
  for (let y = 14; y < 36; y++) for (let x = 0; x < 64; x++) if (x % 6 === 0 || y % 6 === 2) bin.px(x, y, C.GREY);
  bin.rect(0, 14, 64, 2, C.PUTTY);
  reg('bargainBin', bin);

  // ---------------- S6: returns ----------------
  const rs = new Bmp(48, 30);
  rs.rect(8, 0, 1, 18, C.CHAR); rs.rect(39, 0, 1, 18, C.CHAR);
  rs.rect(1, 17, 46, 12, C.CHAR); rs.frame(1, 17, 46, 12, C.SLATE);
  RF.drawText(rs, 'RETURNS', 4, 19, C.PAPER, 1);
  reg('returnsSign', rs);
  function clerk(talk, tilt) {
    const b = new Bmp(44, 60);
    b.ellipse(22, 44, 17, 22, C.PUTTY);
    b.rect(5, 44, 34, 16, C.PUTTY);
    b.poly([12, 30, 32, 30, 34, 60, 10, 60], C.CLAY);
    b.rect(26, 34, 5, 3, C.PAPER);
    b.rect(18 + tilt, 20, 8, 6, C.WOOD);
    b.ellipse(22 + tilt, 15, 7, 8, C.TAN);
    b.rect(15 + tilt, 12, 14, 3, C.WOOD);
    b.rect(19 + tilt, 19, 6, 1 + (talk ? 1 : 0), C.BROWN);
    b.ellipse(22 + tilt, 7, 8, 5, C.DUSK);
    b.rect(12 + tilt, 9, 20, 2, C.NIGHT);
    b.rect(7, 36, 30, 7, C.PUTTY); b.rect(7, 42, 30, 1, C.GREY);
    b.ellipse(8, 39, 3, 3, C.TAN); b.ellipse(36, 39, 3, 3, C.TAN);
    b.outline(C.VOID);
    return b;
  }
  reg('clerk0', clerk(false, 0));
  reg('clerk1', clerk(true, 0));
  reg('clerkNo', clerk(false, -1));
  reg('clerkNo2', clerk(false, 1));
  function etBox(b, x, y, w, h) {
    b.rect(x, y, w, h, C.DUSK); b.rect(x + w - 3, y, 3, h, C.NIGHT);
    b.rect(x, y, w - 3, 2, C.HAZE);
    b.rect(x + 2, y + 3, Math.round(w * 0.35), 2, C.PAPER);
    b.ellipse(x + w * 0.66, y + h * 0.55, Math.min(3, w * 0.12), Math.min(3, w * 0.12), C.MOON);
    b.frame(x, y, w, h, C.VOID);
  }
  function stack(seed) {
    const b = new Bmp(36, 28);
    const r = RF.rng(seed);
    let y = 28;
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      const w = 22 + Math.floor(r() * 8), h = 8 + Math.floor(r() * 3);
      y -= h;
      etBox(b, 2 + Math.floor(r() * 6), y, w, h);
    }
    b.outline(C.VOID, true);
    return b;
  }
  reg('stack0', stack(3)); reg('stack1', stack(9)); reg('stack2', stack(14));
  const exit = new Bmp(24, 10, C.CHAR);
  RF.drawText(exit, 'EXIT', 2, 2, C.FLUO, 1);
  reg('exitSign', exit, [C.FLUO]);

  // ---------------- S7: 1983 landfill ----------------
  const truck = new Bmp(120, 64);
  const bedA = (22 * Math.PI) / 180;
  const piv = [112, 44], L = 76, Hh = 18;
  const along = [-Math.cos(bedA), -Math.sin(bedA)], up = [-Math.sin(bedA), Math.cos(bedA) * -1];
  const P = (a, h) => [piv[0] + along[0] * a + up[0] * h, piv[1] + along[1] * a + up[1] * h];
  const q = [P(0, 0), P(L, 0), P(L, Hh), P(0, Hh)].flat();
  truck.poly(q, C.GREY);
  for (let k = 1; k < 6; k++) { const a = P(k * 13, 0), c2 = P(k * 13, Hh); truck.line(a[0], a[1], c2[0], c2[1], C.SLATE); }
  truck.line(P(0, Hh)[0], P(0, Hh)[1], P(L, Hh)[0], P(L, Hh)[1], C.PUTTY);
  truck.line(62, 44, P(40, 0)[0], P(40, 0)[1], C.SLATE);
  truck.rect(8, 42, 106, 6, C.CHAR);
  truck.poly([6, 20, 34, 20, 37, 44, 3, 44], C.CLAY);
  truck.poly([22, 20, 34, 20, 37, 44, 24, 44], C.BROWN);
  truck.rect(9, 23, 18, 9, C.NIGHT); truck.line(11, 31, 18, 24, C.HAZE);
  truck.rect(1, 36, 3, 4, C.BULB); truck.rect(1, 42, 8, 3, C.GREY);
  [[24, 52], [86, 52], [104, 52]].forEach(([x, y]) => { truck.ellipse(x, y, 9, 9, C.CHAR); truck.ellipse(x, y, 4, 4, C.SLATE); truck.px(x, y, C.GREY); });
  [[110, 46, 9, 6, 20], [114, 54, 8, 7, -35]].forEach(([x, y, w, h, r]) => {
    const tmp = new Bmp(w, h, C.TAN); tmp.rect(w - 2, 0, 2, h, C.WOOD);
    truck.blit(RF.rotate(tmp, r), x - 4, y - 4);
  });
  truck.outline(C.VOID);
  const truckL = new Bmp(truck.w, truck.h);
  truckL.blit(truck, 0, 0, { flip: true });
  reg('truckL', truckL, [C.BULB]);
  function pitPile(seed) {
    const b = new Bmp(64, 26);
    const r = RF.rng(seed);
    for (let i = 0; i < 40; i++) {
      const y = 4 + Math.pow(r(), 0.6) * 20, spread = (y - 2) * 1.4;
      const x = 32 + (r() - 0.5) * spread * 2;
      const k = r();
      if (k < 0.4) { const tmp = new Bmp(8, 6, C.TAN); tmp.rect(6, 0, 2, 6, C.WOOD); b.blit(RF.rotate(tmp, (r() - 0.5) * 90), x - 4, y - 3); }
      else if (k < 0.7) b.blit(RF.rotate(mutedCart, (r() - 0.5) * 180), x - 7, y - 7);
      else if (k < 0.85) { const tmp = new Bmp(9, 7); etBox(tmp, 0, 0, 9, 7); b.blit(RF.rotate(tmp, (r() - 0.5) * 120), x - 4, y - 3); }
      else { b.rect(x - 6, y - 2, 12, 5, C.CHAR); b.rect(x - 6, y + 1, 12, 2, C.WOOD); } // a woodgrain console shell
    }
    return b;
  }
  reg('pile0', pitPile(31)); reg('pile1', pitPile(37)); reg('pile2', pitPile(43));
  const fall = [];
  const mid = cartridge(20, 23, false);
  mid.outline(C.VOID);
  for (let k = 0; k < 8; k++) fall.push(reg('fall' + k, RF.rotate(mid, k * 45 + 10)));
  const dust = [0, 1, 2].map((k) => {
    const b = new Bmp(40, 16);
    for (let i = 0; i < 26 - k * 6; i++) {
      const a = RF.hash3(i, k, 3) * Math.PI, rr = 4 + k * 5 + RF.hash3(i, k, 4) * 6;
      b.px(20 + Math.cos(a) * rr * 1.6, 15 - Math.sin(a) * rr * 0.8, k < 2 ? C.SAND : C.DIRT);
    }
    return reg('dust' + k, b);
  });
  RF.DUST = dust;

  // ---------------- S8: 2014 dig ----------------
  const ex = new Bmp(128, 84);
  ex.rect(54, 66, 70, 14, C.CHAR); ex.ellipse(56, 73, 7, 7, C.CHAR); ex.ellipse(122, 73, 6, 7, C.CHAR);
  for (let x = 52; x < 126; x += 5) ex.rect(x, 79, 3, 2, C.SLATE);
  ex.rect(58, 40, 62, 26, C.TUNGSTEN); ex.rect(58, 60, 62, 6, C.TAN); ex.rect(108, 36, 14, 26, C.TAN);
  ex.rect(66, 16, 26, 26, C.TUNGSTEN); ex.rect(70, 20, 18, 14, C.HAZE); ex.line(72, 32, 84, 21, C.MOON);
  const boom = (x0, y0, x1, y1, w) => { for (let k = -w; k <= w; k++) ex.line(x0, y0 + k, x1, y1 + k, C.TUNGSTEN); ex.line(x0, y0 - w, x1, y1 - w, C.BULB); };
  boom(70, 46, 30, 8, 4); boom(30, 8, 16, 40, 3);
  ex.poly([4, 38, 24, 38, 22, 54, 8, 56], C.CHAR);
  for (let k = 0; k < 4; k++) ex.rect(6 + k * 4, 56, 2, 3, C.SLATE);
  ex.outline(C.VOID);
  reg('excavator', ex);
  const tri = new Bmp(32, 56);
  tri.line(16, 22, 4, 55, C.CHAR); tri.line(16, 22, 17, 55, C.CHAR); tri.line(16, 22, 28, 55, C.CHAR);
  tri.rect(8, 11, 18, 11, C.SLATE); tri.rect(8, 11, 18, 1, C.GREY); tri.ellipse(6, 16, 3, 4, C.CHAR); tri.rect(18, 7, 6, 4, C.CHAR);
  tri.outline(C.VOID);
  reg('tripod', tri);
  const crew = new Bmp(22, 60);
  crew.ellipse(11, 7, 4, 5, C.DIRT_D); crew.rect(5, 3, 12, 2, C.DIRT_D);
  crew.poly([4, 13, 18, 13, 19, 38, 3, 38], C.PLUM); crew.rect(17, 14, 2, 22, C.SAND);
  crew.rect(5, 38, 5, 20, C.CHAR); crew.rect(12, 38, 5, 20, C.CHAR);
  crew.outline(C.VOID);
  reg('crew', crew);
  const dirtCart = new Bmp(30, 22);
  dirtCart.blit(RF.rotate(cartridge(20, 23, true, 7), -24), 2, -2);
  for (let x = 0; x < 30; x++) for (let y = 14 + Math.round(2 * Math.sin(x * 0.5)); y < 22; y++) dirtCart.px(x, y, RF.bayer(x, y) < 0.35 ? C.SAND : C.DIRT);
  reg('dirtCart', dirtCart);

  // ---------------- the hand (world-res, drawn bottom-right like a Doom weapon) ----------------
  function skin(b, fn) {
    // fn(x,y) -> 0 none, else shade 1 (dark) .. 4 (light)
    const ramp = [T, C.BROWN, C.WOOD, C.TAN, C.TUNGSTEN];
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const s = fn(x, y); if (s) b.px(x, y, ramp[s]); }
  }
  const cap = (x, y, ax, ay, bx2, by2, r) => {
    const vx = bx2 - ax, vy = by2 - ay, u = RF.clamp01(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
    return Math.hypot(x - ax - vx * u, y - ay - vy * u) <= r;
  };
  function sleeve(b, x0, y0) {
    b.poly([x0, y0 + 4, x0 + 40, y0, x0 + 52, b.h, x0 + 2, b.h], C.DUSK);
    b.poly([x0 + 2, y0 + 4, x0 + 40, y0, x0 + 41, y0 + 5, x0 + 3, y0 + 9], C.HAZE);
    b.rect(x0 + 10, y0 + 12, 2, b.h - y0 - 12, C.NIGHT);
  }
  function handHold(dirty) {
    const b = new Bmp(84, 96);
    // fingertips behind the shell, peeking on the right edge
    skin(b, (x, y) => (cap(x, y, 52, 22, 58, 22, 4) || cap(x, y, 52, 31, 59, 31, 4) || cap(x, y, 52, 40, 58, 41, 4) ? (x > 57 ? 2 : 3) : 0));
    const cart = cartridge(46, 54, dirty, 11);
    b.blit(cart, 10, 2);
    // palm under the shell, thumb across the label's lower-left corner
    skin(b, (x, y) => {
      if (cap(x, y, 24, 66, 52, 62, 13)) return y > 70 ? 2 : 3;
      if (cap(x, y, 16, 64, 20, 46, 5.5)) return x < 15 ? 2 : y < 50 ? 4 : 3;
      if (cap(x, y, 52, 50, 56, 60, 6)) return 2;
      return 0;
    });
    b.line(19, 50, 22, 50, C.WOOD);
    sleeve(b, 22, 72);
    b.outline(C.UMBER);
    return b;
  }
  reg('handHold', handHold(false));
  reg('handHoldDirty', handHold(true));
  const open = new Bmp(78, 84);
  const FING = [[29, 41, 17, 17, 4.3], [36, 37, 27, 9, 4.4], [43, 38, 37, 10, 4.2], [49, 43, 46, 18, 3.8]];
  skin(open, (x, y) => {
    for (const [ax, ay, bx2, by2, r] of FING) if (cap(x, y, ax, ay, bx2, by2, r)) return x - bx2 > r * 0.4 ? 2 : y < (ay + by2) / 2 ? 4 : 3;
    if (cap(x, y, 24, 58, 14, 46, 5.2)) return x < 16 ? 2 : 3;
    if (cap(x, y, 31, 56, 48, 54, 14)) return y > 62 || x > 54 ? 2 : 3;
    return 0;
  });
  FING.forEach(([ax, ay, bx2, by2]) => { open.rect(bx2 - 1, by2 - 1, 3, 3, C.SAND_L); open.px(ax, ay + 2, C.TUNGSTEN); });
  open.line(30, 50, 46, 47, C.WOOD); open.line(34, 60, 47, 57, C.WOOD);
  sleeve(open, 26, 64);
  open.outline(C.UMBER);
  reg('handOpen', open);
  // where the cuff leaves each hand bitmap: the forearm is extended from here to the screen edge
  SPR.handHold.cuff = [24, 76]; SPR.handHoldDirty.cuff = [24, 76]; open.cuff = [28, 80];
})();

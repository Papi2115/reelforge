/* Card art (millimetres, y down, origin top-left of the card) and the card renderer.
 * Every "photo" is a stylised duotone illustration - no real faces, no invented text. Ops: p = filled (lit) polygon,
 * l = stroke, t = laid-out text strokes, d = darken (printed shadow). Marks with t0/t1 draw on over global time. */
'use strict';
(function () {
  const NB = window.NB;
  const W = NB.world;
  const C = NB.C;

  function Art() {
    this.ops = [];
  }
  Art.prototype.poly = function (p, m, extra) {
    this.ops.push(Object.assign({ k: 'p', p, m }, extra || {}));
    return this;
  };
  Art.prototype.line = function (p, w, c, extra) {
    this.ops.push(Object.assign({ k: 'l', p, w, c }, extra || {}));
    return this;
  };
  Art.prototype.dark = function (p) {
    this.ops.push({ k: 'd', p });
    return this;
  };
  Art.prototype.rect = function (x, y, w, h, m, extra) {
    return this.poly([x, y, x + w, y, x + w, y + h, x, y + h], m, extra);
  };
  Art.prototype.text = function (str, o) {
    const lay = NB.font.layout(str, o);
    this.ops.push({ k: 't', s: lay.strokes, w: o.weight || o.size * 0.14, c: o.c === undefined ? 'ink' : o.c, t0: o.show, t1: o.hide });
    return lay;
  };
  const ell = (cx, cy, rx, ry, n, rot) => {
    const out = [];
    const N = n || 22;
    const cr = Math.cos(rot || 0);
    const sn = Math.sin(rot || 0);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      out.push(cx + x * cr - y * sn, cy + x * sn + y * cr);
    }
    return out;
  };
  /** Hand-drawn loop: an ellipse that does not close, overshoots, in two strokes (seeded). */
  function handLoop(cx, cy, rx, ry, seed, t0, dur) {
    const a = [];
    const b = [];
    const start = -0.5 + NB.sr(seed, 1) * 0.3;
    for (let i = 0; i <= 26; i++) {
      const k = i / 26;
      const ang = start + k * Math.PI * 2 * 0.86;
      const wob = 1 + NB.sr(seed, i) * 0.035 + k * 0.05;
      a.push(cx + Math.cos(ang) * rx * wob, cy + Math.sin(ang) * ry * wob);
    }
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      const ang = start + Math.PI * 2 * (0.8 + k * 0.32);
      b.push(cx + Math.cos(ang) * rx * (1.07 - k * 0.02), cy + Math.sin(ang) * ry * (1.1 - k * 0.04));
    }
    return [
      { p: a, t0, t1: t0 + dur * 0.68 },
      { p: b, t0: t0 + dur * 0.78, t1: t0 + dur },
    ];
  }

  // ---------- the cards ----------
  const ART = {};
  const PHOTO_IMG = (a, w, ih, m) => a.rect(12, 12, w - 24, ih, m);

  ART.sketch = function (t) {
    const a = new Art();
    PHOTO_IMG(a, 240, 232, 'pMid');
    a.poly([12, 244, 12, 214, 34, 192, 76, 174, 108, 170, 150, 176, 186, 196, 214, 222, 228, 244], 'pDark');
    a.line([12, 214, 34, 192, 76, 174, 108, 170, 150, 176, 186, 196, 214, 222, 228, 236], 1.4, C.INK);
    a.poly([96, 150, 128, 148, 130, 176, 98, 178], 'pLight');
    a.poly([100, 172, 130, 170, 116, 210], 'paper');
    a.poly([112, 178, 119, 178, 122, 220, 116, 228, 110, 220], 'ink');
    a.line([100, 172, 116, 210, 130, 170], 1.4, C.INK);
    const head = ell(114, 106, 33, 46, 26, 0.08);
    a.poly(head, 'pLight');
    a.dark([134, 86, 148, 104, 144, 136, 126, 152, 133, 118]);
    a.poly([78, 98, 82, 70, 100, 56, 126, 56, 146, 70, 150, 96, 142, 82, 118, 72, 96, 76, 84, 96], 'ink');
    a.poly([80, 100, 73, 104, 75, 120, 82, 122], 'pLight');
    a.line(head, 1.5, C.INK, { closed: 1 });
    a.poly([86, 96, 108, 96, 109, 106, 104, 112, 90, 112, 86, 106], 'ink');
    a.poly([116, 96, 139, 95, 140, 105, 135, 111, 121, 112, 116, 106], 'ink');
    a.line([108, 99, 116, 99], 1.5, C.INK);
    a.line([123, 99, 131, 98], 0.9, C.ICE);
    a.line([112, 112, 118, 125, 111, 126], 1.0, C.INK);
    a.line([103, 137, 112, 138, 121, 136], 1.4, C.INK);
    return a;
  };

  ART.ticket = function () {
    const a = new Art();
    a.rect(0, 0, 326, 30, 'ink');
    a.text('NORTHWEST ORIENT', { font: 'type', size: 12, x: 14, y: 9, c: 'paper', weight: 1.9 });
    a.text('PASSENGER', { font: 'type', size: 7.5, x: 28, y: 40, c: 'pMid', weight: 1.1 });
    a.text('DAN COOPER', { font: 'type', size: 13, x: 28, y: 54, weight: 2 });
    a.text('FLIGHT 305', { font: 'type', size: 10, x: 28, y: 84 });
    a.text('NOV 24 1971', { font: 'type', size: 10, x: 180, y: 84 });
    a.text('PORTLAND', { font: 'type', size: 10, x: 28, y: 106 });
    a.text('> SEATTLE', { font: 'type', size: 10, x: 28, y: 124 });
    // perforation where the stub was torn off
    for (let y = 36; y < 146; y += 9) a.line([300, y, 300, y + 2.5], 1.6, 'paperB');
    return a;
  };
  ART.stub = function () {
    const a = new Art();
    a.rect(0, 0, 100, 30, 'ink');
    a.text('305', { font: 'disp', size: 26, x: 20, y: 48, weight: 3.4 });
    a.text('PORTLAND', { font: 'type', size: 7, x: 14, y: 96 });
    a.text('NOV 24', { font: 'type', size: 7, x: 14, y: 112 });
    return a;
  };

  ART.plane = function () {
    const a = new Art();
    PHOTO_IMG(a, 300, 168, 'pMid');
    a.rect(12, 150, 276, 30, 'pDark');
    // Boeing 727 in profile, nose cropped by the print edge: T-tail + three rear engines
    a.poly([12, 84, 230, 82, 252, 88, 262, 96, 250, 104, 230, 108, 12, 110], 'pLight');
    a.poly([214, 84, 232, 34, 262, 32, 258, 84], 'pLight');
    a.poly([222, 30, 284, 26, 286, 33, 224, 36], 'pLight');
    a.poly([194, 76, 236, 74, 240, 86, 196, 88], 'pMid');
    a.line([194, 76, 236, 74, 240, 86, 196, 88], 1.2, C.INK, { closed: 1 });
    a.poly([96, 104, 150, 104, 188, 146, 166, 147], 'pDark');
    a.line([96, 104, 166, 147, 188, 146, 150, 104], 1.3, C.INK);
    a.line([12, 84, 230, 82, 252, 88, 262, 96, 250, 104, 230, 108, 12, 110], 1.4, C.INK);
    a.line([214, 84, 232, 34, 262, 32, 258, 84], 1.4, C.INK);
    a.line([222, 30, 284, 26, 286, 33, 224, 36], 1.2, C.INK, { closed: 1 });
    a.line([12, 95, 190, 94], 2.6, 'pMid');
    for (let x = 24; x < 186; x += 9) a.line([x, 90, x + 2, 90], 1.4, 'paper');
    a.line([226, 104, 236, 104], 1.2, C.INK);
    a.text('BOEING 727', { font: 'type', size: 9, x: 16, y: 190 });
    return a;
  };

  ART.briefcase = function () {
    const a = new Art();
    PHOTO_IMG(a, 240, 140, 'pMid');
    a.rect(12, 118, 216, 34, 'pDark');
    a.dark([44, 126, 196, 126, 214, 142, 58, 142]);
    a.poly([40, 56, 192, 52, 196, 128, 44, 130], 'pLight');
    a.line([40, 56, 192, 52, 196, 128, 44, 130], 1.6, C.INK, { closed: 1 });
    a.line([41, 70, 193, 66], 1.3, C.INK);
    a.line([98, 54, 100, 38, 132, 37, 134, 53], 3.2, C.INK);
    a.rect(64, 62, 14, 10, 'pMid');
    a.rect(158, 60, 14, 10, 'pMid');
    a.line([48, 124, 188, 121], 1.0, 'pMid');
    // a typed label on a tape strip, stuck on crooked
    a.poly([62, 160, 182, 156, 183, 178, 63, 182], 'paperB');
    a.text('BOMB?', { font: 'type', size: 11, x: 92, y: 163 });
    return a;
  };

  ART.demand = function (t, tl) {
    const a = new Art();
    for (let y = 46; y < 170; y += 17) a.line([10, y, 270, y], 0.6, 'paperB');
    a.line([10, 30, 270, 30], 0.9, 'pMid');
    a.text('$200,000', { font: 'disp', size: 42, x: 24, y: 48, weight: 4.4, slant: 0.04 });
    a.text('4 PARACHUTES', { font: 'type', size: 12, x: 26, y: 120, weight: 1.9 });
    handLoop(118, 70, 112, 36, 41, tl.circle, 0.55).forEach((s) => a.line(s.p, 3.2, C.RED, { t0: s.t0, t1: s.t1 }));
    return a;
  };

  ART.seattle = function (t, tl) {
    const a = new Art();
    PHOTO_IMG(a, 300, 168, 'pDark');
    a.rect(12, 128, 276, 52, 'pMid');
    a.line([12, 128, 288, 128], 1.0, C.INK);
    // 727 at the stand, three-quarter rear; fuel truck alongside, hose between them
    a.poly([60, 104, 196, 92, 214, 98, 210, 116, 66, 124], 'pLight');
    a.poly([170, 94, 186, 52, 206, 50, 204, 96], 'pLight');
    a.poly([176, 48, 226, 44, 228, 50, 178, 54], 'pLight');
    a.poly([150, 88, 186, 86, 188, 98, 152, 100], 'pMid');
    a.line([60, 104, 196, 92, 214, 98, 210, 116, 66, 124, 60, 104], 1.3, C.INK);
    a.line([170, 94, 186, 52, 206, 50, 204, 96], 1.3, C.INK);
    a.line([176, 48, 226, 44, 228, 50, 178, 54], 1.1, C.INK, { closed: 1 });
    a.poly([216, 132, 272, 130, 274, 158, 218, 160], 'pLight');
    a.poly([232, 118, 260, 117, 262, 131, 234, 132], 'pLight');
    a.line([216, 132, 272, 130, 274, 158, 218, 160, 216, 132], 1.3, C.INK);
    a.line([232, 118, 260, 117, 262, 131, 234, 132], 1.2, C.INK);
    a.poly([224, 158, 232, 158, 232, 166, 224, 166], 'ink');
    a.poly([258, 156, 266, 156, 266, 164, 258, 164], 'ink');
    a.line([218, 146, 196, 150, 172, 140, 150, 116], 1.4, C.INK);
    a.text('SEATTLE', { font: 'type', size: 10, x: 16, y: 192 });
    // tape label slapped on later
    a.poly([128, 186, 296, 182, 297, 204, 129, 209], 'paperB', { t0: tl.tape });
    a.text('PASSENGERS RELEASED', { font: 'type', size: 7.5, x: 136, y: 191, show: tl.tape });
    return a;
  };

  ART.jump = function (t, tl) {
    const a = new Art();
    PHOTO_IMG(a, 300, 190, 'pDark');
    // the tail of the 727 from below, side-on: fin, T-stab, engine pod, and the aft airstair hanging open
    a.poly([60, 100, 112, 100, 140, 146, 116, 147], 'pMid');
    a.line([60, 100, 116, 147, 140, 146, 112, 100], 1.2, C.INK);
    a.poly([12, 64, 186, 60, 234, 68, 264, 84, 258, 93, 226, 100, 12, 112], 'pLight');
    a.poly([168, 62, 204, 18, 236, 16, 242, 70], 'pLight');
    a.poly([194, 14, 266, 9, 268, 17, 196, 21], 'pLight');
    a.poly([158, 54, 214, 52, 218, 70, 160, 72], 'pMid');
    a.poly([158, 56, 166, 56, 166, 70, 160, 70], 'ink');
    a.line([12, 64, 186, 60, 234, 68, 264, 84, 258, 93, 226, 100, 12, 112], 1.5, C.INK);
    a.line([168, 62, 204, 18, 236, 16, 242, 70], 1.4, C.INK);
    a.line([194, 14, 266, 9, 268, 17, 196, 21, 194, 14], 1.2, C.INK);
    a.line([158, 54, 214, 52, 218, 70, 160, 72, 158, 54], 1.2, C.INK);
    for (let x = 22; x < 150; x += 10) a.line([x, 76, x + 2.5, 76], 1.3, 'paper');
    a.poly([194, 99, 216, 97, 204, 172, 180, 170], 'pMid');
    a.line([194, 99, 180, 170, 204, 172, 216, 97], 1.4, C.INK);
    for (let k = 1; k < 7; k++) {
      const f = k / 7;
      a.line([194 - 14 * f, 99 + 71 * f, 216 - 12 * f, 97 + 75 * f], 1.0, C.INK);
    }
    // the man, small, arms up, already below the stair
    a.poly(ell(222, 182, 3.4, 3.4, 8), 'ink');
    a.poly([219, 185, 225, 185, 227, 196, 220, 197], 'ink');
    a.line([220, 186, 213, 178], 1.5, C.INK);
    a.line([225, 186, 232, 179], 1.5, C.INK);
    a.line([221, 196, 217, 202], 1.5, C.INK);
    a.line([226, 196, 230, 202], 1.5, C.INK);
    a.text('REAR STAIR', { font: 'type', size: 10, x: 18, y: 214 });
    // two-stroke red arrow from the label to the stair
    a.line([128, 220, 168, 214, 184, 190], 2.6, C.RED, { t0: tl.arrow, t1: tl.arrow + 0.28 });
    a.line([176, 194, 185, 188, 188, 198], 2.6, C.RED, { t0: tl.arrow + 0.4, t1: tl.arrow + 0.52 });
    return a;
  };

  ART.river = function (t, tl) {
    const a = new Art();
    PHOTO_IMG(a, 300, 168, 'pMid');
    a.poly([12, 12, 288, 12, 288, 70, 12, 108], 'pMid');
    a.poly([12, 12, 288, 12, 288, 30, 262, 26, 248, 31, 226, 24, 204, 32, 178, 27, 150, 34, 122, 28, 96, 36, 70, 30, 44, 38, 12, 33], 'ink');
    for (let k = 0; k < 6; k++) a.line([24 + k * 44 + (k % 2) * 12, 52 + k * 6.5, 50 + k * 44 + (k % 2) * 12, 50 + k * 6.5], 1.2, 'paper');
    a.line([12, 108, 288, 70], 1.4, C.INK);
    a.poly([12, 108, 288, 70, 288, 180, 12, 180], 'pLight');
    // the boy, crouched, lower left of the bank; money bundles in front of him
    a.poly([70, 150, 78, 122, 92, 118, 100, 128, 106, 152, 96, 156, 84, 152], 'ink');
    a.poly(ell(88, 112, 8, 8, 10), 'ink');
    a.line([100, 134, 118, 146], 2.4, C.INK);
    [[124, 146, 0.1], [140, 151, -0.15], [131, 158, 0.3]].forEach(([x, y, r]) => {
      const c = Math.cos(r);
      const s = Math.sin(r);
      const q = (dx, dy) => [x + dx * c - dy * s, y + dx * s + dy * c];
      const p = [].concat(q(-9, -4), q(9, -4), q(9, 4), q(-9, 4));
      a.poly(p, 'paper');
      a.line(p, 0.9, C.INK, { closed: 1 });
      a.line([].concat(q(-1.5, -4), q(-1.5, 4)), 1.4, C.INK);
    });
    a.text('COLUMBIA RIVER', { font: 'type', size: 8, x: 16, y: 192 });
    a.text('1980', { font: 'disp', size: 26, x: 214, y: 186, weight: 3.4 });
    const lay = NB.font.layout('$5,800', { font: 'hand', size: 22, x: 168, y: 130, seed: 58, slant: 0.22, t0: tl.money, cps: 7 });
    a.ops.push({ k: 't', s: lay.strokes, w: 2.8, c: C.RED });
    return a;
  };

  ART.memo = function (t, tl) {
    const a = new Art();
    a.text('FBI', { font: 'type', size: 15, x: 18, y: 18, weight: 2.6 });
    a.line([18, 42, 242, 42], 0.9, 'pMid');
    a.text('2016', { font: 'disp', size: 34, x: 150, y: 56, weight: 4 });
    a.text('ACTIVE', { font: 'type', size: 9, x: 18, y: 60 });
    a.text('INVESTIGATION', { font: 'type', size: 9, x: 18, y: 76 });
    // the stamp lands with a squash; a worn rubber stamp drops a few bits of ink
    const st = tl.stamp;
    if (t >= st) {
      const k = NB.seg(t, st, st + 0.16);
      const sc = 1.22 - 0.22 * NB.E.outBack(k);
      const r = -0.16 + (1 - k) * 0.08;
      const cx = 132;
      const cy = 136;
      const tx = (x, y) => [cx + ((x - cx) * Math.cos(r) - (y - cy) * Math.sin(r)) * sc, cy + ((x - cx) * Math.sin(r) + (y - cy) * Math.cos(r)) * sc];
      a.line([].concat(tx(30, 112), tx(170, 112)), 2.6, C.RED);
      a.line([].concat(tx(182, 112), tx(234, 112), tx(234, 160), tx(96, 160)), 2.6, C.RED);
      a.line([].concat(tx(84, 160), tx(30, 160), tx(30, 112)), 2.6, C.RED);
      const lay = NB.font.layout('SUSPENDED', { font: 'disp', size: 26, x: 132, y: 123, track: 1.0, align: 'center' });
      lay.strokes.forEach((s) => {
        const p = [];
        for (let j = 0; j < s.p.length; j += 2) p.push(...tx(s.p[j], s.p[j + 1]));
        a.line(p, 3.4, C.RED);
      });
    }
    return a;
  };

  function noteArt(card, lines, seed, t, tl, size) {
    const a = new Art();
    a.rect(0, 0, card.w, 16, 'paperB');
    let clock = tl.write;
    lines.forEach((ln, i) => {
      const lay = NB.font.layout(ln, { font: 'hand', size: size || 17, x: 12 + i * 3, y: 28 + i * (size || 17) * 1.75, seed: seed + i * 11, t0: clock, cps: 11 });
      clock = lay.end + 0.08;
      a.ops.push({ k: 't', s: lay.strokes, w: 2.6, c: C.INK });
    });
    return a;
  }
  ART.who = (t, tl, cd) => {
    const a = noteArt(cd, ['WHO?'], 5, t, tl, 34);
    a.line([16, 84, 50, 86, 92, 82], 2.2, C.INK, { t0: tl.write + 0.75, t1: tl.write + 0.95 });
    return a;
  };
  ART.died = (t, tl, cd) => noteArt(cd, ['DIED IN', 'THE JUMP?'], 13, t, tl, 16);
  ART.survived = (t, tl, cd) => noteArt(cd, ['SURVIVED?'], 17, t, tl, 16);
  ART.landed = (t, tl, cd) => noteArt(cd, ['LANDED', 'WHERE?'], 23, t, tl, 17);
  ART.spent = (t, tl, cd) => {
    const a = noteArt(cd, ['SPENT THE', 'MONEY?'], 29, t, tl, 16);
    a.line([10, 14, 120, 98], 3.2, C.RED, { t0: tl.cross, t1: tl.cross + 0.18 });
    a.line([116, 18, 14, 96], 3.2, C.RED, { t0: tl.cross + 0.34, t1: tl.cross + 0.5 });
    return a;
  };
  ART.dbnote = (t, tl, cd) => {
    const a = new Art();
    a.rect(0, 0, cd.w, 14, 'paperB');
    const lay = NB.font.layout('D.B. COOPER', { font: 'hand', size: 15, x: 12, y: 50, seed: 3 });
    a.ops.push({ k: 't', s: lay.strokes, w: 2.4, c: C.INK });
    a.line([9, 58, 30, 57.5, 47, 59], 3, C.RED, { t0: tl.strike, t1: tl.strike + 0.2 });
    a.line([11, 62, 46, 61], 2.4, C.RED, { t0: tl.strike + 0.3, t1: tl.strike + 0.42 });
    const fix = NB.font.layout('DAN', { font: 'hand', size: 13, x: 14, y: 22, seed: 9, slant: 0.3, t0: tl.fix, cps: 6 });
    a.ops.push({ k: 't', s: fix.strokes, w: 2.4, c: C.RED });
    a.line([22, 38, 26, 47], 2, C.RED, { t0: tl.fix + 0.55, t1: tl.fix + 0.65 });
    return a;
  };

  ART.map = function () {
    const a = new Art();
    const LON0 = -126.0;
    const LON1 = -119.3;
    const LAT0 = 48.3;
    const LAT1 = 45.0;
    const mx = (lon) => ((lon - LON0) / (LON1 - LON0)) * 420;
    const my = (lat) => ((LAT0 - lat) / (LAT0 - LAT1)) * 300;
    const path = (pts) => pts.flatMap(([lo, la]) => [mx(lo), my(la)]);
    const coast = [[-124.72, 48.3], [-124.62, 47.9], [-124.33, 47.3], [-124.12, 46.92], [-124.05, 46.62], [-124.06, 46.26], [-123.95, 45.92], [-123.97, 45.5], [-124.04, 45.0]];
    // engraved-map water: paper, with hatch lines that hug the coast and get shorter out to sea
    const sound = path([[-122.75, 48.3], [-122.48, 48.3], [-122.36, 47.85], [-122.42, 47.6], [-122.55, 47.3], [-122.84, 47.06], [-122.97, 47.13], [-122.72, 47.42], [-122.62, 47.78], [-122.82, 48.12]]);
    a.line(sound, 1.0, C.INK);
    const coastAt = (lat) => {
      for (let i = 1; i < coast.length; i++)
        if (coast[i][1] <= lat) {
          const k = (lat - coast[i - 1][1]) / (coast[i][1] - coast[i - 1][1]);
          return mx(NB.lerp(coast[i - 1][0], coast[i][0], k));
        }
      return mx(coast[coast.length - 1][0]);
    };
    for (let k = 0; k < 16; k++) {
      const y = 10 + k * 18.5;
      const lat = LAT0 - (y / 300) * (LAT0 - LAT1);
      const x1 = coastAt(lat) - 4;
      const len = 26 + (k % 4) * 9 + NB.rnd(71, k) * 10;
      a.line([Math.max(4, x1 - len), y, x1, y], 0.9, 'pMid');
      if (k % 2 === 0) a.line([Math.max(4, x1 - len * 0.45), y + 6, x1 - 3, y + 6], 0.8, 'pMid');
    }
    a.line(path(coast), 1.3, C.INK);
    const river = [[-119.3, 45.93], [-120.4, 45.72], [-121.2, 45.61], [-121.9, 45.66], [-122.4, 45.57], [-122.76, 45.66], [-122.86, 45.92], [-122.95, 46.1], [-123.25, 46.17], [-123.6, 46.2], [-124.06, 46.26]];
    a.line(path(river), 2.4, 'pMid');
    a.text('COLUMBIA RIVER', { font: 'type', size: 6, x: mx(-121.75), y: my(45.83), c: 'pMid', weight: 0.9 });
    const city = (lon, lat, name, dx, dy) => {
      a.poly(ell(mx(lon), my(lat), 3.2, 3.2, 10), 'ink');
      a.text(name, { font: 'type', size: 7, x: mx(lon) + dx, y: my(lat) + dy, weight: 1.1 });
    };
    city(-122.33, 47.61, 'SEATTLE', 7, -4);
    city(-122.68, 45.52, 'PORTLAND', -64, 4);
    // pencil route south; the uncertain stretch is dashed, with a pencil "?"
    const route = path([[-122.33, 47.61], [-122.42, 47.1], [-122.5, 46.75]]);
    a.line(route, 1.3, C.GRAPH);
    const dash = path([[-122.5, 46.75], [-122.56, 46.3], [-122.6, 45.9]]);
    for (let k = 0; k < 6; k++) {
      const p0 = k / 6;
      const p1 = p0 + 0.09;
      const at = (q) => {
        const seg = q < 0.5 ? 0 : 1;
        const kk = q < 0.5 ? q * 2 : (q - 0.5) * 2;
        return [NB.lerp(dash[seg * 2], dash[seg * 2 + 2], kk), NB.lerp(dash[seg * 2 + 1], dash[seg * 2 + 3], kk)];
      };
      a.line([...at(p0), ...at(p1)], 1.3, C.GRAPH);
    }
    a.line(path([[-122.6, 45.9], [-122.64, 45.5], [-122.72, 45.12]]), 1.3, C.GRAPH);
    a.line([mx(-122.72) - 6, 288, mx(-122.74), 297, mx(-122.74) + 6, 289], 1.3, C.GRAPH);
    a.text('MEXICO CITY', { font: 'hand', size: 9, x: mx(-122.6) + 10, y: 276, seed: 77, c: C.GRAPH, weight: 1.2 });
    a.ops.push({ k: 't', s: NB.font.layout('?', { font: 'hand', size: 20, x: mx(-122.4), y: my(46.62), seed: 4 }).strokes, w: 1.6, c: C.GRAPH });
    // coffee ring from the mug, not closed, slightly doubled
    a.line(ell(352, 236, 30, 30, 28).slice(0, 46), 1.2, 'paperB');
    a.line(ell(355, 239, 29, 28, 28).slice(10, 34), 0.8, 'paperB');
    return a;
  };

  // ---------- card renderer ----------
  const cache = {};
  function artFor(card, t) {
    if (card.dynamic) return ART[card.art](t, card.tl, card);
    if (!cache[card.id]) cache[card.id] = ART[card.art](0, card.tl, card);
    return cache[card.id];
  }
  /** fr: {o, ax, ay, n, lean0, lean1, plane, support:'board'|'desk'} */
  function makeXf(card, fr) {
    const w = card.w;
    const h = card.h;
    const k = card.k || 1;
    return function (p) {
      const out = new Array((p.length / 2) * 3);
      for (let i = 0, j = 0; i < p.length; i += 2, j += 3) {
        const X = ((p[i] - w / 2) * k) / 1000;
        const Y = ((h / 2 - p[i + 1]) * k) / 1000;
        const ln = fr.lean0 + (fr.lean1 - fr.lean0) * NB.clamp(p[i + 1] / h, 0, 1);
        out[j] = fr.o[0] + fr.ax[0] * X + fr.ay[0] * Y + fr.n[0] * ln;
        out[j + 1] = fr.o[1] + fr.ax[1] * X + fr.ay[1] * Y + fr.n[1] * ln;
        out[j + 2] = fr.o[2] + fr.ax[2] * X + fr.ay[2] * Y + fr.n[2] * ln;
      }
      return out;
    };
  }
  /** Project world points from the lamp onto the support plane (board z=0 or desk y=deskY). */
  function castShadow(pts, support) {
    const L = NB.light.lamps[support === 'desk' ? 1 : 0];
    const out = pts.slice();
    for (let i = 0; i < pts.length; i += 3) {
      const dx = pts[i] - L.x;
      const dy = pts[i + 1] - L.y;
      const dz = pts[i + 2] - L.z;
      const s = support === 'desk' ? (W.G.desk.y + 0.0005 - L.y) / dy : (-0.0005 - L.z) / dz;
      out[i] = L.x + dx * s;
      out[i + 1] = L.y + dy * s;
      out[i + 2] = L.z + dz * s;
    }
    return out;
  }
  function partial(p, k) {
    if (k >= 1) return p;
    let total = 0;
    for (let i = 2; i < p.length; i += 2) total += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    let left = total * k;
    const out = [p[0], p[1]];
    for (let i = 2; i < p.length; i += 2) {
      const l = Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
      if (left >= l) {
        out.push(p[i], p[i + 1]);
        left -= l;
      } else {
        const f = l > 0 ? left / l : 0;
        out.push(p[i - 2] + (p[i] - p[i - 2]) * f, p[i - 1] + (p[i + 1] - p[i - 1]) * f);
        break;
      }
    }
    return out;
  }
  function shaderFor(c, plane) {
    if (typeof c === 'number') return c;
    return { mat: W.M[c], plane };
  }
  function shapeOf(card) {
    const w = card.w;
    const h = card.h;
    if (card.shape === 'tornR') {
      const p = [0, 0, w - 12, 0];
      for (let y = 0, i = 0; y < h; y += 9, i++) p.push(w - 12 + (i % 2 ? 0 : 7), Math.min(h, y + 9));
      p.push(0, h);
      return p;
    }
    if (card.shape === 'tornL') {
      const p = [12, 0, w, 0, w, h, 12, h];
      for (let y = h, i = 0; y > 0; y -= 9, i++) p.push(12 - (i % 2 ? 0 : 7), Math.max(0, y - 9));
      return p;
    }
    if (card.curl) {
      const c = card.curl;
      return [0, 0, w, 0, w, h - c, w - c, h, 0, h];
    }
    return [0, 0, w, 0, w, h, 0, h];
  }
  function drawCard(card, fr, t, opts) {
    const base = makeXf(card, fr);
    const mag = opts && opts.mag;
    const xf = mag
      ? (p) => base(p.map((v, i) => mag.c[i % 2] + (v - mag.c[i % 2]) * mag.k))
      : base;
    const plane = fr.plane;
    const shape = shapeOf(card);
    const world = xf(shape);
    if (!mag) NB.poly3(castShadow(world, fr.support), { dark: 1 });
    NB.poly3(world, { mat: W.M[card.paper || 'paper'], plane });
    const art = artFor(card, t);
    for (const op of art.ops) {
      if (op.t0 !== undefined && t < op.t0) continue;
      if (op.k === 'p') NB.poly3(xf(op.p), shaderFor(op.m, plane));
      else if (op.k === 'd') NB.poly3(xf(op.p), { dark: 1 });
      else if (op.k === 'l') {
        const k = op.t1 !== undefined ? NB.seg(t, op.t0, op.t1) : 1;
        if (k <= 0) continue;
        NB.polyline3(xf(partial(op.p, k)), op.w / 1000, 1, 6, shaderFor(op.c, plane), op.closed && k >= 1);
      } else if (op.k === 't') {
        if (op.t1 !== undefined && t >= op.t1) continue;
        const mode = shaderFor(op.c, plane);
        for (const s of op.s) {
          if (s.ts >= 0 && t < s.ts) continue;
          const k = s.ts >= 0 ? NB.seg(t, s.ts, s.te) : 1;
          NB.polyline3(xf(partial(s.p, k)), op.w / 1000, 1, 5, mode);
        }
      }
    }
    if (card.curl) {
      const c = card.curl;
      const fold = xf([card.w, card.h - c, card.w - c, card.h, card.w - c * 0.86, card.h - c * 0.86]);
      NB.poly3(fold, { mat: W.M.paperB, plane });
      NB.polyline3(fold, 0.0012, 1, 2, C.INK, true);
    }
    if (mag) return;
    const ow = NB.clamp(Math.round((0.0016 * NB.cam.f) / Math.max(0.2, distTo(fr.o))), 1, 3);
    NB.polyline3(world, 0, ow, ow, C.INK, true);
    if (card.tape) card.tape.forEach((tp) => drawTape(xf, tp, plane));
  }
  function drawTape(xf, tp, plane) {
    const [x, y, len, ang] = tp;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const hw = 9;
    const p = [x - c * len + s * hw, y - s * len - c * hw, x + c * len + s * hw, y + s * len - c * hw, x + c * len - s * hw, y + s * len + c * hw, x - c * len - s * hw, y - s * len + c * hw];
    NB.poly3(xf(p), { mat: W.M.paperB, plane });
    NB.polyline3(xf(p), 0, 1, 1, C.SLATE, true);
  }
  function distTo(o) {
    return Math.hypot(o[0] - NB.cam.px, o[1] - NB.cam.py, o[2] - NB.cam.pz);
  }

  NB.props = { ART, Art, drawCard, makeXf, castShadow, partial, ell, distTo };
})();

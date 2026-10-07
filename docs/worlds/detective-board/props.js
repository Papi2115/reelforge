/* detective-board showcase - desk evidence: report page, ticket stub, map, pencil, magnifier. */
(function () {
  'use strict';
  const DB = window.DB;
  const { C, T, surf, px, rect, line, disc, ring, poly, hash, shade, clamp } = DB;
  const cache = new Map();
  const cached = (key, build) => {
    if (!cache.has(key)) cache.set(key, build());
    return cache.get(key);
  };

  /** Typed police page, top part only matters; the rest is covered by the map and ticket. */
  function report() {
    return cached('report', () => {
      const s = surf(200, 250, C.PAPER);
      for (let i = 0; i < 70; i += 1) px(s, hash(7, i, 1) * 200, hash(7, i, 2) * 250, C.PAPER_D);
      // horizontal fold, a third of the way down
      line(s, 0, 84, 199, 84, C.PAPER_D);
      line(s, 0, 85, 199, 85, C.WHITE);
      // staple
      line(s, 9, 10, 17, 8, C.WHITE);
      line(s, 9, 11, 17, 9, C.GREY);
      DB.typeText(s, 'MONA LISA - THEFT', 22, 26, C.BLACK, 51);
      DB.typeText(s, 'TAKEN: MONDAY 21 AUG 1911', 22, 46, C.BLACK, 53);
      DB.typeText(s, 'MUSEUM CLOSED ON MONDAYS', 22, 58, C.BLACK, 54);
      // someone underlined the detail that matters, twice, in ballpoint
      DB.stroke(s, [63, 68, 100, 67, 166, 68], 1, C.INK, 3, 0);
      DB.stroke(s, [70, 70, 120, 70, 160, 71], 1, C.INK, 4, 0);
      // coffee ring on the empty half: thick on one side, broken where the cup lifted
      for (let k = 0; k < 220; k += 1) {
        const a = (k / 220) * Math.PI * 2;
        if (a > 2.2 && a < 2.75) continue;
        const r = 17 + Math.sin(a * 3) * 0.6;
        const th = 1 + (Math.cos(a - 0.6) > 0.35 ? 1 : 0);
        for (let w = 0; w < th; w += 1) px(s, 58 + Math.cos(a) * (r - w), 168 + Math.sin(a) * (r - w), C.CORK_L);
      }
      return s;
    });
  }

  function ticket() {
    return cached('ticket', () => {
      const s = surf(100, 44, C.TEAL_L);
      for (let x = 3; x < 96; x += 1) {
        px(s, x, 3, C.TEAL_D);
        px(s, x, 40, C.TEAL_D);
      }
      line(s, 3, 3, 3, 40, C.TEAL_D);
      DB.typeText(s, 'PARIS', 9, 9, C.BLACK, 61);
      DB.typeText(s, 'FLORENCE', 9, 25, C.BLACK, 62);
      line(s, 12, 19, 22, 19, C.SLATE);
      line(s, 20, 17, 22, 19, C.SLATE);
      line(s, 20, 21, 22, 19, C.SLATE);
      // date stamp, inked unevenly and a little crooked
      for (let k = 0; k < 90; k += 1) {
        const a = (k / 90) * Math.PI * 2;
        if (hash(63, k, 0) < 0.3) continue;
        px(s, 75 + Math.cos(a) * 13, 22 + Math.sin(a) * 13, C.INK);
      }
      DB.typeText(s, '1913', 64, 19, C.INK, 64, C.TEAL_L);
      // torn right edge and a punched hole
      for (let y = 0; y < 44; y += 1) {
        const cut = 1 + Math.floor(hash(65, y >> 1, 0) * 3);
        for (let x = 0; x < cut; x += 1) s.d[y * 100 + 99 - x] = T;
      }
      disc(s, 93, 9, 2, 2, T);
      return s;
    });
  }

  // map geometry in map pixels, projected from real lon/lat at 20 px/deg lon, 29 px/deg lat
  // (Paris 48.85N 2.35E -> 50,30; Florence 43.77N 11.25E -> 228,177; Genoa, Corsica, Gulf of Lion)
  const COAST = [36, 262, 47, 246, 60, 236, 67, 224, 63, 208, 70, 195, 81, 182, 95, 186, 110, 191, 122, 197, 135, 188, 148, 179, 165, 170, 182, 158, 192, 162, 199, 168, 205, 176, 209, 184, 213, 202, 223, 211, 226, 217, 239, 226, 248, 236, 263, 250, 275, 262];
  const CORSICA = [191, 200, 194, 212, 195, 226, 190, 240, 186, 247, 181, 243, 178, 231, 181, 216, 186, 208, 189, 201];
  const SARDINIA = [183, 262, 186, 253, 192, 251, 198, 256, 200, 262];
  const PARIS = [50, 30];
  const FLORENCE = [228, 177];
  const ROUTE = [50, 30, 70, 44, 88, 58, 104, 74, 114, 92, 124, 112, 136, 134, 150, 142, 168, 146, 188, 150, 204, 156, 216, 164, 224, 172, 228, 176];

  function mapBase() {
    return cached('map', () => {
      const s = surf(300, 262, C.PAPER);
      for (let i = 0; i < 120; i += 1) px(s, hash(8, i, 1) * 300, hash(8, i, 2) * 262, C.PAPER_D);
      // sea: a light tint plus two hatch lines that follow the coast, clipped to the water
      const sea = surf(300, 262, T);
      poly(sea, COAST.concat([300, 262, 300, 270, 0, 270]), 1);
      poly(sea, CORSICA, T);
      poly(sea, SARDINIA, T);
      const wet = (x, y) => DB.get(sea, Math.round(x), Math.round(y)) === 1;
      // engraved water: broken horizontal rules (an ordered dither would moire once rotated)
      for (let y = 1; y < 262; y += 3)
        for (let x = 0; x < 300; x += 1) if (wet(x, y) && hash(83, x >> 3, y) > 0.12) px(s, x, y, C.TEAL_L);
      for (let off = 3; off <= 9; off += 3)
        for (let i = 0; i + 3 < COAST.length; i += 2) {
          const steps = 40;
          for (let j = 0; j <= steps; j += 1) {
            const x = COAST[i] + ((COAST[i + 2] - COAST[i]) * j) / steps;
            const y = COAST[i + 1] + ((COAST[i + 3] - COAST[i + 1]) * j) / steps + off;
            if (wet(x, y)) px(s, x, y, C.TEAL_L);
          }
        }
      for (let i = 0; i + 3 < COAST.length; i += 2) line(s, COAST[i], COAST[i + 1], COAST[i + 2], COAST[i + 3], C.TEAL_D);
      // Corsica and the top of Sardinia
      const outline = (pts, closed) => {
        for (let i = 0; i + 3 < pts.length; i += 2) line(s, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], C.TEAL_D);
        if (closed) line(s, pts[pts.length - 2], pts[pts.length - 1], pts[0], pts[1], C.TEAL_D);
      };
      outline(CORSICA, true);
      outline(SARDINIA, false);
      // the Alps as a crowd of little hand-drawn peaks
      for (let i = 0; i < 24; i += 1) {
        const a = hash(9, i, 1) * Math.PI * 2;
        const r = Math.sqrt(hash(9, i, 2));
        const x = Math.round(150 + Math.cos(a) * r * 36);
        const y = Math.round(114 + Math.sin(a) * r * 12 - (x - 150) * 0.22);
        line(s, x - 3, y + 3, x, y, C.GREY);
        line(s, x, y, x + 3, y + 3, C.SLATE);
      }
      // creases where the map was folded in four, worn where they cross
      for (let i = 0; i < 40; i += 1) px(s, 144 + hash(84, i, 1) * 13, 125 + hash(84, i, 2) * 13, C.PAPER_D);
      line(s, 150, 0, 150, 261, C.PAPER_D);
      line(s, 151, 0, 151, 261, C.WHITE);
      line(s, 0, 131, 299, 131, C.PAPER_D);
      line(s, 0, 132, 299, 132, C.WHITE);
      // printed margin + neat line
      rect(s, 0, 0, 300, 6, C.PAPER);
      rect(s, 0, 256, 300, 6, C.PAPER);
      rect(s, 0, 0, 6, 262, C.PAPER);
      rect(s, 294, 0, 6, 262, C.PAPER);
      for (let x = 6; x < 294; x += 1) {
        px(s, x, 6, C.TEAL_D);
        px(s, x, 255, C.TEAL_D);
      }
      line(s, 6, 6, 6, 255, C.TEAL_D);
      line(s, 293, 6, 293, 255, C.TEAL_D);
      // cities
      disc(s, PARIS[0], PARIS[1], 2, 2, C.SLATE);
      disc(s, FLORENCE[0], FLORENCE[1], 2, 2, C.SLATE);
      DB.typeText(s, 'PARIS', 57, 18, C.SLATE, 71, C.GREY);
      DB.typeText(s, 'FLORENCE', 230, 193, C.SLATE, 72, C.GREY);
      // a dog-eared corner
      for (let j = 0; j < 7; j += 1) for (let i = 0; i < 7 - j; i += 1) s.d[j * 300 + 299 - i] = T;
      return s;
    });
  }
  /** Map with the pencil route drawn up to `p` (0..1); returns {s, tip:[x,y]}. */
  function mapRoute(p, circle, boilSeed) {
    const s = DB.copy(mapBase());
    let total = 0;
    const segs = [];
    for (let i = 0; i + 3 < ROUTE.length; i += 2) {
      const l = Math.hypot(ROUTE[i + 2] - ROUTE[i], ROUTE[i + 3] - ROUTE[i + 1]);
      segs.push(l);
      total += l;
    }
    let left = total * clamp(p, 0, 1);
    let tip = [ROUTE[0], ROUTE[1]];
    let n = 0;
    for (let k = 0; k < segs.length && left > 0; k += 1) {
      const steps = Math.ceil(segs[k] * 2);
      for (let j = 0; j <= steps; j += 1) {
        const f = j / steps;
        if (f * segs[k] > left) break;
        const x = ROUTE[k * 2] + (ROUTE[k * 2 + 2] - ROUTE[k * 2]) * f;
        const y = ROUTE[k * 2 + 1] + (ROUTE[k * 2 + 3] - ROUTE[k * 2 + 1]) * f;
        n += 1;
        px(s, x, y, hash(81, Math.round(x), Math.round(y)) < 0.28 ? C.GREY : C.SLATE);
        tip = [x, y];
      }
      left -= segs[k];
    }
    if (circle > 0) {
      // red pencil: a loose loop that overshoots its start
      const pts = [];
      for (let i = 0; i <= 40; i += 1) {
        const u = i / 40;
        const a = -2.5 + u * Math.PI * 2 * 1.14;
        const r = 1 + u * 0.12;
        pts.push(FLORENCE[0] + Math.cos(a) * 13 * r, FLORENCE[1] - 1 + Math.sin(a) * 9 * r);
      }
      DB.stroke(s, pts, circle, C.RED, boilSeed, 0.5);
    }
    return { s, tip, n };
  }

  /** Pencil lying at an angle with its graphite tip at (x, y); lift raises it off the paper. */
  function pencil(f, x, y, lift) {
    const ux = 0.43;
    const uy = -0.9;
    const vx = 0.9;
    const vy = 0.43;
    const P = (a, b) => [x + ux * a + vx * b, y + uy * a + vy * b];
    const quad = (a0, a1, w0, w1) => {
      const p = [P(a0, -w0), P(a1, -w1), P(a1, w1), P(a0, w0)];
      return [].concat(...p);
    };
    const sx = 5 + lift * 7;
    const sy = 7 + lift * 8;
    const shadowPts = quad(0, 100, 0.5, 3).map((v, i) => v + (i % 2 ? sy : sx));
    const tmp = surf(f.w, f.h, T);
    poly(tmp, shadowPts, 1);
    for (let i = 0; i < tmp.d.length; i += 1) if (tmp.d[i] === 1) shade(f, i % f.w, (i / f.w) | 0, 1);
    poly(f, quad(0, 12, 0.6, 3), C.PAPER_D);
    poly(f, quad(0, 4, 0.5, 1.4), C.SLATE);
    poly(f, quad(12, 88, 3, 3), C.BRASS);
    line(f, ...P(13, -2), ...P(87, -2), C.WHITE);
    line(f, ...P(13, 2.6), ...P(87, 2.6), C.CORK_D);
    poly(f, quad(88, 94, 3.2, 3.2), C.GREY);
    line(f, ...P(90, -3), ...P(90, 3), C.PAPER);
    poly(f, quad(94, 100, 3, 3), C.CORK_L);
  }

  /** Magnifying glass: 2x view of what lies beneath, brass rim, wooden handle. */
  function magnifier(f, cx, cy, r, under) {
    const hx = -0.62;
    const hy = 0.78;
    // shadow of rim and handle (it hovers a few cm above the paper)
    const sx = 8;
    const sy = 10;
    for (let y = -r - 3; y <= r + 3; y += 1)
      for (let x = -r - 3; x <= r + 3; x += 1) {
        const d = Math.hypot(x, y);
        if (d >= r - 1 && d <= r + 2.5) shade(f, Math.round(cx + x + sx), Math.round(cy + y + sy), 1);
      }
    const h0 = [cx + hx * (r + 2), cy + hy * (r + 2)];
    const h1 = [cx + hx * (r + 54), cy + hy * (r + 54)];
    const hw = (a, w) => [a[0] - hy * w, a[1] + hx * w];
    const handle = [...hw(h0, -2.5), ...hw(h1, -3), ...hw(h1, 3), ...hw(h0, 2.5)];
    const tmp = surf(f.w, f.h, T);
    poly(tmp, handle.map((v, i) => v + (i % 2 ? sy : sx)), 1);
    for (let i = 0; i < tmp.d.length; i += 1) if (tmp.d[i] === 1) shade(f, i % f.w, (i / f.w) | 0, 1);
    // glass
    for (let y = -r; y <= r; y += 1)
      for (let x = -r; x <= r; x += 1) {
        if (x * x + y * y > (r - 1) * (r - 1)) continue;
        const c = DB.get(under, cx + Math.floor(x / 2), cy + Math.floor(y / 2));
        if (c !== T) px(f, cx + x, cy + y, c);
      }
    ring(f, cx, cy, r, C.BRASS);
    ring(f, cx, cy, r + 1, C.CORK_D);
    ring(f, cx, cy, r - 2, C.WHITE, 3.65, 4.35);
    ring(f, cx, cy, r - 3, C.WHITE, 3.85, 4.1);
    poly(f, handle, C.CORK_D);
    line(f, ...hw(h0, -1.5), ...hw(h1, -2), C.CORK_L);
    line(f, ...hw(h0, 1), ...hw(h0, -1), C.BRASS);
    disc(f, h0[0], h0[1], 2.6, 2.6, C.BRASS);
  }

  DB.props = { report, ticket, mapRoute, pencil, magnifier, PARIS, FLORENCE };
})();

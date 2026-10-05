/* B1 transitions. Each cut has a reason:
   - level-select map: the story changes PLACE/TIME (back to Xmas 82; forward to Alamogordo). Cursor = a cartridge.
   - playfield blinds: entering a level (columns switch on in an order seeded around the chosen node).
   - scanline wipe: the room calendar becomes the boss (the picture is redrawn line by line, interlaced).
   Cartridge insert / pull / continue? live in the shots (they are story beats, not just cuts). */
'use strict';
(function () {
  const K = B1.core;
  const F = B1.fonts;
  const TV = B1.tv;
  const { C } = K;

  const NODES = [
    { x: 24, y: 118, label: 'XMAS 82', icon: 'home' },
    { x: 62, y: 80, label: 'STORES 83', icon: 'store', above: true },
    { x: 104, y: 124, label: 'ALAMOGORDO 83', icon: 'pit' },
    { x: 136, y: 70, label: '?', icon: 'lock', above: true },
  ];
  const LEGS = [
    [[24, 118], [30, 104], [42, 99], [53, 91], [62, 80]],
    [[62, 80], [73, 85], [81, 97], [90, 103], [98, 114], [104, 124]],
    [[104, 124], [116, 119], [121, 102], [129, 88], [136, 70]],
  ];
  const ICONS = {
    home: { rows: ['...##...', '..####..', '.######.', '########', '.#....#.', '.#.##.#.', '.#.##.#.', '.######.'], cols: [C.RUST, C.RUST, C.RUST, C.RUST, C.TAN, C.GOLD, C.GOLD, C.TAN] },
    store: { rows: ['########', '#.#.#.#.', '########', '.#....#.', '.#.##.#.', '.#.##.#.', '.######.'], cols: [C.TEAL, C.CREAM, C.TEAL, C.TAN, C.GOLD, C.GOLD, C.TAN] },
    pit: { rows: ['..####..', '.######.', '########', '##....##', '###..###', '########'], cols: [C.DUSK, C.DUSK, C.TEAK, C.TEAK, C.WALNUT, C.WALNUT] },
    lock: { rows: ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..'], cols: C.GREY_D },
  };
  // path as dense points (for dots and the cursor)
  function legPoints(leg) {
    const out = [];
    for (let i = 0; i + 1 < leg.length; i++) {
      const a = leg[i]; const b = leg[i + 1];
      const n = Math.max(1, Math.round(Math.hypot((b[0] - a[0]) * 2, b[1] - a[1]) / 2));
      for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    out.push(leg[leg.length - 1]);
    return out;
  }
  const LEG_PTS = LEGS.map(legPoints);
  const ROUTE = { back: [[1, -1], [0, -1]], fwd: [[1, 1]] };

  // cursor position along a route at progress p (0..1), as hops of uneven length; returns {x, y, hopF, landed}
  function routePoints(mode) {
    const pts = [];
    ROUTE[mode].forEach((r) => {
      const leg = LEG_PTS[r[0]].slice();
      if (r[1] < 0) leg.reverse();
      if (pts.length) leg.shift();
      pts.push(...leg);
    });
    return pts;
  }
  function cursorAt(mode, u, t0, dur, seed) {
    const pts = routePoints(mode);
    const nHops = mode === 'back' ? 9 : 6;
    // uneven hop lengths + uneven hop durations, with a breath at the middle node when going back
    const lens = []; let tot = 0;
    for (let i = 0; i < nHops; i++) { const l = 0.7 + K.hash(seed, i, 1) * 0.6; lens.push(l); tot += l; }
    const durs = []; let dt = 0;
    for (let i = 0; i < nHops; i++) { const d = 0.75 + K.hash(seed, i, 2) * 0.5 + (mode === 'back' && i === 4 ? 1.1 : 0); durs.push(d); dt += d; }
    let tt = (u - t0) / dur * dt;
    if (tt <= 0) return { p: pts[0], lift: 0, sq: 1 };
    let acc = 0;
    for (let i = 0; i < nHops; i++) {
      if (tt < durs[i] || i === nHops - 1) {
        const f = Math.min(1, tt / durs[i]);
        const a = acc / tot; const b = (acc + lens[i]) / tot;
        const pos = a + (b - a) * K.ease.inOut(Math.min(1, f / 0.8));
        const idx = Math.min(pts.length - 1, Math.round(pos * (pts.length - 1)));
        const air = Math.min(1, f / 0.8);
        const lift = f < 0.8 ? Math.sin(Math.PI * air) * (4 + lens[i] * 3) : 0;
        const sq = f < 0.08 ? 0.72 : f > 0.8 && f < 0.92 ? 0.75 : 1;
        return { p: pts[idx], lift, sq };
      }
      tt -= durs[i];
      acc += lens[i];
    }
    return { p: pts[pts.length - 1], lift: 0, sq: 1 };
  }

  // The level-select map (in-TV). mode: 'back' (hook -> Xmas 82) | 'fwd' (stores -> Alamogordo)
  function map(u, mode, t) {
    TV.at(0, 0);
    TV.bands(0, 180, 160, [[0, C.TUBE], [150, C.NIGHT], [166, C.TUBE]]);
    // horizon of the map: a low ridge of playfield blocks
    for (let b = 0; b < 40; b++) {
      const h = 2 + Math.floor(K.hash(77, b, 1) * 5);
      TV.r(b * 4, 150 - h, 4, h, C.NIGHT);
    }
    const from = mode === 'back' ? 2 : 1;
    const to = mode === 'back' ? 0 : 2;
    // dots: uneven spacing (hand-placed), travelled part lighter
    LEG_PTS.forEach((leg, li) => {
      for (let i = 1; i < leg.length - 1; i++) {
        if (K.hash(31, li, i) < 0.42) continue;
        const p = leg[i];
        const jx = Math.round((K.hash(32, li, i) - 0.5) * 1.2);
        TV.r(p[0] + jx, p[1], 1, 2, li === 2 && mode === 'back' ? C.TEAK : C.TAN);
      }
    });
    NODES.forEach((n, i) => {
      const pop = (i === from ? 0 : 0.06 + K.hash(41, i, 1) * 0.16);
      if (u < pop) return;
      const ic = ICONS[n.icon];
      const w = ic.rows[0].length;
      TV.spr(ic.rows, ic.cols, n.x - w / 2, n.y - ic.rows.length * 2 - 3, { rowH: 2 });
      const selT = u - (mode === 'back' ? 1.42 : 1.02);
      const sel = i === to && selT > 0;
      const blinkOff = sel && ((selT > 0.07 && selT < 0.14) || (selT > 0.26 && selT < 0.31));
      const col = i === 3 ? C.GREY_D : sel ? (blinkOff ? C.TEAK : C.GOLD) : i === to ? C.CREAM : C.TAN;
      const lw = F.joyWidth(n.label, 2);
      const lx = Math.min(600 - lw, Math.max(40, n.x * 4 - lw / 2));
      const ly = n.above ? (n.y - ic.rows.length * 2 - 3) * 2 - 18 : n.y * 2 + 6;
      if (n.icon !== 'lock') F.joy(n.label, lx, ly, 2, col);
    });
    const cur = cursorAt(mode, u, mode === 'back' ? 0.28 : 0.18, mode === 'back' ? 1.12 : 0.82, mode === 'back' ? 51 : 52);
    const cx = cur.p[0] - 3; const cy = cur.p[1] - 16 - cur.lift;
    TV.r(cur.p[0] - 2, cur.p[1] - 1, 4, 1, C.VOID);
    if (cur.sq < 1) TV.sprSquash(TV.CART, C.GREY, cx, cy, cur.sq, {});
    else TV.cart(cx, cy, C.ORANGE, { body: C.GREY });
    TV.crt(0, 0, 640, 360, t);
  }

  // Composite: columns of 16 px that are still "closed" show `under` (the map) on top of the current frame.
  function blinds(under, k, originX, seed) {
    const fb = K.fb;
    for (let col = 0; col < 40; col++) {
      const d = Math.abs(col * 16 + 8 - originX) / 640;
      const open = d * 0.7 + K.hash(seed, col, 1) * 0.3;
      if (k > open) continue;
      for (let y = 0; y < 360; y++) {
        const o = y * 640 + col * 16;
        for (let x = 0; x < 16; x++) fb[o + x] = under[o + x];
      }
    }
  }
  // Composite: interlaced scanline wipe; rows not yet drawn show `under`.
  function scanWipe(under, k) {
    const fb = K.fb;
    const pass = k < 0.5 ? 0 : 1;
    const front = Math.floor(((k < 0.5 ? k : k - 0.5) / 0.5) * 360);
    for (let y = 0; y < 360; y++) {
      const drawn = (y % 2 === 0 && (pass === 1 || y < front)) || (y % 2 === 1 && pass === 1 && y < front);
      if (!drawn) for (let x = 0; x < 640; x++) fb[y * 640 + x] = under[y * 640 + x];
      if (y === front || y === front + 1) for (let x = 0; x < 640; x++) if (K.dith(x, y, 0.6)) fb[y * 640 + x] = C.CREAM;
    }
  }

  B1.trans = { map, blinds, scanWipe, NODES };
})();

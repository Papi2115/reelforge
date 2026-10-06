/* B1 v2 transitions. Each cut has a reason:
   - level-select map: the story changes PLACE/TIME (back to Xmas 82; forward to Alamogordo). Cursor = a cartridge.
   - playfield blinds: entering a level (columns switch on in an order seeded around the chosen node).
   - scanline wipe: the room calendar becomes the boss (the picture is redrawn line by line, interlaced).
   v2 seams around the two new shots (see the bottom of this file):
   - 3->4 attract cycle + draw-in: the deadline is beaten, the game is over, so the console drops into attract
     mode (the real 2600 colour cycling of an idle picture); attract mode redraws the screen as the score table.
   - 4->5 pull-back: the score table says INSERT COIN; the camera pulls back from the glass to the family TV and
     the "coin" is the next cartridge going into the slot (shot 5's head).
   - 7->8 page slide: the manual from the returned box slides over the counter (anticipation peek, slide,
     overshoot, settle) and becomes the spread.
   - 8->9 page turn: the manual's page is turned and the level-select map is printed underneath; the cursor
     hops on to ALAMOGORDO 83 (shot 9's head continues the same map clock).
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

  // ================= v2 seams =================
  const R = B1.room;
  const film = B1.film;
  const S = film.S;
  function lutOf(pairs) {
    const out = K.PAL.map((_, i) => i);
    Object.keys(pairs).forEach((k) => { out[C[k]] = C[pairs[k]]; });
    return out;
  }
  // 2600 attract mode: an idle picture keeps its shapes but its hues step round the wheel and dim a little.
  const CYCLE = [
    lutOf({ RUST: 'TEAL_D', ORANGE: 'TEAL', GOLD: 'AQUA', CRIMSON: 'BLUE', TAN: 'TEAL', CREAM: 'AQUA', WHITE: 'AQUA', TEAK: 'TEAL_D', WALNUT: 'NIGHT', WALNUT_D: 'TUBE', AVOCADO: 'BLUE', OLIVE_D: 'NIGHT', MAUVE: 'TEAL', DUSK: 'TEAL_D', TEAL: 'BLUE', AQUA: 'GREY', BLUE: 'DUSK', GREY: 'AQUA' }),
    lutOf({ RUST: 'DUSK', ORANGE: 'MAUVE', GOLD: 'MAUVE', CRIMSON: 'MAUVE', TAN: 'MAUVE', CREAM: 'GREY', WHITE: 'CREAM', TEAK: 'DUSK', WALNUT: 'NIGHT', WALNUT_D: 'TUBE', AVOCADO: 'DUSK', OLIVE_D: 'TUBE', TEAL: 'DUSK', TEAL_D: 'NIGHT', AQUA: 'MAUVE', BLUE: 'DUSK', GREY: 'MAUVE', MAUVE: 'GREY', DUSK: 'NIGHT' }),
    lutOf({ RUST: 'OLIVE_D', ORANGE: 'AVOCADO', GOLD: 'AVOCADO', CRIMSON: 'RUST', TAN: 'AVOCADO', CREAM: 'TAN', WHITE: 'TAN', TEAK: 'OLIVE_D', WALNUT: 'WALNUT_D', AVOCADO: 'TEAK', TEAL: 'AVOCADO', TEAL_D: 'OLIVE_D', AQUA: 'TAN', BLUE: 'OLIVE_D', GREY: 'TAN', MAUVE: 'TEAK', DUSK: 'WALNUT_D', NIGHT: 'TUBE' }),
  ];
  // steps start at these shot-3 local times (uneven holds); applied to the TV picture only (the glass note keeps colour)
  const CYCLE_AT = [8.12, 8.27, 8.41];
  function attractCycle(t) {
    let k = -1;
    CYCLE_AT.forEach((a, i) => { if (t >= a) k = i; });
    if (k >= 0) K.remapRect(0, 0, 640, 360, CYCLE[k]);
  }
  // Attract mode redraws the screen top-down in uneven bursts; rows not yet drawn keep `under`. A two-row
  // playfield band (alternating per 16 px block) marks the beam.
  function drawIn(under, k, seed) {
    const n = 9;
    let tot = 0; const w = [];
    for (let i = 0; i < n; i++) { const v = 0.55 + K.hash(seed, i, 1) * 0.9; w.push(v); tot += v; }
    let acc = 0; let front = 360;
    for (let i = 0; i < n; i++) {
      const a = acc / tot; const b = (acc + w[i]) / tot;
      if (k < b) { front = Math.round((i + K.ease.out((k - a) / (b - a))) * 40); break; }
      acc += w[i];
    }
    const fb = K.fb;
    for (let y = Math.max(0, front); y < 360; y++) fb.set(under.subarray(y * 640, y * 640 + 640), y * 640);
    if (front < 360) for (let b = 0; b < 40; b++) K.rect(b * 16, front, 16, 2, (b + Math.floor(front / 40)) % 3 ? C.TEAL : C.AQUA);
  }
  // Raw scene content into a buffer (no seams, no HUD). Restores the previous render target, TV offset and room
  // camera, so it can be called in the middle of another shot's draw.
  function renderScene(buf, i, t) {
    const keep = K.fb;
    const cam = { ox: R.cam.ox, oy: R.cam.oy, s: R.cam.s };
    const view = { ox: TV.view.ox, oy: TV.view.oy };
    K.target(buf); K.setClip(); K.fill(C.VOID);
    TV.at(0, 0); R.setCam(160, 90, 2);
    film.scene[i](t);
    K.setClip();
    TV.at(view.ox, view.oy); R.cam.ox = cam.ox; R.cam.oy = cam.oy; R.cam.s = cam.s;
    K.target(keep);
  }
  // The family TV's screen in the console close-up (camera 160, 90, 2), in px.
  function closeupScreen() {
    R.setCam(160, 90, 2);
    return { x: R.X(8), y: 0, w: R.X(86) - R.X(8), h: R.Y(40) };
  }
  // Pull back from the glass into the room: `img` shrinks from full frame into the TV in the console close-up.
  function pullBack(img, k) {
    const scr = closeupScreen();
    R.consoleCloseup(0, { cartY: -84, cartX: 12, grip: true, tv: 'image', tvImage: img });
    if (k >= 1) return;
    const e = K.ease.inOut(k);
    K.blitScaled(img, K.lerp(0, scr.x, e), K.lerp(0, scr.y, e), K.lerp(640, scr.w, e), K.lerp(360, scr.h, e));
  }
  // A page slides in over the current frame: peek (anticipation) -> hold -> slide -> overshoot -> settle.
  function pageSlidePose(u) {
    if (u < 0.14) return { oy: K.lerp(390, 332, K.ease.out(u / 0.14)), ang: 0.07 };
    if (u < 0.22) return { oy: 332, ang: 0.07 };
    if (u < 0.56) { const e = K.ease.inOut((u - 0.22) / 0.34); return { oy: K.lerp(332, -10, e), ang: K.lerp(0.07, -0.012, e) }; }
    if (u < 0.68) { const e = K.ease.out((u - 0.56) / 0.12); return { oy: K.lerp(-10, 0, e), ang: K.lerp(-0.012, 0, e) }; }
    return { oy: 0, ang: 0 };
  }
  // Where the sliding page covers the frame at u (same transform as blitRotated): (x, y) -> bool.
  function pageSlideCover(u) {
    const p = pageSlidePose(u);
    if (u < 0 || p.oy >= 380) return () => false;
    const oy = Math.round(p.oy);
    const co = Math.cos(-p.ang); const si = Math.sin(-p.ang);
    return (x, y) => {
      const rx = x + 0.5 - K.W / 2; const ry = y + 0.5 - (K.H / 2 + oy);
      const sx = Math.floor(rx * co - ry * si + K.W / 2); const sy = Math.floor(rx * si + ry * co + K.H / 2);
      return sx >= 0 && sy >= 0 && sx < K.W && sy < K.H;
    };
  }
  function pageSlide(page, u) {
    if (u < 0) return;
    const p = pageSlidePose(u);
    if (p.oy >= 380) return;
    // cast shadow first (offset down-right), then the page
    K.poly(K.quad(320 + 7, 180 + p.oy + 9, 640, 360, p.ang), 0, K.SCAN);
    K.blitRotated(page, 0, Math.round(p.oy), p.ang);
  }
  // Page turn from the bottom-right corner, right to left. Left of the flap: the page; the flap: the paper's
  // back with the print showing through (mirrored, faint); right of the fold: what was under (already in fb).
  // x of the fold in row y at turn progress k (0 < k < 1): paper (page or flap) left of it, what was under right.
  function pageTurnFold(k, y) {
    const e = K.ease.inOut(k);
    const lead = 90 * Math.sin(Math.PI * k);
    return Math.round(640 * (1 - e) - (y / 360) * lead);
  }
  function pageTurn(page, k) {
    if (k <= 0) { K.fb.set(page); return; }
    if (k >= 1) return;
    const fb = K.fb;
    for (let y = 0; y < 360; y++) {
      const p = pageTurnFold(k, y);
      const fw = Math.round((640 - p) * 0.55);
      const o = y * 640;
      for (let x = 0; x < Math.min(640, p); x++) {
        if (x >= p - fw) {
          const mx = 2 * p - x;
          const v = mx < 640 ? page[o + mx] : C.CREAM;
          const edge = x === p - fw || x === p - 1;
          fb[o + x] = edge ? C.WALNUT_D : (K.DARK[v] || v === C.RUST || v === C.TEAK) && K.dith(x, y, 0.5) ? C.TAN : x > p - 7 ? C.TAN : C.CREAM;
        } else fb[o + x] = page[o + x];
      }
      // the lifted flap casts a soft shadow onto what is under it
      for (let x = Math.max(0, p); x < Math.min(640, p + 10); x++) if (x < p + 4 || K.dith(x, y, 0.5)) fb[o + x] = K.SCAN[fb[o + x]];
    }
  }

  // --- the wrapped draws for the two new shots (scene content comes from film.scene[i]) ---
  const DRAW_IN = 0.55; // shot 4 head: attract mode redraws over the cycled deadline frame
  const PULL = 0.62; // shot 4 tail: the move takes 0.5 s, then holds on the room
  const TURN = 0.8; // shot 8 tail: page turn (0.5 s) onto the map, then the map clock runs into shot 9
  const bufA = K.newBuffer();
  const bufB = K.newBuffer();
  function scoresDraw(t) {
    const dur = film.shots[S.scores].dur;
    if (t >= dur - PULL) {
      renderScene(bufB, S.scores, t);
      pullBack(bufB, (t - (dur - PULL)) / (PULL - 0.12));
      return {};
    }
    if (t < DRAW_IN) B1.renderShotInto(bufA, S.deadline, film.shots[S.deadline].dur - 1 / 30);
    const out = film.scene[S.scores](t) || {};
    K.setClip(); TV.at(0, 0);
    if (t < DRAW_IN) drawIn(bufA, t / DRAW_IN, 404);
    return out;
  }
  function manualDraw(t) {
    const dur = film.shots[S.manual].dur;
    const u = t - (dur - TURN);
    if (u >= 0) {
      renderScene(bufB, S.manual, t);
      // the map's CRT clock continues into shot 9 (which starts it at 45.5 - kept from v1)
      map(u, 'fwd', 45.5 - (dur - t));
      const k = u / 0.5;
      pageTurn(bufB, k);
      // the HUD stays in paper ink wherever the page or its flap is still under it
      if (k <= 0) return { hudDark: true };
      if (k >= 1) return {};
      return { hudDarkAt: (x, y) => x < pageTurnFold(k, y) };
    }
    const out = film.scene[S.manual](t) || {};
    K.setClip(); TV.at(0, 0);
    return out;
  }
  film.draw[S.scores] = scoresDraw;
  film.draw[S.manual] = manualDraw;

  B1.trans = { map, blinds, scanWipe, NODES, attractCycle, drawIn, renderScene, pullBack, pageSlide, pageSlideCover, pageTurn, closeupScreen };
})();

/* B1 shots 5-8. Focal point + traces are written above each shot, before the code (QUALITY.md §9). */
'use strict';
(function () {
  const K = B1.core;
  const F = B1.fonts;
  const TV = B1.tv;
  const R = B1.room;
  const HUD = B1.hud;
  const T = B1.trans;
  const A = B1.art;
  const { C, seg, ease } = K;
  const film = B1.film;
  const buf2 = K.newBuffer();
  const buf3 = K.newBuffer();

  const KID = {
    rows: ['..####..', '.######.', '.##.###.', '..####..', '...##...', '.######.', '########', '#.####.#', '#.####.#', '#.####.#', '..####..', '..#..#..', '..#..#..', '..#..#..', '.##..##.'],
    cols: [C.WALNUT, C.WALNUT, C.TAN, C.TAN, C.TAN, C.TEAL, C.CREAM, C.TEAL, C.CREAM, C.TEAL, C.TEAL, C.BLUE, C.BLUE, C.BLUE, C.CREAM],
  };

  // ============ SHOT 5 · C-roll, boss 2: THE FLOOD (8 s) ============
  // FOCAL: the rising wall of near-identical cartridges (the boss has no body: it is the amount).
  // TRACES: surges in fast-fast-pause rhythm with decaying shakes; crest flickers (2600 sprite limit); the kid's
  //         input-lag crouch before the jump + landing squash; the note is taped (tape strip), underlined in two
  //         strokes; hit-stop + flash when the flood wins, then the picture drains line by line (the crash).
  const SURGES = [[0, 0.5, 22, 30], [1.6, 2.15, 30, 52], [2.65, 3.05, 52, 72], [3.9, 4.45, 72, 98], [6.0, 6.45, 98, 142]];
  function floodLevel(t) {
    let lv = SURGES[0][2];
    for (const s of SURGES) {
      if (t >= s[1]) lv = s[3];
      else if (t >= s[0]) { lv = K.lerp(s[2], s[3], ease.out((t - s[0]) / (s[1] - s[0]))); break; } else break;
    }
    return lv;
  }
  function store() {
    TV.bands(0, 180, 160, [[0, C.TUBE], [14, C.TEAL_D], [24, C.TUBE], [40, C.TEAL_D], [150, C.TUBE]]);
    [64, 100, 136].forEach((sy, k) => {
      TV.r(0, sy, 160, 2, C.TEAK); TV.r(0, sy + 2, 160, 1, C.WALNUT_D);
      let x = 4 + k * 3;
      let i = 0;
      while (x < 156) {
        const w = 4 + Math.floor(K.hash(55, k, i) * 3);
        const h = 10 + Math.floor(K.hash(56, k, i) * 5);
        TV.r(x, sy - h, w, h, [C.WALNUT, C.TEAK, C.TEAL_D, C.DUSK][Math.floor(K.hash(57, k, i) * 4)]);
        TV.r(x, sy - h + 2, w, 1, C.WALNUT_D);
        x += w + 1 + Math.floor(K.hash(58, k, i) * 3);
        i++;
      }
    });
  }
  function kid(t) {
    let x = 22; let top = 70; let sq = 1;
    if (t >= 2.84 && t < 2.98) sq = 0.8;
    else if (t >= 2.98 && t < 3.34) { const k = (t - 2.98) / 0.36; top = K.lerp(70, 34, k) - Math.sin(Math.PI * k) * 12; x = 22 + Math.round(k * 3); } else if (t >= 3.34) { top = 34; x = 25; if (t < 3.44) sq = 0.82; }
    TV.sprSquash(KID.rows, KID.cols, x, top, sq, { rowH: 2 });
  }
  function shot5(t) {
    const f = K.frameOf(t);
    const hit = t >= 6.45 && t < 6.66;
    const tt = t >= 6.45 ? 6.45 : t;
    let sh = { x: 0, y: 0 };
    SURGES.forEach((s, i) => { const q = K.shake(tt, s[0], 2 + i * 0.6, 8, 500 + i); sh.x += q.x; sh.y += q.y; });
    if (hit) { const q = K.shake(t, 6.45, 6, 7, 599); sh.x += q.x; sh.y += q.y; }
    TV.at(sh.x * 4, sh.y * 2);
    store();
    kid(tt);
    const lv = floodLevel(tt);
    A.flood(lv, tt, 7);
    TV.at(0, 0);
    HUD.bossCard({ t: tt, t0: 0.95, num: 2, name: 'THE FLOOD', from: 'right', x: 400, y: 56, seed: 52, hp: { n: 8, value: 8 * (lv - 22) / (142 - 22) } });
    if (t >= 6.45 && t < 6.5) K.remapRect(0, 0, 640, 360, K.SCAN.map((v, i) => (K.DARK[i] ? C.CREAM : C.VOID)));
    const drain = seg(t, 6.7, 7.35);
    if (drain > 0) {
      const yy = Math.round(drain * 360);
      K.remapRect(0, 0, 640, yy, K.DRAIN);
      if (drain < 1) K.remapRect(0, yy, 640, 2, K.DRAIN, 0.5);
    }
    TV.crt(0, 0, 640, 360, t);
    HUD.note({ cx: 178, cy: 196, w: 236, h: 58, ang: -0.045, t0: 5.22, t, lines: ['WEAK POINT:', 'QUALITY CONTROL'], seed: 71, under: 1, tape: true });
    return {};
  }

  // ============ SHOT 6 · B-roll, the returns counter (quiet, 7 s) ============
  // FOCAL: the family's cartridge (Dad's tape label "XMAS 82") pushed back across the counter.
  // TRACES: the cartridge comes out after a squeeze and a small push-down (anticipation); crooked RETURNS sign on
  //         chains of unequal length (pixel-snapped tilt); the push has a hitch; the returned boxes land unevenly
  //         and are stacked off-true; one fluorescent tube flickers rarely; the grey dot in the corner (a nod to
  //         the first famous easter egg). Long still moment 4.9-6.2.
  function shot6(t) {
    if (t < 1.3) {
      R.setCam(160, 90, 2);
      let cartY = 64; let tv = 'attract'; let handY;
      if (t < 0.32) handY = K.lerp(-60, 65, ease.out(t / 0.32));
      else handY = 65;
      if (t >= 0.42 && t < 0.5) cartY = 65;
      if (t >= 0.5) { const k = ease.in(seg(t, 0.5, 0.74)); cartY = K.lerp(65, -100, k); handY = cartY + 1; }
      if (t >= 0.5 && t < 0.7) tv = 'garbage';
      if (t >= 0.7) tv = 'off';
      R.consoleCloseup(t, { cartY, cartX: 0, grip: false, tv });
      if (handY > -80) {
        const sq = t >= 0.32 && t < 0.5;
        R.gripHand(189, handY, sq);
      }
      return {};
    }
    if (t >= 6.2) { T.map(t - 6.2, 'fwd', t); return {}; }
    R.setCam(160, 90, 2);
    const k = seg(t, 1.42, 2.35);
    const hitch = t > 1.86 && t < 1.98 ? 2 : 0;
    const cartX = K.lerp(330, 206, ease.out(k)) + hitch;
    const push = t < 2.5 ? 0 : ease.inOut(seg(t, 2.5, 3.3)) * 90;
    R.counter(t, { cartX, pushHand: push < 89 ? push : undefined, drops: [3.95, 4.42, 4.71] });
    return {};
  }
  // ============ SHOT 7 · A->C, Alamogordo: the landfill (9 s) ============
  // FOCAL: the pile at the bottom of the trench (the camera follows the cartridges down), then THE LANDFILL card.
  // OPINION: a cross-section - a "dark level" under the desert; the trench is off-centre and hand-dug (ragged walls).
  // TRACES: uneven releases + flicker in the shaft; the camera scroll eases and ends on a hold; dirt fills in blocks
  //         of uneven colour and per-column height; boss card drops from the top (third entrance variant); note with
  //         three lines at a tilt; the lights go out row by row and only the card stays lit (it burns in).
  const DROPS = [1.05, 1.32, 1.5, 1.86, 2.02, 2.4, 2.58, 2.71, 3.1, 3.33, 3.62, 3.8, 4.05];
  const SHAFT_X = 112;
  function pitHalf(y) {
    if (y < 150) return 6 + Math.floor((y - 41) / 10) * 2 + (K.hash(85, Math.floor(y / 4), 1) > 0.7 ? 1 : 0);
    return Math.min(36, 13 + 12 + (y - 150) * 1.2) + (K.hash(85, Math.floor(y / 4), 2) > 0.6 ? 1 : 0);
  }
  function landfillWorld(t, f, scroll) {
    const oy = -scroll * 2;
    TV.at(0, oy);
    TV.bands(0, 41, 160, [[-10, C.VOID], [0, C.TUBE], [18, C.NIGHT], [30, C.DUSK], [36, C.MAUVE]]);
    for (let b = 18; b < 40; b++) { const h = 2 + Math.floor(Math.abs(Math.sin(b * 1.3)) * 4 + K.hash(12, b, 1) * 2); TV.r(b * 4, 40 - h, 4, h, C.NIGHT); }
    TV.bands(0, 320, 160, [[40, C.TEAK], [42, C.WALNUT], [64, C.WALNUT_D], [68, C.WALNUT], [101, C.WALNUT_D], [107, C.WALNUT], [146, C.WALNUT_D], [152, C.WALNUT], [200, C.WALNUT_D]]);
    for (let i = 0; i < 24; i++) TV.r(Math.floor(K.hash(81, i, 1) * 80), 46 + Math.floor(K.hash(81, i, 2) * 200), 4 + Math.floor(K.hash(81, i, 3) * 6), 2, i % 3 ? C.GREY_D : C.WALNUT_D);
    // the trench: ragged stepped walls, widening into a chamber
    for (let y = 41; y < 214; y += 2) {
      const hw = pitHalf(y);
      const lean = Math.floor((y - 41) / 30);
      TV.r(SHAFT_X - hw - lean, y, hw * 2, 2, C.VOID);
    }
    // pile at the bottom, grows as carts land
    const landed = DROPS.filter((d) => t >= d + 0.75 + (d % 0.3)).length;
    for (let i = 0; i < 26; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      if (Math.floor(i / 2) > landed) continue;
      TV.cart(SHAFT_X - 36 + col * 7 + (row % 2) * 3 + Math.round((K.hash(83, i, 1) - 0.5) * 2), 205 - row * 7, A.STRIPES[i % 6], { label: C.TAN });
    }
    // carts falling down the shaft (flicker when crowded)
    const air = DROPS.filter((d) => t >= d && t < d + 0.75 + (d % 0.3)).length;
    DROPS.forEach((d, i) => {
      const dur = 0.75 + (d % 0.3);
      if (t < d || t >= d + dur) return;
      if (air > 2 && (f + i) % 2 === 0) return;
      const k = (t - d) / dur;
      A.tumbler(SHAFT_X - 4 + Math.round(Math.sin(i * 2.1) * 4), Math.round(34 + k * k * 162), A.STRIPES[i % 6], f, i);
    });
    // burial: dirt fills from the pile upward in blocks; uneven per column; clipped to the trench
    const fillK = seg(t, 6.2, 8.2);
    if (fillK > 0) {
      for (let c = 0; c < 20; c++) {
        const x = SHAFT_X - 40 + c * 4;
        const top = 212 - Math.max(0, fillK * 172 - K.hash(84, c, 1) * 30);
        for (let y = 212; y > top; y -= 2) {
          const hw = pitHalf(y);
          const lean = Math.floor((y - 41) / 30);
          if (x + 4 <= SHAFT_X - hw - lean || x >= SHAFT_X + hw - lean) continue;
          const v = K.hash(86, c, y);
          TV.r(x, y - 2, 4, 2, v > 0.8 ? C.TEAK : v > 0.25 ? C.WALNUT : C.WALNUT_D);
        }
      }
    }
    // one cartridge bounced and stuck on a ledge halfway down (it never made the pile)
    TV.r(SHAFT_X - pitHalf(96) - 2, 99, 6, 1, C.WALNUT);
    TV.cart(SHAFT_X - pitHalf(96) - 1, 92, A.STRIPES[3], { label: C.TAN });
    // the sign at the edge, on one leaning post (the place's own label)
    TV.at(0, oy);
    TV.r(141, 31, 1, 9, C.TEAK); TV.r(142, 32, 1, 8, C.WALNUT);
    TV.r(128, 25, 29, 7, C.CREAM); TV.r(128, 31, 29, 1, C.TAN); TV.r(157, 26, 1, 6, C.TUBE);
    F.joy('LANDFILL', 128 * 4 + 7, 25 * 2 + oy + 2, 2, C.WALNUT_D);
    // the truck up top, tipping into the trench
    const truckT = t < 4.2 ? 1 : 1 - seg(t, 4.2, 4.6);
    TV.at(0, oy - 57 * 2);
    truckTop(SHAFT_X - 36, truckT, t);
    TV.at(0, 0);
  }
  function truckTop(x, tilt, t) {
    TV.r(x, 92, 36, 2, C.GREY_D);
    [3, 24, 29].forEach((wx) => TV.r(x + wx, 94, 4, 3, C.VOID));
    TV.r(x, 82, 10, 10, C.ORANGE); TV.r(x + 2, 84, 5, 3, C.NIGHT);
    for (let i = 0; i < 12; i++) { const by = 85 - tilt * (11 - i) * 1.25; TV.r(x + 11 + i * 2, Math.round(by), 2, 6, C.TEAK); TV.r(x + 11 + i * 2, Math.round(by), 2, 1, C.RUST); }
    if (Math.floor(t * 6) % 3) TV.r(x + 2, 78, 2, 2, C.GREY_D);
  }
  function shot7(t) {
    const f = K.frameOf(t);
    const u = 0.8 + t;
    if (u < 1.3) { T.map(u, 'fwd', t + 45.5); return {}; }
    const scroll = ease.inOut(seg(t, 3.2, 4.65)) * 96;
    landfillWorld(t, f, scroll);
    const nm = K.typed('ALAMOGORDO, NM', t, 1.25, 17, 20);
    if (nm > 0 && t < 5.7) F.joy('ALAMOGORDO, NM'.slice(0, nm), 40, 42, 2, C.TAN);
    // lights out, row by row, before CONTINUE? (the card is drawn after: it stays lit and burns in)
    const dark = seg(t, 8.15, 8.85);
    if (dark > 0) {
      const yy = Math.round(dark * 360);
      K.remapRect(0, 0, 640, yy, K.SCAN);
      K.remapRect(0, 0, 640, yy, K.SCAN);
      K.remapRect(0, 0, 640, Math.round(dark * dark * 360), K.SCAN);
    }
    if (t >= 5.85) {
      HUD.bossCard({ t, t0: 5.85, num: 3, name: 'THE LANDFILL', from: 'top', x: 40, y: 56, seed: 73, hp: { n: 10, value: 10, segW: 11 } });
    }
    TV.crt(0, 0, 640, 360, t);
    HUD.note({ cx: 478, cy: 206, w: 176, h: 86, ang: 0.055, t0: 7.15, t, lines: ['WEAK POINT:', 'IT KEEPS', 'EVERYTHING'], seed: 91, under: 2 });
    if (u < 1.8) {
      K.target(buf2); K.fill(C.VOID); T.map(u, 'fwd', t + 45.5); K.target();
      T.blinds(buf2, (u - 1.3) / 0.5, 104 * 4, 62);
    }
    return {};
  }

  // ============ SHOT 8 · payoff: continue? (9 s) ============
  // FOCAL: 1) the countdown digit; 2) the new grey cartridge (drawn in finer pixels: a new generation);
  //        3) the bucket pulling the cartridges out; 4) Dad's "XMAS 82", still readable after 31 years.
  // TRACES: the landfill card burnt into the tube; countdown holds are unequal (0.9/0.8/0.9) with a tick squash;
  //         the cartridge clicks in with a shake; the old sticky note comes back with a two-stroke tick; bucket
  //         anticipation lift; hit-stop on the defeat; HP segments fall with gravity; a crumb falls in the hold.
  const COUNT = [[0.3, '9'], [1.2, '8'], [2.0, '7']];
  function continueScreen(t) {
    K.fill(C.VOID);
    HUD.ghostRect(() => HUD.bossCard({ t: 20, t0: 5.85, num: 3, name: 'THE LANDFILL', from: 'top', x: 40, y: 56, seed: 73, hp: { n: 10, value: 10, segW: 11 } }));
    const n = K.typed('CONTINUE?', t, 0.15, 88, 14);
    if (t < 3.08) F.score('CONTINUE?'.slice(0, n), 64, 150, 6, 5, C.CREAM);
    let d = null; let since = 0;
    COUNT.forEach((c) => { if (t >= c[0]) { d = c[1]; since = t - c[0]; } });
    if (d && t < 3.08) {
      const sq = since < 0.067 ? 0.8 : 1;
      const h = Math.round(60 * sq);
      const sh = K.shake(t, t - since, 2, 12, 800 + Number(d));
      F.score(d, 420 + sh.x, 132 + (60 - h) + sh.y, 14, Math.round(12 * sq), C.GOLD);
    }
  }
  // a new generation: the only thing in square 1x pixels (everything else is 2600 wide pixels).
  // Front view of a grey cartridge: label on the upper half, grip grooves below, notched top corners.
  function nesCart(x, y, sq) {
    const s = 1.35;
    const h = 100 * s * (sq || 1);
    const yy = y + 100 * s - h;
    const q = (rx, ry, rw, rh, c) => K.rect(Math.round(x + rx * s), Math.round(yy + ry * s * (sq || 1)), Math.round(rw * s), Math.max(1, Math.round(rh * s * (sq || 1))), c);
    q(0, 0, 88, 100, C.GREY);
    q(0, 0, 88, 1, C.CREAM);
    q(86, 0, 2, 100, C.GREY_D);
    q(0, 99, 88, 1, C.GREY_D);
    q(0, 0, 7, 8, C.VOID); q(81, 0, 7, 8, C.VOID);
    q(9, 6, 70, 46, C.CREAM);
    q(11, 8, 66, 30, C.BLUE);
    q(11, 30, 66, 8, C.AVOCADO);
    q(54, 12, 8, 8, C.GOLD);
    q(18, 22, 6, 8, C.ORANGE); q(17, 20, 8, 3, C.WALNUT);
    q(11, 41, 40, 5, C.WALNUT);
    for (let i = 0; i < 8; i++) q(5, 58 + i * 5, 78, 2, C.GREY_D);
  }
  function digDay(t, f) {
    TV.at(0, 0);
    TV.bands(0, 100, 160, [[0, C.BLUE], [44, C.AQUA], [86, C.CREAM]]);
    for (let b = 0; b < 40; b++) { const h = 2 + Math.floor(Math.abs(Math.sin(b * 0.7 + 1)) * 5 + K.hash(13, b, 1) * 2); TV.r(b * 4, 92 - h, 4, h, C.MAUVE); }
    TV.bands(0, 180, 160, [[90, C.TAN], [100, C.TEAK], [150, C.WALNUT]]);
    // mound + hole
    for (let y = 104; y < 130; y += 2) { const w = 40 - Math.abs(y - 112) * 1.2; TV.r(62 - w / 2, y, w, 2, y < 110 ? C.WALNUT : C.WALNUT_D); }
    // film crew: person + camera on a tripod, left edge (they are why the dig happened)
    TV.spr(['.##.', '####', '.##.', '####', '####', '.##.', '.##.', '#..#'], [C.WALNUT, C.TAN, C.TAN, C.TEAL, C.TEAL, C.TEAL_D, C.TEAL_D, C.VOID], 14, 88, { rowH: 2, stretch: 2 });
    TV.r(26, 94, 4, 3, C.GREY_D); TV.r(25, 95, 1, 1, C.VOID); TV.r(27, 97, 1, 7, C.GREY_D); TV.r(25, 103, 1, 1, C.GREY_D); TV.r(29, 103, 1, 1, C.GREY_D);
    // excavator: tracks, cab, boom, stick, bucket
    const ex = 104;
    TV.r(ex, 102, 40, 6, C.VOID); for (let i = 0; i < 9; i++) TV.r(ex + 1 + i * 4, 103, 2, 1, C.GREY_D);
    TV.r(ex + 6, 86, 28, 16, C.GOLD); TV.r(ex + 6, 86, 28, 1, C.CREAM); TV.r(ex + 20, 78, 14, 10, C.GOLD); TV.r(ex + 22, 80, 9, 5, C.TEAL_D);
    TV.r(ex + 6, 98, 28, 1, C.ORANGE);
    let lift = 0; let dig = 0;
    if (t < 5.35) lift = seg(t, 4.95, 5.35);
    else if (t < 5.6) { lift = 1 - ease.in(seg(t, 5.35, 5.6)) * 1.6; dig = 1; } else { lift = -0.6 + ease.out(seg(t, 5.6, 6.15)) * 1.5; dig = 1; }
    const bx = 74 + (dig ? -2 : 6); const by = 94 - lift * 22;
    // boom from cab to elbow, stick from elbow to bucket, drawn as stepped blocks
    const ebx = 98; const eby = 66 - lift * 10;
    stepLine(ex + 8, 88, ebx, eby, C.GOLD);
    stepLine(ebx, eby, bx + 4, by, C.GREY_D);
    TV.r(bx, by, 9, 6, C.GREY_D); TV.r(bx, by + 6, 2, 2, C.GREY_D); TV.r(bx + 4, by + 6, 2, 2, C.GREY_D); TV.r(bx + 7, by + 6, 2, 2, C.GREY_D);
    if (t >= 5.6) TV.r(bx + 1, by + 1, 7, 3, C.WALNUT);
    // cartridges spill from the bucket as it lifts
    // (riding on the bucket first, then tipping off one by one onto the spoil in front of the hole)
    const rest = [[40, 112], [52, 114], [64, 111], [76, 115]];
    [5.86, 6.02, 6.2, 6.34].forEach((s0, i) => {
      if (t < 5.6) return;
      if (t < s0) { if (i < 2) TV.cart(bx - 2 + i * 7, by - 12 + i, A.STRIPES[i + 1], { label: C.CREAM, scale: 2 }); return; }
      const k = Math.min(1, (t - s0) / 0.42);
      const x = K.lerp(bx - 2 + i * 6, rest[i][0], k);
      const y = Math.min(rest[i][1], K.lerp(by - 10, rest[i][1], k * k) - Math.sin(Math.PI * k) * 6);
      if (k < 1) A.tumbler(Math.round(x), Math.round(y), A.STRIPES[i + 1], f, i, 2, C.CREAM);
      else TV.cart(Math.round(x), Math.round(y), A.STRIPES[i + 1], { label: C.CREAM, scale: 2 });
    });
  }
  function stepLine(x0, y0, x1, y1, c) {
    const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 2));
    for (let i = 0; i <= n; i++) { const x = K.lerp(x0, x1, i / n); const y = K.lerp(y0, y1, i / n); TV.r(Math.round(x) - 1, Math.round(y), 3, 3, c); }
  }
  const SPILL_HITS = [5.86, 6.02, 6.2, 6.34];
  function shot8(t) {
    const f = K.frameOf(t);
    if (t < 3.08) {
      continueScreen(t);
      if (t >= 2.85) {
        const k = ease.in(seg(t, 2.85, 3.06));
        nesCart(410, Math.round(K.lerp(-150, 112, k)));
      }
      TV.crt(0, 0, 640, 360, t);
      return {};
    }
    if (t < 4.75) {
      K.fill(C.VOID);
      HUD.ghostRect(() => F.score('CONTINUE?', 64, 150, 6, 5, C.CREAM));
      const sh = K.shake(t, 3.08, 4, 10, 808);
      nesCart(410 + sh.x, 112 + sh.y, t < 3.15 ? 0.86 : 1);
      K.rect(396, 250, 150, 2, C.GREY_D);
      const n = K.typed('NES', t, 3.3, 89, 10);
      F.joy('NES'.slice(0, n), 410, 262, 2, C.CREAM);
      if (t < 3.12) K.remapRect(0, 0, 640, 360, K.SCAN.map((v, i) => (K.DARK[i] ? C.GREY_D : C.WHITE)));
      TV.crt(0, 0, 640, 360, t);
      HUD.note({ cx: 196, cy: 252, w: 230, h: 46, ang: -0.05, t0: 3.62, t, lines: ['QUALITY CONTROL'], seed: 71 + 17, tick: 3.95 });
      return {};
    }
    if (t < 7.05) {
      const hit = t >= 6.42 && t < 6.62;
      const tt = hit ? 6.42 : t;
      let sh = K.shake(tt, 5.48, 3, 9, 811);
      if (t >= 6.42) { const q = K.shake(t, 6.42, 6, 7, 812); sh = { x: sh.x + q.x, y: sh.y + q.y }; }
      TV.at(sh.x * 4, sh.y * 2);
      digDay(tt, f);
      TV.at(0, 0);
      const value = 10 - SPILL_HITS.filter((h) => tt >= h).length * 2.5;
      const gone = t >= 6.62 ? seg(t, 6.62, 7.0) + (t >= 7.0 ? 1 : 0) : 0;
      if (gone < 1) HUD.bossCard({ t: tt + 20, t0: 20, num: 3, name: 'THE LANDFILL', from: 'top', x: 40, y: 56, seed: 73, gone, hp: { n: 10, value: Math.max(0, value), segW: 11, broken: [] } });
      if (t >= 6.62) {
        // defeated: the bar's segments fall out of the HUD with gravity, unevenly
        for (let i = 0; i < 10; i++) {
          const d = t - 6.62 - K.hash(820, i, 1) * 0.12;
          if (d < 0) continue;
          K.rect(40 + i * 13 + d * (i - 5) * 12, 109 + d * d * 900, 11, 12, C.WALNUT_D);
        }
      }
      if (t >= 6.42 && t < 6.46) K.remapRect(0, 0, 640, 360, K.SCAN.map((v, i) => (K.DARK[i] ? C.CREAM : C.VOID)));
      TV.crt(0, 0, 640, 360, t);
      return {};
    }
    R.setCam(160, 90, 2);
    R.digCloseup(t, { buf: buf3, crumbT: 8.15 });
    return { hudDark: true };
  }

  film.draw[4] = shot5;
  film.draw[5] = shot6;
  film.draw[6] = shot7;
  film.draw[7] = shot8;
})();

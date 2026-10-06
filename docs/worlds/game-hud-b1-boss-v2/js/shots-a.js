/* B1 v2 shots 1, 2, 3 and 5 (v1 shots 1-4; the market moved to slot 5 after the new high-score table).
   Focal point + traces are written above each shot, before the code (QUALITY.md §9). */
'use strict';
(function () {
  const K = B1.core;
  const F = B1.fonts;
  const TV = B1.tv;
  const R = B1.room;
  const HUD = B1.hud;
  const T = B1.trans;
  const { C, seg, ease } = K;
  const film = B1.film;
  const S = film.S;
  const buf2 = K.newBuffer();
  const buf3 = K.newBuffer();
  const bufTv = K.newBuffer();

  // Shared: a cartridge tumbling (2-frame 2600 rotation: upright / sideways); k = NUSIZ-style scale
  const CART_SIDE = ['#######', '#.....#', '#.....#', '#.....#', '######.'];
  function tumbler(x, y, stripe, f, i, k, label) {
    const s = k || 1;
    if ((Math.floor(f / 3) + i) % 2 === 0) TV.cart(x, y, stripe, { label: label === undefined ? C.TAN : label, scale: s });
    else { TV.spr(CART_SIDE, C.GREY_D, x, y + s, { stretch: s, rowH: s }); TV.r(x + s, y + 2 * s, 5 * s, 2 * s, stripe); }
  }

  // Shared with shot 6: the flood of clone cartridges, stacked like bricks from the bottom; crest flickers.
  const STRIPES = [C.ORANGE, C.TEAL, C.AVOCADO, C.MAUVE, C.ORANGE, C.GOLD];
  function flood(level, t, seed) {
    const f = K.frameOf(t);
    const rows = Math.ceil(level / 7);
    for (let r = 0; r < rows; r++) {
      const y = 180 - (r + 1) * 7;
      const crest = r === rows - 1;
      const off = r % 2 ? 4 : 0;
      for (let c = -1; c < 21; c++) {
        const x = c * 8 + off + Math.round((K.hash(seed, r, c) - 0.5) * 2);
        let yy = y;
        if (crest) {
          const part = level - r * 7;
          if (K.hash(seed, r, c + 50) * 7 > part + 2) continue;
          yy = y + Math.round(Math.sin(c * 0.9 + t * 5) * 1.5);
          // 2600 flicker: more objects on the line than the console can draw
          if ((c + f) % 2 === 0) continue;
          tumbler(x, yy, STRIPES[Math.floor(K.hash(seed, r, c + 9) * 6)], f + c, c);
          continue;
        }
        TV.cart(x, yy, STRIPES[Math.floor(K.hash(seed, r, c + 9) * 6)], { label: r < rows - 3 ? C.TAN : C.CREAM });
      }
    }
  }

  // ============ SHOT 1 · hook (6.5 s) ============
  // FOCAL: the last cartridge - wobbling on the truck bed lip, then landing on top of the pile at the right third
  //        (the only lit label in the pit; the rest of the pile is dimmed).
  // TRACES: uneven release times; 2600 flicker when >2 carts in the air; the last cart wobbles before it falls
  //         (anticipation); landing hit-stop + squash + dust + decaying shake; truck chugs off in uneven steps; stars
  //         twinkle on their own cadences; the place name types irregularly. Still moment 3.75-4.3.
  const S1_REL = [0.22, 0.58, 0.81, 1.24, 1.4, 1.93, 2.12];
  const S1_PILE = [[92, 138], [105, 139], [118, 138], [131, 139], [144, 138], [99, 125], [125, 125]];
  const HERO = { lip: 2.35, drop: 3.3, land: 3.64, x: 112, y: 111 };
  const DIM = { [C.ORANGE]: C.RUST, [C.TEAL]: C.TEAL_D, [C.AVOCADO]: C.OLIVE_D, [C.MAUVE]: C.DUSK, [C.GOLD]: C.TEAK };
  function desert(t) {
    TV.bands(0, 80, 160, [[0, C.VOID], [14, C.TUBE], [42, C.NIGHT], [66, C.DUSK], [75, C.MAUVE]]);
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(K.hash(11, i, 1) * 150) + 4; const y = 18 + Math.floor(K.hash(11, i, 2) * 44);
      const on = K.hash(11, i, Math.floor(t * (0.8 + K.hash(11, i, 3) * 1.7) + i)) > 0.22;
      if (on) TV.r(x, y, 1, 1, i % 5 === 0 ? C.AQUA : y > 48 ? C.GREY : C.CREAM);
    }
    // the Sacramento range to the east: playfield blocks, uneven
    for (let b = 20; b < 40; b++) { const h = 3 + Math.floor(Math.abs(Math.sin(b * 1.3)) * 6 + K.hash(12, b, 1) * 3); TV.r(b * 4, 80 - h, 4, h, C.NIGHT); }
    TV.bands(0, 180, 160, [[80, C.TEAK], [82, C.WALNUT], [118, C.WALNUT_D], [122, C.WALNUT], [156, C.WALNUT_D]]);
    for (let i = 0; i < 9; i++) TV.r(4 + Math.floor(K.hash(14, i, 1) * 70), 92 + Math.floor(K.hash(14, i, 2) * 80), 3 + Math.floor(K.hash(14, i, 3) * 4), 1, i % 2 ? C.WALNUT_D : C.TEAK);
    // the pit: stepped left wall, the right side runs out of frame
    for (let y = 82; y < 154; y += 2) { const inset = Math.floor((y - 82) / 6) + (y > 120 ? 1 : 0); TV.r(84 + inset, y, 90, 2, y < 88 ? C.WALNUT_D : C.VOID); }
    TV.r(84, 81, 90, 1, C.WALNUT_D);
  }
  function truck(x, tilt, t) {
    TV.r(x, 92, 36, 2, C.GREY_D);
    [3, 24, 29].forEach((wx) => { TV.r(x + wx, 94, 4, 3, C.VOID); TV.r(x + wx + 1, 95, 2, 1, C.GREY_D); });
    TV.r(x, 82, 10, 10, C.ORANGE); TV.r(x + 1, 81, 8, 1, C.ORANGE); TV.r(x + 2, 84, 5, 3, C.NIGHT); TV.r(x + 6, 84, 1, 1, C.TAN);
    TV.r(x - 1, 89, 1, 2, C.GOLD);
    for (let i = 0; i < 12; i++) {
      const by = 85 - tilt * (11 - i) * 1.25;
      TV.r(x + 11 + i * 2, Math.round(by), 2, 6, i === 11 ? C.WALNUT : C.TEAK);
      TV.r(x + 11 + i * 2, Math.round(by), 2, 1, C.RUST);
    }
    // exhaust puffs at a held 6 fps cadence
    const pf = Math.floor(t * 6);
    if (pf % 3 !== 0) TV.r(x + 2 + (pf % 2), 77 - (pf % 3), 2, 2, C.GREY_D);
  }
  function shotHook(t) {
    const f = K.frameOf(t);
    if (t >= 5.4) { T.map(t - 5.4, 'back', t); return {}; }
    const hold = t >= HERO.land && t < HERO.land + 0.1;
    const tt = hold ? HERO.land : t;
    const sh = K.shake(t, HERO.land, 3, 8, 101);
    TV.at(sh.x * 2, sh.y * 2);
    desert(tt);
    const leave = seg(tt, 4.3, 5.4);
    const steps = Math.floor(leave * 7) + (leave > 0.6 ? 1 : 0);
    const tx = 50 - steps * 4 - (leave > 0 && Math.floor(tt * 10) % 3 === 0 ? 1 : 0);
    const tilt = tt < 4.0 ? 1 : 1 - seg(tt, 4.0, 4.3);
    // pile (dim: labels in shadow)
    S1_REL.forEach((r0, i) => {
      if (tt >= r0 + 0.5) TV.cart(S1_PILE[i][0], S1_PILE[i][1], DIM[STRIPES[i % 4]], { label: C.TEAK, scale: 2 });
    });
    // carts in the air (flicker when crowded)
    const air = S1_REL.filter((r0) => tt >= r0 && tt < r0 + 0.5).length;
    S1_REL.forEach((r0, i) => {
      if (tt < r0 || tt >= r0 + 0.5) return;
      if (air > 2 && (f + i) % 2 === 0) return;
      const k = (tt - r0) / 0.5;
      const x = K.lerp(82, S1_PILE[i][0], k);
      const y = 60 + (S1_PILE[i][1] - 60) * k * k - 8 * k * (1 - k);
      tumbler(Math.round(x), Math.round(y), STRIPES[i % 4], f, i, 2);
    });
    // hero cart: on the lip (wobbles), falls, lands lit
    if (tt >= HERO.lip && tt < HERO.drop) {
      const wob = [0, 1, 0, 0, 1, 1, 0][Math.floor((tt - HERO.lip) * 7) % 7];
      TV.cart(80 + wob, 52, C.ORANGE, { scale: 2, body: C.GREY });
    } else if (tt >= HERO.drop && tt < HERO.land) {
      const k = ease.in((tt - HERO.drop) / (HERO.land - HERO.drop));
      tumbler(Math.round(K.lerp(82, HERO.x, k)), Math.round(K.lerp(52, HERO.y, k)), C.ORANGE, f, 0, 2, C.CREAM);
    } else if (tt >= HERO.land) {
      const sq = t < HERO.land + 0.13 ? 0.7 : 1;
      if (sq < 1) TV.sprSquash(TV.CART, C.GREY, HERO.x, HERO.y, sq, { stretch: 2, rowH: 2 });
      else TV.cart(HERO.x, HERO.y, C.ORANGE, { scale: 2, body: C.GREY });
      const d = t - HERO.land;
      if (d > 0.05 && d < 0.5) {
        const s = Math.floor(d * 12);
        TV.r(HERO.x - 3 - s, HERO.y + 12 - (s > 1 ? 1 : 0), 2, 1, C.TEAK);
        TV.r(HERO.x + 13 + s, HERO.y + 12 - (s > 2 ? 1 : 0), 2, 1, C.TEAK);
      }
    }
    TV.at(sh.x * 2, sh.y * 2 - 34);
    truck(tx, tilt, tt);
    TV.at(0, 0);
    // place name under the year, typed with an irregular hand
    const n = K.typed('NEW MEXICO', t, 0.75, 7, 18);
    if (n > 0) F.joy('NEW MEXICO'.slice(0, n), 40, 42, 2, C.TAN);
    TV.crt(0, 0, 640, 360, t);
    return {};
  }

  // ============ SHOT 2 · A-roll, Christmas 1982 (8 s) ============
  // FOCAL: the missing gift - a dashed placeholder outline under the tree + Dad's tag "E.T. / XMAS 82".
  // TRACES: uneven wood planks + grain, bulbs blinking on their own cadences, a hand-drawn joystick cable, thumbprint
  //         on the TV glass, the tag drops and swings to rest, an unclosed pen circle around the 25th, asymmetric
  //         rabbit ears. Still moment 5.4-7.0 (only bulbs + attract mode).
  function shotXmas(t) {
    const u = 1.1 + t;
    if (u < 1.8) { T.map(u, 'back', t + 6.5); return {}; }
    const push = ease.inOut(seg(t, 7.1, 8.0));
    R.setCam(K.lerp(160, CAL_CAM[0], push), K.lerp(90, CAL_CAM[1], push), K.lerp(2, CAL_CAM[2], push));
    const blinkT = t - 4.3;
    R.livingRoom(t, {
      slot: seg(t, 2.3, 3.2),
      tag: seg(t, 3.45, 4.15),
      blink: blinkT > 0 && blinkT < 0.34 ? blinkT : undefined,
      circle: 1,
    });
    if (u < 2.3) {
      K.target(buf2); K.fill(C.VOID); T.map(u, 'back', t + 6.5); K.target();
      T.blinds(buf2, (u - 1.8) / 0.5, 24 * 4, 61);
    }
    return {};
  }

  // ============ SHOT 3 · C-roll, boss 1: THE DEADLINE (8.5 s) ============
  // FOCAL: the calendar boss's big page number (weeks left, the only accent besides its HP), then the sticky note.
  // OPINION: over the programmer's shoulder - he is a big dark back in the foreground, the calendar looms behind
  //          his terminal. Match cut from the room: the wall calendar becomes the boss at the same size and place.
  // TRACES: pages flip back in uneven beats; typing cadence speeds up and is uneven, elbows bob; torn pages
  //         flutter onto his desk; decaying shake per tear; hit-stop + sprite-flicker death; he slumps; the note is
  //         slapped on the glass, underlined twice, then struck out by hand. Still moment 6.7-7.0 and 7.3-8.1.
  // v2 tail (8.12-8.5): game over -> the console's attract mode cycles the picture's colours (replaces v1's roll).
  const CAL_CAM = [154.07, 47.2, 184 / 34];
  const CAL = { x: 96, y: 22, w: 46, h: 130 };
  const FLIPS = [[0.72, 0.12], [0.86, 0.1], [0.97, 0.08], [1.06, 0.11]];
  const TEARS = [3.15, 4.1, 4.82, 5.38, 5.8];
  const BACK = {
    rows: ['......####......', '....########....', '...##########...', '...##########...', '...##########...', '....########....', '.....######.....', '..############..', '.##############.', '################', '################', '################'],
    cols: [C.WALNUT_D, C.WALNUT_D, C.WALNUT_D, C.WALNUT_D, C.WALNUT_D, C.WALNUT_D, C.TAN, C.ORANGE, C.ORANGE, C.RUST, C.ORANGE, C.ORANGE],
  };
  function weeksLeft(t) { return 5 - TEARS.filter((x) => t >= x).length; }
  function bossPage(t) {
    const { x, y, w, h } = CAL;
    const left = weeksLeft(t);
    for (let i = 0; i < left; i++) TV.r(x + 1 + i, y + h + i * 0.5, w, 1, i % 2 ? C.TAN : C.TEAK);
    TV.r(x, y + 8, w, h - 8, C.CREAM);
    TV.r(x, y + 8, w, 12, C.RUST);
    F.joy('WEEKS LEFT', x * 4 + 12, (y + 11) * 2, 2, C.CREAM);
    F.score(String(left), x * 4 + 50, (y + 27) * 2, 20, 18, C.CRIMSON);
    for (let r = 0; r < 4; r++) {
      for (let d = 0; d < 7; d++) {
        TV.r(x + 3 + d * 6, y + 80 + r * 11, 4, 7, C.TAN);
        TV.r(x + 4 + d * 6, y + 81 + r * 11, 2, 5, C.CREAM);
      }
    }
  }
  function binding(alive) {
    const { x, y, w } = CAL;
    TV.r(x, y, w, 8, C.TEAK);
    TV.r(x, y + 7, w, 1, C.WALNUT);
    [3, 10, 18, 25, 33, 40].forEach((rx) => { TV.r(x + rx, y - 4, 2, 8, C.GREY); TV.r(x + rx, y + 3, 2, 1, C.VOID); });
    if (!alive) for (let i = 0; i < 9; i++) TV.r(x + 2 + i * 5 + (i % 2), y + 8, 2 + (i % 3 === 0 ? 1 : 0), 2 + (i % 2), C.CREAM);
  }
  function calendarBoss(t, f) {
    if (t < FLIPS[0][0]) { R.setCam(CAL_CAM[0], CAL_CAM[1], CAL_CAM[2]); R.calendar(166, 22, 1); return; }
    const dead = t >= 6.0;
    const sway = t > 1.3 && !dead && K.hash(39, Math.floor(t * 2.3), 1) > 0.62 ? 1 : 0;
    TV.at(0, sway * 2);
    if (dead && (t >= 6.62 || f % 2 === 0)) { binding(false); TV.at(0, 0); return; }
    // flipping back through the months, uneven beats; the last flip reveals the boss page
    let flipping = -1;
    FLIPS.forEach((fl, i) => { if (t >= fl[0] && t < fl[0] + fl[1]) flipping = i; });
    const past = FLIPS.filter((fl) => t >= fl[0] + fl[1]).length;
    if (past >= FLIPS.length) bossPage(t);
    else TV.r(CAL.x, CAL.y + 8, CAL.w, CAL.h - 8, C.CREAM);
    if (flipping >= 0) {
      const k = ease.in((t - FLIPS[flipping][0]) / FLIPS[flipping][1]);
      const bottom = K.lerp(CAL.y + CAL.h, CAL.y + 8, k);
      if (flipping === 0) {
        K.setClip(0, 0, 640, Math.round(bottom * 2));
        R.setCam(CAL_CAM[0], CAL_CAM[1], CAL_CAM[2]); R.calendar(166, 22, 1);
        K.setClip();
      } else TV.r(CAL.x, CAL.y + 8, CAL.w, Math.max(0, bottom - CAL.y - 8), C.CREAM);
      // the page's back, curling over the rings
      TV.r(CAL.x + 1, Math.round(bottom) - 2, CAL.w - 2, 2, C.TAN);
    }
    binding(true);
    TV.at(0, 0);
  }
  function tornPages(t) {
    TEARS.forEach((t0, i) => {
      const d = t - t0;
      if (d < 0) return;
      const k = Math.min(1, d / (0.62 + i * 0.07));
      const rest = [[78, 147], [84, 148], [80, 145], [88, 146], [76, 144]][i];
      const x = K.lerp(CAL.x + 8, rest[0], k) + Math.sin(d * 9 + i) * (1 - k) * 5;
      const y = K.lerp(CAL.y + 24, rest[1], ease.in(k));
      const flat = k >= 1 || Math.floor(d * 8 + i) % 2 === 0;
      if (flat) TV.r(Math.round(x), Math.round(y), 9, 2, i % 2 ? C.CREAM : C.TAN);
      else TV.r(Math.round(x) + 2, Math.round(y) - 3, 4, 6, C.CREAM);
    });
  }
  function programmer(t) {
    const x = 6; const y = 132;
    if (t >= 6.15) {
      // slumped: head drops forward, shoulders round
      TV.sprSquash(BACK.rows, BACK.cols, x, y + 4, 0.9, { stretch: 2, rowH: 4 });
      return;
    }
    const rate = 4 + seg(t, 1.5, 5.8) * 9;
    const kf = Math.floor(t * rate);
    const down = K.hash(77, kf, 1) > 0.45;
    const hard = down && K.hash(77, kf, 2) > 0.72;
    TV.sprSquash(BACK.rows, BACK.cols, x, y, hard ? 0.96 : 1, { stretch: 2, rowH: 4 });
    TV.r(x + 5, y + 14, 1, 3, C.TAN); TV.r(x + 26, y + 14, 1, 3, C.TAN);
    // elbows bob on keystrokes, not in sync
    TV.r(x - 2, y + 36 + (down ? 1 : 0), 3, 8, C.ORANGE);
    TV.r(x + 31, y + 36 + (K.hash(77, kf, 3) > 0.5 ? 1 : 0), 3, 8, C.ORANGE);
  }
  function shotDeadline(t) {
    const f = K.frameOf(t);
    const hit = t >= 5.8 && t < 5.94;
    const tt = hit ? 5.8 : t;
    const sh = { x: 0, y: 0 };
    TEARS.forEach((t0) => { const s = K.shake(tt, t0, 3, 10, 300 + Math.round(t0 * 10)); sh.x += s.x; sh.y += s.y; });
    TV.at(sh.x * 2, sh.y * 2);
    TV.bands(0, 152, 160, [[-200, C.VOID], [0, C.VOID], [12, C.TUBE], [72, C.NIGHT], [128, C.TUBE]]);
    // desk + monitor (behind him)
    TV.bands(0, 180, 160, [[150, C.TEAK], [152, C.WALNUT], [160, C.WALNUT_D]]);
    TV.r(44, 112, 30, 38, C.GREY); TV.r(44, 112, 30, 1, C.CREAM); TV.r(73, 112, 1, 38, C.GREY_D);
    TV.r(47, 116, 24, 26, C.TEAL_D);
    const lines = Math.min(11, Math.floor(Math.max(0, tt - 1.2) * 2.2));
    for (let i = 0; i < lines; i++) TV.r(49 + (i % 4 === 2 ? 2 : 0), 118 + i * 2, 3 + Math.floor(K.hash(66, i, 1) * 14), 1, C.AQUA);
    TV.r(56, 144, 8, 6, C.GREY_D);
    TV.at(sh.x * 2 + sh.x * 4, sh.y * 2);
    calendarBoss(tt, f);
    TV.at(sh.x * 2, sh.y * 2);
    tornPages(tt);
    programmer(tt);
    const gone = t >= 6.0 ? seg(t, 6.0, 6.62) + (t >= 6.62 ? 1 : 0) : 0;
    if (gone < 1 && t >= FLIPS[3][0]) {
      HUD.bossCard({
        t: tt, t0: 1.2, num: 1, name: 'THE DEADLINE', from: 'left', x: 40 + sh.x * 2, y: 52 + sh.y * 2, seed: 31, gone,
        hp: { n: 5, value: weeksLeft(tt), label: 'WEEKS', broken: TEARS, segW: 14 },
      });
    }
    if (hit) K.remapRect(0, 0, 640, 360, K.SCAN);
    if (t >= 5.8 && t < 5.84) K.remapRect(0, 0, 640, 360, K.SCAN.map((v, i) => (K.DARK[i] ? C.CREAM : C.VOID)));
    TV.at(0, 0);
    TV.crt(0, 0, 640, 360, t);
    T.attractCycle(t);
    HUD.note({ cx: 172, cy: 190, w: 168, h: 66, ang: -0.075, t0: 5.72, t, lines: ['WEAK POINT:', 'MORE TIME'], seed: 51, under: 1, strike: { line: 1, t0: 7.05 } });
    if (t < 0.62) {
      B1.renderShotInto(buf3, S.xmas, film.shots[S.xmas].dur - 1 / 30);
      T.scanWipe(buf3, t / 0.62);
    }
    return {};
  }

  // ============ SHOT 5 · B-roll, market inventory (7.5 s; v1 shot 4) ============
  // v2 head: the family TV still shows shot 4's attract screen (INSERT COIN) until the cartridge clicks in.
  // FOCAL: the GAMES grid filling faster and faster, then INVENTORY FULL (the only accent) and the spill.
  // TRACES: cartridge resists the slot then clicks (shake); Dad's tape label; panel draws in line by line at uneven
  //         speed; cursor overshoots and settles with uneven holds; names type with irregular cadence; cartridges
  //         land with a 2-frame drop; spill flickers (too many objects).
  const CONSOLES = [
    { name: 'ATARI 2600', hold: 0.56 }, { name: 'INTELLIVISION', hold: 0.42 }, { name: 'ODYSSEY²', hold: 0.34 },
    { name: 'COLECOVISION', hold: 0.47 }, { name: 'ATARI 5200', hold: 0.36 }, { name: 'VECTREX', hold: 0.55 },
  ];
  const ARRIVE = (() => { const out = []; let a = 4.45; for (let i = 0; i < 36; i++) { out.push(a); a += (0.25 * Math.pow(0.84, i) + 0.009) * (0.7 + K.hash(44, i, 1) * 0.6); } return out; })();
  function consoleIcon(i, sx, sy) {
    if (i === 0) { TV.r(sx + 2, sy + 9, 12, 4, C.VOID); TV.r(sx + 3, sy + 10, 4, 1, C.GREY_D); TV.r(sx + 8, sy + 9, 3, 1, C.GREY_D); TV.r(sx + 2, sy + 13, 12, 3, C.TEAK); }
    if (i === 1) { TV.r(sx + 1, sy + 11, 14, 4, C.TEAK); TV.r(sx + 1, sy + 11, 14, 1, C.GOLD); TV.r(sx + 10, sy + 8, 2, 3, C.GREY_D); TV.r(sx + 13, sy + 8, 2, 3, C.GREY_D); }
    if (i === 2) { TV.r(sx + 2, sy + 10, 12, 5, C.VOID); TV.r(sx + 3, sy + 12, 10, 1, C.GREY); TV.r(sx + 3, sy + 14, 10, 1, C.GREY_D); TV.r(sx + 2, sy + 10, 12, 1, C.GREY_D); }
    if (i === 3) { TV.r(sx + 1, sy + 10, 10, 5, C.VOID); TV.r(sx + 2, sy + 10, 8, 1, C.GREY_D); TV.r(sx + 12, sy + 8, 3, 7, C.GREY_D); TV.r(sx + 13, sy + 10, 1, 1, C.GREY); TV.r(sx + 13, sy + 12, 1, 1, C.GREY); }
    if (i === 4) { TV.r(sx + 1, sy + 9, 14, 6, C.GREY_D); TV.r(sx + 1, sy + 11, 14, 1, C.GREY); TV.r(sx + 2, sy + 9, 12, 1, C.VOID); }
    if (i === 5) { TV.r(sx + 5, sy + 2, 7, 14, C.GREY_D); TV.r(sx + 6, sy + 3, 5, 9, C.VOID); TV.r(sx + 7, sy + 9, 1, 1, C.AQUA); TV.r(sx + 8, sy + 7, 1, 1, C.AQUA); TV.r(sx + 9, sy + 5, 1, 1, C.AQUA); TV.r(sx + 5, sy + 13, 7, 1, C.GREY); }
  }
  function cursorSlot(t) {
    let a = 2.0;
    for (let i = 0; i < CONSOLES.length; i++) {
      const end = a + CONSOLES[i].hold + 0.1;
      if (t < end || i === CONSOLES.length - 1) return { i, since: t - a, prevI: Math.max(0, i - 1) };
      a = end;
    }
    return { i: 5, since: 9, prevI: 4 };
  }
  function inventory(t, f) {
    const draw = seg(t, 1.22, 1.62);
    TV.bands(0, 180, 160, [[0, C.TUBE], [168, C.NIGHT]]);
    const px0 = 12; const py0 = 28; const pw = 118; const ph = 128;
    TV.r(px0, py0, pw, ph, C.TEAK);
    TV.r(px0 + 1, py0 + 2, pw - 2, ph - 4, C.VOID);
    F.joy('MARKET 1983', 64, 72, 2, C.CREAM);
    F.joy('CONSOLES', 64, 100, 2, C.TAN);
    const cur = cursorSlot(t);
    const doneConsoles = t > 2.0 + CONSOLES.reduce((s, c) => s + c.hold + 0.1, 0);
    for (let i = 0; i < 6; i++) {
      const sx = 16 + i * 18 + (i === 3 ? 1 : 0); const sy = 58;
      TV.r(sx, sy, 16, 20, C.TEAL_D); TV.r(sx + 1, sy + 1, 14, 18, C.TEAL);
      consoleIcon(i, sx, sy);
      if (doneConsoles) TV.dr(sx, sy, 16, 20, C.TUBE, 0.5);
    }
    if (t >= 2.0 && !doneConsoles) {
      const k = Math.min(1, cur.since / 0.12);
      const e = ease.outBack(k);
      const fromX = 16 + cur.prevI * 18; const toX = 16 + cur.i * 18 + (cur.i === 3 ? 1 : 0);
      const cx = Math.round(K.lerp(fromX, toX, cur.i === 0 ? 1 : e));
      [[0, 0], [14, 0], [0, 18], [14, 18]].forEach((p) => { TV.r(cx - 1 + p[0], 57 + p[1], 3, 1, C.GOLD); TV.r(cx - 1 + p[0] + (p[0] ? 2 : 0), 57 + p[1] + (p[1] ? -1 : 0), 1, 2, C.GOLD); });
      const nm = CONSOLES[cur.i].name;
      const n = K.typed(nm, cur.since, 0.03, 90 + cur.i, 38);
      F.joy(nm.slice(0, n), 64, 166, 2, C.CREAM);
    }
    F.joy('GAMES', 64, 196, 2, t > 4.3 ? C.CREAM : C.TAN);
    ARRIVE.forEach((a, i) => {
      if (t < a) return;
      const c = i % 12; const r = Math.floor(i / 12);
      const drop = t - a < 0.067 ? -3 : 0;
      // stocked by hand: a unit off here and there, never a perfect grid
      const jx = K.hash(45, i, 2) > 0.8 ? 1 : 0; const jy = K.hash(45, i, 3) > 0.85 ? 1 : 0;
      TV.cart(16 + c * 9 + (r === 1 ? 1 : 0) + jx, 108 + r * 10 + drop + jy, STRIPES[Math.floor(K.hash(45, i, 1) * 6)]);
    });
    const full = ARRIVE[35] + 0.12;
    if (t > full) {
      const ft = t - full;
      const on = !(ft > 0.12 && ft < 0.2) && !(ft > 0.34 && ft < 0.4);
      if (on) F.joy('INVENTORY FULL', 64 + 216, 196, 2, C.CRIMSON);
    }
    // rows "draw in" top-down (the console builds the picture line by line)
    if (draw < 1) TV.r(0, Math.round(draw * 180), 160, 180, C.TUBE);
  }
  function shotMarket(t) {
    const f = K.frameOf(t);
    if (t < 1.0) {
      R.setCam(160, 90, 2);
      let cartY; let cartX; let grip = true; let handY;
      if (t < 0.42) { const k = ease.inOut(t / 0.42); cartY = K.lerp(-84, 40, k); cartX = K.lerp(12, 3, k); } else if (t < 0.6) { cartX = 3; cartY = 40 + [0, 1, 0, 1, 1, 0][Math.floor((t - 0.42) * 30) % 6]; } else if (t < 0.7) { const k = ease.in((t - 0.6) / 0.1); cartX = 3 - 3 * k; cartY = 40 + 24 * k; } else { cartX = 0; cartY = 64; }
      if (t > 0.78) { grip = false; handY = 64 - ease.inOut(seg(t, 0.78, 1.0)) * 90; }
      const sh = K.shake(t, 0.7, 3, 9, 404);
      R.cam.ox += sh.x; R.cam.oy += sh.y;
      const before = t <= 0.7;
      if (before) T.renderScene(bufTv, S.scores, film.shots[S.scores].dur + t);
      R.consoleCloseup(t, { cartY, cartX, grip, squeeze: t > 0.6 && t < 0.72, handY: grip ? undefined : handY, handX: 0, tv: before ? 'image' : t < 0.95 ? 'garbage' : 'attract', tvImage: bufTv });
      return {};
    }
    if (t < 1.22) { TV.garbage(0, 0, 640, 360, f, 47); TV.crt(0, 0, 640, 360, t); return {}; }
    TV.at(0, 0);
    // the spill (tail): flood begins from the bottom, panel flickers
    const spill = seg(t, 6.55, 7.5);
    inventory(t, f);
    if (spill > 0) {
      const n = Math.floor(spill * 14);
      for (let i = 0; i < n; i++) {
        const d = t - (6.55 + i * 0.065);
        if (d < 0) continue;
        const x = 120 + K.hash(46, i, 1) * 34 - i * 2;
        const y = 116 + d * d * 260;
        if (y < 175 && (f + i) % 2) tumbler(Math.round(x), Math.round(y), STRIPES[i % 6], f, i);
      }
      flood(spill * 22, t, 7);
    }
    TV.crt(0, 0, 640, 360, t);
    return {};
  }

  film.draw[S.hook] = shotHook;
  film.draw[S.xmas] = shotXmas;
  film.draw[S.deadline] = shotDeadline;
  film.draw[S.market] = shotMarket;
  B1.art = { flood, tumbler, STRIPES, CART_SIDE };
})();

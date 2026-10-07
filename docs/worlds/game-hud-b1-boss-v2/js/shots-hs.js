/* B1 v2 shot 4 · ATTRACT MODE: the high-score table. The deadline is beaten, the game is over, the console idles in
   attract mode and prints the story's facts as a score table, ranked by order of events (score = the year).
   Contract (see trans.js): film.scene[film.S.scores] = function (t) -> {}; pure in t, valid for t in [0, dur + 0.7].
   trans.js owns the head (0-0.55 s draw-in) and the tail (last 0.62 s pull-back into the room).

   FOCAL POINT: the #1 row's score "1982" - the only gold on screen, the biggest type, on the left third.
   HUMAN TRACES:
   1. Grease-pencil ring on the TV glass around 1982 (one loop that overshoots its start and spirals out) and
      "BOOM!" written beside it in Dad's hand - drawn on the glass, so it sits above the scanlines.
   2. A greasy thumbprint on the glass under the ring, left by the hand that drew it (appears with the ring).
   3. Burn-in: "INSERT COIN" is burned into the phosphor from years of attract mode (shows during blink-off).
   4. Timing with feel: rows print at uneven times (0.32 / 0.43 s gaps) with 2600 flicker, then a held beat of
      silence on the empty #1 slot before the score slams in (anticipation -> overshoot -> settle).
   5. Initials entered the arcade way: each slot scrolls through letters with an irregular cadence, then the new
      entry blinks with uneven holds. One row (3RD) sits a 2600 unit off the grid (HMOVE nudge). */
'use strict';
(function () {
  const K = B1.core;
  const F = B1.fonts;
  const TV = B1.tv;
  const HUD = B1.hud;
  const { C } = K;
  const film = B1.film;

  const SEED = K.sid('b1v2-scores');
  const LEFT = 60; // table's left margin (px); the right half of the screen stays empty on purpose
  const INIT_X = 104; // initials column
  const SCORE_X = 182; // score column
  const HERO_BASE = 132; // bottom edge of the #1 score digits
  const COIN = { x: 64, y: 266, str: 'INSERT COIN' };

  // Ranked by order of events; only the first one has happened yet, the rest are locked like the map's '?' node.
  const ROWS = [
    { rank: '2ND', who: '???', year: '1983', y: 160, dx: 0, at: 0.8, c: C.GREY },
    { rank: '3RD', who: '???', year: '1985', y: 183, dx: 4, at: 1.12, c: C.GREY_D },
    { rank: '4TH', who: '???', year: '2014', y: 207, dx: 0, at: 1.55, c: C.GREY_D },
  ];
  const T_SLAM = 2.78; // 1982 lands (narration "1982 was a boom year" starts at 2.7)
  const T_INIT = 3.08; // initials entry starts
  const T_RING = 3.95; // grease-pencil ring on the glass
  const T_BOOM = 4.42; // "BOOM!" beside it
  const T_COIN = 5.15; // INSERT COIN blinks (narration "Insert coin." at 5.2)

  // 2600 flicker while a row is being printed: alternate frames for a short, per-row length.
  function printing(t, at, i) {
    if (t < at) return false;
    const d = t - at;
    const len = 0.17 + K.hash(SEED, i, 1) * 0.12;
    return d > len || K.frameOf(t) % 2 === 0;
  }

  // Arcade initials entry: every slot scrolls through its letters with an irregular cadence.
  const SCROLL = [['A', 'B', 'C', 'D', 'E'], ['A', '.'], ['A', '.', 'Z', 'Y', 'X', 'W', 'V', 'U', 'T']];
  const SLOT_START = [0, 0.21, 0.31];
  function initialsAt(t) {
    let out = '';
    for (let s = 0; s < 3; s++) {
      const t0 = T_INIT + SLOT_START[s] + (s === 2 ? 0.08 : 0);
      if (t < t0) break;
      let at = t0;
      let ch = SCROLL[s][0];
      for (let k = 1; k < SCROLL[s].length; k++) {
        at += (1 + (K.hash(SEED, s * 16 + k, 2) < 0.35 ? 1 : 0)) / 30;
        if (t >= at) ch = SCROLL[s][k];
      }
      out += ch;
    }
    return out;
  }
  // The new entry blinks with uneven holds, then settles (all done before the ring is drawn).
  const BLINK = [[3.62, 3.7], [3.79, 3.86], [3.98, 4.04]];
  function entryHidden(t) { return BLINK.some((b) => t >= b[0] && t < b[1]); }

  function heroRow(t) {
    F.joy('1ST', LEFT, HERO_BASE - 12, 2, C.GREY);
    if (t < T_SLAM - 0.12) {
      F.joy('----', SCORE_X, HERO_BASE - 12, 2, C.GREY_D);
      return;
    }
    if (t < T_SLAM) return; // the beat of silence: the slot empties before the score lands
    const d = t - T_SLAM;
    const cw = d < 0.067 ? 12 : d < 0.134 ? 9 : 10;
    const ch = d < 0.067 ? 7 : d < 0.134 ? 5 : 6;
    const sh = K.shake(t, T_SLAM + 0.07, 3, 11, SEED + 3);
    F.score('1982', SCORE_X + sh.x, HERO_BASE - 5 * ch + sh.y, cw, ch, C.GOLD);
    const ini = initialsAt(t);
    if (ini && !entryHidden(t)) F.joy(ini, INIT_X, HERO_BASE - 18, 3, C.CREAM);
  }

  function lockedRows(t) {
    ROWS.forEach((r, i) => {
      if (!printing(t, r.at, i)) return;
      F.joy(r.rank, LEFT + r.dx, r.y, 2, r.c);
      F.joy(r.who, INIT_X + r.dx, r.y, 2, r.c);
      F.joy(r.year, SCORE_X + r.dx, r.y, 2, r.c);
    });
  }

  function insertCoin(t) {
    // the burn-in ghost is always there; the live text blinks like a machine (linear, regular)
    HUD.ghostRect(() => F.joy(COIN.str, COIN.x, COIN.y, 2, C.CREAM));
    if (t >= T_COIN && (t - T_COIN) % 0.6 < 0.38) F.joy(COIN.str, COIN.x, COIN.y, 2, C.CREAM);
  }

  // --- on the glass (after the CRT pass) ---
  // One loop that starts at the lower left, goes round clockwise and overshoots, spiralling a little outward.
  // The radius wanders on two seeded harmonics (an egg, not an ellipse); the pen starts light and ends in a flick.
  function ring(t) {
    const k = K.ease.inOut(K.clamp01((t - T_RING) / 0.42));
    if (k <= 0) return;
    const cx = 279; const cy = 116; const rx = 112; const ry = 30; const tilt = -0.045;
    const a0 = 2.6; const turns = 1.12;
    const h1 = K.hash(SEED, 1, 9) * 6.28; const h2 = K.hash(SEED, 2, 9) * 6.28;
    const co = Math.cos(tilt); const si = Math.sin(tilt);
    const n = 72;
    const lim = Math.ceil(n * k);
    let prev = null;
    for (let i = 0; i <= lim; i++) {
      const u = i / n;
      const a = a0 + u * turns * Math.PI * 2;
      const wob = 1 + 0.045 * Math.sin(a * 2 + h1) + 0.03 * Math.sin(a * 3 + h2) + u * 0.085;
      const lx = Math.cos(a) * rx * wob + u * 7; const ly = Math.sin(a) * ry * wob - u * 4;
      const p = [cx + lx * co - ly * si, cy + lx * si + ly * co];
      if (prev) K.line(prev[0], prev[1], p[0], p[1], C.WHITE, u < 0.07 ? 1 : 2);
      prev = p;
    }
    // the flick where the pen leaves the glass
    if (k >= 1) K.line(prev[0], prev[1], prev[0] + 7, prev[1] + 3, C.WHITE, 1);
  }
  function boom(t) {
    const k = K.clamp01((t - T_BOOM) / 0.48);
    if (k <= 0) return;
    F.hand('BOOM!', { x: 402, y: 72, size: 3, angle: -0.11, seed: SEED + 21, c: C.WHITE, brush: 2, slant: 0.24, reveal: k });
  }
  // A thumbprint: ridges as elliptical rings with a slight swirl, lifting the dark glass one step, dithered.
  function thumbprint(cx, cy) {
    const rx = 11; const ry = 14; const ang = 0.5;
    const co = Math.cos(ang); const si = Math.sin(ang);
    const fb = K.fb;
    for (let y = cy - 16; y <= cy + 16; y++) {
      for (let x = cx - 16; x <= cx + 16; x++) {
        const dx = x - cx; const dy = y - cy;
        const u = (dx * co + dy * si) / rx; const v = (-dx * si + dy * co) / ry;
        const d = Math.hypot(u, v);
        if (d >= 1) continue;
        const ridge = (d * 6.5 + 0.2 * Math.sin(Math.atan2(v, u) * 2)) % 1;
        if (ridge < 0.5 && K.dith(x, y, 0.95 - d * 0.5)) fb[y * K.W + x] = K.GHOST[fb[y * K.W + x]];
      }
    }
  }

  function scoresScene(t) {
    TV.at(0, 0);
    TV.bands(0, 180, 160, [[0, C.TUBE], [152, C.NIGHT], [168, C.TUBE]]);
    insertCoin(t);
    F.joy('HIGH SCORES', LEFT, 66, 2, C.TEAL);
    heroRow(t);
    lockedRows(t);
    TV.crt(0, 0, 640, 360, t);
    if (t >= T_RING + 0.2) thumbprint(386, 150); // left by the hand that drew the ring
    ring(t);
    boom(t);
    return {};
  }

  film.scene[film.S.scores] = scoresScene;
})();

/* The v1 score sheet in v1 film time T (0..66 s): shots, narration, HUD events, hand choreography. All lookups are pure in T.
   The v2 global timeline (G, with the two inserted scenes) is mapped onto T in film.js. */
'use strict';
(function () {
  const RF = window.RF, E = RF.ease, seg = RF.seg;
  RF.V1_SHOTS = [
    { t0: 0, t1: 7.5, title: 'Hook', role: 'hook', note: 'Dark corridor, one bulb. In its light: desert sand on the floor and a cartridge corner. The chalk tally on the wall counts to five.' },
    { t0: 7.5, t1: 16, title: 'The deadline', role: 'A', note: 'Office, 1982. The calendar close-up: days crossed at a quickening pace, then the bracket - about five weeks.' },
    { t0: 16, t1: 24, title: 'The warehouse', role: 'A', note: 'Racking stencilled E.T. into the fog. One tube flickers. You take one cartridge off the shelf.' },
    { t0: 24, t1: 31, title: 'Quest log', role: 'B', note: 'Paused game: the quest log names the real chapters; the inventory holds the facts picked up so far.' },
    { t0: 31, t1: 39, title: 'The clone aisle', role: 'C', note: 'The aisle narrows, fog and noise rise, MARKET starts to drain. One held look at the clones, then the squeeze.' },
    { t0: 39, t1: 48, title: 'Returns desk', role: 'B', note: 'The boss is a conversation you cannot win: every option but one is crossed out, and the UNSOLD bar only fills.' },
    { t0: 48, t1: 56.5, title: 'Alamogordo, 1983', role: 'A→C', note: 'Out the back door into the night. Look down into the pit and let go of the cartridge.' },
    { t0: 56.5, t1: 66, title: 'The dig, 2014', role: 'payoff', note: 'Fog of 31 years. Dawn, an excavator where the truck was, a film crew. You pick the same cartridge out of the dirt.' },
  ];
  RF.V1_DURATION = 66;

  // narration = the dialogue boxes (caps on screen, sentence case in the dev caption)
  const L = (t0, t1, text, speaker, say) => ({ t0: t0, t1: t1, text: text, speaker: speaker || '', say: say });
  RF.LINES = [
    L(1.2, 4.4, '1983. ATARI BURIED ITS\nUNSOLD GAMES IN THE DESERT.', '', '1983. Atari buried its unsold games in the desert.'),
    L(5.85, 7.95, 'THIS IS HOW\nTHEY GOT THERE.', '', 'This is how they got there.'),
    L(9.85, 12.15, '1982. ATARI WANTS E.T.\nON SHELVES FOR CHRISTMAS.', 'CALENDAR', '1982. Atari wants E.T. on shelves for Christmas.'),
    L(12.3, 14.4, 'THE PROGRAMMER GETS\nABOUT FIVE WEEKS.', 'CALENDAR', 'The programmer gets about five weeks.'),
    L(17.9, 22.9, 'ATARI BETS ON A HIT\nAND FILLS THE WAREHOUSE.', '', 'Atari bets on a hit and fills the warehouse.'),
    L(32.3, 35.5, 'BUT STORES ARE ALREADY\nDROWNING IN GAMES.', '', 'But stores are already drowning in games.'),
    L(36.35, 38.75, 'CHEAP CLONES.\nTOO MANY OF THEM.', '', 'Cheap clones. Too many of them.'),
    L(41.0, 43.15, 'E.T. SELLS POORLY.\nSTORES SEND IT BACK.', 'CLERK', 'E.T. sells poorly. Stores send it back.'),
    L(45.95, 48.05, 'BY 1983, THE WHOLE\nMARKET IS CRASHING.', 'CLERK', 'By 1983, the whole market is crashing.'),
    L(49.4, 53.25, 'ATARI TRUCKS ITS UNSOLD STOCK\nTO ALAMOGORDO, NEW MEXICO.', '', 'Atari trucks its unsold stock to Alamogordo, New Mexico.'),
    L(54.5, 56.1, 'AND BURIES IT.', '', 'And buries it.'),
    L(57.15, 59.65, "1985: NINTENDO'S NES\nBRINGS THE MARKET BACK.", '', "1985: Nintendo's NES brings the market back."),
    L(60.0, 62.85, '2014: A FILM CREW\nDIGS HERE AND FINDS THEM.', '', '2014: a film crew digs here and finds them.'),
  ];
  RF.LINES.forEach((l, i) => (l.times = RF.typeTimes(l.text, 500 + i * 17, l.t0 + 0.16, 0.036)));
  RF.MENU_SAY = 'The quest: sell E.T. for Christmas.';
  RF.v1CaptionAt = function (t) {
    if (t >= 24 && t < 31) return RF.MENU_SAY;
    let best = null;
    RF.LINES.forEach((l) => { if (t >= l.t0 - 0.2) best = l; });
    const shot = RF.v1ShotAt(t);
    return best && best.t0 >= RF.V1_SHOTS[shot].t0 - 0.3 ? best.say : '';
  };
  RF.v1ShotAt = (t) => { for (let i = RF.V1_SHOTS.length - 1; i >= 0; i--) if (t >= RF.V1_SHOTS[i].t0) return i; return 0; };

  RF.TOASTS = [
    { t0: 2.9, t1: 5.6, head: 'NEW QUEST', body: 'HOW THEY GOT THERE' },
    { t0: 14.0, t1: 16.9, head: '+ ITEM', body: 'DEADLINE: ~5 WEEKS' },
    { t0: 20.35, t1: 23.3, head: '+ ITEM', body: 'E.T. CARTRIDGE' },
    { t0: 51.7, t1: 54.9, head: 'QUEST UPDATED', body: 'ALAMOGORDO, NM' },
  ];
  RF.TOASTS.forEach((o, i) => (o.times = RF.typeTimes(o.body, 900 + i, o.t0 + 0.2, 0.03)));
  RF.LOCS = [
    [0.5, '1983', ''], [8.0, '1982', 'THE OFFICE'], [16.9, '1982', 'THE WAREHOUSE'], [31.9, '1982', 'TOY STORE'],
    [39.7, '1983', 'RETURNS'], [49.0, '1983', 'ALAMOGORDO, NM'], [56.95, '1985', ''], [59.95, '2014', 'ALAMOGORDO, NM'],
  ];
  RF.locAt = function (t) {
    let i = -1;
    RF.LOCS.forEach((l, k) => { if (t >= l[0]) i = k; });
    return i;
  };
  // where the compass marker points (next door / thing to look at)
  RF.TARGETS = [[0, 13.5, 20.5], [7.5, 18.5, 15.5], [14.3, 22.5, 20.5], [16, 28.5, 18.5], [21, 40.5, 20.5], [31, 55.5, 20.5], [39, 60.5, 16.5], [47.2, 65.5, 20.5], [48, 77.5, 20.5], [56.5, 74.85, 20.45]];
  RF.targetAt = (t) => { let r = RF.TARGETS[0]; RF.TARGETS.forEach((k) => { if (t >= k[0]) r = k; }); return r; };

  // MARKET (the only health bar: the industry is the thing in danger)
  const MK = [[31.8, 12], [34.4, 12], [35.2, 10], [37.0, 9], [38.6, 7], [46.4, 7], [47.6, 3], [54.5, 3], [54.9, 1], [57.9, 1], [59.6, 12]];
  RF.marketAt = function (t) {
    if (t < MK[0][0]) return -1;
    for (let i = 1; i < MK.length; i++) if (t < MK[i][0]) return MK[i - 1][1] + (MK[i][1] - MK[i - 1][1]) * E.inOut(seg(t, MK[i - 1][0], MK[i][0]));
    return 12;
  };
  RF.STATUS = [{ t0: 14.15, t1: 31.0, label: 'RUSHED', icon: 'hourglass' }, { t0: 34.6, t1: 39.4, label: 'FLOODED', icon: 'waves' }];

  // ---------------- hand ----------------
  RF.GRAB_T = 61.7;
  const REST = { x: 214, y: 98 };
  RF.handAt = function (t, cam) {
    const bx = cam.bobX, by = cam.bobY;
    const rest = (spr) => ({ spr: spr, x: REST.x + bx, y: REST.y + by, s: 1 });
    if (t < 19.25 || (t >= 54.1 && t < 60.8)) return null;
    if (t < 20.15) {
      const u = E.out(seg(t, 19.25, 20.15));
      return { spr: 'handOpen', x: RF.lerp(232, 118, u), y: RF.lerp(182, 54, u) + Math.sin(u * Math.PI) * 6, s: RF.lerp(1, 0.78, u) };
    }
    if (t < 20.95) {
      const u = E.outBack(seg(t, 20.15, 20.95));
      return { spr: 'handHold', x: RF.lerp(104, REST.x, u) + bx, y: RF.lerp(40, REST.y, u) + by, s: 1 };
    }
    if (t >= 43.3 && t < 45.95) {
      const dip = seg(t, 43.3, 43.42) * (1 - seg(t, 43.42, 43.55)) * 5;
      const u = E.outBack(seg(t, 43.42, 43.8)) * (1 - E.inOut(seg(t, 45.4, 45.95)));
      return { spr: 'handHold', x: RF.lerp(REST.x, 112, u) + bx, y: RF.lerp(REST.y, 72, u) + dip + by, s: 1 };
    }
    if (t >= 53.0 && t < 53.4) {
      const u = E.out(seg(t, 53.0, 53.4));
      return { spr: 'handHold', x: REST.x - 8 * u, y: REST.y - 14 * u, s: 1 };
    }
    if (t >= 53.4 && t < 54.1) {
      const u = E.in(seg(t, 53.5, 54.1));
      return { spr: 'handOpen', x: REST.x - 6, y: REST.y - 18 + u * 110, s: 0.95 };
    }
    if (t >= 60.8 && t < RF.GRAB_T) {
      const tgt = RF.project(cam, RF.FIND.x, RF.FIND.y, 0.06);
      const u = E.out(seg(t, 60.8, RF.GRAB_T));
      return { spr: 'handOpen', x: RF.lerp(236, tgt.x - 22, u), y: RF.lerp(184, tgt.y - 30, u), s: RF.lerp(1, 0.86, u) };
    }
    if (t >= RF.GRAB_T && t < 62.95) {
      const tgt = RF.project(cam, RF.FIND.x, RF.FIND.y, 0.06);
      const u = E.inOut(seg(t, RF.GRAB_T, 62.95));
      return { spr: 'handHoldDirty', x: RF.lerp(tgt.x - 30, REST.x, u) + bx, y: RF.lerp(tgt.y - 40, REST.y, u) + by, s: 1 };
    }
    return rest(t >= 60 ? 'handHoldDirty' : 'handHold');
  };

  // the dropped cartridge, as a world sprite
  const DROP = { t0: 53.4, t1: 54.25, sx: 75.0, sy: 20.6, sz: 0.36, lx: 76.6, ly: 20.78, lz: -0.12 };
  RF.dynamicSprites = function (t) {
    const out = [];
    if (t < DROP.t0 || t >= RF.MAP.ERA_SWAP) return out;
    const u = seg(t, DROP.t0, DROP.t1);
    const z = DROP.sz + 0.15 * u - (DROP.sz - DROP.lz + 0.15) * u * u;
    const frame = u < 1 ? Math.floor(u * 9) % 8 : 6;
    out.push({ spr: RF.SPR['fall' + frame], x: RF.lerp(DROP.sx, DROP.lx, u), y: RF.lerp(DROP.sy, DROP.ly, u), z: z, w: 0.2, h: 0.23 });
    const dk = Math.floor((t - DROP.t1) * 8.5);
    if (t >= DROP.t1 && dk < 3) out.push({ spr: RF.DUST[dk], x: DROP.lx, y: DROP.ly + 0.05, z: DROP.lz - 0.03, w: 0.7, h: 0.28 });
    return out;
  };
  // 1983 -> 2014 is a fog interlude: it holds through the 1985 line and clears as '2014' is typed
  RF.fogBoost = (t) => E.inOut(seg(t, 55.9, 56.85)) * (1 - E.sine(seg(t, 59.85, 61.0)));
  RF.shakeAt = function (t) {
    let s = 0;
    [[45.05, 2.2], [54.25, 1.2]].forEach(([t0, a]) => { if (t > t0) s += a * Math.exp(-(t - t0) * 9) * Math.sin((t - t0) * 70); });
    return s;
  };
  RF.clerkFrame = function (t) {
    if ((t > 43.95 && t < 44.3) || (t > 44.75 && t < 45.1)) return Math.floor(t * 14) % 2 ? 'clerkNo' : 'clerkNo2';
    for (const l of [RF.LINES[7], RF.LINES[8]]) {
      const n = RF.typedCount(l.times, t);
      if (t > l.t0 && n < l.times.length && n > 0 && t - l.times[n - 1] < 0.06) return 'clerk1';
    }
    return 'clerk0';
  };
  // noise rises with the crowd, drops dead for the held look (35.95-36.65), then swamps the squeeze
  RF.storeNoise = (t) => 0.1 * E.inOut(seg(t, 34.0, 35.8)) * (1 - seg(t, 35.85, 35.95)) + 0.2 * E.in(seg(t, 36.65, 38.6)) * (1 - seg(t, 38.8, 38.95));
})();

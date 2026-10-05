/* detective-board 2a - the ONE persistent wall: every item, every string, every mark, in one world
 * coordinate system, each with the global time at which it appears. Nothing is ever removed except the
 * card that is torn off in shot 6 (it falls; its tape and the dangling string stay). */
(function () {
  'use strict';
  const D2 = window.D2;
  const { C, E, seg, memo, art, labelTape, typeText, handText, handTimes, handReveal, sticky } = D2;
  const deg = (d) => (d * Math.PI) / 180;

  /** Photo with a caption on its bottom border: typed (TYPE) or written (HAND, marker weight). */
  function captioned(key, base, text, mode, seed) {
    return memo('cap:' + key, () => {
      const s = D2.copy(base());
      const y = s.h - (mode === 'hand2' ? 3 : 12);
      if (mode === 'type') typeText(s, text, Math.round((s.w - D2.typeWidth(text)) / 2) + 2, y, C.INK, seed);
      else handText(s, text, 9, y, C.INK, seed, { scale: 2, slant: 0.2, rise: -0.02 });
      return s;
    });
  }
  /** Written-on sticky / card: reveal quantised to quarter letters so sprites can be memoised. */
  const q = (r) => Math.round(r * 4) / 4;
  function writing(text, t0, seed, cps) {
    const times = handTimes(text, t0, seed, cps);
    return (t) => q(handReveal(times, t, t0));
  }

  // ---------- writing schedules (global seconds) ----------
  const W = {
    alias: writing('alias?', 11.15, 201, 7.5),
    bomb: writing('bomb?', 18.45, 202, 8),
    cleared: writing('cleared', 42.95, 203, 8.5),
    y1980: writing('1980', 50.85, 204, 5.5),
    survived: writing('survived?', 35.0, 205, 13),
    died: writing('died in the jump?', 35.55, 206, 16),
    river: writing('the river?', 36.45, 207, 13),
  };

  // ---------- wall items (x, y = centre in wall px; a = radians) ----------
  // pins: sprite-local points; tapes: [lx, ly, length, angle]; lift: shadow distance factor
  const ITEMS = [
    { id: 'composite', x: 1270, y: 360, a: deg(-1.5), sprite: () => art.composite(), pins: [[50, 5], [90, 7], [4, 34], [3, 92], [9, 122]], tapes: [[6, 4, 16, deg(-38)]], lift: 1.2 },
    { id: 'neverLabel', x: 1262, y: 428, a: deg(1.8), sprite: () => labelTape('NEVER IDENTIFIED', 301), pins: [], land: 3.85, from: [26, -38], lift: 0.6 },
    { id: 'dbc', x: 1420, y: 318, a: deg(4), sprite: (t) => art.dbcCard(D2.E.outQuad(seg(t, 43.95, 44.35)), W.cleared(t)), pins: [[10, 6]], tapes: [[80, 4, 13, deg(40)]], lift: 1 },
    { id: 'ticket', x: 600, y: 706, a: deg(-3), sprite: (t) => art.ticket(Math.round(D2.clamp((t - 12.6) / 0.5, 0, 1) * 10) / 10), pins: [[10, 7], [114, 9]], tapes: [[4, 50, 14, deg(-50)]], lift: 1 },
    { id: 'alias', x: 652, y: 742, a: deg(7), sprite: (t) => aliasSticky(W.alias(t)), pins: [], land: 10.8, from: [30, 24], lift: 0.7 },
    { id: 'nov24', x: 586, y: 659, a: deg(1.2), sprite: () => labelTape('NOV 24 1971', 302), pins: [], lift: 0.5 },
    { id: 'portland', x: 612, y: 822, a: deg(-1.5), sprite: () => labelTape('PORTLAND', 303), pins: [], lift: 0.5 },
    { id: 'plane', x: 470, y: 612, a: deg(2), sprite: () => captioned('plane', art.planePhoto, 'FLIGHT 305', 'type', 304), pins: [[58, 6], [110, 82]], tapes: [[6, 6, 15, deg(-42)]], lift: 1.1 },
    { id: 'cash', x: 790, y: 425, a: deg(3), sprite: () => captioned('cash', art.cashPhoto, '$200,000', 'hand2', 305), pins: [[60, 5], [114, 46], [8, 70]], tapes: [[114, 98, 15, deg(-40)]], lift: 1.1 },
    { id: 'para', x: 925, y: 494, a: deg(-4), sprite: () => art.paraCard(), pins: [[8, 8], [88, 6]], lift: 1 },
    { id: 'briefcase', x: 690, y: 352, a: deg(-6), sprite: (t) => art.briefcaseCard(W.bomb(t)), pins: [[76, 8], [6, 6]], lift: 1 },
    { id: 'seattle', x: 812, y: 160, a: deg(-2), sprite: () => labelTape('SEATTLE', 306), pins: [], lift: 0.5 },
    { id: 'refuel', x: 735, y: 215, a: deg(-2), sprite: () => captioned('refuel', art.refuelPhoto, 'SEATTLE - REFUEL', 'type', 307), pins: [[56, 5], [20, 76]], tapes: [[106, 6, 14, deg(40)]], lift: 1.1 },
    { id: 'passengers', x: 868, y: 236, a: deg(5), sprite: (t) => passengersCard(Math.round(D2.clamp((t - 21.2) / 0.42, 0, 1) * 10) / 10), pins: [[8, 6]], lift: 1 },
    { id: 'zone', x: 960, y: 640, a: 0, sprite: null, pins: [[0, 0]], land: 32.05 },
    { id: 'stair', x: 1092, y: 560, a: deg(2.5), sprite: () => captioned('stair', art.stairPhoto, 'REAR STAIRS', 'type', 308), pins: [[8, 8], [104, 7]], land: 34.2, from: [40, -20], lift: 1.1 },
    { id: 'survived', x: 1088, y: 722, a: deg(-5), sprite: (t) => theoryCard('survived?', 209, 84, 36, W.survived(t)), pins: [[8, 7], [76, 30]], land: 34.85, from: [24, 30], lift: 1 },
    { id: 'died', x: 892, y: 748, a: deg(3.5), sprite: (t) => theoryCard('died in the jump?', 210, 106, 36, W.died(t)), pins: [[98, 7]], land: 35.4, from: [-30, 26], lift: 1 },
    { id: 'theRiver', x: 790, y: 676, a: deg(-3), sprite: (t) => theoryCard('the river?', 211, 82, 36, W.river(t)), pins: [[74, 7]], land: 36.3, from: [-34, 18], lift: 1 },
    { id: 'river', x: 410, y: 766, a: deg(-2.5), sprite: () => art.riverPhoto(), pins: [[57, 5], [104, 10], [96, 76]], tapes: [[4, 80, 14, deg(30)]], lift: 1.1 },
    { id: 'money', x: 292, y: 700, a: deg(5), sprite: () => art.moneyCard(), pins: [[70, 7], [8, 6]], lift: 1 },
    { id: 'y1980', x: 474, y: 690, a: deg(-6), sprite: (t) => sticky1980(W.y1980(t)), pins: [], land: 50.55, from: [-30, -26], lift: 0.8 },
    { id: 'columbia', x: 384, y: 711, a: deg(1), sprite: () => labelTape('COLUMBIA RIVER', 309), pins: [], lift: 0.5 },
  ];


  function passengersCard(tickK) {
    return memo('passengers:' + tickK, () => {
      const s = D2.copy(art.handCard('passengers|released', 208, 78, 46, {}));
      if (tickK > 0) D2.tick(s, 60, 32, 12, tickK, C.INK, 209);
      return s;
    });
  }
  function aliasSticky(reveal) {
    return memo('alias:' + reveal, () => {
      const s = D2.copy(sticky(46, 34, 220));
      handText(s, 'alias?', 6, 21, C.INK, 221, { slant: 0.3, rise: -0.04, reveal });
      if (reveal >= 6) D2.underline(s, 6, 36, 24, 1, C.INK, 222, 1);
      return s;
    });
  }
  function sticky1980(reveal) {
    return memo('1980:' + reveal, () => {
      const s = D2.copy(sticky(50, 36, 230));
      handText(s, '1980', 7, 26, C.INK, 231, { slant: 0.2, rise: -0.03, scale: 2, reveal });
      return s;
    });
  }
  function theoryCard(text, seed, w, h, reveal) {
    return memo('theory:' + text + ':' + reveal, () => {
      const s = art.indexCard(w, h, seed, {});
      handText(s, text, 6, 22, C.INK, seed + 1, { slant: 0.28, rise: -0.035, reveal });
      return s;
    });
  }

  // ---------- desk items (u = wall x, v = depth) ----------
  const DESK_ITEMS = {
    file: { u: 690, v: 150, a: 0, pins: [[30, 28]] },
    map: { u: 795, v: 148, a: deg(2.5), pins: [[96, 26], [100, 152]] },
    stub: { u: 930, v: 214, a: deg(9) },
  };

  // ---------- strings: a/b = anchors; tL = laying starts, tH = hooked (twang); sag = rest sag ratio ----------
  // anchor: {i: itemId, p: pinIndex} on the wall, {d: deskItemId, p} on the desk
  const STRINGS = [
    { id: 's1', a: { i: 'composite', p: 2 }, b: { i: 'ticket', p: 1 }, pre: 5.55, tL: 6.55, tH: 8.6, sag: 0.09, lay: 0.16 },
    { id: 's2', a: { i: 'ticket', p: 0 }, b: { i: 'plane', p: 1 }, tL: 9.55, tH: 10.2, sag: 0.1, lay: 0.22 },
    { id: 's3', a: { i: 'plane', p: 0 }, b: { i: 'cash', p: 2 }, tL: 14.5, tH: 16.0, sag: 0.05, lay: 0.15 },
    { id: 's4', a: { i: 'cash', p: 1 }, b: { i: 'para', p: 0 }, tL: 16.75, tH: 17.2, sag: 0.12, lay: 0.22 },
    { id: 's5', a: { i: 'briefcase', p: 0 }, b: { i: 'cash', p: 0 }, tL: 17.7, tH: 18.15, sag: 0.14, lay: 0.2 },
    { id: 's6', a: { i: 'cash', p: 0 }, b: { i: 'refuel', p: 1 }, tL: 19.2, tH: 20.45, sag: 0.04, lay: 0.15 },
    { id: 's7', a: { i: 'refuel', p: 0 }, b: { d: 'map', p: 0 }, tL: 23.0, tH: 25.3, sag: 0.05, lay: 0.12 },
    { id: 's8', a: { d: 'map', p: 1 }, b: { i: 'zone', p: 0 }, tL: 30.5, tH: 32.0, sag: 0.04, lay: 0.12 },
    { id: 's9', a: { i: 'zone', p: 0 }, b: { i: 'stair', p: 0 }, tL: 34.25, tH: 34.6, sag: 0.09, lay: 0.2 },
    { id: 's10', a: { i: 'zone', p: 0 }, b: { i: 'survived', p: 0 }, tL: 34.9, tH: 35.3, sag: 0.07, lay: 0.18 },
    { id: 's11', a: { i: 'zone', p: 0 }, b: { i: 'died', p: 0 }, tL: 35.45, tH: 35.95, sag: 0.13, lay: 0.2 },
    { id: 's12', a: { i: 'zone', p: 0 }, b: { i: 'theRiver', p: 0 }, tL: 36.35, tH: 36.95, sag: 0.1, lay: 0.2 },
    { id: 's13', a: { i: 'survived', p: 1 }, b: { i: 'composite', p: 3 }, tL: 39.5, tH: 40.9, sag: 0.06, lay: 0.16 },
    { id: 's14', a: { i: 'composite', p: 1 }, b: { i: 'dbc', p: 0 }, tL: 42.0, tH: 42.55, sag: 0.1, lay: 0.2, taut: [43.95, 44.6], snap: 44.62 },
    { id: 's15', a: { i: 'composite', p: 2 }, b: { i: 'river', p: 1 }, tL: 47.5, tH: 49.85, sag: 0.03, lay: 0.13 },
    { id: 's16', a: { i: 'river', p: 0 }, b: { i: 'money', p: 0 }, tL: 51.75, tH: 52.3, sag: 0.12, lay: 0.2 },
    { id: 's17', a: { i: 'river', p: 1 }, b: { i: 'theRiver', p: 0 }, tL: 52.85, tH: 54.1, sag: 0.09, lay: 0.24 },
    { id: 's18', a: { i: 'river', p: 2 }, b: { d: 'file', p: 0 }, tL: 55.0, tH: 56.5, sag: 0.05, lay: 0.12 },
    { id: 's19', a: { d: 'file', p: 0 }, b: { i: 'composite', p: 4 }, tL: 58.7, tH: 61.55, sag: 0.012, lay: 0.1 },
  ];


  // ---------- shots on the global timeline ----------
  const SHOTS = [
    { id: 1, name: 'hook', t0: 0, t1: 6.5, cap: 'In 1971 a man hijacked a jet, jumped out with $200,000, and was never identified.', note: 'Dark room. Only the swinging bulb finds the face; the label slaps on; a pin and a red string go in.' },
    { id: 2, name: 'A - ticket', t0: 6.5, t1: 14.5, cap: 'The day before Thanksgiving, a man in a dark suit buys a ticket as Dan Cooper. Portland to Seattle, flight 305.', note: 'The desk lamp clicks on; the camera follows the first string across the wall to the ticket.' },
    { id: 3, name: 'A - demand', t0: 14.5, t1: 23.0, cap: 'Mid-flight he claims a bomb. He wants $200,000 and four parachutes. In Seattle he gets them, and lets the passengers go.', note: 'North along the string = the flight. Demand cluster, then up to Seattle.' },
    { id: 4, name: 'B - desk', t0: 23.0, t1: 30.5, cap: 'Then he orders the crew back into the air, heading south for Mexico City.', note: 'The longest string runs off the wall and down to the desk: route map, ticket stub, magnifier.' },
    { id: 5, name: 'B - the jump', t0: 30.5, t1: 39.5, cap: 'Somewhere over the Northwest, in the dark, he lowers the rear stairs and jumps. Where he landed is anyone\'s guess.', note: 'Back up to the wall: the zone is circled, theories fan out from one pin.' },
    { id: 6, name: 'C - wrong man', t0: 39.5, t1: 47.5, cap: 'Investigators check a man named D. B. Cooper. Wrong man. But the press keeps the name.', note: 'The bulb is knocked; one string is pulled taut and tears the card off the wall.' },
    { id: 7, name: 'turn - 1980', t0: 47.5, t1: 55.0, cap: 'Then, in 1980, a boy on the bank of the Columbia River finds about $5,800 of the ransom.', note: 'The quiet thread. The longest crossing of the wall, then a slow string.' },
    { id: 8, name: 'payoff - 2016', t0: 55.0, t1: 64.0, cap: 'In 2016 the FBI suspends the active investigation. Every string still leads to a man with no name.', note: 'Stamp on the file, then the last string pulls the camera back to the whole wall.' },
  ];
  const DURATION = 64.0;

  Object.assign(D2, { world: { ITEMS, DESK_ITEMS, STRINGS, SHOTS, DURATION, W, deg } });
})();

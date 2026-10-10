// Grim Ink person (kit-ext/people/you.js): "You", the lunar module pilot of the C-CAM Apollo 11
// film (docs/concepts/c-cam-style/films/03-apollo-11/js/cast/you.js), ported to the people module
// contract. A gangly worrier swimming in a pressure suit a size too big: narrow sloped shoulders
// inside wide suit shoulders, a long neck poking out of the steel neck ring. Long oval face, weak
// chin, big unequal worried eyes, a long thin nose with a bump, an overbite with one snaggle tooth,
// a mole with a hair, a shaving nick under a scrap of plaster, double bags. Comm cap worn crooked.
// Suit: grubby off-white, stains, hose connectors on the chest, a mustard name tape.
// Shot props (p): sweat, helmet (1 clear, 2 gold visor), helmetDy, checklist (page 0..1; the pose
// holds it: hL [42, sy + 150, 112], hR [-42, sy + 150, 112], kL / kR 'grip').
const T = {
  skin: '#b4a17a',
  skinD: '#8a7954',
  suit: '#a8a28a',
  suitD: '#7f7a64',
  glove: '#9f9a84',
  gloveD: '#76725f',
  boot: '#8d8874',
  bootD: '#66624f',
  stone: '#7d7766',
  stoneD: '#5d584a',
  hoseBlue: '#526068',
  hoseRust: '#5f2c1c',
  tape: '#735f26',
  capSide: '#a49d82',
  capSideD: '#7e7862',
  capTop: '#5a4736',
  capTopD: '#3f3125',
  cup: '#2a2623',
  brow: '#5d4e30',
  noseL: '#c6b38c',
  mole: '#7f6a4a',
  plaster: '#c0b089',
  nick: '#5f2c1c',
};
const S = 110;
const NECK = [
  [0, -566, 0, -616],
  [8, -564, 16, -612],
  [16, -560, 36, -606],
  [0, -566, 0, -616],
];
const RING = [0, 12, 26, 0];
// prettier-ignore
const SUITS = [
  [-30, -588, -78, -576, -100, -540, -100, -490, -88, -440, -80, -400, -86, -350, -60, -322, 0, -316, 60, -322, 86, -350, 80, -400, 88, -440, 100, -490, 100, -540, 78, -576, 30, -588],
  [-20, -590, -74, -578, -96, -540, -96, -490, -86, -440, -78, -400, -82, -350, -56, -322, 10, -316, 64, -322, 84, -352, 80, -400, 88, -446, 92, -500, 84, -546, 60, -580, 22, -592],
  [-6, -594, -44, -582, -62, -540, -60, -480, -52, -430, -50, -380, -54, -340, -34, -322, 40, -320, 58, -344, 62, -394, 70, -450, 72, -510, 58, -562, 30, -590],
  [-30, -588, -80, -576, -102, -540, -102, -490, -90, -440, -82, -400, -88, -350, -60, -322, 0, -318, 60, -322, 88, -350, 82, -400, 90, -440, 102, -490, 102, -540, 80, -576, 30, -588],
];
// prettier-ignore
const BELT = [[-82, -404, 0, -394, 82, -404], [-78, -404, 12, -394, 82, -402], [-50, -400, 20, -394, 62, -398], [-84, -404, 0, -396, 84, -404]];
// prettier-ignore
const FACE = { lw: 7, shade: [T.skinD, -14, 8], mottle: ['rgba(150,110,60,0.3)', 6, 8], hatch: { c: 'rgba(60,50,30,0.35)', n: 3, len: 16, gap: 5, k: 3, ang: 75 } };
// prettier-ignore
const CAP = { lw: 6, shade: [T.capSideD, -6, 6], hatch: { c: 'rgba(40,34,20,0.45)', n: 4, len: 18, gap: 5, k: 3, ang: 80 } };
const NOSE = { lw: 6, shade: [T.skinD, -5, 4], patch: [T.noseL, 3, -8, 0.3] };
const STRAP = { w: 5, color: T.capTopD, taper: false };
const PORES = 'rgba(140,80,40,0.5)';
// prettier-ignore
const SWEAT = [[[-2, -114], [-40, -62], [40, -56]], [[16, -116], [-30, -62], [54, -52]], [[30, -114], [8, -60]], []];
const HELMET = [
  [2, -70],
  [10, -70],
  [16, -70],
  [0, -70],
];

export const person = {
  id: 'you',
  name: 'You (lunar module pilot)',
  D: {
    sw: 56,
    sy: -548,
    sz: 6,
    l1a: 118,
    l2a: 112,
    hw: 30,
    hy: -340,
    l1l: 170,
    l2l: 152,
    elbowOut: 0.7,
    top: -800,
    waist: [70, -404],
    hsz: 40,
    head: { x: [0, 18, 40, 0], top: -800, bottom: -585, hw: 70 },
  },
  neck: NECK,
  headScale: 1.1,
  seed: S,
  tones: T,
  arm: {
    cloth: T.suit,
    clothD: T.suitD,
    w: [50, 44, 38],
    skin: T.glove,
    skinD: T.gloveD,
    hsz: 40,
    lw: 7,
    cuff: T.stone,
    hatch: { c: 'rgba(40,36,24,0.45)', n: 3, len: 24, gap: 6, k: 3, ang: 30 },
  },
  leg: {
    cloth: T.suit,
    clothD: T.suitD,
    w: [54, 46, 40],
    shoe: T.boot,
    shoeD: T.bootD,
    len: 76,
    sw: 36,
    lw: 7,
    splay: 0.3,
    hatch: { c: 'rgba(60,50,30,0.4)', n: 3, len: 30, gap: 6, k: 3, ang: 70 },
  },
  defaultExpr: 'scared',
  signatureGag: { kind: 'sweat', note: 'sweats through every crisis, the brow first' },
  // prettier-ignore
  faceAnchors: [
    { chin: [0, 6], cheek: [30, -40], nose: [4, -56], mouth: [2, -24], ear: [56, -78], forehead: [0, -120] },
    { chin: [8, 6], cheek: [40, -40], nose: [36, -56], mouth: [28, -24], ear: [-48, -78], forehead: [6, -120] },
    { chin: [26, 2], cheek: [22, -40], nose: [58, -54], mouth: [38, -26], ear: [-22, -76], forehead: [0, -120] },
    { ear: [56, -78] },
  ],
  drawNeck(g, ink, view, n) {
    // The film's long neck: a three-point tube (the bend at the unjolted midpoint), Adam's apple.
    const b = NECK[view];
    // prettier-ignore
    ink.tube([n[0], n[1] + 4, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, n[2], n[3] + 14], [34, 28, 30], T.skin, { lw: 6, seed: S + 51, shade: [T.skinD, -6, 0] });
    // prettier-ignore
    if (view < 3) ink.brushStroke([b[2] + view * 5, b[3] + 24, b[2] + 8 + view * 5, b[3] + 30, b[2] + 2 + view * 5, b[3] + 36], { w: 4, seed: S + 52 });
  },
  torso(g, ink, view) {
    suit(ink, view);
    // prettier-ignore
    ink.blob(ink.ellipseRing(RING[view], -584, view === 2 ? 30 : 44, 12, 12), T.stone, { lw: 6, seed: S + 18, shade: [T.stoneD, 0, 4] });
  },
  head(g, ink, view, face, p) {
    if (view === 0) headFront(ink, face);
    else if (view === 1) head34(ink, face);
    else if (view === 2) headProfile(ink, face);
    else headBack(ink);
    if (p.sweat) ink.sweat(SWEAT[view], p.t, S + 53);
    // prettier-ignore
    if (p.helmet) ink.helmet(HELMET[view][0], HELMET[view][1] + (p.helmetDy || 0), 96, 104, { visor: p.helmet === 2, vx: [0, 14, 26, 0][view], seed: S + 54 });
  },
  // The flight checklist held open between the hands (pose: both hands in front of the chest).
  beforeHand(g, ink, J, view, p) {
    if (p.checklist === undefined || view === 3) return;
    const x = (J.aL.h[0] + J.aR.h[0]) / 2;
    ink.checklist(x, (J.aL.h[1] + J.aR.h[1]) / 2 + 30, 170, p.checklist, S + 60);
  },
};

// prettier-ignore
function suit(ink, v) {
  ink.blob(SUITS[v], T.suit, { lw: 8, seed: S + v, shade: [T.suitD, -22, 8], mottle: ['rgba(90,80,50,0.28)', 6, 18], hatch: { c: 'rgba(40,36,24,0.5)', n: 9, len: 40, gap: 7, k: 3, ang: -55 } });
  ink.brushStroke(BELT[v], { w: 7, color: T.suitD, seed: S + 5, taper: false });
  if (v === 3) {
    ink.brushStroke([0, -580, 4, -480, -2, -340], { w: 4.5, seed: S + 6 });
    ink.stain(30, -460, 50, 40, S + 7, 'rgba(60,50,30,0.3)');
    return;
  }
  const x = [0, 18, 46][v];
  const k = [1, 0.8, 0.4][v];
  ink.brushStroke([x - 4, -578, x + 2, -480, x - 2, -404], { w: 4, seed: S + 8 }); // closure seam
  [[-34, -486, T.hoseBlue], [-16, -470, T.hoseRust], [16, -470, T.hoseBlue], [34, -486, T.hoseRust]].forEach(([dx, y, col], i) => {
    if (v === 2 && i < 2) return;
    ink.blob(ink.ellipseRing(x + dx * k, y, 9 * (v === 2 ? 0.6 : 1), 9, 8), col, { lw: 4, seed: S + 10 + i, light: ['rgba(230,220,190,0.3)', 2, -2] });
  });
  if (v < 2) ink.rect(x - 70 * k, -540, 38 * k, 22, T.tape, { seed: S + 15, lw: 3, amp: 1 }); // name tape
  ink.stain(x + 30 * k, -430, 40, 30, S + 16, 'rgba(70,58,30,0.3)');
  if (v === 2) ink.brushStroke([-40, -520, -48, -440, -40, -380], { w: 3.5, seed: S + 17 });
}

// Comm cap: linen side strips, brown crown, ear cups; dx = the crooked tilt of the cups.
// prettier-ignore
function cap(ink, side, top, cups, dx) {
  ink.blob(side, T.capSide, { seed: S + 20, ...CAP });
  ink.blob(top, T.capTop, { lw: 6, seed: S + 21, shade: [T.capTopD, -8, 6], hatch: { c: 'rgba(20,12,6,0.5)', n: 3, len: 20, gap: 5, k: 3, ang: 20 } });
  cups.forEach(([x, y, r], i) => ink.blob(ink.ellipseRing(x + dx, y, r * 0.75, r, 9), T.cup, { lw: 5, seed: S + 22 + i, light: ['rgba(200,190,160,0.25)', 3, -3] }));
}

// Big unequal worried eyes.
// prettier-ignore
function eyes(ink, f, a, b) {
  ink.eye(a[0], a[1], 14 * a[2], 17, f, { skin: T.skin, seed: S + 24, lw: 5, side: 0, bags: 2 });
  ink.brow(a[0], a[1] - 26, 30 * a[2], -1, f, { u: 18, thick: 9, color: T.brow, seed: S + 25 });
  if (!b) return;
  ink.eye(b[0], b[1], 12 * b[2], 15, f, { skin: T.skin, seed: S + 26, lw: 5, side: 1, bags: 2 });
  ink.brow(b[0], b[1] - 24, 28 * b[2], 1, f, { u: 18, thick: 9, color: T.brow, seed: S + 27 });
}

// Shaving nick under a scrap of plaster.
// prettier-ignore
function nick(ink, x, y) {
  ink.rough([x - 8, y - 6, x + 8, y - 8, x + 9, y + 5, x - 7, y + 6], T.plaster, { seed: S + 28, lw: 3, amp: 1 });
  ink.brushStroke([x - 4, y - 2, x + 4, y + 2], { w: 2.5, color: T.nick, seed: S + 29 });
}

// prettier-ignore
function headFront(ink, f) {
  const jaw = f.jaw * 16;
  ink.blob([-40, -16 + jaw, -46, -60, -48, -104, -40, -140, -10, -156, 22, -154, 44, -138, 48, -104, 46, -60, 38, -16 + jaw, 18, 6 + jaw, 0, 12 + jaw, -20, 6 + jaw], T.skin, { seed: S + 30, ...FACE });
  cap(ink, [-50, -36, -58, -100, -50, -146, -16, -170, 22, -170, 54, -148, 60, -100, 54, -36, 42, -36, 46, -100, 32, -118, 0, -124, -32, -116, -42, -100, -40, -36], [-46, -126, -38, -154, -12, -174, 24, -174, 52, -150, 56, -128, 20, -136, -20, -134], [[-56, -78, 22], [58, -80, 22]], -2);
  ink.brushStroke([-44, -36, -26, -2 + jaw, 0, 4 + jaw, 28, -2 + jaw, 46, -36], { ...STRAP, seed: S + 31 }); // chin strap
  ink.pores(-38, -66, 22, 14, 6, S + 32, PORES); // stubble pores
  eyes(ink, f, [-19, -86, 1.08], [21, -88, 0.95]);
  ink.mouth(2, -24, 34, f, { open: 28, teeth: 'snag', seed: S + 33, lw: 5 });
  ink.blob([-6, -80, 6, -82, 10, -62, 16, -44, 6, -36, -8, -38, -10, -50], T.skin, { seed: S + 34, ...NOSE });
  ink.brushStroke([4, -66, 10, -62], { w: 3, seed: S + 35 }); // the bump
  ink.wart(-28, -44, 3.5, T.mole, S + 36, true);
  nick(ink, 24, -30);
}

// prettier-ignore
function head34(ink, f) {
  const jaw = f.jaw * 16;
  ink.blob([-34, -14 + jaw, -44, -60, -46, -104, -36, -142, -4, -158, 30, -152, 52, -132, 56, -104, 52, -84, 60, -62, 54, -16 + jaw, 34, 6 + jaw, 8, 12 + jaw, -14, 4 + jaw], T.skin, { seed: S + 37, ...FACE });
  cap(ink, [-44, -36, -54, -100, -44, -148, -10, -172, 28, -170, 56, -146, 58, -112, 46, -116, 30, -124, -2, -124, -26, -114, -34, -96, -30, -36], [-40, -128, -32, -156, -4, -176, 30, -172, 56, -148, 58, -128, 24, -136, -14, -134], [[-46, -78, 22]], -2);
  ink.brushStroke([-34, -36, -14, -2 + jaw, 20, 6 + jaw], { ...STRAP, seed: S + 38 });
  ink.pores(-24, -66, 22, 14, 6, S + 39, PORES);
  eyes(ink, f, [-1, -86, 1.08], [42, -88, 0.62]);
  ink.mouth(28, -24, 30, f, { open: 26, teeth: 'snag', seed: S + 40, lw: 5 });
  ink.blob([24, -80, 34, -80, 44, -60, 52, -44, 42, -36, 28, -38, 22, -52], T.skin, { seed: S + 41, ...NOSE });
  ink.wart(-12, -44, 3.5, T.mole, S + 42, true);
}

// prettier-ignore
function headProfile(ink, f) {
  const jaw = f.jaw * 16;
  ink.blob([-30, -8, -52, -44, -58, -100, -44, -140, -8, -158, 26, -150, 44, -126, 48, -104, 46, -90, 52, -74, 50, -58, 44, -46, 48, -30, 40, -12 + jaw, 26, 2 + jaw, 4, 10 + jaw, -14, 0], T.skin, { seed: S + 43, ...FACE });
  cap(ink, [-30, -20, -62, -60, -64, -120, -40, -164, 0, -176, 34, -164, 46, -128, 30, -120, 6, -118, -10, -96, -6, -20], [-50, -130, -34, -166, 0, -178, 34, -166, 48, -132, 10, -132, -20, -124], [[-22, -76, 22]], 0);
  ink.brushStroke([-8, -30, 8, 2 + jaw, 30, 6 + jaw], { ...STRAP, seed: S + 44 });
  eyes(ink, f, [30, -86, 0.72], null);
  ink.mouth(38, -26, 16, f, { open: 22, teeth: 'snag', seed: S + 45, lw: 5 });
  ink.blob([42, -84, 54, -78, 64, -56, 70, -42, 56, -38, 46, -44], T.skin, { seed: S + 46, ...NOSE });
  ink.brushStroke([56, -66, 62, -62], { w: 3, seed: S + 47 });
  nick(ink, 16, -24);
}

// prettier-ignore
function headBack(ink) {
  ink.blob([-38, -8, -46, -56, -48, -104, -38, -140, -10, -158, 22, -156, 44, -138, 48, -104, 46, -56, 38, -8, 0, 2], T.skin, { seed: S + 48, ...FACE });
  cap(ink, [-52, -30, -60, -100, -50, -148, -14, -172, 22, -172, 54, -148, 60, -100, 52, -30, 0, -20], [-46, -126, -38, -154, -12, -174, 24, -174, 52, -150, 56, -126, 0, -132], [[-56, -78, 22], [58, -80, 22]], 2);
  ink.brushStroke([-12, -18, -10, 8], { w: 3.5, seed: S + 49 });
  ink.brushStroke([12, -18, 10, 8], { w: 3.5, seed: S + 50 });
}

// Grim Ink person (kit-ext/people/commander.js): "The Commander" of the C-CAM Apollo 11 film
// (docs/concepts/c-cam-style/films/03-apollo-11/js/cast/commander.js), ported to the people module
// contract. A test pilot's wardrobe: wide square shoulders, no waist, short thick legs, a neck as
// wide as his head. Block head, heavy square jaw with a cleft and an old stitched scar, a flattened
// boxer's nose, small heavy-lidded eyes under one straight low brow line, crow's feet, deep cheek
// lines, a dark five o'clock shadow. Comm cap worn tight and straight. Off-white pressure suit,
// cleaner than yours, a mustard name tape, grey-blue hose connectors, a steel neck ring.
// Shot props (p): chew (the mouth shifts on twos with a cheek bulge), bubble (0..1, a gum bubble
// at the lips), helmet (1 clear bubble, 2 gold visor down).
const T = {
  skin: '#b07a62',
  skinD: '#86533f',
  suit: '#aba58f',
  suitD: '#817b66',
  glove: '#9f9a84',
  gloveD: '#76725f',
  boot: '#8d8874',
  bootD: '#66624f',
  stone: '#7d7766',
  stoneD: '#5d584a',
  hose: '#526068',
  tape: '#9b8236',
  strap: '#3f3125',
  capSide: '#a59e84',
  capSideD: '#7e7862',
  capTopD: '#2c2219',
  cup: '#2a2623',
  brow: '#2e241c',
  nose: '#c08a6e',
  scar: '#6a3a2a',
};
const S = 310;
const NECK = [
  [0, -570, 0, -612],
  [8, -568, 14, -610],
  [14, -564, 30, -604],
  [0, -570, 0, -612],
];
const RING = [0, 12, 24, 0];
// prettier-ignore
const SUITS = [
  [-34, -590, -96, -582, -118, -548, -114, -490, -104, -440, -100, -400, -102, -350, -70, -322, 0, -318, 70, -322, 102, -350, 100, -400, 104, -440, 114, -490, 118, -548, 96, -582, 34, -590],
  [-24, -592, -92, -584, -114, -548, -110, -490, -100, -440, -96, -400, -98, -350, -64, -322, 12, -318, 74, -322, 96, -352, 94, -404, 98, -450, 102, -504, 94, -552, 70, -584, 26, -594],
  [-8, -596, -54, -586, -72, -546, -68, -480, -60, -420, -60, -370, -62, -338, -40, -322, 46, -320, 66, -344, 70, -400, 76, -456, 78, -516, 64, -566, 34, -592],
  [-34, -590, -98, -582, -120, -548, -116, -490, -106, -440, -102, -400, -104, -350, -70, -322, 0, -320, 70, -322, 104, -350, 102, -400, 106, -440, 116, -490, 120, -548, 98, -582, 34, -590],
];
// prettier-ignore
const BELT = [[-100, -404, 0, -396, 100, -404], [-96, -404, 14, -396, 96, -402], [-60, -400, 24, -394, 70, -398], [-102, -404, 0, -398, 102, -404]];
// prettier-ignore
const FACE = { lw: 7, shade: [T.skinD, -16, 8], mottle: ['#9a6650', 6, 12], hatch: { c: 'rgba(60,24,12,0.4)', n: 4, len: 18, gap: 5, k: 3, ang: 70 } };
const STUB = 'rgba(30,22,18,0.65)';
const NOSE = { lw: 6, shade: [T.skinD, -6, 5], patch: [T.nose, 4, -8, 0.3] };
const HELMET = [
  [2, -72],
  [10, -72],
  [16, -72],
  [0, -72],
];

export const person = {
  id: 'commander',
  name: 'The Commander',
  D: {
    sw: 70,
    sy: -552,
    sz: 8,
    l1a: 114,
    l2a: 108,
    hw: 36,
    hy: -340,
    l1l: 164,
    l2l: 150,
    elbowOut: 0.75,
    top: -800,
    waist: [84, -404],
    hsz: 42,
    head: { x: [0, 18, 36, 0], top: -800, bottom: -585, hw: 78 },
  },
  neck: NECK,
  headScale: 1.1,
  seed: S,
  tones: T,
  arm: {
    cloth: T.suit,
    clothD: T.suitD,
    w: [56, 48, 42],
    skin: T.glove,
    skinD: T.gloveD,
    hsz: 42,
    lw: 7,
    cuff: T.stone,
    hatch: { c: 'rgba(40,36,24,0.45)', n: 3, len: 24, gap: 6, k: 3, ang: 30 },
  },
  leg: {
    cloth: T.suit,
    clothD: T.suitD,
    w: [62, 52, 46],
    shoe: T.boot,
    shoeD: T.bootD,
    len: 80,
    sw: 40,
    lw: 7,
    splay: 0.3,
    hatch: { c: 'rgba(60,50,30,0.4)', n: 3, len: 30, gap: 6, k: 3, ang: 70 },
  },
  defaultExpr: 'deadpan',
  signatureGag: { kind: 'gum', note: 'chews gum and blows a bubble while everyone else panics' },
  // prettier-ignore
  faceAnchors: [
    { chin: [0, 10], cheek: [40, -40], nose: [0, -60], mouth: [0, -24], ear: [66, -80], forehead: [0, -120] },
    { chin: [14, 10], cheek: [52, -40], nose: [32, -60], mouth: [26, -24], ear: [-56, -80], forehead: [10, -120] },
    { chin: [36, 6], cheek: [30, -40], nose: [64, -62], mouth: [46, -26], ear: [-24, -80], forehead: [10, -120] },
    { ear: [68, -80] },
  ],
  drawNeck(g, ink, view, n) {
    // prettier-ignore
    ink.tube([n[0], n[1] + 4, n[2], n[3] + 16], [64, 58], T.skin, { lw: 6, seed: S + 60, shade: [T.skinD, -8, 0] });
  },
  torso(g, ink, view) {
    suit(ink, view);
    // prettier-ignore
    ink.blob(ink.ellipseRing(RING[view], -588, view === 2 ? 34 : 50, 13, 12), T.stone, { lw: 6, seed: S + 18, shade: [T.stoneD, 0, 4] });
  },
  head(g, ink, view, face, p) {
    if (view === 0) headFront(ink, face, p);
    else if (view === 1) head34(ink, face, p);
    else if (view === 2) headProfile(ink, face, p);
    else headBack(ink);
    // prettier-ignore
    if (p.helmet) ink.helmet(HELMET[view][0], HELMET[view][1], 100, 106, { visor: p.helmet === 2, vx: [0, 14, 26, 0][view], seed: S + 61 });
  },
};

// prettier-ignore
function suit(ink, v) {
  ink.blob(SUITS[v], T.suit, { lw: 8, seed: S + v, shade: [T.suitD, -24, 8], mottle: ['rgba(90,80,50,0.2)', 4, 18], hatch: { c: 'rgba(40,36,24,0.5)', n: 9, len: 44, gap: 7, k: 3, ang: -65 } });
  ink.brushStroke(BELT[v], { w: 8, color: T.suitD, seed: S + 5, taper: false });
  if (v === 3) {
    ink.brushStroke([0, -582, -4, -470, 2, -340], { w: 4.5, seed: S + 6 });
    ink.brushStroke([-60, -560, -40, -500, -64, -440], { w: 3.5, seed: S + 7 });
    return;
  }
  const x = [0, 20, 50][v];
  const k = [1, 0.8, 0.4][v];
  ink.brushStroke([x + 2, -580, x - 2, -480, x + 2, -404], { w: 4, seed: S + 8 });
  // Hose connectors.
  [[-40, -470], [-22, -470], [22, -470], [40, -470]].forEach(([dx, y], i) => {
    if (v === 2 && i < 2) return;
    ink.blob(ink.ellipseRing(x + dx * k, y, 10 * (v === 2 ? 0.6 : 1), 10, 8), T.hose, { lw: 4, seed: S + 10 + i, light: ['rgba(230,220,190,0.3)', 2, -2] });
  });
  if (v < 2) ink.rect(x + 30 * k, -546, 46 * k, 22, T.tape, { seed: S + 15, lw: 3, amp: 1 }); // name tape
  ink.brushStroke([x - 60 * k, -430, x - 40 * k, -410, x - 62 * k, -392], { w: 3.5, seed: S + 16 }); // a fold
}

// Comm cap: linen side strips, dark crown, ear cups.
// prettier-ignore
function cap(ink, side, top, cups) {
  ink.blob(side, T.capSide, { lw: 6, seed: S + 20, shade: [T.capSideD, -6, 6], hatch: { c: 'rgba(40,34,20,0.45)', n: 4, len: 18, gap: 5, k: 3, ang: 80 } });
  ink.blob(top, T.strap, { lw: 6, seed: S + 21, shade: [T.capTopD, -8, 6], hatch: { c: 'rgba(120,100,70,0.35)', n: 3, len: 20, gap: 5, k: 3, ang: 20 } });
  cups.forEach(([x, y], i) => ink.blob(ink.ellipseRing(x, y, 16, 22, 9), T.cup, { lw: 5, seed: S + 22 + i, light: ['rgba(200,190,160,0.25)', 3, -3] }));
}

// Small heavy-lidded eyes under one straight low brow line, crow's feet.
// prettier-ignore
function eyes(ink, f, a, b) {
  ink.eye(a[0], a[1], 11 * a[2], 12, f, { skin: T.skin, seed: S + 24, lw: 5, side: 0, bags: 2, lidAdd: 0.08 });
  ink.brow(a[0], a[1] - 20, 34 * a[2], -1, f, { u: 14, thick: 14, color: T.brow, seed: S + 25, arch: 0.2 });
  ink.brushStroke([a[0] - 16 * a[2], a[1] + 2, a[0] - 26 * a[2], a[1] - 4], { w: 3, seed: S + 26 });
  if (!b) return;
  ink.eye(b[0], b[1], 10 * b[2], 12, f, { skin: T.skin, seed: S + 27, lw: 5, side: 1, bags: 2, lidAdd: 0.08 });
  ink.brow(b[0], b[1] - 20, 34 * b[2], 1, f, { u: 14, thick: 14, color: T.brow, seed: S + 28, arch: 0.2 });
  ink.brushStroke([b[0] + 16 * b[2], b[1] + 2, b[0] + 26 * b[2], b[1] - 4], { w: 3, seed: S + 29 });
}

// Gum: the mouth shifts side to side on twos with a cheek bulge; the bubble grows from the lips.
// prettier-ignore
function mouth(ink, f, x, y, w, p, cheekX) {
  const ch = p.chew ? Math.floor(ink.time.twos(p.t) * 6) % 2 : -1;
  const dx = ch === 1 ? 5 : ch === 0 ? -4 : 0;
  if (ch >= 0) ink.blob(ink.ellipseRing(cheekX * (ch ? 1 : -1) + x, y - 10, 10, 8, 7), T.skinD, { lw: 0, seed: S + 30 });
  ink.mouth(x + dx, y, w, f, { open: 26, teeth: 'row', seed: S + 31, lw: 5 });
  ink.gumBubble(x + dx + 4, y + 2, (p.bubble || 0) * 78, S + 32);
}

// prettier-ignore
function headFront(ink, f, p) {
  const jaw = f.jaw * 14;
  ink.blob([-58, -14 + jaw, -62, -60, -62, -110, -54, -146, -18, -160, 20, -160, 54, -148, 62, -112, 62, -60, 58, -14 + jaw, 36, 10 + jaw, 0, 16 + jaw, -36, 10 + jaw], T.skin, { seed: S + 33, ...FACE });
  ink.stubble([-56, -60, -50, 4 + jaw, 0, 18 + jaw, 50, 4 + jaw, 58, -60, 30, -44, -30, -44], S + 34, 120, STUB);
  cap(ink, [-58, -30, -66, -100, -58, -150, -20, -170, 20, -170, 58, -150, 66, -100, 58, -30, 50, -30, 54, -104, 40, -118, 0, -122, -40, -118, -54, -104, -50, -30], [-56, -124, -48, -156, -18, -174, 20, -174, 50, -156, 58, -124, 0, -132], [[-66, -80], [66, -80]]);
  ink.brushStroke([-52, -30, -30, 6 + jaw, 0, 12 + jaw, 30, 6 + jaw, 52, -30], { w: 5, color: T.strap, seed: S + 35, taper: false });
  eyes(ink, f, [-24, -90, 1], [24, -90, 1]);
  ink.brushStroke([-34, -58, -40, -36, -34, -14 + jaw], { w: 3.5, seed: S + 36 }); // cheek lines
  ink.brushStroke([34, -58, 40, -36, 34, -14 + jaw], { w: 3.5, seed: S + 37 });
  ink.blob([-10, -88, 10, -88, 14, -64, 24, -50, 12, -40, -12, -40, -24, -50, -14, -64], T.skin, { seed: S + 38, ...NOSE });
  ink.brushStroke([-4, -2 + jaw, 0, 8 + jaw, 4, -2 + jaw], { w: 3, seed: S + 39 }); // chin cleft
  ink.brushStroke([18, 0 + jaw, 30, -10 + jaw], { w: 3, color: T.scar, seed: S + 40, taper: false }); // scar
  mouth(ink, f, 0, -24, 46, p, 34);
}

// prettier-ignore
function head34(ink, f, p) {
  const jaw = f.jaw * 14;
  ink.blob([-50, -12 + jaw, -58, -60, -58, -112, -48, -148, -10, -162, 30, -158, 58, -140, 66, -110, 64, -84, 70, -60, 66, -14 + jaw, 46, 10 + jaw, 12, 16 + jaw, -24, 10 + jaw], T.skin, { seed: S + 41, ...FACE });
  ink.stubble([-46, -60, -40, 4 + jaw, 12, 18 + jaw, 64, 4 + jaw, 68, -60, 44, -44, -18, -44], S + 42, 120, STUB);
  cap(ink, [-52, -30, -62, -104, -52, -152, -12, -172, 30, -170, 62, -148, 66, -116, 52, -120, 30, -124, -10, -124, -34, -112, -42, -96, -38, -30], [-50, -126, -42, -158, -10, -176, 30, -174, 60, -150, 64, -126, 10, -134], [[-56, -80]]);
  ink.brushStroke([-40, -30, -14, 6 + jaw, 24, 14 + jaw], { w: 5, color: T.strap, seed: S + 43, taper: false });
  eyes(ink, f, [-4, -90, 1], [44, -90, 0.66]);
  ink.brushStroke([-18, -58, -24, -36, -18, -14 + jaw], { w: 3.5, seed: S + 44 });
  ink.blob([18, -88, 34, -88, 40, -64, 52, -50, 42, -40, 20, -40, 12, -50, 20, -64], T.skin, { seed: S + 45, ...NOSE });
  ink.brushStroke([22, -2 + jaw, 26, 8 + jaw, 30, -2 + jaw], { w: 3, seed: S + 46 });
  mouth(ink, f, 26, -24, 40, p, 26);
}

// prettier-ignore
function headProfile(ink, f, p) {
  const jaw = f.jaw * 14;
  ink.blob([-44, -10, -64, -50, -66, -110, -50, -148, -10, -162, 30, -154, 50, -130, 54, -108, 50, -94, 58, -84, 56, -60, 52, -46, 56, -34, 62, -16 + jaw, 56, 4 + jaw, 30, 14 + jaw, 0, 12, -24, 2], T.skin, { seed: S + 47, ...FACE });
  ink.stubble([-4, -60, 4, 8 + jaw, 54, 6 + jaw, 58, -40, 30, -46], S + 48, 90, STUB);
  cap(ink, [-40, -16, -70, -60, -72, -124, -48, -168, -6, -178, 34, -166, 52, -132, 32, -124, 8, -122, -8, -98, -2, -16], [-58, -130, -44, -168, -6, -180, 34, -168, 52, -134, 10, -132, -24, -126], [[-24, -80]]);
  ink.brushStroke([-4, -24, 14, 8 + jaw, 40, 12 + jaw], { w: 5, color: T.strap, seed: S + 49, taper: false });
  eyes(ink, f, [34, -90, 0.72], null);
  ink.blob([48, -90, 62, -86, 70, -64, 76, -52, 60, -46, 50, -52], T.skin, { seed: S + 50, ...NOSE });
  ink.brushStroke([30, -54, 22, -34, 30, -16], { w: 3.5, seed: S + 51 });
  mouth(ink, f, 46, -26, 18, p, 0);
}

// prettier-ignore
function headBack(ink) {
  ink.blob([-56, -8, -62, -60, -62, -110, -54, -146, -18, -160, 20, -160, 54, -148, 62, -110, 62, -60, 56, -8, 0, 4], T.skin, { seed: S + 52, ...FACE });
  cap(ink, [-62, -26, -68, -100, -58, -152, -20, -172, 20, -172, 58, -152, 68, -100, 62, -26, 0, -18], [-56, -124, -48, -156, -18, -176, 20, -176, 50, -156, 58, -124, 0, -132], [[-68, -80], [68, -80]]);
  [-1, 1].forEach((s, i) => ink.brushStroke([s * 30, -16, s * 26, 8], { w: 4, seed: S + 53 + i })); // thick nape folds
}

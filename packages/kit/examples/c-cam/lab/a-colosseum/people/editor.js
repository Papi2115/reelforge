// Grim Ink person (kit-ext/people/editor.js): "The Editor", the man paying for the games. Axis: a
// tiny head (a walnut with a laurel wreath) on a vast, sagging toga that hangs to his shins like a
// tent. A dirty bone toga with one plum border, a fat coin purse on a cord at his hip (the accent
// object of the title), pale soft hands, a wine cup (the sip gag). Shot props (p): purse (default
// 1: the purse hangs at his hip; 0 hides it), lean (he leans over the rail of his box).
const T = {
  skin: '#c79a7a',
  skinD: '#9a6d52',
  toga: '#c8bc9c',
  togaD: '#9c9072',
  border: '#6b3a52',
  borderD: '#47243a',
  laurel: '#6f7a3a',
  laurelD: '#4a5224',
  purse: '#a3392c',
  purseD: '#6e2219',
  cord: '#3c2a1c',
  sandal: '#5e4430',
  sandalD: '#3c2a1c',
  brow: '#3a2c22',
  nose: '#d6a88a',
};
const S = 6300;
const FACE = {
  lw: 6,
  shade: [T.skinD, -8, 5],
  mottle: ['#b08066', 5, 10],
  hatch: { c: 'rgba(70,30,16,0.35)', n: 3, len: 12, gap: 4, k: 3, ang: 70 },
};

// The toga per view (figure space, feet at 0): a tent from the shoulders to the shins.
// prettier-ignore
const TOGA = [
  [-40, -582, -86, -566, -120, -500, -150, -380, -168, -250, -160, -150, -80, -126, 0, -134, 80, -126, 160, -150, 168, -250, 150, -380, 120, -500, 86, -566, 40, -582],
  [-30, -584, -80, -568, -112, -500, -140, -380, -156, -250, -150, -150, -70, -128, 20, -136, 100, -126, 170, -152, 176, -250, 156, -384, 124, -504, 90, -568, 36, -584],
  [-20, -586, -54, -570, -74, -500, -86, -380, -98, -250, -96, -150, -30, -128, 70, -132, 130, -150, 140, -260, 128, -390, 104, -500, 70, -570, 24, -588],
  [-40, -582, -88, -566, -122, -500, -152, -380, -170, -250, -162, -150, -80, -130, 0, -136, 80, -130, 162, -150, 170, -250, 152, -380, 122, -500, 88, -566, 40, -582],
];
// The plum border sweeping across the body from the left shoulder to the right hip.
// prettier-ignore
const BORDER = [
  [-70, -572, -40, -480, 20, -380, 100, -300, 150, -250],
  [-60, -574, -26, -480, 40, -380, 120, -300, 160, -256],
  [-40, -578, -20, -480, 30, -380, 90, -300, 120, -260],
];
const PURSE = [
  [120, -300],
  [134, -296],
  [96, -300],
];

export const person = {
  id: 'editor',
  name: 'The Editor',
  D: {
    sw: 64,
    sy: -548,
    sz: 6,
    l1a: 124,
    l2a: 116,
    hw: 40,
    hy: -360,
    l1l: 180,
    l2l: 162,
    elbowOut: 0.6,
    top: -742,
    waist: [120, -380],
    hsz: 34,
    head: { x: [0, 12, 24, 0], top: -742, bottom: -578, hw: 58 },
  },
  neck: [
    [0, -574, 0, -600],
    [4, -574, 8, -600],
    [10, -574, 18, -598],
    [0, -574, 0, -600],
  ],
  headScale: 0.95,
  seed: S,
  tones: T,
  arm: {
    cloth: T.toga,
    clothD: T.togaD,
    w: [44, 40, 34],
    bare: 0.45,
    skin: T.skin,
    skinD: T.skinD,
    hsz: 34,
    lw: 6,
    hatch: { c: 'rgba(60,50,30,0.35)', n: 3, len: 22, gap: 6, k: 3, ang: 40 },
  },
  leg: {
    cloth: T.skin,
    clothD: T.skinD,
    w: [40, 30, 22],
    shoe: T.sandal,
    shoeD: T.sandalD,
    len: 56,
    sw: 24,
    lw: 6,
    splay: 0.4,
  },
  defaultExpr: 'smug',
  // The one recurring tic: a sip of wine before every decision about somebody else's life.
  signatureGag: {
    kind: 'sip',
    note: 'sips from his wine cup before every decision, as if tasting the crowd',
  },
  // prettier-ignore
  faceAnchors: [
    { chin: [0, 8], cheek: [26, -36], nose: [0, -50], mouth: [0, -18], ear: [38, -62], forehead: [0, -96] },
    { chin: [12, 8], cheek: [34, -36], nose: [34, -52], mouth: [20, -18], ear: [-26, -62], forehead: [10, -96] },
    { chin: [24, 6], cheek: [18, -36], nose: [52, -54], mouth: [34, -18], ear: [-6, -62], forehead: [16, -96] },
    { ear: [38, -62] },
  ],
  torso(g, ink, view, p) {
    // prettier-ignore
    ink.blob(TOGA[view], T.toga, { lw: 8, seed: S + 10 + view, shade: [T.togaD, -30, 10], mottle: ['#a89c7c', 7, 26], hatch: { c: 'rgba(50,40,24,0.4)', n: 8, len: 60, gap: 8, k: 3, ang: -70 } });
    // Folds hanging from the shoulder.
    const x = [0, 14, 30, 0][view];
    ink.brushStroke([x - 60, -520, x - 90, -380, x - 100, -200], {
      w: 4,
      seed: S + 20,
    });
    ink.brushStroke([x + 50, -500, x + 80, -360, x + 96, -180], {
      w: 4,
      seed: S + 21,
    });
    ink.brushStroke([x - 10, -360, x + 6, -260, x - 4, -150], {
      w: 3.5,
      seed: S + 22,
    });
    if (view < 3) {
      ink.brushStroke(BORDER[view], {
        w: 18,
        color: T.border,
        seed: S + 23,
        taper: false,
      });
      ink.brushStroke(BORDER[view], { w: 4, seed: S + 24 });
    }
    // Wine stains down the front: he has been sipping all day.
    if (view < 2) {
      ink.blob(ink.ellipseRing(x - 30, -420, 14, 9, 8), 'rgba(90,30,40,0.45)', {
        lw: 0,
        seed: S + 25,
      });
      ink.blob(ink.ellipseRing(x - 20, -392, 7, 5, 7), 'rgba(90,30,40,0.45)', {
        lw: 0,
        seed: S + 26,
      });
    }
    if (view < 3 && p.purse !== 0) purse(ink, PURSE[view]);
  },
  head(g, ink, view, face) {
    if (view === 0) headFront(ink, face);
    else if (view === 1) head34(ink, face);
    else if (view === 2) headProfile(ink, face);
    else headBack(ink);
  },
};

// The fat coin purse on its cord: plum-red leather, a knot, two coins bulging at the seam.
// prettier-ignore
function purse(ink, [x, y]) {
  ink.brushStroke([x - 18, y - 70, x - 4, y - 40, x, y - 26], { w: 3.5, color: T.cord, seed: S + 30, taper: false });
  ink.blob([x - 34, y - 20, x - 20, y - 34, x + 20, y - 34, x + 36, y - 16, x + 40, y + 24, x + 22, y + 46, x - 22, y + 46, x - 40, y + 22], T.purse, { lw: 6, seed: S + 31, shade: [T.purseD, -10, 8], hatch: { c: 'rgba(40,10,6,0.45)', n: 3, len: 14, gap: 5, k: 3, ang: 60 } });
  ink.brushStroke([x - 22, y - 26, x, y - 20, x + 24, y - 26], { w: 4, seed: S + 32 });
  ink.blob(ink.ellipseRing(x + 10, y + 10, 9, 6, 8), '#b8923e', { lw: 3, seed: S + 33 });
}

// The laurel wreath: two rows of leaves round the tiny skull.
function wreath(ink, cx, cy, w, back) {
  for (let i = 0; i < 7; i += 1) {
    const a = Math.PI * (0.15 + (i / 6) * 0.7);
    const x = cx - Math.cos(a) * w;
    const y = cy - Math.sin(a) * w * 0.45;
    ink.blob(ink.ellipseRing(x, y, 11, 6, 7), back ? T.laurelD : T.laurel, {
      lw: 3.5,
      seed: S + 40 + i,
      shade: [T.laurelD, 0, 2],
    });
  }
}

// prettier-ignore
function eyes(ink, f, a, b) {
  ink.eye(a[0], a[1], 8 * a[2], 7, f, { skin: T.skin, seed: S + 50, lw: 4, side: 0, bags: 1, lidAdd: 0.18 });
  ink.brow(a[0], a[1] - 14, 18 * a[2], -1, f, { thick: 7, color: T.brow, seed: S + 51, arch: 0.4 });
  if (!b) return;
  ink.eye(b[0], b[1], 7 * b[2], 7, f, { skin: T.skin, seed: S + 52, lw: 4, side: 1, bags: 1, lidAdd: 0.18 });
  ink.brow(b[0], b[1] - 14, 18 * b[2], 1, f, { thick: 7, color: T.brow, seed: S + 53, arch: 0.4 });
}

// prettier-ignore
function headFront(ink, f) {
  const jaw = f.jaw * 8;
  ink.blob([-34, -10 + jaw, -42, -50, -38, -90, -20, -112, 0, -116, 20, -112, 38, -90, 42, -50, 34, -10 + jaw, 18, 6 + jaw, 0, 10 + jaw, -18, 6 + jaw], T.skin, { seed: S + 60, ...FACE });
  ink.brushStroke([-20, -4 + jaw, 0, 2 + jaw, 20, -4 + jaw], { w: 3.5, seed: S + 61 }); // double chin
  wreath(ink, 0, -96, 40, false);
  eyes(ink, f, [-14, -66, 1], [14, -66, 1]);
  ink.blob([-5, -64, 5, -64, 8, -38, 0, -32, -8, -38], T.skin, { lw: 5, seed: S + 62, shade: [T.skinD, -3, 3], patch: [T.nose, 2, -4, 0.3] });
  ink.mouth(0, -16 + jaw * 0.5, 22, f, { seed: S + 63, teeth: 'few', lw: 4 });
  ink.blob(ink.ellipseRing(-24, -34, 6, 4, 7), 'rgba(170,60,50,0.35)', { lw: 0, seed: S + 64 });
  ink.blob(ink.ellipseRing(24, -34, 6, 4, 7), 'rgba(170,60,50,0.35)', { lw: 0, seed: S + 65 });
}

// prettier-ignore
function head34(ink, f) {
  const jaw = f.jaw * 8;
  ink.blob(ink.ellipseRing(-28, -60, 7, 12, 8), T.skin, { lw: 4, seed: S + 66, shade: [T.skinD, -3, 2] });
  ink.blob([-28, -10 + jaw, -36, -50, -32, -90, -14, -112, 8, -116, 28, -110, 42, -88, 46, -50, 40, -10 + jaw, 24, 6 + jaw, 6, 10 + jaw, -14, 6 + jaw], T.skin, { seed: S + 67, ...FACE });
  ink.brushStroke([-10, -4 + jaw, 8, 2 + jaw, 26, -4 + jaw], { w: 3.5, seed: S + 68 });
  wreath(ink, 6, -96, 38, false);
  eyes(ink, f, [2, -66, 1], [28, -66, 0.66]);
  ink.blob([18, -64, 30, -64, 38, -38, 26, -32, 18, -38], T.skin, { lw: 5, seed: S + 69, shade: [T.skinD, -3, 3], patch: [T.nose, 2, -4, 0.3] });
  ink.mouth(20, -16 + jaw * 0.5, 18, f, { seed: S + 70, teeth: 'few', lw: 4 });
}

// prettier-ignore
function headProfile(ink, f) {
  const jaw = f.jaw * 8;
  ink.blob([-34, -20, -40, -60, -32, -96, -8, -116, 18, -110, 34, -88, 38, -70, 50, -50, 40, -40, 42, -14 + jaw, 30, 6 + jaw, 6, 10, -16, 4], T.skin, { seed: S + 71, ...FACE });
  ink.blob(ink.ellipseRing(-6, -62, 7, 12, 8), T.skin, { lw: 4, seed: S + 72, shade: [T.skinD, -3, 2] });
  wreath(ink, -2, -96, 36, false);
  eyes(ink, f, [26, -66, 0.72], null);
  ink.blob([38, -66, 46, -60, 60, -40, 44, -34, 38, -40], T.skin, { lw: 5, seed: S + 73, shade: [T.skinD, -3, 3], patch: [T.nose, 2, -4, 0.3] });
  ink.mouth(34, -16 + jaw * 0.5, 12, f, { seed: S + 74, lw: 4 });
}

// prettier-ignore
function headBack(ink) {
  ink.blob([-34, -10, -42, -50, -38, -90, -20, -112, 0, -116, 20, -112, 38, -90, 42, -50, 34, -10, 0, 4], T.skin, { seed: S + 75, ...FACE });
  wreath(ink, 0, -96, 40, true);
  ink.brushStroke([-16, -8, -12, 6], { w: 3, seed: S + 76 });
  ink.brushStroke([16, -8, 12, 6], { w: 3, seed: S + 77 });
}

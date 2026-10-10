// Grim Ink person (kit-ext/people/orbiter.js): "The Orbiting Astronaut" of the C-CAM Apollo 11
// film (docs/concepts/c-cam-style/films/03-apollo-11/js/cast/orbiter.js), ported to the people
// module contract. A soft pear: narrow shoulders, round belly, short arms. Round pudgy face with a
// double chin, a bald dome with a long comb-over whose strands float up in zero gravity, a droopy
// walrus moustache, a red bulb nose with broken veins, sad drooping brows, double bags, a wart on
// the cheek. Beige in-flight coverall with a zip, chest pockets, a pen and a ketchup stain.
// Shot props (p): sandwich (0, or 1 = bitten; in the right hand). The comb-over waves with p.t.
const T = {
  skin: '#b07a62',
  skinD: '#86533f',
  hair: '#7e6a4c',
  cloth: '#968b68',
  clothD: '#6e6549',
  shoe: '#5a4736',
  shoeD: '#3f3125',
  zip: '#5d584a',
  pen: '#2a2623',
  ketchup: '#5f2c1c',
  nose: '#b4664f',
  noseL: '#c98a70',
  vein: '#7c1f19',
  wart: '#7f4a3a',
};
const S = 410;
const NECK = [
  [0, -540, 0, -578],
  [8, -538, 14, -576],
  [16, -534, 32, -572],
  [0, -540, 0, -578],
];
// prettier-ignore
const COVER = [
  [-26, -556, -64, -544, -74, -500, -80, -440, -96, -380, -94, -330, -62, -310, 0, -306, 62, -310, 94, -330, 96, -380, 80, -440, 74, -500, 64, -544, 26, -556],
  [-16, -558, -58, -546, -70, -500, -76, -440, -88, -380, -86, -330, -56, -310, 14, -306, 70, -312, 100, -340, 104, -392, 92, -446, 78, -500, 58, -546, 22, -558],
  [-4, -560, -36, -548, -48, -500, -46, -430, -50, -370, -46, -326, -24, -310, 50, -310, 80, -340, 90, -390, 80, -440, 56, -500, 42, -546, 18, -560],
  [-26, -556, -66, -544, -76, -500, -82, -440, -96, -380, -94, -330, -62, -310, 0, -308, 62, -310, 94, -330, 96, -380, 82, -440, 76, -500, 66, -544, 26, -556],
];
// prettier-ignore
const FACE = { lw: 7, shade: [T.skinD, -16, 10], mottle: ['#9a6650', 6, 12], hatch: { c: 'rgba(60,24,12,0.4)', n: 4, len: 18, gap: 5, k: 3, ang: 70 } };

export const person = {
  id: 'orbiter',
  name: 'The Orbiting Astronaut',
  D: {
    sw: 52,
    sy: -520,
    sz: 10,
    l1a: 106,
    l2a: 100,
    hw: 32,
    hy: -320,
    l1l: 156,
    l2l: 140,
    elbowOut: 0.7,
    top: -800,
    waist: [80, -390],
    hsz: 36,
    head: { x: [0, 16, 36, 0], top: -800, bottom: -551, hw: 96 },
  },
  neck: NECK,
  headScale: 1.1,
  seed: S,
  tones: T,
  arm: {
    cloth: T.cloth,
    clothD: T.clothD,
    w: [36, 32, 28],
    bare: 0.8,
    skin: T.skin,
    skinD: T.skinD,
    hsz: 36,
    lw: 6,
    cuff: T.clothD,
    hatch: { c: 'rgba(30,26,12,0.45)', n: 3, len: 22, gap: 6, k: 3, ang: 30 },
  },
  leg: {
    cloth: T.cloth,
    clothD: T.clothD,
    w: [46, 36, 30],
    shoe: T.shoe,
    shoeD: T.shoeD,
    len: 62,
    sw: 30,
    lw: 6,
    splay: 0.3,
  },
  defaultExpr: 'sad',
  signatureGag: { kind: 'eat', note: 'eats alone in orbit, a sandwich always half gone' },
  // prettier-ignore
  faceAnchors: [
    { chin: [0, 6], cheek: [48, -40], nose: [0, -62], mouth: [0, -28], ear: [72, -88], forehead: [0, -130] },
    { chin: [24, 6], cheek: [62, -40], nose: [30, -62], mouth: [24, -28], ear: [-66, -88], forehead: [10, -130] },
    { chin: [30, 8], cheek: [36, -40], nose: [66, -62], mouth: [50, -28], ear: [-14, -84], forehead: [10, -130] },
    { ear: [72, -70] },
  ],
  drawNeck(g, ink, view, n) {
    // prettier-ignore
    ink.tube([n[0], n[1] + 6, n[2], n[3] + 16], [60, 56], T.skin, { lw: 6, seed: S + 52, shade: [T.skinD, -8, 0] });
  },
  torso(g, ink, view) {
    coverall(ink, view);
    const n = NECK[view];
    // prettier-ignore
    if (view < 3) ink.blob([n[0] - 26 + view * 6, n[1] - 14, n[0] + view * 8, n[1] + 14, n[0] + 26 + view * 10, n[1] - 14], T.clothD, { lw: 5, seed: S + 53 }); // collar
  },
  head(g, ink, view, face, p) {
    // The comb-over strands float up and wave on twos.
    const wave = Math.floor(ink.time.twos(p.t) * 4) % 2 ? 6 : -6;
    if (view === 0) headFront(ink, face, wave);
    else if (view === 1) head34(ink, face, wave);
    else if (view === 2) headProfile(ink, face, wave);
    else headBack(ink, wave);
  },
  // The sandwich in the right hand (p.sandwich = bite 0 | 1).
  arms(p) {
    return p.sandwich === undefined ? undefined : { R: { hand: 'grip' } };
  },
  held(g, ink, side, palm, p) {
    if (side === 'R' && p.sandwich !== undefined) {
      ink.sandwich(palm[0], palm[1] - 6, -10, S + 60, p.sandwich);
    }
  },
};

// prettier-ignore
function coverall(ink, v) {
  ink.blob(COVER[v], T.cloth, { lw: 7, seed: S + v, shade: [T.clothD, -20, 8], mottle: ['rgba(70,60,30,0.3)', 5, 18], hatch: { c: 'rgba(30,26,12,0.5)', n: 8, len: 38, gap: 7, k: 3, ang: -50 } });
  if (v === 3) {
    ink.brushStroke([-60, -380, 0, -364, 60, -380], { w: 4, seed: S + 5 });
    ink.brushStroke([0, -548, 2, -460, -2, -370], { w: 3.5, seed: S + 6 });
    return;
  }
  const x = [0, 18, 52][v];
  const k = [1, 0.8, 0.35][v];
  ink.brushStroke([x, -552, x + 4, -440, x, -312], { w: 4.5, color: T.zip, seed: S + 7, taper: false }); // zip
  if (v < 2) [-1, 1].forEach((s, i) => {
    ink.rect(x + s * 44 * k - 18 * k, -500, 36 * k, 40, T.clothD, { seed: S + 8 + i, lw: 4, amp: 1.5 });
    if (s < 0) ink.tube([x - 40 * k, -508, x - 38 * k, -470], [6, 6], T.pen, { lw: 3, seed: S + 10 });
  });
  ink.blob([x + 20 * k, -420, x + 34 * k, -426, x + 38 * k, -404, x + 24 * k, -398], T.ketchup, { lw: 0, seed: S + 11 }); // ketchup
  ink.brushStroke([x - 50 * k, -360, x - 10 * k, -348, x + 40 * k, -362], { w: 3.5, seed: S + 12 }); // belly fold
}

// Comb-over strands floating up from the dome.
// prettier-ignore
function strands(ink, x0, x1, top, w) {
  for (let i = 0; i < 5; i += 1) {
    const x = x0 + ((x1 - x0) * i) / 4;
    ink.brushStroke([x, top + 8, x + 6 + w, top - 30, x - 4 + w * 1.5, top - 62 - i * 4], { w: 4.5, color: T.hair, seed: S + 20 + i, taper: false });
  }
}

// prettier-ignore
function tash(ink, x, y, w) {
  ink.blob([x - w, y + 18, x - w * 0.8, y - 2, x, y - 8, x + w * 0.8, y - 2, x + w, y + 18, x + w * 0.5, y + 8, x, y + 4, x - w * 0.5, y + 8], T.hair, { lw: 5, seed: S + 26, hatch: { c: 'rgba(30,20,10,0.6)', n: 3, len: 12, gap: 4, k: 3, ang: 80 } });
}

// Red bulb nose with broken veins.
// prettier-ignore
function nose(ink, x, y, r) {
  ink.blob(ink.ellipseRing(x, y, r, r * 0.86, 9), T.nose, { lw: 6, seed: S + 27, shade: [T.skinD, -5, 4], patch: [T.noseL, 3, -5, 0.35] });
  ink.brushStroke([x - r * 0.6, y + 2, x - r * 0.25, y - 1, x - r * 0.1, y - r * 0.4], { w: 2, color: T.vein, seed: S + 28, taper: false });
  ink.brushStroke([x + r * 0.15, y + r * 0.35, x + r * 0.45, y + r * 0.1], { w: 2, color: T.vein, seed: S + 29, taper: false });
}

// prettier-ignore
function eyes(ink, f, a, b) {
  ink.eye(a[0], a[1], 12 * a[2], 13, f, { skin: T.skin, seed: S + 30, lw: 5, side: 0, bags: 2 });
  ink.brow(a[0], a[1] - 22, 28 * a[2], -1, f, { u: 18, thick: 9, color: T.hair, seed: S + 31, droop: 6 });
  if (!b) return;
  ink.eye(b[0], b[1], 12 * b[2], 13, f, { skin: T.skin, seed: S + 32, lw: 5, side: 1, bags: 2 });
  ink.brow(b[0], b[1] - 22, 28 * b[2], 1, f, { u: 18, thick: 9, color: T.hair, seed: S + 33, droop: 6 });
}

// prettier-ignore
function headFront(ink, f, wave) {
  const jaw = f.jaw * 16;
  ink.blob([-70, -50, -72, -100, -60, -140, -24, -162, 24, -162, 60, -140, 72, -100, 70, -50, 54, -10 + jaw, 24, 10 + jaw, -24, 10 + jaw, -54, -10 + jaw], T.skin, { seed: S + 34, ...FACE });
  ink.brushStroke([-36, 4 + jaw, 0, 16 + jaw, 36, 4 + jaw], { w: 4, seed: S + 35 }); // double chin
  [-1, 1].forEach((s, i) => ink.blob([s * 64, -104, s * 76, -112, s * 82, -84, s * 70, -66, s * 62, -76], T.hair, { lw: 4, seed: S + 36 + i }));
  strands(ink, -30, 30, -150, wave);
  eyes(ink, f, [-26, -90, 1], [26, -90, 1]);
  ink.mouth(0, -28, 40, f, { open: 26, teeth: 'few', seed: S + 38, lw: 5 });
  tash(ink, 0, -46, 34);
  nose(ink, 0, -62, 18);
  ink.wart(46, -56, 4.5, T.wart, S + 39, true);
}

// prettier-ignore
function head34(ink, f, wave) {
  const jaw = f.jaw * 16;
  ink.blob([-62, -50, -66, -100, -54, -142, -16, -164, 32, -160, 66, -136, 80, -100, 80, -50, 66, -10 + jaw, 34, 10 + jaw, -14, 10 + jaw, -46, -10 + jaw], T.skin, { seed: S + 40, ...FACE });
  ink.brushStroke([-22, 4 + jaw, 14, 18 + jaw, 50, 4 + jaw], { w: 4, seed: S + 41 });
  ink.blob([-58, -104, -70, -112, -76, -84, -64, -66, -56, -76], T.hair, { lw: 4, seed: S + 42 });
  strands(ink, -16, 40, -152, wave);
  eyes(ink, f, [-6, -90, 1], [46, -90, 0.66]);
  ink.mouth(24, -28, 36, f, { open: 24, teeth: 'few', seed: S + 43, lw: 5 });
  tash(ink, 24, -46, 30);
  nose(ink, 30, -62, 17);
  ink.wart(-30, -56, 4.5, T.wart, S + 44, true);
}

// prettier-ignore
function headProfile(ink, f, wave) {
  const jaw = f.jaw * 16;
  ink.blob([-50, -20, -66, -70, -62, -126, -30, -160, 14, -162, 46, -140, 58, -106, 60, -80, 58, -50, 56, -20 + jaw, 40, 6 + jaw, 10, 16 + jaw, -20, 6], T.skin, { seed: S + 45, ...FACE });
  ink.blob([-62, -64, -66, -110, -42, -110, -30, -70], T.hair, { lw: 4, seed: S + 46 });
  strands(ink, -20, 20, -154, wave);
  ink.blob(ink.ellipseRing(-14, -84, 14, 20, 8), T.skin, { lw: 5, seed: S + 47, shade: [T.skinD, -4, 2], inner: () => ink.brushStroke([-18, -94, -8, -88, -12, -74], { w: 3, seed: S + 55 }) }); // ear
  eyes(ink, f, [34, -90, 0.72], null);
  ink.mouth(50, -28, 16, f, { open: 22, teeth: 'few', seed: S + 48, lw: 5 });
  tash(ink, 54, -46, 18);
  nose(ink, 66, -62, 16);
}

// prettier-ignore
function headBack(ink, wave) {
  ink.blob([-70, -40, -72, -100, -60, -140, -24, -162, 24, -162, 60, -140, 72, -100, 70, -40, 40, -6, 0, 0, -40, -6], T.skin, { seed: S + 49, ...FACE });
  ink.blob([-72, -40, -76, -96, -60, -86, -40, -56, 0, -46, 40, -56, 60, -86, 76, -96, 72, -40, 40, -8, 0, -2, -40, -8], T.hair, { lw: 0, seed: S + 50, hatch: { c: 'rgba(30,20,10,0.55)', n: 8, len: 14, gap: 4, k: 3, ang: 85 } });
  strands(ink, -24, 24, -150, wave);
  ink.brushStroke([-30, -2, 0, 6, 30, -2], { w: 4, seed: S + 51 }); // neck roll
}

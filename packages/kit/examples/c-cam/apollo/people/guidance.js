// Grim Ink person (kit-ext/people/guidance.js): "The Guidance Engineer" (mission control) of the
// C-CAM Apollo 11 film (docs/concepts/c-cam-style/films/03-apollo-11/js/cast/guidance.js), ported
// to the people module contract. A twenty-something stick insect: narrow shoulders, long arms, a
// pencil neck with a big Adam's apple. Long head with a flat-top crew cut, jug ears, heavy
// black-rimmed glasses that magnify his eyes, acne spots, a weak chin, two buck teeth. Dirty white
// short-sleeved shirt, pocket protector stuffed with pens, a skinny tie loosened, a headset.
const T = {
  skin: '#b4a17a',
  skinD: '#8a7954',
  hair: '#3a2e22',
  shirt: '#aea687',
  shirtD: '#857d62',
  slacks: '#5a4736',
  slacksD: '#3f3125',
  black: '#2a2623',
  blackD: '#1b1816',
  tie: '#46452a',
  linen: '#ada385',
  penRed: '#5f2c1c',
  penBlue: '#526068',
  tooth: '#cdbd8c',
  toothD: '#a08f5c',
};
const S = 610;
const NECK = [
  [0, -584, 0, -638],
  [6, -582, 14, -634],
  [14, -578, 32, -628],
  [0, -584, 0, -638],
];
// prettier-ignore
const SHIRTS = [
  [-22, -594, -58, -584, -66, -540, -62, -470, -60, -410, -56, -360, 0, -352, 56, -360, 60, -410, 62, -470, 66, -540, 58, -584, 22, -594],
  [-14, -596, -54, -586, -62, -540, -58, -470, -56, -410, -50, -360, 10, -352, 56, -360, 62, -410, 60, -470, 58, -540, 46, -586, 18, -596],
  [-4, -598, -32, -588, -40, -540, -36, -470, -34, -410, -32, -360, 30, -356, 40, -410, 42, -470, 40, -540, 32, -588, 12, -598],
  [-22, -594, -60, -584, -68, -540, -64, -470, -60, -410, -56, -360, 0, -354, 56, -360, 60, -410, 64, -470, 68, -540, 60, -584, 22, -594],
];
// prettier-ignore
const FACE = { lw: 7, shade: [T.skinD, -14, 8], mottle: ['rgba(150,110,60,0.3)', 5, 8], hatch: { c: 'rgba(60,50,30,0.35)', n: 3, len: 16, gap: 5, k: 3, ang: 75 } };
// prettier-ignore
const CREW = { lw: 5, hatch: { c: 'rgba(120,100,80,0.5)', n: 5, len: 14, gap: 4, k: 4, ang: 90, bend: 0 } };
const NOSE = { lw: 6, shade: [T.skinD, -4, 3] };
const ACNE = 'rgba(160,60,40,0.6)'; // acne spots (ink.pores)

export const person = {
  id: 'guidance',
  name: 'The Guidance Engineer',
  D: {
    sw: 44,
    sy: -566,
    sz: 4,
    l1a: 124,
    l2a: 116,
    hw: 24,
    hy: -350,
    l1l: 180,
    l2l: 160,
    elbowOut: 0.6,
    top: -830,
    waist: [52, -410],
    hsz: 34,
    head: { x: [0, 16, 34, 0], top: -830, bottom: -595, hw: 80 },
  },
  neck: NECK,
  headScale: 1.05,
  seed: S,
  tones: T,
  arm: {
    cloth: T.shirt,
    clothD: T.shirtD,
    w: [30, 26, 20],
    bare: 0,
    skin: T.skin,
    skinD: T.skinD,
    hsz: 34,
    lw: 6,
    cuff: T.shirtD,
    hatch: { c: 'rgba(40,34,20,0.45)', n: 2, len: 18, gap: 6, k: 3, ang: 30 },
  },
  leg: {
    cloth: T.slacks,
    clothD: T.slacksD,
    w: [32, 26, 22],
    shoe: T.black,
    shoeD: T.blackD,
    len: 70,
    sw: 24,
    lw: 6,
    splay: 0.3,
  },
  defaultExpr: 'focused',
  signatureGag: { kind: 'penClick', note: 'clicks a pocket-protector pen while the numbers run' },
  // prettier-ignore
  faceAnchors: [
    { chin: [0, 2], cheek: [30, -50], nose: [0, -64], mouth: [0, -30], ear: [62, -88], forehead: [0, -130] },
    { chin: [10, 4], cheek: [40, -50], nose: [28, -64], mouth: [22, -30], ear: [-50, -88], forehead: [6, -130] },
    { chin: [22, 0], cheek: [20, -50], nose: [52, -66], mouth: [34, -28], ear: [-12, -88], forehead: [4, -130] },
    { ear: [62, -88] },
  ],
  drawNeck(g, ink, view, n) {
    const base = NECK[view];
    // prettier-ignore
    ink.tube([n[0], n[1] + 6, n[2], n[3] + 14], [28, 26], T.skin, { lw: 6, seed: S + 59, shade: [T.skinD, -5, 0] });
    // Adam's apple.
    // prettier-ignore
    if (view < 3) ink.brushStroke([base[2] + view * 5, base[3] + 24, base[2] + 10 + view * 5, base[3] + 32, base[2] + 2 + view * 5, base[3] + 40], { w: 4, seed: S + 60 });
  },
  torso(g, ink, view) {
    shirt(ink, view);
  },
  head(g, ink, view, face) {
    if (view === 0) headFront(ink, face);
    else if (view === 1) head34(ink, face);
    else if (view === 2) headProfile(ink, face);
    else headBack(ink);
  },
};

// prettier-ignore
function shirt(ink, v) {
  const sh = SHIRTS[v];
  ink.blob([-50, -372, 50, -372, 52, -330, -52, -330].map((q, i) => (i % 2 === 0 && v === 2 ? q * 0.7 : q)), T.slacks, { lw: 6, seed: S + 40 + v }); // slacks top
  ink.blob(sh, T.shirt, { lw: 7, seed: S + v, shade: [T.shirtD, -18, 6], mottle: ['rgba(90,80,50,0.3)', 4, 16], hatch: { c: 'rgba(40,34,20,0.5)', n: 7, len: 34, gap: 7, k: 3, ang: -60 } });
  ink.brushStroke([sh[14], -366, 0, -358, sh[18], -366], { w: 8, color: T.black, seed: S + 5, taper: false });
  if (v === 3) {
    ink.brushStroke([0, -588, -2, -460, 2, -366], { w: 3.5, seed: S + 6 });
    return;
  }
  const x = [0, 14, 34][v];
  const k = [1, 0.8, 0.35][v];
  ink.blob([x - 4, -572, x + 4, -572, x + 10, -430, x + 2, -416, x - 4, -430], T.tie, { lw: 4, seed: S + 7 }); // tie, loosened
  ink.blob([x - 22, -594, x, -570, x - 14, -562], T.shirt, { lw: 4, seed: S + 8 });
  ink.blob([x + 22, -594, x, -570, x + 14, -562], T.shirt, { lw: 4, seed: S + 9 });
  if (v < 2) {
    ink.rect(x + 18 * k, -540, 30 * k, 40, T.linen, { seed: S + 10, lw: 4, amp: 1 }); // pocket protector
    [T.black, T.penRed, T.penBlue, T.black].forEach((col, i) => ink.tube([x + 22 * k + i * 7 * k, -552, x + 22 * k + i * 7 * k, -526], [5, 5], col, { lw: 2.5, seed: S + 11 + i }));
  }
  ink.stain(x - 30 * k, -470, 30, 26, S + 16, 'rgba(80,70,40,0.3)');
}

// Thick black rims round magnified eyes (drawn over them).
// prettier-ignore
function glasses(ink, a, b, bridge) {
  [a, b].forEach((r, i) => { if (r) ink.inkLine(ink.curve(ink.ellipseRing(r[0], r[1], r[2], 22, 10), true, 4), { w: 9, closed: true, seed: S + 20 + i, color: T.black }); });
  if (bridge) ink.brushStroke(bridge, { w: 7, color: T.black, seed: S + 22, taper: false });
}

// prettier-ignore
function eyes(ink, f, a, b) {
  ink.eye(a[0], a[1], 15 * a[2], 17, f, { skin: T.skin, seed: S + 23, lw: 5, side: 0, bag: false });
  ink.brow(a[0], a[1] - 34, 26 * a[2], -1, f, { u: 18, thick: 8, color: T.hair, seed: S + 24 });
  if (!b) return;
  ink.eye(b[0], b[1], 15 * b[2], 17, f, { skin: T.skin, seed: S + 25, lw: 5, side: 1, bag: false });
  ink.brow(b[0], b[1] - 34, 26 * b[2], 1, f, { u: 18, thick: 8, color: T.hair, seed: S + 26 });
}

// Jug ear; s = the side it sticks out to.
// prettier-ignore
function ear(ink, x, y, s, seed) {
  ink.blob([x, y - 24, x + s * 34, y - 36, x + s * 40, y - 6, x + s * 28, y + 20, x, y + 14], T.skin, { lw: 6, seed, shade: [T.skinD, -s * 6, 2], inner: () => ink.brushStroke([x + s * 12, y - 20, x + s * 26, y - 12, x + s * 18, y + 8], { w: 3, seed: seed + 1 }) });
}

// prettier-ignore
function teeth(ink, x, y) {
  [-1, 1].forEach((s, i) => ink.blob([x + s, y - 4, x + s * 11, y - 4, x + s * 10, y + 10, x + s * 2, y + 11], T.tooth, { sharp: true, lw: 3, seed: S + 27 + i, shade: [T.toothD, -2, 0] }));
}

// prettier-ignore
function headset(ink, band, cup, mic) {
  ink.brushStroke(band, { w: 7, color: T.black, seed: S + 29, taper: false });
  ink.blob(ink.ellipseRing(cup[0], cup[1], 12, 16, 8), T.black, { lw: 4, seed: S + 30 });
  if (mic) ink.brushStroke([cup[0], cup[1] + 10].concat(mic), { w: 5, color: T.blackD, seed: S + 31, taper: false });
}

// prettier-ignore
function headFront(ink, f) {
  const jaw = f.jaw * 16;
  ear(ink, -44, -88, -1, S + 32);
  ear(ink, 44, -88, 1, S + 34);
  ink.blob([-36, -16 + jaw, -44, -70, -46, -130, -38, -160, 0, -170, 38, -160, 46, -130, 44, -70, 36, -16 + jaw, 16, 4 + jaw, 0, 8 + jaw, -16, 4 + jaw], T.skin, { seed: S + 36, ...FACE });
  ink.blob([-46, -140, -48, -196, 48, -196, 46, -140, 30, -150, 0, -146, -30, -150], T.hair, { seed: S + 37, ...CREW });
  ink.pores(-34, -60, 66, 30, 9, S + 38, ACNE);
  eyes(ink, f, [-20, -98, 1], [20, -98, 1]);
  glasses(ink, [-20, -98, 21], [20, -98, 21], [-2, -102, 2, -102]);
  ink.mouth(0, -30, 30, f, { open: 24, teeth: 'none', seed: S + 39, lw: 5 });
  teeth(ink, 0, -30);
  ink.blob([-6, -84, 6, -84, 10, -56, 0, -50, -10, -56], T.skin, { seed: S + 40, ...NOSE });
  headset(ink, [-48, -110, -50, -170, 0, -204, 50, -170, 48, -110], [50, -96], [44, -40, 20, -28]);
}

// prettier-ignore
function head34(ink, f) {
  const jaw = f.jaw * 16;
  ear(ink, -32, -88, -1, S + 41);
  ink.blob([-30, -14 + jaw, -40, -70, -42, -132, -32, -162, 6, -172, 40, -160, 52, -128, 54, -96, 58, -72, 50, -16 + jaw, 30, 4 + jaw, 10, 8 + jaw, -10, 4 + jaw], T.skin, { seed: S + 42, ...FACE });
  ink.blob([-42, -140, -44, -196, 52, -196, 52, -140, 34, -150, 6, -146, -24, -150], T.hair, { seed: S + 43, ...CREW });
  ink.pores(-22, -60, 60, 30, 9, S + 44, ACNE);
  eyes(ink, f, [-2, -98, 1], [38, -98, 0.66]);
  glasses(ink, [-2, -98, 21], [38, -98, 14], [18, -102, 26, -102]);
  ink.mouth(22, -30, 26, f, { open: 22, teeth: 'none', seed: S + 45, lw: 5 });
  teeth(ink, 24, -30);
  ink.blob([18, -84, 28, -84, 40, -58, 28, -50, 16, -56], T.skin, { seed: S + 46, ...NOSE });
  headset(ink, [-40, -110, -42, -172, 8, -204, 46, -176], [-42, -96], [-30, -40, 6, -28]);
}

// prettier-ignore
function headProfile(ink, f) {
  const jaw = f.jaw * 16;
  ink.blob([-26, -8, -46, -50, -50, -126, -36, -160, 4, -172, 34, -158, 44, -128, 46, -108, 44, -94, 50, -80, 46, -60, 42, -46, 44, -30, 36, -14 + jaw, 22, 2 + jaw, 4, 8 + jaw, -10, 0], T.skin, { seed: S + 47, ...FACE });
  ink.blob([-52, -120, -52, -192, 40, -196, 40, -140, 10, -146, -20, -140], T.hair, { seed: S + 48, ...CREW });
  ear(ink, -12, -88, -1, S + 49);
  ink.pores(0, -64, 30, 26, 6, S + 50, ACNE);
  eyes(ink, f, [28, -98, 0.7], null);
  glasses(ink, [28, -98, 13], null, [16, -102, -12, -100]);
  ink.mouth(34, -28, 14, f, { open: 20, teeth: 'none', seed: S + 51, lw: 5 });
  teeth(ink, 40, -28);
  ink.blob([40, -86, 52, -80, 62, -60, 46, -54], T.skin, { seed: S + 52, ...NOSE });
  headset(ink, [-16, -110, -20, -180, 4, -204], [-14, -96], [-2, -40, 34, -26]);
}

// prettier-ignore
function headBack(ink) {
  ear(ink, -44, -88, -1, S + 53);
  ear(ink, 44, -88, 1, S + 55);
  ink.blob([-36, -10, -44, -70, -46, -130, -38, -160, 0, -170, 38, -160, 46, -130, 44, -70, 36, -10, 0, 0], T.skin, { seed: S + 57, ...FACE });
  ink.blob([-48, -60, -48, -196, 48, -196, 48, -60, 30, -40, 0, -36, -30, -40], T.hair, { seed: S + 58, ...CREW, lw: 0 });
  headset(ink, [-48, -110, -50, -170, 0, -204, 50, -170, 48, -110], [-50, -96], null);
}

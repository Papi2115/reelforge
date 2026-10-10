// Grim Ink person (kit-ext/people/director.js): "The Flight Director" of the C-CAM Apollo 11 film
// (docs/concepts/c-cam-style/films/03-apollo-11/js/cast/director.js), ported to the people module
// contract. A barrel on short legs: thick sloped shoulders, a gut over the belt that leads in
// profile, a bull neck. Big bald dome with a grey horseshoe fringe, jowls, a heavy brow ridge, a
// fleshy nose with broken veins, a double chin, stubble, a cigarette burn on the collar. Dirty
// white short-sleeved shirt, sweat patches, a skinny black tie, a pen pocket, grey-blue slacks,
// a headset with one earpiece and a mic boom.
// Shot props (p): mug (tilt in degrees; the cup in the right hand), steam, sip (mug arm in front).
const T = {
  skin: '#b07a62',
  skinD: '#86533f',
  hair: '#8f897a',
  shirt: '#b2a989',
  shirtD: '#8a8166',
  slacks: '#3a454c',
  slacksD: '#2b343a',
  black: '#2a2623',
  blackD: '#1b1816',
  clip: '#7d7766',
  pen: '#526068',
  burn: '#3a2a1c',
  nose: '#b26a52',
  noseL: '#c98a70',
  vein: '#7c1f19',
};
const S = 510;
const NECK = [
  [0, -556, 0, -592],
  [8, -554, 14, -590],
  [16, -550, 30, -586],
  [0, -556, 0, -592],
];
// prettier-ignore
const SHIRTS = [
  [-30, -570, -84, -558, -104, -520, -100, -460, -106, -400, -96, -344, -60, -330, 0, -326, 60, -330, 96, -344, 106, -400, 100, -460, 104, -520, 84, -558, 30, -570],
  [-20, -572, -80, -560, -100, -520, -96, -460, -100, -400, -90, -344, -54, -330, 14, -326, 72, -332, 106, -356, 116, -410, 104, -470, 96, -524, 70, -560, 24, -572],
  [-6, -574, -46, -562, -62, -520, -58, -460, -54, -400, -50, -350, -30, -330, 60, -330, 96, -360, 108, -410, 92, -470, 70, -520, 52, -560, 22, -574],
  [-30, -570, -86, -558, -106, -520, -102, -460, -106, -400, -96, -344, -60, -330, 0, -328, 60, -330, 96, -344, 106, -400, 102, -460, 106, -520, 86, -558, 30, -570],
];
// prettier-ignore
const PANTS = [[-80, -350, 80, -350, 84, -300, -84, -300], [-74, -350, 84, -350, 88, -300, -78, -300], [-48, -350, 60, -350, 62, -300, -52, -300], [-80, -350, 80, -350, 84, -300, -84, -300]];
// prettier-ignore
const BELT = [[-92, -346, 0, -338, 92, -346], [-86, -346, 16, -336, 98, -350], [-50, -348, 40, -340, 70, -350], [-92, -346, 0, -340, 92, -346]];
// prettier-ignore
const FACE = { lw: 7, shade: [T.skinD, -16, 10], mottle: ['#9a6650', 6, 12], hatch: { c: 'rgba(60,24,12,0.4)', n: 4, len: 18, gap: 5, k: 3, ang: 70 } };
const STUB = 'rgba(60,50,40,0.55)';
// prettier-ignore
const FRINGE = { lw: 5, seed: S + 20, hatch: { c: 'rgba(40,36,30,0.55)', n: 3, len: 14, gap: 4, k: 3, ang: 80 } };

export const person = {
  id: 'director',
  name: 'The Flight Director',
  D: {
    sw: 70,
    sy: -540,
    sz: 10,
    l1a: 112,
    l2a: 104,
    hw: 40,
    hy: -320,
    l1l: 158,
    l2l: 142,
    elbowOut: 0.8,
    top: -800,
    waist: [92, -380],
    hsz: 38,
    head: { x: [0, 18, 36, 0], top: -800, bottom: -566, hw: 86 },
  },
  neck: NECK,
  headScale: 1.05,
  seed: S,
  tones: T,
  arm: {
    cloth: T.shirt,
    clothD: T.shirtD,
    w: [46, 40, 32],
    bare: 0,
    skin: T.skin,
    skinD: T.skinD,
    hsz: 38,
    lw: 6,
    cuff: T.shirtD,
    hair: true,
    hatch: { c: 'rgba(40,34,20,0.45)', n: 3, len: 20, gap: 6, k: 3, ang: 30 },
  },
  leg: {
    cloth: T.slacks,
    clothD: T.slacksD,
    w: [52, 42, 36],
    shoe: T.black,
    shoeD: T.blackD,
    len: 70,
    sw: 30,
    lw: 6,
    splay: 0.4,
  },
  defaultExpr: 'deadpan',
  signatureGag: { kind: 'sip', note: 'never without his coffee; sips before every hard call' },
  // prettier-ignore
  faceAnchors: [
    { chin: [0, 8], cheek: [44, -40], nose: [0, -64], mouth: [0, -30], ear: [72, -84], forehead: [0, -140] },
    { chin: [14, 8], cheek: [58, -40], nose: [30, -64], mouth: [28, -30], ear: [-60, -84], forehead: [10, -140] },
    { chin: [24, 10], cheek: [34, -40], nose: [64, -62], mouth: [46, -30], ear: [-16, -86], forehead: [10, -140] },
    { ear: [70, -86] },
  ],
  drawNeck(g, ink, view, n) {
    // prettier-ignore
    ink.tube([n[0], n[1] + 6, n[2], n[3] + 18], [70, 66], T.skin, { lw: 6, seed: S + 54, shade: [T.skinD, -8, 0] });
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
  // The mug in the right hand grips it; a sip brings that arm in front of the face.
  arms(p) {
    return p.mug === undefined ? undefined : { R: { hand: 'grip', front: Boolean(p.sip) } };
  },
  held(g, ink, side, palm, p) {
    if (side !== 'R' || p.mug === undefined) return;
    const steam = p.steam ? Math.floor(ink.time.twos(p.t) * 3) % 2 : 0;
    ink.mug(palm[0] + 6, palm[1] - 4, p.mug, S + 60, steam);
  },
};

// prettier-ignore
function shirt(ink, v) {
  ink.blob(PANTS[v], T.slacks, { lw: 7, seed: S + 40 + v, shade: [T.slacksD, -10, 4] });
  ink.blob(SHIRTS[v], T.shirt, { lw: 7, seed: S + v, shade: [T.shirtD, -22, 8], mottle: ['rgba(90,80,50,0.3)', 5, 18], hatch: { c: 'rgba(40,34,20,0.5)', n: 9, len: 38, gap: 7, k: 3, ang: -60 } });
  ink.brushStroke(BELT[v], { w: 12, color: T.black, seed: S + 5, taper: false });
  if (v === 3) {
    ink.brushStroke([-40, -560, 0, -548, 40, -560], { w: 4, seed: S + 6 });
    ink.stain(0, -470, 70, 60, S + 7, 'rgba(90,80,40,0.35)');
    return;
  }
  const x = [0, 20, 54][v];
  const k = [1, 0.8, 0.35][v];
  ink.blob([x - 4, -560, x + 4, -560, x + 8, -380, x, -364, x - 8, -380], T.black, { lw: 4, seed: S + 8 }); // tie
  ink.rect(x - 9, -470, 18, 6, T.clip, { seed: S + 9, lw: 2, amp: 0.5 }); // tie clip
  ink.blob([x - 30, -572, x - 2, -548, x - 20, -540], T.shirt, { lw: 4, seed: S + 10 }); // collar
  ink.blob([x + 30, -572, x + 2, -548, x + 20, -540], T.shirt, { lw: 4, seed: S + 11 });
  if (v < 2) {
    ink.rect(x - 70 * k, -520, 34 * k, 36, T.shirtD, { seed: S + 12, lw: 4, amp: 1.5 });
    [0, 1].forEach((i) => ink.tube([x - 62 * k + i * 12 * k, -530, x - 61 * k + i * 12 * k, -506], [5, 5], i ? T.pen : T.black, { lw: 2.5, seed: S + 13 + i }));
    ink.stain(x + 70 * k, -500, 40, 50, S + 15, 'rgba(110,96,50,0.35)'); // sweat patch
  }
  ink.brushStroke([x - 30 * k, -400, x + 20 * k, -380, x + 70 * k, -396], { w: 3.5, seed: S + 16 }); // gut fold
  ink.blob(ink.ellipseRing(x + 22 * k, -556, 4, 3, 6), T.burn, { lw: 0, seed: S + 17 }); // burn mark
}

// prettier-ignore
function headset(ink, band, cup, mic) {
  ink.brushStroke(band, { w: 8, color: T.black, seed: S + 21, taper: false });
  ink.blob(ink.ellipseRing(cup[0], cup[1], 14, 18, 8), T.black, { lw: 4, seed: S + 22 });
  if (!mic) return;
  ink.brushStroke([cup[0], cup[1] + 12].concat(mic), { w: 5, color: T.blackD, seed: S + 23, taper: false });
  ink.blob(ink.ellipseRing(mic[mic.length - 2], mic[mic.length - 1], 7, 6, 6), T.black, { lw: 3, seed: S + 24 });
}

// prettier-ignore
function eyes(ink, f, a, b) {
  ink.eye(a[0], a[1], 11 * a[2], 12, f, { skin: T.skin, seed: S + 25, lw: 5, side: 0, bags: 2 });
  ink.brow(a[0], a[1] - 22, 32 * a[2], -1, f, { u: 18, thick: 11, color: T.hair, seed: S + 26 });
  if (!b) return;
  ink.eye(b[0], b[1], 12 * b[2], 13, f, { skin: T.skin, seed: S + 27, lw: 5, side: 1, bags: 2 });
  ink.brow(b[0], b[1] - 22, 32 * b[2], 1, f, { u: 18, thick: 11, color: T.hair, seed: S + 28 });
}

// Fleshy nose: a flat red patch and a broken vein.
// prettier-ignore
function nose(ink, pts, vx, vy) {
  ink.blob(pts, T.nose, { lw: 6, seed: S + 29, shade: [T.skinD, -6, 5], patch: [T.noseL, 4, -8, 0.3] });
  ink.blob(ink.ellipseRing(vx, vy, 9, 6, 7), 'rgba(150,40,30,0.45)', { lw: 0, seed: S + 30 });
  ink.brushStroke([vx - 6, vy, vx + 2, vy - 3, vx + 7, vy + 2], { w: 2, color: T.vein, seed: S + 31, taper: false });
}

// prettier-ignore
function headFront(ink, f) {
  const jaw = f.jaw * 14;
  ink.blob([-60, -20 + jaw, -68, -70, -66, -130, -44, -164, 0, -172, 44, -164, 66, -130, 68, -70, 60, -20 + jaw, 40, 6 + jaw, 0, 14 + jaw, -40, 6 + jaw], T.skin, { seed: S + 32, ...FACE });
  ink.stubble([-58, -50, -50, 0 + jaw, 0, 14 + jaw, 50, 0 + jaw, 58, -50, 30, -40, -30, -40], S + 33, 70, STUB);
  [-1, 1].forEach((s, i) => ink.blob([s * 64, -92, s * 70, -130, s * 56, -152, s * 54, -128, s * 58, -100], T.hair, { ...FRINGE, seed: S + 34 + i }));
  [-1, 1].forEach((s, i) => ink.blob([s * 64, -100, s * 80, -106, s * 84, -76, s * 70, -60], T.skin, { lw: 5, seed: S + 36 + i, shade: [T.skinD, -4 * s, 2] })); // ears
  ink.brushStroke([-50, -6 + jaw, -36, 8 + jaw], { w: 3.5, seed: S + 38 }); // jowls
  ink.brushStroke([50, -6 + jaw, 36, 8 + jaw], { w: 3.5, seed: S + 39 });
  [-140, -150].forEach((y, i) => ink.brushStroke([-24, y + i * 2, 0, y - 4, 24, y], { w: 3, seed: S + 40 + i }));
  eyes(ink, f, [-24, -98, 1], [24, -98, 1]);
  ink.mouth(0, -30, 46, f, { open: 28, teeth: 'few', seed: S + 42, lw: 5 });
  nose(ink, [-12, -92, 12, -92, 18, -66, 22, -54, 0, -48, -22, -54, -18, -66], 6, -60);
  headset(ink, [-70, -96, -60, -154, 0, -176, 60, -154, 70, -96], [72, -86], [60, -40, 30, -28]);
}

// prettier-ignore
function head34(ink, f) {
  const jaw = f.jaw * 14;
  ink.blob([-54, -20 + jaw, -62, -70, -60, -130, -36, -166, 10, -172, 50, -160, 70, -128, 76, -96, 74, -70, 70, -20 + jaw, 48, 6 + jaw, 12, 14 + jaw, -30, 6 + jaw], T.skin, { seed: S + 43, ...FACE });
  ink.stubble([-44, -50, -38, 0 + jaw, 12, 14 + jaw, 62, 0 + jaw, 70, -50, 44, -40, -14, -40], S + 44, 70, STUB);
  ink.blob([-58, -56, -66, -118, -46, -138, -40, -96, -46, -56], T.hair, FRINGE);
  ink.blob([-50, -100, -66, -106, -70, -76, -54, -60], T.skin, { lw: 5, seed: S + 45, shade: [T.skinD, 4, 2] });
  ink.brushStroke([-34, -6 + jaw, -20, 8 + jaw], { w: 3.5, seed: S + 46 });
  eyes(ink, f, [-2, -98, 1], [48, -98, 0.64]);
  ink.mouth(28, -30, 40, f, { open: 26, teeth: 'few', seed: S + 47, lw: 5 });
  nose(ink, [16, -92, 32, -92, 42, -66, 48, -54, 28, -48, 12, -54, 14, -66], 32, -60);
  headset(ink, [-58, -96, -46, -158, 10, -176, 56, -158], [-60, -86], [-44, -40, 0, -26]);
}

// prettier-ignore
function headProfile(ink, f) {
  const jaw = f.jaw * 14;
  ink.blob([-44, -10, -66, -60, -68, -126, -44, -164, 2, -174, 40, -156, 56, -126, 58, -104, 54, -90, 60, -60, 56, -30 + jaw, 46, 4 + jaw, 20, 16 + jaw, -10, 10, -30, 2], T.skin, { seed: S + 48, ...FACE });
  ink.stubble([0, -50, 6, 6 + jaw, 50, 2 + jaw, 56, -40, 30, -44], S + 49, 50, STUB);
  ink.blob([-64, -60, -70, -112, -52, -120, -42, -96, -48, -62], T.hair, FRINGE);
  headset(ink, [-20, -100, -26, -170, -10, -186], [-16, -86], [-4, -40, 44, -28]);
  eyes(ink, f, [34, -98, 0.72], null);
  ink.mouth(46, -30, 18, f, { open: 22, teeth: 'few', seed: S + 50, lw: 5 });
  nose(ink, [50, -96, 64, -90, 74, -66, 78, -50, 60, -46, 50, -56], 66, -60);
}

// prettier-ignore
function headBack(ink) {
  ink.blob([-60, -14, -68, -70, -66, -130, -44, -164, 0, -172, 44, -164, 66, -130, 68, -70, 60, -14, 0, 0], T.skin, { seed: S + 51, ...FACE });
  ink.blob([-68, -40, -72, -110, -50, -100, -30, -66, 0, -58, 30, -66, 50, -100, 72, -110, 68, -40, 30, -10, 0, -6, -30, -10], T.hair, { ...FRINGE, lw: 0 });
  headset(ink, [-70, -96, -60, -154, 0, -176, 60, -154, 70, -96], [-72, -86], null);
  [-1, 1].forEach((s, i) => ink.brushStroke([s * 40, -2, s * 6, 6], { w: 4, seed: S + 52 + i })); // neck rolls
}

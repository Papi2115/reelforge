// Grim Ink person (kit-ext/people/champion.js): "The Champion", the gladiator who has just won his
// freedom. Axis: a huge slab of a jaw (twice the width of his skull) under a tiny dented bronze
// helmet that sits on top of his head like a cup. Barrel chest, bare scarred torso, a wide leather
// belt over a dirty linen loincloth, a linen wrap on both wrists, an iron slave collar, sandals.
// Shot props (p): rudis (the wooden sword in the right hand; angle in degrees), coins (n coins in
// the right palm), sword (a real iron sword in the right hand, angle), sand (0..1 sand on his
// shins after a fall).
const T = {
  skin: '#b27556',
  skinD: '#87513a',
  scar: '#d8a68a',
  cloth: '#9a5a3c',
  clothD: '#6e3c27',
  belt: '#5d3f2a',
  beltD: '#3c281a',
  bronze: '#9c7a3c',
  bronzeD: '#6e5326',
  iron: '#5e5f5c',
  ironD: '#3d3d3b',
  sandal: '#6b4a32',
  sandalD: '#45301f',
  brow: '#2b2018',
  nose: '#c4876a',
};
const S = 5200;
const FACE = {
  lw: 7,
  shade: [T.skinD, -14, 8],
  mottle: ['#9a5f45', 6, 14],
  hatch: { c: 'rgba(60,24,12,0.4)', n: 4, len: 18, gap: 5, k: 3, ang: 70 },
};
const NOSE = { lw: 6, shade: [T.skinD, -6, 5], patch: [T.nose, 4, -8, 0.3] };
const STUB = 'rgba(32,22,16,0.7)';

// Bare barrel chest per view (figure space, feet at 0): front, three-quarter, profile, back.
// prettier-ignore
const CHEST = [
  [-40, -548, -96, -536, -112, -500, -108, -440, -92, -380, -62, -346, 0, -340, 62, -346, 92, -380, 108, -440, 112, -500, 96, -536, 40, -548],
  [-30, -548, -88, -536, -104, -500, -98, -440, -84, -380, -56, -346, 12, -340, 70, -348, 96, -384, 104, -446, 100, -504, 80, -538, 30, -550],
  [-20, -550, -58, -536, -66, -490, -58, -430, -54, -380, -38, -346, 36, -342, 74, -370, 86, -430, 80, -494, 58, -538, 20, -552],
  [-40, -548, -98, -536, -114, -500, -110, -440, -94, -380, -62, -346, 0, -342, 62, -346, 94, -380, 110, -440, 114, -500, 98, -536, 40, -548],
];
// Loincloth under the belt (none drawn differently on the back: same shape).
// prettier-ignore
const CLOTH = [
  [-70, -360, 70, -360, 74, -300, 34, -258, 0, -276, -34, -258, -74, -300],
  [-60, -360, 78, -362, 80, -300, 44, -256, 8, -274, -28, -260, -64, -302],
  [-40, -360, 70, -362, 72, -300, 50, -262, 10, -270, -36, -300],
  [-72, -360, 72, -360, 76, -296, 0, -284, -76, -296],
];
// prettier-ignore
const BELT = [
  [-80, -372, 0, -380, 80, -372, 82, -340, 0, -346, -82, -340],
  [-70, -372, 14, -380, 88, -372, 90, -340, 14, -348, -72, -340],
  [-44, -374, 20, -380, 78, -372, 78, -340, 20, -346, -44, -340],
  [-82, -372, 0, -380, 82, -372, 84, -340, 0, -346, -84, -340],
];
const COLLAR_X = [0, 10, 22, 0];

export const person = {
  id: 'champion',
  name: 'The Champion',
  D: {
    sw: 76,
    sy: -500,
    sz: 8,
    l1a: 124,
    l2a: 116,
    hw: 36,
    hy: -350,
    l1l: 168,
    l2l: 156,
    elbowOut: 0.6,
    top: -884,
    waist: [84, -380],
    hsz: 44,
    head: { x: [0, 20, 34, 0], top: -884, bottom: -560, hw: 100 },
  },
  neck: [
    [0, -520, 0, -626],
    [6, -520, 10, -626],
    [12, -520, 22, -624],
    [0, -520, 0, -626],
  ],
  headScale: 1.1,
  seed: S,
  tones: T,
  arm: {
    cloth: T.skin,
    clothD: T.skinD,
    w: [54, 46, 38],
    skin: T.skin,
    skinD: T.skinD,
    hsz: 44,
    lw: 7,
    cuff: '#cfc3a2',
    hair: true,
    hatch: { c: 'rgba(60,24,12,0.35)', n: 3, len: 20, gap: 6, k: 3, ang: 30 },
  },
  leg: {
    cloth: T.skin,
    clothD: T.skinD,
    w: [52, 42, 32],
    shoe: T.sandal,
    shoeD: T.sandalD,
    len: 66,
    sw: 76,
    lw: 7,
    splay: 0.35,
    hatch: { c: 'rgba(60,24,12,0.35)', n: 3, len: 24, gap: 7, k: 3, ang: 80 },
  },
  defaultExpr: 'deadpan',
  // The one recurring tic: his sword hand twitches for a hilt that is not there.
  signatureGag: {
    kind: 'fidget',
    note: 'his sword hand keeps twitching for a hilt that is not there',
  },
  // prettier-ignore
  faceAnchors: [
    { chin: [0, 22], cheek: [48, -40], nose: [0, -66], mouth: [0, -20], ear: [58, -90], forehead: [0, -126] },
    { chin: [18, 22], cheek: [60, -40], nose: [44, -66], mouth: [28, -20], ear: [-42, -90], forehead: [16, -126] },
    { chin: [40, 18], cheek: [30, -40], nose: [74, -68], mouth: [52, -22], ear: [-10, -92], forehead: [24, -126] },
    { ear: [58, -90] },
  ],
  drawNeck(g, ink, view, n) {
    ink.tube([n[0], n[1] + 6, n[2], n[3] + 20], [96, 88], T.skin, {
      lw: 7,
      seed: S + 1,
      shade: [T.skinD, -12, 0],
    });
  },
  torso(g, ink, view) {
    // prettier-ignore
    ink.blob(CHEST[view], T.skin, { lw: 8, seed: S + 10 + view, shade: [T.skinD, -26, 8], mottle: ['#a06446', 6, 20], hatch: { c: 'rgba(60,24,12,0.35)', n: 6, len: 36, gap: 7, k: 3, ang: -64 } });
    ink.blob(CLOTH[view], T.cloth, {
      lw: 6,
      seed: S + 20 + view,
      shade: [T.clothD, -10, 6],
      mottle: ['#7a4430', 5, 18],
    });
    ink.blob(BELT[view], T.belt, {
      lw: 6,
      seed: S + 30 + view,
      shade: [T.beltD, 0, 6],
    });
    collar(ink, view);
    if (view === 3) {
      ink.brushStroke([0, -540, -4, -470, 0, -390], { w: 4, seed: S + 35 });
      ink.brushStroke([-70, -500, -30, -470], {
        w: 3,
        color: T.scar,
        seed: S + 36,
        taper: false,
      });
      return;
    }
    const x = [0, 18, 40][view];
    const k = [1, 0.8, 0.45][view];
    // Pecs, belly line and two old scars.
    ink.brushStroke([x - 70 * k, -470, x - 30 * k, -456, x - 4, -470], {
      w: 4,
      seed: S + 37,
    });
    ink.brushStroke([x + 6, -470, x + 34 * k, -456, x + 70 * k, -472], {
      w: 4,
      seed: S + 38,
    });
    ink.brushStroke([x - 20 * k, -410, x, -398, x + 20 * k, -410], {
      w: 3.5,
      seed: S + 39,
    });
    ink.brushStroke([x - 60 * k, -510, x - 10 * k, -440], {
      w: 3,
      color: T.scar,
      seed: S + 40,
      taper: false,
    });
    ink.brushStroke([x + 40 * k, -430, x + 76 * k, -400], {
      w: 3,
      color: T.scar,
      seed: S + 41,
      taper: false,
    });
    ink.blob(ink.ellipseRing(x + 52 * k, -356, 12, 12, 8), T.bronze, {
      lw: 4,
      seed: S + 42,
      shade: [T.bronzeD, 2, 3],
    });
  },
  head(g, ink, view, face) {
    if (view === 0) headFront(ink, face);
    else if (view === 1) head34(ink, face);
    else if (view === 2) headProfile(ink, face);
    else headBack(ink);
  },
  arms(p) {
    const holds = p.rudis !== undefined || p.sword !== undefined || p.coins !== undefined;
    return holds ? { R: { hand: p.coins !== undefined ? 'open' : 'grip' } } : undefined;
  },
  held(g, ink, side, palm, p) {
    if (side !== 'R') return;
    const [x, y] = palm;
    if (p.rudis !== undefined) {
      ink.props.weapon({
        x,
        y,
        kind: 'sword',
        rot: p.rudis,
        size: 0.9,
        tone: 'paleWood',
        wear: 0.2,
        seed: S + 50,
      });
    } else if (p.sword !== undefined) {
      ink.props.weapon({
        x,
        y,
        kind: 'sword',
        rot: p.sword,
        size: 1,
        tone: 'iron',
        wear: 0.6,
        gleam: 0.4,
        seed: S + 51,
      });
    } else if (p.coins !== undefined) {
      ink.props.coins({
        x,
        y: y - 10,
        n: p.coins,
        spread: 'fan',
        size: 0.8,
        seed: S + 52,
      });
    }
  },
};

// The iron slave collar round the base of the neck (part of the torso, under the head).
function collar(ink, view) {
  const x = COLLAR_X[view];
  ink.blob(ink.ellipseRing(x, -552, view === 2 ? 40 : 54, 14, 12), T.iron, {
    lw: 6,
    seed: S + 2,
    shade: [T.ironD, 0, 5],
    hatch: { c: 'rgba(20,20,18,0.5)', n: 3, len: 10, gap: 6, k: 3, ang: 80 },
  });
  if (view < 3)
    ink.blob(ink.ellipseRing(x + 4, -536, 9, 11, 8), T.iron, {
      lw: 4,
      seed: S + 3,
    });
}

// The tiny dented bronze helmet: a cup perched on the top of the skull with a stubby crest.
// prettier-ignore
function helmet(ink, x, y, w) {
  ink.blob([x - w, y, x - w * 0.9, y - 34, x - w * 0.4, y - 52, x + w * 0.4, y - 52, x + w * 0.9, y - 34, x + w, y, x, y + 6], T.bronze, { lw: 6, seed: S + 60, shade: [T.bronzeD, -8, 6], hatch: { c: 'rgba(40,26,8,0.45)', n: 3, len: 16, gap: 5, k: 3, ang: 70 } });
  ink.brushStroke([x - w * 0.3, y - 30, x - w * 0.1, y - 22, x + w * 0.05, y - 30], { w: 3, seed: S + 61 });
  ink.blob([x - 6, y - 50, x - 4, y - 74, x + 10, y - 76, x + 12, y - 50], T.bronzeD, { lw: 5, seed: S + 62 });
}

// Small heavy-lidded eyes under one shelf of a brow, set high above the jaw.
// prettier-ignore
function eyes(ink, f, a, b) {
  ink.eye(a[0], a[1], 10 * a[2], 10, f, { skin: T.skin, seed: S + 63, lw: 5, side: 0, bags: 2, lidAdd: 0.12 });
  ink.brow(a[0], a[1] - 18, 30 * a[2], -1, f, { thick: 14, color: T.brow, seed: S + 64 });
  if (!b) return;
  ink.eye(b[0], b[1], 9 * b[2], 10, f, { skin: T.skin, seed: S + 65, lw: 5, side: 1, bags: 2, lidAdd: 0.12 });
  ink.brow(b[0], b[1] - 18, 30 * b[2], 1, f, { thick: 14, color: T.brow, seed: S + 66 });
}

// prettier-ignore
function headFront(ink, f) {
  const jaw = f.jaw * 12;
  ink.blob([-40, -150, 0, -160, 40, -150, 56, -110, 74, -60, 82, -16 + jaw, 64, 14 + jaw, 0, 24 + jaw, -64, 14 + jaw, -82, -16 + jaw, -74, -60, -56, -110], T.skin, { seed: S + 70, ...FACE });
  ink.stubble([-76, -40, -70, 10 + jaw, 0, 22 + jaw, 70, 10 + jaw, 76, -40, 40, -34, -40, -34], S + 71, 160, STUB);
  helmet(ink, 0, -146, 34);
  eyes(ink, f, [-20, -96, 1], [20, -96, 1]);
  ink.brushStroke([-56, -50, -62, -20, -54, 4 + jaw], { w: 3.5, seed: S + 72 });
  ink.brushStroke([56, -50, 62, -20, 54, 4 + jaw], { w: 3.5, seed: S + 73 });
  ink.blob([-8, -90, 8, -90, 14, -62, 20, -50, 0, -44, -20, -50, -14, -62], T.skin, { seed: S + 74, ...NOSE });
  ink.mouth(0, -18 + jaw * 0.5, 54, f, { seed: S + 75, teeth: 'snag', lw: 5 });
  ink.brushStroke([30, -12 + jaw, 46, 6 + jaw], { w: 3, color: T.scar, seed: S + 76, taper: false });
  ink.wart(-46, -30, 6, T.skinD, S + 77, true);
}

// prettier-ignore
function head34(ink, f) {
  const jaw = f.jaw * 12;
  ink.blob([-32, -150, 8, -162, 46, -150, 64, -112, 84, -64, 92, -16 + jaw, 74, 14 + jaw, 18, 26 + jaw, -48, 16 + jaw, -66, -16 + jaw, -60, -60, -48, -112], T.skin, { seed: S + 80, ...FACE });
  ink.stubble([-58, -40, -50, 10 + jaw, 18, 24 + jaw, 84, 10 + jaw, 88, -40, 50, -34, -20, -34], S + 81, 160, STUB);
  ink.blob(ink.ellipseRing(-44, -90, 10, 18, 8), T.skin, { lw: 5, seed: S + 82, shade: [T.skinD, -4, 2] });
  helmet(ink, 10, -148, 32);
  eyes(ink, f, [6, -96, 1], [44, -96, 0.66]);
  ink.brushStroke([-36, -50, -42, -20, -34, 4 + jaw], { w: 3.5, seed: S + 83 });
  ink.blob([30, -90, 44, -90, 52, -62, 62, -50, 44, -44, 26, -50, 24, -62], T.skin, { seed: S + 84, ...NOSE });
  ink.mouth(28, -18 + jaw * 0.5, 46, f, { seed: S + 85, teeth: 'snag', lw: 5 });
  ink.brushStroke([56, -12 + jaw, 70, 6 + jaw], { w: 3, color: T.scar, seed: S + 86, taper: false });
}

// prettier-ignore
function headProfile(ink, f) {
  const jaw = f.jaw * 12;
  ink.blob([-46, -140, -6, -160, 34, -150, 52, -120, 60, -96, 72, -80, 64, -64, 78, -40, 90, -10 + jaw, 82, 16 + jaw, 40, 24 + jaw, -10, 16, -40, -10, -56, -70], T.skin, { seed: S + 90, ...FACE });
  ink.stubble([0, -40, 10, 14 + jaw, 80, 12 + jaw, 84, -30, 40, -36], S + 91, 120, STUB);
  ink.blob(ink.ellipseRing(-10, -92, 10, 18, 8), T.skin, { lw: 5, seed: S + 92, shade: [T.skinD, -4, 2] });
  helmet(ink, -4, -146, 30);
  eyes(ink, f, [40, -98, 0.72], null);
  ink.blob([58, -92, 70, -86, 80, -64, 88, -52, 70, -46, 60, -54], T.skin, { seed: S + 93, ...NOSE });
  ink.mouth(60, -20 + jaw * 0.5, 22, f, { seed: S + 94, lw: 5 });
}

// prettier-ignore
function headBack(ink) {
  ink.blob([-40, -150, 0, -160, 40, -150, 56, -110, 74, -60, 80, -10, 0, 6, -80, -10, -74, -60, -56, -110], T.skin, { seed: S + 95, ...FACE });
  ink.blob(ink.ellipseRing(-60, -84, 10, 18, 8), T.skin, { lw: 5, seed: S + 96 });
  ink.blob(ink.ellipseRing(60, -84, 10, 18, 8), T.skin, { lw: 5, seed: S + 97 });
  helmet(ink, 0, -146, 34);
  [-1, 1].forEach((s, i) => ink.brushStroke([s * 36, -16, s * 30, 6], { w: 4, seed: S + 98 + i }));
}

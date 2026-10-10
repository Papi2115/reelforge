/**
 * Plain sketched stand-ins (PLAN.md#14.11): when a Grim Ink person or place still fails its code
 * checks after the fix turn, the step writes one of these under the same id so every scene that
 * draws `ctx.kit.people.<id>` / `ctx.kit.places.<id>` still renders (⚠ in the report). A person
 * is a plain grey-coated figure on the proportions of the kit's validated test character (its
 * dimensions, neck, coat outlines, head outlines and face anchors) without any of its features; a
 * place is a plastered wall over a stone floor with one warm light. Both pass the ink-module lint,
 * the kit's contract and the people validators (load.test.ts).
 */
import type { InkModuleKind } from '@reelforge/shared';

/** Marks a placeholder module (the step and the tests recognise it by this first line). */
export const PLACEHOLDER_MARKER = '// reelforge: placeholder';

const quote = (text: string): string => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

function header(file: string): string {
  return `${PLACEHOLDER_MARKER}
// ${file} could not be built (PLAN.md#14.11): a plain sketched stand-in so the scenes still
// render. Build it again with the Scenes stage's people-and-places step.`;
}

const PERSON_PARTS = `const T = {
  skin: '#c9a48a',
  skinD: '#9c7a62',
  hair: '#5e5a54',
  hairD: '#3e3b37',
  coat: '#6f6b62',
  coatD: '#4c4943',
  trousers: '#4f4b45',
  trousersD: '#35322e',
  shoe: '#2a2522',
  shoeD: '#161210',
};
const S = 4100;
const FACE = { lw: 6, shade: [T.skinD, -9, 6] };

// prettier-ignore
const COAT = [
  [-74, -566, -40, -584, 0, -578, 40, -584, 74, -566, 82, -500, 66, -420, 60, -340, 64, -296, 0, -288, -64, -296, -60, -340, -66, -420, -82, -500],
  [-56, -562, -24, -582, 18, -584, 58, -568, 70, -500, 58, -420, 54, -340, 58, -296, 4, -288, -48, -296, -50, -340, -54, -420, -64, -500],
  [-36, -566, 0, -586, 36, -576, 50, -520, 48, -440, 42, -340, 46, -296, 0, -288, -42, -296, -40, -340, -46, -440, -48, -520],
  [-74, -566, -40, -582, 0, -586, 40, -582, 74, -566, 82, -500, 66, -420, 60, -340, 64, -296, 0, -288, -64, -296, -60, -340, -66, -420, -82, -500],
];`;

const PERSON_DATA = `  D: {
    sw: 58,
    sy: -540,
    sz: 6,
    l1a: 116,
    l2a: 108,
    hw: 32,
    hy: -334,
    l1l: 168,
    l2l: 150,
    elbowOut: 0.72,
    top: -805,
    waist: [70, -400],
    hsz: 38,
    head: { x: [0, 17, 40, 0], top: -805, bottom: -579, hw: 70 },
  },
  neck: [
    [0, -560, 0, -596],
    [5, -558, 12, -594],
    [12, -554, 26, -590],
    [0, -560, 0, -596],
  ],
  headScale: 1.1,
  seed: S,
  tones: T,
  arm: { cloth: T.coat, clothD: T.coatD, w: [34, 30, 26], skin: T.skin, skinD: T.skinD, hsz: 38, lw: 6 },
  leg: { cloth: T.trousers, clothD: T.trousersD, w: [46, 38, 32], shoe: T.shoe, shoeD: T.shoeD, len: 60, sw: 28, lw: 6 },
  defaultExpr: 'deadpan',
  // prettier-ignore
  faceAnchors: [
    { chin: [0, 8], cheek: [40, -60], nose: [0, -58], mouth: [0, -28], ear: [62, -95], forehead: [0, -150] },
    { chin: [22, 6], cheek: [54, -62], nose: [70, -62], mouth: [34, -28], ear: [-40, -92], forehead: [24, -152] },
    { chin: [38, 4], cheek: [30, -62], nose: [84, -66], mouth: [52, -28], ear: [-8, -94], forehead: [50, -150] },
    { ear: [62, -95] },
  ],
  torso(g, ink, view) {
    ink.blob(COAT[view], T.coat, { lw: 7, seed: S + 60 + view, shade: [T.coatD, -14, 6] });
  },
  head(g, ink, view, face) {
    if (view === 0) front(ink, face);
    else if (view === 1) threeQuarter(ink, face);
    else if (view === 2) profile(ink, face);
    else back(ink);
  },`;

const PERSON_HEADS = `function ear(ink, x, y, seed) {
  ink.blob(ink.ellipseRing(x, y, 11, 19, 8), T.skin, { lw: 5, seed, shade: [T.skinD, -4, 2] });
}

function hair(ink, pts, seed) {
  ink.blob(pts, T.hair, { lw: 6, seed, shade: [T.hairD, -8, 6] });
}

function front(ink, f) {
  ear(ink, -62, -95, S + 10);
  ear(ink, 62, -95, S + 11);
  // prettier-ignore
  ink.blob([-60, -20, -64, -90, -56, -150, -30, -184, 0, -192, 30, -184, 56, -150, 64, -90, 60, -20, 34, 4 + f.jaw * 10, 0, 10 + f.jaw * 14, -34, 4 + f.jaw * 10], T.skin, { ...FACE, seed: S + 12 });
  // prettier-ignore
  hair(ink, [-66, -112, -62, -162, -36, -198, 0, -206, 36, -198, 62, -162, 66, -112, 48, -142, 18, -160, -22, -158, -50, -140], S + 13);
  ink.brow(-24, -124, 30, -1, f, { seed: S + 14 });
  ink.brow(24, -124, 30, 1, f, { seed: S + 15 });
  ink.eye(-24, -102, 12, 10, f, { skin: T.skin, seed: S + 16, side: 0 });
  ink.eye(24, -102, 12, 10, f, { skin: T.skin, seed: S + 17, side: 1 });
  // prettier-ignore
  ink.blob([-6, -98, 8, -74, 16, -58, 0, -50, -14, -58], T.skin, { lw: 5, seed: S + 18, shade: [T.skinD, -4, 3] });
  ink.mouth(0, -26 + f.jaw * 6, 34, f, { seed: S + 19 });
}

function threeQuarter(ink, f) {
  ear(ink, -40, -92, S + 20);
  // prettier-ignore
  ink.blob([-52, -20, -60, -90, -52, -152, -24, -186, 6, -194, 36, -184, 60, -150, 68, -96, 66, -40, 50, -4 + f.jaw * 10, 20, 8 + f.jaw * 14, -20, 4 + f.jaw * 8], T.skin, { ...FACE, seed: S + 21 });
  // prettier-ignore
  hair(ink, [-60, -104, -58, -160, -30, -198, 6, -206, 40, -196, 64, -160, 66, -120, 46, -146, 14, -162, -24, -156, -46, -128], S + 22);
  ink.brow(12, -124, 28, -1, f, { seed: S + 23 });
  ink.brow(50, -122, 20, 1, f, { seed: S + 24 });
  ink.eye(12, -102, 12, 10, f, { skin: T.skin, seed: S + 25, side: 0 });
  ink.eye(50, -102, 8, 9, f, { skin: T.skin, seed: S + 26, side: 1 });
  // prettier-ignore
  ink.blob([32, -98, 58, -76, 74, -60, 56, -50, 40, -56], T.skin, { lw: 5, seed: S + 27, shade: [T.skinD, -4, 3] });
  ink.mouth(34, -26 + f.jaw * 6, 28, f, { seed: S + 28 });
}

function profile(ink, f) {
  // prettier-ignore
  ink.blob([-50, -20, -58, -90, -48, -152, -16, -188, 18, -192, 48, -170, 62, -130, 66, -100, 64, -50, 60, -16 + f.jaw * 10, 36, 6 + f.jaw * 14, 0, 6 + f.jaw * 8, -30, 0], T.skin, { ...FACE, seed: S + 31 });
  // prettier-ignore
  hair(ink, [-58, -96, -56, -160, -22, -200, 18, -206, 52, -180, 54, -150, 30, -158, 0, -150, -20, -120, -36, -90], S + 32);
  ear(ink, -8, -94, S + 30);
  ink.brow(44, -124, 22, 1, f, { seed: S + 33 });
  ink.eye(44, -102, 9, 10, f, { skin: T.skin, seed: S + 34, side: 1 });
  // prettier-ignore
  ink.blob([58, -100, 76, -80, 88, -64, 70, -54, 60, -60], T.skin, { lw: 5, seed: S + 35, shade: [T.skinD, -4, 3] });
  ink.mouth(52, -26 + f.jaw * 6, 18, f, { seed: S + 36 });
}

function back(ink) {
  ear(ink, -62, -95, S + 50);
  ear(ink, 62, -95, S + 51);
  // prettier-ignore
  ink.blob([-58, -20, -64, -90, -56, -150, -30, -184, 0, -192, 30, -184, 56, -150, 64, -90, 58, -20, 0, 6], T.skin, { ...FACE, seed: S + 52 });
  // prettier-ignore
  hair(ink, [-66, -60, -66, -150, -38, -198, 0, -206, 38, -198, 66, -150, 66, -60, 30, -48, 0, -44, -30, -48], S + 53);
}`;

function personSource(id: string, name: string): string {
  return `${header(`kit-ext/people/${id}.js`)}
${PERSON_PARTS}

export const person = {
  id: ${quote(id)},
  name: ${quote(name)},
${PERSON_DATA}
};

${PERSON_HEADS}
`;
}

function placeSource(id: string, name: string): string {
  return `${header(`kit-ext/places/${id}.js`)}
const FLOOR = 900;

export const place = {
  id: ${quote(id)},
  name: ${quote(name)},
  bounds: [2400, 1080],
  light: { x: 1200, y: 640, rx: 720, ry: 420, color: '#e0a443', alpha: 0.08 },
  anchors: { centre: [1200, 905], left: [600, 905], right: [1800, 905] },
  collide: [],
  draw(g, ink) {
    const { C } = ink;
    ink.rect(-40, -40, 2480, FLOOR + 60, C.PLASTER, { lw: 0, seed: 1, mottle: [C.LINEN_D, 14, 120] });
    ink.stain(520, 360, 260, 170, 3);
    ink.crack(1760, 260, 160, 5);
    ink.rect(-40, FLOOR, 2480, 220, C.STONE_D, { lw: 0, seed: 8 });
    ink.inkLine([-40, FLOOR, 800, FLOOR + 4, 1600, FLOOR - 2, 2440, FLOOR + 3], { seed: 9, w: 8 });
  },
};
`;
}

/** The stand-in module source for `kit-ext/<kind>/<id>.js`. */
export function placeholderSource(kind: InkModuleKind, id: string, name: string): string {
  return kind === 'people' ? personSource(id, name) : placeSource(id, name);
}

export function isPlaceholderSource(source: string): boolean {
  return source.startsWith(PLACEHOLDER_MARKER);
}

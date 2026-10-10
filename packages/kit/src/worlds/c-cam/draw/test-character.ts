/**
 * The rig's test character (PLAN.md#14.5): "The Ferry Warden", a stocky, grey-haired harbour
 * official in a bottle-green coat with brass buttons and a walrus moustache. Hand-built and
 * original (own outlines, palette and proportions; not a copy of any film person), drawn only with
 * the ported brushes. Used by the rig / contact unit tests and the rig contact-sheet render test;
 * task 14.8 brings the real people modules.
 *
 * Public API: `TEST_CHARACTER`, `WARDEN_DIMS` (+ `WARDEN_TONES`, `WARDEN_SEED`, `wardenHead` from
 * test-character-head.ts).
 */
import { brushStroke, type BrushEnv } from './brushes.js';
import type { Character, RigDims, TorsoDraw } from './character.js';
import type { Paint2D } from './paint.js';
import type { ArmStyle, LegStyle } from './rig-limbs.js';
import type { ViewIndex } from './rig-views.js';
import { blob, ellipseRing } from './shapes.js';
import { WARDEN_SEED, WARDEN_TONES, wardenHead } from './test-character-head.js';

export { WARDEN_SEED, WARDEN_TONES, wardenHead } from './test-character-head.js';

const T = WARDEN_TONES;
const S = WARDEN_SEED;

/** Body dimensions (body px, feet at 0, y up = negative). */
export const WARDEN_DIMS: RigDims = {
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
  // bottom = the lowest measured chin (jaw shut), x[1] = the measured 3/4 head centre (PLAN.md#14.13)
  head: { x: [0, 17, 40, 0], top: -805, bottom: -579, hw: 70 },
};

/** Coat outline per view (figure space); every one contains the projected shoulder joints. */
// prettier-ignore
const COAT: readonly [readonly number[], readonly number[], readonly number[], readonly number[]] = [
  [-74, -566, -40, -584, 0, -578, 40, -584, 74, -566, 82, -500, 66, -420, 60, -340, 64, -296, 0, -288, -64, -296, -60, -340, -66, -420, -82, -500],
  [-56, -562, -24, -582, 18, -584, 58, -568, 70, -500, 58, -420, 54, -340, 58, -296, 4, -288, -48, -296, -50, -340, -54, -420, -64, -500],
  [-36, -566, 0, -586, 36, -576, 50, -520, 48, -440, 42, -340, 46, -296, 0, -288, -42, -296, -40, -340, -46, -440, -48, -520],
  [-74, -566, -40, -582, 0, -586, 40, -582, 74, -566, 82, -500, 66, -420, 60, -340, 64, -296, 0, -288, -64, -296, -60, -340, -66, -420, -82, -500],
];

/** Button column x per view (none on the back). */
const BUTTON_X: readonly [number, number, number] = [0, 16, 44];

const COAT_HATCH = { c: 'rgba(16,24,18,0.42)', n: 3, len: 26, gap: 7, k: 3, ang: 76, bend: 0.04 };

function buttons(g: Paint2D, env: BrushEnv, view: ViewIndex): void {
  const x = view === 3 ? undefined : BUTTON_X[view];
  if (x === undefined) return;
  [-528, -476, -424].forEach((y, i) => {
    blob(g, env, ellipseRing(x, y, 7, 7, 6), T.brass, { lw: 4, seed: S + 70 + i });
  });
}

const wardenTorso: TorsoDraw = (g, env, view) => {
  blob(g, env, COAT[view], T.coat, {
    lw: 7,
    seed: S + 60 + view,
    shade: [T.coatD, -14, 6],
    hatch: COAT_HATCH,
  });
  // belt line and collar fold
  // prettier-ignore
  brushStroke(g, env, view === 2 ? [-40, -352, 0, -348, 42, -352] : [-58, -352, 0, -346, 58, -352], { w: 6, seed: S + 66 });
  if (view === 3) {
    brushStroke(g, env, [0, -576, 2, -470, 0, -360], { w: 4, seed: S + 67 });
  } else {
    // prettier-ignore
    brushStroke(g, env, view === 2 ? [10, -578, 30, -540] : [-30, -578, BUTTON_X[view], -540, 30, -578], { w: 5, seed: S + 68 });
  }
  buttons(g, env, view);
};

const ARM: ArmStyle = {
  cloth: T.coat,
  clothD: T.coatD,
  w: [34, 30, 26],
  skin: T.skin,
  skinD: T.skinD,
  hsz: 38,
  lw: 6,
  cuff: T.coatD,
  hatch: { c: 'rgba(16,24,18,0.42)', n: 3, len: 22, gap: 6, k: 3, ang: 30 },
};

const LEG: LegStyle = {
  cloth: T.trousers,
  clothD: T.trousersD,
  w: [46, 38, 32],
  shoe: T.shoe,
  shoeD: T.shoeD,
  len: 60,
  sw: 28,
  lw: 6,
  splay: 0.25,
  hatch: { c: 'rgba(30,20,12,0.4)', n: 3, len: 30, gap: 7, k: 3, ang: 80 },
};

/** The test character; validates against `characterSchema`. */
export const TEST_CHARACTER: Character = {
  id: 'ferry-warden',
  name: 'The Ferry Warden',
  D: WARDEN_DIMS,
  neck: [
    [0, -560, 0, -596],
    [5, -558, 12, -594],
    [12, -554, 26, -590],
    [0, -560, 0, -596],
  ],
  headScale: 1.1,
  seed: S,
  tones: T,
  arm: ARM,
  leg: LEG,
  defaultExpr: 'deadpan',
  signatureGag: { kind: 'clockCheck', note: 'checks his watch against the ferry timetable' },
  torso: wardenTorso,
  head: wardenHead,
  faceAnchors: [
    {
      chin: [0, 8],
      cheek: [40, -60],
      nose: [0, -58],
      mouth: [0, -28],
      ear: [62, -95],
      forehead: [0, -150],
    },
    {
      chin: [22, 6],
      cheek: [54, -62],
      nose: [70, -62],
      mouth: [34, -28],
      ear: [-40, -92],
      forehead: [24, -152],
    },
    {
      chin: [38, 4],
      cheek: [30, -62],
      nose: [84, -66],
      mouth: [52, -28],
      ear: [-8, -94],
      forehead: [50, -150],
    },
    { ear: [62, -95] },
  ],
};

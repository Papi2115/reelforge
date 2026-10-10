/**
 * Test scene for the C-CAM face render test (PLAN.md#14.4): a 1920x1080 face sheet of the six
 * test-page expressions (deadpan, miserable, shock, smug, rage, exhausted) in front of a grimy
 * plaster wall, each head with stubble, pores, a hand of a different kind, one with a wart.
 * Runs inside the page (served by ccam-module-server.ts), so it only imports the ported modules
 * (not poses.ts: it imports zod, which the module server does not serve). Pure function of its
 * inputs, like a real scene.
 */
import { C, H, W } from '../../src/worlds/c-cam/core.js';
import { brushStroke, camera, figure, type BrushEnv } from '../../src/worlds/c-cam/draw/brushes.js';
import {
  face,
  pores,
  stubble,
  wart,
  type ExprName,
  type FaceState,
} from '../../src/worlds/c-cam/draw/face.js';
import { brow, eye, mouth, type TeethSet } from '../../src/worlds/c-cam/draw/face-parts.js';
import { cobbles, crack, flies, peel, puddle, stain } from '../../src/worlds/c-cam/draw/grime.js';
import { hand, type HandKind } from '../../src/worlds/c-cam/draw/hand.js';
import { asPaint2D, type Paint2D } from '../../src/worlds/c-cam/draw/paint.js';
import { blob, ellipseRing, tube } from '../../src/worlds/c-cam/draw/shapes.js';
import { rect } from '../../src/worlds/c-cam/draw/scenery.js';

interface Sitter {
  readonly expr: ExprName;
  readonly skin: string;
  readonly skinD: string;
  readonly hand: HandKind;
  readonly teeth: TeethSet;
  readonly coat: string;
}

const SITTERS: readonly Sitter[] = [
  {
    expr: 'deadpan',
    skin: C.SKIN_RUDDY,
    skinD: C.SKIN_RUDDY_D,
    hand: 'fist',
    teeth: 'row',
    coat: C.OLIVE,
  },
  {
    expr: 'miserable',
    skin: C.SKIN_SALLOW,
    skinD: C.SKIN_SALLOW_D,
    hand: 'open',
    teeth: 'few',
    coat: C.GREYBLUE,
  },
  {
    expr: 'shock',
    skin: C.SKIN_CLAY,
    skinD: C.SKIN_CLAY_D,
    hand: 'open',
    teeth: 'gap',
    coat: C.RUST,
  },
  {
    expr: 'smug',
    skin: C.SKIN_OLIVE,
    skinD: C.SKIN_OLIVE_D,
    hand: 'point',
    teeth: 'snag',
    coat: C.MUSTARD,
  },
  {
    expr: 'rage',
    skin: C.SKIN_RUDDY,
    skinD: C.SKIN_RUDDY_D,
    hand: 'grip',
    teeth: 'row',
    coat: C.PLUM,
  },
  {
    expr: 'exhausted',
    skin: C.SKIN_GREY,
    skinD: C.SKIN_GREY_D,
    hand: 'flat',
    teeth: 'few',
    coat: C.BROWN,
  },
];

/** One head-and-shoulders portrait in head-local units (chin near y = 0, crown near -160). */
function sitter(g: Paint2D, env: BrushEnv, s: Sitter, f: FaceState, seed: number): void {
  const jaw = f.jaw * 14;
  // Shoulders and neck.
  blob(g, env, [-150, 140, -120, 40, -40, 10, 40, 10, 120, 40, 150, 140], s.coat, {
    seed: seed + 1,
    shade: [C.BLACK_D, -20, 0],
    hatch: { n: 3, k: 3, ang: 70 },
  });
  tube(g, env, [0, 30, 0, -20], [64, 60], s.skin, { seed: seed + 2, shade: [s.skinD, -12, 0] });
  // Ears, head, stubble.
  for (const side of [-1, 1]) {
    blob(g, env, ellipseRing(side * 64, -84, 13, 20, 7), s.skin, { seed: seed + 3 + side, lw: 5 });
  }
  // prettier-ignore
  blob(g, env, [-58, -14 + jaw, -62, -60, -62, -110, -54, -146, -18, -160, 20, -160, 54, -148, 62, -112, 62, -60, 58, -14 + jaw, 36, 10 + jaw, 0, 16 + jaw, -36, 10 + jaw], s.skin, {
    seed: seed + 5,
    lw: 7,
    shade: [s.skinD, -16, 8],
    mottle: [s.skinD, 5, 10],
  });
  // prettier-ignore
  stubble(g, env, [-56, -60, -50, 4 + jaw, 0, 18 + jaw, 50, 4 + jaw, 58, -60, 30, -44, -30, -44], seed + 6, 110);
  pores(g, -44, -70, 26, 18, 6, seed + 7);
  pores(g, 20, -70, 26, 18, 6, seed + 8);
  // Eyes, brows, nose, mouth.
  eye(g, env, -24, -90, 11, 12, f, { skin: s.skin, seed: seed + 9, side: 0, bags: 2 });
  eye(g, env, 24, -90, 11, 12, f, { skin: s.skin, seed: seed + 10, side: 1 });
  brow(g, env, -24, -110, 34, -1, f, { u: 14, thick: 14, seed: seed + 11 });
  brow(g, env, 24, -110, 34, 1, f, { u: 14, thick: 14, seed: seed + 12 });
  blob(g, env, [-6, -92, -14, -56, 0, -48, 14, -56, 6, -92], s.skin, {
    seed: seed + 13,
    lw: 5,
    shade: [s.skinD, -6, 0],
  });
  mouth(g, env, 0, -24, 46, f, { open: 26, teeth: s.teeth, seed: seed + 14 });
  if (s.expr === 'smug') wart(g, env, 34, -50, 5, s.skinD, seed + 15, true);
  if (s.expr === 'rage') brushStroke(g, env, [-14, -128, -4, -118, -12, -106], { w: 3 });
  hand(g, env, 118, 70, 160, 40, s.skin, s.hand, { seed: seed + 16, shade: s.skinD });
}

/** Paints the face sheet into `ctx` (a W x H canvas). */
export function paintFacesScene(ctx: CanvasRenderingContext2D): void {
  const g = asPaint2D(ctx);
  const env = camera(g, W / 2, H / 2, 1);

  // Grimy wall and cobbled floor.
  rect(g, env, -20, -20, W + 40, 960, C.PLASTER, { lw: 0, seed: 2 });
  for (let i = 0; i < 6; i += 1)
    stain(g, env, 160 + i * 330, 200 + (i % 2) * 360, 220, 140, 30 + i);
  peel(g, env, 1220, 330, 130, 80, 5);
  crack(g, env, 1500, 80, 160, 6);
  crack(g, env, 300, 520, 120, 7, 0.4);
  cobbles(g, env, -20, 900, W + 20, H + 20, 4);
  puddle(g, env, 1400, 1010, 140, 3);
  flies(g, 1700, 960, 0.05, 2);

  // Two rows of three portraits.
  SITTERS.forEach((s, i) => {
    const f = face(0.05, 40 + i, s.expr);
    const x = 320 + (i % 3) * 640;
    const y = 300 + Math.floor(i / 3) * 500;
    figure(g, env, { x, y, s: 1.45 }, i % 2 === 1, (inner) => {
      sitter(g, inner, s, f, 100 + i * 40);
    });
  });
}

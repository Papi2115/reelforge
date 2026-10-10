/**
 * Test scene for the C-CAM brush render test (PLAN.md#14.3): a 1920x1080 still that exercises the
 * ported brushes on a real 2D canvas. Runs inside the page (served by ccam-module-server.ts), so
 * it only imports the ported modules; like a real scene it is a pure function of its inputs.
 */
import { C, H, W, ease } from '../../src/worlds/c-cam/core.js';
import { brushStroke, camera, figure, inkLine } from '../../src/worlds/c-cam/draw/brushes.js';
import { asPaint2D } from '../../src/worlds/c-cam/draw/paint.js';
import { blob, ellipseRing, tube } from '../../src/worlds/c-cam/draw/shapes.js';
import {
  bands,
  beam,
  bricks,
  gloom,
  pool,
  rect,
  stars,
} from '../../src/worlds/c-cam/draw/scenery.js';

/** Paints the still into `ctx` (a W x H canvas). */
export function paintBrushesScene(ctx: CanvasRenderingContext2D): void {
  const g = asPaint2D(ctx);
  const env = camera(g, 980, 560, 1.08, -2);

  // Sky, ground and a lit brick wall.
  bands(g, -200, -200, W + 200, 680, [C.GREYBLUE_D, C.GREYBLUE, C.PLUM, C.RUST], 3);
  stars(g, -100, -100, W + 200, 420, 60, 9);
  rect(g, env, -200, 640, W + 400, H, C.OLIVE_D, { lw: 0, seed: 4 });
  rect(g, env, 1120, 260, 620, 440, C.PLASTER, { seed: 6, shade: [C.STONE_D, 26, 0] });
  bricks(g, env, 1120, 260, 620, 440, { seed: 2, density: 0.25 });
  beam(g, env, 1110, 250, 1750, 250, 34, 3);
  beam(g, env, 1430, 250, 1430, 700, 26, 5);
  pool(g, 1260, 420, 260, 150, C.FIRE, 0.16);

  // Loaded-brush lines: horizon crack and a long wavy stroke along the ground.
  const ground: number[] = [];
  for (let x = -100; x <= W + 100; x += 120) ground.push(x, 650 + 14 * Math.sin(x / 170));
  inkLine(g, env, ground, { seed: 7, w: 9 });
  brushStroke(g, env, [200, 900, 420, 870, 700, 930, 980, 880, 1300, 940], { seed: 11, w: 12 });

  // A boulder with every tone layer.
  blob(g, env, ellipseRing(1700, 860, 190, 110, 9, 0.2), C.STONE, {
    seed: 5,
    shade: [C.STONE_D, 30, 26],
    light: [C.LINEN, -18, -20],
    patch: [C.MUSTARD_D, 20, 10, 0.45],
    mottle: [C.BROWN, 5, 18],
    hatch: { n: 4, k: 4, len: 40, ang: 30 },
  });

  // A crude figure in figure space (lines thicken with its scale).
  figure(g, env, { x: 620, y: 820, s: 1.5, lean: -4 }, false, (inner) => {
    tube(g, inner, [-30, 0, -24, -90, -20, -170], [40, 36, 30], C.BLACK, { seed: 2 });
    tube(g, inner, [30, 0, 26, -90, 22, -170], [40, 36, 30], C.BLACK, { seed: 3 });
    blob(g, inner, [-70, -160, 0, -190, 70, -160, 80, -300, 0, -340, -80, -300], C.RUST, {
      seed: 8,
      shade: [C.RUST_D, 18, 0],
      hatch: { n: 3, k: 3, ang: 70 },
    });
    tube(g, inner, [60, -300, 130, -250, 180 * ease.out(0.7), -320], [30, 26, 20], C.RUST, {
      seed: 4,
    });
    blob(g, inner, ellipseRing(0, -400, 56, 66, 7), C.SKIN_SALLOW, {
      seed: 6,
      shade: [C.SKIN_SALLOW_D, 14, 6],
    });
    brushStroke(g, inner, [-30, -420, -12, -428, 4, -420], { seed: 1 });
    brushStroke(g, inner, [16, -420, 32, -430, 46, -418], { seed: 2 });
  });

  gloom(g, -200, -200, W + 400, H + 400, 1260, 420, 480, C.BLACK_D, 0.4);
}

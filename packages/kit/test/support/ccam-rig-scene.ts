/**
 * Test scene for the C-CAM rig render test (PLAN.md#14.5): a 1920x1080 contact sheet of the rig's
 * test character (The Ferry Warden) in the four views (columns: front, three-quarter, profile,
 * back) and three poses (rows: stand, akimbo, point), each on its own strip of floor. Runs inside
 * the page (served by ccam-module-server.ts + ccam-zod-route.ts). Pure function of its inputs.
 */
import { C, H, W } from '../../src/worlds/c-cam/core.js';
import { inkLine } from '../../src/worlds/c-cam/draw/brushes.js';
import { drawFigure } from '../../src/worlds/c-cam/draw/figure.js';
import { asPaint2D } from '../../src/worlds/c-cam/draw/paint.js';
import { pose, type PoseName } from '../../src/worlds/c-cam/draw/poses.js';
import type { View } from '../../src/worlds/c-cam/draw/rig-views.js';
import { DEFAULT_ENV } from '../../src/worlds/c-cam/draw/brushes.js';
import { rect } from '../../src/worlds/c-cam/draw/scenery.js';
import { TEST_CHARACTER } from '../../src/worlds/c-cam/draw/test-character.js';

const VIEWS: readonly View[] = ['front', 'three-quarter', 'profile', 'back'];
const ROWS: readonly { readonly pose: PoseName; readonly expr: string }[] = [
  { pose: 'stand', expr: 'deadpan' },
  { pose: 'akimbo', expr: 'smug' },
  { pose: 'point', expr: 'shock' },
];

const CELL_W = W / VIEWS.length;
const CELL_H = H / ROWS.length;
const SCALE = 0.4;

/** Paints the contact sheet into `ctx` (a W x H canvas). */
export function paintRigScene(ctx: CanvasRenderingContext2D): void {
  const g = asPaint2D(ctx);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const env = DEFAULT_ENV;
  rect(g, env, 0, 0, W, H, C.PLASTER, { lw: 0, seed: 3 });
  ROWS.forEach((row, r) => {
    const floor = (r + 1) * CELL_H - 18;
    rect(g, env, 0, floor, W, 18, C.STONE_D, { lw: 0, seed: 5 + r });
    inkLine(g, env, [0, floor, W / 2, floor + 2, W, floor], { seed: 9 + r, w: 6 });
    VIEWS.forEach((view, col) => {
      const P = pose(row.pose, TEST_CHARACTER.D, 1);
      const placement = { x: (col + 0.5) * CELL_W, y: floor, s: SCALE };
      drawFigure(g, env, TEST_CHARACTER, placement, P, view, row.expr, 0.4);
    });
  });
}

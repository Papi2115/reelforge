/**
 * Look `atari-menu` (Game B1 world, look B, PLAN.md#13.5 part b) in the engine harness
 * (SwiftShader): the template scenes (packages/kit/examples/game-b1/b1-b6: the showcase's shots 4,
 * 5 and 8, the level-select map, and two other mechanisms for the high-score table and the
 * manual toolkits) at the showcase stills' times where the shot is the same; the suite is
 * `describeWorldLook` (lint, goldens `look-atari-menu-<scene>-t<t>` at 640x360, vibe guard,
 * seek-order determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'game-b1', width: 640, height: 360, tile: 1 }, 'atari-menu', [
  ['examples/game-b1/b1_scores.js', 7.5, [1.2, 2.84, 5.6]],
  ['examples/game-b1/b2_market.js', 7.5, [0.5, 3.2, 6.6]],
  ['examples/game-b1/b3_manual.js', 8.5, [0, 7.4, 7.95]],
  ['examples/game-b1/b4_scores_moon.js', 7, [0.8, 2.45, 5.5]],
  ['examples/game-b1/b5_manual_pyramid.js', 8, [0.75, 4.6, 7]],
  ['examples/game-b1/b6_level_select.js', 3.6, [0.5, 1.6, 3]],
]);

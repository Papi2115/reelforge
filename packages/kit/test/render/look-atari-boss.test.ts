/**
 * Look `atari-boss` (Game B1 world, look C, PLAN.md#13.5 part b) in the engine harness
 * (SwiftShader): the template scenes (packages/kit/examples/game-b1/c1-c3, ports of the
 * showcase's shots 6, 9 and 10) at the showcase stills' times; the suite is `describeWorldLook`
 * (lint, goldens `look-atari-boss-<scene>-t<t>` at 640x360, vibe guard, seek-order determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'game-b1', width: 640, height: 360, tile: 1 }, 'atari-boss', [
  ['examples/game-b1/c1_flood.js', 8, [3, 5.6, 6.9]],
  ['examples/game-b1/c2_landfill.js', 9, [2.5, 7.8, 8.7]],
  ['examples/game-b1/c3_continue.js', 4.75, [1.5, 3, 4.3]],
]);

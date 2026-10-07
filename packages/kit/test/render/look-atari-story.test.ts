/**
 * Look `atari-story` (Game B1 world, look A, PLAN.md#13.5) in the engine harness (SwiftShader):
 * the template scenes (packages/kit/examples/game-b1/a1-a3, ports of the showcase's shots 1, 2
 * and 3, at the showcase stills' times where the shot itself is on screen); the suite is
 * `describeWorldLook` (lint, goldens `look-atari-story-<scene>-t<t>` at 640x360, vibe guard,
 * seek-order determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'game-b1', width: 640, height: 360, tile: 1 }, 'atari-story', [
  ['examples/game-b1/a1_hook.js', 6.5, [1, 3.9, 5.9]],
  ['examples/game-b1/a2_xmas.js', 8, [3, 5.5, 7.9]],
  ['examples/game-b1/a3_deadline.js', 8.5, [2.6, 6.3, 7.3]],
]);

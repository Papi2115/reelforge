/**
 * Look `comic-story` (Comic world, look A, PLAN.md#13.3) in the engine harness (SwiftShader): the
 * three template scenes (packages/kit/examples/comic/a1-a3, ports of the showcase's shots 1, 2 and
 * 6) at three times each, the showcase stills' times where they show the shot itself; the suite is
 * `describeWorldLook` (lint, goldens `look-comic-story-<scene>-t<t>` at 640x360, vibe guard,
 * seek-order determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'comic', width: 640, height: 360, tile: 1 }, 'comic-story', [
  ['examples/comic/a1_hook.js', 7, [0.45, 3.6, 6.9]],
  ['examples/comic/a2_descent.js', 8, [1.2, 3, 7.9]],
  ['examples/comic/a3_squeeze.js', 7, [1.4, 3.5, 6.9]],
]);

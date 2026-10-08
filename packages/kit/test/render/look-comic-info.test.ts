/**
 * Look `comic-info` (Comic world, look B, PLAN.md#13.3) in the engine harness (SwiftShader): the
 * two template scenes (packages/kit/examples/comic/b1-b2, ports of the showcase's shots 4 and 7)
 * and the two flashback inspirations it hosts (f1 = shot 3 as `page.flashback` cover 'page',
 * f2 = a torn sepia strip over a present page) at three times each, the showcase stills' times
 * where they show the shot itself; the suite is `describeWorldLook` (lint, goldens
 * `look-comic-info-<scene>-t<t>` at 640x360, vibe guard, seek-order determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook(
  { style: 'comic', width: 640, height: 360, tile: 1, minColors: 5 },
  'comic-info',
  [
    ['examples/comic/b1_cutaway.js', 8.5, [0.5, 4.4, 8.4]],
    ['examples/comic/b2_checklist.js', 8, [1.4, 4.4, 7.9]],
    ['examples/comic/f1_flashback_1961.js', 8.5, [2.1, 4.95, 8.4]],
    ['examples/comic/f2_flashback_bug.js', 7.5, [1.2, 6, 7.2]],
  ],
);

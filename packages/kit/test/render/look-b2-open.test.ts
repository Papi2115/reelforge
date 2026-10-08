/**
 * Game B2 open vocabulary (PLAN.md#13.15) in the engine harness (SwiftShader): six films far from
 * the showcase (forest, ocean, space station, medieval village, desert, city), each built only
 * from its own assets (generators + pixel art) in an outdoor or roofed level (in examples/game-b2/open/,
 * outside the folder the showcase-text guards read), through
 * `describeWorldLook` (lint, goldens `look-b2-open-<scene>-t<t>` at 640x360, vibe guard,
 * seek-order determinism). Contact sheet: packages/kit/out/contact/look-b2-open.png.
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'game-b2', width: 640, height: 360, tile: 1 }, 'b2-open', [
  ['examples/game-b2/open/o1_forest.js', 8, [1.5, 4.6, 6.8]],
  ['examples/game-b2/open/o2_ocean.js', 8, [1.5, 4.6, 6.8]],
  ['examples/game-b2/open/o3_space.js', 8, [1.5, 5.2, 7.6]],
  ['examples/game-b2/open/o4_medieval.js', 8, [1.5, 4.4, 6.6]],
  ['examples/game-b2/open/o5_desert.js', 8, [1.5, 4.9, 7]],
  ['examples/game-b2/open/o6_city.js', 8, [1.5, 4.6, 7]],
]);

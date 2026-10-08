/**
 * The open vocabulary of the Game B1 world (PLAN.md#13.15) in the engine harness (SwiftShader):
 * six films far from the showcase's 1983 crash (forest, ocean, space station, medieval village,
 * desert, city), each built only from its own sprites, playfields, generators, asset file and
 * room (packages/kit/examples/game-b1/open/o1-o6); the suite is `describeWorldLook` (lint, goldens
 * `look-game-b1-open-<scene>-t<t>` at 640x360, vibe guard, seek-order determinism). Contact
 * sheet: packages/kit/out/contact/look-game-b1-open.png.
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'game-b1', width: 640, height: 360, tile: 1 }, 'game-b1-open', [
  ['examples/game-b1/open/o1_forest.js', 6.5, [1.2, 3.9, 5.8]],
  ['examples/game-b1/open/o2_ocean.js', 7, [1, 3.6, 5.2]],
  ['examples/game-b1/open/o3_station.js', 7, [1, 3.6, 6.2]],
  ['examples/game-b1/open/o4_village.js', 8, [1.4, 4.2, 7]],
  ['examples/game-b1/open/o5_desert.js', 8, [1.5, 4.8, 7.2]],
  ['examples/game-b1/open/o6_city.js', 8, [1.2, 4, 7]],
]);

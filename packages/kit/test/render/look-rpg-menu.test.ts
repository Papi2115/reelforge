/**
 * Look `rpg-menu` (Game B2 world, look B, PLAN.md#13.4) in the engine harness (SwiftShader): the
 * quest log template (showcase shot 5) and the breakthrough examples - the automap as the story so
 * far (shot 4), a dive into the map mid-walk, the intermission tally (shot 8) and a tally against
 * par - through `describeWorldLook` (lint, goldens `look-rpg-menu-<scene>-t<t>` at 640x360, vibe
 * guard, seek-order determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'game-b2', width: 640, height: 360, tile: 1 }, 'rpg-menu', [
  ['examples/game-b2/b1_quest_log.js', 7, [1, 3.3, 4.8]],
  ['examples/game-b2/b2_automap.js', 8, [2.4, 4.6, 6.6]],
  ['examples/game-b2/b3_automap_dive.js', 8, [2.1, 4.4, 5.4]],
  ['examples/game-b2/b4_tally.js', 8, [1.3, 4.5, 6.9]],
  ['examples/game-b2/b5_tally_par.js', 7, [1.8, 4.6, 6.6]],
]);

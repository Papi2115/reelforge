/**
 * Look `rpg-explore` (Game B2 world, look A, PLAN.md#13.4) in the engine harness (SwiftShader):
 * the template scenes (packages/kit/examples/game-b2/a1-a3, ports of the showcase's shots 1, 3
 * and 7, at the showcase stills' times; a4, the cartridge thrown onto the returns pile); the
 * suite is `describeWorldLook` (lint, goldens `look-rpg-explore-<scene>-t<t>` at 640x360, vibe
 * guard, seek-order determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'game-b2', width: 640, height: 360, tile: 1 }, 'rpg-explore', [
  ['examples/game-b2/a1_corridor.js', 7.5, [0.8, 3.5, 7]],
  ['examples/game-b2/a2_warehouse.js', 8, [1.4, 4, 6.9]],
  ['examples/game-b2/a3_returns.js', 9, [2.5, 5, 7.5]],
  ['examples/game-b2/a4_throw.js', 8, [3.6, 3.95, 4.8]],
]);

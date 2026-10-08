/**
 * Look `rpg-boss` (Game B2 world, look C, PLAN.md#13.4) in the engine harness (SwiftShader): the
 * clone aisle template (showcase shot 6: MARKET draining, damage numbers, the TOO MANY stinger,
 * shake with decay) and the thrown deadline note, through `describeWorldLook` (lint, goldens
 * `look-rpg-boss-<scene>-t<t>` at 640x360, vibe guard, seek-order determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'game-b2', width: 640, height: 360, tile: 1 }, 'rpg-boss', [
  ['examples/game-b2/c1_clone_aisle.js', 8, [3.4, 6.2, 7]],
  ['examples/game-b2/c2_throw_note.js', 7, [3.6, 4.2, 6]],
]);

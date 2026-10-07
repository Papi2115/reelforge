/**
 * The Comic world's open vocabulary (PLAN.md#13.15a, docs/worlds/DECISIONS.md "a world is a
 * style GRAMMAR"): six example films far from the showcase's Moon (packages/kit/examples/comic/
 * open/o1-o6: forest, ocean, space station, medieval village, desert, city), each built only from
 * `page.art` and `page.layout`, at three times each in the engine harness (SwiftShader): lint,
 * goldens `look-open-comic-<topic>-t<t>` at 640x360, vibe guard, seek-order determinism. Contact
 * sheet: packages/kit/out/contact/look-open-comic.png.
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'comic', width: 640, height: 360, tile: 1 }, 'open-comic', [
  ['examples/comic/open/o1_forest.js', 7, [0.5, 3.2, 6.4]],
  ['examples/comic/open/o2_ocean.js', 8, [1.2, 4, 7.6]],
  ['examples/comic/open/o3_station.js', 7, [1, 3, 6.5]],
  ['examples/comic/open/o4_village.js', 8, [1, 4.4, 7.6]],
  ['examples/comic/open/o5_desert.js', 7, [1, 3.2, 6.5]],
  ['examples/comic/open/o6_city.js', 7, [1, 3.5, 6.6]],
]);

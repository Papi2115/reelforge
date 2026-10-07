/**
 * The Comic breakthroughs as an open toolkit (PLAN.md#13.15, docs/worlds/DECISIONS.md "Comic
 * breakthroughs are never a template"): three `page.panelBreak` examples on topics far from the
 * showcase (packages/kit/examples/comic/open/b1-b3: a glacier pulling back, three villages pulled
 * into one city, a levee dragged down), each with its own mechanism, before / during / after the
 * break in the engine harness (SwiftShader): lint, goldens `look-break-comic-<scene>-t<t>` at
 * 640x360, vibe guard, seek-order determinism. Contact sheet:
 * packages/kit/out/contact/look-break-comic.png.
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'comic', width: 640, height: 360, tile: 1 }, 'break-comic', [
  ['examples/comic/open/b1_glacier.js', 8, [1.2, 4, 7.4]],
  ['examples/comic/open/b2_bridge.js', 8, [1.6, 4, 7.2]],
  ['examples/comic/open/b3_levee.js', 8, [2.4, 3.7, 5.2, 7.4]],
]);

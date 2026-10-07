/**
 * Comic page flow and continuity (PLAN.md#13.15, Papi after real run Comic 2: the pages should
 * unfold in different directions and carry things across panels): `page.flow` down a tall narrow
 * column (p1, a well) and across a long band wider than the page (p2, a letter's journey), each
 * with a `page.thread` drawn over the panels and gutters, in the engine harness (SwiftShader):
 * lint, goldens `look-flow-comic-<scene>-t<t>` at 640x360, vibe guard, seek-order determinism.
 * Contact sheet: packages/kit/out/contact/look-flow-comic.png.
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'comic', width: 640, height: 360, tile: 1 }, 'flow-comic', [
  ['examples/comic/open/p1_well.js', 7, [1.2, 3.4, 6]],
  ['examples/comic/open/p2_letter.js', 7, [1.2, 3.2, 6]],
]);

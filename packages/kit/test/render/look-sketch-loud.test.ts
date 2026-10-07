/**
 * Look `sketch-loud` (Sketchbook world, look C, PLAN.md#13.6) in the engine harness
 * (SwiftShader): the template scenes (packages/kit/examples/sketchbook/c1-c3, ports of the
 * showcase's loud pages 1, 6 and 5: the marker "365?", the flipbook and the pop-up page built with
 * `page.popup`) at three times each, through
 * `describeSketchbookLook` (lint, goldens `look-sketch-loud-<scene>-t<t>`, vibe guard,
 * seek-order determinism).
 */
import { describeSketchbookLook } from '../support/sketchbook-looks.js';

describeSketchbookLook('sketch-loud', [
  ['examples/sketchbook/c1_hook.js', 7, [0.6, 2.2, 6]],
  ['examples/sketchbook/c2_flipbook.js', 6.7, [1, 2.5, 5]],
  ['examples/sketchbook/c3_popup.js', 8, [1.3, 3, 7.2]],
]);

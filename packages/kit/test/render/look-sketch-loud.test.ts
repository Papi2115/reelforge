/**
 * Look `sketch-loud` (Sketchbook world, look C, PLAN.md#13.6) in the engine harness
 * (SwiftShader): the two template scenes (packages/kit/examples/sketchbook/c1-c2, ports of the
 * showcase's loud pages 1 and 6: the marker "365?" and the flipbook) at three times each, through
 * `describeSketchbookLook` (lint, goldens `look-sketch-loud-<scene>-t<t>`, vibe guard,
 * seek-order determinism).
 */
import { describeSketchbookLook } from '../support/sketchbook-looks.js';

describeSketchbookLook('sketch-loud', [
  ['examples/sketchbook/c1_hook.js', 7, [0.6, 2.2, 6]],
  ['examples/sketchbook/c2_flipbook.js', 6.7, [1, 2.5, 5]],
]);

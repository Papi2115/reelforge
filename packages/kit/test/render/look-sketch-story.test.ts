/**
 * Look `sketch-story` (Sketchbook world, look A, PLAN.md#13.6) in the engine harness
 * (SwiftShader): the three template scenes (packages/kit/examples/sketchbook/a1-a3, ports of the
 * showcase's story pages 2, 4 and 7) at three times each; the suite is `describeSketchbookLook`
 * (lint, goldens `look-sketch-story-<scene>-t<t>`, vibe guard, seek-order determinism).
 */
import { describeSketchbookLook } from '../support/sketchbook-looks.js';

describeSketchbookLook('sketch-story', [
  ['examples/sketchbook/a1_quarter.js', 8.8, [2.4, 6, 8]],
  ['examples/sketchbook/a2_caesar.js', 8.6, [3.3, 5.2, 7.4]],
  ['examples/sketchbook/a3_gregory.js', 9, [3.3, 5.5, 7.6]],
]);

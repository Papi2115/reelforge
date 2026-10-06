/**
 * Look `sketch-graph` (Sketchbook world, look B, PLAN.md#13.6) in the engine harness
 * (SwiftShader): the three template scenes (packages/kit/examples/sketchbook/b1-b3, ports of the
 * showcase's ballpoint pages 3, 7 and 10) at three times each, through `describeSketchbookLook`
 * (lint, goldens `look-sketch-graph-<scene>-t<t>`, vibe guard, seek-order determinism).
 */
import { describeSketchbookLook } from '../support/sketchbook-looks.js';

describeSketchbookLook('sketch-graph', [
  ['examples/sketchbook/b1_maths.js', 9, [1.9, 3.2, 7.9]],
  ['examples/sketchbook/b2_envelope.js', 8.6, [2, 4.6, 6.8]],
  ['examples/sketchbook/b3_rule.js', 8.8, [3, 5.5, 8.7]],
]);

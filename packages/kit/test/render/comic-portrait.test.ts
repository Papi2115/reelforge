/**
 * The Comic page in a portrait short (PLAN.md#13.18) in the engine harness (SwiftShader): a
 * 'splash-strip' story page (pt1), a page flow that reads down by default with a thread (pt2) and
 * 'stagger' panels under a pasted 1850 strip (pt3), at 360x640: lint, goldens
 * `look-comic-portrait-<scene>-t<t>`, vibe guard, seek-order determinism.
 * Contact sheet: packages/kit/out/contact/look-comic-portrait.png.
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook(
  { style: 'comic', width: 360, height: 640, tile: 1, format: 'portrait' },
  'comic-portrait',
  [
    ['examples/comic/portrait/pt1_lighthouse.js', 6, [0.6, 1.5, 3.8]],
    ['examples/comic/portrait/pt2_elevator.js', 6, [0.6, 2.6, 4.8]],
    ['examples/comic/portrait/pt3_oak.js', 6, [0.6, 2.6, 4.8]],
  ],
);

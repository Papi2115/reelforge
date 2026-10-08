/**
 * Look `comic-loud` (Comic world, look C, PLAN.md#13.3) in the engine harness (SwiftShader): the
 * three template scenes (packages/kit/examples/comic/c1-c3: the pause of showcase shot 8, the line
 * of shot 10, and contact: a slammed panel and onomatopoeia breaking the frame) and the two spread
 * inspirations it hosts (s1 = shot 9 as `page.spread` merge, s2 = the book unfolding with an
 * inset) at three times each; the suite is `describeWorldLook` (lint, goldens
 * `look-comic-loud-<scene>-t<t>` at 640x360, vibe guard, seek-order determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook(
  { style: 'comic', width: 640, height: 360, tile: 1, minColors: 5 },
  'comic-loud',
  [
    ['examples/comic/c1_pause.js', 6, [0.35, 2.2, 4]],
    ['examples/comic/c2_landed.js', 8, [1, 3.6, 7.9]],
    ['examples/comic/c3_contact.js', 6, [0.8, 1.5, 4.5]],
    ['examples/comic/s1_spread_tranquility.js', 8, [0.45, 1.6, 7.9]],
    ['examples/comic/s2_spread_summit.js', 8, [1.4, 3.4, 7.6]],
  ],
);

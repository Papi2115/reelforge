/**
 * World Grim Ink (c-cam, PLAN.md#14.2) in the engine harness (SwiftShader): the skeleton example
 * (packages/kit/examples/c-cam/s0_stage.js: muddy ground, one ink ribbon, one blob, the INK
 * frame) drawn on `kit.fx.inkStage` through the real engine + kit pipeline at the world's native
 * 1920x1080 and 24 fps, full colour (`quantize: false`: the vibe guard checks opacity only). The
 * suite is `describeWorldLook` (scene lint, goldens `look-ink-scene-stage-t<t>`, seek-order and
 * reload determinism). Times avoid the ridge's boil repeating (seed cycles every 3 poses).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook({ style: 'c-cam', width: 1920, height: 1080, tile: 4, fps: 24 }, 'ink-scene', [
  ['examples/c-cam/s0_stage.js', 6, [0.4, 2.5, 4.9]],
]);

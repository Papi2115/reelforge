/**
 * World Grim Ink (c-cam, PLAN.md#14.2, #14.12) in the engine harness (SwiftShader), through the
 * real engine + kit pipeline at the world's native 1920x1080 and 24 fps, full colour
 * (`quantize: false`: the vibe guard checks opacity only):
 *  - the skeleton example (examples/c-cam/s0_stage.js: muddy ground, one ink ribbon, one blob,
 *    the INK frame) on `kit.fx.inkStage`; times avoid the ridge's boil repeating (its seed cycles
 *    every 3 poses);
 *  - a person in a place (examples/c-cam/s1_person_place.js) written like the prompts teach: the
 *    sample person and place loaded as project modules the way `render:frames --scene` finds
 *    them (people/, places/ next to the scene), drawn through `env.ink` (cut table, contacts,
 *    exprAt, hand lettering, a foreground silhouette); one golden per framing (wide, the loaf,
 *    the face).
 * The suite is `describeWorldLook` (scene lint, goldens `look-ink-scene-<scene>-t<t>`, seek-order
 * and reload determinism).
 */
import { describeWorldLook } from '../support/world-looks.js';

describeWorldLook(
  { style: 'c-cam', width: 1920, height: 1080, tile: 4, fps: 24, inkModules: true },
  'ink-scene',
  [
    ['examples/c-cam/s0_stage.js', 6, [0.4, 2.5, 4.9]],
    ['examples/c-cam/s1_person_place.js', 6, [0.6, 2.4, 4.4]],
  ],
);

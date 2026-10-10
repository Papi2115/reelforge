/**
 * World `c-cam` ("Grim Ink", PLAN.md#14.2, docs/concepts/c-cam-style): hand-built caricature
 * people in specific, grimy places, drawn with an uneven ink line in muddy full colour at native
 * 1080p, acting on twos. Look A = the scene (`ink-scene`), B = the insert/ECU/document
 * (`ink-insert`), C = the poster/title (`ink-poster`); each brings the same `kit.fx.inkStage`
 * (stage.ts), so a project may keep any one of them.
 *
 * Skeleton: experimental and NOT wired (no prompts, no world assets, no shorts); it renders only
 * with `render:frames --experimental` and the apps and the CLI refuse it as a project style.
 * Characters, faces, rig and camera are later tasks (PLAN.md#14.4-14.6).
 *
 * Text: no `ctx.text` in the films; the ink-stroke lettering (lettering/) joins the stage later.
 * `fonts` maps the roles to the engine pixel fonts only because every world must name them.
 * Sound: no own palette yet; the looks reuse `voxel` (follow-up).
 */
import { defineWorld } from '../types.js';
import { inkInsertLook } from './looks/ink-insert/index.js';
import { inkPosterLook } from './looks/ink-poster/index.js';
import { inkSceneLook } from './looks/ink-scene/index.js';
import { C_CAM_ID, C_CAM_STYLE } from './style.js';

export { C_CAM_ID, C_CAM_STYLE } from './style.js';
export { inkInsertLook } from './looks/ink-insert/index.js';
export { inkPosterLook } from './looks/ink-poster/index.js';
export { inkSceneLook } from './looks/ink-scene/index.js';

export const C_CAM = defineWorld({
  id: C_CAM_ID,
  label: 'Grim Ink',
  description:
    'Hand-inked caricature people in specific, grimy places: an uneven ink line, muddy full colour at native 1080p, flat grime shapes, deadpan acting on twos.',
  experimental: true,
  wired: false,
  style: C_CAM_STYLE,
  fonts: { display: 'display', mono: 'mono' },
  soundPalette: 'voxel',
  looks: [inkSceneLook, inkInsertLook, inkPosterLook],
});

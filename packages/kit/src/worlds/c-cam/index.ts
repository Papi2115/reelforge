/**
 * World `c-cam` ("Grim Ink", PLAN.md#14.2, docs/concepts/c-cam-style): hand-built caricature
 * people in specific, grimy places, drawn with an uneven ink line in muddy full colour at native
 * 1080p, acting on twos. Look A = the scene (`ink-scene`), B = the insert/ECU/document
 * (`ink-insert`), C = the poster/title (`ink-poster`); each brings the same `kit.fx.inkStage`
 * (stage.ts), so a project may keep any one of them.
 *
 * Experimental and wired (PLAN.md#14.12): offered as a project style only with Settings ->
 * Experimental worlds; projects get 24 fps and the world defaults (`@reelforge/project`), and a
 * project may turn some of the three looks off (`optionalLooks`, project.json `worldLooks`). The
 * stage's `env.ink` (stage-ink.ts) binds the camera, scenery, grime, faces, rig, contacts and
 * lettering.
 *
 * Text: no `ctx.text` in the films; the ink-stroke lettering is `env.ink.drawText(text, o)`.
 * `fonts` maps the roles to the engine pixel fonts only because every world must name them.
 * Sound: the world's own muted, dry room palette `c-cam` (packages/stages sound palettes).
 */
import { defineWorld } from '../types.js';
import { FPS } from './core.js';
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
  wired: true,
  optionalLooks: true,
  style: C_CAM_STYLE,
  fonts: { display: 'display', mono: 'mono' },
  soundPalette: 'c-cam',
  fps: FPS,
  looks: [inkSceneLook, inkInsertLook, inkPosterLook],
});

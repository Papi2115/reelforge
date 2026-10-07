/**
 * World `game-b2` (PLAN.md#13.4, docs/worlds/DECISIONS.md): the film as a first-person RPG level
 * with a Doom vibe. A deterministic software raycaster in the kit paints a 320x180 view (doubled)
 * of a level the runtime Claude describes as a text grid; a woodgrain HUD at native 640x360
 * carries the story's data. Looks: A `rpg-explore` (walk, take, talk, throw), B `rpg-menu` (menus,
 * the automap and the intermission tally: the breakthrough scenes), C `rpg-boss` (boss bar,
 * damage numbers, stinger, shake). Experimental: renders with `render:frames --experimental`,
 * offered nowhere.
 *
 * Text: the HUD draws its own "Bezel 5x7" face (CC0) into its raster; `ctx.text` / `ctx.annotate`
 * stay the engine pixel fonts (`fonts` maps the roles to them), so the look's docs send all
 * on-screen words to the HUD (narrate, say, toast, labels).
 *
 * Sound: the world's own palette `game-b2` (packages/stages): footsteps, doors, pickups, HUD blips.
 */
import { defineWorld } from '../types.js';
import { rpgBossLook } from './looks/rpg-boss/index.js';
import { rpgExploreLook } from './looks/rpg-explore/index.js';
import { rpgMenuLook } from './looks/rpg-menu/index.js';
import { GAME_B2_ID, GAME_B2_STYLE } from './style.js';

export { GAME_B2_ID, GAME_B2_STYLE } from './style.js';
export { rpgBossLook } from './looks/rpg-boss/index.js';
export { rpgExploreLook } from './looks/rpg-explore/index.js';
export { rpgMenuLook } from './looks/rpg-menu/index.js';
export { checkLevel, type LevelInput } from './level/schema.js';
/** The world's 32 colours [index name, swatch, hex] (the engine's game-native transitions). */
export { B2_TABLE as GAME_B2_COLOURS } from './palette.js';

export const GAME_B2 = defineWorld({
  id: GAME_B2_ID,
  label: 'Game B2: first-person RPG',
  description:
    'The film as a first-person RPG level (Doom vibe): a raycast walk through tungsten and fluorescent rooms, the hand takes the named thing, NPCs talk; woodgrain HUD with year compass, minimap and typed narration.',
  experimental: true,
  style: GAME_B2_STYLE,
  fonts: { display: 'display', mono: 'mono' },
  soundPalette: 'game-b2',
  looks: [rpgExploreLook, rpgMenuLook, rpgBossLook],
});

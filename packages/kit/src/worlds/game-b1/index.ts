/**
 * World `game-b1` (PLAN.md#13.5, docs/worlds/DECISIONS.md): the Atari-era boss-fight montage. Two
 * worlds in one frame: inside the TV the story plays with Atari 2600 rules (double-wide pixels, one
 * colour per sprite row, flicker on crowded lines, playfield blocks, colour cycling, CRT), around
 * it a 1982 wood-panelled living room in square pixels with a camera that pushes into the TV and
 * back. Looks: A `atari-story` (the story in the TV or the room), B `atari-menu` (the console's
 * screens: menus, the level-select map and the breakthroughs, the high-score table and the
 * instruction manual), C `atari-boss` (boss slams, bars, the crash, continue?). Continuity: the
 * camera push into the TV, the calendar zoom and the cartridge insert / pull in the scenes, the
 * game-native `game-b1-*` transitions in the engine. Experimental and unwired: renders with
 * `render:frames --experimental`, offered nowhere.
 *
 * Text: the frame draws its own faces (Joy 5x6, Score Block, Box Art, Dad Hand, Rough Print;
 * CC0) into its raster; `fonts` maps the engine text roles to the engine pixel fonts.
 *
 * Sound: the world's own palette `game-b1` (packages/stages): the cartridge click, the CRT,
 * blips, the slam, paper and pencil, the TV's hum.
 */
import { defineWorld } from '../types.js';
import { atariBossLook } from './looks/atari-boss/index.js';
import { atariMenuLook } from './looks/atari-menu/index.js';
import { atariStoryLook } from './looks/atari-story/index.js';
import { GAME_B1_ID, GAME_B1_STYLE } from './style.js';

export { GAME_B1_ID, GAME_B1_STYLE } from './style.js';
export { atariBossLook } from './looks/atari-boss/index.js';
export { atariMenuLook } from './looks/atari-menu/index.js';
export { atariStoryLook } from './looks/atari-story/index.js';
/** The world's 23 inks [index name, swatch, hex] and its LUTs (the engine's game-native transitions). */
export { B1_TABLE as GAME_B1_COLOURS, GAME_B1_LUTS } from './palette.js';

export const GAME_B1 = defineWorld({
  id: GAME_B1_ID,
  label: 'Game B1: Atari boss montage',
  description:
    'The film as an Atari 2600 game in a 1982 living room: the story inside the TV (wide pixels, one colour per sprite row, flicker, CRT) or the room around it, a camera pushing into the TV, boss cards and sticky notes.',
  experimental: true,
  style: GAME_B1_STYLE,
  fonts: { display: 'display', mono: 'mono' },
  soundPalette: 'game-b1',
  looks: [atariStoryLook, atariMenuLook, atariBossLook],
});

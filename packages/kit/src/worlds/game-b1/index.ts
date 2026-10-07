/**
 * World `game-b1` (PLAN.md#13.5, docs/worlds/DECISIONS.md): the Atari-era boss-fight montage. Two
 * worlds in one frame: inside the TV the story plays with Atari 2600 rules (double-wide pixels, one
 * colour per sprite row, flicker on crowded lines, playfield blocks, colour cycling, CRT), around
 * it a 1982 wood-panelled living room in square pixels with a camera that pushes into the TV and
 * back. Look A `atari-story`; looks B/C, the breakthrough scenes (high-score table, instruction
 * manual) and the continuity transitions (cartridge insert / pull, calendar zoom) come later.
 * Experimental and unwired: renders with `render:frames --experimental`, offered nowhere.
 *
 * Text: the frame draws its own faces (Joy 5x6, Score Block, Box Art, Dad Hand; CC0) into its
 * raster; `fonts` maps the engine text roles to the engine pixel fonts.
 *
 * Sound: placeholder palette `game-b2` (its CRT zap, relay-click latch, key-click typing, blips
 * and tungsten hum already fit a console in a living room) until the world's own palette.
 */
import { defineWorld } from '../types.js';
import { atariStoryLook } from './looks/atari-story/index.js';
import { GAME_B1_ID, GAME_B1_STYLE } from './style.js';

export { GAME_B1_ID, GAME_B1_STYLE } from './style.js';
export { atariStoryLook } from './looks/atari-story/index.js';

export const GAME_B1 = defineWorld({
  id: GAME_B1_ID,
  label: 'Game B1: Atari boss montage',
  description:
    'The film as an Atari 2600 game in a 1982 living room: the story inside the TV (wide pixels, one colour per sprite row, flicker, CRT) or the room around it, a camera pushing into the TV, boss cards and sticky notes.',
  experimental: true,
  style: GAME_B1_STYLE,
  fonts: { display: 'display', mono: 'mono' },
  soundPalette: 'game-b2',
  looks: [atariStoryLook],
});

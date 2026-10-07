/**
 * Fixtures of the Game B1 anti-slop calibration (PLAN.md#13.5 part c): the narration of the
 * approved showcase film (docs/worlds/game-hud-b1-boss-v2/js/film.js, ten shots) plus the
 * narration of the kit examples that tell another story (their header comments: the Moon race
 * board, the pyramid manual), the showcase's research notes (its NOTES.md and v1 NOTES.md: facts,
 * the screens, the HUD states, the level-select places, Dad's tag and notes) with the research
 * lines the examples state, and the kit's Game B1 template scenes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The showcase's narration (film.js `lines`) and the examples' own narration. */
export const GAME_B1_NARRATION = [
  '1983. New Mexico. Atari is burying its games.',
  'How do you lose a fight that badly?',
  'Christmas 1982. Atari rules the living room.',
  "Its big gift: a game of E.T. And it doesn't exist yet.",
  'Boss one: the deadline.',
  'About five weeks to build the whole game.',
  "Its weak point: more time. There wasn't any.",
  'Game over. Back to attract mode.',
  '1982 was a boom year for home games.',
  'Insert coin. Everyone wanted in.',
  'E.T. made Christmas. So did everyone else.',
  'By 1983: consoles everywhere, and games from almost anyone.',
  'Boss two: the flood.',
  "Too many games, too many copies. Buyers couldn't tell good from bad.",
  'Its weak point: quality control. Nobody was enforcing it.',
  'So the games came back.',
  'Unsold and returned cartridges piled up.',
  'How to play: flood a market.',
  'A hit sells. Everyone copies it.',
  "Shelves fill. Buyers can't tell good from bad.",
  'So they stop buying. Any of it.',
  'Alamogordo, New Mexico. The cartridges go into the city landfill.',
  'A game famous for its pits, buried in one.',
  'Boss three: the landfill. Its weak point: it keeps everything.',
  'Game over? Not quite.',
  '1985: the NES brings home games back, with strict quality control.',
  '2014: a film crew digs up the landfill.',
  'The cartridges were still there.',
  // b4 (the Moon race board) and b5 (the pyramid manual) tell other stories.
  '1957, Sputnik. 1961, Gagarin. In 1969 Apollo 11 takes the record.',
  'Press start: one more mission is still to come.',
  "Early members get paid. They are paid with new members' money.",
  'Each level needs more recruits. Then the recruits run out.',
  'So who pays? Most of the recruits lose.',
].join(' ');

/**
 * The showcase's research notes (NOTES.md "Facts", the high-score table and manual sections, v1
 * NOTES.md: the screens, HUD states and seams) and the research lines of the examples (b4: the
 * Moon race; b5: a pyramid scheme).
 */
export const GAME_B1_RESEARCH =
  'Facts: the 1983 crash after a flood of low-quality games; E.T. for the Atari 2600 was rushed ' +
  'for Christmas 1982, built in about five weeks, sold poorly and was returned by the stores; ' +
  'unsold stock was buried in the Alamogordo, NM city landfill (1983); dug up in 2014 for a ' +
  "documentary; the NES (1985) revival. Screens: the living room at Christmas, Dad's tag E.T. / " +
  'XMAS 82 under the tree; the deadline page counts WEEKS LEFT; the high-score table ranks the ' +
  'facts by the order of events; the market menu (MARKET 1983, CONSOLES, the GAMES grid filling ' +
  'until INVENTORY FULL); the manual: a hit sells, everyone copies it, fast; shelves fill with ' +
  'look-alikes; buyers stop buying bad games; FIG. 1 THE SHELF. The level-select map: back to ' +
  'XMAS 82, STORES 83, forward to ALAMOGORDO 83. The landfill sign. Other stories: the Moon ' +
  'race (Sputnik 1957, Gagarin 1961, Apollo 11 1969, Apollo 17 the last landing 1972); a ' +
  'pyramid scheme.';

const KIT = fileURLToPath(new URL('../../../kit/', import.meta.url));

/** The kit's Game B1 template scenes (looks A/B/C, tables, manuals, seams): name -> source. */
export function gameB1Examples(): Map<string, string> {
  const dir = path.join(KIT, 'examples', 'game-b1');
  const files = readdirSync(dir).filter((name) => name.endsWith('.js'));
  return new Map(files.map((name) => [name, readFileSync(path.join(dir, name), 'utf8')]));
}

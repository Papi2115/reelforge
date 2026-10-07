/**
 * Fixtures of the Game B1 anti-slop calibration (PLAN.md#13.5 part c): the narration of the
 * approved showcase film (docs/worlds/game-hud-b1-boss-v2/js/film.js, ten shots) plus the
 * narration of the kit examples that tell another story (their header comments: the Moon race
 * board, the pyramid manual), the showcase's research notes (its NOTES.md and v1 NOTES.md: facts,
 * the screens, the HUD states, the level-select places, Dad's tag and notes) with the research
 * lines the examples state, and the kit's Game B1 template scenes; the open-vocabulary examples
 * (PLAN.md#13.15: forest, ocean, space station, village, desert, city) with their own narration.
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

/**
 * The narration of the open-vocabulary examples (their header comments): each is its own film,
 * judged with its own vocabulary (no showcase narration, so a showcase object would be unrequested).
 */
export const GAME_B1_OPEN_NARRATION: Readonly<Record<string, string>> = {
  'o1_forest.js':
    '1990. Four thousand old oaks stood in the valley. Every morning the ranger walked the ridge and counted them. By 2010 there were nine hundred left.',
  'o2_ocean.js':
    'The reef off Cape Rocha fed the whole village. Each dawn the boats rowed out and the fish came up to meet the nets. In 1998 the water warmed, and the reef turned white.',
  'o3_station.js':
    'In 1986 the first module of Mir reached orbit. Two cosmonauts lived aboard for months, and every ninety minutes they watched the sun rise over the Earth.',
  'o4_village.js':
    'A medieval village lived by its harvest. One summer the rain did not stop for six weeks. The wheat rotted in the fields, and the castle took what was left.',
  'o5_desert.js':
    'Crossing the Sahara by caravan took forty days. At the oasis a camel can drink a hundred litres in ten minutes.',
  'o6_city.js':
    "On Monday, October 19, 1987, the Dow Jones fell from 2246 to 1738 in a single day. By four o'clock, traders were running into the streets of New York.",
};

function examplesIn(sub: string): Map<string, string> {
  const dir = path.join(KIT, 'examples', 'game-b1', sub);
  const files = readdirSync(dir).filter((name) => name.endsWith('.js'));
  return new Map(files.map((name) => [name, readFileSync(path.join(dir, name), 'utf8')]));
}

/** The kit's open-vocabulary examples (`examples/game-b1/open`): name -> source. */
export function gameB1OpenExamples(): Map<string, string> {
  return examplesIn('open');
}

/** The narration of the play examples (their header comments): a level and three menu screens. */
export const GAME_B1_PLAY_NARRATION: Readonly<Record<string, string>> = {
  'p1_level.js':
    'Every shift the miner walked two miles of tunnel. A shaft, a runaway cart, the rats. Two lamps lit the way to the lift.',
  'p2_inventory.js': 'Flour, water, salt and yeast. Flour and water alone already make a dough.',
  'p3_shop.js':
    'Fifty coins. The sail cost forty. The chart cost twenty-five, and he could not have both.',
  'p4_splits.js':
    'Base camp on day one. Camp two by day nine. The summit on day twenty-three, four days faster than the year before.',
};

/**
 * Research lines the play examples show but their narration does not say (the level's HUD year,
 * the rope on the chandler's shelf).
 */
export const GAME_B1_PLAY_RESEARCH = 'The mine shift is set in 1911. The chandler also sells rope.';

/** The kit's play examples (`examples/game-b1/play`: level, inventory, shop, splits). */
export function gameB1PlayExamples(): Map<string, string> {
  return examplesIn('play');
}

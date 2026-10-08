/**
 * Fixtures of the Game B2 anti-slop calibration (PLAN.md#13.4 part c): the narration of the
 * approved showcase film (docs/worlds/game-hud-b2-rpg-v2: the dialogue boxes of js/timeline.js,
 * the automap's and the tally's lines) plus the narration of the kit examples that tell it another
 * way (their header comments), the showcase's research notes (NOTES.md "Facts", the rooms, HUD
 * states and speakers of its timeline) with the research lines the examples state, and the kit's
 * Game B2 template scenes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The showcase's narration (timeline.js `RF.LINES`, automap.js, intermission.js, the menu). */
export const GAME_B2_NARRATION = [
  '1983. Atari buried its unsold games in the desert.',
  'This is how they got there.',
  '1982. Atari wants E.T. on shelves for Christmas.',
  'The programmer gets about five weeks.',
  'Atari bets on a hit and fills the warehouse.',
  'An office, a warehouse: the game is made.',
  "Next stop: the stores. That's where it goes wrong.",
  'The quest: sell E.T. for Christmas.',
  'But stores are already drowning in games.',
  'Cheap clones. Too many of them.',
  'E.T. sells poorly. Stores send it back.',
  'By 1983, the whole market is crashing.',
  'Millions made. Far fewer sold.',
  'Built in about five weeks.',
  'And the stores sent it back.',
  'Atari trucks its unsold stock to Alamogordo, New Mexico.',
  'And buries it.',
  "1985: Nintendo's NES brings the market back.",
  '2014: a film crew digs here and finds them.',
  // The b3 example (a dive into the map mid-walk) says the warehouse line another way.
  'All of it has to go out through one door.',
].join(' ');

/**
 * The showcase's research notes (NOTES.md "Facts" and the automap / tally sections; the HUD
 * states, places and speakers of timeline.js) and the research lines of the examples (b5: a
 * typical schedule in weeks and the share E.T. got; a3: the stores' options; c2: the note).
 */
export const GAME_B2_RESEARCH =
  'Facts: the E.T. cartridges. 1982 Christmas; about 5 weeks to make E.T. for the Atari 2600; ' +
  'the 1983 crash; the Alamogordo, NM landfill and its burial pit; 1985 NES; the 2014 dig. ' +
  'Commonly cited, EST.: ' +
  '4,000,000 made, 1,500,000 sold; a typical 2600 game took about 6 months (26 weeks), so E.T. ' +
  'got about 19% of that. Places: the office, the warehouse (stock stencilled E.T.), the toy ' +
  'store, the returns desk (RETURNS, 1983), Alamogordo. HUD: MARKET drains as the stores flood ' +
  '(status FLOODED; cheap clones, SALE cards); RUSHED after the deadline; the UNSOLD stamp. The ' +
  'clerk at the returns desk: sell it, mark it down or send it back. The calendar on the office ' +
  'wall; the deadline note says XMAS!';

const KIT = fileURLToPath(new URL('../../../kit/', import.meta.url));

/** The kit's Game B2 template scenes (looks A/B/C, automaps, tallies, throws): name -> source. */
export function gameB2Examples(): Map<string, string> {
  const dir = path.join(KIT, 'examples', 'game-b2');
  const files = readdirSync(dir).filter((name) => name.endsWith('.js'));
  return new Map(files.map((name) => [name, readFileSync(path.join(dir, name), 'utf8')]));
}

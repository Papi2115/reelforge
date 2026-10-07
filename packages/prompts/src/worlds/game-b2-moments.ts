/**
 * The Game B2 moment catalog (docs/worlds/README.md "Variety", QUALITY.md §6/§8.2): the closed list
 * of game moments the storyboard plans per shot from the narration (`worldMoment`), with the host
 * looks, the exact kit call the scene turn makes (packages/kit/src/worlds/game-b2, templates in
 * packages/kit/examples/game-b2) and what the critic must see. `automap` and `tally` are the
 * breakthroughs (docs/worlds/game-hud-b2-rpg-v2 shots 4 and 8): creative toolkits with a required
 * `intent`, never a template, never the same mechanism twice in a film; the `throw` (shot 9, the
 * world's signature interaction) needs its `intent` too.
 */
import { gameB2Snippet as snippet } from './game-b2-snippets.js';
import type { WorldMomentOption } from './types.js';

const EXPLORE = 'rpg-explore';
const MENU = 'rpg-menu';
const BOSS = 'rpg-boss';
const SOUNDS = '`const r = <the call>`, then `for (const c of r.cues) ctx.sfx.at(c.t, c.name)`';

const AUTOMAP_BUILD = `\`view.automap({ intent, at, until, enter, exit, scale, rooms, replay, marks, note, camera, legend })\` (look \`rpg-menu\`), a toolkit, never a template. The shape of a call (one way of many; never copy it or the inspirations): ${snippet('automap')}. Every automap is original: the map IS this shot's level, so write a level of the film's route (one room per place of the narration, doors between) and decide what the map must SHOW (the claim) and how: \`enter: 'unfold'\` (grows out of the HUD minimap: keep \`hud.minimap()\`), \`'wipe'\` or \`'cut'\`; \`exit: 'fold'\` (back into the minimap) or \`'cut'\`; \`replay: { from, to, dur }\` (the arrow replays the walk and the rooms draw on as it enters them; \`from\` < 0 = the walk before the shot); rooms \`{ cell, label, sub, state: 'done' | 'next' | 'ahead' | 'hidden', at, labelAt }\`; \`marks\` (\`objective\` diamond, \`item\` = THE item, \`cross\`); a margin \`note\` with its two-stroke arrow; \`camera\` pans \`[{ at, x, y }]\`. Never the same opening and closing twice in one film. \`intent\` (required, 12-160 characters) names the claim (\`two rooms done, the stores come next\`), never a generic "the map"; room names and the note are words of the narration (caps; labels <= 18, the note <= 24 characters); at most 10 rooms and 6 marks. The kit's errors say what to move (a label off screen, under the narration box, two labels colliding). Sounds: ${SOUNDS}. Inspiration, each a different mechanism: \`b2_automap.js\` (the story so far: a replay, a pan to the rooms ahead, the NEXT note, a fold), \`b3_automap_dive.js\` (a dive into the map mid-walk: unfold, the one door out, fold, the walk goes on). A neighbour shot may grow it out of its minimap with \`game-b2-map-unfold\` or take it back with \`game-b2-map-fold\` (keep the map centred on the player at that end).`;

const TALLY_BUILD = `\`hud.tally({ intent, at, until, title, sub, rows, stamp, backdrop, enter, exit })\` (look \`rpg-menu\`), a toolkit, never a template. The shape of a call (one way of many; never copy it or the inspirations): ${snippet('tally')}. Every tally is original: decide the claim its numbers make and how the card sits over the level: \`backdrop: 'freeze'\` (the view held behind the smoked plate), \`'live'\` (the level goes on behind it) or \`'dark'\`; \`enter: 'melt' | 'cut'\`; \`exit: 'dissolve' | 'melt' | 'cut'\`. Never the same backdrop, entrance and exit twice in one film. \`intent\` (required, 12-160 characters) names the claim (\`millions made, far fewer sold\`), never a generic "the tally". 1-6 \`rows\` \`{ label, value, format: 'comma' | 'plain' | 'percent' | 'unit' | 'time', unit: ['WEEK', 'WEEKS'], approx, est, role: 'count' | 'par' | 'best', underline }\`: REAL numbers of the narration or research notes only (\`approx: true\` for "about", \`est: true\` for a commonly cited, unverified figure), labels in their words; one \`stamp\` word of the narration (the accent and the focal point). The numbers land >= 0.5 s before it leaves; it holds <= 4 s after its last number or stamp. Sounds: ${SOUNDS}. Inspiration, each a different mechanism: \`b4_tally.js\` (made against sold over the frozen room, the UNSOLD stamp), \`b5_tally_par.js\` (a percent against par, the room live behind it, it melts away). The next shot may open with \`game-b2-melt\`.`;

const THROW_BUILD = `\`view.throw(item, { intent, at, to: [x, y] | target: spriteId, z, arc, dur, windup, stay, shake })\` (look \`rpg-explore\` or \`rpg-boss\`), the world's signature interaction, never a template: ${snippet('throw')}. The hand holds the item first (${snippet('hold')} or a \`take\` earlier); \`intent\` (required, 12-160 characters) says what the throw MEANS in the narration (\`the cartridge goes back onto the returns pile: E.T. comes back unsold\`), never a generic "a throw"; aim at a sprite of the level (\`target\`: it flinches, a clerk shakes his head) or a cell (\`to\`); \`stay: false\` when it is gone (a bin, a pit); \`at\` = the release on its phrase. Sounds ${SOUNDS}; pair it with the inventory item's \`out: r.release\` and a \`- ITEM\` toast. Never the same item and target twice in one film. Inspiration: \`a4_throw.js\` (the cartridge onto the returns pile), \`c2_throw_note.js\` (the XMAS! note onto the programmer's desk).`;

export const GAME_B2_MOMENTS: readonly WorldMomentOption[] = [
  {
    id: 'automap',
    breakthrough: true,
    looks: [MENU],
    cue: 'where the story has been and where it goes next',
    useWhen:
      'takes stock of where the story has been and where it goes next (the story so far, the next stop, the one way out; a B-roll screen); say in the intent what the map shows (which rooms are done, which comes next) and how it opens and closes, never the same way twice in a film',
    build: AUTOMAP_BUILD,
    visible:
      "the level seen from above as a hand-ruled overhead map (walked rooms solid, the next room dashed, the player arrow, room names in caps), opening out of the minimap or folding back into it; name the intent's claim as the focal point; a map whose rooms and labels show nothing the narration says (decorative rooms, invented names) is `off-intent` with a note starting `automap:`",
  },
  {
    id: 'tally',
    breakthrough: true,
    looks: [MENU],
    cue: 'a chapter summed up in numbers',
    useWhen:
      'sums up a chapter in numbers (how many were made and how many sold, how long it took against how long it should, the result of a stage; a B-roll screen); say in the intent the claim the numbers make and how the card arrives, never the same way twice in a film',
    build: TALLY_BUILD,
    visible:
      "Doom's end-of-level card: counters ticking up row by row on a smoked plate, a still beat, then a rubber stamp; name the intent's claim as the focal point; a tally whose numbers or labels the narration never gives (invented figures) is `off-intent` with a note starting `tally:`",
  },
  {
    id: 'throw',
    breakthrough: false,
    looks: [EXPLORE, BOSS],
    useWhen:
      'gets rid of something, sends it back or hands it on (stock returned, a game dumped in a pit, a deadline landing on someone); say in the intent what the throw means',
    build: THROW_BUILD,
    visible:
      'the held item leaving the hand, tumbling along an arc and landing with a puff of dust on the named thing or person, which flinches; a throw that means nothing in the narration is `off-intent` with a note starting `throw:`',
  },
  {
    id: 'quest-log',
    breakthrough: false,
    looks: [MENU],
    useWhen:
      'pauses to take stock: the goal, what is done and what is still ahead, the facts gathered so far',
    build: `the paused game menu over the dimmed level: ${snippet('menu')} (look \`rpg-menu\`; template \`b1_quest_log.js\`), >= 2.5 s while the walk holds still behind it. NOW = the chapter, the objective = the film's question in its words, DONE = the chapters so far, the inventory grid = the facts picked up (the cursor hops to each on its phrase), a developer's note in the corner only when it says something true. A stat sheet instead of the quest: \`stats: { title, rows: [{ label, value, bar }] }\` with real numbers.`,
    visible:
      'a paused game menu over the dimmed level: a quest log (NOW, the objective in its box, DONE ticked) or a stat sheet, and an inventory grid',
  },
  {
    id: 'inventory-pick',
    breakthrough: false,
    looks: [EXPLORE],
    useWhen:
      'names the one object or fact the story turns on, found or picked up ("the cartridge", "a deadline of five weeks")',
    build: `the hand reaches for the named thing in the level and swings back holding it: ${snippet('take')} (\`from\` = the point on the sprite or shelf; the pink \`band\` = THE item of the story); on the same beat it drops into the inventory (${snippet('inventory')}) with a \`+ ITEM\` toast (template \`a2_warehouse.js\`); then hold still on the item >= 0.4 s.`,
    visible:
      'the first-person hand taking the named item from the level and the item dropping into the inventory bar',
  },
  {
    id: 'dialogue',
    breakthrough: false,
    looks: [EXPLORE, BOSS],
    useWhen:
      'lets someone in the story speak or answer (a clerk, an official, a witness: "stores send it back"), or weighs options toward a verdict',
    build: `a \`clerk\` sprite (with an \`id\`) in the level talks or shakes its head on its phrase (${snippet('act')}), its line typed into the dialogue box with the speaker (${snippet('say')}), optionally a choice box whose wrong options are struck by hand (${snippet('choose')}; template \`a3_returns.js\`). The words exactly as the narration says them.`,
    visible:
      'a person in the level talking or shaking their head, a dialogue box naming the speaker',
  },
  {
    id: 'boss-card',
    breakthrough: false,
    looks: [BOSS],
    useWhen:
      'names the central problem of the film and shows it winning or losing (the market crashing, the returns piling up)',
    build: `the central problem as a boss bar (${snippet('boss')}: \`name\` and \`label\` in the narration's words, each step on its phrase), the thing in danger on a meter (${snippet('meter')}) with numbers popping off it (${snippet('damage')}: the meter's lost segments or story numbers), a hit = ${snippet('shake')} + ${snippet('hudShake')} (decaying), a status (${snippet('status')}) (template \`c1_clone_aisle.js\`). Only THE central problem gets a boss bar, and it stays the same problem for the whole film.`,
    visible: "a boss bar naming the central problem, filling or draining on the narration's beats",
  },
  {
    id: 'stinger',
    breakthrough: false,
    looks: [BOSS],
    useWhen:
      'lands the one phrase the film turns on, a short verdict said with force ("too many", "unsold")',
    build: `${snippet('stinger')}: ONE phrase of the narration (<= 16 characters) slams in letter by letter on uneven beats and falls out at \`until\` (held >= 0.6 s after its last letter), with ${snippet('shake')} and ${snippet('hudShake')} on the hit (template \`c1_clone_aisle.js\`). Once per film; never two stingers in a shot.`,
    visible: 'one big phrase of the narration slammed onto the screen letter by letter',
  },
  {
    id: 'level-card',
    breakthrough: false,
    looks: [],
    transition: 'game-b2-level-card',
    useWhen:
      'opens a new chapter or arrives at a new place or year ("1983.", "in the desert", "back at the office")',
    build: `the shot opens with the \`game-b2-level-card\` transition; then the compass types the new place and rolls the year (${snippet('compass')}), the chapter's flag pops on the progress strip (${snippet('progress')}, ${snippet('checkpoint')}) and the new place's first light clicks on (${snippet('switchOn')}; template \`a1_corridor.js\`).`,
    visible:
      'the compass typing the new place under the year and a chapter flag popping on the progress strip',
  },
];

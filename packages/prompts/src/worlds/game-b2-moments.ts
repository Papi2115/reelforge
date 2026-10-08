/**
 * The Game B2 moment catalog (docs/worlds/README.md "Variety", QUALITY.md §6/§8.2): the closed list
 * of game moments the storyboard plans per shot from the narration (`worldMoment`), with the host
 * looks, the exact kit call the scene turn makes (packages/kit/src/worlds/game-b2) and what the
 * critic must see. `automap` and `tally` are the breakthroughs: creative toolkits with a required
 * `intent`, never a template, never the same mechanism twice in a film; the `throw` (the world's
 * signature interaction) needs its `intent` too. The wording is topic-neutral (PLAN.md#13.15
 * phase 2): the mechanisms are the grammar, the content always comes from the film.
 */
import { gameB2Snippet as snippet } from './game-b2-snippets.js';
import type { WorldMomentOption } from './types.js';

const EXPLORE = 'rpg-explore';
const MENU = 'rpg-menu';
const BOSS = 'rpg-boss';
const SOUNDS = '`const r = <the call>`, then `for (const c of r.cues) ctx.sfx.at(c.t, c.name)`';

const AUTOMAP_BUILD = `\`view.automap({ intent, at, until, enter, exit, scale, rooms, replay, marks, note, camera, legend })\` (look \`rpg-menu\`), a toolkit, never a template. The shape of a call (one way of many; never copy it): ${snippet('automap')}. Every automap is original: the map IS this shot's level, so write a level of the film's route (one room per place of the narration, doors between) and decide what the map must SHOW (the claim) and how; size it so the rooms span at least half the frame (\`scale\` up to 24 px per cell: the kit names the scale to use) and give it \`backdrop: 'freeze'\` (the level held dimmed behind it), never a small map on a black screen; a map held to the end of the shot needs the freeze or \`exit: 'fold'\`, so the film never ends on black; \`enter: 'unfold'\` (grows out of the HUD minimap: keep \`hud.minimap()\`), \`'wipe'\` or \`'cut'\`; \`exit: 'fold'\` (back into the minimap) or \`'cut'\`; \`replay: { from, to, dur }\` (the arrow replays the walk and the rooms draw on as it enters them; \`from\` < 0 = the walk before the shot); rooms \`{ cell, label, sub, state: 'done' | 'next' | 'ahead' | 'hidden', at, labelAt }\`; \`marks\` (\`objective\` diamond, \`item\` = THE item, \`cross\`); a margin \`note\` with its two-stroke arrow; \`camera\` pans \`[{ at, x, y }]\`. Never the same opening and closing twice in one film. \`intent\` (required, 12-160 characters) names the claim (which places are done, which comes next, the one way out), never a generic "the map"; room names and the note are words of the narration (caps; labels <= 18, the note <= 24 characters); at most 10 rooms and 6 marks. The kit's errors say what to move (a label off screen, under the narration box, two labels colliding). Sounds: ${SOUNDS}. Mechanisms to vary (never copy one): the story so far (a replay, a pan to the places ahead, a margin note, a fold back); a dive into the map mid-walk (unfold, the one way out, fold, the walk goes on); a route across outdoor places. A neighbour shot may grow it out of its minimap with \`game-b2-map-unfold\` or take it back with \`game-b2-map-fold\` (keep the map centred on the player at that end).`;

const TALLY_BUILD = `\`hud.tally({ intent, at, until, title, sub, rows, stamp, backdrop, enter, exit })\` (look \`rpg-menu\`), a toolkit, never a template. The shape of a call (one way of many; never copy it): ${snippet('tally')}. Every tally is original: decide the claim its numbers make and how the card sits over the level: \`backdrop: 'freeze'\` (the view held behind the smoked plate), \`'live'\` (the level goes on behind it) or \`'dark'\` (only for a moment, never at the end of the film); \`enter: 'melt' | 'cut'\`; \`exit: 'dissolve' | 'melt' | 'cut'\`. Never the same backdrop, entrance and exit twice in one film. \`intent\` (required, 12-160 characters) names the claim (how much against how much, how long against how long it should take), never a generic "the tally". 1-6 \`rows\` \`{ label, value, format: 'comma' | 'plain' | 'percent' | 'unit' | 'time', unit: ['WEEK', 'WEEKS'], approx, est, role: 'count' | 'par' | 'best', underline }\`: REAL numbers of the narration or research notes only (\`approx: true\` for "about", \`est: true\` for a commonly cited, unverified figure), labels in their words; one \`stamp\` word of the narration (the accent and the focal point). The numbers land >= 0.5 s before it leaves; it holds <= 4 s after its last number or stamp. Sounds: ${SOUNDS}. Mechanisms to vary (never copy one): counts against each other over the frozen place; a share of par with the place live behind it, melting away; a time against a time. The next shot may open with \`game-b2-melt\`.`;

const THROW_BUILD = `\`view.throw(item, { intent, at, to: [x, y] | target: spriteId, z, arc, dur, windup, stay, shake })\` (look \`rpg-explore\` or \`rpg-boss\`), the world's signature interaction, never a template: ${snippet('throw')}. The item is the thing the narration names, drawn as itself (\`{ icon: <the film's icon id> }\`; define one with \`view.defineIcon\` when the film has none); the hand holds it first (${snippet('hold')} or a \`take\` earlier); \`intent\` (required, 12-160 characters) says what the throw MEANS in the narration (a thing handed on, sent back, thrown away, a burden landing on someone), never a generic "a throw"; aim at a sprite of the level (\`target\`: it flinches, a person shakes their head) or a cell (\`to\`); \`stay: false\` when it is gone (into water, a fire, a pit); \`at\` = the release on its phrase. Sounds ${SOUNDS}; pair it with the inventory item's \`out: r.release\` and a \`- ITEM\` toast. Never the same item and target twice in one film, and only where the narration gives or gets rid of something.`;

export const GAME_B2_MOMENTS: readonly WorldMomentOption[] = [
  {
    id: 'automap',
    breakthrough: true,
    looks: [MENU],
    cue: 'where the story has been and where it goes next',
    useWhen:
      'takes stock of where the story has been and where it goes next (the story so far, the next stop, the one way out; a B-roll screen); say in the intent what the map shows (which places are done, which comes next) and how it opens and closes, never the same way twice in a film',
    build: AUTOMAP_BUILD,
    visible:
      "the level seen from above as a hand-ruled overhead map (walked rooms solid, the next room dashed, the player arrow, room names in caps) spanning at least half the frame over the dimmed level, opening out of the minimap or folding back into it; a small map on a mostly black frame is a slop tell; name the intent's claim as the focal point; a map whose rooms and labels show nothing the narration says (decorative rooms, invented names) is `off-intent` with a note starting `automap:`",
  },
  {
    id: 'tally',
    breakthrough: true,
    looks: [MENU],
    cue: 'a chapter summed up in numbers',
    useWhen:
      'sums up a chapter in numbers (how many against how many, how long it took against how long it should, the result of a stage; a B-roll screen); say in the intent the claim the numbers make and how the card arrives, never the same way twice in a film',
    build: TALLY_BUILD,
    visible:
      "Doom's end-of-level card: counters ticking up row by row on a smoked plate, a still beat, then a rubber stamp; name the intent's claim as the focal point; a tally whose numbers or labels the narration never gives (invented figures) is `off-intent` with a note starting `tally:`",
  },
  {
    id: 'throw',
    breakthrough: false,
    looks: [EXPLORE, BOSS],
    useWhen:
      'gets rid of something, sends it back or hands it on (a thing returned, thrown away, passed to the next person, a burden landing on someone); say in the intent what the throw means',
    build: THROW_BUILD,
    visible:
      'the held thing leaving the hand, tumbling along an arc and landing with a puff of dust on the named thing or person, which flinches; a throw that means nothing in the narration, or a thrown item that is not the thing the narration names, is `off-intent` with a note starting `throw:`',
  },
  {
    id: 'quest-log',
    breakthrough: false,
    looks: [MENU],
    useWhen:
      'pauses to take stock: the goal, what is done and what is still ahead, the facts gathered so far',
    build: `the paused game menu over the dimmed level: ${snippet('menu')} (look \`rpg-menu\`), >= 2.5 s while the walk holds still behind it. NOW = the chapter, the objective = the film's question in its words, DONE = the chapters so far, the inventory grid = the story's things as the film's icons (the cursor hops to each on its phrase), a developer's \`note\` in the corner only when it says something true. A stat sheet instead of the quest: \`stats: { title, rows: [{ label, value, bar }] }\` with real numbers. It reads from the moment it opens (NOW and the objective type at once when nothing is DONE yet; never an empty log). One paused menu per film: a second take-stock shot is another screen (the tally, the automap, a stat sheet if the first was a quest log) or stays in the walk with a toast and the inventory bar.`,
    visible:
      'a paused game menu over the dimmed level: a quest log (NOW, the objective in its box, DONE ticked) or a stat sheet, and an inventory grid',
  },
  {
    id: 'inventory-pick',
    breakthrough: false,
    looks: [EXPLORE],
    useWhen:
      'names the one object or fact the story turns on, found or picked up ("the letter", "a seed")',
    build: `the hand reaches for the named thing in the level and swings back holding it: ${snippet('take')} (\`from\` = the point on the sprite or the pile; the item is the film's icon of that thing, the pink \`band\` = THE item of the story); on the same beat it drops into the inventory (${snippet('inventory')}) with a \`+ ITEM\` toast; then hold still on the item >= 0.4 s: start the take at least 2 s before the shot ends (the kit refuses a take still swinging back at the cut, where a linked next shot would lose the item). The taken thing does not stay behind in the level.`,
    visible:
      'the first-person hand taking the named thing from the level and its icon dropping into the inventory bar',
  },
  {
    id: 'dialogue',
    breakthrough: false,
    looks: [EXPLORE, BOSS],
    speaker: true,
    useWhen:
      'quotes someone or tells what they said (a quote, or "the ranger says …": a witness, a worker, an official, an expert, a neighbour), or that person weighs options toward a verdict; never where nobody in the narration speaks (a debated question, a maybe): the narration box carries those, and an invented speaker is a slop tell',
    build: `a person sprite of the level (the film's asset for that person, with an \`id\`; not the same figure as everyone else) talks or shakes their head on the phrase (${snippet('act')}), the line typed into the dialogue box with the speaker (${snippet('say')}), optionally a choice box whose wrong options are struck by hand (${snippet('choose')}). The words exactly as the narration says them; the speaker is the person the narration names, named as it names them; never invent a speaker (a keeper, a guide, a narrator figure).`,
    visible:
      'a person of the story in the level talking or shaking their head, a dialogue box naming the speaker',
  },
  {
    id: 'boss-card',
    breakthrough: false,
    looks: [BOSS],
    useWhen:
      'names the central problem of the film and shows it winning or losing (the threat growing, the problem beaten at last)',
    build: `the central problem as a boss bar (${snippet('boss')}: \`name\` and \`label\` in the narration's words, each step on its phrase), the thing in danger on a meter (${snippet('meter')}) with numbers popping off it (${snippet('damage')}: the meter's lost segments or story numbers), a hit = ${snippet('shake')} + ${snippet('hudShake')} (decaying), a status (${snippet('status')}). Only THE central problem gets a boss bar, it stays the same problem for the whole film, and the film's resolution may drain it.`,
    visible: "a boss bar naming the central problem, filling or draining on the narration's beats",
  },
  {
    id: 'stinger',
    breakthrough: false,
    looks: [BOSS],
    useWhen:
      'lands the one phrase the film turns on, a short verdict said with force ("too late", "never again")',
    build: `${snippet('stinger')}: ONE phrase of the narration (<= 16 characters) slams in letter by letter on uneven beats and falls out at \`until\` (held >= 0.6 s after its last letter), with ${snippet('shake')} and ${snippet('hudShake')} on the hit. Once per film; never two stingers in a shot.`,
    visible: 'one big phrase of the narration slammed onto the screen letter by letter',
  },
  {
    id: 'level-card',
    breakthrough: false,
    looks: [],
    transition: 'game-b2-level-card',
    useWhen:
      'opens a new chapter or arrives at a new place or year ("1871.", "on the coast", "back home")',
    build: `the shot opens with the \`game-b2-level-card\` transition, and at 0 ${snippet('levelCard')} types the new place (and its year or chapter) into the black band the plate leaves, big, then sweeps it off; then the compass types the new place and rolls the year (${snippet('compass')}), the chapter's flag pops on the progress strip (${snippet('progress')}, ${snippet('checkpoint')}) and the new place's first light clicks on or its sky opens (${snippet('switchOn')}).`,
    visible:
      'the new place typed in big letters into a black band across the frame as the level card sweeps off, then the compass naming it and a chapter flag on the progress strip; an empty band is a slop tell',
  },
];

/**
 * The Game B1 moment catalog (docs/worlds/README.md "Variety", QUALITY.md §6/§8.2): the closed list
 * of game moments the storyboard plans per shot from the narration (`worldMoment`), with the host
 * looks, the exact kit call the scene turn makes (packages/kit/src/worlds/game-b1, templates in
 * packages/kit/examples/game-b1) and what the critic must see. `score-table` and `manual` are the
 * breakthroughs (docs/worlds/game-hud-b1-boss-v2 shots 4 and 8): creative toolkits with a required
 * `intent`, never a template, never the same mechanism twice in a film. The calendar zoom and the
 * cartridge are the world's continuity inside a shot (Papi's favourite seams); they need their
 * `intent` too.
 */
import { gameB1Snippet as snippet } from './game-b1-snippets.js';
import type { WorldMomentOption } from './types.js';

const STORY = 'atari-story';
const MENU = 'atari-menu';
const BOSS = 'atari-boss';
const SOUNDS = '`const r = <the call>`, then `for (const c of r.cues) ctx.sfx.at(c.t, c.name)`';

const SCORE_TABLE_BUILD = `\`screen.scoreTable({ intent, at, until, title, rows, hero, print, slam, initials, ring, prompt, enter })\` (look \`atari-menu\`), a toolkit, never a template. The shape of a call (one way of many; never copy it or the inspirations): ${snippet('scoreTable')}. Every table is original: decide the claim (\`intent\`, required, 12-160 characters, never a generic "the high scores") and which facts are its 2-8 \`rows\` \`{ who, score, locked }\`: the story's facts ranked in the order of events, \`who\` in the narration's words (<= 10 characters), \`score\` a REAL number or year of the narration or research notes (never an invented figure), rows after \`hero\` (this shot's fact) locked \`???\` (not happened yet). \`slam.at\` after a beat of silence (>= 0.4 s after the last row prints), \`shake\` 0-6; \`initials: 'arcade' | 'typed' | 'none'\`; Dad's grease pencil \`ring: { at, note }\` (one word of his, <= 8 characters) or none; \`prompt: { text: 'INSERT COIN' | 'PRESS START' | 'PLAYER 1' | 'GAME OVER', at }\` or false; \`enter: 'draw-in' | 'cut'\`. It holds <= 4 s after its last beat. Never the same entrance and initials twice in one film. Sounds: ${SOUNDS}. Inspiration, each a different mechanism: \`b1_scores.js\` (attract mode draws in, only 1ST happened, the ring and BOOM!, INSERT COIN), \`b4_scores_moon.js\` (a board cut in, two records done, the record slams in mid-table, a typed name, PRESS START).`;

const MANUAL_BUILD = `\`screen.manual({ intent, at, until, title, steps, figure, ticks, correction, note, enter, exit })\` (look \`atari-menu\`), a toolkit, never a template. The shape of a call (one way of many; never copy it or the inspirations): ${snippet('manual')}. Every page is original: the mechanism the narration explains as the HOW TO PLAY page of a cheap two-colour manual. \`intent\` (required, 12-160 characters) names the claim, never a generic "the manual"; 1-5 \`steps\` in the narration's words (CAPS, '\\n' breaks a rule, <= 2 lines); FIG. 1 \`figure: { caption, shape: 'cartridge' | 'box' | 'person' | 'house', layout: 'shelf' | 'pile' | 'queue', count, hit, callouts: [{ item, step }] }\` (\`hit\` = the one item in colour); Dad's pencil \`ticks\` follow the narrator (uneven times); ONE red \`correction: { step, strike, write, at }\` (a printed word struck, his word written and circled: the point of the page); a margin \`note: { text, at }\` only when it says something true; \`enter: 'slide' | 'cut'\`, \`exit: 'turn' | 'cut'\`. Never the same entrance, exit and figure twice in one film. The kit's errors say what to change (a correction with no room, too many blocks). Sounds: ${SOUNDS}. Inspiration, each a different mechanism: \`b3_manual.js\` (a shelf of look-alikes, BAD struck to ANY, the page turns onto the level map), \`b5_manual_pyramid.js\` (a pyramid of people slides in over the room, WHO PAYS? in the margin, NEW struck to MOST). The next shot may open with \`game-b1-page-turn\`; a manual shot may open with \`game-b1-page-slide\`.`;

export const GAME_B1_MOMENTS: readonly WorldMomentOption[] = [
  {
    id: 'score-table',
    breakthrough: true,
    looks: [MENU],
    cue: 'facts or records ranked in the order they happened',
    useWhen:
      'ranks the story\'s facts or records in the order they happened, with one of them landing now (a boom year, a record, "the first", "the best-selling"; a B-roll screen); say in the intent what the table claims and which rows are still locked, never the same way twice in a film',
    build: SCORE_TABLE_BUILD,
    visible:
      "the attract-mode high-score table in the TV: rows printing at uneven times, a gold score slamming in after a silent beat, locked ??? rows, a blinking machine prompt; name the intent's claim as the focal point; a table whose rows or scores the narration never gives (invented figures) is `off-intent` with a note starting `score-table:`",
  },
  {
    id: 'manual',
    breakthrough: true,
    looks: [MENU],
    cue: 'how something works, step by step',
    useWhen:
      'explains how something works as a few rules in a row (how a market floods, how a scheme pays, what happens step by step; a B-roll screen); say in the intent the mechanism the page claims and which word the red pen corrects, never the same way twice in a film',
    build: MANUAL_BUILD,
    visible:
      "a cheap two-colour HOW TO PLAY manual page with numbered rules, FIG. 1, pencil ticks and ONE red correction; name the intent's claim as the focal point; a page whose rules or figure show nothing the narration says is `off-intent` with a note starting `manual:`",
  },
  {
    id: 'calendar-zoom',
    breakthrough: false,
    looks: [STORY],
    useWhen:
      'jumps to a date, a deadline or a year and the whole place changes with it ("Christmas 1982", "five weeks to go"); say in the intent what the next place is',
    build: `the living room's wall calendar becomes the next place: ${snippet('room')} first (\`month\` and the ringed \`mark\` from the narration), then ${snippet('calendarZoom')} (\`intent\` required: what the next place is and why the calendar): the camera pushes into the calendar until its page stands where the next place's page stands, and the frame is redrawn line by line as the TV picture; paint the next place in \`screen.tv\` with its page at \`r.landing\` (TV units) from the redraw on (template \`a4_calendar_zoom.js\`). \`wipe: false\` ends on the page and the next shot opens with \`game-b1-scanline-wipe\` (the same seam across a cut). Sounds: ${SOUNDS}.`,
    visible:
      'the camera pushing into the wall calendar in the living room and the frame redrawn line by line as a new place around the same page',
  },
  {
    id: 'cartridge',
    breakthrough: false,
    looks: [STORY, MENU],
    useWhen:
      'puts a game into homes or takes it back (it goes in at Christmas, the games come back, a new game starts); say in the intent what the swap means',
    build: `the console close-up of the same room: ${snippet('cartridge')} (\`intent\` required: what the swap means; \`action: 'insert'\` = it resists, clicks, garbage, the camera pushes back into the TV; \`'pull'\` = squeeze, push down, pull, garbage, the TV goes dark; \`label\` = Dad's tape in his hand, <= 10 characters of the narration). The pull-back starts and the push ends exactly on the TV picture, so the room stays continuous (templates \`a5_cartridge_pull.js\`, \`b2_market.js\`). Sounds: ${SOUNDS}.`,
    visible:
      "Dad's hand at the console in the same living room, the cartridge going into the slot or coming out, the TV rolling garbage",
  },
  {
    id: 'level-select',
    breakthrough: false,
    looks: [MENU],
    useWhen:
      'moves the story to another place or time ("back to Christmas 1982", "then the landfill"); the places of the narration on one map',
    build: `${snippet('levelSelect')} (\`intent\` required: why the story changes place or time; 2-6 \`nodes\` = the narration's places in story order, labels <= 14 characters with their year; a place not reached yet is \`icon: 'lock'\` with no label; the cartridge cursor hops from \`route.from\` to \`route.to\`; template \`b6_level_select.js\`). Sounds: ${SOUNDS}.`,
    visible:
      "a level-select map in the TV: the narration's places joined by dotted paths, a cartridge cursor hopping to the chosen place, which blinks gold",
  },
  {
    id: 'boss-card',
    breakthrough: false,
    looks: [BOSS, STORY],
    useWhen:
      'names the central problem of the film and shows it winning or losing (the deadline, the flood of games, the landfill)',
    build: `the central problem as a boss card: ${snippet('boss')} (\`name\` in the narration's words, <= 16 characters; \`hp\` in a real unit of the narration: WEEKS for a deadline; a boss that IS an amount gains segments; each step on its phrase; \`defeat\` = flicker death). Hits in the TV: hit-stop (freeze t), \`g.remap('flash')\` for a frame or two, a decaying \`g.util.shake\` through \`g.offset\`; the crash drains the picture line by line (\`g.remap('drain', level, [y0, y1])\`). Only THE central problem gets a boss card (templates \`a3_deadline.js\`, \`c1_flood.js\`, \`c2_landfill.js\`).`,
    visible:
      "a boss card naming the central problem (BOSS n, the name slammed in) with its bar filling or draining on the narration's beats",
  },
  {
    id: 'game-over',
    breakthrough: false,
    looks: [BOSS],
    useWhen:
      'loses the fight or asks whether it goes on ("game over", "not quite", "it came back years later")',
    build: `${snippet('gameOver')}: black, the winning boss card burned in, a countdown with unequal holds; the scene's \`screen.tv\` painters draw over it (a new thing dropping in; \`g.rectPx\` only for a newer console's thing; template \`c3_continue.js\`). Sounds: ${SOUNDS}.`,
    visible:
      'a black game-over or continue? screen with the boss card burned into the tube and a countdown',
  },
  {
    id: 'dialogue',
    breakthrough: false,
    looks: [STORY],
    useWhen:
      'lets someone in the story speak or answer (a clerk, a programmer, a buyer: "stores send it back")',
    build: `${snippet('say')}: the line exactly as the narration says it, CAPS, <= 3 lines, the speaker in the narration's words; the box opens as its first letter lands and types at a voiced cadence. The speaker stands in the TV picture (a sprite painted in \`screen.tv\`).`,
    visible: 'a dialogue box naming the speaker over the TV picture, typed at an uneven cadence',
  },
  {
    id: 'glass-note',
    breakthrough: false,
    looks: [STORY, BOSS],
    useWhen:
      'names the weak point or the lesson in a few words ("its weak point: more time", "quality control")',
    build: `Dad's sticky note slapped on the TV glass: ${snippet('note')} (1-4 lines of <= 16 characters, the narration's words; \`under\` underlines a line twice, \`strike\` crosses it out in crimson when the story says it failed, \`tick\` ticks it when it worked). One note at a time, off-centre, never over the focal thing (templates \`a3_deadline.js\`, \`c3_continue.js\`).`,
    visible: "a yellow sticky note in Dad's hand on the TV glass, underlined, struck out or ticked",
  },
  {
    id: 'tv-push',
    breakthrough: false,
    looks: [STORY],
    useWhen:
      'moves between the people living the story and the game itself (from the living room into the game, or back out to the family)',
    build: `the camera pushes from the room into the TV or pulls back out in one continuous move: ${snippet('room')}, ${snippet('camera')} ('room' -> 'tv' grows the picture out of the glass, 'tv' -> 'room' pulls back; end on a hold); the picture in \`screen.tv\` keeps playing through the push (template \`a2_xmas.js\`).`,
    visible:
      'the living room around the TV and the camera pushing into the picture (or pulling back out) in one continuous move',
  },
];

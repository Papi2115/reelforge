/**
 * The Game B1 moment catalog (docs/worlds/README.md "Variety", QUALITY.md §6/§8.2): the closed list
 * of game moments the storyboard plans per shot from the narration (`worldMoment`), with the host
 * looks, the exact kit call the scene turn makes (packages/kit/src/worlds/game-b1) and what the
 * critic must see. `score-table` and `manual` are the breakthroughs: creative toolkits with a
 * required `intent`, never a template, never the same mechanism twice in a film. The calendar
 * zoom and the console swap (`cartridge`) are the world's continuity inside a shot; they need
 * their `intent` too and are used only where the narration moves between a thing and its place.
 * Every example is on a topic far from the showcase (PLAN.md#13.15 phase 2).
 */
import { gameB1Snippet as snippet } from './game-b1-snippets.js';
import type { WorldMomentOption } from './types.js';

const STORY = 'atari-story';
const MENU = 'atari-menu';
const BOSS = 'atari-boss';
const SOUNDS = '`const r = <the call>`, then `for (const c of r.cues) ctx.sfx.at(c.t, c.name)`';
const NOT_UNDER_A_TRANSITION =
  "Start it after the shot's `transitionIn` has ended, never under it (a wipe would hide it).";

const SCORE_TABLE_BUILD = `\`screen.scoreTable({ intent, at, until, title, rows, hero, print, slam, initials, ring, prompt, enter })\` (look \`atari-menu\`), a toolkit, never a template. The shape of a call (one way of many; never copy it): ${snippet('scoreTable')}. Every table is original: decide the claim (\`intent\`, required, 12-160 characters, never a generic "the high scores") and which facts are its 2-8 \`rows\` \`{ who, score, locked }\`: the story's facts ranked in the order of events, \`who\` in the narration's words (<= 10 characters), \`score\` a REAL number or year of the narration or research notes (never an invented figure), ONE unit per table (all years, or all counts of one thing), rows after \`hero\` (this shot's fact) locked \`???\` (not happened yet; their score still shows, so give them the year it happens). \`slam.at\` after a beat of silence (>= 0.4 s after the last row prints), \`shake\` 0-6; \`initials: 'arcade' | 'typed' | 'none'\`; a grease-pencil \`ring: { at, note }\` (one word, <= 8 characters) or none; \`prompt: { text: 'INSERT COIN' | 'PRESS START' | 'PLAYER 1' | 'GAME OVER', at }\` or false; \`enter: 'draw-in' | 'cut'\`. It holds <= 4 s after its last beat; fill the frame (no half-empty black screen). Never the same entrance and initials twice in one film. Sounds: ${SOUNDS}. Ways it can go (pick one or invent another): the attract screen draws in with only the first row happened, a ring and a short word, INSERT COIN; a board cut in with two records done and the new one slamming in mid-table, a typed name, PRESS START.`;

const MANUAL_BUILD = `\`screen.manual({ intent, at, until, title, steps, figure, ticks, correction, note, enter, exit })\` (look \`atari-menu\`), a toolkit, never a template. The shape of a call (one way of many; never copy it): ${snippet('manual')}. Every page is original: the mechanism the narration explains as the HOW TO PLAY page of a cheap two-colour manual. \`intent\` (required, 12-160 characters) names the claim, never a generic "the manual"; 1-5 \`steps\` in the narration's words (CAPS, '\\n' breaks a rule, <= 2 lines); FIG. 1 \`figure: { caption, shape, layout: 'shelf' | 'pile' | 'queue', count, hit, callouts: [{ item, step }] }\` draws the rules' nouns with the closest \`shape\` (\`'person'\`, \`'house'\`, \`'box'\`; \`hit\` = the one item in colour); pencil \`ticks\` follow the narrator (uneven times); ONE red \`correction: { step, strike, write, at }\` (a printed word struck, the reader's word written and circled: the point of the page); a margin \`note: { text, at }\` only for a true word of the narration, never a source or a URL; \`enter: 'slide' | 'cut'\`, \`exit: 'turn' | 'cut'\`. Never the same entrance, exit and figure twice in one film. The kit's errors say what to change (a correction with no room, too many blocks). Sounds: ${SOUNDS}. Ways it can go (pick one or invent another): a row of near-identical items with the one that matters in colour, a word struck and corrected, the page turning away; a queue or a pile of people sliding in over the room with a question in the margin. The next shot may open with \`game-b1-page-turn\`; a shot opened by \`game-b1-page-slide\` starts its page with \`enter: 'cut'\` (the transition already slid it in).`;

export const GAME_B1_MOMENTS: readonly WorldMomentOption[] = [
  {
    id: 'score-table',
    breakthrough: true,
    looks: [MENU],
    cue: 'facts or records ranked in the order they happened',
    useWhen:
      'ranks the story\'s facts or records in the order they happened, with one of them landing now (a record, a first, "the tallest", "the deepest"; a B-roll screen); say in the intent what the table claims and which rows are still locked, never the same way twice in a film',
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
      'explains how something works as a few rules in a row (how a tide turns, how a rumour empties a bank, what happens step by step; a B-roll screen); say in the intent the mechanism the page claims and which word the red pen corrects, never the same way twice in a film',
    build: MANUAL_BUILD,
    visible:
      "a cheap two-colour HOW TO PLAY manual page with numbered rules, FIG. 1, pencil ticks and ONE red correction; name the intent's claim as the focal point; a page whose rules or figure show nothing the narration says is `off-intent` with a note starting `manual:`",
  },
  {
    id: 'calendar-zoom',
    breakthrough: false,
    looks: [STORY],
    useWhen:
      'jumps to a date or a year and the whole place changes with it ("on the night of 12 May", "ten years later"); say in the intent what the next place is',
    build: `the room's wall calendar becomes the next place: ${snippet('interior')} first (its calendar with the narration's \`month\`, \`year\` and ringed \`mark\`), then ${snippet('calendarZoom')} (\`intent\` required: what the next place is and why the calendar): the camera pushes into the calendar until its page stands where the next place's page stands, and the frame is redrawn line by line as the TV picture; paint the next place in \`screen.tv\` with its page at \`r.landing\` (TV units) from the redraw on. \`wipe: false\` ends on the page and the next shot opens with \`game-b1-scanline-wipe\` (the same seam across a cut). When this shot already opens with \`game-b1-calendar-zoom\`, do not zoom again: start on the landed page. Sounds: ${SOUNDS}.`,
    visible:
      'the camera pushing into the wall calendar of the room and the frame redrawn line by line as a new place around the same page',
  },
  {
    id: 'cartridge',
    breakthrough: false,
    looks: [STORY, MENU],
    useWhen:
      'turns from one subject to the next while the world stays (a new chapter, a second attempt, "then the town tried again"); say in the intent what the swap means',
    build: `the console close-up of the same room: ${snippet('cartridge')} (\`intent\` required: what the swap means; \`action: 'insert'\` = it resists, clicks, garbage, the camera pushes back into the TV; \`'pull'\` = squeeze, push down, pull, garbage, the TV goes dark; \`label\` = hand-written tape, <= 10 characters of the narration). The pull-back starts and the push ends exactly on the TV picture, so the room stays continuous. ${NOT_UNDER_A_TRANSITION} Sounds: ${SOUNDS}.`,
    visible:
      'a hand at the console of the same room, a game going into the slot or coming out, the TV rolling garbage',
  },
  {
    id: 'level-select',
    breakthrough: false,
    looks: [MENU],
    useWhen:
      'moves the story to another place or time ("back to the harbour", "then the mine"); the places of the narration on one map',
    build: `${snippet('levelSelect')} (\`intent\` required: why the story changes place or time; 2-6 \`nodes\` = the narration's places in story order with the closest icon, labels <= 14 characters with their year; a place not reached yet is \`icon: 'lock'\` with no label; the cursor hops from \`route.from\` to \`route.to\`). Sounds: ${SOUNDS}.`,
    visible:
      "a level-select map in the TV: the narration's places joined by dotted paths, a cursor hopping to the chosen place, which blinks gold",
  },
  {
    id: 'boss-card',
    breakthrough: false,
    looks: [BOSS, STORY],
    useWhen:
      'names THE central problem of the film (one per film: a storm, a debt, a drought) and shows it winning or losing',
    build: `the central problem as a boss: generate it from traits (${snippet('generateBoss')}, or the project's boss asset) and draw it big in the TV, then its card ${snippet('boss')} (\`name\` in the narration's words, <= 16 characters; \`hp\` in a real unit of the narration; a boss that IS an amount gains segments; each step on its phrase; \`defeat\` = flicker death). ONE boss in the film (\`num: 1\`): a second problem or a question is a sticky note or a CONTINUE?, never another boss. Hits in the TV: hit-stop (freeze t), \`g.remap('flash')\` for a frame or two, a decaying \`g.util.shake\` through \`g.offset\`; the picture drains line by line (\`g.remap('drain', level, [y0, y1])\`).`,
    visible:
      "a boss card naming the central problem (BOSS n, the name slammed in) with its bar filling or draining on the narration's beats, the boss itself in the TV",
  },
  {
    id: 'game-over',
    breakthrough: false,
    looks: [BOSS],
    useWhen:
      'loses the fight or asks whether it goes on ("game over", "not quite", "it came back years later")',
    build: `${snippet('gameOver')}: black, the boss card burned in, a countdown with unequal holds; the scene's \`screen.tv\` painters draw over it (what comes next dropping in: a sprite, a place). Keep the black short (about a second), then put something on it. Sounds: ${SOUNDS}.`,
    visible:
      'a game-over or continue? screen with the boss card burned into the tube, a countdown and what comes next dropping in',
  },
  {
    id: 'dialogue',
    breakthrough: false,
    looks: [STORY],
    useWhen:
      'lets someone in the story speak or answer (a keeper, a farmer, a trader: "the lamp is out")',
    build: `${snippet('say')}: the line exactly as the narration says it, CAPS, <= 3 lines, the speaker in the narration's words; the box opens as its first letter lands and types at a voiced cadence. The speaker stands in the TV picture as a big sprite (${snippet('generatePerson')} with the role, hat and tool that fit, or the project's asset).`,
    visible: 'a dialogue box naming the speaker over the TV picture, typed at an uneven cadence',
  },
  {
    id: 'glass-note',
    breakthrough: false,
    looks: [STORY, BOSS],
    useWhen:
      'names the weak point or the lesson in a few words ("its weak point: the old pier", "check the tide first")',
    build: `a sticky note slapped on the TV glass in the player's hand: ${snippet('note')} (1-4 lines of <= 16 characters, the narration's words; \`under\` underlines a line twice, \`strike\` crosses it out in crimson when the story says it failed, \`tick\` ticks it when it worked). One note at a time, off-centre, never over the focal thing; land and strike it while the camera is in the TV (from the room it cannot be read).`,
    visible:
      'a yellow sticky note in a hand-written scrawl on the TV glass, underlined, struck out or ticked',
  },
  {
    id: 'tv-push',
    breakthrough: false,
    looks: [STORY],
    useWhen:
      'moves between the place around the story and the game itself (from the room into the game, or back out)',
    build: `the camera pushes from the room into the TV or pulls back out in one continuous move: a room that fits the film (${snippet('interiorPoster')}), ${snippet('camera')} ('room' -> 'tv' grows the picture out of the glass, 'tv' -> 'room' pulls back; end on a hold); the picture in \`screen.tv\` keeps playing through the push.`,
    visible:
      'a room around the TV and the camera pushing into the picture (or pulling back out) in one continuous move',
  },
];

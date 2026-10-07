/**
 * The anti-slop knowledge of the Game B1 world (packages/kit/src/worlds/game-b1, QUALITY.md §6/§8;
 * `WorldSlopSpec` in world-labels.ts).
 *
 * Human traces: Dad's sticky note on the glass (`note`; underlined twice, struck out in crimson or
 * ticked: `under`, `strike`, `tick`), the decaying shake (`g.util.shake`), the hit flash, drain or
 * lights going out row by row (`g.remap`), irregular typing (`typed`, a painter text's `type`),
 * seeded unevenness (`hash`), a landing squash (`squash`), carts tumbling (`tumble`), the boss card
 * (the name slams in with an overshoot, segments arrive unevenly), the game-over countdown with
 * unequal holds, the garbage frame of a cartridge in the slot; the lived-in room (`room`: uneven
 * planks, the hand-drawn joystick cable, asymmetric rabbit ears, a thumbprint on the glass: 2) with
 * a pen ringing a calendar day (`markAt`), the tree's bulbs on their own cadences (`tree`) and the
 * missing gift's dashed gap with Dad's swinging tag (`gift`); the continuity seams draw their own
 * (the calendar zoom: the unclosed ring and the interlaced redraw; the cartridge: the hand, the
 * knit sleeve, the slot resisting: 2 each); the level-select map (dots a unit off, uneven hops
 * with a squash, an uneven blink: 3), and the breakthroughs (the high-score table: uneven rows,
 * 2600 flicker, the silent beat, the slam, Dad's ring; the manual: the off-register plate, the
 * crooked feed, coffee rings, pencil ticks, the red correction: 3 each) plus their pencil options
 * (`ring`, `ticks`, `correction`, a margin `note`). Repeats are capped (several shakes on one hit
 * are one gesture). The CRT, the scanlines, the HUD year and the narration box's typewriter run in
 * every shot and never count.
 *
 * Text: the narration box and dialogue (`narrate` / `say`, a `speaker`), the TV painter's `text`
 * and `score` digits, the HUD `year`, Dad's `note` lines and the cartridge's tape `label`, a gift
 * `tag`, the calendar `month`, a boss card's `name` (read only inside `boss`), the high-score rows
 * (`who`, a `score` number or string), the manual's `steps` and its correction (`strike`,
 * `write`, labels: any unknown word is invented). Game words (HIGH SCORES, HOW TO PLAY, FIG., INSERT COIN, PRESS START, BOSS, WEAK POINT,
 * CONTINUE?, GAME OVER, INVENTORY FULL) and time units are labels; a two-digit year (XMAS 82) is
 * the full year of the sources.
 *
 * Open vocabulary (PLAN.md#13.15): sprite, playfield, generator and room ids (`defineSprite`,
 * `generate`, `g.draw`, `interior('office')`), their `describe` and a counter's `means` are not on
 * screen; a counter's `keys` values, a calendar's `year` and the chalk `lines` of a blackboard are;
 * a shelf's `items` (the room DSL's enum: cartridges, books, …) are labels. Traces of the open
 * layer: held-step motion (`g.util.path`, once) and sprites animated off each other's beat (`phase`,
 * once). World checks
 * (game-b1-showcase.ts): an unrequested showcase object per scene, number-only monotony per film.
 */
import { b1NumberOnlyFindings, b1ShowcaseFindings } from './game-b1-showcase.js';
import type { WorldSlopSpec } from './world-labels.js';

const SQUASH = 'squash (a landing squash)';
const TUMBLE = 'tumble (carts tumbling)';
const TYPE = 'type (irregular typing)';
const PHASE = "phase (sprites off each other's beat)";

/** Words of the console's own screens and the HUD, and the time units of its counters. */
const GAME_LABELS =
  'high score scores how play fig insert coin press start player game games over continue boss ' +
  'weak point level select inventory full menu manual ' +
  'day days week weeks month months year years hour hours minute minutes ' +
  // The room DSL's shelf items (`{ kind: 'shelf', items }`), an enum read as a text option.
  'cartridges books boxes papers tools jars trophies records';

export const GAME_B1_SLOP: WorldSlopSpec = {
  traceMethods: {
    note: 1,
    shake: 1,
    remap: 1,
    typed: 1,
    hash: 1,
    garbage: 1,
    boss: 1,
    gameOver: 1,
    room: 2,
    calendarZoom: 2,
    cartridge: 2,
    levelSelect: 3,
    scoreTable: 3,
    manual: 3,
    path: 1,
  },
  traceCaps: {
    path: 1,
    [PHASE]: 1,
    shake: 2,
    remap: 2,
    typed: 1,
    hash: 1,
    garbage: 1,
    [SQUASH]: 1,
    [TUMBLE]: 1,
    [TYPE]: 1,
  },
  traceOptions: [
    { key: 'under', trace: 'under (a note underlined twice)' },
    { key: 'strike', trace: 'strike (struck out by hand)' },
    { key: 'tick', trace: 'tick (a two-stroke tick)' },
    { key: 'ring', trace: "ring (Dad's grease pencil)" },
    { key: 'ticks', trace: 'ticks (pencil ticks that follow the narrator)' },
    { key: 'correction', trace: 'correction (the red pen)' },
    { key: 'markAt', trace: 'markAt (the pen rings the day)' },
    { key: 'tree', trace: 'tree (bulbs on their own cadences)' },
    { key: 'gift', trace: "gift (the dashed gap, Dad's tag)" },
    { key: 'squash', trace: SQUASH },
    { key: 'tumble', trace: TUMBLE },
    { key: 'type', trace: TYPE },
    { key: 'phase', trace: PHASE },
  ],
  labels: GAME_LABELS.split(' '),
  labelPatterns: [],
  textMethods: ['narrate', 'say', 'text', 'score', 'note', 'year'],
  textKeys: ['speaker', 'who', 'score', 'steps', 'strike', 'write', 'tag', 'month'],
  textCallKeys: { boss: ['name'] },
  numberKeys: ['score', 'year'],
  keyedNumbers: { counter: 'keys' },
  correctionKeys: ['strike', 'write'],
  shortYears: true,
  breakthroughs: {
    scoreTable: { enter: 'draw-in', initials: 'arcade' },
    manual: { enter: 'slide', exit: 'cut', 'figure.shape': 'cartridge', 'figure.layout': 'shelf' },
    calendarZoom: {},
    cartridge: {},
    levelSelect: {},
  },
  sourceChecks: b1ShowcaseFindings,
  filmChecks: b1NumberOnlyFindings,
};

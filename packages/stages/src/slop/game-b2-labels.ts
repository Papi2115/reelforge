/**
 * The anti-slop knowledge of the Game B2 world (packages/kit/src/worlds/game-b2, QUALITY.md §6/§8;
 * `WorldSlopSpec` in world-labels.ts).
 *
 * Human traces: a light that clicks on with two stutters (`switchOn`), a shake with decay
 * (`shake`, view and HUD), a clerk who talks or shakes his head (`act`), the reach that overshoots
 * (`take`), stock dropping in with an overshoot (`place`), the push forward (`present`), the throw
 * (dip, tumble, 8.5 fps dust, the target flinches: 2), a choice box with an overshooting cursor
 * and options struck by hand (`choose`), a stinger on uneven beats, a number popping off a meter
 * (`damage`), a fog bank (`fog`), the paused menu (two-stroke ticks, a slot a pixel low: 2); the
 * automap and the tally draw their own traces (hand-ruled walls at an uneven pen speed, a margin
 * note; uneven counting, a coffee ring, a misregistered stamp) and count for three. In the level:
 * chalk on a wall, a calendar with crossed days, a faulty tube or a stuttering bulb, a card on a
 * stick at an angle, a worn item, a dev or margin note; the built-in levels bring theirs (office:
 * the chalk tally and the bulb; warehouse: the faulty tube and a carton missing from the rack).
 * Repeats are capped (several shakes on one hit are one gesture). The head-bob, the HUD plates and
 * the typewriter run in every shot and never count.
 *
 * Text: the HUD's `narrate` / `say` / `stinger`, its text options (`place`, `year`, a toast's
 * `head` / `body`, a speaker, choice `options`, menu lines, tally `unit`s, stat `value`s, a
 * built-in level's `stencil`), a boss
 * bar's `name` (read only inside `boss`: a level's `name` is not on screen) and the numbers of a
 * tally row (`value`). Game words (QUEST LOG, + ITEM, EST., PAR, …) and time units are labels; a
 * damage number of one digit (`-2`) is a meter's lost segments.
 *
 * Open vocabulary (PLAN.md#13.15 phase 2): asset ids (pack keys, `defineSprite` / `defineIcon`),
 * level and sprite ids and the generators' options (`kind`, `hat`, a vehicle's `body` ramp, legend
 * colours) are not on screen: a toast's `head` and `body` are text only inside `toast`. Traces of the
 * open layer, once each: a fire light (`flicker: 'fire'`, a torch, a campfire), a crooked plant
 * (`lean`), one sprite turned the other way (`flip`), hand-drawn animation `frames`, a texture's
 * `wear` and a gait of the shot's own (`bob`); generator sway and the default head-bob never count
 * (the six open examples: 3-5 traces each). World checks: an unrequested showcase object per
 * scene (game-b2-showcase.ts); craft per scene and over the film (game-b2-craft.ts: numbers
 * popping off nothing, a web address on screen, the same menu twice, a film ending on black, a
 * linked item that blinks at the seam).
 */
import { b2CraftFindings, b2FilmFindings } from './game-b2-craft.js';
import { b2ShowcaseFindings } from './game-b2-showcase.js';
import type { WorldSlopSpec } from './world-labels.js';

const TILT = 'tilt (a card on a stick at an angle)';
const TUBE = "flicker: 'tube' (a faulty tube)";
const FIRE = "flicker: 'fire' (a flame that flickers)";
/** Traces of the open vocabulary (generator and pixel-art options, the view's gait). */
const OPEN = {
  lean: 'lean (a crooked plant)',
  flip: 'flip (one of them turned the other way)',
  frames: 'frames (hand-drawn animation)',
  wear: 'wear (a worn, cracked surface)',
  bob: 'bob (a gait of its own: a drift, a heavy stride)',
} as const;

/** Words of the game's own screens and HUD, and the time units of its counters. */
const GAME_LABELS =
  'quest log inventory paused pause done ahead est item items updated checkpoint next finished ' +
  'par best time stats objective exit dev note build ' +
  'day days week weeks month months year years hour hours minute minutes';

export const GAME_B2_SLOP: WorldSlopSpec = {
  traceMethods: {
    switchOn: 1,
    shake: 1,
    act: 1,
    take: 1,
    place: 1,
    present: 1,
    throw: 2,
    choose: 1,
    stinger: 1,
    damage: 1,
    fog: 1,
    menu: 2,
    automap: 3,
    tally: 3,
  },
  traceCaps: {
    shake: 2,
    act: 2,
    place: 2,
    damage: 1,
    [TILT]: 1,
    [TUBE]: 1,
    [FIRE]: 1,
    ...Object.fromEntries(Object.values(OPEN).map((trace) => [trace, 1])),
  },
  traceOptions: [
    { key: 'chalk', trace: 'chalk (a mark on the wall)' },
    { key: 'crossed', trace: 'crossed (days crossed on a calendar)' },
    { key: 'flicker', value: 'tube', trace: TUBE },
    { key: 'flicker', value: 'bulb', trace: "flicker: 'bulb' (a stuttering bulb)" },
    { key: 'flicker', value: 'fire', trace: FIRE },
    // The open vocabulary's authored imperfections (once each, however often they appear).
    { key: 'lean', trace: OPEN.lean },
    { key: 'flip', trace: OPEN.flip },
    { key: 'frames', trace: OPEN.frames },
    { key: 'wear', trace: OPEN.wear },
    { key: 'bob', trace: OPEN.bob },
    { key: 'tilt', trace: TILT },
    { key: 'dirty', trace: 'dirty (a worn item)' },
    { key: 'note', trace: 'note (a dev note or a margin note)' },
    { key: 'level', value: 'office', trace: "level 'office' (the chalk tally)" },
    { key: 'level', value: 'office', trace: "level 'office' (the stuttering bulb)" },
    { key: 'level', value: 'warehouse', trace: "level 'warehouse' (the faulty tube)" },
    { key: 'level', value: 'warehouse', trace: "level 'warehouse' (a carton missing)" },
  ],
  labels: GAME_LABELS.split(' '),
  // A damage number of one digit: segments lost on a meter, not a claim.
  labelPatterns: [/(?<![\p{L}\d.,])[-+]\d(?![\p{L}\d.,])/gu],
  textMethods: ['narrate', 'say', 'stinger'],
  textKeys: [
    'place',
    'year',
    'speaker',
    'options',
    'sub',
    'itemLabel',
    'now',
    'objective',
    'done',
    'ahead',
    'value',
    'unit',
    'stencil',
  ],
  textCallKeys: { boss: ['name'], toast: ['head', 'body'] },
  numberKeys: ['value'],
  breakthroughs: {
    automap: { enter: 'unfold', exit: 'fold' },
    tally: { backdrop: 'freeze', enter: 'melt', exit: 'dissolve' },
    throw: {},
  },
  sourceChecks: (program, file, vocabulary) => [
    ...b2ShowcaseFindings(program, file, vocabulary),
    ...b2CraftFindings(program, file),
  ],
  filmChecks: b2FilmFindings,
};

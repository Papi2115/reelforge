/**
 * The exact Game B2 kit calls the prompts quote (packages/kit/src/worlds/game-b2). Every snippet is
 * a complete, runnable expression over `ctx`, `kit`, `LEVEL` (the worked level), `view` and `hud`:
 * the stages test `game-b2-snippets.test.ts` runs each one through the real kit (the level format
 * and `checkLevel`, the automap, tally and throw specs, the HUD text checks) and repaints the
 * frame, so the prompt text cannot drift from the API. Values are an example of the call's shape,
 * never a design to copy.
 */

/** The worked level: the kit's built-in `office`, written out (the stencil is `E.T.`). */
const LEVEL = `{
  name: 'office', mood: 'dark', floor: 'concrete', ceiling: 'dark',
  grid: [
    '#############WWWWWWWWWWW',
    '#############WWWWWKWWWWW',
    '#############WooooooooWW',
    '#############WooooooooWW',
    '#############WouLoooooWW',
    '#########T###WooooooLoPW',
    '#..........,.DooooooooDW',
    '#####..######WoooooLooWW',
    '#############WouuuooooWW',
    '#############WooooooooWW',
    '#############WooooooooWW',
    '#############WWWWWWWWWWW',
  ],
  legend: {
    '#': { wall: 'concrete' },
    T: { wall: 'concrete', chalk: 'tally', count: 5 },
    W: { wall: 'wood-panel' },
    K: { wall: 'wood-panel', pinned: 'calendar', crossed: 23 },
    P: { wall: 'wood-panel', pinned: 'poster' },
    u: { wall: 'cubicle' },
    D: { door: true },
    ',': { floor: 'concrete-sand' },
    o: { floor: 'carpet', ceiling: 'office', mood: 'tungsten' },
    L: { floor: 'carpet', ceiling: 'office-light', mood: 'tungsten' },
  },
  lights: [
    { id: 'bulb', pos: [11.0, 6.45], z: 0.68, power: 1.7, radius: 1.45, flicker: 'bulb', bulb: true },
    { pos: [16.5, 4.5], power: 0.8, radius: 4.2 },
    { pos: [19.5, 7.5], power: 0.7, radius: 4.2 },
    { pos: [20.5, 5.5], power: 0.6, radius: 3.6 },
    { id: 'desk-lamp', pos: [20.6, 2.1], z: 0.5, power: 0.4, radius: 1.4 },
  ],
  sprites: [
    { id: 'clue', sprite: 'sand-pile', pos: [11.05, 6.8], band: 'pink', label: 'E.T.' },
    { id: 'worker', sprite: 'desk', pos: [20.6, 2.3], person: true },
  ],
}`;

export const GAME_B2_SNIPPETS = {
  level: LEVEL,
  /** The view: the level, a walk with uneven keys (walk in, stop, look) and the phrase anchor. */
  view: "kit.fx.b2View({ size: [ctx.shot.width, ctx.shot.height], level: LEVEL, duration: ctx.shot.duration, anchor: ctx.anchor, path: [{ at: 0, x: 15.2, y: 7.6, yaw: -50, ease: 'lin' }, { at: 1.4, x: 16.9, y: 6.9, yaw: -58, ease: 'out' }, { at: 2.3, x: 17.2, y: 6.8, yaw: -66, pitch: 6, ease: 'inOut' }] })",
  /** The HUD over the view (woodgrain plates, native 640x360). */
  hud: 'kit.fx.b2Hud({ size: [ctx.shot.width, ctx.shot.height], view, duration: ctx.shot.duration, anchor: ctx.anchor })',
  /** Year, heading tape, objective marker; the place types under it. */
  compass: "hud.compass({ at: 0.25, year: '1982', place: 'THE OFFICE', target: [20.6, 2.3] })",
  minimap: 'hud.minimap({ at: 0.45 })',
  /** The narration box: typed at an irregular cadence, CAPS, \n breaks, <= 3 lines. */
  narrate:
    "hud.narrate('1982. ATARI WANTS E.T.\\nON SHELVES FOR CHRISTMAS.', { at: 'atari', until: 4.4 })",
  /** A line said by someone in the level. */
  say: "hud.say('E.T. SELLS POORLY.', { speaker: 'CLERK', at: 'sells', until: 3.6 })",
  /** Film progress: this shot's t0 and t1 as shares of the film, the chapter flags. */
  progress: 'hud.progress({ at: 0.6, from: 0.2, to: 0.29, chapters: [0.2, 0.47, 0.71] })',
  /** A chapter starts: its flag pops on the progress strip and its name types under it. */
  checkpoint: "hud.checkpoint({ label: 'THE WAREHOUSE', at: 0.4 })",
  toast: "hud.toast({ head: 'NEW QUEST', body: 'SHELVES BY CHRISTMAS', at: 2.9 })",
  /** Facts picked up so far; the new one drops in. */
  inventory:
    "hud.inventory({ at: 0.9, items: [{ icon: 'calendar', label: 'DEADLINE: ~5 WEEKS', at: -3 }, { icon: 'cartridge', label: '+ E.T. CARTRIDGE', at: 'cartridge', band: 'pink' }] })",
  status: "hud.status({ label: 'RUSHED', icon: 'hourglass', at: 0 })",
  /** A meter ONLY for the thing really in danger; damage pops off it. */
  meter: "hud.meter({ label: 'MARKET', at: 0.4, keys: [[0, 12], [3.3, 10], [5.1, 9]] })",
  damage: "hud.damage({ text: '-2', at: 3.3, on: 'meter' })",
  /** The boss bar ONLY for the central problem. */
  boss: "hud.boss({ name: 'RETURNS DESK', label: 'UNSOLD', at: 1.25, keys: [[1.25, 0.2], [3.1, 0.55], [5.4, 1]] })",
  /** A choice box: the cursor overshoots, the wrong option is struck by hand, the pick lights. */
  choose:
    "hud.choose({ speaker: 'CLERK', options: ['SELL IT', 'SEND IT BACK'], at: 3.7, until: 6.4, steps: [{ at: 3.85, cursor: 0 }, { at: 4.5, strike: 0 }, { at: 4.85, cursor: 1 }, { at: 5.1, pick: 1 }] })",
  /** One phrase of the narration slams in letter by letter (once per film). */
  stinger: "hud.stinger('TOO MANY', { at: 'too many', until: 5.6 })",
  shake: "view.shake({ at: 'too many', amp: 1.6 })",
  hudShake: "hud.shake({ at: 'too many', amp: 2.5 })",
  /** The light clicks on with two stutters; a door slides open. */
  switchOn: "view.switchOn('bulb', { at: 0.42 })",
  open: 'view.open([13, 6], { at: 4.9, dur: 0.7 })',
  /** The hand reaches for the named thing and swings back holding it. */
  take: "view.take({ label: 'E.T.', band: 'pink' }, { at: 'cartridge', from: [17.9, 6.2, 0.45] })",
  hold: "view.hold({ label: 'E.T.', band: 'pink' }, { at: -1 })",
  /** An NPC (a `clerk` sprite with this id) talks or shakes its head. */
  act: "view.act('clerk', { act: 'talk', at: 'sells', until: 3.6 })",
  /** Time passes: a fog bank rolls in and clears. */
  fog: 'view.fog({ at: 1, until: 3.2 })',
  /** The throw (one way of many): the held note onto the worker's desk. */
  throw:
    "view.throw({ kind: 'note', label: 'XMAS!', band: 'clay' }, { intent: 'the Christmas deadline lands on the desk of the programmer: five weeks start now', at: 3.9, target: 'worker', arc: 0.35 })",
  /** A paused menu: the quest log and the inventory grid over the dimmed level. */
  menu: "hud.menu({ at: 0, until: 4.2, quest: { now: 'CHRISTMAS 1982', objective: 'SELL E.T. FOR CHRISTMAS.', done: ['1982 · THE DEADLINE'], ahead: 2 }, inventory: { items: [{ icon: 'cartridge', label: 'E.T. CARTRIDGE', sub: 'ATARI 2600 · 1982', itemLabel: 'E.T.', band: 'pink' }, { icon: 'calendar', label: 'DEADLINE', sub: 'ABOUT FIVE WEEKS' }], select: [{ at: 0.55, index: 0 }, { at: 2.6, index: 1 }] }, note: 'DEV NOTE: NO PITS\\nIN THIS BUILD' })",
  /** The automap (one way of many): the map of this level, the next room dashed. */
  automap:
    "view.automap({ intent: 'the corridor is behind us; the office with the deadline comes next', at: 1, until: 5.6, scale: 12, rooms: [{ cell: [4, 6], label: 'THE CORRIDOR', sub: '1983' }, { cell: [17, 5], label: 'THE OFFICE', sub: '1982', state: 'next', at: 2.2 }], marks: [{ kind: 'objective', pos: [20.6, 2.6], at: 2.6 }], note: { text: 'NEXT: THE DEADLINE', pos: [14.5, 9.6], to: [20.4, 2.8], at: 3.3 } })",
  /** The tally (one way of many): the chapter in real numbers, a still beat, the stamp. */
  tally:
    "hud.tally({ intent: 'five weeks against a usual six months: the game got a fraction of the time', at: 0, until: 6, title: 'THE DEADLINE', sub: '1982', rows: [{ label: 'TIME', value: 5, format: 'unit', unit: ['WEEK', 'WEEKS'], approx: true }, { label: 'PAR', value: 6, format: 'unit', unit: ['MONTH', 'MONTHS'], approx: true, est: true, role: 'par', underline: true }], stamp: { text: 'RUSHED' }, backdrop: 'live', enter: 'cut', exit: 'melt' })",
} as const;

export type GameB2Snippet = keyof typeof GAME_B2_SNIPPETS;

/** A snippet as inline code in a prompt. */
export const gameB2Snippet = (name: GameB2Snippet): string => `\`${GAME_B2_SNIPPETS[name]}\``;

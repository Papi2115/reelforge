/**
 * The exact Game B2 kit calls the prompts quote (packages/kit/src/worlds/game-b2, the open
 * vocabulary of PLAN.md#13.15). Every snippet is a complete, runnable expression over `ctx`, `kit`,
 * `LEVEL` (the worked indoor level), `OUTDOOR` + `SHOT_ASSETS` (the worked outdoor level and its
 * one-off assets), `view` and `hud`; `ctx.worldAssets` is the film's asset pack (`assets`): the
 * stages test `game-b2-snippets.test.ts` runs each one through the real kit (the asset packs, the
 * level format and `checkLevel`, the automap, tally and throw specs, the HUD text checks) and
 * repaints the frame, so the prompt text cannot drift from the API. The values are topic-neutral
 * on purpose and vary from snippet to snippet: they show the shape of a call, never a design or a
 * topic to copy (docs/worlds/DECISIONS.md "a world is a style GRAMMAR").
 */

/** A film's asset pack (`assets/game-b2/*.json`, `ctx.worldAssets`): people, animals, things. */
const ASSETS = `{
  version: 1, world: 'game-b2',
  sprites: {
    teacher: { gen: 'person', seed: 3, hair: 'bun', glasses: true, outfit: 'dress', clothes: 'plum', tool: 'book' },
    pupil: { gen: 'person', seed: 8, build: 'child', outfit: 'overalls', hairColour: 'tungsten' },
    caretaker: { gen: 'person', seed: 5, build: 'stout', beard: true, hat: 'cap', outfit: 'apron', clothes: 'earth', tool: 'bucket' },
    cat: { gen: 'creature', kind: 'quadruped', form: 'cat', coat: 'stone', pattern: 'stripes', seed: 2, size: 0.45 },
    'school-desk': { gen: 'object', kind: 'table', seed: 4, size: 0.38 },
    bookcase: { gen: 'object', kind: 'bookshelf', seed: 6 },
    stove: {
      rows: [
        '...oo...',
        '...oo...',
        '.oooooo.',
        '.oIIIIo.',
        '.oIffIo.',
        '.oIffIo.',
        '.oIIIIo.',
        '.o....o.',
      ],
      legend: { o: 'stone.1', I: 'stone.2', f: 'tungsten' },
      glow: ['tungsten'], size: [0.5, 0.7],
    },
  },
  textures: {
    plaster: { gen: 'texture', kind: 'stone', seed: 3, ramp: 'earth', wear: 0.4 },
    panelling: { gen: 'texture', kind: 'planks', seed: 7, ramp: 'warm', wear: 0.2 },
    floorboards: { gen: 'texture', kind: 'planks', seed: 5 },
    beams: { gen: 'texture', kind: 'logs', seed: 9 },
  },
  icons: {
    chalk: {
      rows: [
        '..........pp',
        '.........ppP',
        '........ppP.',
        '.......ppP..',
        '......ppP...',
        '.....ppP....',
        '....ppP.....',
        '...ppP......',
      ],
      legend: { p: 'paper', P: 'putty' },
    },
    slate: { gen: 'icon', kind: 'book', colour: 'char', accent: 'paper' },
  },
}`;

/** The worked indoor level: a dark corridor, a door, the tungsten classroom behind it. */
const LEVEL = `{
  name: 'village-school', mood: 'dark', floor: 'floorboards', ceiling: 'dark',
  grid: [
    'SSSSSSSSSSWWWWWWWWWWWS',
    'SSSSSSSSSSoooooooooooS',
    'SSSSSSSSSSoooooooooooS',
    'SSSSSSSSSSoooooooooooS',
    'SSSSSSSSSSoooooooooooS',
    'S........DoooooooooooS',
    'S........SoooooooooooS',
    'SSSSSSSSSSoooooooooooS',
    'SSSSSSSSSSoooooooooooS',
    'SSSSSSSSSSoooooooooooS',
    'SSSSSSSSSSSSSSSSSSSSSS',
  ],
  legend: {
    S: { wall: 'plaster' },
    W: { wall: 'panelling' },
    D: { door: true },
    o: { floor: 'floorboards', ceiling: 'beams', mood: 'tungsten' },
  },
  lights: [
    { id: 'lamp', pos: [15.5, 4.5], z: 0.8, power: 1.2, radius: 4.5, flicker: 'bulb', bulb: true },
    { pos: [12.5, 8.0], power: 0.6, radius: 3.5 },
    { id: 'hall', pos: [4.5, 5.6], z: 0.9, power: 0.7, radius: 2.4, flicker: 'tube' },
  ],
  sprites: [
    { id: 'teacher', sprite: 'teacher', pos: [17.5, 3.2] },
    { sprite: 'school-desk', pos: [13.5, 6.1] },
    { sprite: 'school-desk', pos: [16.0, 6.3] },
    { sprite: 'pupil', pos: [13.4, 6.7] },
    { sprite: 'pupil', pos: [16.1, 6.9], flip: true },
    { sprite: 'stove', pos: [19.9, 8.7] },
    { sprite: 'bookcase', pos: [10.6, 1.6] },
    { id: 'cat', sprite: 'cat', pos: [11.3, 8.8] },
    { id: 'caretaker', sprite: 'caretaker', pos: [6.5, 6.3] },
  ],
}`;

/** One-off assets of a single shot (the film's pack has the people). */
const SHOT_ASSETS = `{
  sprites: {
    pine: { gen: 'plant', kind: 'conifer', seed: 4, height: 2.8 },
    'pine-small': { gen: 'plant', kind: 'conifer', seed: 9, height: 1.5, lean: 0.2 },
    goat: { gen: 'creature', kind: 'quadruped', form: 'grazer', horns: 'horns', coat: 'stone', seed: 5, size: 0.8 },
    hut: { gen: 'structure', kind: 'hut', seed: 2, lit: 0.5 },
    signpost: { gen: 'object', kind: 'signpost', seed: 1 },
  },
  textures: {
    scree: { gen: 'texture', kind: 'rock', seed: 6, wear: 0.5 },
    snowfield: { gen: 'texture', kind: 'snow', seed: 2 },
    trail: { gen: 'texture', kind: 'mud', seed: 3, ramp: 'earth' },
  },
}`;

/** The worked outdoor level: a mountain pass at dawn (sky, skyline, an open border). */
const OUTDOOR = `{
  name: 'mountain-pass',
  sky: { preset: 'dawn', skyline: 'mountains', skylineHeight: 0.14, clouds: 0.25, sun: { az: -20, el: 6 }, ground: 'snowfield' },
  floor: 'snowfield',
  grid: [
    '..................',
    '..RRR.......RRRR..',
    '..RRR........RR...',
    '......,,,,,,,.....',
    '....,,,,,,,,,,,...',
    '..,,,,,......,,,..',
    '..................',
    '...RR.......RRR...',
    '..................',
  ],
  legend: { R: { wall: 'scree', height: 2.2 }, ',': { floor: 'trail' } },
  lights: [{ pos: [9.5, 1.4], z: 0.5, power: 0.8, radius: 2.5, flicker: 'fire' }],
  sprites: [
    { sprite: 'hut', pos: [9.5, 1.2] },
    { sprite: 'pine', pos: [1.4, 4.2] },
    { sprite: 'pine', pos: [16.2, 3.6], flip: true },
    { sprite: 'pine-small', pos: [6.5, 6.8] },
    { sprite: 'pine-small', pos: [11.8, 6.4], flip: true },
    { id: 'goat', sprite: 'goat', pos: [11.4, 2.6], flip: true },
    { sprite: 'signpost', pos: [7.6, 5.2] },
    { id: 'pupil', sprite: 'pupil', pos: [10.2, 4.4] },
  ],
}`;

export const GAME_B2_SNIPPETS = {
  assets: ASSETS,
  level: LEVEL,
  shotAssets: SHOT_ASSETS,
  outdoor: OUTDOOR,
  /** The view: the level, the film's assets, a walk with uneven keys and the phrase anchor. */
  view: "kit.fx.b2View({ size: [ctx.shot.width, ctx.shot.height], level: LEVEL, assets: ctx.worldAssets, duration: ctx.shot.duration, anchor: ctx.anchor, path: [{ at: 0, x: 2.2, y: 5.7, yaw: 4, ease: 'lin' }, { at: 1.6, x: 6.8, y: 5.5, yaw: 0, ease: 'out' }, { at: 2.4, x: 7.2, y: 5.5, yaw: -8, pitch: 4, ease: 'inOut' }] })",
  /** A shot with one-off assets of its own next to the film's (the walk over the pass). */
  viewOutdoor:
    "kit.fx.b2View({ size: [ctx.shot.width, ctx.shot.height], level: OUTDOOR, assets: [].concat(ctx.worldAssets ?? [], SHOT_ASSETS), duration: ctx.shot.duration, anchor: ctx.anchor, path: [{ at: 0, x: 3.2, y: 5.5, yaw: -10, ease: 'lin' }, { at: 2.2, x: 7.4, y: 4.6, yaw: -20, ease: 'out' }, { at: 3.0, x: 7.6, y: 4.5, yaw: -38, pitch: -6, ease: 'inOut' }] })",
  /** The HUD over the view (woodgrain plates, native 640x360). */
  hud: 'kit.fx.b2Hud({ size: [ctx.shot.width, ctx.shot.height], view, duration: ctx.shot.duration, anchor: ctx.anchor })',
  /** A sprite generated after build (for `place`, the hand, the HUD). */
  defineSprite:
    "view.defineSprite('sparrow', { gen: 'creature', kind: 'bird', form: 'perch', coat: 'earth', belly: 'paper', seed: 4, size: 0.22 })",
  /** A sprite drawn as pixel art, one character per pixel ('.' = transparent). */
  defineArt:
    "view.defineSprite('lantern', { rows: ['..oo..', '.oyyo.', 'oyYYyo', 'oyYYyo', '.oyyo.', '..oo..'], legend: { o: 'warm.1', y: 'tungsten', Y: 'bulb' }, glow: ['bulb'], size: [0.18, 0.24], z: 0.5 })",
  /** An item icon: a generator call or 12x12 pixel art. */
  defineIcon: "view.defineIcon('apple', { gen: 'icon', kind: 'apple' })",
  /** A sprite drops into the level with an overshoot. */
  place: "view.place({ sprite: 'sparrow', pos: [19.7, 8.4], z: 0.7 }, { at: 'sparrow' })",
  /** Year, heading tape, objective marker; the place types under it. */
  compass: "hud.compass({ at: 0.25, year: '1871', place: 'THE RIVER FORD', target: [17.5, 3.2] })",
  minimap: 'hud.minimap({ at: 0.45 })',
  /** The narration box: typed at an irregular cadence, CAPS, \n breaks, <= 3 lines. */
  narrate: "hud.narrate('BEES KEEP THE HIVE WARM\\nBY SHIVERING.', { at: 'bees', until: 4.4 })",
  /** A line said by someone in the level. */
  say: "hud.say('THE LAMP MUST NOT\\nGO OUT TONIGHT.', { speaker: 'KEEPER', at: 'lamp', until: 3.6 })",
  /** Film progress: this shot's t0 and t1 as shares of the film, the chapter flags. */
  progress: 'hud.progress({ at: 0.6, from: 0.2, to: 0.29, chapters: [0.2, 0.47, 0.71] })',
  /** A chapter starts: its flag pops on the progress strip and its name types under it. */
  checkpoint: "hud.checkpoint({ label: 'THE HARVEST', at: 0.4 })",
  toast: "hud.toast({ head: 'NEW QUEST', body: 'CROSS THE RIVER', at: 2.9 })",
  /** Facts picked up so far, drawn as the film's icons; the new one drops in. */
  inventory:
    "hud.inventory({ at: 0.9, items: [{ icon: 'slate', label: 'SLATE', at: -3 }, { icon: 'chalk', label: '+ CHALK', at: 'chalk', band: 'pink' }] })",
  status: "hud.status({ label: 'LATE', icon: 'alarm', at: 0 })",
  /** A meter ONLY for the thing really in danger; damage pops off it. */
  meter: "hud.meter({ label: 'GRAIN', at: 0.4, keys: [[0, 12], [3.3, 10], [5.1, 7]] })",
  damage: "hud.damage({ text: '-3', at: 5.1, on: 'meter' })",
  /** The boss bar ONLY for the central problem. */
  boss: "hud.boss({ name: 'THE FLOOD', label: 'RISING', at: 1.25, keys: [[1.25, 0.2], [3.1, 0.55], [5.4, 1]] })",
  /** A choice box: the cursor overshoots, the wrong option is struck by hand, the pick lights. */
  choose:
    "hud.choose({ speaker: 'MAYOR', options: ['BUILD THE DAM', 'MOVE THE TOWN'], at: 3.7, until: 6.4, steps: [{ at: 3.85, cursor: 0 }, { at: 4.5, strike: 0 }, { at: 4.85, cursor: 1 }, { at: 5.1, pick: 1 }] })",
  /** One phrase of the narration slams in letter by letter (once per film). */
  stinger: "hud.stinger('NO WAY BACK', { at: 'no way back', until: 5.6 })",
  shake: "view.shake({ at: 'no way back', amp: 1.6 })",
  hudShake: "hud.shake({ at: 'no way back', amp: 2.5 })",
  /** The light clicks on with two stutters; a door slides open. */
  switchOn: "view.switchOn('lamp', { at: 0.42 })",
  open: 'view.open([9, 5], { at: 4.9, dur: 0.7 })',
  /** The hand reaches for the named thing (the film's icon) and swings back holding it. */
  take: "view.take({ icon: 'chalk' }, { at: 'chalk', from: [17.9, 3.0, 0.5] })",
  hold: "view.hold({ icon: 'slate' }, { at: -1 })",
  /** A person of the level (a generated `person` sprite with this id) talks or shakes its head. */
  act: "view.act('teacher', { act: 'talk', at: 'lesson', until: 3.6 })",
  /** Time passes: a fog bank rolls in and clears. */
  fog: 'view.fog({ at: 1, until: 3.2 })',
  /** The throw (one way of many): the held thing lands on the person it is handed to. */
  throw:
    "view.throw({ icon: 'chalk' }, { intent: 'the pupil sends the chalk back to the teacher: it is her turn to explain', at: 3.9, target: 'teacher', arc: 0.35 })",
  /** A paused menu: the quest log and the inventory grid over the dimmed level. */
  menu: "hud.menu({ at: 0, until: 4.2, quest: { now: 'WINTER TERM', objective: 'KEEP THE SCHOOL OPEN.', done: ['AUTUMN · THE ROOF'], ahead: 2 }, inventory: { items: [{ icon: 'slate', label: 'SLATES', sub: 'ONE PER PUPIL' }, { icon: 'chalk', label: 'CHALK', sub: 'LAST BOX', band: 'pink' }], select: [{ at: 0.55, index: 0 }, { at: 2.6, index: 1 }] } })",
  /** The automap (one way of many): the map of this level, the next room dashed. */
  automap:
    "view.automap({ intent: 'the cold corridor is behind us; the warm classroom where the lesson starts comes next', at: 1, until: 5.6, scale: 12, rooms: [{ cell: [4, 5], label: 'THE CORRIDOR' }, { cell: [15, 5], label: 'THE CLASSROOM', state: 'next', at: 2.2 }], marks: [{ kind: 'objective', pos: [17.5, 3.4], at: 2.6 }], note: { text: 'NEXT: THE LESSON', pos: [5.5, 8.6], to: [15.2, 5.2], at: 3.3 } })",
  /** The tally (one way of many): a chapter in real numbers, a still beat, the stamp. */
  tally:
    "hud.tally({ intent: 'six years of digging for nine miles of tunnel', at: 0, until: 6, title: 'THE TUNNEL', sub: '1857 - 1863', rows: [{ label: 'LENGTH', value: 9, format: 'unit', unit: ['MILE', 'MILES'], approx: true }, { label: 'DIGGING', value: 6, format: 'unit', unit: ['YEAR', 'YEARS'], role: 'par', underline: true }], stamp: { text: 'OPEN' }, backdrop: 'live', enter: 'cut', exit: 'melt' })",
} as const;

export type GameB2Snippet = keyof typeof GAME_B2_SNIPPETS;

/** A snippet as inline code in a prompt. */
export const gameB2Snippet = (name: GameB2Snippet): string => `\`${GAME_B2_SNIPPETS[name]}\``;

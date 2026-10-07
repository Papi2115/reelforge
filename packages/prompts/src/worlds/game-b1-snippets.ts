/**
 * The exact Game B1 kit calls the prompts quote (packages/kit/src/worlds/game-b1, its open
 * vocabulary in `vocab/` and `room/`). Every snippet is a complete, runnable expression over
 * `ctx`, `kit` and `screen` (the shot's `kit.fx.b1Screen`): the stages test
 * `game-b1-snippets.test.ts` runs each one through the real kit (its zod schemas, the 2600 sprite
 * and playfield rules, the font checks, the high-score table's and the manual's layout and timing
 * checks) and repaints the frame, so the prompt text cannot drift from the API. The topics are
 * deliberately far from the showcase (a lighthouse coast, a bank run, Everest, a mining coast):
 * an example of the call's shape, never a design to copy.
 */

export const GAME_B1_SNIPPETS = {
  /** One frame of two worlds per shot: the TV picture, the room, the glass, the HUD. */
  screen:
    'kit.fx.b1Screen({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, anchor: ctx.anchor })',
  /** A 2600 player from rows: '#' lit, '.' empty, 8 bits, ONE ink per row, stretched. */
  defineSprite:
    "screen.defineSprite('lighthouse', { rows: ['...##...', '..####..', '...##...', '..####..', '..####..', '.######.'], colours: ['gold', 'rust', 'cream', 'rust', 'cream', 'greyDark'], size: 2, rowH: 3, describe: 'the lighthouse on the point, its lamp lit' })",
  /** Animation: frames of one height, played at `fps`. */
  spriteFrames:
    "screen.defineSprite('gull', { frames: [['#......#', '.#....#.', '..#..#..', '...##...'], ['........', '###..###', '...##...', '........']], colours: 'white', fps: 4, describe: 'a gull flapping' })",
  /** An animal from a preset and traits (seeded from the id). */
  generateAnimal:
    "screen.generate('fox', { kind: 'animal', like: 'dog', colour: 'orange', size: 2 })",
  /** A person: one humanoid base + role, hat, tool. */
  generatePerson: "screen.generate('keeper', { kind: 'person', role: 'sailor', tool: 'lantern' })",
  generateVehicle: "screen.generate('boat', { kind: 'vehicle', type: 'boat', size: 2 })",
  /** The film's central problem as a boss from traits. */
  generateBoss:
    "screen.generate('storm', { kind: 'boss', body: 'cloud', eyes: 2, mouth: 'teeth', arms: true, colour: 'grey' })",
  /** Scenery as a generated playfield (canopy, waves, dunes, hills, skyline, wall, reef, clouds, ground). */
  scenery: "screen.generate('sea', { kind: 'scenery', type: 'waves', rows: 5, rowH: 4 })",
  /** A hand-made playfield: 20-bit rows of 4-unit blocks, repeated or mirrored. */
  definePlayfield:
    "screen.definePlayfield('cliffs', { rows: ['#####...............', '#######.............', '#########...........'], rowH: 4, colours: ['grey', 'greyDark', 'walnut'], mode: 'repeat' })",
  /** The picture inside the TV: a place, the hero walking in held steps, a hit (stop, flash, shake). */
  tv: "screen.tv((g, t) => { const hit = 2.4; const tt = t >= hit && t < hit + 0.1 ? hit : t; const sh = g.util.shake(t, hit, 3, 8, 101); g.bands(0, 160, [[0, 'night'], [44, 'dusk'], [70, 'blue']]); g.field('sea', 116); g.draw('lighthouse', 112, 62, { playfield: true }); g.draw('gull', 30, 30, { phase: 1 }); g.offset(sh.x * 2, sh.y * 2); const k = g.util.path([[0, 8, 92], [hit, 60, 92]], tt); g.draw('keeper', k.x, k.y, { frame: k.moving ? undefined : 0, flicker: false }); g.offset(0, 0); g.text('THE POINT', 8, 164, { colour: 'tan', type: { at: 0.75, cps: 18 } }); if (t >= hit && t < hit + 0.04) g.remap('flash'); })",
  /** A real number of the story in the TV, with what it means. */
  counter:
    "screen.tv((g) => { g.counter({ means: 'ships wrecked on the point', keys: [[0.4, 12], [3.1, 31]], x: 8, y: 24, colour: 'gold' }); })",
  /** The room fits the film: a workshop by day, the sea in the window, a calendar with the year. */
  interior:
    "screen.interior({ shell: 'workshop', light: 'day', calendar: { month: 'MAY', year: 1936, mark: 12, markAt: [0.6, 1.4] }, props: [{ kind: 'window', x: 214, sky: 'day', view: 'sea' }, { kind: 'shelf', x: 262, items: 'tools' }] })",
  /** A bedroom at night with a poster printing one of the film's own sprites. */
  interiorPoster:
    "screen.interior({ shell: 'bedroom', light: 'night', calendar: { month: 'NOV', year: 1991, mark: 9 }, props: [{ kind: 'window', x: 214, sky: 'night', view: 'stars' }, { kind: 'poster', x: 270, sprite: 'lighthouse' }, { kind: 'lamp', x: 300, type: 'floor' }] })",
  /** A classroom with the narration's words in chalk, no calendar. */
  interiorBoard:
    "screen.interior({ shell: 'classroom', light: 'day', calendar: false, props: [{ kind: 'blackboard', x: 180, lines: ['HIGH TIDE', 'TWICE A DAY'] }] })",
  /** The camera push from the room into the TV: the picture grows out of the glass. */
  camera: "screen.camera([{ at: 0, on: 'room' }, { at: 1.6, on: 'tv', ease: 'inOut' }])",
  /** The HUD year (the story's date); a second call rolls it, the old one burns in. */
  year: "screen.year('1936', { at: -1 })",
  /** Film progress: one slot per shot, this shot's share of the film. */
  progress: 'screen.progress({ from: 0.1, to: 0.2, slots: 10 })',
  checkpoint: "screen.checkpoint({ label: 'THE STORM', at: 0.4 })",
  /** A real number of the story counting on the HUD. */
  score: "screen.score({ label: 'WRECKS', keys: [[0.5, 12], [3.1, 31]] })",
  /** Hearts ONLY for the one thing really under threat. */
  lives: "screen.lives({ label: 'BOATS', max: 4, keys: [[0, 4], [3.15, 3]] })",
  /** The narration box: typed at a voiced cadence, CAPS, \n breaks, <= 3 lines. */
  narrate:
    "screen.narrate('1936. THE POINT.\\nTHE STORM CAME AT NIGHT.', { at: 'storm', until: 4.4 })",
  say: "screen.say('THE LAMP IS OUT.', { speaker: 'KEEPER', at: 'lamp', until: 3.6 })",
  /** A sticky note on the glass in the player's hand: underlined twice, then struck out. */
  note: "screen.note(['FIX FIRST:', 'THE OLD PIER'], { at: 'pier', x: 172, y: 190, under: 1, strike: { line: 1, at: 4.8 } })",
  /** The boss card ONLY for the central problem: BOSS n, the name slams in, a real unit. */
  boss: "screen.boss({ num: 1, name: 'THE STORM', from: 'right', at: 1.2, hp: { n: 4, label: 'NIGHTS', keys: [[3.15, 3], [4.1, 2], [4.82, 1]] }, defeat: 5.4 })",
  /** The high-score table (one way of many): the story's facts ranked, one slams in gold. */
  scoreTable:
    "screen.scoreTable({ intent: 'the firsts on Everest in order: only the 1953 ascent has happened, the later firsts are still locked', at: 0, until: 5.8, rows: [{ who: 'HILLARY', score: 1953 }, { who: 'TABEI', score: 1975 }, { who: 'MESSNER', score: 1978 }, { score: 1980 }], hero: 0, print: 0.62, slam: { at: 2.78 }, ring: { at: 3.6, note: 'FIRST!' }, prompt: { text: 'PRESS START', at: 4.4 } })",
  /** The manual page (one way of many): the mechanism as HOW TO PLAY, one red correction. */
  manual:
    "screen.manual({ intent: 'a bank run: the fear of a shortage empties the bank and makes the shortage real', at: 0, until: 5.8, steps: ['A RUMOUR SAYS\\nTHE BANK IS SHORT.', 'SAVERS QUEUE\\nFOR THEIR MONEY.', 'THE BANK SELLS\\nWHAT IT CAN, FAST.', 'SO THE RUMOUR\\nCOMES TRUE.'], figure: { caption: 'THE QUEUE', shape: 'person', layout: 'queue', count: 6, hit: 0, callouts: [{ item: 0, step: 2 }] }, ticks: [1.3, 2.1, 2.9], correction: { step: 4, strike: 'RUMOUR', write: 'FEAR', at: 3.9 }, enter: 'cut', exit: 'turn' })",
  /** The camera pushes into the room's wall calendar; the next place is redrawn around its page. */
  calendarZoom:
    "screen.calendarZoom({ intent: 'the night of the storm: the calendar on the workshop wall becomes the point in the rain', at: 2.2, push: 0.9, wipe: 0.62 })",
  /** The console close-up of the same room: a game goes into the slot, the camera pushes back in. */
  cartridge:
    "screen.cartridge({ intent: 'the story leaves the point for the town: the same room, a new game in the slot', action: 'insert', at: 0.6, label: 'THE TOWN', enter: 'pull-back', exit: 'push', hold: 1.2 })",
  /** The level-select map when the story changes place or time; a lock is not reached yet. */
  levelSelect:
    "screen.levelSelect({ intent: 'the story moves down the coast, from the village to the mine that shipped the ore', at: 0, until: 3.6, nodes: [{ label: 'VILLAGE 1890', icon: 'home', x: 24, y: 118 }, { label: 'PORT 1902', icon: 'store', x: 62, y: 80, above: true }, { label: 'THE MINE 1911', icon: 'pit', x: 104, y: 124 }, { icon: 'lock', x: 136, y: 70, above: true }], route: { from: 0, to: 2, at: 0.28, dur: 2.2 } })",
  /** The game-over screen as the TV's backdrop, the winning boss card burned in. */
  gameOver:
    "screen.gameOver({ text: 'CONTINUE?', at: 0, until: 3.1, count: [[0.3, 9], [1.2, 8], [2.0, 7]] })",
} as const;

export type GameB1Snippet = keyof typeof GAME_B1_SNIPPETS;

/** A snippet as inline code in a prompt. */
export const gameB1Snippet = (name: GameB1Snippet): string => `\`${GAME_B1_SNIPPETS[name]}\``;

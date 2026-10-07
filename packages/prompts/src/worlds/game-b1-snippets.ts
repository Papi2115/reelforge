/**
 * The exact Game B1 kit calls the prompts quote (packages/kit/src/worlds/game-b1). Every snippet is
 * a complete, runnable expression over `ctx`, `kit` and `screen` (the shot's `kit.fx.b1Screen`):
 * the stages test `game-b1-snippets.test.ts` runs each one through the real kit (its zod schemas,
 * the font checks, the high-score table's and the manual's layout and timing checks) and repaints
 * the frame, so the prompt text cannot drift from the API. Values are an example of the call's
 * shape, never a design to copy.
 */

export const GAME_B1_SNIPPETS = {
  /** One frame of two worlds per shot: the TV picture, the room, the glass, the HUD. */
  screen:
    'kit.fx.b1Screen({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, anchor: ctx.anchor })',
  /** The picture inside the TV (2600 rules, TV units), a hit with hit-stop, flash and shake. */
  tv: "screen.tv((g, t) => { const hit = 2.4; const tt = t >= hit && t < hit + 0.1 ? hit : t; const sh = g.util.shake(t, hit, 3, 8, 101); g.offset(sh.x * 2, sh.y * 2); g.bands(0, 160, [[0, 'void'], [14, 'tube'], [66, 'dusk'], [80, 'teak']]); g.cart(112, tt < hit ? Math.round(52 + tt * 24) : 111, 'orange', { scale: 2, body: 'grey', flicker: false }); g.offset(0, 0); g.text('NEW MEXICO', 10, 21, { colour: 'tan', type: { at: 0.75, cps: 18 } }); if (t >= hit && t < hit + 0.04) g.remap('flash'); })",
  /** The 1982 living room around the TV: the wall calendar with a day ringed by hand. */
  room: "screen.room({ calendar: { month: 'DEC', mark: 25, markAt: [0.6, 1.4] }, tree: true })",
  /** The camera push from the room into the TV: the picture grows out of the glass. */
  camera: "screen.camera([{ at: 0, on: 'room' }, { at: 1.6, on: 'tv', ease: 'inOut' }])",
  /** The HUD year (the story's date); a second call rolls it, the old one burns in. */
  year: "screen.year('1982', { at: -1 })",
  /** Film progress: one cartridge slot per shot, this shot's share of the film. */
  progress: 'screen.progress({ from: 0.1, to: 0.2, slots: 10 })',
  checkpoint: "screen.checkpoint({ label: 'CHRISTMAS 1982', at: 0.4 })",
  /** A real number of the story counting on the HUD. */
  score: "screen.score({ label: 'WEEKS', keys: [[0.5, 5], [3.1, 4]] })",
  /** Hearts ONLY for the one thing really under threat. */
  lives: "screen.lives({ label: 'WEEKS', max: 5, keys: [[0, 5], [3.15, 4]] })",
  /** The narration box: typed at a voiced cadence, CAPS, \n breaks, <= 3 lines. */
  narrate:
    "screen.narrate('1983. NEW MEXICO.\\nATARI IS BURYING ITS GAMES.', { at: 'atari', until: 4.4 })",
  say: "screen.say('E.T. SELLS POORLY.', { speaker: 'CLERK', at: 'sells', until: 3.6 })",
  /** Dad's sticky note on the glass: the weak point, underlined twice, then struck out. */
  note: "screen.note(['WEAK POINT:', 'MORE TIME'], { at: 'weak point', x: 172, y: 190, under: 1, strike: { line: 1, at: 4.8 } })",
  /** The boss card ONLY for the central problem: BOSS n, the name slams in, a real unit. */
  boss: "screen.boss({ num: 1, name: 'THE DEADLINE', from: 'left', at: 1.2, hp: { n: 5, label: 'WEEKS', keys: [[3.15, 4], [4.1, 3], [4.82, 2]] }, defeat: 5.4 })",
  /** The high-score table (one way of many): the story's facts ranked, one slams in gold. */
  scoreTable:
    "screen.scoreTable({ intent: 'only the boom year has happened: the crash, the revival and the dig are still locked', at: 0, until: 5.8, rows: [{ who: 'E.T', score: 1982 }, { score: 1983 }, { score: 1985 }, { score: 2014 }], hero: 0, print: 0.62, slam: { at: 2.78 }, ring: { at: 3.6, note: 'BOOM!' }, prompt: { text: 'INSERT COIN', at: 4.4 } })",
  /** The manual page (one way of many): the mechanism as HOW TO PLAY, one red correction. */
  manual:
    "screen.manual({ intent: 'a flood of look-alikes teaches buyers to stop buying any game, not just the bad ones', at: 0, until: 5.8, steps: ['A HIT GAME SELLS.', 'EVERYONE COPIES IT,\\nFAST.', 'SHELVES FILL WITH\\nLOOK-ALIKES.', 'SO THEY\\nSTOP BUYING BAD GAMES.'], figure: { caption: 'THE SHELF', shape: 'cartridge', layout: 'shelf', count: 7, hit: 6, callouts: [{ item: 6, step: 1 }] }, ticks: [1.3, 2.1, 2.9], correction: { step: 4, strike: 'BAD', write: 'ANY', at: 3.9 }, enter: 'cut', exit: 'turn' })",
  /** The camera pushes into the room's wall calendar; the next place is redrawn around its page. */
  calendarZoom:
    "screen.calendarZoom({ intent: 'Christmas is the deadline: the calendar on the wall becomes the boss of the office', at: 2.2, push: 0.9, wipe: 0.62 })",
  /** The console close-up of the same room: the cartridge comes out, the TV goes dark. */
  cartridge:
    "screen.cartridge({ intent: 'the Christmas cartridge goes back: the games came back to the stores', action: 'pull', at: 0.6, label: 'XMAS 82', enter: 'pull-back', hold: 1.2 })",
  /** The level-select map when the story changes place or time; a lock is not reached yet. */
  levelSelect:
    "screen.levelSelect({ intent: 'the story goes back a year, from the burial to the Christmas it all started', at: 0, until: 3.6, nodes: [{ label: 'XMAS 82', icon: 'home', x: 24, y: 118 }, { label: 'STORES 83', icon: 'store', x: 62, y: 80, above: true }, { label: 'ALAMOGORDO 83', icon: 'pit', x: 104, y: 124 }, { icon: 'lock', x: 136, y: 70, above: true }], route: { from: 2, to: 0, at: 0.28, dur: 2.2 } })",
  /** The game-over screen as the TV's backdrop, the winning boss card burned in. */
  gameOver:
    "screen.gameOver({ text: 'CONTINUE?', at: 0, until: 3.1, count: [[0.3, 9], [1.2, 8], [2.0, 7]] })",
} as const;

export type GameB1Snippet = keyof typeof GAME_B1_SNIPPETS;

/** A snippet as inline code in a prompt. */
export const gameB1Snippet = (name: GameB1Snippet): string => `\`${GAME_B1_SNIPPETS[name]}\``;

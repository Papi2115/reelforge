/** The documented methods of `kit.fx.b1Screen` (kit catalog, kit-docs). */
export const SCREEN_METHODS = {
  'update(t)': 'Repaints the frame for local time t: call it every frame',
  'tv((g, t) => { ... })':
    "Paints the picture INSIDE the TV with Atari 2600 rules, in TV units (160 x 180, one unit = 4 x 2 px). g: rect(x, y, w, h, colour), dither(x, y, w, h, colour, level), bands(x, w, [[y, colour], ...], y1) colour per line, playfield(y, h, '20 bits', colour, { mirror }) 16-px blocks, sprite(rows, colour | [colour per row], x, y, { stretch, rowH, flip, squash, playfield, flicker }) <= 16 bits, ONE colour per row, cart(x, y, stripe, { scale, body, label, tumble, phase }), text(str, x, y, { colour, size, type: { at, cps } }) Joy caps, score(str, x, y, { colour, cell: [w, h] }) 2600 score digits, remap('dim' | 'flash' | 'drain' | 'ghost' | 'cycle1' | 'cycle2' | 'cycle3', level, [y0, y1] rows), rectPx(x, y, w, h, colour) square px ONLY for a newer console's thing, attract(), garbage(seed), offset(dx, dy) px shake, util { seg, lerp, ease, hash, shake, typed, frameOf }, t, frame. More than 2 sprites on a scanline flicker on alternate frames (flicker: false = the hero; playfield: true = resting objects)",
  "room({ calendar: { month, mark, markAt }, tree, presents, gift: { slot: [a, b], tag: ['E.T.', 'XMAS 82'], tagAt: [a, b], blink }, lamp, carts })":
    "The 1982 living room around the TV (wood panelling, shag carpet, TV with rabbit ears, the console and joystick): wall calendar with a hand-ringed day, Christmas tree, presents, the missing gift's dashed slot with Dad's swinging tag, a lamp, loose cartridges",
  "camera([{ at, on: 'room' | 'tv' | 'calendar' | 'console' | x, y, zoom, ease }])":
    "Room camera keys; 'tv' = inside the TV (its picture fills the frame): a push from 'room' to 'tv' grows the picture out of the glass, 'tv' -> 'room' pulls back. Without room() the frame is the TV picture",
  "year('1983', { at })":
    'The HUD year: call again to roll to a new year (odometer, the old one burns in)',
  'score({ label, keys: [[t, value]], at, until })':
    'A number from the story counting on the HUD (pops and flashes gold on change)',
  'progress({ from, to, slots })':
    'Film progress as cartridge slots (slots = shots, from / to = this shot`s share of the film)',
  'checkpoint({ label, at, until })': 'Chapter: a flag pops over the current slot, its name types',
  'lives({ label, max, keys: [[t, n]], at, until })':
    'Hearts: ONLY for the one thing really under threat; a lost one blinks then goes hollow',
  "boss({ num, name, from: 'left' | 'right' | 'top', x, y, at, hp: { n, label, keys: [[t, value]] }, defeat })":
    'Boss card for the central problem (in-game, gets the CRT): BOSS n types, the name slams in with overshoot and shake, HP segments arrive unevenly; each lost segment flashes and shakes; defeat = flicker death',
  "say(text, { speaker, at, until, place: 'bottom' | 'top' }) / narrate(text, { at, until })":
    'Dialogue box (CAPS, \\n, <= 3 lines) typed at an irregular voiced cadence, a blinking cursor; returns { at, end }',
  "note(['WEAK POINT:', 'MORE TIME'], { at, x, y, w, h, angle, under, strike: { line, at }, tick })":
    "A sticky note slapped on the TV glass in Dad's hand (picture px): underlined twice, struck out in crimson or ticked",
  "scoreTable({ intent, at, until, title, rows: [{ who, score, locked }], hero, print, slam: { at, shake }, initials: 'arcade' | 'typed' | 'none', ring: { at, note }, prompt: { text, at }, enter: 'draw-in' | 'cut' })":
    'Breakthrough (toolkit, intent required): the attract-mode high-score table. Rows = the story`s facts in order of events, score = a real number / year, later events locked ???; the hero row slams in gold after a beat of silence (>= 0.4 s), initials scroll in, Dad`s grease pencil rings it on the glass, the prompt blinks (burned in); holds <= 4 s after its last beat. Returns { at, end, intent, cues }',
  "manual({ intent, at, until, title, steps: ['A HIT SELLS.', ...], figure: { caption, shape: 'cartridge' | 'box' | 'person' | 'house', layout: 'shelf' | 'pile' | 'queue', count, hit, callouts: [{ item, step }] }, ticks: [t], correction: { step, strike, write, at }, note: { text, at }, enter: 'slide' | 'cut', exit: 'turn' | 'cut' })":
    'Breakthrough (toolkit, intent required): the instruction-manual page over the frame (two-colour print, off-register plate, crease, coffee rings): <= 5 numbered rules, FIG. 1 from the world`s shapes, pencil ticks that follow the narrator, ONE red correction (struck word, Dad`s word circled), a margin note; slides in (overshoot, cast shadow) and / or turns away from its corner; the HUD prints in paper ink on it',
  'calendarZoom({ intent, at, push, wipe })':
    'Continuity: the camera pushes into the room`s wall calendar, then the frame is redrawn line by line (interlaced) as the TV picture of the next place; returns landing = where the page stands in TV units ({ x: 96, y: 22, w: 46, h: 130 }): paint the next place`s page there. wipe: false = end on the page (world transition game-b1-scanline-wipe into the next shot)',
  "cartridge({ intent, action: 'insert' | 'pull', at, label, stripe, enter: 'pull-back' | 'cut', exit: 'push' | 'cut', hold })":
    'Continuity: the console close-up of the same room; the picture shrinks into the TV (pull-back), Dad`s hand brings a cartridge in (resists, clicks, garbage) or pulls it out (squeeze, garbage, the TV goes dark); push = back into the TV. Returns { at, end, intent, cues }',
  "levelSelect({ intent, at, until, nodes: [{ label, icon: 'home' | 'store' | 'pit' | 'office' | 'factory' | 'lock', x, y, above }], route: { from, to, at, dur } })":
    'The level-select map in the TV: the story`s places joined by dotted paths, the cartridge cursor hopping unevenly from node to node; lock = a place not reached yet (?)',
  "gameOver({ text: 'CONTINUE?' | 'GAME OVER', at, until, count: [[t, digit]], ghost })":
    'The game-over screen as the TV`s backdrop: black, the boss card burned in, CONTINUE? typed with a countdown (unequal holds) or GAME OVER slammed; tv() painters draw over it',
} as const;

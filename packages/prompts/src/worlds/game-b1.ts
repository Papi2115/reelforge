/**
 * Game B1 in the stage prompts (PLAN.md#13.5 part c, #13.15 phase 2; docs/worlds/DECISIONS.md
 * "PRINCIPLE: a world is a style GRAMMAR"): the film's own subject played as an Atari 2600 game on
 * a TV in a room that fits the film. The prompts teach the GRAMMAR (two worlds in one frame: 2600
 * rules inside the TV, square pixels in the room; the HUD, boss and note grammar; the continuity
 * moves) and a design process per shot (the narration's nouns → a sprite, a playfield or the room
 * → defined, generated or taken from the project's asset files), never the showcase's content: the
 * showcase's nouns appear only in one "pitfalls seen in real films" sentence (`B1_PITFALLS`; the
 * prompts test scans every rendered prompt for them). Looks: A `atari-story`, B `atari-menu`, C
 * `atari-boss` (packages/kit/src/worlds/game-b1). The craft brief is the world's ≤ 1.5 KB brief of
 * QUALITY.md §9. The B1 rework (docs/beta-feedback.md, film 2 "a tragedy": no game left, constant
 * zooms onto the TV): the film is mostly GAME (levels the hero plays, menus, the boss), the room
 * only frames it; the film grammar (`B1_GRAMMAR`, validators/world-grammar.ts) counts it.
 */
import { GAME_B1_MOMENTS } from './game-b1-moments.js';
import { gameB1Snippet as snippet } from './game-b1-snippets.js';
import type { WorldFilmGrammar, WorldPromptText } from './types.js';

/** The one sentence that may name the showcase's things (real run Game B1 1: they leaked). */
export const B1_PITFALLS =
  'Pitfalls seen in real films: no cartridge, E.T., Christmas tree or 1982 living room unless the narration is about one.';

/** The film grammar of B1 (numbers tuned on films 1-2: 5 TV-only shots, 6 camera trips, 9 of 10 plain cuts). */
export const B1_GRAMMAR: WorldFilmGrammar = {
  views: [
    { id: 'screen', start: 'screen', end: 'screen', moves: 0, description: 'the game picture fills the frame for the whole shot (most shots)' },
    { id: 'room', start: 'room', end: 'room', moves: 0, description: 'the room around the TV, the game playing on it (the opening or the ending)' },
    { id: 'push-in', start: 'room', end: 'screen', moves: 1, description: 'starts in the room, the camera pushes into the picture (out of the opening room into the game)' },
    { id: 'pull-out', start: 'screen', end: 'room', moves: 1, description: 'starts in the picture, the camera pulls back into the room (the ending)' },
    { id: 'room-visit', start: 'screen', end: 'screen', moves: 2, description: 'out to the console and back into the picture in one shot (a game swap)' },
  ],
  minGameShare: 0.6,
  gameplayMoment: 'level',
  minGameplay: 2,
  gameplayEveryShots: 4,
  maxSwitchesMin: 2,
  switchesPerMinute: 2.5,
  maxKindRun: 2,
  minNativeTransitions: 3,
  nativeTransitionEveryS: 12,
  transitionEveryS: 8,
  exclusiveBreakthroughs: ['score-table', 'manual'],
}; // prettier-ignore

/** The views as the storyboard reads them: `screen` (…), `room` (…), … */
const VIEW_LIST = B1_GRAMMAR.views.map((view) => `\`${view.id}\` (${view.description})`).join(', ');

const CRAFT_BRIEF = `Craft brief (Game B1; binding):
- First, write a comment: \`// focal: <the one thing read first> | traces: <three human traces>\`; build toward it.
- Two worlds: inside the TV 2600 rules (wide pixels, 8-bit sprites with ONE ink per row, > 2 sprites on a line flicker, scenery as playfield blocks); the room in square pixels. The shot's \`worldView\` decides the frame: \`screen\` = only the game, never the room.
- Do: ONE hero (a sprite or the room), big enough to read at 64 px wide, off-centre, on a place (playfield, bands or the room); crimson only for the threat; every HUD element MEANS something: year = the story's date, a score or counter = a real number, lives only for a real threat, ONE boss in the film, for the central problem; hit-stop, squash, decaying shake, then HOLD >= 0.4 s; >= 3 traces: a sticky note with real words (underlined, struck or ticked), an unclosed pen ring, held-step motion, uneven releases, a wobble before a fall, irregular typing.
- Don't: a big number alone on black, black as a background, centred symmetric HUD spam, icon rows, > 6 competing elements, constant motion, slick polished art: keep the sprites simple, slightly crude.
- Text: only words of the narration or research notes (real numbers, names, dates; game words: HIGH SCORES, HOW TO PLAY, INSERT COIN, BOSS); no \`$\` or \`=\` (write DOLLARS, IS); no \`ctx.text\` or \`ctx.annotate\`.
- No slur-like words (chink): sound words CLINK, CLANG, TINK.`;

const DESIGN = `Design first, in a comment under the focal line (\`// nouns: …\`): (i) list the nouns, places and actions of THIS shot's narration; (ii) decide what each becomes: a sprite in the TV (a person, animal, vehicle, building, item), the place as a playfield or colour bands, a boss (only the film's central problem), a counter (a real number), or the room around the TV (which shell, era, light, window view and props fit the film); (iii) ONE hero per shot, big enough to read when the frame is 64 px wide (\`size\` 2-4 or \`rowH\` 3), the place carried by a playfield, bands or the room: never small sprites alone, never a big number alone on black; (iv) differ from the neighbouring shots: another room or TV place, another palette band, another kind of hero; near-black frames under about 15 % of the shot (black is a beat, not a background); (v) every number and word on screen comes from the narration; the fonts have no \`$\` or \`=\`: write DOLLARS, MILLION, IS.`;

const VOCABULARY = `The film's own things: the project's asset files (designed for this film) load once in build() with \`if (ctx.worldAssets) screen.assets(ctx.worldAssets)\` and are drawn by id; a one-off thing of this shot is defined inline in build(). The calls below come from one made-up coast film: their ids and values show the shape of a call, never things to reuse. A sprite is a 2600 player: rows of 8 characters, \`'#'\` = a lit bit and \`'.'\` = empty (nothing else draws), ONE ink per row (a list, or row stops \`{ 0: 'tan', 3: 'teal' }\`), \`size\` 1/2/4 stretches OR \`copies\` 2-3 repeats (a flock, a convoy), \`frames\` of one height animate: ${snippet('defineSprite')}, ${snippet('spriteFrames')}. Generators in the same grammar (seeded by the id, two of a kind are never twins): ${snippet('generateAnimal')}, ${snippet('generatePerson')}, ${snippet('generateVehicle')}, ${snippet('generateItem')}, ${snippet('generateBoss')}; kinds tree, bush, cactus, seaweed, rock, bird, fish, insect, reptile, building, item, effect too (\`reelforge kit-docs b1Screen\`). Scenery is playfield (20-bit rows of 4-unit blocks, mirrored or repeated, one ink per row): ${snippet('scenery')}, ${snippet('definePlayfield')}.`;

const GAMEPLAY = `Gameplay is the film's main substance: a \`level\` shot PLAYS the narration as a 2D level in the TV with ${snippet('level')} (call it before \`screen.tv\`, whose painters then draw on top; \`intent\` required): the hero (the one the narration follows, or the viewer) runs on keys timed to the spoken beats and jumps in arcs; obstacles, enemies on patrol, items and ONE goal are the narration's own things (what stands in the way, what helps, the outcome), with a word of the narration typed over the ones that matter; collecting, a hit (hit-stop, flash, blink), a stomp and reaching the goal are DERIVED from the geometry: plan the keys so the hero reaches each thing on its phrase (\`r.events\` lists what happens when; time \`screen.score\` or \`screen.lives\` to them, only for real numbers). \`width\` > 160 scrolls the level in whole blocks; a pit needs a jump; the kit's errors say what to change.`;

const VIEW =
  "The shot's `worldView` (storyboard.json) decides the frame: `screen` = the game picture fills the frame for the whole shot (never call `interior()`, `room()` or `camera()`), `room` = `interior()` with the game playing on its TV, `push-in` / `pull-out` = ONE camera move between them (ending on a hold), `room-visit` = the console swap (`screen.cartridge({ … })`); never zoom to the TV as decoration.";

const MOTION = `${DESIGN}
Build ONE screen per shot: ${snippet('screen')}; \`scene.add(screen)\` in build(), \`screen.update(t)\` in update(t). ${VIEW} ${GAMEPLAY} ${VOCABULARY} Paint the TV in \`screen.tv((g, t) => …)\` (160x180 TV units, 2600 rules: \`g.bands\` an ink per line, \`g.field(id, y)\`, \`g.draw(id, x, y, { frame, face, flicker: false for the hero, playfield: true for resting things })\`, \`g.util.path\` for held-step motion, \`g.text\` caps, \`g.counter\` a real number with what it \`means\`; more than 2 sprites on a line flicker; a hit = hit-stop (freeze t) + \`g.remap('flash')\` + a decaying \`g.util.shake\` through \`g.offset\`), e.g. ${snippet('tv')} and ${snippet('counter')}. The room fits the film (the TV, console and joystick always stay): ${snippet('interior')}, ${snippet('interiorPoster')}, ${snippet('interiorBoard')} (shells living-room, bedroom, arcade, office, classroom, garage, workshop; the calendar's ringed day is 1-28); the camera push is the continuity: ${snippet('camera')} ('room' -> 'tv' grows the picture out of the glass, 'tv' -> 'room' pulls back, 'calendar' lands on the wall calendar). Fast-fast-pause: things land, then the frame HOLDS (a still beat of at least 0.4 s); never constant motion. The HUD: ${snippet('year')} (the story's date), ${snippet('progress')} (one slot per shot: this shot's t0 and t1 as shares of the film in storyboard.json), ${snippet('checkpoint')} when a chapter starts, the narration box ${snippet('narrate')} (the narration's words, CAPS, \\n breaks, <= 3 lines), ${snippet('score')} (a real number), ${snippet('lives')} only for the real threat, a sticky note on the glass ${snippet('note')} (land or strike it while the camera is in the TV: from the room it cannot be read); every HUD element must say something in this shot, leave the rest out. Never cut content words from the narration. ${B1_PITFALLS}`;

export const GAME_B1_PROMPTS: WorldPromptText = {
  film: 'an Atari 2600 game video (the narration PLAYED as a 2D 2600 game: levels the hero runs through, menus, a boss, with wide pixels, flicker, a CRT and a game HUD; a room around the TV in square pixels only opens and closes the film)',
  brief: `the whole film is one Atari 2600 game about THIS film's subject, and it is mostly GAME: the narration becomes levels the hero plays (the topic as a level: the hero is who the narration follows or the viewer, obstacles and enemies are what stands in the way, items what helps or what is gained, the goal the outcome), the console's screens (level select, high scores, inventory, shop, split timer, manual) and ONE boss. The room around the TV is a frame, not the subject: the film opens in it and pushes into the game, and pulls back out at the end; between, it stays in the game and moves the way games move (the next screen of the level, a level select, attract mode, a scanline redraw). Two worlds in one frame: inside the TV the story plays by the console's rules (double-wide pixels, sprites 8 bits wide with one colour per row, flicker when a line is crowded, scenery as playfield blocks and colour bands, a CRT with scanlines); around it a room in clean square pixels (the TV, console and joystick always; the room's shell, era, light, window view and props chosen for the film: a workshop, an office, a bedroom, a classroom, a garage, an arcade or a living room); the camera visits the room only to open and close the film. Design per shot from the narration: list its nouns, places and actions and say in the intent what the game shows (the level the hero plays with its obstacles, items and goal, or the screen, with ONE hero sprite big enough to read) or which room it is; call each recurring thing by the same name in every intent (the film's sprites, playfields and rooms are designed from them). Vary: another place, palette band and hero in every shot; a number is never the whole picture (it sits on a place, never alone on black for shot after shot); black screens are short beats. HUD grammar: the year = the story's date; a score, counter or lives only for a real number or threat; ONE boss card in the film, for the central problem (a second problem or a question is a sticky note or a CONTINUE?, never another boss); a chapter = a checkpoint flag. Nothing else appears: no rendered 3D sets, no photos, no modern UI windows, no character pack or mascot; everything is drawn in the TV or the room, so never list \`missingProps\`. ${B1_PITFALLS}`,
  rolls: `Rolls and looks: give every shot a \`"roll"\` and a \`"look"\`, e.g. \`{ "id": "s04_scores", …, "roll": "B", "look": "atari-menu" }\`.
- \`A\` = the story PLAYED (\`atari-story\`: gameplay, the hero running a level of the narration past its obstacles and items to a goal (\`"worldMoment": "level"\`), a dialogue, the opening and closing room; the narration box, a sticky note on the glass). It is the film's anchor: come back to it every 3–6 s, at least once in every 6 shots.
- \`B\` = the console's screens (\`atari-menu\`: a menu painted in the TV, the level-select map when the story changes place or time, and the breakthrough screens: the inventory, the shop, the split timer, the high-score table, the instruction-manual page): show what the narration explains, with its real numbers and names.
- \`C\` = the boss (\`atari-boss\`: the film's ONE central problem as a generated boss and its card, a hit with hit-stop and a flash, the picture draining line by line, the continue? screen): open acts and land the biggest beats; short and rare. A C shot has one loud thing; an explanation goes to B.
Framing: give every shot a \`"worldView"\`: ${VIEW_LIST}; e.g. \`{ "id": "s03_run", …, "roll": "A", "look": "atari-story", "worldView": "screen", "worldMoment": "level" }\`. Most shots are \`screen\`; the camera crosses between the room and the screen only to open and close the film (a cut from a room shot to a screen shot is a crossing too).`,
  tensionLooks:
    '- Rolls and looks by tension: high tension → C-roll boss shots (the card slams in, the bar drains, the picture drains) and fast A-roll gameplay (the hero against obstacles and enemies); calm → A-roll gameplay that breathes (a long scrolling level, a dialogue); B-roll console screens on plateaus where the narration explains or proves.',
  rhythm:
    'Rhythm: never more than 2 shots in a row in one look or of one moment; change roll, look or place at least every 6–8 s; never the same level or screen twice in a row; stay inside the game (no trips back to the room between game shots); open each act with a C-roll shot; link many shots with game-native transitions (the next screen of the level between two gameplay shots, a scanline redraw, attract mode after a boss) instead of plain cuts.',
  shared:
    'every look plays on the same TV and console (wide 2600 pixels and a CRT inside the TV, square pixels in the room, the same 23 inks, crimson only for the threat)',
  transitionIn:
    'a game-native transition (`"type": "wipe"` with a `style` from the list below and about its duration; `"focus": { "x": 0.6, "y": 0.4 }` = the thing it goes through: the hero at the screen edge, the wall calendar or the console, as a share of the frame); `game-b1-screen-flip` between two gameplay shots of one journey; a transition never repeats what the shot itself plays (no `game-b1-calendar-zoom` into a shot that zooms into its own calendar, no `game-b1-page-slide` into a manual that slides in itself, never a key beat inside the transition)',
  camera:
    'The camera is the room camera and it moves rarely: the opening pushes from the room into the TV (`push-in`), the ending pulls back out (`pull-out`), a swap or a date may visit the console or the wall calendar; every move ends on a hold and is said in the intent; inside the game the picture scrolls with the hero in whole blocks and never moves like a 3D camera (no orbit, spin, fly-over or zoom).',
  interrupts:
    '`"interrupt": { "kind": "look-switch", "note": "the boss dies in a flicker and the console drops into attract mode: the high-score table" }`. Kind in this world: only `look-switch` (the look changes from the previous shot; give the shot a game-native `transitionIn`).',
  marks:
    'In this world every mark is part of the game or the room: a pin is a word typed in the TV or a sign in the picture, a caption is the narration box, a counter is a counter in the TV, the HUD score or a boss bar, a ring is a pen ring on the wall calendar or a grease-pencil ring on the glass, a note is a sticky note on the glass, a stamp is a boss name slammed in; every label comes from the narration.',
  annotate:
    "put each in the game, timed to its spoken phrase (`at: 'the phrase'`, with `anchor: ctx.anchor` on the screen): a word typed in the TV (`g.text` inside `screen.tv`), a number counting in the TV (`g.counter` with what it `means`) or on the HUD (`screen.score`), a line in the narration box (`screen.narrate`), the story's year (`screen.year`), a few words on a sticky note (`screen.note`); never with `ctx.annotate` or `ctx.text`",
  motion: MOTION,
  missing:
    'Draw everything the narration needs in this world: a project asset, or a sprite, playfield or room you define or generate in the scene (never loose rectangles standing in for a figure); this world has no props to build, so never end your reply with a `MISSING:` line.',
  craftBrief: CRAFT_BRIEF,
  criticMedium: 'Atari 2600 game',
  criticStyle:
    'an Atari 2600 game on a TV in a room that fits the film: wide pixels with one colour per sprite row, flicker and a CRT inside the TV, a square-pixel room around it, a blocky HUD, sticky notes on the glass',
  vibe: "Vibe check (every look of the film must feel like one Atari 2600 game on one TV and console): inside the TV double-wide pixels, crude 8-bit sprites with one colour per row, playfield blocks, colour bands per line, scanlines and colour bleed; the room in clean square pixels; blocky caps and score digits; a few inks. Smooth gradients, glossy or rendered 3D, photos, vector icons, a comic or hand-drawn page outside the manual, modern UI windows or a later console's fine pixels everywhere break the world: answer `off-intent` with a note starting `vibe:`.",
  checklist: `one focal thing, off-centre (a hero sprite big enough to recognise, the boss, the gold number on its place, the red correction; the HUD is texture, never the focal point); the place reads (a playfield, colour bands or the room), never a number alone on black; crimson only for the threat; every HUD element means something (year = the story's date, a score or counter = a real number, lives only for a real threat, one boss card in the film, for the central problem); at most 6 competing elements; text whole and readable; the two worlds kept apart (2600 rules inside the TV, square pixels in the room); a hold after a hit; human traces such as a sticky note (underlined, struck out or ticked), an unclosed pen ring, uneven releases, held-step motion, a wobble before a fall, hit-stop + squash + a decaying shake, typing at an irregular cadence, uneven pencil ticks. Only authored marks count as traces: the CRT, the scanlines and the room's wallpaper or floor never do. A gameplay shot shows the hero MOVING through the level past its things (a jump, a hit, a pickup, the goal), never sprites standing on a still picture. Slop tells: a centred symmetric HUD, HUD spam (elements that say nothing), lives or health with no real threat, rows of icons, figures built from plain rectangles, invented labels, numbers or gibberish in the TV, on the HUD or in a note, constant motion, slick polished sprites, a high-score table or manual page that shows nothing the narration says. ${B1_PITFALLS}`,
  continuity:
    'Link the pair where the narration carries one thing into the next shot, with the game\'s own link transitions: `zoom-through` into the wall calendar (`game-b1-calendar-zoom`: the camera pushes into the room\'s calendar and the next place is redrawn around its page; the whole room changes, the page stays: a date that opens a new place), `carry-environment` through the console (`game-b1-cartridge-in` / `game-b1-cartridge-out`: the TV and the room stay, the game in them changes: the story turns to a new subject in the same world), `shared-object` (the same sprite or note holds its place while the picture around it changes). Write the link as `"continuity"` AND name its transition in `transitionIn.style`; name the object in both intents; never link two unrelated places. The linked shot opens where the transition lands (on the calendar page or in the TV picture), never replaying the zoom or the swap.',
  surprise:
    'a sudden game moment (e.g. "the boss dies in a flicker and the console drops into attract mode", "the picture drains line by line and the TV goes dark"); never a camera move (no dolly zoom, orbit, rack focus or screen)',
  moments: GAME_B1_MOMENTS,
  grammar: B1_GRAMMAR,
};

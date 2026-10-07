/**
 * Game B1 in the stage prompts (PLAN.md#13.5 part c, docs/worlds/DECISIONS.md, QUALITY.md §6/§9):
 * the film as an Atari 2600 game played in a 1982 living room, two worlds in one frame (inside the
 * TV by 2600 rules, the room around it in square pixels); look A `atari-story` (the story in the
 * TV or the room), B `atari-menu` (the console's screens, the high-score table and the manual
 * page), C `atari-boss` (boss cards, the crash, continue?) (packages/kit/src/worlds/game-b1). The
 * craft brief is the world's ≤ 1.5 KB brief of QUALITY.md §9: the slop tells as a don't-list, the
 * game-hud signature (§6: HUD elements that mean something) and the world's continuity (the TV
 * push, the cartridge in and out, Dad's notes on the glass) as a do-list, the focal-point-first
 * process, text provenance and reference frames of the approved showcase (game-hud-b1-boss-v2).
 */
import { GAME_B1_MOMENTS } from './game-b1-moments.js';
import { gameB1Snippet as snippet } from './game-b1-snippets.js';
import type { WorldPromptText } from './types.js';

const CRAFT_BRIEF = `Craft brief (Game B1; binding):
- First, write a comment: \`// focal: <the one thing read first> | traces: <three human traces>\`; build toward it.
- Two worlds: inside the TV 2600 rules (wide pixels, ONE colour per sprite row, > 2 sprites on a line flicker); the room in square pixels. The TV push, the cartridge in/out and the calendar zoom carry the story across.
- Do: ONE focal thing, off-centre (the lit cartridge, the boss's digit, the gold score); crimson only for the threat; every HUD element MEANS something: year = the story's date, score = a real number, a cartridge slot per shot, lives only for a real threat, a boss card only for the central problem; hit-stop, squash, decaying shake, then HOLD >= 0.4 s; >= 3 traces: Dad's sticky note with real words (underlined, struck or ticked), an unclosed pen ring, uneven releases, a wobble before a fall, irregular typing.
- Don't: centred symmetric HUD spam, lives or health with no real threat, icon rows, > 6 competing elements, constant motion, slick polished art: keep the sprites simple, slightly crude.
- Text: only words of the narration or research notes (real numbers, names, dates; game words: HIGH SCORES, HOW TO PLAY, INSERT COIN, BOSS); no invented labels or numbers; no \`ctx.text\` or \`ctx.annotate\`.
- No slur-like words (chink): sound words CLINK, CLANG, TINK.
- References (docs/worlds/game-hud-b1-boss-v2/shots/): s1-t3.9.png the lit cart on the dim pile; s3-t6.3.png the boss digit, a struck note; s4-t5.6.png gold 1982, locked rows; s8-t7.4.png red ANY.`;

const MOTION = `Build ONE screen per shot: ${snippet('screen')}; \`scene.add(screen)\` in build(), \`screen.update(t)\` in update(t). Paint the picture inside the TV in \`screen.tv((g, t) => …)\` (160x180 TV units, 2600 rules: \`g.bands\` a colour per line, \`g.playfield\` blocks, \`g.sprite\` rows of <= 16 bits with ONE colour per row, \`g.cart\`, \`g.text\` caps, \`g.score\` digits; a hit = hit-stop (freeze t) + \`g.remap('flash')\` + a decaying \`g.util.shake\` through \`g.offset\`), e.g. ${snippet('tv')}. The room: ${snippet('room')}; the camera push is the continuity: ${snippet('camera')} ('room' -> 'tv' grows the picture out of the glass, 'tv' -> 'room' pulls back, 'calendar' lands on the wall calendar). Fast-fast-pause: things land, then the frame HOLDS (a still beat of at least 0.4 s); never constant motion. The HUD: ${snippet('year')} (the story's date), ${snippet('progress')} (one cartridge slot per shot: this shot's t0 and t1 as shares of the film in storyboard.json), ${snippet('checkpoint')} when a chapter starts, the narration box ${snippet('narrate')} (the narration's words, CAPS, \\n breaks, <= 3 lines), ${snippet('score')} (a real number), ${snippet('lives')} only for the real threat, Dad's note on the glass ${snippet('note')}; every HUD element must say something in this shot, leave the rest out. Never cut content words from the narration.`;

export const GAME_B1_PROMPTS: WorldPromptText = {
  film: 'an Atari-era boss-fight montage video (the film as an Atari 2600 game played in a 1982 living room: the story inside the TV with wide pixels, flicker and a CRT, the room around it, boss cards and sticky notes on the glass)',
  brief:
    "the whole film is one Atari 2600 game played in a 1982 wood-panelled living room. Two worlds in one frame: inside the TV the story plays by the console's rules (double-wide pixels, one colour per sprite row, flicker when a line is crowded, playfield blocks, colour bands, a CRT with scanlines), around it the living room in clean square pixels (panelling, shag carpet, the console and joystick, a wall calendar, a Christmas tree when the story is at Christmas); a camera pushes into the TV and pulls back out. The central problems are boss cards (BOSS n, the name slammed in, a bar in a real unit), their weak points sticky notes in Dad's hand on the glass; the HUD carries the story's year, one cartridge slot per shot and a chapter flag. Nothing else appears: no rendered 3D sets, no photos, no modern UI windows, no character pack or mascot. Everything is painted in the TV or the room, so never list `missingProps`.",
  rolls: `Rolls and looks: give every shot a \`"roll"\` and a \`"look"\`, e.g. \`{ "id": "s04_scores", …, "roll": "B", "look": "atari-menu" }\`.
- \`A\` = the story (\`atari-story\`: the story played inside the TV by 2600 rules, or the living room around it, the camera pushing between them; the narration box, Dad's notes on the glass, the cartridge going in and out). It is the film's anchor: come back to it every 3–6 s, at least once in every 6 shots.
- \`B\` = the console's screens (\`atari-menu\`: a menu painted in the TV, the level-select map when the story changes place or time, the high-score table, the instruction-manual page): show what the narration explains, with its real numbers and names.
- \`C\` = the boss (\`atari-boss\`: the central problem slammed in as a boss card with its bar, a hit with hit-stop and a flash, the crash draining the picture line by line, the continue? screen): open acts and land the biggest beats; short and rare. A C shot has one loud thing; an explanation goes to B.`,
  tensionLooks:
    '- Rolls and looks by tension: high tension → C-roll boss shots (the card slams in, the bar drains, the crash) and tight A-roll shots inside the TV (one sprite against the threat); calm → A-roll room shots with the TV playing and room to look around; B-roll console screens on plateaus where the narration explains or proves.',
  rhythm:
    'Rhythm: never more than 2 shots in a row in one look; change roll, look or place at least every 6–8 s; go back and forth between the TV and the room; open each act with a C-roll shot and a game-native transition.',
  shared:
    'every look plays on the same 1982 TV in the same living room (wide 2600 pixels and a CRT inside the TV, square pixels in the room, the same 23 inks, crimson only for the threat)',
  transitionIn:
    'a game-native transition (`"type": "wipe"` with a `style` from the list below and about its duration; `"focus": { "x": 0.6, "y": 0.4 }` = the calendar, the cartridge or the thing it goes through, as a share of the frame)',
  camera:
    'The camera is the living-room camera: an intent may ask it to push into the TV (the picture grows out of the glass), to pull back out into the room, to land on the wall calendar or on the console, always ending on a hold; the picture inside the TV never moves like a 3D camera (no orbit, spin or fly-over).',
  interrupts:
    '`"interrupt": { "kind": "look-switch", "note": "the boss dies in a flicker and the console drops into attract mode: the high-score table" }`. Kind in this world: only `look-switch` (the look changes from the previous shot; give the shot a game-native `transitionIn`).',
  marks:
    "In this world every mark is part of the game or the room: a pin is a word typed in the TV or a sign in the picture, a caption is the narration box, a counter is the HUD score or a boss bar, a ring is Dad's pen on the calendar or his grease pencil on the glass, a note is his sticky note on the glass, a stamp is a boss name slammed in; every label comes from the narration.",
  annotate:
    "put each in the game, timed to its spoken phrase (`at: 'the phrase'`, with `anchor: ctx.anchor` on the screen): a word typed in the TV (`g.text` inside `screen.tv`), a line in the narration box (`screen.narrate`), a number on the HUD (`screen.score`), the story's year (`screen.year`), the weak point on Dad's note (`screen.note`); never with `ctx.annotate` or `ctx.text`",
  motion: MOTION,
  missing:
    'Paint everything the narration needs inside the TV or in the room (sprites, cartridges, places, menus, signs): this world has no props to build, so never end your reply with a `MISSING:` line.',
  craftBrief: CRAFT_BRIEF,
  criticMedium: 'Atari 2600 game',
  criticStyle:
    'an Atari 2600 game in a 1982 living room: wide pixels with one colour per sprite row, flicker and a CRT inside the TV, a wood-panelled room in square pixels around it, boss cards, sticky notes on the glass, a blocky HUD',
  vibe: "Vibe check (every look of the film must feel like one Atari 2600 game in one 1982 living room): inside the TV double-wide pixels, one colour per sprite row, colour bands per line, scanlines and colour bleed; the room in square pixels, wood panelling, shag carpet; blocky caps and score digits; a few inks. Smooth gradients, glossy or rendered 3D, photos, vector icons, a comic or hand-drawn page outside the manual, modern UI windows or a later console's fine pixels everywhere break the world: answer `off-intent` with a note starting `vibe:`.",
  checklist:
    "one focal thing, off-centre (the lit cartridge, the boss's digit, the gold score, the red correction; the HUD is texture, never the focal point); crimson only for the threat; every HUD element means something (year = the story's date, one cartridge slot per shot, a score = a real number, lives only for a real threat, a boss card only for the central problem); at most 6 competing elements; text whole and readable; the two worlds kept apart (2600 rules inside the TV, square pixels in the room); a hold after a hit; human traces such as Dad's sticky note (underlined, struck out or ticked), an unclosed pen ring, uneven releases, a wobble before a fall, hit-stop + squash + a decaying shake, typing at an irregular cadence, a cartridge that resists the slot, uneven pencil ticks. Only authored marks count as traces: the CRT, the scanlines, the panelling and the shag never do. Slop tells: a centred symmetric HUD, HUD spam (elements that say nothing), lives or health with no real threat, rows of icons, invented labels, numbers or gibberish in the TV, on the HUD or in a note, constant motion, slick polished sprites, a high-score table or manual page that shows nothing the narration says.",
  continuity:
    'Link the pair where the narration carries one thing into the next shot, with the game\'s own link transitions: `zoom-through` into the wall calendar (`game-b1-calendar-zoom`: the camera pushes into the calendar and the next place is redrawn around its page; the whole room changes, the page stays), `carry-environment` with the cartridge (`game-b1-cartridge-in` / `game-b1-cartridge-out`: the TV and the room stay, the game in it changes), `shared-object` (the same cartridge or note holds its place while the picture around it changes). Write the link as `"continuity"` AND name its transition in `transitionIn.style`; name the object in both intents; never link two unrelated places.',
  surprise:
    'a sudden game moment (e.g. "the boss dies in a flicker and the console drops into attract mode", "the cartridge is pulled out and the TV goes dark"); never a camera move (no dolly zoom, orbit, rack focus or screen)',
  moments: GAME_B1_MOMENTS,
};

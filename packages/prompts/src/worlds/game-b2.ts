/**
 * Game B2 in the stage prompts (PLAN.md#13.4 part c, docs/worlds/DECISIONS.md, QUALITY.md §6/§9):
 * the film as one first-person RPG level with a Doom vibe; look A `rpg-explore` (the walk), B
 * `rpg-menu` (the game's screens, the automap and the tally), C `rpg-boss` (the pressure)
 * (packages/kit/src/worlds/game-b2). The craft brief is the world's ≤ 1.5 KB brief of QUALITY.md
 * §9: the slop tells as a don't-list, the game-hud signature (§6: HUD elements that mean
 * something) as a do-list, the focal-point-first process, text provenance and reference frames of
 * the approved showcase (game-hud-b2-rpg-v2). The level format with a worked level is the scene
 * turn's step 4 (this world has no props: the level is the set).
 */
import { GAME_B2_MOMENTS } from './game-b2-moments.js';
import { GAME_B2_SNIPPETS, gameB2Snippet as snippet } from './game-b2-snippets.js';
import type { WorldPromptText } from './types.js';

const CRAFT_BRIEF = `Craft brief (Game B2; binding):
- First, write a comment: \`// focal: <the one thing read first> | traces: <three human traces>\`; build toward it.
- Do: ONE focal thing, off-centre (the item in the hand, the clerk, the sign, the stamp); pink (the accent) only on THE item of the story; every HUD element MEANS something: progress = film progress, a checkpoint flag = a chapter, a meter only for a real threat, the boss bar only for the central problem; walk, then HOLD a look >= 0.4 s; >= 3 traces: a bulb that stutters, a faulty tube, chalk on a wall, a hand-lettered sign, a struck option, a reach that overshoots, a shake with decay, a dev note.
- One level per scene, written from the narration's places and objects: its nouns are the signs, stencils and sprites.
- Don't: centred symmetric HUD spam, decorative HP or ammo with no real threat, icon rows, > 6 competing elements, the same corridor twice in a film, constant walking, slick polished art: keep the sprites simple, slightly crude.
- Text: only words of the narration or research notes (real numbers, names, dates; game words: QUEST LOG, NEW QUEST, + ITEM, EST.), all in the HUD and the level; no invented labels or numbers; no \`ctx.text\` or \`ctx.annotate\`.
- References (docs/worlds/game-hud-b2-rpg-v2/shots/): s1-t3.5.png one bulb, sand, a chalk tally; s3-t20.png the reach for the shelf; s4-t30.4.png done rooms solid, the next dashed, a NEXT note; s8-t62.6.png the tally, the UNSOLD stamp.`;

const MOTION = `Build ONE view and ONE HUD per shot: \`const LEVEL = { … }\` (this shot's level, step 4), ${snippet('view')}, ${snippet('hud')}; \`scene.add(view); scene.add(hud)\` in build(), \`view.update(t); hud.update(t)\` in update(t). Walk, then HOLD: path keys \`{ at, x, y, yaw, pitch, eye, ease }\` in cells (walk in with 'in', stop with 'out', turn or look down with 'inOut'), uneven strides, a still look of at least 0.4 s; never constant walking. The HUD: ${snippet('compass')}, ${snippet('minimap')}, the narration box ${snippet('narrate')} (the narration's words, CAPS, \\n breaks, <= 3 lines), ${snippet('progress')} (this shot's t0 and t1 as shares of the film in storyboard.json) and ${snippet('checkpoint')} when a chapter starts, ${snippet('toast')}, ${snippet('inventory')}; a meter only for the real threat, a boss bar only for the central problem; every HUD element must say something in this shot, leave the rest out. In the level: ${snippet('switchOn')}, ${snippet('open')}, ${snippet('take')}, ${snippet('hold')}, ${snippet('act')} (a \`clerk\` sprite with that id), ${snippet('fog')}. Never cut content words from the narration.`;

const LEVEL_FORMAT = `The level is the set: this world has no props to build, so never end your reply with a \`MISSING:\` line. Write the level from the narration's places and objects: ONE level per scene, the place this shot is in (a corridor, an office, a warehouse, a store aisle, a returns desk), the things the narration names as sprites with its real words as labels and stencils, nothing decorative. Format (the \`level\` of \`kit.fx.b2View\`; or a built-in \`'office' | 'warehouse'\` with \`stencil: 'WORD'\`): \`{ name (kebab case), mood: 'dark' | 'tungsten' | 'fluorescent' | 'shop' | 'backroom', floor, ceiling, grid, legend, lights, sprites }\`. \`grid\` = rows of equal length, one character per 1x1 cell, at most 32x32, the border all walls. \`legend\` maps every other character to a wall \`{ wall: 'concrete' | 'wood-panel' | 'cubicle' | 'shelf' | 'shelf-end' | 'corrugated' | 'cinderblock' | 'counter' | 'store-shelf', label (shelf stencil, <= 4 letters), chalk: 'tally' | 'arrow' | 'cross', count, pinned: 'calendar' | 'poster', crossed, height, cap }\`, a door \`{ door: true }\` (walls on two opposite sides) or an open cell \`{ floor, ceiling, flicker, mood }\` ('.' is open); floors 'concrete' | 'concrete-sand' | 'carpet' | 'warehouse' | 'warehouse-line' | 'tile' | 'tile-big' | 'sand', ceilings 'dark' | 'office' | 'office-light' | 'warehouse' | 'warehouse-tube' | 'grey' | 'grey-tube'. At most 12 \`lights\` \`{ id, pos: [x, y], z, power, radius, flicker: 'none' | 'tube' | 'bulb', bulb }\` and 40 \`sprites\` \`{ id, sprite: 'clerk' | 'desk' | 'sign' | 'exit' | 'carton' | 'boxes' | 'pallet' | 'item' | 'card' | 'bin' | 'sand-pile', pos: [x, y], label, band, person, tilt }\`; positions in cells (x right, y down, 0.5 = the middle of cell 0), never inside a wall. A worked level (the built-in office: a dark corridor with one bulb and a chalk tally, a door, the tungsten office behind it):
\`\`\`js
const LEVEL = ${GAME_B2_SNIPPETS.level};
\`\`\`
Check it before the frames: \`reelforge validate level <the scene file>\` (each error names the grid row or the field), fix it and run it again.`;

export const GAME_B2_PROMPTS: WorldPromptText = {
  film: 'a first-person RPG video with a Doom vibe (every shot a moment of one game level: a raycast walk through rooms, the hand taking the named thing, people who talk, a woodgrain HUD that carries the story)',
  brief:
    "the whole film is one first-person game level. Every shot is a place of the story seen through the player's eyes: a software-raycast room (concrete, wood panel, shelves, a counter; tungsten or fluorescent light and fog) that the scene writes as a small level from the narration's places and objects, a walk with head-bob and held looks, the first-person hand that takes, holds, presents and throws the specific thing the narrator names, simple crude sprites (a clerk who talks, a desk, cartons, signs) and a woodgrain HUD whose every element means something: the year compass, the minimap of the rooms walked, the narration box typed at an irregular cadence, the inventory of facts picked up, a film-progress strip with chapter flags, a meter only for a real threat, a boss bar only for the central problem. Nothing else appears: no rendered 3D sets, no charts or UI windows, no photos, no character pack or mascot. Everything is built in the level and the HUD, so never list `missingProps`.",
  rolls: `Rolls and looks: give every shot a \`"roll"\` and a \`"look"\`, e.g. \`{ "id": "s04_stock", …, "roll": "B", "look": "rpg-menu" }\`.
- \`A\` = the walk (\`rpg-explore\`: first person in a level of the place the narrator names, the hand takes or holds the thing, a clerk talks, the narration box, the minimap and the compass). It is the film's anchor: come back to it every 3–6 s, at least once in every 6 shots.
- \`B\` = the game's screens (\`rpg-menu\`: a paused quest log or stat sheet with the inventory, the automap of the route, the end-of-chapter tally): take stock of what the narration explains, with its real numbers and names.
- \`C\` = the pressure (\`rpg-boss\`: the central problem as a boss bar, numbers popping off what is in danger, one stinger phrase, a shake, the thrown item): open acts and land the biggest beats; short and rare. A C shot has one loud thing; an explanation goes to B.`,
  tensionLooks:
    '- Rolls and looks by tension: high tension → C-roll pressure shots (boss bar, stinger, shake) and tight A-roll walks (a narrowing aisle, a held look at the threat); calm → A-roll walks with room to look around; B-roll game screens on plateaus where the narration explains or proves.',
  rhythm:
    'Rhythm: never more than 2 shots in a row in one look; change roll, look or place at least every 6–8 s; never walk the same corridor twice; open each act with a C-roll shot and a game-native transition.',
  shared:
    'every look plays in the same game (a raycast level in the 32-colour palette, the woodgrain HUD with its own pixel face, pink only for THE item of the story)',
  transitionIn:
    'a game-native transition (`"type": "wipe"` with a `style` from the list below and about its duration; `"focus": { "x": 0.6, "y": 0.4 }` = the door or thing it goes through, as a share of the frame)',
  camera:
    "The camera is the player's eyes: an intent may ask for a walk in (uneven strides), a stop, a turn to the thing or a look down, always ending on a held look; never an orbit, a spin, a fly-over or a camera outside the player.",
  interrupts:
    '`"interrupt": { "kind": "look-switch", "note": "the walk freezes and the screen melts into the end-of-chapter tally" }`. Kind in this world: only `look-switch` (the look changes from the previous shot; give the shot a game-native `transitionIn`).',
  marks:
    "In this world every mark is part of the game: a pin is a sign or a stencilled label in the level, a caption is the narration box, a name or place types on the compass, a counter is a tally row or a meter, a badge is an inventory item, a stamp is the tally's rubber stamp, an arrow is the compass's objective marker or the automap's note; every label comes from the narration.",
  annotate:
    "put each in the game, timed to its spoken phrase (`at: 'the phrase'`, with `anchor: ctx.anchor` on the view and the HUD): a name or place on the compass (`hud.compass({ place })`) or a sign in the level, a fact into the inventory (`hud.inventory`) or a toast (`hud.toast`), a number on a meter or a tally row, a line in the narration box (`hud.narrate`); never with `ctx.annotate` or `ctx.text`",
  motion: MOTION,
  missing: LEVEL_FORMAT,
  craftBrief: CRAFT_BRIEF,
  criticMedium: 'first-person RPG game',
  criticStyle:
    'a first-person game level with a Doom vibe: raycast rooms in a 32-colour palette with dithered light and fog, crude sprites, the first-person hand, a woodgrain HUD with its own pixel face',
  vibe: 'Vibe check (every look of the film must feel like one first-person game): chunky raycast walls and floors at a low resolution doubled up, dithered tungsten or fluorescent light and fog, simple crude sprites, the first-person hand, a woodgrain HUD with a blocky pixel face. Smooth gradients, glossy or rendered 3D, photos, vector icons, a comic or hand-drawn paper look or modern UI windows break the world: answer `off-intent` with a note starting `vibe:`.',
  checklist:
    'one focal thing, off-centre (the item in the hand, the clerk, the sign, the stamp; the HUD is texture, never the focal point); pink (the accent) only on THE item of the story; every HUD element means something (progress = film progress, a meter only for a real threat, a boss bar only for the central problem); at most 6 competing elements; HUD words whole and readable; a held look after a walk; human traces such as a bulb that stutters, a faulty tube, chalk on a wall, a hand-lettered sign, a struck option, a reach that overshoots, a shake with decay, a counter that stalls, a misregistered stamp, a dev note. Only authored marks count as traces: the HUD plates, the woodgrain, the dither and the head-bob never do. Slop tells: a centred symmetric HUD, HUD spam (elements that say nothing), decorative HP or ammo with no real threat, rows of icons, invented labels, numbers or gibberish in the HUD or on signs, the same corridor as the shot before, constant walking, slick polished sprites, an automap, tally or throw that shows nothing the narration says.',
  continuity:
    "Link the pair where the narration carries one thing into the next shot: `shared-object` (the held item stays in the hand while the place changes: the cartridge from the warehouse to the store), `carry-environment` (the same level goes on and one thing in it changes: the shelf empties, the returns pile up), `zoom-through` (through a door or into the calendar on the wall, and the next place opens). The game's own links are the map and the throw: an automap shot grows out of the walk's minimap (`game-b2-map-unfold`) and folds back into the next walk (`game-b2-map-fold`). Name the object in both intents; never link two unrelated places.",
  surprise:
    'a sudden game moment (e.g. "the walk freezes and the screen melts into the end-of-chapter tally", "the cartridge is thrown and tumbles into the pit"); never a camera move (no dolly zoom, orbit, rack focus or screen)',
  moments: GAME_B2_MOMENTS,
};

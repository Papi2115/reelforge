/**
 * Game B2 in the stage prompts (PLAN.md#13.4 part c, #13.15 phase 2, docs/worlds/DECISIONS.md "a
 * world is a style GRAMMAR", QUALITY.md §6/§9): the film as one first-person game with a Doom vibe;
 * look A `rpg-explore` (the walk), B `rpg-menu` (the game's screens, the automap and the tally), C
 * `rpg-boss` (the pressure) (packages/kit/src/worlds/game-b2). The prompts teach the STYLE (the
 * raycaster's ramps, fog and dither, light by mood, crude sprites, a HUD whose every element means
 * something) and a design process per shot (the narration's places, people, animals and things →
 * a level, sprites and icons of THIS film), never the showcase's content: the film's own assets
 * (`ctx.worldAssets`, designed before the scenes) and one-offs defined in the scene are its
 * vocabulary. The craft brief is the world's ≤ 1.5 KB brief of QUALITY.md §9; the asset and level
 * format with worked examples is the scene turn's step 4 (this world has no props: the level is
 * the set).
 */
import { GAME_B2_MOMENTS } from './game-b2-moments.js';
import { GAME_B2_SNIPPETS, gameB2Snippet as snippet } from './game-b2-snippets.js';
import type { WorldPromptText } from './types.js';

const CRAFT_BRIEF = `Craft brief (Game B2; binding):
- First, write a comment: \`// focal: <the one thing read first> | traces: <three human traces>\`; build toward it.
- A style, not a catalogue: the places, people, animals and things are THIS film's (its assets or yours) in the style: 32-colour ramps, crude sprites with a 1 px outline lit from the upper left, dithered light and fog.
- Do: ONE focal thing, off-centre, readable at 64 px (one big sprite or one strong wall feature); pink (the accent) only on THE item of the story; every HUD element MEANS something: progress = film progress, a checkpoint flag = a chapter, a meter only for a real threat, the boss bar only for the central problem; walk, then HOLD >= 0.4 s; every shot has a lit light or a sky; >= 3 traces: a stuttering light, a reach that overshoots, a struck option, a decaying shake, a dev note.
- Don't: centred symmetric HUD spam, decorative HP or ammo with no real threat, icon rows, > 6 competing elements, the same room, palette and mood as the walk before, long dark stretches, constant walking, slick polished art: keep the sprites simple, slightly crude.
- Text: only words of the narration or research notes (real numbers, names, dates; game words: QUEST LOG, NEW QUEST, + ITEM, EST.), all in the HUD; no invented labels or numbers; no \`ctx.text\` or \`ctx.annotate\`.
- No slur-like words (chink): sound words CLINK, CLANG, TINK.
- References for the light and the HUD only, never their things: docs/worlds/game-hud-b2-rpg-v2/shots/ s1-t3.5.png, s4-t30.4.png, s8-t62.6.png.`;

const DESIGN = `Design the shot before you write it, in this order: (i) list the narration's places, people, animals, objects and actions in this shot; (ii) each place: indoors (rooms with a mood, doors between them) or outdoors (a sky preset, a skyline, the ground), its textures, and its light by the moment's mood (tungsten = warm, home, safety; fluorescent = cold, work, threat; shop = bright and busy; backroom = dim and forgotten; dark = one lamp in the dark; dawn, dusk or night skies for beginnings and endings); (iii) each noun → a sprite or an icon: the film's asset by id (read \`assets/game-b2/\` for what exists) or a one-off of this shot (step 4); people differ by build, clothes, hat and tool, animals by kind and coat, plants by kind; the thing the narrator names is drawn as that thing (a book is a book), never a stand-in; (iv) write the level from those places (step 4), sized for the walk: a 3–6 s walk crosses 3–6 cells, the focal sprite stands 2–4 cells ahead at the held look; (v) vary: never the same room, palette and mood as the walk before; no long dark stretches: every shot has a lit light or a sky (a dark room only with a lit lamp or doorway), a menu, map or tally sits over the live or frozen level, never on black; (vi) thumbnail test: at 64 px wide the frame reads as one thing (one big lit sprite or one strong wall feature, off-centre).`;

/**
 * The one sentence of the B2 prompts that may name the reference film's things (the topic-bias
 * test allows it): what real films got wrong by replaying the showcase.
 */
export const GAME_B2_PITFALLS =
  'Pitfalls seen in real films: a ledger drawn as a game cartridge (an item without an `icon` is drawn as one: give every taken, held or thrown thing its icon), every person the same shop clerk, a river walked as a brown corridor; never draw a cartridge or a clerk unless the narration is about one.';

const MOTION = `${DESIGN}
Then build ONE view and ONE HUD per shot: \`const LEVEL = { … }\` (this shot's level, step 4), ${snippet('view')}, ${snippet('hud')}; \`scene.add(view); scene.add(hud)\` in build(), \`view.update(t); hud.update(t)\` in update(t). Walk, then HOLD: path keys \`{ at, x, y, yaw, pitch, eye, ease }\` in cells (walk in with 'in', stop with 'out', turn or look down with 'inOut'), uneven strides, a still look of at least 0.4 s; never constant walking. The HUD: ${snippet('compass')}, ${snippet('minimap')}, the narration box ${snippet('narrate')} (the shot's key line in the narration's words, CAPS, \\n breaks, <= 3 lines; the level carries the shot, not the box), ${snippet('progress')} (this shot's t0 and t1 as shares of the film in storyboard.json) and ${snippet('checkpoint')} when a chapter starts, ${snippet('toast')}, ${snippet('inventory')} (the film's icons); a meter only for the real threat, a boss bar only for the central problem; every HUD element must say something in this shot, leave the rest out. In the level: ${snippet('switchOn')}, ${snippet('open')}, ${snippet('take')} (take it from a pile of several or from a place with no sprite of it: the taken thing must not stay behind), ${snippet('hold')}, ${snippet('act')} (a person sprite of the level with that \`id\`), ${snippet('defineSprite')} then ${snippet('place')}, ${snippet('fog')}. A \`shared-object\` link: the first shot ends with the item held (\`hold\`, not \`present\`), the next starts holding it (\`at: -1\`). The automap, the tally and the throw only in the shot the storyboard planned them for. Never cut content words from a line you show. ${GAME_B2_PITFALLS}`;

const ASSET_FORMAT = `The level is the set and the film's assets are its things: never end your reply with a \`MISSING:\` line, define what the narration needs. The film's pack is \`ctx.worldAssets\` (its recurring people, animals, plants, buildings, things, textures and item icons, designed for this film before the scenes in \`assets/game-b2/*.json\`; undefined when the film has none): use its ids. One-offs of this shot: a \`SHOT_ASSETS\` pack in the scene next to the film's (${snippet('viewOutdoor')}), or after build ${snippet('defineArt')} / ${snippet('defineIcon')} (for \`place\`, the hand and the HUD; textures only through \`assets\`). Ids are kebab case, unique, never a built-in name; at most 4 packs, 48 sprites, 24 textures and 24 icons per view.
Every entry is a generator call (seeded, crude on purpose, shaded from the upper left; every call takes \`seed\` (two trees of one kind: two seeds or a \`flip\`), \`fps\` (0 = still) and \`z\`):
- \`{ gen: 'person', build: 'slim' | 'average' | 'stout' | 'child', skin: 0-3, hair: 'none' | 'short' | 'long' | 'bun', hairColour, beard, glasses, hat, outfit, clothes: <ramp>, trim, tool, height }\`; hats none, top, cap, bowler, hood, helmet, crown, bonnet, straw, hardhat, wizard, turban, space; outfits suit, coat, robe, dress, tunic, overalls, uniform, spacesuit, apron, rags; tools none, staff, sword, spade, book, lantern, basket, cane, umbrella, clipboard, torch, pickaxe, bucket. Four frames: \`view.act\` drives it. Every person of a film looks different.
- \`{ gen: 'creature', kind, form, coat: <ramp>, belly, pattern: 'plain' | 'spots' | 'stripes', neck, legs, horns: 'none' | 'antlers' | 'horns' | 'tusks', hump, ears: 'none' | 'pointy' | 'long' | 'round', size, facing }\`: bird (perch, fly), quadruped (grazer, dog, cat, bear, horse), fish (slim, round, eel), insect (bee, butterfly, beetle, ant), reptile (lizard, snake, croc, turtle).
- \`{ gen: 'plant', kind, height, width, leaf: <ramp>, trunk, bloom, lean }\`: deciduous, conifer, palm, bush, grass, flowers, mushrooms, cactus, seaweed, reeds.
- \`{ gen: 'structure', kind, height, width, wall, roof, lit }\`: hut, house, tower, castle-wall, ship, bridge, tent, ruins, pipe, well, windmill, lighthouse, skyscraper, dome, antenna, planet.
- \`{ gen: 'vehicle', kind, size, body, facing }\`: car, truck, bus, cart, bicycle, rowboat, sailboat, rocket, satellite, train.
- \`{ gen: 'object', kind, size, ramp, accent }\`: table, chair, bed, barrel, crate, chest, sack, pot, lamp, torch, campfire, rock, signpost, fence, console, bookshelf, anvil, cauldron, statue, column, tombstone, bench, streetlamp, hydrant, pile, flag, log.
- textures \`{ gen: 'texture', kind, ramp, wear, lit, window }\`: grass, sand, mud, snow, rock, ice, foliage, water, lava, tile, planks, brick, stone, cobble, metal, hull, fabric, logs, thatch, adobe, facade, glass.
- icons \`{ gen: 'icon', kind, colour, accent }\`: document, letter, book, map, scroll, key, coin, coins, bag, gem, bottle, potion, flask, bread, apple, fish, bone, wrench, hammer, brick, ticket, chip, phone, clock, compass, feather, leaf, star, heart, drop, medal, battery, shell, rope, ring, pill.
Or pixel art when no generator fits a thing of this story: sprites \`{ rows | frames (2-4), legend, size: [w, h] in cells, mirror, z, fps, glow, outline, person }\`, textures \`{ size: 16 | 32 | 64, rows | frames, legend }\`, icons \`{ rows (<= 16x16), legend }\`; one character per pixel, '.' and space transparent; legend values are swatches (void, gloom, umber, brown, wood, tan, tungsten, bulb, mossDark, moss, green, sage, fluo, tube, nightDark, night, dusk, haze, moon, dirtDark, dirt, sand, sandLight, paper, char, slate, grey, putty, pink, wine, clay, plum) or ramp steps (warm 0-5, leaf 0-5, sky 0-4, earth 0-4, stone 0-5, rust 0-4, plum 0-3, accent 0-1: \`leaf.2\`), 'clear' = transparent, never hex; a silhouette that reads, two or three steps of one ramp. A film pack (its shape, not a design to copy):
\`\`\`js
${GAME_B2_SNIPPETS.assets}
\`\`\``;

const LEVEL_FORMAT = `${ASSET_FORMAT}
Level format (the \`level\` of \`kit.fx.b2View\`): \`{ name (kebab case), mood: 'dark' | 'tungsten' | 'fluorescent' | 'shop' | 'backroom', floor, ceiling, sky, grid, legend, lights, sprites }\`. \`grid\` = rows of equal length, one character per 1x1 cell, at most 32x32. \`legend\` maps every other character to a wall \`{ wall: <texture id>, height }\`, a door \`{ door: true }\` (walls on two opposite sides) or an open cell \`{ floor, ceiling, mood }\` ('.' is open; a cell's \`mood\` makes a room: a dark corridor opening onto a tungsten room). Indoors the border is all walls and walls are at most 1 tall. Outdoors add \`sky: { preset: 'day' | 'dawn' | 'dusk' | 'night' | 'overcast' | 'space' | 'underwater', skyline: 'none' | 'hills' | 'mountains' | 'trees' | 'dunes' | 'city' | 'sea' | 'mesa' | 'towers', skylineHeight, clouds: 0-1, sun: { az, el, moon } | 'none', stars, ground }\`: no ceiling (a cell keeps a roof only with its own \`ceiling\`), the border may stay open, walls up to 4 tall, \`'none'\` floor or ceiling = the void. At most 12 \`lights\` \`{ id, pos: [x, y], z, power, radius, flicker: 'none' | 'tube' | 'bulb' | 'fire', bulb }\` (a light lights only its own room) and 40 \`sprites\` \`{ id, sprite, pos: [x, y], z, scale, flip, w, h }\`; positions in cells (x right, y down, 0.5 = the middle of cell 0), never inside a wall. Words go in the HUD, not on walls. The kit's built-in textures and sprites were drawn for another film: build this one from its own assets. Worked levels (their shape, not a design to copy): indoors,
\`\`\`js
const LEVEL = ${GAME_B2_SNIPPETS.level};
\`\`\`
outdoors, with this shot's one-offs next to the film's pack:
\`\`\`js
const SHOT_ASSETS = ${GAME_B2_SNIPPETS.shotAssets};
const OUTDOOR = ${GAME_B2_SNIPPETS.outdoor};
\`\`\`
Check it before the frames: \`reelforge validate level <the scene file>\` (each error names the grid row or the field), fix it and run it again.`;

export const GAME_B2_PROMPTS: WorldPromptText = {
  film: 'a first-person RPG video with a Doom vibe (every shot a moment of one game: a raycast walk through the places of the story, the hand taking the named thing, people who talk, a woodgrain HUD that carries the story)',
  brief:
    "the whole film is one first-person game, and every shot is a place of THIS story seen through the player's eyes. The world is a style, not a set of props: a software raycaster with chunky 32-colour textures, distance fog and dither; rooms lit by their mood (dark, tungsten, fluorescent, shop, backroom) or outdoor places under a sky (day, dawn, dusk, night, overcast, space, underwater) with a skyline; crude pixel sprites made for this film (its people, told apart by build, clothes, hats and tools; its animals, plants, buildings, vehicles and things); the first-person hand that takes, holds, presents and throws the thing the narrator names; a woodgrain HUD whose every element means something: the year compass, the minimap of the places walked, the narration box typed at an irregular cadence, the inventory of the story's things, a film-progress strip with chapter flags, a meter only for a real threat, a boss bar only for the central problem. A film about a forest walks a forest under the sky with its trees and animals; a film about a harbour has water, boats and the people who work there. Each intent names the shot's place (indoors or outdoors, its light or sky) and the people, animals and things of the narration in it, in the narration's words. Nothing else appears: no rendered 3D sets, no charts or UI windows, no photos, no character pack or mascot. The film's assets and each level are built from these intents, so never list `missingProps`.",
  rolls: `Rolls and looks: give every shot a \`"roll"\` and a \`"look"\`, e.g. \`{ "id": "s04_stock", …, "roll": "B", "look": "rpg-menu" }\`.
- \`A\` = the walk (\`rpg-explore\`: first person in a level of the place the narrator names, the hand takes or holds the thing, someone of the story talks, the narration box, the minimap and the compass). It is the film's anchor: come back to it every 3–6 s, at least once in every 6 shots.
- \`B\` = the game's screens (\`rpg-menu\`: a paused quest log or stat sheet with the inventory, the automap of the route, the end-of-chapter tally): take stock of what the narration explains, with its real numbers and names.
- \`C\` = the pressure (\`rpg-boss\`: the central problem as a boss bar, numbers popping off what is in danger, one stinger phrase, a shake, the thrown item): open acts and land the biggest beats; short and rare. A C shot has one loud thing; an explanation goes to B.`,
  tensionLooks:
    '- Rolls and looks by tension: high tension → C-roll pressure shots (boss bar, stinger, shake) and tight A-roll walks (a narrowing passage, a held look at the threat, a darker mood); calm → A-roll walks with room to look around, warm light or an open sky; B-roll game screens on plateaus where the narration explains or proves.',
  rhythm:
    'Rhythm: never more than 2 shots in a row in one look; change roll, look or place at least every 6–8 s; never walk the same room twice, and change the place, the palette or the light from one walk to the next (indoors and outdoors, warm and cold, day and night); open each act with a C-roll shot and a game-native transition.',
  shared:
    'every look plays in the same game (a raycast level in the 32-colour palette, the woodgrain HUD with its own pixel face, pink only for THE item of the story)',
  transitionIn:
    'a game-native transition (`"type": "wipe"` with a `style` from the list below and about its duration; `"focus": { "x": 0.6, "y": 0.4 }` = the door or thing it goes through, as a share of the frame)',
  camera:
    "The camera is the player's eyes: an intent may ask for a walk in (uneven strides), a stop, a turn to the thing or a look down or up (at the sky, a tree, a tower), always ending on a held look; never an orbit, a spin, a fly-over or a camera outside the player.",
  interrupts:
    '`"interrupt": { "kind": "look-switch", "note": "the walk freezes and the screen melts into the end-of-chapter tally" }`. Kind in this world: only `look-switch` (the look changes from the previous shot; give the shot a game-native `transitionIn`).',
  marks:
    "In this world every mark is part of the game: a caption is the narration box, a name or place types on the compass, a counter is a tally row or a meter, a badge is an inventory item drawn as the thing it names, a stamp is the tally's rubber stamp, an arrow is the compass's objective marker or the automap's note, a pin is the thing itself in the level, held by the hand or named on the compass; every label comes from the narration.",
  annotate:
    "put each in the game, timed to its spoken phrase (`at: 'the phrase'`, with `anchor: ctx.anchor` on the view and the HUD): a name or place on the compass (`hud.compass({ place })`), a thing into the inventory as its own icon (`hud.inventory`) or a toast (`hud.toast`), a number on a meter or a tally row, a line in the narration box (`hud.narrate`); never with `ctx.annotate` or `ctx.text`",
  motion: MOTION,
  missing: LEVEL_FORMAT,
  craftBrief: CRAFT_BRIEF,
  criticMedium: 'first-person RPG game',
  criticStyle:
    'a first-person game with a Doom vibe: raycast rooms or outdoor places under a sky in a 32-colour palette with dithered light and fog, crude sprites, the first-person hand, a woodgrain HUD with its own pixel face',
  vibe: 'Vibe check (every look of the film must feel like one first-person game): chunky raycast walls, floors and skies at a low resolution doubled up, dithered light and fog, simple crude sprites with a dark outline, the first-person hand, a woodgrain HUD with a blocky pixel face. Smooth gradients, glossy or rendered 3D, photos, vector icons, a comic or hand-drawn paper look or modern UI windows break the world: answer `off-intent` with a note starting `vibe:`.',
  checklist:
    "one focal thing, off-centre, readable at thumbnail size (a person, an animal, the thing in the hand, a strong wall feature; the HUD is texture, never the focal point); the place, people, animals and things are the narration's (a thing drawn as something else, the same person for everyone or a place that does not match the narration is a slop tell); pink (the accent) only on THE item of the story; every HUD element means something (progress = film progress, a meter only for a real threat, a boss bar only for the central problem); at most 6 competing elements; HUD words whole and readable; a held look after a walk; a lit light or a sky in view; human traces such as a light that stutters, a torch flicker, an animal out of step, a reach that overshoots, a struck option, a shake with decay, a counter that stalls, a misregistered stamp, a dev note. Only authored marks count as traces: the HUD plates, the woodgrain, the dither and the head-bob never do. Slop tells: a centred symmetric HUD, HUD spam (elements that say nothing), decorative HP or ammo with no real threat, rows of icons, invented labels, numbers or gibberish in the HUD, the same room or palette as the shot before, a frame mostly black, constant walking, slick polished sprites, an automap, tally or throw that shows nothing the narration says.",
  continuity:
    "Link the pair where the narration carries one thing into the next shot: `shared-object` (the held thing stays in the hand while the place changes: from the place it was found to the place it is used), `carry-environment` (the same level goes on and one thing in it changes: a field fills, a shelf empties, the light falls), `zoom-through` (through a door, a window or into a thing on the wall, and the next place opens). The game's own links are the map and the throw: an automap shot grows out of the walk's minimap (`game-b2-map-unfold`) and folds back into the next walk (`game-b2-map-fold`). Name the object in both intents; never link two unrelated places.",
  surprise:
    'a sudden game moment (e.g. "the walk freezes and the screen melts into the end-of-chapter tally", "the held thing is thrown and tumbles over the edge"); never a camera move (no dolly zoom, orbit, rack focus or screen)',
  moments: GAME_B2_MOMENTS,
};

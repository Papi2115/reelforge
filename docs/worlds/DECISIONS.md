# Worlds — decisions and foundations (Papi, 2026-10-06)

Status: **the approved foundations of the new Styles ("worlds") for ReelForge 3.0.** Everything here comes from standalone HTML showcases
(`docs/worlds/<world>/showcase.html`, copied for viewing to `C:\Users\galar\Desktop\ReelForge-worlds\index.html`). Nothing is built in the
app yet. A world = one **Style** (palette, post-fx/filter, resolution, fonts, music/sound palette) + its own **A/B/C looks** + rare
**breakthrough scenes** that punch through every ~60–90 s without breaking the world's vibe (see `QUALITY.md`, `briefs/`).

## Approved (official foundations — build these, do not redesign them)
| World | Showcase folder (v2 = the reference) | Breakthrough scenes | Notes |
|---|---|---|---|
| **Comic panels** | `comic-panels-v2/` (v1 `comic-panels/` kept) | sepia flashback strip, double-page spread | "Every element is a banger" — approved in full. Topic used: Apollo 11, the 1202 alarm. |
| **Game B1 — Atari-era boss montage** | `game-hud-b1-boss-v2/` (v1 kept) | high-score table (weakest, kept), instruction-manual page | Two worlds in one: inside the TV (Atari rules) vs the living room. Topic: 1983 video game crash / E.T. cartridges. |
| **Game B2 — first-person RPG (Doom vibe)** | `game-hud-b2-rpg-v2/` (v1 kept) | automap, intermission tally screen | Papi "fell in love": style, animations, interaction with the character, inventory, the map (continuity), narration box, the cartridge-throw animation. To be developed for sure. |
| **Sketchbook** | `sketchbook-v2/` (v1 kept) | pop-up page ("overpowered"), accordion timeline ("another level of animation") | Hand-drawn notebook; A felt-tip story pages, B blue ballpoint graph paper, C loud page moments. Topic: the leap-year calendar bug. |

## Rejected / parked
- **Detective board** (all variants: 1, 2a wall, 2b neon-noir 3D, 2c felt) — dropped. (Papi: flat, grainy, string animations cut off; none of the reworks won.)
- **Game HUD v1** (dark-green Y2K) — parked as a possible later addition ("we may come back to it"), not a foundation.
- Rejected ideas (Papi found them boring/over-complicated): synthwave, plain filters (sepia/halftone/VHS…), pinball, versus-fight, roguelike, microscope, metro,
  point-and-click, found-footage VHS, old map. Keep concepts SIMPLE and human.

## What Papi loved (design principles for the real build)
1. **Continuity transitions** — "natural, you feel continuity". The best moments are match-cuts / shared-object transitions, not wipes:
   B1 shot 2→3 (zoom into the wall calendar and the whole environment changes cleanly = "masterful"); B1 shots 5 and 7 (the environment stays
   continuous while the cartridge is inserted/pulled); B2's map that really conveys continuity and the cartridge throw. The engine must support
   an explicit **continuity link between shots** (a shared object/anchor that the camera or action carries across the cut) — storyboard
   field + scene-build rules + transition kit support. This is the signature of ReelForge worlds.
2. **Human feel** — hand traces everywhere (QUALITY.md §2): visible hand with pen, crossed-out words, coffee rings, uneven gutters, a developer's sticky
   note, irregular typewriter cadence. Never "AI slop" (QUALITY.md §1).
3. **Rare breakthrough scenes** that keep the world's vibe; each shot has one focal point; real text only (every on-screen word from the narration or research).
4. Interaction with the character/world (B2: inventory, dialogue boxes, the thrown cartridge) feels like a game, not a template.

## Deliberate roughness — DO NOT "fix" (Papi, 2026-10-06)
Papi loves the slightly crude, hand-made drawing of figures and props (the comic's Steve Bales profile, the clerk and stick figures, simple sprites,
uneven lines). It is what makes the worlds look made by a person and not generated; he first thought it was a deliberate effect. In the real build
**keep the imperfection** and never replace it with slicker, symmetric, "polished" art. Only touch a drawing if it hurts readability (focal point,
silhouette at thumbnail size), never because it looks simple.

## Technical items to check in the real build (not about the art style)
- Comic: shot 7 has two accent colours (should be one); the 6.5 s silence on the spread may need trimming once real voice-over exists; the front-view Lunar Module
  can read like a face (judge it, keep it if Papi likes it).
- B1: high-score table is dark and sparse in the captured frame (Papi: "fairly OK, keep it"); room.js/shots-a.js longer than 400 lines (code hygiene only).
- B2: automap showed an empty box at the bottom in the captured frame (probably an animation state; verify); dither grain in dark areas; port cost ≈ 1 week for the
  raycaster as a kit look, 4–6 weeks for a native Three.js version with a level description format + validator for the runtime Claude.
- Sketchbook: the writing hand sometimes covers the subject (add a "hand rests here" rule); the crumple transition is the slowest frame; marker digits slightly calligraphic.
- All worlds: facts marked `[verify]` in each NOTES.md MUST be checked against sources before anything goes on screen (e.g. E.T. 4,000,000 made / 1,500,000 sold "est.",
  DSKY P63/VERB 05 NOUN 09/01202, exact dates).

## How these were produced (so it can be repeated)
Briefs in `docs/worlds/briefs/*.md` (comic-v2, game-b1-v2, game-b2-v2, sketchbook-v2) were run as **cloud sessions** started by Papi at claude.ai/code on the
repo (so the $250 cloud credit applies; agents launched from the desktop app with `isolation: remote` actually ran LOCALLY on his limit — do not use that).
Each session works in its own new folder, commits to `worlds/<name>`, opens a PR into `phase-12/v2.5-worlds`; the Manager pulls the folder with
`git checkout origin/worlds/<name> -- docs/worlds/<folder>` and reviews the PNGs. Standalone HTML = plain classic scripts (file:// blocks ES modules), 640×360 or 960×540
indexed canvas, pure function of t, seeded PRNG, palette ≤ 24–32 colours.

## Sketchbook resolution (Papi, 2026-10-06)
960×540 indexed page scaled ×2 (nearest) to 1080p is approved ("git, nie kombinuj"): the stair-stepped hard edges read as hand-made. Do NOT build the native 1920×1080 variant.

## Sketchbook rules from test film 2 (Papi, 2026-10-07)
- **Pop-ups are never a template.** Every pop-up must be original. Pulling the side ribbon/tab must trigger a motion that MEANS something in the narration
  (the mockup's sun slid so the calendar drifted), ideally always a different motion; Claude is expected to play with it and understand it. No invented decorative
  elements (the grey disc in film 2). A required `intent` string states the claim the motion shows; the critic checks it; never the same mechanism twice in one film.
- **Hand policy.** If the hand cannot keep up with the narration it draws only the KEY elements (figures, the hero object); labels, numbers and small words may simply
  APPEAR on their own while the hand draws something else. Never cut narration content because writing is slow; never stroke-draw text without the hand.
- **Variety is mandatory** (≈ 1 pop-up or accordion per 50 s on average in real films, ≥ 2 kinds, never adjacent) — see QUALITY.md §8.2.

## PRINCIPLE: a world is a style GRAMMAR, not an asset catalogue (Papi, 2026-10-07)
Seen on test film B2: the new worlds only REPLAY the mockup's vocabulary (the clerk sprite, brick walls, cartridges, the Thames as a corridor). The mockups are
**references for the style and the vibe** (palette, line/pixel rules, shading, proportions, animation feel, HUD grammar), NOT the set of things a film may contain.
"The world serves the narration, not the narration the world": a film about a forest in the B2 style must get trees, animals, undergrowth, sky and a forest level,
generated for THAT film, the same way the base voxel model builds props/characters per film. Applies to all four worlds (Sketchbook, Comic, Game B2, Game B1).
Consequences: (1) every world needs an OPEN VOCABULARY: authoring DSLs and parametric generators (sprites/textures/props/characters/icons/environments) in the world's
style, not only built-in ids; (2) prompts teach the STYLE GRAMMAR and a design process (nouns of the narration → what each looks like in this style → build/define it),
and must not bias towards the showcase topics; (3) project-local asset files built per film (like the voxel prop builder) with a critic that checks recognisability
at thumbnail size; (4) validation = real films on topics far from the showcases (forest, ocean, space station, medieval village, desert, city…).

## Comic breakthroughs are never a template; pages flow and carry things (2026-10-07)
Real run Comic 2: the flashback was the kit example's own `strip + row`, the spread the same `pull-back` as Comic 1 (the prompt's snippet).
- **Open toolkit** `page.panelBreak({ intent, panels, moves, gutters, drive, print, fold })`: the scene shapes 1-5 panels, how each arrives (swing, grow, unroll, drop…), what moves on which phrase (one panel dragging others with `lag`), what the gutters do (close / lift / tear), a camera inside a panel, `print: 'past'` for a look back. Needs a motion that shows the claim; `intent` required. Preferred over `flashback`/`spread`, which lost their defaults (`cover`/`arrange`, `assemble`/`pieces` must be chosen).
- **Guards (⚠)**: a flashback/spread whose options ARE a showcase template (f1 page+rows, f2 strip+row, s1 merge+grid, s2 unfold), a panel break replaying a kit example's mechanism (b1-b3), the same mechanism twice in a film, a missing/generic intent.
- **Flow and continuity** (Papi: "does not always FEEL like a comic, transitions are dry"): `page.flow({ intent, direction: 'down' | 'across' | 'diagonal' })` lays a long or narrow strip the camera reads; `page.thread({ intent, through: [3+ panels] })` carries one element over panels and gutters. Final-review ⚠: 4+ plain cuts in a row with no flowing page, the same page flow on 3 pages in a row, a film of 6+ shots that carries nothing across 3 panels or shots.
- Lettering: the Inkhand W now ends in two points (read as N before); captions letter in only with an explicit `type`.

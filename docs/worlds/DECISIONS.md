# Worlds — decisions and foundations (Papi, 2026-10-06)

Status: **the approved foundations of the new Styles ("worlds") for ReelForge 2.5.** Everything here comes from standalone HTML showcases
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

## Known weaknesses to fix in the real build (from the showcases' own NOTES + my review)
- Comic: front-view Lunar Module reads like a face; the Bales figure is crude; shot 7 has two accent colours; 6.5 s silence on the spread may need trimming with real voice-over.
- B1: high-score table is dark and sparse (Papi: "fairly OK, keep it"); room.js/shots-a.js too long; shot 4 menu centred.
- B2: automap is sparse with an empty box at the bottom in the captured frame; dither grain in dark areas; clerk sprite crude; hand has one stiff pose; port cost ≈ 1 week for the
  raycaster as a kit look, 4–6 weeks for a native Three.js version with a level description format + validator for the runtime Claude.
- Sketchbook: pop-up reads a little flat; marker digits slightly calligraphic; the writing hand sometimes covers the subject (needs a "hand rests here" rule); crumple transition slowest.
- All worlds: facts marked `[verify]` in each NOTES.md MUST be checked against sources before anything goes on screen (e.g. E.T. 4,000,000 made / 1,500,000 sold "est.", DSKY P63/VERB 05 NOUN 09/01202, exact dates).

## How these were produced (so it can be repeated)
Briefs in `docs/worlds/briefs/*.md` (comic-v2, game-b1-v2, game-b2-v2, sketchbook-v2) were run as **cloud sessions** started by Papi at claude.ai/code on the
repo (so the $250 cloud credit applies; agents launched from the desktop app with `isolation: remote` actually ran LOCALLY on his limit — do not use that).
Each session works in its own new folder, commits to `worlds/<name>`, opens a PR into `phase-12/v2.5-worlds`; the Manager pulls the folder with
`git checkout origin/worlds/<name> -- docs/worlds/<folder>` and reviews the PNGs. Standalone HTML = plain classic scripts (file:// blocks ES modules), 640×360 or 960×540
indexed canvas, pure function of t, seeded PRNG, palette ≤ 24–32 colours.

# Real run Game B2 2: open vocabulary on a forest film (PLAN.md#13.15 phase 3, Game B2)

Date: 2026-10-07 · Claude Code CLI on the user's subscription (sanitized env, all 39 turns
`apiKeySource: none`, 64 rate-limit events all `allowed`, `limitHits: 0`) · Windows 11 · another
coder's real run (a `claude -p --model opus` child) shared the PC and the subscription. Run by the
Coder through the stage code like [Game B2 1](real-run-game-b2-1.md): `StageRunner` with
`experimentalWorlds: true`, **`worldQuotaOverride: { minBreakthroughs: 2 }` (test only)**,
`maxFixIterations: 1`, concurrency 2; `checkSources`, `proposeMoments` (all accepted), `exportVideo`,
`buildPublishKit`. Code: `phase-13/v3.1` at 9a4c84c (+ other coders' uncommitted work in the tree),
**no code changed**. Before the run: `pnpm exec tsc -b` (clean), `pnpm build:cli`,
`pnpm check:cli-bundle` "up to date". Project created with `createProject({ style: 'game-b2' })`.
Driver: `scratch/real-run-game-b2-2/` (gitignored; copy of round 1). **Driver change:** the export
manifest now carries `worldAssets` (`readWorldAssetFiles` + `manifestWorldAssets`, as
`apps/desktop/src/main/project-manifest.ts` does); round-1 drivers did not have it.

Topic (packet): "A day in the life of a forest: how a 300-year-old oak tree feeds an entire
ecosystem". EN, SAPI David rate +2, lead 0.8 s / paragraph 0.6 s / tail 0.8 s → 48.4 s; whisper
large-v3-turbo-q5_0 (7.5 s, 91 % coverage).

Output: `C:\Users\galar\Desktop\ReelForge-test-films\game-b2-test-2.mp4` (47.93 s, 1920×1080 30 fps
H.264 NVENC + AAC, 57.1 MB), `…-contact-sheet.png`, `…-transitions.png`, **`…-world-assets.png`** (the 8
world-asset QA sheets tiled), publish kit `…\game-b2-test-2-publish\`; project
`…\game-b2-test-2 work\Forest Oak\`. Per-shot 8-frame strips in `scratch/real-run-game-b2-2/strips/`,
detail strips in `…/zoom/` (`s05keeper`, `s06card`, `s07link`).

## 1. World assets (the new step)

Ran as `{ stage: 'scenes', action: 'world-assets' }` before the build (the build then kept the set:
"up-to-date", no second design). 2 Opus turns (design 66 tool turns / 5.1 min, fix 8 turns) + 2 Haiku
critic turns; status **built ✓, 23 assets, 0 findings**; committed path-limited ("World assets built ✓").

| Kind | Assets (`assets/game-b2/*.json`, `assets/cast.json`) | Used in scenes |
| --- | --- | --- |
| sprites (12) | old-oak, neighbour-oak, sapling, hedge, acorn-heap, oak-roots, fungus-threads (forest.json); caterpillar, blue-tit, jay, nest, keeper (creatures.json) | all 12 (old-oak 8 shots, hedge 8, neighbour-oak 6, sapling 5) |
| textures (4) | wet-grass, soil, canopy, leaf-litter | all 4 |
| icons (7) | acorn, oak, sugar, nutrients, water-drop, new-leaf, quest-log (items.json) | 5 (new-leaf, quest-log unused) |

Scenes added their own on top (low-branch, tall-grass, soil-mound, falling-acorn, far-jay, fern,
edge-oak, dusk-grass…). `cast.json` maps each asset to the narration phrase and shots.

**Differ from mockup/showcase: yes, fully.** grep over scenes + assets for cartridge / Dad / warehouse /
office / store-shelf / 1982 / clerk / desert: 0 hits (only an automap mark `kind: 'item'`). No
`unrequested showcase object` guard finding. Every level is named after the narration (dawn-meadow,
oak-canopy, root-chamber, noon-clearing, dusk-oak-clearing, dusk-wood-edge, morning-oak-glade,
dusk-oak-hollow, oak-day-map). Run 1's "Thames is a corridor / every person is a clerk / every object
is a cartridge" problem is gone.

**Recognisable at thumbnail (`game-b2-test-2-world-assets.png`):** old oak / neighbour oak / sapling / hedge
read instantly; caterpillar (striped green bar), nest with chicks and blue tit read at 1×; **jay does
not** (a tan, kiwi-shaped bird; the turn itself said "reads as a tan bird, not pink-brown with blue
wings"); **oak-roots** read as a tan boomerang/arch and **fungus-threads** as a white checker X with a
mushroom; the 7 icons are ~8 px and only the pink acorn and blue drop read. The QA "thumbnail" row
scales the whole sheet to 128 px, so sprites are ~10 px there — it does not test per-asset legibility,
and the Haiku critic passed every sheet "ok" both rounds.

**Invented character:** `keeper` ("woodland keeper, the film's only person", for s05) — the narration has
no person; the storyboard's `dialogue` moment on "whether oaks share … is debated" needed a speaker and
the asset step made one up. The anti-slop guard caught only the `KEEPER` label (s05 ⚠).

**Cost of the step:** 7.1 min, $1.56 (14 % of the film). 8 of 14 `reelforge world-assets check` calls
failed on generator option guesses (tree `kind: 'oak'`, string seeds, ramp indexes, `horns`), each
error message naming the allowed values — learning by trial. The turn also left an empty
`assets/game-b2/probe.json` (it cannot delete files) which became part of the committed set.

## 2. Breakthroughs, moments, intents

| Moment | Shot / time | `intent` | What it shows | Verdict |
| --- | --- | --- | --- | --- |
| **tally** (planned breakthrough) | s08 36.36–42.42; rows 38.5, value ticks to ~2,300 by 40.3, LINKED stamp 41.0 | "one oak tree is linked to about 2,300 species in Britain" | THAT NUMBER / IN BRITAIN / SPECIES ~2,300, pink LINKED stamp; **live meadow + oak behind** | **meaningful, best frame of the film**; answers the open loop; backdrop not black any more (run-1 defect 2 not repeated) |
| **automap** (planned breakthrough) | s10 44.94–47.93 | "dawn, morning, noon and evening are all walked; the loop ends on the one tile the oak never leaves" | 4 chapter rooms (✓DAWN ✓MORNING ✓NOON ✓EVENING) ringed around a central ITS SPOT room, arrow note NEVER LEAVES | **original and meaningful idea** (the day's chapters all orbit the same tile) — not a copy of run 1's automap; **but** small, ~85 % of the frame black, 45.5–46.0 almost empty (blank guard ⚠ at 0.75 s, dismissed by final triage), film ends on black |
| dialogue | s05 22.95–27.47 | – | invented KEEPER speaks the narration line, QUEST UPDATED / MAYBE toast | **invented speaker**; keeper is a back-facing block with no face |
| level-card | s06 transition 27.47 | – | woodgrain plate with an **empty** black band; EVENING appears only as a tiny compass/flag label | by design (`engine/src/transitions/game-b2/card.ts`: the band is "the slot … typed by the incoming shot's compass") — reads as a blank plate; critic flagged "EVENING level-card missing" (true) |
| inventory-pick | s06 → s07 | – | hand catches one pink acorn from the heap (s06 ~31.5), holds it into s07, acorn drops into the inventory on "thousands" (+ITEM ACORN) | reads; the shared-object link (s06 → s07) **blinks**: the hand lowers out of frame ~32.4, the crossfade 32.46–33.06 shows 0.3 s with no acorn, then the hand rises in s07 (`zoom/s07link.png`); no double hand this time |
| stinger | s09 42.42–44.94 | – | big 326 types digit by digit, boss bar THE OAK 326/2,300 | number lands; the "boss" is the oak itself (HUD semantics off); static 2.5 s, dark |
| quest-log | s02 6.41–12.01 | – | HOW MANY CREATURES / LIVE OFF THIS ONE TREE?, oak + pink note slot CREATURES HOW MANY? | the open loop reads; first 1.7 s empty log |
| palette-shift (moments.json) | s09 42.42–42.92 | – | render effect on "Three" | present |

**No unplanned breakthrough** (run 1's s03 tally leak did not recur): 2 planned, 2 rendered, different
mechanisms. But `hud.menu` is used twice (s02 quest log, s04 fungus menu) with the same full-frame
layout — not a breakthrough, still the same picture twice.

## 3. Variety, hand and pop-up rules

| Shot | t0–t1 | Look | Place / light | Transition in |
| --- | --- | --- | --- | --- |
| s01 dawn_oak | 0.00–6.41 | A explore | dawn meadow, hero oak, sun | – |
| s02 question | 6.41–12.01 | B menu | quest log over frozen meadow | cut |
| s03 morning_canopy | 12.01–17.79 | A explore | under the crown, nest + caterpillar on branch boards | cut |
| s04 roots_below | 17.79–22.95 | B menu | underground root chamber → menu | game-b2-melt |
| s05 neighbours_maybe | 22.95–27.47 | A explore | grey noon clearing, keeper | cut |
| s06 acorn_fall | 27.47–32.46 | C boss | dusk, acorn heap, hand | game-b2-level-card |
| s07 jays_bury | 32.46–36.36 | A explore | dusk wood edge, jay, mounds | continuity shared-object |
| s08 species_tally | 36.36–42.42 | B menu | tally over sunny meadow | game-b2-darkness |
| s09 326_stinger | 42.42–44.94 | C boss | dusk hollow | cut |
| s10 never_leaves | 44.94–47.93 | B menu | automap on black | cut |

Looks never repeat back to back; 3 game transitions + 1 continuity crossfade rendered. The day
structure gives real light variety in the first half (dawn → bright morning → underground → grey
noon), **then 4 dark dusk shots + black map** (last ~20 s mostly dark again; s08 is the one bright
break). Hand (first-person) only on the key item (the acorn) ✓; toasts carry narration words
(CATERPILLARS HATCH, QUEST UPDATED MAYBE, +ITEM ACORN) ✓. Decorative bits: floating "2" / "5" damage
numbers off the heap in s06 ("every two to five years"), SCIENCEALERT.COM source text in s04's menu.

## 4. Guards and critic

- Anti-slop guards: **2 ⚠** — s01 "too few human traces: 2" (rule-true, low value for a calm opening
  walk), s05 invented text "KEEPER" (**true**: invented character). `slopcheck.mjs` re-run on all 10
  scenes: same 2. No showcase-object finding (none present).
- `reelforge validate level`: 12 calls / 10 scenes, **0 errors** (run 1: 13 real errors) — the scenes
  build levels from the film's own assets instead of forcing kit kinds.
- Critic (Haiku), build QA: s02 quest text missing "creatures" (true, fixed); s04 "too dark to see the
  roots" (half-true, at the melt); s06 hand position / EVENING card missing / acorn placement (partly
  true); s07 "no clear sprout focal at the end" (true-ish); **s10 "external meta-text overlay 'NOT BAD
  FOR AI'" (false: mid-typewriter "NOT BAD FOR A…")** → the fix turn deleted the narration line.
  Final review: triage `suspects: []`, 8 ✓ / 2 ⚠ (the two guard findings only); it cleared s06/s07/s10.
  **Missed:** blank map frames (s10), the acorn blink at the s06→s07 seam, the empty level card, the
  unreadable jay, the invented keeper as a character (only its label).
- QA/fix turns: **6 fix turns** (run 1: 11), 1 only for sfx sync (s08 tally ticks).

## 5. Quality (QUALITY.md §7, /20)

| Shot | Score | Note |
| --- | --- | --- |
| s01 | 15 | hero oak + dawn sky read; slow walk, the box carries "ALREADY OPEN FOR BUSINESS"; box stays empty last 0.3 s |
| s02 | 14 | the question reads; full-frame menu, empty for 1.7 s, icons tiny |
| s03 | 15 | on-topic (nest with chicks, caterpillar, blue tits) but on two floating "branch boards" at eye level; caterpillar as long as the nest; all green |
| s04 | 14 | underground reads for 1.5 s (roots = boomerang, fungi = checker), then the same menu as s02 for 3.3 s; "SWAP / FOR TREE'S SUGAR" lost "FUNGI" to the 28-char cap |
| s05 | 14 | nice uneven pan between the two oaks; invented faceless keeper; grey |
| s06 | 15 | dusk, heap, hand catches the acorn on cue; empty level card; heap = dirt pyramid; 2/5 floating numbers |
| s07 | 15 | mounds pop, sapling sprouts on "oaks", acorn into inventory; jay unreadable; dark |
| s08 | 17 | tally ticks to ~2,300 over a lit meadow, LINKED stamp lands — clearest frame |
| s09 | 15 | 326 slams; dark static; boss bar = the oak |
| s10 | 14 | good map idea, small on black, near-empty first second, black ending |

**Mean 14.8/20** (run 1: 14.8; Sketchbook 16.25–16.8; B2 showcase 17–19). Same score, different
reasons: run 1 failed on content (wrong/forced objects), run 2 has the right content but the same
readability/craft problems (small subjects, menus filling the frame, dark second half, black map).

## 6. Wall clock, turns, cost, export

`costUsd` = project ledger deltas (list-price meter, not a bill).

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 87 s | 3 Sonnet | 12.2 k | 0.50 |
| claims check | 9.6 s | 1 Sonnet (12 claims, 12 sourced, 0 disputed) | 0.8 k | 0.06 |
| voiceover / clean / words | 0.7 / 3.2 / 7.5 s | – | – | – |
| storyboard (+ tension) | 141 s | 2 Sonnet (warnings: s09 2.5 s, s10 3.0 s short; tension tempo) | 11.9 k | 0.38 |
| **world assets** | 423 s | 2 Opus + 2 Haiku | 33.0 k | 1.56 |
| scenes build | 1322 s (22 min) | 10 build + 6 fix (Opus), 12 critic (Haiku) | 156.9 k | 8.85 |
| final review | 74 s | 1 triage (Haiku) | 2.1 k | 0.04 |
| sound-cues / mix | 70 s / 6.5 s | 1 Sonnet | 3.9 k | 0.17 |
| export | 77 s (1438 frames, 2 workers, SwiftShader, 18.6 fps, `h264_nvenc` first try) | – | – | – |
| **Total** | **~36 min of stages** | **40 turns** | 221 k | **11.55** |

$0.89 per scene shot (run 1: $1.19) + $1.56 for the assets. Scene turns: 402 tool calls (153 Read,
79 Edit, 45 `frames`, 38 `kit-docs`, 24 `anchors`, 20 `lint`, 12 `validate level`). Mix: −14 LUFS,
−2.53 dBTP; warnings "Sound moments per minute 26.0 (want ≤ 24)", "Repetitions: 1 open (1 SFX)".

## 7. Pipeline failures and root causes

No stage failed, no crash, no frame timeout, no limit pause. Problems found:
1. **Round-1 drivers export without `worldAssets`** (driver code, not product): fixed in this driver;
   the Comic / B1 / Sketchbook phase-3 drivers need the same two lines, or their exports ignore the
   designed assets. The app path (`project-manifest.ts`) already includes them.
2. **Junk file committed in the asset set:** the world-assets turn wrote `assets/game-b2/probe.json`
   to probe options, cannot delete (allowed tools), and the builder commits every file of
   `assets/<world>/`.
3. **Critic false positive drove a destructive fix:** "NOT BAD FOR AI" (mid-typewriter frame) → the s10
   narration box was removed.

## Honesty verdict: style vs content — 7/10

The open vocabulary **works on content**: every asset, level and label is designed for this narration
(oak, roots, fungi, caterpillar, blue tits, nest, jay, acorns, 2,300 / 326), zero showcase objects,
breakthroughs are original and mean something (the automap's "four chapters orbit one tile" is a real
idea, not a template). It loses points on **one invented character** (keeper, forced by a `dialogue`
moment with no speaker in the narration), **assets that do not read** (jay, roots, fungi, 8 px icons —
and the asset QA passes them), and the world's **craft defaults** (full-frame menus twice, empty level
card, dark dusk run, map on black) that keep the film at 14.8/20.

## Defects and suggested fixes

| # | Sev | Defect | Suggested fix |
| --- | --- | --- | --- |
| 1 | high | `dialogue` moment planned without a speaker in the narration → invented person (keeper) | storyboard validator: B2 `dialogue` only when the narration quotes/names a speaker; else narrate box; asset prompt: never invent people the narration does not name |
| 2 | high | Automap on black again (~85 % black, near-empty first second, black ending) | automap `scale` ≥ 50 % of frame, `backdrop: 'freeze'` over the last level; validator: no film ends on a B-menu shot over black |
| 3 | medium | Asset QA does not test legibility: thumbnails are the whole sheet at 128 px; jay / roots / fungi / icons pass "ok" | per-asset crop at 64 px + critic question "name this thing"; flag unnamed ones |
| 4 | medium | `game-b2-level-card` is an empty plate; the place name appears only as tiny compass text | type the incoming shot's chapter/place into the band (from storyboard/compass), or drop the band |
| 5 | medium | Shared-object link blinks (hand lowered at s06 end, 0.3 s without the acorn) | continuity check: the shared item visible at both seams (t1−0.05 / t0+0.05) at the `anchor` |
| 6 | medium | Same full-frame `hud.menu` layout twice (s02, s04); menu empty for 1.5–1.7 s | variety check on menu shots; menu content at open (no typing from an empty log) |
| 7 | medium | Critic misreads typewriter frames ("NOT BAD FOR AI"), fix turn deletes the line | critic checklist: text in progress is not a finding; sample text at t1−0.1 |
| 8 | low | world-assets turn learns generator enums by trial (8/14 failed checks) | `kit-docs generators` lists allowed values per option (or the prompt inlines them) |
| 9 | low | world-assets turn leaves probe files that get committed | builder: commit only ids referenced by `cast.json`, or drop files with no assets |
| 10 | low | Second half dark (4 dusk shots + black map) | mood/light variety per act (as run-1 #2) |
| 11 | low | Decorative numbers (2 / 5 off the heap), source URL as HUD text (SCIENCEALERT.COM) | guard: damage numbers need a damage meaning; sources only in the publish kit |

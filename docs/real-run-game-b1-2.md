# Real run Game B1 2: space station, the first B1 film with the open vocabulary (PLAN.md#13.15 phase 3)

Date: 2026-10-07, 17:58–18:44 UTC · Claude Code CLI on the user's subscription (sanitized env, every turn
`apiKeySource: none`, 53 rate-limit events all `allowed`, `limitHits: 0`) · Windows 11 · two other real runs
(B2 forest, Comic ocean) active at the same time. Run by the Coder through the stage code like
[Game B1 1](real-run-game-b1-1.md): `StageRunner` with `experimentalWorlds: true`,
**`worldQuotaOverride: { minBreakthroughs: 2 }` (test only)**, `maxFixIterations: 1`, concurrency 2;
`checkSources`, `proposeMoments` (`PAGE_CAMERA_HINTS`, all accepted), `exportVideo`, `buildPublishKit`.
**The world-assets step ran as its own stage call** (`{ stage: 'scenes', action: 'world-assets' }`) before
the scenes build (which then kept the set: "up to date").

Code: `phase-13/v3.1` at e04515c, **no source changed by this run**. Before the run `tsc -b --dry` showed every
project up to date and `pnpm check:cli-bundle` said "up to date" (so `build:cli` was not re-run, to avoid
rewriting the bundle under the parallel runs); the engine harness was newer than every `kit/src`/`engine/src`
file. **Caveat:** another coder edited `kit/src/worlds/game-b1/{screen/methods.ts,vocab/assets.ts,vocab/registry.ts}`
at 18:41 UTC, after the scenes and before the export; the diff is text only (`assets/b1` → `assets/game-b1` in
doc strings and error messages), so no pixel differs. Driver: `scratch/real-run-game-b1-2/` (gitignored:
`drive.mjs` + the round-1 helpers). **Driver fix (from the B2 run):** the old driver's export manifest omitted
`worldAssets`; added `manifestWorldAssets(readWorldAssetFiles(...))` as in
`apps/desktop/src/main/project-manifest.ts` before the export (scene turns were not affected: `reelforge frames`
loads the assets itself).

Topic (fixed by the packet): life aboard a space station: how astronauts sleep, eat and exercise in zero
gravity. EN, SAPI "Microsoft David Desktop" rate +2, lead 0.8 s / paragraph 0.6 s / tail 0.8 s → 51.5 s WAV;
whisper large-v3-turbo-q5_0 (7.9 s, 136 words, 91 % coverage). Project created with
`createProject({ style: 'game-b1' })` → world defaults.

Output: `C:\Users\galar\Desktop\ReelForge-test-films\game-b1-test-2.mp4` (50.53 s, 1920×1080 30 fps
H.264 NVENC + AAC, 32.8 MB), `…-contact-sheet.png`, `…-transitions.png`, **`…-world-assets.png`** (the 11
critic sheets tiled), publish kit `…\game-b1-test-2-publish\`; project `…\game-b1-test-2 work\Space Station\`.
Per-shot 8-frame strips in `scratch/real-run-game-b1-2/strips/`, detail frames in `…/zoom/` (`s05s06cart`,
`s07s08shake`, `crop-s05-tv`). Every claim below was checked on them. Times are film seconds.

## 1. World assets (the point of this run)

One Opus turn (80 tool turns, 6.3 min, 13 × `world-assets check`, 3 × `world-assets sheet`, `kit-docs world-assets`
×2) + one Haiku critic (all 11 sheets "ok") → **28 assets ✓ on the first attempt, 0 findings**:

| Kind | Ids (all from THIS narration) |
| --- | --- |
| characters | `astronaut` (blue polo, grey shorts; 4 frames float/lift/pant/seated), `crewSleeper` (green bag, tether), `scottKelly` (bald, moustache, orange bag), `boneLoss` (the one boss: skeleton, crimson only here) |
| props / icons | `cushion`, `chair`, `tray` (empty / food stuck on), `foodPouch`, `foodFruit`, `foodVeg`, `foodDessert`, `treadmill`, `exerciseBike`, `weightsMachine`, `station` (ISS: solar wings + truss), `sun` |
| effects | `hitFlash`, `snapSparkle` |
| playfields | `galley`, `menuBoard`, `gymModule`, `bossArena`, `starfield`, `earthLimb`, `sleepPod` |
| rooms | `bedroomNight` (bedroom shell, stars window, lamp, bed, **ISS poster**), `bedroomMorning`, `kitchenCorner` (tiles, checker floor, trees window) |

`assets/cast.json` maps every id to the shots it serves, with look notes ("ORANGE bag, never the crew's green").

- **Differs from the showcase: yes, completely.** No cartridge/1982/Dad/warehouse/office/E.T. anywhere in the
  set; 0 "unrequested showcase object" findings in the 11 scenes. The room is no longer the showcase living room:
  7 shots use `bedroomNight`, s07 `kitchenCorner` (the TV cabinet, console and joystick stay, as designed).
- **Used by the scenes: 18 of 28.** Every scene calls `screen.assets(ctx.worldAssets)`. Unused: the 4 food icons
  (s06 re-defined them as NUSIZ 3-copy rows with `defineSprite`), `exerciseBike`, `weightsMachine` (the manual's
  FIG. 1 cannot take a sprite, §2), `galley`/`sleepPod` (s07/s03 drew their own), `gymModule`, `bedroomMorning`,
  `snapSparkle`.
- **Recognisable at thumbnail:** on the sheets' ≤ 64 px thumbnails only the rooms, the station, the skeleton and
  the bike read; people are 3-px dots, `cushion` is a checkerboard, `hitFlash`/`snapSparkle` are invisible, the
  food icons are specks. In the film at 1080p (sprites at size 2 × rowH 4) they read well: astronaut, skeleton,
  the sleeping bags, the tray, the ISS (contact sheet). **The critic passed everything** (incl. the cushion and the
  invisible effects) — it judges "8-bit style", not "is this recognisable as X".
- **Defect:** the turn wrote an empty `assets/game-b1/probe.json` while testing, could not delete it (no delete
  tool; Bash is `reelforge` only) and said so; it was listed in the report and committed. The driver deleted it
  before the export (the parallel B2 coder is adding a junk filter: `stages/src/world-assets/junk.ts`, uncommitted).

## 2. Breakthroughs and moments

| Moment | Shot / time | `intent` | What it shows | Verdict |
| --- | --- | --- | --- | --- |
| **score-table** (planned) | s05 21.53–25.85 | "the sleep the schedule plans against the sleep crews really get: 8 hours planned, about 6 slept" | HIGH SCORES 1ST SCHEDULE 8; pull back to the room; 2ND CREWS **6** ringed + "ABOUT" | meaningful, one unit (hours), **the hedge of the disputed claim (c6) is on screen** (fixes B1-1 #9). The 6 slams in while the camera is already in the room (legible at 1080p, `zoom/crop-s05-tv.png`, tiny on a phone); the note carries the source ASTRONOMY.COM again |
| **manual** (planned) | s09 38.88–44.26 | "exercise pushes back against the shrinking: two hours a day on a treadmill, a bike and a weights machine" | 2 HOURS A DAY; 1 ASTRONAUTS ~~REST~~ → red PUSH; 2–4 treadmill/bike/weights ticked on their words; FIG. 1 A WEIGHTS MACHINE | page slides in once over the boss (`enter: 'cut'`, no double slide ✓). **REST is invented** (the storyboard asked for "REST → PUSH"; the build wrote EXERCISE, the critic forced it back to PUSH; guard ⚠ "invented text REST"). **FIG. 1 = three star boxes on a shelf**: the figure only knows `cartridge/box/person/house`, so the film's `weightsMachine` sprite could not be shown (same decorative figure as B1-1 #14) |
| level-select | s02 6.61–10.87 | "the day is a run of levels: bedtime and breakfast are open, the strangest part waits locked at the end" | BEDTIME (house) → BREAKFAST (**a store icon**: closed icon set) → `?`; note ???/COMES LAST; dialogue "THE STRANGEST PART OF THE DAY COMES LAST." | good structure for a day; opens the loop, closed by the boss in s08 (the `?` hangs above the boss until BONE LOSS lands) |
| cartridge insert | s06 0–1.0 (+ transition `cartridge-in`) | "the sleep game is swapped for the breakfast game" | full-frame garbage 26.15–26.3, then a console close-up on **green shag carpet** with a **moon/night label** under the BREAKFAST tape, then cut to the bedroom console on **blue carpet** (`zoom/s05s06cart.png`) | **showcase leak in kit code**: `seams/console.ts` hard-codes the shag carpet and the label art, ignoring `interior()`; the transition and the scene's own insert both play (two inserts back to back, same look) |
| boss | s08 34.00–38.88, s10 | (boss card) | `?` over a black skeleton silhouette → BOSS 1 **BONE LOSS**, bar BONES; s10: astronaut lifts against it, bar dips and refills, NOT STOPPED | one boss = the central problem ✓ (fixes B1-1 #5); s08 opens with a full-frame cream flash at 34.2 and ~35.0 then 1.2 s of a dimmed silhouette (dark) |
| dialogue | s04 | – | Scott Kelly drifts up until his head meets the cushion; box SCOTT KELLY "HIS HEAD WAS VELCROED TO A CUSHION, JUST TO FEEL A PILLOW."; note JUST TO FEEL A PILLOW | the warmest beat; his words, his look from the asset |
| palette-shift (`moments.json`) | s08 36.94–37.44 | – | tint on "bones" | present |

**Never the same mechanism twice in the film: yes** (score table, manual, level select, cartridge, boss, dialogue
once each; the boss card twice for the same boss). **But across films:** the two planned breakthroughs are the
same two as the Y2K film (manual + score table); B1 has a small breakthrough menu. 4 s no-sound hold: no breach.

## 3. Hand, text and variety rules

- **Hand:** B1 has no drawing hand; the only hand is the cartridge grip (s06). Small labels type themselves
  (dialogue, odometer, PHONE BOOTH, MAGNETISED TRAY, SLEEP/EAT/PUSH BACK) ✓.
- **Text provenance:** from the narration/research: 16 SUNRISES, NASA.GOV, BEDTIME, BREAKFAST, PHONE BOOTH,
  SCOTT KELLY + his quote, SCHEDULE 8 / CREWS 6 / ABOUT, 100+ ITEMS, MENU, MAGNETISED TRAY, BONE LOSS, BONES,
  2 HOURS A DAY, the machines, NOT STOPPED, SLEEP / EAT / PUSH BACK. **Invented:** ZZZ (s01 note, guard ⚠),
  REST (s09, guard ⚠). Source credits are typed inside the TV picture (NASA.GOV, RMG.CO.UK, ASTRONOMY.COM) and twice
  on sticky notes.
- **Variety:** looks A B A A B B A C B C A — **two back-to-back repeats** (s03→s04 atari-story, s05→s06
  atari-menu). Different focal per shot: space + 16, level map, sleeping bag in a booth, Kelly + cushion, score
  table, food board + odometer, seated astronaut + tray, skeleton boss, cream manual, fight, loop + pull back. **Dark
  frames: 4 % of 4 fps samples with mean Y < 35** (B1-1: 29 %); means per shot 42–82, manual 175. "Number on black"
  focal in 3 of 11 (16, 100, 6) (B1-1: 10 of 12).
- **Continuity:** 1 link planned / 1 rendered (s05 ends on the console, s06 opens on it); 5 in-shot room ↔ TV
  pushes/pulls, all continuous; s11 loops the TV back to s01's station-and-stars picture (a real callback).
  Seams: s06 carpet mismatch (above); s08 `room-shake` from the kitchen into a TV-only shot = a jitter + cream flash
  (B1-1 #13 again).

## 4. Guards, critic, fix turns

- **Guard warnings (final):** s01 invented "ZZZ", s09 invented "REST", s06 "centred and symmetric (mirror 0.80)".
  `slopcheck.mjs` re-run: the same. Probes: label BREAKFAST → **E.T. caught as "unrequested showcase object"**;
  → 1982 / PITFALL, Kelly → DAD, note → WAREHOUSE caught as invented text; **passed**: SCHEDULE score 8 → 9 (small
  number). Offensive-terms guard: 0 hits in 11 scenes + script.
- **Critic (Haiku):** build QA 6 ✓ / 5 ⚠. s04 "smooth-shaded room interior" (**false**: the pull-back room is
  square-pixel art); s05 "locked rows not clearly visible" (partly true); s09 pushed REST→PUSH (made it worse,
  and misread WEIGHTS as HEIGHTS). **Final review: 0 suspects; the s04/s05 critic ⚠ were dropped silently** (B1-1
  #11 again). Missed: the cartridge carpet/label leak, the s08 cream flashes, the decorative FIG. 1.
- **Fix turns: 6, none ended with a question.** 4 were sfx sync (s02 blips, s04 whoosh, s10 pop, s11 hit — s02/s11
  delete kit cues again, B1-1 #10), s05 blank first frame + sfx, s09 the critic's wording.
- **Claims:** 12 claims, 11 sourced, 1 disputed: c6 "Crews average about six." flagged as unhedged although the
  script says "about" (false positive in the claims check; the scene kept ABOUT).

## 5. Quality (QUALITY.md §7, /20)

| Shot | Score | Note |
| --- | --- | --- |
| s01 | 16 | bedroom → TV push, ISS sprite + sun over Earth's edge, 16 SUNRISES; the sun only bobs, ZZZ invented |
| s02 | 15 | the day as levels, loop opened; store icon for breakfast, darkish |
| s03 | 15 | tethered green bag in a narrow booth, the tether snaps taut; the face is a brown bar, static |
| s04 | 17 | Kelly floats up to his cushion, his words; human and specific |
| s05 | 15 | score table with the hedge ABOUT 6; the slam lands in room view; source on the note |
| s06 | 13 | odometer 100+ ITEMS with food rows; cartridge seam garbage + shag/moon leak + double insert; centred |
| s07 | 17 | seated astronaut, belt clicks, food dots snap to the magnetised tray, pull to the kitchen — the most "this film" shot |
| s08 | 14 | the loop pays off as BONE LOSS; two cream flashes and a dim first second |
| s09 | 14 | the manual reads; invented REST, decorative FIG. 1 |
| s10 | 16 | astronaut lifts against the skeleton, bar dips/refills, NOT STOPPED |
| s11 | 16 | SLEEP / EAT / PUSH BACK with the film's sprites, pull back, TV loops to the start screen |

**Mean 15.3/20** (B1-1 15.0; showcase 17–19). One shot below 14 (s06).

## 6. Wall clock, turns, cost, export

`costUsd` = project ledger deltas (list-price meter, not a bill).

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 86 s | 3 Sonnet (research, script, repair) | 11.7 k | 0.42 |
| claims check | 6.7 s | 1 Sonnet | 0.8 k | 0.06 |
| voiceover / clean / words | 0.8 / 3.9 / 7.9 s | – | – | – |
| storyboard (+ tension) | 113 s | 3 Sonnet (tension, storyboard, repair) | 10.6 k | 0.39 |
| **world assets** | **432 s (7.2 min)** | **1 Opus (80 tool turns) + 1 Haiku critic** | **35.1 k** | **1.67** |
| scenes build | 1684 s (28.1 min) | 11 build + 6 fix (Opus), 12 critic (Haiku) | 195.8 k | 10.45 |
| final review | 85 s | 1 Haiku triage, no fix | 3.3 k | 0.04 |
| sound-cues / mix | 30 s / 7.1 s | 1 Sonnet | 1.6 k | 0.09 |
| export | 68.2 s (1516 frames, 2 workers, SwiftShader, 22.2 fps) | – | – | – |
| **Total** | **~42 min of stages** | **40 turns** | 259 k | **13.13** |

$1.19 per shot (B1-1 $0.94; the world-assets step is $0.15/shot of it). Scene CLI calls: 54 `frames`, 27 `lint`,
25 `anchors`, 29 `kit-docs` (3 × `world-assets`). Encoder `h264_nvenc` first try, 0 warnings. Mix −14 LUFS,
−2.03 dBTP; 34 sfx, `crt-hum`, lo-fi bed. Sync report 96 events: 86 ok, 10 free, 0 problems.

## 7. Failures and root causes

No crash, no page error, no frame timeout, no validator false error (storyboard warnings: s10 2.8 s shot,
tension tempo at the end).

| # | Sev | Defect | Root cause / suggested fix |
| --- | --- | --- | --- |
| 1 | high | console close-up (cartridge transition + `screen.cartridge`) shows the showcase's green shag carpet and moon label in a bedroom with blue carpet | `seams/console.ts` hard-codes `shag(...)` and the label art; take floor/colours from the active `interior()`, label art from a project sprite or blank |
| 2 | high | manual FIG. 1 and level-select icons are closed sets (`cartridge/box/person/house`, `home/store/lock…`) → decorative star boxes, a store for breakfast | let `figure.item`/`node.icon` take a project sprite id |
| 3 | medium | world-assets critic passes everything; thumbnails show dots | sheet thumbnails at ≤ 64 px are too small for size-2 sprites; ask the critic "name each thing" and compare with `cast.json` names |
| 4 | medium | empty `probe.json` left in `assets/game-b1/` and committed | the turn cannot delete; junk filter in the builder (in progress by the B2 coder) |
| 5 | medium | storyboard invents a correction word (REST); the critic enforces the storyboard over the guard | storyboard prompt: correction words come from the narration; critic must not ask for text the guard calls invented |
| 6 | medium | final review drops build-time critic ⚠ (s04, s05) | keep unresolved build ⚠ in the triage list (B1-1 #11) |
| 7 | medium | 4 of 6 fix turns are sfx sync, two delete kit cues | kit cues free unless anchored (B1-1 #10) |
| 8 | low | 10/28 assets unused; s06/s03/s07 re-drew what the set already had | scene prompt: "use the cast's ids for the shot (cast.json shots)"; lint hint when a scene defines a sprite named like a cast entry |
| 9 | low | `room-shake` into a TV-only shot; cream flash frames in s08 | B1-1 #13 |
| 10 | low | claims check flags "about six" as unhedged | claims prompt: "about/around" is a hedge |
| 11 | low | old driver manifests lack `worldAssets` (exports would ignore the set) | drivers fixed; any non-app export path should share the desktop manifest builder |

## Verdict: does the open vocabulary work for B1? **7/10**

Yes for the *what*: the world-assets step designed a cast, props, places and rooms that belong to this narration
(astronaut, sleeping bags, Scott Kelly, cushion, tray, ISS, treadmill, skeleton boss, bedroom with an ISS poster,
kitchen), with zero showcase objects, and the scenes built the film from them. The film no longer looks like the
Y2K film (dark frames 29 % → 4 %, number-on-black 10 → 3 shots). It loses points where the kit's own helpers are
still closed vocabulary (console close-up with the showcase carpet/label, manual figure shapes, level icons),
where the critic cannot tell recognisability, and because the breakthroughs repeat the same two B1 mechanisms
as the last film.

# Beta feedback list (3.x worlds)

Policy (Papi, 2026-10-07): ship each world as a beta; finish all worlds and all 3.0–3.3 features first, then fix by taste after hands-on use.
Source for the first entries: `docs/real-run-sketchbook-3.md` (defect table) and the follow-ups of the coders. Add Papi's own findings at the top.

## Sketchbook (beta)
- Camera `pushIn` is a no-op on sketch pages while prompts still ask for pushes (wasted turns) → page-level push or stop asking. (run 3 #3)
- Pop-up: opening hidden under a transition when `at ≤ 0`; pull tab travels only a few px; pulling hand rests 1.7 s. (#4)
- Gauges fill red by default → 4 red elements in one frame. (#5)
- Text guard lets small invented numbers through via the calculation rule (19/17/23 on a 21 card). (#6)
- Pop-up intent guard accepts ungrounded intents ("a pretty decoration"). (#8)
- Stagger variance flags pre-drawn marks (`at` < 0). (#9)
- Critic counts chrome (binding, paper, hand) as traces; misses ghost writing, reversed order, invented numbers, red overload, empty opening. (#10)
- First second of a hook can be near-empty (s01 2.7 s). (#11)
- A pages repeat the ground-line composition despite layouts. (#12)
- Pale ballpoint hero numbers on kraft/card (low contrast). (#13)
- `appear: 'bloom'` still sweeps left to right on big words (reads as writing). 
- Prompt wording still says "the hero mark keeps its time" (`packages/prompts/src/worlds/sketchbook.ts`, `sketchbook-snippets.ts`) — now: hero never displaces an earlier-timed task.
- Kit sketch-graph docs still show strip `end: 'now'`.
- Dedicated sketchbook sound recipes (pen click, marker thump, paper tear) instead of reused ones (needs `apps/desktop/src/shared/timeline-contract.ts`).
- Quality scores of real films: 16.6 / 16.8 / 16.25 of 20 (showcase 18–19).

## Infrastructure
- Engine `build-harness.ts`: write harness atomically (race when parallel scene turns rebuild it).
- Desktop autocommits (chat turns etc.) still use `add --all`; use `paths`.
- `scenes` contact sheet says "TIMED OUT" for a harness that did not start (needs separate flag).
- Remember an NVENC open failure per session so the next export skips the doomed GPU pass.
- `reelforge looks`, `lookSummaries` scope for experimental worlds, `templates/project/CLAUDE.md` voxel wording, prop builder in a world, asset-research wording ("photo on the CRT").
- Files over ~400 lines: `packages/prompts/src/validators/storyboard.ts` (482), `apps/desktop/src/main/main.ts` (656), `Workspace.tsx` (439), `styles.css`.
- Flaky: `apps/desktop live-direction.bench.test.ts` under load; own-assets smoke (retry diagnostics added).
- Research note about the 1949 fluorine test needs a human fact check; real films must be fact-checked before publishing.

## UI (light rebuild still open)
- U6 (status words polish), U8 dock, U10 library (taste/characters per world/channel instead), U11 export dialog v2, U12 copy pass (pattern interrupts / open loops wording), U13 pixel face for titles.
- Clicking Script/Voiceover/Words opens a document over the preview — judge if too much.
- Docked Sound panel is short at 720p.

## Comic (beta)
From [real run Comic 1](real-run-comic-1.md) (Piltdown Man, 61 s, mean 15.2/20; numbers = defect ids there).
- high: critic judges facts against the storyboard intent, not `research.md`; the fix turn flipped s07's research-correct fluorine gauges back to the storyboard's inverted ones and the shot passed ✓. (#1)
- high: a slur as onomatopoeia (CHINK) only gets an "invented text" ⚠; needs a denylist → error for all on-screen text. (#2)
- high: ruled but empty panels / blank hook for 0.6–3 s (s01, s03, s04, s08, s11). (#3)
- medium: page camera crops lettering (CHINK→NK, AY?, 953). (#4)
- medium: closed sound-word list → false "invented text" for LA LA LA, SKRRT, CLINK. (#5)
- medium: key objects unreadable (skull drawn as a potato / dark disc). (#6)
- medium: `sfx({ rise: 4 })` crashes at render, lint passes. (#7)
- medium: every scene turn rebuilds the harness from the whole kit; one half-written world breaks frames/anchors for all worlds. (#8)
- medium: invented quantities and dropped hedges ("MOST LIKELY" ~90 % bar, "40 YEARS" for "about forty"). (#9)
- low: layout presets used 0/13, 5 pages share one 2-panel grammar; two loud words at once; balloon tail at nobody; anchors resolve to the film's first occurrence; small W reads as N; letter-by-letter caption typing; false `transition-focus` warning for comic wipes; 61 MB MP4 for 61 s; script 22 % over target. (#10–#16)

## Game B2 (beta)
From [real run Game B2 1](real-run-game-b2-1.md) (Great Stink of London, 54 s, mean 14.8/20; numbers = defect ids there).
- high: unplanned breakthroughs at scene level (s03 built a `hud.tally` on a no-moment shot → 3 breakthroughs, tally twice); nothing flags it. (#1)
- high: dark, monotonous levels (brown brick boxes; automap 70 % black; tally on `backdrop: 'dark'`; last 13 s dark). (#2)
- high: level vocabulary too small for real topics (one clerk sprite for every person, cartridge `item` for every object, no water/river, ≤ 42 px labels). (#3)
- medium: shared-object link breaks between `view.present` and `view.hold` (item jumps, two hands); `map-unfold` grows the next shot's walk view, the automap unfolds later inside the shot. (#4, #5)
- medium: tally default `dissolve` exit blacks the whole frame with a live backdrop; `view.take` leaves the level sprite on the floor. (#6, #7)
- medium: 7 of 11 fix turns spent on lamp/`switchOn` click sync; critic false "clipped" on typewriter frames, misses blink/double sprite/broken link; invented meter counts and small tally values pass the text guard. (#8–#10)
- low: illegible wall signs; 8 HUD elements in one frame; per-shot chapter flags differ; throw as decoration; zod-style `validate level` messages; one transient ffmpeg probe timeout in mix. (#11–#16)

## Game B1 (beta)
From [real run Game B1 1](real-run-game-b1-1.md) (Y2K bug, 56 s, mean 15.0/20; numbers = defect ids there).
- high: `g.sprite` / `g.playfield` draw only `'#'` bits and silently ignore `'1'`/`'X'`/arrays (doc never says `'#'`) → 0 sprites in the film, the 2600 flicker rule never runs, every figure is a `g.rect` block. (#1)
- high: calendar-zoom link = the transition's push + a crossfade into s08's own room view → two calendars ghosted 32.9–33.2. (#2)
- high: transitions hide or duplicate in-shot beats: attract-cycle hides the whole cartridge pull; page-slide slides a TV picture, then the manual slides again. (#3)
- medium: calendar `mark` max 28 (no 31 DEC); a second boss card for a question (FALSE ALARM? ×2); glass notes illegible while the camera is in the room; big number on black in 10/12 shots, 29 % near-black frames. (#4–#7)
- medium: locked score-table row prints its score; disputed $100B shown without its hedge; 4/7 fix turns on sfx sync (s10 deletes kit craft cues); critic misses the seams and flags beats before they happen. (#8–#11)
- low: BOSS label over the HUD year; room-shake between TV-only shots; decorative FIG. 1 and a source URL as Dad's margin note; no `$`/`=` glyphs; sound-cues turn swaps the world's `board-tap`; engine harness stale after `tsc -b`/`build:cli` and built from live `kit/src` (a parallel coder's uncommitted kit work leaked into the export). (#12–#17)

## Papi's verdict on the open-vocabulary test films (2026-10-07, after phase 3)
- **Game B1 (space station): "a tragedy".** Lost its whole style: it no longer reads as a 2D game (no game elements), it is very illogical, with constant zoom in/out onto the TV. The mockup had creative transitions, sensible scenes and rooms, nice animations and variety. => B1 must be rebuilt toward the mockup's grammar: 2D game playfields/levels/rooms as the main content, TV/console seam rare and purposeful, creative link transitions, variety. TOP PRIORITY of the next round.
- **Game B2 (forest): not bad, needs polish.** Script must be written differently for this world: B2 films will be "How <science/psychology/finance topic> works, explained as a game" — narration is written for the game framing (quests, levels, stats, bosses). => B2 needs a script/genre mode ("explained as a game"), not just visuals.
- **Comic (ocean): quite good**, somewhat oddly built in places; drawing is okay. General polish later.
- Sketchbook village (film 4): see docs/real-run-sketchbook-4.md.

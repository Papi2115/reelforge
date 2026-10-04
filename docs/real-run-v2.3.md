# Real run v2.3: every 2.1–2.3 switch on (release verification)

Date: 2026-10-04 · Claude Code CLI 2.1.287 on the user's subscription (Max) · Windows 11 · run by
the Coder through the stage code (`@reelforge/stages` API like `run-stage`, `maxFixIterations: 1`,
concurrency 2), not through the Electron UI. Method as in [real-run-v2.0.md](real-run-v2.0.md);
claims check, moment decision, export manifest and publish kit called the same functions the
desktop services call (`checkSources`, `proposeMoments`, `loadManifestAssets` +
`momentRenderEffects` + `withShotTension`, `buildPublishKit`). Project in a scratch folder with a
space in its path, from `templates/project`. Code: `phase-12/v2.0-looks` at 39074f9 (the fixes
below were applied during the run: the claims fix before the second claims check, the rest after
the export).

## What was run

| Item | Value |
| --- | --- |
| Brief | "The Apollo 11 guidance computer: how 4 KB of memory landed humans on the Moon", EN, target 2 min, style `voxel-pixel-crisp640` |
| Switches | `lookMode: mixed`, `ambientVariation`, `researchMode: allowlist` (`wikimedia`, `nasa`, real network), `tensionMap`, `beatSync`, `patternInterrupts`, `openLoops`, `revealMoments`, `repetitionControl` all `auto`; taste learning off (no profile passed) |
| Voice-over | SAPI "Microsoft David Desktop", rate +2, 2:19; whisper `large-v3-turbo-q5_0`, 90 % coverage |
| Export | 1080p30, `h264_nvenc`, 2 workers, SwiftShader frames; 138.73 s, AAC 48 kHz stereo, 155 MB (8.9 Mbit/s) |

Output: `C:\Users\galar\Desktop\ReelForge-test-films\v2.3-full-test.mp4`, `…-contact-sheet.png`
(mid-shot frames, 5x6), `…-transitions.png` (every non-cut transition at its midpoint) and the
publish kit next to them (`description.txt`, `chapters.txt`, `credits.txt`, `tags.txt`). No usage
limit was hit; the Bash guard blocked one `wc -w` in the script turn.

## Per stage: wall clock and usage

`costUsd` is the CLI's list-price meter (relative measure, not a bill).

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 153 s | 3 Sonnet (research, repair, script) | 18.6 k | 0.69 |
| claims check | 11 s + 19 s | 2 Sonnet (before / after the fix) | 4.9 k | 0.14 |
| voiceover / clean / words | 0.3 / 5.5 / 13.1 s | – | – | – |
| storyboard (+ tension, assets turn) | 252 s + 33 s | 4 Sonnet (tension, storyboard, repair, assets) | 35.0 k | 0.81 |
| scenes build | 4003 s | 47 build + 13 fix (Opus), 45 critic (Haiku) | 524 k | 32.25 |
| final review | ~20 min hung + 296 s | 1 Haiku triage, 11 fix (Opus) | 32 k | 1.70 |
| sound-cues / mix | 40 / 27 s | 1 Sonnet | 1.5 k | 0.41 |
| export | 360 s | – (4162 frames, ~11.9 fps) | – | – |
| **Run total** | ~2 h 10 min | 127 turns | 622 k | **36.79** |

Over the ~$35 budget by ~$1.8, so no shot was rebuilt with real Claude after the fixes. Scene
builds: 29 shots + 11 project props (4 from the storyboard: agc, dsky, ropeCore, lunarModule; 7
asked for by scenes: astronaut, radio, lmCabin, radarDish, lunarModuleIcon, missionConsole,
controlStick) + 7 rebuilds with them ≈ $1.15 per shot (2.0: $0.88). About $1.5 of the final
review went to fix turns that could not succeed (legibility false positive, below).

## Quality per feature

**Script + claims (12.18).** 322 words, 16 sources, both open loops and 4 surprise beats in
`beats.md`, the "4 KB = erasable memory, 72 KB rope" caveat handled correctly. The first claims
check left 12 of 28 claims unsourced and disputed "36,864 words" although research.md states all of
them with links: **bug, fixed** (only the first research line of each link reached the prompt).
After the fix: 31 of 32 sourced, the one left ("Armstrong asked Houston what it meant") really is
not in the research.

**Looks.** All 7 used: voxel 19, flat-2d 4, retro-ui 2, blueprint, diorama, whiteboard,
paper-cutout 1 each; rolls A 15, B 8, C 6. Good: flat-2d ("WHY NO CRASH?", WORK/MEMORY bars with
an OVERLOAD stamp, "GO!" stamp), whiteboard (1 module → 8 weeks → 6 modules drawn by the hand),
paper-cutout (the real Tranquility Base photo dealt on a paper stack), diorama (Raytheon floor,
though a generic office rather than rope weaving). Weak: blueprint s07 is half empty (a big
hatched "rope memory" block, a tiny RAM box); retro-ui s13 garbles the highlighted "VERB" glyphs
over a mostly empty screen; s21 (memo) clips "MISSION RULES" at the top edge; voxel s25 crops
"600 FT" to "..600..F"; s08's dolly zoom is an unreadable close-up; s17 is floating cubes. The
"agc" project prop reads as a desktop computer with a screen, not the flat AGC box.

**Assets (12.9–12.11, allowlist).** 5 needs, 3 fetched, all Wikimedia public domain, verified
(the NASA source answered other queries but had no hit for the DSKY query); nothing fitting for
Raytheon's weavers or Garman's sheet, so those shots stayed kit-only (good restraint). Embedding:
s26 (paper stack) reads well; s06 and s12 show the photo as a 48-px polaroid in a wide voxel shot
(an unreadable thumbnail). Credits: 3 assets, no unverified, but the authors print as Commons gives
them ("Unknown author Unknown author or not provided").

**Tension map (12.22).** Claude's curve 0.15–1.0 with labelled segments. Tempo follows it:
10.6 shots/min calm (0.33) → 14.9 rising → 16.6 turn (0.75) → 18.5 peak (0.84) → 10.5 release,
mean-length ratios 0.87–1.18 of the target. Music: calm-tech + tense-investigation beds. Darkness
does **not** visibly follow: mean luma of tense voxel shots (≥ 0.65) is ~52 vs ~46 for calm ones,
because scene content (lit rooms, the Moon's surface) outweighs the darker background tones.

**Pattern interrupts (12.25).** Planned 4 (range 2–5), realised 4: dolly zoom s08, `crt-zoom` s13,
orbit + rack focus s17, `pixel-sort-melt` look switch s26 (1.7/min). The look switch into the paper
photo and the crt-zoom work; the two camera interrupts are technically there but weak shots.

**Open loops (12.26).** 2 opened, 2 closed with foreshadows, 0 warnings. No veils planned
(`veil: false` on both), so the reveal templates were not exercised.

**Reveal moments (12.27).** One proposal (peak 1.0 on "landed"), accepted: slow motion
123.79–125.79 s. The dust settles slowly around the LM, no artefacts; sync report unchanged.

**Transitions.** Claude wrote 24 non-cut transitions for 28 cuts (one every 5.8 s; 2.0: 5 in
137 s) although the prompt says "mostly cut". Each renders cleanly, but together they blur the
edit. **Fixed** (validator + prompt budget). Knock-on effects: 19 `act-change-roll` warnings, 3
transition repetitions, 10 chapters.

**Beat sync (12.21).** Cuts 28/28 on the grid (all already on accents, 0 nudges). Whooshes 6/10
within ±120 ms → report `ok: false`: none of the 10 sits at a cut; they are scene `sfx.at` accents
on words and Claude-mode cues, which are never beat-snapped (`cues.snapped: 0`). Follow-up.

**Repetition (12.23).** 5 open, all sensible: 3 transition repeats (mosaic-reveal twice in 20 s,
twice; pixel-sort-melt twice) and 2 whoosh triples, each with a concrete replacement.

**Publish kit (12.17).** Valid for YouTube but 10 chapters in 2:18 (every mixed-look cut counts as
an act change) — **fixed**: 4 chapters (0:00, 0:41, 1:28, 1:48). Titles come from visual intents
("Cold open in a dark", "Surprise"): follow-up.

**Sync / mix.** `reelforge anchors`: 197 ok, 15 info, 0 miss. Mix QA all pass: −14.0 LUFS,
−1.9 dBTP, ducking 14.0 dB, voice over music 31.5 dB, music < 120 Hz 0.5 %, 21.1 sound
moments/min.

**Scene QA.** 27 ✓ 2 ⚠ after the build. The Haiku critic called s11's planned "SOURCE: RIGHTO.COM"
chip a watermark (**fixed**). The final review hung for ~20 min: the dev harness's Playwright
renderer never returned one QA render (no timeout); killed and re-run with the critic off. Its fix
turns for "secondary line of a lower third" could not succeed: Claude dropped the line
(`lowerThird("NEIL ARMSTRONG", null, …)`) and the static check still flagged it (**fixed**).

**Verdict:** watchable and the most "channel-like" ReelForge film so far: a real story with an
open question paid off twice, a clear tension arc in the edit, a slow-motion landing, real
photos and sourced facts. Weakest: the transition flood, unreadable photo thumbnails in voxel
shots, a few crops (s21, s25) and weak camera-interrupt shots (s08, s17).

## Found and fixed (with tests)

1. **Claims check saw one line per link** (`researchSourceExcerpts` in
   `packages/shared/src/claims-ops.ts`; `claimsPromptVars` lists every line citing a source, capped
   at 3,000 chars; `claims` prompt v2). Real re-run: 15/12/1 → 31/1/0 sourced/unsourced/disputed.
2. **Legibility false positive** on `lowerThird(primary, null|undefined|'', …)`
   (`packages/stages/src/scenes/source-checks.ts`).
3. **Transition flood**: rule `transition-density` (mixed, ≥ 2 looks; error above
   `max(3, ceil(duration / 20 s))` non-cut transitions, `packages/prompts/src/validators/rhythm.ts`)
   and the budget in the storyboard prompt (`{{#maxTransitions}}`, v10). This film's storyboard
   fails it (24 > 7); the 2.0 film passes (5).
4. **Chapter count**: the best split within target ±1 chapters (≈ 1/min, min 3)
   (`packages/pipeline/src/publish/chapter-plan.ts`).
5. **Critic and source chips**: the critic prompt (v4) is told when the plan has a chip.
6. **Runtime docs**: template CLAUDE.md lists all 7 looks and the paper-cutout photo slot;
   `kit-docs assets` adds `paperStack`, says which boards have no photo slot and asks for photos
   at ≥ 1/3 of the frame height (96–128 px) when they are the evidence.

Not verified with real Claude (budget): fixes 3, 5, 6 (2 and 4 are deterministic).

## Remaining (backlog candidates)

- Dev harness renderer (`PlaywrightFrameRenderer`, CLI `frames`) has no per-frame timeout: one QA
  render hung the final review; 8 `reelforge frames/anchors/prop-preview` processes from Claude's
  Bash calls were left running for hours (4 from the 2.0 run). Check whether the app's render
  service can hang the same way; add timeouts and kill the process tree.
- Beat sync: Claude-mode sound cues are never snapped; the whoosh metric counts word-synced scene
  accents. Either snap Claude's cue file too or exclude scene `sfx.at` cues from the metric.
- Tension → darkness is invisible in voxel scenes with lit content; scenes ignore
  `ctx.ambient.tension` beyond the background.
- Chapter titles from the narration at the chapter start (needs words in the publish service).
- Commons author strings ("Unknown author Unknown author or not provided") in credits.
- Props on demand: 11 props + 7 rebuilds ≈ 35 % of the scene budget.
- Retro-ui text crops/garbling (s13, s21) persist from 2.0.

## No harm

Voxel-only fixtures (`packages/prompts/src/fixtures/*-voxel-only.txt`, `script-dramaturgy-off.txt`)
unchanged and their tests green: the new prompt text sits in `{{#multiLook}}` / `{{#lookId}}`
sections, the new rule runs only with two or more looks. No engine, kit or render code changed.
The chapter plan change keeps the 5-minute example at 6 chapters (existing test).

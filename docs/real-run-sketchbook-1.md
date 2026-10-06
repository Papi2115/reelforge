# Real run Sketchbook 1: the first world film on a random topic (PLAN.md#13.10, round 1)

Date: 2026-10-06 · Claude Code CLI 2.1.287 on the user's subscription (Max) · Windows 11 · run by
the Coder through the stage code (`@reelforge/stages` API like `run-stage`, `maxFixIterations: 1`,
concurrency 2, `StageSettings.experimentalWorlds = true`), not through the Electron UI. Method as in
[real-run-v2.3.md](real-run-v2.3.md); claims check, moment decision, export manifest and publish kit
called the same functions the desktop services call (`checkSources`, `proposeMoments`,
`loadManifestAssets` + `momentRenderEffects` + `withShotTension`, `buildPublishKit`). The `reelforge`
launchers got `REELFORGE_EXPERIMENTAL_WORLDS=1` (as the app's `cliShimEnv(true)`). Project created
with `createProject({ style: 'sketchbook' })` in a folder with a space in its path, outside the repo.
Code: `phase-13/v3.0` at 3e0a66a, **no code changed**. Driver: `scratch/real-run-sketchbook-1/drive.mjs`
(gitignored).

## What was run

| Item | Value |
| --- | --- |
| Brief | "The Great Emu War of Australia, 1932: how soldiers with machine guns lost to birds", EN, target 2.5 min, tone "pop-history, a bit comic", notes "mark uncertain facts; no precise numbers without hedging" |
| Project | world defaults (`lookMode: mixed`, `continuityLinks`, `antiSlopGuards`, `characters: classic`, `mascot: none`), `researchMode: off`, `tensionMap` / `beatSync` / `patternInterrupts` / `openLoops` / `revealMoments` / `repetitionControl` all `auto`, `ambientVariation` (template) |
| Voice-over | SAPI "Microsoft David Desktop", rate +2, 2:36; whisper `large-v3-turbo-q5_0`, 95 % coverage |
| Export | 1080p30, **libx264** (NVENC failed, below), 2 workers, SwiftShader frames; 155.40 s, H.264 + AAC 48 kHz stereo, 35 MB (1.8 Mbit/s), decodes cleanly end to end |

Output: `C:\Users\galar\Desktop\ReelForge-test-films\sketchbook-test-1.mp4`,
`…-contact-sheet.png` (mid-shot frames, 5x6), `…-transitions.png` (every non-cut transition at
p = 0.25/0.5/0.75) and the publish kit in `…\sketchbook-test-1-publish\`. Project:
`…\sketchbook-test-1 work\Emu War\`. No usage limit was hit (every turn reported `allowed_warning`,
`limitHits: 0`); no stage hung; no `reelforge`/headless processes were left behind.

`researchMode: off` only governs assets: the Script stage's research turn always has WebSearch/WebFetch
(`WEB_STAGES`), so research.md has real sources (Wikipedia, Australian Geographic, Mental Floss).

## Per stage: wall clock and usage

`costUsd` from the project ledger (`.reelforge/usage.json`, per-turn deltas; the CLI's result
`costUsd` is cumulative over a resumed session). List-price meter, not a bill.

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 78 s | 2 Sonnet (no repair) | 10 k | 0.30 |
| claims check | 13 s | 1 Sonnet | 2 k | 0.08 |
| voiceover / clean / words | 0.8 / 5.9 / 12.4 s | – | – | – |
| storyboard (+ tension) | 179 s | 3 Sonnet (tension, storyboard, repair) | 24 k | 0.55 |
| scenes build | 3196 s (53 min) | 29 build + 6 fix (Opus), 31 critic (Haiku) | 471 k | 24.97 |
| final review | 102 s (+ 103 s re-run to log the reply) | 1 Haiku triage each | 2–4 k | 0.04 (+0.04) |
| sound-cues / mix | 81 / 23 s | 1 Sonnet | 6 k | 0.17 |
| export | 281 s (4662 frames, ~17 fps) + 2 failed tries (15 s, 72 s) | – | – | – |
| **Run total** | ~70 min | 75 turns | 519 k | **26.15** |

$0.86 per shot (2.3: $1.15, 2.0: $0.88): no project props or roles (the world draws everything,
`missingProps` never listed, no `MISSING:` line) and only 6 fix turns. Claude's tool use in scene
turns: 393 Bash (150 `reelforge frames`, 75 `anchors`, 45 `kit-docs sketchPage`, lint), 443 Read,
275 Edit; 1 denied Write, 0 Bash guard blocks.

## Script and claims

426 words (2:50 at 150 wpm, 2:36 read at rate +2). Hedging is good and natural: "around twenty
thousand emus, and that is only an estimate", "Reportedly", "about fifty … a dozen or so",
"Estimates … range from about fifty to a couple of hundred, and sources disagree", "by his own
count", "Historians doubt his extra claims". Two open loops (medals, what worked), both closed.
Claims check: 40 claims, 37 sourced, 0 unsourced, 3 disputed — all three correct and useful (kill
range 50–200 vs ~500, the medal quip attributed to A.E. Green vs Rowley James). **Gap:** beats.md's
"surprise beats" are written for voxel ("dolly zoom", "camera orbits", "look-switch from voxel into
a retro-ui screen"): the research/script prompts are not world-aware. The storyboard ignored them
(it used page-native look switches), so no harm here.

## Storyboard

29 shots for 2:35 (avg 5.4 s, 11.2/min); rolls A 15, B 7, C 7; looks sketch-story 15, sketch-graph
7, sketch-loud 7. One repair turn. Warnings: 10 annotations trimmed, 4 `act-change-roll` (page-native
transitions on A/B shots although the world prompt says "open each act with a C-roll page"), 2
`transition-focus` on continuity styles (a `focus` field the validator says only enter-/dive- styles
use), `continuity-spacing` (links 27 s apart), `annotation-variety`. 18 `source-chip` annotations
(one per claim) — every scene wrote them as tiny pencil "en.wikipedia.org" scrawls (unreadable at
phone size, harmless).

**Breakthrough scenes: not used.** No intent asked for a pop-up or the accordion strip and no scene
called `page.popup` / `page.strip`, although s22 ("a calendar strip from 13 NOV to 10 DEC") and the
timeline of the second campaign were natural strip moments. The storyboard prompt does not mention
the breakthrough scenes at all; they live only in the look docs that the scene turn reads.

## Continuity links, transitions, dramaturgy

- **Continuity:** 2 planned, 2 rendered (final review: "2 links planned, 2 rendered"). s23 → s24
  `continuity-shared-object` (the 9,860 / 986 pair carries over, the ballpoint then works the
  division to a red 10): reads as a true match cut. s28 → s29 `continuity-zoom-through` on the fence
  (blue ballpoint fence on graph paper → felt-tip fence on the final page): clean and the best cut
  of the film.
- **Transitions:** 8 non-cut in 155 s (budget `max(3, ceil(155/20))` = 8, exactly at the limit):
  page-flip ×2 (s05, s18), riffle (s09), torn-strip (s13), tape-peel (s22), crumple-toss (s26) + the
  2 links. All render cleanly and read as the notebook; crumple-toss and tape-peel are the strongest.
- **Pattern interrupts:** 4 planned / 4 realised, all `look-switch` through a page-native
  transition (1.5/min).
- **Tension:** Claude's curve 0.15–0.85 with labelled segments; peaks are C-roll pages (s15, s23).
- **Reveal moments:** 1 proposal (peak 0.85 on "split", s15), accepted: slow motion 78.74–79.89 s.
  Its `cameraHint` says "a slow orbit around the key object" — an orbit is forbidden in this world.
- **Beat sync:** cuts 28/28 on the grid, 0 nudges, no whooshes (none in the world palette), `ok`.
- **Repetition:** 15 open. The 7 SFX ones are sensible (paper-pop/pencil-scratch runs). The 8
  "visual" ones are noise in a world: the signature is `look · treatment · kit defs` and every shot
  uses `fx.sketchPage`, so any two A-roll character pages within 40 s "repeat".
- **Sound:** sketchbook palette used (pencil-scratch, paper-pop, tape-tear, paper-rustle); 47 sfx,
  1 ambience; music moods `calm-tech, retro-wave, calm-tech` — synth moods in a paper notebook film.
  Mix QA pass: −14.0 LUFS, −1.97 dBTP, ducking 14.6 dB, speech margin 39 dB.

## Anti-slop guards: 0 ⚠ in 29 shots

No guard fired in any QA round or in the final review (same-composition included). Verified that
they really ran: `loadAntiSlop` on this project returns a setup, `slopSourceFindings` on all 29
built scenes gives 0 findings, and the same s22 source with one string changed to
`"ZORBLAX 4,321"` is flagged ("invented text"). So these are true negatives by the guards' own
rules, but the rules miss things a person sees:

| What I see | Guard result | Verdict |
| --- | --- | --- |
| s21 sticky notes "EMUS 1 / ARMY 0" (a scoreline the narration never says) | no ⚠ (EMUS, ARMY in the script; 0 and 1 are free numbers) | false negative (minor, it is a joke on the quip) |
| Red ink used for non-corrections: s02 arc around the birds, s12 film-strip zigzag, s11 dart arrow | no ⚠ (accent share far under 12 %) | false negative: the guard measures area, not meaning |
| Hand parked over the subject at the shot's last frame (s09, s16, s19, s25; mid-shot s03, s05, s10, s14) | not a guard | gap (see findings) |
| s23 centred pair 9,860 / 986 | symmetry guard silent (two stacked numbers are not mirror-similar enough) | the critic caught it instead |
| Human traces | every scene ≥ 3 (Claude writes the `// focal: … | traces: …` comment and uses `tape`, `coffeeRing`, `loop`, `crossOut`, `rot`, `tool: 'red'`) | true negative |

## Critic

28 ✓, 1 ⚠ after the build (6 shots needed one fix turn). The Haiku critic names a focal point and
traces in every note, but it counts the world's chrome as traces ("spiral binding", "lined paper",
"visible pen hand", "paper grain") and passed every shot where the hand covers the subject or red
is used decoratively. s23 ⚠: "blank: setup only, no text yet" is a **false positive** (a shot that
opens on an empty page and is drawn live is this world's grammar); "two numbers violate the
single-number rule" and "centred layout" are **true positives** — but the storyboard intent asked
for "two huge marker numbers … ends on the pair centred", so the storyboard and the sketch-loud look
rules contradict each other. Final review triage: Haiku answered ```` ```json {"suspects":[]} ```` ````
followed by a prose paragraph; `validateTriageReply` rejected it ("the triage reply was not valid
JSON; only the code checks were used"), in both runs. Harmless this time (no suspects), but any real
suspect would be dropped.

## Quality review (QUALITY.md §7, my scores from the MP4 frames)

Scored 0–2 on focal · hierarchy · asymmetry · specificity · traces · motion · palette · text ·
signature · ship, from mid-shot, end-of-shot and start-of-shot frames and the full-size frames of
s14, s15, s16, s19, s28, s29.

| Shot | Score | Note |
| --- | --- | --- |
| s01 hook | 18 | huge 1932, ARMY + red WAR, underline; strong opener |
| s02 army | 14 | tiny figures in a big empty page; red arc round the birds is decoration |
| s03 medals | 14 | hand over the medal mid-shot; "?" medal reads at the end |
| s04 not a gun | 19 | GUN crossed out in red, the best loud page |
| s05 veterans | 17 | rough WA map, POOR in red; hand over the figures at the end |
| s06 depression | 17 | wheat-price cliff + COLLAPSED; curve has no values (shape only) |
| s07 20,000 | 19 | ~20,000 + red ESTIMATE: hedging made visible |
| s08 crops/fences | 17 | emus in the orange wheat, flattened fence looped in red; busy but clear |
| s09 request | 14 | hand covers GUNS and PEARCE is faint pencil |
| s10 conditions | 18 | index card with clip, red loop on STATE PAYS FOR TRIP; small text |
| s11 target practice | 14 | REPORTEDLY is a faint tiny pencil word; small figures |
| s12 cameraman | 15 | red film-strip zigzag (red off the point) |
| s13 2 NOV | 18 | marker date, 10,000 boxed |
| s14 day one | 19 | ~50 crude emus, a dozen red crosses — charming, exactly the world |
| s15 scatter | **12** | emus run off, ~1 s of near-empty page, then a crossed gun; the flipbook is a barely visible thumb in the corner (fail) |
| s16 truck | 15 | "NOT" + caret collides with KEEP UP and the hand sits on KEEP until the cut |
| s17 guerrilla | 19 | emu in a beret, GUERRILLA bubble — funny and specific |
| s18 rounds gone | 17 | tally + ABOUT 2,500 GONE; highlighter over the number hurts it |
| s19 dead range | 18 | 50–200 bar, both sources labelled; hand over the red "?" and EMUS |
| s20 pulled out | 15 | tiny figures, parliament sketch |
| s21 medals closed | 15 | medal EMUS works; invented scoreline sticky notes |
| s22 army back | 17 | calendar strip, red loop 13 NOV; the EMUS/ARMY tally box stays empty |
| s23 numbers | 14 | centred pair; ROUNDS label touches 9,860 |
| s24 ten per bird | 19 | continuity in, red =10, DOUBTED (two red items, but both are the point) |
| s25 any army | 14 | hand over the speech bubble; globe + tiny army |
| s26 boring | 19 | WHAT DID WORK? + circled BORING; "NEVER WENT BACK" tiny in the bottom 12 % |
| s27 refused | 15 | tiny figures, much empty paper |
| s28 bounty/fences | 19 | 57,034 in red, 1934 circled, "6 MONTHS?" pencil doubt, fence |
| s29 answer | 19 | lone emu circled, bounty + fence, MACHINE GUNS crossed out — a good last frame |

Mean **16.6/20**; 1 fail (s15), 6 at the 14 line. Showcase (sketchbook-v2) shots score 18–19. The
best third of this film (s04, s07, s14, s17, s24, s26, s28, s29) is at showcase level: crude stick
emus, red corrections on the point, real hedged numbers, page-native cuts. The deliberate
roughness is preserved everywhere (wobbly figures, uneven lettering, crooked tape) — it is the
film's charm, not a flaw. What separates the rest from the showcase:

- **Scale:** figures and props are often ~1/4–1/3 of the page height in the lower half with a large
  empty top (s02, s11, s20, s27). The showcase fills its page with one idea at a readable size.
- **The hand:** it often stays over the subject when the shot ends (s09, s16, s19, s25) or mid-shot
  (s03, s05, s10, s14). DECISIONS.md already lists "add a hand-rests-here rule"; the docs say
  "the hand clear of the subject" but nothing enforces it.
- **Red discipline:** mostly right (WAR, GUN, ESTIMATE, COLLAPSED, 10, DOUBTED, REFUSED), broken in
  s02, s11, s12.
- **Text:** every word comes from the narration or research (except the s21 scoreline);
  legibility suffers from faint pencil labels and the source-chip scrawls; ROUNDS/BIRDS labels are
  small and touch the numbers.
- **Rhythm:** good — drawn live, fast-fast-pause, about a third of the shots open on an empty page,
  the rest on a pre-drawn page; 2 match cuts carry the end of the film.

## Problems found (none fixed: no code changed in this run)

| # | Severity | Problem | Suggested fix |
| --- | --- | --- | --- |
| 1 | high | `reelforge validate` reports `project.json style: unknown style preset "sketchbook"` as an **error** even with `REELFORGE_EXPERIMENTAL_WORLDS=1` (`packages/cli/src/project/checks.ts` `styleProblems` checks only `STYLE_PRESET_IDS`). The sound-cues turn saw it ("still reports the unrelated project.json style error"); a turn could try to "fix" project.json (it may Edit `./**`). | accept world styles in scope (`STYLE_REGISTRY` all ids when the env switch is on) + test |
| 2 | medium | Final review triage: fenced JSON followed by prose is rejected (`validateTriageReply` → `parseJsonText`), so Haiku suspects are silently dropped. Happened in 2/2 runs. | extract the first fenced/balanced JSON object like the critic parser does, or tighten the triage prompt ("JSON only") + fixture test |
| 3 | medium | The hand ends shots parked over the subject; neither guard nor critic checks it. | a frame guard (hand mask vs. the focal drawing's bbox in the last QA frame) and/or `page` auto-retracts the hand after the last stroke + a critic checklist line "the hand covers …" |
| 4 | medium | Breakthrough scenes never used in a 2.5 min film (the world's selling point). | storyboard world vars: offer `breakthrough: popup | strip` (≤ 1 per 60–90 s) and pass it to the scene prompt |
| 5 | medium | Export: `detectEncoder` probes NVENC OK, then the real session fails `InitializeEncoder failed: out of memory` (GPU busy, 5.6/6.1 GB used) and the export fails instead of falling back to libx264. | on an encoder-open failure of a GPU encoder retry the segment with libx264 (warn) |
| 6 | low | First libx264 export attempt: "frame renderer did not answer (t=23.533) within 60000 ms" with 2 SwiftShader workers on a loaded PC; the same frame renders in 115 ms alone; the retry passed (segments resumed). | retry a timed-out frame once on a fresh page (QA already does) |
| 7 | low | Storyboard intent vs look rules: s23 asks for two centred numbers on a sketch-loud page; the critic then flags it. | storyboard world text: "C page = one number/word; pairs go to B" |
| 8 | low | Repetition "visual" signature treats `fx.sketchPage` as content: 8 noise findings per world film. | drop the world's page fx from the signature (or compare look + treatment + layout hash) |
| 9 | low | Critic counts world chrome as human traces; never flags red misuse or the hand. | world checklist: "the spiral, paper, page number and the hand do not count as traces" |
| 10 | low | Script prompt's surprise beats are voxel-specific in a world project; music moods (retro-wave) ignore the world; reveal-moment `cameraHint` suggests an orbit the world forbids. | world wording in script/beats, a world mood list, no orbit hint for worlds |
| 11 | low | Chapter titles from the narration are weak ("Australian Army Went", "Starts"). Already a 2.3 follow-up. | – |

## Not verified

The Electron app path (preview, render service, GPU frames), NVENC output, a pop-up/strip from a
real scene turn, the tags file (the dev driver passed no fallback tags, so `tags.txt` is empty —
the app adds its template tags), ambient variation's visual effect in this world.

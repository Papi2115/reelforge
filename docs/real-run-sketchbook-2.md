# Real run Sketchbook 2: a short film aimed at pop-ups, variety and the hand (PLAN.md#13.10, round 2)

Date: 2026-10-06/07 · Claude Code CLI 2.1.288 on the user's subscription · Windows 11, PC under load
(a game was running: whisper's CUDA run and SwiftShader frames show it) · run by the Coder through
the stage code, like [round 1](real-run-sketchbook-1.md): `StageRunner` with
`experimentalWorlds: true`, **`worldQuotaOverride: { minBreakthroughs: 2 }` (test only)**,
`maxFixIterations: 1`, concurrency 2; `checkSources`, `proposeMoments` (all accepted),
`exportVideo` and `buildPublishKit` as the desktop services call them. Code: `phase-13/v3.0` at
dbe24b3, **no code changed**. Driver: `scratch/real-run-sketchbook-2/` (gitignored; `drive.mjs`,
`synth.ps1`, `sheets.mjs`, `strips.mjs`, `slopcheck.mjs`).

Output: `C:\Users\galar\Desktop\ReelForge-test-films\sketchbook-test-2.mp4` (58.6 s, 1080p30,
H.264 NVENC + AAC 48 kHz stereo, 15.7 MB, decodes cleanly), `…-contact-sheet.png`,
`…-transitions.png`, publish kit `…\sketchbook-test-2-publish\`; project
`…\sketchbook-test-2 work\Dancing Plague\`. Per-shot 8-frame strips (6 shares of the shot + t1−0.4 s
+ t1−0.05 s) in `scratch/real-run-sketchbook-2/strips/` — every claim below was checked on them.

## Answers to the mandatory checks

### 1. Page moments in the final frames

| Moment | Shot | Time in film | Planned (`worldMoment`) | In the frames |
| --- | --- | --- | --- | --- |
| **pop-up** (`page.popup`) | s07_popup_stage | 32.63–36.95 (opens 33.4–34.1, pull 35.3–36.9) | yes | **yes**: a real kraft card stands up (BUILT/STAGES block, MUSICIANS and DANCED cut-outs, "more people" tag); see `frames/popup-35.0.png` |
| **strip** (`page.strip`) | s10_september | 46.61–49.97 (`at: −1.6`, dragging mostly before the cut) | yes | **yes**: pleat stack at the left, 2 panels (14 JULY · first dance → SEPTEMBER, red ENDED + ?), left hand drags it in the first ~0.4 s |
| torn-page (`torn: true` + torn-strip) | s12_nobody_knows | 54.31–58.61 | yes | yes: torn-strip transition, paper stubs in the spiral (`frames/spirals.png`) |
| sticky-slap (`sheet paper: 'sticky'`) | s05_why_dance | ~25.5 | no (scene's own idea) | yes: a sticky note slapped over WHY? on "Hold that thought", red CURE? on it |
| index card (`sheet`) | s09_fifteen_a_day | 42.11–46.61 | no | yes (card with clip; not the envelope moment) |
| taped scraps (3 × `sheet`) | s11_best_guess | 49.97–54.31 | no | yes (bowl / sick bed / scared saint) |
| flipbook, envelope, ruler-graph | – | – | – | not used |

Both breakthroughs are in the film (round 1: none). The storyboard placed them on the right looks
(pop-up on C `sketch-loud`, strip on B `sketch-graph`) and on the right words.

### 2. Variety

| Shot | t0–t1 | Roll / look | Treatment | Moment | Transition in |
| --- | --- | --- | --- | --- | --- |
| s01 july_1518 | 0.00–6.59 | C loud | title-card | – | cut |
| s02 troffea | 6.59–12.65 | A story | character-scene | – | cut |
| s03 four_hundred | 12.65–18.23 | B graph | counter/odometer | – | cut |
| s04 bleeding_feet | 18.23–21.99 | A story | character-scene | – | cut |
| s05 why_dance | 21.99–28.05 | C loud | kinetic-text | (sticky) | cut |
| s06 blood | 28.05–32.63 | A story | metaphor-object | (slow-motion reveal 28.89–30.38) | cut |
| s07 popup_stage | 32.63–36.95 | C loud | montage/transition | **popup** | page-flip |
| s08 shrine | 36.95–42.11 | A story | character-scene | – | cut |
| s09 fifteen_a_day | 42.11–46.61 | B graph | counter/odometer | (card) | crumple-toss |
| s10 september | 46.61–49.97 | B graph | node-graph/timeline | **strip** | cut |
| s11 best_guess | 49.97–54.31 | A story | metaphor-object | (scraps) | cut |
| s12 nobody_knows | 54.31–58.61 | C loud | kinetic-text | **torn-page** | torn-strip |

Looks never run longer than 2 (one B-B pair). 7 treatments in 12 shots, 3 distinct non-cut
transitions, 2 look-switch interrupts realised. **Repeated compositions:** the four A pages (s02,
s04, s06, s08) share one grammar — stick figures on a ground line in the lower half, empty upper
third; s03 and s09 both put a yellow highlighter bar *through the middle* of a number on graph paper
(reads as a strike-through twice); s05 and s11 both open on "WHY?" top-left (s11 on purpose:
it closes the loop).

### 3. The hand

- `duration: ctx.shot.duration` (as `shot.duration`) is passed in **12/12** scenes; `rest: 'off'`
  in 11/12.
- **Last 0.4 s:** no shot ends with the hand parked on the subject (round 1: 4 shots + 4 mid-shot).
  s03 is borderline: the hand draws the loop round 400 until t1−0.25 and is gone at t1−0.2; s09: the
  red pen stays at the card's bottom edge just under NO RECORD up to the cut (touching, not covering).
- **New dominant glitch: ink that writes itself while the one hand works elsewhere** (the
  `handDrawn` rule "a mark of another task that started meanwhile is drawn without the hand"):
  - s01 0.6–2.0 s: the hero "1518" (170 px marker) writes itself, no hand; the hand sits top-right
    finishing the pre-drawn `en.wikipedia.org` chip (`at: −1`, still running into the shot).
  - s03 15.3–16.8 s: red "AS MANY AS" writes itself while the hand draws the second figure — which
    was given `parallel: true` (it should have been the handless one). Then within 0.5 s the hand
    hops figure → highlighter → "4" → red text, and at 17.7→17.8 s it flips ~90° in one frame; the
    loop round 400 is drawn in 0.15 s while the pen tip sits on the middle 0.
  - s07: the red loop at the end appears without a hand; s08 38.8 s: second figure's head appears
    without the hand; s11 52.1 s: the bowl draws itself while the red pen writes BEST GUESS
    (Claude chose this, see its report).
  - s10 46.62 s: the dragging left hand and the pen hand overlap at the same spot (a tangle of two
    hands for ~0.3 s).
- **Simultaneous top + bottom drawing** happens in s01, s03, s11 — every time one of the two is
  the ghost-written one. It is readable but it looks like a glitch, not like a person drawing.

### 4. Guards and critic

- Guards: **1 ⚠** — s06 `invented text: "HOT"` ("HOT BLOOD" for the spoken "overheated blood").
  True positive by the rule, semantically harmless; the cause is that `page.write` was too slow to
  write OVERHEATED (Claude's own note). `slopSourceFindings` re-run on all 12 scenes: same single
  finding.
- **False negatives:** (a) s09 draws "/ DAY" and "NO RECORD" with a scene-local glyph table of
  strokes (`letter()`, 40 lines, "page.write was too slow for a 4.5 s shot") — invisible to text
  provenance: the same source with `"ZORBLAX 4,321"` passes clean, while a strip label `ZORBLAX`
  is caught. (b) s10's strip `end: "now"` prints "now" on a 1518 timeline (kit option, unchecked).
  (c) s07's swinging grey disc means nothing (forced by the kit, see defects).
- Critic (Haiku): 12 ✓ after build except **s08 `off-intent`: a false positive of our parser** —
  the note was `"Focal: shrine procession. Traces: visible hand, …"`; `CRAFT_NOTE` in
  `packages/prompts/src/validators/critic.ts:51` needs `;` or `|` between focal and traces, so a
  full stop turned a good note into `craft: no focal point…`. s01 note names the focal point as
  "JLY text" (misread; the focal is 1518). The critic still counts chrome as traces ("spiral
  binding", "grid paper", "visible hand", "paper folds") and flagged none of: ghost-writing, the
  meaningless pop-up disc, the highlighter-as-strike in s03/s09.
- Final review triage: Haiku again replied fenced JSON + prose; **this time accepted** (no "not
  valid JSON" warning): the round-1 fix works. Review fixed s09's sfx sync (1 Opus turn).

### 5. Continuity links

Planned **0**, rendered 0 (the prompt allows "at most 1", ~1 per 45 s; the storyboard chose none).
The world's signature cut is absent from this film. s11 → s12 would have been a natural
shared-object link (the scraps → the trance figure); s10 → s11 carries "WHY?" over by content only.

### 6. Quality (QUALITY.md §7), rhythm

| Shot | Score | Note |
| --- | --- | --- |
| s01 | 18 | huge 1518, red 14 + caret, STRASBOURG; 1518 ghost-written; label in the bottom 12 % |
| s02 | 18 | lone dancer, empty stool + crossed note = "no music" made visible; sparse top |
| s03 | 15 | 400 lands only in the last second; highlighter through 400 reads as a strike; hand hopping |
| s04 | 18 | big crude feet with red drops, a figure collapses; charming |
| s05 | 18 | WHY? → sticky note "hold that thought" → CURE?; three evenly spaced dancers |
| s06 | 17 | leader + CURE jar, red frowny on "worse" (slow-mo reveal); HOT caret |
| s07 | 16 | pop-up works as paper; but meaningless disc, URL note is the 2nd biggest text, card right, left 40 % empty |
| s08 | 17 | crossed drummer, dotted road to ST VITUS, 30 MILES (low); clear |
| s09 | 17 | 15/DAY struck, red NO RECORD; the 15 is faint |
| s10 | 14 | strip present but only 2 panels, "now" invented, two hands tangle, bottom half empty |
| s11 | 17 | WHY? crossed → BEST GUESS, three scraps in a bracket; scraps unlabelled |
| s12 | 17 | one swaying figure and a red ? on a torn page: eerie, deliberate emptiness |

**Mean 16.8/20** (round 1: 16.6; showcase 18–19). No fail, 1 at the line (s10). Deliberate
roughness is preserved everywhere (wobbly figures, crooked lettering, tape, coffee rings, crude
feet). Slop tells: §1.5 uniform spacing (s05 dancers), §1.2 decoration without meaning (s07
disc), §1.4 invented text ("now"). **Boring?** Less than round 1: something other than "pencil
draws on a page" happens in 6/12 shots (sticky, pop-up, card, strip, scraps, torn page), shots
average 4.9 s, a pause before each red correction. Near-empty page: at mid-shot only s12
(intended); opening near-empty: s07 (0.5 s), s11 (1.5 s, only WHY?), s12 — no plain page holds
longer than ~1.3 s (s02's end). What still drags: the four A pages look alike, and the pop-up's
real "wow" lasts 0.7 s (opening), then 2.8 s of a disc swinging.

### 7. Wall clock, turns, cost

`costUsd` = project ledger deltas (list-price meter, not a bill). Log times UTC.

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 75 s | 2 Sonnet | 8.7 k | 0.29 |
| claims check | 9 s | 1 Sonnet | 1.1 k | 0.06 |
| voiceover / clean / words | 0.6 / 3.1 / 112 s (CUDA error → CPU) | – | – | – |
| storyboard (+ tension) | 99 s | 2 Sonnet (no repair) | 11.9 k | 0.36 |
| scenes build | 1670 s (28 min) | 12 build + 2 fix (Opus), 12 critic (Haiku) | 224 k | 11.55 |
| final review | 130 s | 1 triage + 1 fix + 1 critic | 6.8 k | 0.24 |
| sound-cues / mix | 23 / 6 s | 1 Sonnet | 1.5 k | 0.10 |
| export | 114 s (1758 frames, NVENC opened first try, 0 warnings, SwiftShader) | – | – | – |
| **Total** | **~40 min** | **35 turns** | 254 k | **12.61** |

$0.96 per shot (round 1 $0.86). Scene turns: 78 `reelforge frames`, 54 `kit-docs`, 33 lint, 26
anchors, 192 Read, 124 Edit; s03 and s05 took 55–57 turns (5–6 min) each. No usage limit (every
turn `allowed_warning`, `limitHits: 0`), no hang, no frame-render timeout in export (s02's build turn
reported one out-of-memory render and one hung render inside `reelforge frames`, both retried by
Claude), no headless processes left behind.

## Top 5 findings

1. **The variety work landed:** pop-up, strip and torn page are all in the frames, on the right
   looks and words; looks alternate; 3 different page transitions; triage JSON fix works; no
   visual-repetition noise (6 SFX repetitions only).
2. **The hand no longer parks on the subject at the cut** (`duration` passed 12/12), but the
   one-hand queue now produces **ghost-writing** (hero marks writing themselves, s01/s03) and
   **hand hops** — the most visible remaining glitch.
3. **Time per shot is the real constraint:** hand lettering is too slow for 4–5 s shots, so Claude
   cut content (s08 notes, s10 third date, s06 OVERHEATED→HOT) or hand-rolled a stroke font (s09),
   which also bypasses the text guard.
4. **The pop-up API forces meaningless content:** the red pull needs a swinging arm, so a grey disc
   that "isn't in the narration" was added, and the red loop circles an empty notch; all elements
   rise at once (no per-element timing), so "musicians on musicians" could not be shown.
5. **Process trap:** `tsc -b` does not rebuild the `reelforge` CLI bundle
   (`packages/cli/dist/reelforge.mjs`, esbuild); it was stale (pre-fdb74c4), so the tension and
   storyboard turns again saw `unknown style preset "sketchbook"`. Rebuilt with
   `node packages/cli/scripts/build.mjs` before the scenes stage; validate then passes.

## Defects and suggested fixes

| # | Sev | Defect | Suggested fix |
| --- | --- | --- | --- |
| 1 | high | Ghost-writing: `handDrawn` gives the hand to the task that started first; a later, more important mark (s01 hero 1518) appears handless; `parallel: true` only affects queue slip, not `handDrawn` (s03: the parallel figure got the hand, the red hedge wrote itself) | in `handDrawn` never give the hand to `parallel` tasks; prefer the bigger/accent mark when two overlap; marks with `at < 0` must be done by t=0 (clamp, or handless) |
| 2 | high | Lettering too slow for 4–5 s shots → cut content, abbreviations, home-made stroke fonts | a faster `hand: 'marker'`/`print` speed or a `speed` option; scene prompt: "never draw letters as strokes; use page.write" + lint rule for glyph tables |
| 3 | medium | Text provenance blind to stroke-drawn text (s09 `letter()`) and to kit options like strip `end` ("now" on 1518) | flag scene-local glyph tables; check `end`/`band`/`tag` strings; strip `end` default should be off for history |
| 4 | medium | `popup` pull requires an `arm` with `swing`; red loop marks the empty notch; no per-element `at` | allow `pull` without an arm (loop the tab / a named element), per-element `at` (rise on the word), catalog example without the sun arm |
| 5 | medium | Critic craft parser rejects `Focal: X. Traces: …` (s08 false off-intent + a wasted fix turn) | accept `.`/newline as separator in `CRAFT_NOTE` + test |
| 6 | medium | CLI bundle not rebuilt by `tsc -b`; drivers/dev runs use a stale `reelforge` | build the bundle in `pnpm build`'s first step or make the shim warn when the bundle is older than `packages/*/src` |
| 7 | low | Critic counts chrome as traces, misses ghost-writing, highlighter-as-strike, meaningless parts | world critic checklist lines for these |
| 8 | low | 0 continuity links in a 59 s film (allowed, but the world's signature is missing) | for worlds, require 1 link when the film is ≥ 45 s and a natural pair exists, or let the validator suggest the pair |
| 9 | low | A pages repeat one composition (figures on a ground line, empty top) | storyboard world text: vary A layouts (close-up, top-down map, object large) |
| 10 | low | Reveal moment `cameraHint` still "slow orbit" in a world; `act-change-roll` warning on a B page-native transition | world-aware hint; skip the act-change rule for page-native transitions |
| 11 | low | Chapter "Anyone Dance" (weak title from narration); whisper CUDA fails when the GPU is busy (CPU fallback worked, 112 s) | known 2.3 follow-up; none for CUDA (fallback is correct) |

## Run notes

- Next real runs: `pnpm build:cli` after `tsc -b`, then `pnpm check:cli-bundle` before the first
  stage (defect 6; packages/cli/README.md).

- Voice: SAPI David, rate +2, lead 0.8 s, paragraph pause 0.6 s, tail 0.8 s (the round-1 pauses
  of 2.5 s gave 69 s for this 139-word script); 59.05 s, whisper coverage 90 %.
- Script: 139 words, hedged ("Some estimates say as many as four hundred", "Fifteen deaths a day is
  often claimed. No record backs it", "may have pushed", "Nobody knows for sure"); beats.md now
  speaks the world's language (pop-up card, torn-out page). Claims: 17, 16 sourced, 1 disputed
  (correct: "By September" vs late August/early September).
- Music: one lo-fi chill bed (fits paper better than round 1's retro-wave), mix −14 LUFS,
  −2.03 dBTP.

# Real run Sketchbook 3: pop-up intent, hand ownership, variety (PLAN.md#13.10, round 3)

Date: 2026-10-07 · Claude Code CLI on the user's subscription (sanitized env, every turn
`apiKeySource: none`) · Windows 11, GPU idle at start · run by the Coder through the stage code like
[round 2](real-run-sketchbook-2.md): `StageRunner` with `experimentalWorlds: true`,
**`worldQuotaOverride: { minBreakthroughs: 2 }` (test only)**, `maxFixIterations: 1`, concurrency 2;
`checkSources`, `proposeMoments` (now with `cameraHints: PAGE_CAMERA_HINTS`, all accepted),
`exportVideo`, `buildPublishKit`. Code: `phase-13/v3.0` at 866a840, **no code changed**. Before the
run: `tsc -b` (clean), `pnpm build:cli` + `pnpm check:cli-bundle` ("up to date"); dist contains
`intent` (popup schema), `appear` (`draw/appear.js`), `worldQuotaOverride` (`stages/storyboard.js`);
no `unknown style preset` in any turn. Driver: `scratch/real-run-sketchbook-3/` (gitignored:
`drive.mjs`, `synth.ps1`, `sheets.mjs`, `strips.mjs`, `zoom.mjs`, `slopcheck.mjs`).

Topic (fixed random pick): the Great Molasses Flood, Boston, 15 Jan 1919. EN, SAPI David rate +2,
lead 0.8 s / paragraph 0.6 s / tail 0.8 s → 54.8 s; whisper large-v3-turbo-q5_0 on CUDA (6.8 s,
95 % coverage).

Output: `C:\Users\galar\Desktop\ReelForge-test-films\sketchbook-test-3.mp4` (55.27 s, 1920×1080
30 fps H.264 NVENC + AAC 48 kHz stereo, 16.9 MB, decodes cleanly), `…-contact-sheet.png`,
`…-transitions.png`, publish kit `…\sketchbook-test-3-publish\`; project
`…\sketchbook-test-3 work\Great Molasses Flood\`. Per-shot 8-frame strips (6 shares + t1−0.4 s +
t1−0.05 s) in `scratch/real-run-sketchbook-3/strips/`, 0.1–0.2 s detail strips in `…/zoom/`; every
claim below was checked on them.

## Answers to the mandatory checks

### 1. Page moments: intent, mechanism, what the pull moves

| Moment | Shot / time | `intent` | Mechanism / what moves | Verdict |
| --- | --- | --- | --- | --- |
| **pop-up** (`page.popup`, breakthrough) | s10_the_answer 40.20–46.72; card up ~40.9 (under the torn-strip), pull 41.98 (dur 1.4) | "the steel wall was about half as thick as standards required" | ribbon → `flap.open` (veil "THE ANSWER" drops 42.10–42.25) + `gauge.level` ×2: REQUIRED → 1, STEEL → 0.5 (42.4–43.0), red loop on STEEL 43.6, red stamp BARELY TESTED on "barely tested" | **meaningful**: the pull stops the steel bar at half of the required one on "about half as thick". No invented element (REQUIRED/STEEL/THE ANSWER/BARELY TESTED are narration). Weak: it reads as two thermometers (a "level", not a wall thickness); the card's opening is hidden by the transition; the ribbon travels a few px while a hand holding a red pen rests on it for 1.7 s (41.7–43.4), so the *pull* itself barely reads; 4 red elements (both gauge fills + loop + stamp). `frames: zoom/s10a.png, s10b.png, f42.png, f46.png` |
| **strip** (`page.strip`, breakthrough) | s08_cold_thickens 30.84–36.96 | storyboard: "three frames unspool: runny syrup → thick blob → stick person stuck" | 3 panels THE COLD / molasses cooled → THICKENED / it thickened → TRAPPED / couldn't escape (red), the page scrolls left as panels arrive | **meaningful** (the unspooling sequence is the narration's causal chain). Panels are almost only text: the "loop" doodle and the TRAPPED figure (~15 px) are tiny; THE COLD scrolls out of frame at 33.9 s, so only 2 panels are ever visible at the end. No invented element. |
| ruler-graph (page moment) | s04_wave_ruler 14.83–18.65 | "the bar grows from 15 to 50 ft, a speed tick on 35 mph" | hand-hatched bar on a ruled feet axis, red loop on 50, 15-50 FT / maybe / 35 MPH appear | **confusing order**: the hero top block (15→50) is drawn first on "fifty" (15.3–15.9) and the base (0→15, anchored on "fifteen" 14.83) only at 16.0–16.4 — a block floating at 15–50 ft, then its base (`zoom/s04a.png`). Content itself right. |
| slow-motion reveal (`moments.json`) | s05 18.81–20.0, rate 0.4, on "flattens" | – | render effect | present; `cameraHint` is now the page hint ("a slow push toward the key drawing…") |
| index card (`sheet`) + tape-peel | s06 22.57–26.61 | – | card taped at angles | fine; see invented "19" below |
| envelope (`sheet kraft envelope`) | s12 50.66–55.28 | – | kraft envelope | fine as paper; the "check" on it is an empty box |
| torn page | s10 | – | torn-strip transition + stubs | yes |

Mechanisms are all different (one pop-up only, so "never the same mechanism twice" was not really
exercised). **Invented elements:** s06 opens with a struck-out "19" corrected to "21" (a fake earlier
count, not in narration or research); s07 "WHY" struck and rewritten "WHY?" (harmless fake
correction); s03 "SYRUP" corrected to "WAVE" suggests "it wasn't syrup, it was a wave" — the
narration says "a wave *of* syrup" (misleading semantics); s12 empty check rectangle.

### 2. The hand

- `duration: shot.duration` passed **12/12**; `hero: true` in 10/12; `appear` used in 12/12 scenes
  (32 calls) — labels, numbers, source credits bloom in on their own while the hand draws the key
  mark. Bloom (0.36 s wave) reads as ink soaking in, not as writing (s05 "ELEVA…" for 2 frames).
- **Ink writing itself without a hand: 1 case, s03 12.9–13.3 s**: red `WAVE` (a hand write, no
  `appear`, starts 0.3 s after the red strike) writes stroke by stroke while the hand is still on
  the strike (`zoom/s03.png`). It is the point of the shot (the correction) and it overlaps SYRUP.
- **Hero preemption reorders a sequence: s04** (see §1): the earlier base fill lost the hand and was
  queued 1.2 s behind the hero fill.
- **Last 0.4 s:** 10/12 clean. s09 and s11: the hand parks on the subject until t1−0.35/−0.33
  (covering "4 MONTHS" / the anarchist) and is gone at t1−0.19 (`zoom/s09end.png`, `s11end.png`):
  borderline, same as round 2's s03.
- Simultaneous top+bottom drawing: none by hand; only hand + `appear` labels (by design). No
  teleport, flip or double hand seen. s06: the hero "21" is written under the tape-peel
  transition, so the shot opens with it already there.
- **Narration cut because writing was slow: none.** Claude dropped content only by policy (URL
  chips in s02/s04, highlighter in s12, "$" missing from the hand font → "628,000 dollars").
  `speed: 2` used in s03/s12; no scene-local stroke fonts.

### 3. Variety

| Shot | t0–t1 | Roll / look | Layout (A) | Moment | Transition in |
| --- | --- | --- | --- | --- | --- |
| s01 dateline | 0.00–5.67 | C loud | – | – | – |
| s02 tank_splits | 5.67–11.41 | A story | hero-left | – | cut |
| s03 wave_word | 11.41–14.83 | C loud | – | – | page-flip |
| s04 wave_ruler | 14.83–18.65 | B graph | – | ruler-graph | cut |
| s05 wave_destruction | 18.65–22.57 | A story | tall-diagram | (slow-mo) | cut |
| s06 toll | 22.57–26.61 | B graph | – | (index card) | tape-peel |
| s07 why_burst | 26.61–30.84 | A story | tall-diagram | – | cut |
| s08 cold_thickens | 30.84–36.96 | B graph | – | **strip** | **continuity zoom-through** |
| s09 four_months | 36.96–40.20 | A story | hero-left | (calendar sheet) | cut |
| s10 the_answer | 40.20–46.72 | C loud | – | **popup** + torn | torn-strip |
| s11 blame | 46.72–50.66 | A story | wide-strip | – | cut |
| s12 payout | 50.66–55.28 | B graph | – | (envelope) | cut |

Looks never repeat back to back; 7 treatments; 4 distinct non-cut transitions (round 2: 3).
Something other than "pen draws on a page" happens in 7/12 shots. **Still repetitive:** A pages
s02, s05, s07, s11 are again "things standing on one horizontal ground line in the middle band"
although the layout presets differ (hero-left/tall-diagram/wide-strip). **Plain-page holds:** the
film's hook, s01 0–2.7 s, is a near-empty lined page with only "BOSTON, JAN. 15" and a coffee ring
(breaks "never < 3 elements for > 0.6 s"); other static holds ≤ 1.6 s (s12 end 1.6, s03 end 1.2).
Boring? Less than rounds 1–2 in structure, but the pages themselves are plainer (s06, s12 pale
ballpoint on kraft/card).

### 4. Continuity links

Planned **1** (s07 → s08 `zoom-through`, object: tank), rendered **1** (final review:
"1 link planned, 1 rendered"). In the frames the camera dives into the tank's molasses and
crossfades onto the molasses blob of s08's page (transitions sheet row 3) — the world's signature
cut is in the film for the first time. The 0.5 mid-frame is busy (hand + tank + strip overlap). The
storyboard got a false warning: `transition-focus: "focus" is used only by enter-*/dive-*/…` for a
continuity zoom-through that needs `focus`.

### 5. Guards and critic

- Guards: **3 ⚠, all stagger variance**: s02 and s07 flag *pre-drawn* strokes (`at` −3 … −0.3,
  finished before the shot starts, never seen) → **false positives**; s06 5 scribble bundles 0.15 s
  apart (visible, reads as one scribbling gesture) → debatable. `slopSourceFindings` re-run on all
  12 scenes: same 3.
- **False negatives:** the invented "19" (s06) passes; probes: replacing it with 17 or 23 also
  passes, "4,321" and "ZORBLAX" are caught → the "visible result of a calculation" rule lets any
  small number through. Pop-up intent guard: replacing s10's intent with "a pretty decoration"
  passes (only genericity is checked, not grounding in the narration). Accent share did not flag
  s10's four red elements (< 12 % pixels).
- Critic (Haiku): 12/12 ✓ (s05 judged only in the final review). Round-2 parser fix works (no false
  `off-intent`). It still names chrome as traces ("spiral binding", "lined paper", "taped cover" in
  s04, s07, s10, s11, s12) and missed: s03 ghost WAVE, s04 reversed bar, s06 invented 19, s10 red
  overuse, s01 empty opening. It correctly judged the s10 pull as meaningful.
- QA: s02's first QA round reported a renderer crash (`TypeError … reading 'load'`) that the fix
  turn could not reproduce (wasted 1 Opus turn, $0.22). s05 sfx 160 ms early survived its fix
  (clamped at 0) and was fixed in the final review. Triage: fenced JSON, accepted.

### 6. Quality (QUALITY.md §7)

| Shot | Score | Note |
| --- | --- | --- |
| s01 | 17 | big crooked 1919 + red underline, strong focal; hook opens on a near-empty page for 2.7 s |
| s02 | 17 | tank + red crack on "splits" + brown fill + label/arrow; rooftops read as squiggle humps; "more than" floats alone first |
| s03 | 15 | huge SYRUP → red WAVE; WAVE ghost-written and overlapping; misleading correction |
| s04 | 16 | clear ruler chart, 15-50 FT, 35 MPH, red 50; bar drawn top-first |
| s05 | 16 | wave over buildings, railway labelled; buildings don't flatten, red V reads like a tick |
| s06 | 15 | thin pale "21" is a weak focal; invented 19; tally reads ok |
| s07 | 17 | quiet tank, red ? on "burst", WHY?, arrow; centred on purpose for the zoom |
| s08 | 17 | strip + zoom-through (signature); panels mostly text, figure tiny |
| s09 | 16 | eerie boot + calendar tallies + red circle; boot hard to read; hand parks on label |
| s10 | 17 | pop-up with a meaningful pull + stamp; flat pale card, opening unseen, too much red |
| s11 | 17 | clear blame story: pointing, bomb, AUDITOR, ANARCHISTS crossed; ground-line grammar again |
| s12 | 15 | 628,000 in pale blue on kraft (low contrast), empty check, coin stack reads as a spring |

**Mean 16.25/20** (round 1: 16.6; round 2: 16.8; showcase 18–19). No fail, 3 shots at 15. The
*structure* improved (meaningful pop-up, strip, link, 4 transitions, no URL chips, no cut words) but
individual pages are plainer and paler, and 3 accent/invention slips cost points. Deliberate
roughness is preserved (wobbly figures, crooked marker, tape, coffee rings, smudges, crude boot).
Slop tells: §1.4 invented text (19), §1.8 accent overload (s10), §1.10 cosmetic camera requests
that do nothing (below).

### 7. Wall clock, turns, cost

`costUsd` = project ledger deltas (list-price meter, not a bill). 41 rate-limit events, all
`allowed_warning`, `limitHits: 0`; no hang, no frame-render timeout, no leftover headless browsers.

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 61 s | 2 Sonnet | 7.7 k | 0.26 |
| claims check | 7 s | 1 Sonnet (17 claims, 17 sourced, 0 disputed) | 1.0 k | 0.06 |
| voiceover / clean / words | 0.4 / 3.1 / 6.8 s (CUDA ok) | – | – | – |
| storyboard (+ tension) | 116 s | 2 Sonnet (no repair) | 14.7 k | 0.39 |
| scenes build | 1077 s (18 min) | 12 build + 2 fix (Opus), 11 critic (Haiku) | 141 k | 8.28 |
| final review | 138 s | triage + 1 fix + 1 critic | 9.0 k | 0.25 |
| sound-cues / mix | 26 / 5.5 s | 1 Sonnet | 1.8 k | 0.13 |
| export | 129 s (1658 frames, 2 workers, SwiftShader, ~13 fps) | – | – | – |
| **Total** | **~26 min of stages** | **34 turns** | 175 k | **9.36** |

$0.78 per shot (round 2: $0.96; scenes 18 min vs 28). Scene turns used 52 `reelforge frames`, 47
`kit-docs`, 28 lint, 28 anchors, 122 Read, 84 Edit. **Export encoder:** `h264_nvenc` probed ok and
opened on the first try, 0 export warnings (no libx264 fallback needed).

## Top 5 findings

1. **The pop-up finally means something**: s10's ribbon stops the STEEL gauge at half of REQUIRED on
   "about half as thick" — no decorative disc, no invented piece. But the pull itself is barely
   visible and the card's opening happens under the transition, so the "wow" is small.
2. **The world signature arrived**: 1 continuity link planned and rendered (tank → molasses
   zoom-through), 4 different page transitions, strip + pop-up + ruler + card + envelope, looks never
   repeat.
3. **Hand ownership mostly works** (labels bloom, the hand draws the key mark, no cut words, 10/12
   clean endings) but two queue bugs remain: a non-`appear` write that loses the hand still writes
   itself (s03 WAVE), and hero preemption reorders an anchored sequence (s04 bar).
4. **Camera moves do nothing on Sketchbook pages**: storyboard intents ask for pushes in most shots,
   scenes call `ctx.camera.pushIn` (s08, s10) or spend turns removing it (s01: "turned every frame
   blank"; s02/s03/s04/s07/s09 "no visible effect"); frames at 42.5 s and 46.6 s are identical scale.
5. **Quality per page dipped to 16.25**: pale ballpoint heroes (s06 "21", s12 "628,000"), an
   invented "19", red overload in the pop-up, an empty 2.7 s opening — and neither guards nor the
   critic caught any of these.

## Defects and suggested fixes

| # | Sev | Defect | Suggested fix |
| --- | --- | --- | --- |
| 1 | high | A hand write that loses the hand still writes itself stroke by stroke (s03 red WAVE during the strike) | in `handDrawn`, a task that does not get the hand at its time is turned into `appear: 'bloom'` automatically (never handless strokes), or kit lint error for overlapping non-`appear` writes |
| 2 | high | Hero preemption reorders anchored marks (s04: base fill at "fifteen" drawn 1.2 s late, after the top block) | a hero never displaces a task that started earlier; the displaced one appears at its own time instead of queueing > 0.6 s |
| 3 | medium | Camera `pushIn` is a no-op on sketch pages, yet storyboard/scene prompts ask for pushes; wasted turns | either implement a page-level push (scale/translate the page in `sketchPage`) or drop camera wording from Sketchbook storyboard/scene prompts and lint `ctx.camera.*` in world scenes |
| 4 | medium | Pop-up: opening hidden when `at ≤ 0` under a transition; the pull tab travels a few px; the pulling hand holds a pen and rests 1.7 s | prompt + check: popup `at` ≥ transition duration; kit: ribbon travel ≥ ~60 px with a pen-less grip pose for the pull |
| 5 | medium | Gauges fill red by default → 4 red elements in s10 | gauge fill default = a non-accent ink; red only on `focus` |
| 6 | medium | Text guard lets small invented numbers through (19, 17, 23 on a 21 card) via the calculation rule | count a calculation only when both operands are on screen in the same scene; flag struck-out numbers that are not sourced |
| 7 | medium | Hand parks on the subject until t1−0.35 (s09 label, s11 figure) | start the exit right after the last mark + hold, or rest outside the subject's box |
| 8 | low | Pop-up intent guard accepts ungrounded intents ("a pretty decoration") | require ≥ 1 intent content word from the shot's narration |
| 9 | low | Stagger variance flags pre-drawn marks (`at` < 0; s02, s07) | skip tasks finished before t = 0 |
| 10 | low | Critic counts chrome as traces; misses ghost writing, reversed order, invented numbers, red overload, empty opening | add these lines to the Sketchbook critic checklist; sample ≥ 2 frames incl. t≈0.5 s |
| 11 | low | s01 hook: near-empty page for 2.7 s | scene brief: the first 1 s already shows ≥ 3 elements (pre-draw props, draw the date while speaking) |
| 12 | low | A pages repeat the ground-line composition despite different layouts | layout presets with different vertical structure (top-down map, close-up object) + storyboard examples |
| 13 | low | Pale ballpoint heroes on kraft/card (s06, s12) | hero writes default to marker/felt or a darker bic on kraft; contrast check in the frame guards |
| 14 | low | Storyboard false warning `transition-focus` for continuity zoom-through | allow `focus` for `continuity-zoom-through` in the validator |

## Run notes

- Script 132 words, hedged ("Estimates say fifteen to fifty feet", "maybe thirty-five", "About a
  hundred and fifty", "more than two million", "about half as thick"); open loop "why would a tank
  just burst?" → closed at 41.98 with a veil. Chapters: January Fifteenth / Wave of Syrup Rolls /
  Twenty-one People Die / Answer (weak last title). Mix −13.99 LUFS, −2.22 dBTP; 30 sfx, 4 SFX
  repetitions open.
- With concurrency 2, scene autocommits pick up the other shot's in-progress file: "Scene
  s02_tank_splits built ⚠" contains only `scenes/s03_wave_word.js`, so a per-shot revert would
  undo the wrong shot; autocommit should stage only the shot's own files.

# Real run Game B1 1: the first film in the Atari boss-fight world (PLAN.md#13.10, Game B1 round 1)

Date: 2026-10-07, 14:32–15:10 UTC · Claude Code CLI on the user's subscription (sanitized env, every turn
`apiKeySource: none`) · Windows 11 · no other real run active. Run by the Coder through the stage code like
[Game B2 1](real-run-game-b2-1.md): `StageRunner` with `experimentalWorlds: true`,
**`worldQuotaOverride: { minBreakthroughs: 2 }` (test only)**, `maxFixIterations: 1`, concurrency 2;
`checkSources`, `proposeMoments` (`PAGE_CAMERA_HINTS`, all accepted), `exportVideo`, `buildPublishKit`.
Code: `phase-13/v3.1` at 81e4104, **no code changed**. Before the run: `tsc -b` clean (up to date),
`pnpm build:cli` → `pnpm check:cli-bundle` "up to date"; the bundle and dists contain `score-table`,
`game-b1-calendar-zoom`, the offensive-terms guard (`source-checks-offensive.js`, `offensive-terms.js`) and
`scenes/fix-reply.js`. **The engine harness (`packages/engine/out/harness/engine-frame.js`) was stale**
(built 15:57 local, before 81e4104's engine/kit changes) → rebuilt with `buildHarnessFiles()` before the
first stage. **Caveat:** the harness bundles `packages/kit/src` directly and is rebuilt by every `reelforge
frames` call and by the export; another coder's *uncommitted* Game B1 kit work (`vocab/`, built to dist at
14:55 UTC, mid scenes stage; `room/interior*.ts`, `tv/painter.ts`, `screen/model.ts`) was in the working tree,
and the export's harness (15:08 UTC) contains it (`defineSprite`, room shells). The scene turns only saw the
81e4104 API (no `defineSprite`/`interior` in any transcript) and the film's room matches the showcase room,
but the pixels are not a pure 81e4104 render. Project created with `createProject({ style: 'game-b1' })` → world defaults (mixed looks,
continuity links on, guards on, classic characters, no mascot). Driver: `scratch/real-run-game-b1-1/`
(gitignored: `drive.mjs`, `synth.ps1`, `sheets.mjs`, `strips.mjs`, `zoom.mjs`, `slopcheck.mjs`,
`offcheck.mjs`, `spriteprobe.mjs`, `transcripts.mjs`, `waitfor.mjs`).

Topic (fixed random pick): the Y2K bug (1999–2000). EN, SAPI David rate +2, lead 0.8 s / paragraph 0.6 s /
tail 0.8 s → 57.2 s WAV; whisper large-v3-turbo-q5_0 (8.0 s, 130 words, 95 % coverage).

Output: `C:\Users\galar\Desktop\ReelForge-test-films\game-b1-test-1.mp4` (56.37 s, 1920×1080 30 fps
H.264 NVENC + AAC 48 kHz stereo, 24.5 MB), `…-contact-sheet.png`, `…-transitions.png`, publish kit
`…\game-b1-test-1-publish\`; project `…\game-b1-test-1 work\Y2K Bug\`. Per-shot 8-frame strips in
`scratch/real-run-game-b1-1/strips/`, 0.1–0.2 s detail strips in `…/zoom/` (`s07s08cal`, `s10s11cart`,
`s03s04slide`, `s01s02shake`, `s11-scene-frames`, `crop-s03-tv`, `crop-s12-tv`); every claim below was
checked on them. Times are film seconds.

## Answers to the mandatory checks

### 1. Breakthroughs and moments

| Moment | Shot / time | `intent` | What it shows | Verdict |
| --- | --- | --- | --- | --- |
| **manual** (planned breakthrough) | s04 14.09–18.97; page in 15.15–15.35, ticks 15.2/15.7, red pen on "Nineteen" 16.01, margin note 17.15 | "two-digit years make 00 read as 1900, so the machine cannot tell the centuries apart" | HOW TO PLAY: 1 YEAR: 2 DIGITS. 2 99 THEN 00. 3 00 MEANS ~~2000~~ → red circled 1900; FIG. 1 THE YEAR; pencil margin note EBSCO.COM | **meaningful, original, the best beat of the film**: the correction *is* the bug (the machine's reading). Weak parts: FIG. 1 is two tiny star boxes in the corners of a big empty halftone panel (decorative, not digits); the margin note is a source URL (not "something true" of Dad's); the 1900 circle overlaps the struck 2000. Not a b3/b5 copy. No invented element. `strips/strip-s04_zero_zero.png` |
| **score-table** (planned breakthrough) | s10 40.96–44.82; rows pre-printed (print −0.4), slam on "ninety-one" 42.14, ring + TAPE on "two" 43.22 | "midnight's glitches in order: the observatory and the plant are logged, the video store's $91,250 bill lands now, the Senate verdict is still locked" | HIGH SCORES: 1ST NAVAL 19100, 2ND NUCLEAR 10, 3RD NEW YORK **91250** (gold slam, typed initials, grease-pencil ring "TAPE"), 4TH ??? 2000 | **meaningful recap, template-like**: the b4 mechanism nearly 1:1 (cut in, two done rows, hero mid-table, typed name, locked row) + b1's ring. Facts checked: 19100 (observatory site), 10 (minutes of alarms), 91,250 (USD bill), 2000 (Senate report, research.md:12) are all real — but the "score" column mixes a date string, minutes and dollars, so NUCLEAR 10 reads as a score of 10. **The locked row still prints its score 2000** (kit). Table sits in the top half, the lower ~50 % is empty black. |
| boss-card | s02 6.73–10.09 | – | BOSS 1 MISSING DIGITS, bar DIGITS ■■; big "19" + two empty crimson slots → 1900 | the strongest image idea (19__ = two missing digits); the BOSS label types over the HUD year (7.1–7.3) |
| boss-card (unplanned) | s07 27.0, s11 47.2 | – | BOSS 2 FALSE ALARM? | **misuse**: a question as a second boss (QUALITY §6: only the central problem); never defeated |
| tv-push | s01 4.4–5.4 (in), s03 12.1–12.7 (out), s05 19.1–20.5 (in), s07 30.4–31.7 (out), s12 54.3–55.0 (out) | – | the room ↔ TV picture in one move | **all continuous**, no jump (the world's continuity works inside a shot) |
| glass-note | s03, s05, s06, s07, s12 | – | SAVED SPACE, ON FIXES, ESTIMATES, HOLD THAT THOUGHT., SENATE: FIXES WORKED ✓ / SKEPTICS: ~~OVERBLOWN~~ | ESTIMATES = good hedge; **SAVED SPACE lands only after the pull-back (12.9 s) → never legible**; s12 strike-out happens during the pull-back → illegible (`zoom/crop-s03-tv.png`, `crop-s12-tv.png`) |
| calendar-zoom | s08 32.10–33.5 | (see §2) | room → calendar → line-by-line redraw → TV page JAN 1 / 19100 | the redraw itself works; the seam into it does not (§2) |
| cartridge (unplanned in s11, `action: 'pull'`) | s11 44.82–45.5 | "the century runs out: the cartridge comes out of the slot and the game dies a hundred years overdue" | in the scene: Dad's hand pulls a moon-label cart, TV garbage | **invisible in the film**: the whole pull plays under s11's 0.9 s `game-b1-attract-cycle` wipe (`zoom/s10s11cart.png` vs `zoom/s11-scene-frames.png`) |
| game-over | s11 47.2–49.26 | – | CONTINUE? 9 → 8 → 7 (uneven), 1900 burned in, BOSS 2 | reads; 45.8–47.2 is a dot then 1900 alone on black |
| dialogue | s12 49.26–54.3 | – | senator at a podium + Capitol dome, SENATE / SKEPTICS boxes typed | works, warmest shot; figures are `g.rect` blocks (see §3) |
| palette-shift (`moments.json`) | s09 37.76–38.26 | – | tint on "Alarms" | present |

**4 s no-sound hold rule**: no breach (manual: last beat 17.15 → cut 18.97; score table: ring 43.22 → cut
44.82; narration runs through both). **No unplanned breakthrough** (each toolkit once; B2's defect #1 did
not recur). The 8 storyboard moments are all different (boss-card, tv-push, manual, glass-note,
calendar-zoom, score-table, game-over, dialogue).

### 2. Continuity

- **calendar-zoom s07 → s08** (planned zoom-through link + `game-b1-calendar-zoom` 1.2 s): s07 ends on a
  slow push with the calendar small at x≈0.7 (32.05); the transition zooms s07's last frame until the
  calendar fills the frame (32.3–32.7), then **crossfades into s08's own opening, which restarts from a
  room view with the calendar small at the right → two calendars at different scales, a ghosted double
  exposure 32.9–33.2** (`zoom/s07s08cal.png`, transitions sheet row 3); then s08's in-shot `calendarZoom`
  redraws line by line onto the TV page (33.2–33.5). Two pushes + a misregistered crossfade = a visible
  jump. The s08 builder noted "the calendar sits right of centre, not centred as the link asks" and left
  it; final review said "1 link planned, 1 rendered". The calendar never shows 31 DEC (kit `mark` ≤ 28).
- **cartridge in/out**: the storyboard planned `game-b1-cartridge-out` on s11, the validator rejected it
  (needs a continuity link), the storyboard fix swapped in `game-b1-attract-cycle`; the scene still built the
  pull at local 0.1–0.7, so the 0.9 s wipe hides it entirely. No double hand (the hand is never seen).
- **TV push**: 5 in-shot pushes/pulls, all continuous (§1). Cuts between shots are clean cuts.
- **page-slide s03 → s04** (0.8 s): the transition slides s04's opening *TV picture* (dark, 99) up over the
  room like a page, then the manual page slides in a second time inside s04 (15.15–15.35)
  (`zoom/s03s04slide.png`) — the same class of bug as B2's map-unfold.
- **room-shake s01 → s02**: neither side shows the room (both TV-only); it reads as a jitter plus one
  full-frame tan flash at 6.90 (`zoom/s01s02shake.png`).
- Nice unplanned continuity: s12's pull-back shows a JAN calendar and no tree (s01–s08 rooms: DEC + tree).

### 3. The two-worlds grammar and the HUD

- **Inside the TV**: wide 4×2 px units ✓, CRT scanlines/bleed only on the picture ✓, colour bands per line ✓,
  Joy caps text with irregular typing ✓, Score Block digits ✓. **But zero 2600 sprites in the film**:
  `g.sprite` / `g.playfield` only draw `'#'` bits and silently draw nothing for `'1'`, `'X'` or arrays
  (probe `spriteprobe.mjs`: `'#'` 160 px, `'1'`/`'X'` 0 px; playfield `'0'/'1'` 0 px); the method doc in
  `screen/methods.ts` never says `'#'`. 4 scene turns (s02, s03, s08, s12) reported "g.sprite drew nothing in
  any row format" and fell back to `g.rect` (30 calls in 8 scenes). So one-colour-per-row and the **flicker
  rule never ran** — no sprite flickers anywhere; the senator, skeptic, dome, cooling towers are plain blocks.
- **The room**: clean square pixels, no CRT ✓; the same 1982 room in 7 shots (by design, one room per film);
  a 1982 Christmas room on New Year's Eve 1999 is a fixed world frame, slightly anachronistic.
- **HUD**: year 1999 → 2000 rolls in s08 on "came" ✓ (meaningful); progress = 12 cartridge slots = 12 shots ✓;
  score only in s05 (BILLION 100, a story number, redundant with the big 100) ✓; no lives ✓; boss bar:
  BOSS 1 MISSING DIGITS = the central problem ✓ (hp 2 DIGITS), **BOSS 2 FALSE ALARM? ✗** (s07, s11).
  The BOSS label collides with the HUD year at top-left in s02 (7.1–7.3).

### 4. Variety

| Shot | t0–t1 | Roll / look | Moment | Transition in | What fills the frame |
| --- | --- | --- | --- | --- | --- |
| s01 hook | 0.00–6.73 | A atari-story | – | – | room (lit) → TV: countdown 05→01 on black |
| s02 culprit | 6.73–10.09 | C atari-boss | boss-card | wipe room-shake | black, boss card, 19__ |
| s03 two_digits | 10.09–14.09 | A atari-story | tv-push | cut | 99 on black → room |
| s04 zero_zero | 14.09–18.97 | B atari-menu | **manual** | wipe page-slide | 99→00 on black → cream manual page |
| s05 hundred_billion | 18.97–22.21 | A atari-story | – | cut | room → 100 + money stacks on black |
| s06 worldwide | 22.21–26.13 | B atari-menu | – | cut | bar chart on black |
| s07 hold_thought | 26.13–32.10 | C atari-boss | glass-note | cut | **black 0.9 s**, BOSS 2, note → room → calendar |
| s08 midnight | 32.10–37.76 | A atari-story | calendar-zoom | calendar-zoom (link) | room → dome + orange page 19100 |
| s09 alarms | 37.76–40.96 | C atari-boss | – | cut | cooling towers, ALARM, 10 MIN |
| s10 score_table | 40.96–44.82 | B atari-menu | **score-table** | cut | table in the top half of black |
| s11 overdue | 44.82–49.26 | C atari-boss | game-over | wipe attract-cycle | (hidden cart) dot, 1900 on black, CONTINUE? |
| s12 verdict | 49.26–56.36 | A atari-story | dialogue | cut | purple stage, senator, notes → room |

Looks never repeat back to back; 4 non-cut transitions, all rendered. **Boring part: "a big orange number
on black" is the focal of 10 of 12 shots** (01, 19__, 99, 00, 100, bar, 19100, 10, 91250, 1900); the topic is
numeric, but the treatment never changes. Near-black frames: luminance sampled at 4 fps, **29 % of samples
have mean Y < 35** (s02 mean 30, s10 33, s11 33, s06 45, s07 47); dark stretches 26.13–27.0 (black + HUD) and
45.8–47.2 (dot, then 1900 alone). The warm room (s01, s03, s05, s07, s08, s12) and the cream manual (s04,
mean Y 166) are what saves the film from B2's monotony.

### 5. Text provenance and legibility

- From the narration/research: MIDNIGHT, YEARS, TWO DIGITS, AMERICA, BILLION DOLLARS, ON FIXES, WORLDWIDE,
  300-600B, ESTIMATES, FALSE ALARM?, HOLD THAT THOUGHT., FIRST:, NAVAL OBSERVATORY, JAN 1, 19100, JAPANESE
  NUCLEAR PLANT, ALARM, 10 MIN, NAVAL / NUCLEAR / NEW YORK / 91250 / TAPE, SENATE 2000 (research.md:12), the
  manual rules (2000 in research), SENATE / SKEPTICS lines; game words HIGH SCORES, HOW TO PLAY, FIG. 1,
  CONTINUE?, BOSS n. Source credits EBSCO.COM / MENTALFLOSS.COM typed **inside the TV picture** (and as
  Dad's margin note) — provenance OK, but out of the fiction.
- **Not grounded**: s01 countdown 05→01 (no seconds in the narration; small numbers pass the guard); s05 shows
  an exact **100 / BILLION 100** for "about a hundred billion" — the one claim the claims check marked
  *disputed* (c5: $100B vs Gartner $150–225B) loses its hedge on screen; `$` and `=` are missing from the B1
  fonts (91250 without $, "YEAR: 2 DIGITS." instead of "=").
- **Offensive-terms guard: 0 hits** in 12 scenes and the script (`offcheck.mjs`); probes `TAPE → RETARD` and
  `→ Retarded!` caught as errors (the suggestion "e.g. CLINK, CLANG, TINK" is onomatopoeia-specific).
- **Legibility at 1080p**: TV-only text, boss names, manual print and score rows read well; credits ~12 px
  read. **Glass notes are illegible once the camera is in the room** (SAVED SPACE ≈ "SAWED BPACE", s12 notes
  scribbles; `zoom/crop-s03-tv.png`, `crop-s12-tv.png`); the dialogue box in room view is fine.

### 6. Guards, critic, fix turns

- Guards: **1 ⚠** — s02 invented text "19" (the first half of 19__/1900; a fragment of 1999/1900 from the
  narration → rule-true, a false positive in meaning). `slopSourceFindings` re-run on all 12 scenes: the same 1.
  Probes (`node slopcheck.mjs …`): score 91250 → 95250, 19100 → 19200, NUCLEAR 10 → 12, ring TAPE → WOW, NEW
  YORK → TOKYO, correction 1900 → 1800, caption → THE CLOCK, manual 2000 → 2700, intent → "the high scores"
  **all caught** (better than B2: small table values now caught); **passed**: manual "00 MEANS 2100", "99 THEN
  07" (small/derivable numbers). Not checked at all: a second boss card, a beat hidden under a transition,
  a locked row printing its score, a dropped hedge.
- Critic (Haiku), build QA: 11/12 ok; s11 off-intent ×5 notes: "missing BOSS card (required)" / "no
  countdown" (**false** — they arrive at 47.2, the frames were before "So,"), "fewer than 3 traces" (partly
  true), "collapse to dot not clearly shown" (true-ish), "FALSE ALARM? breaks the Atari aesthetic" (false).
  The s11 ⚠ was then silently dropped by the final review (triage did not list it). Final triage: 1 suspect
  s12 "characters on purple instead of sticky notes" (**false positive**: the notes arrive 0.3 s in); the fix
  turn moved the note onto "Senate" (harmless). **Missed**: the calendar double exposure, the hidden
  cartridge pull, the double page slide, BOSS 2 misuse, s07's black first second, illegible notes in room
  view, the leaked locked score, the dropped hedge, BOSS label over the year, number-on-black monotony.
- **No fix turn ended with a question** (0/7; the fix-reply change works). **4 of 7 fix turns were sfx
  sync** (s04 scribble 0.12 s early, s08 ×2, s10 six findings, s12 tick 440 ms early); s10's fix *deletes
  every kit cue 150–500 ms from a spoken hit* (row-print ticks gone). Others: s03 blank opening frame, s11
  blank frame + late tick, final s12.
- Fact conflicts: no critic/research conflict note was raised (none occurred); the claims-check dispute (c5)
  did not reach the scene turn.

### 7. Quality (QUALITY.md §7, /20)

| Shot | Score | Note |
| --- | --- | --- |
| s01 | 16 | warm lit room, clean push into the TV; invented countdown, TV picture mostly black, no 31 DEC |
| s02 | 14 | 19__ is a strong image; black frame, BOSS over the year, room-shake with no room + full-frame flash |
| s03 | 15 | 99 drops + pull-back read; dithered "socket" blocks look like mistakes; note never legible |
| s04 | 17 | the manual correction is the film's idea; decorative FIG. 1, source as margin note, double slide |
| s05 | 15 | push + stacks + slam; hedge lost; HUD score repeats the big number |
| s06 | 14 | a plain bar chart on black; the ESTIMATES note is the only human touch |
| s07 | 14 | 0.9 s black open, BOSS 2 misuse; the pull-back to the calendar is good |
| s08 | 15 | the redraw into the TV page is the world working; ghosted entry, blank orange page, crimson-on-orange |
| s09 | 15 | cooling towers read instantly, ALARM + 10 MIN; flat and static |
| s10 | 15 | slam + ring + recap mean something; b4-like, mixed units, leaked locked score, half empty |
| s11 | 13 | the cartridge pull is invisible, 1.4 s of dot/1900 on black, BOSS 2 again |
| s12 | 17 | senator/Capitol/dialogue + pull-back to a January room; notes illegible in the room |

**Mean 15.0/20** (Sketchbook 16.6 / 16.8 / 16.25; Comic 1 15.2; B2 1 14.8; B1 showcase 17–19). One shot
below the 14 fail line (s11). Deliberate roughness is preserved where the kit draws it (crooked notes,
uneven typing, misregistered manual print, coffee rings, thumbprint, grease-pencil ring, uneven countdown),
but the 2600 crudeness (sprites, flicker) is lost to plain rectangles. Slop tells: §1.2 decoration (FIG. 1),
§1.4 small invented numbers (countdown), §1.9 near-same composition (number on black ×10).

### 8. Wall clock, turns, cost, export

`costUsd` = project ledger deltas (list-price meter, not a bill). 53 rate-limit events, all `allowed`,
`limitHits: 0`; no hang, no frame-render timeout, no retry needed.

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 87 s | 3 Sonnet (research, script, trim 144 → 128 words) | 12.2 k | 0.34 |
| claims check | 7.2 s | 1 Sonnet (11 claims, 10 sourced, 1 disputed: c5 $100B) | 0.9 k | 0.07 |
| voiceover / clean / words | 0.7 / 3.4 / 8.0 s | – | – | – |
| storyboard (+ tension) | 154 s | 3 Sonnet (1 validator fix: cartridge-out needs a link) | 16.4 k | 0.41 |
| scenes build | 1459 s (24.3 min) | 12 build + 6 fix (Opus), 12 critic (Haiku) | 181 k | 9.98 |
| final review | 251 s | triage + 1 fix + 1 critic | 13.4 k | 0.35 |
| sound-cues / mix | 55 s / 7.7 s (first try) | 1 Sonnet | 2.6 k | 0.14 |
| export | 62.6 s (1691 frames, 2 workers, SwiftShader, **27.0 fps**) | – | – | – |
| **Total** | **~35 min of stages** | **41 turns** | 227 k | **11.30** |

$0.94 per shot (B2 1: $1.19, Sketchbook 3: $0.78). Scene turns 10–49 tool turns; CLI calls: 75 `frames`, 50
`kit-docs`, 34 `anchors`, 33 `lint`, 4 `validate`. **Export encoder:** `h264_nvenc` probed ok and opened on
the first try, 0 warnings, no fallback. Mix −14 LUFS, −1.99 dBTP. MP4 24.5 MB for 56 s.

### 9. Crashes, validator false errors, anchors

No crash, no page error, no frame timeout. Validator false errors: none (storyboard: only the tension-tempo
warning 10.1–19.0 s; the cartridge-out rejection is a real rule). Kit limits hit by real needs: calendar
`mark` max 28 (`screen/schemas.ts:74` at 81e4104; New Year's Eve = 31, wanted by s01/s07/s08; zod message
"mark Too big: expected number to be <=28"), no `$`/`=` glyphs, "camera wouldn't accept a zoom on the TV
view" (s06), silent no-op sprites (§3). **Anchors now resolve inside the shot window: yes** — sync report
106/114 events ok, 0 problems; every repeated word resolved to its own shot (false ×2 → s07 26.75 / s11
47.80; two ×3 → s02 / s03 / s10; hundred ×2 → s05 / s11; zero ×2 within s04).

## Top 5 findings

1. **The world works end to end and the room ↔ TV continuity inside a shot is genuinely good**: 12/12 scenes,
   5 continuous pushes/pulls, the manual's red correction (2000 → 1900) is the bug explained in one stroke,
   no unplanned breakthrough, no question-ending fix turn, anchors per shot, cost down to $0.94/shot.
2. **The world's signature is half missing: `g.sprite`/`g.playfield` silently draw nothing unless bits are
   `'#'`** → 0 sprites, no flicker, every figure a rectangle; 4 scene turns lost time on it.
3. **Cross-shot seams break where a transition and an in-shot helper do the same job**: calendar zoom =
   two pushes + ghosted crossfade; page-slide slides a TV picture, then the page slides again; the
   attract-cycle wipe hides the whole cartridge pull.
4. **Monotony and dark frames**: a big orange number on black is the focal in 10/12 shots, 29 % of frames
   near-black; BOSS 2 FALSE ALARM? misuses the boss card twice.
5. **QA misses the visual seams and leaks**: critic/final review saw none of the 10 misses in §6 and raised
   2 false positives; glass notes are illegible in room view; the disputed $100B lost its hedge on screen;
   4 of 7 fix turns are sfx sync (one deletes the kit's craft ticks).

## Defects and suggested fixes

| # | Sev | Defect | Suggested fix |
| --- | --- | --- | --- |
| 1 | high | `TvPainter.sprite` / `playfield` draw only `'#'` and silently ignore `'1'`, `'X'`, numbers, arrays; the method doc never says `'#'` → 0 sprites, flicker rule never runs | throw a sentence error on any bit char other than `#`/`.` (or accept `1`/`0`, `X`); say `'#'` = on in `screen/methods.ts`; lint: `g.rect` figures > N per scene → hint "use g.sprite" |
| 2 | high | calendar-zoom link: the transition pushes s07's last frame, then crossfades into s08's own room view (calendar small at the right) → double calendars 32.9–33.2 | when `transitionIn = game-b1-calendar-zoom`, s08 must open on the landed page (`calendarZoom({ at: 0 })` with the push done, or the transition is a hard cut onto the redraw); continuity check compares the calendar rect at both seams |
| 3 | high | transitions hide or duplicate in-shot beats: attract-cycle (0.9 s) hides the whole cartridge pull; page-slide slides a TV picture, then the manual slides again | validator: no anchored beat / seam helper inside `transitionIn.duration`; a shot entered by `page-slide` must start the manual at 0 with `enter: 'cut'` (same rule as B2 map-unfold) |
| 4 | medium | calendar `mark` max 28 (`screen/schemas.ts:74` at 81e4104): 31 DEC impossible on a New Year's Eve film | allow 1–31 (grid of 5 rows), message in sentence style |
| 5 | medium | a second boss card for a question (BOSS 2 FALSE ALARM?, s07 + s11); boss never defeated | guard: ≤ 1 boss name per film (the storyboard's central problem); prompt: a question is a glass note or a CONTINUE?, not a boss |
| 6 | medium | glass notes slapped or struck while the camera is in the room are illegible (s03 SAVED SPACE never readable; s12 strike) | note min on-screen size: land/strike notes only while `inTv` ≥ 0.8, or the note rides the room glass at a readable scale; critic checklist item |
| 7 | medium | number-on-black monotony (10/12 shots), 29 % near-black frames, s07 0.9 s black opening | craft brief: ≤ 3 "score digits on black" shots per minute; TV pictures need a place (bands/playfield) behind the number; near-black-frame guard per shot (> 0.5 s) |
| 8 | medium | score-table locked row prints its score (4TH ??? 2000); mixed units in one score column | hide `score` on `locked` rows; prompt: one unit per table, or the unit in `who` (10 MIN) |
| 9 | medium | disputed claim loses its hedge on screen (s05 exact 100 for "about a hundred billion", claims c5 disputed) | pass disputed claims into the scene prompt; guard: a disputed number on screen needs ~ / ABOUT / a range |
| 10 | medium | 4/7 fix turns are sfx sync; s10's fix drops every kit cue 150–500 ms from a word | anchors check: kit-generated cues (`r.cues`) are free cues unless the scene anchors them; only the slam/ring cue is checked |
| 11 | medium | critic misses seams (ghost, hidden beat, double slide), raises false "missing boss" on frames before the beat; final review drops a build ⚠ silently | sample frames after each anchored beat and at transition midpoints; show the critic the film frames (with transitions), not only the scene's; keep unresolved build ⚠ in the final list |
| 12 | low | BOSS label types over the HUD year at top-left (s02 7.1–7.3) | boss card min y below the HUD band, or the year moves right while a card is up |
| 13 | low | room-shake transition used between two TV-only shots (no room to shake), full-frame flash | validator: room-shake only when either side shows the room |
| 14 | low | FIG. 1 decorative (two star boxes in an empty panel); margin note used for a source URL | prompt: the figure shows the rule's nouns; margin note = Dad's word, never a source |
| 15 | low | B1 fonts lack `$` and `=` | add `$`, `=`, `%` glyphs to Joy / Score Block / Rough Print |
| 16 | low | sound-cues turn swaps the world palette's `board-tap` (the knock) as "whiteboard" (also in B2) | tell the sound-cues prompt the world palette's names are intended |
| 17 | low | engine harness not rebuilt by `tsc -b` / `build:cli` (stale before the run), and it bundles live `kit/src`, so a parallel coder's uncommitted kit edits leak into a real run's frames and export | `check:cli-bundle` (or a sibling) also checks `out/harness` freshness; real runs pin a harness build (or run from a clean worktree of the commit) |

## Run notes

- Script 130 words (target ~125) after a trim turn; hedged ("about a hundred billion", "estimates run three
  hundred to six hundred billion", the verdict left open). Open loops "was it all a false alarm?" (closed at
  47.2) and "what actually broke?" (closed at 33.7). Chapters: New Year's Eve / Zero Zero Mean / Midnight
  Came / Hundred Years Overdue (one weak title).
- Storyboard: 12 shots, A 5 / B 3 / C 4, 2 breakthroughs (manual s04, score-table s10), 1 continuity link.
- Sound: 25 sfx, `crt-hum` ambience, music bed `tense-investigation` (changed by the sound-cues turn);
  not listened to.

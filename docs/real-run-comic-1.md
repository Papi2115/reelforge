# Real run Comic 1: first Comic film on the subscription (PLAN.md#13.10, Comic round 1)

Date: 2026-10-07 · Claude Code CLI on the user's subscription (sanitized env, every turn
`apiKeySource: none`) · Windows 11 · run by the Coder through the stage code like the
[Sketchbook rounds](real-run-sketchbook-3.md): `StageRunner` with `experimentalWorlds: true`,
**`worldQuotaOverride: { minBreakthroughs: 2 }` (test only)**, `maxFixIterations: 1`, concurrency 2;
`checkSources`, `proposeMoments` (`cameraHints: PAGE_CAMERA_HINTS`, all accepted), `exportVideo`,
`buildPublishKit`. Code: `phase-13/v3.1` at fe2f89b (+ other coders' uncommitted Game B1/B2 work in
the tree), **no code changed**. Before the run: `pnpm exec tsc -b` (clean), `pnpm build:cli` +
`pnpm check:cli-bundle` ("up to date"); dist contains `prompts/dist/worlds/comic-moments.js`,
`kit/dist/worlds/comic/breakthrough/flashback*.js`, `flashback` in `cli/dist/reelforge.mjs` (32×).
Project made by `createProject` (style `comic`): `lookMode mixed`, `continuityLinks: true`,
`antiSlopGuards: true`, `characters classic`, `mascot none`; research mode off. Driver:
`scratch/real-run-comic-1/` (gitignored: `drive.mjs`, `synth.ps1`, `sheets.mjs`, `strips.mjs`,
`zoom.mjs`, `slopcheck.mjs` + logs).

Topic (fixed random pick): the Piltdown Man hoax (1912). EN, SAPI David rate +2, lead 0.8 s /
paragraph 0.6 s / tail 0.8 s → **61.7 s** (script 142 words, 22 % over the 50 s target);
whisper large-v3-turbo-q5_0 (9.5 s, 93 % coverage). Claims check: 12 claims, 11 sourced,
1 disputed ("orangutan's jaw": one summary said chimpanzee teeth) — left as is (no user step).

Output: `C:\Users\galar\Desktop\ReelForge-test-films\comic-test-1.mp4` (61.0 s, 1920×1080 30 fps
H.264 NVENC + AAC 48 kHz stereo, **60.9 MB** — 3.6× the Sketchbook film per second: the halftone
screens are expensive to encode; decodes cleanly), `…\comic-test-1-contact-sheet.png`,
`…\comic-test-1-transitions.png`, publish kit `…\comic-test-1-publish\`; project
`…\comic-test-1 work\Piltdown Man Hoax\`. Opened: all 13 eight-frame strips
(`scratch/real-run-comic-1/strips/strip-*.png`), both sheets, full 1080p frames at 0.8, 26.8, 31.9,
39.3 and 55.5 s (`…/zoom/`).

## Answers to the mandatory checks

### 1. Breakthroughs and page moments

| Moment | Shot / time | `intent` | What it shows | Verdict |
| --- | --- | --- | --- | --- |
| **flashback** (breakthrough) `cover: 'strip'`, `arrange: 'rows'`, `when: 'IN 1912...'` | s09_forgery_strip 36.23–39.65 (page-back turn 0.9 s; strip from ~36.9) | "the specimen was a human skull joined to an orangutan's jaw, the jaw stained brown" | a torn sepia strip pasted vertically over the dark s08 desk; beat 1 "human skull" (a beige potato with a rectangle, **no eye sockets**), beat 2 "ORANGUTAN'S JAW," (slab with triangle teeth) that darkens to a checker stain on "stained brown"; red pencil loop on the junction, pencil arrow to the stain | **meaningful intent, weak picture.** Not a template (strip + rows differs from f1 page+rows and f2 strip+row), no invented element. But the skull does not read as a skull (`zoom/f39.png`), the camera is pushed in so the `when` caption and the present page are cropped, "A HUMAN SKULL," floats outside the strip on the dark page, and it is not a *look back* — the narration states the 1953 verdict, so "flashback" is a stretch. Holds: 3.4 s, beats at 37.4/38.9 — no > 4 s hold. |
| **spread** (breakthrough) `assemble: 'pull-back'`, `focus` on the skull | s13_fake_spread 56.87–60.99 | "the whole hoax on one picture: the gravel pit, the textbooks, Dawson and the file torn in around the giant skull on its ape jaw, FAKE standing in the gravel" | opens close on the skull's eye sockets, pulls back across the fold; 4 torn scraps (pit, textbook, Dawson silhouette, file) arrive around a big skull on a grey jaw; FAKE stands up in the gravel on "fake" with a red underline; "FOUR DECADES." caption | **meaningful and original** — a recap of the film's own objects (callbacks), every element was narrated. Fold/spine crease barely visible (critic said so). Opening 0.3 s is a small panel on an empty page. Beats 58.3 / 59.5 / 60.2 → no > 4 s hold. |
| cutaway | s07_fluorine 29.23–32.47 | – | skull + jaw "torn open" (dark disc with one dot, a dark crescent), SKULL/JAW labels on leaders, 2 gauges, red X on "didn't match" | **the gauges contradict the research** (see §5 / defect 1); the torn-open inside does not read; dark labels on navy |
| impact-break | s08_verdict 32.47–36.23 | – | calendar tears 1949 → 1953, report slams in, SLAM breaks the border, red FAKE stamp | works; right panel is an empty outline for the first 1.9 s |
| pause-panel | s12_not_proven 51.35–56.87 | – | flat grey panel held 1.9 s, CLANG (cropped), big red "?", DIED 1916., a "…" balloon pointing off-panel | the pause reads; the "…" balloon for "he isn't talking" is a real joke; flat grey with no halftone (critic: vibe) and centred |
| palette-shift (`moments.json`) | s06 25.51–26.01 | – | render effect | hidden under the gutter wipe; barely visible |

Mechanisms differ (one flashback, one spread). Invented elements in the breakthroughs: none.

### 2. Variety

| Shot | t0–t1 | Roll / look | Panels (custom quads) | Moment | Transition in |
| --- | --- | --- | --- | --- | --- |
| s01 hook | 0.00–4.93 | C loud | 1 | – | – |
| s02 gravel_pit | 4.93–9.77 | A story | 3 | – | cut |
| s03 dawn_man | 9.77–15.99 | B info | 2 | – | **continuity zoom-through** (skull) |
| s04 doubters | 15.99–19.93 | A story | 3 | – | cut |
| s05 two_questions | 19.93–25.51 | C loud | 2 | – | cut |
| s06 giveaway | 25.51–29.23 | A story | 2 | (palette shift) | comic-gutter-wipe |
| s07 fluorine | 29.23–32.47 | B info | 2 | cutaway | cut |
| s08 verdict | 32.47–36.23 | A story | 2 | impact-break | cut |
| s09 forgery_strip | 36.23–39.65 | B info | 1 + strip | **flashback** | comic-page-back |
| s10 teeth_filed | 39.65–44.23 | A story | 2 | – | cut |
| s11 dawson_study | 44.23–51.35 | B info | 3 | – | cut |
| s12 not_proven | 51.35–56.87 | C loud | 1 | pause-panel | comic-panel-slam |
| s13 fake_spread | 56.87–60.99 | C loud | spread | **spread** | cut |

Rolls 5 A / 4 B / 4 C, never > 2 in a row; 5 moment kinds; 4 distinct non-cut transitions.
**Layout presets: used 0/13** — every page is a custom `page.panel(quad)`, and 5 pages (s05, s06,
s07, s08, s10) are the same "two panels side by side, the right one arrives later" grammar.
**Near-empty panels** (ruled outline, no content) on screen: s04 1.4–2.5 s, s08 0–1.9 s, s11
0–3.0 s, s03 ~12.9 s (one book in a wide empty panel), s01 0–1.6 s (empty halftone sky, "IN" and
a ghost pencil "1912", `zoom/full-0.8.png`). Panel counts never exceed 3; no identical grids;
s03 has a row of 6 identical textbook icons (icon row). Boring? Structurally less than Sketchbook
1–2 (looks, moments, transitions vary; real gags in s04 and s12), but the empty-panel openings make
4 shots start dead.

### 3. Panel grammar

- **Gutters**: uneven and leaning everywhere (custom quads), good. One panel breaking the frame:
  SLAM (s08), CHINK (s02), FAKE (s13).
- **Balloons**: 4. s04 "IT'S WRONG!" tail at the speaker's head; s06 "HERE'S THE GIVEAWAY." tail at
  a faceless hexagon head; s10 "SO, WHO DID IT?" **tail points at nobody** (an empty panel);
  s12 "…" tail off-panel on purpose (works).
- **Onomatopoeia**: CHINK (s02 — **also an ethnic slur**, unacceptable on YouTube), LA LA LA (s04,
  the best gag), SLAM (s08), SKRRT (s10, on the file; teeth visibly shorten — the best action),
  CLANG (s12); s05 uses sfx lettering for two questions at once (two loud words, crowds the hat
  figure, "MADE IT?" overlaps it).
- **Halftone**: heavy on every page (also the reason for the 61 MB file); misregistration visible
  only as the offset shadow of sfx/digit letters, not on colour plates. **Speed lines**: 1 call
  (s08), not visible in the frames.
- **Lettering at 1080p**: legible; the small pixel face's W reads as N ("GIVEANAY",
  "EN.NIKIPEDIA"); captions/labels type letter by letter (`type: 0.3`), so mid-frames show
  "CHARL / DA", "MO", "THE MISSING" — reads as a typewriter, not hand lettering.
- **Camera** (unlike Sketchbook it works): used in 12/13 shots, reads panels and pushes in, but
  **crops lettering 3×**: CHINK → "NK" for 1.5 s (s02), "WHAT GAVE IT AWAY?" → "AY?" (s05), 1953 →
  "953" (s08).
- **Text provenance**: invented "IT'S WRONG!" (s04), "MOST LIKELY" drawn as a ~90 % bar (s11, a
  quantity nobody said), "40 YEARS" drops the narration's "about" (s03), **inverted gauges** (s07).
  "ENGLAND, 1912." is a fair derivative of "English". URL credit chips on 5 pages (EN.WIKIPEDIA.ORG,
  RESEARCHONLINE.LJMU.AC.UK).

### 4. Continuity links

Planned **1** (s02 → s03 `zoom-through`, object: skull), rendered **1** (final review: "1 link
planned, 1 rendered"). Frames: the camera dives into s02's skull and crossfades onto s03's museum
skull (transitions sheet row 1); the landing skull is smaller and off-centre at 0.75, so the match
is a dissolve rather than a hit, but it reads.

### 5. Guards and critic

- **Guards (⚠ in final review: 4 shots)**: s02 invented "ENGLAND, 1912." (false positive:
  "English" is narrated) + "CHINK" (true problem, wrong reason: it is a slur, not an unknown
  word); s04 "IT'S WRONG!" (true) + "LA LA LA" (false: sound word); s10 "SKRRT" (false: sound
  word); s12 symmetry 0.81 (true: the "?" sits in the middle). During build also s05 clutter 7
  (true-ish: two loud words + figure). The sound-word list is closed (`world-labels.ts`
  COMIC_SOUNDS), so any fresh onomatopoeia is "invented text".
- **Probes** (`slopcheck.mjs`, `slopcheck.out`): flashback intent "a pretty decoration…" and an
  ungrounded intent → caught (fixed since Sketchbook 3); "BY 1950," and "FLUORINE 62%" → caught;
  ZORBLAX/SCRAPE/CLINK → all "invented" (CLINK too). Replacing s09's options with the f1 template's
  `cover page + arrange rows` → no finding (the mechanism check is film-wide only).
- **Missed by guards**: inverted gauges (s07), the "MOST LIKELY" bar, lost hedge "40 YEARS",
  empty-panel openings, cropped lettering, the slur.
- **Critic (Haiku)**: 16 critic + 3 final critic turns. **It caused the worst error of the film**:
  s07's builder (Opus) read `research.md` ("the jaw had far less fluorine than the skull") and drew
  skull high / jaw low against the storyboard; the critic judged against the storyboard intent
  ("Gauges inverted: skull … should be low") → `off-intent` → the fix turn flipped them back,
  saying in its reply "this direction contradicts your research notes … the intent and the critic
  need correcting, not the scene" — and the shot ended ✓. True positives: s02 CHINK clipped,
  s03 "DAWN-M" half-typed, s04 empty panel, s13 spine crease missing. False/odd: s12 "Clean digital
  3D render" (it is a flat grey panel — the halftone-less part is right, the wording wrong); s06's
  fix turn was spent rewriting the `// focal:` comment. Traces it names are still mostly chrome
  (halftone dots, panel borders, gutters) despite the checklist.
- **Triage** (final review): s01 "THE MISSIN" (real: inking too slow; fixed), s02 caption drifting
  out (fixed); s08 anchor "in" resolved to the film's first word (local −31.86 s; fixed to
  "was in").

### 6. Quality (QUALITY.md §7)

| Shot | Score | Note |
| --- | --- | --- |
| s01 | 14 | strong red off-register 1912 + THE MISSING LINK, but the hook is an empty halftone panel for 1.6 s |
| s02 | 15 | crude bowler-hat diggers, skull panel push-in; CHINK (slur) cropped to "NK"; skull not "half ape" |
| s03 | 15 | link lands, DAWSON'S DAWN-MAN card good; row of 6 identical books, empty pan frame, "40 YEARS" loses "about" |
| s04 | 16 | LA LA LA silhouettes = real comic gag, crude charm; empty panels 1 s, invented "IT'S WRONG!" |
| s05 | 14 | two loud questions at once, letters over the hat figure, cropped by the camera |
| s06 | 15 | lamp + gloved hands + jaw + balloon; faceless hexagon head, both panels the same jaw |
| s07 | 11 | **contradicts the research** (fails §5 content), skull = dark disc, labels dark on navy |
| s08 | 16 | calendar tear, SLAM, FAKE stamp — clear hit; right panel empty 1.9 s, "953" crop |
| s09 | 13 | flashback with a real claim, but the skull is a potato and the focal is unclear |
| s10 | 17 | teeth visibly filed flat under SKRRT — the best shot; balloon tail at nobody |
| s11 | 15 | charming Dawson; 3 s of empty panels, invented ~90 % "MOST LIKELY" bar |
| s12 | 15 | pause → CLANG → "?" + "…" joke; flat grey, centred, CLANG cropped |
| s13 | 17 | spread recap with callbacks, FAKE standing in the gravel; fold barely visible |

**Mean 15.2/20** (Sketchbook rounds 16.6 / 16.8 / 16.25; comic showcase 17–19). One shot below the
14 fail line (s07) and one at the line twice (s01, s05). Deliberate roughness **is preserved** and is
the best part: crude bowler-hat figures, Dawson's moustache, silhouettes covering their ears, the
filed teeth. What costs points is drawing legibility of the key objects (skull in s07/s09), empty
panels, and content errors.

### 7. Wall clock, turns, cost

`costUsd` = project ledger deltas (list-price meter, not a bill). 59 rate-limit events, all
`allowed`; `limitHits: 0`; no hang, no frame-render timeout.

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 64 s | 2 Sonnet | 7.2 k | 0.26 |
| claims check | 7.6 s | 1 Sonnet (12 claims, 1 disputed) | 0.9 k | 0.06 |
| voiceover / clean / words | 0.5 / 3.6 / 9.5 s | – | – | – |
| storyboard (+ tension, loops) | 145 s | 3 Sonnet (no repair) | 16.8 k | 0.41 |
| scenes build | **1591 s (26.5 min)** | 13 build + 8 fix (Opus), 16 critic (Haiku) | 225 k | **10.95** |
| final review | 281 s | triage + 3 fix + 3 critic | 25.1 k | 0.88 |
| sound-cues / mix | 33 / 9.4 s | 1 Sonnet | 1.6 k | 0.09 |
| export | 85 s (1830 frames, 2 workers, SwiftShader) | – | – | – |
| **Total** | **~37 min of stages** | **51 turns** | 277 k | **12.66** |

$0.97 per shot (Sketchbook 3: $0.78). Scene turns used 58 `reelforge frames`, 42 `kit-docs`, 31
lint, 28 anchors, 165 Read, 105 Edit. **Export encoder:** `h264_nvenc` probed ok and opened on the
first try, 0 export warnings, no libx264 fallback.

### 8. Crashes and errors

- **s08: `page.sfx('SLAM', { rise: 4 })` crashed the scene at render** (the kit wants a per-letter
  array); `reelforge lint` passed it with 0 errors. Fixed in the fix turn.
- **Harness build broken by a concurrent coder** (~13:12–13:15): `game-b1/screen/model.ts` imported
  missing `../seams/cartridge.js` / `calendar-zoom.js`; `reelforge frames` and `anchors` failed in
  the s07 build and the s08 build + fix turns (they shipped unverified; the stage QA renderer still
  rendered them). Environment issue of this run, but every scene turn rebuilds the harness from
  the whole kit source, so any broken world breaks every world.
- No unknown-style or CLI errors; storyboard got 3 false `transition-focus` warnings (the Comic
  prompt asks for `focus` on its wipes) and one tension-tempo warning.

## Top 5 findings

1. **The critic overrode the research and made the film wrong**: s07's builder followed
   `research.md`, the Haiku critic enforced the storyboard's inverted fluorine levels, the fix turn
   complied (and said so) and the shot passed ✓. The storyboard (Sonnet) invented the direction.
2. **CHINK as an onomatopoeia** (s02) — a racial slur on screen for 4 s in a YouTube film; the guard
   flagged it only as "invented text", alongside harmless LA LA LA/SKRRT, so the warning is noise.
3. **Comic grammar works where it is simple**: LA LA LA silhouettes, filed teeth under SKRRT,
   calendar tear + SLAM + FAKE, the "…" balloon, the spread recap with callbacks, 1 continuity link,
   4 panel-native transitions, crude charm intact.
4. **Empty panels and cropped lettering**: 5 shots open on ruled but empty panels (0.6–3 s), the
   hook is a blank halftone page for 1.6 s; the page camera crops lettering in 3 shots; layout
   presets are never used and 5 pages share one 2-panel grammar.
5. **Breakthroughs are meaningful but small**: the flashback's skull is unreadable and its strip is
   cropped by the camera; the spread is the best page of the film. Quality mean 15.2 — below every
   Sketchbook round; cost $12.66 for 61 s.

## Defects and suggested fixes

| # | Sev | Defect | Suggested fix |
| --- | --- | --- | --- |
| 1 | high | Critic judges facts against the storyboard intent, not the research; a research-grounded deviation gets flipped back (s07) | critic prompt: when the builder states a research-based deviation, judge against `research.md`; fix prompt: never undo a research-grounded change on a critic note — report it as ⚠ instead; storyboard prompt: quantitative directions only from research |
| 2 | high | Slur as onomatopoeia (CHINK) passes as a mere "unknown word" | denylist of slurs/offensive words for all on-screen text (sfx included) → error, not ⚠; Comic prompt: list safe impact words |
| 3 | high | Empty ruled panels / blank hook for 0.6–3 s (s01, s03, s04, s08, s11) | kit: a panel's border appears with its content (`enter` draws frame + art together) or a pencil rough fills it; craft brief: the first 0.5 s shows the focal or ≥ 3 elements; frame guard "near-empty page > 0.6 s" |
| 4 | medium | Page camera crops lettering (CHINK→NK, AY?, 953) | `page.camera` clamps so lettering boxes stay inside the view, or a lint/frames check for cropped lettering at keyframes |
| 5 | medium | Sound-word guard: closed list → false positives (LA LA LA, SKRRT, CLINK) that bury real ones | accept any `sfx`/`bigLetter` text that is letters only (with denylist #2); keep the provenance check for balloons/captions |
| 6 | medium | Key objects unreadable (skull = potato/dark disc in s07, s09) | kit: comic-drawn skull/jaw/common props or a "readability" critic line ("can you name the hero object?"); brief: draw the object's defining features (eye sockets, teeth) |
| 7 | medium | `sfx({ rise: 4 })` crashes at render; lint passes | validate page lettering options (zod) in lint/kit with a clear error |
| 8 | medium | Every scene turn rebuilds the harness from the whole kit; one broken world (game-b1 in progress) breaks frames/anchors for all | build per-world entry or fail soft; at least report "harness build failed (kit source)" distinctly so turns don't waste time |
| 9 | medium | Invented quantities: "MOST LIKELY" ~90 % bar, hedge dropped ("40 YEARS" vs "about forty") | text guard: keep hedges of a number from the narration; prompt: never draw a quantity the narration does not give |
| 10 | low | Layout presets used 0/13; 5 pages share one 2-panel side-by-side grammar | storyboard/scene prompt names a layout per page; variety check on panel grammar |
| 11 | low | Two loud words at once (s05), balloon tail at nobody (s10) | craft brief already forbids; add both to the critic checklist examples |
| 12 | low | Anchor phrases resolve to the first occurrence in the film ("in" → 0.61 s) | page `at: 'phrase'` prefers the occurrence inside the shot |
| 13 | low | Small pixel W reads as N (GIVEANAY, EN.NIKIPEDIA); letter-by-letter typing of captions | fix the small W glyph; default caption reveal = whole words |
| 14 | low | Storyboard false `transition-focus` warning for comic wipes (prompt asks for `focus`) | allow `focus` for comic-gutter-wipe/page-back/panel-slam in the validator |
| 15 | low | MP4 61 MB for 61 s (halftone noise) | export preset: slightly higher CRF/CQ for comic, or render halftone at a coarser, stable cell |
| 16 | low | Script 142 words for a 50 s target → 61.7 s | script prompt word budget from target × ~2.3 words/s for SAPI-like voices |

## Run notes

- Script hedged ("about forty years", "Most likely. Not proven."); open loops "what gave it away?"
  (closed 29.39) and "who made it?" (closed 45.81). Chapters: British Scientists Announced / Doubted /
  Giveaway / Human Skull (weak). Mix −14 LUFS, −1.91 dBTP; 33 sfx, 5 SFX repetitions open.
- One dramaturgy moment proposed (palette shift at s06), hidden under the gutter wipe.
- The research note "fluorine testing (1949) showed the jaw had far less fluorine than the skull" is
  itself worth a human check (historically the 1949 test dated the remains as recent; the
  skull/jaw mismatch was established in 1953) — the claims check accepted it as sourced.

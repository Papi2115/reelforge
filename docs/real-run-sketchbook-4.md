# Real run Sketchbook 4: open vocabulary on a medieval village (PLAN.md#13.15, phase 3)

Date: 2026-10-07 · Claude Code CLI on the user's subscription (sanitized env, every turn
`apiKeySource: none`) · Windows 11, three other world films running concurrently · run by the Coder
through the stage code like [round 3](real-run-sketchbook-3.md): `StageRunner` with
`experimentalWorlds: true`, **`worldQuotaOverride: { minBreakthroughs: 2 }` (test only)**,
`maxFixIterations: 1`, concurrency 2; `checkSources`, `proposeMoments` (page camera hints, all
accepted), `exportVideo` (manifest now carries `worldAssets`, like `project-manifest.ts`),
`buildPublishKit`. Code: `phase-13/v3.1` at e04515c + the concurrent coders' uncommitted work + **one
prompt fix from this run** (below). Before the run: `tsc -b`, `pnpm build:cli`, `pnpm
check:cli-bundle` ("up to date") after `packages/*/dist` was stable for 9 min. Driver:
`scratch/real-run-sketchbook-4/` (gitignored: `drive.mjs`, `synth.ps1`, `sheets.mjs`, `strips.mjs`,
`slopcheck.mjs`, `results.mjs`, `run-log.jsonl`).

Topic (packet): "How a medieval village survived winter: food, firewood and the long dark". EN, SAPI
David rate +2, lead 0.8 s / paragraph 0.6 s / tail 0.8 s → 51.8 s; whisper large-v3-turbo-q5_0 (9.6 s,
133 words, 89 % coverage).

Output: `C:\Users\galar\Desktop\ReelForge-test-films\sketchbook-test-4.mp4` (51.07 s, 1920×1080
30 fps H.264 NVENC + AAC, 24.5 MB, decodes cleanly), `…-contact-sheet.png`, `…-transitions.png`,
`…-assets-1..4.png` (the world-assets contact sheets), publish kit `…\sketchbook-test-4-publish\`;
project `…\sketchbook-test-4 work\Medieval Village Winter\`. Per-shot 8-frame strips in
`scratch/real-run-sketchbook-4/strips/`; every claim below was checked on them.

## Blocking failure and fix (first scenes attempt)

**Symptom:** s01 (C, `sketch-loud`) and s02 (B, `sketch-graph`) rendered blank frames (94 % one
colour) in `reelforge frames`; both builders and both fix turns concluded "renderer/kit bug" and gave
up (4 Opus turns, ≈ $2.1 wasted). The world-assets sheets rendered fine minutes earlier, and a kit
example rendered with `--shot s01_hook --scene <example>` was fine → the scenes, not the engine.
**Root cause:** the scenes never called `scene.add(page)`. Only the `sketch-story` look doc says
"`scene.add` it"; the `sketch-loud`/`sketch-graph` look docs, the Sketchbook world prompt, the
`kit-docs sketchPage` example and the world-assets snippet never say it (round 3's s01 prompt lacked
it too, Claude guessed right then). Comic/B1/B2 prompts all say it. **Fix (minimal):** the Sketchbook
HAND rule now starts "Build ONE page per shot: `scene.add(page)` in build() and `page.update(t)` in
update(t) (a page never added to the scene renders a blank frame)" (`packages/prompts/src/worlds/
sketchbook.ts`), assertion in `world-prompts.test.ts`, fixture `sketchbook-scene-build.txt` updated.
The scenes were reset to the storyboard placeholders (one commit in the video project) and rebuilt:
12/12 shots added the page, 0 blank findings.

## Answers to the mandatory checks

### 1. World assets (the open vocabulary)

`{ stage: 'scenes', action: 'world-assets' }` ran as its own step: 1 Opus design turn + 1 Haiku
critic, **22 assets ✓ on the first attempt** (no fix turn), 219 s, $1.07; `assets/cast.json` maps
each to its shots. Files (`assets/sketchbook/`): characters **farmer** (hood, beard, pitchfork),
**neighbour** (purple robe, brimmed hat, fat candle), **tenant** (green beanie, axe), **historian-a**
(blue suit, book), **historian-b** (orange vest, bun, scroll); animals **cow, pig, hen**; props
**haystack, salt-barrel, cooking-pot, hearth, stick-bundle, rushlight, fat-candle, straw-bed, shop**;
places **cottage, cottage-room, snowy-yard, winter-woods**; icon **snowflake**.

- **Different from earlier films/showcase: yes, fully.** Films 1–3 had no project assets (generic
  `figure()` stick people, text-heavy pages); the showcase vocabulary (calendar, sun, Caesar, Pope)
  and the kit's own `o4_village` example (well, church plan, roofs from above, windmill, top-down
  map) appear nowhere. The one calendar-ish page (s02 Michaelmas→Candlemas) is narration.
- **Used: all 22, by id** (`like:`/`use(`: hen 5, pig 4, farmer/cow/hearth 3, …; 0 inline
  `defineFigure/defineProp`). The farmer is the same drawing in 7 shots (s03/s04/s06/s12 recognisably
  so); the cooking pot carries the s06→s07 zoom-through. This is the biggest change vs films 1–3.
- **Recognisable at thumbnail (64 px sheets):** pig, hen, cow, cooking pot, hearth, haystack, candle,
  barrel, cottage, shop: yes. Figures read as people and are told apart by colour/hat. Weak:
  `cottage-room` (two thin lines + a window, near-empty), `straw-bed` (a plank + blob; reads as a bed
  only with a head on it, s09/s10), `winter-woods` (three faint conifers, "bare trees" in its notes),
  `snowflake` (asterisk). **Sheet bug:** on sheet 3 the wide places (snowy-yard) overlap stick-bundle
  and straw-bed into one tangle — and the Haiku critic still passed the set.
- Drift: s06 drew the farmer by hand "from the asset's look" to swap the pitchfork for a stirring stick
  (no `like:`), s09 drew his head as a doodle (round face, no hood/beard: reads as another person).

### 2. Page moments: pop-up/accordion, `intent`, mechanism

| Moment | Shot / time | `intent` | Mechanism / what moves | Verdict |
| --- | --- | --- | --- | --- |
| **pop-up** (`page.popup`, breakthrough) | s05 17.96–23.84, pull 0.2 s after "slaughtered" | "on Martinmas the pig is slaughtered: the ribbon swings the flap open on the pig and the salt barrel" | ribbon → `flap` (veil) opens on a sticky card SLAUGHTERED, red loop on it; pig + barrel drawn on the card's base, SALTED/SMOKED/DRIED ticked in red | **weak, and the intent lies**: the flap reveals a word, not the pig (Claude says pop-up pieces cannot carry the film's drawings, so it put them on the base). The mechanism is the same flap-veil reveal as film 3's "THE ANSWER". Card reads as a taped kraft panel, not a pop-up; pull tab travels a few px. 4 red elements (loop + 3 ticks). No invented element. |
| **strip** (planned breakthrough) | s02 4.32–8.24 | – | **not built**: the turn judged `page.strip` needs ≥ 4 s for two events and the shot is 3.92 s, so it drew a ruled ballpoint timeline + red ring | lost breakthrough: the storyboard put a strip in a 3.9 s shot and nothing checks a minimum length (I found no hard limit in the kit either: Claude's own estimate) |
| sticky-slap (C moment) | s10 40.82–44.04 | – | sticky TWO HALVES slapped and lettered, page split, farmer asleep twice, candle between, red "quiet hour" | clear, meaningful |
| slow-motion (`moments.json`) | s10 41.12–42.13, rate 0.4 | – | render effect | present |
| continuity zoom-through | s06→s07 | – | camera dives into the cooking pot, s07 opens on the same pot (same asset) | **the best cut of the film** (transitions sheet row 2) |

Never the same mechanism twice: trivially true (one pop-up). **Guard probe:** replacing s05's intent
with "a pretty decoration" still passes (round-3 defect #8 open); an invented card word ZORBLAX is
caught.

### 3. The hand

- `scene.add` 12/12 (after the fix), `duration: ctx.shot.duration` 12/12, `hero: true` 11/12,
  `appear` in 12/12 scenes (71 calls): animals, labels, sources and backdrops bloom in while the hand
  draws the farmer, the hero word or the red mark. No handless stroke-by-stroke writing seen.
- Hand draws key elements: yes (5 MONTHS, figures, HARD CHOICE underline, POTTAGE, ESTOVERS, the
  rushlight, the neighbour). s03's big HARD CHOICE *appears* by itself while the hand draws the
  farmer (acceptable by policy, but the loud word loses its writing).
- Last 0.4 s: 10/12 clean; s04 (farmer) and s08 (neighbour) keep the hand on the subject until
  ≈ t1−0.35 s, gone by t1−0.05 (same borderline as round 3).
- Narration cut because writing was slow: none. Openings: s09's first build had a blank t=0 (all
  fades from 0), fixed in its QA round with `appear: 'pop'`; no other empty openings (s01 starts
  writing at 0.17 s).
- Camera: storyboard asked for pushes in 6 shots; every scene dropped them ("flat page, no camera
  move") — round-3 defect #3 still open, but no turns were wasted on it this time.

### 4. Variety

| Shot | t0–t1 | Roll / look | Layout / stock | Moment | Transition in |
| --- | --- | --- | --- | --- | --- |
| s01 hook | 0.00–4.32 | C loud | big-number, lined | – | – |
| s02 calendar_span | 4.32–8.24 | B graph | graph | (strip lost) | cut |
| s03 hard_choice | 8.24–13.80 | A story | wide-strip | – | cut |
| s04 not_enough_fodder | 13.80–17.96 | A story | facing | – | cut |
| s05 martinmas_popup | 17.96–23.84 | C loud | lined | **popup** | tape-peel |
| s06 pottage | 23.84–28.16 | A story | hero-left (interior) | – | cut |
| s07 estovers | 28.16–32.54 | B graph | graph + index card | – | **continuity zoom-through** |
| s08 rushlights | 32.54–37.62 | A story | facing (dark hatch) | – | cut |
| s09 strangest_part | 37.62–40.82 | A story | close-up (dark hatch) | – | cut |
| s10 two_halves | 40.82–44.04 | C loud | lined split page | sticky-slap (+slow-mo) | torn-strip |
| s11 debated | 44.04–46.90 | A story | facing | – | cut |
| s12 twelve_days | 46.90–51.05 | A story | landscape | – | page-flip |

Never > 2 shots in one look; 7 layouts/compositions (interior, dark page, close-up, split page,
landscape) — less "everything on one ground line" than round 3, though s03/s04/s11/s12 still are.
4 page-native transitions (the same 4 styles as round 3). Breakthroughs delivered: **1 of 2** planned.

### 5. Guards and critic

- Guards: **0 findings** on 12 scenes (stage + `slopSourceFindings` re-run). **False negatives:**
  s11 pencils "fact" and crosses it out in red (not in the narration: an invented correction, like
  round 3's "19"); s05 intent/reality mismatch; s05/s12 red used for labels (POTTAGE, 12 DAYS,
  "strangest part?" are not corrections).
- Critic (Haiku): 11 ✓ + 1 `off-intent` on s01 ("5 MONTHS is a clean digital font") that is wrong
  (it is the marker hand font) and did not change the status; s09 first round flagged the blank t=0
  correctly. It still lists chrome ("spiral binding") as traces. World-assets critic: 0 findings
  despite the overlapping sheet 3 and the near-empty cottage-room.
- Storyboard warnings: s11 2.86 s shot, two tension-tempo notes. Claims check: 11 claims, **4
  disputed** (fodder cause ×2, "salted, smoked or dried" Tudor source, rushlight source weak) — left
  as is for the test (in the app the user decides). Script hedges "That idea is debated, though."
- Final review: triage 0 suspects, "1 link planned, 1 rendered". Sound: 18 sfx, 3 repetitions open;
  mix −13.98 LUFS, −2.29 dBTP.

### 6. Quality (QUALITY.md §7)

| Shot | Score | Note |
| --- | --- | --- |
| s01 | 17 | crooked marker 5 MONTHS, the film's tiny shop crossed in red, NO SHOPS; hand starts at once |
| s02 | 14 | lost strip; sparse pale ballpoint timeline, big coffee ring, red ring around a line |
| s03 | 17 | farmer + cow/pig/hens + wattle fence in snow, HARD CHOICE; ground-line composition |
| s04 | 16 | herd vs haystack, red NOT ENOUGH; size contrast mild; farmer last, hand parks on him |
| s05 | 15 | 11 NOV huge; pop-up = flap reveals a word; intent mismatch; 4 red elements |
| s06 | 17 | cottage interior, pot over hearth, steam; farmer drawn body-first; red as a label |
| s07 | 17 | the zoom-through pot lands; tenant + sticks + woods + ESTOVERS card, red "dead wood only" |
| s08 | 16 | the dark page reads; rushlight vs neighbour's candle crossed; candle tiny |
| s09 | 15 | close-up head reads as another person; asleep→awake; red as a label |
| s10 | 17 | sticky TWO HALVES, split page, two sleeps, candle, quiet hour: the idea is clear |
| s11 | 15 | two historians arguing, DEBATED; invented "fact" correction |
| s12 | 17 | warm whole-cast ending around the fire, 12 DAYS, work struck, survived together |

**Mean 16.1/20** (round 3: 16.25; showcase 18–19). Deliberate roughness preserved.

**Honesty verdict (1–10):** open vocabulary **8/10** — it works: a cast and props designed for THIS
narration, all used by id, consistent across shots, zero showcase objects; weak spots are a few
near-empty places and a sheet the critic should have failed. Sketchbook rules **5/10** — hand rules
hold, variety OK, but the breakthroughs regressed (strip dropped for length, pop-up is a word reveal
whose intent misdescribes it, no guard caught either). Film overall **6.5/10**: the most
*specific* Sketchbook film so far, not yet a better one per page.

### 7. Wall clock, turns, cost

`costUsd` = project ledger (list-price meter, not a bill). 0 limit hits, all rate-limit events
`allowed`; no hang, no render timeout.

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 91 s | 3 Sonnet | 11.5 k | 0.37 |
| claims check | 18 s | 1 Sonnet | – | 0.06 |
| voiceover / clean / words | 0.6 / 2.9 / 9.6 s | – | – | – |
| storyboard (+ tension) | 190 s | 2 Sonnet | 13.2 k | 0.39 |
| **world-assets** | 219 s | 1 Opus + 1 Haiku | 21.2 k | 1.07 |
| scenes, attempt 1 (blank pages, killed) | ≈ 6 min | 4 Opus | – | ≈ 2.08 |
| scenes build | 1387 s (23 min) | 12 build + 2 fix (Opus), 13 critic (Haiku) | 154 k | 8.45 |
| final review | 107 s | 1 triage | 5.9 k | 0.06 |
| sound-cues / mix | 30 / 6.6 s | 1 Sonnet | 1.9 k | 0.10 |
| export | 120 s (1532 frames, 2 workers, h264_nvenc first try, 0 warnings) | – | – | – |
| **Total** | **≈ 37 min of stages** (+ 6 min wasted) | **41 turns** | 229 k | **12.58** |

$0.70/shot for scenes (round 3: $0.78) + $1.07 for the assets. Scene turns: 56 `reelforge frames`,
35 `kit-docs`, 24 lint, 20 anchors, 139 Read, 75 Edit.

## Defects and suggested fixes

| # | Sev | Defect | Suggested fix |
| --- | --- | --- | --- |
| 1 | high (fixed) | B/C Sketchbook scenes omitted `scene.add(page)` → blank frames; turns blamed the engine | prompt fix done; also add "`scene.add` it" to the sketch-loud/sketch-graph look docs and the `kit-docs sketchPage` example, and a lint/QA hint "a kit page was created but never added to the scene" |
| 2 | high | Storyboard planned a strip in a 3.9 s shot; the scene dropped the breakthrough | storyboard validator: minimum shot length per world moment (strip, popup), or extend the shot |
| 3 | high | Pop-up intent describes a motion that does not happen (flap reveals a word, not the pig); pop-up elements cannot carry the film's assets | critic/guard compares intent to the pull's targets; let popup elements take `use`/`like` ids |
| 4 | medium | Pop-up mechanism repeats across films (flap-veil reveal, films 3 and 4) | prompt: a veil is the fallback, prefer a motion that moves a drawn subject |
| 5 | medium | World-assets sheet overlaps wide places with neighbours; critic passed it and a near-empty `cottage-room` | sheet layout: places on their own row/page; critic checks overlap and near-empty assets |
| 6 | medium | Invented correction ("fact" struck in s11) passes guards | flag struck-out words that are not in narration/research |
| 7 | low | Red used for labels (POTTAGE, 12 DAYS, strangest part?) and 4 red elements in s05 | accent guard: red only on the focal correction; count red marks per page |
| 8 | low | Hand parks on the subject until t1−0.35 (s04, s08) | as round 3 #7 |
| 9 | low | Cast drift: s09 redraws the farmer's head as a doodle, s06 avoids `like:` to change the held tool | allow `holds` override with `like:`; a head-only/close-up view of a cast figure |
| 10 | low | Haiku critic `off-intent` "digital font" on the marker hand font | add the hand fonts to the critic's Sketchbook notes |

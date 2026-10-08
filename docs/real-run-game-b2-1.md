# Real run Game B2 1: the first film in the first-person RPG world (PLAN.md#13.10, Game B2 round 1)

Date: 2026-10-07 · Claude Code CLI on the user's subscription (sanitized env, every turn
`apiKeySource: none`) · Windows 11 · a Comic real run shared the PC and the subscription until 13:34 UTC
(its scenes overlapped this run's script → scenes). Run by the Coder through the stage code like
[Sketchbook 3](real-run-sketchbook-3.md): `StageRunner` with `experimentalWorlds: true`,
**`worldQuotaOverride: { minBreakthroughs: 2 }` (test only)**, `maxFixIterations: 1`, concurrency 2;
`checkSources`, `proposeMoments` (`PAGE_CAMERA_HINTS`, all accepted), `exportVideo`, `buildPublishKit`.
Code: `phase-13/v3.1` at f45a3b1, **no code changed**. Before the run: `tsc -b` (clean), CLI bundle was
**stale** (`validate-level.ts` newer) → `pnpm build:cli`, then `pnpm check:cli-bundle` "up to date";
`reelforge validate level` present in the bundle (`validate --help` lists it). Project created with
`createProject({ style: 'game-b2' })` → world defaults (mixed looks, continuity links on, guards on, no
pack/mascot). Driver: `scratch/real-run-game-b2-1/` (gitignored: `drive.mjs`, `synth.ps1`,
`sheets.mjs`, `strips.mjs`, `zoom.mjs`, `slopcheck.mjs`, `transcripts.mjs`).

Topic (fixed random pick): the Great Stink of London, 1858. EN, SAPI David rate +2, lead 0.8 s /
paragraph 0.6 s / tail 0.8 s → 54.7 s; whisper large-v3-turbo-q5_0 on CUDA (8.2 s, 92 % coverage).

Output: `C:\Users\galar\Desktop\ReelForge-test-films\game-b2-test-1.mp4` (54.27 s, 1920×1080 30 fps
H.264 NVENC + AAC 48 kHz stereo, 52.8 MB), `…-contact-sheet.png`, `…-transitions.png`, publish kit
`…\game-b2-test-1-publish\`; project `…\game-b2-test-1 work\Great Stink of London\`. Per-shot 8-frame
strips (6 shares + t1−0.4 + t1−0.05 s) in `scratch/real-run-game-b2-1/strips/`, 0.1–0.2 s detail strips
in `…/zoom/` (`s02start`, `s03end`, `s08start`, `s09throw`); every claim below was checked on them.

## Answers to the mandatory checks

### 1. Breakthroughs and moments

| Moment | Shot / time | `intent` | What it shows | Verdict |
| --- | --- | --- | --- | --- |
| **automap** (planned breakthrough) | s08 32.26–36.68; unfold at 32.76, rooms 32.9–33.1, MAIN SEWERS on "Bazalgette" 34.1, note on "eighty-two" 35.2 | "three rooms walked; Bazalgette lays roughly 82 miles of main sewers under all of them" | 3 done rooms THE THAMES / THE COMMONS / BOARD OF WORKS (✓), a hatched dashed MAIN SEWERS gallery under them (sub BAZALGETTE), objective diamond, note "ROUGHLY 82 MILES" with a two-stroke arrow; `exit: 'cut'`, no fold | **meaningful idea, weak frame**: the labels recap the film's places (real continuity of story), but the rooms are 3 identical boxes of s08's own grid, not the levels walked; ~70 % of the frame is black and the map sits small; 33.1–33.5 is only thin lines (blank guard ⚠ true-ish). Original (not b2/b3 copied). No invented element. `strips/strip-s08_automap.png`, `zoom/s08start.png` |
| **tally** (planned breakthrough) | s12 49.08–54.26; cut in at 0, rows land 50.6 / 51.6 / 52.7, DONE stamp 53.14 | "the stink got the sewers built: 82 miles from 318 million bricks and £3 million, done by 1875" | SEWERS BUILT 1858–1875, SEWERS ~82 MILES, BRICKS ~318,000,000, POUNDS 3,000,000 (underlined), pink DONE stamp; `backdrop: 'dark'`, enter/exit cut | **meaningful** (sums the chapter), numbers tick unevenly, stamp lands on "done". But the card is small in the top-left of a **black** frame for the whole shot (the "finished sewer" level is never seen: the fix turn moved the card to t=0 to dodge a blank-frame finding); the film ends on 70 % black. Labels collide with "~" (`BRICKS~318,000,000`). |
| **tally (unplanned)** | s03 8.15–12.61 (storyboard: B menu, no moment) | "over two million Londoners flush straight into the Thames" | LONDONERS 1858 / FLUSHING ~2,000,000 over the live lane, 5 clerk sprites drop in, pink stamp INTO IT | the scene builder swapped `hud.menu` for `hud.tally` ("the stats menu can't tick a number") → **a third breakthrough, the same toolkit twice**, never checked by the variety validator (it reads the storyboard only). "INTO IT" is a meaningless fragment in the story's accent colour. The default `dissolve` exit **blacks out the whole frame** (live view included) 11.70–11.85 s (`zoom/s03end.png`). |
| **throw** (moment) | s09 36.68–41.48; release ~37.5 | "the city hands its waste on: 318 million bricks go down into the sewers that carry it downstream" | the hand lifts a paper `note` item labelled BRICK, tosses it, it lands as a small card on the sand; sand piles (clay) drop on "eighteen / million / bricks" | **decorative / confusing**: a paper card is not a brick, and "throwing bricks into the sewer" is not what the narration says (they were built from bricks). The toss itself reads (dip, swing, release, bounce). `zoom/s09throw.png` |
| boss-card | s04, s01 | – | THE STINK boss bar grows (0.45→0.85) on "out"/"Commons" | meaningful (the central problem); never defeated later — the film's payoff (sewers built) has no boss-down beat |
| dialogue | s05 17.71–22.81 | – | DISRAELI speaker plate + the quote typed | works; the speaker plate is tiny and Disraeli is the same clerk sprite as every MP and Londoner |
| quest-log | s06 22.81–27.64 | – | NOW: SUMMER 1858, the open question, DONE list, 3 inventory facts, toast HOLD THAT THOUGHT | reads; 4.8 s almost static; the toast overlaps the 3rd inventory slot |
| inventory-pick | s10 41.48–46.58 | – | hand takes the pink FOUL token on "miasma" (44.6–45.2), presents it | the take is shown (critic's "not depicted" is false) but the **level sprite stays on the floor** → two tokens on screen 45.5–46.6 |
| stinger | s11 46.58–49.08 | – | WRONG CULPRIT slams letter by letter, letters fall at 48.5 | works (the one stinger); the answer DIRTY WATER is only a 7 px toast |
| slow-motion (`moments.json`) | s11 46.58–47.67, rate 0.4 | – | render effect on "Wrong" | present |

4 s no-sound hold rule: no breach (tally s12 last number → stamp 0.4 s → end 1.1 s; s03 stamp → card
out 1.7 s; narration runs through every map/menu). **The map as continuity:** planned s07 → s08
`game-b2-map-unfold` (0.6 s). Rendered: the transition grows s08's *opening walk view* (an empty
checkered room, a third place) out of s07's minimap (32.3–32.9), then the automap unfolds again inside
s08 from s08's own minimap at 32.76 (the final-review fix moved it from 0.15 to 0.5 s). So the "map
grows out of the minimap" reads as a picture-in-picture zoom into an empty room, then a black box —
**half-rendered**. There is no fold back (s08 → s09 is a melt that melts the map, fine).

### 2. Levels and `reelforge validate level`

- Ran in **12/12 scenes, 28 calls**, every scene ended `ok` (`scratch/real-run-game-b2-1/validate-level.out`).
  **13 real errors caught and fixed** in 11 scenes: border not closed (s06, s09 ×3 rows 25 vs 24 cells),
  `cap: true` not a colour (s02), labels on sprites that carry none (clerk in s04/s05), labels too wide
  (OPEN SEWER, DOWNSTREAM, MIASMA, DIRTY WATER, > 12 chars ×2), wall `height` > 1 (s07), chalk `count`
  > 9 (s12). Messages are good sentences except the zod-path ones (`sprites.1.label: Too big: expected
  string to have <=12 characters`, `legend "W".height: Too big …`). No false error.
- **Derived from the narration: yes, but the set is thin.** 13 distinct levels named after the script
  (london-alley, thames-embankment, privy-lane, commons-chamber/-corridor/-lobby, board-of-works,
  route-to-the-sewers, brick-sewer, foul-air-street, culprit-arena, finished-sewer); signs LONDON, SEWER,
  THAMES, LIME, BOARD, WASTE, WATER, SEWERS. The label caps (20–42 px) force one-word signs (MIASMA →
  FOUL, OPEN SEWER → SEWER), and sprites are only the kit's 11 kinds: Londoners, MPs and Disraeli are
  all `clerk`, the ledger and the miasma token are the cartridge-shaped `item`, coin bags and brick
  piles are `sand-pile`. The Thames is never a river (no water floor): s02 is a brown corridor.

### 3. Variety

| Shot | t0–t1 | Roll / look | Moment | Transition in | Place |
| --- | --- | --- | --- | --- | --- |
| s01 hook | 0.00–4.05 | C rpg-boss | (boss bar) | – | brick alley, dark |
| s02 thames | 4.05–8.15 | A rpg-explore | – | cut | brick corridor, beige |
| s03 two_million | 8.15–12.61 | B rpg-menu | **tally (unplanned)** | cut | sand lane + clerks |
| s04 commons | 12.61–17.71 | C rpg-boss | boss-card | cut | green carpet, benches |
| s05 disraeli | 17.71–22.81 | A rpg-explore | dialogue | game-b2-fog | same Commons textures |
| s06 quest | 22.81–27.64 | B rpg-menu | quest-log | cut | menu |
| s07 board | 27.64–32.26 | A rpg-explore | – | cut | checkered office, bright |
| s08 automap | 32.26–36.68 | B rpg-menu | **automap** | game-b2-map-unfold | black map |
| s09 bricks | 36.68–41.48 | C rpg-boss | throw | game-b2-melt | brick sewer |
| s10 miasma | 41.48–46.58 | A rpg-explore | inventory-pick | cut | dark brick street |
| s11 wrong | 46.58–49.08 | C rpg-boss | stinger | continuity shared-object | black arena |
| s12 tally | 49.08–54.26 | B rpg-menu | **tally** | cut | black |

Looks never repeat back to back; 3 game-native transitions + 1 continuity crossfade, all rendered.
**Boring parts:** the walk views s01, s02, s09, s10 are interchangeable brown/grey brick boxes (and
s04/s05 share one set), the camera mostly walks a few steps and holds; **near-empty/dark frames**: s08
(map, 70 % black), s12 (card on black, 5 s), s10 (sprites invisible in the dark), s11 (black arena) —
the last 13 s of the film are dark. The narration box types the voice word for word in 7/12 shots,
so it carries most shots instead of the level.

### 4. HUD quality

- **Means something:** progress strip = film progress in 12/12 (contiguous from/to; s01's chapter flags
  [0, .23, .59, .9] differ from the other 11 [.232, .509, .764] → the flags jump at the first cut);
  checkpoints THE COMMONS / A LAW / FOUL AIR land exactly on the chapter flags; THE STINK boss bar =
  the central problem (s01, s04) ✓; compass year/place = real place per shot ✓; inventory/toasts carry
  the story's items (3 MILLION POUNDS, BRICKS, MIASMA). **Doubtful:** s04 `MPS` HP meter 10 → 6 → 3 with
  "-4"/"-3" damage numbers (invented counts) next to the boss bar, plus `SOAKED` status → 8 HUD elements
  in one frame (`frames/full-s04_commons.png`); s06 DEV NOTE repeats the toast.
- **Dialogue box cadence:** irregular typewriter, box opens with a cursor ~0.1 s before the first letter
  (s02 4.15, s04 15.16 empty box + cursor for ~0.05 s) — acceptable; s05 `say` with a speaker plate.
- **Text provenance:** everything from the narration except: "MPS FLED" (paraphrase, guard ⚠), the MP
  counts 10/-4/-3, "INTO IT" (fragment), "SEWERS BUILT" title (paraphrase), FOUL (from "foul air"),
  "~2,000,000" for "over two million" (a hedge turned into "about").
- **Legibility at 1080p:** narration box, tally, quest log and stinger read well; place names and the
  automap labels (~5 px → 15 px) read; **wall signs do not** (s01 LONDON, s04 LIME garbled "LI^C",
  s09 WASTE / s11 WATER unseen in the dark).

### 5. Continuity links

Storyboard: 1 continuity link (s10 → s11 `shared-object`, miasma token, anchor 0.5/0.62) + the map
unfold transition. Final review: "1 link planned, 1 rendered". **Frames disagree:** s10 ends with the
token *presented* centre-top (x≈0.45, y≈0.4), s11 starts with it *held* at the lower right (x≈0.88,
y≈0.75); the 0.6 s crossfade shows two hands and two tokens (transitions sheet row 4). Cause: s10 uses
`view.present`, s11 `view.hold` (no way to start a shot in the present pose). Map unfold: §1.

### 6. Guards and critic

- Guards: **1 ⚠** (s06 "MPS FLED" — rule-true, low value: paraphrase of "drives MPs out").
  `slopSourceFindings` re-run on all 12 scenes: same 1. Probes (`node slopcheck.mjs …`): tally value
  82 → 97 passes, 318,000,000 → 412,000,000 caught; damage "-4" → "-9" passes (by design); ledger "3M" →
  "7M" passes; meter label MPS → VOTERS caught; stamp INTO IT → GROSS caught; automap intent "a pretty map
  of the level" caught; throw intent shortened to "the bricks go down into the sewers" passes (grounded,
  but the throw is still not what the narration says). Not checked at all: an unplanned breakthrough
  (s03 tally), same toolkit twice in a film, black-frame blink, duplicate sprite after `take`.
- Critic (Haiku), build QA: s05 off-intent (speaker label small — partly true), s09 "clipped" and s11
  "clipped" (**false**: frames caught mid-typewriter), s10 off-intent "hand taking item not depicted"
  (**false**: 44.6–45.2 shows it). Final review: triage `suspects: []`, all 12 ✓ after re-check; final
  ⚠ only for s06 (guard) and s08 blank (true-ish). **Missed:** s03 black blink and unplanned tally, s10
  double token, s11 broken link/double hand, illegible signs, ledger = cartridge, s04 HUD clutter, dark
  ending, Thames not a river.
- QA/fix turns: **11 fix turns** (Sketchbook 3: 2), 7 of them only for sfx sync — scenes put a `click`
  on `switchOn` / the lamp at local 0–0.5 s, 180–490 ms off the next word, and the anchors check fails
  it. s08's final fix asked a question ("Should I go ahead, or undo these edits?") and left its edits in.

### 7. Quality (QUALITY.md §7, /20)

| Shot | Score | Note |
| --- | --- | --- |
| s01 | 15 | year + boss bar + narration read; dark static room, illegible LONDON sign, no planned title slam |
| s02 | 14 | no river; washed-out brown corridor; tiny SEWER sign; the box carries the shot |
| s03 | 15 | ticking count over the live lane works; INTO IT pink stamp meaningless; full-black blink; clerks as Londoners |
| s04 | 15 | Commons reads (green, benches, MPs at the exit); 8 HUD elements, invented MP counts, moon posters, no curtains |
| s05 | 15 | fog transition nice; Disraeli = clerk clone, window/river not visible |
| s06 | 16 | clean quest log, clear question focal; static 4.8 s; toast over a slot |
| s07 | 16 | clearest frame: counter, clerk, held 3M, coin piles; ledger looks like a cartridge, piles like loaves |
| s08 | 14 | right idea (story so far + 82 MILES); small, 70 % black, identical boxes, unfold via an empty room |
| s09 | 14 | melt + toss read; a paper "BRICK" thrown is confusing; tunnel plain |
| s10 | 14 | too dark (Londoners invisible), cartridge token, double token |
| s11 | 15 | stinger slam + fall is the best motion beat; broken hand-over, answer in a tiny toast |
| s12 | 15 | counters + DONE stamp land; card small on black, sewer never seen, film ends dark |

**Mean 14.8/20** (Sketchbook 16.6 / 16.8 / 16.25; B2 showcase 17–19; Comic 1 15.2). No shot below the
14 fail line, 4 at 14. Deliberate roughness is preserved (crude sprites, dithered light, uneven strides,
stuttering bulbs, chalk tallies, misregistered stamps) — the problem is not polish but **readability
and monotony**: brown/dark levels, sprite kinds that cannot express the topic, and the B looks on black.
Slop tells: §1.2 decoration (moon posters, INTO IT), §1.4 invented numbers (MP meter), §1.8 HUD clutter
(s04), §1.12 vague literalism (Thames as a corridor, brick as a paper note).

### 8. Wall clock, turns, cost, export

`costUsd` = project ledger deltas (list-price meter, not a bill). 67 rate-limit events, all `allowed`,
`limitHits: 0`; no hang, no frame-render timeout.

| Stage | Wall | Turns (model) | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 96 s | 2 Sonnet | 9.9 k | 0.35 |
| claims check | 7.5 s | 1 Sonnet (17 claims, 15 sourced, 2 disputed — both hedged in the script) | 1.1 k | 0.07 |
| voiceover / clean / words | 0.7 / 3.1 / 8.2 s (CUDA) | – | – | – |
| storyboard (+ tension) | 144 s | 2 Sonnet (1 self-fixed validator error: level-card on s01) | 16.5 k | 0.46 |
| scenes build | 1735 s (29 min) | 12 build + 11 fix (Opus), 14 critic (Haiku) | 234 k | 12.57 |
| final review | 246 s | triage + 2 fix + 1 critic | 14.1 k | 0.71 |
| sound-cues / mix | 63 s / 34 s **failed** + 11.5 s retry | 1 Sonnet | 3.8 k | 0.14 |
| export | 90 s (1628 frames, 2 workers, SwiftShader, **18.1 fps**) | – | – | – |
| **Total** | **~41 min of stages** | **47 turns** | 280 k | **14.30** |

$1.19 per shot (Sketchbook 3: $0.78) — the scene turns are long (25–57 tool turns; 93 `frames`, 40
`anchors`, 39 `lint`, 28 `validate level`, 50 `kit-docs`) and 11 fix turns. **Mix:** first attempt
failed `probe-failed: ffmpeg.exe timed out after 30000 ms` (Comic had finished; cause unknown,
transient), retry ok: −14 LUFS, −2 dBTP. **Export encoder:** `h264_nvenc` probed ok and opened on the
first try, 0 warnings. **Raycaster speed:** not isolable in the export; whole-frame time in the harness
(`drive.mjs probe`, 27 frames over the film) 42–110 ms, median ~75 ms (SwiftShader readback dominates;
the kit's own Node measurement is 2.3–2.8 ms/frame). Export 18.1 fps vs Sketchbook 3's ~13 fps.

### 9. Crashes and validator false errors

No crash, no page error, no frame timeout. Validator false errors: none (`validate level` 0 false;
storyboard only the expected warnings: s11 2.5 s short, tension tempo). The CLI bundle was stale at the
start (rebuilt; the Comic run's scene turns were using the same bundle file at that moment). Other
coders' uncommitted fixes rebuilt `stages`/`prompts` dist and the CLI bundle from 13:52 UTC on, i.e.
after this run's final review; every stage of this run used the f45a3b1 build.

## Top 5 findings

1. **The pipeline works end to end in the RPG world**: 12/12 scenes built, `validate level` caught 13
   real level errors with no false ones, HUD progress/checkpoints/boss bar mean what they should, both
   planned breakthroughs and all 4 transitions are in the film.
2. **It is dark and monotonous**: 4 interchangeable brown brick boxes, the last 13 s on black/dark
   (automap 70 % black, tally on `dark` backdrop, black arena), the narration box doing the work of the
   picture. Mean 14.8/20 — the lowest world round so far.
3. **The level vocabulary is too small for a topic**: 11 sprite kinds and 20–42 px labels → the Thames is
   a corridor, Disraeli/MPs/Londoners are one clerk sprite, the ledger and the miasma are E.T.
   cartridges, bricks are paper notes, coin bags are sand piles.
4. **Breakthrough discipline leaks at scene level**: s03 built an unplanned tally (3 breakthroughs, the
   same toolkit twice) and nothing flags it; the throw is decorative; the automap shows the story's
   places but not their geometry.
5. **Continuity and QA misses**: the shared-object link jumps (present → hold, two hands), the
   map-unfold zooms into an empty room first, the s03 tally exit blinks the whole frame black, the
   taken token stays on the floor — the critic missed all four and raised 3 false positives, while 7 of
   11 fix turns were spent on lamp-click sync.

## Defects and suggested fixes

| # | Sev | Defect | Suggested fix |
| --- | --- | --- | --- |
| 1 | high | Unplanned breakthroughs at scene level (s03 `hud.tally` on a no-moment shot → 3 breakthroughs, tally twice) | final review / guard: count `automap`/`tally`/`page.*` toolkit calls per scene vs the storyboard's `worldMoment`; ⚠ unplanned or repeated; scene prompt: "a stat sheet that ticks = `hud.menu` stats or a meter, never a tally unless planned" (or give `menu` a ticking value) |
| 2 | high | Dark, monotonous levels: brown brick boxes, B looks on black (automap 70 % black, tally `backdrop: 'dark'`), last 13 s dark | craft brief + critic: ≥ 1 lit level per 2 walk shots, mood variety across shots (not one mood film-wide), tally default `backdrop: 'freeze'`/`'live'` (never `dark` when a level exists), automap `scale` so the map fills ≥ 50 % of the frame; luminance/near-black guard per frame |
| 3 | high | Sprite/label vocabulary too small for real topics (one clerk for every person, cartridge `item` for every object, no water floor, ≤ 42 px labels) | kit: a `person` variant set (coat/top hat/robe colours, `seed`), item shapes (`book`, `bag`, `brick`, `token`), a `water` floor/channel and a river wall; allow 2-line or wider sign labels |
| 4 | medium | Shared-object link breaks between `present` (s10) and `hold` (s11): item jumps, two hands in the crossfade | `view.hold(item, { pose: 'present' })` or `present({ at: -1 })`; continuity check compares the item's screen position at both seams against `anchor` |
| 5 | medium | `game-b2-map-unfold` grows the next shot's first *walk* frame; the automap unfolds later (0.5 s) inside the shot | validator: a shot entered by `map-unfold` must have `automap({ at: 0, enter: 'cut' })` (the transition is the unfold); same for fold at the end |
| 6 | medium | Tally `exit: 'dissolve'` (default) blacks out the whole frame incl. the live view (s03 11.70–11.85) | with `backdrop: 'live'`/`'freeze'` dissolve only the plate; default exit `cut` for live |
| 7 | medium | `view.take` leaves the level sprite in place (two tokens s10) | `take({ sprite: id })` hides the level sprite at the grab; lint warns when `take.from` matches a sprite position |
| 8 | medium | 7 of 11 fix turns for lamp/switchOn `click` sfx 180–490 ms off a word | let `switchOn`'s own cue be a free ambient cue (exempt from word sync) or prompt: level sfx only on anchors |
| 9 | medium | Critic false positives on mid-typewriter frames ("clipped") and a take it did not see; misses blink, double sprite, broken link, illegible signs | critic checklist: typewriter text in progress is not clipping; sample t1−0.1 for text; add the 4 misses to the B2 checklist |
| 10 | medium | Invented counts pass: MP meter 10/-4/-3, tally value 82 → 97, "3M" → "7M" | guard: meter `keys`/segments and tally values need a number from narration/research (approx ±10 %), not only multi-digit strings |
| 11 | low | Wall sign labels illegible at distance (LONDON, LIME garbled) | sign labels render at a min on-screen size or face the camera; critic: a sign label must be readable in the held frame |
| 12 | low | HUD clutter: 8 elements in s04 (boss + meter + status + damage + checkpoint + compass + progress + box) | prompt/guard: ≤ 5 HUD elements at once; meter and boss bar not on the same threat |
| 13 | low | s01 chapter flags differ from the other shots | pass the film's chapter list into the scene prompt (one source) or lint progress chapters against the storyboard |
| 14 | low | Throw used as decoration (paper "BRICK" into a sewer) | throw prompt: only when the narration hands/throws/discards something; intent guard requires a hand-over verb in the narration |
| 15 | low | `validate level` zod-path messages (`sprites.1.label: Too big …`) | map zod issues to the same sentence style as `checkLevel` |
| 16 | low | Mix probe `ffmpeg.exe timed out after 30000 ms` once (retry ok) | retry the probe once with a longer timeout before failing the stage |

## Run notes

- Script 139 words (target ~125), hedged ("Over two million", "roughly eighty-two", "about three hundred
  and eighteen million", "Within weeks" instead of the inconsistent "18 days"); open loop "what did they
  think that smell was doing to them?" → closed at 46.58 "Wrong culprit". Chapters: Summer of 1858 /
  Smell Drives MPs / Think / Three Hundred and Eighteen Million (two weak titles).
- Sound: 32 sfx, 1 ambience, lo-fi bed; the sound-cues turn said it "swapped the whiteboard, blueprint
  and retro-UI sounds the defaults had put in this game-b2 film" — not verified (I did not listen; the
  palette code passes the style to the default cues).
- MP4 is 52.8 MB for 54 s (dithered raycast frames compress badly; Sketchbook 3: 16.9 MB).

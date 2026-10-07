# Real run Comic 2: open vocabulary on the deep ocean (PLAN.md#13.15 phase 3)

Date: 2026-10-07 · Claude Code CLI on the user's subscription (sanitized env, every turn
`apiKeySource: none`) · Windows 11 · run by the Coder through the stage code like
[Comic 1](real-run-comic-1.md): `StageRunner` with `experimentalWorlds: true`,
**`worldQuotaOverride: { minBreakthroughs: 2 }` (test only)**, `maxFixIterations: 1`, concurrency 2;
`checkSources`, `proposeMoments` (all accepted, run **before** the scenes this time), `exportVideo`,
`buildPublishKit`. Code: `phase-13/v3.1` at 9a4c84c + other coders' uncommitted work in the tree +
**one fix of this run** (world-asset sheets, see §8). Before the run: `pnpm exec tsc -b`,
`pnpm build:cli`, `pnpm check:cli-bundle` (up to date). Project made by `createProject` (style
`comic`): `lookMode mixed`, `continuityLinks`, `antiSlopGuards`, `characters classic`, `mascot none`,
research mode off. Driver `scratch/real-run-comic-2/` (gitignored): `drive.mjs` (its export manifest
now carries `worldAssets` exactly like `apps/desktop/src/main/project-manifest.ts`), `synth.ps1`,
`sheets.mjs`, `strips.mjs`, `slopcheck2.mjs`, logs `*.out`, round-1 asset copy `wa-run1/`.

Topic (far from the Apollo 11 showcase): "How the deep ocean works: why the bottom of the sea glows
and what lives where sunlight ends". EN, SAPI David rate +2, lead 0.8 / paragraph 0.6 / tail 0.8 s →
**55.0 s** (script 136 words, 10 % over 50 s); whisper large-v3-turbo-q5_0 (8.5 s, 91 % coverage).
Claims: 11, 9 sourced, 1 without source ("no sunlight reaches" the vents), 1 disputed (the jellyfish
"burglar alarm" is "thought to be") — left as is. Note: the kit ships a comic open-vocabulary example
`examples/comic/open/o2_ocean.js` (anglerfish + jellyfish) and the fish generator has `anglerfish` /
`jellyfish` / `shark` presets, so "ocean" is far from the showcase but not from the open examples.

Output: `C:\Users\galar\Desktop\ReelForge-test-films\comic-test-2.mp4` (54.5 s, 1920×1080 30 fps
H.264 **NVENC** first try + AAC, 40.3 MB), `comic-test-2-contact-sheet.png`,
`comic-test-2-transitions.png`, **`comic-test-2-world-assets.png`** (all 6 asset sheets, 1× + ≤ 64 px
thumbnails), publish kit `comic-test-2-publish\`, project `comic-test-2 work\Deep Ocean\`. Opened: all
12 eight-frame strips (`scratch/real-run-comic-2/strips/`), both sheets, the asset sheets.

## 1. World assets (the new stage)

Run 1 (`action: world-assets`, 616 s): one Opus design turn wrote 4 files + `assets/cast.json`
(23 ids), then QA: **sheets 1–2 crashed** ("8 panels on the page at once; a comic page shows at most
5") because the sheet put 8 characters/props on one comic page → findings → the Haiku critic is
skipped when there are findings → fix turn (it correctly blamed the sheet tool and changed nothing) →
kept "⚠". Fixed (§8), run 2 (forced, 112 s): the design turn kept the set (moved the small fish into
frame), QA rendered 6 sheets, **critic: all 6 ok** → "23 world assets ✓", committed path-limited.
The design turn ignored "self-QA at most 2 rounds": ~20 `world-assets sheet` + 12 `check` calls, 9 min.

| File | Ids |
| --- | --- |
| `deep-creatures.json` | characters anglerfish (gen fish + lure parts), vampire-squid (hand parts), shark (gen), jellyfish (hand parts, the gen read as a ring), small-fish (gen tropical), shadow-fish |
| `glow-chemistry.json` | props flask, luciferin-molecule, oxygen-bubbles, glow-burst |
| `hot-vents.json` | characters bacteria, tube-worms; props vent-chimney, chemical-puffs, dinner-plate |
| `the-deep.json` | props submersible (gen vehicle), sub-window, thermometer, glowing-dot; backdrops sunlit-surface, midnight-water, abyss-black, vent-floor |

`cast.json` maps each to the narration's words and shots ("attackers" = shark, "something bigger" =
shadow-fish, "its own dinner" = dinner-plate).

**Checks.** Assets differ from mockup/showcase: **yes** — no Apollo/LM/1202/crew/1961 content in any
asset or scene (grep), nothing copied from `o2_ocean` (its backdrops are sky+sea / star-field; ours are
4 own backdrops; the only overlap is the file name `the-deep`). Recognisable at thumbnail: anglerfish,
squid, shark, jellyfish, flask, molecule, bubbles, porthole, thermometer, sub, tube worms, vent: yes;
bacteria/chemical-puffs/glowing-dot read as blobs only with their label. **Siblings not distinct:**
midnight-water, abyss-black and vent-floor are three near-identical navy halftones (critic said ok).
Vampire squid reads as a red octopus; small fish is a striped tropical fish (not a deep-sea animal).
Use in scenes: **21/23 ids used in 10/12 scenes** (unused: thermometer — s02 drew its own cyan one —
and abyss-black); s01 and s03 draw everything themselves. Consistency across shots is the real win:
the same anglerfish, squid, shark, jellyfish, tube worms and vent recur in s05–s12 and in the spread.

## 2. Breakthroughs and page moments

| Moment | Shot / time | `intent` | Verdict |
| --- | --- | --- | --- |
| **flashback** `cover: 'strip'`, `arrange: 'row'`, `when: 'IN ONE LONG SURVEY...'` | s05 19.15–24.93 | "in one long survey off California, about three quarters of the animals glowed, or probably did" | grounded intent, original picture (sepia log with California coast + sub track; bar fills to "3 IN 4", 3 of 4 film animals light up, PROBABLY stamp on "probably"). But **the option pair is exactly the showcase's f2 template** (strip+row) and the guard does not compare with showcase templates (probe f1 pair: no finding either). "Flashback" fits loosely (a past survey, not a look back). Right half of the strip empty ~0.9 s; "GLONED" (W glyph). |
| **spread** `assemble: 'pull-back'` | s11 46.19–50.17 | "the whole black deep ocean switching on: anglerfish, vampire squid, jellyfish and tube worms lit up as dots across both pages" | content = callbacks of the film's own cast, RRIP tears the cover on "The animals", the palette-shift moment (sepia) lands on "themselves". **But 0–2.6 s (65 % of the shot) is a small black rectangle on an empty cream page**; the spread is on screen ~1.4 s; no fold visible. Same `pull-back` as Comic 1's spread. |
| pause-panel | s03 | – | black panel, dot flickers on "Hold that thought"; centred by the storyboard's own request (guard ⚠ symmetry). |
| cutaway | s04 | – | flask torn open, molecule + oxygen + burst; works; LUCIFERIN label crosses the molecule. |
| impact-break | s07 | – | jelly's ring of light + BRRRING! breaks the border, shadow fish looms — works. |

Never the same mechanism twice in the film: yes (flashback vs spread). Invented decorative elements in
breakthroughs: none.

## 3. Variety, panel grammar, hand

Rolls C A C B B A A C A B C A (never > 2 in a row); 5 moment kinds; 4 non-cut transitions
(panel-slam, continuity zoom-through, page-back, gutter-wipe). Pages: 1–3 panels, still mostly
"side-by-side, next one slams in" (s06, s07, s09, s10, s12). Real comic gags: the sunny strip pasted
over the vent page and ripped off (s09), the fork stabbing through THE FOOD?! (s08), the squid's light
spray confusing the shark (s06). Lettering: W still reads as N (BELON, DONN AT, GLONED, TUBE NORMS,
ITS ONN); captions still type letter by letter ("BACTE", "THE DE"); camera crops CHEMICALS → "EMICALS"
(s10). Near-empty openings: s11 2.6 s, s08 1.2 s, s12 left 2/3 cream 1.8 s, s10 right third empty
at 44 s. Hand rules: Comic has no drawing hand (n/a); small labels appear on their own.
Text provenance: "WHAT IS THAT?" pencil (s02), "ANIMALS" stamp (s11), the shark "eating" the jelly
(narration: "whatever is eating it"); s12 puts the dinner plate next to the jellyfish (the narration's
dinner is the vent food chain). Credit chips: WHOI.EDU, OCEANEXPLORER.NOAA.GOV, LIVESCIENCE.COM.
Continuity: 1 planned, 1 rendered (s03 dot → s04 dot in the flask; reads, transitions sheet row 2).

## 4. Anti-slop guards (final review: 4 ⚠ shots)

s03 symmetry 0.86 (true, but asked for by the storyboard); s07 "BRRRING!", s09 "FSSSHH", s11 "RRIP!"
— all **false positives** (sound words; Comic-1 defect 5 still open). During build also s05 symmetry,
s10 clutter 7. Probes (`slopcheck.out`): flashback intent generic / ungrounded → caught; "LUNAR
MODULE." / "1202 ALARM." captions → caught as invented text (no dedicated showcase-object guard for
Comic); **"TWO DEGREES CELSIUS" instead of "four" → not caught**; HISS → ok; CHINK → only "invented
text" from this layer (the offensive-terms check lives in scene QA, not exercised by this film).

## 5. Quality (QUALITY.md §7, /20)

s01 14 · s02 16 · s03 14 · s04 16 · s05 15 · s06 17 · s07 16 · s08 14 · s09 16 · s10 14 · s11 13 ·
s12 15 → **mean 15.0** (Comic 1: 15.2). Best: s06, s09, s04. Worst: s11 (the payoff is mostly an
empty page), s10 (crop, glyphs), s01 (generic, uses no asset).

**Style-vs-content honesty verdict: 7/10.** The open vocabulary works for content: every recurring
thing is designed for THIS narration (23 assets, zero showcase objects, consistent across 10 shots,
the spread recaps the film's own cast). Points lost: the breakthrough mechanisms still fall back to
template option pairs (f2 strip+row, pull-back again), the generator presets did much of the work
(the ocean topic is covered by `o2_ocean`/fish presets, so this is a softer test than forest/city),
three backdrops are interchangeable, and readability problems are kit-level (W glyph, crops, empty
openings), not vocabulary.

## 6. Wall clock, turns, cost

`costUsd` = ledger deltas (list-price meter, not a bill). 50+ rate-limit events, all `allowed`;
`limitHits: 0`; no failed turn. Two Bash `sed -i` calls in scene turns were denied by the hook.

| Stage | Wall | Turns | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script | 62 s | 2 Sonnet | 8.7 k | 0.32 |
| claims | 7.4 s | 1 Sonnet | 0.8 k | 0.06 |
| voiceover / clean / words | 0.8 / 3.4 / 8.5 s | – | – | – |
| storyboard | 132 s | 2 Sonnet | 12.6 k | 0.37 |
| world-assets run 1 (sheet bug) | 616 s | 2 Opus | 49.9 k | 2.57 |
| world-assets run 2 (after fix) | 112 s | 1 Opus + 1 Haiku | 4.3 k | 0.28 |
| scenes build | **1860 s (31 min)** | 12 build + 2 fix Opus, 13 Haiku critic | 233.7 k | **11.87** |
| final review | 87 s | 1 (no fixes) | 3.7 k | 0.05 |
| sound-cues / mix | 26 / 5.8 s | 1 Sonnet | 1.4 k | 0.09 |
| export | 73 s (1636 frames, 2 workers) | – | – | – |
| **Total** | **~50 min** | **38** | 315 k | **15.62** |

Without the sheet bug the world-assets step would be ~0.3–2.6 $; scenes $0.99/shot (Comic 1 $0.97).

## 7. Pipeline failures and root causes

1. **World-asset sheets crash for Comic sets with > 5 characters or props** (high): `sheet-scenes.ts`
   put 8 one-panel assets per comic page; `comicPage` throws above `MAX_PANELS_AT_ONCE = 5`. Effect:
   QA findings → the Haiku critic never ran → the set was kept unchecked, and the design turn burned
   9 min re-rendering in batches. **Fixed** (Comic `perPage: 5`, test `sheet-scenes.test.ts`).
2. The design turn ignores the "at most 2 self-QA rounds" limit (~20 sheet renders).
3. Chapter titles in the publish kit include storyboard jargon: "Story page" (t 24.93) — likely from the
   intent text — plus "Below Roughly"/"First".
4. Storyboard: 2 false `transition-focus` warnings for comic wipes (Comic-1 defect 14 still open).

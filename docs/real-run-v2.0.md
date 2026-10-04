# Real run v2.0: a mixed-look film (release verification of phase 12 "Looks")

Date: 2026-10-04 · Claude Code CLI 2.1.287 on the user's subscription (Max) · Windows 11 · run by
the Coder through the stage code (`@reelforge/stages` API, as `run-stage` does, but with
`maxFixIterations: 1`), not through the Electron UI. Project in a scratch folder with a space in
its path, created from `templates/project` (`lookMode: "mixed"`, `ambientVariation: true`).
Code: `phase-12/v2.0-looks` at d6bbe57 for script…export; the 3 rebuilt shots, the second sound
pass and the final export ran on a clean worktree of 0a3b32b plus the fixes below.

## What was run

| Item | Value |
| --- | --- |
| Brief | "How the first web browser changed the internet (1990–1995)", EN, target 2 min, style `voxel-pixel-crisp640` |
| Voice-over | the script read by Windows SAPI ("Microsoft David Desktop", rate +2; spike 03 `synth.ps1` + a `Rate` param), 2:17 |
| Whisper | `large-v3-turbo-q5_0` from `%LOCALAPPDATA%\ReelForge\whisper` |
| Scenes | concurrency 2, `maxFixIterations` 1, critic on, Playwright + SwiftShader frames |
| Export | 1080p30, `h264_nvenc` (final), 2 workers, SwiftShader frames (headless) |
| Result | 136.97 s, 1920x1080, AAC 48 kHz stereo, −14.0 LUFS integrated, 158 MB (9.2 Mbit/s) |

Output: `C:\Users\galar\Desktop\ReelForge-test-films\v2.0-looks-test.mp4`, a 5x5 contact sheet of
the mid-shot frames (`…-contact-sheet.png`) and the five transitions at two progress values each
(`…-transitions.png`). No usage limit was hit (`limitHits: 0`, no pause).

## Per stage: wall clock and usage

`costUsd` is the CLI's list-price meter (relative measure, not a bill).

| Stage | Wall | Turns (model) | Output tok | Cache read | costUsd |
| --- | --- | --- | --- | --- | --- |
| script | 74 s | 3 Sonnet (research, research repair, script) | 11.0 k | 156 k | 0.38 |
| voiceover / clean / words | 0.4 / 4.9 / 9.8 s | – (words: 1 attempt, 91 % coverage) | – | – | – |
| storyboard | 119 s | 2 Sonnet (draft + repair) | 15.3 k | 468 k | 0.52 |
| scenes | 2948 s | 44 build + 9 fix (Opus), 36 critic (Haiku) | 381 k | 18.1 M | 21.97 |
| sound-cues / mix | 27 / 15 s | 1 Sonnet | 1.9 k | 317 k | 0.13 |
| export | 237 s | – (4109 frames, ~17.7 fps) | – | – | – |
| **Run total** | ~57 min | 95 turns | 409 k | 19.0 M | **23.00** |
| Rebuild of 3 shots + sound pass | 147 + 13 s | 3 Opus, 3 Haiku, 1 Sonnet | 20 k | 1.1 M | 1.21 |

Scene builds: 25 shots + 10 project props (`nextComputer` from the storyboard, 9 asked for by
scenes: webPage, fuse, crate, chair, seesaw, calendar, mosaicBox, chest, door) + 9 shot rebuilds
with those props ≈ $0.80 per shot (1.0: $0.67). Plus 4 Haiku probe turns outside the project
($0.23, the Bash output limit below).

## Quality

**Script** (307 words, 2:03 at 150 wpm, 12 sources): accurate and sourced, good hook ("one website
… twenty-three thousand five hundred"). SAPI mangles "CERN", "WorldWideWeb"; 91 % coverage.

**Storyboard** (25 shots for 2:17, avg 5.5 s; 10 treatments): looks voxel 15, blueprint 5, retro-ui
3, diorama 2; rolls A 10, B 9, C 6. The look choices mostly fit the content: retro-ui for the
browser/editor (s09), the home page (s11) and Mosaic's inline images (s14); blueprint for the map
(s04), counters (s17, s23) and charts (s19, s21); diorama for Sendall's office (s07) and the
Illinois lab (s13).
- **Bad look choice forced by the validator:** the draft had s18+s19 (one growing chart, voxel B,
  12.8 s); `pattern-run` failed it and the repair moved s19 to blueprint. In the film s18 is a weak
  voxel slab with one tiny bar and s19 redraws the same 130 bar in blueprint. The same repair
  relabelled s16 metaphor-object → 3d-reconstruction (a label change, same picture). Fixed below.
- The draft listed one badge per spoken item (as the prompt says for lists) and `annotation-run`
  (max 2 of a kind in 20 s) failed it; the repair dropped 5 annotations (follow-up).
- s04 (a map) is tagged C; 3 of 5 act openers are not C-rolls (warnings only).
- Intents prescribe camera moves the looks forbid ("slow zoom on the text" s11, "zoom toward the
  picture" s14). 1 blocked Bash (`node -e`) in the repair; the guard held.

**Transitions** (5 non-cut, all styles chosen by Claude): draw-over s04 (voxel→blueprint),
tile-flip s13 (voxel→diorama), dither-dissolve s20, draw-over s22 (blueprint→voxel), pixel-wipe s24.
No style twice in a row, specials only at look changes; in the MP4 frames all are palette-pure and
read well (draw-over and tile-flip are the best moments of the film).

**Scenes:** 25 ✓, 0 ⚠, 9 fix turns. Every look shot used its look's definitions (retroDesktop +
retroBrowser/retroWindow, blueprintMap/Counter/Chart, dioramaOffice with the iso camera and pins);
no shot faked a look with voxel boxes or brought outside colours. Weak spots:
- s11, s14 (retro-ui): the push-in crops the window title / headline mid-word.
- s09, s14: `retroBrowser` titles the window "<title> - NETSURF" (kit default): "NCSA MOSAIC -
  NETSURF" is wrong for a film about real browsers; s09's title is clipped ("…- NETSU..").
- Blueprint titles carry clashing figure numbers (FIG. 4 twice, FIG. 3 twice, FIG. 2).
- s21 plots invented values (Mosaic 15 %, others 10 %; only Navigator's 75 % is sourced).
- s17: a small counter on an otherwise empty board; s18: weak, dark.
- Text over busy areas: s04 "MARCH 1989" over the map, s13 date over a window, s22 date over the
  facade; s08 code text clipped at the left edge.
- The Haiku critic said `ok` 39/39 times and called blueprint/retro-ui frames "voxel style"; it
  did not catch any of the crops above (it is not told the shot's look).
- Ambient variation is visible but subtle in voxel shots (teal vs violet horizon, pink vs teal
  grid, the room window teal in s05 and pink in s06); the other looks have no budgets yet.

**Sound:** 70 sfx, 20 ambience beds, 2 music beds (calm-tech). Palettes switch per look (blueprint:
ruler-tick/relay-click/data-ping; retro-ui: crt-zap/disk-seek; diorama: paper-shuffle) and the
draw-over out of blueprint plays plotter-pen. Gaps: s05 has no sound, s11's typed text no keyboard,
s09's three pop-up windows no window-open. Mix QA all pass: −14.0 LUFS, −2.0 dBTP, ducking
14.9 dB, voice over music 29.2 dB, music < 120 Hz 0.5 %, 19.2 sound moments/min.

**Sync:** `reelforge anchors`: 92 anchors, all within ±150 ms (172 ok, 14 info, 0 miss).

**Verdict:** watchable and on topic with no manual edits; the look mix makes it feel like a real
channel (the browser windows, the blueprint charts and the iso office carry the B-roll). Weakest:
the runtime Claude losing the kit index (below), text crops in retro-ui push-ins, s18/s19.

## Found and fixed (with tests)

1. **`pattern-run` repairs broke a continuing visual / relabelled shots.** The error now says to
   change what the viewer sees (not a label) and to keep one chart/counter/place in one look by
   merging the shots or cutting away (`packages/prompts/src/validators/rhythm.ts`; test in
   `rhythm.test.ts`). Not re-run with real Claude (a storyboard rerun would re-cut the film).
2. **Blueprint figure numbers, small counters, invented data, text over data.** Blueprint look docs:
   no "FIG. n" (example and the `title` param description), `digitScale: 7`-`8` for a lone counter,
   only numbers from the narration/`research.md`, `ctx.text` on a free part of the board
   (`looks/blueprint/index.ts`, `board.ts`, `docs/kit-catalog.md`). Rebuilt s17 and s23 with real
   Claude: titles "MOSAIC MID-1994" / "DAY ONE CLOSE", s17 at `digitScale: 8`.
3. **Intent camera ideas overriding look camera rules.** retro-ui and diorama docs: the look's
   camera rules win over the intent; retro-ui keeps the title bar and headline whole. Rebuilt s14:
   the pan no longer cuts the window, but the push-in on the picture still crops the headline
   (allowed by the new rule, since the picture is the point) — only partly fixed.

## Remaining (backlog candidates, by priority)

- **`reelforge kit-docs` is over the CLI's Bash output limit (release-relevant).** Claude Code
  saves a Bash output above ~30,000 characters to a file under `~/.claude/projects/…` and shows a
  2 KB preview (probed: 29,766 chars inline, 30,334 persisted; `BASH_MAX_OUTPUT_LENGTH=80000`
  changes nothing). Scene turns may only read `./**`, so the file is denied: 24 of 97 sessions got
  the preview only, 21 denied Read/Grep calls. The index was 25.5 KB in the 1.x runs; with the
  looks it is 38.3 KB even in the voxel-only example (17 look entries = 12.6 KB) and 42.3 KB in this
  film (10 project props = 4 KB). Proposal: voxel-only projects list no look entries (back to the
  1.x text); in mixed projects look entries and project props get one short line each (params via
  `kit-docs <name>`), with a size test (< 28,000 chars with 12 project props).
- `kit-docs props|env|fx|blueprint` (category names) fail 14 times; accept categories / look ids.
- The critic prompt does not know the shot's look and passes crops/clipped text.
- `retroBrowser` window title suffix "- NETSURF" (kit default; changing it re-renders retro-ui goldens).
- Storyboard prompt vs `annotation-run`: "one badge per spoken item" for lists contradicts "max 2
  of a kind in 20 s".
- The storyboard writes camera moves per shot without knowing each look's camera idiom.
- 25 shots for 2:17 is right for the rhythm rules but costs ~$22 in scene builds; props on demand
  add ~40 % turns (10 props, 9 rebuilds).

## No harm (v1.2.0 vs 2.0, voxel-only)

The example project (`templates/examples/doom-on-a-calculator`, project.json without `lookMode` /
`ambientVariation`) rendered through the engine harness with the full manifest (transitions
included) at shot start, middle and end and at p = 0.25/0.5/0.75 of every non-cut transition: 36
frames (21 shot + 15 transition), SHA-256 of the RGBA frames. v1.2.0 (tag `v1.2.0` = f1419cc) vs
d6bbe57 and vs 0a3b32b (clean worktrees): **all 36 identical**. Sound (`sound:demo` on the example
film): `example-mix-cues.json`, `example-mix.wav` and `example-music.wav` byte-identical
(the mix report differs only in `createdAt`).

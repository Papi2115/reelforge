# First real end-to-end run (PLAN.md#10.4)

Date: 2026-10-02 · Claude Code CLI 2.1.287 on the user's subscription · Windows 11 · run by the
Coder through the stage code (`@reelforge/stages` API, the same as the app and `run-stage`), not
through the Electron UI. Project folder in a temp scratch dir (not in the repo, path with a space).

## What was run

| Item          | Value                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Brief         | "Why a 1990s calculator can run Doom", EN, target 0.4 min, style `voxel-pixel-crisp640`               |
| Voice-over    | Script read by Windows SAPI ("Microsoft David Desktop", spike 03 `synth.ps1`) as the user's recording |
| Whisper       | spike 03 cache, `large-v3-turbo-q5_0` (fallback `small`)                                              |
| Scenes        | concurrency 2, `maxFixIterations` 1, critic on, Playwright + SwiftShader frame renderer              |
| Sound cues    | the Claude generator (Sonnet)                                                                        |
| Export        | 1080p30, `h264_amf` (final), 2 workers, SwiftShader frames (headless; the app renders on the GPU)    |
| Result        | 38.97 s MP4, 1920x1080, AAC 48 kHz stereo, −13.9 LUFS integrated, 72 MB                              |

No usage limit was hit (5-hour window utilization read 0.06 → 0.10, 7-day 0.15 → 0.16 over the run;
the Manager and Coder sessions used the same account at the same time, so these are upper bounds).

## Per stage: wall clock and usage

`costUsd` is the CLI's list-price meter (not a bill on a subscription; a relative measure).

| Stage       | Wall    | Turns (model)                                 | Output tok | Cache read | costUsd                  |
| ----------- | ------- | --------------------------------------------- | ---------- | ---------- | ------------------------ |
| script      | 87 s    | 2 (research + script, Sonnet; WebFetch Haiku) | 10.5 k     | 105 k      | 0.41 (booked 0.77, bug 2) |
| voiceover   | 1 s     | –                                             | –          | –          | –                        |
| clean       | 2 s     | –                                             | –          | –          | –                        |
| words       | 125 s   | – (3 whisper attempts, CPU)                   | –          | –          | –                        |
| storyboard  | 41 s    | 1 Sonnet                                      | 4.7 k      | 127 k      | 0.20                     |
| scenes      | 1296 s  | 8 build + 3 fix (Opus), 10 critic (Haiku)     | 117.5 k    | 5.63 M     | 6.17                     |
| sound-cues  | 24 s    | 1 Sonnet                                      | 6.9 k      | 203 k      | 0.37                     |
| mix         | 4 s     | –                                             | –          | –          | –                        |
| export      | 79 s    | – (1169 frames)                               | –          | –          | –                        |
| **Total**   | ~27.7 min | 25 turns                                    | 140 k      | 6.1 M      | **≈ 7.15** (booked 7.52)  |

Scene builds were 87 % of the cost (Opus: $5.36 for 8 builds, $0.62 for 3 fixes; Haiku critics
$0.20 in total). After the fixes below, 2 shots were rebuilt with the real CLI: 4 turns, 168 s,
$0.61 (both builds in parallel, no blocked or failed tool calls). Extra real turns after the run:
2 Haiku probe turns (bug 2) + 4 rebuild turns.

## Quality

- **Script** (66 words / target 60, 12 sources, 0 repairs): accurate, sourced, punchy; numbers
  spoken the way a person says them. Research was as deep as for a long film (12 web calls, $0.36).
- **Words**: 82 % coverage, because SAPI mispronounces ("Doom-like" → "duxand more skilling",
  "BSP tree" → "A, B, S, P, T, R"); a real voice should do better. All 66 words got times.
- **Storyboard**: 8 shots, 7 treatments, sensible intents with quoted landing words, valid on the
  first try; 2 missing props (a chip, a file icon).
- **Scenes**: 5 ✓, 3 ⚠ in the build (s08 later rebuilt ✓). The frames look like a real channel:
  neon-grid calculator hook, a voxel Z80 chip rising out of the calculator with a 1976 counter, a
  96×64 pixel grid with rulers, "NO FLOATING POINT" with 3.14 → 3, a BSP node graph + assembly
  terminal, a "52,000 BYTES" odometer next to a DOOM83 file, and the closing line struck through.
  Weak spots: s03's numbers are very small (phone legibility; only the review mode checks it), a
  shard burst runs over "BYTES", a node label is clipped at the left edge in s06, one empty
  terminal panel early in s06. All 52 anchors land within ±150 ms (`reelforge anchors`).
- **Sound**: 10 sfx on real events, 2 hum beds at −26 dB, mix −14 LUFS / −2.4 dBTP.
- **Verdict**: a watchable, on-topic 39 s explainer with no manual edits; the main cost and time
  sink is Opus scene building.

## Bugs found and fixed (each with a test)

1. **Scene concurrency did not exist with the real bridge.** The SessionManager runs one turn per
   project + purpose; all scene builds use purpose `main`, so "concurrency 2" built one shot at a
   time (and every scene turn overwrote the user's `main` chat session id). Fake-claude tests only
   checked render concurrency. Fix: `detached` turns (one-off session, never stored, own queue key)
   for scene build/fix, critics and review turns. Rerun: two Opus builds started in the same
   second. Tests: `session-manager.test.ts`, `scenes-stage.test.ts`.
2. **Resumed turns were booked with the whole session's usage.** After `--resume` the CLI's
   `total_cost_usd` and `modelUsage` are session totals; only top-level `usage` is per turn
   (confirmed with 2 Haiku probe turns, and visible in the recorded `resume-2-recall` fixture). The
   script turn was booked at $0.41 instead of ≈ $0.05. Fix: `usageSnapshot` per session in
   `sessions.json`, a resumed turn books the difference (`turn-usage.ts`). Test on the recorded
   fixture. `docs/spikes/01-claude-cli.md` corrected.
3. **A scene that throws in `update()` was a "bug in reelforge" / a renderer outage.** `reelforge
   frames` printed "internal error (a bug in reelforge, not in your project)" for the scene's own
   TypeErrors and bad `ctx.text` options (6 times in this run); the stage QA renderers (dev
   Playwright, app pool renderer, app render service) rejected, which fails the whole scenes stage
   instead of asking for a fix. Fix: such errors are a failed render of that shot (`scene failed:
   rendering t=…: …`). Tests: CLI render test, stage critics render test, desktop renderer tests.
4. **No reference for `ctx.camera` / `ctx.text`.** Every scene author ran `reelforge kit-docs
   camera` / `text` (unknown), then guessed (`position`, `y`, a lower third without text). Fix:
   `reelforge kit-docs ctx|camera|text|anchor|sfx|rng|ease|shot`, text options generated from the
   engine schemas; an unknown text option now lists the known ones. Tests: `kit-docs.test.ts`,
   `text-layer.test.ts`.
5. **Every fresh session started with a blocked Bash call** (`cd "<project>" && reelforge kit-docs;
   ls scenes; cat …`), 12 times in the scene stage plus once in the storyboard turn. Template `CLAUDE.md` now states the one-plain-command rule and
   points to `kit-docs ctx`; `anchors --shot sNN` → the full storyboard id (Claude used `s03`).
   Test: `template-docs.test.ts`. Rerun: 0 blocked calls, `kit-docs ctx` used.
6. **`MISSING:` replies parsed into bogus props** ("none (I drew it with voxel tools)", descriptions
   in brackets, whole sentences). `parseMissing` handles them; `scene-build` prompt v2 asks for short
   names only. Rerun reply: `MISSING: file-icon`.
7. **Dev entry `run-stage`** did not put `reelforge` on the children's PATH and did not build the
   CLI bundle, so storyboard/scene turns could not run their QA commands. Fixed (+ env test).

## Remaining issues (backlog candidates)

- With two shots in flight one autocommit carries the other shot's file (rerun: "Scene s07 built"
  contains s08; no s08 commit). Commit only the shot's own scene file.
- Rebuilding scenes does not mark sound-cues/mix/export stale.
- Storyboard `missingProps` entries carry descriptions (`"z80Chip (voxel IC package …)"`).
- whisper: the CUDA build ran on CPU (`usedGpu: false`), 51 s per attempt for 38 s of audio; three
  attempts when coverage is low. A 10-min VO could take 30–40 min.
- Research depth does not scale with the target length.
- Phone legibility is only checked in the review mode; tiny text passed the build QA.
- The final preset writes ~15 Mbit/s (72 MB for 39 s).
- A 10-min storyboard (~120 shots) in one Sonnet turn is untested.
- Still no real usage-limit stream fixture (no limit was hit).

## Estimate: one 10-minute film (extrapolated, not measured)

Assumptions: ~5 s per shot → ~120 shots; per shot ≈ $0.67 Opus build + ~0.4 fix turns × $0.21 +
$0.02 critic ≈ $0.77 (this run, before the fixes); fixes 4–5 should lower it (the rebuild averaged
$0.30/shot, but it started from existing scene files). Script + research ≈ $0.5–1, storyboard ≈
$1–2, sound cues ≈ $0.5–1.

- **List-price meter: ≈ $40–95 per 10-min film**, ~90 % of it scene building.
- **Subscription share (very rough)**: this run's ~$7 moved the 5-hour window by ≤ 4 points and
  the weekly one by ≤ 1 point (with other sessions running). Linear scaling gives roughly 25–55 %
  of a 5-hour window and 6–14 % of the weekly limit per 10-min film on this account's plan; expect
  the scene stage to span more than one 5-hour window on smaller plans.
- **Wall clock**: scenes ≈ 1.4 min/shot with real concurrency 2 → ~3 h for 120 shots; words
  15–40 min on CPU; export on GPU minutes (SwiftShader here: ~15 fps → ~20 min).

## Recommendations

- Keep scene concurrency 2 (now effective); 3 only on large plans — it raises the limit risk.
- Economy mode (Sonnet for scenes, 1 fix turn) for drafts and long films; Opus for the final pass
  on shots that came out ⚠.
- Scale research effort with `targetMinutes`; chunk storyboards of long films by act.
- Run the phone-legibility check in the build QA, not only in review.

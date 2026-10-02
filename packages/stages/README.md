# @reelforge/stages

Pipeline stage orchestration (PLAN.md §3, #7.1–7.7, #8.1, #8.3), Electron-free. `StageRunner` runs one
stage at a time on a project folder; export is in `@reelforge/pipeline`.

## Stages

| Stage (`id`)               | Inputs                                                                       | Outputs                                                                                                 | Model / tool                                                                                             | Validation                                                                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Script (`script`)          | `brief.json` (with `targetMinutes`)                                          | `research.md`, `beats.md`, `script.txt`, `.reelforge/reports/script.json`                               | `research` + `script` prompts, Sonnet, web tools, `script` side session                                  | research: sections + a source on every claim (1 repair, then warning); script: spoken text only, words within ±15 % of 150 wpm × target (1 repair, then **fail**); word count + duration estimate |
| Voiceover (`voiceover`)    | a recording (`wav mp3 m4a ogg flac`)                                         | `audio/vo.original.<ext>`, `.reelforge/voiceover.json` (sha256), `.reelforge/reports/voiceover.json`    | copy + hash; ffmpeg for the length                                                                       | format; same hash = no change; replace archives `vo.original.prev.<ext>` (setting); VO↔script report (wpm outside 110–190 → warning)                                                              |
| Audio cleaned (`clean`)    | `audio/vo.original.*`                                                        | `audio/vo.clean.wav`, `.reelforge/reports/clean.json` (LUFS before/after)                               | pipeline `cleanAudio`, preset from settings                                                              | loudness outside target ± tolerance → warning                                                                                                                                                     |
| Words timed (`words`)      | `audio/vo.original.*` (cleaned audio if pauses were shortened), `script.txt` | `timing/words.raw.json`, `timing/words.json`, `.reelforge/reports/words.json`                           | whisper.cpp (model from settings or the request's `model`, language from `project.json`) + align         | coverage < 0.85 or decoder loop → retry `-bs 5 -tp 0.2`, then the fallback model (if installed); best kept; mismatch regions reported; coverage added to the VO report                            |
| Storyboard (`storyboard`)  | `script.txt`, `timing/words.json`, style, kit catalog (`reelforge kit-docs`) | `storyboard.json`, stub `scenes/<shot>.js` for new shots, `.reelforge/reports/storyboard.json`          | `storyboard` prompt, Sonnet, `main` session (Economy: leaner storyboard)                                 | `validateStoryboard` (schema, contiguous from 0, boundaries on word starts, ≤ 2 same treatments in a row, scene paths) + 1 repair, then **fail**; `missingProps` collected                        |
| Scenes built (`scenes`)    | `storyboard.json`, `timing/words.json`, style, kit                           | `scenes/<shot>.js`, `.reelforge/scenes-report.json` (✓ ⚠ ✗ per shot), QA sheets `.reelforge/frames/qa/` | per shot: `scene-build` (Opus) → QA by code → `critic` (Haiku) → `scene-fix` (Opus) ≤ 2; `FrameRenderer` | see [Scenes built](#scenes-built-74-77); ✗ shots → **fail** (`quality`), ⚠ → warnings                                                                                                             |
| Sound cues (`sound-cues`)  | `storyboard.json`, `timing/words.json`, `audio/music/*`, scene sfx events    | `cues.json`                                                                                             | `sound-cues` prompt, Sonnet; **`generateDefaultCues`** in Economy mode, without Claude, or as fallback   | `validateCues` (`CuesFileSchema`, ambience ≤ −20 dB, music files exist, inside the timeline) + 1 repair; still invalid → default cues + warning                                                   |
| Sound design mixed (`mix`) | `cues.json`, `audio/vo.clean.wav`                                            | `audio/mix.wav`, `.reelforge/reports/mix.json`                                                          | pipeline `mixAudio`                                                                                      | **fail** unless loudness = target (−14) ± 1 LU and true peak ≤ −1 dBTP                                                                                                                            |

## Scenes built (#7.4–7.7)

```ts
const runner = new StageRunner({ …, scenes: { frames, onMissingProps, kitNames } });
await runner.run({ stage: 'scenes' }); // build every shot (or `shots: ['s03']`)
await runner.run({ stage: 'scenes', action: 'fix-what-looks-wrong' }); // a "Whole video" chip
```

- **Jobs**: one per storyboard shot, persisted as work items (`stage: 'scenes'`) in `pipeline.json`;
  `settings.scenes.concurrency` (default 2) at once, capped by the LimitGuard's concurrency (halved
  after a limit, recovering after successful turns) — create the app's guard with
  `maxConcurrency ≥ 2`. A limit pauses every job (TurnDriver) and resumes; a cancel/crash leaves the
  unfinished shots `pending` and the next run (without `shots`) continues them, never rebuilding
  finished ones. A run after a finished run (or with `shots`) rebuilds the targets.
- **Per shot** (`scenes/shot-job.ts`): `scene-build` turn (Opus, detached one-off session, no per-turn commit),
  then QA rounds run **by code** (`scenes/qa.ts`, Claude's self-report is not trusted): engine
  `lintScene` (errors are fatal) → smoke render at start, 25 %, 50 %, 75 %, end − 0.1 s through the
  `FrameRenderer` (console errors captured) → blank/uniform frames (colour stats + content share of
  8×8 blocks, robust to dithering) → `checkCards` (overlap, safe area, clipped) → anchors vs sfx
  (±150 ms) → only when all that is clean, the Haiku critic on a contact sheet
  (`.reelforge/frames/qa/<shot>/<label>.png`, critic JSON validated; an invalid reply is a note).
  Error findings → `scene-fix` turn with the findings, at most `maxFixIterations` (2). Result:
  ✓ clean · ⚠ findings left or missing props · ✗ lint/runtime error persisted (or a Claude turn
  failed). Stored in `.reelforge/scenes-report.json` and autocommitted `Scene s03 built ✓` (with two
  shots in flight a commit can also carry the other shot's file).
- **Missing props** (ADR-007): the storyboard's `missingProps` first, then a `MISSING:` reply line
  or `kit.props.<name>(` calls that neither the kit nor `kit-ext/props` has → `PropBuilder`: a
  `prop-build` turn writes `kit-ext/props/<name>.js`, QA by code (prop lint, turntable render,
  size, floating parts, determinism, Haiku critic), one fix turn, then "Prop <name> built ✓" and the
  shot is built again with it; a prop that still fails moves to `.reelforge/props-failed/` and the
  shot keeps ⚠ "missing prop: …". One build per name per run, `maxNewProps` (12) per film, all in
  `.reelforge/props-report.json`. A custom `onMissingProps(names, shot)` replaces the builder
  (`'added'` / `'skipped'` / `{ built, failed }`).
- **FrameRenderer**: `renderShot({ projectDir, shotId, times, cards }, signal)` — the same engine as
  preview/export. The app passes its render service; tests and `run-stage` use
  `src/cli/playwright-renderer.ts` (Playwright + SwiftShader, `planServiceShot` manifests).
- **Critics** (`critiqueFrames`, `programmaticCritique`): reusable outside the stage; the code layer
  needs no Claude.
- **Review modes** (`action`, `reviewVideo`): `fix-what-looks-wrong` — 3 frames/shot → contact
  sheets (8 rows each) → code checks + Haiku triage (`review-triage`) → Sonnet plan
  (`review-plan`, `{shot, change}`) → Opus `scene-fix` per shot (queue `scenes-review`) → re-QA;
  `phone-legibility` — static text-size check of `ctx.text` calls (scale ≥ `minTextScale` 2, glyphs
  ≥ `minGlyphPx` 14 px at 640 wide; lower-third secondary lines are mono ×1) + card checks → fixes
  → re-QA; `sync-check` — sync report → fixes for shots with events off by > 150 ms → re-QA →
  report again. Fixed shots: `Scene s03 fixed ✓`.
- **Sync report** (`syncReport()`, no Claude): every shot loaded once (build only); events = the
  scene's anchors (checked against `timing/words.json` through the fuzzy resolver), its `sfx.at`
  cues and the `cues.json` sfx of the shot, each against the nearest anchor (`ok` ≤ 150 ms, `off`,
  `free` > 0.5 s from any anchor, `outside-shot`) → `.reelforge/sync-report.json`.

## Runner

```ts
const runner = new StageRunner({
  projectDir,
  claude: new BridgeClaudeRunner(manager), // the app's SessionManager (extraEnv, permissions, usage)
  audio: createPipelineAudioTools({ ffmpegPath, whisper }),
  guard, // the app's LimitGuard (shared with the manager)
  settings: () => stageSettingsFromApp(appSettings),
  sceneSfx, // optional: sfx events recorded by scene builds
});
runner.on('event', (event) => …); // started · step · claude · paused · resumed · shot · warning · committed · done · failed
const result = await runner.run({ stage: 'voiceover', source }); // Result<StageSuccess, StageError>
```

- **Gating**: `canRun(stage, snapshot)` / `runner.readiness()` → `{ ready, reasons[] }` (missing files,
  stale or running upstream stages, broken `project.json`). A not-ready run returns `not-ready` with the reasons.
- **Status** in `.reelforge/pipeline.json` (`PipelineStateStore`): `running` → `done` | `failed` |
  `blocked` (Claude not logged in / missing tool) | `paused` (limit) | `idle` (cancelled). `running` left
  behind by a crash becomes `failed` on the next run.
- **Invalidation**: when a stage changes its output, downstream stages that ran or have files get
  `stale: true` + `staleReason` (e.g. a new voice-over → clean, words, storyboard, scenes, sound-cues,
  mix, export). Scene files are never touched; they follow new timings through anchors. Re-running clears it.
- **Limits**: a usage-limit turn pauses the guard; the stage becomes `paused` (pause persisted), waits
  for the guard's automatic resume (or cancel), then retries in the same session with a continuation prompt.
  A persisted pause is restored into the guard on the next run.
- **Cancellation**: `runner.cancel()` or `run(..., { signal })` → kills the Claude process tree /
  ffmpeg / whisper.
- **Autocommit** (`@reelforge/project`): `claude-turn` after every Claude turn and `pipeline-step`
  after every finished stage, trailer `ReelForge-Step: <stage id>`; nothing changed → no commit
  (audio and `.reelforge/` are git-ignored). Failures are warnings.
- **Models**: `promptModel` (Economy → Sonnet + `ECONOMY_HINT` per turn > `settings.models` > prompt
  default). Create the stages' SessionManager **without** `economy` (the hint is added per turn).
- **Usage**: booked by the SessionManager's `UsageLedger`; `StageSuccess.usage` sums the run's turns.

## Dev entry

```
pnpm --filter @reelforge/stages run-stage <project> <stage> [--source <file>] [--economy] [--no-commit]
pnpm --filter @reelforge/stages run-stage <project> scenes [--action <build|review mode>] [--shots s01,s02]
```

Uses the real `claude` CLI (spends subscription usage), ffmpeg and whisper; scenes render in
Playwright Chromium. Never run by tests.

## Tests

All Claude turns run on `tools/fake-claude` (sidecar `tools-write` steps; scene tests use `rules`
matched per shot and turn, see `src/testing/film.ts`), audio on `FakeAudioTools` (spike 03 whisper
fixtures), git in temp repos. Scene orchestration (8-shot film, limit → resume, restart, concurrency,
cancel, review) runs in the unit project on `ScriptedFrameRenderer`; the real engine (Playwright +
SwiftShader, slower) runs in the render project from `test/`: the 8-shot film, the broken-frame
fixtures of the critics (blank, clipped text, overlapping cards) and the sync report/check.
`pnpm --filter @reelforge/stages test` runs both. The real ffmpeg + whisper test
(`audio.integration.test.ts`, ~100 s) is opt-in: `REELFORGE_REAL_WHISPER=1` and the spike 03 cache.

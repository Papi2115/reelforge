# `reelforge` CLI — what the runtime Claude may call

The runtime Claude (the one building a video inside a project folder) may run exactly one Bash
command: `reelforge` (allowlist `Bash(reelforge *)` + the bash-guard hook: one plain command, no
`;`, `&&`, `|`, `>`, `$(`). Its working directory is the project folder; every path argument is
relative to it and must stay inside it. Source: `packages/cli` (README there for internals).

Exit code: **0** ok · **1** problems found (the output says what and how to fix) · **2** usage
error (wrong option; stderr says which). Every command accepts `--help` and `--json`.

## Commands

| Command                                                          | Use it to                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `reelforge status`                                               | see which stages are done, the shots (id, global times, treatment, scene file), last errors |
| `reelforge validate`                                             | check `project.json`, `brief.json`, `storyboard.json`, `timing/words.json`, `cues.json`     |
| `reelforge lint` / `reelforge lint scenes/s03_calc.js`           | determinism + scene-contract lint (forbidden APIs, state carried between frames); `kit-ext/props/*.js` get the prop contract |
| `reelforge frames --shot s03` / `--scene scenes/s03_calc.js`     | render 5 frames (or `--at 0,1.5,3`, local shot seconds) and get their PNG paths to Read       |
| `reelforge contact-sheet` / `--shot s03,s04` / `--per-shot 4`    | one grid image of every shot (or some) to Read; rows = shots, tiles labelled `s03 1.50s`     |
| `reelforge render-shot s03` / `--step 0.25`                      | judge motion and timing: one strip image of frames every step                                |
| `reelforge anchors --phrase "61 KB"`                             | find when a phrase is spoken (fuzzy: `61KB`, `sixty one kilobytes` match too) and in which shot |
| `reelforge anchors` / `--shot s03`                               | list the anchors and sfx cues each scene declares in `build()` with the ±150 ms landing check |
| `reelforge kit-docs` / `reelforge kit-docs desk`                 | the `ctx.kit` reference (project props marked project-local); with a name: params, anchors and an example call; `kit-docs prop-module`: how to write a project prop; `kit-docs ctx` / `annotate`: the scene context and `ctx.annotate` |
| `reelforge prop-preview fridge` / `--angles 0,45,90`             | a project prop (`kit-ext/props/fridge.js`) alone on a neutral stage from 4 angles, one sheet to Read, plus checks: lint, not blank, size 0.3–4 units, no floating parts, deterministic |

## Reading the output

- **Times**: `frames`, `contact-sheet`, `render-shot` take and print **local shot times** (0 = start
  of the shot, the `t` of `update(t, …)`). `status` and `anchors` print **global** times (seconds
  of the voice-over); `anchors` adds `(local …)`.
- **Frames**: `frames` prints one absolute PNG path per line — Read them. A `! looks blank` note
  means the frame is (almost) one colour.
- **Text cards**: `[card-overlap]` / `[card-outside-safe-area]` lines name the card ids (`id` option
  of `ctx.text.*` / `ctx.annotate.*`), the time range and the fix. Annotations add
  `[annotation-target-offscreen]`, `[annotation-target-hidden]` and `[annotation-off-anchor]`
  warnings (ADR-008).
- **Lint**: `file:line:col  error  rule  message` + a `fix:` line. A scene with lint errors is not
  rendered at all.
- **Scene failed to load/build**: the engine error, e.g.
  `[shot s03] anchor("62 KB", 1) is not spoken in words.json …`; `anchors` adds a `hint:` with the
  closest spoken phrases.
- **Anchors**: `ok` (a cue lands within ±150 ms), `MISS` (a cue is 150–500 ms off: schedule it at
  the anchor time), `OUTSIDE` (the phrase is spoken outside the shot), `info` (no cue on it — fine
  when the event is visual only).
- Each command ends with `result: ok` or `result: N problems found; <what to do next>`.

## Suggested self-QA loop (per scene)

1. `reelforge lint scenes/<file>.js` → fix until `result: ok`.
2. `reelforge frames --shot <id>` → Read the frames; fix text-card and console problems.
3. `reelforge anchors --shot <id>` → no `MISS`/`OUTSIDE`.
4. Optional: `reelforge render-shot <id>` for motion; at the end `reelforge contact-sheet` for the
   whole video.

## Project props (`kit-ext/props/<name>.js`)

When the kit lacks an object, a project prop is written as an ES module `export const prop = { name,
description, params, anchors, methods, build(ctx, params) }` using only `ctx.kit.voxel` (contract,
scale rules, example: `reelforge kit-docs prop-module`). Every render manifest of the project
carries the props (`kitExtensions`), so scenes call `ctx.kit.props.<name>()` in preview, export and
the CLI alike. Loop: `reelforge lint kit-ext/props/<name>.js` → `reelforge prop-preview <name>` →
Read the sheet → fix. Design: `docs/decisions/ADR-007-project-props.md`.

## Files it writes

Only `.reelforge/frames/` inside the project (frames, contact sheets, strips, prop turntables in
`.reelforge/frames/props/<name>/`; regenerated on every run). It never edits project files.

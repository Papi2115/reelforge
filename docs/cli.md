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
| `reelforge kit-docs` / `reelforge kit-docs desk`                 | the `ctx.kit` reference (project props marked project-local); with a name: params, anchors and an example call; `kit-docs prop-module`: how to write a project prop; `kit-docs ctx` / `annotate` / `ambient`: the scene context, `ctx.annotate` and `ctx.ambient`; entries of looks other than voxel are marked `(look <id>)`. The index is kept under ~26,000 (voxel-only) / 27,500 (mixed) characters so Claude Code shows it in full: voxel-only projects list no other looks, mixed projects list look entries and project props one line each, and the longest entries keep only param names when the kit outgrows it (a last line says so) |
| `reelforge kit-docs props` / `env` / `fx` / `templates` / `project` / `voxel` / `retro-ui` / `diorama` / `blueprint` (`--full`, `--page 2`) | one kind, the look templates, the project's props or one look: one line per entry; `--full` adds every param (long slices come in pages); an unknown name gets "did you mean" suggestions |
| `reelforge looks`                                                | the available looks (2.0: `voxel`, `retro-ui`, `diorama`, `blueprint`) with their rolls, treatments and sound palette, what rolls A/B/C mean, and the project's look mode (`voxel-only` / `mixed`) |
| `reelforge assets search --query "apollo 11"` / `--source nasa` / `--kind video` / `--limit 5` | find open-licence images/footage (Wikimedia Commons, Openverse, Internet Archive public domain, NASA, Library of Congress); prints keys `<source>:<id>`, size, licence (verified/UNVERIFIED); titles/authors inside an `UNTRUSTED EXTERNAL DATA` block |
| `reelforge assets propose --ids wikimedia:105654713,nasa:jsc2007e034221` | research mode `ask`: a proposal package (fresh metadata + thumbnails) the user approves in the app |
| `reelforge assets list`                                          | research mode, the project's asset catalogue (`assets.json`: the user's own files with their descriptions, library copies, downloads) and pending proposals; no network |
| `reelforge assets credits` / `--all`                             | the "Credits" text (title, author, licence, link) of the assets the scenes/storyboard name; unverified licences flagged; the user's own files skipped; no network |
| `reelforge assets library search --query "nokia"` / `--tag` / `--kind` / `--licence verified\|unverified\|own` / `--favorites` | the user's global asset library (inside the app: `REELFORGE_ASSET_LIBRARY`); prints keys (12 hex digits), licence, tags; no network, every research mode |
| `reelforge assets library use 3f2a9c01d4e7` / `--as nokia`       | copy a library asset into the project (`.reelforge/assets/`, `assets.json`, `fromLibrary`); nothing is downloaded; every research mode |
| `reelforge fetch-asset --source nasa --id jsc2007e034221` / `--as apollo-pad` | download one asset into `.reelforge/assets/<id>.<ext>` and record it in `assets.json` (mode `ask`: approved items only) |
| `reelforge fetch-asset --url https://… [--kind video]`           | research mode `full-auto` only: a direct https file, licence `unverified` |
| `reelforge prop-preview fridge` / `--angles 0,45,90`             | a project prop (`kit-ext/props/fridge.js`) alone on a neutral stage from 4 angles, one sheet to Read, plus checks: lint, not blank, size 0.3–4 units, no floating parts, deterministic |
| `reelforge cast list` / `cast check characters/roles/chef.json` / `cast preview chef` | people for scenes (`kit.cast`: mascots, cast, mannequin, project roles and accessories); check a role or accessory file ("did you mean" for unknown ids, spec checks); a role alone, 4 angles + 2 poses, one sheet to Read, plus checks: outfit colours, palette, face, accessories, height within the pack's range, not blank, vibe guard, deterministic |

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

## Project roles (`characters/roles/<id>.json`)

A person the character pack lacks is a role spec (JSON, the kit's vocabulary), optionally with an
accessory extension `characters/accessories/<id>.json` (boxes on a slot). Every render manifest
carries them (`castRoles`), so scenes call `ctx.kit.cast.person('<id>')` in preview, export and the
CLI alike. Loop: `reelforge cast check characters/roles/<id>.json` → `reelforge cast preview <id>`
→ Read the sheet → fix. Design: `docs/decisions/ADR-026-cast-roles.md`, `docs/characters.md`.

## Files it writes

Only `.reelforge/frames/` inside the project (frames, contact sheets, strips, prop turntables in
`.reelforge/frames/props/<name>/`, role lineups in `.reelforge/frames/roles/<id>/`; regenerated on every run). It never edits project files —
except the asset commands: `fetch-asset` writes the file to `.reelforge/assets/` and its record to
`assets.json` (tracked), `assets propose` writes `.reelforge/assets/proposals/<n>.json` and
thumbnails in `.reelforge/assets/thumbnails/`.

## Asset research and the network

`reelforge assets search|propose` and `reelforge fetch-asset` are the only network path of the
runtime Claude (WebFetch/WebSearch exist only in the research/script stages; curl, wget,
PowerShell and every other shell command are blocked by the bash guard). What they may do is set
by the project's research mode (`project.json` `researchMode`, chosen by the user in the app; absent
= `off`). Guard matrix, sources, safety limits and the metadata format: [`docs/assets.md`](assets.md).

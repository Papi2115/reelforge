# @reelforge/cli

`reelforge`: the command the runtime Claude runs (Bash allowlist `Bash(reelforge *)`, see
`packages/claude-bridge`) inside a video project folder to check its own work. Every command works
on the current directory (the project root), prints compact line-oriented text (or JSON with
`--json`) and exits with **0** ok, **1** problems found, **2** usage error. What the runtime Claude
may call and how to read the output: [`docs/cli.md`](../../docs/cli.md).

| Command                                                              | What it does                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`                                                             | pipeline stages (which files exist), shots with times and scene files, last errors from `.reelforge/pipeline.json`                                                                                                                                       |
| `validate`                                                           | zod-validates `project.json`, `brief.json`, `storyboard.json`, `timing/words.json`, `cues.json` + cross-file checks                                                                                                                                      |
| `lint [file.js…]`                                                    | determinism + contract lint (`lintModule`: scenes, and `kit-ext/props/*.js` in prop mode); default `scenes/*.js` + `kit-ext/props/*.js`                                                                                                                  |
| `frames (--shot <id> \| --scene <file>) [--at t,…]`                  | PNG frames of one shot into `.reelforge/frames/<shot>/`, text-card QA (`checkCards`), console errors, blank-frame check                                                                                                                                  |
| `contact-sheet [--shot ids \| --all] [--per-shot n]`                 | one labelled PNG grid (row per shot) in `.reelforge/frames/`                                                                                                                                                                                             |
| `render-shot <id> [--step s \| --at t,…]`                            | motion preview: frames every `step` s + one strip image `.reelforge/frames/<id>/clip.png`                                                                                                                                                                |
| `anchors [--shot id] [--phrase "…" [--nth n]]`                       | `--phrase`: fuzzy resolution over words.json (pipeline `AnchorIndex`); else a build-only dry run listing anchors/sfx with ±150 ms check                                                                                                                  |
| `kit-docs [name]`                                                    | `kitCatalog()` + the project props (metadata read statically) as compact reference; with a name: params, anchors, example call; `prop-module`: how to write a project prop; `ctx` / `annotate` / `ambient`: scene context, `ctx.annotate`, `ctx.ambient` |
| `looks`                                                              | available looks of the project's style (kit `listLooks`; a world's style lists only its own, ADR-029): rolls, treatments, sound palette, description; roll legend; project look mode                                                                     |
| `prop-preview <name> [--angles a,…]`                                 | turntable of `kit-ext/props/<name>.js` (a generated standalone scene) as one sheet + checks: lint, blank, size, floating parts, determinism                                                                                                              |
| `assets search\|propose\|list\|credits`                              | asset research (ADR-012): open-licence search, proposal packages for the user (mode ask), the `assets.json` catalogue, Credits text; the research mode of `project.json` is enforced by `src/assets/guard.ts`                                            |
| `fetch-asset (--source <id> --id <id> \| --url <https>) [--as name]` | one file into `.reelforge/assets/` through the guarded transport (`src/assets/http.ts`: https, ban list, SSRF, redirects, caps, magic bytes)                                                                                                             |

## How rendering works

Rendering commands use one of two backends with identical output (same PNG paths, text, JSON):

- **Inside the app** (`REELFORGE_RENDER_URL` + `REELFORGE_RENDER_TOKEN` set by the app for its
  `claude` processes): the app's local render service (`src/service/protocol.ts`, loopback HTTP,
  bearer token, only the open project). The app builds the same per-shot manifest from the project
  files and renders it in its hidden GPU window; frames come back as PNGs. No Playwright needed.
- **Otherwise** (dev, CI): the engine harness (`@reelforge/engine/cli`: Playwright Chromium +
  SwiftShader).

Both run the same sandboxed engine as preview and export. A shot is rendered **on its own but
at its real place on the timeline**: the manifest gets an empty padding shot over `[0, t0)`, so the
seed, local times and anchors are exactly those of the full video, and only that shot's scene is
built (one broken scene does not hide the others). Transitions from the previous shot are not
shown. Times passed to `--at` are **local shot times** (0 = shot start), like `t` in `update()`.

Scenes run only inside the engine's sandboxed iframe, never in Node. The CLI reads and writes only
inside the project (`..`, absolute paths elsewhere and links out of the project are rejected) and
uses no network beyond the loopback server of the harness.

The harness needs the engine sources and Playwright Chromium (dev setup:
`pnpm --filter @reelforge/engine exec playwright install --only-shell chromium`). Non-rendering
commands do not load it, so they work wherever the bundle lives.

## Build and put it on PATH

```sh
pnpm --filter @reelforge/cli build      # -> packages/cli/dist/reelforge.mjs (one Node script)
pnpm --filter @reelforge/cli test       # unit + render tests (SwiftShader)
```

The app writes launchers and prepends their folder to the PATH of the spawned Claude:

```ts
import { writeCliShims } from '@reelforge/cli';
await writeCliShims({
  dir: path.join(appData, 'bin'),
  runtime: process.execPath, // in Electron: the app binary, run as Node
  env: { ELECTRON_RUN_AS_NODE: '1' },
});
```

It writes `reelforge` (sh; used by Git Bash, which is what Claude Code's Bash tool runs on Windows)
and on Windows also `reelforge.cmd` (cmd/PowerShell; switches to UTF-8 code page when a path has
non-ASCII letters and restores it). Paths with spaces and Polish letters are tested.

## Layout

```
src/cli.ts              dispatch, --help/--json, exit codes (the only output layer with main.ts)
src/commands/*.ts       one module per command (+ anchors-check.ts: pure ±150 ms landing check)
src/project/*.ts        project paths + confinement, JSON loading/validation, cross-file checks, shot plans
src/render/*.ts         harness session, shared render flow + QA issues, PNG output, contact-sheet raster
src/shims.ts            PATH launchers
scripts/build.mjs       esbuild bundle (playwright/esbuild required lazily)
test/fixtures/project   2-shot fixture project; test/render/*: harness + bundle integration tests
```

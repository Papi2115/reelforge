# Golden frames and frame rendering (PLAN 2.6, 2.7)

All frames below are rendered by the **same engine** the app uses (`packages/engine`, sandboxed
iframe, ADR-004), driven by headless Playwright Chromium with **SwiftShader** (software WebGL,
`--use-angle=swiftshader --enable-unsafe-swiftshader`). No GPU is needed, so this works the same
on Windows and Linux CI. Code: `packages/engine/src/cli/` (Node-only dev tooling, exported as
`@reelforge/engine/cli`; Playwright is not a product dependency, ADR-002).

## Render frames to look at: `pnpm render:frames`

```
pnpm render:frames -- --scene packages/engine/examples/s00_hello.js --at 0,2.5,5
pnpm render:frames -- --manifest path/to/video.json --at 3.5 --out some/dir --preset noir-voxel
pnpm render:frames -- --help
```

- Prints one absolute PNG path per line on stdout (status goes to stderr), e.g.
  `packages/engine/out/frames/s00_hello/s00_hello_t2.500.png`. Default output:
  `packages/engine/out/frames/<scene-or-manifest-name>/` (git-ignored).
- `--scene` renders the file as a single shot from t=0 (length `--duration`, default
  `max(5, last --at + 1)`, fps 30, `--seed` default 2115). `ctx.anchor()` needs words: `--words`
  or, automatically, `words.json` next to the scene, `../timing/words.json` (project layout) or
  `../words.json`. `examples/words.json` makes the example scene's `anchor('hello world')` work.
- `--manifest` takes a render manifest JSON (`@reelforge/shared` `renderManifestSchema`);
  `shots[].scene.source` may be omitted and is then read from `shots[].scene.file`, relative to
  the manifest. `--at` is global video time.
- `--preset <id>` sets `manifest.style` (unknown ids are rejected with the list of presets).
- Every scene is linted first (determinism lint, below). Errors are printed and nothing is
  rendered (exit 1) unless `--no-lint` is given. Console/page errors of the engine are printed
  and make the exit code 1 (the PNGs are still written).
- Relative paths resolve against the directory you ran `pnpm` from (`INIT_CWD`); spaces in paths
  are fine. Exit codes: 0 ok, 1 lint/render failure, 2 usage error.

## Golden-frame tests: `pnpm test:render`

`pnpm test:render` runs the vitest `render` project (`packages/*/test/**/*.test.ts`). Tests call
`compareWithGolden(name, { width, height, data })` (`packages/engine/src/cli/goldens.ts`).

### Goldens are per backend (ADR-002)

GPU and SwiftShader renders differ by ~6 % of pixels, so a golden is only valid for the backend
that produced it. The harness always renders with SwiftShader, so goldens live in
`packages/engine/test/goldens/swiftshader/<name>.png`. Never compare them with GPU renders
(e.g. frames from the app's hidden export window); a future GPU suite gets its own directory.

Annotation goldens (`annotations-<style>-sheet`) are 2x2 contact sheets of
`examples/s02_annotations.js` (one settled frame per act, every `ctx.annotate` type) per style,
which keeps them small (`packages/engine/test/render/annotations.test.ts`).

The kit's goldens (`kit-*`) live next to the kit, in `packages/kit/test/goldens/swiftshader/`
(`compareWithGolden(name, frame, undefined, { goldenDir })`), rendered by the same harness.
The kit's voxel perf test (`packages/kit/test/render/kit-perf.test.ts`) writes its numbers to
`packages/kit/out/perf/voxel-stress.json`; `REELFORGE_KIT_PERF_GPU=1 pnpm test:render
packages/kit` also measures the hardware GPU (ANGLE D3D11) and requires 60 fps there (ADR-006).

### Tolerance

A pixel *differs* when any RGBA channel differs by more than `channelTolerance` (0–255); a frame
*matches* when at most `maxDiffShare` (0–1) of its pixels differ. Sources, last wins:

1. `packages/engine/test/goldens/golden-config.json` (versioned, zod-validated):
   ```json
   { "version": 1, "channelTolerance": 0, "maxDiffShare": 0.002,
     "overrides": { "glitch-mid": { "maxDiffShare": 0.01 } } }
   ```
   `overrides` are keyed by golden name (file name without `.png`). Missing file = the defaults
   above (exact pixels, 0.2 % of the frame may differ).
2. Environment: `REELFORGE_GOLDEN_CHANNEL_TOLERANCE`, `REELFORGE_GOLDEN_MAX_DIFF_SHARE`,
   `REELFORGE_GOLDEN_CONFIG` (path of another config file).
3. An explicit `tolerance` argument of `compareWithGolden` in a test.

Tests rely on `compareWithGolden` throwing on a mismatch; do not additionally assert
`result.differingShare` against a constant (that would override the configured tolerance).

### On failure

`compareWithGolden` throws `GoldenMismatchError` and writes to
`packages/engine/out/golden-diff/swiftshader/`:

- `<name>.actual.png` — what was rendered now,
- `<name>.expected.png` — the golden,
- `<name>.diff.png` — differing pixels in red over a dimmed greyscale of the golden.

Stale diff files of a golden are removed when it passes again. CI uploads this directory as the
`golden-diff-<os>` artifact.

### Updating goldens

```
pnpm test:render -- --update-goldens            # rewrite every golden the tests touch
pnpm test:render -- --update-goldens -t goldens # only tests whose name matches "goldens"
```

`--update-goldens` sets `REELFORGE_UPDATE_GOLDENS=1` (which also works directly); other
arguments go to vitest. A missing golden is written automatically on a local run but **fails on
CI** (`CI` set), so new goldens must be generated locally, looked at (open the PNG), and
committed together with the change that explains them. Rendering is deterministic: rewriting
unchanged goldens produces byte-identical files, so `git status` shows only real changes.

## Determinism lint (PLAN 2.6)

`lintScene(source, { filename })` (`@reelforge/engine`) parses a scene with acorn and returns
`{ rule, severity, line, column, message, fix }[]` (1-based positions; `message`/`fix` are
written for an LLM). Rules: `no-wall-clock`, `no-random`, `no-timers`, `no-network`,
`no-import`, `no-eval`, `no-node`, `no-host-globals`, `no-storage`, `no-css-animation`,
`no-dynamic-global-member` (warning), `scene-contract`, `no-module-state-in-update`,
`no-incremental-update`, `parse-error`. It follows aliases (`const r = Math.random`,
`const { random } = Math`, `globalThis['Date']`) and respects shadowing (a local `Date` is fine).

- CLI: `pnpm lint:scene -- scenes/s01.js [--json]` (exit 0 clean/warnings, 1 errors, 2 usage);
  the function `runLintCli(args, io)` is exported for the `reelforge lint` command (PLAN 5.6).
- Loader gate: `createSandboxedHarness({ ..., lintScenes: true })` (or `harness.html?lint`)
  rejects `load()` with a `scene-lint` EngineError listing the diagnostics before any scene code
  runs. `render:frames` lints in Node before rendering.

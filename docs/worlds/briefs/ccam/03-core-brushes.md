# Brief 03 — PLAN.md#14.3: port of core + brushes (C-CAM) against a Paint2D interface

Branch: `phase-14/ccam-core-brushes`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first (rules).

## Goal
Port the C engine's core helpers and brush layer from classic scripts (`window.ST`) to TypeScript
modules without globals, drawing through a small `Paint2D` interface (a subset of
CanvasRenderingContext2D) so the same code can later run on a real CPU-backed 2D canvas or on a path
rasterizer. No world registration yet (another task builds the world skeleton after spike 14.0).

## Read first
- `docs/concepts/c-cam-style/README.md`, `docs/01-STYLE_GRAMMAR.md`, `docs/02-ARCHITECTURE.md` (all,
  esp. §4 time model, §5 hashing, §6 determinism), `docs/03-API_REFERENCE.md` (core + brushes),
  `docs/07-REELFORGE_INTEGRATION.md` (§4–§7: what the port must change).
- Source to port (film 3 has the newest copy): `docs/concepts/c-cam-style/films/03-apollo-11/js/core.js`
  and `brushes.js`. Compare with `films/01-*/js` and `films/02-*/js` for divergences and note them.
- ReelForge rules: CLAUDE.md §3.2 (determinism: no Date/Math.random/performance.now/rAF/timers/fetch),
  §6.

## Do
1. `packages/kit/src/worlds/c-cam/draw/paint.ts`: the `Paint2D` interface — list EXACTLY the 2D-context
   methods/properties the ported code needs (path building: beginPath/moveTo/lineTo/quadraticCurveTo/
   bezierCurveTo/arc/ellipse/closePath/rect; fill/stroke/clip; save/restore/translate/rotate/scale/
   setTransform/resetTransform; fillStyle/strokeStyle/lineWidth/lineCap/lineJoin/globalAlpha/
   globalCompositeOperation if used; gradients only if the code truly uses them — the grammar forbids
   gradients, so flag any use). Keep it minimal; no text drawing (`fillText` is forbidden by ADR-005).
2. `core.ts`: size/fps constants as exported values (1920x1080, 24 fps, ANIM 12) — NO module-level
   mutable state; hash (`ST.hash`: must produce exactly the original outputs; test on 1000 inputs
   against a reference list computed from the original JS, either by running it in the test through
   `node:vm` or from a fixture checked into the test), ease/key/step/twos helpers, talk/blink timing,
   palette tokens (INK `#16120e`, bone, mustard, rust… as typed constants with the `_D` shade helper).
3. `brushes.ts`: curve, inkLine (filled ribbon, width swell 0.4–1.9x along arc length, tapered open
   ends), blob, tube, hatch, mottle, rough/rect/beam, bands/pool/gloom/bricks, camera transform helper
   — all as pure functions taking `(g: Paint2D, ...)`. REMOVE the original module state `ST.LW` /
   `ST.camZ`: pass the line-weight scale/zoom explicitly through a small `BrushEnv { zoom: number }`
   argument (or a closure bound to an env); behaviour identical for the same zoom.
4. `RecordingPaint` (test helper, `packages/kit/src/worlds/c-cam/draw/recording-paint.ts` or under test
   support): implements Paint2D by recording calls; used for deterministic unit tests (snapshot of the
   call sequence) and as the base for later rasterizer tests.
5. Tests: hash equality, ease/key/step values, ribbon width range (0.4–1.9x), taper, `twos`
   quantisation, determinism (same call twice = same recording), no forbidden identifiers in the module
   sources (Date, Math.random, performance, document, window, requestAnimationFrame, setTimeout,
   fillText, filter). If headless Chromium is available in the environment (Playwright is a dev
   dependency; CI installs it), add ONE render test that runs the ported `inkLine`/`blob` on a real
   canvas (`willReadFrequently: true`) and compares with a stored golden (follow the pattern in
   `packages/kit/test/render/`); if that is not feasible in the cloud environment, say so and skip only
   that test.
6. Document divergences from the original in a header comment of each file (state removal, explicit
   zoom argument, any bug fixed).

## Acceptance
`pnpm typecheck`, `pnpm lint`, targeted vitest for packages/kit green; files <= 400 lines; no new
dependencies; the PR lists the exact Paint2D surface and the divergence list.

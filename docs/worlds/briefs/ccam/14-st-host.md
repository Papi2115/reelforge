# Brief 14 — PLAN.md#14.21 part A: the `ST` film host inside the engine

Branch: `phase-14/ccam-st-host`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` (rules; you are the Manager, code through the `coder`
subagent) and `docs/worlds/c-cam-AUTHORING-MODE.md` (the design). This is the foundation: nothing else
in the authoring mode works without it.

## Goal
Render an ORIGINAL-format C-CAM film (classic scripts with a global `ST`, exactly like
`docs/concepts/c-cam-style/films/03-apollo-11/js/`) inside ReelForge's frame host, deterministically,
for preview, `reelforge frames` and export, with the project's own `film/js/*.js` files as the
source. Preview = export (CLAUDE.md §3.3).

## Read first
`docs/concepts/c-cam-style/docs/{02-ARCHITECTURE,03-API_REFERENCE,06-AUTHORING}.md`, the prototype
files `films/03-apollo-11/js/{core,brushes,face,grime,rig,poses,timeline,player,film}.js` (what a
film is: `ST.defineShot`, `film.js` duration table, `renderFrame(ctx,t)`), `docs/spikes/
ccam-canvas.md` and ADR-004 addendum (kit-side CPU canvas rules), packages/kit/src/fx/ink-stage.ts and
packages/kit/src/worlds/c-cam/stage*.ts (the working canvas stage), packages/engine harness
(host.ts, frame-entry.ts, module-loader.ts; CSP `script-src 'self' blob:`), render manifest schema
(packages/shared/src/render-manifest.ts), export pipeline (packages/pipeline/src/export), desktop
manifest builder (apps/desktop/src/main/project-manifest.ts), cli project loader
(packages/cli/src/project/shots.ts).

## Do
1. Manifest field `inkFilm?: { files: {path, source}[], fps: 24, size: [1920,1080], durationS }`
   (zod, additive; absent = unchanged). A project with `film/js/*.js` and `film/film.json`
   (`{ order: [...scripts], durationS }`) produces it (cli service + desktop manifest builder).
2. Engine: when `inkFilm` is present the frame host loads the scripts in `order` as classic scripts
   (blob script elements inside the sandboxed frame, no `import`) into a context exposing `window.ST`,
   creates the CPU canvas (`willReadFrequently: true, alpha: false`, 1920x1080), and for a frame at
   time t (seconds) resets the canvas, calls the film's `renderFrame(ctx, t)` (or the timeline function
   the prototypes use), uploads as the full-frame textured quad, passes through the existing
   post path with `quantize: false`. Reuse the kit ink-stage canvas code; no module state across
   frames beyond what the original does (document the original's state: ST.LW, ST.camZ reset per
   frame; make the host reset them before each frame so out-of-order seeks stay deterministic).
3. Time: the prototypes quantise t to 1/24 and act on twos; keep that in the host so output
   equals the prototype player's output. Add a test that rendering t in forward, reverse and random
   order gives identical hashes.
4. Lint for film scripts (`reelforge lint` on `film/js/*.js`): reuse the determinism rules
   (Date, Math.random, performance.now, timers, fetch, rAF outside player, document.write...) but
   ALLOW `fillText`/`strokeText`/`font` with system fonts for this mode (ADR-005 world exception)
   and `ctx.canvas`/`document.createElement('canvas')` only if the original uses it deterministically
   (the film-1 scratch canvas broke determinism: warn, do not error). Fonts: probe availability and
   record into the export cache key as the c-cam ink-fonts code already does.
5. Shots: derive `storyboard.json` shot table from the film's own shot list (id, t0, t1) so the rest of
   the pipeline (export segments, anchors report, sound, thumbnail) works; one segment per shot is
   fine. Export cache key = hash of all film files + fonts report (any change re-renders
   everything; acceptable).
6. Seed assets: a function `seedFilmProject(dir)` copying the engine files (core, brushes, face,
   grime, rig, poses, timeline) from one canonical copy shipped in `packages/stages/assets/
   c-cam-engine/` (take film 3's copy, apply the state fixes from docs/07 §7 minimally: no
   `window` identifiers other than `ST`; keep behaviour identical, goldens prove it) plus an empty
   film.js / film.json template.
7. Golden test: take the Apollo 11 prototype (films/03-apollo-11) as a fixture project (copy only the
   JS needed into `packages/engine/test/fixtures/ccam-film/` — keep size reasonable: you may use a
   trimmed film with 3 shots), render 6 frames through `reelforge frames` and the engine render
   test, compare with the prototype's own proof frames (visual tolerance) and store goldens.
8. Docs: kit-docs topic or `docs/worlds/c-cam-AUTHORING-MODE.md` section "Host API" describing exactly
   what a film may use.

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:render` green; every other style/world
byte-identical; a trimmed Apollo fixture renders through preview manifest + `reelforge frames` +
export deterministically; PR lists the manifest schema, host behaviour and any deviations.

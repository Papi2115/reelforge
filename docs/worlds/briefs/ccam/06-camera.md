# Brief 06 — PLAN.md#14.6: camera for the C-CAM world

Branch: `phase-14/ccam-camera`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first (rules). Prerequisites merged to `main`: 14.3
(`packages/kit/src/worlds/c-cam/draw/{paint,core,brushes}.ts`). If missing, stop and say so.

## Goal
One camera system for the world: a single cut table `{ at, name?, x, y, z, rot? }` (hard cuts, optional
keyed tracks), foreground pieces in screen space and in world space, the foreground silhouette without
a helper canvas, and a coverage check so a framing never shows an undrawn edge of a set. The three
films have three different camera APIs; unify them (doc 05 §2, doc 07 §6.6).

## Read first
- `docs/concepts/c-cam-style/docs/05-CAMERA_GUIDE.md` (all), `02-ARCHITECTURE.md` §4 (clocks: cuts on
  twos vs raw t), `03-API_REFERENCE.md` (camera), `07-REELFORGE_INTEGRATION.md` §6.6.
- Sources: `films/03-apollo-11/js/camera.js` (`ST.cutCam`, `ST.fgShape`), `films/01-*/js/camera.js`
  (`[[at,end,a,b]]` with easing), `films/02-*/js/camera.js` (named cuts), `brushes.js`
  (`ST.camera`, `ST.fg*`), and the scratch-canvas silhouette code in film 1 `sets/sets-a.js` (~line
  71): replace with a path-only silhouette (no helper canvas; it breaks determinism).
- The ported brushes (`BrushEnv.zoom`) from brief 03.

## Do
1. `packages/kit/src/worlds/c-cam/draw/camera.ts`:
   - types `Cut { at: number; name?: string; x: number; y: number; z: number; rot?: number; ease?:
     'cut' | 'lin' | 'inOut' | 'out' | 'back'; to?: {x,y,z,rot?}; end?: number }` and a pure
     `resolveCut(cuts, t)` (last cut with `at <= t` wins; hard cut; optional within-framing move with
     the easing; cut selection on twos like film 1/2 or raw t like film 3 — expose `clock: 'twos' |
     'raw'`, default `'twos'`, document why);
   - `applyCamera(g, env, cam)` (world point at frame centre, zoom z in 0.8–5.4, Dutch roll rot in
     −7..+7 degrees, sets `BrushEnv.zoom`), returns the inverse mapping helpers (world↔screen).
   - `fgScreen(g, env, fn)` and `fgWorld(g, env, cam, fn)` (foreground in screen space and in world
     space), `silhouette(g, path, fill)` path-only.
   - `coverage(cam cuts, setBounds, frame)`: pure check returning the list of cuts whose framing
     rectangle (accounting for z and rot) leaves the set bounds; used by lint/QA later.
2. A zod schema for the cut table (used by scenes' `meta` and by later validators).
3. Tests: cut selection (boundaries, on twos), easing endpoints, rot/zoom ranges and clamping,
   inverse mapping round trip, coverage detection on a synthetic set, determinism, no forbidden
   identifiers. One recording test of `applyCamera` call sequence.
4. Header comments: how each of the three film dialects maps onto the unified table (a short
   conversion note per film, so the fixture-film task can port the shot lists mechanically).

## Acceptance
`pnpm typecheck`, `pnpm lint`, kit tests green; files <= 400 lines; the PR lists the public API.

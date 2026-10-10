# Brief 05 — PLAN.md#14.4: port of faces, grime and poses (C-CAM)

Branch: `phase-14/ccam-face-grime-poses`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first (rules). Prerequisites merged to `main`: 14.3
(`packages/kit/src/worlds/c-cam/draw/{paint,core,brushes}.ts`, `RecordingPaint`). If missing, stop and
say so.

## Goal
Port the face system (14 expressions), the grime shapes and the pose library from the film engine to
TypeScript, drawing through `Paint2D`, no globals, deterministic. No rig, no world registration.

## Read first
- `docs/concepts/c-cam-style/docs/01-STYLE_GRAMMAR.md` (§6 faces, §4 grit, §10 motion),
  `02-ARCHITECTURE.md`, `04-CHARACTER_GUIDE.md` (§2 D dimensions, §3 views, §5 poses),
  `03-API_REFERENCE.md` (face, grime, poses), `07-REELFORGE_INTEGRATION.md` §5–§7.
- Sources (film 3 newest): `films/03-apollo-11/js/face.js` (200 lines), `grime.js` (98),
  `poses.js` (76). Diff against films 1/2 and note divergences.
- The ported core/brushes API from brief 03 (names are in the merged files; do not change them).

## Do
1. `packages/kit/src/worlds/c-cam/draw/face.ts`: `EXPR` table (14 expressions, default deadpan,
   snap on change), eye/brow/mouth/stubble/wart/pores/hand drawing, jaw-flap speech (`talk` from
   core), hand kinds (fist, open, point, grip, flat). Pure functions
   `(g, env, params) => void`; expression selection is a pure function of (cue list, t) on twos.
2. `grime.ts`: flat grit shapes (mottle, hatch, stains, cracks, stubble, warts) — no textures,
   gradients, noise or blur; 4–6 marks per face as in the grammar; all placement from the integer
   hash of a seed (no Math.random).
3. `poses.ts`: the body-space pose library scaled by `D` (stand, akimbo, jig, flail, point R, …) as
   data + a pure `blendPose(a, b, k)` if the original has it; type `Pose`, `BodyDims` (the `D` record)
   with a zod schema in the module (used later by `kit-ext/people` loading).
4. Remove module state; any value the original kept in `ST.*` becomes an explicit argument.
5. Tests: expression table completeness (14 names), snap behaviour, determinism (same call twice =
   same `RecordingPaint` recording), grime placement stable for a seed, pose scaling by D, no
   forbidden identifiers (Date, Math.random, performance, document, window, rAF, timers, fillText,
   filter). If headless Chromium is available: one render test (face sheet of 6 expressions) with a
   golden.
6. Header comments list divergences from the original code and any bug fixed.

## Acceptance
`pnpm typecheck`, `pnpm lint`, kit tests green; files <= 400 lines; the PR lists the exported API
(function signatures) so the rig task (14.5) can import it.

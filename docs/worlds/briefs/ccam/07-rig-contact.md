# Brief 07 — PLAN.md#14.5: port of the rig + contact solver (C-CAM)

Branch: `phase-14/ccam-rig-contact`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first (rules). Prerequisites merged to `main`:
14.3 (`packages/kit/src/worlds/c-cam/draw/{paint,core,brushes}.ts`), 14.4
(`.../draw/{face,grime,poses}.ts`: expressions, grime, pose library, `BodyDims`). If missing, stop
and say so.

## Goal
Port the character rig of the film engine — views, ring, projection, 2-bone IK, face guard, draw
layers, limbs/feet — and the hand/object contact helpers (palmWorld, reachPalm, figToWorld, bowPt)
into one coherent TypeScript API, deterministic, no globals, drawing through `Paint2D`. A hand placed
on a world point must land within 2 px (the film's `koban` check reached 1.3 px). Character *modules*
(people files) come in task 14.8; here the rig only needs a `Character` type and a test character.

## Read first
- `docs/concepts/c-cam-style/docs/04-CHARACTER_GUIDE.md` (all: §2 D dimensions, §3 views, §5 hand
  and limb rules, §6 faces, §8 how a person is authored), `01-STYLE_GRAMMAR.md` §6–§7,
  `02-ARCHITECTURE.md`, `03-API_REFERENCE.md` (rig, poses), `07-REELFORGE_INTEGRATION.md` §5–§7.
- Sources: `films/03-apollo-11/js/rig.js` (138 lines: views, ring, proj, IK, guard, layers,
  drawArm/Leg/Foot, solve) and the contact code from film 1 (`films/01-samurai-edo/js/` —
  `palmWorld`, `reachPalm`, `figToWorld`, `bowPt`: they exist in 3 slightly different signatures;
  unify into ONE). Also the cast files of film 3 `cast/*.js` to see how `draw()` uses the rig.
- The c-plus validators later need anchor points (shoulder, chin, hand): expose them from the rig
  (`anchors(character, view, pose)`), see `docs/concepts/styles7/20-cplus-engine/js/validate.js` and
  `CHARACTER_CONTRACT.md` for the names, but do NOT port the validators here (task 14.13).

## Do
1. `packages/kit/src/worlds/c-cam/draw/rig.ts` (split into `rig-views.ts`, `rig-ik.ts`,
   `rig-layers.ts`, `rig-limbs.ts` if > 400 lines):
   - `View = 'front' | 'three-quarter' | 'profile' | 'back'` and flip handling (mirrored views are a
     flip, not a redraw), the body ring/projection helpers;
   - `solveIK(a, b, len1, len2, bendSign)` two-bone IK in body space; limbs drawn as tubes (brushes);
   - the face guard (do not let the open jaw/head overlap the shoulder line the way the original
     guards), draw layers (back arm, torso, head, front arm, held object) with explicit z order;
   - `solvePose(character, pose, view)` returning joint positions; `drawFigure(g, env, character,
     pose, view, expr, t)`.
2. `packages/kit/src/worlds/c-cam/draw/contact.ts`: ONE signature for each: `palmWorld(figure, hand)`,
   `reachPalm(figure, hand, target)`, `figToWorld(figure, p)`, `bowPt(...)` — document units and
   what each returns; remove the film-specific variants.
3. `Character` type + zod schema (`D` body dimensions, `views`: functions for torso/head per view,
   `hsz`, tones) so task 14.8 can load project modules against it; one TEST character in
   `packages/kit/src/worlds/c-cam/draw/test-character.ts` (simple, hand-built, original; not a
   copy of the films' people).
4. Tests: IK reach/limits (never NaN, clamps when out of reach), view flip symmetry, face guard
   cases from the original, layers order, contact accuracy: for 20 targets within reach the palm lands
   within 2 px; determinism (same call twice = same `RecordingPaint` recording); no forbidden
   identifiers (Date, Math.random, performance, document, window, rAF, timers, fillText, filter).
   If headless Chromium is available: ONE render test of the test character in 4 views x 3 poses
   (contact sheet) with a golden.
5. Header comments: divergences from the original and the final public API list.

## Acceptance
`pnpm typecheck`, `pnpm lint`, kit tests green; files <= 400 lines; PR lists the public API and the
measured contact error.

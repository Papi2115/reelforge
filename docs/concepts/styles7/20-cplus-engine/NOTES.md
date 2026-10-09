# c-plus engine (consolidated, fixed) - how to use it

**Run the test suite (no npm):** `node tools/validate.mjs` (all characters; ~20 s; writes `proof/validate.log`, exit
code 1 on any failure) or `node tools/validate.mjs captain,senator` for a subset.
Proof images: `node tools/proof.mjs` (before/after vs the original films, deck handshake, board, sheets, line-up).
Humans: open `test.html` (turnarounds of every character + the validators behind a button) and `demo.html` (3-shot
demo cut). Film contact sheet: `node tools/film-sheet.mjs out.png [framesDir|-] [times|-] [page.html]`.
Headless capture: `node tools/shoot.mjs <page> <out.png> "<js expression returning a data URL>"`.
Tools use the repo's playwright-core + installed Chrome (paths at the top of each tool).

## Engine files (js/, classic scripts, load in this order)
core (hash, keys, twos, blink, palette) - brushes (ink line, blob + key light, tube, hatching, silhouette mode) -
light (setLight, rim, hard shadows, vignette frame|oval, ground shadow, beams, gloom, foreground silhouettes,
litFigure) - camera (camera + Dutch tilt, keyframed track, cuts inside a shot, figure space, affine maths) - rig
(views, turns, IK, continuous face guard, solve) - limbs (arm/leg/foot/hand drawing) - poses - acting (expressions,
visemes, twitch, darts) - face (jaw rule, mouth hole, eye socket, skin marks) - facekit (optional shared eye/brow/mouth)
- grime - character (the contract) - contact (ST.meet, handAtWorld) - bg (background people) - then cast files,
then your film: sets, shots, film table, `timeline.js`, `player.js`. Tests add validate-raster, validate, test-page.

## Start a new film
1. Copy this folder (or point script tags at it). Keep `js/` untouched; put film files next to it.
2. Characters: copy `cast-examples/skeleton.js` per person, follow `CHARACTER_CONTRACT.md`, write the brief first.
   Add them to `test.html`, run `node tools/validate.mjs` until ALL GREEN, look at the sheets.
3. Shots: `ST.defineShot(id, { title, role, note, render(ctx, t) })`. In every render: `ST.setLight(...)` first
   (one hard key + rim), `ST.shotCam(ctx, t, { x, y, z, tilt })` or `ST.camera(...)`, the set, the people, then
   `ST.vignette(ctx, k, 'frame'|'oval')`. Cuts inside a shot: `ST.cut(ctx, t, [[t0, draw], ...])`. Lit as one
   figure (film 16 look): `ST.actor(ctx, id, p)`.
4. Contact: never place two hands by eye - `ST.meet` / `ST.handAtWorld` / `ST.touch` (see the demo shots).
5. Film table: `ST.FILM = [{ id, dur, lines: [[from, to, text]] }]`, then load `timeline.js` + `player.js`
   (`demo.html` is the template: canvas#frame, #shots, #play, #scrub, #time, #loop, #captions, #note).
6. Determinism: frame = f(t). No Math.random / Date / timers in scenes (use ST.hash, ST.rnd, ST.noise1); the player
   is the only place with a wall clock. Hooks: `window.__showcase.frame(t)`, `?t=12.5&paused=1&captions=0`.

## Porting a character from an old c-plus film (what changed in the API)
- `ST.solve(V, D, P)` -> `ST.defineCharacter` + `ch.draw(ctx, p)`; torso via `ST.torso` / `A.fit`; heads get
  `(ctx, f, o)` with `o.J`; `NECK` -> `neck: [[x, y] x 4]`; `D.head` is gone (measured); add `face` points.
- Lighting: `shade` = fixed crescent, `lit: [colour, depth, rim]` = follows the key (films 12/13 `shade` -> `lit`).
- Unified signatures: `ST.sweat(ctx, x, y, w, h, seed)`, `ST.tornHem(ctx, x0, y0, x1, y1, seed, n)`,
  `ST.setLight(side, rim, shadow)` or `ST.setLight({ x, y, rim, shadow, deep })`, visemes A E I O F M.
- Film 12's mammoth jawbone `ST.jaw` must be renamed (ST.jaw is the jaw rule now).

## Known limits (honest)
- The guard has one discontinuity left by design: a hand target dragged straight THROUGH the face from the far side
  (that motion is itself a tangle and is reported by the validators). Big-headed short-armed people cannot reach
  every face point (counts per character are in the log, `face anchors out of arm's reach`).
- The Senator (ball body, short arms) cannot shake hands at belly distance; ST.meet reports it instead of faking it.

# C-CAM film 4 - "Would You Survive as a Miami Gangster in the 80s?" (a day in the life, satire)

Film: `showcase.html` (62.2 s, 13 shots, 40 in-shot framings, 24 fps, 1920x1080, captions on/off with `C`).
Dev: `test.html` (turnarounds of the four hand-built people). Proof: `proof/sheet.png` (12 / 50 / 93 % of every shot),
`proof/cuts.png` (the middle of every in-shot framing), `proof/turnarounds.png`, `proof/frames/` (12 key frames at
full size). Facts, cast and shot table: `storyboard.md`; narration: `script.txt`.

## What is shared and what is new
- Engine files are byte-identical copies of `../03-apollo-11/js/` (`core, brushes, face, grime, rig, poses, camera,
  timeline, player, test-page`). Film 3's camera dialect (`ST.cutCam` with `{ at, x, y, z, rot }` and `ST.key` frames).
- New topic code: `props.js` (cash bricks, oven mitts, newspaper with eye holes, sub sandwich, cigar, calculator,
  popsicle, sweat/spit, `reachTo`, figure<->world), `miami.js` (Deco facade, neon tube, palm tree, the sports car,
  sedan, speedboat, rowboat, sea, planks, blinds, ceiling fan, CRT TV, flamingo, fluorescent tube, clock, chest
  freezer, swordfish, cell bars), `sets/sets-a..c.js` (strip at night, hotel room, porch/street, bus, back office,
  street through the blinds, marina, open sea, courtroom, cell), `shots/shots-a..c.js`, `film.js`.
- Every shot def lists its in-shot cut times in `cuts`, so `tools/proof.mjs <out> - cuts` renders one frame per
  framing (like film 2's proof tool).
- `ST.palm` is the rig's palm-centre helper: the palm *tree* brush is `ST.palmTree` (a name clash broke the hands).

## Rules used
- One accent per shot: neon pink on the strip/TV, the gold chain in the office, red E on the fuel gauge.
- Dutch tilt only on tense beats (headlight, the yelling, the fogged glasses, the snapped slat, the wire, the gauge,
  the witness); the poster and the wide establishing framings are level.
- Foreground silhouettes: the blind slats at the lens with your fingertip denting one slat (shot 9 POV); cell bars
  in front of you (shot 13).
- Contacts are solved in world space before drawing: the freezer lid edge under your hand, the hands on the desk
  and bricks, the hand on the wire, the finger in the blind gap (`ST.reachTo`).
- Acting on twos everywhere: strut bob, key turns, fan flaps, pounding fist, shiver, sweat drips, boat bob, waves.
- Satire, never glamour: no drugs, weapons, violence or how-to on screen; the money is plain banded paper.

## Running tools on another machine
`tools/pw.mjs` defaults to Papi's Windows paths (same as films 1-3); override with env vars, e.g. on Linux:
`PW_CORE=/opt/node-tools/node_modules/playwright-core CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/proof.mjs proof/sheet.png`.
Paths with spaces work (`pathToFileURL`).

## Verified (2026-10-11, headless Chromium (playwright build 1194) via playwright-core 1.56.1, Linux)
No console or page errors on `showcase.html` and `test.html`; `window.__duration` = 62.2; 7 frames re-rendered on a
CPU-backed canvas after rendering another time in between: bit-identical. Fonts in this container were Liberation /
DejaVu substitutes for Arial Black / Impact, so letter widths on Windows will differ slightly.

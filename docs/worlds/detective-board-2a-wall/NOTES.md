# detective-board 2a "Wall in a dark room" - showcase notes (D. B. Cooper, 1971)
Open `showcase.html` (double-click; classic scripts, no network/build). 640x360 indexed framebuffer, 30 fps, 64 s, 8 shots.
Every frame = `render(frame / 30)` on ONE global timeline; seeded hash only; caches memoise pure sprite builders. Files: `core` (raster, palette, ramps) · `fonts` · `paper`/`art` (props) · `room` (wall texture, map, window, desk top) ·
`world` (items, strings, shots, captions) · `desk` · `camera` (path, lamp, bulb) · `scene` (poses, strings, pins) · `light` · `render` · `player`.

## Palette (24, `core.js`)
Room `#09080c` black · `#15131b` night · `#241e27` shadow (cork in deep shadow) · `#3a3140` dusk (paper in deep shadow).
Cork `#4b2e22` deep/seams · `#6d4229` dark/grain · `#93603a` base · `#b98551` lit · `#e2b56f` brass (hot cork, pins, bulb, manila, sticky).
Paper `#8d8070` deep · `#c2b293` shade/sand · `#e8dcbd` paper · `#fbf5e2` highlight/label letters.
Accent `#d22f22` RED (strings, the stamp only) · `#74191a` string underside. Ink `#222f47` ballpoint, photo darks.
Photo colour `#3b6168`/`#7ba49c` teal water/sky · `#4e6a3d`/`#8ea766` banknotes. Cool `#2a3a60` navy (night, label tape,
blind stripes on cork) · `#6c87b6` blue (stripes on paper, glass). Neutral `#5a5560` graphite · `#a39e98` steel.
Light = per-colour DARK/LIGHT ramps; 3+ steps collapse texture (all cork -> shadow, all paper+ink -> dusk: silhouettes, no
readable text, no grain in the dark). Bands are flat; a 50 % checker only in the middle fifth of each band edge.

## Persistent world + string network
- One wall, 1600x900 world px (+ ceiling, side wall with blinded window, floor) and a desk top in front (u = wall x, v = depth).
  The wall is a pencil map of the Pacific Northwest (coast, Puget Sound, Columbia River, PACIFIC OCEAN): Seattle cluster top,
  demand mid-route, jump zone, Portland/ticket bottom, river find bottom-left, the composite dossier right.
- 23 wall items + 3 desk items, each with a fixed pose and (optional) landing time; nothing is removed. The D. B. Cooper card
  is torn off by the taut string (its tape + paper scrap stay); the snapped string keeps dangling from the composite.
- 19 strings in screen space each frame: anchors projected from item pins (wall or desk), parabolic catenary sag, laid by a
  carried pin (long slack), hook = twang (damped sag), one taut + snap. Pins appear when their string first uses them.
- Camera = one function of t: 10 holds + 9 moves; each move rides a string (camera lags the string head, zoom dips to show
  the run, sag follows the string). Desk = 2.5D: tilt unfolds when the camera looks down; perspective grows when zoomed out
  so mug and lamp frame the reveal. Lamp pool trails the camera 0.12 s; the bulb is a damped pendulum (knocked in shot 6).
- Last shot: the 19th string runs from the stamped file up to the composite as the camera pulls back to the whole wall.

## Human traces per shot (all seeded)
1 bulb stutters on, lens glint as it sways past, hatching + construction strokes + hand smudge, curled corner, tape, crooked label slap, pin pressed with a tail.
2 lamp click stutter, string overshoot/twang, sticky slapped crooked + "alias?" written with irregular cadence, name circled in one unclosed loop.
3 tally of 4 canopies (last one hurried), "bomb?" + double underline, two-stroke tick, dog-ear/curl, three strings with different sag.
4 pencil hesitates where the jump happened (pressed dot), magnifier overshoots and settles, coffee ring with gap, thumbprint, label-maker tab.
5 dashed oval with uneven dashes, "?" scribbled twice off-register, cards slapped at varied beats (0.55/0.9 s), fan of different sags.
6 knocked bulb swings shadows, card leans into the taut string, strike-through + "cleared", pin pops, card hangs on tape then drops.
7 marker "1980" on a sticky, slow string, tape, curled print corner, the boy's bills half in the sand.
8 stamp hover shadow -> thud + shake, starved ink, coffee ring, 1 s of silence, the last string pulls the camera back.

## Review (QUALITY.md 7: focal, hierarchy, asymmetry, specificity, traces, motion, palette, text, signature, ship)
Round 1: S1 17 · S2 17 · S3 17 · S4 16 · S5 17 · S6 19 · S7 17 · S8 19. Fixed: text readable in the dark (ink now collapses),
cash/refuel photos turned into black blobs in shadow, typed "NOV" mangled by double rotation, s1/s13/s19 crossing the face
(pins moved to the sheet edges), centred compositions (per-shot lamp targets + reframes), lamp head floating in wall shots,
stamp "2016" starved, shot 6 too wide (now z=2), S7 cut-off cards (z=2), tiny "?" (fat two-pass pen stroke). Round 2: hook
opens at z=4 on the lenses; label lit; plane photo contrast; name circle; briefcase into the pool; S3b z=2.
| shot | f | h | a | s | t | m | p | x | w | ship | total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 hook | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 18 |
| 2 ticket | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 18 |
| 3 demand | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 19 |
| 4 desk | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 18 |
| 5 jump | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 19 |
| 6 wrong man | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 19 |
| 7 1980 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 18 |
| 8 payoff | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 20 |
Verified: 192 frames rendered twice (reverse order) bit-identical; 24 indices used; red <= 1.1 %; 5-40 ms/frame. Weak: travel frames are mostly dark; 1x hand text small in thumbnails; cork busy at z=2; crude lamp; desk text resampled.

## Facts on screen (certain) and [verify] (kept OFF screen)
On screen: Nov 24 1971; Northwest Orient flight 305; Portland-Seattle; "Dan Cooper"; Boeing 727; bomb claim (as "bomb?");
$200,000; 4 parachutes; Seattle refuel; passengers released; toward Mexico City; aft stairs; NORJAK (FBI case name);
D. B. Cooper = a man questioned and cleared, name kept by the press; 1980; about $5,800; Columbia River; suspended 2016.
[verify] not shown: ticket price, seat, $20 denominations (drawn as generic green notes), Reno stop, boy's name and month
(Feb), Tena Bar, the questioned man's city, weather that night, drop-zone location (zone is a pencil "?" only), the stair's
exact hinge geometry (illustrative), 36 passengers.

## Port notes (engine/kit)
- World = persistent scene graph with appear/land times; strings as a kit primitive (anchors, sag, lay, twang, taut, snap,
  dangle); camera "ride string" move; lamp target per hold. All screen-space strings must stay readable (darken max 1 step).
- Lighting post-fx: continuous light value -> flat bands + edge-only checker; DEEP collapse table per style; COOL stripes.
- Desk as a second plane with tilt/perspective tied to camera height; billboards for standing objects.
- Trace helpers to expose: land(slap+wobble), handWrite(cadence), tick2, strike, circle, dashedOval, scribbleTwice, tape, curl, stamp.

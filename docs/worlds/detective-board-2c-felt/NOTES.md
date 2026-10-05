# detective-board 2c "the endless board (felt)" - D. B. Cooper, 1971
Open `showcase.html` (double-click, no network/build/modules). 960x540 indexed framebuffer, 30 fps, 8 shots / 65 s, ONE global
timeline: every frame is `F.render(T)` of global time T. Files: `palette` `raster` (camera, linen, shapes) `pieces` (felt/paper)
`strokes` (thread, knot, needle, text) `fonts` `kit` (stitch helpers) `layout` (shots + item places) `art-a/b` `threads` `world`
(the thread plan) `film` (camera path, scene, magnifier) `player`. Randomness = integer hash / seeded PRNG; memo caches are pure.

## Palette - 24 colours (all 24 used; checked over all 1950 frames)
INK `#1c1a20` type ink, sunglasses · NIGHT `#2c2a33` dark-suit felt, hats · NIGHT_L `#46434f` dark fibres, faded strikes ·
LIN0-3 `#4a453e` `#625c52` `#78715f` `#8f8774` the linen (gaps/seams, shade + dye lot B, base 60 %, crowns/quilting) ·
CREAM_S `#c4b592` / CREAM `#e5d8b6` / WHITE `#f6efda` paper, cream thread (tacks, theories, heading), sheen · MUST_S `#a4722b` /
MUST `#d6a03f` map felt, brass, cross-stitched years · RUST_S `#793824` / RUST `#ad5532` briefcase, route + label stitches ·
TEAL_S `#245759` / TEAL `#3b867f` / TEAL_L `#74ae9f` sea, river, chutes, ripples · SAGE_S `#536943` / SAGE `#809b60` bank notes ·
RED_S `#8a1b23` / RED `#d42b2f` / RED_L `#ef6b58` THE thread + the two sums only · STEEL_S `#6b7380` / STEEL `#c0c6ce` needle, jet.
Shading only by palette ramps (DARK/LIGHT per index): two-step drop shadows, felt cut-edge thickness. No dither, no grain.

## How the persistent canvas works
- **One canvas**: world units (1 unit = 1 typewriter pixel), tapestry ~2400x1350; every item has a fixed place (`layout.js`) and
  stays forever. Items appear by being pressed on (hover, slap, settle); nothing is erased.
- **Zoom 0.44x to 8x, always crisp**: no bitmaps are scaled. Each frame re-draws at the current zoom with LOD. Linen: macro =
  plied grains with twist lines; mid = basket weave that thins out as you zoom out; far = calm ground. The board is an endless
  quilt (two dye lots, seams with a quilting stitch) that gives scale and travel cues. Felt: fuzzy cut edges and per-cell fibres
  (> 7 px). Type: ragged ink at macro, greeked bar below 1 px. Cross-stitch: X stitches > 5 px, then squares, then fill. Camera
  ox/oy is pixel-snapped; text holds sit on integer zooms (1/2/3).
- **The thread**: ONE red main thread is laid by ONE needle: ticket name, man, briefcase, cash, chute, Seattle, jump knot,
  suspect (unpicked), river notes, 2016 tag, needle parked. It is couched: laid behind the needle with slack, tacked by small
  cream stitches (popping in with overshoot), knotted at both ends (French knots). Where it passes behind a felt piece it
  re-emerges as a new segment. Theory threads fan out from the jump knot in CREAM, so the final zoom-out reads as one red line.
- **Transitions = the thread**: camera "follow" moves track the laid end of a segment (blend in, ride, blend out to a framed
  hold, slight pull-back mid-move). Tug = segment pulled straight, linen puckers (warped weave + fold shading), card shifts; unpick
  = needle pulls back, tacks pop, holes + a pressed line stay; loosen = tacks pop, the thread goes slack. The magnifier
  re-renders the scene at 1.75x inside its rim.

## Human traces per shot (all seeded)
1 hook: light-struck letter in COOPER, rust stitches with uneven gaps, paper fibres, slack loop with anticipation, overshoot + twang.
2 A: crooked ticket with a torn stub edge, a crooked printed rule, irregular tack spacing, push-pause needle cadence, glint stitches.
3 A: crooked woven label, sum stitched X by X (cadence varies, X jitter), chutes land 0.22/0.39/0.16 s apart, each turned differently.
4 B: lens rests on the stub, anticipation nudge, then overshoot-settle; pinked map edge; sewing pin through REFUELLED; hand-cut coast.
5 B: stair rungs are stitches; jumper pressed on; beat of silence before the fan; seven fans with different starts, speeds, curves.
6 C: pucker, unpicked holes + pressed line, card swings on its last stitch, slack theory threads, one tape on one card only.
7 turn: slowest thread (3 s), notes half under a sand lip, irregular ripple stitches, 3.2 s held stillness.
8 payoff: blanket-stitched tag lands, last knot, needle parked with a slack tail, every earlier scar visible in the pull-back.

## Review - QUALITY.md §7 (focal · hier · asym · spec · traces · motion · palette · text · signature · ship)
Round 0 (first renders): brick/plaid linen, grainy mid zoom, wrench-like jet, fans across labels, ~100 ms frames.
Round 1: S1 18 · S2 17 · S3 16 (label cut by frame) · S4 15 (handle over stub, label cropped) · S5 16 (LIVE scrap off frame, red
fans read as a hairball) · S6 15 (generic person icons in a row, fern-like pucker) · S7 15 ($5,800 cut) · S8 17 (final tangle).
Fixes: theories in cream, mugshot cards with stitched height lines + crooked hanging card, magnifier on the stub, reframed holds,
subtle pucker, visible holes, bigger scraps (2x type), no far tacks.
Round 2 (final frames in shots/): S1 2,2,2,2,2,2,2,2,2,1 = 19 · S2 2,1,2,2,2,2,2,2,2,1 = 18 · S3 2,2,2,2,2,2,2,1,2,1 = 18 ·
S4 2,2,1,2,2,2,2,2,2,1 = 18 · S5 1,1,2,2,2,2,2,2,2,1 = 17 · S6 2,2,2,1,2,2,2,2,2,1 = 18 · S7 2,2,1,2,2,2,2,2,2,1 = 18 ·
S8 2,2,2,2,2,2,2,2,2,1 = 19.
Still weak: S5 fan beat is busy (it resolves in the hold); the man is a dark "egg" (anonymous on purpose); suspects are generic
busts; the far quilt seams can read as UI boxes; the cross-stitched comma is small.

## Facts on screen / [verify]
On screen: Northwest Orient, Flight 305, Portland-Seattle, Nov 24 1971, ticket name Dan Cooper, "a bomb, he said", $200,000,
four parachutes, Seattle, refuelled, Mexico City, rear stairs of the 727, 1980, $5,800, Columbia River, FBI, suspended, 2016.
Kept off screen [verify]: ticket price / cash payment · seat number · black clip-on tie (a dark tie is drawn, not labelled) ·
weather · Reno stop · landing area (the map's jump knot and SE leg are ILLUSTRATIVE) · boy's name and exact place · exact sum
($5,800 vs $5,880) · passenger count · month of the 2016 suspension · origin of the "D. B." name.

## Verified
Determinism: 10 sample frames re-rendered after other frames gave identical hashes; split refactor gave byte-identical PNGs.
Speed (headless Chromium, PC under load): all 1950 frames < 60 ms (p50 30, worst 54). Player: URL params, 1-8, A, space, arrows.

## Port notes (packages/engine + kit)
- World camera with log-zoom moves + "follow segment" moves; LOD materials (linen weave levels, felt fibres, type greeking, cross
  stitch) as shader/post passes; thread = ribbon mesh with ply-twist UVs, couching tacks and knots as instanced decals.
- Thread plan as data (`world.js`): segments with t0/t1, tack spacing, tug/unpick/loosen events; helpers `lay`, `tack`, `knot`,
  `tug`, `unpick`, `loosen`, `park` (countable for the §8 trace guard). Magnifier = second camera into a stencil circle.

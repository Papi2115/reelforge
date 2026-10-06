# sketchbook v2 - showcase notes (Why we have February 29 - the calendar bug, 10 shots)
Open `showcase.html` (no build/network/libs, classic scripts). One 83.0 s timeline, 10 shots (6.7-9 s each), 9 page-native
transitions living in the tail of the outgoing shot. 960x540 index buffer, 30 fps, `frame = f(t)`. `docs/worlds/sketchbook/`
(v1) is untouched; v2 = v1 code copied + extended. Stills in `shots/` (26 PNG, 1.9 MB): `s<shot>-t<shot-local s>.png`,
`g-t<global s>.png` = mid-transition frames (4>5 curl, 7>8 sticky peel, 8>9 riffle).
Player: buttons 1-10, keys 1-9 + 0 (=10), space, arrows, A = play all, `?shot=&t=&paused=1`; `?t=` snaps to 0.1 s steps.

## Palette (24, unchanged from v1 - documented in `../sketchbook/NOTES.md`)
Paper/fibre/shade, printed rule/margin/grid, two graphite greys, INK black, BIC blue + light blue, **red `#d8342b` = the correction,
only on the point**, highlighter, sticky yellow x2, four pencils (green, orange = every sun, sky, purple), coffee/skin, kraft x2,
desk. No halftone, no dither (flat SOFT/HARD remaps for paper shading). v2 adds no colour.

## The two NEW scene types
**Shot 5 - POP-UP PAGE** (`js/popup.js` + `js/popup-kit.js`, 8.0 s). A kraft card taped into the page; a pencil hand lifts
its cover and a cut-paper model rises from the fold: a MARCH 21 calendar block and a paper sun on a hinged arm. Small 2.5D camera
(inverse-homography face fill, so fibres stay on the paper), fold angle eased with anticipation dip, overshoot past upright and
settle; flat soft/hard shadows, creases, glue tabs. Then the red pen pulls a tab and the sun slides off its pencilled notch:
red loop round the empty notch + arrow = "the date stayed, the season moved". Only 2.5D shot in the film. Still beats 1.84-3.98 s
(before the pull) and 7.05-7.38 s. Text: MARCH, 21, "spring equinox" (tag), "same date, same season", page 5.
**Shot 8 - ACCORDION TIMELINE** (`js/accordion.js` + `js/accordion-strip.js`, 8.5 s). A taped paper strip under a fixed view;
the strip is dragged right-to-left by a visible left hand in three drags (two fast back-to-back, a pause, one with overshoot)
while the right hand writes events in order; the already-read panels fold into a zigzag pleat stack at the left (older pleats
tighter, cast shadow); paper clip marks "now" after 1752. Text: 45 BC "Caesar: +1 day / every 4 years" · 325 "equinox: 21 March"
· 1500s "equinox slipped ~10 days" · 1582 + red "-10 days" · 1752 "Britain: -11 days" · "now". Year spacing hand-placed
(~1 px/yr early, squeezed 325-1500, stretched 1582-1752). Still beat 4.63-5.1 s (pen hovers over the empty 1582 spot).

## Human traces per new shot (QUALITY §2; >= 3 each)
5: pencil compass arc of the sun's path left on the backdrop · pencil ring round the sun's notch · guide line with ticks, block
glued 3 px off it · glue smear past a tab · two torn tape strips at different angles · crooked hand-lettered tag on a thread ·
timing (anticipation, overshoot, press-in before the pull, uneven holds).
8: uneven panel widths, wandering creases · tape strips at different angles · pencil axis ruled panel by panel (does not align
across creases) + hand-ruled century ticks · coffee ring half under the strip · sun doodle by "21 March" · graphite thumbprint
after the last drag · three different drag lengths/speeds.
Shots 1-4, 6, 7, 9, 10 = the v1 shots (traces listed in `../sketchbook/NOTES.md`).

## Scorecard (QUALITY §7: focal, hierarchy, asymmetry, specificity, traces, motion, palette, text, signature, ship; fail < 14)
Shot 5: 2,2,2,2,2,2,2,2,2,1 = **19** (hold frame 7.2; "ship" 1: construction a bit clean/diagrammatic). Three self-critique
rounds (box top read as blank card, arc/arrow off the card, backdrop flash in overshoot, MARCH below min size, empty card floor).
Shot 8: 2,2,1,2,2,2,2,2,2,1 = **18** (asymmetry 1: strip is a full-width band; "ship" 1). Three self-critique rounds (~45 frames
inspected; fixes kept in the code, per-round findings not recorded).
Shots 1-4, 6, 7, 9, 10: v1's final scores stand (18-19), NOT re-scored in v2; their frames are pixel-identical to v1 at the same
shot-local time (regression: 1966 frames identical, 0 different; 53 tail frames differ only because the next shot changed).
Squint / 5-second / thumbnail (64 px) / swap run by the coders on the new shots: all pass (red loop + sun; 1582 + red).

## Verification (what was actually run)
Headless Chromium (preinstalled /opt/pw-browsers) via playwright-core installed only in a scratch dir (nothing in the repo).
All 2490 frames re-rendered in reverse and seeded-shuffle order: 0 mismatches, 24 palette entries, 0 off-palette pixels
(415 canvas frames sampled for RGB). Player smoke test: all cuts, play-all, play-shot + loop (wrap itself not exercised), keys, URL
params, no console errors. ~8-10 ms/frame. Repo pnpm test/lint/typecheck deliberately NOT run (outside this showcase folder).
**Not verified:** real-time playback smoothness in a headed browser, audio (none), any browser other than Chromium, the pen
possibly peeking at the bottom-right in the first riffle frames of 8>9, mobile viewport, visual re-review of shots 1-4/6/7/9/10.

## Facts on screen / [verify] (kept off screen)
On screen: 365.2422-day year; Julian calendar 45 BC +1 day every 4th year; equinox ~21 March (325), ~11 March by 1582
(interpolated +-1 in the flipbook); 1582: 4 Oct then 15 Oct; Britain 1752: 2 Sep then 14 Sep (3-13 struck, 11 days); rule /4,
/100, /400 (1900 no, 2000 yes). Captions (dev only, `js/timeline.js`) shot 5: "A calendar makes a promise: same date, same
season." / "Caesar's calendar slowly drifted away from the seasons."; shot 8: "45 BC. Then more than sixteen centuries of
drift." / "1582: the fix. 1752: Britain finally follows."
[verify] Caesar's leap day = doubled 24 February (never written as 29) · early leap years misapplied every 3rd year until
Augustus · which countries switched in 1582 · colonies in 1752 (narration says Britain only) · exact Julian equinox date per
century · "equinox ~21 March in 325" as shown on the strip · the tag wording "spring equinox" for 21 March.

## Port notes
- Shot 5 needs a real perspective/fold pipeline (here: one homography per face); in a Three.js kit it is a paper-strip rig with
  hinge parameters and a soft contact shadow. Shot 8 = strip texture + pleat stack, camera translation + clip-space fold.
- Both scenes are hand-coded per topic (props, text, positions); the runtime Claude would need a "pop-up" and a "strip" DSL with
  validated hinges/dates and the usual validator (one pen at a time, red only on the point, >= 0.4 s still, text provenance).
- Page numbering: 5 = pop-up, flipbook and strip carry none, so v1's circled 6/7/8 and Caesar's "-> p.7" still hold.
- Known: `?t=` snaps (can't single-step via URL; use arrows); sticky "1582" slap of shot 7 lands over the strip's opening.

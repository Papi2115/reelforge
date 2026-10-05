# detective-board 2b "neon noir 3D" - D. B. Cooper (1971)
Open `showcase.html` (double-click; classic scripts, no network/build). 960x540 indexed framebuffer, integer-scaled, 30 fps,
`frame = NB.render(t)` on ONE 65 s timeline (8 shots are windows into it). Stills: `shots/s<shot>-g<global t>.png` (27, 1.2 MB).
Checks (headless Chromium): 650 frames rendered twice bit-identical, out-of-order scrubbing identical, 20/20 colours,
195 sampled frames avg 23.5 ms / worst 40.6 ms, red accent 0-2.7 % of pixels. No Date/Math.random/rAF outside `player.js`.

## Palette - 20 inks (base indigo night 60 %, warm lamp + cyan neon 30 %, hot red 10 %)
`#07060e` INK outlines, type, ceiling · `#11143a` NIGHT walls · `#1f2763` INDIGO board (the base) · `#34428c` DUSK paper shade ·
`#5b67a8` SLATE paper in shadow · `#a5b1dd` MIST paper in night light · `#2a2c44` GRAPH wood, iron, graphite, blinds ·
`#0b4656` TEAL_D neon spill / sign glow ramp · `#1b8e98` TEAL neon on floor, desk, frame rim · `#7af6ea` CYAN tube core ·
`#3e1e48` PLUM lamp pool on dark surfaces + beam haze · `#8a3f2e` RUST · `#c06e45` TAN photo tones in lamp light ·
`#e88f2e` AMBER lamp rims, brass pins · `#f7d08f` PEACH paper in the lamp (the ONE warm colour) · `#fff4d8` HOTW hot core,
bulbs, lens caustic · `#e4ecff` ICE glints · `#5c0927` RED_DK string glow · `#ff2e4a` RED string, string pins, marker marks
(circle, strike, arrow, X, $5,800, stamp) - nothing else · `#ff9da6` RED_HOT string highlight, payoff spark.
No halftone, no paper grain, no cork texture. Dither only in hand-placed ramps: 1-2 px pool edge, lamp beam, sign glow, string glow.

## How it works
- **Room** (`world.js`): real metres. Board 2.6x1.5 m on a stand 1.45 m off the back wall (frame rails, ledge, posts), desk
  0.8 m in front, pendant lamp, desk lamp, window with mullions + half-lowered blinds, alley wall with the vertical HOTEL sign.
- **Renderer** (`core.js`): software camera (yaw/pitch/dist/f/roll), near-clipped polygons, scanline fill into palette indices,
  strokes re-stamped in screen space (crisp at any scale). Light per pixel by ray-plane intersection, cached per plane:
  classes shadow/night/lamp/hot/neon -> 5-entry material ramps. Neon reaches a surface only through the window aperture
  (mullions, slats) and is blocked by board + desk. Cast shadows = lamp-projected copies drawn as a "darken" LUT. Occlusion
  masks (board front, desk top) skip hidden pixels.
- **Persistent case** (`story.js`): items and strings are an event log with times. Cards land (shadow converges), pins squash,
  every string is a catenary (sag along gravity's perpendicular) between two real pins; laying = a carried red pin on a lifted
  arc or a 3D swoop to/from the desk, then twang (per-string frequency/decay). s11 is pulled taut, pops, dangles as a pendulum
  and is later relaid to the 1980 print - the same string. Nothing is ever removed.
- **Camera** (`camera.js`): one track of hold / move / follow segments; follow = lagged tip + offset easing between framings
  (+ "breathe" pull-back on long strings), so Play all has no cuts. Payoff: loop closes at the sketch, a spark runs through
  all 14 connections in story order while the camera orbits back to the opening room. Fonts (`fonts.js`, new, CC0):
  Remington Mono (slab typewriter), Tube Condensed (neon display), Marker hand (Tube skeleton + seeded slant/wobble/cadence).

## Shots - focal + human traces (all seeded / timed, never random)
1 Hook 0-7: neon window -> room reveal as the lamp stutters on -> push to the faceless sketch. Tape, old pin holes, WHO? written
  with pauses + separate underline, broken T in the sign, sketch pinned crooked.
2 A 7-15: string carried sketch->ticket->plane. "D.B." struck in two strokes, "DAN" + caret, torn ticket edge, perforation.
3 A 15-23.5: $200,000 circled (open loop, overshoot, 2 strokes), crooked tape label slapped on, lay times 1.5/0.8/1.3 s.
4 B 23.5-31.5: string swoops off the board to the desk map. Unclosed doubled coffee ring, pencil "?", dashed uncertain stretch,
  stub torn to match the ticket, magnifier slides in (overshoot) and re-draws the map 1.8x, pencil nudges, slow push-in.
5 B 31.5-39.5: rise to the jump print (light spills down the stair), two-stroke red arrow, three notes slapped on at
  0.42/0.46 s gaps, fan strings of 0.55/0.7/0.42 s, 3 s still hold.
6 C 39.5-46.5: Dutch tilt, string pulled taut (tremble), lamp knocked: its first sweep finds the theory as the pin pops,
  card swings on its other pin and hangs curled, red X in two strokes, lamp/neon stutters.
7 Turn 46.5-54.5: shade twisted while swinging and settles low-left: the 1980 print lands in the light; dangling string relaid.
8 Payoff 54.5-65: worn stamp (squash, broken box line), last string closes the loop at the sketch, orbit out, 1.3 s hold.

## Review - QUALITY.md §7 (focal, hierarchy, asymmetry, specificity, traces, motion, palette, text, signature, ship)
**Round 1** (first full render): S1 17 · S2 18 · S3 18 · S4 18 · S5 18 · S6 19 · S7 19 · S8 19. Found: warm pool too big, brown
and cream (v1 look) -> narrow cone, PLUM pool, paper is the only warm light; centred window opener; rear-view 727 read as a
face -> tail side view with the stair; long grazing shadows + three rings cluttering the desk; desk hot spot blown out; desk
strings slashing across the 1980 print -> moved it; strings crossing printed text -> anchors moved to card edges; lamp swing
never reached the dying theory -> timed sweep + resettle; card landing shadow a detached black box -> lower lift.
**Round 2**: S1 18 · S2 19 · S3 19 · S4 19 · S5 18 · S6 19 · S7 19 · S8 19. Fixes: follow lag 0.12->0.05 s + breathe (transition
frames were empty), memo anchor off the text, octagonal sign glow, twang variety, payoff spark, stair lit as S5 focal.
**Final**: S1 18 (2,2,2,1,2,2,2,2,2,1) · S2 19 · S3 19 · S4 19 · S5 19 · S6 19 · S7 19 · S8 19.
Weak spots: the empty room is sparse in the wides; desk strings cross the lower board in S5-S8 (true 3D, but busy); the sketch is
illustrative, not a composite; tiny labels (PASSENGER, map names) only read at 1x close-ups; theory notes have no source.

## [verify] (kept off screen unless noted)
- "For years, not one ransom bill turned up" (narration S6): high confidence, verify wording before use.
- Ticket, plane, Seattle, river prints are stylised illustrations, not replicas; map coastline/river hand-plotted from lat/lon.
- Not used anywhere: the boy's name, the exact 1980 place/month, Reno, altitude/flaps, seat, jump time, weather, suspects.

## Port to packages/engine
- Three.js scene from the same event log; z-buffer replaces masks/painter order. Toon material = light-class ramps + palette LUT
  post-pass; dither only in narrow smoothstep bands (pool edge, beam, glow). Strings: catenary polyline, screen-space width.
- Kit helpers to expose (QUALITY §8 can count calls): `pinCard`, `layString(a,b,t0,t1)`, `twang`, `pullTaut`, `popAndDangle`,
  `relay`, `peel(hinge)`, `handLoop`, `strikeAndFix`, `stamp`, `noteWrite(cadence)`, `pulseNetwork`.
- Camera move type `follow(string, lag, breathe)` ending on a hold; runtime Claude authors events + framings, never frames.

# comic-panels v2 — showcase notes (Apollo 11, the 1202 alarm, 10 shots)
Open `showcase.html` (file://, no build/network, classic scripts). 640×360 indexed framebuffer, 30 fps, ONE timeline of
77.5 s: `frame = f(global frame)`. Player: shot buttons 1–10, play all (A), play shot + loop, scrubber with shot markers,
1–9/0, space, ←/→ = one frame, `?shot=N&t=sec&paused=1` (t is inside shot N). v1 (`../comic-panels/`) is untouched.

## Palette — 22 inks (≤ 24): v1's 16 + a duotone sepia set
v1: `#1b1714` INK · `#252a3f` NIGHT · `#f1e5c9` PAPER · `#dccba5` SHADE · `#b49d76` AGED · `#3e86a0` CYAN · `#24546a` CYAN_D ·
`#c35a70` MAG · `#e2b13b` YEL (foil, highlighter) · `#efd690` YEL_P captions · `#d8381f` RED **only alarm codes** ·
`#aaa497`/`#7a7569`/`#4c4840` MOON L/M/D · `#93c86b` DSKY · `#8b8d94` PENCIL.
Sepia (shot 3 only): `#e3cc98` SEP_PAPER · `#cfb27f` SEP_FIBRE · `#a9875c` SEP_TAN (tint screen) · `#7a5a3c` SEP_MID ·
`#3f2a1c` SEP_INK (brown key) · `#a8432b` SEP_RED **only the 1961 stamp**. Measured: 22 indices used over the film, 22 colours in shots/.

## Film (shot · dur · incoming panel-native transition)
1 hook 7 · — | 2 descent 8 · page slide | 3 FLASHBACK 8.5 · page turned BACK | 4 cutaway 8.5 · ink-bleed out of the 1961 sketch |
5 houston 7.5 · gutter split (page cut and pulled apart) | 6 squeeze 7 · panel push | 7 alarm explained 8 · gutter collapse |
8 pause 6 · vertical page slide | 9 SPREAD 9 · page turn + merge | 10 epilogue 8 · inset panel grows from Eagle's window.
Transitions (`transitions.js`) composite A = previous shot's last frame (a printed page holds still while it moves) and
B = the new shot running; they live in B's first 0.5–1.0 s. Story order: question (2) → flashback cuts in → why (4) → answer (5).

## The two new scene types
**Flashback strip (shot 3).** A different print job, not a filter: the page is drawn with the normal inks, then pushed through
`SEPIA` (page.js), a LUT to a brown key + one tan tint on yellowed stock; `setScreen(1.5, +0.52)` makes every halftone coarser and
rotated ~30°; one tint plate, 1 px off. Three narrow letterboxed panels (1961 hall / the deadline as hand-ruled years ending at the
Moon / an engineer's pencil sketch of the guidance computer), captions "EIGHT YEARS EARLIER..." and "MEANWHILE...", a worn
rubber "1961" stamp slammed half on the margin. Static foxing + aged edge, no grain, the camera never moves (the past is still).
Enters by turning a page backwards; leaves by ink-bleeding colour out of the sketch into shot 4's real box (match cut).
**Double-page spread (shot 9).** The page turns onto four panels that are secretly one picture, each a few px out of register.
Gutters close on their own beats (horizontal first), borders thin 2→1→0, margins slide off, each panel slides into register,
the image scales 0.955→1.03 so it bleeds off every edge. Then 6.5 s of held silence (line boil only, one foil glint); at 5.6 s a
tiny pencilled "SEA OF TRANQUILITY" + arrow appears by the spine crease. Title = block letters standing in the regolith, lit
by the same low sun as Eagle, same long shadows, regolith drifted against the bases (`art-spread.js`).

## Human traces per shot (all seeded by shot + element)
1 pencil rough before the slam · blue-line pencils · leaning gutters · plates off-register · smudge · "WHAT IS 1202?" in margin.
2 plates print Y-C-M-K · crew poses differ · thumbprint · thought balloon instead of an answer.
3 hand-ruled years (uneven) · two-stroke circle round 1969 + arrow · sketch gone over twice · hand enters with the pencil ·
  coffee ring · worn rotated stamp · thumbprint.  4 torn cutaway · kinked leader · stamp · "DROPPED" + pencil arrow · boil.
5 pencil circle + "BALES" in the room · two-stroke underline under GO · uneven console spacing · blink · smudge · thumbprint.
6 gutters close at three speeds · two BEEP bursts · a 5th panel elbows in · freeze before the collapse · smudge.
7 pencil ticks (each different) · ABORT struck out, GO written + highlighter · dog-ear · tilted clipboard · bracket "SAME FAMILY".
8 shadow creeps in held 0.45 s steps.  9 out-of-register panels · leaning title letters · margin note · spine crease.
10 grains on clean parabolas that stop dead · loosening glove · pencilled time + underline + note + arrow · thumbprint.

## Review — QUALITY.md §7 (focal · hierarchy · asymmetry · specificity · traces · motion · palette · text · signature · ship)
**Round 1** (first full set): S1 18 · S2 15 · S3 14 · S4 17 · S5 14 · S6 17 · S7 15 · S8 18 · S9 13 · S10 14. Found: thought cloud
too tight; audience heads cropped into "arches", faint sketch, blob hand; MOCR crew invisible + perfectly even consoles (slop 5);
CAPCOM balloon hid its plate; "GUIDANCE KEEPS RUNNING" off the sheet, "ALARM1202", text across rules; spread title behind Eagle,
gutter through the title, closing gutters as black bars; window "shadow" read as a road, invisible dust, half-empty glove panel.
**Fixes**: cloud geometry; heads raised + rim light; pencil + ink double pass; uneven console widths, white-shirt backs; balloon
moved/2×; STILL STEERING, baseline on rules; per-panel register offsets, gutter-sized borders, title re-spaced; dust streaks.
**Round 2**: idle drafting hand (decoration) → enters with the first stroke; spread: floating gutter sliver, "QUI" crowding, "B"
buried by drift (read "RASE"), title inside the 6 % margin; squint: 1961 stamp lost to panel A → bolder, half on the margin;
shot 1 refresh (margin question); ink-bleed 107 ms/frame → cached field (all shots now avg 5–29 ms/frame headless).
**Final**: S1 18 (2,2,2,2,2,2,2,1,2,1) · S2 17 (1,1,2,2,2,2,2,2,2,1) · S3 18 (2,1,2,2,2,2,2,2,2,1) · S4 17 (2,1,2,1,2,2,2,2,2,1) ·
S5 18 (2,1,2,2,2,2,2,2,2,1) · S6 18 (2,2,1,2,2,2,2,2,2,1) · S7 18 (2,2,2,2,2,2,1,2,2,1) · S8 18 (2,2,2,1,2,2,2,2,2,1) ·
S9 19 (2,2,2,2,2,2,2,2,2,1) · S10 18 (2,2,1,2,2,2,2,2,2,1). Squint/64 px: 1202, 1961 stamp, GO, Eagle, title, line all survive.
Weak spots left: front-view LM still reads a bit like a face (v1); Bales' profile is crude; MOCR is schematic; shot 7 has two
accents (red codes + yellow GO); the 6.5 s spread hold may want trimming once there is a voice track.

## Facts on screen (certain) and [verify] (kept off screen or condensed)
On screen: 20 Jul 1969 · Eagle · program alarm 1202 and 1201 · "Give us a reading on the 1202 program alarm" · Steve Bales,
guidance officer · CAPCOM · "We're go on that alarm" · restart, low-priority jobs dropped · boulders, manual control, "60 seconds" ·
1961 goal: the Moon before the decade was out (caption paraphrase) · Sea of Tranquility · "Houston, Tranquility Base here. The
Eagle has landed." · 20:17 UTC · no air, so the dust does not drift. Executive overflow = the alarm family name.
- [verify] exact loop wording: Bales' call condensed to "GO."; who said "We're go on that alarm" (CAPCOM Charlie Duke relaying).
- [verify] Bales sat in the front row ("trench") — position of the pencil circle in shot 5.
- [verify] 1202 = "no core sets", 1201 = "no VAC areas" (screen says only "no room left for new jobs").
- [verify] 1961 speaker = President Kennedy to Congress, 25 May 1961 (drawn anonymous, no quote, no name).
- [verify] guidance computer work started at MIT Instrumentation Lab in 1961 (screen: "MEANWHILE..." + sketch only).
- [verify] count/order of all program alarms in the descent; cause of the overload (radar interface) — not shown.
- [verify] sun direction/shadow side at the site, MOCR tier count, DSKY V05 N09 / P63 (from v1) — drawn schematically.

## Porting to the engine
- **Timeline + transitions**: a two-input compositor pass (held A + live B) with the 7 transitions as post shaders; the bleed
  field is static per origin (texture). Cache the outgoing shot's last frame; transitions belong to the incoming shot.
- **Flashback = print job**: per-shot palette LUT + halftone screen params (cell × 1.5, angle + 0.52) in the pixel post-fx; one
  tint plate offset; style token `printJob: 'sepia-duotone'`; rubber stamp / pencil circle / tick / strike / highlighter /
  coffee ring helpers (`marks.js`) join the traces API so the §8 guard can count them.
- **Spread**: page-layout keyframes driving margin/gutter widths → 0 and per-panel register offsets → 0 over one full-bleed
  render; title as extruded 3D text standing in the scene, lit/shadowed by the scene light (kit helper `titleBlocks`).

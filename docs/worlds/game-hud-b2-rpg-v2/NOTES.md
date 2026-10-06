# game-hud B2 v2 "First-person RPG" — notes (1983: the crash and the E.T. cartridges, 10 shots)
Open `showcase.html` (no build/network, classic scripts). 82 s, ONE timeline incl. transitions. 1–9 and 0 play shot 1–10, A play
all, space, ←/→ one frame, loop, scrubber with shot marks, `?shot=4&t=2.5&paused=1` / `?t=<global s>&paused=1`. 30 fps,
`frame = f(t)`. Stills: `shots/s<shot>-t<global s>.png` (31, 0.65 MB). `docs/worlds/game-hud-b2-rpg/` (v1) is untouched.

## Verified (headless Chromium, in-page, 2460 frames)
Forwards vs. 400 random-order vs. 400 backwards vs. 50 after player draws: 0 mismatches (2280 distinct frames). 32 palette indices,
0 off-palette. avg 5.0 ms/frame, worst 10.7 ms (automap avg 1.0, tally avg 0.4; first scene frame is pre-rendered on load). No page
errors. v1 shots are bit-identical to v1 at the mapped time except 6 frames at T 48.00–48.17 (an old clerk line no longer leaks past
the tally). NOT run: repo tests/lint/typecheck (told not to).

## Palette (32, unchanged from v1 — the new scenes add no colours)
Darks `#08070a #16131b`. Tungsten `#2c1e18 #4e3325 #7d5336 #b07b49 #e2a85f #ffde9c` (woodgrain HUD, BULB). Fluorescent
`#10201a #1f3b2d #3a634b #6d9d6a #b5dd8f #ecfbd2`. Night `#0d1428 #1a2546 #2f4471 #57729f #95afd1`. Sand/paper `#39292c #6a5049
#a5846a #d8b98f #f5e7c6`. Greys `#2b292a #504c4b #87817b #c4bdb0`. `#b4603c` CLAY, `#3d2b47` PLUM. Accent `#ff4d7a`/`#9b2546` = E.T.'s
fate only (cartridge band, ~5 WEEKS, UNSOLD bar) — v2 adds the UNSOLD stamp (1.7 % of pixels max) and the automap's pickup pixel.

## How the film is built
v1 keeps its own time T (0–66 s). `js/film.js` maps global G → either a v1 shot (T = G − offset) or an inserted scene with T held:
1 Hook 0–7.5 · 2 Deadline 7.5–16 · 3 Warehouse 16–24 · **4 AUTOMAP 24–32** · 5 Quest log 32–39 · 6 Clone aisle 39–47 · 7 Returns
47–56 · **8 TALLY 56–64** · 9 Landfill 64–72.5 · 10 The dig 72.5–82. Scenes are `RF.AUTOMAP / RF.TALLY = {dur, lines, render(screen,
u, unders)}`; `unders` = cached by-value v1 frames to wipe from/to, so a seam is a pure function of G too.

## New scene type 1 — AUTOMAP (shot 4, `js/automap.js` + `automap-data.js`)
Doom overhead map derived from the real level grid (every walkable/solid edge = a wall, doors = gaps + ticks, shelves/cubicles interior
lines; the desert is drawn from the pit outline, fence and truck tracks). The arrow replays the real walk, walls draw on in pencil
order, the camera drags right to dashed/grey rooms ahead (TOY STORE diamond, RETURNS, ALAMOGORDO), holds, then the map folds into the
HUD minimap (dithered hand-over, 8 frames). Focal: player arrow + objective diamond (left third). Traces: hand-ruled walls 1 px off
grid with overruns, ±30 % pen speed and stops, pencil ticks by the rooms, margin note "NEXT: THE STORES" on a −2° wobbly baseline
with a two-stroke arrow. Still moment u 6.25–6.98. Text = room names, years, narration, DONE/AHEAD.

## New scene type 2 — INTERMISSION TALLY (shot 8, `js/intermission.js` + `intermission-art.js`)
Doom end-of-level card re-used as the chapter recap: painted warehouse back door at dusk behind a woodgrain plate, "CHRISTMAS 1982 /
FINISHED", rows MADE / SOLD / TIME / PAR counting up at uneven cadence, a hand-drawn comma, pencil underline, 0.7 s still beat, then a
rotated, off-register UNSOLD stamp (thump, overshoot, shake with decay, 0.74 s hold). Melt in, Bayer dissolve through VOID out.
Focal: the stamp. Traces: uneven row timing, ±1 px baseline jitter, coffee ring, misregistered stamp + smudge, painting wear.

## Traces per shot (v1 shots as in the v1 notes)
1 bulb stutter, chalk tally, held look-down · 2 crossed days, coffee ring, crooked sticky, two-stroke arrow · 3 flicker, missing
cartons, hand sign, reach-overshoot · 5 two-stroke ticks, wobbly rule, dev-note egg · 6 SALE cards tilted, noise drop-dead hold · 7
struck options, shake with decay, taped slip · 9 lift before the toss, 8.5 fps dust, silence after "AND BURIES IT." · 10 fog
interlude, crouch-reach-rise, hand underline, HUD powers off.

## Scorecard (QUALITY §7, /20; fail < 14)
New scenes — coder self-scores after 3 rounds each + one Manager look at the PNGs: **S4 automap 18** (2,1,2,2,2,2,2,2,2,1: note is
nearly as loud as the arrow; fold lands ~15 px outside the 6 % margin only for the fence line) · **S8 tally 19** (ship 1: empty plate
lower-left, plain-rectangle stamp shadow). v1 shots carry their v1 final scores, NOT re-scored for v2: S1 18 · S2 19 · S3 18 ·
S5(quest log) 19 · S6(clones) 16 · S7(returns) 17 · S9(landfill) 19 · S10(dig) 19. Known: clone aisle busy by design; one-point aisle.

## Facts / [verify] (kept off screen unless marked EST.)
On screen as certain: 1982 Christmas, ~5 weeks, 1983 crash, Alamogordo NM landfill, 1985 NES, 2014 dig. **On screen with EST. but
UNVERIFIED — check before any real use:** 4,000,000 made · 1,500,000 sold · "PAR ~6 MONTHS" (typical 2600 dev time; the weakest, from
memory) · narration "millions made". Also [verify]: RETURNS labelled 1983 (returns arguably began late 1982); everything in v1's list
(single programmer, burial Sep 1983, concrete cap, 26 Apr 2014, ~97 % revenue drop, NES NY test Oct 1985). No logos, no faces.

## Port notes (honest)
- Automap: ~2–3 d in the kit given a level grid (edges→lines, pencil order, labels, fold into HUD) + ~1 d validator (label collisions,
  safe area, callout vs camera). Per film Claude writes a small table (labels, note, objective, timings). Breaks on non-grid levels.
- Tally: ~1 d as built; reusable card (rows, count schedules, stamp, melt/dissolve) 2–3 d; the painted still is ~0.5 d per topic
  unless a backdrop kit exists. Real cost stays per-film content: sourced numbers (EST. rows need research) and a backdrop.
- Everything from v1's port notes still applies (second renderer ~1 wk, level DSL + validator 4–6 wk). Insert-scene seams need the
  by-value `unders` cache; keep it a memo of a pure function.

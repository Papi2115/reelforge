# game-hud · B1 v2 "Boss-fight montage" — 10 shots, two new scene types (1983 crash, E.T. cartridges)
Open `showcase.html` (no build/network, classic scripts). 640×360 indexed, integer-scaled, 30 fps, 79.5 s, 10 shots, ONE timeline.
Player: buttons 1–10, keys 1–9 and 0, A = play all, space, ←/→ frame step, L loop, `?shot=&t=&paused=1`. Stills: `shots/` (33 PNGs).
Copied from `../game-hud-b1-boss/` (untouched) and extended; v1 grammar, fonts, room, bosses and HUD rules apply (see its NOTES.md).

## Checks run (headless Chromium via Playwright, scratch tool outside the repo)
Determinism: every frame of the film rendered twice, 2nd pass reversed → 0 mismatches. Palette: 23 canvas colours (≤ 24, no new ink
added; one slot free). Console errors: 0. Slowest frame ≈ 39 ms headless (shot 8's page is built once, ≈ 42 ms on its first frame).
No Math.random/Date/timers in scene code. Ported shots are pixel-identical to v1 outside the HUD progress bar and the planned seams.

## Palette — unchanged from v1 (23 inks)
Base: VOID `#0b090d` TUBE `#17131d` NIGHT `#2a2340` DUSK `#533a5e` WALNUT_D `#2c1a12` WALNUT `#50301e` TEAK `#84522c` OLIVE_D `#39401a`
TEAL_D `#163c43` GREY_D `#403d47`. Support: TAN `#bf8d57` CREAM `#efd9ae` WHITE `#fff3dc` RUST `#92381a` ORANGE `#d9651f` GOLD `#eba73a`
TEAL `#2a8783` AQUA `#82c9b5` AVOCADO `#77812d` MAUVE `#9c5c74` GREY `#8a8591` BLUE `#4a68bd`. Accent: CRIMSON `#e3304a` (the point only).
Shot 8's two-colour print = CREAM paper + WALNUT_D key ink + TEAL plate; pencil in GREY(_D); CRIMSON once (the correction).

## Order and seams (all game-native, each with a reason)
1 hook · 2 Xmas 1982 · 3 boss 1 deadline · **4 high scores** · 5 market menu · 6 boss 2 flood · 7 returns · **8 manual** · 9 landfill · 10 payoff.
3→4 boss dies → the 2600's attract-mode colour cycling (3 uneven steps) on the TV only; the glass note keeps its colour.
4→5 camera pulls back into the console; the cartridge going in answers "INSERT COIN"; the HUD year dissolves out (ordered dither) so the TV's
1982 reads alone, back in at the cartridge click. 7→8 the returns counter gives way to a page slide (peek, hold, slide, overshoot, settle,
cast shadow); HUD ink flips per pixel where the paper edge passes. 8→9 page turn from the bottom-right corner onto the level-select map
to ALAMOGORDO; HUD ink flips as the fold passes. Shot 5's first line is now "E.T. made Christmas." (the old "It" lost its referent).

## NEW scene type 1 — HIGH-SCORE TABLE (shot 4, 7.5 s, attract mode)
The console idles after the boss and prints the story's facts as a score table: ranked by order of events, score = year. Only #1 has
happened: **E.T 1982**; 2ND–4TH are locked "???" rows (1983 / 1985 / 2014), the same "?" lock as the level-select map. No invented figures.
Focal: the gold 1982 (biggest type, left third, the only gold). Left-aligned table, right half empty but for BOOM!. Beat of silence on the
empty #1 slot (1.7–2.66), slam with overshoot and decaying shake (2.78), initials scroll with irregular cadence, still 4.9–5.15, then
INSERT COIN blinks at a steady 0.6 s as a machine would, through the pull-back.
Traces: egg-shaped grease-pencil ring (overshoots its start, flick) · "BOOM!" in Dad's hand · thumbprint that appears with the ring · INSERT COIN
burned into the phosphor (ghost in blink-off) · uneven row print + 2600 flicker, 3RD row one unit off-grid.

## NEW scene type 2 — INSTRUCTION MANUAL (shot 8, 8.5 s)
Cheap two-colour manual spread, five numbered "HOW TO PLAY" steps = how a flood of clones kills a market: a hit sells · everyone copies it,
fast · shelves fill with look-alikes · buyers can't tell good from bad · so they stop buying bad games. FIG. 1 THE SHELF: halftone shelf, the
hit (callout 1, the only cart with colour) vs look-alikes (callout 2, same star art, never quite the same). Frame t=0 is the complete spread.
Focal: step 5 — red pen strikes BAD, writes ANY, circles it (buyers stop buying any games). Pencil ticks follow the narrator (2.30 / 2.95 /
4.10 / 5.05), silent beat 5.3–5.8, red at 5.97–7.25, held still until the turn at 7.7.
Traces: TEAL plate 3/2 px off-register · crooked feed (drawing 0.37°, type skewed per glyph) · ink-gain type with jumpy baseline · starved-ink band
in the halftone · crease with fold shadow and two staples · two coffee rings (one with a drip) · thumbprint + yellowing at the turning corner ·
uneven pencil ticks · the red correction.

## Scorecard (QUALITY §7: focal, hierarchy, asym, specific, traces, motion, palette, text, signature, ship)
Shot 4: R1 17 → R2 18 → final **19** (R1 fixes: vector-perfect ring, floating thumbprint, TAN diluting the gold; R2: five type sizes → three).
 Weakest: bottom-right quarter very empty (deliberate negative space).
Shot 8: R1 16 (t=7.4) / 15 (t=0) → R2 **19** (t=7.4) / **18** (t=0). R1 fixes: rotated type split glyphs ("SO" read "SQ"), figure too small, hit lost
 among copies, strike hid BAD, illegible tinted badges, Pac-Man coffee ring, hard-edged stain, comma read as period. Weakest: both pages fairly full.
Ported shots 1,2,3,5,6,7,9,10 are bit-identical to v1 and keep v1's scores (17–19, see v1 NOTES); not re-scored here.
Self-scores were made by the building agents and spot-checked by the Manager on shots 4 and 8 (stills + seam frames); they are not a designer's review.

## Facts (certain) · [verify]
On screen: 1983 crash after a flood of low-quality games; E.T. for the 2600 rushed for Christmas 1982, sold poorly, returned; unsold stock buried in
the Alamogordo landfill (1983); dug up in 2014 for a documentary; NES (1985) revival. Years shown: 1982, 1983, 1985, 2014. The manual's mechanism
is the commonly cited account of the crash, not a measured claim. No logos, no figures.
**[verify] (kept off screen):** exact E.T. release date; 1983 vs 1984 as the market bottom; any sales/loss/copies figures; cartridges buried
(~728,000); burial date and concrete cap; E.T. made vs sold; dig date; NES NY test month (Oct 1985); licence fee.

## Port notes (engine)
v1 layers (`tv` 160×180 wide pixels, `room` 2x camera, `glass`, HUD) plus: `scores` = TV-layer attract screen with glass pen marks (trace helpers:
typed, shake, hand, handStroke, ghostRect); `manual` = paper scene built once and copied per frame (kit: halftone, off-register plate, crease, stain
helpers, rough print font); seam kit: attract colour cycle, console pull-back, page slide/turn with per-pixel HUD ink (`hudDarkAt`), year dither
dissolve (`yearAside`). Mark timings are seeded and not editable from narration — the engine port should key them to word anchors.

# sketchbook - showcase notes (Why we have February 29 - the calendar bug)
Open `showcase.html` (no build/network, classic scripts). One 66.5 s timeline, 8 shots, 7 page-native transitions living in the
tail of the outgoing shot (Play all never resets; Play shot starts on a clean page). 960x540 index buffer, 30 fps, `frame = f(t)`:
all 1995 frames re-rendered backwards bit-identical, exactly 24 colours, 0 off-palette pixels. Avg 5-7 ms/frame; worst 40-75 ms
on a few crumple/eraser frames (machine load dependent). Stills: `shots/s<shot>-t<shot-local s>.png` (29, 2.2 MB).

## Palette (24) - one notebook, five pens, three pencils
Paper `#f4eedb` PAPER · `#e6ddc4` FIBRE (fibres, pen shadow) · `#cbbd9d` SHADE (edges, creases). Printed: `#a8c2d6` RULE lines ·
`#e6a4a1` MARGIN / index-card header / eraser · `#bfd6cc` GRID. Graphite `#a09b92` / `#5e5a55` (pencil, metal, spiral). Pens:
`#1d1b20` INK felt-tip+marker · `#2b48a1` BIC + `#7189c6` BIC_L hatching · **`#d8342b` RED = the correction, only on the point**
(.24, +1/4 day, about 1 day, +1 DAY, 11 min / 10 days, the cut days, Feb 29). Tools: `#e6ef5a` highlighter · `#f6d86c`/`#d9b74e`
sticky note, straw, mitre. Pencils: `#6b9a47` green · `#e48a35` orange (every sun) · `#88b6d6` sky (Earth) · `#8a5c9c` purple
(Caesar's sash). `#a8744c`/`#dcbf98` coffee + skin · `#d2b386`/`#b19064` kraft envelope · `#46332a` desk. No halftone, no dither.

## Grammar
- **One object**: every page is the same spiral notebook (coils + punched holes left, page number circled top-right in that page's
  pen); other media are *taped / clipped / slapped into it*. Torn stubs of the flipbook page stay in the spiral on p.6.
- **A = the story** (p.2 farmer+Sun, p.4 Caesar, p.7 Gregory): blank cartridge paper, felt-tip line drawn stroke by stroke by a
  visible hand, coloured-pencil hatch fills that go slightly out of the lines, stick people with props and faces that react
  (pose = f(t) redrawn on twelves). Boil 12 fps.
- **B = the proof** (p.3 graph paper, p.6 back of a kraft envelope): blue ballpoint print, ruled lines (a clear plastic ruler
  slides in), column subtraction, year-boxes hatched in ballpoint, a drift chart; tidy-with-flaws (overshot corners, ink skips,
  blobs). Boil 8 fps, half amplitude.
- **C = rhythm** - loud, physical, never the same: marker "365?" slammed + red correction (hook); thumb-riffled flipbook (p.5);
  highlighter sweep; sticky note slapped on + push-in; and the transitions: page flip over the spiral, 3-page riffle, eraser
  rub-out (smear + crumbs), corner curl into the flipbook, tear-out + crumple + toss, sticky peel, tear-out drop.
- **Fonts** (own single-stroke skeleton, CC0): PRINT (neat), SCRAWL (slanted lowercase), MARKER (condensed caps, chisel nib),
  TYPE (printed calendars, no boil). Seeded per-glyph jitter, baseline drift, rotation; writing pace varies by stroke and word.

## Shots - stock / tools · focal · human traces
1 Hook C+A 0-7 · lined, marker + red + pencil · "365" and red ".24" · ? struck, caret, wet-marker smudge, blots, "not quite.", 0.9 s held beat.
2 A 7-15.8 · cartridge, felt, green/yellow/orange/sky pencil, red · the gap: "+1/4 day" · farmer points at the Sun then scratches his head + "?", fills out of the lines, orbit wobble.
3 B 15.8-24.8 · graph, BIC, highlighter, ruler, red · "about 1 day" circled -> "leap day!" · highlight overshoot, ruler, uneven box sizes, ink skips; eraser exit.
4 A 24.8-33.4 · cartridge + pencil-ruled margin, felt, red, pencils · "+1 DAY" on the decree · smug Caesar pump (anticipation/overshoot), margin doubt + mitre "-> p.7", label arrow.
5 C 33.4-40.1 · flipbook corners · year flicks 325 -> 1582 while the sun slides 21 -> 11 March, pencil ring stays on 21 · every page redrawn, thumb, accelerating riffle, 1.2 s hold, tear + crumple.
6 B 40.1-48.7 · kraft envelope taped in, BIC, red · "about 10 days" at the top of the drift line · flap seams, coffee ring, tape, torn stubs, aligned decimals by hand; sticky "1582" slap.
7 A 48.7-57.7 · printed Oct 1582 sheet + Sep 1752 slapped on · red cuts: careful X 5-7, impatient zigzag 8-14, 4 -> 15 · Gregory's tongue, crozier, slap with lift shadow, tape, 1.4 s hold.
8 Payoff 57.7-66.5 · index card clipped on lined page, felt, red, orange pencil · red "Feb 29" + swash · paper clip, X / check, small smiling sun beside the card, 1.4 s quiet held frame.

## Review (QUALITY §7: focal, hierarchy, asym, specificity, traces, motion, palette, text, signature, ship)
**Round 1**: S1 14 · S2 13 · S3 12 · S4 12 · S5 14 · S6 13 · S7 13 · S8 15. Found: ink ran past the shot (S3 rule / S4 decree never
appeared, two pens at once), proof caret read as a stick figure and "." vanished, "1/4" illegible, tiny figures, mitten hand,
hoe through the farmer, MARCH colliding with the label, noisy kraft, calendar rules through headers, crozier across the face, clip on
"LEAP". **Fixes**: time-budget choreography (fitMarks) + per-shot pace, top caret, solid dot, stacked 1/4, bigger heads, slim hand,
calmer fibres, sheet edges, pen hidden on incoming pages.
**Round 2**: S2 16 (shading arm across the face) · S3 16 · S4 15 (scroll arm hidden, hand covering the pump) · S6 16 (sticky =
flat yellow screen) · S7 16 (pencil hand over the Pope during the slap). **Fixes**: point-then-scratch pose with the reaction
before the red, visible fist on the scroll, label moved under the decree, bounded sticky + motivated push-in, slap later, flat
(not dithered) flip shading, >= 0.4 s still per shot.
**Final**: S1 2,2,2,2,2,2,2,2,2,1=19 · S2 2,2,2,2,2,1,2,2,2,1=18 · S3 2,2,2,2,2,1,2,2,2,1=18 · S4 2,2,2,2,2,2,2,2,2,1=19 ·
S5 2,2,2,2,2,2,2,2,2,1=19 · S6 2,1,2,2,2,2,2,2,2,1=18 · S7 2,1,2,2,2,2,2,2,2,1=18 · S8 2,2,1,2,2,2,2,2,2,2=19.
Left: marker letterforms read a bit calligraphic; farmer/Caesar bodies are plain sticks; the hand sometimes covers the subject
while writing labels; crumple creases look swirly; S3 writes fast (pace 1.3); S6 has two red notes (11 min, 10 days).

## Facts on screen / [verify] (kept off screen)
365.2422-day year; 365.25 - 365.2422 = 0.0078 day ~ 11 min/year; 0.2422 x 4 = 0.9688; Julian calendar 45 BC, +1 day every 4th
year; equinox ~21 March in 325, ~11 March by 1582 (the reform restored 21 March; flipbook days in between interpolated, +-1);
1582: 4 October then 15 October; Britain 1752: 2 September then 14 September (3-13 struck); rule /4, /100, /400; 1900 no,
2000 yes. Calendar grids carry no weekday headers (illustrative). [verify] Caesar's leap day was a doubled 24 February, not 29
(never claimed on screen) · early leap years misapplied every 3rd year until Augustus · which countries switched in 1582 ·
British colonies in 1752 (narration says Britain only) · the exact Julian equinox dates per century.

## Port notes
- Kit "sketchbook look" = this 2D index renderer inside the scene iframe (pure in t, preview = export): page stocks, stroke font,
  mark list (stroke / fill / write / figure / arrow / loop / underline) with time budgets, a hand derived from the active mark,
  transition compositors (need 2 extra page buffers). ~1-1.5 wk to package; native Three.js port (ink layer on a page plane +
  fold/tear shaders) 2-3 wk.
- Runtime Claude needs a mark DSL with budgets + validator: one pen at a time, ink inside the safe area, red only on the point,
  a >= 0.4 s still, the hand must not park over the focal while labelling, text provenance on every `write`.
- Risks: legibility below ~13 px cap; per-topic props (mitre, crozier, laurel are hand-coded here); transition cost on slow PCs.

# Brief — sketchbook world v2 (10 shots, two new breakthrough scene types)

Goal: a NEW standalone showcase `docs/worlds/sketchbook-v2/` (plain HTML + JS + CSS, no network, no libs, no build, double-click to open)
extending the approved sketchbook world to **10 shots** with **one shot of each new breakthrough scene type**.
**Do NOT modify or overwrite `docs/worlds/sketchbook/`.** Copy what you need into the new folder and extend.
Read first: `docs/worlds/QUALITY.md` (binding), `docs/worlds/sketchbook/NOTES.md`, its code (`js/`) and `shots/*.png` (the craft bar: one spiral
notebook, A = felt-tip + pencil fills on cartridge paper at 12 fps boil, B = blue ballpoint on graph paper/envelope with a ruler at 8 fps, C =
loud physical page moments; red correcting pen as the only accent; the visible hand with pen/marker tip; page-native transitions).

## Topic (same as v1): "Why we have February 29 — the calendar bug"
Use ONLY facts you are certain of; keep uncertain ones off screen and list them as `[verify]` in NOTES.md: a solar year is about 365.24 days;
Julius Caesar's calendar (45 BC) added a leap day every 4 years (slightly too much, about 11 minutes per year); the calendar drifted ahead of
the seasons; by the 1500s the equinox had slipped about 10 days; Pope Gregory XIII's reform (1582): century years are not leap years unless
divisible by 400 (1900 no, 2000 yes); in October 1582 the calendar jumped from the 4th to the 15th in the countries that adopted it first;
Britain and its colonies switched in 1752 (dropping 11 days in September). Caesar's leap day was a doubled 24 February (do not write 29).

## The two NEW scene types (rare, punchy, keep the notebook's vibe)
1. **Pop-up page** — the notebook page is turned and a paper POP-UP rises from the fold: a folded, cut paper model (e.g. a tiny calendar tower
   or a sun-and-earth mechanism made of paper strips and hinges) unfolding in perspective with soft paper shadows, visible creases and tabs,
   a hand-written tag; a "wow" moment and a change of dimension. Exactly one (shot 5).
2. **Accordion timeline strip** — a long taped paper strip / accordion-fold that slides across the screen right-to-left as events are written
   onto it in chronological order (45 BC … 1582 … 1752 with real, certain dates), folds with creases, a paper clip marks "now", a hand pulls it
   along; the camera pans along the strip. Exactly one (shot 8).

## The 10 shots (6–9 s each, ≈ 75–85 s, ONE continuous timeline)
Keep the 8 existing beats (hook "365?" with the red ".24"; farmer and sun; maths on graph paper; Caesar; the 1,600-year flipbook of drift; drift
chart; Gregory 1582 + Britain 1752 calendar pages; final rule note) and weave in: **5 = POP-UP PAGE** (after the Caesar page, a visual
leap: the paper model of the drifting calendar) and **8 = ACCORDION TIMELINE** (before the Gregory/1752 pages: the long chronology). Page-native
transitions (page flip, tear-off, sticky-note slap, eraser smear, spiral flick) on one continuous timeline. Narration lines are yours (short,
punchy, English), shown as a dev caption.

## Player, quality, process, output
Same player as v1 extended to 10 shots (buttons 1–10; "Play all" = one continuous timeline incl. transitions; "Play shot" with loop toggle;
global scrubber with shot markers; keys 1–9 and 0, space, ←/→ frame step, A = play all; `?shot=&t=&paused=1`). 960×540 internal pixels, 30 fps
with the deliberate 8–12 fps line boil, ALL animation a pure function of global t (seeded PRNG; no Math.random/Date in render), plain classic
scripts (no ES modules), palette ≤ 24 colours (document), no halftone (the comic owns it). Obey QUALITY.md (focal point per shot, ≥ 3 human traces
per shot, no slop tells, real text only, held still moments). Render screenshots with headless Chromium via Playwright (install it in a
scratch dir if missing; if you truly cannot run a browser, say so loudly and do not claim visual verification), LOOK at the PNGs, self-critique
each shot with the §7 scorecard (≥ 16/20), at least TWO full critique-and-fix rounds, verify determinism and the palette limit. Output:
`showcase.html` (+ js/css), `NOTES.md` (≤ 80 lines: palette, the two new scene types, traces per shot, scorecard, [verify] list, port notes),
`shots/` (≤ 35 PNGs, ≤ 4 MB). Touch no other folder. Commit to branch `worlds/sketchbook-v2` and open a pull request into
`phase-12/v2.5-worlds` listing the files, self-scores and anything unverified.

# Brief — comic world v2 (10 shots, two new "breakthrough" scene types)

Goal: a NEW standalone showcase `docs/worlds/comic-panels-v2/` (plain HTML + JS + CSS, no network, no libs, no build, double-click
to open) that extends the approved comic world to **10 shots** and includes **one shot of each new breakthrough scene type**.
**Do NOT modify or overwrite `docs/worlds/comic-panels/`** (approved by Papi). Copy what you need from it into the new folder and extend.

Read first: `docs/worlds/QUALITY.md` (binding), `docs/worlds/comic-panels/NOTES.md`, the code in `docs/worlds/comic-panels/` and its
`shots/*.png` (the craft bar, tone and palette Papi loved: paper tone, halftone with misregistration, hand-lettered "Inkhand" face,
big imperfect onomatopoeia, uneven gutters, balloons with tails, a nearly empty pause panel before a twist).

## Topic (same as v1): Apollo 11 — the 1202 alarm during the landing
Use ONLY facts you are certain of; keep uncertain ones OFF screen and list them as `[verify]` in NOTES.md. Known and safe: 20 July 1969;
Lunar Module "Eagle"; Armstrong and Aldrin; the guidance computer showed program alarms 1202/1201 during descent; Houston's guidance
controller Steve Bales judged it safe ("we're go on that alarm"); the computer shed low-priority tasks; Armstrong took manual control to
avoid a boulder field and landed with little fuel; "Houston, Tranquility Base here. The Eagle has landed." 1961: the national goal of
landing a person on the Moon before the decade ended (paraphrase, no exact quote unless certain).

## The two NEW scene types (breakthroughs: rare, punchy, keep the comic's vibe)
1. **Flashback strip in sepia** — narrow letterboxed panels drawn with a DIFFERENT ink set (sepia/brown ink, different halftone dot size/angle,
   slightly yellowed paper), a rubber date stamp ("1961"), caption boxes ("Meanwhile…", "Eight years earlier…"), a faint film-grain-free
   vintage look; used for jumps in time/place. Exactly one in the film (shot 3).
2. **Double-page spread / splash** — all panel borders disappear; ONE enormous image bleeds off every edge with a held silence, a tiny
   hand-lettered margin note, and a title lettering that is part of the art (not a caption). The page "turns" into it (a panel-native
   transition: the gutters shrink away and the panels merge into one). Exactly one in the film (shot 9).

## The 10 shots (6–9 s each, ≈ 75–85 s total, ONE continuous timeline)
1 hook splash→strip (existing idea, refreshed) · 2 A descent in panels (existing) · **3 FLASHBACK sepia strip (NEW)** · 4 B cutaway info
page of the guidance computer shedding tasks (existing, may be reworked) · 5 A Houston/Mission control in panels (new content, careful
with facts) · 6 C tension: gutters shrink, panels crowd, "BEEP BEEP", speed lines (existing) · 7 B a "checklist/alarm explained" page in
the same comic grammar (new: e.g. what the alarm meant, with real concepts only) · 8 the pause panel before the twist (existing idea:
almost empty, one tiny detail) · **9 DOUBLE-PAGE SPREAD (NEW)**: the Eagle on the surface as one huge vista · 10 quiet epilogue payoff
(a hand on a switch, dust settling, a handwritten margin note). Every transition between shots is panel-native (panel slides, gutter
collapse, page turn, ink-bleed) and part of the continuous timeline. Narration lines are yours (short, punchy, English), shown as a dev caption.

## Player (same as v1, extended)
Shot buttons 1–10; "Play all" plays the whole film as ONE continuous timeline including transitions (no resets); "Play shot" for one
shot (loop toggle); scrubber over the global timeline with shot markers; keyboard: 1–9 and 0 (=10), space, ←/→ frame step, A = play all;
URL params `?shot=&t=&paused=1`. 30 fps, ALL animation a pure function of global time t (seeded PRNG; no Math.random/Date in render),
plain classic scripts (no ES modules: file:// blocks them), palette-limited (≤ 24 colours incl. the sepia set; document them).

## Process and output
- Output folder: `docs/worlds/comic-panels-v2/` with `showcase.html` (+ js/css), `NOTES.md` (≤ 80 lines: palette, how the two new scene
  types work, traces per shot, scorecard per shot with QUALITY.md §7, [verify] list, port notes), `shots/` (≤ 35 PNGs, ≤ 4 MB).
- Render screenshots with headless Chromium via Playwright (`npm i -D playwright` in a scratch dir and `npx playwright install chromium`
  if it is not available; if you truly cannot run a browser, say so loudly in the report and do not claim visual verification). LOOK at
  the PNGs, self-critique each shot with the §7 scorecard (≥ 16/20), at least TWO full critique-and-fix rounds, verify determinism
  (same t → identical image) and the palette limit.
- Do not touch any other folder. Commit your work to a branch named `worlds/comic-v2` and open a pull request into
  `phase-12/v2.5-worlds`. In the PR description list the files, the self-scores and what you could not verify.

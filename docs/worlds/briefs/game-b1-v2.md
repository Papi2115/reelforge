# Brief — game world B1 v2 "Boss-fight montage" (10 shots, two new breakthrough scene types)

Goal: a NEW standalone showcase `docs/worlds/game-hud-b1-boss-v2/` (plain HTML + JS + CSS, no network, no libs, no build, double-click to
open) extending the approved B1 world to **10 shots** with **one shot of each new breakthrough scene type**.
**Do NOT modify or overwrite `docs/worlds/game-hud-b1-boss/`.** Copy what you need into the new folder and extend.
Read first: `docs/worlds/QUALITY.md` (binding), `docs/worlds/game-hud-b1-boss/NOTES.md`, its code (`js/`) and `shots/*.png` (the craft bar:
Atari-2600 rules inside the TV — wide pixels, one colour per sprite row, flicker; living-room scene in square pixels; bosses as real
antagonists; level-select and cartridge transitions; Dad's "XMAS 82" cartridge as a human thread).

## Topic (same as v1): the 1983 video game crash and the E.T. cartridges
Use ONLY facts you are certain of; keep uncertain ones off screen and list them as `[verify]` in NOTES.md: the market collapse of 1983 after
a flood of low-quality games and clones; Atari's E.T. for the 2600 rushed (about five weeks) for Christmas 1982, sold poorly and was returned;
unsold cartridges and hardware buried in a landfill in Alamogordo, New Mexico (1983); excavated in 2014 for a documentary; the market's recovery
with Nintendo's NES (1985). No trademarked logos; generic cartridge labels.

## The two NEW scene types (rare, punchy, keep the world's vibe)
1. **High-score table (attract mode)** — an arcade-style attract screen: a ranked list with three-letter initials and scores where the "players"
   are real facts ranked (e.g. the biggest losses/most copies/sizes ONLY if you are certain of the numbers; otherwise rank by years or by order
   of events, never invent figures), blinking "INSERT COIN", demo-mode flicker, a hand-drawn note on the cabinet glass. Exactly one (shot 4).
2. **Instruction manual page** — a cheap two-colour 1980s game-manual spread: a bad-print halftone drawing, numbered "HOW TO PLAY" steps in a
   rough print font, a tiny misaligned colour plate, crease down the middle, a coffee ring; it explains ONE mechanism step by step (e.g. how
   the market flood worked, with real concepts only). Exactly one (shot 8).

## The 10 shots (6–9 s each, ≈ 75–85 s, ONE continuous timeline)
Keep the 8 existing beats (hook; the Christmas-1982 rush; boss 1 the deadline; market menu; boss 2 the flood; returns; Alamogordo landfill;
2014 dig + NES) and weave in the two new scenes: **4 = HIGH-SCORE TABLE** after the deadline boss (ranking of the story's facts) and **8 =
INSTRUCTION MANUAL** after the returns beat (how a flood of clones kills a market). Transitions stay game-native (level-select map,
scanline wipe, cartridge insert/pull, "continue?") and everything is on one continuous timeline. Narration lines are yours (short, punchy,
English), shown as a dev caption.

## Player, quality, process, output
Same player as v1 extended to 10 shots (buttons 1–10; "Play all" = one continuous timeline incl. transitions; "Play shot" with loop toggle;
global scrubber with shot markers; keys 1–9 and 0, space, ←/→ frame step, A = play all; `?shot=&t=&paused=1`). 30 fps, ALL animation a pure
function of global t (seeded PRNG; no Math.random/Date in render), plain classic scripts (no ES modules), palette ≤ 24 colours (document).
Obey QUALITY.md (focal point per shot, ≥ 3 human traces per shot, no slop tells, real text only, held still moments). Render screenshots with
headless Chromium via Playwright (install it in a scratch dir if missing; if you truly cannot run a browser, say so loudly and do not claim
visual verification), LOOK at the PNGs, self-critique each shot with the §7 scorecard (≥ 16/20), at least TWO full critique-and-fix rounds,
verify determinism and the palette limit. Output: `showcase.html` (+ js/css), `NOTES.md` (≤ 80 lines: palette, the two new scene types,
traces per shot, scorecard, [verify] list, port notes), `shots/` (≤ 35 PNGs, ≤ 4 MB). Touch no other folder. Commit to branch `worlds/b1-v2`
and open a pull request into `phase-12/v2.5-worlds` listing the files, self-scores and anything unverified.

# Brief — game world B2 v2 "First-person RPG" (10 shots, two new breakthrough scene types)

Goal: a NEW standalone showcase `docs/worlds/game-hud-b2-rpg-v2/` (plain HTML + JS + CSS, no network, no libs, no build, double-click to
open) extending the approved B2 world (Papi loves its Doom vibe) to **10 shots** with **one shot of each new breakthrough scene type**.
**Do NOT modify or overwrite `docs/worlds/game-hud-b2-rpg/`.** Copy what you need into the new folder and extend (reuse the raycaster).
Read first: `docs/worlds/QUALITY.md` (binding), `docs/worlds/game-hud-b2-rpg/NOTES.md`, its code (`js/`) and `shots/*.png` (the craft bar:
raycaster at 320×180 shown 2×, HUD at native 640×360, woodgrain plates, compass with a year counter, MARKET as the only health bar, the
single cartridge arc, the returns-desk conversation boss, the 1985 fog interlude).

## Topic (same as v1): the 1983 video game crash and the E.T. cartridges
Use ONLY facts you are certain of; keep uncertain ones off screen and list as `[verify]` in NOTES.md: the 1983 market collapse after a flood of
low-quality games and clones; Atari's E.T. for the 2600 rushed (about five weeks) for Christmas 1982, sold poorly and was returned; unsold
cartridges and hardware buried in a landfill in Alamogordo, New Mexico (1983); excavated in 2014 for a documentary; the market's recovery with
Nintendo's NES (1985). No trademarked logos; generic cartridge labels; no invented quotes; no real person's face.

## The two NEW scene types (rare, punchy, keep the world's vibe)
1. **Automap** — the classic wireframe overhead map (thin vector lines on a dark field, the player arrow, doors, discovered vs undiscovered
   rooms drawn differently, a hand-written note on the margin) that shows the STRUCTURE of the story: where we have been (office, warehouse,
   shop, returns, landfill) as rooms of one level and where the next chapter is; the camera moves like an overhead pan with a "map revealed"
   draw-on. Exactly one (shot 4), a break from the first-person 3D.
2. **Intermission tally screen** — the Doom-style end-of-level screen ("KILLS / ITEMS / SECRET" style tally) re-purposed as a recap of the
   chapter's facts (percentages and times that are NOT invented: use counts you are certain of, or label as "est." with a [verify] mark off
   screen), with the animated counting-up, a "par time" line, a painted background still, a stamped grade. Exactly one (shot 8).

## The 10 shots (6–9 s each, ≈ 75–85 s, ONE continuous timeline)
Keep the 8 existing beats (hook corridor; office deadline; warehouse; quest log; clone aisle; returns desk; landfill at night; 2014 dig +
NES) and weave in: **4 = AUTOMAP** (after the warehouse/inventory, a structure beat) and **8 = INTERMISSION TALLY** (after the returns boss, the
recap before the landfill). Transitions stay first-person-native (walk through doors, fog, fades, the map "folding" into the HUD) on one
continuous timeline. Narration lines are yours (short, punchy, English), shown as a dev caption.

## Player, quality, process, output
Same player as v1 extended to 10 shots (buttons 1–10; "Play all" = one continuous timeline incl. transitions; "Play shot" with loop toggle;
global scrubber with shot markers; keys 1–9 and 0, space, ←/→ frame step, A = play all; `?shot=&t=&paused=1`). 30 fps, ALL animation a pure
function of global t (seeded PRNG; no Math.random/Date in render), plain classic scripts (no ES modules), palette ≤ 32 colours (document),
each frame < 50 ms. Obey QUALITY.md (focal point per shot, ≥ 3 human traces per shot, no slop tells, real text only, held still moments).
Render screenshots with headless Chromium via Playwright (install it in a scratch dir if missing; if you truly cannot run a browser, say so
loudly and do not claim visual verification), LOOK at the PNGs, self-critique each shot with the §7 scorecard (≥ 16/20), at least TWO full
critique-and-fix rounds, verify determinism and the palette limit. Output: `showcase.html` (+ js/css), `NOTES.md` (≤ 80 lines: palette, the two
new scene types, traces per shot, scorecard, [verify] list, port notes incl. honest build cost), `shots/` (≤ 35 PNGs, ≤ 4 MB). Touch no other
folder. Commit to branch `worlds/b2-v2` and open a pull request into `phase-12/v2.5-worlds` listing the files, self-scores and anything unverified.

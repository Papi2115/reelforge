# game-hud — showcase notes (Y2K)
Open `showcase.html`. World 320x180 blitted 2x, HUD/UI 640x360. Frames are pure functions of (shot, t), hash-seeded; 1140 frames
checked: bit-identical re-render, 16 colours, worst 7.5 ms. Stills: `shots/s<shot>-t<t>.png` (22, native 1x).

## Palette — "worn cartridge / beige 1999 office", not synthwave
Base 60 % (phosphor greens on ink): `#0d110e` ink · `#18201a` night · `#253228` deep moss · `#3a4d3c` moss · `#5d7556` fern ·
`#9cc583` phosphor (HUD fill, flags) · `#d9f2bd` phosphor light (hero numbers).
Support 30 % (beige PC + paper): `#2a241e` brown · `#54483a` umber · `#8c7c63` putty · `#c7b897` beige/skin · `#efe6cf` paper.
Accent 10 %: `#e0522a` bug vermilion = the threat only (the 99/00, 1900, boss bar, "2 DIGITS").
Light: `#f0a345` amber = "the world is running" (lit windows, the fixed `9(4)` in shot 5 — the only accent there);
`#2d4566` midnight / `#7d9fb8` haze = time of day + the developer's oxford shirt. Each shot uses one accent, never both.

## Fonts
"Forge Mono" 5x7 copied from `packages/engine/src/text/font-mono.ts` (our CC0) + a `→` glyph. New "Cartridge Display"
7x12 in an 8x12 cell: chamfered arcade caps, 2-px stems, slashed zero (reads as a 1999 terminal), integer scales 1/2/3/4/8.

## HUD = meaning, not decoration
Progress bar = film progress (head icon rides it). Checkpoint flags on the bar = chapters 1999 / AUDIT / MIDNIGHT / 2000;
a flag climbs its pole when passed, the chapter label retypes. FACTS = count of facts the narration has stated; the counter
has two digits on purpose. "+1 <fact>" pops under it, types in, then backspaces away. Boss bar only in shot 4: the bug's
strength = unfixed code; it drains after the rollover holds. "LEVEL COMPLETE" appears once.

## Shots, focal point, traces
1 Hook — focal: `99`. "STAGE 1999" card; the `19` dims and is eaten by the Bayer pattern, leaving dashed empty slots.
  Traces: third digit 1 px low (worn print), uneven drop-in stagger, hand underline in two strokes, irregular typewriter,
  HUD boots late with two hitches in the bar, CRT power-on + tube falloff.
2 A-roll — focal: hero (then the `19` leaving). Level printed on green-bar tractor paper (perforations, faint COBOL);
  hero = bald COBOL programmer with printout; bumps a beige key, the `19` flies off; far tower shows `1999`; the `00` hops in.
  Traces: run frames held by distance with uneven strides (4/5/3/6 px), input-lag crouch before take-off and on landing,
  landing dust, one-frame glasses glint, uneven bug hops, a still hold (5.25–5.7 s), `* TODO: 4 DIGITS` printed on the floor.
3 B-roll — focal: `1900`. Game paused (world dims), item card YEAR FIELD: 4 slots, only 2 used, `99` rolls to `00`
  (tens digit lags + overshoots); checklist BANKS / AIRLINES / POWER. Traces: grease-pencil loop on the glass (unclosed,
  overlapping), two-stroke hand ticks, cursor overshoot/settle, POWER row 2 px off-grid and its tick hesitates longest.
4 C-roll — focal: the millennium clock. Low angle, hero small at left. 23:59:57..59, `99`→`00` (attack) = `1900`,
  shake with exponential decay, hero braces, held hush (edges dim, ~1.2 s), then `20` rolls in: `2000`, `1 JAN 2000`, bar drains.
  Traces: decaying shake, lagging/overshooting tens drum, off-grid 2nd window, brace squash, typed boss label, the hush.
5 Payoff — focal: the changed line `05 YR PIC 9(4).` (old `PIC 99.` struck through above it). Dawn window, developer asleep on
  his arms, mug steam at 8 fps, the checkpoint flag rises from the pencil cup; quiet type: LEVEL COMPLETE / EST. COST
  $300 BILLION / THE WORLD KEPT RUNNING; HUD fades out. Traces: crooked blank sticky note, struck line + correction,
  breathing (back rises, arms stay), baseline-wobble typing, steam on a held cadence.
Facts: 2-digit years saved memory; 99→00 read as 1900; midnight 1 Jan 2000; banks/airlines/power audited code; est. ~US$300 bn
fix cost; the world kept running. `PIC 99`/`PIC 9(4)` is real COBOL syntax; field name `YR` and code lines are illustrative.

## Self-review (QUALITY.md §7; order: focal, hierarchy, asym/neg space, specificity, traces, motion, palette, text, signature, ship)
Round 1 (first full render, world at 1x): S1 15 · S2 12 · S3 15 · S4 16 · S5 13. Problems: hero 15 px tall = unreadable;
sleeper a blob; S2 sky empty + paper print the brightest area; bug off-frame; S3 two accents (00 and 1900) and the loop cut
"READ AS"; S5 desk ended mid-frame; dithered popup fade looked like corruption; amber window grid in S4 too busy.
Fixes: world moved to its own 320x180 buffer blitted 2x (hero now 30x44 px); developer rebuilt from shaded ellipses at
closer-camera scale; blue oxford shirt for contrast and continuity; full-width desk; popups backspace instead of fading;
slots stay phosphor so 1900 is the only accent; loop re-centred; `→` glyph; window density cut; bug path re-timed.
Round 2: paper re-valued (umber/moss/brown: reads as paper, sits back; a global shade was tried and reverted, it killed
the print); far clock tower in S2 sky (foreshadows the boss); tube vignette on S1.
Final: S1 2,2,2,2,2,1,2,1,2,1 = 17 · S2 2,1,2,2,2,2,2,1,2,1 = 17 · S3 2,2,1,2,2,2,2,1,2,2 = 18 ·
S4 2,2,2,2,2,2,2,2,2,1 = 19 · S5 2,2,2,2,2,1,2,2,2,1 = 18. Weakest: S2 ground print still a bit loud; S1 title 7 px.

## For the real engine port
- Two-target rendering (world 2x / HUD 1x) as an engine look option; HUD as kit components fed by the timeline
  (chapters, facts, boss) so it cannot be decorative: facts come from narration anchors, chapters from storyboard beats.
- Trace helpers (`typed`, `handStroke`/`handLoop`, decaying `shake`, uneven run cycle, lagging odometer) for the §8 check;
  sprite sheets + seated/sleeping hero poses; palette tokens. Foley: cartridge click, key bump, odometer clatter.

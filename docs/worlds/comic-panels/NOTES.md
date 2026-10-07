# comic-panels — showcase notes (Apollo 11, the 1202 alarm)
Open `showcase.html` (no build/network). 640×360 indexed framebuffer, 30 fps, `frame = f(shot, t)` (25/25 re-renders bit-identical).

## Palette — 16 inks, a cheap four-colour job on yellowed newsprint
`#1b1714` INK key plate, line art, lettering · `#252a3f` NIGHT space, interiors · `#f1e5c9` PAPER page, balloons ·
`#dccba5` SHADE fibres, thumbprints, skin · `#b49d76` AGED foxing, comm cap · `#3e86a0` CYAN · `#24546a` CYAN_D ·
`#c35a70` MAG faded magenta (foil shadow, onomatopoeia shading) · `#e2b13b` YEL foil, PROG lamp, kept jobs · `#efd690` YEL_P
captions · `#d8381f` RED spot ink, **only the alarm code** · `#aaa497`/`#7a756a`/`#4c4840` MOON L/M/D regolith, suits ·
`#93c86b` DSKY electroluminescent green, displays only · `#8b8d94` PENCIL margin notes, blue-line pencils.
## Fonts
- **Inkhand** (new, CC0): caps, 7 px cap height, 1-px strokes + "smart bold" (thickens a stem only where a gap survives,
  so M/W/N stay open), alternates for A E O R S T picked per letter, baseline jitter ±1 px (digits ±0.5 — a wobbling 0
  read as "o"). Text scale = floor(camera zoom), so lettering stays pixel-crisp while balloons scale continuously.
- **Forge Display** (copied from `packages/engine/src/text/font-display.ts`, CC0) for onomatopoeia / the big 1202 / the
  stamp: rotated, low-frequency warp, 2-px outline, ink extrusion, colour fill misregistered against the key line.
  Changed: plain zero (the engine's slashed zero turns into an 8 once warped).

## Human traces per shot (all seeded)
1 hook: pencil layout rough before the slam · blue-line pencils overshooting every panel corner (never erased) · two
  leaning gutters of different width · colour plates 1–2 px off the key line · ink smudge in the gutter · thumbprint.
2 A-roll: plates print one by one (Y, C, M, K at uneven intervals) · per-panel misregistration · lettering baseline ·
  thumbprint in the margin · Aldrin's head turned to the DSKY, Armstrong's to the window (no copy-paste crew).
3 B-roll: torn cutaway edge · hand-lettered callout with a kinked leader · worn, rotated rubber stamp · two-stroke pencil
  arrow + "DROPPED" (slanted, typed in at an irregular cadence) · boiling chart line · smudge + thumbprint.
4 C-roll: gutters close at three speeds, panels tilt more as they crowd · two BEEP bursts, different size/beat · smudge
  where panels collide · pause panel: Eagle's shadow creeps in held 0.45 s steps.
5 payoff: Eagle stands on the panel border (feet in the margin) · inset with its own paper rim · pencil "20:17 UTC" +
  two-stroke arrow + underline · dust that stops dead at engine stop (vacuum) · thumbprint.

## Review — QUALITY.md §7 (focal · hierarchy · asymmetry · specificity · traces · motion · palette · text · signature · ship)
**Round 1** (first full set): S1 15 · S2 15 · S3 13 · S4 13 · S5 14. Found: big "1202" mangled (slashed zero + warp),
helmet read as a bowling ball, craters as smiles, cockpit crew identical, Bales crude at 2× zoom, cutaway hole read as an
explosion, stamp illegible, glove blobs, panel D overlapping A, S5 shadow/dust clipped, speed lines floating like rain,
pause shadow illegible.
**Fixes**: plain zero + less warp; clear bubble helmets with Snoopy caps; crater shading rebuilt (left inner wall dark);
crew poses differ; Bales redrawn as a lost profile with headset/glasses + chair foreground; torn-rectangle cutaway; stamp
×1.4; gloves rebuilt from capsules (one merged silhouette); slanted shared gutters; LM moved onto the border; dust haze
band; speed lines hug the subject and re-roll at 10 fps; LM shadow = flattened silhouette with pads.
**Round 2**: DSKY re-cropped; "IT'S A 1202." tail read as a crack → short tail; S3 stamp moved off the kept cards; S4
second BEEP moved off the glove + staggered intro; job label THROTTLE → NAVIGATION (more defensible).
**Final scores**: S1 18 (2,2,2,2,2,2,2,2,2,0) · S2 17 (1,1,2,2,2,2,2,2,2,1) · S3 17 (2,1,2,1,2,2,2,2,2,1) ·
S4 18 crowd / 18 pause · S5 19 (2,2,2,2,2,2,2,2,2,1). Squint: red 1202 / Eagle win every frame; thumbnail 64 px: S1 code
and S5 balloon shape still read. Weak spots left: front-view LM reads a bit like a face;
Bales' anatomy; glove-on-stick generic; S2 page hold splits focus (Eagle vs GO); S3 card count is schematic (unlabelled).
## Facts used (no invented numbers/labels)
20 Jul 1969; Eagle; Armstrong/Aldrin; "Program alarm", "It's a 1202", "Give us a reading on the 1202 program alarm";
DSKY PROG lamp, P63, V05 N09, register 01202; guidance officer Steve Bales, "we're go on that alarm"; Executive overload →
restart, low-priority jobs dropped; later 1201; boulder field, manual control; "60 seconds"; contact light / engine stop;
"Houston, Tranquility Base here. The Eagle has landed."; 20:17 UTC. Chart is labelled LOAD/FULL only (schematic).
## Porting to the engine (multi-panel layout)
- **Page as a layout layer**: shot = page (quads in 640×360 page space) + per-panel sub-scene + page camera track. Cuts
  become camera keyframes (hold/travel/hold); layout keyframes animate quads (split, squeeze, slide-in). ≤5 panels guard.
- **Rendering**: each panel = its own scene camera rendered with scissor + stencil (polygon mask) or to an RT composited
  in post; gutters, borders, blue-line pencils, smudges drawn in a 2D overlay pass in page space (shared with lettering).
- **Misregistration**: render key (ink) and colour into separate targets (material flag), offset colour by the panel's
  plate vector in the compositor; halftone/Bayer per ink in the existing pixel post-fx, tone from luminance.
- **Lettering**: page-space balloons/captions, tail target = 3D anchor projected through the panel camera, text scale
  floor(zoom); onomatopoeia kit helper. **Traces API** (`pencils/smudge/thumbprint/handArrow/marginNote/plateIntro/boil`)
  seeded by shot+element so the §8 guard can count ≥3 calls. Kit props needed: LM 3/4 view, DSKY with key legends, gloves.

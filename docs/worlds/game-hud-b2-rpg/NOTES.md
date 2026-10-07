# game-hud B2 "First-person RPG" — notes (1983: the crash and the E.T. cartridges)
Open `showcase.html` (no build/network). Play all = one 66 s timeline (doors, a fog interlude, no resets); 1–8 play shot, A play
all, space, ←/→ one frame, loop, scrubber with shot marks, `?shot=3&t=2.5&paused=1`. 30 fps, `frame = f(t)`. 1981 frames:
re-render (backwards) bit-identical, exactly 32 colours, 0 off-palette pixels, avg 6.2 ms / worst 16–18 ms. Stills:
`shots/s<shot>-t<global s>.png` (30, 1.2 MB).

## Palette (32): tungsten office · fluorescent green · desert-blue night · dawn
Darks `#08070a` VOID (hook fog, outlines) `#16131b` SHADOW (menu/dialogue). Tungsten `#2c1e18 #4e3325 #7d5336 #b07b49 #e2a85f
#ffde9c`: panelling, cartons, skin, woodgrain HUD; BULB = the single light + year digits. Fluorescent `#10201a #1f3b2d #3a634b
#6d9d6a #b5dd8f #ecfbd2`: carpet, warehouse air, store fog, tubes, MARKET, CRT. Night `#0d1428 #1a2546 #2f4471 #57729f #95afd1`:
1983 desert, sleeve, retail boxes, moon. Sand/paper `#39292c #6a5049 #a5846a #d8b98f #f5e7c6`: dirt, dawn, calendar, all dialogue
text. Greys `#2b292a #504c4b #87817b #c4bdb0`: plaster, steel, shell, pencil. `#b4603c` CLAY: beams, SALE ink, strike-throughs,
every *other* cartridge label. `#3d2b47` PLUM: crew, boxes. Accent `#ff4d7a` (+`#9b2546`) = E.T.'s fate only: our cartridge's
band, "~5 WEEKS", the empty quest box, the UNSOLD bar. Lighting LUTs never create accent pixels.

## Renderer
Own textured-column raycaster (`js/raycast.js`), 320×180 index buffer blitted 2× under a native 640×360 HUD. Per-pixel floor and
ceiling casting; back-to-front low / see-through walls with caps (cubicles, counter, fence, tape); Wolf-style sliding doors;
billboards with per-pixel depth; a real sunken pit (rays drop to the bottom or hit the far dirt wall). Doom-style lighting: per
region a `[colour][16 light][8 fog]` colormap built once by nearest colour, point lights with 1/(1+d²/r²)² falloff, emissive texels
mostly ignore fog, Bayer 4×4 on floors/walls/sprites, flat bands on ceilings and the hand. Sky per azimuth (stars, crescent,
mesas; dawn sun). Walk = keyframes + mixed easing; seeded uneven strides drive bob, sway and minimap footprints. New font
"Bezel 5×7" (proportional caps, dotted zero, CC0); seeded irregular typewriter (punctuation holds, stalls).

## HUD language (every piece carries story data)
Woodgrain plates + black ribbed insets (early-80s console veneer). Compass: heading, objective diamond, a year odometer rolling
1983 → 1982 (back in time) → 1983 → 1985 → 2014. Minimap: only rooms the story has reached, footprints. MARKET = the only health
bar (the industry is what is in danger): drains store → returns → landfill, refills on the NES line. Status RUSHED / FLOODED.
Toasts NEW QUEST / + ITEM / QUEST UPDATED type in, backspace out. Shot 4 = quest log + inventory. Boss = RETURNS DESK, a talk
you cannot win (options crossed out; the UNSOLD bar only fills).

## Shots — focal · traces
1 Hook 0–7.5 · bulb clicks on; sand pile with a cartridge corner in its light · bulb stutter + sway, chalk tally of five (foreshadows
  the weeks), damp plaster, uneven strides, a curious glance, held look-down 5.1–5.8 s.
2 A 7.5–16 · "~5 WEEKS" bracket on the calendar close-up · days crossed at a quickening uneven pace, coffee ring off the corner,
  crooked XMAS! sticky (two-stroke underline), poster with two-stroke arrow to the door, NPC typing from behind.
3 A 16–24 · E.T.-stencilled racking into fog, then the cartridge in hand · flickering tube, offset/missing cartons, hand-made aisle
  sign, fallen carton, worn floor line, reach-overshoot-settle, 0.45 s hold after the pickup.
4 B 24–31 · "SELL E.T. FOR CHRISTMAS." + empty accent box · two-stroke ticks, wobbly rule, off-grid slot, cursor overshoot,
  uneven typing, dev-note egg "NO PITS IN THIS BUILD" (E.T.'s infamous pits), 1.4 s still.
5 C 31–39 · same pictogram in new paint (clones) · aisle narrows, fog + noise rise then drop dead for a 0.7 s held look, tilted
  hand-lettered SALE cards, lost MARKET segments blink. Chaos beat that resolves at the arch.
6 B 39–48 · offered cartridge + UNSOLD bar · options struck by hand, clerk shakes head, returns land unevenly with overshoot and a
  decaying shake, taped slip on the counter, flickering tube.
7 A→C 48–56.5 · the cartridge tumbling into the pit · EXIT door frames the night, truck dumping, crescent moon, lift before the toss,
  8.5 fps dust puff, held silence after "AND BURIES IT."
8 payoff 56.5–66 · the same cartridge, dirty, lifted into dawn · fog interlude where only MARKET refills (1985), fog clears as "2014"
  types, film crew + tripod, crouch-reach-rise, quiet dark QUEST COMPLETE with a hand underline, HUD powers off.

## Scorecard (QUALITY §7: focal, hierarchy, asym, specificity, traces, motion, palette, text, signature, ship)
R1: S1 11 · S2 15 · S3 15 · S4 18 · S5 16 · S6 12 · S7 12 · S8 14 (invisible bulb, camo plaster, aliased ceilings, coffee ring as a
circled date, floating "waving" hand, E.T.→C.T. on scaling, tiny clerk, flat pit, pink copies) → R2 falloff, bulb click, sunken pit,
forearm + reach, muted copies, clerk, sky text → R3 visible landing, fog interlude (1985 not over 2014), ≥0.3 s/word. Final: S1 2,2,1,2,2,2,2,2,2,1=18 · S2 2,2,2,2,2,2,2,2,2,1=19 ·
S3 2,2,1,2,2,2,2,2,2,1=18 · S4 2,2,2,2,2,2,2,2,2,1=19 · S5 1,1,2,2,2,2,1,2,2,1=16 · S6 1,1,2,2,2,2,2,2,2,1=17 ·
S7 2,2,2,2,2,2,2,2,2,1=19 · S8 2,2,2,2,2,2,2,2,2,1=19. Left: S6 focal splits, crude clerk; S5 busy by design; aisle near
one-point symmetric; dither grain in dark/night areas; plain ceilings; one stiff reach pose.

## Facts / [verify] (kept off screen)
On screen: 1982; E.T. for the Atari 2600 rushed for Christmas 1982 in about five weeks; cheap clones flooded stores; E.T. sold
poorly, stock returned; the market crashed (1983); Atari buried unsold stock in a landfill in Alamogordo, NM (1983); the NES brought
the market back (1985); a 2014 dig for a documentary found cartridges. Calendar = unlabelled month grid (illustrative).
[verify] single programmer (not named/shown) · ~4 M made / ~1.5 M sold · Jul–1 Sep 1982 window · Sep 1983 burial, truckloads,
concrete cap · 26 Apr 2014, "Atari: Game Over", counts · ~97 % revenue drop · NES NY test launch Oct 1985. No logos, no faces.

## Port notes (honest)
- Cheapest: this renderer as a kit "raycast look" (2D canvas in the scene iframe, pure in t, preview = export), ~1 wk, but a second
  renderer. Native: FP rig 2–3 d; half-res + colormap LUT shader + dither 3–5 d; dungeon kit 1 wk; HUD kit fed by timeline 1 wk.
- Real cost = per-film levels: runtime Claude needs a level DSL (grid, regions, doors, sprites, camera keys as in `world.js`/`path.js`)
  + validator (path vs sprites, door timing, focal in frame) + per-topic textures. 4–6 wk for a robust generator. Risks: bob fatigue
  in 8-min films (subtle + off switch), flat billboards up close, bespoke props per topic (the E.T. cartons carried this one).

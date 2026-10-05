# game-hud · B1 "Boss-fight montage" — showcase notes (the 1983 crash and the E.T. cartridges)
Open `showcase.html` (no build/network, classic scripts). 640×360 indexed, integer-scaled, 30 fps, 63.5 s, 8 shots; frame = f(global
frame), seeded hash only. Headless check: 1905 frames ×2 (2nd pass out of order) → 0 mismatches, 23 inks, worst 15 ms. Stills: `shots/`.

## Palette — "wood-panel living room seen through an NTSC 2600" (23 inks)
Base 60 %: `#0b090d` VOID crt black · `#17131d` TUBE · `#2a2340` NIGHT · `#533a5e` DUSK · `#2c1a12` WALNUT_D · `#50301e` WALNUT ·
`#84522c` TEAK (panelling, dirt) · `#39401a` OLIVE_D (shag shadow) · `#163c43` TEAL_D (store wall) · `#403d47` GREY_D (black plastic).
Support 30 %: `#bf8d57` TAN (HUD ink, cardboard) · `#efd9ae` CREAM (labels, paper) · `#fff3dc` WHITE (hit flash only) · `#92381a` RUST ·
`#d9651f` ORANGE (Dad's sweater, truck, stripes) · `#eba73a` GOLD (sticky notes, year flash, excavator) · `#2a8783` TEAL ·
`#82c9b5` AQUA (phosphor, 2014 sky) · `#77812d` AVOCADO (shag, tree) · `#9c5c74` MAUVE (desert dusk) · `#8a8591` GREY (metal, NES) ·
`#4a68bd` BLUE (2014 sky, NES label). Accent 10 %: `#e3304a` CRIMSON = the threat only (HP, weeks-left digit, INVENTORY FULL,
the strike through MORE TIME). All post effects are LUTs inside the palette (scanline, bleed, drain, burn-in ghost).

**Fonts** (new, CC0, `js/fonts.js`): Joy 5×6 menu caps (2x) · Score Block, 2600 score kernel on wide cells · Box Art = Joy bold +
italic shear + extrusion (boss names) · Dad Hand, a jittered stroke font (tag, masking tape, sticky notes).

## Grammar
**Two worlds + glass.** In the TV: 2600 rules (4×2 px wide pixels, ~8-bit sprites with ONE colour per row, playfield, colour bands,
flicker on crowded lines, CRT bleed/scanlines/hum/tube). Outside: the room in square 2x pixels with a camera. On the glass: sticky
notes (no scanlines, cast a shadow). On top: the film HUD.
**HUD = meaning.** YEAR = the story's date (odometer with lag/overshoot; the old year stays as a CRT burn-in ghost; 1985→2014 spins).
8 cartridge slots = film progress, one per shot. Dims on CONTINUE?, dark ink on daylight dirt.
**Bosses = the real antagonists** (DEADLINE, FLOOD, LANDFILL): silence beat → "BOSS n" types → name slams from a different side each
time (left / right / top), overshoot + decaying shake → HP segments arrive unevenly, in a real unit or unlabelled (WEEKS = the five
weeks; the flood's bar GROWS; the landfill is full) → the weak point = a sticky note slapped on the glass in Dad's hand. Three endings:
deadline met (hit-stop, flicker death, note struck out) · flood wins (hit-stop flash, picture drains to grey, only the glass note
keeps colour) · landfill falls in 2014 (hit-stop, segments drop out with gravity).
**Transitions, each with a reason:** level-select map only when place/time changes (back to XMAS 82, forward to ALAMOGORDO 83; cursor
= a cartridge hopping unevenly; playfield blinds open around the chosen node) · push-in + interlaced scanline wipe = match cut, the
wall calendar becomes the boss at the same size/place · cartridge insert (resists, clicks, garbage flash) = the game reaches homes ·
INVENTORY FULL spills into the next shot's flood (one continuous level) · hit-stop + drain = the crash · cartridge pull (same hand,
same tape) = the return · CRT roll = someone touches the console · lights out row by row → CONTINUE? with the landfill card burned
in · year spin = the 29-year jump.

## Shots — focal · traces (all seeded) · score (focal, hierarchy, asym, specific, traces, motion, palette, text, signature, ship)
1 Hook — last cartridge on the truck lip, then lit on the dim pile (right third). Uneven releases, flicker, lip wobble, landing
  hit-stop + squash + dust, truck chugs off unevenly, irregular typing. 2,2,2,1,2,2,2,2,2,1 = **18**
2 A Xmas 82 — the dashed "missing item" gap under the tree + Dad's tag E.T. / XMAS 82. Uneven planks, bulbs on own cadences,
  unclosed pen circle on DEC 25, thumbprint on the glass, hand-drawn joystick cable, tag swings to rest. 2,1,2,2,2,1,2,2,1,2 = **17**
3 C Deadline — over the shoulder; CRIMSON weeks-left digit, then the note. Pages flip back unevenly, typing speeds up, elbows out
  of sync, torn pages land on his desk, slump, note underlined twice then struck out. 2,2,2,2,2,2,2,2,2,1 = **19**
4 B Market — GAMES grid filling faster and faster → INVENTORY FULL. Cart resists the slot, Dad's masking tape, panel draws line by
  line, cursor overshoot with uneven holds, carts stocked a unit off-grid, spill flicker. 1,2,1,2,2,2,2,2,2,1 = **17**
5 C Flood — the rising wall of near-identical clones. Surges + decaying shakes, crest flicker (2600 sprite limit), kid's input-lag
  crouch + landing squash, taped note, hit-stop flash, row-by-row drain. 2,1,2,1,2,2,2,2,2,2 = **18**
6 B Returns — the family cartridge pushed back across the counter. Squeeze + push-down before the pull, crooked sign (right chain
  longer), push hitch, boxes land off-true, a tube flickers, the grey dot (Adventure nod). 2,2,2,2,2,1,2,2,1,2 = **18**
7 A→C Landfill — the pile at the bottom of a ragged trench, then the card. Cart stuck on a ledge, uneven drops + flicker, eased
  scroll ending on a hold, dirt in blocks of uneven height, card burns in. 1,2,2,2,2,2,2,2,2,1 = **18**
8 Payoff — countdown digit → grey cart (the only square-pixel object: a new generation) → bucket → XMAS 82 in the dirt. Burn-in
  ghosts, unequal countdown holds + tick squash, click shake, the old note returns with a 2-stroke tick, bucket anticipation,
  hit-stop, a crumb falls in the final hold. 2,2,2,2,2,2,2,2,2,1 = **19**
Round 1: S1 13 · S2 14 · S3 13 · S4 14 · S5 15 · S6 13 · S7 12 · S8 15 (names clipped by the Box Art mask, tiny unlit hook focal, S3
copied v1's small-hero-left, hand over Dad's writing, invisible icons, panel flicker read as a bug, loud shelves, muddy drain, stack
over sign/HUD, hard-edged vignette boxes, symmetric shaft, striped dirt, NES cart read as a monitor). Round 2 fixed all of it; round
3: S4 grid jitter. Weakest left: S4 centred menu block; S2 TV + tree lights compete a little; S7 opens on a big dark shape.

## Facts (certain) · [verify]
On screen / in captions: NA market crash 1983 after a flood of low-quality games; E.T. for the 2600 built in about five weeks for
Christmas 1982, known for its pits, sold poorly, returned; Atari buried unsold stock in the Alamogordo, NM city landfill in 1983;
dug up for a documentary in 2014, cartridges found; NES (1985) revived the market with licensing/quality control; consoles on sale
in 1983: Atari 2600, Intellivision, Odyssey², ColecoVision, Atari 5200, Vectrex. The family cartridge (Dad's XMAS 82 tape) is a
narrative device, not a claim. No logos; labels are generic.
**[verify] (off screen):** cartridges buried (~728,000, 2014 report); burial dates (Sept 1983), concrete cap; E.T. made vs sold;
dev dates (late Jul–1 Sep 1982); dig date 26 Apr 2014 + film title; licence fee; revenue drop size; NES NY test Oct 1985; El Paso.

## Port notes (engine)
Layers `tv` (160×180 wide pixels, per-row-colour sprites, crt as LUT passes) / `room` (2x camera) / `glass` + HUD. Kit fed by the
timeline: yearOdometer+burn-in, progressCartridges, bossCard, stickyNote, levelMap (nodes = storyboard places), cartridgeCloseup.
§8 trace helpers: typed, handStroke, hitStop, flicker, sprSquash, shake. Foley: cartridge click, slot scrape, page tear, hum.

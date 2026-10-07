# detective-board - showcase notes ("The 1911 theft of the Mona Lisa")

Open `showcase.html` (no network/build). `gfx.js` rasteriser + light, `fonts.js`, `art.js`, `props.js`, `shots*.js`, `player.js`.
Every frame is `render(frameIndex / 30)`; randomness = seeded integer hash; caches only memoise pure builders.

## Palette (16, indexed; lighting = one-step DARK/LIGHT ramps + 4x4 Bayer in world space)
`#0c0b11` black / `#1c1a26` night (room shadow) / `#393543` slate (graphite, iron, cool shadow band) /
`#553624` cork dark / `#835532` cork / `#ad7843` cork lit, coffee / `#dca462` brass, lamp-hot cork, pencil /
`#e6d9ba` paper / `#bcab8b` paper shade / `#878476` photo grey / `#4b636c` photo teal dark / `#86a39c` photo teal,
map water / `#22344c` ballpoint ink / `#d8281c` RED (string, key pins, tick, circle - nothing else) / `#701510` red
shade / `#f8f2de` hot white. Mood: warm lamp pool falling off into cool slate/indigo, photos in cool faded teal so they
sit against the cork; no sepia filter. Red share measured 0.03-0.24 % of pixels.

## Fonts
- TYPE (labels, report, map): Forge Mono caps 5x7 (CC0 glyph data copied); seeded light strikes, ~1/10 letters jump 1 px.
- HAND "Ballpoint" (new, CC0): 1-px pen strokes, 8-px caps, 5-px x-height, proportional; per-note slant 0.22-0.34,
  baseline drift, seeded letter bob and spacing; writes on with irregular cadence (pauses at spaces).

## Human traces per shot
1 Hook: tape on corner, curled corner, old pin holes, slanted date, double underline (2 strokes, boil), pin squash + photo jolt.
2 A-roll: carried string that hooks on and twangs, curled corners, crooked typed tapes, one pin shared by two prints,
  "the poet?" struck through + "released", stagger 0.37/0.51 s, two lamp pools with dark between.
3 B-roll: coffee ring with a gap, double ballpoint underline, crease, dog-ear, crooked date stamp, torn ticket edge,
  pencil that hesitates over the Alps, loose red loop that overshoots its start.
4 C-roll: theory print curls and drops, pin pops off, its label is left behind, lamp sway moves every shadow,
  lamp stutter inside the silence, "?" scribbled out, tick in two strokes.
5 Payoff: old note struck, new card pinned across it, new print over the old one (old date visible), "Returned. 1914.", 1.0 s hold.

## Critique round 1 (first full render of all five) - score /20 and fixes
- S1 13: date cut off in lower 12 %, Bayer noise everywhere, hooks invisible. -> tighter crop print, narrowed dither,
  readable iron hooks, date above the caption zone.
- S2 13: centred symmetric pair + card (slop #1), strike hid the word. -> cluster left of centre sharing one pin,
  card low right, single strike through the x-height.
- S3 15: Paeth edges notched, typed "-----" read as underscores, sea read as a hill, rotated Bayer -> moire stripes.
  -> exact-rotation outline + Paeth content, real lon/lat map (Gulf of Lion, Genoa, Corsica), engraved water rules,
  film grain instead of Bayer inside sprites.
- S4 15: perfect elliptical spotlight rings, tick crowded on the "?". -> value-noise light pools, wider card, bigger tick.
- S5 12: hero centred, "1914" read "191Y", writing unfinished in the hold. -> print moved right of centre with the
  string leading in, new 1/4 glyphs, faster write + longer hold.
## Critique round 2 (after fixes; frames in shots/)
| shot | focal | hier | asym | spec | traces | motion | palette | text | signature | ship | total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 19 |
| 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 17 |
| 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 19 |
| 4 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 18 |
| 5 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 19 |
Fixes in round 2: 2-px yarn string (top red, underside dark red), DARK ramp cork->slate (warm-to-cool falloff, no hard
ring), full Bayer for light, portraits re-drawn (sockets, ears, forelock, jaw, police scale), halo removed.
Still weak: S2 card text is small at 1x (the sentence's point has the lowest contrast); handwriting reads at 2x, not in a
64-px thumbnail; portraits are illustrative rather than photographic.

## Refine in the real engine port
- Lighting as a post-fx pass in `packages/engine` (lamp list + value noise + DARK/LIGHT ramps), Bayer in screen space only.
- Sprite rotation = exact outline + Paeth content; forbid ordered dither inside rotatable sprites (lint).
- Trace helpers for the kit: `pinDrop`, `land` (hover shadow -> slap -> settle), `string(sag, twang)`, `strike`, `tick`,
  `curl`, `tape`, `handText(slant, rise, cadence)`; the critic can count calls (QUALITY 8).
- Hand face: add Polish diacritics + a 2x "marker" weight for focal notes; typewriter: per-letter ink pressure map.
- Camera rides the string as a reusable move (x along path, y follows sag), ending on a hold; catenary/verlet string.

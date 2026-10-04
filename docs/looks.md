# Looks (ReelForge 2.0)

One **Style**, many **Looks** (PLAN.md phase 12, ADR-009).

- **Style** = what makes every frame of the film one film: the post-fx pass (palette LUT, Bayer
  dither, outline, vignette), the palette, the pixel fonts and (12.24) the shared sound treatment.
  It lives in `packages/engine` (`styles/<id>/`, `presets/`) and is never replaced by a look.
- **Look** = a family of kit content (environments, props, effects, shot templates) plus the docs
  the runtime Claude builds with, a sound palette id and a variation budget key. Every look renders
  through the same Style. Available: `voxel` (the 1.x kit, unchanged), `retro-ui`, `diorama` and
  `blueprint` (`reelforge looks` lists them).

## The contract (`packages/kit/src/looks/types.ts`)

| Field | Meaning |
| --- | --- |
| `id` | kebab case, written by storyboards as `shot.look` (`voxel`, `retro-ui`, …) |
| `label`, `description` | the description is the one line the storyboard prompt shows |
| `rolls` | rolls it suits (`A`, `B`, `C`) |
| `treatments` | storyboard treatments it favours (PLAN.md §4.3 taxonomy; a test checks them) |
| `docs` | markdown for the scene-build prompt: how to build a shot in this look |
| `soundPalette` | sound palette id (PLAN.md#12.24) |
| `variationBudget` | variation budget key in `STYLE.md` (PLAN.md#12.8) |
| `available` | only available looks reach storyboards, scene builds, `ctx.kit` and the catalog |
| `kit` | `{ env, props, fx, templates }`: kit definitions (`defineEnv/defineProp/defineFx`) |

`defineLook()` validates a look when the kit loads. A look's definitions are bound into the usual
namespaces (`kit.env.*`, `kit.props.*`, `kit.fx.*`; templates by their kind) next to the voxel
kit's own; a name already used by the voxel kit or another look is an error. Catalog entries carry
`look`; `docs/kit-catalog.md` gets one `## Look …` section per available look besides voxel, and
`reelforge kit-docs` marks those entries `(look <id>)`. With only voxel available, the kit API, the
catalog and kit-docs text are exactly what they were before looks (tested).

The `reelforge kit-docs` index must fit Claude Code's Bash output (~30,000 characters; above that
the scene turn sees a 2 KB preview, real run v2.0): `voxel-only` projects list no entries of
other looks (the 1.x text), `mixed` projects list look entries and project props one line each
(params via `kit-docs <name>`), and when the kit outgrows the budget the longest entries keep
only their param names. `kit-docs <kind|look> [--full]` lists one slice (`props`, `env`, `fx`,
`templates`, `project`, `voxel`, `retro-ui`, …); long slices come in pages (`--page n`).

## Rolls

Assigned per shot by the storyboard (`shot.roll`), definitions to be refined after the first film:

- **A** = the main visual story (voxel 3D: the character, places, reconstructions). The anchor:
  it comes back every 3–6 s, at least once in every 6 shots.
- **B** = proof and illustration (retro UI, documents, maps, charts, blueprint, diorama, photos
  embedded in a scene).
- **C** = atmosphere and rhythm (glitch, pixel-sort, loops, kinetic text, title cards, metaphors,
  transitions); opens acts.

## Look mode (`project.json` → `lookMode`)

- `voxel-only` — every project without the field (all pre-2.0 projects, the Nokia film, the
  example project). Storyboard prompt, validator, scene-build and critic prompts are byte for
  byte as before (fixtures in `packages/prompts/src/fixtures/`).
- `mixed` — new projects (`templates/project/project.json`). The storyboard prompt adds the roll
  definitions and the available looks; the validator adds the rhythm rules; the scene-build
  prompt gets the shot's look id and docs; the frame critic gets the shot's look, roll and the
  look's visual rules (`CRITIC_LOOK_RULES` in `packages/stages/src/looks.ts`) and checks crops,
  label collisions and off-look elements.

Rhythm rules (`packages/prompts/src/validators/rhythm.ts`, `StoryboardRules`), `mixed` only:

| Rule | Severity | When |
| --- | --- | --- |
| `unknown-look`: look not available | error | always |
| `roll-a-gap`: no A-roll in 6 shots in a row (untagged voxel shot = A) | error | always |
| `missing-roll`: every shot needs a roll | error | ≥ 2 looks available |
| `look-run`: one look > 3 shots in a row (A-roll voxel: 4) | error | ≥ 2 looks available |
| `pattern-run`: one roll + look + treatment > 8 s over several shots | error | ≥ 2 looks available |
| `act-change-roll`: a non-cut transition into a non-C shot | warning | ≥ 2 looks available |

Errors go to the storyboard repair turn; warnings land in the stage record. With voxel as the
only look, rolls are optional and every shot is `voxel`.

## Vibe guard

`vibeGuard(rgba, style)` in `packages/engine/src/vibe.ts` returns `{ ok, offPalettePct, issues }`:
every pixel must be a colour of the style palette (project overrides included) and opaque. The
post-fx pass ends with the palette LUT, so a normal render always passes (the voxel goldens are
checked in a unit test); a failure means a look bypassed the post-fx (own gradients,
anti-aliasing, an unfiltered image). Render tests call `expectVibe(frame, label, style?)` from
`packages/kit/test/support/vibe.ts` on their golden frames. The Haiku critic prompt has a matching
"vibe check" paragraph (same palette, pixel fonts, dithering; no smooth gradients or
anti-aliasing → `off-intent` with a `vibe:` note).

## Adding a look in 6 steps

1. Work only in `packages/kit/src/looks/<id>/` (the stub module already exists for `retro-ui`,
   `diorama`, `blueprint`; a brand-new look adds one import to `LOOKS` in `looks/index.ts`).
2. Build its kit definitions with `defineEnv/defineProp/defineFx` (palette names only, `tools.rng`
   for randomness, pure functions of `t`), list them in `kit`.
3. Write `docs`: what the look is, which definitions to use for which shot, composition and
   camera rules; keep it short (it is sent with every scene build in the look).
4. Fill `rolls`, `treatments`, `soundPalette`, `variationBudget`; flip `available` to `true`.
5. Add render tests with goldens in `packages/kit/test/render/` and call `expectVibe` on every
   golden frame; check the thumbnails/contact sheets by eye.
6. Run `pnpm kit:catalog` (the look gets its catalog section), `pnpm typecheck && pnpm lint &&
   pnpm test && pnpm test:render`; existing goldens must not change.

## Look: retro-ui

Code: `packages/kit/src/looks/retro-ui/`; example `packages/kit/examples/look_retro_ui.js` (one setup
per template); render test and goldens `packages/kit/test/render/look-retro-ui.test.ts`,
`look-retro-ui-*`. Rolls B and C; treatments `ui-mockup`, `kinetic-text`, `title-card`,
`montage/transition`; sound palette and variation budget `retro-ui`.

- **Templates** (`kit.props.*`): `retroWindow` (dialog / progress / icons / text / image, stacked
  windows, zoom open/close, pointer click), `retroTerminal` (typed commands, printed output in
  tones, scrollback), `retroBrowser` (typed URL, interlaced page load, headline, photo, hit
  counter), `retroDocument` (newspaper, dossier with redaction bars, memo; rubber stamp),
  `retroCrt` (voxel monitor/TV casing or bare tube; `crt.show(child)` shows another template
  through the tube). Backdrop: `kit.env.retroDesktop` (`os` desktop or `desk` wall + voxel desk).
- **How it renders.** Each template is a painter: a pure function `paint(canvas, t)` over a
  canvas of colour-role indices (22 roles, each a palette chain "Crisp swatch, Noir swatch, Soft
  swatch, token"), uploaded to an unlit, nearest-filtered plane only when a pixel changed. The
  CRT paints at 2x density for 1-px scanlines; curvature, glow, flicker and power animations are
  one-tone steps along the palette (`DIM`), so the vibe guard passes by construction. In-world
  text uses the kit's own CC0 bitmap fonts (5x7 caps, 3x5 caps; the engine's `ctx.text` fonts live
  in the engine, which the kit cannot import) plus a few glyphs they lack (`\`, `|`, `"`...).
- **Anchors** move with t and exist in every state (a closed window keeps `button` where it will
  be): `title`, `close`, `button`, `bar`, `line:<i>`, `cursor`, `url`, `headline`, `photo`,
  `stamp`, `field:<i>`, `icon:<i>`, `mark:<text>` (phrases listed in `marks`); a container
  (window, CRT) passes its child's anchors through, mapped through the tube curvature.
- **Camera.** `obj.fitDistance(px)` gives the distance at which one UI pixel is `px` frame
  pixels (fov 50, 360-px frame). Integer ratios keep the pixel grid crisp; pans move camera and
  target together; push-ins jump between integer ratios quickly.

## Look: diorama

Code: `packages/kit/src/looks/diorama/`; render test and goldens
`packages/kit/test/render/look-diorama.test.ts`, `look-diorama-*` (inline scene, one setup per
diorama/time of day; contact sheet `packages/kit/out/contact/look-diorama.png`). Rolls A and B;
treatments `3d-reconstruction`, `metaphor-object`, `character-scene`, `map`; sound palette and
variation budget `diorama`.

- **Environments** (`kit.env.*`): `dioramaOffice` (desks with flickering monitors, staff, raised
  meeting corner, whiteboard), `dioramaServerRoom` (two rack rows with blinking LEDs, cable trays,
  cooling units, status screen with live bars, pacing technician, `alarm(amount)`), `dioramaCity`
  (ring road with looping cars, park with fountain, landmark tower with a marquee sign, frame of
  buildings, lamps, traffic light, pedestrians, chimney smoke; `traffic`), `dioramaRoom` (bed,
  rug with a cat, bookshelf, desk with computer and steaming mug; `occupied`). Shared params:
  `seed`, `accent`, `density`, `time` (`day` / `dusk` / `night`), `base` (`earth` / `concrete` /
  `wood` slab), `lights`, `shadow`.
- **How it renders.** A diorama is a tile grid parsed from ASCII rows (kind + floor height, so
  raised floors and curbs are steps) drawn into one voxel canvas (1/8-unit voxels, a tile is 8):
  display plate, cross-section slab, patterned floor, cut-away back/left walls with a light cap,
  windows, and every static object through stamps that face +z or +x. The canvas is one greedy
  mesh. Animated lights (LEDs, screens, windows, signs, traffic light) are unlit palette quads on
  voxel faces repainted from t; cars, walkers and smoke are small voxel meshes posed from t and
  snapped to whole voxels. The diorama carries its own light rig per time of day (bright tops,
  mid left faces, dark right faces) and a dithered base shadow (a Bayer-thresholded rounded
  rectangle in one palette colour, no depth write), so the vibe guard passes by construction.
- **Camera.** `diorama.camera({ t, zoom, focus, offset, drift, screen })` returns a pose for
  `ctx.camera.set()`: azimuth 45°, elevation 30° (2:1 pixel-art ground lines), fov 12° (close to
  orthographic), framed on the platform bounds with an 8 % margin, the target snapped to whole
  output pixels in the image plane (a pan moves the plate by whole pixels), and an idle pan of
  `drift` pixels (sine, 12 s). `focus` takes an anchor name; `offset` moves the subject in frame
  fractions (thirds). Orbiting would break the iso read: animate `zoom`/`focus` instead.
- **Anchors** are fixed points of the plate (`desk0..3`, `monitor0..3`, `rack0..11`,
  `building0..11`, `landmark`, `cat`, …, listed per env in the catalog); moving parts are
  `diorama.part('car0' | 'walker0' | 'tech' | 'steam' | 'smoke')`.

## Look: blueprint

`packages/kit/src/looks/blueprint/` (PLAN.md#12.4; goldens `look-blueprint-*`, contact sheets
`packages/kit/out/contact/look-blueprint-<style>.png`). Rolls B and C; treatments
`data-chart-3d`, `map`, `node-graph/timeline`, `counter/odometer`, `3d-reconstruction`,
`title-card`; sound palette and variation budget `blueprint`.

- **Templates** (each a full-frame board): `kit.fx.blueprintChart` (bar / line / area / hbar from
  a pasted `csv` string or `values`/`series`; `highlight` for the punchline), `blueprintCounter`
  (2D odometer with classic carries), `blueprintGraph` (flow chart: boxes trace in, arrows draw,
  pulses flow, highlights), `blueprintTimeline` (events on an axis, `views` zoom/pan, now-marker),
  `blueprintMap` (embedded Natural Earth countries: views, markers, arcing routes, country or
  continent highlights), `blueprintSchematic` (parts traced in order, hatch fills, dimension lines,
  callouts with balloons) and `kit.env.blueprintSheet` (bare sheet; `headline` = title card).
- **How it renders.** A board is a CPU raster at the shot's low-res size (`size: [ctx.shot.width,
  ctx.shot.height]`), repainted from scratch for every t (paper, drifting grid, border, rulers,
  title block, then the template) with integer primitives (Bresenham lines, scanline polygons,
  midpoint circles, Bayer patterns) and the kit's 5x7 caps font at integer scales, in palette
  colours only (role chains per style). It is shown on a clip-space quad (no depth write,
  camera-independent, 1 texel = 1 frame pixel), so it stays pixel-exact, passes through the shared
  post pass (dither, LUT, vignette) and never triggers the depth outline; voxel objects, `ctx.text`
  and `ctx.annotate` (frame targets) draw on top. `region` + `paper: false` make overlays.
- **Data and sync.** Times are seconds or spoken phrases (`"phrase#2"` = 2nd occurrence) resolved
  in build through `anchor: ctx.anchor`, so the sync report sees them. CSV: optional header, first
  column = labels, other numeric columns = series, `at`/`time` (seconds) or `say`/`phrase` columns
  time each row; numbers may carry `$ € £ %`, digit groups and decimal commas (`;` files).
- **Map data.** Natural Earth 1:110m countries (public domain), simplified topology-preserving and
  stored as encoded polylines (~13 KB); land is rasterised into a country mask, so coasts, borders
  and highlights are 1-px edges at any zoom. Views: world, europe, africa, asia, middle-east,
  north-america, south-america, oceania or a `[w, s, e, n]` box (no Pacific-centred views).

## Ambient variation

PLAN.md#12.8, ADR-010. With `"ambientVariation": true` in project.json (new projects; absent =
off, frame for frame as before) the environments of a look drift from shot to shot inside the
style's budget `variation.<variationBudget>` in the engine preset: tone families (swatches of the
palette only), sky horizon, grid density and fade, light turn, debris/stars, layout of seeded
backdrops and a slow camera drift. Neighbouring shots always differ (two axes step through seeded
permutations); acts and rolls give each stretch a coherent mood. Only `voxel` has budgets today;
a look opts in by adding a budget under its key in the presets and reading `tools.variation`
(helpers `toneOf`, `debrisCount`, `layoutLabel` in `packages/kit/src/variation/`). Scenes read
`ctx.ambient` (read-only) and must not hard-code one background for every shot. Render test and
goldens: `packages/kit/test/render/kit-ambient.test.ts`, `ambient-*`; contact sheets
`packages/kit/out/contact/ambient-<style>.png`.

## Transitions between looks

PLAN.md#12.15, ADR-011, guide `docs/transitions.md`. A non-cut `transitionIn` may name a
transition-kit `style`; the engine composites the two post-fx frames pixel by pixel (palette
only). Look-change specials: `crt-zoom` (retro-ui), `tile-flip` (diorama), `draw-over`
(blueprint), `pixel-sort-melt` (C-rolls). In `mixed` projects the storyboard prompt lists the
styles and the storyboard stage fills missing ones per look pair (`transitionFor`).

## Asset pictures in looks

PLAN.md#12.11, ADR-014, guide `docs/assets.md` → "In scenes". A look shows a real picture through
`ctx.assets.image(ref)` and an `asset` param: voxel `photoFrame`, `polaroid`, `billboard`,
`assetScreen`; retro-ui `retroBrowser`/`retroDocument`/`retroCrt` (`asset`, the placeholder
photo otherwise); diorama `dioramaCity({ billboard })`, `dioramaOffice({ screen })`. The engine
stylises the picture into the colours the look asks for (style palette, retro roles, or luminance
for halftone ramps). Render test and goldens: `packages/kit/test/render/kit-assets.test.ts`,
`asset-*`; contact sheets `packages/kit/out/contact/assets*.png`.

## Look: whiteboard

`packages/kit/src/looks/whiteboard/` (PLAN.md#12.7; goldens `look-whiteboard-*`, contact sheets
`packages/kit/out/contact/look-whiteboard-<style>.png`). Rolls B and C; treatments
`metaphor-object`, `node-graph/timeline`, `counter/odometer`, `kinetic-text`, `title-card`; sound
palette `whiteboard` (`marker-stroke`, `marker-squeak`, `cap-pop`, `eraser-swipe`, `board-tap`,
`board-chime`, `board-tick`; bed `room-tone`) and variation budget `whiteboard` (none yet).

- **Templates** (each a full-frame board): `kit.fx.whiteboardSketch` (strokes from a compact
  stroke language: `line`, `curve`, `arrow`, `box`, `circle`, `bracket`, `underline`, `zigzag`,
  `hatch`, `dot`, `write x y TEXT`, plus 24 doodles such as `person`, `bulb`, `gear`, `house`,
  `computer`, `axes`, `bars`, `pie`, `cloud`, `magnifier`, `rocket`, `coin`, `heart`, `question`,
  `check`), `whiteboardText` (lines written glyph by glyph, emphasis underline / double / circle /
  box / strike), `whiteboardDiagram` (`flow` with auto layout row / snake / column / cycle,
  `timeline`, `equation`), `whiteboardCounter` (numbers written, crossed out and replaced, the last
  one circled) and `kit.env.whiteboardBoard` (bare board or handwritten title card).
- **Stroke model.** A drawing is a list of marks; a mark is one thing drawn in one ink (black,
  blue, red, green role chains): pen paths of integer pixels (Bezier and arcs flattened, wobbled by
  seeded smooth noise rounded to whole pixels, then Bresenham) inked with a 2-3 px nib, or font
  cells for handwriting (the kit's 5x7 caps put in pen order, slanted, bobbing a pixel). Progress is
  a pure function of t: the pen walks the paths along their arc length (each path eases in and out,
  lifts cost time by distance), with the hand sprite (or a bare marker) at the head and travelling
  between marks. Timing per item: `at` (seconds or phrase), `duration`, or auto by ink length at
  `speed`; auto items hurry (down to a third of their time) so the hand is free for the next
  pinned phrase. `erase: [{ at }]` passes wipe everything drawn before them with a ragged,
  Bayer-dithered front and the felt eraser at it, leaving a faint ghost.
- **How it renders.** Like blueprint: a CPU raster at the shot size, the surface (wall, aluminium
  frame, grain, ghosts of old marker, optional dot/line grid, tray with markers and eraser) painted
  once and restored per frame, marks and sprites on top, palette colours only, on a clip-space quad
  (no depth write) through the shared post pass. `region` + `board: false` make overlays.
- **Sync and annotations.** `board.strokeTime(i)` gives `{ t, tEnd }` of item i (for `ctx.sfx`),
  `board.stroke(i)` and `board.point(name)` are `ctx.annotate` screen targets (`'id'`,
  `'id.top'`, `'id.end'`, `'stroke:<i>'`, `'word:<k>'`, `'value:<i>'`, `'pen'`). Transitions: the
  wildcard styles (`pixel-wipe`, `dither-dissolve`, `glitch-cut`, `iris`, `scanline-sweep`,
  `mosaic-reveal`; `pixel-sort-melt` with a C-roll side) pair with it; no special style of its own.

## Look: paper-cutout

`packages/kit/src/looks/paper-cutout/` (PLAN.md#12.6; render test
`packages/kit/test/render/look-paper-cutout.test.ts` + `look-paper-cutout-scenes.ts`, goldens
`look-paper-cutout-*`, contact sheets `packages/kit/out/contact/look-paper-cutout-<style>.png`).
Rolls A, B and C; treatments `metaphor-object`, `character-scene`, `3d-reconstruction`,
`title-card`, `montage/transition`; sound palette `paper-cutout` (`paper-rustle`, `paper-slide`,
`scissor-snip`, `tape-tear`, `paper-pop`, `wood-tick`, `page-flip`; bed `room-tone`, no bass) and
variation budget `paper-cutout` (none yet).

- **Stage and pieces.** `kit.env.paperStage` is the set: a torn-paper sky sheet (`backdrop` day /
  dusk / night, or a plain kraft / paper sheet), built-in depth strips (`scenery` hills with a row
  of trees, a two-row city skyline, or none; `layers` 1-4), sun / moon / stars / clouds, and the
  clock. Pieces are props placed on it with `stage.place(piece, { layer, x, y })` (layers 1 far ..
  5 near, 0 = pasted on the sky; x, y in 640x360 px): `paperHills`, `paperTrees`, `paperClouds`,
  `paperBuildings` (strips spanning the frame plus a pan margin), `paperRoom` (toy-theatre room:
  shell, furniture one layer nearer, curtains two layers nearer), `paperPuppet` (jointed character
  with brass fasteners: idle / wave / walk / talk / point / cheer, `walk: { from, to, start, end }`),
  `paperSign`, `paperLabel`, `paperCard` (lettered paper; text never rotates), `paperStack`
  (photos and documents dealt one by one; `asset` puts a stylised picture on top).
- **How it renders.** Each piece is cut as palette-index sprites: scanline polygons and ellipses
  with seeded torn edges, a light rim on torn / cut edges (two steps lighter on near-black paper),
  sparse 2-3 px grain fibres one shade darker. The stage composites all sprites into one frame-size
  index raster back to front and shows it on a clip-space quad (no depth write: never outlined,
  still dithered, vignetted and palette-snapped by the shared post pass). Before a piece is pasted
  its drop shadow darkens what lies beneath through a palette `shade` map (CIELAB nearest darker
  colour, a few hand-tuned Crisp pairs); the offset and the soft 50 % checker fringe grow with the
  layer gap, and shadows of several pieces stack. `light: 'low'` lifts shadows above each layer's
  edge (landscapes), `'high'` drops them down-right (rooms, desks, walls).
- **Parallax and camera.** Layers sit at fixed depths in front of the preset camera
  (`stage.camera({ t, pan, rise, drift })`: fov 30, the middle layer 10 units away, `parallax`
  scales the gaps); every layer is drawn 1:1 in frame pixels at the preset. Each frame the stage
  projects every piece's world position through the camera actually used (the pan, an idle sway,
  `ctx.camera.parallax`, the ambient drift) and pastes it at whole pixels, so near layers move
  more than far ones and annotations on piece anchors line up. Lateral moves only: an orbit, dolly
  or push-in would not scale the paper.
- **Stop-motion.** Moving pieces pose from `t` snapped to the stage clock (`fps`, default 8; 12
  for smoother) with a seeded 1-px hand jitter per frame (`wobble`); puppets are re-cut per frame
  from pure pose functions, so any seek order gives the same image and one image lasts 1/8 s.
- **Anchors.** World points kept up to date on every `stage.update(t)`: puppet `head`, `face`,
  `hand`, `feet`; room items (`window`, `shelf`, `table`, ...); stack `photo`, `caption`; card
  `title`, `subtitle`; sign `text`, `base`; trees `tree<i>`, clouds `cloud<i>`, hills `peak`;
  stage `horizon`, `layer<n>`; any frame pixel via `stage.point(layer, x, y)`.
- **Transitions.** No special style of its own: the wildcard styles (`pixel-wipe`,
  `dither-dissolve`, `glitch-cut`, `iris`, `scanline-sweep`, `mosaic-reveal`; `pixel-sort-melt`
  with a C-roll side) pair with it; the look-pair golden matrix is a fixed circuit of the 2.0
  looks and was not extended.

## Look: flat-2d

`packages/kit/src/looks/flat-2d/` (PLAN.md#12.5; goldens `look-flat-2d-*` incl. the icon sheet
`look-flat-2d-sheet-t1`, contact sheets `packages/kit/out/contact/look-flat-2d-<style>.png`).
Rolls B and C; treatments `kinetic-text`, `title-card`, `metaphor-object`, `counter/odometer`,
`data-chart-3d`, `node-graph/timeline`; sound palette and variation budget `flat-2d` (no budget
in the presets yet: the stage does not drift between shots).

- **When.** Explainer beats in clean flat motion graphics: a concept as icons, a list of steps,
  a percentage, A vs B, one big number, a phrase that must land, a name plate. Blueprint stays
  the look for charts, maps, schematics and timelines from data; retro-ui for proof on a screen
  or on paper.
- **Templates** (each a board, see below): `kit.env.flatStage` (field in a tone family:
  indigo, violet, teal, night, wine, cream; pattern solid, dithered gradient, spot, stripes,
  dots, grid, checker or sunburst rays, drifting with t; seeded floating decor on the edges),
  `kit.fx.flatShapes` (circle, rect, pill, triangle, diamond, hexagon, star, plus, ring, line,
  arrow; flat drop shadows, labels; entrances pop / scale / slide / drop / spin / wipe / fade,
  idles float / pulse / spin / wobble, exits; `morph` keys change kind, size, position and colour
  on cues), `kit.fx.flatIcons` (26 hand-made 16x16 icons on badges; `sheet: true` shows the set),
  `kit.fx.flatInfographic` (`kind` icons / progress / ring / versus / stat; numbers count up),
  `kit.fx.flatKinetic` (bold pixel caps, per-word effects pop / slide / drop / shake / type /
  fade and marks underline / plate / box / strike) and `kit.fx.flatLowerThird` (bar, name plate,
  caption strip, icon; overlay over any shot).
- **How it renders.** Like blueprint: a CPU raster at the shot's low-res size repainted for every
  t (stage, then content) with integer primitives (scanline polygons and ellipses at pixel
  centres, Bresenham strokes, Bayer-ordered coverage for fades, gradients and colour morphs),
  the kit's 5x7 caps font (bold for display type) at integer scales, palette roles per tone
  (chains Crisp, Noir, Soft, token), shown on a clip-space quad without depth. Morphs blend the
  radial profiles of two shapes angle by angle; nothing is anti-aliased, so the vibe guard passes
  by construction. `overlay: true` (default for lower thirds) draws after the scene's objects.
- **Composition.** One idea per board, at most 6 elements on screen, everything inside the 5 %
  safe area (the layouts keep it); elements land on the words that name them (`at: 'phrase'`,
  `anchor: ctx.anchor`), the rest staggered 0.2-0.4 s; one accent carries the point.
- **Anchors.** `board.target(name)` gives a `ctx.annotate` target `{ screen, size }` of a part at
  rest: `shape:<i>`, `icon:<i>` / `icon:<name>`, `item:<i>` and `vs`, `word:<i>` / `line:<i>`,
  `name` / `caption` / `plate` / `icon`. Around badges prefer `ring({ shape: 'rect' })`.
- **Sound.** Palette `flat-2d` (docs/sfx.md): `shape-pop`, `swoosh-soft`, `whoosh-flat`,
  `flat-tick`, `chime-up`, `text-snap`; clean, short, no heavy lows; room-tone bed.
- **Transitions.** No look-change style of its own: the wildcard styles pair with it (and
  `pixel-sort-melt` with a C-roll side); the look-pair golden matrix is a fixed circuit of the
  2.0 looks and was not extended.

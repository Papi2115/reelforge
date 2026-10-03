# Looks (ReelForge 2.0)

One **Style**, many **Looks** (PLAN.md phase 12, ADR-009).

- **Style** = what makes every frame of the film one film: the post-fx pass (palette LUT, Bayer
  dither, outline, vignette), the palette, the pixel fonts and (12.24) the shared sound treatment.
  It lives in `packages/engine` (`styles/<id>/`, `presets/`) and is never replaced by a look.
- **Look** = a family of kit content (environments, props, effects, shot templates) plus the docs
  the runtime Claude builds with, a sound palette id and a variation budget key. Every look renders
  through the same Style. Today only `voxel` (the 1.x kit, unchanged) is available.

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
  example project). Storyboard prompt, validator and scene-build prompt are byte for byte as
  before (fixtures in `packages/prompts/src/fixtures/`).
- `mixed` — new projects (`templates/project/project.json`). The storyboard prompt adds the roll
  definitions and the available looks; the validator adds the rhythm rules; the scene-build
  prompt gets the shot's look id and docs.

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

# ADR-006: Voxel kit foundation (PLAN 3.1)

Status: accepted (2026-10-02). Code: `packages/kit/src`; tests: `packages/kit/src/**/*.test.ts`,
`packages/kit/test/render/`; examples: `packages/kit/examples/k01_voxel_demo.js`,
`k02_voxel_stress.js`.

## Wiring: `ctx.kit` = `createKit({ three, palette, rng }).api`, one instance per shot

- The engine depends on the kit (not the reverse). `buildShot` creates the kit with the engine's
  Three namespace, the style palette and a kit-only seeded stream (`hash('kit', shotSeed)`), and
  **seals** it after `build()`: factories that create scene objects (`kit.voxel.mesh/group`,
  `kit.env/props/fx.*`) throw `kit-outside-build` in `update()`. Pure model helpers stay usable.
- The kit has no runtime imports of `three` (type imports only; enforced by eslint), so the
  bundle in the sandboxed engine frame uses exactly one Three instance (ADR-004). It is bundled
  into the frame via an esbuild alias, like `@reelforge/shared`.
- `KIT_VERSION` (= `packages/kit/package.json#version`, unit-tested) goes into the export cache
  key (4.7). Bump it whenever kit output can change pixels.

## Voxel models and colours

`VoxelModel = { size, data: Uint8Array (0 = empty, n = palette[n-1]), palette }`, plain data.
Palette entries are **ctx.palette names** (tokens like `hero`, `accent1`) resolved at mesh time,
so the same model recolours with the style (verified: demo goldens in 3 presets); `#rrggbb` is
allowed but discouraged; `{ color, glow: true }` = unlit (screens, neon, windows).
Authoring: `fromGrid` (string layers `top`/`front`, numeric `grid[y][z][x]`, sparse list),
`generate`, `box`, `extrude`, `mirror` (flip or join), `merge`, `recolor`, `speckle(rng)`.

## Rendering: greedy mesh by default, instancing for clouds and per-voxel animation

- **Greedy mesher** (Lysenko): faces keyed by colour + the 4 corner AO levels are merged into
  maximal rectangles; AO is the classic per-vertex rule (side/side/corner), baked into vertex
  colours (darkest = 55 % by default), diagonal flipped towards the odd corner. Flat-shaded
  `MeshLambertMaterial` (lit by the scene's lights) + `MeshBasicMaterial` for glow, one mesh,
  two groups. Deterministic (byte-identical buffers, tested).
- **InstancedMesh**: one cube per visible voxel (all voxels with `includeHidden`), colour x a
  per-voxel AO approximation from the 26 neighbours; `setVoxelTransform(i, { offset, rotation,
  scale })` for effects (3.4). Frustum culling off (instances move).
- `mode: 'auto'`: greedy, except models with > 4096 voxels averaging > 4 exposed faces each
  (sparse clouds that greedy cannot merge) -> instanced.

## Anchors and placement

Every kit result is a `KitObject` (a `THREE.Group` + methods): standard anchors `center/top/
bottom/front/back/left/right` from the filled bounds (groups: union of children), custom
anchors (grid coordinates for voxel meshes), `a.on(b, { at, align, offset })` parents `a` to `b`
and puts `a`'s `bottom` on `b`'s `top`; `b.mount(a, 'anchor')`; `dispose()`. Default voxel
size 0.125 (a 16-voxel sprite is 2 units, the hero's height), default pivot = bottom centre.

## Registry (3.2-3.4 fill it)

`defineEnv/defineProp/defineFx({ name, description, params: zod, anchors, build(params,
tools) })`; `kit.<ns>.<name>(params)` validates params (LLM-readable errors), gives each call
its own rng (`kind:name:callIndex`). `kitCatalog()` emits JSON Schema (zod `toJSONSchema`,
input side) + anchor docs + `VOXEL_API_DOCS` - the source for kit-docs/`docs/kit-catalog.md`.

## Performance (117k-voxel city, 640x360, full seek path incl. post-fx + readPixels)

| Backend | greedy (auto) | instanced |
|---|---|---|
| RTX 4050 Laptop, ANGLE D3D11 | **547 fps** | 389 fps |
| SwiftShader (CI) | 25 fps | 1.8 fps |

Greedy meshing of the 100k model takes ~0.2 s in build(). SwiftShader numbers are
informational (the CI test only asserts > 5 fps for greedy); the 60 fps preview target is
checked on the GPU with `REELFORGE_KIT_PERF_GPU=1`.

## Environments (PLAN 3.2)

`kit.env.*` = `sky`, `neonGrid`, `lights`, `desk`, `bench`, `room`, `blockCity`,
`floatingCubes`, `void` (code: `packages/kit/src/env/`; example: `examples/k03_envs.js`; contact
sheets: `pnpm test:render` -> `packages/kit/out/contact/envs-<style>.png`).

- Every environment is a KitObject with `update(t)` (pure; no-op when static) that scenes call
  from `update()`. Colours are chains "Crisp 640 swatch, other presets' swatches, token", so the
  reference look holds in Crisp 640 and every style still resolves (unit-tested on a tokens-only
  palette).
- **Backdrops write no depth.** The sky dome (`renderOrder -3`, no depth test) and the neon
  grid floor (`renderOrder -2`, depth test on, depth write off) draw first; the depth outline
  of the post pass would otherwise draw black rows where a far ground plane changes depth by
  more than the threshold per pixel row (beyond ~33x camera height) and a line at the horizon.
- Sky: a shader picks one of two palette colours per pixel with a 4x4 Bayer threshold
  (`gl_FragCoord`, low-res pixels), so the dithered bands are exact palette colours and
  survive the post pass; below the horizon the gradient mirrors back to the top colour.
- Neon grid: analytic lines in the fragment shader, widened to >= 1 px and dimmed by
  coverage (energy-preserving), so distant lines average into a glow band instead of
  breaking into dashes/moire; then faded into the horizon colour by camera distance (`fog`)
  and towards the disc edge.
- GPU (RTX 4050, full seek path): 641-1060 fps per environment; SwiftShader 36-42 fps.

## Props (PLAN 3.3, batch A)

`kit.props.*` = `calculator`, `bench` (school/exam desk + chair), `paper`, `laptop`, `monitor`,
`server`, `phone`, `folder`, `documentStack`, `cash`, `suitcase`, `lock`, `key`, `clock`, `globe`,
`mapTable`, `usbStick` (code: `packages/kit/src/props/`; example: `examples/k04_props.js`;
catalog: `pnpm kit:catalog` -> `docs/kit-catalog.md` + 160x90 thumbnails in `docs/kit-catalog/`).

- Authored with `Sketch` (named colour slots, boxes/cylinders/hand-drawn character patterns) ->
  `voxel.generate`; desk props at 1/32 unit per voxel, furniture (server, map table, school desk)
  at 1/16. Colours are the same "Crisp swatch, Noir swatch, Soft swatch, token" chains as the
  environments. Every prop has a `scale` param; seeded layouts use a `seed` param hashed per
  cell (same seed = same look in every shot, independent of call order).
- Animation hooks are absolute setters (`laptop.open(k)`, `lock.unlock(k)`, `folder.open(k)`,
  `clock.setTime(h, m, s)`, `globe.spin(a)`, `server.blink(t)/alarm(k)`, `mapTable.dropPins(k)`,
  `phone.screenOn(on)`) plus `update(t)`; the catalog documents them (`methods` in the registry).
- **Pixel screens** (calculator LCD, laptop, monitor, phone, server LEDs) are grids of unlit
  quads with vertex colours (`pixel-panel.ts`), set 0.15 voxel above the floor of a 1-voxel
  recess (no z-fighting, outline around the bezel). Content is a pure function
  `paintScreen(size, { mode, text, glitch, on, t, seed })` -> one of six colour roles per pixel
  (`off/back/ink/hot/cool/dim`), each screen mapping roles to palette colours, so screens stay
  palette-limited. Modes: blank, text (3x5 pixel font), doom, glitch, code, chart.
- Turntable test per prop (`test/render/kit-props.test.ts`): 0/90/180/270 degrees, not blank,
  four different views, seek determinism; one golden (`kit-props-sheet`, six props at half
  resolution). Unit tests check that every voxel part is connected or rests on its floor.
- GPU (RTX 4050): 20-prop animated gallery 316 fps; SwiftShader 34 fps.

## Props batch B: character, crowd, vehicles, buildings (PLAN 3.3)

`kit.props.*` += `character`, `crowd`, `car`, `van`, `truck`, `container`, `warehouse`,
`building`, `tower`, `house`, `drone` (example: `examples/k06_world.js` with setups `poses`,
`seated`, `variants`, `street`, `city`; render test `test/render/kit-world.test.ts`, golden
`kit-world-sheet`; turntables and catalog entries via `examples/k04_props.js`).

- **Character**: 24 voxels at 1/12 unit (2 units tall), faces +z. Eleven joints (kit groups,
  Euler order YXZ) carry six part models per look (torso, head, upper arm, forearm, thigh, shin);
  a pose is a flat record of joint angles + hip offsets, so `blend` is a per-key lerp and `mix`
  takes legs from one pose and the upper body from another. Clips (`stand`, `walk`, `sit`,
  `point`, `wave`, `typing`, `think`, `shrug`, `cheer`) are closed-form functions of local time;
  `walk(t, speed)` derives the stride from the swing amplitude (no foot sliding) and returns the
  distance for the scene to move the character. The `bottom` anchor stays at the feet; `seat`
  matches the kit chair (`character.on(bench, { at: 'seat', align: 'seat' })`); hand/face/head
  anchors follow the pose; `hold(prop)` parents a prop to a forearm joint.
- Default skin is the pale chain: in Crisp 640 the only warm swatch (`lightOrange`) reads as the
  hero's orange hoodie after quantisation; `skin: 'warm'` remains available.
- **Crowd**: every (look, body part) is one InstancedMesh over the character's greedy part
  geometry; each frame a bare template rig is posed per person and its joint matrices are copied
  (no history). Jittered grid layout (no overlaps), walking rows are lanes at one speed per lane
  (wrapping at the area edges), outfits/hair/lanes hashed from `seed`.
- Vehicles share the 1/12 voxel; wheels are groups rotated by `distance / radius`; buildings and
  towers use 1/2-unit voxels (3-unit storeys of 6 voxels, 1.5-unit window bays), warehouse and
  house 1/4, container 1/8 (it fits the truck flatbed `cargo` anchor). Lit windows are glow
  voxels picked by a hash of (seed, face, bay, storey).
- GPU (RTX 4050, full seek path): `city` (hero + 200-person crowd + 6 buildings + 2 vehicles)
  180 fps; SwiftShader 19 fps.

## Effects and 3D infographics (PLAN 3.4)

`kit.fx.*` = `shardExplosion`, `dissolve`, `glitch`, `flicker`, `counter`, `bars3d`, `nodeGraph`,
`timeline3d`, `mapAnimated`, `typewriterBlock`, `ticker`, `screenGlitch`, `label3d` (code:
`packages/kit/src/fx/`; examples: `examples/k05_fx_{objects,counter,charts,map}.js`, one setup
per effect selected by `const FX`; render tests: `test/render/kit-fx.test.ts`, contact sheets
`out/contact/fx-<style>.png`).

- Every effect is a KitObject with a pure `update(t)` (posed at t = 0 on creation). Timing is
  absolute (`start`/`end`/`at`, e.g. from `ctx.anchor`); physics and patterns are closed-form
  or hash-of-time-slot (shards: ballistic flight with a floor; glitch/flicker/screen bursts:
  `hash(floor(t * rate))`), so any t is posed without history and scrub order is irrelevant.
  Object effects also take `update(t, level)` to force progress/strength for one frame.
- Object effects (`dissolve`, `glitch`) replicate the voxel meshes of an object (or a bare
  model) as instanced meshes with hidden voxels, take the object's place in its parent and hide
  it. Glitch ghosts are two recoloured unlit copies offset left/right (chromatic split).
- Voxel text uses the kit's own 5x7 font (`fx/font.ts`, CC0; `bold` widens vertical strokes):
  labels are one greedy mesh, changing text (counter drums, typewriter, ticker) clones one
  template mesh per character. Label rows auto-fit their pitch and alternate between two rows
  (`fitLabelRow`) when they would get too small; node labels sit on dark plates in front of
  edges (`labelSide` above/below); map pin labels stack when they would overlap and lean back
  (`labelTilt`) for high cameras.
- Counter: one drum per digit (10 glyph meshes at 36 degrees, radius 1.8 x digit height) behind
  a bezel window that hides the neighbours rolling in; classic odometer carries; leading zeros
  blank; prefix floats next to the leftmost digit.
- Map: land masks per region (`europe` hand-traced [lon, lat] outline with `coords: 'lonlat'`;
  `generic`/`islands` = seeded value noise thresholded at a fixed land share), heights coast /
  land / hills, water grid; route = trail of cubes, pins drop when the route passes them.
- Screens: `glitchPixels(base, t, level, seed)` over the minimal `ScreenPixels` buffer
  (`{ columns, rows, data: palette indices }`) is exported for any screen; `screenGlitch` is a
  standalone panel that shows it.
- Eight half-resolution goldens (`kit-fx-*`), seek determinism of every setup in the harness,
  unit tests of the math (shard positions, counter wheels/format, bar heights, edge/milestone
  timing, land shares, glitch/flicker ranges) and of pose determinism per effect.
- GPU (RTX 4050, full seek path): 277-774 fps per setup (lowest: node graph); SwiftShader
  19-35 fps.

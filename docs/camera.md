# Cinematic camera moves (PLAN 12.28)

Four deterministic moves on `ctx.camera` for scenes: **rack focus** (focus pull with
ordered-dither bokeh), **dolly zoom**, **orbit** and **layered parallax**. They render through the
normal Crisp 640 pipeline (same post pass, same palette LUT) in preview and export alike.
Decision record: `docs/decisions/ADR-013-camera.md`. Reference for scene authors:
`reelforge kit-docs camera`; when to use which move: the "Camera moves" section of each
`styles/<id>/STYLE.md`.

Code: `packages/engine/src/camera/moves.ts` (math), `move-options.ts` (validation),
`move-layer.ts` (per-shot apply/restore), `bokeh.ts` (CoC + tap table, CPU reference),
`camera-api.ts` (`ctx.camera`), `gl/bokeh-shader.ts` + `gl/post-shader.ts` (bokeh variant of the
post pass), `gl/composite-pass.ts` (program switch), lint rule `lint/camera-rules.ts`.
Example: `packages/engine/examples/s03_camera.js` (one voxel room, a 3 s act per move).

## How a move works

Moves are immediate mode, like `ctx.text`: call them in `update(t, state, ctx)` every frame,
after setting the base pose (a rig, `ctx.camera.set`, or a pose set once in `build`):

```js
export function update(t, state, ctx) {
  ctx.camera.pushIn({ dist: [7, 5], target: [0, 1, 0] })(t);          // base pose
  ctx.camera.rackFocus({ from: state.laptop, to: state.hero, t0: state.hit, t1: state.hit });
  ctx.camera.orbit({ degrees: 40, t0: 1, t1: 4 });                     // on top of the push-in
}
```

After `update` returns, the shot applies the frame's moves on top of that pose in a fixed order:
orbit(s) → dolly zoom → parallax(es) → ambient camera drift (PLAN 12.8) → focus. Before the next
`update` everything a move changed (camera position, orientation, fov; positions of parallax
layer objects) is restored, so a frame is a pure function of `t` whatever was rendered before.
Frames without any move are untouched (byte-identical to before 12.28).

- `t0`/`t1`: local seconds or an anchor from `ctx.anchor()` (resolve it in `build`). As `t0` an
  anchor counts from its start, as `t1` until its end, so `{ t0: hit, t1: hit }` spans the
  phrase. Before `t0` a move holds its start, after `t1` its end. `ease` defaults to
  `easeInOutCubic`. Every call returns `{ progress }` (eased, 0..1).
- Subjects/targets: `[x, y, z]` or an object (its world bounding-box centre). The default pivot /
  subject is the look-at target of the last pose set through `ctx.camera` (set or rig).
- Several calls: one rack focus and one dolly zoom hold a frame — the latest started by `t`
  (else the first to start), so sequential pulls chain; orbits and parallaxes add up.
- Calls in `build` throw `camera-move-outside-update`; invalid options throw
  `invalid-camera-move` with what to pass instead.

| Move | Options | What it does |
| --- | --- | --- |
| `rackFocus` | `from`, `to` (distance in units, point or object), `t0`, `t1`, `ease?`, `bokeh?` = 3 | Focus distance (along the view axis, measured with the final camera) goes from→to; everything else blurs by its circle of confusion. |
| `dollyZoom` | `from`, `to` (distance to the subject), `t0`, `t1`, `subject?`, `ease?` | Camera moves along its view axis so the subject is `from`→`to` away; the fov is set so the subject's plane keeps its size and place (`d·tan(fov/2)` constant, fov clamped to 1–160°). |
| `orbit` (with `t0`) | `degrees`, `t0`, `t1`, `axis?` = `'y'`, `radius?`, `target?`, `ease?` | Turns the pose's position and orientation around the pivot: `'y'` turntable, `'x'` arc over the subject (positive rises), or a world axis. With `radius` the camera first moves to that distance. The old rig `orbit({ radius, degrees: [a, b] })(t)` is unchanged. |
| `parallax` | `amount`, `t0`, `t1`, `layers?`, `ease?` | Camera travels `amount` units along its right axis (negative = left). A layer member moves with the camera by `(1 − ratio)·travel`, so it shows `ratio` × its natural parallax: 0 pinned to the frame (far sky), 1 natural, 2 a foreground racing past. Layers: `{ kit: 'floatingCubes' \| 'env' \| 'prop' \| 'fx' \| <kit name> }`, `{ objects: [...] }` or `{ near?, far? }` (top-level scene objects whose origin lies at that distance); objects with lights inside (`kit.env.lights`, `kit.fx.flicker`, diorama sets) are never moved. First matching layer wins. |

## Moves as pattern interrupts

A `scale-shift` / `perspective-shift` interrupt (PLAN.md#12.25) is realised with these moves, and
it must keep the subject readable (real run v2.3: a dolly zoom ending in an unreadable close-up,
an orbit over unlabelled floating cubes). Rules, in the interrupt directive of the scene-build
prompt (v10), the project template's `CLAUDE.md` and checked statically by the scene QA
(`packages/stages/src/scenes/source-checks-camera.ts`, warnings, no fix turn):

- one subject framed whole and named on screen (`ctx.annotate.callout/pin/label` with text, or a
  `ctx.text` card; a badge's number alone does not count);
- dolly zoom: literal `from`/`to` within 2x (`MAX_DOLLY_ZOOM_RATIO`), e.g. 6 → 3.5;
- orbit (the move form with `t0`): at most 45° (`MAX_INTERRUPT_ORBIT_DEGREES`);
- rack focus / orbit move between labelled objects.

Computed distances and angles are not judged; shots without an interrupt are not checked.

## Dither bokeh

The post pass has a second program, compiled on the first frame that has a focus; frames without
a focus keep using the original program (identical shader source, so every pre-12.28 golden is
unchanged). Per layer (outgoing/incoming shot of a transition separately):

1. View depth `z` from the depth buffer (the same linearized depth the AO and outline read).
2. Integer CoC radius `r = floor(min(6, bokeh · |z − focus| / min(z, focus)))`: `bokeh` pixels at
   twice or half the focus distance, 0 inside the depth of field.
3. `r = 0` → the pixel is exactly what the base program computes (AO + outline). `r ≥ 1` → the
   pixel takes the colour of one neighbour: the tap of radius `r` indexed by the pixel's rank in
   the 4×4 Bayer matrix (16 integer offsets per radius on a golden-angle spiral). A 4×4 block
   thus samples the whole disk once: edges dissolve into an ordered dither of the neighbouring
   colours, flat areas stay flat.
4. A tap clearly nearer than the pixel (`zq < 0.97 z`) and too sharp to reach it is rejected, so
   in-focus silhouettes stay crisp over a blurred background.
5. Text overlays are composited after the bokeh (always sharp); the dither and palette LUT run
   as usual, so every pixel is a palette colour (`vibeGuard` passes).

Limits: backdrops that write no depth (`kit.env.sky`, `kit.env.neonGrid`) count as infinitely
far; a style without depth effects (no AO and no outline) ignores the focus; a blurred
foreground does not spill over a sharp background (its edge erodes instead).

## Tests

- Unit: `packages/engine/src/camera/{moves,bokeh,move-layer}.test.ts` (dolly zoom keeps the
  subject within 1 px, orbit radius, parallax ratios, seek-order determinism with and without the
  ambient drift, restore, errors), lint `camera-api` cases in `lint/lint-scene.test.ts`.
- Render (SwiftShader): `packages/engine/test/render/camera.test.ts` — goldens
  `camera-<rack-focus|dolly-zoom|orbit|parallax>-<start|end>` (act start + 0.5 s and + 2.8 s),
  vibe guard on each, seek-order determinism, and a focus whose CoC is 0 everywhere is
  byte-identical to no focus.
- Performance: `packages/engine/test/render/camera-perf.test.ts` measures each move on the
  example room through the full harness seek path. SwiftShader: informational floor (> 2 fps).
  Hardware GPU: `REELFORGE_ENGINE_PERF_GPU=1 pnpm test:render packages/engine/test/render/camera-perf.test.ts`
  requires ≥ 30 fps per move. Numbers: `packages/engine/out/perf/camera-moves.json`.

## Lint

Rule `camera-api` (error): `ctx.camera.<member>` must be one of `object, set, dolly, orbit,
pushIn, crane, lookAt, shake, rackFocus, dollyZoom, parallax` (e.g. `ctx.camera.fov = 30` or
a guessed `ctx.camera.zoom()` is reported; the Three.js camera is `ctx.camera.object`). The
moves themselves pass the determinism rules: they are plain calls in `update` with values
computed from `t`.

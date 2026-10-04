# ADR-013: Cinematic camera in pixel art (PLAN 12.28)

Status: accepted (2026-10-04). Code: `packages/engine/src/camera/{moves,move-options,move-layer,
bokeh,camera-api}.ts`, `contract.ts`, `shot.ts`, `gl/{bokeh-shader,post-shader,composite-pass,
frame-renderer}.ts`, `errors.ts`, lint `lint/camera-rules.ts`; docs `docs/camera.md`,
`reelforge kit-docs camera` (`packages/cli/src/commands/ctx-docs.ts`), "Camera moves" in
`styles/*/STYLE.md`. Tests: `packages/engine/src/camera/*.test.ts`,
`packages/engine/test/render/camera{,-perf}.test.ts` (goldens `camera-*`).

## Context

Version 2.2 (direction and drama) needs camera language beyond the rigs of 2.4: a focus pull
between two subjects, the vertigo dolly zoom for a twist, orbits on top of a framed pose and
layered parallax for establishing shots. Pattern interrupts (12.25) and climax reveals (12.27)
will use them. They must stay pure functions of `t`, look like pixel art (no smooth blur, palette
only), work in preview and export alike, and not change any existing film.

## Decisions

- **Moves modify the scene's pose, immediate mode.** Scenes call the moves in `update` (like
  `ctx.text`); the shot applies them after `update`, before the ambient drift, and restores the
  camera, fov and moved objects before the next `update`. Rigs produce whole poses; moves compose
  with them (a push-in plus an orbit plus a rack focus). The default pivot/subject is the target
  of the last pose set through `ctx.camera`.
- **Anchors as times.** `t0`/`t1` take seconds or `ctx.anchor()` hits (`t0` = start, `t1` = end
  of the phrase), so moves land on words like annotations do.
- **`orbit` overloaded, not renamed.** `orbit({ radius, degrees: [a, b] })` stays the rig; an
  options object with `t0` is the move. Existing scenes see no change; the packet's API name is
  kept.
- **Dolly zoom along the view axis.** Moving along the camera's forward axis and setting
  `fov = 2·atan(D·tan(fov₀/2)/d)` keeps the whole subject plane fixed on screen (not only its
  centre). `from`/`to` are distances to the subject; one dolly zoom holds a frame (the latest
  started), so sequential ones chain instead of fighting.
- **Parallax = lateral travel + per-layer counter-motion.** A member of a layer with ratio `r`
  moves with the camera by `(1 − r)·travel`: its screen motion is exactly `r` × natural. Layers
  by kit kind/name, explicit objects or depth bands. Objects containing lights are never moved
  (that would change the shading, not the parallax).
- **Ordered-dither bokeh instead of blur.** An out-of-focus pixel copies one neighbour inside its
  integer circle of confusion, picked by its 4×4 Bayer rank from a golden-angle tap table; no
  colour is averaged, the existing dither + palette LUT still run, so frames stay on the palette
  and crisp. The CoC is relative to the nearer of depth and focus (`bokeh` px at 2× / 0.5× the
  focus distance): a thin lens barely blurs the 2–10-unit depth range of voxel sets. Taps that
  are clearly nearer and sharp are rejected so in-focus silhouettes stay clean.
- **Second shader program, chosen per frame.** The bokeh lives in a variant of the post shader,
  compiled on the first focused frame; unfocused frames keep the original program (identical
  source), so existing goldens and exports are byte-identical. A zero CoC in the variant gives
  the same bytes as no focus (tested). Bokeh needs the depth texture: styles without AO/outline
  ignore the focus rather than changing their render targets.
- **Lint `camera-api`.** Scenes may only use the `ctx.camera` members; anything else is reported
  (the Three.js camera stays reachable as `ctx.camera.object`).

## Consequences

- Scenes can stage focus pulls, vertigo, orbits and parallax with a few lines; 12.25/12.27 can
  plan them without new engine work. Nothing uses them automatically yet.
- Focused frames cost one extra tap (`shadeBase` + two depth reads) per blurred pixel and a
  one-time shader compile.
- Not built: bokeh spill of a blurred foreground over a sharp background (needs a scatter pass),
  depth for backdrops that write none (sky, neon grid count as infinitely far), storyboard/UI
  fields for moves.

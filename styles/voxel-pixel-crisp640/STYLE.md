# Style: Voxel Pixel · Crisp 640

Default style. Renders at 640×360, integer-upscaled ×3 to 1080p. Chunky voxel props, flat shading, hard pixels, Bayer dithering. The mood of a retro-futuristic explainer: neon on dark, one hero object per shot, clear and a little playful.

## Look
- **Palette (use tokens, never raw hex):** background `sky`/`ground`/`groundAlt` in navy and violet; neon accents `accent1–4` (magenta, violet, teal, green); hero object `hero` (orange) with `heroTrim`; cream/white only for `text`. Shading ramps exist for orange (orange → burnt orange → rust) — rely on lighting, don't recolour by hand.
- **Max 5 colours per shot** that read as "design" colours (plus automatic shading). One accent colour carries the shot's idea; the rest stays dark.
- **Backdrops:** dithered dusk/night sky + `kit.env.neonGrid` horizon, or a dark void with `floatingCubes`; indoor shots use `kit.env.room`/`desk`/`bench` with a single strong light accent.
- **Lighting:** `kit.env.lights({ preset: 'default' | 'neon' })`. Use `neon` when the hero is orange on violet.

## Composition
- One hero object per shot, placed on a third (rule of thirds), with clear depth: foreground element, hero, background grid/skyline.
- Keep the hero ≥ 20 % of frame height; leave negative space on the side where text goes.
- Low horizon for power/scale; tilted-down camera for "overview/data" shots.

## Camera
- Never static longer than 3 s. Default: slow `pushIn` (distance ×0.6 over the shot) or `orbit` ≤ 25°. Use `crane` for reveals, `shake` only for impacts (≤ 0.4 s, decays).
- Always `lookAt` the hero; ease with `easeInOutCubic`; no moves faster than one shot-width per second.

## Camera moves (`reelforge kit-docs camera`)
- **Rack focus** (`ctx.camera.rackFocus`): to move attention between two things at different depths (the object, then the person reacting; a detail, then the big picture). Pull over 0.8–1.5 s on the spoken word (`t0: hit`), `bokeh` 2–3, then hold the new focus ≥ 1 s. Keep foreground and subject at least 2x apart in distance or the blur will not read.
- **Dolly zoom** (`ctx.camera.dollyZoom`): only for a realization or shock beat (the twist, "this changes everything"), 1.5–2.5 s, at most once every ~2 minutes; subject centred, with a deep set behind it (room, city) so the background visibly stretches.
- **Orbit move** (`ctx.camera.orbit({ degrees, t0, t1 })`): ≤ 60° over ≥ 2 s to reveal the hero object from another side.
- **Parallax** (`ctx.camera.parallax`): establishing shots and B-roll; `amount` 1–3 units over 2–6 s; foreground debris `ratio` 1.5–2, far backdrops 0.3–0.6.
- **Max duration:** rack focus and dolly zoom ≤ 3 s; orbit and parallax ≤ the shot. One cinematic move at a time (parallax + rack focus may overlap).
- **Never during annotations that point at moving targets:** while an orbit, dolly zoom or parallax moves a target across the frame, do not point at it (`arrow`, `pin`, `callout`, `ring`); start the mark after the move's `t1`, or point at a fixed screen region. A rack focus is fine while the mark's target is the one in focus.
- Moves modify the pose you set: set the base pose (`set` or a rig) first in `update`, then call the move. Backdrops without depth (`kit.env.sky`, `neonGrid`) count as infinitely far for the focus.

## Typography
- `ctx.text.title` for the one-line headline (capitals, chunky display font, scale 3–4); `ctx.text.lowerThird` for names/sources; at most two text levels per shot; ≥ 5 % safe margin; never over busy geometry without a plate.
- Numbers on screen: prefer `kit.fx.counter` over text. Keep any line ≤ 28 characters at scale 3.

## Pacing
- New visual pattern at least every 6–8 s; never three shots in a row with the same treatment. Impact moments (a number, a reveal) land exactly on the spoken word via `ctx.anchor`, with a matching `sfx.at`.
- Enter/exit animations 0.25–0.5 s; hold the key visual ≥ 1 s before cutting.

## Annotations (`ctx.annotate`, `reelforge kit-docs annotate`)
- **Sizes:** strokes 2 px (default), label text scale 2 (names, pins, callouts), stamps scale 3; arrows ~0.2 of the frame height long; rings fit the target (whole object) or `radius: 0.06–0.1` around an anchor.
- **Colours:** defaults are tuned for this palette — teal `accent1` for arrows/pins/callouts/brackets, magenta `accent2` for rings, underlines and stamps, `accent4` marker highlights, `accent3` check badges; the dark 1 px `outline` rim keeps them readable over any background. One annotation colour per shot besides the text.
- **Density:** 0–2 marks per shot, at most ~8 per minute; one label on screen at a time; show a mark on its spoken phrase (`phrase:`) and take it off within 2–4 s unless it carries the whole shot.
- **Don'ts:** no mark over the hero for long (point at it from the free side), no stacked labels, no arrow + ring + spotlight on the same thing, no mark whose target is off screen, never the same form 3 times in a row.

## Avoid
Pure black or pure white fills, more than ~4 simultaneous moving things, text smaller than scale 2, hand-picked hex colours, static wide shots, objects clipping through each other, scenes that need > 250 lines (build a kit prop instead and say it is missing).

## Ambient variation budget (`variation.voxel` in the engine preset)
When `project.json` has `"ambientVariation": true` (new projects), the environments of voxel shots drift from shot to shot — deterministically, from the project seed and the shot's place in the storyboard (index, act, roll); neighbouring shots always differ. Off (field missing, e.g. older projects) = every shot exactly as authored.
- **Tones (palette families only):** black→navy; navy→indigo; indigo→purple/navy; purple→indigo/violet; violet→purple/wine; magenta→pink/violet; pink→magenta; slateBlue→teal/navy; teal→slateBlue/brightTeal; brightTeal→teal; lightOrange→orange/tan; slateGrey, darkSlate→midSlate. About 35 % of the families swap in a shot; within one act and roll a family always swaps to the same member. Hero, text and accent tokens never change.
- **Ranges (scale 1):** horizon −0.06…+0.08, grid cell ×0.8…1.25, grid fade ×0.85…1.2, light turn ±24°, light elevation ±8°, debris/stars ×0.75…1.3, camera drift ≤ 1.2° yaw / 0.5° pitch over the shot, 5 levels per axis.
- **Scenes:** do not hard-code the same background in every shot and do not re-implement variation by hand — the kit environments (`sky`, `neonGrid`, `lights`, `floatingCubes`, `void`, `blockCity`, `room`) vary automatically. Colours you pass explicitly (`colors`, `lineColor`, `wall`…) are kept as given, so leave them at their defaults unless the shot needs a specific colour. A scene that paints its own background can follow the shot with `palette[ctx.ambient.tone('<swatch>')]`; `ctx.ambient.enabled` / `ctx.ambient.params` are read-only.

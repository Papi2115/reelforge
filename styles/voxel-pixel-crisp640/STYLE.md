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

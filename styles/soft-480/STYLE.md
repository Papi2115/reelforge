# Style: Soft 480

Warmer and friendlier. Renders at 480×270 (bigger pixels, ×4 to 1080p). Rose/plum/sage/peach palette, softer dithering, gentle contrast. For lifestyle, history-with-heart, education, "story of an invention" videos.

## Look
- **Palette (tokens):** `sky` plum/rose gradient, `ground` clay/taupe, `accent1–4` sage, peach, coral, denim; `hero` warm orange; `text` cream; the plate behind lower thirds is warm brown (`umber`).
- **Max 5 colours per shot**, balanced warm vs. one cool accent.
- **Backdrops:** dawn/dusk `sky`, `room`, `desk`, `blockCity` by day, gentle `floatingCubes`. Prefer `lights({ preset: 'soft' })`.

## Composition
- Centred or gently off-centre, generous margins, rounder forms (characters, globes, clocks). Clear foreground/background separation by colour temperature.
- Pixels are 33 % larger than Crisp 640: keep silhouettes simple, avoid fine detail < 2 voxels.

## Camera
- Calm: slow `orbit` ≤ 15°, soft `pushIn`, `crane` reveals. `shake` almost never.

## Typography
- Display font at scale 2–3 (the frame is smaller); at most two levels; ≥ 5 % safe margin; keep lines ≤ 22 characters.

## Pacing
- Relaxed: 5–9 s shots, new pattern every 7–10 s; transitions mostly crossfade/wipe 0.4–0.6 s. SFX soft: pop, click, tick; light ambience; warm music beds.

## Annotations (`ctx.annotate`, `reelforge kit-docs annotate`)
- **Sizes:** the frame is small — labels at scale 2 are already big here; keep labels ≤ 2 words, callout text ≤ 6 words (`maxWidth` 0.4). Prefer `curve: 'curved'` arrows and `corner: 'round'` callouts (softer).
- **Colours:** sage `accent1` for arrows/pins/callouts, peach `accent2` rings/underlines, rose `accent4` highlights; the warm `umber` plate behind labels. Avoid red stamps — a stamp is rare here (once per video, as a wink).
- **Density:** 0–1 mark per shot, at most ~6 per minute; calm `fade`/`draw` entries; `pulse: false` on rings when the shot is very quiet.
- **Don'ts:** no spotlight dimming (it turns the warm palette muddy) except for one big reveal, no glitchy or shaking marks, no labels over faces/characters.

## Avoid
Harsh red/black contrast, glitch effects (except as a single joke), fast camera moves, tiny text, clutter. If the olive horizon band of the teal grid shows, switch to the rose/plum sky.

## Ambient variation budget (`variation.voxel` in the engine preset)
When `project.json` has `"ambientVariation": true` (new projects), the environments of voxel shots drift from shot to shot — deterministically, from the project seed and the shot's place in the storyboard (index, act, roll); neighbouring shots always differ. Off (field missing, e.g. older projects) = every shot exactly as authored.
- **Tones:** dusk→denim/plum; plum→dusk/mauve; mauve→plum/rose; rose→mauve/clay; coral→peach/clay; peach→sand/coral; denim→dusk/cornflower; cornflower→denim/ice; ice→cornflower; olive→sage; sage→olive/mint; stone→pebble/taupe; umber→brown. `night` (the darkest floor) never changes. About 35 % of the families swap in a shot.
- **Ranges (scale 1):** horizon −0.06…+0.08, grid cell ×0.8…1.25, grid fade ×0.85…1.2, light turn ±24°, light elevation ±8°, debris/stars ×0.75…1.3, camera drift ≤ 1.2° / 0.5°, 5 levels per axis.
- **Scenes:** do not hard-code the same background in every shot and do not re-implement variation by hand — the kit environments (`sky`, `neonGrid`, `lights`, `floatingCubes`, `void`, `blockCity`, `room`) vary automatically. Colours you pass explicitly (`colors`, `lineColor`, `wall`…) are kept as given, so leave them at their defaults unless the shot needs a specific colour. A scene that paints its own background can follow the shot with `palette[ctx.ambient.tone('<swatch>')]`; `ctx.ambient.enabled` / `ctx.ambient.params` are read-only.

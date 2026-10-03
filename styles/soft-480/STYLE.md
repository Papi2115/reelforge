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

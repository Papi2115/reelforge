# Style: Noir Voxel

For true-crime, espionage, heists, manhunts. Same 640×360 voxel engine, but low-key: mostly shadow, a single motivated light, red and amber accents, dense dither. Serious, tense, never cute.

## Look
- **Palette (tokens):** near-black `sky`/`ground`; accent colours from `accent1–4` are red, amber/copper and bone; `hero` is the thing that matters (a document, a phone, a face-less figure) lit by the `keyLight`. `text` is bone-white; the lower-third plate is dark blood red (`shadow`) — keep red-on-red text out.
- **Max 4 colours per shot.** Let 60–70 % of the frame fall into shadow.
- **Backdrops:** `kit.env.room` with one lamp, `blockCity` at night, `void` with sparse shards; rain/smoke overlays are not available yet — suggest atmosphere with `fx.flicker`, slow drifting `floatingCubes` (as dust) and dark fog on the grid.
- **Lighting:** `kit.env.lights({ preset: 'noir' })` or `dramatic` (rim light). One hard key, no fill. Flicker a light (`fx.flicker`) only to punctuate a reveal.

## Composition
- Off-centre subject, large negative space, strong silhouettes. Foreground occluders (a doorframe, a desk edge) to create voyeuristic depth.
- Low camera for threat, high camera for surveillance/map views.

## Camera
- Slower than Crisp 640: `pushIn` over the full shot, `dolly` along corridors, occasional `shake` on violence or error. Never whip. Hold still only with a tiny drift (≤ 1°).

## Typography
- Sparse. Titles only for chapter beats, dates and names (`lowerThird` with plate). Typewriter reveals (`fx.typewriterBlock`) for documents and transcripts. Redaction-style bars are a good motif.

## Pacing
- Longer holds (4–9 s) with tension builds; cut on a sound. Use `sfx` low hits, tick, typewriter, glitch; ambience hum/room under everything.
- Evidence moments: slow push on the object, then the key number/name lands on its spoken word.

## Annotations (`ctx.annotate`, `reelforge kit-docs annotate`)
- **Sizes:** thin and precise: strokes 1–2 px (`thickness: 1` for pins and dimension lines), labels scale 2 on the dark `shadow` plate; stamps scale 3 for evidence ("CLASSIFIED", "CONFIRMED", "REDACTED").
- **Colours:** red `accent1` for arrows/pins/callouts (evidence board), amber `accent2` for rings and stamps; at most one red mark per shot. `spotlight` is the signature move here — dim everything but the clue.
- **Density:** sparse, 0–1 mark per shot, at most ~5 per minute; marks arrive on the key word and hold; `square` corners and `elbow` arrows read as case files.
- **Don'ts:** no bouncy pops (`enter: 'draw'` or `'fade'` instead of `'pop'`, `bounce: false` on arrows), no colourful badges, no marks on bright areas without a plate.

## Avoid
Bright backgrounds, neon violet/teal, bouncy easing (`easeOutBack`), cartoon characters in comedic poses, more than one red element per shot, text over bright areas without a plate.

## Ambient variation budget (`variation.voxel` in the engine preset)
When `project.json` has `"ambientVariation": true` (new projects), the environments of voxel shots drift from shot to shot — deterministically, from the project seed and the shot's place in the storyboard (index, act, roll); neighbouring shots always differ. Off (field missing, e.g. older projects) = every shot exactly as authored.
- **Tones:** black→ink; ink→charcoal/black; charcoal→ink/slate; slate→charcoal/steel; steel→slate/fog; ash→fog; bloodDark→blood; blood→bloodDark/red; tealDark→teal/ink; teal→tealDark; ember→brown/copper. About 30 % of the families swap in a shot.
- **Ranges (scale 1):** horizon −0.05…+0.06, grid cell ×0.85…1.2, grid fade ×0.9…1.15, light turn ±18°, light elevation ±6°, debris/stars ×0.8…1.25, camera drift ≤ 0.8° / 0.3°, 5 levels per axis. Kept tighter than Crisp: the noir mood relies on its low key.
- **Scenes:** do not hard-code the same background in every shot and do not re-implement variation by hand — the kit environments (`sky`, `neonGrid`, `lights`, `floatingCubes`, `void`, `blockCity`, `room`) vary automatically. Colours you pass explicitly (`colors`, `lineColor`, `wall`…) are kept as given, so leave them at their defaults unless the shot needs a specific colour. A scene that paints its own background can follow the shot with `palette[ctx.ambient.tone('<swatch>')]`; `ctx.ambient.enabled` / `ctx.ambient.params` are read-only.

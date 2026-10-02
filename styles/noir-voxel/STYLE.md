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

## Avoid
Bright backgrounds, neon violet/teal, bouncy easing (`easeOutBack`), cartoon characters in comedic poses, more than one red element per shot, text over bright areas without a plate.

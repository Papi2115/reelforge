# C + c-plus camera - "Would You Survive as a Samurai in Peaceful Japan?"

Film: `showcase.html` (62.0 s, 11 shots, same script, beats, captions, cast, faces, sets, light and grit as `../c-base`).
Proof: `proof/sheet.png` (every framing of every shot, incl. each cut inside a shot), `proof/turnarounds.png`.

## The one change: camera work (ported from c-plus, nothing else)
- `ST.camera(ctx, cx, cy, z, tilt)` - c-plus camera with Dutch roll (rotate before scale), in `js/brushes.js`.
- `js/camera.js`: `ST.cutCam(ctx, t, cuts)` / `ST.cutFrame(t, cuts)` - a shot lists framings `[at, end, a, b]`
  (frame = [cx, cy, zoom, tilt]); each framing is a hard cut at a beat, moving a -> b inside it (push-in, pull-back,
  pan). Cut choice runs on twos; returns the framing index so a shot can stage per framing (OTS body, silhouette).
- Contacts are solved in world space before the camera is set (coin exchange palms, bale hand-over, bow pivots,
  scabbard bump, cat on the sword); the camera only frames those points. Shot 8 palms still meet within 1.3 px.
- Vocabulary used: ECUs (gleam, CLACK, coins, YOU heading, hat at the toe), close-ups, push-ins/pull-backs, low and
  tilted framings (dream blades, street turn, rice weight, panic, Elder's fury), over-the-shoulder (ledger), foreground
  silhouette (market passer-by), off-centre framing, one focal point per framing.

Not ported: c-plus key/rim light, vignette, face system, briefs, grime, line weight, doubled strokes, rig changes.
Player/tools/URL hooks as in c-base (Up/Down = next/previous shot, `?t=&paused=1&captions=0`).

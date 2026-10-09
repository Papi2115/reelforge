# c-cam - "How not to choose a pope" in style C + c-plus camera work (one change only)

Same film as `../c-base/` (cast, faces, grit, light, engine, script, shots, beat timing, hard cuts between shots).
Only the camera changed. Film: `showcase.html` (63.0 s, 12 shots, 37 camera setups). Dev: `test.html`.
Proof: `proof/sheet.png` (shot start, the middle of every in-shot cut, shot end), `proof/turnarounds.png`.

## Camera machinery (ported from the c-plus films, camera only)
- `ST.camera(ctx, cx, cy, z, rot)`: optional roll in degrees (Dutch tilt), as in c-plus `brushes.js`.
- `js/camera.js`: `ST.cut(t, list)` = hard cuts inside a shot (each shot has `cuts: [[time, name], ...]`, beat times
  unchanged); `ST.fg` = flat dark foreground silhouette in screen space; `ST.fgArm` = an accusing arm at the lens.
- Grips stay correct under any camera: contact points are solved in world space before the camera is applied
  (`ST.palmWorld`: keyhole under the key, ladder under the hand, loaf landing where the baker's palm lets go).
- Not ported: key/rim light, vignette, c-plus faces, briefs, grime or line changes, rig changes.

## Grammar used
One focal point per setup, off-centre; wide -> close-up -> extreme close-up cut-ins; push-ins (zoom keys) and one
pull-back; low angles on the Mayor and the Stubborn Cardinal, high/wide on the hall; over-the-shoulder (reader's
back); foreground silhouettes (crowd backs, chair back, door jamb, shoulder, street corner, arms); 2-8 deg roll only
on tense beats (bell, shouting, roof, grille, refusal). Keys as in c-base (Up/Down = shot, `?captions=0`).

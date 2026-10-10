# Style C + c-plus camera - "Would You Survive Landing on the Moon?" (Apollo 11)

Film: `showcase.html` (63.0 s, 13 shots). It is `../c-base/` with ONE change: the camera work from c-plus.
The characters, faces, lighting, grit, line weight, rig, script, shot list, beat timing, captions and hard cuts
between shots are all the same as c-base. Dev: `test.html`. Proof: `proof/sheet.png` (start/mid/end of every shot),
`proof/cuts.png` (one frame per cut-in), both 1440 px wide.

## Camera machinery (ported from c-plus)
- `ST.camera(ctx, cx, cy, z, rot)` (c-plus signature, `rot` = Dutch tilt deg, `js/brushes.js` +1 line); `js/camera.js`: `ST.cutCam(ctx, t, cuts)` = hard cuts INSIDE a shot. A shot is a list of framings
  (`at`, `x`, `y`, `z`, `rot`); each value is a number or `ST.key` frames for a push-in, pull-back or drift. It returns
  the active cut index so a shot can restage (e.g. a reverse angle). `ST.fgShape` = a flat near-black silhouette in the
  foreground.
- The camera is applied before anything is drawn. Every hand target, grip and prop contact is still solved in world
  space (`ST.reachTo`, palms), so contacts hold in every framing (checked in all cut-ins).

## Rules used
One focal point per cut, faces off-centre, CU/ECU on gag beats. Dutch tilt (3-6 deg) is used only in tense beats (alarm, 1202, boulders, fuel, the dent). A pull-back is used for
loneliness (orbit). Low angles are used for the landing and the pad. Foreground silhouettes: the door edge (pad), a
console and an engineer's shoulder (control), your helmet (over-the-shoulder at the window). No c-plus lighting,
faces, briefs or line changes.

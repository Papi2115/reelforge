# What changed vs the five c-plus films (12-16) - root causes A-F, fix, evidence
Kept: camera (Dutch tilt, push-ins, cuts in a shot), one hard key + rim per shot, stepped vignettes, line weight,
wandering ink, scratchy hatching, palette, the doubled stroke on heads/torsos/props. Evidence: `proof/validate.log`
(ALL GREEN: 948 anchor, 1566 connectivity, 12394 tangle, 192 continuity, 601 contact checks), `proof/before-after-*`
(left = each film's own engine + character, right = this engine + the port).

**A. Anchors disagreed with the drawing.** Shoulders were set by hand, the tilt (`D.tilt`/`shY`/`shy`) moved only the
solver, shoulders sat at or above the real chin (old sy vs measured chin: Captain -480 vs -442, Senator -420/-426 vs
-398, Laundromat Owner -404 vs -380, You -562 vs -563) so arms grew out of jowls/wattles; NECK fed the layering.
Fix: `ST.defineCharacter` computes `anchors(view, pose)` once; the torso is drawn through `ST.torso` / `A.fit` (tilt
applied once to both); the head box and chin are MEASURED from the head drawing; arm layering uses the real chin.
Shoulders of the ports moved down/out (Captain 84/-430, Senator 112/-380, Owner 70/-368, You 58/-540).
After: drawn shoulder vs arm root 0.00 px in every view x pose; all roots inside the torso and 2.6-72 px below the chin.

**B. Face guard off / jumpy.** Touch gestures set `D.head = null` (whole body unguarded, film 13) or forced layer 2
(film 14); `guard()` snapped hands across the box edge. Fix: `ST.touch(side, 'chin'|'cheek'|...)` = a palm target on
the head's own face points (jaw-aware), only that hand unguarded and in front; the guard is continuous (exit along a
ray from the far edge, reach-aware: targets are pulled into reach first, so IK never clamps a hand back onto a face).
After: hand step / target step across the guard box edges 169x (old) -> 4.8x; face-contact palms within 0.02 px.

**C. Doubled stroke on every limb.** `ST.blob`'s loose 2nd contour hit every `ST.tube` (arms, legs, fingers, feet). Fix:
tubes and hands never double (props may opt in); heads, torsos, clothes keep it. After: one clean limb contour.

**D. Handshakes never met.** Each hand was a body-space guess per character. Film 15 deck: palms 234 px apart (measured
in the old engine, same set-up). Fix: `ST.meet` solves both arms to one world point from the drawing's own transforms
(x, y, scale, yaw, lean, camera), keeps it below both chins, slides an over-stretched character (never into the other
body) or reports; `ST.handAtWorld` / `ST.anchorWorld` for props and shoulders. After: deck 0.00 px (Captain slid 21
px); 601 contact checks, met set-ups <= 2.3 px; impossible ones (e.g. 0.6 vs 1.4 scale on one floor) are reported.

**E. Captain's face broke when the mouth opened.** `jaw = f.jaw * 10` moved jowls/chin/wart while the skin outline and
the mouth stayed: the jaw tier floated, the cravat showed, the mouth spilled past the chin. Fix: the jaw rule
(`ST.jaw` -> `o.J`): one skin outline through `J.pts`, lower lip / teeth / chin / jowls / wattle / warts on `J.y`.
After: every head of every port is one piece with 0 holes in 4 views x 7 visemes x all expressions.

**F. Other glitches found by the suite (fixed):** Recruit's back-view head floated ~30 px above the neck; a Recruit
shirt fold and the Owner's profile mole hung in the air; hands spun round in one frame when a forearm pointed at the
camera (now foreshortened + continuous palm); the IK elbow flipped when a target lined up with the pole (now blends to
a hanging elbow); poses asked short arms for more than they had (`ST.fitArm`); the Captain's jowls read as hands
(re-drawn as two chin tiers); You's double-chin line left slivers (now a skin tier); each shot now resets the key light
(frames no longer depend on the previous shot).

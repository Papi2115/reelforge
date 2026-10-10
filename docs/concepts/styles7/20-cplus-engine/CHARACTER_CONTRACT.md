# The character contract (what a hand-built c-plus person must follow)

Start from `cast-examples/skeleton.js` (fully commented). Register with `ST.defineCharacter({...})`; the engine owns
the draw order, the solver and the measurements, the file owns every drawing. `node tools/validate.mjs` checks it all.

## 1. Anchors - one source of truth
- `D.sw / D.sy / D.sz` = the shoulder joint in body space (x = the character's LEFT, y down from the feet, z forward).
  `D.hw / D.hy` = hips. `D.tilt` (or `D.shY = [left, right]`) = one shoulder higher. `D.hk` = head scale.
- The engine computes `anchors(view, pose)` once per frame: `sh.L/R`, `shoulderNear/Far`, `hip.L/R`, `hipNear/Far`,
  `neck`, `head` (the head box), `facePoint(name, side)`. The SAME object feeds the torso drawing and the arm solver.
- The projected shoulder must land INSIDE every torso view and BELOW the real chin (jaw shut) + `D.neckGap` (6 px).
  Wide heads / jowls / wattles hang low: put the shoulders lower and wider, never "under the chin".
- Never offset a shoulder by hand in a drawing, never fake a neck to steer arm layering.

## 2. Torso reads the anchors
- Draw the main torso outline with `ST.torso(ctx, A, pts, fill, opts)`; every other part near the shoulders (vest,
  cravat, hood, stripes) goes through `A.fit(pts)`. That is how the tilt is applied ONCE to drawing and solver.
- `torso(ctx, view, A, p, f)` runs inside the bob translation; draw the neck there too if the character has one.

## 3. Head, head box, neck
- `heads[4]` = front, 3/4, profile, back drawings, head-local (origin = top of the neck, facing +x), placed at
  `neck[view]` (unmirrored figure space) and scaled by `D.hk`. Head functions get `(ctx, f, o)`:
  `f` = acting state (`ST.act`), `o = { J, ex, p, t, measure, ks }`.
- The head box is MEASURED from the real drawing (all views, jaw shut and open). Do not hand-guess it. When
  `o.measure` is true skip hats and props. Sweat beads / speed lines are `deco: true` (`ST.beads`).

## 4. The jaw rule
- `jaw: { pivot, drop, span }` (or one per view) -> `o.J = ST.jaw(f.jaw, spec)`. Run the ONE skin outline through
  `J.pts(...)`; put the lower lip, lower teeth, chin, jowls, wattle, beard, chin warts at `J.y(...)`/`J.pts(...)`.
  The upper lip, nose and everything above `pivot` never move. A mouth hole's lower edge = `J.y(lip + rest)`.
- Never move a separate jaw/jowl tier by itself; never open a mouth past the chin.

## 5. Hands, grips, face contact
- `arm.hsz` = hand size (palm offset, grips, guard radius). Arms/legs/hands are tubes: no doubled contour, ever.
- Props are drawn AT THE SOLVED PALM before the hand closes over them: `hold(ctx, side, j, g, p, A)` (`g` = palm),
  `holdOver` for things on top of the hand, `p.propL / p.propR` for one-offs.
- Touching the own face = `ST.touch(side, 'chin'|'cheek'|'nose'|'mouth'|'ear'|'forehead', dx, dy, kind)`. The palm
  lands on `face[view][name]` (head-local points on the real drawing; lists = candidates, the hand's own side wins).
  Only that hand skips the guard and is drawn in front. Never set `D.head = null` or force `layer: 2` to touch a face.
- Everything else is guarded: a hand target inside the head box slides round the head (continuous), first pulled into
  the arm's reach. Raised hands above the chin are drawn behind the head.
- Poses never ask for more arm than there is: use `ST.fitArm(D, sgn, target)` for custom cross-body targets.

## 6. Contact between characters / props
- Handshake, coin or ledger hand-over, high five: `m = ST.meet({ a: { ch, p, hand }, b: { ch, p, hand }, point })`,
  then draw `m.a` and `m.b`. It solves both arms to ONE world point from the real transforms (x, y, scale, yaw, lean,
  camera). If arms cannot reach it slides a character (max 1.2 arms, never into the other body) or REPORTS
  (`m.ok false`, `m.reason`); never fake it.
- A palm on a world point (counter, door, another character's shoulder via `ST.anchorWorld(ch, p, 'shoulderNear')`):
  `ST.handAtWorld(ch, p, side, [x, y])` -> merge `.over` into the pose.

## 7. What the validators check (`node tools/validate.mjs`)
1. anchors: drawn shoulder (ST.torso) == arm root (ST.drawArm) within 2 px; root inside the torso silhouette; root
   below chin + gap - every view x pose. 2. connectivity: each figure flat = ONE piece (no floating hand, no loose
   jaw); each head alone = one piece with no holes, every view x viseme x expression. 3. tangle: no palm in the head
   box (except touch), no elbow flip (3D + frame to frame), pose targets reachable, no near arm across the face,
   face-contact palms <= 4 px. 4. contact: ST.meet palms <= 4 px at many scales / yaws / positions + the film 15 deck
   set-up; unreachable set-ups must be reported. 5. continuity: sweeps across the guard box edges, hand step <= 5x
   target step.

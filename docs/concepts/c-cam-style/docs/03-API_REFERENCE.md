# 03 · API reference — every `ST.*` used by the films

All functions live on the global `window.ST`. Canonical copy of the shared engine files: `films/03-apollo-11/js/`
(byte-identical in the three films, see [02-ARCHITECTURE §1](02-ARCHITECTURE.md#1-shape-of-the-system)); camera and topic
APIs are cited per film. Line numbers point at the definition.

Conventions used below:
- **pts** = flat number array `[x0, y0, x1, y1, …]` in the current canvas space.
- **seed** = an integer that fixes every wobble/jitter of the call. Same seed → same drawing.
- **current space** = whatever transform is active (world after the camera, figure space inside `ST.figure`, head
  space inside a head function).
- Angles: `ST.camera`, `ST.figure` lean, `ST.label` rot, `ST.hand` in **degrees**; `ST.ellipseRing` rot, `ST.slip`,
  `ST.bigKey` in **radians** (as noted).

Contents: [core](#1-core-corejs) · [brushes](#2-brushes-brushesjs) · [camera](#3-camera-brushesjs--camerajs) ·
[face](#4-face-facejs) · [grime](#5-grime-grimejs) · [rig](#6-rig-rigjs) · [poses](#7-poses-posesjs) ·
[timeline & film](#8-timeline-and-film) · [player hooks](#9-player-hooks) · [topic APIs](#10-topic-apis-per-film) ·
[unused / deprecated](#11-unused-and-leftovers)

---

## 1. Core (`core.js`)

| Name | Signature → return | Notes | Line |
|---|---|---|---|
| `ST.W`, `ST.H` | `1920`, `1080` | frame size | `films/03-apollo-11/js/core.js:6-7` |
| `ST.FPS` | `24` | playback/export rate | `:8` |
| `ST.ANIM` | `12` | acting rate ("twos") | `:9` |
| `ST.SHOT_DEFS` | `{ [id]: def }` | registry filled by `defineShot` | `:12` |
| `ST.defineShot` | `(id, def) → void` | `def = { title, role, note, cuts?, render(ctx, t) }`; `render` gets **shot-local** t | `:13` |
| `ST.CAST` | `{ [id]: { name, D, draw(ctx, p), … } }` | character registry; extra fields per character (`hsz`, `demo`, `extraRow`, helpers) | `:15` |
| `ST.hash` | `(a, b, c, d) → [0,1)` | integer hash; args truncated with `\|0`; missing args = 0 | `:26-32` |
| `ST.rnd` | `(lo, hi, a, b, c, d) → number` | `lo + (hi−lo)·hash(a,b,c,d)` | `:33` |
| `ST.noise1` | `(seed, x) → [0,1)` | smooth 1-D value noise, smoothstep between integer lattice points | `:35-38` |
| `ST.clamp01` | `(x) → [0,1]` | | `:42` |
| `ST.lerp` | `(a, b, k) → number` | unclamped | `:43` |
| `ST.seg` | `(t, a, b) → [0,1]` | `clamp01((t−a)/(b−a))` | `:44` |
| `ST.ease` | `{ lin, inOut, out, back }` each `(x) → number` | inputs clamped; `inOut` cubic, `out` cubic, `back` overshoot s = 2.2 | `:45-50` |
| `ST.twos` | `(t) → t` quantised down to 1/12 s | `floor(t·12 + 1e-6)/12` | `:52` |
| `ST.key` | `(t, [[time, value, ease?], …]) → number` | holds the first value before the first key and the last after; each segment eases **into** its key with `ST.ease[ease \|\| 'inOut']` | `:55-65` |
| `ST.step` | `(t, [[time, value], …]) → value` | last value whose time ≤ t (snaps: expressions, modes) | `:67-71` |
| `ST.talk` | `(t, seed, [[from, to], …]) → jaw 0..0.95` | on twos; 22 % of frames 0.05 (closed gap), else 0.25–0.95; 0 outside spans | `:74-83` |
| `ST.blink` | `(t, seed) → lid 0..1` | one blink per 3.4 s window at `0.4 + hash·2.4` s; 1 for 0.17 s then 0.6 until 0.25 s | `:85-90` |
| `ST.C` | `{ NAME: '#rrggbb' }` | 46 colours, see [01 §3](01-STYLE_GRAMMAR.md#3-palette-and-values) | `:93-103` |

Example:
```js
const z = ST.key(t, [[0, 1.0], [4, 1.1, 'out']]);           // zoom from 1.0 to 1.1 over 4 s
const expr = ST.step(t, [[0, 'deadpan'], [2.4, 'shock']]); // snap at 2.4 s
const tt = ST.twos(t);                                     // acting time
```

## 2. Brushes (`brushes.js`)

Module state: `ST.LW` (ink width multiplier, default 1) and `ST.camZ` (current camera zoom) — `brushes.js:7-8`.

| Name | Signature → return | Parameters / behaviour | Line |
|---|---|---|---|
| `ST.figure` | `(ctx, p, flip, draw) → void` | figure space: translate `(p.x, p.y)`, scale `(flip ? −p.s : p.s, p.s)`, rotate `p.lean` **deg**; sets `ST.LW = (p.s·camZ)^-0.55` during `draw()`, restores after | `films/03-apollo-11/js/brushes.js:21-31` |
| `ST.curve` | `(pts, closed, step=7) → pts` | Catmull-Rom through control points, one sample every `step` px; < 3 points returned as is | `:34-54` |
| `ST.path` | `(ctx, c, closed) → void` | `beginPath` + polyline (no fill/stroke) | `:55-60` |
| `ST.bbox` | `(c) → { x0, y0, x1, y1, w, h, cx, cy }` | | `:61-68` |
| `ST.inkLine` | `(ctx, c, { w=7, closed, seed=1, color=C.INK, taper=true }) → void` | the ink ribbon (width 0.4–1.9×, taper on open strokes); `w` is multiplied by `ST.LW` | `:71-100` |
| `ST.stroke` | `(ctx, pts, o) → void` | open brush stroke; smooths with `curve(step 4)` when > 2 points; default `w: 4.5` | `:102` |
| `ST.mottle` | `(ctx, bb, [col, count, size], seed) → void` | flat tone blobs inside a bbox (used by `blob`) | `:124-137` |
| `ST.hatch` | `(ctx, bb, { c, w=2.8, n=6, k=4, len=30, gap=7, ang=−40, bend=0.18 }, seed) → void` | n clusters of k bent parallel strokes; angle jitter ±14°; `ctx.stroke` with round caps | `:139-156` |
| `ST.blob` | `(ctx, pts, fill, o) → c` (the smoothed outline) | fill → `shade` crescent → `light` crescent → `patch` → `mottle` → `hatch` → `inner(bb)` (clipped to the shape) → ink outline. Options: `sharp` (no smoothing), `step`, `seed`, `shade: [col, dx, dy]`, `light: [col, dx, dy]`, `patch: [col, dx, dy, k=0.5]`, `mottle`, `hatch`, `inner: (bb) => …`, `lw` (default 7; **0 = no outline**), `lineColor` | `:159-186` |
| `ST.tube` | `(ctx, joints, widths, fill, o) → c` | soft tube through joints with per-joint widths and rounded caps; then `blob(…, o)` | `:189-206` |
| `ST.ellipseRing` | `(cx, cy, rx, ry, n, rot=0 rad) → pts` | n control points of an ellipse | `:209-216` |
| `ST.wobble` | `(pts, amp, seed, step=80) → pts` | subdivides polygon edges every `step` px and jitters the inner points by ±amp (corners stay sharp) | `:219-230` |
| `ST.rough` | `(ctx, pts, fill, o) → c` | hand-wobbled polygon: `blob(wobble(pts, o.amp ?? 3, o.seed ?? 5), fill, { sharp: true, lw: 5, …o })` | `:231` |
| `ST.rect` | `(ctx, x, y, w, h, fill, o) → c` | `rough` rectangle | `:232` |
| `ST.beam` | `(ctx, x0, y0, x1, y1, w, seed, col=C.TIMBER) → c` | timber beam tube with grain hatching | `:234` |
| `ST.bands` | `(ctx, x0, y0, x1, y1, cols[], seed) → void` | flat sky bands, wavy seams; no ink | `:237-247` |
| `ST.stars` | `(ctx, x0, y0, w, h, n, seed, col='#b9b39a') → void` | 1.6 px squares, 12 % 3.2 px | `:248-254` |
| `ST.pool` | `(ctx, cx, cy, rx, ry, col, alpha) → void` | stepped light pool: ellipses at scales 1, 0.66, 0.36, each at `alpha` | `:256-265` |
| `ST.gloom` | `(ctx, x0, y0, w, h, cx, cy, r, col, alpha) → void` | flat darkness with a stepped elliptical hole (r/1, r/0.72, r/0.5) | `:267-277` |
| `ST.bricks` | `(ctx, x0, y0, w, h, { bh=22, bw=56, seed=7, tone, density=0.18, line, lw=2.2 }) → void` | mortar courses + some darker blocks, clipped to the rect | `:279-305` |
| `ST.label` | `(ctx, str, x, y, { size=40, font, fill=C.INK, stroke, lw=8, align='center', rot (deg) }) → void` | `fillText` with optional outline; default font `Impact, 'Arial Black', sans-serif` (system font — see [07 §9](07-REELFORGE_INTEGRATION.md#9-fonts-and-licences)) | `:307-323` |

Gotchas:
- `ST.blob` smooths the points (Catmull-Rom) unless `sharp: true`; give it 6–18 control points, not dense polylines.
- `lw` is the *nominal* width; the screen width depends on `ST.LW` (see [01 §2](01-STYLE_GRAMMAR.md#2-line)).
- `ST.hatch` and `ST.bricks` stroke with `ctx.lineWidth`, they do not use the ink ribbon.
- `ST.label` with `font` given ignores `size`.

Example (a stained plaster wall with a lit window):
```js
ST.rough(ctx, [0, 200, 900, 190, 910, 800, 0, 810], ST.C.PLASTER, {
  seed: 40, lw: 6, shade: ['rgba(0,0,0,0.2)', -24, 0],
  mottle: ['rgba(60,50,30,0.22)', 6, 40], hatch: { c: 'rgba(30,24,12,0.35)', n: 8, len: 40, gap: 8, k: 3, ang: 80 },
});
ST.stain(ctx, 300, 600, 160, 90, 41);
```

## 3. Camera (`brushes.js` + `camera.js`)

| Name | Film | Signature → return | Notes | Line |
|---|---|---|---|---|
| `ST.camera` | all | `(ctx, cx, cy, z, rot) → void` | resets the transform; world point (cx, cy) lands at the frame centre, zoom z, roll `rot` **deg** (rotate before scale); sets `ST.camZ = z`, `ST.LW = z^-0.55` | `films/03-apollo-11/js/brushes.js:11-19` (film 1 names `rot` `tilt`: `films/01-samurai-edo/js/brushes.js:11`) |
| `ST.cutFrame` | 1 | `(t, cuts) → [cx, cy, z, tilt]` | `cuts = [[at, end, a, b?], …]`; picks the framing on twos; interpolates a→b with `ease.inOut((t−at)/(end−at))` | `films/01-samurai-edo/js/camera.js:16-19` |
| `ST.cutCam` | 1 | `(ctx, t, cuts) → index` | applies `cutFrame`, returns the framing index | `films/01-samurai-edo/js/camera.js:21-25` |
| `ST.cut` | 2 | `(t, [[from, name], …]) → { name, t0 }` | current setup on twos; the shot then calls `ST.camera` itself | `films/02-papal-conclave/js/camera.js:32-37` |
| `ST.fg` | 2 | `(ctx, pts, seed, col='#14110e') → void` | flat dark blob in **screen space** (transform reset), no outline | `films/02-papal-conclave/js/camera.js:8-16` |
| `ST.fgArm` | 2 | `(ctx, x0, y0, x1, y1, seed) → void` | accusing arm from the frame edge in screen space: sleeve tube (150/120/100 wide) + pointing hand size 110 | `films/02-papal-conclave/js/camera.js:19-29` |
| `ST.cutCam` | 3 | `(ctx, t, [{ at, x, y, z, rot }, …]) → index` | **different from film 1**: objects; each value a number or `ST.key` keys; cut chosen on raw t | `films/03-apollo-11/js/camera.js:9-15` |
| `ST.fgShape` | 3 | `(ctx, pts, seed) → c` | near-black `ST.rough` with no outline, drawn in the **current (world) space** | `films/03-apollo-11/js/camera.js:17` |
| `ST.silhouette` | 1 | `(ctx, cam, draw) → void` | draws `draw(s)` into a scratch canvas with camera `cam`, fills it with ink `#1c1715`, composites it | `films/01-samurai-edo/js/sets/sets-a.js:70-86` (breaks determinism slightly, see [02 §6](02-ARCHITECTURE.md#6-determinism)) |

Details and examples: [05-CAMERA_GUIDE](05-CAMERA_GUIDE.md).

## 4. Face (`face.js`)

| Name | Signature → return | Parameters / behaviour | Line |
|---|---|---|---|
| `ST.EXPR` | `{ name: { lid, eye, pup, bl, br, sq?, mouth, jaw, look? } }` | 14 expressions; `bl`/`br` = `[raise, knit]` per brow; table in [01 §6](01-STYLE_GRAMMAR.md#6-face-construction) | `films/03-apollo-11/js/face.js:10-25` |
| `ST.face` | `(t, seed, expr, { talk, talkAmp=0.8, noBlink, look }) → f` | resolved face state `{ lid, eye, pup, bl, br, sq, mouth, jaw, look, name }`: lid = max(expr lid, blink); jaw = max(expr jaw, talk·talkAmp); talking turns `flat`/`frown` into `open`; unknown names fall back to deadpan | `:28-38` |
| `ST.eye` | `(ctx, x, y, rx, ry, f, { seed=3, skin, white=C.EYE, side 0\|1, lidAdd, lw=5, bag=true, bags 1\|2 }) → void` | egg eye scaled by `f.eye`, pupil radius `max(rx·0.14·f.pup, 2.2)` offset by `f.look`, skin lid, squint from `f.sq[side]`, lid line, bag strokes | `:41-86` |
| `ST.brow` | `(ctx, x, y, w, side −1\|+1, f, { u=20, thick=14, color, seed=9, arch=1, droop }) → void` | tapered stroke; `side −1` = screen-left brow (uses `f.bl`) | `:89-96` |
| `ST.mouth` | `(ctx, x, y, w, f, { seed=17, lw=5, open=0.6·w, teeth, under }) → bottomY` | `f.mouth` ∈ `flat smirk frown grin twist wavy open yell snarl`; opening `h = f.jaw·open`; closed when h < 4; `teeth: few\|snag\|gap\|row\|none`; `under: [[u, h], …]` lower teeth over the lip | `:100-147` |
| `ST.stubble` | `(ctx, pts, seed, n, col) → void` | n dashes clipped to the closed region | `:150-166` |
| `ST.wart` | `(ctx, x, y, r, col, seed=5, hair) → void` | lumpy blob + optional hair | `:168-171` |
| `ST.pores` | `(ctx, x0, y0, w, h, n, seed, col) → void` | n 3×2.5 px ticks | `:173-176` |
| `ST.hand` | `(ctx, x, y, ang, sz, skin, kind, { seed=23, shade, lw=5.5 }) → void` | mitten hand at the wrist; `ang` = forearm direction in deg (0 = down); `kind` ∈ `fist open point grip flat`; thumb toward +x | `:179-199` |

Example (inside a head function, head-local units):
```js
const f = ST.face(p.t, SEED, p.expr || 'deadpan', { talk: p.talk });
ST.eye(ctx, -24, -90, 11, 12, f, { skin: SKIN, seed: SEED + 1, side: 0, bags: 2 });
ST.brow(ctx, -24, -110, 34, -1, f, { u: 14, thick: 14, color: '#2e241c', seed: SEED + 2 });
ST.mouth(ctx, 0, -24, 46, f, { open: 26, teeth: 'row', seed: SEED + 3 });
```

## 5. Grime (`grime.js`)

| Name | Signature | Notes | Line |
|---|---|---|---|
| `ST.stain` | `(ctx, x, y, w, h, seed, col='rgba(40,30,15,0.22)')` | 9-point blob, drips down, no outline | `films/03-apollo-11/js/grime.js:8-15` |
| `ST.peel` | `(ctx, x, y, w, h, seed)` | jagged hole with brick courses and an ink edge | `:17-26` |
| `ST.crack` | `(ctx, x, y, len, seed, ang=1.2 rad)` | 5-point ink polyline | `:27-38` |
| `ST.cobbles` | `(ctx, x0, y0, x1, y1, seed, col, colD)` | perspective rows of stones | `:40-50` |
| `ST.house` | `(ctx, x, base, w, h, { seed, lean, floors=3, plaster, jetty=14, peel, beam=18, lit, roof, roofLean, roofCol }) → { left(y), right(y), top, roofTop }` | crooked half-timbered house | `:53-77` |
| `ST.window` | `(ctx, cx, cy, w, h, seed, lit)` | leaded window with a shutter | `:79-88` |
| `ST.puddle` | `(ctx, x, y, w, seed, sky)` | | `:89-91` |
| `ST.flies` | `(ctx, x, y, t, seed)` | 6 dashes jittering on twos | `:93-97` |

## 6. Rig (`rig.js`)

Body space: x = the character's LEFT, y down (feet at 0, so the body is at negative y), z forward
(`films/03-apollo-11/js/rig.js:4-5`). Views: `v` 0 front, 1 three-quarter, 2 profile, 3 back; `mir` = facing
screen-left. Yaw values: 0, 1, 2, 3, −2, −1 (the ring `RING = [0, 1, 2, 3, −2, −1]`, `rig.js:11`).

| Name | Signature → return | Notes | Line |
|---|---|---|---|
| `ST.yawOfRing` | `(i) → yaw` | ring index (any integer) → yaw | `:15` |
| `ST.turn` | `(t, [[time, ring], …], rate=12) → yaw` | from each key the ring walks one step per twos frame toward the key value; keep counting past 5 for spins (ring 6 = front again) | `:18-29` |
| `ST.view` | `(yaw) → { yaw, v, mir }` | | `:30` |
| `ST.proj` | `(V, [x, y, z]) → [sx, sy, depth]` | body → figure space for the view (rotation about y by 0/45/90/180°; x negated first when mirrored) | `:34-37` |
| `ST.ik` | `(S, T, l1, l2, pole) → [E, H]` | 2-bone IK in 3-D; target clamped to `[|l1−l2|+0.5, l1+l2−0.5]` | `:41-50` |
| `ST.limbRig` | `(V, S, T, l1, l2, pole, sideW) → j` | `j = { s, e, h, H3, depth, behind, ang }` (screen shoulder/elbow/hand, 3-D hand, mean depth, behind-the-body flag, forearm angle deg) | `:53-60` |
| `ST.elbowPole` | `(sgn, k=0.7) → [sgn·k, 0.25, −1]` | out, slightly down, behind | `:62` |
| `ST.kneePole` | `(sgn) → [sgn·0.18, 0, 1]` | knees forward | `:63` |
| `ST.palm` | `(j, hsz) → [x, y]` | palm centre: 0.55·hsz along the forearm from the wrist | `:66-69` |
| `ST.drawArm` | `(ctx, j, { cloth, clothD, w: [shoulder, elbow, wrist], bare=1, skin, skinD, hsz, hand, cuff, hatch, hair, seed=50, lw=6 })` | sleeve tube (+ bare forearm from fraction `bare`), cuff, then `ST.hand` unless `hand: 'none'` | `:73-87` |
| `ST.drawLeg` | `(ctx, V, j, sgn, { cloth, clothD, w, shoe, shoeD, shoeL, len, sw, splay=0.25, skin, skinD, hatch, seed=70, lw=6 })` | hip→knee→ankle tube, optional bare shin, then the foot | `:91-96` |
| `ST.drawFoot` | `(ctx, V, A, sgn, st)` | shoe from projected heel/ball/toe; forward-pointing feet drop by `depth·0.16` | `:97-102` |
| `ST.solve` | `(V, D, P) → { bob, aL, aR, lL, lR }` | resolves a pose: shoulders `(±D.sw, D.sy+bob, D.sz)`, hips `(±D.hw, D.hy+bob, 0)`; hand targets pass the **face guard** first; poles from `P.poleL/R` or `elbowPole(±1, D.elbowOut)`; `bob = P.bob·(l1l+l2l)` | `:117-128` |
| (guard) | private | if a hand target projects inside `D.head` (top..bottom, `|x − head.x[v]| < hw + 34`) it is slid sideways along the view axis until clear | `:109-116` |
| `ST.armLayer` | `(j, neckY, force) → 0\|1\|2` | 0 behind the torso; 1 = hand above `neckY` or elbow above `neckY − 20` (drawn after the torso, before the head); 2 = in front | `:132` |
| `ST.headView` | `(bodyYaw, headYaw) → { V, flip }` | head view and whether to mirror it inside figure space | `:134-137` |

`D` (character dimensions) fields read by the rig and poses: `sw, sy, sz, hw, hy, l1a, l2a, l1l, l2l, elbowOut,
waist: [x, y], head: { x: [v0..v3], top, bottom, hw }` (+ `top` for the test page scale, `hsz` in film 3). Full
contract: [04-CHARACTER_GUIDE](04-CHARACTER_GUIDE.md).

## 7. Poses (`poses.js`)

Targets are body-space points scaled by the character: `A = l1a + l2a`, `L = l1l + l2l`;
`hand(D, sgn, out, down, fwd) = [sgn·(sw + out·A), sy + down·A, sz + fwd·A]`,
`foot(D, sgn, out, lift, fwd) = [sgn·(hw + out·L), −lift·L, fwd·L]` (`films/03-apollo-11/js/poses.js:8-11`).
A pose object: `{ hL, hR, fL, fR, poleL?, poleR?, kL?, kR? (hand kinds), bob?, lean? }`.

| Name | Signature | Notes | Line |
|---|---|---|---|
| `ST.POSE.stand` | `(D)` | arms hanging | `:14` |
| `ST.POSE.akimbo` | `(D)` | hands on `D.waist`, elbows out, flat hands | `:16-19` |
| `ST.POSE.clasp` | `(D)` | hands together in front of the belly | `:21` |
| `ST.POSE.point` | `(D, sgn)` | one arm pointing forward at eye level | `:23-28` |
| `ST.POSE.armsUp` | `(D)` | shock pose, open hands | `:30` |
| `ST.POSE.jig` / `stomp` / `flail` | `(D, ph 0..1)` | dance/flail cycles (from the Dancing Plague film) | `:32-59` |
| `ST.POSE.slump` | `(D)` | spent, leaning 9° | `:61` |
| `ST.POSE.walk` | `(D, ph 0..1)` | opposite arm/leg swing | `:63-69` |
| `ST.pose` | `(name, D, ph, over) → P` | `Object.assign(POSE[name](D, ph), over)` | `:72` |
| `ST.handAt` | `(D, sgn, out, down, fwd) → [x, y, z]` | hand target relative to the shoulder in arm lengths | `:74` |
| `ST.footAt` | `(D, sgn, out, lift, fwd) → [x, y, z]` | | `:75` |

Feed phase poses `ST.twos` time, e.g. `ST.pose('walk', D, (tt * 1.4) % 1)` (`films/01-samurai-edo/js/shots/shots-b.js:75`).

## 8. Timeline and film

| Name | Signature → return | Notes | Line |
|---|---|---|---|
| `ST.FILM` | `[{ id, dur, lines: [[from, to, text], …] }]` | the cut; `lines` in shot time | `films/03-apollo-11/js/film.js:4-18` |
| `ST.SHOTS` | `[{ index, …def, …film entry, t0, t1 }]` | built at load; throws on an unknown id | `films/03-apollo-11/js/timeline.js:7-13` |
| `ST.DURATION` | seconds | sum of `dur`, ms-rounded | `:14` |
| `ST.shotAt` | `(t) → index` | | `:15-18` |
| `ST.captionAt` | `(t) → string` | the caption line of the current shot at its local time, or `''` | `:20-24` |
| `ST.showCaptions` | boolean | | `:25` |
| `ST.renderFrame` | `(ctx, t) → void` | the whole frame for film time t (see [02 §8](02-ARCHITECTURE.md#8-how-one-frame-is-produced-draw-order)) | `:40-53` |

## 9. Player hooks

| Hook | Behaviour | Line |
|---|---|---|
| `window.__duration` | `ST.DURATION` | `films/03-apollo-11/js/player.js:79` |
| `window.__seek(s)` | pause, set time (clamped), draw | `:80` |
| `window.__showcase.duration` / `.shots` | `[{ id, title, t0, t1 }]` | `:81-83` |
| `window.__showcase.frame(t)` | seek + `canvas.toDataURL('image/png')` (default, GPU-backed canvas) | `:84` |
| `window.__test.ids` / `.sheet(id)` / `.all(scale=0.5)` | dev turnaround PNG data URLs (test.html) | `films/03-apollo-11/js/test-page.js:69-88` |

## 10. Topic APIs (per film)

Not part of the shared engine, but reusable patterns. Characters register in `ST.CAST`; draw props `p` are listed in a
comment above each `draw` (e.g. `films/03-apollo-11/js/cast/commander.js:112-113`).

**Film 1 — `props.js`, `edo.js`, `cast/`, `sets/`**

| Name | Signature | What | Line |
|---|---|---|---|
| `ST.bowed` | `(ctx, hy, deg, fn)` | draw `fn` with the upper body rotated about the hip pivot (0, hy) | `films/01-samurai-edo/js/props.js:16-24` |
| `ST.bowPt` | `(pt, hy, deg) → pt` | the same rotation for a point | `:25` |
| `ST.figToWorld` / `ST.worldToFig` | `(p, flip, lean, pt) → pt` | figure space ↔ world | `:28-32` |
| `ST.bodyAt` | `(V, q, bob, keep) → [x, y, z]` | body-space target projecting onto figure point q (one axis fixed by `keep`) | `:36-41` |
| `ST.reachPalm` | `(ch, p, P, side 'L'\|'R', w, keep) → target` | 4 fixed-point steps so the **palm** lands on world point w (bow and lean aware) | `:43-53` |
| `ST.palmWorld` | `(ch, p, P, side) → [x, y]` | world position of a palm | `:55-58` |
| `ST.sode`, `ST.seated`, `ST.swordEnd`, `ST.daisho`, `ST.rackSword`, `ST.bale`, `ST.koban`, `ST.abacus`, `ST.hanko`, `ST.jingasa` | various | sleeve bags, kneel-behind-furniture clip, swords projected from body space, Edo props | `:62-155` |
| `ST.roof`, `ST.shoji`, `ST.tatami`, `ST.planks`, `ST.lattice`, `ST.noren`, `ST.kura`, `ST.dirt`, `ST.lowDesk`, `ST.papers`, `ST.sparrow` | various | Edo set brushes | `films/01-samurai-edo/js/edo.js:10-131` |
| `ST.setTitle`, `setHouse`, `futonBase`, `futonQuilt`, `setDream`, `setOffice`, `setStreet`, `setRice`, `setMarket`, `priceBoard`, `setShop`, `setShopFront` | `(ctx, t, o?)` | settings | `films/01-samurai-edo/js/sets/sets-a.js:8`, `sets-b.js:8,32,61`, `sets-c.js:8,30,46,76` |
| `ST.posterWord` | `(ctx, word, x, y, size, t, t0, rotBase)` | title lettering (also in films 2–3) | `films/01-samurai-edo/js/shots/shots-a.js:9-37` |
| `ST.cat` | `(ctx, { x, y, s, flip, t, mode: walk\|sit\|jump, ph, look, lid })` | off-rig animal | `films/01-samurai-edo/js/cast/cat.js:25-50` |
| `ST.crowdFigure` | `(ctx, { x, y, s, kind 0..4, yaw, mode stand\|point, col, colD, skin, seed })` | background figure | `films/01-samurai-edo/js/cast/crowd.js:19-52` |
| helpers | `ST.clerkDesk`, `ST.elderStamp`, `ST.keeperHold`, `ST.merchantOffer`, `ST.merchantAbacus` | pose fragments | `cast/clerk.js:134`, `elder.js:132`, `keeper.js:108`, `merchant.js:138-139` |

**Film 2 — `acting.js`, `cast/`, `sets/`, `shots/`**

| Name | Signature | What | Line |
|---|---|---|---|
| `ST.seat` | `(D, over) → P` | seated pose (bob 0.4, forearms forward) | `films/02-papal-conclave/js/acting.js:7-10` |
| `ST.ballotUp` | `(D, sgn) → P fragment` | slip held up beside the head | `:12` |
| `ST.pointAt` | `(D, sgn, up) → P fragment` | accusing point | `:14` |
| `ST.shake` | `(t, bodyYaw, period=0.25) → yaw` | head shake 3/4 L – front – 3/4 R on twos | `:16-19` |
| `ST.slip` | `(ctx, x, y, rot rad, seed, scale)` | ballot slip | `:21-30` |
| `ST.palmWorld` | `(ch, p, side 'aL'\|'aR', hsz) → [x, y]` | **different signature from film 1**; ignores lean | `films/02-papal-conclave/js/shots/shots-b.js:10-13` |
| `ST.ladder`, `ST.marks`, `ST.conclave`, `ST.CONCLAVE`, `ST.writeUp`, `ST.tableBallots`, `ST.TOWN_TONES` | various | shared table layout of all hall shots, groan marks, ladder | `shots-a.js:7,43-70`, `shots-b.js:15-19`, `shots-c.js:10` |
| sets | `ST.towers`, `palaceDoor`, `palace`, `bellTower`, `setTitle`, `setStreet`, `hallRoof`, `setHall`, `cobweb`, `candleStand`, `chair`, `hallTable`, `chalice`, `rain`, `setDoorClose`, `carvedStone`, `grilleFrame`, `setGrilleClose` | | `films/02-papal-conclave/js/sets/sets-a.js:9-94`, `sets-b.js:11-145`, `sets-c.js:8-53` |
| props in cast files | `ST.loaf`, `ST.jug` (baker), `ST.bigKey`, `ST.plank` (mayor), `ST.roofTile` (roofer) | | `cast/baker.js:90,94`, `cast/mayor.js:111,120`, `cast/roofer.js:96` |
| `ST.crowdFigure` | `(ctx, { …, kind 0..5 (5 = cardinal), mode stand\|mutter\|point\|vote\|sit\|sitpoint\|cover\|none, t, lean })` | | `cast/crowd.js:34-70` |

**Film 3 — `props.js`, `lunar.js`, `cast/`, `sets/`**

| Name | Signature | What | Line |
|---|---|---|---|
| `ST.reachTo` | `(p, wx, wy, free) → [x, y, z]` | body-space **wrist** target projecting onto world (wx, wy); `free` = the axis the view cannot see. Ignores `bob`, lean and the palm offset | `films/03-apollo-11/js/props.js:124-129` |
| `ST.helmet`, `ST.thumbsUp`, `ST.checklist`, `ST.mug`, `ST.sandwich`, `ST.toyBear`, `ST.phone`, `ST.controlStick`, `ST.sweat`, `ST.gumBubble`, `ST.GLOVE(_D)` | various | held props and suit hardware | `:8-120` |
| `ST.MOON`, `ST.crater`, `ST.boulder`, `ST.moonGround`, `ST.earth`, `ST.lander`, `ST.metalPanel`, `ST.switches`, `ST.gauge`, `ST.dsky`, `ST.dent` | various | lunar/cabin set brushes | `films/03-apollo-11/js/lunar.js:7-134` |
| sets | `ST.moonDisc`, `setTitle`, `setPad`, `windowView`, `setLM`, `setWindowPOV`, `setPanelWall`, `console`, `setControl`, `controlFront`, `cigSmoke`, `setCM`, `floaters`, `setSurface` | | `sets/sets-a.js:8-32`, `sets-b.js:10-83`, `sets-c.js:8-86` |
| `ST.tag` | `(ctx, text, x, y, size, rot, seed)` | paper tag with stencil text | `shots/shots-a.js:39-46` |
| helpers | `ST.youRead`, `ST.directorSip`, `ST.orbiterFloat` | pose fragments | `cast/you.js:149`, `cast/director.js:142`, `cast/orbiter.js:137` |
| `ST.crowdFigure` | `(ctx, { …, kind 0..3, mode stand\|work, ph })` | | `cast/crowd.js:17-51` |

## 11. Unused and leftovers

| Item | Status | Evidence |
|---|---|---|
| `ST.gloom`, `ST.noise1` (as a direct call), `ST.yawOfRing`, `ST.limbRig`, `ST.drawFoot` (direct), `ST.kneePole`, `ST.elbowPole` (direct) | engine helpers not called by any film code (they are used internally by other engine functions, except `ST.gloom`) | grep over `films/*/js` excluding engine files, 2026-10-09 |
| `ST.POSE.jig`, `stomp` | used only by `test-page.js` rows (jig) / nowhere (stomp) | `films/03-apollo-11/js/test-page.js:12` |
| `ST.house`, `ST.window`, `ST.cobbles` | used only by film 2's street | `films/02-papal-conclave/js/sets/sets-a.js` |
| "dancing plague" error text | leftover from the source film | `films/03-apollo-11/js/timeline.js:9` |
| `crescent` | private helper of `blob` | `brushes.js:110-122` |
| Three cut-table dialects, two `ST.palmWorld` signatures, `hsz` stored on `ch` (film 1), on `D` (film 3) or passed by the caller (film 2) | inconsistent APIs to unify in a port | see [05 §2](05-CAMERA_GUIDE.md#2-the-three-cut-table-dialects), [04 §6](04-CHARACTER_GUIDE.md#6-hands-grips-and-contact) |

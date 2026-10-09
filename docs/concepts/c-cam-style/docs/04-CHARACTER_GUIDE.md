# 04 · Character guide — the C character contract and how to build a new person

Every person in C-CAM is **hand-built**: one file, one `draw(ctx, p)` function, own torso per view, own head per view,
own costume and props. Only the brushes, the rig (views, IK, layers, guard), the pose library and the face primitives
are shared. There is no generator and no parameterised "character factory" (Papi's rule, recorded in
`../../styles7/10-dancing-plague-both/CHANGES.md:30` and the style 07 rulebook `../../styles7/07-great-stink-london/NOTES.md:4-5`).

Worked example throughout: **the Commander** (`films/03-apollo-11/js/cast/commander.js`, 147 lines).
Related: [01-STYLE_GRAMMAR](01-STYLE_GRAMMAR.md) (look), [03-API_REFERENCE §6](03-API_REFERENCE.md#6-rig-rigjs) (rig API).

---

## 1. What a character module provides

```js
// films/<film>/js/cast/<id>.js — a classic script
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = …, SEED = 310;                     // own tones and a seed block (110, 310, 1100 … per character)
  const D = { … };                                 // rig dimensions (§2)
  const NECK = [ … 4 views … ];                     // where the head sits per view (§4)
  const TORSO/SUITS/CASSOCK = [ … 4 outlines … ];  // hand-drawn torso per view (§3)
  function headFront(ctx, f, …) {} … headBack()    // 4 hand-drawn heads (§5)
  const HEADS = [headFront, head34, headProfile, headBack];
  const ARM = { … }, LEG = { … };                  // sleeve/leg style for ST.drawArm / ST.drawLeg
  function draw(ctx, p) { … }                      // the fixed draw order (§7)
  ST.CAST.<id> = { name, D, draw, hsz?, demo?, extraRow?, …helpers };
})();
```

Registry fields seen in the films (`ST.CAST` lines at the end of every cast file):

| Field | Required | Meaning | Example |
|---|---|---|---|
| `name` | yes | label on the turnaround sheet | `'The Commander'` |
| `D` | yes | rig dimensions | `films/03-apollo-11/js/cast/commander.js:10` |
| `draw(ctx, p)` | yes | draws the whole person in world space | `commander.js:114-145` |
| `hsz` | film 1 | hand size for palm solves (`ST.reachPalm`, `ST.palmWorld`) | `films/01-samurai-edo/js/cast/you.js:193` |
| `demo` | optional | props merged into every test-page cell | `commander.js:146` (`{ chew: true }`) |
| `extraRow` | optional | `[label, (D) => props]`, one extra test-page row | `commander.js:146` |
| helpers | optional | world-space queries or pose fragments | `you.js:184-193` (`swordEnd`, `crown`), `films/02-papal-conclave/js/cast/stubborn.js:184` (`write`) |

## 2. Dimensions `D` (body space)

Body space: x = the character's LEFT, y down with the feet at 0 (so the body is at negative y), z forward
(`films/03-apollo-11/js/rig.js:4-5`). Commander: `D = { sw: 70, sy: -552, sz: 8, l1a: 114, l2a: 108, hw: 36, hy: -340,
l1l: 164, l2l: 150, elbowOut: 0.75, top: -800, waist: [84, -404], hsz: 42, head: { x: [0, 18, 36, 0], top: -800,
bottom: -598, hw: 78 } }` (`commander.js:10`).

| Field | Meaning | Used by | Commander |
|---|---|---|---|
| `sw`, `sy`, `sz` | shoulder joint: half width, height, forward offset | `ST.solve` (`rig.js:119`), `hand()` in poses | 70, −552, 8 |
| `hw`, `hy` | hip joint half width and height | `ST.solve` (`rig.js:125-126`), `foot()` | 36, −340 |
| `l1a`, `l2a` | upper arm, forearm length | IK, pose scale `A` | 114, 108 |
| `l1l`, `l2l` | thigh, shin length (in the cast `hy` is 2–26 units above `−(l1l+l2l)`) | IK, bob scale | 164, 150 |
| `elbowOut` | sideways component of the default elbow pole (0.6–0.9) | `ST.elbowPole` | 0.75 |
| `waist` | `[x, y]` hand target for `akimbo` | `ST.POSE.akimbo` | [84, −404] |
| `top` | crown height (scale of the test sheet) | `test-page.js:32` | −800 |
| `head` | face-guard box: `x[v]` centre per view, `top`, `bottom`, `hw` half width | guard (`rig.js:109-116`) | see above |
| `hsz` | hand size (film 3 keeps it in D) | `ARM.hsz` | 42 |

Measured ranges over the 17 hand-built cast members: height 640–860, shoulder half-width 44–106, arm 162–242,
leg 182–346 (table in [01 §5](01-STYLE_GRAMMAR.md#5-proportions-and-the-body)).

## 3. Torso by view

Four hand-drawn outlines, never one shape squashed (`commander.js:14-19`, `SUITS[v]`):
- **front** (v 0): widest shoulders, symmetric, closure (zip/buttons) on the centre line;
- **3/4** (v 1): near shoulder wide on the back side, far shoulder narrow, belly/bust bulges toward the facing side,
  closure shifted toward it (`commander.js:26`: closure x = `[0, 20, 50][v]`, detail scale `[1, 0.8, 0.4][v]`);
- **profile** (v 2): shoulders overlap, width = body depth, closure on the front edge, side seam;
- **back** (v 3): seam and folds only, no front details (`commander.js:25`).
Belts, collars, aprons follow the view (`BELT[v]`, `RING[v]`, `commander.js:20,35-37`). Mirrored views are produced by
`ST.figure`'s flip, never drawn separately.

## 4. Neck and head placement

`NECK[v]` is either `[baseX, baseY, headX, headY]` (a visible neck tube from base to head) or `[x, y]` (no neck: the
head sits straight on the collar). The head is translated to the last pair plus `J.bob + p.headDy`.
- Commander: `[[0, -570, 0, -612], [8, -568, 14, -610], [14, -564, 30, -604], [0, -570, 0, -612]]` — the neck moves
  forward in 3/4 and profile (`commander.js:11`); drawn as a tube 64→58 wide (`:129`).
- Stubborn Cardinal, Mayor, Baker, Gregory, Keeper, Merchant, Rival use the 2-value form (sunk heads),
  e.g. `films/02-papal-conclave/js/cast/stubborn.js:10`.
- The head is scaled by a per-character factor (1.05–1.2; Commander 1.1, `commander.js:137`) and mirrored when its own
  view faces the other way (`ST.headView`, `rig.js:134-137`), so `p.head` (a yaw) can turn the head independently of
  the body (`commander.js:134`).

## 5. Heads by view, expressions and the jaw

Four functions `(ctx, f, …extras)` in head-local units, origin = top of the neck, +x = the way the head faces, y up
negative (`commander.js:39-106`):
- front: both eyes, nose on the centre line (`headFront`, `:64-77`);
- 3/4: far eye narrower (`0.66`), nose breaks the far contour, near ear only (`head34`, `:78-89`);
- profile: one eye near the front edge, nose/lips/chin form the outline, ear centre-back (`headProfile`, `:90-100`);
- back: hair mass / cap fills the head, nape folds, no face (`headBack`, `:101-105`).

`f = ST.face(p.t, SEED, p.expr || <default>, { talk: p.talk, look: p.look })` (`commander.js:116`). Each character
has its own default expression (`deadpan` Commander, `scared` You (`you.js:148`), `smug` Stubborn
(`stubborn.js:156`)).

**The jaw in C.** The opening is `jaw = f.jaw * 14` (Commander, `:65`; 16 for You, `you.js:78`) and is added to the
chin control points **inside the single head outline** (`commander.js:66`: points `-14 + jaw … 16 + jaw`), to the
stubble region, chin cleft, scar and jowl lines. The upper face (eyes, nose, brows) never moves. This keeps the head
in one piece by construction, but nothing checks it (c-plus added a validator, §9).

## 6. Hands, grips and contact

- Hand size `hsz` = mitten size (32–42 body units, `ARM` consts); `ST.palm(j, hsz)` = palm centre 0.55·hsz along the
  forearm from the wrist (`rig.js:66-69`).
- Hand kind per side comes from the pose: `P.kL`/`P.kR` ∈ `fist` (default), `open`, `point`, `grip`, `flat`
  (`face.js:178-199`); characters may add their own kinds (Commander `'thumb'` → `ST.thumbsUp`, `commander.js:121-122`).
- **Grips are solved, not placed**: draw the prop at the solved palm, then the hand closes over it. Hooks used:
  - inside `armsAt(layer)` before `ST.drawArm` (Stubborn's notebook and stylus, `stubborn.js:159-164`);
  - `p.beforeHand(J)` between the head and the near arms (the control stick under the glove,
    `films/03-apollo-11/js/shots/shots-c.js:30-34`);
  - `p.after(J)` after everything (a blade from the palm, `films/01-samurai-edo/js/shots/shots-a.js:89`);
  - a `held(J)` callback (the ledger between the merchant's palms, `films/01-samurai-edo/js/shots/shots-d.js:52`).
- **Contact with scenery or another person** is solved in world space before the camera (all three films):

| Film | Helper | What it solves | Accuracy |
|---|---|---|---|
| 1 | `ST.reachPalm(ch, p, P, side, w, keep)` | 4 fixed-point steps on the palm offset so the **palm** lands on world point w; bow- and lean-aware (`films/01-samurai-edo/js/props.js:43-53`) | koban hand-over "within 1.3 px" (`films/01-samurai-edo/NOTES.md:12`) |
| 1 | `ST.palmWorld(ch, p, P, side)` | where a palm is, to place a prop or aim another hand (`props.js:55-58`) | exact for the given pose |
| 2 | `ST.palmWorld(ch, p, 'aL'\|'aR', hsz)` | palm in world space → the scenery is placed there (keyhole, ladder, the loaf's landing spot) (`films/02-papal-conclave/js/shots/shots-b.js:10-13`) | exact; ignores lean |
| 3 | `ST.reachTo(p, wx, wy, free)` | the **wrist** target that projects onto (wx, wy) (`films/03-apollo-11/js/props.js:124-129`) | ignores bob, lean and the palm offset; the guard may still move it |

## 7. The draw order (fixed)

Commander, `commander.js:114-145` (the same skeleton in every cast file):

```js
function draw(ctx, p) {
  const V = ST.view(p.yaw || 0), P = p.pose || ST.pose('stand', D), J = ST.solve(V, D, P);
  const f = ST.face(p.t || 0, SEED, p.expr || 'deadpan', { talk: p.talk, look: p.look });
  const n = NECK[V.v], lay = p.layer || {};
  const arms = [[J.aL, P.kL, 1, ST.armLayer(J.aL, n[1] + J.bob, lay.L)],
                [J.aR, P.kR, 2, ST.armLayer(J.aR, n[1] + J.bob, lay.R)]];
  const armsAt = (layer) => arms.forEach(([j, k, sd, l]) => { if (l === layer) ST.drawArm(ctx, j, { ...ARM, hand: k || 'fist', seed: SEED + 80 + sd }); });
  ST.figure(ctx, { ...p, lean: (p.lean || 0) + (P.lean || 0) }, V.mir, () => {
    armsAt(0);                                                       // 1. far arms, behind the body
    [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth)  // 2. legs, far first
      .forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, { ...LEG, seed: SEED + 90 + sg }));
    ctx.save(); ctx.translate(0, J.bob);                             // 3. bob: upper body drops
    /* neck tube */ suit(ctx, V.v); ring(ctx, V.v);                  // 4. torso for this view
    ctx.restore();
    armsAt(1);                                                       // 5. raised arms: behind the head
    const H = ST.headView(V.yaw, p.head);                            // 6. head (own view, mirrored if needed)
    ctx.save(); ctx.translate(n[2], n[3] + J.bob + (p.headDy || 0)); ctx.scale(H.flip ? -1.1 : 1.1, 1.1);
    HEADS[H.V.v](ctx, f, …); /* helmet */ ctx.restore();
    if (p.beforeHand) p.beforeHand(J);                               // 7. props under the near hand
    armsAt(2);                                                       // 8. near arms in front
    if (p.after) p.after(J);                                         // 9. hook
  });
}
```
(simplified from the file; the real code also draws the thumbs-up hand and the helmet).

**Common draw props `p`** (comment above each `draw`, e.g. `commander.js:112-113`): `x, y` (feet in world), `s` (scale),
`t` (shot time, for blinks/talk/chewing), `yaw`, `head` (head yaw), `headDy` (jolt/nod), `expr`, `talk` (spans),
`look` ([x, y] −1..1), `pose`, `lean` (deg), `layer: { L, R }` (force an arm layer), `after(J)`; plus the
character's own (`chew`, `bubble`, `helmet`, `book`, `bow`, `hat`, `beard`, `sweat`, …).

**Layers** (`ST.armLayer`, `rig.js:132`): 0 = arm behind the body plane for this view; 1 = hand above the neck base or
elbow 20 px above it (drawn after the torso, under the head, so a raised near arm passes behind the head); 2 = in
front. `p.layer.L/R = 2` forces a hand in front (used for folded arms and for writing over a notebook:
`films/02-papal-conclave/js/shots/shots-b.js:52`, `shots-a.js:123`).

**Face guard** (`rig.js:109-116`): before IK, a hand target whose projection falls inside `D.head` (from `top` to
`bottom`, horizontally within `hw + 34` of `head.x[v]`) is slid sideways along the view's screen axis to the box edge.
It is a one-shot slide (not continuous) and it moves the target, not the drawn hand.

## 8. Recipe: a new character from scratch

1. **Brief** (5 lines): role/job, one exaggeration axis, costume + one loud prop with a gag use, 4–6 grit marks
   (stubble, wart with hair, bags, broken veins, missing tooth, scar), default expression, a signature action.
   Commander brief = the file header (`commander.js:1-5`).
2. **Pick a SEED block** not used by another character in the film (100-wide blocks: 110, 310, 810, 1100 …).
3. **Tones**: skin pair from `ST.C` or a local pair; cloth pair; one accent at most.
4. **D**: start from a cast member of similar build (table in [01 §5](01-STYLE_GRAMMAR.md#5-proportions-and-the-body)) and change the axis:
   shoulders (`sw`), leg length (`l1l+l2l`, with `hy` 2–26 units above `−(l1l+l2l)` as in the cast), arm length (the C cast uses
   0.25–0.30 × height for `l1a+l2a`; style 11 recommends a reach of 0.45–0.55 of the height,
   `../../styles7/11-prohibition-arms-only/NOTES.md:8`, which is longer than C), `top`.
5. **Torso[4]**: draw the front outline (16–18 control points), derive 3/4, profile and back by hand (§3). Keep the
   shoulder joint `(±sw, sy)` **inside** every torso outline and clearly **below the chin** (see §9).
6. **NECK[4]** and the head scale.
7. **Heads[4]** in the order of [01 §6](01-STYLE_GRAMMAR.md#6-face-construction): head blob with `FACE` options, hair/cap, eyes + brows
   (far eye 0.6–0.72 in 3/4), cheek lines, nose last, mouth, marks; add `jaw` to every chin point.
8. **ARM / LEG** style objects (`w: [shoulder, elbow, wrist]`, `bare`, `cuff`, `hsz`, `hatch`; leg `w`, `shoe`,
   `len`, `sw`, `splay`).
9. **draw()** with the fixed order of §7; add the character's own props via hooks or extra `p` fields.
10. **Register** `ST.CAST.<id> = { name, D, draw, hsz: ARM.hsz, demo, extraRow }`.
11. **Test**: add the file to `test.html` (after `props.js` if it uses topic props) and look at the sheet (§10).

## 9. Common mistakes and whether C avoids them

These are the three bug families found in the c-plus films (`../../styles7/20-cplus-engine/CHANGES.md:7-40`) and how
plain C behaves.

| Problem | In c-plus | In C (this engine) |
|---|---|---|
| **Anchor at chin level** — arms growing out of jowls because the shoulder joint sits at or above the chin | fixed by computing anchors once, drawing the torso through them and *measuring* the chin (`../../styles7/20-cplus-engine/CHANGES.md:7-14`) | Not prevented. Shoulders and head box are typed by hand. Shoulder-to-head-box-bottom distance in the cast: You (film 1) 60, Tired 80, Commander 46 … but Stubborn **8**, Baker 10, Mayor 12, Gregory 16 (from `D.sy − D.head.bottom`, every cast file line 9–11). Worked example, Stubborn front head: chin outline at head-local y `22 + jaw` (`stubborn.js:71`), head origin y −490, scale 1.15 (`:10,176`) → closed chin at y ≈ −464.7, open (jaw 14) ≈ −448.6; shoulder `sy` −462, i.e. 2.7 px under the closed chin and ~13 px above the open chin. The cape covers the root in the films (visual judgement: **UNKNOWN**, not measured). Rule for new characters: shoulder ≥ 30 units below the open-jaw chin. |
| **Jaw detachment** — the chin/jowl tier moves while the outline stays (the c-plus Captain) | fixed by the "jaw rule" `J.pts`/`J.y` + connectivity validator (`../../styles7/20-cplus-engine/CHANGES.md:30-34`) | Avoided by convention in the heads read (Commander, You, Stubborn): the jaw offset is applied to chin points of the one head blob (§5). Not enforced; check the open-mouth faces on the turnaround sheet (`shock`/`rage` columns). |
| **Handshake misses** — two palms guessed separately | fixed by `ST.meet` (both arms to one world point, slide or report) (`../../styles7/20-cplus-engine/CHANGES.md:24-28`) | Partially: film 1 solves one hand onto the other's palm (`ST.reachPalm`, 1.3 px), film 3 aims a wrist at a solved point (`reachTo`, no palm offset), film 2 moves the scenery to the palm. No two-sided solve, no reach report: an out-of-reach target is silently clamped by the IK (`rig.js:43`). Stage people within reach (C arm 162–242 units). |
| Hands through faces | continuous guard + `ST.touch` | one-shot guard slide; touching the own face requires forcing layer 2 and accepting a hand inside the head box |
| Doubled stroke on limbs | removed | C never doubles strokes |
| Elbow flip when a target lines up with the pole | blends to a hanging elbow | `ST.ik` falls back to `[u₁, −u₀, 0]` as the pole when the projected pole is degenerate (`rig.js:46-47`); a flip can happen between frames (not checked) |

Also seen in development: the back-of-head band that reads as a mask (style C rule,
`../../styles7/10-dancing-plague-both/NOTES.md:36-37`); props held "near" instead of on the hand; a raised near arm across
the face (prevented by layer 1).

**Upgrade path**: `../../styles7/20-cplus-engine/` is the fixed engine with the full contract
(`../../styles7/20-cplus-engine/CHARACTER_CONTRACT.md`): `ST.defineCharacter`, `ST.torso`/`A.fit`, measured head box,
jaw rule, `ST.touch`, `ST.meet`, `ST.handAtWorld`, and a Node validator suite (`tools/validate.mjs`: anchors,
connectivity, tangle, contact, continuity). It is **not** part of C-CAM (it carries the c-plus look). Porting the C
cast onto it means rewriting each `draw` to the contract (porting notes:
`../../styles7/20-cplus-engine/NOTES.md:34-40`). Recommended for ReelForge as a later step
([07 §11](07-REELFORGE_INTEGRATION.md#11-task-breakdown-paste-into-planmd)).

## 10. How to test a character

- Open `films/<film>/test.html`: every `ST.CAST` entry gets a sheet of 6 yaws × rows `stand, akimbo, jig, flail,
  point R` (+ `extraRow`) + 6 faces (`films/03-apollo-11/js/test-page.js:7-17`). Background figures (`crowd.js`) and the
  cat are not in `ST.CAST` and are not on the sheet.
- Capture: `node films/<film>/tools/shoot.mjs "<abs path>/films/<film>/test.html" out.png "window.__test.all(0.5)"`
  (or `window.__test.sheet('commander')`). The tool prints console errors and exits 1 on any
  (`films/03-apollo-11/tools/shoot.mjs:12-29`).
- What to look for: torsos that face the wrong way in 3/4/profile; hands on or across the face; arms rooted in the
  chin/jowls; a floating chin with the mouth open (shock column); the back-of-head mask band; shoes not turning with
  the view; the near hand drawn behind the body.
- Existing proofs: `films/01-samurai-edo/proof/turnarounds.png`, `films/02-papal-conclave/proof/turnarounds.png`.
- There is **no automated check** in C (no validator); the c-plus suite is the path for one.

## 11. Off-rig characters and crowds

- **Animals** are drawn by their own function, not on the human rig: the cat (`films/01-samurai-edo/js/cast/cat.js:25-50`,
  modes walk/sit/jump, own eyes via `ST.eye` with `bag: false`). There is no shared animal rig in C (a goat or horse
  would be another hand-built function).
- **Background people** (`crowd.js` in every film) use a small shared `D` (`sw 30, sy −250 …`) on the real rig (arms
  2-bone, far arm behind), a flat body per `kind`, dot eyes, no hatching (`films/02-papal-conclave/js/cast/crowd.js:1-70`).
  They are simplified on purpose and are the generic part of the style ([08](08-KNOWN_ISSUES_AND_BACKLOG.md)).

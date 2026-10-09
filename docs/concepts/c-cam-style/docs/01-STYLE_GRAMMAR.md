# 01 · Style grammar — the rulebook for drawing NEW material in C-CAM

Use this when you draw a character, a set, a prop or a shot that does not exist yet. The style is a **grammar**, not a
catalogue: every film gets new, hand-built people and places that obey these rules (the same principle ReelForge applies
to all worlds, `docs/worlds/DECISIONS.md:67-75`). Numbers are measured from the code; `films/…` paths are relative to
the C-CAM folder. Inherited rulebooks: style 07 (`../../styles7/07-great-stink-london/NOTES.md`, proportions, face
build, costume) and style C (`../../styles7/10-dancing-plague-both/NOTES.md`, grit and anatomy). Where the films differ
from those notes, the code wins and is cited.

Related: [04-CHARACTER_GUIDE](04-CHARACTER_GUIDE.md) (how to build a person), [05-CAMERA_GUIDE](05-CAMERA_GUIDE.md)
(framing), [03-API_REFERENCE](03-API_REFERENCE.md) (the brushes).

---

## 1. Canvas and units

| Fact | Value | Source |
|---|---|---|
| Frame | 1920 × 1080 canvas 2D | `films/03-apollo-11/js/core.js:6-7` |
| Clock / playback | 24 fps (`ST.FPS`) | `films/03-apollo-11/js/core.js:8` |
| Acting rate | 12 fps, "on twos" (`ST.ANIM`) | `films/03-apollo-11/js/core.js:9` |
| World units | 1 unit = 1 px at camera zoom 1; sets are drawn in a 1920×1080 world and usually extend to x −300…2300, y −300…1300 | e.g. `films/01-samurai-edo/js/sets/sets-a.js:26,37` |
| Figure units | origin at the feet, y up is negative; a standing adult is 640–860 units tall and is drawn at scale `s` 0.6–1.0 (wide/medium), 1.25–4.2 for over-the-shoulder backs and foreground figures | heights in §5; scales e.g. `films/02-papal-conclave/js/shots/shots-c.js:29` |

## 2. Line

C has **one** line: `ST.inkLine`, a filled ribbon (never `ctx.stroke` with a constant width) whose width swells and
pinches along the arc length (`films/03-apollo-11/js/brushes.js:71-100`).

- **Width modulation**: `w = base · (0.4 + 1.25·k² + 0.25·n₂)` where `k` is seeded value noise over every 30 px of arc
  length and `n₂` a second, faster noise over every 9 px (`brushes.js:83-84`). Range ≈ **0.4×–1.9×** of the nominal width.
- **Taper**: open strokes taper at both ends, `min(1, 0.12 + 2.2·sin(π·i/(n−1)))` (`brushes.js:85`); pass `taper: false`
  for flat-ended marks (belts, ropes, slats, rain).
- **Camera/figure scaling**: inside the camera the width multiplier is `ST.LW = z^-0.55` (`brushes.js:18`); inside a
  figure `ST.LW = (s·z)^-0.55` (`brushes.js:27`). Because the drawing is also scaled by `s·z`, the **on-screen width is
  `w · (s·z)^0.45`**: lines thicken only gently in close-ups (a 7-px outline is 6.7 px for a figure at s 0.9, z 1, and
  ≈ 10.9 px at s 0.9, z 3).
- **Nominal widths used in the films** (code defaults in brackets):

| Element | `lw` / `w` | Examples |
|---|---|---|
| Body/costume silhouette | 7–8 (blob default 7) | `films/02-papal-conclave/js/cast/stubborn.js:33`, `films/03-apollo-11/js/cast/commander.js:23` |
| Head outline | 7 (`FACE.lw`) | `films/01-samurai-edo/js/cast/you.js:52` |
| Arms/legs/hands | 6–7; hands 0.9 × arm `lw` | `films/03-apollo-11/js/rig.js:86`, `ARM`/`LEG` consts in every cast file |
| Ears, nose, hair, small props | 4–6 | `you.js:54,61,75` |
| Eyes | 5 (lid line 1.5× = 7.5) | `films/03-apollo-11/js/face.js:76-80` |
| Brows | thick 7–15 (default 14) | `face.js:95`, `you.js:69`, `commander.js:49` |
| Wrinkles, folds, crow's feet, cleft | 3–4.5 (stroke default 4.5) | `brushes.js:102`, `commander.js:50,71,74` |
| Architecture (`ST.rough`) | 5 (default), 6 for big walls | `brushes.js:231`, `films/01-samurai-edo/js/edo.js:13` |
| Background crowd | 5, flat | `films/01-samurai-edo/js/cast/crowd.js:22` |
| Hatching strokes | 2.8 × LW (default), plain `ctx.stroke` with round caps | `brushes.js:139-156` |

- **Doubled strokes are NOT part of C.** They belong to c-plus and were explicitly not ported
  (`films/01-samurai-edo/NOTES.md:17`, `films/03-apollo-11/NOTES.md:19-20`).
- No outline on purely tonal shapes: shade/rim crescents, mottling, stains, pools, foreground silhouettes use `lw: 0`.

## 3. Palette and values

The base palette is `ST.C` (`films/03-apollo-11/js/core.js:93-103`), 46 named colours, "olive, clay, grey-blue,
mustard, rust. Nothing pastel; whites are dirty" (`core.js:92`). Each character adds its own local tones (e.g. the
cardinal's skin `#bf8b6b` / `#91604a`, `films/02-papal-conclave/js/cast/stubborn.js:8`).

| Family | Swatches (hex) |
|---|---|
| Ink / frame clear | `INK #16120e` (also the frame clear colour, `films/03-apollo-11/js/timeline.js:44`) |
| Skins (base / shade) | ruddy `#b07a62/#86533f`, sallow `#b4a17a/#8a7954`, clay `#a26c52/#784a36`, olive `#9b8a62/#71633f`, grey `#a39880/#7a705b` |
| Cloth | olive `#646238`, clay `#8a5a40`, grey-blue `#526068`, mustard `#9b8236`, rust `#83402a`, brown `#5a4736`, linen `#ada385`, black `#2a2623`, plum `#55404a`, fur `#6e5640` (+ `_D` shades) |
| Materials | stone `#7d7766`, timber `#3d2e22`, plaster `#9c9273` |
| Accents | red `#b02e26`, gold `#c29632`, fire `#e0a443` (+ `_D`) |
| Face parts | eye white `#d9d0b4`, mouth `#2c110d`, tongue `#7f3b33`, tooth `#cdbd8c` / `#a08f5c` |

Rules:
1. **Every fill is a muddy mid value**; the lightest colours are dirty linen / bone (`#cdbf94`, `#e2d8b8` for captions),
   never pure white; the darkest is `INK`, never pure black.
2. **One shade colour per fill**, written as a `_D` partner and used for the shade crescent, cuffs and leg cloth.
3. **One warm light per set**, drawn as a stepped pool behind the figures (`ST.pool`, 3 concentric ellipses at the same
   alpha, `brushes.js:256-265`), alphas 0.07–0.18 in the films (e.g. `films/01-samurai-edo/js/sets/sets-a.js:10,27`,
   `films/02-papal-conclave/js/sets/sets-b.js:96`). Darkness = `ST.gloom` (a flat layer with a stepped hole,
   `brushes.js:267-277`; unused in the three films).
4. **One accent object per shot.** Film 2 reserves gold for the bell, chalice, key and tiara
   (`../../styles7/18-papal-conclave/c-base/NOTES.md:23-24`); film 3 reserves red for the alarm lights and the fuel
   warning (`../../styles7/19-apollo-11/c-base/NOTES.md:10-12`); film 1 rotates one accent per shot (sword gleam,
   seals, CLACK, koban, ledger, hat, cat — `../../styles7/17-samurai-edo/c-base/NOTES.md:22`).
5. Translucent colours are written as `rgba(...)` for grime, hatching and stains only (never for a body fill).

## 4. Grit and grime vocabulary (all flat shapes, never a texture or filter)

| Mark | How | Code |
|---|---|---|
| Shade crescent | the shape minus itself shifted by (dx, dy), flat colour | `blob` option `shade: [col, dx, dy]`, `brushes.js:110-122,171` |
| Rim/lit crescent | same with a lighter colour | `light: [col, dx, dy]`, `brushes.js:172` |
| Inner patch | the shape scaled by k and offset (cheek, highlight) | `patch: [col, dx, dy, k]`, `brushes.js:173-178` |
| Mottling | n seeded 7-point blobs inside the bbox | `mottle: [col, count, size]`, `brushes.js:124-137` |
| Hatching | clusters of k bent parallel strokes | `hatch: { c, n, k, len, gap, ang, bend, w }`, `brushes.js:139-156` |
| Stain | flat irregular blob, drips downward | `ST.stain`, `films/03-apollo-11/js/grime.js:8-15` |
| Peeled plaster | jagged hole showing brick courses | `ST.peel`, `grime.js:17-26` |
| Crack | 5-point ink polyline | `ST.crack`, `grime.js:27-38` |
| Stubble | short dashes clipped to a region | `ST.stubble`, `films/03-apollo-11/js/face.js:150-166` |
| Wart / mole (+ hair) | lumpy blob with a hair stroke | `ST.wart`, `face.js:168-171` |
| Pores / pock marks | tiny dark rectangles | `ST.pores`, `face.js:173-176` |
| Flies | 6 dashes jittering on twos | `ST.flies`, `grime.js:93-97` |

Typical doses measured in the cast files: torsos `hatch n 6–9, k 3, len 34–60`, faces `hatch n 3–4, len 16–18` and
`mottle 6 blobs of size 8–12` (`films/01-samurai-edo/js/cast/you.js:30,52`,
`films/02-papal-conclave/js/cast/stubborn.js:33,50`). Every costume gets at least one stain (soup on a rochet, ink on a
kimono: `stubborn.js:46`, `you.js:48`).

**Never:** watercolour, paper texture, noise, blur, gradients, canvas `filter` (none appear in the code; the style 07
and C rulebooks forbid them: `../../styles7/07-great-stink-london/NOTES.md:37`,
`../../styles7/10-dancing-plague-both/NOTES.md:21`).

## 5. Proportions and the body

Pick **one exaggeration axis** per character and push it (style 07 §1). Measured from the `D` objects of every
hand-built character (`films/*/js/cast/*.js`, line 9–11 of each file):

| Character | Height (units) | Head box h | Head : body | Shoulder width | Arm (l1a+l2a) | Leg (l1l+l2l) | Axis |
|---|---|---|---|---|---|---|---|
| 01 you | 810 | 210 | 1 : 3.9 | 92 | 220 | 324 | thin, sloped shoulders, long neck |
| 01 elder | 860 | 220 | 1 : 3.9 | 100 | 240 | 346 | gaunt, tall |
| 01 merchant | 760 | 230 | 1 : 3.3 | 116 | 202 | 290 | smug pear |
| 01 keeper | 720 | 220 | 1 : 3.3 | 128 | 218 | 270 | squat labourer |
| 02 stubborn | 712 | 242 | 1 : 2.9 | 212 | 200 | 230 | barrel-chested wedge |
| 02 mayor | 690 | 238 | 1 : 2.9 | 184 | 184 | 212 | brick |
| 02 gregory | 640 | 240 | 1 : 2.7 | 128 | 162 | 182 | round pilgrim |
| 02 tired | 836 | 200 | 1 : 4.2 | 116 | 242 | 318 | drooping pear, horse face |
| 03 commander | 800 | 202 | 1 : 4.0 | 140 | 222 | 314 | wardrobe, neck as wide as the head |
| 03 guidance | 830 | 210 | 1 : 4.0 | 88 | 240 | 340 | tall, narrow |
| 03 orbiter | 800 | 240 | 1 : 3.3 | 104 | 206 | 296 | pudgy |

(Head box = the hand-set face-guard box `D.head.bottom − D.head.top`, which includes hats.) Range in practice:
**1 : 2.7 to 1 : 4.2**; shoulder width varies **88–212**; the three mains of a film differ clearly in silhouette
(style 07 lineup test: heights differ, hats/shoulders differ).

Body rules (enforced by the shared rig, see [04-CHARACTER_GUIDE](04-CHARACTER_GUIDE.md)):
- **Torso drawn by hand for each of 4 views** (front, 3/4, profile, back) — different silhouettes, closures shifted
  toward the facing side in 3/4, on the front edge in profile, seams/pleats only on the back
  (`../../styles7/10-dancing-plague-both/NOTES.md:27-32`; e.g. `films/02-papal-conclave/js/cast/stubborn.js:12-30`).
- **Turns walk the ring** front → 3/4 → profile → back one view per animation frame (`ST.turn`,
  `films/03-apollo-11/js/rig.js:18-29`); mirrored views (facing screen-left) are the same drawing flipped.
- **Arms and legs are 2-bone IK in body space**, never hand-placed angles (`rig.js:41-60`). Hands 1.3–1.8× realistic
  ("mittens"): `hsz` 32–42 units (`ARM` consts).
- **Far limbs behind the torso, raised hands behind the head, near arm in front** (`ST.armLayer`, `rig.js:132`).
- **No hand on a face** unless forced (`guard`, `rig.js:109-116`).

## 6. Face construction

Order (style 07 §2, kept by every head function, e.g. `films/03-apollo-11/js/cast/commander.js:64-77`):
back ear / hair mass → lumpy head blob (13–18 control points, wider at jowl or dome) with `FACE` = shade crescent +
mottle + face hatching → stubble/pate/hair → cap or hat body → eyes (+ brows + crow's feet) → cheek lines → **nose
last** (a separate blob over eyes and mouth) → mouth (the commander draws the mouth after the nose) → chin cleft, scar,
wart → headwear on top.

Parts (all in `films/03-apollo-11/js/face.js`):
- **Eyes** (`ST.eye`, :41-86): dirty-white egg, one eye 5–10 % bigger (`you.js:68,71` 13 vs 14), **tiny pupil**
  `max(rx·0.14·pup, 2.2)` px, heavy skin-coloured upper lid (deadpan lid 0.58), thick lid line, one or two bag
  strokes (`bags: 2` = double bag), optional lower-lid squint. In 3/4 the far eye is 0.6–0.72 wide.
- **Brows** (`ST.brow`, :89-96): one tapered brush stroke each; `[raise, knit]` per side comes from the expression.
- **Mouth** (`ST.mouth`, :100-147): closed = a crooked brush line with corner ticks; open = dark hole + tongue + uneven
  yellow teeth (`teeth: 'few'|'snag'|'gap'|'row'|'none'`), optional underbite teeth `under`.
- **Skin marks**: `ST.stubble`, `ST.wart` (with hair), `ST.pores`, broken-vein patches as flat `rgba` red blobs
  (`stubborn.js:58-63`).

**Expression vocabulary** — 14 entries in `ST.EXPR` (`face.js:10-25`):

| Name | lid | eye | pupil | mouth | jaw | note |
|---|---|---|---|---|---|---|
| deadpan (default) | 0.58 | 0.96 | 1 | flat | 0 | the resting face of the style |
| miserable | 0.62 | 0.95 | 1 | frown | 0 | look down |
| exhausted | 0.78 | 0.95 | 1 | open | 0.35 | look down |
| shock | 0 | 1.3 | 0.5 | open | 0.9 | brows +1.1 |
| rage | 0.3 | 1.06 | 0.7 | snarl | 0.5 | knit 1.1, squint |
| smug | 0.66 | 0.98 | 1 | smirk | 0 | one brow up 0.7 |
| scared | 0.02 | 1.2 | 0.5 | wavy | 0.3 | inner brows up |
| confused | 0.32 | 1.04 | 0.9 | twist | 0.08 | brows opposite |
| sad | 0.5 | 1 | 1 | frown | 0 | inner brows up |
| yelling | 0.12 | 1.16 | 0.6 | yell | 1 | knit |
| disgust | 0.5 | 1 | 1 | twist | 0.22 | one-sided squint |
| grin | 0.4 | 1 | 1 | grin | 0.4 | |
| asleep | 1 | 1 | 1 | open | 0.25 | no blink |
| focused | 0.44 | 1 | 0.85 | flat | 0 | squint 0.2 |

**Visemes: C has none.** Speech is a jaw flap: per 1/12 s frame the jaw is 0.05 (22 % of frames, "closed gap") or
0.25–0.95 (`ST.talk`, `films/03-apollo-11/js/core.js:74-83`); while talking a `flat`/`frown` mouth becomes `open`
(`face.js:35`). Blinks: one per ~3.4 s at a hashed moment, lids closed for 0.17 s then half-closed to 0.25 s
(`core.js:85-90`). Visemes (A E I O F M) exist only in the c-plus engine (`../../styles7/20-cplus-engine/NOTES.md:41`).

Faces must be **ugly-lovable and specific**, balanced (Papi on the c-plus faces: "interesting but sometimes over the
top - balance it, more grim realism than goofy caricature", `../../styles7/19-apollo-11/c-plus-faces/CHANGES.md:9`);
pick 4–6 grit marks per face (`../../styles7/10-dancing-plague-both/NOTES.md:14-16`).

## 7. Costume tells the character

Era + job = costume and props; one loud prop or tell per character, and every prop gets a gag use
(`../../styles7/07-great-stink-london/NOTES.md:28-31`). In the films: the notebook of grievances that becomes a tiny roof
(`films/02-papal-conclave/js/cast/stubborn.js:134-138`, used in `films/02-papal-conclave/js/shots/shots-d.js:32`), the
huge brass key (`films/02-papal-conclave/js/cast/mayor.js:110-118`), the gum bubble (`films/03-apollo-11/js/props.js:116-120`),
the two swords that a cat sits on (`films/01-samurai-edo/js/shots/shots-d.js:113`). Silhouette-defining headwear
(skullcap, jingasa, comm cap).

## 8. Backgrounds (sets)

Recipe used by every set function (`films/01-samurai-edo/js/sets/*.js`, `films/02-papal-conclave/js/sets/*.js`,
`films/03-apollo-11/js/sets/*.js`):
1. **Sky** = flat bands with wavy seams, 3–5 colours, no gradient (`ST.bands`, `brushes.js:237-247`), or a wall.
2. **One warm pool** (`ST.pool`) behind where the figures will stand.
3. **Architecture** with hand-wobbled edges: `ST.rough` / `ST.rect` / `ST.beam`, always with `shade`, `mottle` and
   `hatch` options on big surfaces; specific materials (tatami, shoji, plank walls, stone courses via `ST.bricks`,
   riveted panels).
4. **Grime**: 2–5 stains per wall, a peel, a crack, a puddle (`films/02-papal-conclave/js/sets/sets-b.js:35-38`).
5. **Floor plane** of its own material (tatami `films/01-samurai-edo/js/edo.js:43-54`, cobbles, dirt `edo.js:100-105`,
   moon ground `films/03-apollo-11/js/lunar.js:28-38`).
6. **Clutter that tells the place** (papers, ledgers, candle stubs, cobwebs, tally marks, switches, gauges).
7. **Coverage beyond the frame**: draw from about x −300 to 2300 and y −300 to 1300 and add explicit "set extensions"
   where a camera looks further (`films/02-papal-conclave/js/sets/sets-b.js:13,33,74`). The camera must never see an
   edge (see [05-CAMERA_GUIDE](05-CAMERA_GUIDE.md) §6).
8. **Foreground pieces after the figures** (table front, console front, quilt): `ST.hallTable`
   (`sets-b.js:115-125`), `ST.controlFront` (`films/03-apollo-11/js/sets/sets-c.js:43`), `ST.futonQuilt`
   (`films/01-samurai-edo/js/sets/sets-a.js:50-54`).
9. **Background people** are deliberately simple (flat plane colour, no hatching, dot eyes) so the cast reads in front
   (`films/01-samurai-edo/js/cast/crowd.js:1-4`).

## 9. Captions and lettering

- **Captions** (narration burned in): bold 46 px Arial Black, fill `#e2d8b8`, ink outline `#16120e` 11 px, centred at
  x 960, last line on y 1010, 58 px line spacing, wrapped at 1500 px (`films/03-apollo-11/js/timeline.js:27-38`). On/off
  with `C` or `?captions=0`.
- **Poster title**: letters "thud" in one by one on twos (0.04–0.06 s apart, 18 px drop for 0.09 s), each rotated
  ±4° plus a base rotation, bone fill `#cdbf94`, rust extrusion `#5c2616`, ink outline (`ST.posterWord`,
  `films/03-apollo-11/js/shots/shots-a.js:9-37`).
- **In-world labels** via `ST.label` (`brushes.js:307-323`): signs, sound words (CLACK, `films/01-samurai-edo/js/shots/shots-b.js:83`),
  dials. Default face `Impact, 'Arial Black', sans-serif` (`brushes.js:311`).
- **All of these use system fonts** (Impact, Arial Black, Arial, Georgia, Courier New), which ReelForge does not allow
  (CLAUDE.md §6). The full list and the replacement plan are in [07-REELFORGE_INTEGRATION §9](07-REELFORGE_INTEGRATION.md#9-fonts-and-licences).
  When drawing new material for the port, letter text with the replacement (single-stroke CC0 lettering drawn with the
  ink line), never with `fillText`.

## 10. Motion and timing

| Rule | Implementation |
|---|---|
| Characters act **on twos** (12 fps): poses, positions, turns, head jolts are functions of `tt = ST.twos(t)` | `core.js:52`; e.g. `films/01-samurai-edo/js/shots/shots-d.js:63-84` |
| The camera and the film clock run at 24 fps (moves are smooth) | `films/03-apollo-11/js/camera.js:12`, `player.js:15` |
| Expression changes **snap** (no blends) | `ST.step(t, [[t0, 'expr'], …])` (`core.js:67-71`), used as `S(t, …)` |
| Shock = one-frame snap + head jolt `headDy` −10…−22 for 0.2 s | `films/03-apollo-11/js/shots/shots-a.js:81`, `films/02-papal-conclave/js/shots/shots-d.js:30` |
| Default acting is deadpan; long holds | `face.js:11`, `../../styles7/10-dancing-plague-both/NOTES.md:17-18` |
| Moves ease in/out; `out` for landings, `back` for pops | `ST.key` eases `lin | inOut | out | back` (`core.js:45-50,55-65`) |
| Repeated actions on a hashed or fixed beat: stamping every 0.5 s, chewing 6 Hz on twos, rain dashes on twos | `films/01-samurai-edo/js/shots/shots-b.js:14`, `commander.js:57`, `films/02-papal-conclave/js/sets/sets-b.js:134-145` |
| Hard cuts between shots, "like a TV show"; cuts inside a shot land on beats | `films/01-samurai-edo/js/film.js:1`, [05-CAMERA_GUIDE](05-CAMERA_GUIDE.md) |

Anticipation in C is light: a bow eases out to its depth then holds (`films/01-samurai-edo/js/shots/shots-c.js:78-79`);
a pop uses `ST.ease.back` (`films/03-apollo-11/js/shots/shots-a.js:128`). There is no squash-and-stretch system.

## 11. What NOT to do (anti-patterns)

From the inherited rulebooks and from what went wrong during development:
1. **Texture or filter effects** (watercolour, paper, noise, blur, canvas `filter`, gradients) — never.
2. **Generic faces** or a face/character generator: every person is drawn by hand in their own function; only brushes,
   rig, poses and face *primitives* are shared (`../../styles7/10-dancing-plague-both/CHANGES.md:30`).
3. **Uniform line width**; `ctx.stroke` outlines on bodies.
4. **Arm across the face**; a hand "near" a prop instead of on it (solve the palm, draw the prop there, close the hand
   over it) (`../../styles7/07-great-stink-london/NOTES.md:54-56`).
5. **Light pool drawn over a figure** (looks like a filter) — pools go behind (`../../styles7/07-great-stink-london/NOTES.md:54`).
6. **A band across the back of the head** (reads as a mask/visor); fill the back head with hair
   (`../../styles7/10-dancing-plague-both/NOTES.md:36-37`).
7. **Flipping 180° in one frame**; always walk the view ring.
8. **More than one accent** per shot; pastel or clean pink skin; pure black/white.
9. **Over-the-top caricature** (Papi rejected the "pig snout" nose blobs and "goofy" faces of c-plus-faces):
   `../../styles7/19-apollo-11/c-plus-faces/CHANGES.md:9,30`.
10. **Polishing the roughness away** — the slightly crude hand-made drawing is the point
    (`docs/worlds/DECISIONS.md:33-37`).
11. **A camera that moves for no reason or crops the subject** (QUALITY.md §1.10, `docs/worlds/QUALITY.md:19`); Dutch
    tilt outside tense beats.
12. **Scratch canvases / module state** in scene code — it broke determinism in film 1
    ([08](08-KNOWN_ISSUES_AND_BACKLOG.md)).

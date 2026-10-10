# 05 · Camera guide — the "CAM" in C-CAM

The camera is the one thing C-CAM adds to style C (`films/03-apollo-11/NOTES.md:3-6`). It is a 2-D affine camera
over a hand-drawn world: no 3-D, no parallax layers, no lens effects. Everything in the world (characters, hands,
props) is placed in world coordinates first; the camera only transforms the frame. Papi called this camera work the
"masterpiece" part of the style (Manager's work packet, 2026-10-09).

Related: [01-STYLE_GRAMMAR](01-STYLE_GRAMMAR.md), [03-API_REFERENCE §3](03-API_REFERENCE.md#3-camera-brushesjs--camerajs),
[06-FILM_AUTHORING](06-FILM_AUTHORING.md).

---

## 1. `ST.camera(ctx, cx, cy, z, rot)`

`films/03-apollo-11/js/brushes.js:11-19`:
```js
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.translate(ST.W / 2, ST.H / 2);            // frame centre (960, 540)
if (rot) ctx.rotate((rot * Math.PI) / 180);   // Dutch roll, degrees, + = clockwise
ctx.scale(z, z);                              // zoom
ctx.translate(-cx, -cy);                      // world point (cx, cy) → frame centre
ST.camZ = z; ST.LW = Math.pow(z, -0.55);      // ink gets relatively thinner when zooming in
```

| Field | Meaning | Values in the films |
|---|---|---|
| `cx, cy` | world point at the frame centre (world = 1920×1080 at z 1, so `960, 540` = the neutral frame) | 0 … 1820 / 0 … 1330 |
| `z` | zoom; 1 = the whole 1920×1080 world | 0.8 – 5.4 |
| `rot` | roll in degrees (Dutch tilt), applied before the zoom so the frame rotates about its centre | −7 … +7 |

The call **resets** the transform, so it must be the first thing a shot does; nothing drawn before it survives a
transform change except what is drawn in screen space on purpose. On-screen ink width scales as `z^0.45`
([01 §2](01-STYLE_GRAMMAR.md#2-line)).

**Visible world rectangle** for a framing (useful to check set coverage): half-width
`(960·|cos r| + 540·|sin r|) / z`, half-height `(960·|sin r| + 540·|cos r|) / z` around `(cx, cy)` (follows from the
transform above). Example: film 2's looking-up framing `(1820, 160, 1.5, −7°)` sees x ≈ 1141–2499, y ≈ −275–595, which
is why the hall roof and wall got "set extensions" to x 2700 (`films/02-papal-conclave/js/sets/sets-b.js:13,33,74`).

## 2. The three cut-table dialects

Each film carries its own `camera.js` (the c-plus camera was ported three times independently). All three express
"hard cuts **inside** a shot, each framing possibly moving", but with different shapes:

| | Film 1 `ST.cutCam` / `ST.cutFrame` | Film 2 `ST.cut` + `ST.camera` | Film 3 `ST.cutCam` |
|---|---|---|---|
| File | `films/01-samurai-edo/js/camera.js:9-25` | `films/02-papal-conclave/js/camera.js:32-37` | `films/03-apollo-11/js/camera.js:9-15` |
| Table | `[[at, end, a, b?], …]`, frame `a`/`b` = `[cx, cy, z, tilt]` | shot def `cuts: [[at, name], …]` | `[{ at, x, y, z, rot }, …]` |
| Move inside a framing | a → b with `ease.inOut((t − at)/(end − at))` | written by the shot: `ST.camera(ctx, K(t, …), …)` per name | each field a number or `ST.key` keys |
| Cut chosen on | twos (`ST.twos(t) >= at`) | twos | raw `t` |
| Returns | framing index | `{ name, t0 }` | framing index |
| Proof tool support | — | `tools/proof.mjs` samples the middle of every cut (`films/02-papal-conclave/tools/proof.mjs:19-31`) | — |

Same framing written in each dialect (a 1.0 → 1.1 push-in held from 0 to 4 s):
```js
// film 1
ST.cutCam(ctx, t, [[0, 4, [960, 540, 1.0], [960, 540, 1.1]]]);
// film 2 (shot def has cuts: [[0, 'wide']])
const cut = ST.cut(t, this.cuts).name;
if (cut === 'wide') ST.camera(ctx, 960, 540, ST.key(t, [[0, 1.0], [4, 1.1]]));
// film 3
ST.cutCam(ctx, t, [{ at: 0, x: 960, y: 540, z: [[0, 1.0], [4, 1.1]] }]);
```

Recommendation for the port: **film 3's object form** (named fields, any field keyable with its own easing, optional
`rot`) plus film 2's **names** (`{ at, name, x, y, z, rot }`) so a shot can restage per framing by name and a proof
tool can sample every framing; choose the cut on twos (films 1–2) so cuts land on acting frames
([07 §6](07-REELFORGE_INTEGRATION.md#6-camera-and-cuts)).

## 3. Rhythm: cuts, beats and the 12 fps acting

- **Cut times are beat times** inside the shot and most of them coincide with the caption lines. Film 3: lander cut
  at 3.0 = the line "Its walls are famously thin." at 3.0; alarm 2.4 = line 2.4; window 3.0 = line 3.0; orbit 2.2 =
  line 2.2; payoff 1.4 = line 1.4 (`films/03-apollo-11/js/film.js:7-17` vs `shots/*.js`). Film 2: choice cuts 1.75 and
  3.4 vs lines 1.7 and 3.4 (`films/02-papal-conclave/js/film.js:16`, `shots/shots-d.js:44`).
- **Quantisation**: with selection on twos, a cut at `at` appears on the first 1/12 s step ≥ `at` (a cut at 2.4 shows
  from 29/12 ≈ 2.417 s). To land exactly, write cut times as multiples of 1/12 (e.g. 2.4167) or accept the round-up.
- **Moves inside a framing run on the film clock** (24 fps, smooth); the acting stays on twos. A framing typically
  lasts **0.4–2.4 s** (film 1 `wake`: 2.4 / 1.0 / 0.5 / 2.1 s) and an ECU 0.4–1.5 s.
- Every framing holds **one focal point** placed off-centre (`films/02-papal-conclave/NOTES.md:16`).
- Hard cuts **between** shots are unchanged from c-base (`films/03-apollo-11/NOTES.md:3-5`).

## 4. Shot types used (catalogue)

| Type | Zoom | Typical use | Examples (file:line) |
|---|---|---|---|
| Wide / establishing | 0.8 – 1.2 | set the place, group action, the "ruined day" pull-back | `films/02-papal-conclave/js/shots/shots-d.js:16` (0.8), `films/01-samurai-edo/js/shots/shots-d.js:70` |
| High wide | 0.86 – 1.0, `cy` above centre | the whole table/hall | `films/02-papal-conclave/js/shots/shots-a.js:116`, `shots-d.js:78` |
| Low angle | 0.92 – 1.5, figure scaled up and feet below frame (`y` 1150–1420), small roll | power: Mayor, door, touchdown | `films/02-papal-conclave/js/shots/shots-b.js:51,54`, `films/03-apollo-11/js/shots/shots-c.js:76` |
| Medium / two-shot | 1.3 – 1.6 | exchange, reaction pair | `films/03-apollo-11/js/shots/shots-c.js:15`, `films/02-papal-conclave/js/shots/shots-c.js:44` |
| Close-up (CU) | 1.7 – 2.6 | faces, the reaction beat, off-centre | `films/03-apollo-11/js/shots/shots-b.js:59-60`, `films/02-papal-conclave/js/shots/shots-c.js:18` |
| Extreme close-up / insert | 2.4 – 5.4 | the gag object: gleam, CLACK, coins, key, bell, tally, ledger "YOU", alarm, glove | `films/01-samurai-edo/js/shots/shots-a.js:64`, `films/02-papal-conclave/js/shots/shots-c.js:85` (5.0–5.4), `films/03-apollo-11/js/shots/shots-b.js:14` |
| Push-in | z rises 5–40 % within a framing | tension, realisation | `films/01-samurai-edo/js/shots/shots-a.js:65` (2.2 → 2.8) |
| Pull-back | z falls within a framing | reveal, loneliness | `films/01-samurai-edo/js/shots/shots-d.js:45`, `films/03-apollo-11/js/shots/shots-c.js:97` (1.9 → 1.0) |
| Pan / tracking | cx moves at constant z | along desks, a strut | `films/01-samurai-edo/js/shots/shots-b.js:19,57` |
| Dutch tilt | `rot` 2–7° | tense beats only | §5 |
| Over-the-shoulder (OTS) | a cast member's back drawn huge in the foreground | reading, looking out | §7 |
| Foreground silhouette | flat near-black shape at the lens | depth, peeping | §7 |
| Reverse angle | the next framing restages the set from the other side | face at the window | `films/03-apollo-11/js/shots/shots-b.js:87-98` |
| Shake | ±8 px on twos for 0.2 s added to `cy` | impact | `films/03-apollo-11/js/shots/shots-c.js:75-76` |

## 5. Dutch tilt rules

- Range **2–7°**, sign varies from framing to framing (film 2: −2, −6, 3, −4, 7, 2, −3, −3, 4, −2, −5, 2, 3, 7, −3,
  −7, 5, −4, −3, −4 and an animated 0 → −6 roll on the grille).
- **Only on tense beats**: "2-8 deg roll only on tense beats (bell, shouting, roof, grille, refusal)"
  (`films/02-papal-conclave/NOTES.md:18-19`); "Dutch tilt (3-6 deg) is used only in tense beats (alarm, 1202, boulders,
  fuel, the dent)" (`films/03-apollo-11/NOTES.md:17`); film 1 uses 2–6° (either sign) on the gleam, the blades, CLACK, the turning heads, the weight,
  the panic and the Elder's fury (`films/01-samurai-edo/CHANGES.md:3-10`).
- Calm framings, title cards and wide establishing framings are level (title posters use −2° at most:
  `films/02-papal-conclave/js/shots/shots-a.js:76`).

## 6. Contacts are solved before the camera; coverage

1. Compute every point the shot needs in **world space** first: palms (`ST.palmWorld`, `ST.reachPalm`), prop ends
   (`Y.swordEnd`), a face in a bow (`ST.figToWorld(…, ST.bowPt(…))`).
2. Use those points to **frame** (the camera centre may be a solved point) — never move a contact to suit the frame.
   Film 1 loan, `films/01-samurai-edo/js/shots/shots-c.js:83-100`:
   ```js
   const coin = ST.palmWorld(M, pM, PM, 'L');                       // the merchant's palm, world space
   const face = ST.figToWorld(pM, true, 0, ST.bowPt([34, -614], M.D.hy, bowM));
   ST.cutCam(ctx, t, [ …,
     [2.9, 3.9, [coin[0], coin[1] - 20, 3.2], [coin[0], coin[1] - 20, 3.5]],   // ECU: the hands meet
     [3.9, 5.0, [face[0] - 60, face[1] + 60, 2.3], [face[0] - 40, face[1] + 50, 2.7]], …]);
   ```
   Same pattern: the CLACK ECU frames the solved scabbard tip (`films/01-samurai-edo/js/shots/shots-b.js:53-58`),
   the key ECU frames the Mayor's palm and the keyhole is drawn at that palm
   (`films/02-papal-conclave/js/shots/shots-b.js:79-83`), the cat sits on the solved sword end
   (`films/01-samurai-edo/js/shots/shots-d.js:103-113`).
3. **Coverage**: draw the set beyond every framing's visible rectangle (§1). Film sets span roughly x −300…2300,
   y −300…1300 (`films/01-samurai-edo/js/sets/sets-a.js:26`), plus explicit extensions where a framing looks further
   (`films/02-papal-conclave/js/sets/sets-b.js:13,33,74`, noted in `films/02-papal-conclave/CHANGES.md:14-15`).
   Clip groups that must not poke out (seated people below the table: `films/02-papal-conclave/js/shots/shots-a.js:46-49`).

## 7. Foreground silhouettes and over-the-shoulder

| Technique | How | Space | Examples |
|---|---|---|---|
| `ST.fg(ctx, pts, seed, col)` | flat blob, no outline, default `#14110e` | **screen** (transform reset) | chair back `films/02-papal-conclave/js/shots/shots-a.js:127`, street corner `shots-b.js:94`, shoulder `shots-c.js:64`, door jamb `shots-d.js:61` |
| `ST.fgArm(ctx, x0, y0, x1, y1, seed)` | sleeve tube + pointing hand at the lens | screen | two accusing arms `films/02-papal-conclave/js/shots/shots-c.js:93-96` |
| `ST.fgShape(ctx, pts, seed)` | `ST.rough` near-black, no outline | **world** (after the camera) | door edge `films/03-apollo-11/js/shots/shots-a.js:84` |
| Giant background figure in near-black | `ST.crowdFigure` with all colours `#14100c`, s 3.2 | world | engineer's shoulder `films/03-apollo-11/js/shots/shots-b.js:78` |
| Crowd backs | `ST.crowdFigure` yaw 3 (back), s 2.6, dark tones | world | `films/02-papal-conclave/js/shots/shots-a.js:107` |
| `ST.silhouette` | figures drawn to a scratch canvas and filled with ink | world → composited | dream fighters and the market passer-by `films/01-samurai-edo/js/shots/shots-a.js:102`, `shots-c.js:69` (not deterministic, see [08](08-KNOWN_ISSUES_AND_BACKLOG.md)) |
| OTS back | a cast member's `draw` with `yaw: 3` (back view), large `s`, feet far below frame | world | your back `films/01-samurai-edo/js/shots/shots-d.js:54` (s 1.25, y 1330), reader `films/02-papal-conclave/js/shots/shots-c.js:29` (s 4.2, y 1900), your helmet `films/03-apollo-11/js/shots/shots-b.js:94` (s 1.7, y 1820) |

Rules seen: one silhouette per framing, only in the framing that needs it (`if (cut === 'wide')`, `if (shot === 0)`),
drawn last, dark enough to read as "closer than the scene", never covering the focal point.

## 8. Per-film framing tables

Format `x, y, z, rot` (`a→b` = moving inside the framing). Times in shot seconds.

**Film 1 — Samurai** (`films/01-samurai-edo/js/shots/*.js`; tilt shown when ≠ 0)

| Shot | Framings |
|---|---|
| title | 0–4 (960,500,1.14)→(960,540,1.0) pull-back off the poster |
| wake | 0–2.4 high wide (960,520,1.0)→(980,560,1.12) · 2.4–3.4 CU (980,600,2.2)→(950,590,2.4) · 3.4–3.9 ECU gleam (1500,712,3.4→3.8,−3) · 3.9–6 push-in (800,590,2.2)→(760,575,2.8) |
| dream | 0–1.6 low wide (960,640,1.0)→(960,610,1.12) · 1.6–3.6 blades (965,480,2.0→2.4,−6) · 3.6–6 desk pull-back (1100,500,2.0)→(1100,620,1.3) |
| office | 0–1.5 insert stamp (solved palm −80/−190, 2.0→2.25) · 1.5–3.4 pan (700→1000,560,1.12) · 3.4–4.4 CU (1700,420,2.0→2.1) · 4.4–6 (1190,520,1.45→1.55,2) |
| street | 0–2.4 tracking (solved x, 640, 1.35) · 2.5–2.9 ECU CLACK (scabbard tip, 3.2→3.5, −5) · 2.9–3.8 (mid,410,1.5→1.6,4) · 3.8–6 pull-back (mid,580→590,1.2→1.04) |
| rice | 0–1.9 (930→960,600,1.55→1.6) · 1.9–2.3 wide (1040,580,1.15) · 2.3–3.8 tilted CU (820→815,470,2.2→2.4,−3) · 3.8–6 wide pan (1000→900,580,1.0) |
| market | 0–1.9 wide + fg passer-by (980,560→540,1.0→1.06) · 1.9–3.7 insert board (1280,420,2.1→2.3) · 3.7–6 low tilted push-in (860→840,560→540,1.5→1.8,5) |
| loan | 0–2.1 wide (1000→990,600→610,1.12→1.2) · 2.1–2.9 medium (1060,640,1.5) · 2.9–3.9 ECU coins (3.2→3.5) · 3.9–5 push-in on his face (2.3→2.7) · 5–7 pull-back (1000,600→590,1.3→1.1) |
| ledger | 0–1.5 OTS (1110→1090,560→555,1.75→1.85) · 1.5–3 ECU "YOU" (3.0→3.3) · 3–6 pull-back down the list (2.4→1.5) |
| wrongbow | 0–1 wide (980,520,1.04→1.1) · 1–1.6 (1000,520,1.6,−4) · 1.6–2.4 ECU hat (1194,830,2.6→2.8) · 2.4–3.6 low tilted fury (1260→1250,360,1.9→2.1,−5) · 3.6–5 wide (980,520→530,1.0→1.06) |
| payoff | 0–1.6 wide (960→940,580,1.04→1.1) · 1.6–2.3 (520,820,1.6) · 2.3–3.2 CU cat on sword (solved end, 2.3→2.6) · 3.2–4 pull-back (960,600,1.2→1.04) |

**Film 2 — Conclave** (`cuts` names; `films/02-papal-conclave/js/shots/*.js`)

| Shot | Framings |
|---|---|
| title | poster (960,540,1.06→1.0,−2) |
| death | crowd (900→960,560,1.0→1.05) + crowd backs · bell 2.6 (1645,190,3.0→3.2,−6) · baker 3.8 (470,560,2.2→2.3) |
| hall | wide (980,430→470,0.9→0.96) + chair back · chalice 2.2 (1010,660,2.8→3.0,3) · writer 4.0 (1210→1230,520,2.2→2.4) |
| years | wide (960,500,0.96→1.0) · beard 1.5 (520,430,1.9→2.05) · tally 3.25 (1570→1610,460,3.0,−4) · shout 4.75 (1250,520,1.9→2.25,7) |
| patience | low (940→980,660,1.0→1.06,2), Mayor at s 1.5 · foot 2.5 (700,1330,2.6,−3) · face 3.5 (790,520,1.9→2.1,−3) |
| lock | door (940,640,0.92,4) + street corner · key 0.9 (palm+130,palm−10,2.9→3.1) · smirk 2.25 (600,640,2.3→2.45,−2) · grille 3.0 (960,540,1.0→1.18, roll 0→−6) |
| nopope | ots (1060→1100,520,1.1→1.16) + reader's back · groan 2.25 (610,470,2.2→2.35,−5) · shake 3.5 (1180→1200,480,2.3→2.45) |
| bread | serve (520→560,520,1.55) + shoulder · loaf 2.0 (drop+170,680,3.0,2) · sniff 2.75 (560→540,500,2.2→2.6,3) |
| refuse | fingers (1290,500,1.55→1.62) + two fg arms · chin 1.25 (1300,610,1.95→2.15,7) · page 3.4 (solved page, 5.0→5.4,−3) |
| roof | up (1820→1760,160,1.5,−7) · wide 1.75 (960,330→350,0.8→0.84) · hat 3.25 (1250,450,2.2→2.35,5) · wake 4.5 (650,450,2.2→2.4,−4) |
| choice | enter (900,480,0.92→0.95) + door jamb · me 0.9 (400,560,2.1→2.3) · door 1.75 (960,560→520,0.82→0.88,−3) · stone 3.4 (960,0,1.55→1.65) |
| payoff | vote (940,400→430,0.86→0.9) · mayor 1.5 (470→440,640,1.8→2.0,−4) |

**Film 3 — Apollo 11** (`films/03-apollo-11/js/shots/*.js`)

| Shot | Framings |
|---|---|
| title | (960,560→500,1.0→1.1) |
| pad | 0 wide (900→880,600,1.05→1.1) + door edge · 1.2 CU helmet (900,450,2.5→2.7,−4) · 2.6 thumbs up (1060→1100,560,1.3→1.42) |
| lander | 0 push-in (1000→1080,600,1.0→1.12) · 3.0 ECU finger + dent (1640,600,2.6,5) · 4.6 CU shrug (820,560,1.7→1.8) |
| computer | 0 close DSKY (800,500,1.55→1.65) · 1.2 pull back (960,540,1.0→1.05) · 3.4 CU squint (420,560,1.9,−3) |
| descent | 0 framed right (1200→1240,560,1.35→1.45) · 2.0 ECU alarm (1059,300,3.2,6) · 2.6 Dutch wide (980→1020,560,1.05→1.2,−5) |
| alarm | 0 ECU 1202 (540→548,290,2.4→2.6,4) · 2.4 flipping pages (1300→1330,640,1.45→1.6,−6) |
| control | 0 CU go (560,520,1.9) · 1.6 CU sip/nod (1180,560,1.8→1.9) · 2.9 pull back (1000→960,600,1.2→1.05) + shoulder |
| window | 0 OTS (960→990,540→570,1.0→1.1) · 3.0 boulders (1000,640,1.7→1.85,−4) · 4.6 reverse on your face (960,600,1.4,3), set restaged |
| manual | 0 two-shot (1000→1040,600,1.05→1.1) · 2.0 ECU glove (860,700,2.6→2.8,3) · 3.6 CU chewing (790,420,2.2) · 4.8 CU sweat (1400,450,2.2,−4) |
| fuel | 0 needle (560,600,1.6→1.7,−5) · 1.6 ECU armrest (1300,860,2.4) · 2.8 CU face (1500,540,1.6,5) |
| land | 0–2 `ST.camera` low push-in (960→980,520+shake,1.15→1.35) · 2.0 CU frozen (1240,500,2.0) · 2.6 ECU bubble (830,450,2.6→2.85) |
| orbit | 0–2.2 `ST.camera` pull-back (760→960,380→540,1.9→1.0) · 2.2 push-in (940→880,560,1.25→1.4) |
| payoff | 0 ECU squeeze (960,590,2.4→2.5) · 1.4 push-in (940→920,520,1.45→1.6) |

## 9. How to author a shot (camera part)

1. From the shot's narration, mark the **beats** (caption line starts, the gag moment, the reaction) — these are the
   only allowed cut times.
2. Choose **2–5 framings**: usually establish (wide/medium) → the gag object (ECU/insert) → the reaction (CU) → optional
   pull-back for the payoff. Never two adjacent framings of the same size on the same subject.
3. **Solve contacts first** in world space (§6) and keep them in variables; build the cut table from them.
4. Write the table (one dialect per film, §2); keep each framing's own move small (5–40 % zoom, ≤ 100 px pan).
5. Restage per framing when needed (`const cut = ST.cutCam(...)` / `ST.cut(...).name`): add the OTS back, the
   foreground silhouette, or a different set for a reverse angle; draw silhouettes last.
6. Tilt only tense beats (§5); keep title cards level or −2°.
7. Check coverage with the visible-rectangle formula (§1); extend the set where needed.
8. Proof: render the middle of every framing (film 2's `tools/proof.mjs` does it from `cuts`) and look at it.

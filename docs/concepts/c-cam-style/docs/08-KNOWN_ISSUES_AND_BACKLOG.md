# 08 · Known issues, limitations, backlog and Papi's taste

Real defects and limits of C-CAM as it stands in `films/`, found by reading the code and by measuring
(2026-10-09). Severity: **H** = blocks a port or breaks a rule, **M** = visible in films or costs work, **L** = hygiene.
Related: [02-ARCHITECTURE](02-ARCHITECTURE.md), [07-REELFORGE_INTEGRATION](07-REELFORGE_INTEGRATION.md).

## 1. Defects and limitations

| # | Sev | Issue | Evidence | Fix direction |
|---|---|---|---|---|
| 1 | H | **Not bit-reproducible on the default canvas**: the player's GPU-backed canvas gives 12–45 differing pixel channels (≤ 20/255) when the same frame is re-rendered | measured, [02 §6](02-ARCHITECTURE.md#6-determinism); `films/03-apollo-11/js/player.js:7` | render into a CPU-backed canvas (`willReadFrequently: true`) for anything that must match |
| 2 | H | **`ST.silhouette` breaks determinism** (film 1 daydream 10–16 s and the market passer-by): a module-level scratch canvas from `document.createElement`; the first render on a target canvas differs from later ones by ≤ 12/255 on ~1 M channels | `films/01-samurai-edo/js/sets/sets-a.js:68-86`; measured | draw silhouettes with a flat-fill override, no scratch canvas, no module state |
| 3 | H | **System fonts** (Impact, Arial Black, Arial, Georgia, Courier New) in titles, labels, captions, gauges | full list [07 §9](07-REELFORGE_INTEGRATION.md#9-fonts-and-licences) | CC0 stroke lettering drawn with the ink line |
| 4 | H | **Truecolor output** (AA, alpha) vs ReelForge's ≤ 32-colour palette snap | `packages/shared/src/palette.ts:6-7`, `packages/engine/src/gl/post-shader.ts:1-7` | engine truecolor mode ([07 §3 D1](07-REELFORGE_INTEGRATION.md#3-decisions-needed-before-coding)) |
| 5 | M | **Three camera APIs** (`[at,end,a,b]` arrays / named cuts + manual `ST.camera` / objects with keys) and cut selection on twos in films 1–2 but raw `t` in film 3 | `films/01-samurai-edo/js/camera.js:9-25`, `films/02-papal-conclave/js/camera.js:32-37`, `films/03-apollo-11/js/camera.js:9-15` | one table ([05 §2](05-CAMERA_GUIDE.md#2-the-three-cut-table-dialects)) |
| 6 | M | **Contact helpers differ per film**: `ST.palmWorld(ch, p, P, side)` (film 1) vs `ST.palmWorld(ch, p, side, hsz)` (film 2, ignores lean) vs `ST.reachTo` (film 3, wrist not palm, ignores `bob` and lean); `hsz` on `ch` (film 1), in `D` (film 3) or passed in (film 2) | `films/01-samurai-edo/js/props.js:43-58`, `films/02-papal-conclave/js/shots/shots-b.js:10-13`, `films/03-apollo-11/js/props.js:124-129` | keep film 1's solves; one signature; `hsz` in `D` |
| 7 | M | **No validators**: shoulders typed by hand can sit at chin level (Stubborn: 2.7 px under the closed chin, ~13 px above the open chin; Baker, Mayor, Gregory within 10–16 units of the head box); IK silently clamps unreachable targets; one-shot face guard | [04 §9](04-CHARACTER_GUIDE.md#9-common-mistakes-and-whether-c-avoids-them); `films/03-apollo-11/js/rig.js:43,109-116` | turnaround critic; later the c-plus validators |
| 8 | M | **Flat, generic background people**: one shared `D`, 4–6 body `kind`s, dot eyes, no hatching (by design) — they repeat in every crowd shot | `films/02-papal-conclave/js/cast/crowd.js:1-16`, `films/01-samurai-edo/js/cast/crowd.js:1-16` | a small pool of hand-built extras per film (c-plus did 12–14 individual background people: `../../styles7/12-mammoth-hunt/COMPARE.md`) |
| 9 | M | **Hall-shot repetition** in film 2: 8 of 12 shots reuse one table layout (`ST.conclave`: hall, years, nopope, bread, refuse, roof, choice, payoff) | `films/02-papal-conclave/js/shots/shots-a.js:40-60` and its callers | vary places/angles; the storyboard should cap one place per N shots |
| 10 | M | **Dark frames**: mean frame luminance (0–255, captions off) ranges 45–139; lowest: film 2 `lock` grille 45, film 3 `land` start 56, film 1 `payoff` 62–69, film 3 `control` 63–77, film 1 `street`/`wrongbow` 66–73 | measured 2026-10-09 at 15/50/85 % of every shot | judge on a phone; lift dark sets (c-plus-faces lifted gloom by 28 %: `../../styles7/19-apollo-11/c-plus-faces/CHANGES.md:28-29`) |
| 11 | M | **No animal rig**: the cat is a one-off function (walk/sit/jump); a goat, horse or dog means another hand-built function each | `films/01-samurai-edo/js/cast/cat.js:1-3,25-50` | acceptable (grammar); maybe a quadruped helper later |
| 12 | M | **Bows are 2-D**: the upper body rotates about the hip in figure space; reads in profile, foreshortens wrong in 3/4, not used in front/back | `films/01-samurai-edo/js/props.js:15-25` (same limit noted for c-plus: `../../styles7/17-samurai-edo/c-plus-fixed/NOTES.md:27`) | keep bows to profile views |
| 13 | M | **Seated people are a clip hack**: drawn standing, lowered and clipped at the floor/table line | `films/01-samurai-edo/js/props.js:68-76`, `films/02-papal-conclave/js/shots/shots-a.js:46-49` | fine for tables; no visible thighs/knees in front views |
| 14 | L | Expression snaps run on raw `t`, poses on twos → an expression can change on an odd 24 fps frame | e.g. `films/01-samurai-edo/js/shots/shots-d.js:75` | snap expressions on `ST.twos(t)` in the port |
| 15 | L | Cut-table gap: film 1 `street` framing 0 ends at 2.4 and the next starts at 2.5; framing 0 is held (clamped) for 0.1 s | `films/01-samurai-edo/js/shots/shots-b.js:56-58` | contiguous tables |
| 16 | L | Engine leftovers from the Dancing Plague film: timeline error text "dancing plague", core header "Dancing Plague - core", `ST.POSE.jig/stomp/flail`, grime helpers only film 2 uses (`house`, `window`, `cobbles`), `ST.gloom` never used | `films/03-apollo-11/js/timeline.js:9`, `core.js:1`, `poses.js:31-59`, `grime.js:40-88`, `brushes.js:267` | rename/remove in the port |
| 17 | L | Folder 10's `test.html` did not load `grime.js` (bug); **fixed** in these copies (`films/03-apollo-11/test.html:21`); `test.html` does not load `camera.js` (not needed by cast files) | `../../styles7/10-dancing-plague-both/test.html:18-30`, `../../styles7/17-samurai-edo/c-base/CHANGES.md:7` | — |
| 18 | L | Tools hard-code the playwright-core path and Chrome's install path | `films/03-apollo-11/tools/proof.mjs:7,13`, `tools/shoot.mjs:6,10` | parameterise if reused |
| 19 | L | Rare slow frames: worst 44–118 ms vs a 3–6 ms median (cause **UNKNOWN**) | measured, [02 §10](02-ARCHITECTURE.md#10-performance) | profile in the spike |
| 20 | L | Captions are burned in at y ≈ 1010 and cover the lowest ~10 % of the frame (feet, table fronts) | `films/03-apollo-11/js/timeline.js:37` | not ported (VO films) |
| 21 | L | Facts are hedged in storyboards ("reports say", no invented numbers) but nothing checks on-screen text | `films/02-papal-conclave/storyboard.md:3` | ReelForge text-provenance guard |

## 2. Backlog (ideas, not committed)

1. Port the C cast to the fixed c-plus engine contract (anchors through the torso, measured head box, jaw rule,
   `ST.meet`, validators) **without** the c-plus look — `../../styles7/20-cplus-engine/`.
2. Individually drawn background people (2–4 per place) instead of `crowdFigure` kinds.
3. A per-film "place" library (sets reused across shots with different angles) and a reverse-angle helper.
4. Quadruped helper (body tube + 4 two-bone legs + own head) for animals.
5. Visemes (A E I O F M) only if characters ever lip-sync to the VO (today they don't).
6. A frame-exact MP4 exporter is unnecessary if the style is ported into ReelForge ([06 §7](06-FILM_AUTHORING.md#7-rendering-to-png-and-mp4)).

## 3. Papi's taste (what he liked and disliked)

Sources: repo docs where they exist; otherwise the Manager's recorded feedback notes (Claude memory files, not in the
repo — marked *(notes)*) and this work packet *(packet)*.

**Likes**
- **Ugly-lovable characters with personality**, built like the Polish adult cartoons *Blok Ekipa* / *Bogdan Boner:
  Egzorcysta* (construction method only, never their characters): tiny pupils, lumpy specific faces, grim specific
  backgrounds *(notes)*; style 07's rulebook is the distilled grammar (`../../styles7/07-great-stink-london/NOTES.md:3-5`).
- **Balanced, not over-the-top caricature**: "interesting but sometimes over the top - balance it, more grim realism than
  goofy caricature" (`../../styles7/19-apollo-11/c-plus-faces/CHANGES.md:9`).
- **Hand-drawn feel from line quality and hand-timed animation**, not from effects *(notes)*; deliberate roughness is
  part of the charm (`docs/worlds/DECISIONS.md:33-37`).
- **The camera work** — cuts inside shots, ECUs, low angles, tilts, foreground silhouettes — the "masterpiece" part
  *(packet)*; continuity and natural flow between shots in general (`docs/worlds/DECISIONS.md:23-27`).
- **Every character individually hand-built, no generator** *(notes)*; the style must carry any topic (pope, emperor,
  astronaut…) *(notes)*.
- Simple, human formats; standalone HTML showcases to judge before building (`CLAUDE.md` §8, 2026-10-06).

**Dislikes**
- Watercolour, paper textures, noise/blur filters, cut-paper or linocut gimmicks *(notes)*; plain filters as "styles"
  (`docs/worlds/DECISIONS.md:19-20`).
- Over-the-top faces, e.g. nose wings drawn as blobs read as a "pig snout"
  (`../../styles7/19-apollo-11/c-plus-faces/CHANGES.md:30`).
- Re-skinning topics as estate guys (he vetoed Sumerians-as-blokers) *(notes)*.
- Bland toy-like characters (the old voxel hoodie guy) *(notes)*; AI slop in general (`docs/worlds/QUALITY.md:7-21`).

Why C over c-plus: the c-plus variants had arm, jaw and handshake bugs (fixed later in the c-plus engine, not part of
C-CAM) *(packet)*; the bug families are documented in `../../styles7/20-cplus-engine/CHANGES.md:7-34`. See
[09-HISTORY_AND_DECISIONS](09-HISTORY_AND_DECISIONS.md).

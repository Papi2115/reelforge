# 07 · ReelForge integration — how to bring C-CAM into the app

Audience: the ReelForge Manager (and the Coder packets it writes). This is an analysis and a proposal; **nothing in
`packages/`, `PLAN.md` or `styles/` was changed**. Repo paths are relative to the repository root; `films/…` paths are
relative to `docs/concepts/c-cam-style/`. Statements about ReelForge are cited from its code and docs; proposals are
marked **Proposal**; facts that need a spike are marked **UNKNOWN**.

Contents: [1 What ReelForge expects](#1-what-reelforge-expects-from-a-style) · [2 Fit/gap summary](#2-fitgap-summary) ·
[3 Decisions needed first](#3-decisions-needed-before-coding) · [4 What to port as is / adapt](#4-port-as-is-vs-adapt) ·
[5 Proposed layout](#5-proposed-package-and-file-layout) · [6 Camera and cuts](#6-camera-and-cuts) ·
[7 Runtime-Claude workflow](#7-runtime-claude-workflow) · [8 Draft STYLE.md](#8-draft-stylesidstylemd) ·
[9 Fonts and licences](#9-fonts-and-licences) · [10 Risks](#10-risks) · [11 Task breakdown](#11-task-breakdown-paste-into-planmd) ·
[12 Open questions for Papi](#12-open-questions-for-papi)

---

## 1. What ReelForge expects from a style

| Contract | What it says | Source |
|---|---|---|
| Scene module | `export const meta = { id, title?, treatment? }`, `build(ctx)` once, `update(t, state, ctx)` a pure function of local time t; validated at load | `packages/engine/src/scene-module.ts:22-40`, `packages/engine/src/contract.ts:1-5,267-271`, `PLAN.md:89-108` |
| `ctx` | `three, scene, camera, kit, text, annotate, palette, ease, anchor, sfx, rng, shot, ambient, assets, worldAssets` | `packages/engine/src/contract.ts:223-265` |
| Sandbox | the whole engine runs in one `<iframe sandbox="allow-scripts">`, CSP `default-src 'none'; script-src 'self' blob:`; scenes are blob modules, no `import`, no network, no Node | `docs/decisions/ADR-004-scene-sandbox.md:5-18` |
| Determinism | scenes must not use `Date`, `Math.random`, `performance`, timers, `requestAnimationFrame`, `fetch`, `document`/`window`/`globalThis`, `OffscreenCanvas`, `Image`, … (lint with fix messages) | `packages/engine/src/lint/forbidden.ts:70-200`, `CLAUDE.md` §3.2 |
| Project code modules | project-local props `kit-ext/props/<name>.js` loaded as blob modules before scenes, linted, `no-module-state-in-prop` | `docs/decisions/ADR-007-project-props.md:20-40`, `packages/engine/src/lint/prop-rules.ts:199-201` |
| Preview = export | one engine; the app's export uses hidden Electron render windows loading the same harness; frames are RGBA at the style's render size | `CLAUDE.md` §3.3, `docs/export.md:18-51` |
| Style preset | resolution (integer-upscaled to the export size), a **palette of 2–32 colours that every output pixel is snapped to**, 15 tokens, dither, optional outline/AO/scanlines/vignette | `packages/shared/src/style-preset.ts:89-112`, `packages/shared/src/palette.ts:6-18`, `packages/engine/src/gl/post-shader.ts:1-7` |
| World | `defineWorld({ id, label, description, experimental, wired, style, fonts, soundPalette, looks })`; looks scoped by `styles: [id]`; a world style is exclusive | `packages/kit/src/worlds/types.ts:16-98`, `docs/decisions/ADR-029-worlds.md:20-45` |
| World raster pattern | a kit fx owns a 2-D raster, repaints it from scratch for every t, shows it on a full-frame quad through the normal post pass (Sketchbook `kit.fx.sketchPage`, Comic `kit.fx.comicPage`) | `packages/kit/src/worlds/sketchbook/page/sketch-page.ts:1-6`, `docs/decisions/ADR-032-comic-compositor.md:23-35` |
| "Grammar, not catalogue" | the world teaches the style grammar; assets (people, props, places) are generated per film | `docs/worlds/DECISIONS.md:67-75` |
| Craft + guards | craft brief ≤ 1.5 KB, ≥ 3 human traces, anti-slop guards (text provenance, clutter, accent share, symmetry, stagger, same composition) | `docs/worlds/QUALITY.md:89-124,141-145` |
| Prompts per world | `WORLD_PROMPTS[id]` with ~20 text fields per stage (storyboard, scene-build, critic, craft brief, moments…) | `packages/prompts/src/worlds/types.ts:10-80`, `packages/prompts/src/worlds/index.ts:43-49` |
| kit-docs | `reelforge kit-docs` index ≤ 28 000 characters (Bash output limit) | `packages/cli/src/commands/kit-docs-size.test.ts:2-4,20`, `CLAUDE.md` §8 (2026-10-04) |
| Fonts | only OFL/CC0, every one listed; all current fonts are authored in-repo | `CLAUDE.md` §6, `docs/licenses.md:6-17` |
| Goldens | `pnpm test:render`, SwiftShader goldens per backend, 0.2 % tolerance | `docs/golden-frames.md:1-40`, `docs/decisions/ADR-004-scene-sandbox.md:36-37` |
| Scene size | "Keep a scene under ~250 lines" | `templates/project/CLAUDE.md:100` |
| Project fps | `project.json` `fps` 1–120, template 30 | `packages/shared/src/project.ts:60`, `templates/project/project.json:6` |

## 2. Fit/gap summary

| C-CAM today | ReelForge expects | Fit |
|---|---|---|
| Canvas 2D vector painting, anti-aliased, alpha blending, ~46 + per-character colours | output pixels snapped to ≤ 32 palette colours by the post pass; all kit rasters are integer-exact software index buffers (`packages/kit/src/worlds/sketchbook/draw/canvas.ts:1-6`) | **Gap (blocking)**: either an engine "no quantize" mode or a different raster (§3 D1) |
| 1920 × 1080 native | resolution × integer factor = export size | fits (factor 1); cost at 1080p **UNKNOWN** in the app (§10) |
| Global `window.ST`, classic scripts | kit = TS modules; scenes/props = blob ES modules, no globals (`document`, `window` forbidden) | adapt: an fx object that hands the scene a drawing API (§5) |
| `ST.hash` seeded integer hash | `ctx.rng` (mulberry32, per shot) | `ST.hash` is a pure function → allowed; keep it inside the kit, derive seeds from literal numbers as today |
| Film clock + twos inside a shot | local `t` per shot, project fps (30 default) | fits; at 30 fps the 12 fps acting holds frames 3-2-3-2 (§3 D4) |
| Hard-coded beat times | `ctx.anchor('phrase')` from words.json | adapt: cut tables and gag beats take anchor times |
| Burned-in captions | films: no captions; shorts: word-by-word captions drawn by the engine (`packages/shared/src/render-manifest.ts:124-127`) | drop C-CAM captions |
| System fonts (Impact, Arial Black, Arial, Georgia, Courier New) | OFL/CC0 only | **Gap**: in-repo CC0 lettering (§9) |
| Hand-built characters as JS functions in the film | project-local code modules (props) exist; "people" modules do not | **Gap**: a new project extension kind (§5, §7) |
| No validators | lint + QA + critic + anti-slop guards | adapt: turnaround preview + critic now, c-plus validators later |
| Three cut-table dialects, two `palmWorld` signatures | one kit API | unify (§6) |
| Scratch canvas in `ST.silhouette` | `document`, module state forbidden in scenes | rewrite as a flat-fill mode (§4) |

## 3. Decisions needed before coding

**D1 — Colour pipeline (blocking).** Every output pixel is snapped to a ≤ 32-colour palette with optional Bayer dither
(`packages/engine/src/gl/post-shader.ts:1-7`, `packages/shared/src/palette.ts:6-7`). C-CAM's look depends on
anti-aliased ink edges, translucent stains/pools/hatching and per-character tones. Options:
- **(A) Recommended — engine "truecolor" preset mode**: a preset flag (e.g. `quantize: false`) that skips dither + LUT
  for that style only; the post pass keeps transitions and optional vignette. Touches `stylePresetSchema`,
  `post-shader.ts` and its CPU reference; must keep every existing preset and golden byte-identical. The preset still
  needs a ≥ 2-colour palette and the 15 tokens for `ctx.palette` and the guards.
- (B) Quantize C-CAM to 32 inks: changes the look (posterised AA edges, no translucent grime); not recommended.
- (C) Write C-CAM to an index buffer like the other worlds: rewrite every brush; the line quality is the style; no.

**D2 — Raster technology.** All existing world rasters are software and integer-exact. C-CAM needs Canvas 2D
(curves, AA, clipping, `evenodd` fills). Measured in desktop Chrome: on a **CPU-backed** canvas
(`willReadFrequently: true`) films 2 and 3 render bit-identically regardless of seek order or a fresh canvas; the
default (GPU) canvas differs in 12–45 pixel channels by ≤ 20/255 ([02 §6](02-ARCHITECTURE.md#6-determinism)).
**UNKNOWN**: equality between the app's Electron render window (ANGLE D3D11, `docs/export.md:46-51`), the preview, and
Playwright SwiftShader goldens; whether `document.createElement('canvas')` inside the kit (the engine iframe has a DOM:
`packages/engine/src/harness/frame-entry.ts:28-29`) is acceptable under ADR-004. → Spike first (task 14.0).

**D3 — Where the hand-built people live.** Proposal: a new project extension kind `kit-ext/people/<id>.js` (the name
`cast` is taken by the character pack `kit.cast`, `docs/characters.md:1`), loaded exactly like project props
(manifest `kitExtensions`, `packages/shared/src/render-manifest.ts:129`), linted with the prop rules (module-level
constants allowed, writes flagged). Same for per-film places: `kit-ext/places/<id>.js` (sets reused by several
shots). Alternative: everything inline in each scene (simple, but a character used in 8 shots would be copied 8 times
and blow the ~250-line scene limit).

**D4 — Frame rate.** C-CAM is authored for 24 fps with acting on twos. At the template's 30 fps a 1/12 s pose holds
2 or 3 frames alternately. Proposal: world project default `fps: 24` (needs `fps` added to `WorldProjectDefaults`,
`packages/project/src/world-defaults.ts:13-15`). Papi decides (§12).

**D5 — Looks A/B/C.** C-CAM is one look in the films. A world needs ≥ 1 look (`packages/kit/src/worlds/types.ts:61-63`).
Proposal: A `ink-scene` (acting scenes with in-shot cuts, the films), B `ink-insert` (an ECU/insert or a diagram drawn
in ink on a prop: ledger, gauge, map, notebook), C `ink-poster` (title/payoff posters and "loud" frames: poster
lettering, sound words). Papi decides (§12).

## 4. Port as is vs adapt

| Part | Port as is (algorithm) | Adapt |
|---|---|---|
| `core.js` | hash, noise1, ease, key, step, twos, talk, blink, EXPR values | registries (`SHOT_DEFS`, `CAST`, `FILM`) are replaced by scenes and project modules |
| `brushes.js` | curve, inkLine, mottle, hatch, blob, tube, ellipseRing, wobble, rough, rect, beam, bands, stars, pool, gloom, bricks | `ST.LW`/`ST.camZ` globals → a per-render state object passed to brushes; `ST.label` → CC0 lettering (§9) |
| camera | `ST.camera` transform | unify the three cut dialects (§6); `ST.fg` screen-space and `ST.fgShape` world-space both kept as explicit options |
| `face.js` | eye, brow, mouth, stubble, wart, pores, hand, EXPR table | — |
| `grime.js` | all | — |
| `rig.js`, `poses.js` | all math (views, ring turns, proj, IK, guard, layers, palm, arm/leg/foot drawing, pose library) | a `defineDims(D)` zod schema for `D`; `hsz` always in `D` |
| contact | film 1's `reachPalm` / `palmWorld` / `figToWorld` / `bowPt` (most complete: bow- and lean-aware) | single signature; drop film 2's `palmWorld` and film 3's `reachTo` variants |
| `ST.silhouette` | — | **rewrite** without a scratch canvas: draw the figures with a flat-fill override (every `fill` → ink) |
| `timeline.js`, `player.js`, captions | — | not ported (engine timeline, app player, no burned captions) |
| `test-page.js` | layout of the turnaround sheet (6 yaws × rows + faces) | becomes a CLI preview (`reelforge people-preview`) like `prop-preview` |
| topic files (`edo.js`, `lunar.js`, props, sets, shots) | **not** ported into the kit (grammar, not catalogue) | become the example/fixture film and few-shot references in prompts |

## 5. Proposed package and file layout

**Proposal** (names are placeholders; world id `c-cam` until Papi names it):

```
packages/kit/src/worlds/c-cam/
  index.ts               defineWorld({ id: 'c-cam', experimental: true, style, fonts, soundPalette, looks })
  style.ts               preset: 1920x1080, palette (≤ 32 named swatches from ST.C for tokens/guards), tokens, quantize: false (D1)
  core/                  hash.ts, ease.ts (key/step/twos), acting.ts (talk/blink/EXPR)            ≲ 150 lines each
  ink/                   curve.ts, ink-line.ts, blob.ts (blob/tube/crescent/mottle/hatch), architecture.ts (wobble/rough/rect/beam/bricks),
                         sky.ts (bands/stars/pool/gloom), grime.ts
  face/                  eye.ts, brow.ts, mouth.ts, skin-marks.ts, hand.ts
  rig/                   views.ts (ring/turn/proj/headView), ik.ts, solve.ts (guard/layers), limbs.ts (drawArm/drawLeg/drawFoot), poses.ts, contact.ts
  camera/                cuts.ts (unified table), foreground.ts (fg screen/world, silhouette fill mode), coverage.ts
  lettering/             strokes.ts (CC0 single-stroke glyphs drawn with the ink line), poster.ts (thud-in title)
  stage/ink-stage.ts     kit.fx.inkStage: owns the canvas, the per-render state, the quad; render(t, paint)
  looks/ink-scene/, ink-insert/, ink-poster/   defineLook({ styles: ['c-cam'], experimental: true, docs, kit: { fx: [inkStage] } })
  traces.ts              world trace helpers counted by the human-trace guard
packages/kit/examples/c-cam/   example scenes + people/places modules (fixture film: Apollo 11 port)
packages/prompts/src/worlds/c-cam.ts (+ -moments.ts, -snippets.ts)   WORLD_PROMPTS entry
styles/c-cam/STYLE.md + style.json   when the world ships (§8 draft)
```

What a scene would look like (**Proposal**, API names not final):
```js
// scenes/s10_fuel.js
export const meta = { id: 's10_fuel', title: 'Fuel', treatment: 'character-scene' };
export function build(ctx) {
  const stage = ctx.kit.fx.inkStage({ size: [ctx.shot.width, ctx.shot.height] });
  const low = ctx.anchor('dangerously low');
  return { stage, low };
}
export function update(t, s, ctx) {
  s.stage.render(t, (g) => {                       // g = the drawing API for this frame (no globals)
    const cut = g.cuts([                           // unified cut table (§6), returns the active name
      { at: 0, name: 'needle', x: 560, y: 600, z: [[0, 1.6], [s.low.t, 1.7]], rot: -5 },
      { at: s.low.t, name: 'glove', x: 1300, y: 860, z: 2.4 },
    ]);
    g.place('panelWall', { seed: 420 });           // kit-ext/places/panelWall.js
    g.person('you').draw({ x: 1560, y: 1720, s: 1.75, yaw: -1, sweat: true,
      expr: g.step([[0, 'miserable'], [s.low.t, 'scared']]) });   // kit-ext/people/you.js
  });
}
```

People module contract (**Proposal**, from [04 §1](04-CHARACTER_GUIDE.md#1-what-a-character-module-provides)): `export const person = { name, description,
D, defaultExpr, props: {…literal JSON for kit-docs…}, draw(g, p) }`; the module may define local constants
(outlines per view) and functions; it receives the drawing API `g` (brushes, face, rig, poses) instead of `ST`.

## 6. Camera and cuts

Unified table (**Proposal**): film 3's object form + film 2's names, selection on twos:
`g.cuts([{ at, name?, x, y, z, rot? }, …]) → name | index` where every numeric field is a number or `[[t, v, ease?], …]`
keys; `at` may be an anchor time. The kit's proof/preview samples the middle of every cut (as
`films/02-papal-conclave/tools/proof.mjs:19-31`). Keep:
- contacts solved before the camera (`g.palmWorld`, `g.reachPalm`), [05 §6](05-CAMERA_GUIDE.md#6-contacts-are-solved-before-the-camera-coverage);
- foreground silhouettes in screen space (`g.fg`) and world space (`g.fgShape`), OTS backs via `person.draw` with `yaw: 3`;
- a coverage check (visible rectangle vs the set's declared bounds) as a QA finding;
- `ctx.camera` (Three.js) does nothing on the stage, like Sketchbook's page (`packages/kit/src/worlds/sketchbook/page/sketch-page.ts:131-132`).

## 7. Runtime-Claude workflow

| Stage (ReelForge, `PLAN.md:62-71`) | What changes for C-CAM |
|---|---|
| Script | unchanged; films are VO-narrated |
| Storyboard (Sonnet) | per shot: setting (place id), cast in frame, the gag beat, 2–5 framings with sizes (wide / CU / ECU / OTS), which framing is tense (tilt), the continuity link; a **cast list** of roles with a 1-line brief each (job, exaggeration axis, loud prop) |
| **People build** (new, Opus, like the prop builder `docs/decisions/ADR-007-project-props.md:41-56`) | one `kit-ext/people/<id>.js` per role, hand-built per [04](04-CHARACTER_GUIDE.md); QA = lint → turnaround sheet render → Haiku critic ("one exaggeration axis? reads at thumbnail? hands off the face? torso turns?") → ≤ 1 fix turn |
| **Places build** (new or part of people build) | `kit-ext/places/<id>.js` per setting used by ≥ 2 shots, per [01 §8](01-STYLE_GRAMMAR.md#8-backgrounds-sets) |
| Scenes (Opus + Haiku QA) | one scene per shot: stage + cut table + place + people + props drawn inline; anchors for beats; ≲ 250 lines |
| Sound | world sound palette later; placeholder palette as other worlds did (`docs/decisions/ADR-032-comic-compositor.md:56`) |

What the kit provides vs what the runtime Claude writes:

| Kit (reviewed, versioned, goldens) | Runtime Claude (per film, in the project) |
|---|---|
| brushes, grime, face primitives, EXPR, rig + IK + guard + layers, pose library, contact solves, camera + cuts + fg silhouettes + coverage check, lettering, stage fx, trace helpers | people (one module each), places, topic props (inline or `kit-ext/props`), shot scenes with their cut tables |

## 8. Draft `styles/<id>/STYLE.md`

Mirrors the format of `styles/voxel-pixel-crisp640/STYLE.md` (sections Look, Composition, Camera, Typography, Pacing,
Annotations, Avoid, Ambient variation). **Draft, ≈ 2.5 KB; the craft brief for prompts must be cut to ≤ 1.5 KB.**

```markdown
# Style: C-CAM · Grim Ink

World style. Renders at 1920×1080 (no upscale), canvas ink drawing in truecolor. Hand-built, ugly-lovable caricature
people in specific, grimy places; deadpan acting on twos; a restless TV-cartoon camera with cuts inside a shot.

## Look
- **Line:** only the kit ink line (width swells 0.4–1.9×); silhouettes lw 7–8, faces 5–7, details 3–4. Never uniform strokes.
- **Palette:** muddy olive/clay/grey-blue/mustard/rust/plum; skins ruddy/sallow/clay/olive/grey; whites are dirty linen,
  darks are ink. One warm light pool per place, drawn behind people. **One accent object per shot.**
- **Grime as flat shapes:** shade crescents, mottling, hatch clusters, stains, peels, cracks. No textures, filters,
  gradients, noise, paper or watercolour.
- **People:** each one hand-built (`kit-ext/people`), one exaggeration axis, head:body 1:2.7–1:4.2, 4 torsos and 4 heads
  by view, tiny pupils, heavy lids, 4–6 grit marks, a loud prop with a gag use. Background people stay simple.

## Composition
- One focal point per framing, off-centre; layered depth (foreground silhouette or table edge, subject, set).
- Places are drawn wider than any framing (coverage check); the floor line and a specific material in every place.

## Camera
- 2–5 framings per shot, hard cuts on beats (anchors): establish → the gag object (ECU) → the reaction (CU) → pull-back.
- Moves inside a framing are small (5–40 % zoom, ≤ 100 px pan). Dutch tilt 2–7° only on tense beats.
- Solve hands/props in world space first, then frame them. OTS backs and foreground silhouettes for depth.

## Typography
- No `ctx.text`. Signs, sound words and posters use the stage lettering (hand ink strokes). Every word comes from
  the narration or the research. No captions in films.

## Pacing
- Characters act on twos; expressions snap; shock = snap + head jolt for 0.2 s; long deadpan holds (≥ 0.4 s still).
- A recurring gag and a payoff that calls back to it.

## Annotations
- None from `ctx.annotate`; emphasis is a cut to an ECU, a sound word or an ink mark in the place.

## Avoid
Generic or generated faces; arms across faces; props held "near" a hand; pools over people; more than one accent;
pure black/white; over-the-top caricature (max two strong exaggerations per face); polished symmetric drawing; cosmetic
camera moves; tilt on calm beats; scenes > 250 lines (move people/places into their modules).

## Ambient variation budget
None (one hand-drawn world; places differ by content, not by tone drift).
```

## 9. Fonts and licences

Every text-drawing site in the films (none of these fonts may ship; Comic Sans appears **nowhere** in the films,
grep 2026-10-09):

| Use | Font | Where |
|---|---|---|
| `ST.label` default | `Impact, 'Arial Black', sans-serif` | `films/03-apollo-11/js/brushes.js:311` (+ every `ST.label` call without `font`: `films/01-samurai-edo/js/sets/sets-c.js:35,84`, `films/01-samurai-edo/js/shots/shots-a.js:53`, `shots-b.js:83`, `shots-d.js:16,25`, `films/02-papal-conclave/js/sets/sets-c.js:42`, `films/02-papal-conclave/js/shots/shots-a.js:86`, `shots-d.js:60`, `films/03-apollo-11/js/sets/sets-a.js:49`, `films/03-apollo-11/js/shots/shots-a.js:45,61,132`) |
| Poster title `ST.posterWord` | Impact, Arial Black | `films/01-samurai-edo/js/shots/shots-a.js:11`, `films/02-papal-conclave/js/shots/shots-a.js:12`, `films/03-apollo-11/js/shots/shots-a.js:11` |
| Tag `ST.tag` | Impact, Arial Black | `films/03-apollo-11/js/shots/shots-a.js:41` |
| Captions | bold 46 px Arial Black, Arial | `films/*/js/timeline.js:29,37` |
| Sleep "z", ledger entries | Georgia bold / italic bold | `films/01-samurai-edo/js/shots/shots-b.js:36`, `shots-d.js:30` |
| Year slate, CUM CLAVE stone | Georgia, Times New Roman | `films/02-papal-conclave/js/sets/sets-b.js:69`, `sets-c.js:38-39` |
| Gauge, DSKY lamps/keys, MASTER ALARM, LOW LEVEL | Arial Black, Arial | `films/03-apollo-11/js/lunar.js:103,114,117,123`, `films/03-apollo-11/js/sets/sets-b.js:52-53`, `films/03-apollo-11/js/shots/shots-b.js:43`, `shots-c.js:51` |
| DSKY digits | Courier New | `films/03-apollo-11/js/lunar.js:118` |
| Dev only (not in frames) | Georgia | `films/*/js/test-page.js:28,30,46,56`, `films/*/tools/proof.mjs:46`, page CSS `showcase.html:7`, `test.html:7` |

**Proposal**: one in-repo CC0 lettering system drawn with the ink line, in two weights:
- **Hand lettering** (signs, ledgers, slates, sound words): reuse the Sketchbook's CC0 single-stroke skeletons
  (`packages/kit/src/worlds/sketchbook/draw/glyphs.ts`, listed in `docs/licenses.md:13`) rendered by `inkLine` with a
  heavier width; same licence row extended to C-CAM.
- **Poster/stencil caps** (titles, CLACK, DSKY, MASTER ALARM): a new hand-authored CC0 stroke set of caps + digits,
  drawn thick with the ink line, bone fill and rust extrusion like `ST.posterWord`; new row in `docs/licenses.md`.
- Captions: none in films (§2); shorts use the engine's captions.
The text-provenance guard must see these calls (`docs/worlds/QUALITY.md:109`).

## 10. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Palette snap (D1) | look destroyed or engine change rejected | truecolor preset flag with no-harm goldens (task 14.1); decide before any other work |
| Canvas 2D determinism across preview window / export window / SwiftShader (D2) | preview ≠ export, flaky goldens | CPU-backed canvas; spike 14.0; per-backend goldens with the existing tolerance (`docs/golden-frames.md:39-70`) |
| Performance at 1080p native | slow preview/export (PLAN target: preview ≥ 30 fps at 640×360, `PLAN.md:347`) | measured paint 3.3–5.6 ms median in Chrome ([02 §10](02-ARCHITECTURE.md#10-performance)); upload + post + readback of 8 MB/frame in Electron **UNKNOWN** → spike; optional half-res preview |
| Lint vs kit code | kit stage uses `document.createElement('canvas')`, forbidden in scenes | keep the canvas inside the kit (not scene code); ADR-004 addendum |
| Module state | `ST.silhouette` scratch canvas, `ST.LW` globals | flat-fill silhouettes; per-render state object |
| File-size rules (≲ 400 lines, scenes ≲ 250) | big files | split as in §5; topic code stays per film; people/places in modules |
| Fonts | licence violation | §9 |
| No validators | arms from chins, missed contacts in LLM-written people | turnaround critic now; port c-plus validators (anchors, jaw connectivity, tangle, contact) later (task 14.13; `../../styles7/20-cplus-engine/NOTES.md:1-6`) |
| LLM drawing quality | generic faces, symmetric "AI" drawings | craft brief + references (the three films' proof sheets), people critic, Papi's taste list ([08 §3](08-KNOWN_ISSUES_AND_BACKLOG.md#3-papis-taste-what-he-liked-and-disliked)) |
| Anti-slop guard calibration | busy grimy frames trip the clutter guard; labels (CLACK) trip provenance | calibrate on the fixture film's goldens; world label whitelist |
| Portrait shorts (9:16) | landscape sets and framings | portrait framing rules in the world's `short` prompt line (`packages/prompts/src/worlds/types.ts:59-64`); later |
| Cost/limit | people modules are long code (135–194 lines each in the films) → more Opus tokens per film | one build per role per film; reuse across shots |

## 11. Task breakdown (paste into PLAN.md)

**Proposal** for a new phase (numbering free; each task one packet, diff ≲ 400 LOC, split where noted):

```markdown
### Faza 14 — Świat C-CAM („Grim Ink”, styl C + kamera) — propozycja
- [ ] **14.0** [O] **Spike: Canvas 2D w silniku**: kit fx z płótnem CPU (`willReadFrequently`) w iframe silnika; pomiar determinizmu (ten sam t w różnej kolejności, świeże płótno; okno podglądu vs ukryte okno eksportu vs Playwright SwiftShader) i czasu klatki 1920×1080 (malowanie + upload + post + readback) na laptopie Papiego. — AC: `docs/spikes/ccam-canvas.md` z liczbami, GO/NO-GO, addendum do ADR-004.
- [ ] **14.1** [O] **Silnik: preset bez kwantyzacji** (`quantize: false` lub równoważne) w `stylePresetSchema`, `post-shader.ts` i referencji CPU. — AC: wszystkie istniejące goldeny i presety bajt w bajt; test presetu truecolor (piksel spoza palety przechodzi bez zmian).
- [ ] **14.2** [O] **Szkielet świata `c-cam`** (eksperymentalny, niepodpięty): `style.ts` (1920×1080, tokeny), `defineWorld`, `kit.fx.inkStage` (płótno, stan per klatka, quad, `render(t, paint)`), jedna scena przykładowa. — AC: `render:frames --experimental` renderuje scenę; golden; test „bez szkody” (worlds.test, kit-docs-styles).
- [ ] **14.3** [O] **Port core + pędzle** (hash, ease/key/step/twos, talk/blink, curve, inkLine, blob, tube, hatch, mottle, rough/rect/beam, bands/pool/gloom/bricks) do TS bez globali. — AC: testy jednostkowe (zakres szerokości 0,4–1,9×, hash = oryginał na 1000 wejść), golden „próbnik pędzli” zgodny wizualnie z `films/03-apollo-11`.
- [ ] **14.4** [O] **Port twarzy, brudu i póz** (EXPR, eye/brow/mouth/stubble/wart/pores/hand, grime, POSE). — AC: testy, golden arkusza twarzy (6 min).
- [ ] **14.5** [O] **Port rigu** (widoki, ring, proj, IK, guard, warstwy, drawArm/Leg/Foot, solve) + kontakt (palmWorld/reachPalm/figToWorld/bowPt z filmu 1, jedna sygnatura); schemat zod `D`. Dwa pakiety, jeśli > 400 LOC. — AC: testy IK/guard/warstw; dłoń na punkcie ≤ 2 px (jak koban 1,3 px).
- [ ] **14.6** [O] **Kamera**: jedna tabela cięć (`{ at, name?, x, y, z, rot? }`, klucze, wybór na dwójkach, czasy z anchorów), fg w ekranie i w świecie, sylwetka bez płótna pomocniczego, sprawdzenie pokrycia planu. — AC: testy; golden ujęcia z 3 cięciami; raport pokrycia.
- [ ] **14.7** [O] **Liternictwo CC0** (szkielety kresek tuszem: ręczne z Zeszytu + nowe kapitaliki plakatowe, „thud-in” tytułu). — AC: wpis w `docs/licenses.md`, golden tytułu, strażnik pochodzenia tekstu widzi wywołania.
- [ ] **14.8** [O] **Moduły projektu `kit-ext/people` i `kit-ext/places`** (kontrakt, lint jak propsy, ładowanie przez manifest, klucz cache) + `reelforge people-preview` (arkusz 6 widoków × pozy + twarze). — AC: testy lint/loader; podgląd renderuje się w CLI i w aplikacji jednakowo.
- [ ] **14.9** [O] **Film-fixture**: port Apollo 11 (5 postaci, 7 miejsc, 13 ujęć) na sceny + moduły; goldeny looków A/B/C. Kilka pakietów (postacie / miejsca / ujęcia). — AC: klatki porównane z `docs/concepts/c-cam-style/films/03-apollo-11/proof/` (ocena Managera), lint zielony, ≤ 250 linii na scenę.
- [ ] **14.10** [S] **Prompty i dokumenty świata**: `WORLD_PROMPTS['c-cam']` (storyboard z listą ról i ujęciami, scene-build, critic z checklistą, craft brief ≤ 1,5 KB, momenty: insert/ECU, OTS, reverse, plakat), `kit-docs` (indeks < 28 000 znaków), STYLE.md z §8. — AC: testy promptów i rozmiaru kit-docs; „bez szkody” dla innych stylów.
- [ ] **14.11** [O+S] **Etap budowy postaci i miejsc** (jak prop-build: lint → arkusz → krytyk Haiku → ≤ 1 poprawka; raport). — AC: test na fake-claude; postać nieudana nie blokuje filmu (⚠).
- [ ] **14.12** [O] **Domyślne ustawienia świata + strażnicy**: `WORLD_PROJECT_DEFAULTS` (+ fps wg decyzji Papiego), kalibracja anti-slop (biała lista etykiet, clutter, akcent), paleta dźwięku zastępcza; `wired: true`. — AC: 0 fałszywych alarmów na goldenach fixture; świat widoczny za „Experimental worlds”.
- [ ] **14.13** [O] **(Później) Walidatory z c-plus** dopasowane do kontraktu C: kotwice ramion vs podbródek, spójność głowy z otwartą szczęką, splątanie, kontakt. — AC: 0 błędów na fixture; celowo zepsute postacie wykryte.
- [ ] **14.14** [S] **Film testowy** 2,5 min na losowym temacie (zasada Papiego, PLAN 13.10), raport + poprawki promptów.
```

## 12. Open questions for Papi

1. **Name** of the style/world in the app (working ids: `c-cam`, "Grim Ink").
2. **Colour pipeline (D1)**: OK to add a truecolor mode to the engine for this one style (recommended), or must it
   keep a ≤ 32-colour palette like the other worlds?
3. **fps (D4)**: 24 fps for C-CAM projects (matches the films), or keep 30?
4. **Looks (D5)**: one look, or A scene / B insert / C poster as proposed?
5. **Captions**: none in films (VO only), as proposed? Word captions only in shorts?
6. **People in every film**: always new hand-built people per film (grammar rule), or may a channel keep recurring
   characters across films (a "series cast")?
7. **Validators**: port the c-plus validators now (slower start, safer drawings) or after the first real films?
8. **Experimental flag**: ship behind "Experimental worlds" like the other worlds (beta rule, `CLAUDE.md` §8
   2026-10-07)?
9. Is the **c-plus fixed engine** (`../../styles7/20-cplus-engine/`) acceptable as a later *engine* upgrade for C-CAM
   if its look is kept to C (no c-plus lighting, faces or doubled strokes)?

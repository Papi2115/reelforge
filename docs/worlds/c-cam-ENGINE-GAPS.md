# Grim Ink (c-cam) — engine gaps vs the concept films (PLAN.md#14.19)

Audit of what kept a generated Grim Ink film below the authored level of the concept films
(`docs/concepts/c-cam-style/films/01-samurai-edo`, `02-papal-conclave`, `03-apollo-11`; the styles7 pilots
17 and 18 are the same samurai and papal films). Rule (CLAUDE.md §8, 2026-10-11): prototype fidelity beats engine rules
in this world; every deviation is a world-scoped exception with a CI-safe fallback; other worlds stay byte-identical.
The exceptions in force are summarised in `docs/worlds/c-cam-STYLE.md` → "Exceptions to engine rules".

## Part A — audit

| # | Limit | Where enforced | What it blocks | Decision |
|---|---|---|---|---|
| 1 | Scenes see shot-local `t` only | `packages/engine/src/shot.ts` (`update(localTime)`), `contract.ts` `ShotInfo` without `t0` | running gags across shots (the commander's gum all film, the bubble at the landing, a tally that grows), film-level motifs | **Removed (additive for all styles)**: `ctx.film = { t, duration, progress, shotIndex, shotCount, shotT0, anchor(phrase, nth) }` and `ctx.shot.t0`; manifest `film` + shot `filmIndex` for one-shot renders (`packages/cli/src/project/shots.ts` `isolatedManifest`); export cache key gains `film` only for scenes that read it (`packages/pipeline/src/export/cache-key.ts` `filmInputs`) |
| 2 | Scene "under ~250 lines" | `packages/prompts/src/worlds/c-cam.ts` DESIGN, `templates/project/CLAUDE.md:100`, `docs/worlds/c-cam-STYLE.md` Avoid | a concept shot with its cut table, acting and inline props (300-500 lines) | **Raised** to ~600 for c-cam (`C_CAM_SCENE_MAX_LINES`, `packages/shared/src/ink-modules.ts`); other styles keep ~250 |
| 3 | People / places: 250 lines, 64 KB, 24 per kind | `packages/shared/src/ink-modules.ts` `INK_MODULE_LIMITS`; read by `packages/cli/src/project/kit-ext.ts` `checkLimits/checkSize`, `packages/engine/src/lint/lint-ink-module.ts` `checkLength`, `packages/stages/src/c-cam/design.ts:133`, `kit-docs people` | dense cast files (`cast/*.js` up to ~200 lines of tightly packed code), films with crowds of named sets | **Raised** to 450 lines, 160 KB, 64 per kind (only c-cam reads these kinds) |
| 4 | No shared code (scenes and modules cannot import) | engine sandbox (scenes = blob modules), `lint-ink-module.ts` (no imports), `c-cam-build` write guard (`packages/stages/src/c-cam/builder.ts`) | the films' `acting.js`, `props.js`, `crowd.js`, `lunar.js`, `edo.js`, used by every shot; every shot re-inventing a seated pose or a crowd row | **Exception**: project libraries `kit-ext/lib/<name>.js` (`export const lib = { … }` of pure functions), `kind: 'lib'` in the manifest, loaded with people/places (c-cam only), `ctx.kit.lib.<name>` in scenes, `ink.lib.<name>` in modules (`packages/kit/src/worlds/c-cam/modules/library.ts`), lint `packages/engine/src/lint/lint-ink-lib.ts`, same limits, every library in every shot's cache key, `c-cam-build` turns may write `kit-ext/lib/*`; `reelforge kit-docs lib` |
| 5 | Anti-slop frame budgets guessed (clutter ≤ 6, accent ≤ 12 %, symmetry 0.8) | `packages/stages/src/slop/guards.ts` | flags authored density: 5 of 182 concept frames have 7 competing elements | **Measured** (`packages/stages/scripts/c-cam-proof-metrics.mjs`, 182 proof frames, +15 %): 8 elements, 11.7 % accent, symmetry 0.84 (`C_CAM_FRAME_BUDGETS`, `WorldSlopSpec.frameBudgets`); same-composition distance and the trace minimum unchanged (not measurable on sheets / source-level) |
| 6 | Critic = Haiku, one contact sheet, 5 smoke points, no reference | `packages/shared/src/app-settings.ts:40` (`critic: 'haiku'`), `packages/stages/src/scenes/qa.ts` `smokeTimes`, `scenes/critic.ts` | judging craft at the prototypes' bar; a 0.6 s ECU between two smoke points is never seen | **Exception**: c-cam critic turn at least Sonnet (`StageTurn.minModel`, `turns.ts` `atLeastModel`), two reference frames of the shot's look (`packages/stages/assets/c-cam-reference`, critic prompt `referencePaths`, fallback: none), ≥ 3 QA times per framing parsed from the cut table (`packages/stages/src/c-cam/framing-times.ts`, fallback: smoke times) |
| 7 | One fix turn with Faster checks | `packages/stages/src/settings.ts` `FASTER_CHECKS.maxFixIterations: 1` | a second pass on a framing the critic rejected | **Raised** for c-cam scenes to ≥ 2 (`worldSceneSettings`) |
| 8 | No concrete example of an excellent shot | prompts give abstract rules only | Claude has nothing to imitate at the craft level | **Added** `reelforge kit-docs shots` + 5 technique topics (running gag, climax ECU, accident beat, reverse/OTS, foreground-silhouette tension) restated in this API, "technique, not content"; the scene prompt tells the model to read the closest one; `cCamShowcaseFindings` flags the films' objects (samurai, papal, Apollo, toy bear) in a scene the narration does not ask for |
| 9 | Cut table: one `from → to` move per framing, one ease | `packages/kit/src/worlds/c-cam/draw/camera-schema.ts` | — | **Keep**: the films key 2 values per framing (`[[t0, a], [t1, b]]`), the same thing; anything richer is `applyCamera(g, framing)` with a framing the scene keys itself (`env.time.key`) |
| 10 | Zoom 0.8-5.4, roll ±7° | `camera-schema.ts` | — | **Keep**: the films use 1.0-3.2 and ±6° (`05-CAMERA_GUIDE.md` §1) |
| 11 | Foreground silhouettes, coverage, OTS, low angle, shake | `stage-ink.ts` `fgScreen/fgWorld/silhouette/coverage`; OTS / low angle by figure scale; shake by hand | — | **Keep**: all present; shake (±8 px on twos, 0.2 s) is a convention in `kit-docs ink-camera`, as in the films |
| 12 | Captions burned in the frame (films: y ≈ 1010, 11 px outline) | world rule "no captions in films" (`kit-docs ink-lettering`) | the films' caption track | **Out of this brief**: briefs 09 / 11 (captions, lettering, title frame; cloud session B) |
| 13 | System fonts in titles (films: Impact / Arial Black) | ADR-005, `lint-ink-module.ts` grammar | the films' poster lettering | **Out of this brief**: brief 11 / PLAN.md#14.18 (font roles with CC0 fallback) |
| 14 | Hard cuts only between shots (`cutsOnly`), crossfade ≤ 0.4 s | `packages/prompts/src/worlds/c-cam.ts` | — | **Keep**: the films cut hard; blackouts / smash cuts are a scene painting ink; speed ramps exist as reveal moments (`timeRemap`) |
| 15 | People / place build: build + ONE fix turn | `packages/stages/src/c-cam/builder.ts:31` `INK_BUILD_ATTEMPTS = 2` | a second fix of a module the QA rejected | **Follow-up F4** (raise to 3) |
| 16 | Final review critic: one batched Haiku turn | `packages/stages/src/scenes/final-review.ts` | the film-level look at the prototypes' bar | **Follow-up F2** |
| 17 | Contact sheet thumbnails shrink with more frames | `packages/stages/src/scenes/sheet.ts` | with 15+ QA times a framing is a small thumbnail | **Follow-up F3** |
| 18 | kit-docs topics < 6 KB, index < 28 KB | `kit-docs-c-cam.test.ts`, Bash output limit | — | **Keep** (CLI output limit); topics are split instead |

## Part B — what changed (limits old → new, new APIs)

- `INK_MODULE_LIMITS`: maxModules 24 → 64, maxBytes 64 KB → 160 KB, maxLines 250 → 450.
- Scene guidance (c-cam): ~250 → ~600 lines (`C_CAM_SCENE_MAX_LINES`).
- Frame budgets (c-cam): competing elements 6 → 8, accent share 12 % → 11.7 %, symmetry 0.80 → 0.84.
- Critic (c-cam): model Haiku → at least Sonnet; references 0 → 2 per look; QA times 5 per shot → ≥ 3 per framing (≤ 20);
  fix turns with Faster checks 1 → 2.
- New APIs: `ctx.film`, `ctx.shot.t0`; manifest `film` / shot `filmIndex`; kit-ext kind `lib` (`kit-ext/lib`,
  `ctx.kit.lib`, module `ink.lib`); `WorldSlopSpec.frameBudgets`; `StageTurn.minModel`; critic prompt `referencePaths`;
  `reelforge kit-docs lib | shots | shot-running-gag | shot-climax-ecu | shot-accident | shot-reverse-ots | shot-fg-tension`.

## Follow-ups (estimated)

- **F1 — library preview** (S, ~0.5 day): `reelforge lib-preview <name>` (calls each drawing helper on a sheet), like
  people-preview; today a library is checked by lint and through the scenes that call it.
- **F2 — final-review critic at the c-cam bar** (S, ~0.5 day): the batched final review keeps Haiku and no references;
  apply `minModel` and one reference sheet per look there too.
- **F3 — per-framing contact sheets** (M, ~1 day): with ≥ 3 times per framing the critic's one sheet gets dense; write
  one sheet row per framing at a fixed thumbnail size.
- **F4 — module build fix turns** (XS): `INK_BUILD_ATTEMPTS` 2 → 3 (build + 2 fixes) for people / places; left out here
  because `c-cam-modules-stage.test.ts` is being changed by the parallel vocabulary work.
- **F5 — trace credit for places** (S): the films carry most grime in their sets; a scene that draws a place module (with
  its own stains and cracks) still needs three grime calls of its own to pass the trace minimum. Count a drawn place once.
- **F6 — reference frames in the packaged app** (S): `packages/stages/assets/c-cam-reference` is resolved next to the
  stages code; the Electron bundle needs it as an extra resource (today the packaged critic runs without references).

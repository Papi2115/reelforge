# ADR-010: Ambient variation (PLAN 12.8)

Status: accepted (2026-10-04). Code: schemas `packages/shared/src/ambient-variation.ts` (budget,
manifest switch, per-shot inputs), `style-preset.ts` (`variation`), `project.ts`
(`ambientVariation`); generator `packages/kit/src/variation/`; environments
`packages/kit/src/env/{sky,neon-grid,lights,floating,void,city,room}.ts`; engine
`packages/engine/src/ambient.ts`, `camera/drift.ts`, `shot.ts`, `runtime.ts`; budgets in
`packages/engine/src/presets/*.json`; manifest builders `apps/desktop/src/main/project-manifest.ts`,
`packages/cli/src/project/shots.ts`; export cache key `packages/pipeline/src/export/cache-key.ts`.
Tests: `packages/kit/src/variation/variation.test.ts`, `packages/kit/src/env/ambient-env.test.ts`,
`packages/engine/src/ambient.test.ts`, render `packages/kit/test/render/kit-ambient.test.ts`
(goldens `ambient-*`).

## Context

Scenes are written one per shot and tend to reuse the same backdrop (violet grid under a dusk
sky). Eight minutes of that read as one blue grid. The environment should drift from shot to shot
the way a real set changes light and dressing, while staying inside the Style (palette, post-fx)
and never changing films that already exist.

## Decisions

- **Budget per style and look.** `variation.<key>` in the engine preset, keyed by the look's
  `variationBudget` (`voxel` today). The preset is the render source of truth (it is in the
  engine bundle, so `engineVersion` already covers budget edits in the export cache);
  `styles/<id>/style.json` stays the user-facing card, STYLE.md documents the budget. A look
  whose key the style lacks never varies (retro-UI, diorama and blueprint until they add one).
- **Colours = swatch families.** `tones` maps a swatch to other swatches of its family; the
  schema rejects anything that is not a swatch, so variation cannot leave the palette. Only
  environment colours the scene did not set explicitly are toned; hero, text and accent tokens
  never change.
- **Axes.** Tone families, sky horizon/top, grid cell (density) and fade distance, light turn and
  elevation, debris/star count, a layout variant of seeded backdrops (floating cubes, void
  shards, city windows) and a slow camera drift (yaw/pitch from -d to +d over the shot, applied
  after the scene's update and undone before the next one, so it is a pure function of t).
- **Neighbours differ by construction.** The first two axes with a range (horizon, light turn)
  walk through a fresh seeded permutation of their levels every `steps` shots; at a cycle
  boundary the first two entries swap if they would repeat the previous cycle's last level. The
  swap never touches a cycle's last entry, so a level depends only on its own and the previous
  cycle (no chain): any shot is computable alone. The other axes are hashed from seed + roll +
  act + index + shot id; each act and roll picks one member per tone family (a coherent mood per
  act), each shot swaps `toneShare` of the families.
- **Inputs travel in the manifest.** `ambientVariation: { enabled, seed, scale? }` plus per shot
  `ambient: { index, act, roll?, look?, scale? }` (act = count of non-cut transitions), filled by
  both manifest builders from project.json + storyboard, so `reelforge frames` on one shot
  matches the whole film. Hand-made manifests without per-shot info derive index and act.
- **Switch: project.json `ambientVariation`, absent = off.** Builders then emit nothing new, so
  the manifest, the export cache keys and every frame are byte-identical to before (Nokia film,
  example project). The template sets `true` for new projects. Scale 0 is also exactly off.
- **Scale.** `value = neutral + (budget value - neutral) * scale`, film-wide (`scale`) times per
  shot (`ambient.scale`): the hook for the tension map (12.22).
- **Scenes cannot defeat determinism.** They only read `ctx.ambient` (frozen: `enabled`,
  `params`, `tone(name)`); everything is derived in the engine from manifest data.

## Consequences

- New projects look different shot to shot without any prompt change; scene authors are told
  (STYLE.md) not to hard-code one background everywhere and to keep env colours at defaults.
- Looks add variation later by adding a budget under their key and reading `tools.variation`.
- Not built: a UI toggle (edit project.json), `ctx.ambient` in `reelforge kit-docs ctx`.

# ADR-009: Looks, A/B/C rolls and the look mode (PLAN 12.1)

Status: accepted (2026-10-04). Code: `packages/kit/src/looks/` (contract, registry, `voxel` look,
stubs `retro-ui`, `diorama`, `blueprint`), `packages/kit/src/kit.ts` (binding, catalog),
`packages/kit/src/catalog-markdown.ts`, `packages/cli/src/commands/kit-docs.ts`, schema
`packages/shared/src/storyboard.ts` (`roll`, `look`, `shotLook`) and `project.ts` (`lookMode`),
rules `packages/prompts/src/validators/rhythm.ts`, prompts `storyboard.md` (v3), `scene-build.md`
(v6), `critic.md` (v2), plumbing `packages/stages/src/looks.ts`, vibe guard
`packages/engine/src/vibe.ts`. Guide: `docs/looks.md`.

## Context

ReelForge 2.0 adds visual looks (retro UI, diorama, blueprint, later flat 2D, paper, whiteboard)
so eight minutes do not look like one blue grid, while keeping one retro identity and never
changing how existing films render. Three looks will be built in parallel by separate coders.

## Decisions

- **Style vs look.** The Style (post-fx, palette, pixel fonts, sound treatment) stays in the
  engine and applies to every look; a look only contributes kit definitions, docs, a sound palette
  id and a variation budget key. Looks cannot bring their own post-fx.
- **Registry in the kit, flag per look.** `LOOKS` imports every look module, including stubs with
  `available: false`; only available looks reach storyboards, scene builds, `ctx.kit` and the
  catalog. Parallel work on 12.2–12.4 touches only `looks/<id>/` and flips its own flag.
- **Same namespaces, no collisions.** Look definitions bind into `kit.env/props/fx` next to the
  voxel kit's (templates by their kind); a duplicate name throws. Scenes stay plain calls such as
  `kit.props.crtMonitor()`, the lint and missing-prop logic need no change. The voxel look is the
  existing definitions (same arrays), so `ctx.kit` is identical with voxel alone; rng forks are
  keyed by kind/name/call index, so other looks cannot shift voxel randomness.
- **The kit stays free of `@reelforge/shared`** (it is bundled into the scene sandbox): rolls are
  duplicated as `LOOK_ROLLS`, treatments are strings; a stages test checks them against the
  shared schemas.
- **Storyboard fields are optional and additive** (`roll`, `look`; absent look = `voxel`), so the
  file version stays 1 and every old storyboard stays valid.
- **`lookMode` in project.json; absent = `voxel-only`.** Existing projects (the Nokia film, the
  example project) keep byte-identical prompts and checks; the project template sets `mixed` for
  new projects. Prompt sections are template sections that render to nothing in `voxel-only`
  (fixtures pin the old text).
- **Rules that need a second look wait for one.** In `mixed` mode with voxel alone only
  `unknown-look` and `roll-a-gap` apply (an untagged voxel shot counts as A); `missing-roll`,
  `look-run`, `pattern-run` (roll + look + treatment > 8 s across shots) and the `act-change-roll`
  warning switch on with the second available look. Otherwise every all-voxel film would fail the
  look-run rule and untagged storyboards would fail before any new look exists.
- **Vibe guard = palette membership + opacity.** The LUT is the last post-fx step, so any
  off-palette pixel proves a bypass. It is a CPU check over RGBA frames (unit-tested on the voxel
  goldens) plus a critic prompt paragraph that maps style breaks to `off-intent` with `vibe:`.

## Consequences

- 12.2–12.4 each add definitions, docs and goldens (with `expectVibe`) in their own folder.
- 12.8 reads `variationBudget`, 12.24 reads `soundPalette`, 12.15 picks transitions per look pair.
- A `lookMode` switch in the UI is not built yet; projects are switched by editing project.json.

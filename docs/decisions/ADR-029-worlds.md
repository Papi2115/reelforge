# ADR-029: Worlds — style-scoped looks, exclusive looks per world, style registry (ReelForge 3.0)

Status: accepted (2026-10-06). Code: `packages/kit/src/worlds/` (`World`, `defineWorld`, `WORLDS`),
`packages/kit/src/looks/{types,index}.ts` (`Look.styles`, `Look.experimental`, `LookScope`,
`lookInScope`, `isWorldStyle`, `listLooks`, `getLook`, `extraLookDefinitions`), `packages/kit/src/kit.ts`
(`createKit({ style })`, `kitCatalog(…, scope)`), `packages/kit/src/testing/test-world.ts`,
`packages/engine/src/presets/registry.ts`, `packages/stages/src/looks.ts` (`styleLooks`,
`styleLookSummaries`, `fallbackLook`), `packages/cli/src/commands/{looks,kit-docs,kit-docs-index}.ts`.
Docs: `docs/worlds/README.md` (how to add a world), `docs/worlds/DECISIONS.md` (the approved worlds).

## Context

Version 3.0 brings "worlds" (PLAN.md#13.1, phase 13): Sketchbook, Comic, Game B2, Game B1. A world is one
Style (palette, tokens, post-fx filter, resolution, fonts, sound palette) plus its own A/B/C looks and
its own heroes. Papi's foundations (`docs/worlds/DECISIONS.md`) make a world a whole film language: a
Sketchbook film must not cut to a voxel room or a retro-UI window. At the same time nothing may change
for the projects and styles that exist today (voxel-pixel-crisp640, noir-voxel, soft-480): their prompts,
kit-docs, catalog and golden frames are the product Papi uses every day.

## Decision

- **Looks are scoped to styles.** `Look.styles?: string[]` lists the world styles a look belongs to;
  absent = the 2.x looks (voxel, retro-ui, diorama, blueprint, flat-2d, whiteboard, paper-cutout), offered
  in every built-in style. `LookScope { style?, experimental? }` is what callers pass.
- **World styles are exclusive.** A style is a world style when some look lists it (`isWorldStyle`,
  derived from the look list, so tests pass their own). In a world style only that world's looks are
  offered — no voxel, retro-ui or any other 2.x look — everywhere looks are chosen or described: the
  kit catalog (`kitCatalog` drops the voxel API, the voxel env/props/fx and the character pack: worlds
  have their own heroes), `reelforge kit-docs` (index, slices, look ids), `reelforge looks`, the
  storyboard roll/look choice and its validator (`styleLooks(project.style)`), the scene-build docs and
  the frame critic. A shot that names no look or a look of another style builds and is judged in
  `fallbackLook`: voxel wherever voxel is offered, otherwise the world's first (A-roll) look.
- **Runtime binding.** `createKit({ style })` binds only the world's looks next to the voxel kit's own
  definitions. The voxel kit stays bound (its `KitApi` types, `tools.voxel` for building) and its names
  stay reserved, so a world definition can never shadow a voxel one; it is simply never documented or
  offered in a world.
- **Experimental flag.** `Look.experimental` / `World.experimental`: bound into `ctx.kit` of its style
  (showcase renders), never offered to storyboards, kit-docs or the catalog unless the scope asks;
  `defineWorld` requires an experimental world to have only experimental looks.
- **Style registry.** `createStyleRegistry(builtIns, WORLDS)` registers each world's style preset
  (validated by `stylePresetSchema`, `id` = world id, fonts mapped to engine fonts) after the built-ins.
  `ids` (pickers, `reelforge check`, prompts) holds the built-ins and shipped worlds; experimental world
  styles resolve only for showcase renders (`render:frames --experimental`).
- **Registration is one import.** A world lives in `packages/kit/src/worlds/<id>/` and is added to
  `WORLDS`; its looks join `LOOKS` scoped to its style. No shared code changes per world.

## Consequences

- No harm, proved by tests: for no style and every built-in style the catalog, `docs/kit-catalog.md`,
  kit-docs index and slices, prompt variables and ctx.kit are byte-identical with a world registered
  (`packages/kit/src/worlds/worlds.test.ts`, `packages/cli/src/commands/kit-docs-styles.test.ts`,
  `packages/stages/src/looks.test.ts`); exclusivity is proved with the test-only world.
- The storyboard and critic prompt texts still describe the voxel film (roll A = "voxel 3D", the
  `"look": "voxel"` example, "voxel" in the critic's style line). Each world brings its own wording when
  it ships (13.6 Sketchbook first); `voxel-only` look mode has no meaning in a world.
- Sound: a world look names its sound palette; until the world ships one, shots fall back to the voxel
  palette.
- The app's look lists use `styleLookSummaries(project.style)` (`@reelforge/stages`) so the Project
  settings dialog follows the same rule.

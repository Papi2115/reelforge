# Looks (ReelForge 2.0)

One **Style**, many **Looks** (PLAN.md phase 12, ADR-009).

- **Style** = what makes every frame of the film one film: the post-fx pass (palette LUT, Bayer
  dither, outline, vignette), the palette, the pixel fonts and (12.24) the shared sound treatment.
  It lives in `packages/engine` (`styles/<id>/`, `presets/`) and is never replaced by a look.
- **Look** = a family of kit content (environments, props, effects, shot templates) plus the docs
  the runtime Claude builds with, a sound palette id and a variation budget key. Every look renders
  through the same Style. Today only `voxel` (the 1.x kit, unchanged) is available.

## The contract (`packages/kit/src/looks/types.ts`)

| Field | Meaning |
| --- | --- |
| `id` | kebab case, written by storyboards as `shot.look` (`voxel`, `retro-ui`, …) |
| `label`, `description` | the description is the one line the storyboard prompt shows |
| `rolls` | rolls it suits (`A`, `B`, `C`) |
| `treatments` | storyboard treatments it favours (PLAN.md §4.3 taxonomy; a test checks them) |
| `docs` | markdown for the scene-build prompt: how to build a shot in this look |
| `soundPalette` | sound palette id (PLAN.md#12.24) |
| `variationBudget` | variation budget key in `STYLE.md` (PLAN.md#12.8) |
| `available` | only available looks reach storyboards, scene builds, `ctx.kit` and the catalog |
| `kit` | `{ env, props, fx, templates }`: kit definitions (`defineEnv/defineProp/defineFx`) |

`defineLook()` validates a look when the kit loads. A look's definitions are bound into the usual
namespaces (`kit.env.*`, `kit.props.*`, `kit.fx.*`; templates by their kind) next to the voxel
kit's own; a name already used by the voxel kit or another look is an error. Catalog entries carry
`look`; `docs/kit-catalog.md` gets one `## Look …` section per available look besides voxel, and
`reelforge kit-docs` marks those entries `(look <id>)`. With only voxel available, the kit API, the
catalog and kit-docs text are exactly what they were before looks (tested).

## Rolls

Assigned per shot by the storyboard (`shot.roll`), definitions to be refined after the first film:

- **A** = the main visual story (voxel 3D: the character, places, reconstructions). The anchor:
  it comes back every 3–6 s, at least once in every 6 shots.
- **B** = proof and illustration (retro UI, documents, maps, charts, blueprint, diorama, photos
  embedded in a scene).
- **C** = atmosphere and rhythm (glitch, pixel-sort, loops, kinetic text, title cards, metaphors,
  transitions); opens acts.

## Look mode (`project.json` → `lookMode`)

- `voxel-only` — every project without the field (all pre-2.0 projects, the Nokia film, the
  example project). Storyboard prompt, validator and scene-build prompt are byte for byte as
  before (fixtures in `packages/prompts/src/fixtures/`).
- `mixed` — new projects (`templates/project/project.json`). The storyboard prompt adds the roll
  definitions and the available looks; the validator adds the rhythm rules; the scene-build
  prompt gets the shot's look id and docs.

Rhythm rules (`packages/prompts/src/validators/rhythm.ts`, `StoryboardRules`), `mixed` only:

| Rule | Severity | When |
| --- | --- | --- |
| `unknown-look`: look not available | error | always |
| `roll-a-gap`: no A-roll in 6 shots in a row (untagged voxel shot = A) | error | always |
| `missing-roll`: every shot needs a roll | error | ≥ 2 looks available |
| `look-run`: one look > 3 shots in a row (A-roll voxel: 4) | error | ≥ 2 looks available |
| `pattern-run`: one roll + look + treatment > 8 s over several shots | error | ≥ 2 looks available |
| `act-change-roll`: a non-cut transition into a non-C shot | warning | ≥ 2 looks available |

Errors go to the storyboard repair turn; warnings land in the stage record. With voxel as the
only look, rolls are optional and every shot is `voxel`.

## Vibe guard

`vibeGuard(rgba, style)` in `packages/engine/src/vibe.ts` returns `{ ok, offPalettePct, issues }`:
every pixel must be a colour of the style palette (project overrides included) and opaque. The
post-fx pass ends with the palette LUT, so a normal render always passes (the voxel goldens are
checked in a unit test); a failure means a look bypassed the post-fx (own gradients,
anti-aliasing, an unfiltered image). Render tests call `expectVibe(frame, label, style?)` from
`packages/kit/test/support/vibe.ts` on their golden frames. The Haiku critic prompt has a matching
"vibe check" paragraph (same palette, pixel fonts, dithering; no smooth gradients or
anti-aliasing → `off-intent` with a `vibe:` note).

## Adding a look in 6 steps

1. Work only in `packages/kit/src/looks/<id>/` (the stub module already exists for `retro-ui`,
   `diorama`, `blueprint`; a brand-new look adds one import to `LOOKS` in `looks/index.ts`).
2. Build its kit definitions with `defineEnv/defineProp/defineFx` (palette names only, `tools.rng`
   for randomness, pure functions of `t`), list them in `kit`.
3. Write `docs`: what the look is, which definitions to use for which shot, composition and
   camera rules; keep it short (it is sent with every scene build in the look).
4. Fill `rolls`, `treatments`, `soundPalette`, `variationBudget`; flip `available` to `true`.
5. Add render tests with goldens in `packages/kit/test/render/` and call `expectVibe` on every
   golden frame; check the thumbnails/contact sheets by eye.
6. Run `pnpm kit:catalog` (the look gets its catalog section), `pnpm typecheck && pnpm lint &&
   pnpm test && pnpm test:render`; existing goldens must not change.

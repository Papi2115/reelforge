# ADR-024: Character pack as `kit.cast` (PLAN 12.20, part 1)

Status: accepted (2026-10-04). Code: `packages/kit/src/characters/`; CLI topic:
`packages/cli/src/commands/kit-docs-characters.ts`; tests: `packages/kit/src/characters/*.test.ts`,
`packages/kit/test/render/kit-cast.test.ts`. Docs: `docs/characters.md`.

## Context

Papi's character concepts (`docs/concepts/characters.html`) are the input of 2.3.5: 4 mascots
(Bulb chosen as the channel mascot), 10 side-cast members, a neutral mannequin, 8 poses with
personality and a mascot expression system. They must be ported without redesign, stay
deterministic, render in every style, and new professions must look like siblings of the pack.

## Decisions

- **Port the page 1:1, not to the integer voxel grid.** The page builds parts from boxes with
  fractional voxel extents (0.15-voxel collars, 2.6-wide sleeves) and carved unit-voxel volumes.
  `Shape` records the same calls (`cb`, `box`, `vox`) and builds one mesh per joint with the kit's
  shared flat Lambert / unlit materials, palette-resolved vertex colours, no AO (the page has
  none). Converting to `kit.voxel` grids would have changed every proportion.
- **Same rig and clips as the page**, with pure time-driven direction: the page's `setClip` state
  becomes sorted cues (`pose/expression/walkTo/lookAt`, `at` = seconds or an anchor hit);
  evaluating any t in any order gives the same frame (the previous cue keeps playing under the
  0.35 s blend, the head reads the pose `lag` s earlier). Cues at the same time replace each other;
  cues are build-only (after the first `update()` they throw), so no frame depends on the seek
  history.
- **`kit.cast` namespace over the registry.** Four `defineProp` definitions (`mascot`, `person`,
  `mannequin`, `role`) bound with `bindRegistry(..., 'cast')` (validation, per-call phase, origin
  `kit.cast.<name>()`), wrapped by a positional API (`mascot(id, params)`). Catalog: `cast`
  entries tagged `voxel` (no new look) and a `## Characters` section in `docs/kit-catalog.md`. The
  kit-docs index gets one line; the details live in `reelforge kit-docs characters`, so the
  voxel-only index stays inside its budget.
- **Role specs as the extension point.** A zod-validated JSON (body preset, skin, hair, headgear,
  top + ordered clothing layers, legs, shoes, eyes, accessories, held prop) drawn from a fixed
  vocabulary in the page's idiom. The ten cast members are presets of the same builder; every page
  box is a vocabulary item (exact coordinates). Rule from the page: outfit (top, layers with
  trim/detail, legs, headgear) <= 4 colours; skin, hair, shoes, accessories, the prop are extra.
- **Colours through chains.** Page swatches map to `[Crisp 640, Noir, Soft 480, token]` (nearest
  swatch or the kit's existing chain), so Crisp 640 is exact and other styles recolour; the vibe
  guard passes in all three.
- **Old hero untouched.** `kit.props.character` and every existing golden are unchanged.

## Deviations from the page (adapted)

- Lighting is the scene's: the engine renders with colour management off and snaps to the
  palette, so the page's linear-light look is approximated by the stage lights in the tests.
- Turntable, focus camera, pedestals, labels, the skull/brain props and the old-hero comparison
  are page staging, not part of the pack.
- Kid's single left sleeve band (hidden by the sleeve of the same colour) is dropped; the
  astronaut's boot toe is the shared `boots` toe (1.2 instead of 1.0 voxel).

## Consequences

- Scenes get mascots and cast through `ctx.kit.cast`; prompts and series (12.20 parts 2-3) can
  reference role specs as data.
- Preview picking labels cast objects `props.<name>#i` (engine `pick.ts` derives the id prefix from
  the kind); the origin `call` is correct (`kit.cast.<name>()`).
- KIT_VERSION is not bumped: no existing output changes.

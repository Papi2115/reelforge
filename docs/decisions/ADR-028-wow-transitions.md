# ADR-028: Wow transitions (ReelForge 2.3.7)

Status: accepted (2026-10-05). Code: `packages/engine/src/transitions/{enter,paper,shatter,
cube-smash,pieces,dive,wow}.ts`, `packages/shared/src/{transitions,wow-transitions,
transition-picker,storyboard}.ts`, `packages/prompts/src/validators/wow.ts`,
`packages/prompts/prompts/storyboard.md` (`{{#wowTransitions}}`), `packages/stages/src/looks.ts`,
`packages/stages/src/repetition/analyse.ts`, `packages/stages/src/sound/palettes/wow-sfx.ts`,
`packages/pipeline/src/mix/sfx/glass.ts`. Docs: `docs/transitions.md`.

## Context

The transition kit (ADR-011) has quiet, rhythm-keeping styles. Papi approved three families of
showpiece transitions from the 2.3.7 brainstorm: entering the next shot through something on the
subject (lens, binoculars, window, keyhole), object-driven textures (paper roll, cube smash, sponge,
page turn, shatter) and scale dives (in / out, chained for "flat → street → city → globe"). They
must make the viewer's jaw drop, so they have to be rare, fit the content and look like a pro
editor's work — still palette-pure, deterministic and identical in preview and export.

## Decision

- **Same contract as the kit**: eleven new styles in `TRANSITION_STYLES` with a `wow` block
  (`family: enter | texture | dive`, content tags, whether they use `focus`), any look pair,
  0.5–1.4 s. Compositors are pure functions of (A, B, p, seed, focus) that only copy A / B pixels
  (nearest-neighbour zooms, inverse-mapped pieces) or write palette colours; materials (paper,
  brass, wood, sponge, glass) use `tones.nearest(0xRRGGBB)`, so a project palette override still
  stays in its palette. No trigonometry: diamond angles, half-angle rotations, an arc polynomial.
  Exact end frames at p = 0 / 1.
- **Focus**: optional `transitionIn.focus { x, y }` (0..1, zod) flows storyboard → manifest →
  timeline sample → `compositeTransition(params.focus)`; absent = the centre. The shatter / cube
  geometry is built once per (size, seed, focus) and kept in a one-entry cache (pure).
- **Rarity is a rule, not a hope**: `WOW_RULES` (one per 40–90 s; error < 25 s apart or above one
  per 25 s; nothing in the first 6 s except an `enter-*` into a `hook` shot; never two in a row
  except dives over `scaleSequence` shots, counted as one moment; same style within 90 s =
  warning and a repetition item). New optional shot flags `hook` and `scaleSequence`.
- **Chosen by content**: the mixed storyboard prompt lists the wow styles with their content tags
  and the film's budget and asks for `focus` on the subject. The picker never adds a wow style on
  its own unless the shot's intent names one of its content tags and the budget (stricter: 60 s)
  allows it; repetition re-picks never choose one. Voxel-only prompts are unchanged (fixtures).
- **Sound**: every wow style has its own slot in every palette (`wow-sfx.ts`), also within one
  look; one new recipe, `glass-crack` (crack / shatter / tinkle, light, QA-tested), the rest reuse
  existing recipes.
- **Tests**: unit (ends, purity at 19 progress values incl. corner focus points, focus, cache
  determinism, masks), render goldens on synthetic shots (`transition-wow-*`, byte-equal to the
  pure function) and six real look pairs (`transition-wow-look-*`), export = preview parity with a
  `shatter`, validator / picker over synthetic 8-minute storyboards.

## Consequences

- Preview cost: a wow frame composites in about 2–15 ms at 640x360 (shatter / cube smash build
  their piece map once, ~60 ms, per transition).
- The storyboard prompt v14 carries both this and the mascot reaction change of 2.3.7.
- `enter-screen` pattern interrupts still require `crt-zoom`; letting `enter-*` realise them is a
  possible follow-up.

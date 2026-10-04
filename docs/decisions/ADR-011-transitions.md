# ADR-011: Transition kit (PLAN 12.15)

Status: accepted (2026-10-04). Code: metadata and picker `packages/shared/src/transitions.ts`,
`transition-picker.ts`, schema `storyboard.ts` (`transitionIn.style`); compositing
`packages/engine/src/transitions/` (`pixels.ts`, `basic.ts`, `looks.ts`, `index.ts`, `render.ts`),
`timeline.ts`, `runtime.ts`; validator `packages/prompts/src/validators/storyboard.ts`; prompt
`storyboard.md` (v4); plumbing `packages/stages/src/looks.ts`, `stages/storyboard.ts`; sound
`packages/stages/src/sound/palettes/index.ts`. Guide: `docs/transitions.md`.

## Context

With several looks (ADR-009) a film changes between voxel 3D, retro UI, dioramas and blueprints.
The 1.x transitions (crossfade, glitch, wipe) blend colours before the post pass and know nothing
about looks. 2.0 needs transitions that read as part of the retro style, suit the pair of looks
they join, and never change how existing films render.

## Decisions

- **Pixel domain, after the post pass.** A styled transition renders A and B each through the
  full post pass, reads both back and composites on the CPU, choosing per pixel a pixel of A or B
  or a palette tone. Palette purity holds by construction (no blending, no re-quantisation
  needed) and the outputs are A/B frames that already passed the vibe guard. Cost: two renders
  and two read-backs per transition frame (only during transitions, 0.2–0.8 s).
- **CPU, not GLSL.** One TypeScript implementation is the specification and the renderer:
  unit-testable in Node, integer hashes and plain arithmetic (no trig), so it is exact across
  GPUs/backends; the GPU part (each shot's normal frame) is unchanged.
- **`style` is optional and additive.** `transitionIn.type` stays the plain class (sound gesture,
  act detection, fallback); an absent style renders the old GPU transition, so old projects,
  manifests and export cache keys are byte-identical. Any kebab id parses; unknown ids render as
  the plain type and fail the validator.
- **Metadata in shared, compositors in the engine.** The prompts, stages and sound need ids,
  durations and pairs without the engine; the engine registry `TRANSITIONS` joins the metadata
  with the compositors (a test checks both lists match).
- **Look-change specials** (`crt-zoom`, `tile-flip`, `draw-over`, `pixel-sort-melt`) only where
  the look changes; plain styles fit any pair.
- **Picking.** Claude names styles in `mixed` storyboards (prompt lists them, 2+ looks only);
  the stage fills missing ones with the deterministic `transitionFor` (specials weighted where the
  look changes, never the previous style; `recent`/`avoidRecent` are the 12.23 hook) and writes
  storyboard.json back. Transitions keep their meaning (act changes).
- **Sound.** A look change through a special plays the style's sound (`lookChangeSlot`); all
  other cases are unchanged, so voxel-only mixes stay byte-identical.

## Consequences

- New mixed projects get styled transitions at act changes; voxel-only projects see nothing new.
- Every styled transition frame costs an extra render and read-back (preview and export alike).
- Not built: a UI to change a transition's style (edit storyboard.json); styled transitions in
  `voxel-only` prompts; repetition control over more than the previous style (12.23).

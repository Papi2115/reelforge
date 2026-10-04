# ADR-019: Film-level repetition control (PLAN 12.23)

Status: accepted (2026-10-04). Code: schema `packages/shared/src/repetition.ts`, `project.ts`
(`repetitionControl`); analysis, proposals, apply and stage glue `packages/stages/src/repetition/`;
hooks `packages/stages/src/scenes/final-review.ts`, `stages/sound-cues.ts`; UI
`apps/desktop/src/renderer/editing/`, `apps/desktop/src/main/editing-ipc.ts`,
`apps/desktop/src/shared/editing-contract.ts`. User docs: `docs/repetition.md`.

## Context

Ambient variation (ADR-010) keeps neighbouring shots apart and the director never repeats a
variant twice in a row, but a film can still show the same chart three times a minute, use one
transition style back to back or the same whoosh on every cut. 12.23 asks to find these across the
whole film, report them with thresholds and propose replacements that never touch locked shots.

## Decisions

- **Analysis is pure and read-only.** `findRepetitions(film)` takes the storyboard, scene sources,
  cues, words and locks and returns items with proposals; it writes nothing. The stages write
  `.reelforge/repetitions.json` (+ `.md`) as app state, not tracked (decisions are UI state like the
  final review; nothing in the film depends on them).
- **Static scan instead of a recorded template signature.** Scene QA does not record which kit
  templates a scene uses; a regex over `kit.<ns>.<name>(` calls is cheap, deterministic and good
  enough (background definitions are ignored, template-like names identified by keyword). A scene
  that builds a chart by hand is not seen as a template.
- **Proposals reuse the existing pickers.** SFX: `pickRecipe` with a real history (the 12.24 plug-in
  point) over same-category recipes of the shot's palette (voxel: a curated list). Transitions:
  `transitionFor` with the repeated styles as `recent` (voxel-only projects keep plain types).
  Visuals: the 11.3 variant mechanism with a hint; the user still picks. Phrases: report only (the
  voice-over is recorded).
- **The director itself is unchanged.** It still passes `NO_HISTORY`: changing what the director
  picks would change every mixed film's cues; the analysis proposes, the user applies.
- **Apply edits raw JSON.** cues.json / storyboard.json are changed entry by entry (unknown fields
  survive), validated by their schemas before writing, committed by main (`ReelForge-Step:
  repetition`). An entry that no longer shows the repeated value is left alone.
- **Stable ids, sticky decisions.** id = kind + subject + first occurrence time; Ignore / Apply
  statuses are merged into each new analysis.
- **Behind a switch.** `repetitionControl` absent = off: no analysis, no notes, no files (old
  projects unchanged).

## Consequences

- Each final review and Sound cues run reads every scene source once (fast, no rendering).
- Re-picking a transition changes the shot's render (export cache key) but not its timing.
- Not built: automatic replacement during generation, repetition rules for camera moves and
  ambient props, rewording repeated phrases.

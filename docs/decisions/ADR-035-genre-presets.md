# ADR-035: Genre presets (ReelForge 3.3)

Status: accepted (2026-10-07). Code: `packages/shared/src/genre-presets.ts` (schema + table),
`packages/shared/src/genre-preset-apply.ts` (`resolveGenrePreset`, `applyGenrePreset`),
`packages/project/src/create.ts` (`createProject` options `genrePreset`, `explicitFields`,
`isStyleAvailable`), `packages/stages/src/stages/script.ts` (`scriptToneVar`). Task: PLAN.md#13.8
part a (data + apply + channel integration; the New project form is a separate packet). User
guide: `docs/genre-presets.md`.

## Context

One choice when a project is created should set the film's world/style, look mode, rhythm,
direction switches and research mode, and steer the script's tone, the music and the transitions
(PLAN.md#13.8, docs/roadmap-3.0.md). Channels already carry a free-text `genrePreset` (ADR-031).
The mapping is to be tuned with Papi after real films, so it must live in one table. Worlds
(Comic, Game B2) may be registered but not wired, or experimental behind a switch.

## Decision

- **Pure data.** A preset is a zod-validated record (`genrePresetSchema`) in one built-in table
  (`GENRE_PRESETS`): true-crime, tech-explainer, history, finance, science, pop-culture. All values
  are defaults.
- **Applying writes ordinary fields.** `resolveGenrePreset` returns a project.json patch
  (`style`, `lookMode`, `shotsPerMinute`, `fasterChecks?`, the six direction switches,
  `ambientVariation`, `researchMode`, `continuityLinks`) plus `genrePreset: <id>`. The pipeline
  needs no preset code: a preset project behaves exactly like one where the user picked the
  same values; later table changes never alter existing projects (except the script's tone hint,
  which is looked up by id when the script runs).
- **Style fallback.** The preset's styles are ordered; the first the app offers
  (`isStyleAvailable`) wins. A world that is not wired, or experimental with the switch off, is
  skipped; none offered = the style is left to the channel/app default. Every preset lists a
  built-in style. createProject's default availability is "has a style bible" (built-ins only).
- **Precedence.** Explicit form values > genre preset > channel default > app/template defaults.
  The form's preset beats the channel's (`genrePreset: null` = none, not even the channel's); an
  unknown form preset is refused, an unknown channel preset ignored. A world chosen by a preset
  still gets the world defaults (`world-defaults.ts`) on top.
- **Script tone.** The preset's `scriptTone` reaches the script prompt through the existing
  `{{tone}}` variable (`<brief tone>; genre: <hint>`). Without a preset the variable is exactly the
  brief's tone, so no prompt template, version or fixture changes.
- **Tendencies as data.** `musicMoodsPreferred`, `preferredLooks` and `wowTransitionBudget` are
  recorded in the table but not consumed yet (follow-ups for the sound, storyboard and wow
  validators). `@reelforge/stages` tests keep mood, style and look ids in sync with the pipeline,
  engine and kit.

## Consequences

- Legacy projects and projects without a preset are byte-identical (no `genrePreset` field).
- The New project form must pass `explicitFields` for the values the user actually touched, so the
  preset can replace app/channel defaults, and `isStyleAvailable = id => isOfferedStyle(id,
  experimentalWorlds)`.
- Tuning = editing one table (`docs/genre-presets.md` lists the current values).

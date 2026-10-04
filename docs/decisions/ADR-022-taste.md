# ADR-022: Taste learning — a local profile from the user's decisions (PLAN 12.13)

Status: accepted (2026-10-04). Code: `packages/shared/src/taste-profile.ts`, `app-settings.ts`
(`taste.learning`); stages `packages/stages/src/taste/{features,profile,signals}.ts`,
`variants/decide.ts`, `stages/storyboard.ts`, `scenes/shot-job.ts`; prompts `storyboard.md` v9,
`scene-build.md` v9; desktop `apps/desktop/src/main/taste/`, `stages/stages-ipc.ts`,
`apps/desktop/src/shared/taste-contract.ts`, `apps/desktop/src/renderer/settings/TasteSettings.tsx`.
User docs: `docs/taste.md`.

## Context

Variant picks (11.3) and locks (11.4) show what the user likes, but every storyboard and scene
started from zero. 11.3 already logged decisions per project (`.reelforge/taste.json`) without
reading them. The profile must stay local, be visible and resettable, and must not change
anything for users who do not want it (or for old installs).

## Decisions

- **One global profile in the app data folder**, `<userData>/taste.json` (zod v1, atomic writes,
  a broken file is moved aside), not per project and never in git: taste is the user's, not the
  film's. The per-project decision log of 11.3 stays as it is.
- **App switch `taste.learning` (`off` | `auto`).** A settings file without the field reads as
  `off` (existing installs are unchanged); `defaultAppSettings()` — used when there is no
  settings file — has `auto` (new installs). Off = no signals recorded, no profile text.
- **Signals are features, not content.** Pure extraction from the storyboard entry (look, roll,
  treatment, tempo, planned density) and a regex scan of the scene source (kit env/fx templates,
  background and accent swatches, camera moves, annotate density) plus the variant direction.
  Pick = positive for the picked, negative for the other ready variants; keep-current, discard
  (weak), lock (positive), rebuild (weak negative). Variant features shared by all variants (the
  storyboard entry) are not counted against the rejected ones; dropped variants are ignored.
- **Counters with decay and thresholds.** Per feature value positive/negative evidence, halved
  every 60 days; a preference needs ≥ 2 evidence and a lean ≥ 0.34; no profile before 3
  decisions. Deterministic text, ≤ 120 words, ≤ 5 likes + 5 dislikes.
- **A conditional prompt section.** `{{#tasteProfile}}` in the storyboard and scene-build
  prompts (both v9); absent profile = byte-identical prompts (fixture tests). The profile is a
  soft preference below the narration, the rules and variety. Variant builds do not get it.
- **Plumbing through an optional `TasteLearner`** on the StageRunner / StageContext
  (`profile()`, `record(signals)`); the desktop `TasteService` implements it and reads the
  switch on every use. Lock and rebuild signals are recorded where those requests arrive
  (`stages-ipc.ts`), variant decisions inside the stages (`decide.ts`) before the variant files
  are removed.
- **Visible and resettable.** Settings → Taste: switch, profile text, preference bars, decision
  counts, Export (JSON via main's save dialog), Forget everything (confirm).

## Consequences

- No network and no secrets: the profile contains only feature values; the taste code is
  scanned by a test for network APIs.
- The profile follows the user across projects; a project-level override is a possible later
  step (Project settings has a reserved "Taste" section).
- Feature extraction from source is heuristic (regex); unusual code styles teach less, never
  wrongly fail anything.

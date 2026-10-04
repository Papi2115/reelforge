# ADR-027: Scenes per minute (range) and faster checks per project (ReelForge 2.3.6)

Status: accepted (2026-10-04). Code: `packages/shared/src/scene-count.ts`,
`packages/shared/src/tension-tempo.ts` (`ShotTempo`), `packages/prompts/prompts/storyboard.md`
(v13, `{{#shotRange}}`), `packages/prompts/src/{shot-range-vars.ts,validators/shot-range.ts}`,
`packages/prompts/src/validators/{storyboard,rhythm,tension}.ts`,
`packages/stages/src/{settings.ts,stages/storyboard.ts,tension.ts,scenes/{job,qa,final-review}.ts,
props/qa.ts}`, `packages/project/src/create.ts`, desktop `project-settings-*`, `project-service.ts`,
`renderer/project/{SceneCountFields.tsx,scene-count-view.ts,StartScreen.tsx}`,
`renderer/settings/NewProjectSceneCount.tsx`. Docs: `docs/scene-count.md`.

## Context

A real 10:42 film got 139 shots (13/min); the build of an 8-minute film grew from 30–40 min to
over 70 min (scene builds are ~90 % of it), and some sentences were cut into two unrelated
pictures. Papi first asked for a "lean" mode, then (same day) for a free choice of the number of
scenes per minute as a range, plus a separate switch for lighter checks.

## Decision

- **Two optional fields in `project.json`**: `shotsPerMinute: { min, max }` (zod, 1 ≤ min ≤ max ≤
  20) and `fasterChecks: boolean`. Absent = today's behaviour: the storyboard prompt renders byte
  for byte as v12 (fixture `storyboard-standard-full.txt` with every section on, captured from v12
  before the change, plus the voxel-only fixture), the validator runs exactly the old rules, the
  scene settings are the app's. Off / Standard in the UI removes the field instead of writing a
  default. The template gets neither field.
- **Presets** Calm 3–5, Balanced 5–8, Dynamic 8–12, Custom (two numbers); Standard = no range.
  Chosen in the New project form (defaults from Settings → Projects), editable in Project settings
  ("Scenes and checks"; commits "Project settings: scenes per minute 3–5", "… no limit",
  "faster checks on").
- **Validator with a range**: `shots-per-minute` error outside the range ±10 % (film average),
  warning per 60 s window outside [min × 0.6, max × 1.4] (merged into stretches); `cut-mid-sentence`
  error (sentence ends from the script punctuation carried into words.json). A long sentence
  (> min(12 s, 1.5 × 60 / max)) may be cut on a clause boundary or as a continued shot: the new
  optional storyboard field `continues: true` with the same look (chosen over "same treatment and
  look" because the pattern-run rule would then fire on exactly these shots). Shot lengths, the
  pattern window and the tension targets are derived from the range (`shotRangeRules`); a
  `continues` shot is exempt from `treatment-run` and `pattern-run`. The lean draft's hard
  `shot-cap` became the range error.
- **Relaxed vs kept**: relaxed = shot length limits, pattern window, tension tempo targets
  (the rules that forced splits). Kept = transition density (per film length, it does not force
  cuts), annotation density/variety (marks keep long shots alive), interrupts (markers on existing
  shots, density only a warning), look runs and A-roll rhythm (they force look changes, not cuts),
  `treatment-run` = 2 (with the `continues` exemption).
- **Faster checks** (`fasterSceneSettings`, applied in `loadSceneJob`): critic on shots with code
  findings + every 4th shot; `maxFixIterations` ≤ 1; `maxNewProps` ≤ 4; prop turntable 2 angles;
  final review skips fix turns for legibility-only errors. Warnings never got fix turns (only
  `severity: error` findings are fixable), so "no fix turns for warnings" needed no change.
- **Not done**: scene concurrency +1. The scene stage is capped by the account-wide Claude cap
  (`DEFAULT_CLAUDE_CONCURRENCY` = 2, the LimitGuard's max); raising it would also change standard
  projects (chat, variants, final review run alongside) and Papi's PC is already loaded by the
  per-shot frame renders. Left for a decision. The claims check already runs only on "Check
  sources"; the Assets stage already runs only with needs; the tension proposal and repetition
  analysis stay.
- **Stats**: the Storyboard message starts with `42 shots for 10:42 · 3.9/min · range 3–5` (only
  with a range, so standard messages and commits are unchanged).

## Consequences

- Fewer, longer shots put more work into each scene (progressive reveals); the estimate assumes a
  longer shot costs up to 25 % more to build. Real numbers need a real run.
- The Tension panel's shot-length labels still show the standard targets (`targetShotLength`
  without a tempo) in a project with a range (follow-up).
- `reelforge validate` (runtime CLI) checks schemas only, as before; the range rules run in the
  storyboard stage (one repair turn).

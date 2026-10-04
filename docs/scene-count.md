# Scenes per minute and faster checks (ReelForge 2.3.6)

Two independent per-project options, chosen in the **New project** form (start screen), editable
in **Project settings → Scenes and checks**, with app-wide defaults for new projects in
**Settings → Projects → Scenes and checks of new projects**. Decision record:
[ADR-027](decisions/ADR-027-scene-count.md).

Why: on a real 10:42 film the 2.x pipeline planned 139 shots (13 per minute). Scene builds are
about 90 % of the build time ([real-run-v2.3.md](real-run-v2.3.md): 47 Opus builds, 13 fixes and
45 Haiku critic turns for a 2:19 film), so the build of an 8-minute film went from 30–40 min to
more than 70 min. Some sentences were also split into two unrelated pictures.

## Scenes per minute (`shotsPerMinute`)

`project.json` → `"shotsPerMinute": { "min": 3, "max": 5 }` (1 ≤ min ≤ max ≤ 20). Absent = no
range: the storyboard prompt and validator are byte for byte as in 2.3.5.

| Choice | Range | ≈ scenes, 10:00 film | Build vs the default |
| --- | --- | --- | --- |
| Standard (default) | none (2.x films: 10–13 per minute) | 100–130 | – |
| Calm | 3–5 | 30–50 | roughly 60 % faster |
| Balanced | 5–8 | 50–80 | roughly 35 % faster |
| Dynamic | 8–12 | 80–120 | roughly 10 % faster |
| Custom | from–to | | |

The estimate (`sceneCountEstimate`, `packages/shared/src/scene-count.ts`) assumes the build time
scales with the number of shots and a longer shot costs up to 25 % more to build; Faster checks
take a further ~15 % off. It is an estimate, not a measurement.

What a range changes (only then):

- **Storyboard prompt** (`{{#shotRange}}` section, storyboard v13): the range and the expected
  shot count; one idea = one shot; a long sentence is one shot that develops on its words
  (annotations, objects on cue, counters, a camera move) instead of two unrelated pictures; cuts on
  sentence ends; merge neighbours instead of splitting ideas; up to 3 marks in a long shot.
- **Validator** (`packages/prompts/src/validators/shot-range.ts`):
  - `shots-per-minute` **error** when the film's average is outside [min × 0.9, max × 1.1], with a
    "merge neighbouring shots" (too many) or "split the longest shots" (too few) hint;
  - `shots-per-minute` **warning** for stretches where a 60 s window (every 30 s) is outside
    [min × 0.6, max × 1.4];
  - `cut-mid-sentence` **error**: a cut must follow a word ending in `.` `!` `?` `…` in
    `timing/words.json`. Inside a sentence longer than min(12 s, 1.5 × 60 / max) it is allowed on a
    clause boundary (`,` `;` `:` `–`) or when the next shot keeps the look and sets
    `"continues": true`. Narration without sentence punctuation is not checked.
- **Rules derived from the range** (`shotRangeRules`): hard shot length max(1, 0.4 × 60 / max) to
  max(14, 1.5 × 60 / min) s (standard 1–10 s), typical 0.6 × 60 / max to 1.2 × 60 / min s,
  pattern window max(8, 1.2 × 60 / min) s (standard 8 s), tension targets 60 / min s at tension 0
  to 60 / max s at tension 1 (standard 7.5 → 3 s; the prompt's tension table uses them). A
  `continues` shot does not count as a treatment repeat or a pattern-run.
- **Stage line**: the Storyboard message starts with `42 shots for 10:42 · 3.9/min · range 3–5`.

Unchanged: transition density, annotation density and variety, interrupts (markers on existing
shots, they never force a cut), look runs, A-roll rhythm, beat sync, tension proposal.

## Faster checks (`fasterChecks`)

`project.json` → `"fasterChecks": true`. Absent = off = scene QA as before. On
(`fasterSceneSettings`, `packages/stages/src/settings.ts`):

- the Haiku critic looks only at shots with code findings and at every 4th shot (index 0, 4, 8…);
- at most 1 fix turn per shot (standard 2; Economy stays at its own value if lower);
- at most 4 new project props per film (standard 12), prop QA from 2 angles (0°, 90°) instead of 4;
- the final review gives no Opus fix turn to a shot whose only errors are legibility hints (they
  stay ⚠ in the report); the sync check, frame checks and the batched critic still run.

Measured on the scripted 8-shot film (`packages/stages/src/faster-checks-stage.test.ts`: a lint
error, overlapping cards needing two fixes, one critic flag on an unsampled shot):

| | Builds | Fix turns | Critic turns | Total turns |
| --- | --- | --- | --- | --- |
| Standard | 8 | 4 | 9 | 21 |
| Faster checks | 8 | 2 | 2 | 12 (−43 %) |

The trade-off: a shot the critic would have flagged (off-intent, clipped) may slip through, and a
shot needing a second fix stays ⚠ — the final review and the user still see it.

Not changed (see ADR-027): the scene concurrency (the app's account-wide Claude cap is 2 and
the PC renders frames per shot), the claims check (it already only runs on "Check sources"), the
Assets stage (already skipped without needs).

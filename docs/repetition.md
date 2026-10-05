# Film-level repetition control (PLAN.md#12.23)

Finds what the whole film repeats too often and proposes a replacement. Complements ambient
variation (12.8, neighbouring shots) and the director's "not the same variant twice in a row".
Design: `docs/decisions/ADR-019-repetition.md`.

## Switch

`project.json` `repetitionControl`: `auto` (new projects) or `off` (absent = `off`: nothing is
analysed or written). Project settings → Direction → Editing → "Watch for repetition".

## What is found (`packages/stages/src/repetition/analyse.ts`, pure, read-only)

| Kind | Rule (default thresholds) | Proposal (Apply) |
| --- | --- | --- |
| Visual | same look + treatment + kit definitions twice within 45 s | variant build of the later shot(s), with a hint |
| Template | same chart / template definition in 3 shots within 60 s | variant build of the later shots |
| Transition | same transition style (or plain type) twice within 20 s; a wow style (ADR-028) within 90 s, the dives of a scale sequence excepted | re-pick with `transitionFor` (mixed) / another plain type (voxel-only) |
| SFX | same recipe 3× within 30 s, or twice in a row | every other occurrence (the second of a pair) re-picked with `pickRecipe` + a history |
| Phrase | the same 3+ word phrase 3× within 60 s | report only |

- **Kit definitions** come from a static scan of `kit.<namespace>.<name>(` calls in the scene
  source (placeholder scenes and background definitions like `env.lights` do not count); a
  template is a definition named like a chart, map, counter, timeline, window, terminal, browser,
  document, CRT, sheet, table or diagram.
- **SFX**: same-recipe cues closer than 1 s are one designed series (a list reveal) and count once;
  a replacement is another recipe of the shot's sound palette in the same category (voxel: a short
  list of light sounds that do the same job, e.g. whoosh -> swoosh-in), its gain moved to the new
  category's level.
- **Phrases**: quoted passages are deliberate and skipped, so are n-grams of function words only; a
  longer repeated phrase is reported once.
- Severity ⚠ when the repeat is dense (more than the threshold, adjacent shots, within half the
  window), else ℹ. Thresholds are `repetitionThresholdsSchema` (`packages/shared/src/repetition.ts`).
- **Locks**: a change never targets a locked shot (or a cue inside one); an item whose every later
  occurrence is locked is marked "locked shots: nothing to change".

## Files

`.reelforge/repetitions.json` (app state, zod `repetitionsFileSchema`): thresholds, items (id,
kind, severity, subject, text, occurrences, action, changes, locked, status) and counts; and
`.reelforge/repetitions.md`, the same as a readable list. Written after the final review and after
the Sound cues stage (their notes say "Repetitions: 3 open (1 visual, 2 SFX)"). Item ids are stable
(kind + subject + first occurrence), so **Ignore** and **Apply** decisions survive re-analysis.

## Apply / Ignore (Scenes built → Editing)

- **Swap sound**: rewrites the targeted `cues.json` sfx (raw JSON: everything else kept),
  validated by the pipeline schema, committed as "Repetition: 2 whoosh cue(s) swapped
  (swoosh-in)" (`ReelForge-Step: repetition`). No Claude.
- **Re-pick transition**: rewrites the targeted shots' `transitionIn` in `storyboard.json` (style,
  type, duration kept when the new style allows it), committed the same way.
- **Build variants**: queues a shot-variant run (PLAN.md#11.3) per targeted shot with the hint as
  its note; you pick a variant as usual (or keep the current scene).
- **Ignore** / **Reopen**: only the status changes. Phrases have no Apply.

Nothing changes until you press Apply.

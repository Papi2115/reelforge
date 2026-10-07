# Genre presets

One choice when you create a project (PLAN.md#13.8, ADR-035). A preset fills in the film's style
or world, look mode, rhythm, direction switches and research mode, and gives the script a tone
hint. Anything you set yourself in the same form wins over the preset. A channel can name a
preset (Channels → genre preset); its new projects use it unless the form picks another one or
"none".

All values are **defaults**, to be tuned after real films. They live in one table:
`packages/shared/src/genre-presets.ts` (`BUILT_IN_GENRE_PRESETS`).

## What a preset sets

| Field | Where it goes |
|---|---|
| styles (ordered) | `project.json#style`: the first style the app offers. Worlds that are not wired yet, or experimental with Settings → Experimental worlds off, are skipped. |
| lookMode, shotsPerMinute, fasterChecks | the same project.json fields |
| tensionMap, beatSync, patternInterrupts, openLoops, revealMoments, repetitionControl | the same project.json fields (`off` / `auto`) |
| ambientVariation, researchMode, continuityLinks | the same project.json fields |
| scriptTone | added to the brief's tone in the script prompt (`<brief tone>; genre: <hint>`) |
| musicMoodsPreferred, preferredLooks, wowTransitionBudget | recorded only (not used by the pipeline yet) |

`project.json#genrePreset` records the id. A world chosen by a preset still gets the world's own
defaults (mixed looks, continuity on, its own heroes, anti-slop guards on).

Precedence: your choices in the form > genre preset > channel default style > app defaults.

## Current table

Shot ranges per minute: calm 3–5, balanced 5–8, dynamic 8–12. Direction = all six switches
`auto` unless noted.

| Preset | Styles (first offered wins) | Shots/min | Direction | Continuity | Wow budget | Music moods | Looks favoured |
|---|---|---|---|---|---|---|---|
| True crime | noir-voxel | 5–8 | all auto | on | ×0.5 | tense-investigation, calm-tech | blueprint, retro-ui |
| Tech explainer | voxel-pixel-crisp640 → sketchbook | 8–12 | all auto | off | ×1.25 | bright-explainer, calm-tech, retro-wave | blueprint, retro-ui, flat-2d |
| History | sketchbook → comic → soft-480 | 3–5 | interrupts off | on | ×0.75 | lofi-chill, calm-tech, tense-investigation | paper-cutout, diorama, whiteboard |
| Finance | voxel-pixel-crisp640 → sketchbook | 5–8 | all auto | off | ×0.75 | calm-tech, lofi-chill | flat-2d, blueprint, retro-ui |
| Science | sketchbook → voxel-pixel-crisp640 | 5–8 | all auto | off | ×1 | bright-explainer, calm-tech, lofi-chill | diorama, whiteboard, blueprint |
| Pop culture / gaming | game-b2 → voxel-pixel-crisp640 | 8–12 | all auto | off | ×1.5 | retro-wave, bright-explainer | retro-ui, flat-2d |

Every preset: look mode `mixed`, ambient variation on, research mode `ask`, faster checks left
alone.

Script tone hints:

- **True crime**: investigative and measured: concrete dates, places and sources; no gore, no hype
- **Tech explainer**: clear and energetic: one idea at a time, concrete examples and numbers, no hype
- **History**: storytelling in order: people, places and dates by name; vivid but sourced; no anachronisms
- **Finance**: calm and precise: real figures with dates and sources, charts over adjectives, risks said plainly; no financial advice
- **Science**: curious and wonder-driven: intuition first, then the numbers; everyday analogies; say what is still unknown
- **Pop culture / gaming**: playful and fast: references the audience knows, punchy lines, real facts behind the trivia

## Tuning

Edit the table in `genre-presets.ts` (comments say why each value is what it is), update this
page, run `pnpm test` (the shared tests and `packages/stages/src/genre-presets.test.ts` check the
ids against the engine, kit and music engine). Existing projects keep the values they were
created with; only the script tone hint is read from the table when the script runs.

# @reelforge/prompts

Stage prompts of the pipeline (PLAN.md#5.8) as a library: prompt files, a small template renderer,
prompt → bridge stage/model mapping, validators for every stage's output, and evals.

## Prompt files

`prompts/<id>.md` = front matter (`id`, `version`, `model`, `tools`, `output`) + template. They are
bundled into `src/generated/prompt-sources.ts` (strings + sha256), so nothing reads prompt files at
runtime. After editing a prompt run:

```
pnpm --filter @reelforge/prompts generate
```

(the unit tests fail while the bundle is stale). Bump `version` for behavioural changes;
`PROMPT_VERSIONS[id]` (`{ version, sha256 }`) changes with any edit and keys caches. The prompt files
are excluded from Prettier: they are sent to the model byte for byte.

## API

| Export                                                                                                                                                                               | What                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadPrompt(id)`                                                                                                                                                                     | `{ id, version, model, tools, output, template }`; `output`: `files` (paths may contain variables) · `json-reply` (critic) · `reply`                                                                  |
| `renderPrompt(id, vars)`                                                                                                                                                             | `Result<string, PromptError>`; `{{var}}`, `{{#key}}…{{/key}}`; missing required vars → `missing-vars` error; values inserted once, never re-parsed                                                    |
| `renderOutputPaths(id, vars)`, `promptVariables(id)`, `PROMPT_VERSIONS`                                                                                                              | output files of a stage, required/optional variables, cache keys                                                                                                                                      |
| `permissionStageFor(id)`                                                                                                                                                             | bridge `Stage` for `permissionsForStage`/`SessionManager` (1:1 with the prompt id, except the whole-video review: `review-triage` → `critic`, `review-plan` → `storyboard`; usage is booked under it) |
| `promptModel(id, { economy, override })`                                                                                                                                             | override > Economy (`ECONOMY_MODEL` of the bridge) > declared model                                                                                                                                   |
| `validateStoryboard`, `validateScript`, `validateCriticReply`, `validateTriageReply`, `validatePlanReply`, `validateCues`, `validateResearch`, `validateSceneModule`, `parseMissing` | `ValidationReport { valid, value, issues[] }` (issues: `error`/`warning`, stable `code`); `validateCues` takes `CuesFileSchema` of `@reelforge/pipeline`                                              |

## Evals

`evals/cases/<id>/` = `case.json` (stage parameters, canned replies) + `project/` (a complete golden
project: brief, research, beats, script, `timing/words.json` from `spikes/03-audio`, storyboard, cues,
one scene). Cases: `en-tech-doom` (EN tech story), `pl-history-apollo` (PL history story),
`en-short-prism` (EN ~30 s short).

For each case × stage the runner renders the prompt, copies `project/` into a temp folder without the
stage's outputs, runs one turn through the claude-bridge `SessionManager` (stage permissions, sanitized
env, policy audit) and validates what was produced. The JSON report goes to
`packages/prompts/out/evals/report.<mode>.json`.

- **CI / `pnpm --filter @reelforge/prompts test`**: fake-claude (`tools-write` scenario) writes the
  golden outputs back via Write tool calls. No model call.
- **Real CLI (manual, spends subscription usage)**:

  ```
  REELFORGE_REAL_CLAUDE=1 pnpm --filter @reelforge/prompts eval:real
  ```

  Defaults: case `en-short-prism`, stages `script,storyboard,sound-cues` (3 Sonnet turns), hard cap
  `REELFORGE_EVAL_MAX_TURNS=3`, 10 min per turn. Override with `REELFORGE_EVAL_CASES` /
  `REELFORGE_EVAL_STAGES`. `critic` needs real frame PNGs and `scene-build`/`scene-fix` need the
  `reelforge` CLI on PATH, so they are not in the default selection.

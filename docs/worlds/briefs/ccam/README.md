# C-CAM ("Grim Ink") — cloud briefs

Run these in claude.ai/code (cloud sessions, the $250 credit), one session per brief, repository
`Papi2115/reelforge`. Each brief is self-contained: paste the whole file as the first message.

## Rules that apply to every brief
- Base branch: `main` (it must contain `docs/concepts/c-cam-style/`; if the session's checkout lacks that
  folder, run `git fetch origin phase-14/c-cam && git checkout -b <your-branch> origin/phase-14/c-cam`
  instead).
- Work on your own branch named in the brief; open a PR into `main` at the end; do NOT merge it. Do NOT
  edit `PLAN.md`, `CLAUDE.md` or anything under `docs/concepts/` (the Manager updates plan and log after
  the merge; parallel sessions would conflict).
- Roles (CLAUDE.md §1): you are the Manager. Write ALL code and tests through the `coder` subagent
  (Opus 5.5, `.claude/agents/coder.md`) with a work packet (GOAL/TASK/CONTEXT/CONSTRAINTS/ACCEPTANCE/
  OUT OF SCOPE taken from your brief); use the `scout` subagent (Haiku) for reading big files/logs.
  If the `coder` subagent is unavailable, switch the session model to Opus 5.5 and write the code
  yourself. Follow CLAUDE.md §3 (product rules, determinism, preview = export, Windows), §6 (code
  conventions: TypeScript strict, no `any`, files <= 400 lines, tests for every feature, licences) and
  §7 (Conventional Commits).
- Setup: `pnpm install` (Node 24, pnpm from `packageManager`). Verify with `pnpm typecheck`, `pnpm lint`
  and the targeted vitest runs of the packages you touched (CI runs everything; on Linux the render
  tests use SwiftShader goldens).
- Never touch API keys or secrets. Never add dependencies without a licence check (OFL/CC0/MIT only)
  and a note in the PR.
- Existing styles/worlds must stay byte-identical: all existing golden frames and prompt fixtures must
  not change.
- Report in the PR description: what changed, what you verified (commands + results), what you could
  not verify, decisions, follow-ups.

## Wave 1 (independent, start now)
1. `01-quantize-flag.md` — task 14.1: engine preset flag to skip palette quantization (full-colour styles).
2. `02-lettering.md` — task 14.7: CC0 ink-stroke lettering (replaces forbidden system fonts). Mandatory
   before any release.
3. `03-core-brushes.md` — task 14.3: port of core + brushes against a `Paint2D` interface.

## Wave 2 (after spike 14.0 = GO and wave 1 merged; briefs written then)
14.2 world skeleton, 14.4 faces/grime/poses, 14.5 rig + contact, 14.6 camera, 14.8 people/places modules.

## Wave 3
14.9 fixture film (3 packets), 14.10 prompts/docs, 14.11 build stage, 14.12 defaults + guards,
14.13 validators.

Merge order: 01, 02, 03 are disjoint (engine + shared / kit lettering / kit core); merge in any order
after CI is green.

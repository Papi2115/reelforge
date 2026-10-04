# ADR-021: Hook lab — three alternative openings (PLAN 12.16)

Status: accepted (2026-10-04). Code: `packages/shared/src/hook-lab.ts`; prompt
`packages/prompts/prompts/hooks.md` v1 + `validators/hooks.ts`; stages
`packages/stages/src/hook-lab/{generate,decide,store}.ts`; desktop
`apps/desktop/src/main/hook-lab/`, `apps/desktop/src/shared/hook-lab-contract.ts`,
`apps/desktop/src/renderer/hook-lab/`. User docs: `docs/hook-lab.md`.

## Context

The opening decides retention, but the script stage writes one opening and changing it meant
editing by hand. Shot variants (11.3) already showed how to compare alternatives and pick one; the
hook lab applies that to the script's first paragraph, before the voiceover is recorded. Locks
(11.4) must stay untouched.

## Decisions

- **An explicit action in the Script step, not a stage and not a project switch.** Nothing runs
  unless the user opens the lab and presses "Write three openings"; projects that never use it
  are unchanged. It is not a pipeline stage (no status, no gating): the pick is a script edit.
- **One read-only Sonnet turn, no web.** The `hooks` prompt runs under the critic's permissions
  (read-only tools, no web) with Sonnet passed explicitly (like `claims`, ADR-016); a fresh `qa`
  session, so the script session is not disturbed. Economy rules apply through `promptModel`.
- **JSON reply, validated; one repair.** Exactly one opening per form (cold open, question,
  shocking fact), 40–70 words, the script's spoken-text rules, openings distinct from each other
  and from the current one (word Jaccard < 0.8), and every number present in research.md unless
  the opening is flagged `claimsToSource` (then a warning). An opening with a number is always
  flagged. One repair turn with the problems; then a clear error.
- **The opening = the first paragraph.** `scriptOpening` / `replaceScriptOpening` (shared, pure)
  replace only that paragraph; the rest of script.txt stays byte for byte. A set records the
  opening it was written for; a pick on a changed opening is refused.
- **History like variants.** `.reelforge/hooks/<n>.json` (app state, not in git) keeps every set
  and its decision (`pick` + index / `discard`).
- **The existing invalidation, nothing more.** A pick marks stale exactly what a hand edit of the
  script marks (`stagesToInvalidate('script')`: Words timed and everything after it); the script
  step keeps its approval like a hand edit. The voiceover is not invalidated by the pipeline
  graph, so the lab says it explicitly: "You will need to re-record the opening".
- **Locks win.** The pick never touches scenes, locks.json or the storyboard; locked shots whose
  start lies inside the replaced opening (its time range in timing/words.json, else the 150 wpm
  estimate) are listed before and after the pick ("never rebuilt automatically").
- **The app commits.** The stages functions are Electron-free and return the commit subject
  (`Hook lab: opening 2 (Question)`); the desktop service flushes the editor's pending edits
  first, commits (manual, step `script`) and refreshes the pipeline.

## Consequences

- One more prompt id (`hooks`) in the catalogue and the evals (a canned reply per eval case).
- Hook sets are local app state; a project copied without `.reelforge/` loses only the history.
- Re-recording stays a manual step; a later version could re-record only the opening.

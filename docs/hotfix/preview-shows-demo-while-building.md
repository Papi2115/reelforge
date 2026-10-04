# HOTFIX (IMPORTANT): preview shows the demo scene until every shot is built

**Priority:** high — the preview is unusable for the whole "Scenes built" stage (139 shots ≈ the whole build).
**Found:** 2026-10-04, real project "Did AI Just Break Out of Its Test?" (v2.3.0).

## Symptom
- Shots s001–s004 are built, but the preview plays the demo scene (floating cubes) with the note:
  `Project preview unavailable (shot s005_unbelievable: scenes/s005_unbelievable.js is missing) · showing the demo scene`
- Scrubbing stops at 0:05: that is the demo scene's length, not the video's.

## Root cause
`buildProjectManifest` in [apps/desktop/src/main/project-manifest.ts:103-108](../../apps/desktop/src/main/project-manifest.ts) is all-or-nothing:
the loop over storyboard shots returns `unavailable` on the **first** missing scene file. Then
`resolvePreview` ([apps/desktop/src/renderer/preview/preview-source.ts:56-58](../../apps/desktop/src/renderer/preview/preview-source.ts)) falls back to the demo manifest.

## Expected
- Built shots play normally; the timeline is the full video length, with voice-over and words in sync.
- Shots whose scene file is **missing** render a deterministic placeholder for their `t0..t1`
  (dark background + pixel text `<shotId> · building…`, written with the same scene contract and kit text as other built-in scenes).
- A note over the preview, e.g. `136 of 139 shots not built yet · placeholders shown`.
- The preview reloads as scenes land (already handled: `scenes/` is in `PREVIEW_INPUTS`).

## Constraints
- The placeholder must be deterministic (CLAUDE.md §3.2): a pure function of `t`.
- **Preview only.** Export must still require real scenes. Check whether export/render calls `buildProjectManifest`; if it does, put the placeholder behind an option that only the preview passes.
- Other scene read errors (unreadable or invalid) can keep the current `unavailable` behaviour, or show a placeholder with an error label. Pick the safer option and record it.
- Keep the `no-storyboard` behaviour unchanged.

## Files
- `apps/desktop/src/main/project-manifest.ts`: the loop and the placeholder source
- `apps/desktop/src/shared/snapshot-contract.ts`: `ProjectManifestResult` (add e.g. `pendingShots` to `ready`)
- `apps/desktop/src/renderer/preview/preview-source.ts` + `.test.ts`: the note
- `apps/desktop/src/main/project-snapshot.test.ts:186`: expects the old `reason: 'shot s02: scenes/s02_calc.js is missing'`; update it to the new behaviour

## Acceptance
- Unit tests: when some scenes are missing, the result is `ready`, missing shots get the placeholder and the pending count is correct. When all scenes exist, there is no note. The note text is tested.
- `pnpm typecheck && pnpm lint && pnpm test` green.
- Manual: open a project during "Scenes built", see the built shots, placeholders for the rest, and scrubbing across the full length.

## Out of scope
- The Storyboard stage showing "Failed — see details" while shots exist (check separately)
- Export changes, UI redesign

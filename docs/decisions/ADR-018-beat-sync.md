# ADR-018: Beat-synced editing (PLAN 12.21)

Status: accepted (2026-10-04). Code: schemas `packages/shared/src/beat-sync.ts`, `project.ts`
(`beatSync`); grid, snapping, report and stage glue `packages/stages/src/beat-sync/`; music
`packages/pipeline/src/mix/music/music.ts` (`ActSpan.bpm` / `phaseS`, `moodTempoRange`),
`packages/stages/src/sound/music.ts`, `design.ts`, `stages/default-cues.ts`, `stages/sound-cues.ts`;
storyboard hook `packages/stages/src/stages/storyboard.ts`, validator rule `pauseLeadS`
`packages/prompts/src/validators/storyboard.ts`; UI `apps/desktop/src/renderer/editing/`,
`apps/desktop/src/main/editing-ipc.ts`. User docs: `docs/beat-sync.md`.

## Context

Generated beds ran at a tempo picked from the mood range, unrelated to the speech; cuts sat on word
starts wherever the storyboard put them; hits landed on words but not with the music. 12.21 wants
music that follows the speech, and cuts / whooshes / accents on a beat or a stressed word, with a
measurable target (>= 90 % of cuts within one frame), without harming old projects.

## Decisions

- **One grid file, derived, tracked.** `timing/beats.json` is a pure function of the words, the
  storyboard's acts / moods / cuts and the tension curve. Tracked so a revert brings back the grid
  the cuts were snapped to. Derived in the Storyboard stage (after validation, so the cut windows
  are known) rather than after Words timed: the acts and moods that decide the tempo range only
  exist with a storyboard. The Sound cues stage derives it when it is missing (older storyboards).
- **The grid fits the speech and the cuts, not the other way round.** A constant tempo cannot
  reach arbitrary points, so per act the tempo (inside the mood's range, 0.25 bpm steps) and phase
  are searched to put beats inside as many cut windows and on as many accents as possible, with a
  mild pull to a tempo that follows the speech pace and the act's tension. Exhaustive over the
  candidate phases (window / accent edges), deterministic tie-breaks; ~150 ms for 8 minutes.
- **Accents count as the grid.** A cut on a phrase opener is already where an editor cuts, so the
  metric and the snapping accept beats or accented word starts. Most Claude storyboards cut on
  sentence starts, which are accents.
- **Small, safe nudges.** ±100 ms for cuts, only inside the pause, never across or into a word,
  never next to a locked shot, shots >= 1 s; ±120 ms for hits (whole gestures, so riser + hit stay
  together). The storyboard is validated again by the stage's own check; on any error the written
  storyboard is restored. Anchors are global word times, so a cut that never crosses a word cannot
  move an anchor out of its shot.
- **Word-boundary rule widened only with the switch.** Snapped cuts may sit up to 0.2 s into the
  pause before their word (`pauseLeadS`); the rule is 0 for projects without beat sync, so the
  pre-2.2 validation is unchanged.
- **Music locked by offset, not by a new score feature.** A bed rendered at the grid tempo starts on
  a bar at file time 0; the cue's existing `offsetS` aligns it with the grid. The score, voices,
  bass / low-end rules and loudness are untouched (QA: onset analysis on the grid, < 12 % below
  120 Hz, byte-identical). No new "pickup / anti-clash" logic was added: ducking stays as it was.
- **Transitions follow the cut.** The director does not move transition sounds; they peak on the cut,
  which is on the grid.
- **Off by default for old projects.** No field = off: storyboard, cues, music identical (tested by
  the existing no-harm fixtures plus explicit tests).

## Consequences

- New projects: shot boundaries may move up to 100 ms after Claude's storyboard (a commit includes
  `timing/beats.json`); generated beds change tempo (new cache keys).
- The tempo is fixed per act by the storyboard's default moods; a Claude `moods` hint in the Sound
  cues turn re-renders at the same tempo even if that is outside the new mood's range.
- Not built: tempo changes inside an act, beat-aware camera moves, snapping scene-scheduled sounds
  (they follow the visuals).

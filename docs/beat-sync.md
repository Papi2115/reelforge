# Beat-synced editing (PLAN.md#12.21)

The music follows the pace of the narration; cuts, whooshes and accents land on a beat grid or on
an accented word. Design: `docs/decisions/ADR-018-beat-sync.md`.

## Switch

`project.json` `beatSync`: `auto` (new projects, from the template) or `off`. Absent = `off`:
projects made before 2.2 get exactly the storyboard, cues and music they got before (tested).
Project settings → Direction → Editing → "Cut on the beat".

## The grid: `timing/beats.json`

Tracked (next to `words.json`), versioned, zod schema `beatsFileSchema` (`packages/shared/src/beat-sync.ts`).
Written by the Storyboard stage after validation; the Sound cues stage derives it (and writes it)
when it is missing. Pure and deterministic: `deriveBeatGrid` / `gridForFilm`
(`packages/stages/src/beat-sync/grid.ts`, `stage.ts`).

- **Accents** (`accents.ts`): the first word and every word after a pause (>= 0.15 s) or after a
  sentence / clause end (`phrase`), spoken numbers (`number`), `word!` and ALL CAPS (`emphasis`),
  sentence-final words (`final`). Time = the word's start.
- **Acts and moods**: the same acts and default moods the sound design uses (`sound/acts.ts`; with
  the tension map, the tension-driven moods).
- **Tempo per act** within the mood's range (`moodTempoRange`: calm-tech 84–96, lofi-chill and
  tense-investigation 70–84, bright-explainer 100–116, retro-wave 84–100), 0.25 bpm steps, and a
  **phase**, chosen to maximise: 3 × the cut windows (where a cut may move, below) that contain a
  beat + the accents within 35 ms of a beat (phrase / emphasis 1, number 0.75, final 0.5), minus a
  small pull towards the preferred tempo (faster talk and higher act tension = livelier inside the
  range). Cuts already on an accent need no beat and are not targets.
- File: `durationS`, `acts[]` (`from`, `to`, `bpm`, `phaseS` = time of the act's first beat, `mood`),
  `beats[]` (every beat, ms), `accents[]` (`word` index, `t`, `kind`).

## Cuts (Storyboard stage, `snap.ts`)

After the storyboard validates (and transition styles are filled in), `snapCutsToBeats` moves the
boundary between two **unlocked** shots to the nearest beat or accent if:

- it is within ±100 ms and stays in the pause the cut sits in (never inside or across a word; a cut
  a little inside a word belongs to the pause before it);
- both shots stay >= 1 s and longer than their transition.

A cut already within one frame (1/30 s) of a beat or accent stays. The snapped storyboard is
validated again by the stage's own check (word boundaries — with beat sync a boundary may sit up to
0.2 s into the pause before its word, `pauseLeadS` — annotation phrases, shot lengths, transitions,
the tension tempo); if anything fails, the storyboard Claude wrote is restored and the report says
so. Scene anchors resolve against the words in global time, and a cut never crosses a word, so
every anchor stays in its shot and on its word.

## Music and sound (Sound cues stage)

- Each act's bed is rendered at the grid's tempo (`ActSpan.bpm` / `phaseS` -> `planActMusic`): the
  file starts on a bar, and the cue's `offsetS` shifts it so its bars fall on the grid. Everything
  else about the beds is unchanged (moods, energy, bass and low-end rules, -23 LUFS, ducking,
  crossfades); a Claude `moods` hint re-renders at the same tempo. Verified by onset analysis
  (`music.grid.test.ts`: attacks on the grid's eighth notes, < 12 % energy below 120 Hz,
  byte-identical renders).
- The director's spoken-number hits, big-number whoosh-impacts and emphasis riser + hit move as a
  whole so their peak (the event time the rule's lead is measured from) lands on the nearest beat
  or accent within ±120 ms; budget, density rules and palettes are unchanged. Transition sounds
  follow their cut (which is already on the grid).

## Report: `.reelforge/beat-sync-report.json`

`cuts` (total, on the grid within ±1 frame, fraction), `nudges` (moved, locked, kept, mean / max
ms, reverted), `whooshes` (whoosh / swoosh / whoosh-impact cues whose peak — the cut they lead into,
else start + 0.25 s — is within ±120 ms of a beat or accent), `cues.snapped`, `ok` = >= 90 % of
the cuts (and of the whooshes) on the grid. Shown in Scenes built → Editing: "Beat sync ✓ 94 % of
cuts on the beat (±1 frame) · whooshes 100 % · 12 cuts moved (≤ 96 ms)".

Measured: the example film 100 % (4 of 6 cuts moved), a synthetic 8-minute film with cuts 45 ms
into the pause 94 % (53 moved; the rest sit in 20–80 ms gaps with no beat in reach).

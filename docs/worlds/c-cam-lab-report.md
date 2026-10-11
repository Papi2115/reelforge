# Grim Ink quality lab report (PLAN.md#14.17)

The lab plays the model: it writes the narration, then answers every prompt the real pipeline sends
(direction, storyboard, people and places modules, scenes) exactly as the prompt asks, runs the
same self-checks the turns run (`reelforge lint`, `people-preview` with the validators,
`places-preview`, `frames`), lets the real stage QA judge the result, renders the frames and scores
them against `docs/worlds/c-cam-QUALITY-RUBRIC.md` side by side with the Apollo 11 proof sheet
(`docs/concepts/c-cam-style/films/03-apollo-11/proof/`). Defects are fixed by root cause: (a) the
prompt did not ask, (b) the kit lacks a vocabulary item, (c) a validator or critic gap. At most 4
rounds per narration. Rubric scores are honest 1–10.

## Recipe (Linux, no `claude` CLI, no subscription)

1. `pnpm install`, then `pnpm typecheck` (builds every `packages/*/dist`; run it again after kit,
   engine or prompt edits). Playwright's headless Chromium must be installed (the lab machine
   reused an installed build; do not run `playwright install` in the cloud sandbox).
2. A single scene, standalone: `pnpm render:frames -- --scene <scene.js> --at 0.6,2.4 --preset
   c-cam --experimental --out <dir>`. Without `--preset c-cam --experimental` a Grim Ink scene
   fails with `ctx.kit.fx.inkStage is not a function` (the default style has no ink stage).
   People and places are loaded from `people/` and `places/` next to the scene (or `../kit-ext/`).
3. A whole film through the real stages: `node scripts/ccam-lab.mjs <labDir> init | storyboard |
   modules | scenes [s01,s02]`. `<labDir>/authored/` holds the hand-written answers
   (`narration.txt`, `tension.json`, `direction.json`, `storyboard.json`, `people/*.js`,
   `places/*.js`, `scenes/*.js`); the driver creates `<labDir>/project/` (`createProject`, style
   `c-cam`, research off, synthetic 150 wpm words as in real run 1), runs `StageRunner` with
   experimental worlds on and an in-process Claude stand-in that records every prompt in
   `<labDir>/prompts/NN-<kind>.md` and answers with the authored file (a missing answer makes the
   stage fall back or fail: run once without answers to capture the prompts). Scenes are judged
   by the real QA (lint, source checks, text provenance, traces, frame guards); the critic turn is
   stubbed with an `ok` craft note (the frames are judged by hand with the rubric).
4. Inside `<labDir>/project/`, with `REELFORGE_EXPERIMENTAL_WORLDS=1`:
   `node <repo>/packages/cli/dist/main.js lint | people-preview <id> | places-preview <id> | frames
   --shot <id> --at <t,t>`: the commands the turns run. Read the PNGs it prints.

## (a) "What If You Won Your Freedom in the Colosseum?"

Narration (62 words, synthetic timing 27.9 s; facts: the rudis given by the editor at the crowd's
wish, volunteers released, a slave's freedom disputed, Suetonius *Tib.* 7):

> You've just won. The crowd wants you free, and the man paying for the games hands you a wooden
> sword, the rudis. It means you are done. Volunteers walked away. A slave might be freed, though
> sources disagree. But some came back. Tiberius reportedly paid some retired fighters one hundred
> thousand sesterces each to return. Freedom, it turns out, had a price.

Artefacts: `packages/kit/examples/c-cam/lab/a-colosseum/` (direction with 7 beats, two gag arcs,
an accident and a climax ECU; 7 shots C/A/B/A/B/A/A; people `champion` (huge slab jaw under a tiny
dented helmet, `fidget`) and `editor` (tiny head on a vast toga, `sip`); places `arenaSand`,
`arenaGate`; 7 scenes). Frames: `docs/worlds/lab/a-colosseum/before.png` (round 1) and
`after.png` (round 2), one frame per framing.

Pipeline run: direction accepted first time; storyboard: one repair (`pattern-run`: two A-roll
character scenes for 10.9 s) then valid; people: champion needed 5 preview rounds (`hand-in-head`:
the jaw hung at shoulder height, so `D.head` and the neck were raised; `contact-miss` on the
handshake: `elbowOut` 0.8 -> 0.6), editor 1 (`head-pieces`: a double-chin stroke outside the
head outline); places clean; scenes: code QA clean after round 2 (round 1 had "invented text
100 000" and "too few human traces" on the title).

### Defects, root cause and fix

| # | Defect (round 1) | Class | Fix |
| --- | --- | --- | --- |
| 1 | Extreme close-ups miss their object: the palm and falling sword off frame (s03), the snag (s04), the coins (s06). The cut table is built in `build()` with guessed numbers while the contact is solved in the painter. | b | `env.ink.frameOn(subject, size, opts)` puts a solved world point or box on a third at the size's zoom (push keeps it on its spot); the pure helpers are also `stage.ink` in `build()`. Kit-docs `ink-camera`, craft brief, design step (iv); unit-tested. |
| 2 | The editor sips from a steaming yellow coffee mug in Rome: `sip` draws the Apollo film's mug. | b, a, c | Gag option `vessel` (mug, cup, goblet or bowl; mug stays the default, Apollo unchanged); craft brief "Props and gag objects of the period"; critic checklist: period props and the ECU showing its object. |
| 3 | The craft brief (1534 chars) is cut at 1500 in the direction and module prompts: its last rule, the period props, never reached them (real run 1's modern ledger books). | a | Brief rewritten to 1472 chars (depth and contact-framing rules added); prompts test at 1500; stages test that the digest is the whole brief. |
| 4 | The wooden rudis has a black steel hilt and reads as a real sword. | b | A `paleWood` / `wood` sword is a practice sword: grip and guard of the same wood. |
| 5 | The champion's `fidget` (a tap at the belt) is invisible: over-the-shoulder from behind, close-ups cropped at the chest. | a | Brief: the gag plays with "face and acting hand in frame"; framed with `frameOn([forehead, hip])` in s04. Still invisible in the s02 setup (from behind). |
| 6 | Two-layer frames (a wall and a person). | a | Brief rule "Depth: >= 3 layers per framing"; round 2 adds heads, a back, bars, a spear, an arm, the rudis at the lens. |
| 7 | The script prompt asks for 2.5 words/s = 75 words for 30 s, which runs ~36 s with sentence pauses (real run 1: 68 words = 32 s). | a | `wordBudget` 2.2 words/s (66 words for 30 s; this narration's 62 ran 27.9 s). |
| 8 | Text provenance flags "100 000": the guard reads space-grouped digits as two numbers. | — | Scene letters "100,000" (what a fix turn does); guard left as is (follow-up). |
| 9 | The title shot warns `shot-length` (1.9 s < 3 s) and `direction-uncovered b01` although the direction prompt asks for a 1.5–3 s title shot without `beats`. | c | Not fixed (follow-up): the two checks contradict the title-frame rule. |
| 10 | The editor's box is a blank plaster billboard. | — | Module craft (a curtain, an awning, columns), not a prompt or kit gap. |

### Scores (round 1 -> round 2)

| Line | Before | After | What the frames show |
| --- | --- | --- | --- |
| Character | 4 | 5 | Both people specific and readable; close-ups 300–420 px faces with shock, confusion, smugness; but poses are mostly `stand`, the champion is brown on brown (skin, loincloth, sandals) and his back view is a bare cone. |
| Narrative accents | 4 | 6 | Sip setup, escalation and payoff on screen with a goblet; the climax ECU shows purse and palm; the accident (sword snagging the bars) still reads weakly; the coins are small. |
| Camera | 5 | 7 | 2–4 framings per shot, every ECU on its object, subjects on thirds, tilts on the tense beats only; the s06 wide holds 2 s with a slow push. |
| Depth | 3 | 5 | Foreground pieces in 6 of 7 shots; the sets still lack a mid-ground (no props between wall and people). |
| Text | 6 | 7 | Ink lettering only: title poster, RUDIS along the blade, 100,000 on the purse; round 1 had RUDIS in the air and SLAVE on the back. |
| Colour | 6 | 6 | Muddy palette, red purse accent reads; sand and skin close in value. |
| Coherence | 4 | 8 | Goblet, wooden rudis, iron collar, tunics; no mug, no steel hilt. |
| **Overall** | **4** | **6** | |

### Side by side with Apollo 11

Apollo's frames are denser: suits with name tapes and hoses, instrument walls in every set (mid
ground), faces in most framings, a gag (the gum bubble) that is big and readable, and people in
varied acting poses (pointing, a hand on a shoulder, hugging a checklist). The lab film matches
the line, the palette, the poster and the camera rhythm now, but its people act less (stand poses,
few hand gestures), its sets are a wall plus a crowd strip, and the champion's design is a flat
brown silhouette next to Apollo's layered costumes.

### Remaining gaps (below concept level)

- People act stiffly: no pose library beyond `stand/akimbo/walk/point` was used, few hand-on-thing
  gestures; the champion's back view is featureless (a module-quality issue the validators do not
  see; the critic should).
- Sets lack mid-ground props (instrument walls, benches, racks in Apollo); the prompt asks for
  "clutter that tells the place" but the module previews never fail without it.
- The `fidget` setup is still off-screen (over the shoulder from behind): a gag-visibility check in
  the scene QA (face size and acting hand on screen while the gag plays) does not exist; the rule
  lives only in prompt text.
- The accident (s04) and the coins in the climax (s06) are readable only at full size.
- The critic turn was stubbed in the lab: whether the Sonnet critic catches these is unverified.

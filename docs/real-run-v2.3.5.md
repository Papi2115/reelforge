# Real run v2.3.5: character pack, mascot rules, on-demand roles (small verification)

Date: 2026-10-04 · Claude Code CLI 2.1.287 on the user's subscription (Max) · Windows 11 · run by
the Coder through the stage code (`@reelforge/stages` API like `run-stage`, concurrency 1,
`maxFixIterations: 1`, critic on), not through the Electron UI. Method as in
[real-run-v2.3.md](real-run-v2.3.md). Code: `phase-12/v2.3.5-characters` at b86cb0e. Deliberately
small (the user was rendering his own film on the same subscription): one ~1 min film, **4 shots
built**, no export.

## What was run

| Item | Value |
| --- | --- |
| Brief | "How a smoke detector saves lives" (a firefighter and a doctor as natural characters), EN, target 1 min |
| Project | `characters: pack`, `mascot: fox`, `lookMode: mixed`, `researchMode: off`, other 2.x switches `auto` (template); scratch folder with a space in its path |
| Voice-over | SAPI "Microsoft David Desktop", rate +2, 1:04; whisper `large-v3-turbo-q5_0`, 95 % coverage |
| Shots built | s03 (Fox as `pointer`), s08 (`firefighter`, a new role), s09 (`doctor`), s07 (no people) |

Output: `C:\Users\galar\Desktop\ReelForge-test-films\v2.3.5-characters\` — `contact-sheet.png`
(4 shots × 4 times), one frame per shot, s08 before and after the rebuild, the firefighter's role
lineup (`role-firefighter-lineup.png`).

**Two manual edits** (both committed in the project as user edits): the real script dropped the
people of the brief ("Medical sources warn …", no firefighter), so its storyboard rightly had no
people and no `newRoles`; one line of the script was edited to name firefighters and doctors, and
VO/words/storyboard were re-run. The second storyboard put the doctors on a retro-ui text card
(a fair choice), so s09 was edited into a voxel `doctor` shot to exercise the cast.

## Usage

`costUsd` is the CLI's list-price meter (relative measure, not a bill); the ledger
(`.reelforge/usage.json`) says **$8.67** for 29 turns, the sum of the turns' `result.costUsd`
$10.10.

| Step | Wall | Turns (model) | costUsd (result) |
| --- | --- | --- | --- |
| research + script | 71 s | 3 Sonnet | 0.58 |
| storyboard (+ tension) ×2 | 112 s + 83 s | 4 Sonnet | 1.93 |
| role `firefighter` | 69 s | 1 Sonnet (21 tool turns) + 1 Haiku | 0.28 |
| storyboard props | 510 s | 3 Opus + 3 Haiku | 2.07 |
| 4 shots | 925 s | 4 build + 3 fix (Opus), 5 critic (Haiku) | 4.87 |
| rebuild s08 after the fixes | 54 s | 1 Opus + 1 Haiku | 0.37 |

$0.44 went to a prop no built shot uses (`bed`, for s06): with `--shots` the scenes stage still
builds every prop the storyboard flagged (same for roles). Over the ~$8 target because of the
second storyboard and the three props (≈ 40 % of the scene budget).

## Findings

**Storyboard and mascot rules: good.** Both storyboards put the Fox in 2 of 12–13 shots (s03
`pointer` "points at the light sensor", s11 `demonstrator` "presses and holds the test button"),
37–42 s apart, none in the hook, never in a person's shot. With people in the script it listed
`newRoles: [{ id: "firefighter", … }]` once and named it in the intent; no cast member was dressed
up. No validator issue fired (0 repairs), no false positives.

**Role build: works, looks mediocre.** The roles turn read `kit-docs characters` + `cast list`,
copied the docs' firefighter example and, because the storyboard asked for a flashlight (not in the
vocabulary), wrote a valid `characters/accessories/flashlight.json` (hand slot, glowing lens) after
three `cast check` rounds. Code QA and the Haiku critic passed it on the first try. The lineup
reads as a firefighter by its silhouette (helmet, banded coat, air tank), but under the lineup's
default lights the `tan` skin snaps to orange and merges with the `burntOrange` helmet (also seen in
s08), and the flashlight reads as a dark lantern box.

**Fox (s03): readable, wrong pointing.** Whole, ~1/3 of the frame height, expressions timed to the
words (curious → thinking → surprised → alarm "!" on "sounds"). But `point` raises the arm along
the way the body faces; the scene turned the Fox to the camera, so it points at the viewer, not at
the sensor. The docs did not say how `point` aims (**fixed**, below).

**People in dark shots (s08, s09): hard to read.** Both scenes chose `kit.env.lights` `noir` for a
grim/tense mood. Under it the doctor's skin and scrubs turn violet (the mask and cap still read)
and the firefighter is a dark silhouette seen over the shoulder; only the pin label says
"FIREFIGHTER". Re-rendering s09 with `default` / `dramatic` (no Claude) gives a clearly readable
doctor (teal scrubs, skin, mask). **Fixed** in the docs and the scene prompt; the one real rebuild
of s08 (the worst shot) switched to `dramatic`: the helmet and the coat's bands now read, but
Claude kept its over-the-shoulder framing (a rebuild edits the existing scene minimally).

**Other.** s07 (no people) has no mascot or person, as planned; its "3 of 5 dark houses" is weak
(hard to see which ones). Claude called `reelforge kit-docs doctor` once and got "no kit function"
without a pointer to `characters` (**fixed**). No `kit.props.character`, no wrong `kit.cast` call,
no impersonation; `kit-docs characters` (10.7 kB) was read in every people/mascot build. The Haiku
critic passed all four shots and never flagged the dark people.

## Fixed (with tests)

1. **Pointing and staging docs** (`packages/kit/src/characters/docs.ts`, `kit-docs characters`):
   `point` aims along the facing, turn the body toward the target (`rotation.y`), `lookAt` turns
   only the head; lights `default`/`dramatic` on people (`noir` turns skin and outfits violet),
   faces front or three-quarter, the shot's person ≥ ~1/4 of the frame height.
2. **Scene prompt** `scene-build` v12 (bundle regenerated): the same staging rule in the pack
   section and the pointing rule in the mascot section. Classic projects render byte for byte as
   before (fixtures unchanged, `characters-prompts.test.ts`).
3. **`kit-docs <character id>`** (`packages/cli/src/commands/kit-docs-characters.ts`): a mascot, a
   cast member or a project role id answers with its call (`doctor is a cast member:
   ctx.kit.cast.person('doctor')`) and the pack reference; the unknown-name hint lists
   `characters`.

Verified with real Claude: only the lighting part of 1–2 (s08 rebuild switched `noir` →
`dramatic`); the pointing rule was not re-run (budget).

## Remaining (backlog candidates)

- `scenes --shots` builds every storyboard prop and role, not only those of the selected shots.
- Role lineup lights: `tan` skin reads orange under the default rig and merges with an orange
  helmet; the docs' firefighter example has exactly that pair. Consider a warm fill in the lineup
  (as the pack's goldens use) or a skin/headgear contrast check in the role QA.
- The Haiku critic does not judge people's readability (dark/violet faces, back views) — add it
  to the pack-section critic hint.
- The storyboard prompt says the mascot "may stand beside them and react", but
  `mascot-impersonation` rejects a mascot shot whose intent names a profession; one of the two
  should give.
- The script stage dropped the people the brief asked for; the storyboard then has no one to cast.

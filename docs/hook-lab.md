# Hook lab (PLAN.md#12.16)

The first seconds decide whether a viewer stays. The hook lab writes three alternative openings
of the finished script, shows them next to the current one and lets you pick one before you
record the voiceover. Nothing changes until you choose. Decision record: ADR-021.

## In the app

- **Open**: Script → Script tab → **Hook lab…** (top right of the editor). Disabled until there
  is a script; while the Script step runs the lab waits for it.
- **Write three openings**: one Claude turn (Sonnet, read-only tools, no web; Economy rules apply)
  with the `hooks` prompt. Claude gets the current opening paragraph, the rest of the script (it
  must follow the new opening unchanged) and research.md, and writes one opening per form:
  - **Cold open** — start in the middle of the most vivid moment, explain later;
  - **Question** — one sharp question the film answers;
  - **Shocking fact** — the most surprising true fact or number of the research.
- **Compare**: four cards side by side — the current opening (dashed) and the three variants. Each
  card shows the word count and the spoken length at 150 wpm (`58 words · ≈ 23 s`), the
  first-visual idea, "States a fact or number: check its source (Sources tab)." when the opening
  makes a checkable claim, and "Changes against the current opening" (a word diff: green = new,
  red struck = removed). Keys **1/2/3** choose a variant, **Escape** steps back / closes.
- **Use this opening**: a confirm step says what it means — the opening paragraph of script.txt
  is replaced (the rest stays byte for byte), later steps that already ran (timed words,
  storyboard, scenes…) become out of date, **"You will need to re-record the opening: the
  voice-over no longer matches the script."** when a voiceover exists, and **"Locked shots stay
  exactly as they are and are never rebuilt automatically: s01, s02."** for locked shots that
  cover the opening. **Replace the opening** writes the script and commits
  `Hook lab: opening 2 (Question)` (step `script`, revertable from the history).
- **Keep the current opening** closes the set without changes; **Write new openings** asks again.

## Checks (`packages/prompts/src/validators/hooks.ts`)

| Code | Rule |
|---|---|
| `hook-styles` | exactly one opening per form |
| `hook-word-count` | 40–70 spoken words (≈ 15–25 s) |
| `markdown-*`, `stage-direction`, `speaker-label`, `emoji` | spoken text only (the script rules) |
| `hook-similar` | two openings share ≥ 80 % of their words (Jaccard) |
| `hook-unchanged` | an opening is the current one again |
| `hook-number-not-in-research` | a number that is not in research.md and not flagged (error) |
| `hook-number-unsourced` | the same, flagged `claimsToSource` (warning, shown in the dialog) |
| `hook-claim-flag` | an opening with a number is always marked as a claim to source |

An unusable reply gets one repair turn with the problems; a second failure is an error message
in the dialog ("Claude's openings did not pass the checks: …").

## Files

| path | what | git |
|---|---|---|
| `.reelforge/hooks/<n>.json` | `hookSetSchema`: number, time, the opening it replaces, the script fingerprint, the three variants (style, text, first visual, claims flag, word count), check warnings, the decision (`pick` + index / `discard`) | no |
| `script.txt` | changed only by **Replace the opening** | yes |

A set written for an older opening (the script was edited since) is refused: "The script's
opening changed since these openings were written: generate new ones."

## What a pick never does

It never touches scenes, `locks.json`, the voiceover or the storyboard. Out-of-date steps follow
the same invalidation as a hand edit of the script (Words timed and everything after it); locked
shots stay locked and are skipped by the next Scenes build as usual.

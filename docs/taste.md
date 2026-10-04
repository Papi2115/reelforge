# Taste learning (PLAN.md#12.13)

ReelForge learns what you like from your own decisions and tells Claude in a few words when it
plans the storyboard and builds scenes. Everything stays on this computer; you can read, export
and forget the profile at any time. Decision record: ADR-022.

## The switch

Settings → **Taste** → "Learn my taste from variant picks, locks and rebuilds" (app setting
`taste.learning`: `auto` / `off`). A new install starts with it on; an install from before 2.3
(settings.json without the field) keeps it off until you turn it on. Off: nothing is recorded and
the prompts are byte for byte as without taste learning.

## What is learned

Every decision is a signal: what it endorsed (positive) and what it turned down (negative).

| Decision | Positive | Negative | Weight |
|---|---|---|---|
| **Use this one** (shot variants) | the shot + the picked variant's scene + its direction | the other ready variants' scene features + directions | 1 |
| **Keep current** | the shot + the current scene | the variants' features | 1 |
| **Discard all** | — | the variants' directions | 0.5 |
| **Lock** a shot | the shot + its scene ("approved as is") | — | 1 |
| **Rebuild** chosen shots | — | the shot + its current scene | 0.5 |

Features (`packages/stages/src/taste/features.ts`, pure): from the storyboard entry the **look**,
**roll**, **treatment**, **tempo** (shot length: fast < 3.5 s, slow > 6.5 s) and planned mark
**density**; from a scan of the scene source the kit **templates** (`kit.env.*`, `kit.fx.*`), the
**background** swatch, up to three **accent** swatches, **camera** moves (`orbit`, `pushIn`,
`crane`, `dolly`, `shake`, `rackFocus`, `dollyZoom`, `parallax`) and the `ctx.annotate` density;
the variant **direction**. Dropped variants (failed QA) are no opinion and are ignored; a value
on both sides of one decision counts for neither. Variant builds never get the profile (they must
stay genuinely different).

## From counters to the profile (`packages/stages/src/taste/profile.ts`)

- Evidence decays: it halves every **60 days**.
- A value becomes a preference with **≥ 2** (decayed) evidence and a lean of **≥ 0.34**
  (`(positive − negative) / (evidence + 1)`, −1 … +1).
- No profile at all before **3** decisions were recorded.
- The text names at most 5 likes and 5 dislikes, strongest first, **≤ 120 words**, e.g. "Prefers
  orbit camera moves, the retro-ui look, slower cuts (longer shots). Usually turns down violet
  backgrounds, pushIn camera moves." The same profile and time give the same text.

The storyboard prompt (v9) and the scene-build prompt (v9) get it as one conditional section
("Taste profile of this user … a soft preference — the narration, the rules above and variety
come first"). Without a profile the section is absent and both prompts equal their fixtures.

## Settings → Taste

The switch, the profile text (or why there is none: off / "Learning: 2 decisions so far, the
profile is used from 3 on." / no clear preference yet), the strongest preferences with a centred
bar (read out as "Prefers orbit camera moves: 75 %"), the decisions recorded ("2 variant picks ·
1 current scene kept · 0 sets discarded · 1 lock · 1 rebuild"), **Export profile…** (JSON, a save
dialog) and **Forget everything…** (confirm: "Forget all N recorded decisions?" → **Forget
everything**).

## Files

| path | what |
|---|---|
| `<app data>/taste.json` | `tasteProfileFileSchema` v1: `updatedAt`, counters (feature, value, positive, negative), decisions per kind. Atomic writes; a broken file is moved to `taste.corrupt-<time>.json` and the profile starts empty. Only feature values — no project path, shot id or script text. |
| `<project>/.reelforge/taste.json` | the per-project variant decision log of 11.3 (unchanged, not read by the profile) |

Privacy: the taste code has no network access (a test scans it for `fetch`, http, sockets); the
only thing that leaves the machine is the profile text inside the storyboard / scene prompts
sent through your own Claude Code.

# Tension map (PLAN.md#12.22)

The film gets a dramatic curve: calm → escalation → turn → resolution. It lives in
`tension.json` (tracked, next to `storyboard.json`) and steers the storyboard, the sound design
and the render. Decision record: `docs/decisions/ADR-017-tension-map.md`.

## Switch

`project.json` → `"tensionMap": "auto" | "off"`. Absent = `off`: projects made before 2.2 behave
exactly as before (prompts, validators, cues and frames unchanged). New projects get `auto` from
`templates/project/project.json`. UI: Project settings → Direction → "Tension map".

## tension.json

```json
{ "version": 1, "source": "claude",
  "note": "Calm setup, rising curiosity, the payoff at 0:27, Newton as the release.",
  "points": [ { "t": 0, "v": 0.45 }, { "t": 5.33, "v": 0.25 }, { "t": 26.745, "v": 0.85 }, { "t": 36.705, "v": 0.25 } ],
  "segments": [ { "from": 26.745, "to": 30.325, "kind": "peak", "label": "red versus violet" } ],
  "pins": [ { "shotId": "s04_rainbow", "v": 0.62 } ],
  "locked": false,
  "proposal": { "points": [ … ] } }
```

- `points`: `t` seconds (strictly increasing), `v` 0..1; the curve is straight between points
  and flat before the first / after the last. 2–400 points.
- `segments` (optional): `calm` / `rising` / `peak` / `turn` / `release` with a short label.
  Unlabelled stretches are cut into ~15 s windows classified from the curve.
- `source`: `claude` (proposed), `user` (drawn), `edited` (a proposal the user changed;
  `proposal` keeps Claude's original for Reset).
- `locked`: no proposal replaces the curve (not even "Propose with Claude").
- `pins`: locked shots (`locks.json`, PLAN.md#11.4) keep the tension they had when the curve
  changed. A locked shot without a previous curve is pinned to 0.5, which renders exactly as
  without a map.
- Zod schema and helpers: `packages/shared/src/tension.ts` (`tensionAt`, `meanTension`,
  `tensionForShot`, `normalizeTensionPoints`, `resampleTension`, `tensionPreset`,
  `lockedShotPins`) and `tension-tempo.ts` (`targetShotLength`, `tensionAmbientScale`,
  `tensionSpans`, `cutTempoReport`, `withShotTension`).

## Who writes it

- **Claude** (prompt `packages/prompts/prompts/tension.md`, Sonnet, validator
  `validateTension`: covers the narration, has contrast): at the start of the Storyboard stage
  when the map is `auto` and there is no curve, or Claude's curve no longer matches the
  narration length. One turn in the storyboard's session, one repair when the file is invalid;
  a turn that writes nothing is a warning and the storyboard goes on without a curve.
  A user-drawn, edited or locked curve is never replaced by a storyboard re-run.
- **"Propose with Claude"** (Tension panel): the storyboard stage's `tension` action. It
  replaces the current curve (unless locked) and leaves `storyboard.json` and the stage status
  as they were.
- **The Tension panel** (timeline toolbar → "Tension"): drag points (snap to word starts and shot
  boundaries, Alt = free), double-click to add, Delete to remove, arrows to nudge (Shift = fine),
  presets Flat / Rising / Wave / Three acts, Reset (Claude's proposal again, or no curve), Undo,
  Lock curve. Every change is written by main (atomic) and committed as `Tension: …`
  (`ReelForge-Step: tension`), so the project history can revert it.

## What it steers

| Consumer | Rule |
| --- | --- |
| Storyboard prompt | the curve as a table per segment: phase, mean tension, target shot length; calm = longer, wider shots; tense = faster cuts, closer cameras; in mixed looks C-roll at high tension, A/diorama/wide when calm, B proof on plateaus |
| Storyboard validator `tension-tempo` | target `L(v) = 7.5 − 4.5·v` s (7.5 s calm … 3 s peak). Error only for gross misses in segments ≥ 10 s with ≥ 2 shots: mean shot length > 1.6× target where tension ≥ 0.65, < 0.6× target where tension ≤ 0.35; otherwise a warning outside 1/1.35…1.35× |
| `cutTempoReport` | shots per minute, mean shot length and ratio to target per segment |
| Music (`sound/acts.ts`) | act energy = ½ shot density + ½ (0.2 + 0.7·tension); mood per act: tense acts (≥ 0.6, intro/outro ≥ 0.75) the style's tense mood, else its calm one (crisp640 calm-tech / retro-wave, noir lofi-chill / tense-investigation, soft-480 lofi-chill / calm-tech; never bright-explainer). Bass and loudness limits unchanged |
| SFX (`sound/cue-director.ts`) | gesture budget × 0.85 (calm) … 1.2 (peak), tense stretches win the spreading, emphasis (riser + hit) moves up a priority at tension ≥ 0.65; window/gap limits unchanged and the film stays under 92 % of the mix QA's 24 sound moments per minute |
| Render manifest | per shot `ambient.tension` (mean over the shot, or its pin) and `ambient.scale = 0.6 + 0.8·tension` (ambient variation budget); needs ambient variation on |
| Ambient variation (`kit/variation`) | above tension 0.5 a growing share of the tone families takes its closest darker member (by palette luma, `engine/ambient.ts` `darkerTones`): darker backgrounds, still in the palette (vibe guard) |
| Mood grade (`engine/mood.ts`) | host pass on the finished frame (after a reveal flash, before live co-direction), only where the tension reaches the scene: tension ≥ 0.6 steps colours at or above the palette's median luma to their closest darker tone-family member (else the nearest darker swatch) through the 4x4 ordered dither, share `min(0.75, 1.5·(v − 0.5))`; tension ≤ 0.4 lifts colours below the median by `min(0.2, 0.5·(0.5 − v))`; 0.4–0.6 untouched. Text, dim text and outline colours are never graded; transitions blend the two shots' grades. Lit content (rooms, surfaces) now darkens too |
| Scenes | `ctx.ambient.tension` (undefined without a map; treat as 0.5): raise particle/effect density and motion energy with it (`reelforge kit-docs ambient`) |

The preview reloads when `tension.json` changes; the export cache key covers the per-shot
`ambient` object, so changed shots re-render and the others stay cached.

## Locks and staleness

Editing the curve never touches a scene file. Locked shots keep their tension (pins), so their
frames do not change. Unlocked shots follow the new curve right away in the preview (background
tone and ambient budget); their cut tempo and looks change at the next Storyboard run — the
panel lists them as "out of date (tension)". No pipeline step is marked stale.

## Tests

`packages/shared/src/tension.test.ts`, `packages/kit/src/variation/tension.test.ts`,
`packages/engine/src/ambient-tension.test.ts`, `packages/engine/src/mood.test.ts`, `packages/prompts/src/validators/tension.test.ts`,
`packages/stages/src/tension-stage.test.ts` (fake-claude),
`packages/stages/src/sound/tension-sound.test.ts`, `apps/desktop/src/main/tension-service.test.ts`,
`apps/desktop/src/renderer/tension/tension-view.test.ts`, render
`packages/kit/test/render/kit-tension.test.ts` (calm vs tense mean luma incl. a lit room, neutral = no map; contact sheet `packages/kit/out/contact/tension.png`), e2e
`apps/desktop/test/tension.smoke.test.ts`. No harm: the prompt fixtures
(`packages/prompts/src/fixtures/*-voxel-only.txt`) and the sound no-harm snapshot are unchanged.

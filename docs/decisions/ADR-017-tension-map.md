# ADR-017: Tension map (PLAN 12.22)

Status: accepted (2026-10-04). Code: schema and helpers `packages/shared/src/tension.ts`,
`tension-tempo.ts`, `project.ts` (`tensionMap`), `ambient-variation.ts` (`ambient.tension`);
prompt `packages/prompts/prompts/tension.md`, `storyboard.md` (v6, `{{#tension}}` section),
validators `packages/prompts/src/validators/tension.ts`; stage plumbing
`packages/stages/src/tension.ts`, `stages/storyboard.ts` (`tension` action), `sound/acts.ts`,
`sound/cue-director.ts`; render `packages/kit/src/variation/ambient.ts`,
`packages/engine/src/ambient.ts`; manifest builders `apps/desktop/src/main/project-manifest.ts`,
`packages/cli/src/project/shots.ts`; UI `apps/desktop/src/renderer/tension/`,
`apps/desktop/src/main/tension-service.ts`. User docs: `docs/tension.md`.

## Context

A film needs dramaturgy: calm stretches that breathe, a build-up, a peak, a release. Until 2.2
every stage paced the film the same way from start to end. One curve should steer the cut
tempo, the choice of looks/rolls, the music, the background darkness and the effect density,
and later the beat sync (12.21), pattern interrupts (12.25) and reveal moments (12.27).

## Decisions

- **One file, points + optional labels.** `tension.json` (tracked, versioned, zod) holds
  piecewise linear points `{t, v}` and optional labelled segments. Linear segments make every
  consumer's number exact (mean over a shot = integral) and the editor trivial; labels are only
  for the prompt and the UI. Unlabelled stretches get ~15 s auto segments.
- **Off by default for old projects.** `project.json` `tensionMap` absent = `off`; new projects
  `auto` from the template. With `off` (or no valid curve) every consumer runs its 2.1 code
  path: the storyboard prompt section is empty (fixtures unchanged), the validator adds nothing,
  `detectActs`/`directCues` get no curve, the manifest carries no `tension`.
- **Claude proposes inside the Storyboard stage, not as a new stage.** A separate pipeline step
  would change gating, the sidebar and every scripted e2e; a sub-step at the start of the
  storyboard run (same session, Sonnet, `storyboard` permissions) is the least invasive. It runs
  only when there is no usable curve, so re-runs cost nothing extra; a turn that writes nothing
  is a warning. "Propose with Claude" is the storyboard's `tension` action, a review-like run
  (keeps the stage status, no invalidation, no Assets follow-up).
- **The user's curve wins.** A curve with `source` `user`/`edited` or `locked` is never replaced
  by a re-run; `proposal` keeps Claude's last curve for Reset. Edits go through main (atomic
  write + commit per change), so undo is both an in-panel stack and the project history.
- **Tempo as a target, errors only when gross.** `L(v) = 7.5 − 4.5·v` seconds. The validator
  errors only when a decisive segment misses by a wide margin (1.6× slow at high tension, 0.6×
  fast when calm), so Claude keeps freedom for word boundaries and the existing 1–10 s limits.
- **Darkness within the palette.** High tension darkens tone families to their closest darker
  member (palette luma decides, computed in the engine); variation stays in the style budget
  (`scale` 0.6–1.4 by tension), so the vibe guard holds. Tension 0.5 is neutral: scale 1 and no
  darkening = the same frame as without a map.
  Addendum (after the v2.3 real run): lit content (rooms, the Moon's surface) outweighed the
  darker background tones, so the engine adds a host mood grade (`engine/mood.ts`): an
  ordered-dither palette step of the upper-luma colours toward their darker family members at
  tension ≥ 0.6 and a small lift of the lower-luma colours at ≤ 0.4; text/outline colours are
  protected, 0.4–0.6 is untouched, so neutral and pinned shots still render bit for bit as before.
- **Locks.** A locked shot keeps its tension as a pin (neutral 0.5 when there was no curve), so
  its frame never changes with the curve. Unlocked shots that change are reported in the panel
  ("out of date (tension)") instead of marking pipeline steps stale (that would block Scenes
  until a storyboard re-run).
- **Music stays pleasant.** Tension picks between a calm and a tense mood per style, never the
  cheerful `bright-explainer`; bed energy cap, bass and loudness rules are unchanged.
- **SFX within the mix QA.** The director's budget grows at most 1.2× at the peak, and with a
  curve the film keeps under 92 % of the QA's 24 sound moments per minute.

## Consequences

- One extra Sonnet turn on the first Storyboard run of a new project (and on "Propose").
- Scenes can read `ctx.ambient.tension` (only with ambient variation on; undefined otherwise).
- 12.21 (beat sync), 12.25 (interrupt frequency) and 12.27 (reveal moments) read the same file.

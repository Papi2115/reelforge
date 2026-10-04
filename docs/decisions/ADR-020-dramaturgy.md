# ADR-020: Dramaturgy — pattern interrupts, open loops, reveal moments (PLAN 12.25–12.27)

Status: accepted (2026-10-04). Code: `packages/shared/src/{dramaturgy,interrupts,loops,moments,time-remap}.ts`;
prompts `script.md` v2, `storyboard.md` v8, `scene-build.md` v8, validators
`packages/prompts/src/validators/dramaturgy.ts`; stages `packages/stages/src/dramaturgy.ts`
(script / storyboard / scenes / final review / mix plumbing); engine `packages/engine/src/moments.ts`
+ `runtime.ts`; mix `packages/pipeline/src/mix/bus.ts` (`silences`); kit `packages/kit/src/reveal.ts`,
`props/veil.ts`, `looks/retro-ui/redacted.ts`, `looks/blueprint/masked.ts`; desktop
`apps/desktop/src/main/dramaturgy-service.ts`, `project-manifest.ts`,
`apps/desktop/src/renderer/dramaturgy/`. User docs: `docs/dramaturgy.md`.

## Context

With the tension map (ADR-017), the transition kit (ADR-011) and the camera moves (ADR-013) the
film can be paced, but it never surprises: no planned pattern breaks, no questions carried across
the film, no peak that lands. Old projects (voxel-only, made before 2.2) must stay byte for byte
as they are.

## Decisions

- **Three switches, off when absent.** `patternInterrupts`, `openLoops`, `revealMoments` in
  project.json (`off` | `auto`); new projects `auto`. Off = empty prompt sections (fixtures
  captured before the change), no validator rules, no files read, no manifest/mix fields.
- **Interrupts are storyboard markers realised by what already exists.** A marker
  (`shot.interrupt`) names the kind; transitions (look-change specials, `crt-zoom`) and the
  12.28 camera moves realise it, so no new renderer is needed. The kind must be possible for the
  look pair (camera kinds only in voxel, the look that allows free camera moves); "realised" is
  measured from the storyboard transition and the scene source (static `cameraMovesIn`), not
  from frames, which keeps the report cheap and deterministic.
- **Loops are a tracked file with warnings only.** `loops.json` is written by the storyboard turn
  from the script's notes; problems are ⚠ warnings, never errors — a missing payoff is a
  creative note, not a broken film, and a repair turn would cost subscription for little.
- **Veils are kit templates with one shared dither wipe.** `reveal.ts` (Bayer 4x4 thresholds,
  a sweeping wipe with a dithered edge, 8 dissolve steps) drives a voxel crate (one instanced
  shell: no floating voxel parts, one draw call), a retro-ui redaction bar and a blueprint mask.
  Everything stays in the palette (vibe guard) and is a pure function of t.
- **Moments are proposals, decided by the user, applied host-side.** Proposals are a pure
  function of the curve, the words and the scene anchors/cues (sync report), recomputed on
  demand; only decisions are stored (`moments.json`, tracked, committed per decision), so the
  history stays readable. Accepted moments are applied where the effect lives: the render
  manifest (`timeRemap`, `paletteShift` per shot — the engine applies them on seek, so preview =
  export and no scene is rebuilt) and the mix (`silences` + a `hit` cue). Camera moves for a
  moment stay a hint: they need scene code.
- **Slow motion keeps sync by construction.** The remap is s(t) = t − L·(1−r)/(2π)·(1 − cos 2πu)
  over [a, b]: monotone, identity outside the window (bit for bit), s(a) = a, s(b) = b, speed in
  [r, 2 − r] and 1 at the edges. The window starts on the key word and ends before the next
  visual hit, so anchors, cues, words and the VO are untouched and the sync report does not
  change. Engine anchors and cues are resolved at build time from words, independent of the
  remap.
- **Silence hit never touches the voice.** Only the bed buses are multiplied by the silence
  envelope (−40 dB after a 30 ms raised-cosine fade, back to unity exactly on the hit's frame),
  and only in a pause of the VO (≥ 250 ms before the key word). Without silences the bus WAVs are
  the same bytes as before.
- **Palette shift is an in-palette CPU pass.** Mapped style colours step to a lighter member of
  their tone family (STYLE.md variation budgets, else the nearest lighter swatch) through a Bayer
  threshold that follows a fast-attack/hold/release envelope. Only shots with windows pay for it.
- **Locks win.** A locked shot keeps its interrupt marker (validator error otherwise); a locked
  shot's moment cannot be accepted (it renders as approved); a moment accepted before the lock
  stays applied.

## Consequences

- Prompt versions: script 1→2, storyboard 7→8, scene-build 7→8 (caches keyed by prompt versions
  re-run once).
- New tracked files in projects: `loops.json`, `moments.json`; app state
  `.reelforge/reports/dramaturgy.json`.
- Export cache keys of shots with moment effects change; all others stay valid.
- Not done: a Claude touch on the moment proposals (optional per PLAN), automatic camera moves for
  moments (need a shot rebuild), detecting realised interrupts from rendered frames.

# Dramaturgy: pattern interrupts, open loops, reveal moments (PLAN.md#12.25–12.27)

The film gets planned surprises, questions it opens and answers, and "wow" moments at its tension
peaks. Decision record: `docs/decisions/ADR-020-dramaturgy.md`. All three build on the tension
map (`docs/tension.md`), the transition kit (`docs/transitions.md`) and the camera moves
(`docs/camera.md`).

## Switches

`project.json` → `"patternInterrupts"`, `"openLoops"`, `"revealMoments"`, each `"auto" | "off"`.
Absent = `off`: projects made before 2.2 prompt, validate, render and mix exactly as before (the
script prompt renders as script v1 — fixture `packages/prompts/src/fixtures/script-dramaturgy-off.txt`
— and the storyboard / scene-build prompts as their voxel-only fixtures). New projects get `auto`
from `templates/project/project.json`. UI: Project settings → Direction → "Dramaturgy" (three
checkboxes, saved and committed like every project setting).

## Pattern interrupts (12.25)

- **Script** (switch on): `beats.md` gets a `## Surprise beats` section — about 1–2 surprises a
  minute, more where the story escalates, none in the first 5 s, ≥ 15 s apart (never in
  `script.txt`).
- **Storyboard**: a shot carries `"interrupt": { "kind", "note" }` (zod, optional, additive).
  Kinds and how they are realised:

  | Kind | Realised by | Allowed when |
  | --- | --- | --- |
  | `look-switch` | the shot's `transitionIn` (a look-change special such as `tile-flip`, `draw-over`) | the look differs from the previous shot |
  | `enter-screen` | `transitionIn` style `crt-zoom` (required) | the look changes into or out of `retro-ui` |
  | `scale-shift` | `ctx.camera.dollyZoom` in the scene | voxel shots |
  | `perspective-shift` | `ctx.camera.orbit({ t0 … })`, `rackFocus`, `parallax` | voxel shots |

- **Validator** (`packages/prompts/src/validators/dramaturgy.ts`, codes `interrupt-*`): errors for
  an interrupt before 5 s, two closer than 15 s, a kind the look pair does not allow, an
  `enter-screen` without `crt-zoom`, and a locked shot whose marker changed (locked shots keep
  theirs); warnings for a look-switch on a plain cut and for a planned count outside the film's
  range: 1–2 per minute (`interruptRange`), narrowed by the tension curve when there is one
  (target 1/min at tension 0 … 2/min at tension 1, ±30 %).
- **Scene build**: the shot's prompt gets the directive ("Realise it with
  `ctx.camera.dollyZoom({ from, to, t0, t1 })` …"); the marker itself is left out of the shot JSON.
- **Interrupt report** (`buildInterruptReport`, in `.reelforge/reports/dramaturgy.json`): planned
  vs realised per minute; realised = the shot's transition (look change / `crt-zoom`) or the
  camera moves found in the scene source (`cameraMovesIn`). Written by the Storyboard (planned
  only) and by the final review (with the scene sources); an unrealised one is a ⚠ note of the
  review.

## Open loops (12.26)

- **Script** (switch on): opens 1–3 questions the viewer carries ("I'll show you in a moment"),
  closes each later with a foreshadow, and lists them under `## Open loops` in `beats.md`.
- **Storyboard**: writes `loops.json` (tracked, zod `loopsFileSchema`):

  ```json
  { "version": 1, "loops": [ { "id": "why-red", "question": "why does red bend the least?",
    "openedAt": { "t": 12.4, "shotId": "s03_flashlight", "phrase": "show you" },
    "plannedCloseAt": { "t": 31.2, "shotId": "s06_red_violet" },
    "closedAt": { "t": 31.2, "shotId": "s06_red_violet", "phrase": "violet bends the most" },
    "foreshadowed": true, "status": "closed", "veil": true } ] }
  ```

- **Analysis** (`analyzeLoops`, all ⚠ warnings, never errors): never closed (`loop-unclosed`),
  closed without a foreshadow, closed before it opens, closed > 20 s after its planned place, an
  unknown shot, a phrase not spoken near its time. A missing or invalid `loops.json` is a warning
  too. The lines go to the Storyboard's stage record and report, the dramaturgy report, the final
  review notes and the Dramaturgy section of Scenes built.
- **Veils** (`veil: true`): the closing shot keeps the answer covered and reveals it on the
  closing phrase with a deterministic ordered-dither wipe (`packages/kit/src/reveal.ts`); the
  opening shot may show the covered object. Kit templates:
  - voxel `kit.props.veiledProp({ size, revealAt, duration })` — a question-mark crate (one
    instanced voxel shell) that trembles 0.3 s, then dissolves top-down in 8 Bayer steps;
    `cover(object)` puts the answer inside.
  - retro-ui `kit.props.redactedBlock({ text, label, caption, surface, revealAt })` — a
    CLASSIFIED slip whose hatched black bar wipes off left to right.
  - blueprint `kit.fx.maskedRegion({ size, text, caption, revealAt })` — a hatched mask plate
    with a `?` over a value that lights up when the mask is gone (`revealAt` may be a phrase).

## Reveal moments (12.27)

- **Proposals** (`proposeMoments`, pure): the highest local maxima of the tension curve
  (v ≥ 0.6, ≥ 30 s apart, one per ~3 minutes, 1–3) → the key word near each peak (the word of the
  nearest scene anchor within ±6 s, else the weightiest word) → the first kind that fits there,
  rotated per peak:
  - `silence-hit`: only in a pause of the voice — the bed (SFX, ambience, music; never the VO)
    ducks to −40 dB for 250–600 ms (30 ms raised-cosine fade in) and is back at full level on the
    key word, where a `hit` lands (sample-exact: the silence ends on the hit's first frame).
  - `slow-motion`: a time remap of the shot from the key word, 1–2 s long, never past the next
    visual hit (scene anchor or `sfx.at` cue more than 50 ms after the word) or the shot end.
  - `palette-shift`: a 0.5 s flash in which style colours step to a lighter member of their tone
    family (STYLE.md variation budgets; otherwise the nearest lighter swatch) through a 4x4 Bayer
    dither — every pixel stays a palette colour.
  Each proposal carries a camera hint (dolly zoom / orbit / rack focus) that needs a rebuild of the
  shot to add.
- **Decisions**: Scenes built → Dramaturgy → "Reveal moments": Accept / Reject / Preview (seeks
  a second before it). `moments.json` (tracked, zod `momentsFileSchema`) keeps the decisions;
  every change is committed `Moments: accepted slow motion at 0:51 (s02_glass)` (step
  `moments`). A locked shot's moment shows disabled ("unlock it to accept"); a moment accepted
  before the lock stays applied (the shot was approved with it).
- **Applied at render / mix time, never by rebuilding a scene**: the render manifest (preview and
  export share it, `apps/desktop/src/main/project-manifest.ts`) gives the shot `timeRemap` /
  `paletteShift` windows; the export cache key covers them. The mix stage adds the hits and the
  silences (`MixAudioOptions.silences`). Switch off or no `moments.json` = nothing changes.

### The slow-motion curve

For a window [a, b] with slowest speed `rate` (0.25–0.9, proposals use 0.4), film time t maps to
scene time

    u = (t − a) / (b − a)
    s(t) = t − (b − a) · (1 − rate) / (2π) · (1 − cos 2πu)
    s'(t) = 1 − (1 − rate) · sin 2πu        ∈ [rate, 2 − rate]

s(a) = a, s(b) = b, s is strictly monotone, the speed is 1 at both edges (no jump into or out of
the slow motion), slowest a quarter in and fastest (the catch-up) three quarters in; the largest
lag is (b − a)(1 − rate)/π at the middle. Outside the window s(t) = t bit for bit, so anchors,
words, cues and the VO keep their times: the sync report and `reelforge anchors` are unchanged.

## Tests

`packages/shared/src/{dramaturgy,time-remap}.test.ts` (schemas, rules, property tests of the
remap), `packages/prompts/src/{dramaturgy-prompts.test.ts,validators/dramaturgy.test.ts}`,
`packages/stages/src/dramaturgy-stage.test.ts` (fake-claude: script/storyboard prompts, the ⚠ of a
deliberately unclosed loop, repairs, locked markers, scene directives, mix hits),
`packages/pipeline/src/mix/silence-hit.test.ts` (deterministic bytes, the hit on the word),
`packages/cli/src/commands/moments-sync.test.ts` (anchors report unchanged),
`packages/engine/src/moments.test.ts`, `packages/kit/src/reveal.test.ts`, desktop
`dramaturgy-service.test.ts`, `dramaturgy-view.test.ts`; render (SwiftShader)
`packages/engine/test/render/moments.test.ts` (slow-motion frames = the plain shot at the remapped
time, anchors/cues unchanged, palette-shift golden) and `packages/kit/test/render/kit-veils.test.ts`
(veiled / half / revealed goldens for voxel and retro-ui, vibe guard on all three looks); e2e
`apps/desktop/test/dramaturgy.smoke.test.ts`.

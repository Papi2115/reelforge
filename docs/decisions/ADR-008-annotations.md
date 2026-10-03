# ADR-008: Annotation layer (`ctx.annotate`) and annotation plans (PLAN 11.8)

Status: accepted (2026-10-03). Code: `packages/engine/src/annotations/`, card QA
`packages/engine/src/text/check-cards.ts` + `annotations/check.ts`, docs
`packages/cli/src/commands/annotate-docs.ts` (`reelforge kit-docs annotate`), plan schema
`packages/shared/src/storyboard.ts`, plan rules `packages/prompts/src/validators/annotations.ts`,
prompts `storyboard.md` (v2) and `scene-build.md` (v5), stages `scenes/shot-job.ts`,
`scenes/source-checks.ts`, `scenes/sync.ts`, `scenes/sync-report.ts`. Example and goldens:
`packages/engine/examples/s02_annotations.js`, `packages/engine/test/render/annotations.test.ts`
(`annotations-<style>-sheet.png`, one 2x2 sheet per style).

## Context

Films need varied on-screen marks that fit what the narration says (a name gets a pin, a definition
a callout, "here" an arrow…), not only titles and lower thirds. Everything must stay pixel-art,
deterministic, and must not change how existing scenes look.

## Decisions

- **Same overlay as the text.** Annotations draw into the shot's low-res text surface (palette
  colours, 1 px dark rim, Bayer dissolve for fades and dimming), so they get the same palette snap,
  dither and transitions as text, and preview = export. Strokes are "pixel-perfect" 8-connected
  paths (no L-corners), so a draw-on is a prefix of the path.
- **Immediate mode, drawn after `update()`.** Calls in `update` are validated at once (zod, errors
  name the call, the option and the known options; targets get one message listing the forms) and
  queued; `endFrame` projects the targets with the frame's final camera (no dependence on call
  order or the previous frame), draws in call order with spotlights last, and registers each mark
  as a card (`kind: 'annotation'`). Shots without annotations run exactly the old code path.
- **Targets**: kit object (+ anchor name), world point, frame point/region, or a `ctx.text` card
  (+ word range; title/kinetic cards now expose word ink boxes). A whole object (no anchor) also
  gives its projected bounds, used by ring/spotlight/bracket/dimension/arrow.
- **Behind-text marks.** Highlight and spotlight fill only empty overlay pixels (`Paint.under`),
  so text stays on top whatever the call order.
- **QA through the card registry.** Label parts (callout box, pin label, badge, stamp, value
  plates) are card boxes: existing overlap/safe-area rules apply, with an annotation fix hint.
  New rules (warnings, not auto-fixed): `annotation-target-offscreen`, `annotation-target-hidden`
  (raycast occlusion, computed only in the QA probe or for pins with `occlude: true`),
  `annotation-off-anchor`; `annotation-anchor` is an `info` record that the sync report turns into
  `annotation` events (±150 ms). `cardProblems()` filters info records out of problem lists.
- **`phrase`, not `anchor`.** The timing option is `phrase: "spoken words"` (+ `nth`): `anchor`
  already names object anchor points inside targets.
- **Plans are hints.** The storyboard may plan `annotations` per shot (kind, phrase, target, text,
  reason); old storyboards stay valid (optional field, file version unchanged). The validator
  requires phrases spoken inside the shot and variety (no kind 3x in a row within 20 s, ≤ 8 per
  minute; ≥ 3 kinds per busy minute in films ≥ 2 min as a warning). The scene-build prompt gets
  the plan as hint lines and may adapt or drop marks.
- **Legibility.** Labels default to scale 2 (`defaultLowerThirdScale`), badges size themselves to
  fit a scale-2 number; the phone-legibility source check covers labelled annotate calls.

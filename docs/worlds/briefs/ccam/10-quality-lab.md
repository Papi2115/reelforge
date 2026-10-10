# Brief 10 — PLAN.md#14.17: Grim Ink quality lab (prompt + kit iteration with rendered frames)

Branch: `phase-14/ccam-quality-lab`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first. Prerequisite: brief 09 (direction layer) merged to
`main`; if it is not, stop and say so.

## Why
The first real sample (`docs/real-run-grim-ink-1.md`, 5/10, Papi: "tragedy") showed that generic
prompts do not produce the authored feel of the concept films. Real-film iterations burn Papi's
subscription limit. This lab iterates in the cloud, on credit, by letting YOU play the model
(writing the direction plan, the people/places modules and the scenes exactly as the app's prompts
instruct), rendering real frames and comparing with the concept films — then improving the prompts
and the kit vocabulary until the result is at concept level.

## Do
1. Setup: `pnpm install`, make `render:frames` work on Linux (SwiftShader; see
   `docs/spikes/ccam-canvas.md`, `packages/kit/test/render/world-ccam-stage.test.ts`). Study the
   references: `docs/concepts/c-cam-style/films/*/proof/*` (frames), `docs/worlds/c-cam-DIRECTION.md`,
   `docs/real-run-grim-ink-1.md` + the generated sample (scenes + modules are in the report; the MP4
   is not available in the cloud: read the report's defect table).
2. Three narrations (30 s each, ~62–68 words at 150 wpm, English, topic-neutral facts you can verify
   offline; write them yourself): (a) the Colosseum freedom story from the report's brief, (b) a
   lighthouse keeper and a storm night, (c) a bank run in a small town. For each, follow the app's
   own prompts verbatim (`packages/prompts/src/worlds/c-cam*.ts`, `c-cam-build.md`, direction prompt
   from brief 09, scene-build prompt) to produce: direction.json, storyboard, people/places modules,
   scenes. Work like the real pipeline: lint (`reelforge lint`), validators (`validateCharacter`),
   people/places previews, `reelforge frames`.
3. Review every output against a RUBRIC (write it in `docs/worlds/c-cam-QUALITY-RUBRIC.md`, 1 page):
   character (signature gag visible at >= 90 px face height; expression variety; acting not stiff),
   narrative accents (running gag with payoff, an accident, a purposeful climax ECU), camera (2–5
   framings per shot, never a static single wide for > 2 s, Dutch tilt only on tension), depth
   (>= 3 layers: set, mid props, figures, foreground silhouette/piece), text (ink lettering only, no
   overlap with captions), colour (accent object not lost on the same colour ground), coherence
   (period-correct props), and compare side-by-side with the Apollo proof frames.
4. Iterate: when a defect appears, find its ROOT CAUSE class: (a) the prompt did not ask for it ->
   improve the prompt text (c-cam.ts craft brief, c-cam-build.md, scene-build snippets,
   direction prompt) — keep topic-neutral, never paste showcase content; (b) the kit lacks a
   vocabulary item -> add it (e.g. camera moves: push-in/pull-out/rack between framings as
   functions of t, parallax layer helper, ECU framing helper, crowd/background figures, prop
   library: period-neutral generic props with `kind` options) — vocabulary, NOT templates; every
   addition documented in kit-docs (index < 28 KB) and tested; (c) a validator/critic gap -> add
   the check. Maximum 4 iteration rounds per narration; record before/after frames.
5. Deliverables: a single PR with the prompt/kit changes, `docs/worlds/c-cam-QUALITY-RUBRIC.md`,
   `docs/worlds/c-cam-lab-report.md` (per narration: frames before/after, defects found, root-cause
   class, fixes, remaining gaps, and an honest 1–10 per rubric line), and the three narrations'
   direction/scenes/modules under `packages/kit/examples/c-cam/lab/<id>/` as new examples (they
   double as few-shot references for the prompts — wire at most 2 as examples in the build prompts,
   within the prompt size budgets).
6. Hard limits: existing worlds/goldens/fixtures byte-identical except c-cam ones; CI green.

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test` (and `pnpm test:render` for new goldens generated on this
backend; mention CI may need regeneration). The lab report states plainly where output is still
below concept level.

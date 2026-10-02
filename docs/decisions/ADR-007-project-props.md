# ADR-007: Project-local props (`kit-ext/props`) for props the kit lacks (PLAN D9, 7.4)

Status: accepted (2026-10-02). Code: `packages/kit/src/extensions.ts`, `packages/kit/src/voxel/inspect.ts`,
`packages/engine/src/kit-extensions.ts`, `packages/engine/src/lint/{lint-prop,prop-rules,prop-meta}.ts`,
`packages/cli/src/{props/,commands/prop-preview.ts,commands/prop-module-docs.ts,project/kit-ext.ts}`,
`packages/stages/src/props/`, prompt `packages/prompts/prompts/prop-build.md`. Reference module:
`packages/kit/examples/kit-ext/fridge.js`. Tests: unit tests next to the code,
`packages/engine/test/render/kit-ext.test.ts`, `packages/cli/test/render/prop-preview.test.ts`,
`packages/stages/test/props-build.test.ts`.

## Context

The first real runs (docs/real-run-report.md) showed scenes needing objects the kit does not have
(a chip, a file icon, a fridge…). Until now a scene build could only reply `MISSING:` and keep a
fallback (⚠); "extending the kit" meant a repo change by a developer, so every video with an
unusual object shipped with a stand-in.

## Decision: the runtime Claude builds the prop inside the project, the app checks it by code

- **Where**: `<project>/kit-ext/props/<name>.js`, one ES module per prop, tracked in the project's
  git (committed as `Prop <name> built ✓`). Never in the repo kit: the kit stays reviewed,
  versioned code with golden frames and `KIT_VERSION` in the export cache key; a project prop is
  user content like a scene, so it lives (and is versioned and undone) with the project.
- **Contract**: `export const prop = { name, description, params, anchors, methods, build(ctx,
  params) }`. Metadata are literal JSON (read statically by `reelforge kit-docs`, no code runs in
  Node); params are a small JSON-schema-ish spec (`number | enum | boolean | string | color`, each
  with a default) turned into a strict zod schema by the kit, plus the kit's uniform `scale`.
  `build` gets `{ kit: { voxel }, palette, rng }` only and must return one kit object; a missing
  `update(t)` is added as a no-op so scenes can treat it like a kit prop. Names are camelCase,
  equal to the file name, and may not shadow a kit prop (checked by the lint and at load).
- **Loading**: the render manifest carries `kitExtensions: [{ name, file, source }]` (the CLI's
  isolated shot manifests, the app's preview/export manifest and the render service all read the
  same folder). The sandboxed engine imports them as blob modules before any scene and registers
  them in every shot's kit (`ctx.kit.props.<name>`), so preview = export = CLI (CLAUDE.md §3.3).
- **Security / determinism**: prop modules run where scenes run (sandboxed iframe, no Node, no
  network) and pass the same forbidden-API lint plus a prop mode (`prop-contract`, and
  `no-module-state-in-prop`: one module instance serves every shot of a load, so state written by
  any function would make a shot render differently alone than in the full video). The harness
  lint gate rejects a manifest whose props fail the lint, like scenes. Edits stay inside the
  project folder (the bridge's `Edit/Write(./**)` rules already cover `kit-ext/**`).
- **QA by code** (`reelforge prop-preview` and the scene stage): prop lint → a generated
  standalone turntable scene (one view per angle, rendered through the normal shot paths: the
  app's render service or Playwright) → checks: views not blank, largest side 0.3–4 units,
  `kit.voxel.inspect` finds no floating meshes and no voxel islands above a model's floor (the
  rule the kit's own props are tested with), the same view rendered twice is identical → the
  Haiku critic on the turntable sheet ("recognisable as a <name>?"). The inspection travels back
  as an sfx cue of the turntable scene (`prop-metrics {json}`), the one value channel every render
  path already returns.
- **Stage flow**: the storyboard's `missingProps` are built before the first scene; a scene-build
  reply `MISSING: x` or a call of an unknown `kit.props.x` triggers a prop-build turn (Opus, scene
  permissions) for that prop, QA, at most one fix turn with the findings, then the shot is built
  again with `kit.props.x` named in the prompt. One build per name per run (shots share it),
  props already built are reused, at most `maxNewProps` (default 12) new props per film. A prop
  that still fails is moved to `.reelforge/props-failed/` (it must not break other shots) and its
  shots keep the fallback with ⚠ "missing prop: x". `.reelforge/props-report.json` records every
  attempt; the app's banner reads it ("Built N new props: … · Could not build: …").
- **Caching**: a shot's export segment key includes the hashes of the project props its scene
  mentions (all of them when it indexes `props[...]`); projects without props keep their keys.
  The preview reloads the whole video when a prop changes (every shot may call it).

## Alternatives rejected

- Editing `packages/kit` from the app: changes the shared kit for every project, needs a
  rebuild/review and a kit version bump; impossible in a packaged app anyway.
- Props as inline helpers inside scene files: duplicated per shot, not reusable, and the kit
  docs/QA could not see them.
- Executing prop modules in Node for docs/inspection: would run model-written code outside the
  sandbox; metadata are read statically and inspection happens in the engine.

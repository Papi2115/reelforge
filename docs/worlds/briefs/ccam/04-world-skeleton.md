# Brief 04 — PLAN.md#14.2: world skeleton `c-cam` ("Grim Ink"), experimental, not wired

Branch: `phase-14/ccam-world-skeleton`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first (rules). Prerequisites already merged to `main`: spike
14.0 (GO, `docs/spikes/ccam-canvas.md`, `packages/kit/src/fx/ink-stage.ts`), 14.1 (`quantize: false`
preset flag), 14.3 (`packages/kit/src/worlds/c-cam/draw/{paint,core,brushes}.ts`), 14.7 (lettering).
If any of these is missing on `main`, stop and say which.

## Goal
Register the C-CAM world as a real (experimental, `wired: false`) ReelForge world: style preset
(1920x1080, 24 fps, full colour), `defineWorld`, an ink stage fx wired to a CPU-backed 2D canvas, and
one example scene that renders through `render:frames --experimental`. No characters, faces, rig or
camera yet (later tasks).

## Read first
- `docs/spikes/ccam-canvas.md` and the ADR-004 addendum (rules for kit-side canvases: CPU-backed
  `willReadFrequently: true, alpha: false`, reset every frame, no fonts/fillText, no filters, no
  module state across frames, free the canvas on dispose).
- `packages/kit/src/fx/ink-stage.ts` (+ test) from the spike: the canvas stage you build on.
- How the Comic world was added (copy the structure, do not copy the content):
  `git show 5eb8e17 --stat`, `packages/kit/src/worlds/comic/{index.ts,style.ts}`,
  `packages/kit/src/worlds/{index.ts,types.ts}`, `docs/decisions/ADR-032-comic-compositor.md`,
  `packages/stages/src/worlds.ts`, `packages/project/src/world-defaults.ts`.
- `docs/concepts/c-cam-style/docs/07-REELFORGE_INTEGRATION.md` §4 (world shape), §8 (STYLE.md sketch —
  worlds have no STYLE.md; the equivalent is world prompts + kit-docs, a later task), §10 (looks).

## Do
1. `packages/kit/src/worlds/c-cam/style.ts`: the style preset: id `c-cam`, name "Grim Ink", resolution
   1920x1080 (scale 1), fps 24, `quantize: false`, palette tokens for text/annotations taken from
   the C palette (INK `#16120e`, bone, mustard, rust, olive…; <= the preset's token set), fonts:
   map the roles to the engine's `display`/`mono` only (the real lettering is the module from task
   14.7, used through the ink surface).
2. `packages/kit/src/worlds/c-cam/index.ts`: `defineWorld({ id: 'c-cam', experimental: true, wired:
   false, style, looks: [A, B, C], fonts, soundPalette })` with three looks `ink-scene` (A, the
   scene), `ink-insert` (B, insert/ECU/document), `ink-poster` (C, poster/title), each with a short
   look doc (3–6 lines: what it is for, grammar rules). Looks may be disabled per project later (task
   14.12): design `Look.styles`/the looks array so one look can be the only one.
3. `packages/kit/src/worlds/c-cam/stage.ts` + registration in the kit fx list for this world only:
   `kit.fx.inkStage({ size?, ... })` returning `{ paint(t, fn: (g: Paint2D, env) => void) }` backed
   by the spike's canvas + a textured full-frame quad (nearest filtering), per-frame
   `reset → opaque background (INK) → save → fn → restore`, the unit of time = seconds, a `dispose()`
   that frees the canvas. Time quantisation helpers from `core.ts` (`twos`).
4. Add `fps` to `WorldProjectDefaults` (`packages/project/src/world-defaults.ts`; additive, other
   worlds unchanged) and make the project creation use it for worlds that define it (24 for c-cam).
5. Export presets for this world: 1080p x1 and 4K x2 only (1440p is not an integer multiple; hide or
   refuse it for this style: follow how `packages/pipeline/src/export/presets.ts` and the export
   dialog options derive available presets from the style size).
6. One example scene `packages/kit/examples/c-cam/s0_stage.js` (<= 100 lines, scene contract
   `meta/build/update`) that draws a muddy ground, one `inkLine` ribbon, one `blob`, and the INK
   frame, using only the public `kit.fx.inkStage` API; a render test (pattern
   `packages/kit/test/render/`) with a golden; the lint scene check must pass.
7. Hidden by default: the world must NOT appear anywhere unless Settings → Experimental worlds is on
   and `wired` is false means "not offered to users yet" (follow the Comic world's pre-wiring
   behaviour: `render:frames --experimental` renders it, apps/CLI refuse it). Add the "no harm" tests
   other worlds have (`worlds.test.ts`, kit-docs styles list, prompts that enumerate worlds).
8. `docs/worlds/README.md`: add a short section for the new world and the files it adds.

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test` (kit, engine, shared, project, stages, cli, prompts),
`pnpm test:render` green; existing goldens and prompt fixtures byte-identical; `reelforge frames`
with `--experimental` renders the example at 1920x1080; PR description lists files, the preset
values, the render time per frame you observed, and open questions.

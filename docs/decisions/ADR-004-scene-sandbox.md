# ADR-004: Scene sandbox, clock and transitions (PLAN 2.1, 2.2)

Status: accepted (2026-10-02). Code: `packages/engine/src/{harness,runtime,shot,timeline,gl}`; tests: `packages/engine/test/render/engine.test.ts`.

## Decision: the whole engine runs inside one sandboxed iframe; scenes are blob: modules in that realm

```
host page (app renderer / hidden export window / test page)
  window.__reelforge = { load, seek, duration, frame }      <- src/harness/host.ts
    | postMessage (zod-validated, frames as transferred ArrayBuffers)
  <iframe sandbox="allow-scripts" src="engine-frame.html">  <- opaque origin, CSP below
     three.js + runtime + WebGL canvas                       <- src/harness/frame-entry.ts
     scene modules: import(blob:...) of the source text      <- src/harness/module-loader.ts
```

- `sandbox="allow-scripts"` **without** `allow-same-origin`: the frame has an opaque origin (`self.origin === "null"`), so scenes cannot reach the parent DOM, the preload/IPC bridge, storage or cookies. Scenes never have Node (`typeof process/require === "undefined"`, verified by a probe scene in the render tests).
- CSP of the frame: `default-src 'none'; script-src 'self' blob:` — no network (fetch/XHR/WebSocket), no `eval`/`new Function` (verified), no images/fonts/workers. Scene data comes only through `ctx`.
- Scene sources travel inside the manifest (`shots[].scene = { file, source }`); the frame never touches the disk. Each shot gets its own blob URL → its own module instance (no shared module state between shots). `//# sourceURL=<file>` keeps stack traces readable. Scenes must not `import` (bare specifiers cannot resolve); Three.js is `ctx.three`, so there is exactly one Three instance.

### Why not the alternatives
- **Engine in the host, only scenes in the iframe**: Three objects cannot cross a postMessage boundary; the scene graph would have to be serialized every frame. Rejected.
- **No iframe (blob import in the engine page)**: same determinism, but scene code would share a realm with the app's preload bridge. Rejected for isolation; it would also make preview and export differ in where code runs.
- **Worker + OffscreenCanvas**: viable later, but Electron/Chromium readback and DOM-based text (2.5) are simpler in a document. Revisit if the render thread blocks the UI.

### Determinism of `seek(t)`
Inside the frame `seek(t)` is synchronous: sample timeline → `update()` the active shot(s) → render → `readPixels` all in one message handler. The async postMessage hop only delivers the request/response; requests are processed strictly in arrival order (promise queue in the frame), and `frame()` on the host returns the bytes of the last completed seek. Same `t` → same bytes (tested: repeat, reverse order, two fresh pages).

## Scene context (`ctx`)
`three`, `scene` (root of the shot), `camera` (`object` + `set({position,target,fov})`; rigs in 2.4), `kit` (typed empty placeholder until phase 3), `text` (pixel-font cards, ADR-005), `palette` (named hex colours), `anchor(phrase, nth=1)` → local `{t, tEnd}` (stub exact-token resolver over `words.json`; fuzzy resolver is 4.5; unknown phrase = typed error), `sfx.at(t, name)` (build only; cues returned by `load()` in global time; calling it in `update` is an error), `rng` (mulberry32; build stream seeded from `hash(projectSeed, shotId)`, and in `update` a fresh fork on **every call** so per-frame random values depend only on `t`), `shot` info.

## Clock and transitions
- Shots are contiguous from 0 (validated by `renderManifestSchema`); `t >= duration` clamps to the last frame.
- A transition into shot *i* starts at its `t0` and lasts `duration`; the outgoing shot keeps rendering past its `t1` ("overhang"). Hence a shot's local `t` is never negative and `t = 0` is the first frame it appears. The first shot cannot transition in.
- Each active shot renders to its own 640×360 `Nearest` target; one composite pass at output resolution combines A (outgoing) and B (incoming) — `crossfade` (mix), `wipe` (left→right, pixel-snapped edge), `glitch` (12 stepped states, 8-px bands displaced and switched A→B by an integer hash seeded per transition, red-channel split) — and then applies the Bayer 4×4 + palette snap. Blending before quantization keeps every output pixel in the palette (tested).

## Tests / goldens
`pnpm test` (unit, Node, no GPU) covers RNG, palette CPU reference, timeline mapping, anchors, scene contract and ctx. `pnpm test:render` runs Playwright headless-shell Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader` (renderer asserted to be SwiftShader) and compares with SwiftShader PNG goldens in `packages/engine/test/goldens/swiftshader/` (tolerance 0.2 % of pixels; `REELFORGE_UPDATE_GOLDENS=1` rewrites; diffs land in `packages/engine/out/golden-diff/`). Goldens were produced on Windows; Linux SwiftShader equality is expected but unverified until the first CI run.

## Addendum (2026-10-10, spike PLAN.md#14.0): kit-side Canvas 2D rasters
Measured in `docs/spikes/ccam-canvas.md`: a CPU-backed Canvas 2D inside the engine frame is bit-identical across seek order, fresh canvases/pages, SwiftShader and the Electron windows (GPU). Rules for any 2D canvas in the engine frame:
- **Kit code only.** Scenes and project modules never get `document`, a canvas or `OffscreenCanvas` (the scene lint already rejects them); they draw through an API the kit hands them. The canvas, its texture and the quad are created by kit code in `build()`.
- **CPU-backed only:** `getContext('2d', { willReadFrequently: true, alpha: false })` (`STAGE_CONTEXT_SETTINGS` in `packages/kit/src/fx/ink-stage.ts`). The default GPU-accelerated canvas is not reproducible.
- **One canvas per stage, reset every frame:** `reset()` → opaque background → paint as a pure function of `t` → upload. No state survives between frames (no module state, no incremental drawing, no reading the previous frame), no scratch canvases or canvas-to-canvas `drawImage`.
- **No text APIs** (`fillText`, `strokeText`, `measureText`, `font`): they reach system fonts (CSP blocks web fonts, not installed ones), which differ between machines and are unlicensed; lettering is drawn with strokes (ADR-005 spirit). **No `filter`, no `shadowBlur`, no images/`createImageBitmap`/`ImageData` from outside.**
- **Upload** with `CanvasTexture` (`flipY = false`, nearest, no mipmaps, `NoColorSpace`) on a full-frame `ShaderMaterial` quad; the engine's 8-bit linear targets keep the pixels unchanged when the style does not quantize.
- Goldens stay per backend (a Chromium/Skia upgrade may move AA edges).

# Spike 14.0 — Canvas 2D inside the engine (C-CAM / Grim Ink world)

**Date:** 2026-10-10 · **Machine:** Papi's laptop (Windows 11, RTX 4050 Laptop GPU, Node 24.17) ·
**Stack:** three 0.186.1 · Playwright 1.63 (Chromium 153.0.8010.12 headless shell, SwiftShader) · Electron 44.4.5
(Chrome 152.0.7977.130, ANGLE D3D11 on the NVIDIA GPU, no switches = the app's default)
**Code:** `spikes/04-ccam-canvas/` (throw-away) + `packages/kit/src/fx/ink-stage.ts` (kept for PLAN.md#14.2,
not registered) · **Artifacts (gitignored):** `spikes/04-ccam-canvas/out/` (`chromium-swiftshader.json`,
`electron.json`, `*/frame-<t>.png`)

## Verdict: **GO**

A CPU-backed Canvas 2D raster (`getContext('2d', { willReadFrequently: true, alpha: false })`) owned by **kit
code** inside the sandboxed engine frame, repainted from scratch for every `t` and shown on a full-frame quad,
is **bit-identical** in every case measured: forward / reverse / repeated seeks, a fresh runtime + canvas, a fresh
page, Playwright SwiftShader vs. the Electron hidden window vs. a shown Electron window (preview stand-in) on the
GPU — the **same SHA-256 on all of them**, and equal to a reference paint in the host page (0 differing bytes).
With palette quantization off, pixels pass the quad + post pass unchanged. The frame CSP
(`default-src 'none'; script-src 'self' blob:`) does not restrict canvases. Frame time at 1920×1080 is fine for
goldens and export and borderline for preview with heavier real frames (risks below).

## Method

- **Kit side** (`ink-stage.ts`): canvas created once per stage with `document.createElement('canvas')` in the
  engine frame; `render(t, paint)` = `reset()` → opaque background `fillRect` → `save()` → `paint(g, t)` →
  `restore()` → upload. Upload variants: `canvas` (`THREE.CanvasTexture`, `texImage2D` from the canvas) and
  `pixels` (`getImageData` → `DataTexture`). Both: `flipY = false`, nearest filtering, no mipmaps, `NoColorSpace`,
  a `ShaderMaterial` quad in clip space (no depth). The engine already renders to `UnsignedByte` targets with
  `LinearSRGBColorSpace` output and no tone mapping, so no conversion happens anywhere.
- **Test frame** (`spikes/04-ccam-canvas/frame/`): a minimal copy of the C-CAM brushes (hash, noise1,
  Catmull-Rom `curve`, `inkLine` ribbon, `blob` with clip + evenodd crescents + mottle + hatch, `tube`, `wobble`,
  `bands`, `stars`, translucent `pool`/`gloom`, `camera` with cuts on twos, zoom and Dutch tilt), `ST.LW/camZ`
  turned into a per-frame state object. Load ≈ a busy C-CAM set (14 craters + 60 pebbles, 160 stars) + one figure.
  No text. Frames inspected visually (`out/*/frame-*.png`: AA ink edges, translucent pools, full colour).
- **Harness**: the real engine + kit bundle, built by `spikes/04-ccam-canvas/lib.mjs` with three **in-memory**
  patches (repo sources untouched): post pass writes the composed colour instead of the palette LUT (stand-in for
  PLAN.md#14.1), a 1920×1080 preset `ccam-spike` (dither spread 0, no AO/vignette), and `inkStageSpike` appended to
  the kit's hidden app effects. The scene source only calls `ctx.kit.fx.inkStageSpike(...)` / `stage.update(t)`.
- **Runs**: `node spikes/04-ccam-canvas/run-chromium.mjs` (twice) and **one**
  `apps/desktop/node_modules/electron/dist/electron.exe spikes/04-ccam-canvas/run-electron.mjs` (hidden window
  configured like `render-window.ts` for the whole protocol, then a shown, mouse-ignoring window). Afterwards
  `tasklist /FI "IMAGENAME eq electron.exe"` → no tasks.
- **Times**: determinism at t = 0.5, 3.0, 7.25, 12.0 (three camera cuts); perf over 72 frames spread over 0–12.6 s
  after two warm-up seeks; memory over 300 frames at 24 fps (sample after a forced GC every 100 frames).
  Timing = host-page wall time of `seek(t)` + `frame()`: paint + raster + upload + render + post + `readPixels` +
  8.3 MB transfer to the host page. Mode `upload` paints only the background (upload cost); `static` paints once
  in `build()` (render + post + readback only).

## Numbers

**Determinism** (first 16 hex of SHA-256 of the RGBA frame; identical in every row):

| Case | t=0.5 | t=3.0 | t=7.25 | t=12.0 |
|---|---|---|---|---|
| SwiftShader, forward / reverse / repeat / reload / fresh page, both uploads | 71fc48d4… | 951dccf5… | 02dbbfbe… | 0b0eea63… |
| Electron hidden window (D3D11), same five cases, both uploads | 71fc48d4… | 951dccf5… | 02dbbfbe… | 0b0eea63… |
| Electron shown window (preview stand-in) | 71fc48d4… | 951dccf5… | 02dbbfbe… | 0b0eea63… |
| Host-page reference paint vs. engine frame | 0 channels differ (all t, both backends, both uploads) | | | |

**Frame time at 1920×1080, ms per frame (p50 / p95, 72 frames):**

| Path | SwiftShader run 1 | SwiftShader run 2 | Electron D3D11 hidden | Electron shown |
|---|---|---|---|---|
| full, `canvas` upload (paint + upload + post + readback) | 64.5 / 75.9 | 46.9 / 57.2 | **41.6 / 48.5** | 34.3 / 44.6 |
| full, `pixels` upload | 60.3 / 75.6 | 48.6 / 63.9 | 44.7 / 51.2 | — |
| upload only (`canvas` / `pixels`) | 48.1 / 44.9 p50 | 44.9 / 40.2 p50 | 33.4 / 34.4 p50 | — |
| static (render + post + readback + transfer) | 39.2 / 46.2 | 37.6 / 45.6 | 18.7 / 33.7 | — |
| paint recording only (host page) | 1.6 / 2.5 | 1.5 / 2.8 | 1.6 / 3.8 | — |
| raster + `getImageData` (host page) | 12.9 / 16.3 | 13.3 / 21.7 | 9.5 / 14.0 | — |

Reading: Chrome records canvas commands and rasterizes lazily, so "paint" (1.6 ms) is only recording; the real
CPU cost of the test frame is raster ≈ 8–16 ms (full − upload, and the host `getImageData` row). On the GPU the
end-to-end frame is ~24 fps hidden / ~29 fps shown; the fixed 1080p readback + transfer is ~19 ms of it.
Doc 02 §10 measured 3.3–5.6 ms median for the real films — that is also recording only, so real C-CAM frames
will raster slower than this test frame (estimate 1.5–3×).

**Memory over 300 frames** (frame-realm JS heap MB / renderer working set MB, samples at 0, 100, 200, 300):

| Backend, upload | JS heap | Renderer ("Tab"/"renderer") | GPU process |
|---|---|---|---|
| SwiftShader `canvas` | 103 → 161 → 120 → 153 | 508 → 508 → 443 → 443 | 250 → 251 |
| SwiftShader `pixels` | 144 → 161 → 103 → 111 | 452 → 452 → 452 → 402 | 251 → 210 |
| Electron `canvas` | 184 → 133 → 133 → 133 | 549 → 633 → 568 → 607 | 196 → 188 |
| Electron `pixels` | 158 → 216 → 183 → 158 | 810 → 680 → 767 → 953 | 196 → 99 |

No monotonic growth (no canvas/texture leak: one canvas, one texture per stage, re-uploaded in place). `pixels`
churns an 8.3 MB `ImageData` per frame (larger, noisier working set) for no speed gain → **use `canvas` upload**.
(The Electron "Tab" figure sums the hidden window and the fresh-page window that was still open.)

**Lint / goldens:**
- The spike scene (`ctx.kit.fx.inkStageSpike(...)`, `stage.update(t)`) passes `pnpm lint:scene` (0 errors).
  `document.createElement('canvas')` and `new OffscreenCanvas()` in **scene** source are errors
  (`no-host-globals`, `no-network`); `new ctx.three.CanvasTexture(...)` / `DataTexture` are not linted, but a scene
  has no way to obtain a canvas. Texture creation therefore stays kit-only by construction.
- Golden workflow holds: render twice / fresh page → byte-identical, so `pnpm test:render` goldens (0.2 % tolerance)
  will be stable; here SwiftShader and D3D11 even agree bit for bit (unlike 3D styles, spike 1.2: 5.83 % differ),
  because the image is Skia's CPU raster and the GPU only copies it. Keep per-backend goldens anyway (a Chromium /
  Skia upgrade may change AA edges; see risks).

## Risks

| Risk | Mitigation |
|---|---|
| Real frames (characters, faces, grime) raster 1.5–3× slower → preview at 1080p < 24 fps | measure on the Apollo port (14.9); optional half-resolution preview stage (`render` at 960×540 with `g.scale(0.5)`, export stays full) |
| The 2D raster runs on the renderer main thread; render windows of the app share one renderer process (`render-backend.ts` load gate), so export workers do not parallelize the paint | export at ~20 fps is acceptable (8 min @ 24 fps ≈ 10 min); if not, separate renderer processes per export window |
| 1080p native output: 8.3 MB/frame readback + transfer (~19 ms on the GPU) vs. 0.9 MB for 640×360 styles | inherent to a native-1080p style; no upscale step in ffmpeg |
| Chromium/Skia upgrade changes AA rasterization | per-backend, per-Electron goldens with the existing tolerance; re-baseline on upgrades |
| GPU-backed canvas (`willReadFrequently` missing) is not reproducible (doc 02 §6: 12–45 channels differ) | `STAGE_CONTEXT_SETTINGS` fixed in the kit; unit-tested; ADR-004 addendum |
| Canvas-to-canvas `drawImage` (scratch canvases) gave first-render differences (doc 02 §6, film 1 daydream) | rule: one canvas per stage, no `drawImage` between canvases; silhouettes as a flat-fill mode (14.6) |
| `fillText` would use system fonts (CSP blocks web fonts, not installed fonts) → machine-dependent, unlicensed | rule: no text APIs; lettering with ink strokes (14.7) |
| A stage is ~8 MB of canvas backing store; hot reloads create new stages | 14.2: free on kit dispose (`canvas.width = 0`) |

## Plan B (only if a later Chromium breaks this)

A software path rasterizer into a kit buffer, like Comic's `ComicCanvas` but RGBA truecolor with coverage AA:
transform stack, flattened paths (C-CAM already flattens curves into polygons), scanline fill with nonzero and
evenodd winding and analytic/sparse-supersampled coverage, clip-mask stack, `globalAlpha` blending, round-cap
strokes for hatching, ellipses, rects. Integer/fixed-point math → bit-identical everywhere. Effort: ~1000–1300 LOC
+ tests, 3–4 packets (≈ 1 week of Coder time); speed risk: plain JS AA raster at 1080p is likely 3–10× slower than
Skia (50–150 ms/frame), so it would also need a half-res preview. Not needed now.

## What stays for 14.2

- `packages/kit/src/fx/ink-stage.ts` (+ unit test): `createInkStage(tools, { width, height, background, upload })`
  → `{ mesh, render(t, paint) }`. Not registered anywhere. 14.2 wraps it as `kit.fx.inkStage` of the c-cam world,
  keeps `upload: 'canvas'` (the `pixels` variant can go), adds dispose of the canvas and the drawing API `g`.
- Quantization stays on for every style; the spike's LUT bypass existed only in the spike bundle (14.1 adds the
  real `quantize: false`).

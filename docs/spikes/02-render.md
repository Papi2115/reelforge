# Spike 1.2 — Deterministic low-res Three.js render → 1080p MP4

**Date:** 2026-10-02 · **Machine:** Windows 11, RTX 4050 Laptop GPU + Radeon 740M iGPU, 6 cores, 15 GB RAM, Node 24.17, ffmpeg 8.1.1 (GPL, NVENC)
**Code:** `spikes/02-render/` · **Artifacts (gitignored):** `spikes/02-render/out/` (`spike.mp4`, `spike-nvenc.mp4`, `spike-electron*.mp4`, `frame-*.png`, `bench-*.json`, `export-report.json`)
**Stack measured:** three 0.186.1 · Playwright 1.63.0 (Chromium 153.0.8010.12 headless shell) · Electron 44.4.5 (Chrome 152.0.7977.130)

## Verdict: **GO for D1, D2 (render side), D3, D4**

- Render is **~10× over target**: seek + post pass + `readPixels` at 640×360 runs at **~0.9–1.4k fps** on the GPU
  (target ≥ 100 fps). SwiftShader (software) does **85–101 fps** — usable as a fallback, not as the default.
- **Bit-exact determinism**: `seek(t)` twice, in reverse order and after a page reload → identical SHA-256 on every
  backend. Same GPU, different runtime (Playwright Chromium 153 vs Electron 44/Chrome 152) → **0 px differ**, and the
  final **MP4 files are byte-identical** (libx264 and NVENC) whether rendered in Playwright or Electron, streamed or
  encoded from a raw dump.
- GPU vs SwiftShader: **13,428 px (5.83 %) differ** on the sample frame → golden hashes are backend-specific.
- The **bottleneck is never the render**: it is page → Node transport and the H.264 encoder. Best end-to-end path
  (Electron hidden window + IPC + `h264_nvenc`) exports the 10 s clip in **~1.5 s (167–201 fps)**; with libx264
  (default preset) **~4.4–5.3 s (56–68 fps)**.
- Recommendation: **export from a hidden Electron BrowserWindow in the app itself, frames over IPC, GPU by default,
  one render worker, NVENC when available (with quality settings) else libx264.** Playwright is not needed.

---

## 1. Method

Scene (`src/scene/voxel-scene.ts`): voxel hero (6 boxes), 40 floating cubes (positions/colours/spin from a seeded
mulberry32 RNG at construction), skyline of 28 towers, gradient sky sphere, neon `GridHelper` floor scrolling with `t`,
orbiting camera. `update(t)` sets every time-dependent property **absolutely** from `t` (never incrementally), so the
scene is a pure function of time. Flat-shaded `MeshLambertMaterial`, fog. Lint override forbids `Date`, `performance`,
`requestAnimationFrame`, timers, `fetch`, `Math.random` in `spikes/*/src/scene/**`.

Pipeline (`src/spike-renderer.ts`, `src/post.ts`):
1. `WebGLRenderer({ antialias: false })`, pixel ratio 1, `ColorManagement.enabled = false`, linear output, no tone mapping.
2. Scene → `WebGLRenderTarget` 640×360, `NearestFilter`, `samples: 0`, RGBA8.
3. Post pass (full-screen quad, `texelFetch`): add 4×4 Bayer offset (spread 0.12) → snap to nearest of 16 palette
   colours (luma-weighted distance). Writes rows **flipped**, so `readPixels` returns a top-down image that goes
   straight to ffmpeg without `vflip`. CPU reference of the same math in `src/palette.ts` (unit-tested).
4. `renderer.readRenderTargetPixels` (synchronous) into a reused `Uint8Array`.

Harness (`src/page.ts`, bundled with esbuild to `out/page.js`) exposes `init / hashAt / frameBase64 / bench / stream`.
All timing code lives in the harness, not in the scene. Drivers: Playwright (`scripts/bench.ts`, `scripts/export.ts`)
and Electron (`scripts/electron-main.ts`) share `scripts/bench-core.ts`.

Metrics per backend: time to first frame (navigation → first frame read back; also split into renderer setup and first
seek+read incl. shader compile), seek+readPixels fps over 300 frames after 30 warm-up frames (in-page
`performance.now`), transfer fps (render + send each frame to Node with a no-op handler), SHA-256 of 6 timestamps
(`0, 1.234, 2.5, 5, 7.77, 9.9667`) — first pass, reverse-order re-seek, after reload.

Export: 300 frames (10 s @ 30 fps) → ffmpeg `-f rawvideo -pix_fmt rgba -s 640x360 -r 30 -i - -vf
scale=1920:1080:flags=neighbor -c:v <enc> -pix_fmt yuv420p`. Transport integrity checked by hashing frames
0/75/150/299 as received by Node vs in-page `hashAt`. ffprobe with `-count_frames`. 3 PNGs extracted at 1/5/9 s.

Reproduce (from repo root; run `bench:electron` before `bench` to get the cross-runtime diff):
```
pnpm --filter @reelforge/spike-render setup            # one-off: Playwright Chromium (~115 MB + headless shell)
pnpm --filter @reelforge/spike-render bench:electron   # Electron downloads its binary lazily on first run (~12 s)
pnpm --filter @reelforge/spike-render bench
pnpm --filter @reelforge/spike-render export
```

## 2. Numbers (ranges over 2–4 runs; laptop on AC, variance ±30 % from power state)

| Backend | WebGL renderer | seek+readPixels | p50 / p95 per frame | transfer to Node | 1st frame (wall) |
|---|---|---|---|---|---|
| Playwright, `--use-angle=d3d11` | ANGLE D3D11, RTX 4050 | **917–1433 fps** | 0.7–1.1 / 1.0–1.5 ms | WS: 94–116 fps · HTTP POST: 22 fps | 253–492 ms |
| Playwright, `--use-angle=swiftshader` | SwiftShader (Subzero) | **85–101 fps** | 10.0–11.6 / 11.4–14.1 ms | WS: 50–55 fps · HTTP POST: 18 fps | 183–498 ms |
| Electron hidden window (`show:false`) | ANGLE D3D11, RTX 4050 | **717–1316 fps** | 0.7–1.2 / 1.0–2.4 ms | **IPC: 271–363 fps** | 369–534 ms |
| Electron offscreen (`offscreen:true`) | ANGLE D3D11, RTX 4050 | 398–1298 fps | 0.7–2.6 / 1.0–3.7 ms | IPC: 232–373 fps | 118–167 ms* |

\* second window in the same Electron process (GPU process already up). First seek+read incl. shader compile:
31–44 ms (Electron), 70–100 ms (Playwright GPU), 88–149 ms (SwiftShader).

End-to-end export of the 10 s clip (300 frames):

| Path | libx264 (default `medium`) | h264_nvenc (`-preset p4`) | raw file only |
|---|---|---|---|
| Playwright GPU + WebSocket (window 4) | 50–51 fps (~6.0 s) | 73–76 fps (~4.0 s) | 87–88 fps |
| **Electron hidden + IPC** | 56–68 fps (4.4–5.3 s) | **167–201 fps (1.5–1.8 s)** | — |
| Encoder alone (from raw file) | 65–72 fps · `veryfast`: 172–173 fps | 327–342 fps | — |

Transport probes (900 KB frames): per-frame `fetch` POST page→Node 41 fps, `Blob` body 68 fps; Node→Node `fetch`
76 fps; raw TCP loopback 1.86 GB/s (≈2000 fps) → HTTP request/response overhead, not bandwidth. WebSocket lock-step
100 fps, window of 4 in flight 132 fps. Electron `ipcRenderer.invoke` with `Uint8Array`, empty page: 466 fps.

## 3. Verification

- `ffprobe` (both encoders): `h264, 1920x1080, 30/1, 300 frames, duration 10.0 s, yuv420p` OK
- Transport integrity (Node bytes == in-page hash, 4 frames) OK · determinism reseek OK reload OK on all 4 backends.
- Frames: `frame-01s.png` 83,439 colours, mean RGB 34/24/70, dominant colour 2.6 % · `frame-05s.png` 78,924 / 34/21/67 /
  4.0 % · `frame-09s.png` 60,572 / 33/20/69 / 2.8 %. Non-blank (the 640×360 source has 15 palette colours; the
  extra colours are yuv420p/H.264 artefacts). Viewed: sky gradient dithered at the top, neon grid floor, skyline,
  floating cubes, hero — upright, crisp 3×3 pixel blocks.
- Bitrate of the 10 s clip: libx264 12.9 Mbps (16 MB) vs NVENC default 2.2 Mbps (2.8 MB); NVENC vs libx264 PSNR
  29.6 dB average → NVENC defaults visibly smear the dither.

## 4. Decisions D1–D4

| | Verdict | Evidence / note |
|---|---|---|
| D1 Electron + Chromium | **GO** | Hidden BrowserWindow renders on the dGPU, same pixels as Playwright, fastest transport (IPC). |
| D2 Three.js, scenes as ES modules | **GO (render side)** | Scene module bundles cleanly; purity enforced by lint + unit test. Sandboxed iframe **not** tested here. |
| D3 640×360 → `neighbor` ×3 | **GO** | Crisp blocks, 9× fewer pixels; caveats on chroma and bitrate below. |
| D4 deterministic `seek(t)` | **GO** | Bit-exact per backend, incl. across runtimes and through to the MP4; goldens must pin the backend. |

## 5. Recommended engine/export architecture

1. **Export in the app's own Electron**, hidden `BrowserWindow({ show: false, webPreferences: { backgroundThrottling:
   false, sandbox: true, contextIsolation: true } })`, same `packages/engine` bundle as the preview → §3.3 preview =
   export holds by construction (same Chromium too). No Playwright dependency in the product.
2. **Transport: IPC** (`ipcRenderer.invoke(channel, Uint8Array)` via preload, one awaited call per frame = natural
   back-pressure from ffmpeg's stdin). Spawn/pipe ffmpeg from main (or a `utilityProcess` to keep main responsive).
3. **GPU by default**, log `UNMASKED_RENDERER_WEBGL` at export start and warn if it says SwiftShader (5–15× slower).
4. **One render worker.** Render is ~10× faster than the encoder; shot-parallel rendering only pays off if real scenes
   exceed ~15 ms/frame — measure again in phase 2 with kit scenes before adding workers. libx264 already uses all cores.
5. **Encoder:** `h264_nvenc` when present (detect via `ffmpeg -encoders` + a 1-frame trial), but **with explicit
   quality** (e.g. `-rc vbr -cq 19 -b:v 0` or ≥ 12 Mbps — to be tuned in 4.x); fallback libx264 (`veryfast` for drafts,
   default/CRF for final). Consider a 4K (×6) export option: YouTube serves higher-bitrate codecs for 4K uploads and
   2×2 chroma blocks align with 6×6 pixels.
6. **Golden tests (2.x):** CI has no GPU → SwiftShader goldens (separate from GPU hashes), or compare with a small
   pixel-diff tolerance. Never compare hashes across backends.

## 6. Pitfalls found

1. **Headless Chromium defaults to SwiftShader** on this machine (no flags, `--disable-gpu`, `--use-angle=swiftshader`
   all → SwiftShader). Hardware GL needs `--use-angle=d3d11` (or `--enable-gpu`). `--enable-unsafe-swiftshader` was
   not needed in Chromium 153.
2. `powerPreference: 'low-power'` was ignored — still the RTX 4050, not the Radeon 740M. The iGPU path is untested.
3. Per-frame HTTP POST from the page is ~40 ms/frame (22 fps) despite fast loopback TCP — do not use HTTP for frames.
4. Electron: `win.destroy()` followed immediately by `loadURL` in a **new** window failed with `ERR_FAILED (-2)`;
   `win.close()` + `await once(win, 'closed')` fixes it.
5. Electron 44 has **no postinstall**: the binary is downloaded lazily by `node_modules/electron` on first use
   (~12 s). `allowBuilds` is only needed for esbuild.
6. three r186 colour management: `ColorManagement.enabled = false` + `LinearSRGBColorSpace` output, otherwise palette
   hex values are converted before the palette snap. It is module-global state → engine sets it exactly once.
7. `readPixels` is bottom-up; the post pass flips rows so the buffer is top-down. The preview blit must use the same
   convention (or flip once more) — keep a single owner of this in `packages/engine`.
8. Ordered dither is high-entropy: libx264 default needs ~13 Mbps at 1080p, NVENC defaults (2.2 Mbps) smear it.
9. yuv420p 2×2 chroma vs 3×3 pixel blocks at 1080p → slight colour bleed on saturated edges (inherent to ×3).
10. 1-px `GridHelper` lines alias into dashes at distance (visible in `frame-05s.png`) — a kit concern (use thicker
    line geometry or fade lines by distance), not an engine bug.
11. TS 6 + DOM lib: `WebSocket.send` / `crypto.subtle.digest` reject `Uint8Array<ArrayBufferLike>`; frame buffers
    must be typed `Uint8Array<ArrayBuffer>`.
12. Not verified: sandboxed-iframe scenes (D2), `readRenderTargetPixelsAsync`/PBO pipelining (unnecessary at current
    speed), heavier scenes, other GPUs/drivers, Electron with `--use-angle=swiftshader`.

## 7. Spike dependencies (dev-only, `spikes/02-render/package.json`)

three 0.186.1 (MIT) · @types/three (MIT) · playwright 1.63.0 (Apache-2.0) · electron 44.4.5 (MIT) · esbuild 0.28.2
(MIT, bundles page + Electron main/preload) · ws 8.21.3 + @types/ws (MIT, Playwright transport only). Versions pinned
older than ~1 day per the pnpm release-age policy.

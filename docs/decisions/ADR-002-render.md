# ADR-002: Rendering architecture (D1–D4)

Status: accepted (2026-10-02). Evidence: `docs/spikes/02-render.md`.

**Decision:** GO for Electron + Three.js, 640×360 `Nearest` render target + palette/Bayer post pass, deterministic `seek(t)`, integer upscale to 1080p via ffmpeg `scale=…:flags=neighbor`.

**Consequences:**
- Render/export from a hidden Electron `BrowserWindow`, frames over IPC, GPU (ANGLE D3D11) by default, one worker initially. Playwright is not a product dependency.
- ~900–1400 fps render; the bottleneck is frame transfer + encoder (libx264 ~60 fps, NVENC ~170–200 fps end-to-end). NVENC needs explicit quality settings (default smears dither).
- GPU vs SwiftShader differ by ~6% of pixels: golden frames are per-backend (CI uses SwiftShader goldens or tolerance). Log the GPU name and warn on SwiftShader; headless Chromium needs `--use-angle=d3d11`.
- Engine sets Three colour management once (global state). TS 6 types frame buffers as `Uint8Array<ArrayBuffer>`.
- Not yet verified: scenes in a sandboxed iframe (task 2.1), heavier scenes, other GPUs.

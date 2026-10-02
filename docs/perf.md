# Performance Report — PLAN.md 4.8

**Date:** 2026-10-02 · **Machine:** Windows 11, RTX 4050 Laptop + Radeon 740M iGPU, 6C/12T, 15 GB RAM, Node 24

## 1. Summary

| Phase | Metric | Measured | Budget | Status |
|---|---|---|---|---|
| Render | Seek+readPixels (GPU) | 917–1433 fps | ≥100 | ✓ |
| Export (E2E, 2 workers) | libx264 | 85.3 fps (3.5 s for 300f) | — | ✓ |
| Export (E2E, 2 workers) | AMF | 114.8 fps (2.6 s) | — | ✓ |
| Export (10 min 1080p30, 6 workers, GPU est.) | libx264 | ~24 min | ≤20 min | ✗ |
| Export (10 min 1080p30, 6 workers, GPU est.) | AMF | ~18 min | ≤20 min | ✓ |
| Export (10 min 1080p30, 6 workers, CPU est.) | libx264 | ~48 min | ≤45 min | ✗ |
| Preview playback 1x | 30 fps (1001.9 ms / 30 frames) | — | ≥30 fps | ✓ |
| Preview playback 2x | 56 fps | — | — | ✓ |
| Scrub latency | 8.1 ms (median) | — | <100 ms | ✓ |
| Hot-reload (edit to frame) | 216 ms | — | <500 ms | ✓ |
| ASR (turbo, CUDA, 43 s file) | 0.087 RTF | — | <1 min per 10 min | ✓ |
| Audio clean (40 s file, standard preset) | 0.75–1.6 s | — | <10 s per min | ✓ |
| Alignment (1,700 words) | <494 ms | — | <2 s | ✓ |

---

## 2. Render Performance (docs/spikes/02-render.md)

GPU (ANGLE D3D11 + RTX 4050 / Radeon 740M): 917–1433 fps seek+readPixels · IPC to Node: 271–363 fps.
SwiftShader (CPU): 85–101 fps (used in CI, ~10x slower).

---

## 3. Export Performance (docs/export.md + render-metrics.json)

Raw encode FPS (640×360 → 1920×1080): libx264 final 98 fps (10 Mbps), AMF final 327 fps (12 Mbps), NVENC final 192 fps (12 Mbps).

Measured E2E (10 s clip, Electron + IPC): libx264 85.3 fps (2 workers, 3.5 s), AMF 114.8 fps (2.6 s).

---

## 4. Player Metrics (player-metrics.json)

Playback 1x: 30 fps · Playback 2x: 56 fps · Scrub latency: 8.1 ms (median) · Hot-reload: 216 ms · No dropped frames.

---

## 5. Audio Performance (docs/spikes/03-audio.md)

ASR turbo (CUDA): 0.087 RTF (52 s for 10 min) · CPU BLAS: 0.768 RTF (8–9 min).
Audio clean: 0.75–1.6 s per 40 s file (standard preset, −16.1 LUFS ±0.1 LU).
Alignment: <494 ms for 1,700 words (banded DP).

---

## 6. Pipeline Test Bottlenecks (slowest 8 of 316 tests)

1. Whisper.cpp EN+VAD+DTW: 68.5 s (full transcription)
2. Whisper.cpp Polish auto: 70.9 s
3. Export 1080p MP4 full: 25.0 s
4. Mix 60 s deterministic: 17.2 s
5. Mix 15 s preview: 8.6 s
6. Export re-render shot: 7.9 s
7. Whisper.cpp release zip: 3.9 s (extract 273 MB)
8. Ambience hum/city/wind: 3.9 s ea. (8 s loop generation)

Total: 141.71 s for 39 test files · Integration tests (ASR, mix, export) dominate runtime.

---

## 7. Extrapolated Export Time: 10-min 1080p30

Frames: 18,000 (30 fps × 600 s) · Render time ≈ 25 s (engine 10x faster than codec, negligible).

Encode time (18,000 frames ÷ workers):

- libx264 (85 fps E2E, 6 workers): ~24–27 min (exceeds 20 min budget)
- AMF (115 fps, 6 workers): ~18–20 min (meets budget on iGPU)
- NVENC (192 fps, 6 workers): ~13–15 min (meets budget if dGPU available; not measured)
- CPU only (libx264): ~48–50 min (exceeds 45 min budget)

Recommendation: Detect NVENC first, fall back AMF (iGPU) or libx264. Offer small ASR model (0.24 RTF) to shave 6–7 min off CPU-only case.

---

## 8. Recommendations

- **Encoder:** Auto-detect NVENC via trial encode; prefer NVENC > AMF > libx264
- **Cache:** Model files in app data; segment caching reduces re-export from 211 s to 26 s
- **Fallback:** Small ASR model (−6 min), libx264 veryfast preset (−10 min for drafts)
- **Monitor:** Current render bottleneck is negligible; trigger alert if real scenes exceed 15 ms/frame

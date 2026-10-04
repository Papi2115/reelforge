# Video export (PLAN 4.7)

Code: `packages/pipeline/src/export/`. Entry point: `exportVideo(options)` (`export-video.ts`).
Input is the same render manifest the preview uses; frames come from `packages/engine` through a
`FrameSource`, so the export shows exactly what the preview shows (CLAUDE.md §3.3).

```
manifest ─ planShots ─► per-shot cache key ─► cached? ──yes──────────────────────┐
                                    │ no                                         │
                                    ▼                                            ▼
         worker k: FrameSource.renderFrame(i/fps) ─► ffmpeg (stdin RGBA) ─► segments/<key>.mp4
                                                                                 │
   concat demuxer (-c:v copy) + audio/mix.wav (AAC 192k) + faststart ─► out/<title>.mp4
   FrameSource frame at thumbnailAt ─► neighbour upscale ─► out/thumb.png
   buildChaptersTxt(chapters) ─► out/chapters.txt
```

## FrameSource (the integration point for the app)

```ts
interface FrameSource {
  open(manifest: RenderManifest, range: ShotRange): Promise<Result<FrameSourceInfo, ExportError>>;
  renderFrame(t: number): Promise<Result<Uint8Array, ExportError>>; // RGBA8, top-down, w*h*4
  close(): Promise<void>;
}
type FrameSourceFactory = (workerIndex: number) => FrameSource;
interface ShotRange { shotIds: readonly string[]; t0: number; t1: number } // global seconds
interface FrameSourceInfo { width: number; height: number; gpu: string | null }
```

- One source per render worker, created by the injected factory; `close()` is always called.
- `open` is called once per shot on the same source. `shotIds` lists the shot and, when it
  transitions in, the previous shot (its frames show both). Sources should load the **whole**
  manifest (the engine's timeline renders transitions from it) and may keep it loaded while the
  manifest object is unchanged.
- `renderFrame(t)` gets global time `frameIndex / fps`. The returned buffer may be reused by the
  next call. Size must equal the style's render size (checked; mismatch = `frame-source` error).
- `gpu` is the WebGL `UNMASKED_RENDERER_WEBGL` string; the exporter emits a `source` progress event
  with `software: true` for SwiftShader/llvmpipe so the UI can warn (5–15× slower, ADR-002).
- Errors are returned, not thrown (a throw is still contained and reported as `frame-source`).

Implementations:
- `testing/playwright-frame-source.ts` — `createPlaywrightFrameSources()`: headless Chromium via
  `@reelforge/engine/cli` (one shared browser, one page per worker). **SwiftShader only**: the
  engine CLI launches with `--use-angle=swiftshader`. Tests/dev tooling only, not exported.
- `apps/desktop/src/main/render/electron-frame-source.ts` — the app's source: hidden render windows
  (`render-window.ts`: `show: false`, sandboxed, GPU = Chromium's ANGLE D3D11) loading
  `engine/render-host.html` (the preview's `createSandboxedHarness` + the same `engine-frame.html`,
  determinism lint on). Main sends `load`/`frame`/`cards` calls over IPC; frames come back as RGBA
  bytes (structured clone). A `RenderPool` reuses windows (and their loaded manifest) across workers
  and the thumbnail; windows close gracefully (`close()` + `closed`). Aborting closes them.
  `exportProject()` (`export-project.ts`) wires the preview's manifest, ffmpeg/encoder/workers from
  the settings and `exportVideo`; IPC `export:start` / `export:cancel` / push `export:progress`
  (frame events throttled to 10/s).

Measured in the app (`apps/desktop/test/render.smoke.test.ts`, 10 s fixture clip at 1080p30, GPU
Radeon 740M iGPU — the RTX 4050 was unavailable to CUDA/Chromium during the run): libx264 final
58.5 fps end to end (2 workers; 53.9 with 1 worker; ADR-002: 56–68), AMF final 77 fps (65.8 with 1
worker). NVENC not measured (`CUDA_ERROR_NO_DEVICE`); re-measure on the dGPU (Settings → GPU:
high-performance).

## Segments: encoded straight to the final codec

Each shot is encoded directly into a final-quality H.264 `.mp4` segment (upscaled, BT.709,
yuv420p). The final video is a stream-copy concat of the segments (no re-encode).

Why not a lossless intermediate: the spike showed the encoder is the bottleneck, so encoding per
shot parallelizes the expensive part across workers; re-exporting after one shot changes costs
one shot's encode plus a copy-concat (seconds); and a lossless 640×360 cache of dithered frames
would take 0.75 GB (libx264rgb `-qp 0`) to 7 GB (FFV1) per 10 minutes (measured on the example
scene) yet still need a full 1080p re-encode on every export. Cost: the
output settings (preset, encoder, quality) are part of the cache key, so switching them
re-renders everything. Constant-quality rate control (CRF/CQ/QP) is per frame, so segment
boundaries do not change quality. Each segment starts with an IDR frame at its shot cut.

Verified: concat of `.mp4` segments keeps exact frame counts and duration (`.mkv` segments lose
~1 ms per segment to millisecond timestamps).

## Cache keys (`cache-key.ts`)

`segments/<sha256>.mp4` under `<project>/.reelforge/cache/export/`. The key hashes (stable JSON):
cache format version · `engineVersion` · `kitVersion` · style id + full preset JSON · manifest
palette overrides · project seed · fps · the shot's frame range · shot id, t0, t1, transitionIn
(with its transition-kit `style`, ADR-011), sha256 of the scene source · used anchors · for transitions-in, the same content of the previous
shot · output fingerprint (`ExportMedia.outputKey` + preset + upscale factor).

`RenderIdentity` (`engineVersion`, `kitVersion`, `style {id,width,height,preset}`) is supplied by
the caller — the pipeline does not import the engine.

Anchors: `extractAnchorUses(source)` finds literal calls (`anchor('61 KB')`, `ctx.anchor("x", 2)`);
with `options.resolveAnchor` (pass the engine's resolver) only the resolved spans of those phrases
enter the key, so retiming unrelated words re-renders nothing. If a scene uses `anchor` in a way
the scan cannot see through (variables, aliases, `${}` templates) or no resolver is given, the
whole words file enters the key (safe over-invalidation). The scene file name is not hashed.

A segment is written as `<key>.partial-<worker>.mp4` and renamed into place only after ffmpeg exits
0, so the cache never holds half a segment. After a successful export, segments the export did
not use are pruned (`pruneCache: false` keeps them).

## Resume and cancellation

`export-state.json` (zod `ExportStateSchema`, atomic writes, serialized across workers) records
the job key, output, preset, encoder, `status` (`running`/`complete`) and the finished shots. A
re-run of the same job reports `resumed: true`; any shot whose segment exists is skipped, so a
killed or cancelled export continues where it stopped (and an edited project re-renders only the
changed shots). `AbortSignal` cancels everything: workers stop, the segment encoder is killed with
its process tree (`taskkill /T /F` on Windows), partial files are deleted, result `cancelled`.

## Presets (`presets.ts`)

| Preset | Output | 640×360 | 480×270 (Soft 480) |
|---|---|---|---|
| `1080p30` (default) | 1920×1080 | ×3 | ×4 |
| `1440p` | 2560×1440 | ×4 | ✗ (×5.33) |
| `4k` | 3840×2160 | ×6 | ×8 |

The factor is computed from the style size; a non-integer factor fails with `preset-mismatch`
naming the presets that fit. Output fps = manifest fps. Upscale + colour conversion:
`scale=W:H:flags=neighbor:out_color_matrix=bt709:out_range=tv,format=yuv420p`, tagged BT.709.

## Encoders (`encoders.ts`)

`detectEncoder(ffmpeg, { prefer, quality })` runs a real 1 s `testsrc2` encode at 1920×1080 for
`h264_nvenc`, `h264_qsv`, `h264_amf` (in that order) and falls back to `libx264`; every probe is
returned for logs. Listing in `ffmpeg -encoders` is not enough (QSV is listed here but fails:
"Error creating a MFX session").

Quality was tuned on 120 dithered 640×360 frames of the example scene, upscaled ×3, PSNR vs the
same frames before encoding (ffmpeg 8.1.1, RTX 4050 Laptop, Radeon 740M):

| Encoder / setting | PSNR | bitrate | note |
|---|---|---|---|
| NVENC defaults (p4) | 35.5 dB | 2 Mbps | smears the dither (spike) |
| **NVENC final** `-preset p7 -tune hq -rc vbr -cq 19 -b:v 0 -profile:v high` | 49.6 dB | 12 Mbps | chosen |
| NVENC p5 cq19 | 46.4 dB | 12 Mbps | |
| NVENC draft `p4 hq vbr cq23` | 43.7 dB | 9 Mbps | |
| **libx264 final** `-preset medium -crf 18` | 46.1 dB | 10 Mbps | chosen |
| libx264 `medium crf16` | 47.9 dB | 13 Mbps | |
| libx264 draft `-preset veryfast -crf 20` | 41.3 dB | 8 Mbps | |
| **AMF final** `-quality quality -rc cqp -qp_i 16 -qp_p 18 -qp_b 20` | 46.5 dB | 12 Mbps | chosen |
| QSV `-preset medium -global_quality 18` | — | — | unverified (no Intel GPU) |

Audio: AAC 192 kbps, `apad` + `-t <frames/fps>` so the audio matches the video length exactly.
Container: MP4 with `+faststart`.

## Thumbnail and chapters

- `out/thumb.png`: the engine frame at `thumbnailAt` (default: middle of the first shot), snapped
  to a frame, upscaled by the smallest integer factor reaching 1280 px width (640×360 → 1280×720,
  480×270 → 1440×810). Lossless: the integration test checks it equals the engine frame exactly.
- `buildChaptersTxt(chapters, durationS)`: YouTube description format (`0:00 Intro`, `H:MM:SS`
  from 1 h). Enforces YouTube's rules (first at 0:00, ≥ 3 chapters, each ≥ 10 s) and fails before
  rendering when they are broken. `exportVideo({ chapters })` writes `out/chapters.txt`.
- Chapter titles in the app (`apps/desktop/src/main/export/export-chapters.ts`): one chapter per
  shot start (shots < 10 s merged), titled with the key phrase spoken at the chapter's start
  (`spokenChapterTitle`, ≤ 5 words, from `timing/words.json`); without words, or when that phrase
  is already used by another chapter, the scene's `meta.title` or the first clause of its intent.

## Progress events

`plan` (shots, cached, frames to render, workers, encoder, resumed) · `source` (per worker: GPU,
software flag) · `shot-start` · `frame` (per frame: shot, counts, fps, ETA seconds) · `shot-done`
(`cached` true for skipped shots) · `mux` · `thumbnail` · `done`.

## Measured (this machine: 6 cores / 12 threads, RTX 4050 Laptop)

Encode only, raw frames via stdin through `createFfmpegMedia`, 600 frames 640×360 → 1080p:
libx264 final **98 fps**, libx264 draft 251 fps, **h264_nvenc final 192 fps** (autodetected),
NVENC draft 440 fps, AMF final 327 fps.

End to end, 2-minute 12-shot video (3600 frames), Playwright **SwiftShader** source, NVENC final:
1 worker 311 s (12 fps) · 3 workers 146 s (25 fps) · 6 workers (default) **134 s (28 fps)**.
Re-export after editing one 10 s shot: **26 s**, only that shot rendered. The SwiftShader +
base64-over-CDP path is the bottleneck here; the Electron GPU source is expected to be ~10× faster
(spike: IPC 270–360 fps).

## Tests

- Unit (no ffmpeg, no browser — run everywhere): `export-video.test.ts` with a counting fake
  FrameSource and raw-bytes ExportMedia (`testing/fakes.ts`): cache hits, single-shot re-render,
  transitions, anchor moves, resume after abort, partial-segment cleanup, failures, workers.
  Plus presets, chapters, cache keys, encoder detection (fake runner), ffmpeg args, stdin process.
- Integration (`export.integration.test.ts`, real ffmpeg + Playwright Chromium; skipped with a
  reason when either is missing): 3 shots / 6 s with a crossfade + generated `mix.wav` → ffprobe
  (h264 1920×1080, 30/1, 180 frames, yuv420p, bt709, AAC, 6.0 s), thumbnail = engine frame,
  MP4 frame 75 ≈ engine frame at t=2.5, single-shot re-render, cancellation mid-shot.

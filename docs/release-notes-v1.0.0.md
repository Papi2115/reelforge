# ReelForge v1.0.0 — release notes

First complete version: brief → script → your voiceover → timed words → storyboard → 3D voxel
animation → sound design → MP4, driven by your own Claude subscription through the local Claude Code CLI.

## Highlights
- Eight-stage pipeline with a sidebar (Open / Replace / Run / Redo, dependency gating, stale tracking).
- Deterministic engine: the same time gives the same frame, bit for bit; preview and export share it.
- Voxel kit: environments, 28 props (incl. a posable character and crowds), effects, 3D charts and counters.
- Claude chat editing with Selection / Shot / Whole video scopes; click objects in the preview.
- Automatic scene QA (lint → smoke frames → programmatic checks → visual critic → ≤2 fixes) and a sync
  report (every visual lands within ±150 ms of its spoken word).
- Timeline editing with word snapping, sound design panel, cached and resumable export.
- Local-first projects (git history and revert), recovery from crashes, limits and corrupt files.
- Example project and guided tour for first run.

## Measured (this release's dev machine: RTX 4050 laptop, 6 cores, 15 GB)
- Render 900–1400 fps (GPU), preview 30 fps with scrub < 15 ms, hot reload of a scene ≈ 0.2 s.
- Export at 1080p30: libx264 ≈ 55–98 fps, AMF ≈ 76–327 fps, NVENC ≈ 170–200 fps (spike; not re-measured
  in the app). Details in `docs/perf.md`.
- One real 39-second film on a real subscription: 25 Claude turns, 28 minutes wall time, see
  `docs/real-run-report.md` for usage and quality notes.

## Known limitations
- **Personal use only.** Distributing an app that uses people's Claude subscriptions is a grey area;
  decide before any public release. No LICENSE file is chosen yet.
- The installer has been verified by silent install/uninstall on the dev machine, not on a clean VM, and is unsigned
  (SmartScreen will warn; see `docs/packaging.md`).
- A real usage-limit stream has never been observed; detection follows the CLI's documented shapes and is
  covered by fake-claude scenarios only.
- Missing kit props are reported per shot (e.g. fridge, printer); extending the kit is a developer task.
- Whisper may fall back to CPU if the GPU is busy; long voiceovers then take much longer.
- Very long videos (10 minutes, ~100 shots) were not run end to end on a real subscription; expect
  $40–95 list-price equivalent of usage per 10-minute film (estimate).
- The SAPI-synthesized example voiceover's redistribution terms are marked "to verify" in `docs/licenses.md`.
- Windows only.

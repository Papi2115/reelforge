# ReelForge

ReelForge is a Windows-first desktop app that turns a short video brief into a finished YouTube
video: script → your voiceover → cleaned audio → word-level timestamps → storyboard → a deterministic
voxel / pixel-art 3D animation → sound design → MP4 (1080p, optionally 1440p / 4K).

All AI work runs through **your own Claude subscription** via the locally installed Claude Code CLI
(`claude`). No API keys, no cloud services beyond the CLI itself, no telemetry. ReelForge never reads
or stores your Claude credentials. v1 is for personal use (see "Licensing and terms" below).

## What you get

- **Brief → script** with web research and sources (Sonnet), editable, with a word counter and
  duration estimate.
- **Your voiceover**: import a file or record in the app. It is cleaned (noise, loudness) and timed
  word by word with whisper.cpp, aligned to your script.
- **Storyboard and scenes**: Claude (Sonnet for planning, Opus for scene code) composes shots from a
  voxel kit (environments, 28 props, effects, 3D charts, counters, a voxel character), synced to the
  spoken words through anchors. Every scene goes through automatic QA (determinism lint, frame
  checks, a visual critic, ≤2 fix iterations).
- **Chat editing** with scopes Selection / Shot / Whole video, click-to-select objects in the preview.
- **Timeline** with shots, narration, cues, waveform; drag boundaries (snapping to words), edit cues.
- **Sound design**: synthesized SFX, ambience, your music with sidechain ducking, −14 LUFS master.
- **Export**: per-shot cached and resumable; hardware encoders (NVENC / AMF / QSV) with x264 fallback;
  chapters, thumbnail and title/description/tag suggestions.
- **Local first**: a project is a folder plus a git repo (autocommit after every step and Claude turn,
  history + revert in the app).
- **Resilient**: recovers from usage limits (pause and auto-resume), crashes, killed processes and
  corrupted files.

## Requirements

- Windows 10/11 x64, a GPU is recommended (software rendering works but is slower).
- [Claude Code](https://claude.com/claude-code) installed and logged in (`npm install -g @anthropic-ai/claude-code`
  then run `claude` once). The app has a Connect Claude wizard that checks this.
- Git, and ffmpeg (a build with libx264; encoders for NVENC/AMF/QSV are used when present).
  whisper.cpp and its models are downloaded on demand (≈ 600 MB once, ≈ 870 MB with an NVIDIA GPU)
  from the official sources (GitHub, Hugging Face) and checked against pinned SHA-256 hashes: from
  Settings → Tools, the first-run "Prepare tools" step, or Words timed's "Download and continue"
  (`docs/whisper.md`).

## Quick start

Install `ReelForge-Setup-<version>-x64.exe` (see `docs/packaging.md` for building it), or run from source:

```sh
pnpm install
pnpm dev            # Electron + HMR
```

First launch: Connect Claude → Welcome → **Open the example project** ("Doom on a calculator"), press
Play, ask Claude to change a scene in the chat, then Sound design → Export.

## Commands

```sh
pnpm dev                 # Electron + HMR
pnpm typecheck           # tsc -b
pnpm lint                # eslint + prettier --check
pnpm test                # unit tests (vitest, no GPU, no Claude)
pnpm test:render         # golden frames, WebGL on SwiftShader (Playwright Chromium)
pnpm test:app            # end-to-end tests in the real Electron app (fake-claude)
pnpm test:app:ci         # same with tolerances for GPU-less / audio-less CI runners
pnpm render:frames -- --scene <file> --at 0,2.5,5   # PNG frames for visual review
pnpm kit:catalog         # regenerate docs/kit-catalog.md
pnpm build               # tsc -b + app bundle
pnpm package / pnpm dist # unpacked app / NSIS installer (apps/desktop/release)
pnpm test:packaged       # smoke tests of the packaged app and installer
```

Tests and CI never call the real Claude: they use `tools/fake-claude`, which replays recorded streams.

## Layout

```
apps/desktop            Electron app (main / preload / renderer, React)
packages/engine         Three.js engine: scene contract, clock/seek, post-fx, cameras, text, lint
packages/kit            voxel tools, environments, props, effects; look registry (looks/<id>/)
packages/pipeline       ffmpeg, whisper.cpp, alignment, anchors, mixer, export
packages/claude-bridge  spawns the local `claude` CLI: sessions, limits, permissions
packages/prompts        versioned stage prompts, validators, evals
packages/stages         stage orchestration (script … scenes … mix) + QA critics
packages/project        project folders, git history, revert, recovery
packages/cli            `reelforge` CLI used by Claude for self-QA (frames, lint, anchors, kit-docs)
packages/shared         shared types and zod schemas
styles/                 style presets and style bibles (STYLE.md)
templates/              project template and the example project
tools/fake-claude       fake CLI for tests
docs/                   spikes, ADRs, kit catalog, perf, packaging, real-run report
```

## Docs

`docs/decisions/` (ADR-001…009) · `docs/looks.md` · `docs/kit-catalog.md` · `docs/cli.md` · `docs/export.md` ·
`docs/golden-frames.md` · `docs/perf.md` · `docs/packaging.md` · `docs/real-run-report.md` ·
`docs/licenses.md`. Roadmap in `PLAN.md`, contributor rules in `CLAUDE.md`.

## Licensing and terms

Third-party licences are listed in `docs/licenses.md`; ffmpeg is used as an external binary (a GPL
build on the developer machine), never bundled. ReelForge only starts your locally installed Claude
Code; Anthropic's terms for subscription accounts apply to your use. Distributing an app built on
users' subscriptions is a grey area, so v1 is personal use; decide before any public release.
No LICENSE file has been chosen yet.

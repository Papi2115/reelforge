# ReelForge

ReelForge is a Windows-first desktop app that turns a short video brief into a finished YouTube
video: script → your voiceover → cleaned audio → word-level timestamps → storyboard → a deterministic
pixel-art animation in seven looks (voxel 3D, retro UI/CRT, isometric diorama, blueprint/data, flat 2D,
paper cut-out, whiteboard — one shared retro style) → sound design → MP4 (1080p, optionally 1440p / 4K).

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
- **Publish kit and sources**: paste-ready description, chapters, tags and credits saved to
  `publish/` (no upload), with a warning for unverified licences; claims of the script pinned to
  research links (no web), a report of claims without a source and an optional on-screen source
  chip (`docs/publish.md`).
- **Project settings** per video: voxel only or mixed looks (retro UI, diorama, blueprint) and
  subtle background variation between shots, saved in `project.json` and the project history.
- **Characters and a mascot** per video: people from the character pack (10 cast members, a
  mannequin, new professions in the same style) or the classic hoodie hero, and an optional channel
  mascot (Bulb, Screen, Fox, Bean) that Claude gives sparse screen time in impersonal roles only —
  never as a doctor, a scientist or a real person (`docs/characters.md`).
- **Tension map**: a calm → rising → peak → release curve (proposed by Claude, drawn or edited
  under the timeline) sets the cut tempo, the choice of rolls/looks, the music mood per act, how
  dark the backgrounds get and how busy the effects are; locked shots keep theirs
  (`docs/tension.md`).
- **Beat sync**: the music beds follow the narration's pace; cuts (±100 ms, never into a word),
  whooshes and hits land on a beat or a stressed word, with a ✓/⚠ report; locked shots never move
  (`docs/beat-sync.md`).
- **Repetition control**: finds the same visual, chart, transition, sound or phrase used too often
  across the film and proposes a swap (sound, transition) or shot variants, with Apply / Ignore
  under the final review (`docs/repetition.md`).
- **Dramaturgy**: planned pattern interrupts (1–2 surprises a minute, made with look-change
  transitions and camera moves, planned vs realised report), open loops the script opens and
  closes (⚠ when one never closes; veiled objects revealed on the answer) and reveal moments at
  the tension peaks — silence before a hit, a palette flash or slow motion that keeps every anchor
  in sync — to accept or reject (`docs/dramaturgy.md`).
- **Live co-direction**: type "slower", "ciemniej", "arrow on the word X", "zoom in", "undo"
  while the film plays (press `/`); the shot changes at once without a rebuild, every command is
  committed, locked shots are refused, and "make it a terminal" goes to Claude as shot variants
  (`docs/live-direction.md`).
- **Hook lab**: before recording, Claude writes three alternative openings of the script (cold
  open, question, shocking fact; no web) shown next to the current one with length, first-visual
  idea and a diff; the chosen one replaces only the opening paragraph, warns when the voiceover
  must be re-recorded and never touches locked shots (`docs/hook-lab.md`).
- **Taste learning** (Settings → Taste): your variant picks, locks and rebuilds become a local
  profile ("prefers orbit camera moves, slower cuts…") that the storyboard and scene prompts get
  as a soft preference; readable, exportable and resettable, on this computer only
  (`docs/taste.md`).
- **Asset research** (optional): real photos/footage from open-licence sources, per project ask /
  selected sources / full auto ⚠ / off (zero network); you approve packages, ⚠ unverified licences
  are flagged at export (`docs/assets.md`).
- **Your own assets + asset library**: add your photos, logos and clips (picker or drag and drop);
  the storyboard places them as B-roll even with research off; a global library on this computer
  shares approved and saved assets between projects without downloading again (`docs/assets.md`).
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

`docs/decisions/` (ADR-001…009) · `docs/looks.md` · `docs/assets.md` · `docs/publish.md` · `docs/kit-catalog.md` · `docs/cli.md` · `docs/export.md` ·
`docs/golden-frames.md` · `docs/perf.md` · `docs/packaging.md` · `docs/real-run-report.md` ·
`docs/licenses.md`. Roadmap in `PLAN.md`, contributor rules in `CLAUDE.md`.

## Licensing and terms

Third-party licences are listed in `docs/licenses.md`; ffmpeg is used as an external binary (a GPL
build on the developer machine), never bundled. ReelForge only starts your locally installed Claude
Code; Anthropic's terms for subscription accounts apply to your use. Distributing an app built on
users' subscriptions is a grey area, so v1 is personal use; decide before any public release.
No LICENSE file has been chosen yet.

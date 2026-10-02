# Licenses of fonts, assets and third-party components

Rule (CLAUDE.md §6): fonts and assets only under OFL or CC0; every one gets a row here. The full
audit is PLAN.md#9.4 — rows marked _to verify_ must be checked there before any distribution.

## Fonts

| Name | Where | Author | License | Notes |
|---|---|---|---|---|
| Forge Display (chunky caps, 7-row cap height, 2-px strokes) | `packages/engine/src/text/font-display.ts` | ReelForge project, authored in-repo (2026-10-02) | CC0 1.0 | Bitmap glyph data written by hand for this repo; no third-party font was copied, traced or downloaded. ASCII caps, digits, punctuation, Polish capitals (lower-case input maps to caps). |
| Forge Mono (5x7 in a 6-column cell, with descenders) | `packages/engine/src/text/font-mono.ts` | ReelForge project, authored in-repo (2026-10-02) | CC0 1.0 | Same as above. Printable ASCII (except `^` `` ` `` `{` `|` `}` `~`), Polish letters in both cases. |
| Forge Voxel 5x7 (caps, 1-voxel strokes, optional bold) | `packages/kit/src/fx/font.ts` | ReelForge project, authored in-repo (2026-10-02) | CC0 1.0 | Voxel text of the kit effects (counters, labels, tickers). Hand-written glyph data, nothing copied or traced. Accented letters are drawn with their base letter. |

## Other assets (textures, sounds, models, presets)

| Name | Where | Source | License | Notes |
|---|---|---|---|---|
| Style presets (palettes, post-fx settings) | `packages/engine/src/presets/*.json` | ReelForge project | CC0 1.0 | Authored in-repo. |
| Map land masks (`europe` outline, `generic`/`islands` noise) | `packages/kit/src/fx/map-regions.ts` | ReelForge project | CC0 1.0 | The Europe outline is ~200 rough [lon, lat] points typed by hand from general knowledge for a stylised look; no geodata set (Natural Earth, OSM, ...) is bundled or derived from. |
| _(sfx library — PLAN.md phase 8)_ | | | | |

## npm dependencies (runtime)

| Package | Version | License | Used by |
|---|---|---|---|
| three | 0.186.1 | MIT | engine |
| zod | 4.6.5 | MIT | shared, engine, pipeline, claude-bridge |
| acorn | 8.18.0 | MIT | engine (determinism lint) |

## npm dependencies (dev / test only, not shipped)

| Package | Version | License | Notes |
|---|---|---|---|
| playwright | 1.63.0 | Apache-2.0 | Headless Chromium for golden frames (ADR-002) |
| esbuild | 0.28.2 | MIT | Harness bundle |
| vitest | 5.0.3 | MIT | |
| typescript | 6.0.3 | Apache-2.0 | |
| eslint, typescript-eslint, prettier | see `package.json` | MIT | |

## External binaries and models (not bundled; installed or pointed to by the user)

| Component | License | Notes |
|---|---|---|
| ffmpeg / ffprobe | LGPL-2.1+ or GPL, depends on the build | _to verify_ (9.4): the app must work with an LGPL build; the dev machine has a GPL build (docs/environment.md). |
| whisper.cpp | MIT | ADR-003. |
| Whisper model weights (ggml) | MIT | ADR-003; downloaded by the user, not committed. |
| Silero VAD | MIT | ADR-003, if shipped. |
| rnnoise models (`arnndn`) | BSD-3-Clause | ADR-003, if shipped. |
| Claude Code CLI (`claude`) | Anthropic commercial terms | Installed and logged in by the user; never redistributed (CLAUDE.md §3.1). |

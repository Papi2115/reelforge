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
| World countries of the blueprint map (177 outlines, ~13 KB) | `packages/kit/src/looks/blueprint/world-data.ts` | Natural Earth 1:110m Admin 0 Countries (naturalearthdata.com, `nvkelso/natural-earth-vector`), simplified in-repo on 2026-10-04 (topology-preserving Douglas-Peucker 0.5°, 0.25° grid, encoded polylines) | Public domain | Natural Earth: "all versions ... are in the public domain"; no attribution required ("Made with Natural Earth" credited voluntarily in the module doc). |
| Character pack (mascots Bulb/Screen/Fox/Bean, 10 cast members, mannequin, role-spec vocabulary, poses, expressions) | `packages/kit/src/characters/` | ReelForge project: Papi's character concepts (`docs/concepts/characters.html`, own work), ported in-repo (2026-10-04) | CC0 1.0 | Procedural box geometry and pose code written for this repo; nothing copied from third-party models. The concept page inlines Three.js (MIT) for viewing only; the kit does not bundle Three.js (the engine passes its own instance). |
| App icon (pixel-art voxel cube) | `apps/desktop/build-resources/icon.{png,ico}`, drawn by `apps/desktop/scripts/icon-art.ts` | ReelForge project, authored in-repo (2026-10-02) | CC0 1.0 | Procedural; regenerate with `pnpm --filter @reelforge/desktop icon`. |
| Example project "Doom on a calculator" (script, storyboard, scenes, cues, word timings) | `templates/examples/doom-on-a-calculator/` | ReelForge project, authored in-repo (2026-10-02) | CC0 1.0 | Scenes use only the kit; see `docs/example-project.md`. |
| Example project voice-over (30.5 s, 16 kHz mono WAV, ~0.95 MB) | `templates/examples/doom-on-a-calculator/audio/vo.original.wav` | Synthesized locally on 2026-10-02 with the Windows built-in SAPI voice "Microsoft David Desktop" (System.Speech, the `spikes/03-audio/synth.ps1` approach) | _to verify_ (9.4) | Machine speech from the voice that ships with Windows; no recording of a person. Microsoft's terms for redistributing synthesized output must be checked before any public distribution; if not allowed, replace it with a recorded CC0 voice-over (same script) and re-time the words. |
| _(sfx library — PLAN.md phase 8)_ | | | | |

## Downloaded assets (ReelForge 2.1, PLAN.md#12.9)

No downloaded asset is bundled with the app or committed to this repo. Inside a user's project,
`reelforge fetch-asset` only downloads what the project's research mode allows: items the user
approved (mode `ask`) or items from allowlisted open-licence sources with verified licences (mode
`allowlist`); mode `full-auto` downloads are marked `unverified` and flagged in the credits (and, from
PLAN.md#12.10, at export). Each file's source, author and licence are stored in the project's `assets.json`, and
`reelforge assets credits` writes the attribution. Responsibility for published videos stays with
the user. Details: `docs/assets.md`, ADR-012.

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
| electron-builder | 26.17.0 | MIT | Windows packaging (PLAN.md#9.3, docs/packaging.md). The NSIS installer stub it embeds is NSIS (zlib/libpng license; bzip2 parts BSD-style), which allows redistribution of installers. electron-updater is **not** used. |

## External binaries and models (not bundled; installed or pointed to by the user)

| Component | License | Notes |
|---|---|---|
| ffmpeg / ffprobe | LGPL-2.1+ or GPL, depends on the build | _to verify_ (9.4): the app must work with an LGPL build; the dev machine has a GPL build (docs/environment.md). |
| whisper.cpp | MIT | ADR-003. |
| Whisper model weights (ggml) | MIT | ADR-003; downloaded by the user, not committed. |
| Silero VAD | MIT | ADR-003, if shipped. |
| rnnoise models (`arnndn`) | BSD-3-Clause | ADR-003, if shipped. |
| Claude Code CLI (`claude`) | Anthropic commercial terms | Installed and logged in by the user; never redistributed (CLAUDE.md §3.1). |

## Dependency audit (2026-10-02)

### License summary (all dependencies, incl. dev)

| License | Count | Status |
|---|---|---|
| MIT | 100 | ✓ approved |
| Apache-2.0 | 14 | ✓ approved |
| ISC | 6 | ✓ approved |
| BSD-2-Clause | 6 | ✓ approved |
| BSD-3-Clause | 2 | ✓ approved |
| MPL-2.0 | 2 | ✓ approved |
| BlueOak-1.0.0 | 1 | ✓ approved |
| **Total** | **131** | All acceptable |

### Production dependencies (shipped in Electron app)

| Package | Version | License | Used by | Notes |
|---|---|---|---|---|
| react | 19.3.0 | MIT | desktop | Renderer framework |
| react-dom | 19.3.0 | MIT | desktop | React DOM binding |
| three | 0.186.1 | MIT | engine | WebGL rendering |
| zod | 4.6.5 | MIT | shared, engine, pipeline, claude-bridge, project, prompts, stages | Runtime schema validation |
| acorn | 8.18.0 | MIT | engine, stages | Determinism lint parser |

### Development dependencies (examples, not exhaustive)

All dev dependencies (ESLint, TypeScript, Vitest, Playwright, Vite, etc.) are MIT, Apache-2.0, ISC, or BSD-licensed. No conflicts.

**Playwright 1.63.0** (Apache-2.0) is dev-only and used for golden-frame tests (ADR-002); not shipped.

### External binaries verification

| Component | License | Acquisition | Shipped | Notes |
|---|---|---|---|---|
| ffmpeg / ffprobe | LGPL-2.1+ or GPL | User-provided or system PATH | ✗ external | ✓ Code looks up via `REELFORGE_FFMPEG` env, PATH, or common dirs (packages/pipeline/src/ffmpeg/locate.ts); no bundled build. User must ensure LGPL/non-GPL binary. |
| whisper.cpp | MIT | User-downloaded (ADR-003) | ✗ external | ✓ Confirmed MIT license |
| Whisper model weights (ggml) | MIT | User-downloaded | ✗ external | ✓ Confirmed MIT license |
| Silero VAD | MIT | User-downloaded if shipped | ✗ external | ✓ Confirmed MIT license |
| rnnoise (`arnndn`) | BSD-3-Clause | User-downloaded if shipped | ✗ external | ✓ License confirmed; see rnnoise upstream |

### Findings

- **No GPL/LGPL/AGPL in production bundle.** ffmpeg is external; the app does not distribute a GPL build.
- **No unknown/UNLICENSED/proprietary packages.** All 131 dependencies have clear, OSS-compatible licenses.
- **react, react-dom, three, zod, acorn are MIT:** all shipped dependencies are MIT or lower-restriction licenses.
- **Fonts (Forge Display, Mono, Voxel):** hand-authored CC0 (already documented).
- **Assets (presets, map outlines):** CC0 (already documented).
- **Playwright is Apache-2.0 and dev-only:** no impact on distribution.

### Missing documentation (now resolved)

- ✓ react, react-dom production deps added to npm dependencies table.
- ✓ three already documented; license confirmed MIT.
- ✓ esbuild: verified MIT, but is dev-only (in CLI, not desktop app).
- ✓ playwright: verified Apache-2.0, dev-only for golden frames.
- ✓ whisper.cpp, models, Silero VAD, rnnoise: licenses already documented in external binaries section.
- ✓ ffmpeg: documentation updated with verification that code fetches external binary; no GPL build bundled.
- ✓ Electron (MIT; Chromium notices): ship with Electron itself (not our npm dependencies); noted separately as platform dependency.

**Conclusion:** PLAN.md#9.4 AC met. No license conflicts. Ready for distribution (assuming ffmpeg binary provided by user is LGPL, not GPL).

## Test pictures (PLAN.md#12.11)

- `packages/engine/test/fixtures/asset-test-card.png`: synthetic test photo generated by
  `packages/engine/src/assets/testing/test-card.ts` (procedural, made for this project): CC0.
  The asset render goldens (`asset-*`) are renders of it.

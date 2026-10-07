# ReelForge v3.1.0-beta.1 — release notes

Builds on v3.0.0-beta.1. **Beta**: all four worlds (Sketchbook, Comic, Game B2, Game B1) are behind **Settings → Projects → Experimental worlds (preview)**; existing projects and styles are unchanged.

## New
- **Channels.** A dynamic list of channels, each with its own ElevenLabs key (encrypted with Electron `safeStorage`, never in the project, git, logs or the renderer), voice and voice settings, default style/genre, and its own taste profile per world. Settings → Channels, with a **Test key** button.
- **ElevenLabs voice generation (English).** Generate the voice-over from the script per channel: chunking, seamless stitching, cost estimate before the call, takes manifest, per-sentence **Redo**. Manual import still works. Not yet tried with a live key in this beta; see `docs/voice.md`.
- **Production line.** Per-channel queues, one film building at a time, approval gate before building, "needs voice" skip, pauses and resumes when the usage limit is hit (Ctrl+Shift+L, Needs-you integration, notifications). See `docs/production-line.md`.
- **Genre presets.** Six presets (script tone, preferred moods/looks, wow pacing) applied in New project, Channels and Project settings. Final mapping to be tuned after hands-on trials. See `docs/genre-presets.md`.
- **Worlds: Comic, Game B2 (first person), Game B1 (2600-style)** with their own looks, breakthrough scenes, link transitions, prompts, sound palettes and variety quotas.
- **Open vocabulary.** A world is a style grammar, not an asset catalogue: each film designs its own cast, props and environments (sprite/texture/figure/art DSLs and generators per world) from the narration. New **world-assets** stage inside "Scenes built", project files `assets/<world>/*.json`, `reelforge world-assets check|sheet`, topic-bias tests.
- **Guards:** offensive-terms guard, unrequested-showcase-object guard, fact-conflict handling between critic and research, sfx lint, no-question fix turns.
- **UI:** export dialog v2, shortcuts dialog, Project settings tabs, pixel titles, taste per channel.

## Fixes
- Anchors are resolved inside the shot window; parallel shot locks no longer race; encoder falls back from NVENC to x264; atomic harness writes; file-size guard.

## Notes
- Known list: `docs/beta-feedback.md`. Test films: `docs/real-run-*.md`.
- Films are English only. GitHub releases stay drafts.

# ReelForge v3.4.0-beta.2 — release notes

Fix release on top of v3.4.0-beta.1.

## Fixes
- **"Words timed" no longer fails in project folders with accents or other non-ASCII characters** (e.g. `Déjà Vu`). The whisper tools on Windows cannot open such paths, so the audio and models are now staged in a temporary ASCII-only folder while they run (always cleaned up); plain ASCII paths behave as before. Error messages now name the real cause.

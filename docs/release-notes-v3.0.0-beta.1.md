# ReelForge v3.0.0-beta.1 — release notes

Builds on v2.3.7. **Beta**: the new worlds are behind **Settings → Projects → Experimental worlds (preview)** (off by default); existing projects and styles are unchanged.

## New
- **Worlds architecture.** A world = a Style + its own looks (A/B/C) + rare "breakthrough" scenes. World styles show only their own looks and get their own prompts, craft brief, sound palette and transitions.
- **Sketchbook world (beta).** Hand-drawn notebook: one writing hand with a task queue (it draws the key thing, small labels appear on their own), line boil, felt-tip/crayon/ballpoint/marker marks, 3 looks (story pages, graph paper/envelope/index card, loud paper moments), 4 page layouts, page-native transitions (page flip, riffle, crumple-toss, tape-peel, torn strip), its own sound palette, and two breakthrough scenes: the **pop-up** (a toolkit — every pop-up invents its own mechanism whose pull carries the narration's meaning: gauge, door, window, gear, …) and the **accordion strip**. Variety is enforced (about one breakthrough per 50 s, ≥ 2 kinds, never adjacent).
- **Continuity links** between shots (zoom-through, shared object, carry-environment): the signature cut of the worlds; in worlds ≈ one per 45–60 s.
- **Anti-slop guards** (warn only): invented text, clutter, symmetry, uniform timing, missing human traces, repeated compositions, text drawn outside `page.write`.
- **UI (light rebuild, old-school layout kept):** true empty states and status words per step ("Needs: timed words", "Built with problems: 6 of 7"), empty stage instead of the demo scene (voiceover still plays), one click on a pipeline row opens its panel with **All options** (everything that step offers, same settings as Project settings), **Director tab** next to Chat (tension, story beats, editing, opening, directions history), **Needs you** inbox (Ctrl+Shift+N), cleaner header/status bar, tokens v2.
- **Export:** if the GPU encoder cannot open (e.g. out of video memory) the export retries once and falls back to CPU with a warning.
- **Fixes:** per-shot commits contain only that shot's files (parallel scenes), `reelforge validate` knows experimental worlds, renderer harness retry in scene QA.

## Notes
- No release of a world is "finished": see `docs/beta-feedback.md` for the known list. Real test films: `docs/real-run-sketchbook-1.md`, `-2.md`, `-3.md` (mean page score 16–17 of 20; showcase 18–19).
- Comic, Game B2 and Game B1 worlds, Channels (own ElevenLabs key + voice per channel) and ElevenLabs voice generation come in 3.1–3.3.

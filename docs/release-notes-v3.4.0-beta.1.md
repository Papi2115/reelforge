# ReelForge v3.4.0-beta.1 — release notes

Builds on v3.3.0-beta.2. **Beta**: worlds are still behind Settings → Projects → Experimental worlds.

## New
- **New main menu (Home).** Full-window Home without the scene preview: left menu (Projects, Channels, Production line, Shorts, Settings, Help), project cards in a grid grouped by channel (type a new channel name when creating a project and it files itself), search, filters, a "Continue" row, 8-step progress strip and a status sentence per card, Ctrl+N and / shortcuts. The editor is unchanged ("← Projects" returns Home).
- **New project wizard** (Topic → Channel and genre → Style with picture cards → Voice and create) instead of the long form.
- **Project overview** (click a card): where the film is, next step button, thumbnail upload, film facts, tags and timestamps, shorts of the film.
- **Publish SEO.** The program writes `publish/seo.json`: 15 tags (5 one-word, 5 two-word, 5 three-word, about the film and the whole channel niche) and 5–8 chapters with SEO titles; the production line generates it after export (never blocks, deterministic fallback).
- **Shorts (voxel and Comic).** Menu → Shorts → "New short from a film": two separate short projects per film (30 s and 60 s), portrait 9:16 (1080×1920), same style, channel and voice. The script is a curiosity-gap teaser (hook, stakes, withheld answer), the storyboard is built for retention (cuts every 1.5–3 s), every scene is built new (copying a film scene is blocked; props, characters and assets are reused), last 2 s "Full video on YT: <Channel>", optional word-by-word captions. Comic has native portrait layouts.
- **Portrait format** in the engine, preview and export (1080p/1440p/4K upright). Sketchbook, Game B1 and Game B2 are not portrait-aware yet.

## Fixes (since beta.2)
- Sketchbook: page push, gauge ink, number provenance in diagrams, three new sound recipes. Export remembers a failed GPU encoder per session. Sound panel scrolls at 720p.

## Notes
- Shorts are available for voxel and Comic films for now. Known list: `docs/beta-feedback.md`.

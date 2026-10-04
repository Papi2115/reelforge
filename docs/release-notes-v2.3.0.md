# ReelForge v2.3.0 — release notes

Builds on v1.2.0. This release carries the whole of phase 12 (versions 2.0, 2.1, 2.2 and 2.3 were developed
in one go, so they ship together under one tag; the sections below say what belongs to which step).
Everything new sits behind a project switch. **Projects without the new fields (every 1.x project,
the example project) render exactly as before**: frame-for-frame, cue-for-cue (the "no harm" test).
New projects get the new features switched on; the *Project settings* dialog (header) changes them.

## 2.0 — Looks
One **Style** (palette, dithering, pixel fonts, sound character) and many **Looks** that all pass through it.
- **Looks:** voxel (unchanged), **retro-UI/CRT** (windows, terminal, browser, dossier/newspaper, CRT),
  **isometric diorama** (office, server room, city, room), **blueprint/data** (charts from pasted CSV, graphs,
  timelines, maps, schematics, counters).
- **A/B/C rolls** assigned by the storyboard (A = main story, B = proof/illustration, C = atmosphere) with
  rhythm rules; a vibe guard checks every frame stays in the palette.
- **Ambient variation:** backgrounds drift subtly shot to shot inside the style's budget.
- **Transition kit:** ten palette-pure pixel transitions, including look-change specials (crt-zoom,
  tile-flip, draw-over, …), identical in preview and export.
- **Sound palettes per look:** 25 new SFX recipes and ambience beds, deterministic mix.
- **Project settings dialog**, `reelforge looks`, bounded `kit-docs` (the index stays readable for Claude).

## 2.1 — Assets and research
- **Four research modes:** ask per package, allowlisted sources, full auto (⚠ unverified licences), off
  (zero network). `reelforge fetch-asset` / `assets` commands with strict safety limits; YouTube is never touched.
- **Assets inside scenes:** photos and stills pixelised into the palette and shown on screens, frames,
  polaroids, billboards, newspapers.
- **Own assets from A to Z** and a **global asset library** shared across projects.
- **Publish kit:** chapters, description, tags and a Credits block as paste-ready files (no upload).
- **Sources and fact-check:** claims with pinned sources, a Sources panel, an optional on-screen source chip.

## 2.2 — Direction and dramaturgy
- **Tension map** (from the script or drawn by you) steering cut tempo, look choice, music mood, background
  darkness and effect density.
- **Cinematic pixel camera:** rack focus (dither bokeh), dolly zoom, orbit, parallax.
- **Beat-synced editing** and **film-level repetition control** with proposals.
- **Pattern interrupts, open loops and climax reveal moments** (silence-hit, palette shift, slow motion that
  keeps the voice-over sync).

## 2.3 — Personalisation
- **Looks:** flat 2D motion graphics, paper cut-out, whiteboard.
- **Hook lab:** three alternative openings side by side; the pick is saved to the script.
- **Taste learning:** your variant picks and locks become a local profile fed to the prompts (view and reset
  in Settings → Taste).
- **Live co-direction:** type commands while the film plays ("slower", "darker", "arrow on the word X");
  host-level overrides apply in well under a second; harder requests go through Claude as variants.

## Measured
- Real run of the 2.0 looks on a real subscription: 2:17 film, 25 shots, 25 ✓, mix −14 LUFS, all anchors within
  ±150 ms (`docs/real-run-v2.0.md`). The later versions were verified with fake-claude end-to-end tests and
  render goldens; they have not been run on a real subscription yet.
- Preview stays at 30 fps (engine frame cost unchanged vs 1.2.0 within noise).

## Known limitations
- Unsigned installer; Windows only; personal use (see v1.0.0 notes). Signing/auto-update (11.6) and the speed
  track (11.7) remain deferred.
- Characters/mascot packs and series memory are the separate 2.3.5 step (not in this release).
- Live co-direction is limited to host-level overrides (speed, tone, arrows, zoom); structural changes rebuild
  through Claude.
- Library of Congress search could not be verified against the live API from the dev machine.
- Videos used as assets show one still frame; no video playback in scenes.
- A screen auto-clicker running on the machine breaks end-to-end tests of the real window; test windows
  ignore OS mouse input now.

# ReelForge 2.0 — ideas for breakthrough mechanics

Status: brainstorm (2026-10-03), nothing committed to. Version 1.2 is planned in `PLAN.md` (phase 11).
Ordered roughly by expected impact on "a finished, edited, well-sounding film from a script and a voiceover, fast".

## Top candidates
1. **Style DNA from references.** Drop in 1–3 videos you like; the app samples frames and audio, extracts pacing,
   cut rhythm, annotation vocabulary, colour, camera behaviour and music energy into a reusable style pack, and
   applies it to your films (style only, never content).
2. **Live co-direction.** Talk to the film while it plays ("slower here, darker, add an arrow on the word X"):
   the shot re-renders in under a second because shots are template-driven and cached. Voice dictation optional.
3. **Taste learning.** Variants you pick (v1.2: shot variants) and shots you lock (v1.2: locks) become a local preference
   signal. Future builds bias towards what you approved. Everything stays on your machine.
4. **One style, many looks** (agreed direction, see `PLAN.md` phase 12). The retro identity lives in the shared
   post-fx, palette, pixel fonts and sound palette (the *Style*); a *Look* is a renderer family + templates + kit that
   always passes through it. Looks: voxel (current), retro-UI/CRT, isometric diorama, blueprint/data, flat 2D,
   paper cut-out, whiteboard. The director assigns each beat an A/B/C roll and a look; the environment drifts subtly
   within a variation budget so eight minutes never look like the same blue grid.
   Assets (photos/footage) are researched in one of four modes — ask per batch, auto for chosen sources, full auto
   (flagged risky), off (own assets only) — and are embedded inside scenes (photo on a laptop screen, framed on a
   wall) after the pixel filter. Looks can later be shared as folders.
5. **Beat-synced editing.** Generated music follows the speech pace; cuts, whooshes and accents snap to a beat grid
   and to emphasised words. The film feels edited to the music.
6. **One project, many languages.** Translate the script, import a voiceover per language; the same animation re-times
   through anchors and on-screen text is localised. A channel in several languages from one build.
7. **Data-driven scenes.** Drop a CSV or paste numbers; the app builds charts, maps (licensed open geodata) and
   timelines in 3D automatically, synced to the narration.
8. **Series memory.** A channel or series is an object: recurring characters, mascot, props, intro/outro, running
   gags and continuity ("episode 12 reuses the lab from episode 9").

## Strong second tier
9. **Retention coach.** Predicts weak spots from pacing, loudness and pattern-change frequency; suggests cuts or visual
   boosts; imports your YouTube analytics export (CSV, no API) to tune the next film.
10. **Shorts factory — moved to 3.0.** A separate short-form generator that works on different principles than the
    long film, not just a re-crop of it.
11. **Local draft voice.** Optional local TTS (Piper/Kokoro) so the whole pipeline can be previewed without ElevenLabs;
    swapping in the final voiceover only re-times.
12. **Director plug-ins.** Packaged "directors" (true-crime, tech explainer, history…) as shareable Claude skills with
    their own storyboard rules and sound palettes.
13. **Render farm on the LAN.** Spread export across several of your own machines; multi-GPU support.
14. **Script-to-film live.** Type the script and watch the animatic build incrementally (cached, only changed parts).

## Added 2026-10-03 (approved, now `PLAN.md` phase 12)
Transition kit between looks (12.15) · Hook lab: 3 openings side by side (12.16) · Publish kit: chapters, description,
tags, credits (12.17) · Sources and fact-check with on-screen source chips (12.18) · Global asset library across
projects (12.19) · Series memory (12.20) · Beat-synced editing (12.21) · Tension map driving cuts, music, background
darkness and effect density (12.22) · Film-level repetition control (12.23) · Per-look sound palettes (12.24).
Pattern interrupts planned from the script (12.25) · Open loops with visual teasers (12.26) · Climax reveals driven by
the tension map (12.27) · Cinematic pixel camera: rack focus, dolly zoom, orbit, parallax (12.28).
Declined for now: AI thumbnails/titles, branded captions.

## Release split (2.0–2.3, 28 tasks of `PLAN.md` phase 12)
Each version ships on its own branch with a tag, release notes, a test film and the "no harm" test on the Nokia project.
- **2.0 Looks** — 12.1 look architecture + A/B/C rolls · 12.2 retro-UI/CRT · 12.3 isometric diorama · 12.4 blueprint/data
  · 12.8 ambient variation · 12.15 transition kit · 12.24 per-look sound palettes.
- **2.1 Assets and research** — 12.9 `fetch-asset` · 12.10 four research modes · 12.11 asset embedded in scene · 12.12 own
  assets A–Z · 12.19 global asset library · 12.17 publish kit · 12.18 sources and fact-check.
- **2.2 Direction and dramaturgy** — 12.22 tension map · 12.28 cinematic camera · 12.21 beat-synced editing · 12.23
  repetition control · 12.25 pattern interrupts · 12.26 open loops · 12.27 climax reveals.
- **2.3 Personalisation and extras** — 12.5 flat 2D · 12.6 paper cut-out · 12.7 whiteboard · 12.16 hook lab · 12.13 taste
  learning · 12.14 live co-direction.
- **2.3.5 Series and characters** — 12.20 series memory, built on Papi's ready-made character and mascot packs
  (imported, not redesigned).
- **3.0** — Shorts factory (separate generator). **2.x backlog** — retention coach.

## Not scheduled (ideas not yet approved)
Style DNA from references · one project in many languages · local draft voice (Piper/Kokoro) · director plug-ins ·
LAN render farm · script-to-film live · cold-read test · VO swap diff (re-anchor report) · dry-run director plan with
cost estimate · machine profiles · dither/scanline reveal masks · signature sound and visual motifs.

## How v1.2 prepares 2.0
Shot variants and locks produce taste signals (3). Word-driven templates and an animatic before the voiceover are
the foundation for live co-direction (2) and beat-synced editing (5). Style packs (4) reuse the template and kit
interfaces introduced by the speed track (11.7).

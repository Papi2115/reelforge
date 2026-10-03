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
4. **Style packs / multiple engines.** Voxel is one pack. Others: flat 2D motion graphics, isometric dioramas, paper
   cut-out, whiteboard, blueprint/technical. Each pack ships its own kit, templates, style bible and sound palette;
   packs can be shared as folders.
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
10. **Shorts factory.** Long film → vertical Shorts with automatic re-framing, captions and best-moment selection from
    the same storyboard.
11. **Local draft voice.** Optional local TTS (Piper/Kokoro) so the whole pipeline can be previewed without ElevenLabs;
    swapping in the final voiceover only re-times.
12. **Director plug-ins.** Packaged "directors" (true-crime, tech explainer, history…) as shareable Claude skills with
    their own storyboard rules and sound palettes.
13. **Render farm on the LAN.** Spread export across several of your own machines; multi-GPU support.
14. **Script-to-film live.** Type the script and watch the animatic build incrementally (cached, only changed parts).

## How v1.2 prepares 2.0
Shot variants and locks produce taste signals (3). Word-driven templates and an animatic before the voiceover are
the foundation for live co-direction (2) and beat-synced editing (5). Style packs (4) reuse the template and kit
interfaces introduced by the speed track (11.7).

# Grim Ink — authoring-session mode (PLAN.md#14.21)

Decision of Papi (2026-10-11): the prototype films (Apollo, papal conclave, samurai, and the styles7
experiments) were made by ONE free Opus session that was given the graphic style (a guide with
recommendations) and a topic. No live corrections, no gates. The film was one continuous timeline;
scenes changed only where the script needed it; characters and motion were invented freely. Our
fragmented pipeline (storyboard -> isolated per-shot builds, shots per minute, quotas, validators)
scored 5 - 6.5 / 10 on the same topic. A free cloud session (Miami 80s, PR #32) reproduced the
prototype quality inside the repo.

Goal: **a twin of that environment inside ReelForge**, plus everything ReelForge adds around it
(voice-over timing, captions, sound, export, thumbnail, SEO, channels).

## Contract
- One session (Claude Code CLI, Opus) per film, long-running and resumable, with tools: Read, Write,
  Edit, Bash limited to the project folder and the `reelforge` CLI (frames, lint, anchors).
- Environment = the ORIGINAL C-CAM engine API (`ST.*`, classic scripts) so the guide matches what the
  model reads and writes: `film/js/{core,brushes,face,grime,rig,poses,timeline}.js` seeded from the
  prototypes, plus film-specific files the session writes (cast, sets, props, shots, film.js).
- Reference pack (read-only, in the project under `reference/`): guide docs 01-09, the style-07
  rulebook (`styles7/07-great-stink-london/NOTES.md`), the ten stills' character functions as
  technique references, the Apollo/samurai/papal film code and proof frames. Labelled "technique,
  not content".
- Inputs the app provides: script, timed words (anchors) and the voice-over file (or silence for tests),
  channel/genre/style settings, caption preference.
- Free: number and length of shots (they follow the script), cast size, gags, camera, composition. No
  shots-per-minute range, no variety quotas, no moment catalogue, no required cast size, no
  per-shot gates, no scene line limits. The direction notes (gags with setup/payoff, accident,
  climax close-up) are a chapter of the guide, not validators.
- Fact policy for this world: "what if" material; about 70 % grounded in science/history, the rest
  imagination framed as imagination. Only guard: fabricated precise statistics or quotes attributed
  to real people, claims contradicting common knowledge stated plainly, offensive terms, and leakage
  of example content from the reference pack.
- Only technical hard requirements: valid determinism (pure function of t), timeline matching the
  voice-over anchors, export success, the content-leak guard.
- Keep between films only the general graphic style (line, palette family, proportions, grit,
  camera language); casts, plots and gags must differ every time. A cheap diversity check compares
  consecutive films (cast designs, camera patterns, gag kinds) and warns on repetition.

## Pipeline shape
Script (speculative tone) -> voice/silence -> words/anchors -> FILM SESSION (replaces Storyboard +
Scenes) -> sound -> export (captions, thumbnail from the opening frame) -> publish kit.
The storyboard file is still derived (shots from the film's timeline table) so downstream steps keep
working.

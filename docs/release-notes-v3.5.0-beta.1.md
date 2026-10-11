# ReelForge v3.5.0-beta.1 — release notes

Builds on v3.4.0-beta.2. **Beta**: worlds (Sketchbook, Comic, Game B2, Game B1, Grim Ink) are behind
Settings → Projects → Experimental worlds.

## New: the Grim Ink world (`c-cam`)
- A hand-drawn grim-caricature world: truecolor ink style (no palette snap), 24 fps, three looks
  (scene / insert / poster) that can be switched off per project, people and places built from the
  narration (project modules `kit-ext/people`, `kit-ext/places`, shared libraries `kit-ext/lib`),
  cut-table camera with 2–5 framings per shot, foreground silhouettes, Dutch tilt.
- **Direction layer**: before the storyboard Claude plans the film's narrative accents — a signature
  gag per person with setup → escalation → payoff, an accident beat, a purposeful climax close-up,
  camera intent per beat, and a title frame (main characters + title + background) that doubles as the
  thumbnail; validators check that the plan is executed.
- **Gag toolkit** (17 kinds: gum + bubble, sweat, sip, eat, thumbs-up, checklist, helmet, fidget,
  glance, yawn, scratch-head, sigh, cough, clock-check, tug-collar, wipe-brow, pen-click) and a
  parameterized **vocabulary** of props, instruments, crowds, two-body acting gags and small fx.
- Captions and lettering use the same fonts as the prototype films (Arial Black, Impact, …) when they
  are installed, with a CC0 ink-stroke fallback; a film-level Captions switch (`off`/`words`).
- c-plus validators check people (anchors vs chin, head vs open jaw, tangles, hand contact) and a
  build stage designs people and places per film (lint → validators → preview → critic → one fix).
- Opening frame saved as the thumbnail when none is uploaded.

## Also
- Export no longer fails with "render window closed" on world projects; "Words timed" works in
  project folders with accents (3.4.0-beta.2 fixes, included).
- Home screen, wizard, project overview, publish SEO and Shorts (voxel and Comic) from 3.4.

## Notes
- Grim Ink is rough: the first 30 s sample scored 5/10; this release contains the fixes made after it
  (see `docs/real-run-grim-ink-1.md`, `docs/worlds/c-cam-ENGINE-GAPS.md`). Known: the editor's arm in
  3/4 view comes from mid-chest (rig behaviour of the prototypes).
- Test films stay at 30 s or less; check the weekly usage limit before real runs.

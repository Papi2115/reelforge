# ReelForge v2.3.5 — release notes

Builds on v2.3.1. Adds the character pack from your `docs/concepts/characters.html` and the rules for using it.

## New
- **Character pack as `kit.cast`:** 4 mascots (Bulb, Screen, Fox, Bean), 10 side-cast people (Scientist, Doctor, Engineer,
  Finance, Teacher, Historian, Kid, Hacker, Detective, Astronaut) and a neutral Mannequin, ported faithfully from the concept
  page with the 8 poses, spring motion, blink and the mascot expression system. Deterministic and palette-clean.
- **Per-project choice** (Project settings): **Pack style** or **Classic** (the old hoodie guy), plus a **mascot** (None or one of
  the four). New projects can start from defaults set in Settings → Projects, so your channel mascot carries over.
- **Mascot rules:** with a mascot chosen, Claude gives it sparse, sensible screen time while planning and building scenes, only in
  impersonal roles (pointing at a chart, pressing a button, carrying an object, reacting, standing in for the viewer, holding a
  sign). It never replaces a doctor, scientist, historian or any person whose identity matters; the storyboard validator rejects
  that (EN + PL keyword list) and scene QA checks the right mascot is used.
- **Roles on demand:** when the story needs a person who is not in the pack (a firefighter, chef, pilot…), the app builds a role in
  the same style (a data-driven role spec from an accessory vocabulary, with optional new accessories), QA-checks it and saves it
  in the project. `reelforge cast list|check|preview` and `kit-docs characters` document it.
- **Staging rules for people** in the scene prompt and docs: default or dramatic lighting on people (never noir), face the camera,
  readable size.

## Also (from v2.3.1)
Storyboard annotation auto-trim, preview placeholders for unbuilt shots, tension mood grade, retro-UI glyph fix, render/preview
watchdogs, clearer sidebar labels.

## Known limitations
- Real-run check was small (4 shots): firefighter skin and helmet colours can merge; the critic does not yet flag unreadable people.
- Series memory beyond the per-project choice (shared intro/outro and continuity between episodes) is not built yet.
- `reelforge validate` does not run the storyboard rule checks (the stage does).

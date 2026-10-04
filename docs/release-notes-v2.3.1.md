# ReelForge v2.3.1 — release notes

Hotfix and polish on top of v2.3.0.

## Fixed
- **Preview during a build:** shots whose scene is not built yet show a "not built yet" card instead of the whole project falling
  back to the demo scene; built shots play normally and update as they appear. Export still requires every scene.
- **Storyboard no longer fails on a slightly crowded minute.** When the only problem is too many or too repetitive
  annotations (the density rule: max 8 per minute, or the same kind 3 times in a row), the stage now trims the weakest
  marks itself, re-checks and continues with a warning. No repair turn is spent. Other problems fail as before.
- **Tension mood grade:** high-tension shots now visibly darken (and calm ones lift) inside the style palette, host side.
- **Retro-UI:** garbled highlighted glyphs on CRT screens fixed; headings no longer overflow their pages.
- **Camera interrupts:** scene QA flags unlabelled or extreme camera moves; the scene prompt gives clearer rules.
- **Beat sync:** whooshes snap to the beat within a wider, anchor-safe window.
- **Robustness:** hung render windows are destroyed instead of waited on; the preview recovers from a lost engine reply.
- **UI:** the sidebar says what a waiting step really waits for (e.g. your review of an asset package).
- **Small bits:** clean author names in the asset panel; export chapters use spoken titles.

# ReelForge v1.2.0 — release notes

Builds on v1.0.0. Includes everything from the 1.1 line (runtime props, whisper install, new SFX and music) and the whole 1.2 plan.

## New
- **Preview audio fixed:** sound no longer cuts out after ~21 s in the preview (the media protocol range cap made the player think the file was 4 MB long). The player now also reports audio failures instead of failing silently.
- **Shot locks:** lock approved shots (padlock in Shots and the timeline, Shift+L); locked shots are never rebuilt or edited by builds, reviews or chat, enforced in code.
- **Automatic final review:** after Scenes are built, a quiet review (sync, phone legibility, frame checks, critic) fixes confirmed problems and shows a ✓/⚠ list; the export dialog shows a pre-flight list.
- **Shot variants:** "Variants…" (V) builds 2–3 genuinely different versions of a shot, side by side with live previews; pick one. Picks are logged locally as a taste signal for the future.
- **Annotation vocabulary:** `ctx.annotate` with callouts, arrows, rings, brackets, pinned labels, underlines/highlights, badges, stamps, dimension lines and spotlight; the storyboard plans annotations from the meaning of the script with variety rules.
- **Readability pass:** collapsible chat, clearer pipeline statuses, compact Shots panel with filter, timeline track toggles, calmer sound panel, model guidance in Settings, shortcut sheet (`?`).
- **Runtime props:** missing props (e.g. a Nokia 6110) are built inside the project on demand, QA'd from four angles, then used.
- **Whisper install in Settings** and a self-healing Words step.
- **Sound:** 32 polished SFX recipes with variants, generated music per act (light, calm by default, bass-limited), director-style SFX placement and a mix QA report.

## Quality
CI runs verify (Windows + Ubuntu), an end-to-end job in the real Electron app, and a clean-machine installer job (silent install, smoke tests, uninstall).

## Known limitations
- Unsigned installer (SmartScreen asks once). Signing and auto-update are deferred; personal use.
- Windows only. Distribution of an app built on users' subscriptions is a grey area; decide before any public release. No LICENSE file yet.
- System-clipboard tests cannot run on the developer's machine (environment).
- Speed track (templates, animatik) and a shared prop library are deferred by decision.

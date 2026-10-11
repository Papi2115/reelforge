# Brief 17 — PLAN.md#14.21 part D: app UI and settings for authoring mode

Branch: `phase-14/ccam-authoring-ui`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` and `docs/worlds/c-cam-AUTHORING-MODE.md`. Depends on briefs 14
and 15 for the stage name and manifest; code to the contract in those briefs (stage action
`{ stage: 'scenes', action: 'film' }`, report `.reelforge/film-report.json`, project field
`authoringMode: 'session'`) and keep UI logic in pure view-models so it merges cleanly.

## Goal
In the desktop app a Grim Ink project defaults to authoring mode: the pipeline shows the steps that
matter (Script, Voice, Words, Film, Sound, Export), the Film step runs the session with live progress
and can be resumed, and nothing in the UI suggests per-shot limits. The editor, preview, chat,
export and publish keep working on the produced film.

## Do
1. Project schema: `authoringMode?: 'session' | 'pipeline'` (zod, additive; default 'session' for
   style c-cam, absent for others). Project settings -> "Visuals": a row "Authoring" (Free session /
   Step-by-step pipeline) shown only for c-cam, with a one-line explanation. Wizard: nothing new
   except a note on the style card ("One free session writes the whole film").
2. Pipeline panel (renderer): for authoring-mode projects replace the Storyboard and Scenes built
   rows by one "Film" row with status words (Not started / Writing the film… / Built with warnings /
   Built) and the usual Open / Retry / Redo buttons; the "All options" list for the Film row has:
   captions (off/words), notes to the artist (free text appended to the session brief), "Redo from
   scratch" vs "Resume". Progress text shows the session's current activity (tool names like
   "rendering frames", "editing film/js/shots-b.js") from the stage events (follow how Scenes built
   shows progress).
3. Film report panel: shows `film-report.json` (anchor sync, lint, diversity warnings, leak guard,
   duration) as a readable list with "open file" actions; proof sheet image if present.
4. Chat integration: scope buttons "Shot/Selection/Whole video" keep working: in authoring mode a chat
   turn resumes the film session with the user's instruction (existing turn mechanism; write a stub
   adapter if brief 15 is not merged: `resumeFilmSession(projectDir, instruction)`).
5. Home/overview: card status strip shows the Film step; overview "Where the film is" next-step
   hint says "Write the film"; shorts remain unsupported for this mode (message).
6. Copy in docs/ui-copy.md; view-model tests; renderer/main service tests; no Electron launch in
   tests beyond the existing smoke patterns (update e2e selectors only where the UI changed; do not add
   new e2e).

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test` (renderer/main view-model tests); other styles' UI unchanged;
PR description with screen descriptions for Papi.

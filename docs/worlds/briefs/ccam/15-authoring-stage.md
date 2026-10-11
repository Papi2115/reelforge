# Brief 15 — PLAN.md#14.21 part B: the film-authoring session stage

Branch: `phase-14/ccam-authoring`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` and `docs/worlds/c-cam-AUTHORING-MODE.md`. Depends on brief 14
(ST host): develop against its API; where it is not on `main` yet, code to the contract described
there (manifest `inkFilm`, `film/js`, `film/film.json`, `seedFilmProject`) and stub what is missing
behind small interfaces so the two merge cleanly.

## Goal
A stage action `{ stage: 'scenes', action: 'film' }` (shown as "Film" in the pipeline for
c-cam projects in authoring mode) that runs ONE long Opus session which writes the whole film
as ST files, with the reference pack and tools, then derives what the rest of the pipeline needs.

## Read first
Stage precedents: packages/stages/src/c-cam/* (modules stage, QA, report/recovery), world-assets
stage, scenes stage (packages/stages/src/stages/scenes.ts), session manager / permissions /
hooks (packages/claude-bridge: sandboxed Bash allowing only `reelforge`, Edit(./**)), the app's
run-stage CLI (packages/stages/src/cli/run-stage.ts), prompts infrastructure
(packages/prompts: prompts/*.md, catalog tests, evals, fake-claude fixtures), the guide pack:
docs/concepts/c-cam-style/docs/*.md, styles7/07-great-stink-london/NOTES.md, stills code
styles7/07-great-stink-london/js/stills/*.js.

## Do
1. Reference pack builder: `scripts/build-ccam-pack.mjs` assembles `packages/stages/assets/
   c-cam-authoring-pack/` from docs/concepts (guide docs 01-09; style-07 rulebook; the ten stills'
   character functions; for each of Apollo, samurai, papal: js + proof frames (PNG, downscaled to
   <= 1280 px wide, <= 40 frames total); NOTES) with a README that labels everything "technique,
   not content". Keep the pack <= 8 MB. Commit the pack; add a test that the pack exists and its
   index is consistent; add to the packaged app resources (apps/desktop packaging config).
2. Stage `film`: for c-cam projects with `authoringMode: 'session'`: (a) seed `film/js` via
   `seedFilmProject`, copy the pack to `reference/` (read-only by convention), write `inputs/`
   (script.txt, words.json, anchors.md = the narration split into phrases with start/end seconds,
   total duration, caption lines, voice/silence info, channel, genre, brief); (b) run the session
   with a new prompt `c-cam-film` (v1, Opus, tools: Read/Write/Edit/Bash(reelforge only)/Glob/Grep),
   prompt text = a short authoring brief in the spirit of the original chat: "You are the artist
   of this film. Style = the guide in reference/. Topic and script in inputs/. Make the film in
   film/ as one continuous timeline whose scene changes follow the script's anchors; invent
   the cast, motion, gags and camera freely; look at your frames (`reelforge frames --film`) and
   refine until you are proud; finish with a proof sheet." NO rules about shot counts, quotas or
   cast size; only the technical contract (file layout, determinism, durations equal to the
   voice-over total, captions from the anchors); (c) session resumption: the stage tracks the
   Claude session id and resumes across limit pauses (existing bridge limit/resume rules);
   (d) after the session: `reelforge lint film/js`, anchor-sync report (does each caption/beat sit
   within 0.3 s of its anchor?), derive storyboard.json from the film's shot table, render
   proof frames, write `.reelforge/film-report.json`; failures are warnings, never a blocker for
   export.
3. Advisory validators (warnings only, in the report): diversity vs the previous film of the same
   channel (cast silhouettes, gag kinds, camera patterns: very cheap heuristics), content leak guard
   (named objects of the reference pack appearing in a film whose script does not ask for them: reuse
   the existing showcase-leak guard idea), captions present, duration mismatch.
4. Tests with fake-claude: success path, resume after a limit pause, lint failure -> one fix turn,
   missing reference pack -> clear error, shorts unsupported for this mode.
5. CLI: `reelforge run-stage scenes --action film` works headless (used by drivers and tests).

## Constraints
Do not add per-shot builds, critics or quotas to this path. Other worlds/stages byte-identical.
No real Claude calls in tests (fake-claude fixtures only). Files <= 400 lines.

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test`; stage tests green; pack committed with README;
PR description with the exact prompt text, the file layout the session sees, and the report schema.

# Brief 12 — PLAN.md#14.19: remove engine limits that block Grim Ink prototype fidelity

Branch: `phase-14/ccam-limits`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first. Context: Papi's verdict on the first sample ("tragedy",
`docs/beta-feedback.md`, `docs/real-run-grim-ink-1.md`) and his rule (CLAUDE.md §8, 2026-10-11):
**prototype fidelity beats engine rules in this world — the engine must speed up work, not limit it;
every deviation is a documented, world-scoped exception with a CI-safe fallback.**

## Goal
Find and remove (for `c-cam` only, behind the world id) every engine/kit/lint/prompt/stage limit that
makes it impossible or unlikely for a generated film to reach the authored level of the three
concept films (`docs/concepts/c-cam-style/films/*`, plus papal conclave and samurai in
`docs/concepts/styles7/17-samurai-edo`, `18-papal-conclave`). Other worlds stay byte-identical.

## Part A — audit (first; write `docs/worlds/c-cam-ENGINE-GAPS.md`)
Compare the prototype films' engine and authoring with what our pipeline allows. Table: limit →
where enforced (file:line) → what it blocks → decision (remove / raise / exception / keep, why).
Known suspects to verify and size:
1. **Absolute film time.** Scenes get shot-local `t` only; running gags (gum chewed all film, bubble
   at the end), counters and motifs need film-absolute time/progress. Provide `ctx.film = { t, duration,
   shotIndex, shotCount, shotT0, anchors? }` (and `ctx.shot.t0`) — c-cam only if needed for byte
   identity, else additive for all.
2. **Size limits.** Scene "<= 250 lines" guidance/lint, project module limits (people/places <= 250
   lines, 64 KB, 24 per kind). The prototypes' shot files and cast files are bigger and denser. Raise
   for c-cam: scene 600 lines, modules 450 lines / 160 KB / 64 per kind (kit-ext loader, lint rules,
   template CLAUDE.md for c-cam projects, prompts).
3. **No shared code.** Prototypes had film-level libraries (`acting.js`, `props.js`, `crowd.js`,
   `lunar.js`, `edo.js`) used by every shot. Our scenes/modules cannot import. Add project libraries
   `kit-ext/lib/<name>.js` (same loader/lint/cache key family as people/places; exports one literal
   `export const lib = {...}` of pure functions taking `(g, ink, ...)`), exposed as `kit.lib.<name>`
   to scenes and to people/places modules; limits as above.
4. **Anti-slop thresholds** (clutter <= 6, symmetry, accent coverage, trace counts) were guessed.
   Measure the prototype frames (all shots of the three films, render them with their own player or
   use the proof PNGs) and set c-cam thresholds from the observed maximum + 15 % margin. The
   guards must never push toward emptier frames than the prototypes.
5. **Critic.** Haiku judges frames; for c-cam use a stronger critic model setting (Sonnet) and give
   it 2 reference proof frames per look as images (paths in the prompt); keep other worlds as is.
   Also allow 2 fix iterations (not 1) and review >= 3 timestamps per framing for c-cam scenes.
6. **Style references.** Prompts are topic-neutral with abstract rules only; Claude has no
   concrete example of an excellent shot. Add on-demand `reelforge kit-docs shots` (<= 6 KB each):
   annotated, trimmed prototype shots labelled "technique, not content" (a running gag shot, a
   climax ECU, an accident beat, a reverse/OTS pair, a foreground-silhouette tension shot) with
   the existing unrequested-showcase-object guard extended to the prototype objects so content does
   not leak. The scene-build prompt tells the model to read the relevant topic before writing.
7. **Camera/stage.** Check `ink.cam` features vs prototypes: in-shot cut tables with 2–5 framings,
   push/pull moves within a framing, Dutch tilt, foreground silhouettes in screen and world space,
   coverage beyond the frame. List anything missing and implement it (vocabulary, not templates).
8. **Anything else you find** by reading `docs/concepts/c-cam-style/docs/06-AUTHORING.md` and the
   prototypes' timeline/player code (e.g. title card timing, blackouts/smash cuts, speed ramps,
   letterboxing, caption rendering) and comparing with `packages/engine`, `packages/kit/src/worlds/
   c-cam`, `packages/stages`.

## Part B — implement the decisions (each with tests; list in the PR)
Implement everything the table marks "remove/raise/exception" that is small and mechanical, and the
items above (1, 2, 3, 4, 5, 6). Anything big (e.g. a new engine camera feature) gets its own
follow-up entry in the gaps doc with an estimate instead of being half-done.

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:render` green; other worlds/goldens/fixtures
byte-identical; gaps doc + `docs/worlds/c-cam-STYLE.md` "Exceptions to engine rules" updated; PR
lists every raised limit with old/new value and every added API.

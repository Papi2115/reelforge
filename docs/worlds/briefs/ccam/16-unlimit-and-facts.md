# Brief 16 — PLAN.md#14.21 part C: remove the limits for Grim Ink and the 70/30 fact policy

Branch: `phase-14/ccam-unlimit`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` and `docs/worlds/c-cam-AUTHORING-MODE.md`.

## Goal
For the c-cam world (project `authoringMode: 'session'`, and as far as it makes sense for the old
storyboard path too): the engine and the prompts impose NO shots-per-minute range, NO variety quotas,
NO moment catalogue, NO required cast size, NO per-shot gates, NO scene length limits, and the
script/fact policy matches Papi's "what if" material: about 70 % grounded in science/history, the
rest imagination framed as imagination.

## Do
1. Inventory every limit that applies to c-cam (grep the world id and the generic stage code):
   `shotsPerMinute` / "Scenes per minute" (project.json, genre presets, storyboard prompt ranges,
   validators), `worldQuotaOverride`/variety quotas (packages/prompts/src/worlds/variety.ts),
   `cutsOnly`/transition density, moment catalogue and `world-moments` validators, direction layer
   validators (direction-rules, direction-cast, direction-storyboard), anti-slop errors and
   thresholds, "faster checks", scene QA/critic gates, per-shot fix limits, scene/module size limits,
   claims check strictness. Write `docs/worlds/c-cam-LIMITS-REMOVED.md`: limit -> where ->
   what was done (removed / made advisory / kept because technical).
2. Implement: in authoring mode none of these may produce errors; they become advisory entries in the
   film report (or are not run at all). The UI must not show a "Scenes per minute" control for this
   mode (Project settings: hide row for authoring-mode projects; the genre preset must not set
   shotsPerMinute for c-cam; the wizard must not offer it). Keep the old per-shot path behaviour for
   projects not in authoring mode unchanged (byte-identical prompts/fixtures).
3. Fact policy "speculative": script prompt for c-cam (new section gated on the world, topic-neutral
   wording): "This is a what-if film for entertainment. About 70 % of what you state should rest on
   real science or history; the rest may be imagination, framed as imagination ('imagine…', 'what
   if…', 'maybe…'). Never invent precise statistics or quotes attributed to real people; do not state
   contradictions of well-known facts as fact; no offensive terms." Claims check (packages/stages
   claims, prompts claims.md): a 'plausibility' mode for c-cam: warns only for (a) fabricated precise
   numbers/quotes attributed to real people stated as fact, (b) contradictions of widely known facts
   stated plainly; imagination framed as such is fine. Warnings never block.
4. Word budget: the c-cam script budget subtracts sentence pauses (0.4 s each): ~62 words per 30 s;
   keep the 150 wpm rule; update validator and prompt text; tests.
5. Tests: the previously failing-by-design cases (a film with 1 long shot; a cast of 2; no gag;
   shots per minute 1 or 40) produce no errors in authoring mode; byte-identical fixtures for other
   worlds/modes; claims plausibility tests (framed imagination passes; precise invented stat attributed
   to a person warns).

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test`; other worlds byte-identical; limits document present;
PR lists each removed/advisory limit.

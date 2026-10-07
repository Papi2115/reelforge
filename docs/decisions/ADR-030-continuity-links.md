# ADR-030: Continuity links between shots (ReelForge 3.0)

Status: accepted (2026-10-06). Code: `packages/shared/src/continuity.ts` (`continuityLinkSchema`,
`CONTINUITY_STYLES`, `applyContinuityTransitions`, `plannedLinks`, `projectContinuityLinks`),
`packages/shared/src/{storyboard,project}.ts` (`shot.continuity`, `project.continuityLinks`),
`packages/prompts/src/validators/continuity.ts`, `packages/prompts/prompts/{storyboard,scene-build,
scene-fix}.md`, `packages/engine/src/transitions/{continuity,index}.ts`,
`packages/stages/src/continuity.ts` (+ `stages/storyboard.ts`, `scenes/shot-job.ts`,
`scenes/final-review.ts`), `templates/project/project.json`. Docs: `docs/transitions.md`
("Continuity links").

## Context

What Papi loved most in the world showcases (`docs/worlds/DECISIONS.md`, "What Papi loved" #1) were
match-cuts, not wipes: the camera zooms into a wall calendar and the next shot is the year it shows
(B1 2→3, "masterful"), the room stays while a cartridge is pulled out and another goes in (B1 5 and 7),
the map that carries B2 from place to place. This continuity is the signature of ReelForge worlds
(PLAN.md#13.2) and has to be planned (storyboard), built (both scenes make the object match) and drawn
(the transition) — deterministically and identically in preview and export.

## Decision

- **Storyboard field.** `shot.continuity { kind, object, anchor? }` on the second shot of a link:
  `kind` = `zoom-through` | `shared-object` | `carry-environment`; `object` = the thing both shots show,
  named in both intents; `anchor` = where it sits on screen at the cut (0..1 from the left / top, default
  the centre; for `zoom-through` its place in the first shot, the second opens on it centred).
- **Rendered as transitions of the one engine.** Each kind has a continuity style in the transition kit
  (`continuity-zoom-through` 1 s, `continuity-shared-object` 0.6 s, `continuity-carry-environment` 0.6 s,
  at most half the incoming shot; plain type `crossfade`). After validation the storyboard stage writes
  the linked shot's `transitionIn` from its link (style + anchor as `focus`), so manifest, preview and
  export carry it like any transition. Compositors are pure functions of (A, B, p, focus) that copy only
  A / B pixels (palette-pure, seed unused): zoom-through = A zooms into the anchor, dither swap, B settles
  from a magnified centre; shared-object = B replaces A from the edges in, the object changes last;
  carry-environment = a dithered disc grows from the anchor, then the rest follows.
- **Scenes make the object match.** Both shots of a link get a continuity directive in their scene-build
  prompt and — so a QA or review fix never breaks it — in their scene-fix prompt
  (scene-fix v2): the outgoing shot ends with the object whole at the anchor (and pushes in for
  zoom-through) and keeps `update(t)` valid while the link plays past its end; the incoming shot opens on
  it at the same place and size.
- **Rare by rule.** Validator: `continuity-first` (error: never on the first shot), `continuity-style`
  (error: a continuity style without a link), `continuity-object` (warning: object not named in both
  intents), `continuity-spacing` / `continuity-budget` (warnings: about one per 45 s). The storyboard
  prompt carries the film's budget.
- **Project switch.** `project.json` `continuityLinks` (boolean). Absent = off: the storyboard prompt,
  the scene prompts and the storyboard are exactly as before (fixtures). New projects get `true` from the
  template, like the other direction switches.
- **Report.** The final review adds a "continuity" line: links planned vs rendered (wired and neither
  shot failed).

## Consequences

- Legacy projects and storyboards without links are byte-identical (prompt fixtures, golden frames,
  `scene-fix-legacy.txt`); render goldens `transition-continuity-*` cover the three kinds.
- A link costs nothing extra in Claude turns: the directive rides on the existing build / fix turns.
- No dedicated continuity sound yet (a possible follow-up).
- Worlds (ADR-029) will tune when to link in their own storyboard wording (panel language for Comic,
  inventory for Game B2).

# ADR-025: Characters and mascot per project (PLAN 12.20, part 2a)

Status: accepted (2026-10-04). Code: `packages/shared/src/characters.ts` (schemas, profiles),
`packages/prompts/src/characters.ts` (prompt variables), `packages/prompts/src/validators/
characters.ts` + `mascot-words.ts` (storyboard checks), `packages/stages/src/characters.ts` and
`scenes/source-checks-characters.ts` (stage wiring, scene QA), `apps/desktop/src/renderer/project/
CharacterRows.tsx` (dialog). Docs: `docs/characters.md` ("Project settings: characters and the
mascot"). Builds on ADR-024 (the pack); the on-demand role build is ADR-026.

## Context

Papi wants to choose per project whether people come from the new character pack or stay the
classic hoodie hero, and to pick a channel mascot that Claude gives screen time sensibly: helping
the viewer (pointing, carrying, reacting), never replacing a person the story needs (a doctor, a
historian, a victim, a named or quoted person).

## Decisions

- **Two project fields, absent = as before.** `characters: 'pack' | 'classic'` (absent =
  `classic`) and `mascot: 'none' | 'bulb' | 'screen' | 'fox' | 'bean'` (absent = `none`). New
  projects get the app's `newProjectDefaults` (default `pack` + `none`, the template's values), so a
  channel mascot carries over. The mascot is in effect only with the pack (`projectMascot`); the
  stored choice survives a switch to classic.
- **Conditional prompt sections only.** Storyboard v11, scene-build v11, critic v5 add sections
  behind `castPack`, `mascotId`, `mascotAbsent` and `mascotCheck`; classic + none renders byte for
  byte as before (fixture tests). The sections share the mascot's profile with the UI cards.
- **The storyboard plans the mascot; code enforces the plan.** Each mascot shot carries
  `mascot: { role, action }` with a closed set of impersonal roles. The validator turns the rules
  into errors that cost one repair turn: impersonation (a keyword list EN + PL with prefix entries
  for Polish inflection, quotation marks and speech verbs, capitalised name pairs and honorifics
  in the shot's narration window), overuse (> 30% of the shots, < 12 s between starts) and a
  mascot without a choice; warnings for the hook (first 3 s outside a title card) and long
  absences (> 90 s in films over 3 min). The scene QA checks the source: the planned mascot must be
  called with the project's id (error), an unplanned mascot and the wrong character system are
  warnings.
- **New roles as a storyboard hook.** `newRoles: [{ id, description }]` (kebab case) lists people
  the pack lacks; the checks refuse duplicates and ids of the cast, the mannequin or a mascot. The
  role build (ADR-026) maps the ids to its camelCase role files (`castRoleId`).
- **Preview cards from the kit's golden.** The dialog shows 1:1 crops (130x158 px) of the
  `character-mascots` golden (640x360) shipped as a renderer asset: no new build step, crisp
  pixels, readable at 1280x720.

## Consequences

- Projects made before 2.3.5 and the stage tests (their template copy is classic) are unchanged.
- The keyword heuristics can flag a legitimate shot (e.g. a place name read as a person's name);
  the cost is one repair turn, and the list lives in one data file to tune.
- `reelforge validate` does not run these checks (it does not run the storyboard rule checks at
  all); the storyboard stage does.

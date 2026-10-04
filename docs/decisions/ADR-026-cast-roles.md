# ADR-026: On-demand project roles (`characters/roles`) in the pack's style (PLAN 12.20, part 2b)

Status: accepted (2026-10-04). Code: `packages/kit/src/characters/{project-roles,accessory-extension,
role-errors,role-checks,suggest}.ts`, `packages/shared/src/cast-roles.ts`, `packages/cli/src/{cast/,
commands/cast.ts,commands/cast-preview.ts,project/cast-roles.ts}`, `packages/stages/src/roles/`,
prompt `packages/prompts/prompts/roles.md` (validator `validators/roles.ts`), the manifest field
`castRoles` (engine `runtime.ts`, desktop `project-manifest.ts`, CLI `project/shots.ts`), the export
cache key (`pipeline/src/export/cache-key.ts`). Tests: unit tests next to the code,
`packages/stages/src/roles/roles-stage.test.ts`, `packages/kit/test/render/kit-cast-roles.test.ts`.
Docs: `docs/characters.md`.

## Context

The character pack (ADR-024) has ten cast members and a role-spec builder, but a story regularly
needs someone else (a firefighter, a judge, a courier). Hand-building a person in a scene breaks
the pack's look; a developer adding presets for every video does not scale. Papi asked for roles
built on demand in a style similar to the pack, like project props are (ADR-007).

## Decision

- **A role is data**: `characters/roles/<id>.json` = one role spec of the kit (camelCase id = file
  name) + optional `notes`, tracked in the project's git ("Role <id> built ✓/⚠"). It can only use
  the kit's vocabulary, so it is a sibling of the pack by construction; no code from the project
  runs. The storyboard's kebab ids (`police-officer`) map to camelCase (`castRoleId`).
- **Vocabulary extended once in the kit** (no new goldens; existing output unchanged):
  `peakedCap`, `strawHat`, `overalls`, `robe`, `gavel`, `pitchfork`, `parcel`, so common
  professions (pilot, police, farmer, judge, courier, …) need no extension.
- **Accessory extensions** for the rest: `characters/accessories/<id>.json`, up to 16 boxes on a
  slot (head, torso, back, hand) in the slot's frame, palette swatches/tokens or colour slots only,
  every box inside the slot's envelope and connected to the body part (strict zod schema). Worn
  slots go in `accessories`, the hand slot in `held`. Ids may not shadow vocabulary ids.
- **Loading**: the render manifest carries the file texts (`castRoles: { roles, accessories }`),
  absent without files (manifests byte-identical). The engine parses them with the kit into a
  `ProjectCast`; `kit.cast.person/role/spec('<id>')` resolve project roles by id. An invalid file is
  left out (`problems`) and only a scene naming it gets its errors: a half-written role must not
  break the other shots.
- **Building** (Scenes built, before the props): the storyboard's `newRoles`, and any id a scene
  calls that nobody has (detected in the source after the build turn; no rebuild turn needed).
  A `roles` turn runs on **Sonnet** (permission stage `storyboard`: project edits + reelforge) —
  a spec is data, not code. Builds run one at a time; at most 8 new roles per film.
- **QA by code + critic**: parse (with "did you mean"), spec checks (≤ 4 outfit colours, palette,
  a face, accessories on valid slots), a lineup render through the normal shot path (4 angles + 2
  poses; height within the pack's range ±15 %, not blank, vibe guard, determinism), then Haiku on
  the sheet ("reads as the profession and a sibling of the pack?"), one fix turn. Findings left on
  a valid spec → ⚠, still usable; a spec that never parses → `.reelforge/roles-failed/`.
- **Cache key**: a shot's segment key includes the role files its scene names (all of them when a
  `kit.cast` call takes a computed id) and the accessories those roles name; undefined without
  roles, so old keys stay valid. The preview reloads the video when `characters/` changes.

## Alternatives rejected

- Roles as JS modules like project props: would run model-written code and could drift from the
  pack's proportions; data over the vocabulary keeps the look and the safety.
- Opus for role turns: unnecessary cost for a JSON spec.
- Failing the whole manifest on an invalid role file (as props do): one broken role would stop the
  preview of every shot.

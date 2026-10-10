# Brief 08 — PLAN.md#14.8: project modules `kit-ext/people` and `kit-ext/places` (+ people-preview)

Branch: `phase-14/ccam-people-places`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first (rules). Prerequisites merged to `main`: 14.2 world
skeleton (`packages/kit/src/worlds/c-cam/{index,style,stage}.ts`), 14.4 faces/poses, 14.5 rig
(`.../draw/{rig,contact}.ts`, `Character` type + schema). If missing, stop and say so.

## Goal
Every C-CAM film builds its OWN people and places (grammar rule: always new people, hand-built under
the narration, no generator). Give projects a safe place for them: `kit-ext/people/<id>.js` and
`kit-ext/places/<id>.js`, loaded like the existing project props (`kit-ext/props`), linted for
determinism, cached, available to scenes as `kit.people.<id>` / `kit.places.<id>`, and previewable
with a CLI sheet command.

## Read first
- How project props work end to end: `docs/decisions` (ADR for kit extensions, `rg -n "kit-ext"
  docs packages | head -30`), `packages/cli/src/project/kit-extensions*.ts`,
  `packages/shared/src/render-manifest.ts` (`kitExtensions`), `packages/engine` loader/lint for
  props, `packages/kit` prop registry, export cache key (`packages/pipeline/src/export/cache-key.ts`),
  `reelforge prop-preview` (`packages/cli/src/commands/`), desktop manifest builder
  `apps/desktop/src/main/project-manifest.ts`.
- Character contract: `docs/concepts/c-cam-style/docs/04-CHARACTER_GUIDE.md` §1–§3, §8; the film
  cast files `films/03-apollo-11/js/cast/*.js` for the shape of one person; sets:
  `films/03-apollo-11/js/sets/*.js` for the shape of one place (draw function, bounds, light pool).

## Do
1. Contract + zod schema (packages/shared): `PersonModule` (id, name, `D`, seed, tones,
   `draw(g, env, view, pose, expr, t)` registered through a small `definePerson` helper provided by the
   kit) and `PlaceModule` (id, name, bounds `[w,h]`, `draw(g, env, t)`, optional light pool and
   `collide`/anchor points). Modules are plain JS files without imports that export ONE literal object,
   `export const person = { ... }` or `export const place = { ... }`, which the lint can read (as
   built: `packages/kit/src/worlds/c-cam/modules/contract.ts`).
2. Loader: read `kit-ext/people/*.js` and `kit-ext/places/*.js` in `readKitExtensions` (cli service),
   include in the render manifest (`kitExtensions` kind `people` / `places`), the preview manifest
   builder, `reelforge frames`, export cache key. Limits: count and size like props.
3. Lint: same forbidden-identifier rules as scene lint plus: no `fillText`, no `document`, no
   gradients/filters (grammar), file <= 250 lines; clear errors with the fix.
4. `kit.people` / `kit.places` registries available in scenes of the c-cam world only; unknown id ->
   helpful error listing defined ids.
5. `reelforge people-preview [id]` and `places-preview [id]`: render a contact sheet (6 views x poses +
   14 faces for a person; the place at 3 framings) with the world's stage; PNG output like
   `prop-preview`; works in CLI and the same bytes in the app preview.
6. Tests: schema, loader, lint (good/bad modules), manifest round trip, cache key changes with module
   content, preview renders a non-blank frame (render test with golden for ONE sample person + place
   authored in `packages/kit/examples/c-cam/people/` and `.../places/` — original, simple).
7. Docs: `docs/worlds/README.md` section; a short `kit-docs` topic for the c-cam world's
   `people`/`places` API (keep the kit-docs index < 28 KB test green).

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:render` green; existing styles unaffected;
PR lists the contract (TS types), the file locations, limits and the CLI commands.

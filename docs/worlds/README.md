# Adding a world

A **world** = one Style (palette, tokens, post-fx filter, resolution, fonts, sound palette) + its own A/B/C **looks** + rare breakthrough
scenes (`DECISIONS.md`, `QUALITY.md`). Adding one must not change a single byte for the existing styles: their prompts, kit-docs, catalog and
goldens stay as they are. Contract: PLAN.md#13.1. Code: `packages/kit/src/worlds/` (contract + registry), `packages/kit/src/looks/types.ts`
(`Look.styles`, `Look.experimental`, `LookScope`), `packages/engine/src/presets/registry.ts` (style registry).

## How it works
- `Look.styles: ['<world-id>']` — the look is listed (storyboard roll choice, scene-build and critic prompts, `reelforge kit-docs`,
  `reelforge looks`, catalog) and bound into `ctx.kit` **only while the project's style is that world**. Looks without `styles` (voxel,
  retro-ui, …) appear in every built-in style. Callers that pass no style (`listLooks()`, `kitCatalog()`) never see world looks.
- **A world's style is exclusive** (ADR-029): while it is active only the world's own looks are offered — no voxel, retro-ui or other 2.x
  look, no voxel API / voxel entries / character pack in the catalog and kit-docs. A shot naming no look (or another style's look) builds
  and is judged in the world's first (A-roll) look. The voxel kit stays bound in `ctx.kit` (names reserved) but is never documented there.
- `Look.experimental: true` — bound into `ctx.kit` of its style (so showcase renders work) but never offered to storyboards, kit-docs or the
  catalog. An experimental world must have only experimental looks (`defineWorld` checks it).
- `World.experimental: true` — its style resolves in the engine (`resolveStyle`, the harness) but is not in `STYLE_PRESET_IDS` (style picker,
  `reelforge check`, prompts). `pnpm render:frames -- --preset <world-id> --experimental …` is the showcase render; without
  `--experimental` the render is refused.
- The engine registers the world's `style` (validated with `stylePresetSchema` of `@reelforge/shared`; `id` = world id) next to the built-in
  presets; `fonts` map the text roles `display`/`mono` to engine font ids (today only the two pixel fonts, `display` and `mono`). A world
  with its own lettering (Sketchbook) draws it inside its page template and tells its looks to write all text there, not with `ctx.text`.
- **World-level templates**: the looks of one world may list the very same definition object (Sketchbook's `kit.fx.sketchPage`); it is
  bound and catalogued once, under the first look. Two different definitions with one name still clash.
- **Page-native transitions** are engine compositors with world-prefixed ids (`sketchbook-page-flip`, … in
  `packages/engine/src/transitions/sketchbook/`), found by `findTransition` like the continuity links but never part of
  `TRANSITION_STYLES`, the picker, the wow budget or the kit-docs of the built-in styles; `type: 'wipe'` is their plain fallback.
- **World sound palette** (`packages/stages/src/sound/palettes/<world>.ts`, `world: '<id>'`): its films never mix with the built-in looks,
  so it may reuse their recipes; its page-native transitions sound like themselves (`WORLD_TRANSITION_SFX`). The world's variation budget
  lives in its style preset under the looks' `variationBudget` key.

## Folder layout
```
packages/kit/src/worlds/<world-id>/
  index.ts            defineWorld({ id, label, description, experimental: true, style, fonts, soundPalette, looks: [a, b, c] })
  style.ts            the style preset as a plain object (version 1, id, name, resolution, palette ≤ 32 swatches, every token, dither, …)
  looks/<look-id>/    one folder per look: index.ts = defineLook({ …, styles: ['<world-id>'], experimental: true }), its kit definitions
  traces.ts           the world's human-trace helpers (QUALITY.md §2/§8) used by its looks
styles/<world-id>/    STYLE.md (craft brief inside) + style.json card, when the world stops being experimental
docs/worlds/<world>-v2/  the approved standalone showcase = the visual contract
```
Register the world by adding it to `WORLDS` in `packages/kit/src/worlds/index.ts` (one import; nothing else changes). The test-only world
`packages/kit/src/testing/test-world.ts` shows the minimal shape (never registered).

## Checklist (every world)
1. **Style**: palette (paper/ink/accent families, ≤ 32 colours, no swatch named like a token), every token mapped, text legible on the
   `shadow` plate (WCAG AA) and the plate distinct from `sky`/`ground`/`groundAlt`/`outline` (the checks of `presets.test.ts`), resolution
   that upscales to 1080p by an integer factor, filter (dither/outline/ao/scanlines/vignette) matching the showcase.
2. **Craft brief ≤ 1.5 KB** (QUALITY.md §9) in the looks' `docs` and `STYLE.md`: the §1 tells as a don't-list, the world's own traces as a
   do-list, "write the focal point and the three traces in a comment before the code", the world's deliberate roughness (DECISIONS.md).
3. **References**: 3–4 frames from the showcase (path + one-line critique each) named in the brief.
4. **Guards** (QUALITY.md §8): the world's trace helpers, its critic checklist (`CRITIC_LOOK_RULES` entry per look), text provenance
   whitelist of world labels, accent share.
5. **Golden frames**: render tests per look (`packages/kit/test/render/look-<id>.test.ts`) with `expectVibe(frame, '<world-id>')`; compare
   against the showcase frames before asking Papi.
6. **No-harm test**: the existing fixtures stay byte-identical (`docs/kit-catalog.md`, prompt fixtures, kit-docs index, goldens of the
   existing looks/styles); `packages/kit/src/worlds/worlds.test.ts` and `packages/cli/src/commands/kit-docs-styles.test.ts` show how to prove
   it for every built-in style with the world registered.
7. **Ship**: flip `experimental` off on the world and its looks, add `styles/<world-id>/`, a sound palette, the world's row in Project
   settings, a decision-log line in CLAUDE.md §8.

## Sketchbook: breakthrough scenes (PLAN.md#13.6)
The two showpieces of the showcase (`docs/worlds/sketchbook-v2`, shots 5 and 8) are parameterized methods of the shared
`kit.fx.sketchPage`, so the runtime Claude builds them from a short validated spec instead of hand-coding them per topic. Both are
**rare**: at most one per ~60–90 s of film, each the one showpiece of its shot. Code: `packages/kit/src/worlds/sketchbook/breakthrough/`.
- **`page.popup(spec)`** — hosted by look C (`sketch-loud`). A kraft card taped into the page; the pencil hand lifts its cover (anticipation
  dip, overshoot past upright, settle) and up to **6 elements** stand up from the fold through a small 2.5D camera: `block` (printed band +
  big word, V-fold box), `arm` (a cut-paper sun or disc on a hinged arm on the backdrop), `cutout` (a scissor-cut card with a felt stick figure
  or sun), `tag` (crooked, on a thread), `note` (the maker's pencil note on the floor). `pull: { at }` = the red pen pulls the tab, the arm
  with `swing` leaves its pencilled notch, then a red loop on the empty notch + an arrow along the drift. `camera: { dx, dy }` = how far the
  standing top shifts in parallax while the card opens (the page itself never moves). Built-in traces: compass arc + ring on the backdrop,
  pencil guide the block missed by 3 px, glue tabs and a glue smear, two torn tapes. Template: `packages/kit/examples/sketchbook/c3_popup.js`.
- **`page.strip(spec)`** — hosted by look B (`sketch-graph`, treatment `node-graph/timeline`; a chronology is evidence). A taped paper
  strip of uneven panels under a fixed view; **2–8 events** (`label`, a one- or two-line `note`, optional `year` that spaces them by a
  square-root squeeze, optional `doodle`) are written in order while the left hand drags the strip whenever the next one is out of view
  (two fast back-to-back pulls for a long way, one with an overshoot for a short one); read panels fold into a zigzag pleat stack.
  `highlight` = the event that is the point (written after a ≥ 0.5 s held beat, its note in red — the only red); `until` stretches the
  pace (0.7–1.8× of natural, else a readable error); `pen: 'bic'` for B films; `end: 'now'` = pencil word + paper clip at the strip end.
  Built-in traces: wandering creases, tapes at angles over joins, pencil axis ruled panel by panel with hand-ruled year ticks, a
  graphite thumbprint after the last drag. Template: `packages/kit/examples/sketchbook/b4_strip.js`.
- The writing hand: `SketchPage.addHandScript` (scripted stretches: lifting the flap, pulling the tab) and `addBusy` (another hand works
  the page: the hand leaves, never glides across) keep one hand on the page; strip marks reach the hand track as page-space proxies.

## Sketchbook: one writing hand (PLAN.md#13.6)
Code: `page/hand-queue.ts` (queue), `draw/hand.ts` (track), `draw/hand-room.ts` (where the hand may be).
- **Queue (build time):** every page call (write, figure, arrow, …) is one hand task. A task that starts while the hand is busy more
  than 80 px away (another task, a strip, a pop-up's scripted hand) waits until the hand has finished and travelled there (lift, eased
  glide, ~0.12 s + distance / 1600 px/s) when that slips it by **≤ 0.6 s**; it moves as a whole and the call returns the new `{ at, end }`,
  so chained calls follow it. Otherwise, or with `parallel: true`, it keeps its time. Conflicts go to the task added first.
- **One hand (first frame):** in time order the hand stays with its task until that task is done; marks of another task that started
  meanwhile appear without the hand until it has travelled there. Never two nibs, never a jump between two places.
- **Subject safety** (`keepClear` boxes; figures add theirs): the wrist turns away while drawing, glides bend around a subject that
  is not the target when the speed limit allows, a pause ≥ 0.4 s that would leave the hand on a subject parks it on a clear margin
  spot (or its rest spot), and with `duration: ctx.shot.duration` the hand leaves for its rest spot or off the page in the shot's
  last 0.4 s (the ink finishes by itself). Pure in t, seek-order independent; tests: `page/hand-queue.test.ts`,
  `packages/kit/test/render/sketch-hand.test.ts`.

## Variety: page moments, quota and rhythm (real run Sketchbook 1)
The first real world film used neither breakthrough: the storyboard prompt never mentioned them. Now a world's prompt text carries a
**moment catalog** (`WorldPromptText.moments`, Sketchbook: `packages/prompts/src/worlds/sketchbook-moments.ts`) and the storyboard
writes an optional `"worldMoment"` per shot (`@reelforge/shared` `storyboardShotSchema`, kebab case, absent = plain):

| Moment | Kind | Look | Use when the narration… |
| --- | --- | --- | --- |
| `popup` | breakthrough | `sketch-loud` (C) | turns on a reveal, a twist, the answer to an open question |
| `strip` | breakthrough | `sketch-graph` (B) | runs through dates or steps (a chronology) |
| `flipbook` | moment | `sketch-loud` | races through years or numbers in one breath |
| `envelope` | moment | `sketch-graph` | stacks facts or a calculation into one result |
| `sticky-slap` | moment | `sketch-loud`, `sketch-story` | lands a short verdict or label |
| `torn-page` | moment | any (opens with `sketchbook-torn-strip`) | breaks with what came before |
| `ruler-graph` | moment | `sketch-graph` | compares amounts or shows a trend |

- **Storyboard prompt**: the catalog with its "use when" lines and the film's quota (`storyboardWorldVars(…, { durationS })`).
- **Validator** (`validators/world-variety.ts`, world projects only; legacy byte-identical): `moment-unknown`, `moment-look`,
  `moment-transition`, `moment-quota` (breakthroughs: ≥ 1 from 25 s, ≥ max(1, floor(d/60)) from 45 s, ≤ ceil(d/35)),
  `moment-variety` (≥ 2 kinds once 2 are needed), `moment-spacing` (never adjacent), `moment-repeat` (one kind once per 90 s),
  `moment-run` (no 3 in a row with one moment + roll), `transition-variety` (≥ 3 named page transitions from 25 s) and the
  world's look run (≤ 2 in a row). Numbers: `packages/prompts/src/worlds/variety.ts`.
- **Scene-build / scene-fix** get the exact call of the planned moment (`page.popup`/`page.strip` spec shape and caps, templates
  `c3_popup.js`, `b4_strip.js`, …); the **critic** must see it in the frames (else `off-intent`, note `moment:`).
- **Test drivers only**: `StageSettings.worldQuotaOverride = { minBreakthroughs: 2 }` raises the floor for a short test film (e.g.
  both a pop-up and a strip in 50 s). Never a project field or a default.
- Also world-aware now: the script's surprise beats (page moments, no camera moves), the music moods (Sketchbook: `lofi-chill`,
  `calm-tech` only), repetition control's visual signature (moment + look + paper; a plain page has none) and the reveal-moment
  camera hints (`PAGE_CAMERA_HINTS` / `worldMomentCameraHints`: no orbit).

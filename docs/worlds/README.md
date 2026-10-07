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
- `World.wired` (default `false`; `defineWorld` fills it) — the world has its prompt wording (`WORLD_PROMPTS`, `packages/prompts/src/worlds`)
  and project defaults (`WORLD_PROJECT_DEFAULTS`, `packages/project/src/world-defaults.ts`). An unwired world is render-only: never in
  the app's style lists (even with Settings → Experimental worlds on), refused by `reelforge validate` ("a world still in development"),
  no looks in kit-docs, no world in the stages (`activeWorld`). A world that is not experimental must be wired.
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
7. **Wired**: when the world gets its prompts (`WORLD_PROMPTS` entry) and project defaults (`WORLD_PROJECT_DEFAULTS` entry), set
   `wired: true` in its `defineWorld` and re-read its one-line `STYLE_DESCRIPTIONS` entry (`apps/desktop/src/shared/style-choices.ts`);
   `packages/stages/src/worlds.test.ts` then requires both entries (and that no registered world is left unwired). Before that the app and the runtime Claude never see the world.
8. **Ship**: flip `experimental` off on the world and its looks, add `styles/<world-id>/`, a sound palette, the world's row in Project
   settings, a decision-log line in CLAUDE.md §8.

## Sketchbook: breakthrough scenes (PLAN.md#13.6)
The two showpieces of the showcase (`docs/worlds/sketchbook-v2`, shots 5 and 8) are parameterized methods of the shared
`kit.fx.sketchPage`, so the runtime Claude builds them from a short validated spec instead of hand-coding them per topic. Both are
**rare**: at most one per ~60–90 s of film, each the one showpiece of its shot. Code: `packages/kit/src/worlds/sketchbook/breakthrough/`.
- **`page.popup(spec)`** — hosted by look C (`sketch-loud`). A **creative toolkit, not a template**: every pop-up is original and the
  pull must cause a **meaningful** motion (in film 2 nobody knew what the pull did). A kraft card taped into the page; the pencil hand
  lifts its cover (anticipation dip, overshoot past upright, settle). Up to **8 pieces** with optional `id`s: standing on the fold
  `block` (band + big word) and `cutout` (felt figure or sun + word), each may stand up on its own word (`at`, staggered rise with
  seeded variance); on the backdrop `arm` (sun or labelled disc on a brad), `card` (paper/kraft/sticky with a word or drawing),
  `flap` (a door on a hinge left/right/top/bottom over the pieces listed before it), `gauge` (thermometer/tank with tick labels),
  `wheel` (dial or gear; the label under the fixed top pointer is read), `counter` (a number), `window` (a strip of items sliding
  behind an opening), `scale` (two ends, ticks, a pointer); static `tag` and `note`. **`intent`** (required) = the claim the motion
  shows. **`pull`** = `{ at, tab: tab|ribbon|knob|lever, side: left|right|bottom, dur, ease (back = overshoot), motions, drive,
  focus, callout }`: the red pen pulls and the pull's progress p in [0, 1] drives the pieces. `motions: [{ target: id, to: { prop },
  from?, span: [p0, p1], ease, arc, vary }]` (chain and stagger with spans; a motion over the whole pull follows the tab's press-in
  and overshoot) on the props of the target's kind: block/cutout `rise` (0 = flat on the base) and `slide`; arm and wheel `angle`;
  card `x`, `y` (card px, y up), `rotate`, `scale`, `show` (dissolve in/out); flap `open`; gauge `level`; counter `value`; window
  `index`; scale `value`. `drive: (p, t) => ({ id: { prop: n } })` is a pure callback for what spans cannot say. The red pen then
  marks what moved: `callout: 'loop'` (default, round `focus` or the first target), `'trail'` (arrow along the move + loop),
  `'notch'` (an arm: loop on the notch it left + arrow along the drift), `'none'`. The schema rejects a pull that moves nothing, a
  motion on a piece that is not on the card or on a property its kind does not have, a drive returning unknown ids/props, a disc
  without a label, a card without a word or drawing. Inspiration (never the same mechanism twice in a film; invent the one that
  shows your claim): `c3_popup.js` (the reference: the sun swings off its notch), `c4_popup_gauge.js` (a quarter day a year fills a tube, a
  counter runs yr 1 → yr 4, FEB 29 springs up), `c5_popup_flap.js` (a door after THU 4 opens on FRI 15), `c6_popup_window.js` (a
  lever runs a pointer 325 → 1582 while the date slides 21 → 11 MAR behind a window), `c7_popup_wheel.js` (a gear turns
  1582 → 1752, a drive callback runs the year counter with it, BRITAIN dissolves in). Built-in traces: compass arc + ring for a swung arm, pencil
  guides, glue tabs and smear, two torn tapes. Tests: `breakthrough/breakthrough.test.ts`, `test/render/sketch-popups.test.ts`.
- **`page.strip(spec)`** — hosted by look B (`sketch-graph`, treatment `node-graph/timeline`; a chronology is evidence). A taped paper
  strip of uneven panels under a fixed view; **2–8 events** (`label`, a one- or two-line `note`, optional `year` that spaces them by a
  square-root squeeze, optional `doodle`) are written in order while the left hand drags the strip whenever the next one is out of view
  (two fast back-to-back pulls for a long way, one with an overshoot for a short one); read panels fold into a zigzag pleat stack.
  `highlight` = the event that is the point (written after a ≥ 0.5 s held beat, its note in red — the only red); `until` stretches the
  pace (0.7–1.8× of natural, else a readable error); `pen: 'bic'` for B films; `end: 'now'` = pencil word + paper clip at the strip end (only when the narration reaches today; the text guard flags a "now" on an old timeline).
  Built-in traces: wandering creases, tapes at angles over joins, pencil axis ruled panel by panel with hand-ruled year ticks, a
  graphite thumbprint after the last drag. Template: `packages/kit/examples/sketchbook/b4_strip.js`.
- The writing hand: `SketchPage.addHandScript` (scripted stretches: lifting the flap, pulling the tab) and `addBusy` (another hand works
  the page: the hand leaves, never glides across) keep one hand on the page; strip marks reach the hand track as page-space proxies.

## Sketchbook: one writing hand (PLAN.md#13.6, real runs 2 and 3)
Code: `page/hand-queue.ts` (call-time queue), `page/hand-plan.ts` (first-frame plan), `draw/hand.ts` (track),
`draw/hand-room.ts` (where the hand may be), `draw/appear.ts` (ink without a hand), `page/hand-check.ts` (the invariants).
- **Ownership:** every stroke-drawn mark has the hand's nib on it; nothing writes itself stroke by stroke. The hand draws the key
  things (figures, the hero mark); small labels, numbers and words may **appear by themselves** while it works elsewhere:
  `appear: 'bloom'` (the ink soaks in pixel by pixel, a small wave across the word), `'pop'` (all at once), `'type'` (letter by
  letter). `parallel: true` = appear `bloom`. A mark the scene sets `held: false` on a page with the hand appears too. A task
  that loses the hand (below) soaks in **whole at once** on its own time (a bloom without the wave): never letter by letter in
  writing order, which reads as ink writing itself (run 3, s03 red WAVE).
- **Anchor order:** the hand takes the tasks in the order of their own times (as the scene asked them): a task never starts
  before one timed earlier, and a later task never displaces one whose time has come (run 3, s04: the base fill on "fifteen"
  was drawn after the hero top block).
- **Hero:** `hero: true` on a mark or figure (default: the largest in-shot `page.write`, the later one on a tie) goes first among
  tasks timed at the same moment and waits for earlier tasks **≤ 0.6 s**; an earlier task that would push it further (it could
  only get the hand after the hero) appears by itself on its own time instead of being reordered behind it.
- **Queue (build time):** every page call is one hand task. A task that starts while the hand is busy more than 80 px away (on a
  task timed no later, a strip or a script) waits until the hand has finished and travelled there (~0.12 s + distance / 1600
  px/s) when that slips it by **≤ 0.6 s**; the call returns the new `{ at, end }`. **Plan (first frame):** what is still in
  conflict waits too (the breakthrough choreography keeps its time), except secondary text that would wait more than 0.6 s: it
  appears on its own time (see Ownership); the plan may still move a returned time. A task that
  starts before the shot (`at < 0`) is already on the page: done by t = 0, no hand. A task running into the shot's last 0.4 s is
  written faster to end before it when that keeps ≥ 40 % of its pace; else the hand finishes it, then leaves.
- **Motion:** glides at hand speed; a pen swap goes out and back only when there is time, else the hand glides over; the wrist
  turns at most 200°/s (no flips); one hand on the page at a time (while a strip's left hand works, the writing hand is off).
- **Subject safety** (`keepClear` boxes; figures add theirs): the wrist turns away while drawing, glides bend around a subject that
  is not the target when the speed limit allows, a pause ≥ 0.4 s that would leave the hand on a subject parks it on a clear margin
  spot (or its rest spot), and with `duration: ctx.shot.duration` the hand leaves for its rest spot or off the page in the shot's
  last 0.4 s, or already 0.15 s after its last mark (and any scripted stretch) when that is earlier: it does not park on the
  subject (run 3, s09/s11); the exit starts fast (ease-out over 0.35 s). Pure in t, seek-order independent.
- **Invariants** (`checkHand`; tests `page/hand-check.test.ts` over every example, the film-2 and film-3 scenes in
  `packages/kit/test/fixtures/sketchbook-run2`/`-run3` and seeded worst cases): ≤ 1 hand; every non-appearing mark being drawn has
  the nib within 90 px of its tip; a glide moves ≤ 180 px per 1/60 s; the wrist turns ≤ 12° per 1/60 s; hand-drawn tasks start in
  anchor order; a task without the hand appears whole from one moment.

## Sketchbook: lettering pace (real run 2)
`page.write` without `until` is brisk (a 12-letter word in ~1–1.2 s at cap heights ≤ 40, bigger letters a little slower, the
uneven seeded gaps kept); `speed` multiplies it (0.5–2), `quick: true` is the label pace (~1.7× faster); `until` keeps the old pace
inside its budget. Never letter text with `page.stroke` (a home-made glyph table also dodges the text-provenance guard):
`strokeLetteringFindings(source)` (exported by the kit) flags glyph tables and per-character stroke loops for the stages guards.

## Sketchbook: look A layouts (real run 2)
The story pages of film 2 all shared one grammar (small figures bottom-left, a label on top). `kit.fx.sketchPage({ layout })` +
`page.slots()` give four composition presets (seeded nudges, never a grid): `hero-left` (figure large centre-left, big label beside
its head, the thing at its hand), `facing` (two figures facing across the page, the label above the gap), `tall-diagram` (a tall
figure left, a diagram filling the right, its label under it), `wide-strip` (three figures along one ground, title and caption).
Slots: `hero`, `figures`, `label`, `note`, `thing` box, `ground`. **Rule: the hero figure is ≥ 25 % of the page height** (≥ 135 of
540 px). Template `packages/kit/examples/sketchbook/a4_layouts.js`; render test `packages/kit/test/render/sketch-layouts.test.ts`.

## Sketchbook: open vocabulary (PLAN.md#13.15a, phase 1: kit)
The showcase is the style grammar, not the content: a forest film draws trees, a ranger, a deer, a map - drawn per film in the notebook
hand (DECISIONS.md "PRINCIPLE"). Code: `packages/kit/src/worlds/sketchbook/vocab/` + `page/api-vocab.ts`. Everything is one hand task like
`page.figure` (drawn by the hand, or `appear`), seeded, palette-pure, rough on purpose (loops overlap, lines bow, corners are missed, crayon
lands out of the lines); errors name the part and the field.
- **`page.doodle({ box, parts }, place)`** - the drawing DSL in local units: `blob`, `circle`, `rect`, `poly`, `line` (`sharp`, `arrow`),
  `arc`, `dots`, `rays`, `hatch`, `scribble`, `zigzag`, `wave`; each with `nib` (felt, fine, crayon, ballpoint, marker, pencil, red),
  `color`, `width`, `fill` + `shade` (hatch, dense, light, scribble). Place: `x, y, h | w` (both = stretch), `anchor` (bottom, centre,
  top-left), `flip`, `rot`, `at`, `until` (never squeezed below half its pace: the hand must travel), `attach` (a joint / head frame).
- **`page.spot({ rows, legend, px }, place)`** - tiny icons as rows of characters, legend -> notebook inks; one hand dab per run.
- **`page.draw(kind, { type, color, action, count, shade, plain, bold, ...place })`** - parametric generators (`vocab/gen/`): beast (14
  species, stand/walk/run/sit), bird, fish, sealife, insect, reptile; tree, bush, grass, flower, cactus, seaweed, mushroom, leaf;
  backdrops hills, mountains, sea, dunes, forest, skyline, room, sky, space, ground, road, river (page px `w x h`, pale, 1.8x pace);
  building (18 types), vehicle (15), object (31), tool (16), instrument (17), icon (33, never letters), effect (16). Non-backdrop drawings
  are fitted, so `h` is the drawing's own height; per-type default heights; `hero` = bold outline. Red crayon is never a default fill
  (red is the correction ink).
- **`page.person({ action, face, mood, body, clothes, hat, hair, skin, holds, ... })`** - the stick figure with 11 poses, 8 moods, stick or
  blob body, 9 clothes, 12 hats, 9 hair styles, 4 skins, a held tool/object/instrument type or prop (at its grip). **`page.crowd`**.
- **`page.diagram(kind, spec)`** - callout, timeline, map (route, red X, places, compass), bars, line, pie, venn, flow, stack, cutaway; built
  from the page's own methods on the diagram's own clock; structure by the hand, small labels bloom in, `highlight` = the one red mark.
- **Composition**: five more `layout` presets with another vertical structure - `top-down-map`, `close-up`, `landscape` (`sky` slot),
  `two-column` (`columns` slots), `big-number` - the hero (figure, map, object) is still ≥ 25 % of the page height.
- **The film's own things**: `page.defineFigure(id, look)` -> `person({ like: id })`; `page.defineProp(id, { doodle } | { spot } |
  { draw: kind, ... }, + h)` -> `use(id, place)`; seeded by the id, so the same ranger in every shot. Project files
  `assets/sketchbook/<id>.json` (or `.js` exporting the same object) `{ version: 1, id, kind: figure|prop, description, spec }` reach the
  page as `sketchPage({ library })`; `parseSketchAsset` / `checkSketchAssets` validate them, `sketchAssetFindings(source, ids)` flags ids
  a scene uses that nobody defined (exported by the sketchbook module; loading the files and the validator wiring are phase 2).
- **Examples / tests**: `packages/kit/examples/sketchbook/open/o1_forest.js` … `o6_city.js` (forest, ocean, space station, medieval village,
  desert, city; built only from the open layer), render test `packages/kit/test/render/sketch-open.test.ts` (goldens
  `look-sketchbook-open-*`, contact `out/contact/look-sketchbook-open.png`, 64 px strip `out/contact/sketch-open-thumbs.png`), unit tests
  `vocab/vocab.test.ts` (DSL, generators, silhouette coverage), `page/page-vocab.test.ts`, the hand invariants over every example.

## Variety: page moments, quota and rhythm (real run Sketchbook 1)
The first real world film used neither breakthrough: the storyboard prompt never mentioned them. Now a world's prompt text carries a
**moment catalog** (`WorldPromptText.moments`, Sketchbook: `packages/prompts/src/worlds/sketchbook-moments.ts`, Comic:
`comic-moments.ts`, see "Comic: wiring", Game B2: `game-b2-moments.ts`, see "Game B2: wiring", Game B1:
`game-b1-moments.ts`, see "Game B1: wiring") and the storyboard
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

## Comic: the page compositor (PLAN.md#13.3 part a, ADR-032)
Code: `packages/kit/src/worlds/comic/` (experimental). Visual contract: `docs/worlds/comic-panels-v2/` (shots 1, 2, 6 ported
as `packages/kit/examples/comic/a1_hook.js`, `a2_descent.js`, `a3_squeeze.js`; goldens `look-comic-story-*`).
- **One page per shot**: `kit.fx.comicPage({ seed, anchor })`, 640x360 index raster painted for every t (paper -> panels ->
  lettering), palette-pure (22 print inks, `dither.spread: 0`). No engine change: panels are masks in one framebuffer.
- **Panels**: `page.panels(layout, { weights, mirror })` (`splash`, `2-up`, `strip`, `3-up-l`, `4-grid`, `4-l`, `splash-inset`;
  hand-ruled, leaning uneven gutters, offset rows, seeded) or `page.panel(quad | (t) => quad)`; at most 5 at once.
  Per panel: `draw((g, t) => ...)`, `enter({ at, kind: cut|slam|slide|pop, rough })`, `exit(at)`, `morph(quad, { at, dur })`
  (gutters closing), `camera([{ at, x, y, zoom }])` (camera = panel moves), `clock({ offset, rate, hold })`, `toPage(x, y, t)`.
- **The painter's `g`**: fills on `g.plate` (printed 1-2 px off register, seeded per panel), ink on `g` (`g.ink` boils at
  10 fps); `g.tone(ink, level | (lx, ly) => level, { on })` halftone, `g.dither`, `g.layer`, `g.clip`, `g.blob` (one-outline
  silhouettes: hands, gloves), `g.speedLines` (stop before the subject), `g.trail`, `g.text`, `g.bigLetter`, `g.ground`,
  `g.digits`, `g.rnd(key, i)`.
- **Page**: `camera([...])` (reads the page like an eye), `shake(at)`, `press()` (plates Y, C, M, K land one by one),
  `balloon(text, { kind: speech|radio|thought, tail, dots })`, `caption`, `sfx(word, { beats, angles, rise })` (letters slam on
  uneven beats and may break the frame), `note` (pencil margin question), `arrow`, `loop`, `tick`, `strike`, `highlight`,
  `thumbprint`, `smudge`, `coffeeRing`, `draw` (free page layer), `util` (seg, track, pop, rnd).
- **Fonts**: Inkhand (lettering) and Forge Display (onomatopoeia) as own CC0 glyph tables in the kit; never `ctx.text`.
- Extras for every look: `page.stamp(text, { x, y, at, angle, color })` (worn rubber stamp + a page hit), `caption(..., { type })`
  (lettered in), `page.draw(fn, { z })` (a drawing among the panels), `g.text(..., { reveal, slant })`, `g.standing(text, ...)` (block
  letters standing in the picture), `page.util.torn(...)` (a torn cutaway outline).

## Comic: looks B and C, breakthroughs, transitions, sound (PLAN.md#13.3 part b)
- **Look B `comic-info`** (B roll): cutaways, charts as panel art, codes slammed like sound effects, a ticked checklist, stamps,
  captions; templates `b1_cutaway.js` (shot 4), `b2_checklist.js` (shot 7, now ONE accent: the codes print paper-white, the
  yellow GO highlight is the point). **Look C `comic-loud`** (C roll): the near-empty pause panel, onomatopoeia breaking the frame,
  a slammed panel, the line lettered large; templates `c1_pause.js` (shot 8), `c2_landed.js` (shot 10), `c3_contact.js` (new: a
  panel slams in past the margin, CONTACT across both panels). Goldens `look-comic-info-*`, `look-comic-loud-*`.
- **`page.flashback(spec)`** (hosted by look B; a toolkit, never a template): the past as an older print job - the `SEPIA` remap
  of the page inks (brown key, one tan tint, yellowed stock; palette-pure) and a coarser screen rotated ~30 degrees, one tint plate
  1 px off. `intent` (required, the claim), `when` (time-stamp caption, lettered in), 1-5 `beats` `{ at, draw: (g, t, [w, h]),
  weight, caption, enter }` revealed panel by panel in narration order (beat-local px), `cover: 'page'` (the whole page re-inked,
  aged edge, foxing, the coming beats pencilled in when it opens the shot) or `'strip'` (a torn strip pasted crooked over the
  present page, which stays in colour; it slides or drops in and leaves at `until`), `arrange: 'rows' | 'row' | 'stair' | 'pile'`,
  `box`, optional `stamp` (the only red of the past). Readable errors: no intent, > 5 beats, beats out of order or < 0.15 s
  apart, `until` before the last beat has held 0.4 s, a box off the page. Inspiration: `f1_flashback_1961.js` (page + rows +
  stamp), `f2_flashback_bug.js` (a torn strip of 1947 over today's screen).
- **`page.spread(spec)`** (hosted by look C): the frame becomes two pages, one picture `art` across the fold, a spine crease.
  `assemble: 'merge'` (panels that turn out to be one picture: `pieces` grid/columns/halves, gutters close on their own beats,
  register offsets go to 0, borders thin, the margin slides off, the picture grows to bleed), `'unfold'` (the book opens from
  the spine, the lifted page edges flatten) or `'pull-back'` (a small panel on `focus` whose camera pulls back to the spread);
  `delay`, `dur`, up to 3 `insets` (only after it is whole), `beats` (narration landing). **Hold rule** (the 6.5 s silence of
  the showcase, DECISIONS.md): between the finished spread and `until` (default `comicPage({ duration })`) no gap > 4 s without a
  beat, inset, note, balloon or panel - checked on the first frame. Inspiration: `s1_spread_tranquility.js` (merge, the hold
  trimmed to 2.5 / 1.5 / 1.5 / 1.4 s), `s2_spread_summit.js` (unfold + an inset). Unit tests `breakthrough/breakthrough.test.ts`.
- **Panel-native transitions** (`packages/engine/src/transitions/comic/`, world `comic`, `type: 'wipe'` fallback, `focus` used):
  `comic-page-turn`, `comic-page-back` (into a flashback), `comic-gutter-wipe` (cut along a leaning gutter, halves pulled apart),
  `comic-panel-zoom` (push in, the next page pops up as an inset at the focus and grows: a match cut through a panel),
  `comic-panel-slam`, `comic-ink-bleed` (out of a flashback). Goldens `transition-comic-*` (`transition-comic.test.ts`).
- **Sound palette `comic`** (`packages/stages/src/sound/palettes/comic.ts`, `world: 'comic'`): page flips and slides, paper
  rustle, felt-pen lettering, pencil, scissors, and the whiteboard's `board-tap` knock for stamps, slams and onomatopoeia (no new
  synthesis); 2-3 candidates per busy slot; each comic transition has its own sound (`COMIC_TRANSITION_SFX`).
- **Known**: the front-view Eagle (s1) can read like a face - kept, it is the showcase Papi approved. Beat/inset content is not
  rotated with a tilted strip or pile clipping (kept small: <= 1.8 / 5 degrees).

## Comic: wiring (PLAN.md#13.3 part c)
Comic is **wired** (`wired: true`): offered with Settings → Experimental worlds on, like Sketchbook.
- **Prompts** (`packages/prompts/src/worlds/comic.ts`): film, brief, rolls (A story page `comic-story`, B information page
  `comic-info`, C loud page `comic-loud`), rhythm, panel-native `transitionIn` (style + `focus`), camera (the reader's eye,
  no orbit), interrupts (`look-switch` only), marks/annotate (all lettering on the page, never `ctx.text`/`ctx.annotate`),
  motion (one `comicPage` per shot, panel size = importance, fast-fast-pause), craft brief (≤ 1.5 KB, QUALITY.md §6 as the
  do-list), critic medium/style/vibe/checklist, continuity wording, surprise beats. Exact kit calls in
  `comic-snippets.ts`, run through the real kit by `packages/stages/src/comic-snippets.test.ts`.
- **Moment catalog** (`comic-moments.ts`), checked by the generic variety validator (`validators/world-variety.ts`; the quota
  repair message names each breakthrough's `cue`):

| Moment | Kind | Look | Use when the narration… |
| --- | --- | --- | --- |
| `flashback` | breakthrough | `comic-info` (B) | goes back to where something came from (an origin, a cause, "years earlier") |
| `spread` | breakthrough | `comic-loud` (C) | lands the big picture (an arrival, the scale of a place, the machine as a whole) |
| `pause-panel` | moment | `comic-loud` | falls silent right before a twist, a verdict or an arrival |
| `impact-break` | moment | `comic-loud`, `comic-story` | lands a hit, a touchdown, an alarm |
| `cutaway` | moment | `comic-info` | explains how something works inside |
| `checklist` | moment | `comic-info` | weighs conditions or options toward a verdict |
| `big-line` | moment | `comic-loud`, `comic-story` | speaks the one line the film turns on |
| `squeeze` | moment | `comic-story` | tightens: time runs out, pressure builds |

  Flashback and spread are toolkits, never templates: `intent` required, inspirations f1/f2 and s1/s2, never the same
  cover + arrangement (flashback) or assembly (spread) twice in a film.
- **Guards** (`packages/stages/src/slop/world-labels.ts` `COMIC`): traces = `thumbprint`, `smudge`, `coffeeRing`, `note`,
  `arrow`, `loop`, `tick`, `strike`, `highlight`, `stamp`, `press`, `rough`, `pencil` (1 each), seeded `rnd`/`range` (1 each at
  most), `flashback`/`spread` (3); options `rough: true`, `tilt`, `slant`, sfx `angles`/`rise`. Text provenance reads
  `caption`, `balloon`, `sfx`, `note`, `stamp`, `g.text`, `g.standing`, `g.digits`, `g.bigLetter` and a flashback's `when`;
  sound words (`CLANG`, `BEEEP`, …) are free only in `sfx`/`bigLetter`; labels `MEANWHILE`, `LATER`, `EARLIER`, `FULL`, `EMPTY`.
  `slop/breakthrough-intent.ts`: a flashback/spread without an intent, with a generic one or one the narration and research never
  make (< 2 known content words) → ⚠; the final review flags a repeated mechanism or intent in a film. Calibration: 0 findings on
  the 12 comic templates (with the showcase narration + notes) and the 36 comic goldens; 24/25 planted fakes caught
  (`slop/comic-detection.test.ts`). Known blind spot: the clutter count sees a comic page as 1-3 components (the inked panel
  borders join every mark), so clutter inside panels is not measured (backlog: per-panel counting).
- **Project defaults**: `WORLD_PROJECT_DEFAULTS.comic` = continuity links on, anti-slop guards on, mixed looks, no pack or
  mascot (640x360 comes with the style preset, 30 fps with the template). Music moods `calm-tech`, `tense-investigation`,
  `lofi-chill` (`WORLD_MOODS`); critic look rules `CRITIC_LOOK_RULES['comic-*']`; `reelforge kit-docs` lists `comicPage` and the
  three looks with the experimental switch on.

## Comic: open vocabulary (PLAN.md#13.15a, phase 1: kit)
The showcase is a style reference, not a catalogue (DECISIONS.md "a world is a style GRAMMAR"). Code:
`packages/kit/src/worlds/comic/art/`; examples `packages/kit/examples/comic/open/o1-o6` (a subfolder on purpose: the
stages' comic slop calibration reads `examples/comic/*.js` with the Apollo narration).
- **Audit (before)**: the kit itself drew only topic-neutral grammar (lettering, stamps, flashback/spread toolkits) plus
  three showcase leftovers: `g.ground` (Moon craters, shots 1/2/8), `g.digits` (the DSKY display), `g.standing` (the spread
  title). Every figure and prop was free-form painter code inside a template: Eagle LM (a1-a3, s1), the crew from behind
  (a1/a2), the DSKY (a1/a2/b1), Bales (a2), boulders and gloves (a3, c2, s1), the LM shadow (c1), the 1961 hall and desk
  (f1), the Mark II relay and logbook (f2), the Everest massif (s2). Nothing for a forest (trees, plants, animals, a sky
  other than space), an ocean (water, waves, sea life), a space station (modules, Earth, suits), a medieval village
  (buildings, period clothes, horses, carts), a desert (dunes, cacti, reptiles) or a city (skyline, traffic, crowds, signs).
- **`page.art.<generator>(g, options)`** (zod, readable errors listing the valid values, seeded, animated on the panel
  clock, palette-pure): person (9 poses, 6 expressions, 5 builds, skin, 7 hairs, 11 hats, 7 outfits, 18 tools), crowd
  (flat back rows), animal (13 species presets, 7 poses), bird (11), fish (fish, tropical, shark, eel, whale, ray,
  anglerfish, jellyfish, crab, octopus), insect (8), reptile (5), tree (6 kinds x 4 seasons), bush, grass, flowers,
  cactus, seaweed/coral, sky (8 kinds; sun, moon, stars, clouds), land (10 grounds), hills/peaks, sea, dunes, forest rows,
  skyline, interior (room, station module, stone hall, cabin), space (Earth, Moon, Mars, ringed), backdrop (12 presets),
  building (13), vehicle (15), object (43, each drawn as its defining features: the skull has sockets, nose hole, teeth),
  icon (22), chart (bar/line/pie, values from the narration), map, sign (lettered), effect (16). Every part is drawn by
  `Sketch` in the grammar: colour plate off register, boiled ink outline heavier on the silhouette, halftone shade from
  the left light, hatching; three value steps (fill, shade, ink). `size: 0` draws nothing (grow from nothing safely).
- **Authoring DSL**: `art.shape(g, parts, { x, y, scale, flip })` - JSON parts (`ellipse | rect | poly | capsule | line |
  dots | sprite | use | gen`, fill, shade, hatch, outline, wobble; model units, 0,0 = where it stands); `art.sprite(g, {
  rows, legend, px })` - ASCII spot art onto the 22 inks, grown ink outline. Caps: 80 parts, 128 points, `use` depth 4,
  sprites 64x64 with 16 legend entries.
- **Registry**: `art.defineProp/defineCharacter/defineBackdrop(id, spec)` + `art.draw(g, id, options)`; a spec is exactly
  one of `parts`, `sprite`, `gen` (a generator preset, per-call knobs merged: `art.draw(g, 'ranger', { pose: 'walk' })`),
  `layers` (backdrops) or `draw` (JS asset files only). Ids kebab case, never a generator name, <= 64 per page; a
  character must be a creature generator, layers only for backdrops.
- **Asset files**: `assets/comic/*.json` (or `.js` exporting `comicAssets`) `{ version: 1, world: 'comic', props,
  characters, backdrops }`; `art.load(file)`; `parseComicAssets(value, file)` returns every problem at once;
  `unknownComicArtIds(sceneSource, knownIds)` lists drawn ids that neither the files nor the scene define. Example:
  `examples/comic/open/assets/comic/forest.json` (exactly what o1 loads, unit-tested). Loading the project's files into
  a shot is phase 2 (stages/CLI); until then a scene passes the file's content to `art.load`.
- **Layout by beats**: `art.suggestLayout(weights)` (1 splash; 2 `2-up`, or `splash-inset` when one is 2.5x; 3 `strip`,
  or `3-up-l` with a dominant first/last beat, mirrored when last; 4 `4-grid`, or `4-l` with a dominant first/last; 5+ =
  a second page) with a `why`; `page.layout(beats, { backdrop, reveal })` builds the panels in beat order. `reveal: 'page'`
  (default): every panel shows its establishing backdrop from frame 0 (overscanned so a panel camera never uncovers
  paper) and its subject - beat `draw` and any later `panel.draw` - arrives on the beat. `reveal: 'beats'`: panels enter
  on their beats (beat `enter`) over pencil roughs. A beat with nothing to draw is an error on the first frame;
  backdrops are validated at build time. `page.audit({ until })` lists panels that show (almost) one flat ink for > 0.6 s.
- **Examples** (each only `page.art` + `page.layout` + lettering; goldens `look-open-comic-<topic>-t<t>`, render test
  `test/render/comic-open.test.ts`, contact sheet `packages/kit/out/contact/look-open-comic.png`; QUALITY.md §7 by the
  author, one honest pass):

| Example | Look | Layout | Built from | §7 | Weakest |
| --- | --- | --- | --- | --- | --- |
| o1 forest | A | 3-up-l | asset file: ranger, red deer, woodpecker, fern + bark (parts), pine-dawn (layers) | 16 | sun and sfx both yellow; the deer panel is short |
| o2 ocean | B | strip | water column + the deep (backdrops), anglerfish/jellyfish presets, a lettered depth sign | 15 | the deep panels are dark and bare until the fish arrive; W reads as N in the caption |
| o3 station | A | 3-up-l mirrored | astronaut preset, station + Earth, module interior | 16 | the close-up astronaut is a white blob; the face barely reads |
| o4 village | A | 4-l | goose (recoloured duck preset), baker preset, market square, crowd, cart + horse, bell | 18 | three accents (red roofs, orange dusk, yellow DONG) |
| o5 desert | C | strip, reveal beats | hiker preset, saguaros, vulture, canteen held upside down, rattlesnake | 17 | dunes are magenta-heavy; the red tongue is lost in them |
| o6 city | B | 4-grid | traffic light (two sprites), zebra (parts), crowds, bus, skyline | 15 | four equal panels: weak hierarchy |

  **Thumbnail (64 px wide, QUALITY.md §7)**, subjects drawn ~58 px in 64 px cells: reads at a glance - skull (sockets,
  nose, teeth), key, clock, campfire, book, chest, bell, person, astronaut, deer (antlers), horse, cow (spots), camel
  (hump), sheep (wool), anglerfish (lure + teeth), shark (fin), jellyfish, rattlesnake (rearing, banded), turtle,
  woodpecker, pine, palm, saguaro, castle, lighthouse, station, rocket. Weak: whale (reads as a big fish: the side-view
  flukes look like a fish tail), cart without its horse (a table on wheels), flask (needs its strap to read). Whole pages
  at 64 px are only colour blocks, as any comic page.

## Game B2: raycaster, level format, HUD (PLAN.md#13.4 part a)
World `game-b2` (experimental), code `packages/kit/src/worlds/game-b2/`, showcase `docs/worlds/game-hud-b2-rpg-v2/`.
- **Style**: the showcase's 32 colours, 640x360 (x3 = 1080p), post dither off (spread 0): the raycaster dithers its own
  light and fog levels (4x4 Bayer) through one Doom-style colormap per room mood, so every pixel is an exact palette index.
  Variation budget `game-b2` is neutral (places differ by their level). Sound: the world's own palette `game-b2` (part b).
- **Renderer** (`ray/`): textured-column raycaster on a 320x180 index buffer, doubled into the 640x360 screen; floors and
  ceilings per pixel, low walls with caps (counter, cubicle), sliding doors, depth-tested billboards, per-room lights
  (a light lights only its own room; an opening door spills the bright room into the dark one). Textures and sprites are
  seeded pure functions, cached. Measured on the dev machine (Node, warehouse + hand + HUD, 640x360): **2.8 ms/frame avg,
  p95 3.5 ms, max 5.5 ms** (`view/world.test.ts` logs its best batch, slower under vitest's module transform, and allows
  30 ms for slow CI runners).
- **Level format** (`level/schema.ts`, `checkLevel`): `{ name, mood, floor, ceiling, grid: ['#####', '#...#', ...], legend,
  lights, sprites }`. Grid <= 32x32, closed border, one character per cell (`.`/space = open with the level's floor and
  ceiling); legend entries are walls `{ wall, label, chalk, count, pinned, crossed, height, cap }`, doors `{ door: true }`
  (walls on two opposite sides) or open cells `{ floor, ceiling, flicker, mood }` (`mood` makes a room: a dark corridor
  opening onto a tungsten office). <= 12 lights `{ id, pos, z, power, radius, flicker: none|tube|bulb, bulb }`, <= 40
  sprites `{ id, sprite, pos, z, w, h, label, band, person, seed, tilt }` (sprite kinds: sand-pile, carton, pallet, desk,
  clerk, sign, exit, boxes, item, card, bin). Errors name the field or grid row (`grid row 1: "x" at x=2 is not in the
  legend`, `sprites[0] (clerk): pos [0.5, 0.5] is inside a wall cell`, label width per sprite kind). Built-in levels
  `office` and `warehouse` (ported from the showcase map, `stencil` fills their carton/sign word).
- **`kit.fx.b2View`**: level + camera path (keys `{ at, x, y, yaw, pitch, eye, ease }`, uneven seeded strides, head-bob,
  breathing when still) + timed events: `open` (door), `switchOn` (light clicks on with two stutters), `act` (clerk talks /
  shakes head), `place` (sprite drops in with an overshoot), `shake`, and the hand: `take(item, { from: [x, y, z] })`,
  `hold`, `present`. Path keys inside walls are errors.
- **`kit.fx.b2Hud`** (over the view, transparent elsewhere; HUD words are caps): `compass` (year roll, heading tape,
  objective marker, place typed), `minimap` (rooms walked so far + footprints), `meter` (HP-style: only a real threat),
  `status`, `boss` (only the central problem), `progress` + `checkpoint` (film progress strip, chapter flags), `toast`,
  `inventory` (left column: facts picked up), `say` / `narrate` (irregular typewriter, chained lines keep the box open),
  `choose` (cursor with overshoot, struck options, the pick lights up).
- **Look A `rpg-explore`**, templates `packages/kit/examples/game-b2/a1_corridor.js` (showcase shot 1), `a2_warehouse.js`
  (shot 3, inventory instead of the toast + a checkpoint), `a3_returns.js` (shot 7, its level written inline as the format
  demo); goldens `look-rpg-explore-*` in `packages/kit/test/render/look-rpg-explore.test.ts`.
- Prompts and `reelforge validate level`: part c ("Game B2: wiring" below).

## Game B2: breakthrough scenes, throw, looks B/C, transitions, sound (PLAN.md#13.4 part b)
The two showpieces of the showcase (shots 4 and 8) are **toolkits, never templates** (Sketchbook rules from test film 2):
a required `intent` (the claim), content from the narration, never the same mechanism twice in a film. Inspiration
examples in `packages/kit/examples/game-b2/` show different mechanisms; their errors are sentences that say what to move.
- **`view.automap(spec)`** (`map/`): a Doom overhead map generated from the shot's own level grid (`rooms.ts`: rooms =
  4-connected open cells split by doors, every open/solid edge a pen line, shell walls vs interior islands, seeded
  hand-ruling: overruns, 1 px restarts, ±30 % pen speed, own dash rhythm). Spec: `{ intent, at, until, enter: unfold |
  wipe | cut, exit: fold | cut, scale, rooms: [{ cell, label, sub, state: done | next | ahead | hidden, at, labelAt }],
  replay: { from, to, dur } (path times, may be < 0 = the walk before the shot), marks: [{ kind: objective | item | cross,
  pos, at }], note: { text, pos, to, at }, camera: [{ at, x, y }], legend }`. Walked rooms draw on in pencil order as the
  replayed arrow enters them; next / ahead rooms are dashed and hatched; the camera pans with anticipation and overshoot.
  **Continuity**: `unfold` grows out of the HUD minimap (same centre = the player, same heading, 3 px per cell growing to
  the map's scale), `wipe` dithers in radially from it, `fold` squeezes the frozen map in held steps back onto the minimap
  at 3 px per cell around the arrow and dithers into the real minimap; before a replay starts the arrow is the live walk.
  The HUD clears its persistent elements where the map covers the screen. Validator (`automap-plan.ts`): cells inside a
  room, one accent item, a replay that ends where the walk is, labels / notes inside the safe area, off the narration box
  and the legend and apart from each other **at every camera hold after they appear**. The showcase's "empty box" frame
  was the narration box open before its first letter: the box now finishes opening as the first letter lands (tested).
  Examples: `b2_automap.js` (shot 4: the story so far, replay, pan, the NEXT note, fold), `b3_automap_dive.js` (mid-walk
  dive: unfold, the one door out, fold, the walk goes on).
- **`hud.tally(spec)`** (`hud/tally*.ts`): Doom's intermission card. `{ intent, at, until, title, sub, rows: [{ label,
  value, format: comma | plain | percent | unit | time, unit, approx, est, role: count | par | best, underline, at, dur,
  stall, brake }] (1-6), stamp: { text, at }, backdrop: freeze | live | dark, enter: melt | cut, exit: dissolve | melt |
  cut }`. Counters tick on seeded uneven cadences (big numbers decelerate and never look round until they land, a stall, a
  brake), a real descending comma, EST. tags, par / best lines under a hand rule, pencil underline, coffee ring, then a
  0.7 s silent beat and the misregistered rubber stamp over the plate's right edge (shadow anticipation, overshoot, shake
  with decay). `freeze` holds the view at `at` behind the smoked-glass plate (the level is the painting); the view does
  not render under an opaque tally. Rules: the numbers land >= 0.5 s before it leaves, it holds <= 4 s after its last
  number / stamp. Returns sound cues (`for (const c of r.cues) ctx.sfx.at(c.t, c.name)`), silent in the still beat.
  Examples: `b4_tally.js` (shot 8), `b5_tally_par.js` (live office behind, a percent of par, RUSHED, melts away).
- **`view.throw(item, spec)`** (`view/throw.ts`): `{ intent, at (release), to: [x, y] | target: spriteId, z, arc, dur,
  windup, stay, shake }`; items `{ kind: cartridge | note | key, label, band }`. The hand dips (anticipation), swings, opens
  at the release and lowers out; the item leaves about where the held item was (same size), tumbles through 8 frames
  along the arc, lands with a bounce and an 8.5 fps dust puff, rests or is gone (bin, pit); the target flinches (a clerk
  shakes his head). Pair it with the inventory item's new `out` time and a toast. Examples: `a4_throw.js` (the cartridge
  onto the returns pile), `c2_throw_note.js` (the XMAS! note onto the programmer's desk). Also `view.fog({ at, until })`.
- **Look B `rpg-menu`** (rolls B): `hud.menu({ quest | stats, inventory: { items, select }, note })`, the paused menu
  over the dimmed level; template `b1_quest_log.js` (shot 5). Hosts the automap and the tally.
- **Look C `rpg-boss`** (rolls C): `hud.damage({ text, at, on: meter | boss })`, `hud.stinger(text, { at, until })` (letters
  slam on uneven beats, fall out under gravity), `hud.shake`; template `c1_clone_aisle.js` (shot 6: new wall texture
  `store-shelf`, MARKET draining, FLOODED, TOO MANY). Every look binds `b2View` + `b2Hud` (world-level templates).
- **Game-native transitions** (`packages/engine/src/transitions/game-b2/`, world-scoped like the Sketchbook's, `type:
  'wipe'` fallback): `game-b2-melt` (Doom's screen melt), `game-b2-fog` (a flat sand fog bank, like the showcase's 1983 ->
  2014 interlude), `game-b2-darkness` (light falls in hue-keeping steps to black, the next place clicks on with two
  stutters), `game-b2-door` (the frame rises like a door, we walk through), `game-b2-level-card` (a woodgrain HUD plate
  sweeps across; the incoming shot's compass types the place), and the continuity links `game-b2-map-unfold` /
  `game-b2-map-fold` (an automap shot grows out of / shrinks back into the neighbour's minimap; keep the map centred on
  the player at that end). Goldens `transition-game-b2-*` (`packages/kit/test/render/transition-game-b2.test.ts`).
- **Sound** (`packages/stages/src/sound/palettes/game-b2.ts`): no footstep, door or pickup recipes exist, so it reuses
  built-in ones: footsteps = `board-tap` / `wood-tick`, the door = `servo` + `relay-click` latch, the pickup =
  `chime-up`, HUD typing = `key-click` / `keyboard` (terminal), blips = `terminal-tick` / `measure-blip` / `led-blip`, the
  stamp and thumps = `board-tap` knock, menus = `window-open` / `window-close`, the CRT = `crt-zap`; busy slots have two
  or three candidates (variation); bed: tungsten `hum`. Each game-native transition sounds like itself
  (`GAME_B2_TRANSITION_SFX`).
- **Measured** (plain Node, best batch of 30 frames, view + HUD, 640x360): walk 2.3 ms, automap 2.7 ms, tally 2.4 ms
  (p95 <= 4.9 ms; the first tally frame builds its frozen still once, ~30 ms).
- **QUALITY §7 self-scores vs the showcase stills** (/20): automap story `b2` 17 (arrow + diamond left of centre, ahead
  rooms dashed, the note; rooms are plain rectangles, the note's arrow brushes the TOY STORE label), automap dive `b3` 14
  (correct and continuous, but one big room reads thin: an inspiration example, not a showpiece), tally `b4` 18 (counters,
  stall, underline, the stamp over the plate's edge; the frozen back room is plainer than the showcase's painting), tally
  par `b5` 16, quest log `b1` 18 (close to shot 5), clone aisle `c1` 16 (shelves and stinger read; a SALE card crosses
  the stinger), throws `a4` 17 / `c2` 16 (the toss reads in motion; stills show a small item). Transitions 15-17, level
  card 14 (no name on the card by design).

## Game B1: two worlds in one frame, look A (PLAN.md#13.5 part a)
World `game-b1` (experimental; wired in part c), code `packages/kit/src/worlds/game-b1/`, showcase `docs/worlds/game-hud-b1-boss-v2/`.
- **Style**: the showcase's 23 inks, 640x360 (x3 = 1080p), no engine post (dither spread 0, no engine scanlines or vignette):
  the CRT belongs to the TV picture only and is painted by the kit as palette LUTs (NTSC bleed, scanlines, a hum bar, rounded
  tube); the living room stays in clean square pixels. Variation budget `game-b1` is neutral (one room and one console per
  film). Sound: placeholder palette `game-b2` (CRT zap, relay-click latch, key-click typing, blips, tungsten hum) until the
  world's own palette (`packages/stages`, a later part).
- **`kit.fx.b1Screen`** paints one 640x360 index frame per t from scratch (`screen/model.ts`): (1) the picture inside the TV:
  the scene's `tv((g, t) => ...)` painters in TV units (160x180, each a 4x2 px wide pixel) with 2600 rules: sprites of <= 16
  bits with ONE colour per row (stretch, flip, squash); more than `flickerLimit` (2) sprites on a scanline flicker on
  alternate frames (calls are recorded and replayed, so the rule sees the whole frame; `flicker: false` = the hero,
  `playfield: true` = resting objects outside the limit); playfield of 20 blocks mirrored or repeated; colour bands per line;
  cartridges (tumbling); Joy text typed at an irregular cadence; Score Block digits; whole-picture remaps (`dim`, `flash`,
  `drain`, `ghost`, attract `cycle1`-`cycle3`); the attract mode (also the idle TV when there is no painter) and the garbage
  frame; then the in-game boss cards. (2) The living room (`room/`, square room units, 320x180 at zoom 2): panelling, shag,
  TV cabinet with rabbit ears, console, joystick with a hand-drawn cable, and `room({ calendar, tree, presents, gift, lamp,
  carts })`; the picture is blitted into the TV glass and gets the CRT there. (3) The glass: sticky notes. (4) The HUD.
- **Camera = continuity**: `camera([{ at, on: 'room' | 'tv' | 'calendar' | 'console' | x, y, zoom, ease }])`. A view carries
  `inTv` (0..1): while the room zooms on the TV, the picture grows from the glass rect to the full frame (ease-in), the CRT
  radius and the glass notes with it. `inTv = 1` is exactly the TV-only frame and the start of the push exactly the room
  (tested pixel for pixel), so a push in or pull back is one continuous move. `calendar` lands the wall calendar where a
  calendar boss stands on the TV (the shot 2 -> 3 match cut; the scanline wipe itself is a later part).
- **HUD** (never scanlined; every element is story data, QUALITY.md §6): `year` (odometer with lag and overshoot, the old
  year burned into the glass), `score` (a number from the story), `progress` (cartridge slots; slots = shots and from / to =
  index / count gives one cartridge per shot), `checkpoint` (a flag over the current slot, its name typed), `lives` (hearts:
  only a real threat), `boss` (in-game card: BOSS n types, the Box Art name slams from a side, HP segments arrive unevenly,
  each loss flashes and shakes, `defeat` = flicker death), `say` / `narrate` (box opens as its first letter lands, voiced
  cadence, blinking cursor), `note` (Dad's sticky note on the glass: slap, curl, underline twice, crimson strike or tick).
- **Look A `atari-story`**, templates `packages/kit/examples/game-b1/a1_hook.js`, `a2_xmas.js`, `a3_deadline.js` (showcase
  shots 1-3 without their transitions); goldens `look-atari-story-*` (`packages/kit/test/render/look-atari-story.test.ts`).
- **Measured** (plain Node under vitest, best batch of 30 frames, template scenes incl. output): hook 2.1, Christmas room 2.3,
  deadline 2.1 ms/frame (`screen/screen.test.ts`). The CRT loops read their LUTs from locals: through vitest's import
  bindings the same loops took 10 ms.
- **QUALITY §7 self-scores vs the showcase stills** (/20): hook 18 at t 3.9 (the same frame as `s1-t3.9`: the lit cart on the
  dim pile; t 5.9 is weaker, ~15: the showcase cuts to the level map there, here the pit just empties out); Christmas 17 at
  t 5.5 (same as `s2-t5.5`; tree lights and TV still compete a little), 16 at t 7.9 (the calendar push reads, nothing else
  happens); deadline 19 at t 2.6 / 6.3 (same as `s3-t2.6` / `s3-t6.3`), 17 at t 7.3 (dead boss, struck note, an emptier frame).
  Deliberate roughness kept (crude sprites, uneven grain). Files <= 400 lines (the showcase's room.js is split into
  `room/view.ts`, `room/props.ts`, `room/living-room.ts`).
- Part b (next section): looks B/C, the breakthroughs, the continuity helpers, the transitions, the sound palette. Part c:
  prompts and wiring ("Game B1: wiring").

## Game B1: breakthroughs, continuity, looks B/C, transitions, sound (PLAN.md#13.5 part b)
The two showpieces (showcase shots 4 and 8) are **toolkits, never templates**: `intent` required, every word from the
narration (game words allowed: HIGH SCORES, HOW TO PLAY, FIG., INSERT COIN, PRESS START), never the same mechanism twice in
a film; errors are sentences that say what to change. All are methods of `kit.fx.b1Screen` and return `{ at, end, intent,
cues }` (`for (const c of r.cues) ctx.sfx.at(c.t, c.name)`). The frame model gained layers (`screen/model.ts`): picture
overlays (drawn over the painters and boss cards), glass painters (after the CRT, riding the glass), the console close-up,
the calendar redraw and paper layers; the HUD prints in paper ink (`INK_FLIP`) where a page covers it. Part-a pixels are
unchanged (the `look-atari-story` goldens of a1-a3 pass as committed).
- **`scoreTable(spec)`** (`scores/`): the attract-mode high-score table. `{ intent, at, until, title, rows: [{ who, score,
  locked }] (2-8), hero, print, slam: { at, shake }, initials: arcade | typed | none, ring: { at, note }, prompt: { text:
  INSERT COIN | PRESS START | PLAYER 1 | GAME OVER, at } | false, enter: draw-in | cut }`. Rows = the story's facts in the
  order of events, score = a real number / year; rows after the hero are locked `???` by default (the level map's lock).
  The attract screen redraws top-down in nine uneven bursts over what the TV showed; rows print at uneven gaps with 2600
  flicker, one a unit off the grid; the hero slot shows `----`, then empties for a beat of silence (checked: >= 0.4 s
  after the last row), the gold score slams with a squash and a decaying shake, initials scroll arcade-style (A up, or A
  then Z down, 1-2 frame steps) and blink with uneven holds; the prompt blinks at a machine's 0.6 s and is burned in.
  Glass: Dad's egg-shaped grease-pencil ring round the hero score, his word beside it (right, else above), his thumbprint.
  Checked: hero digits only (Score Block), widths <= 600 px, rows fit above the prompt (pitch squeezed to 15 px), every
  beat inside the table, a hold of at most 4 s after the last beat. Examples: `b1_scores.js` (shot 4), `b4_scores_moon.js`
  (the record mid-table under two done rows, typed name, hard shake, no pencil, PRESS START, cut in).
- **`manual(spec)`** (`manual/`): the HOW TO PLAY page of a cheap two-colour manual. `{ intent, at, until, title, steps
  (1-5, <= 2 lines), figure: { caption, shape: cartridge | box | person | house, layout: shelf | pile | queue, count, hit,
  callouts: [{ item, step }] }, ticks: [t], correction: { step, strike, write, at }, note: { text, at }, enter: slide | cut,
  exit: turn | cut }` (<= 6 blocks = rules + FIG. 1). The printed spread is built once per page (`page.ts`, `paper.ts`):
  key ink as a 45-degree halftone with a starved band, type in **Rough Print** (own CC0 4x7 caps) on a sheet fed crooked,
  the teal plate 3 / 2 px off-register and rotated differently (the hit, the badges, the header rule), copies that are
  never quite the same (lean, mark, bar, tone seeded), yellowed edges, crease, staples, two coffee rings, a thumbprint.
  Per frame (`marks.ts`): pencil ticks at uneven times, a pencil margin note, ONE red correction (tap, strike, the word,
  a loose circle) written above the struck word or, when the line above is in the way, after its line (checked: else an
  error). Slide = peek, hold, slide, overshoot, settle with a cast shadow; turn = from the bottom-right corner, the flap
  shows the print through. Examples: `b3_manual.js` (shot 8, turning onto the level map), `b5_manual_pyramid.js` (a
  pyramid of people, slides in over the living room, WHO PAYS? in the margin, NEW -> MOST).
- **Continuity helpers** (`seams/`): `calendarZoom({ intent, at, push, wipe })` pushes the room camera into the wall
  calendar until its page stands where the next place's page stands (`landing` = { x: 96, y: 22, w: 46, h: 130 } TV
  units), then redraws the frame line by line, interlaced, as the TV picture (the shot 2 -> 3 match cut in one shot,
  `a4_calendar_zoom.js`); `wipe: false` ends on the page. `cartridge({ intent, action: insert | pull, at, label, stripe,
  enter: pull-back | cut, exit: push | cut, hold })`: the console close-up of the same room (`console.ts`, ported from
  room.js), Dad's hand and knit sleeve, the cartridge clipped at the slot, resist / click / garbage / release or squeeze
  / push-down / pull / garbage / dark; the pull-back starts and the push ends **exactly** on the TV-only frame (tested
  pixel for pixel), so the room stays continuous (`b2_market.js` head, `a5_cartridge_pull.js`). `levelSelect({ intent,
  at, until, nodes: [{ label, icon: home | store | pit | office | factory | lock, x, y, above }], route: { from, to, at,
  dur } })`: dotted hand-placed paths, the cartridge cursor in uneven hops with lift and squash, the chosen place blinks
  gold; `lock` = '?' with no name, never a route target (`b6_level_select.js`).
- **Look B `atari-menu`** (rolls B): the console's screens (menus painted in `tv()`, the level map) and the two
  breakthroughs; templates b1-b6. **Look C `atari-boss`** (rolls C): boss slam and bar (a boss that IS an amount may gain
  segments), hit-stop + `g.remap('flash')`, the crash `g.remap('drain', level, [y0, y1])` line by line, lights out row
  by row, `gameOver({ text: CONTINUE? | GAME OVER, at, until, count, ghost })` as the TV's backdrop with the winning boss
  card burned in (`g.rectPx` only for a newer console's thing); templates `c1_flood.js` (shot 6), `c2_landfill.js`
  (shot 9), `c3_continue.js` (shot 10 head). Painter additions: `remap(name, level, rows)`, `rectPx`; note lines <= 16.
- **Game-native transitions** (`packages/engine/src/transitions/game-b1/`, world-scoped, `type: 'wipe'` fallback):
  `game-b1-calendar-zoom` (link `zoom-through`: A pushes into the focus, which drifts to the centre, then the interlaced
  redraw; for the exact showcase seam end the shot on the calendar and use `game-b1-scanline-wipe`),
  `game-b1-cartridge-in` / `-out` (link `carry-environment`: roll + garbage + click jolt; garbage + collapse to a line and
  a dot + dark beat + power-on), `game-b1-attract-cycle` (three uneven colour-cycle steps, then the burst redraw),
  `game-b1-scanline-wipe`, `game-b1-page-slide`, `game-b1-page-turn`, `game-b1-room-shake` (held decaying jolts, one flash
  frame, the next shot settles). The style metadata carries `link` for the three continuity ones (the storyboard stage
  draws a planned link with them: "Game B1: wiring"). Goldens `transition-game-b1-*` (`packages/kit/test/render/transition-game-b1.test.ts`).
- **Sound** (`packages/stages/src/sound/palettes/game-b1.ts`, now the world's and every look's palette): no cartridge,
  coin or slam recipes exist, so it reuses built-in ones: the cartridge click = `relay-click` latch, garbage = `crt-zap`
  static, the coin-up (INSERT COIN, a chosen level) = `chime-up`, the slam = `board-tap` knock, blips = `measure-blip` /
  `led-blip` / `terminal-tick`, the page = `paper-slide` / `page-flip`, Dad's pencil = `pencil-scratch`, typing =
  `key-click` / `keyboard` (terminal); bed: `crt-hum`. Each `game-b1-*` transition sounds like itself
  (`GAME_B1_TRANSITION_SFX`); the toolkits' cue names map onto these (tested).
- **Measured** (plain Node, best batch of 30 frames incl. output, 640x360; `screen/budget.test.ts`): calendar zoom 2.1,
  cartridge pull 1.7, scores 1.7, market 1.9, manual 4.1, Moon board 1.7, pyramid manual 3.6, level select 1.9, flood
  3.2, landfill 1.6, continue 3.5 ms/frame. The manual's printed page is built once on its first frame (warm-up).
- **QUALITY §7 self-scores vs the showcase stills** (/20, PNGs viewed): scores `b1` 18 at t 5.6 (the same frame as
  `s4-t5.6`; same weakness, the empty bottom right), Moon board `b4` 15 (focal clear, plainer: no hand on the glass);
  manual `b3` 17 at t 7.4 (close to `s8-t7.4`; no back row of copies on the shelf), pyramid `b5` 15 (small figures, the
  red circle crowds rule 4); market `b2` 17 (the close-up matches `s5-t0.5`); level select `b6` 16 (the cursor sits on
  the node icon when it lands, as in the showcase); flood `c1` 18 (`s6-t5.6` without the tape strip), landfill `c2` 17
  (`s9-t2.5`; the boss card stays lit through the drain), continue `c3` 18 (`s10-t1.5`); calendar zoom `a4` 17 (the
  seam reads; the office is plainer than a3), cartridge pull `a5` 17. Transitions: page turn 17, page slide 16, attract
  16, scanline 16, calendar zoom 15, cartridge in / out 15, room shake 14.

## Game B2: wiring (PLAN.md#13.4 part c)
Game B2 is **wired** (`wired: true`): offered with Settings → Experimental worlds on, like Sketchbook and Comic.
- **Prompts** (`packages/prompts/src/worlds/game-b2.ts`): film, brief, rolls (A the walk `rpg-explore`, B the game's screens
  `rpg-menu`, C the pressure `rpg-boss`), rhythm (never the same corridor twice), game-native `transitionIn` (style + `focus`),
  camera (the player's eyes, walk then hold, no orbit), interrupts (`look-switch` only), marks/annotate (all text in the HUD
  and the level, never `ctx.text`/`ctx.annotate`), motion (one `b2View` + one `b2Hud` per shot; every HUD element must mean
  something), craft brief (≤ 1.5 KB, QUALITY.md §6 game-hud as the do-list), critic medium/style/vibe/checklist, continuity
  (`shared-object` = the held item across places, `carry-environment`, `zoom-through`; the map link `game-b2-map-unfold` /
  `-fold`), surprise beats. Exact kit calls in `game-b2-snippets.ts`, run through the real kit by
  `packages/stages/src/game-b2-snippets.test.ts` (and the worked level paints the same pixels as the built-in `office`).
- **Level format for the runtime Claude** (the scene turn's step 4, `missing`): no props in this world, the level is the set;
  one level per scene written from the narration's places and objects; the format with its caps (grid ≤ 32×32 with a closed
  border, ≤ 12 lights, ≤ 40 sprites; every wall/floor/ceiling/mood/sprite id, checked against the kit's enums by the snippets
  test) and one worked level (the built-in `office`, written out). **`reelforge validate level <scene.js | level.json>`**
  (`packages/cli/src/commands/validate-level.ts`): reads every object with a `grid` and a `legend` from the scene source
  (literals, consts, spreads; no execution) and every built-in name, checks them with the kit's `checkLevel`; errors name the
  grid row or field; a level computed at run time is a warning. Listed in the scene-build prompt and in the template
  `CLAUDE.md` (Self-QA step 5).
- **Moment catalog** (`game-b2-moments.ts`), checked by the generic variety validator:

| Moment | Kind | Look | Use when the narration… |
| --- | --- | --- | --- |
| `automap` | breakthrough | `rpg-menu` (B) | takes stock of where the story has been and where it goes next |
| `tally` | breakthrough | `rpg-menu` (B) | sums up a chapter in numbers (made vs sold, time vs par) |
| `throw` | moment (intent required) | `rpg-explore`, `rpg-boss` | gets rid of something, sends it back or hands it on |
| `quest-log` | moment | `rpg-menu` | pauses to take stock: the goal, what is done, the facts so far |
| `inventory-pick` | moment | `rpg-explore` | names the one object or fact the story turns on |
| `dialogue` | moment | `rpg-explore`, `rpg-boss` | lets someone in the story speak, or weighs options |
| `boss-card` | moment | `rpg-boss` | names the central problem and shows it winning or losing |
| `stinger` | moment | `rpg-boss` | lands the one phrase the film turns on (once per film) |
| `level-card` | moment | any (opens with `game-b2-level-card`) | opens a new chapter, place or year |

  Automap, tally and throw are toolkits, never templates: `intent` required, inspirations b2/b3, b4/b5, a4/c2, never the same
  opening + closing (automap), backdrop + entrance + exit (tally) or item + target (throw) twice in a film.
- **Guards** (`packages/stages/src/slop/game-b2-labels.ts`): traces = `switchOn`, `shake` (≤ 2), `act` (≤ 2), `take`, `place`
  (≤ 2), `present`, `choose`, `stinger`, `damage` (≤ 1), `fog` (1 each), `throw` and `menu` (2), `automap` and `tally` (3);
  level options `chalk`, `crossed`, `flicker: 'tube' | 'bulb'`, `tilt`, `dirty`, `note`; the built-in `office` / `warehouse`
  count for their two traces each. Text provenance reads `narrate`, `say`, `stinger`, the HUD options (`place`, `year`, a
  toast's `head`/`body`, `speaker`, choice `options`, menu lines, `sub`, `unit`, `stencil`, …), a boss bar's `name` (only
  inside `boss`: level names are not on screen) and a tally row's numeric `value`; game words (QUEST, LOG, EST., PAR, …) and
  time units are labels, a one-digit damage number is a meter's lost segments. `slop/breakthrough-intent.ts`: an automap,
  tally or throw without an intent, with a generic one or one the sources never make → ⚠; the final review flags a repeated
  mechanism or intent. The text stem now folds a doubled consonant (`betting` = `bet`): the HUD is all caps, so a paraphrase
  there counts as a label. Calibration: 0 findings on the 11 Game B2 templates (showcase narration + notes) and the 33 Game B2
  goldens; 30/30 planted fakes caught (`slop/game-b2-*.test.ts`).
- **Project defaults**: `WORLD_PROJECT_DEFAULTS['game-b2']` = continuity links on, anti-slop guards on, mixed looks, no pack
  or mascot (640x360 comes with the style preset, 30 fps with the template). Music moods `lofi-chill`,
  `tense-investigation`, `retro-wave` (`WORLD_MOODS`); critic look rules `CRITIC_LOOK_RULES['rpg-*']`; `reelforge kit-docs`
  lists `b2View`, `b2Hud` and the three looks with the experimental switch on.

## Game B2: open vocabulary (PLAN.md#13.15 phase 1, kit only)
The world is a style GRAMMAR (docs/worlds/DECISIONS.md), not the showcase's asset catalogue. Code:
`packages/kit/src/worlds/game-b2/assets/` (pack, DSL, generators), `level/sky.ts` + `ray/sky.ts` + `ray/outdoor.ts` (outdoor mode).
Prompts / stages / CLI are phase 2 (not touched).
- **Audit of the built-in vocabulary** (all from the 1983 E.T. showcase): walls `concrete` (shot 1 corridor), `wood-panel`
  (shot 2 office), `cubicle` (office), `shelf` / `shelf-end` (shot 3 warehouse, E.T. cartons), `corrugated`, `cinderblock`,
  `counter` (shot 7 returns desk), `store-shelf` (shot 6 clone aisle); floors `concrete(-sand)`, `carpet`, `warehouse(-line)`,
  `tile(-big)` (toy store / returns), `sand` (shot 9 landfill); ceilings `dark`, `office(-light)`, `warehouse(-tube)`,
  `grey(-tube)`; moods dark / tungsten / fluorescent / shop / backroom (indoors only); sprites `clerk` (the one person, a
  returns clerk), `desk` (office worker from behind), `item` (the cartridge shell), `sand-pile` (cartridge in sand), `carton`,
  `pallet`, `boxes` (boxed games), `bin` (bargain bin), `card` (SALE), `sign`, `exit`; held items cartridge / note / key; HUD
  icons cartridge / calendar / carton / note / key. No sky, no outdoors, no water, no plants, no animals, no second person.
  What a film could not express before: **forest** (trees, animals, undergrowth, sky: nothing), **ocean** (water, fish,
  coral: nothing; a "sea" = a brown corridor, like the Thames in real run 1), **space station** (hull, windows, a planet,
  stars: nothing), **medieval village** (houses, villagers, a well, torches: only the clerk), **desert** (only `sand` floor and
  the cartridge `sand-pile`; no dunes, palms, camels), **city** (no streets, facades, cars, skyline). Every person was the
  clerk, every object the cartridge shell.
- **Asset pack** (`kit.fx.b2View({ assets })`, one pack or a list of up to 4; the same JSON as a project file
  `assets/game-b2/<name>.json`: `{ version: 1, world: 'game-b2', sprites, textures, icons }`). Ids are kebab case, unique across
  packs, never a built-in name; caps 48 sprites / 24 textures / 24 icons per view. Each entry is **pixel art** or a
  **generator call**; errors name the asset, frame, row and column (`sprites.fern.rows[1]: "X" at x=1 is not in the legend`).
  Delivering project files to scenes (inline or injected) is phase 2; `checkAssets(pack)` is exported for the CLI.
- **Pixel-art DSL**: sprites `{ rows | frames (2-4), legend, mirror, size: [w, h], z, fps, glow, outline, person }`, textures
  `{ size: 16 | 32 | 64, rows | frames, legend, fps, glow }` (tiled to 64), icons `{ rows (<= 16x16), legend }`. Legend values
  are the world's swatches (`sage`) or **ramp steps** (`leaf.2`; ramps warm 0-5, leaf 0-5, sky 0-4, earth 0-4, stone 0-5,
  rust 0-4, plum 0-3, accent 0-1), `clear` = transparent; never hex. A `person: true` sprite has 4 frames (rest, talk, shake,
  shake) and `view.act()` drives it.
- **Generators** (seeded, crude on purpose, shaded by ramp steps with the light from the upper left, Bayer dither, 1 px
  outline): `plant` (deciduous, conifer, palm, bush, grass, flowers, mushrooms, cactus, seaweed, reeds; height, width, leaf /
  trunk ramp, bloom, lean; grass / reeds / seaweed sway); `creature` (bird perch|fly, quadruped grazer|dog|cat|bear|horse with
  neck / legs / horns / hump / ears / pattern, fish slim|round|eel, insect bee|butterfly|beetle|ant, reptile
  lizard|snake|croc|turtle; 2 frames); `person` (build, skin 0-3, hair, beard, glasses, 13 hats, 10 outfits, clothes ramp,
  trim, 13 tools; 4 frames like the clerk); `structure` (hut, house, tower, castle-wall, ship, bridge, tent, ruins, pipe,
  well, windmill, lighthouse, skyscraper, dome, antenna, planet; `lit` windows glow); `vehicle` (car, truck, bus, cart,
  bicycle, rowboat, sailboat, rocket, satellite, train); `object` (27 kinds: furniture, barrel, crate, chest, sack, pot, lamp,
  torch and campfire (animated, glowing), rock, signpost, fence, console, bookshelf, anvil, cauldron, statue, column,
  tombstone, bench, streetlamp, hydrant, pile, flag, log); `texture` (grass, sand, mud, snow, rock, ice, foliage, water and
  lava (3 frames), tile, planks, brick, stone, cobble, metal, hull, fabric, logs, thatch, adobe, facade, glass; `ramp`,
  `wear`, `lit`, `window` = a see-through hole); `icon` (36 kinds, 12x12 + outline: document, letter, book, map, scroll, key,
  coin(s), bag, gem, bottle, potion, flask, bread, apple, fish, bone, wrench, hammer, brick, ticket, chip, phone, clock,
  compass, feather, leaf, star, heart, drop, medal, battery, shell, rope, ring, pill). Any generator call may add `fps` (0 =
  still) and `z`.
- **Level format extensions** (`checkLevel(level, ids)`; the built-in lists in error messages are unchanged, a hint names the
  film's ids or says "define it in assets.*"): walls / floors / ceilings / sprites take project ids; `sky: { preset: day |
  dawn | dusk | night | overcast | space | underwater, clouds, sun: { az, el, moon } | 'none', stars, skyline: none | hills |
  mountains | trees | dunes | city | sea | mesa | towers, skylineHeight, ground, drift }` makes an OUTDOOR level: no ceiling
  (a cell keeps a roof only with its own `ceiling`), the border may stay open (the ground runs to the horizon haze), walls up
  to 4 tall (tiled per unit), floor / ceiling `'none'` = the void (space), the level's own room lit by the sky preset;
  sprites `scale`, `flip`, `z` up to 4 and `w` / `h` up to 6; lights `flicker: 'fire'`; animated textures cycle per frame;
  label / chalk / pinned only on built-in walls; indoor levels keep every old rule (closed border, height <= 1).
- **The film's things in the hand and the HUD**: `take / hold / throw({ icon: 'ledger' })` draws the project icon (scaled by
  whole factors), `hud.inventory` and `hud.menu` accept icon ids of the view's assets; `view.defineSprite(id, spec)` /
  `view.defineIcon(id, spec)` add entries after build (for `place`, the hand, the HUD). Textures come only through `assets`
  (the level compiles when the view is built).
- **Examples** (`packages/kit/examples/game-b2/open/o1_forest … o6_city.js`, built only through the open layer; kept out of
  `examples/game-b2/*.js` because the showcase-text guards and `validate level` read that folder), goldens
  `look-b2-open-*` (`packages/kit/test/render/look-b2-open.test.ts`), contact sheet `packages/kit/out/contact/look-b2-open.png`.
  QUALITY §7 self-scores (/20, honest) and the 64 px thumbnail read: forest **15** (trees, trail, sky and deer read at 64 px;
  the mushroom focal is a few pixels; foliage-wall hedges look flat), ocean **13** (reads as underwater by colour and the
  surface shimmer, but coral and fish lose their colour under the blue light and become grey lozenges at 64 px; below the
  bar as a showpiece), space station **16** (the planet in the porthole is the strongest thumbnail of the six; the hull is
  noisy dither up close; the astronaut is small), medieval village **15** (dusk sky, well, timber walls and the baker read;
  the dusk clouds are blocky), desert **15** (palms, pool and camels read; the pool's edge steps with the grid; the rock is a
  blob), city **14** (bus and lit windows read; near facades turn into checker dither, the lower left is dark).
- **Measured** (plain Node, best batch of 30, view + HUD incl. the quad upload, 640x360): forest 2.7, ocean 3.4, station 3.4,
  village 3.4, desert 4.4, city 5.3 ms/frame (built-in warehouse template 3.4 on the same run). The built-in templates paint
  the same pixels as before (all existing B2 goldens pass unchanged).

## Game B1: wiring (PLAN.md#13.5 part c)
Game B1 is **wired** (`wired: true`): offered with Settings → Experimental worlds on, like the other three worlds.
- **Prompts** (`packages/prompts/src/worlds/game-b1.ts`): film, brief (two worlds in one frame: 2600 rules inside the TV,
  square pixels in the room; boss cards, Dad's notes, the HUD), rolls (A the story `atari-story`, B the console's screens
  `atari-menu`, C the boss `atari-boss`), rhythm (back and forth between the TV and the room), game-native `transitionIn`
  (style + `focus`; the storyboard's list names the link of the three continuity ones), camera (the living-room camera: push
  into the TV, pull back, land on the calendar or the console, no orbit), interrupts (`look-switch` only), marks/annotate
  (all text in the TV, the HUD and Dad's notes, never `ctx.text`/`ctx.annotate`), motion (one `b1Screen` per shot; every
  HUD element must mean something), craft brief (≤ 1.5 KB, QUALITY.md §6 game-hud as the do-list), critic
  medium/style/vibe/checklist, continuity (`zoom-through` = `game-b1-calendar-zoom`, `carry-environment` =
  `game-b1-cartridge-in` / `-out`, `shared-object`: write `"continuity"` AND name the transition), surprise beats. Exact kit
  calls in `game-b1-snippets.ts`, run through the real kit by `packages/stages/src/game-b1-snippets.test.ts` (each alone,
  together on one screen, and drifted calls that must throw).
- **Moment catalog** (`game-b1-moments.ts`), checked by the generic variety validator:

| Moment | Kind | Look | Use when the narration… |
| --- | --- | --- | --- |
| `score-table` | breakthrough | `atari-menu` (B) | ranks the story's facts or records in the order they happened, one landing now |
| `manual` | breakthrough | `atari-menu` (B) | explains how something works as a few rules in a row |
| `calendar-zoom` | moment (intent required) | `atari-story` | jumps to a date, a deadline or a year and the whole place changes |
| `cartridge` | moment (intent required) | `atari-story`, `atari-menu` | puts a game into homes or takes it back |
| `level-select` | moment (intent required) | `atari-menu` | moves the story to another place or time |
| `boss-card` | moment | `atari-boss`, `atari-story` | names the central problem and shows it winning or losing |
| `game-over` | moment | `atari-boss` | loses the fight or asks whether it goes on |
| `dialogue` | moment | `atari-story` | lets someone in the story speak |
| `glass-note` | moment | `atari-story`, `atari-boss` | names the weak point or the lesson in a few words |
| `tv-push` | moment | `atari-story` | moves between the people living the story and the game itself |

  The score table and the manual are toolkits, never templates: `intent` required, rows / rules / scores from the narration
  (no invented figures), inspirations b1/b4 and b3/b5, never the same entrance + initials (table) or entrance + exit +
  figure (manual) twice in a film.
- **Continuity links drawn by world transitions** (`packages/stages/src/world-links.ts`): a world transition with `link`
  draws a planned link of that kind. A linked shot opens with the world's transition of its link's kind (the one named in
  `transitionIn.style`, else the world's first: the calendar zoom for `zoom-through`, the cartridge in for
  `carry-environment`) at its own length (at most half the shot) on the link's anchor; a kind the world has no transition
  for (`shared-object`) keeps the generic `continuity-<kind>` style. The scene directive gives the link's real length; the
  final review counts a world link transition as rendered. With links on, a link transition named on a shot without
  `"continuity"` is a storyboard error (`continuity-link`: the object both shots build is missing); the stage never fills a
  link transition into an unlinked shot. Worlds without link transitions: byte-identical behaviour.
- **Guards** (`packages/stages/src/slop/game-b1-labels.ts`): traces = `note`, `shake` (≤ 2), `remap` (≤ 2), `typed`, `hash`,
  `garbage` (1 each at most), `boss`, `gameOver` (1), `room`, `calendarZoom`, `cartridge` (2), `levelSelect`, `scoreTable`,
  `manual` (3); options `under`, `strike`, `tick`, `ring`, `ticks`, `correction`, `markAt`, `tree`, `gift`, `squash`,
  `tumble`, `type`. Text provenance reads `narrate`, `say` (and its `speaker`), the painter's `text` and `score`, `year`,
  `note` lines, a cartridge `label`, a gift `tag`, the calendar `month`, a boss card's `name` (only inside `boss`), the
  table's `who` and `score` (numbers and strings), the manual's `steps`, `caption` and correction (`strike`, `write`);
  game words (HIGH SCORES, HOW TO PLAY, INSERT COIN, PRESS START, BOSS, WEAK POINT, CONTINUE?, GAME OVER, INVENTORY FULL)
  and time units are labels (LIVES, HP are not: lives only for a real threat); a two-digit year (`XMAS 82`) is sourced by
  its full year (`shortYears`). `slop/breakthrough-intent.ts`: a score table, manual page, calendar zoom, cartridge swap or
  level select without an intent, with a generic one or one the sources never make → ⚠; mechanisms may name nested options
  (`figure.layout`); the final review flags a repeated mechanism or intent. Calibration: 0 findings on the 14 Game B1
  templates (showcase narration + notes) and the 42 Game B1 goldens; 33/33 planted fakes caught, numbers included
  (`slop/game-b1-*.test.ts`).
- **Project defaults**: `WORLD_PROJECT_DEFAULTS['game-b1']` = continuity links on, anti-slop guards on, mixed looks, no pack
  or mascot (640x360 comes with the style preset, 30 fps with the template). Music moods `lofi-chill`, `retro-wave`,
  `tense-investigation` (`WORLD_MOODS`); critic look rules `CRITIC_LOOK_RULES['atari-*']`; `reelforge kit-docs` lists
  `b1Screen` and the three looks with the experimental switch on.

## Game B1: open vocabulary (PLAN.md#13.15 phase 1, kit only)
The showcase is the **style grammar** (2600 rules inside the TV, square pixels in the room, HUD/boss/note grammar, the 23
inks), not the set of things a film may contain (DECISIONS.md "PRINCIPLE"). Code `packages/kit/src/worlds/game-b1/vocab/`
(DSLs, generators, assets, drawing, logic) and `room/` (room DSL); prompts and stages are phase 2.
- **Audit (before)**: the built-in vocabulary was the 1983 crash: `g.cart()` (the E.T. cartridge, shots 1/6/9), attract and
  garbage frames (3→4, 5), `room()` = Christmas 1982 only (panelling, shag, tree, presents, missing-gift tag, lamp, loose carts,
  a calendar without a year; shot 2), boss = a text card (3/6/9), the manual's FIG. shapes cartridge/box/person/house (8),
  level-select icons home/store/pit/office/factory/lock (8→9), the console close-up with Dad's knit sleeve (5/7), CONTINUE?
  (10). Everything else (the kid, the truck, the shelves) was hand-written rows inside one template. A forest, ocean, space
  station, village, desert or city film had no trees, animals, people, vehicles, buildings, water or sky, no scenery
  playfield, no room but the 1982 living room, no year on the calendar, and no rule check beyond "<= 16 bits": the runtime
  Claude replayed cartridges (the London film's buried E.T.).
- **Sprite DSL** `screen.defineSprite(id, { rows | frames, colours, size: 1|2|4, copies: 1-3, gap: close|medium|wide, rowH,
  fps, faces, describe })`: a player is <= 8 bits ('#'/'.'), ONE colour per row (an ink, one per row, or row stops
  `{ "0": "tan", "3": "teal" }`), NUSIZ stretch OR copies (never both, no wide triple), frames of one height, <= 48 rows.
  Every broken rule comes back as a sentence with the fix ("9 bits wide: a 2600 player is 8 bits. Draw it narrower and
  stretch it…"); everyday colour words get the inks that play them ("green" → avocado, oliveDark, teal).
- **Playfield DSL** `screen.definePlayfield(id, { rows, rowH, colours, mode: mirror|repeat })`: 20-bit halves mirrored or
  repeated, or 40-bit asymmetric rows, 4-unit blocks, one colour per row. **Ball / missile**: `g.ball` / `g.missile`
  (1/2/4/8 units wide, outside the player limit: rain, a net line).
- **Generators** `screen.generate(id, { kind, ...traits, seed })` (seed defaults to the id): trees (pine, round, palm, birch,
  dead), bush, cactus, seaweed (swaying), rock; bird, fish, `animal` from traits (neck, legs, horns/antlers/ears, hump, tail,
  bulk; presets deer, horse, camel, dog, cow, bear, goat), insects (bee, locust, beetle, butterfly), reptiles (lizard, snake,
  turtle); `person` = one humanoid base + hat + tool + uniform (roles ranger, miner, sailor, knight, astronaut, clerk,
  farmer, kid; everything overridable); vehicles (car, truck, boat, rocket, cart, plane), buildings (hut, house, castle,
  tower, factory, office, `lit`), items (key, gem, coin, potion, document, flag, heart); `boss` from traits (body blob /
  cloud / wave / clock / swarm / tower / beast, eyes, mouth, arms, crown; size 4; the swarm = a copied locust); effects
  (explosion, splash, smoke, sparkle, dust: one-shots); `scenery` playfields (canopy, waves, dunes, hills, skyline, wall,
  reef, clouds, ground). Each result goes through the same validator (tested over 12 seeds per variant); a seed nudges a
  few bits so two trees are never twins (deliberate roughness kept).
- **Drawing** inside `tv()`: `g.draw(id, x, y, { frame, at (one-shot), phase, face, squash, flicker, playfield, colour,
  size })` (NUSIZ copies are one player: they count once on a scanline), `g.field(id, y, { shift (whole-block scroll),
  colour, rows: [a, b] })`, `g.box(id, x, y)`; **game logic** `g.util.path(keys, t, { ease, fps })` (whole units, held
  steps, `dir` to face the sprite), `g.util.scroll(t, speed)` (coarse blocks), `g.util.hit(a, b)` (a collision is shown,
  never simulated), `g.counter({ means, keys, x, y, colour })` (Score Block digits; `means` must name the real number,
  "score" / "points" are refused).
- **Room DSL** `screen.interior({ shell, wall, floor, light: day|evening|night, calendar: { month, year, mark, markAt },
  props, defaults, carts } | roomId)`: shells living-room, bedroom, arcade, office, classroom, garage, workshop (walls
  panelling, wallpaper, paint + chair rail, brick, concrete, tiles; floors shag, carpet, boards, checker, concrete); props
  window (sky day/dusk/night, view trees/city/sea/hills/desert/snow/stars), poster (prints one of the film's sprites), shelf
  (cartridges, books, boxes, papers, tools, jars, trophies, records), clock (time), blackboard (chalk lines in Dad's hand),
  pegboard, plant, lamp, rug, desk (papers, typewriter, computer, phone), bed, sofa, cabinet (filing, arcade, locker),
  workbench, boxes, instrument (guitar, drum). The TV cabinet, console and joystick are drawn exactly as in the living room
  (the identity; the TV glass is pixel-identical in every shell, tested) and the calendar stays where the calendar zoom
  lands. `room()` is unchanged (all part a/b goldens pass as committed).
- **Asset files** `assets/game-b1/<name>.json` = `{ version: 1, world: "game-b1", describe, sprites, playfields, generated, rooms }`,
  loaded with `screen.assets(file)`. `checkB1Assets(files, { used, known })` (exported from the world) validates a whole
  project at once without throwing: every message names the file and the id, ids are unique across files and kinds, room
  posters must name a defined sprite, ids a scene uses that nobody defines get a did-you-mean; `b1SceneRefs(source)`
  reads the defined / used ids from a scene's string literals. Phase 2 wires the files into the scene turn and
  `reelforge validate`.
- **Examples** (`packages/kit/examples/game-b1/open/`, a subfolder so the showcase guard calibration keeps its 14
  templates): `o1_forest` (ranger, deer, crows as copies, canopy, a hand-drawn stump, the oak count 4000 → 900), `o2_ocean`
  (a hand-drawn rowing boat, fish schools as copies, kelp, the reef bleaching row by row), `o3_station` (a 1986 bedroom, a
  push into the TV: module + mirrored solar-wing playfield, capsule docking, cosmonaut, the Earth's limb and its sunrise),
  `o4_village` (storm-cloud boss THE RAIN with a six-week bar, castle, huts, a wheat playfield rotting, rain missiles, a
  cart), `o5_desert` (a camel caravan as one copied player, two dune playfields scrolling at two speeds, the oasis pool
  shrinking on a visual collision, the day count 1 → 40), `o6_city` (a 1987 office, push in: skyline, towers, traffic as
  copies, traders, falling papers, the Dow 2246 → 1738). Each is built ONLY from the open layer (tested: no `cart`,
  `sprite`, `room`, `rectPx`, `raw`); every number comes from its narration (written in the header). Goldens
  `look-game-b1-open-<scene>-t<t>` (`packages/kit/test/render/vocab-game-b1.test.ts`).
- **Measured** (plain Node, best batch of 30 frames incl. output, `vocab/examples.test.ts`): forest 3.3, ocean 2.9, station
  2.6, village 2.8, desert 1.9, city 1.9 ms/frame.
- **QUALITY §7 self-scores** (/20, PNGs viewed; honest, not a designer's review): station 17 (the bedroom reads at once, the
  station between its wings, the dome and its gold line; the sunrise line is thin), ocean 16 (the white reef is a clear
  focal; the reef before bleaching is too dark, the boat small), desert 16 (caravan, dunes and palm read; the camels are 8
  units wide), city 16 (office and the crimson 1738 read; cars read as orange domes, traders are tiny), forest 15 (trees,
  stumps, the count; the ranger is small, the canopy reads as a hedge band), village 14 (wheat and its rot, the boss card;
  the cloud boss reads as a grey blimp, the castle is striped grey on dusk, the cart reads as a sled).
- **Recognisability at 64 px wide** (goldens box-downscaled and viewed): what survives is the playfields, the bands and the
  room: the bleached reef, the Earth's dome, the dunes and palm, the skyline, the bedroom and the office (TV, window,
  calendar) are identifiable; single 8-unit sprites (ranger, fish, camels, traders, cars) become 2-3 px dots and the
  village is just bands. Rule for phase 2 (prompts, critic): one hero per shot at size 2-4 or rowH 3, the place carried by
  a scenery playfield or the room shell, never a shot that relies on small sprites to say what it is.

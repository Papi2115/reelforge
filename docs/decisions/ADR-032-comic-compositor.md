# ADR-032: Comic world, the multi-panel page compositor (ReelForge 3.1)

Status: accepted (2026-10-07), experimental world. Code: `packages/kit/src/worlds/comic/` (`page/comic-page.ts`
= `kit.fx.comicPage`, `page/model.ts` compositor, `page/panel.ts`, `page/layouts.ts`, `page/pen.ts` = the painter's
`g`, `page/api*.ts`, `draw/*` raster, print textures, lettering, marks), templates `packages/kit/examples/comic/`,
render test `packages/kit/test/render/look-comic-story.test.ts`. Visual contract: `docs/worlds/comic-panels-v2/`.

## Context

PLAN.md#13.3 asks for "a compositor of many panels in the engine (several scenes at once, panel masks, camera =
panel moves)". The approved showcase (`comic-panels-v2`) is not built from sub-scenes: every shot paints one
640x360 indexed framebuffer, panel by panel, through polygon clip masks; panel content is 2D ink art over colour
plates printed 1-2 px out of register, halftone screens are patterns of whole inks, lettering is pixel glyph tables,
"camera" moves are a page placement (pan/zoom) and per-panel placements. Every frame is a pure function of t.

Two designs were possible:
1. **Engine-level multi-scene compositing**: N sub-scenes (Three.js) rendered into N render targets and
   composited through panel masks by a new engine pass, with per-panel clocks and cameras.
2. **Kit-level page raster** (like Sketchbook's `kit.fx.sketchPage`): one fx object owns an index framebuffer,
   paints the page for t, maps indices to palette colours and shows it on a full-frame quad through the normal
   post pass.

## Decision

**Design 2, a kit-level page compositor `kit.fx.comicPage`.** No engine change.

- The showcase needs no sub-scene rendering: nothing in it is 3D, and a panel is "a mask + a placement + a
  clock". Painting all panels into one index buffer reproduces it 1:1 (the goldens match the showcase stills
  almost pixel for pixel), keeps the page palette-pure by construction (indices < 22, `dither.spread: 0`) and
  makes preview = export trivially (the same raster for both, ADR-002/ADR-004 unchanged).
- Engine-level compositing would add render targets, a mask pass, per-panel scene lifecycles and a new manifest
  shape for a look that would then still have to fake print (halftone, misregistration, ink boil) in shaders, and
  it would give the runtime Claude a second scene contract. Its only gain (3D content inside a panel) is not part
  of the approved world; if a later look needs it, a panel painter can blit a sub-raster without changing the
  page model.
- **Panel model** (`PanelModel`): a quad (fixed, morphing via `morph`, or a function of t for gutters that
  split), an entrance (`cut`, `slam` 1.14 -> 1 with overshoot, `slide` from just off the page, `pop`; `rough: true`
  shows the pencil layout before it), an exit, a clock (`offset`, `rate`, `hold`) and a camera (content point at the
  panel centre + zoom: "camera = panel moves"). Painters `(g, t) => ...` get the panel's own time.
- **Page model** (`ComicPageModel.render(canvas, t)`): paper (fibres fixed to the page) -> under-traces -> panels
  in z order (blue-line pencils past the corners, content through the mask, boiled ink border) -> page drawings,
  lettering, traces -> press-intro plate remap. Page camera keys + decaying shakes place the whole page. Nothing
  survives a frame; seek order cannot matter.
- **The painter's `g`**: `g` = key plate (ink lines, `g.ink` boils at 10 fps), `g.plate` = colour plate shifted by
  the panel's seeded misregistration (never zero), so the print trace is the default, not an effort. Paints are
  inks by swatch name, halftone `g.tone(ink, level | (lx, ly) => level, { on })`, dither, layers; seeded `g.rnd`.
  Generic art only where every topic needs it (`g.ground` horizon + halftone + craters, `g.digits`, `g.blob`
  one-outline silhouettes); subjects are drawn by the scene.
- **Rules the API enforces**: at most 5 panels on the page at once (checked on the first frame, readable error),
  unknown inks name the palette, layouts are hand-ruled presets with uneven leaning gutters and offset rows
  (`splash`, `2-up`, `strip`, `3-up-l`, `4-grid`, `4-l`, `splash-inset`), lettering keys are seeded by content and
  place (adding an item never reshuffles another's wobble).
- **Fonts**: Inkhand (lettering, drawn for the comic showcase) and Forge Display (onomatopoeia, the engine's own
  display face with a plain zero) as own CC0 glyph tables in the kit (`docs/licenses.md`). `ctx.text` stays the
  engine fonts; the look's docs send all text to `page.balloon/caption/sfx/note`.
- **Sound**: placeholder `paper-cutout` palette until the world's own palette (later part of 13.3).

## Consequences

- Example scenes carry their subject art (Eagle, the crew, Houston, the glove) as plain JS on `g` (~270-380 lines
  each); the runtime Claude writes the same kind of code. Shared generic helpers can grow in `pen-art.ts`.
- Looks B/C, the breakthrough scenes (sepia flashback = per-shot palette remap + halftone screen, already
  supported by the page's `Screen`; double-page spread = page-layout keyframes), the panel-native transitions
  (engine compositors with world-prefixed ids, like `sketchbook-*`) and the prompt wording are later parts.
- Registering the world adds `comic` to `STYLE_REGISTRY.allIds` (experimental) and to `WORLDS`; tests that pin the
  world list must name it.

# ADR-005: Pixel-font text system (PLAN 2.5)

Status: accepted (2026-10-02). Code: `packages/engine/src/text/`; tests: `src/text/*.test.ts`,
`test/render/text.test.ts`; example: `examples/s01_text.js`.

## Decision: CPU bitmap fonts rasterized into a per-shot low-res overlay, composited in the post pass

- **Fonts are data in code**, authored for this repo (CC0, `docs/licenses.md`): _Forge Display_
  (caps-only title font, 7-row caps, 2-px stems, proportional) and _Forge Mono_ (5x7, 6-px cell,
  real descenders). Polish diacritics are composed from a base glyph plus a mark (acute, dot,
  ogonek) so marks sit identically on every letter. Line box = 3 rows accent room + 7 cap rows +
  2 descender rows; integer scales only; no kerning.
- **Rasterization is CPU, not canvas `fillText`**: browser text rendering depends on OS fonts
  and hinting; our own bitmaps give bit-identical pixels everywhere (Node unit tests can assert
  them) and need no font loading in the CSP-locked sandbox.
- **Where text enters the image**: each shot owns an RGBA8 overlay at the low-res size (640x360,
  480x270). The composite shader does per layer `withText(overlay, shade(scene))` — i.e. **after
  fake AO and depth outline** (so they never eat or darken glyphs) and **before** the transition
  (text crossfades/wipes/glitches with its shot), vignette, scanlines, Bayer dither and the
  palette LUT. Text therefore gets the same palette snap as the 3D image and every output pixel
  stays in the palette (tested). Overlay pixels are opaque or absent; partial opacity is an
  ordered (Bayer 4x4) dissolve, so cards fade as one block in pixel-art style. An empty overlay
  is not re-uploaded.

## API (`ctx.text`, immediate mode)
`title(text, opts)`, `lowerThird(primary, secondary, opts)`, `kinetic(words, opts)` are called in
`update(t, …)` every frame; `at`/`until` decide visibility and enter/exit animations (`none`,
`fade`, `wipe`, `pop`, `typewriter`, `shake`, `slide-*`) are pure functions of t (shake = hash of
card seed and a 24 Hz step). Kinetic words reveal per `perWordDelay` or per-word `t` (e.g. from
`ctx.anchor`), styles `pop` / `typewriter` / `shake`, optional highlight of the newest word.
Positions are normalized frame coordinates, sizes integer scales (defaults: title 3 at 360 px
high, lower-third primary 2, mono 1). `measure(text, style)` returns `{w, h, lines}` in low-res
pixels with word wrap; `safeArea` comes from the style preset (`safeArea: {x, y}`, default 5 %).
Options are validated with strict zod schemas; errors name the call, card id and option. Drawing
calls in `build()` throw `text-outside-update`.

## QA
Every call registers a card `{id, kind, text, box, at, until, visible}` (`box` = inked pixels +
shadow/plate at rest). `collectCardTimeline(shot)` samples a built shot (GL-free, works in Node)
and `checkCards(timeline)` reports `card-overlap` (two visible cards intersect) and
`card-outside-safe-area` (with per-side overflow and frame clipping), merged into time ranges,
with an LLM-readable message and fix. Goldens: title / lower third mid-wipe / kinetic mid-pop in
`voxel-pixel-crisp640` and `soft-480`.

## Addendum (2026-10-11, PLAN.md#14.18): world exception "c-cam system fonts"
Grim Ink (`c-cam`) follows its prototype films over this ADR (Papi: "the engine must speed up work, not limit it").
In that world only, text is lettered with the SAME system fonts as the prototypes (`docs/concepts/c-cam-style/films/*/js/
{brushes,timeline}.js`): Arial Black and Impact for captions, poster words, titles and labels, Georgia / Times New Roman
for ledgers, Courier New for digits. Rules of the exception:
- Drawn by the kit (`env.ink.text(text, { role })`, `env.ink.titleCard`, the world's captions) on the ink stage's CPU canvas
  with `fillText` / `strokeText`; scene and module source still never call `fillText`, set `font` or touch `document`
  (lint), and never see the canvas context.
- Fonts are never shipped: only the fonts installed on the user's machine are used (`docs/licenses.md`).
- Determinism is per machine. Availability is probed once per frame source with `measureText` against the generic
  families; a role whose fonts are missing (CI Linux, cloud) draws with the CC0 ink lettering at the same cap height and
  width, so goldens stay deterministic. The probe result is part of the export cache key and a fallback is named in the
  export report ("font fallback used").
- Captions of this world use role `caption` on the ink stage (bold 46 px, bone fill, 11 px ink outline); every other world
  keeps the pixel captions of this ADR byte-identical.

# Transition kit (ReelForge 2.0)

PLAN.md#12.15, ADR-011. Pixel transitions between shots, including look-to-look transitions
(A → B → C rolls), picked per pair of looks, palette-pure, deterministic, identical in preview and
export.

## How it works

A storyboard transition is `transitionIn: { type, duration, style? }`. Without `style` the plain
`type` (`crossfade` / `glitch` / `wipe`) renders exactly as before 2.0 (GPU composite before the
post pass; old projects keep every frame). With a `style`:

1. The engine renders the outgoing shot (A) and the incoming shot (B) each through the full post
   pass (dither, LUT, vignette): their normal frames, palette only.
2. `compositeTransition(style, { palette }, A, B, p, seed)` (`packages/engine/src/transitions/`)
   picks for every pixel a pixel of A or B — through masks driven by the progress `p`, an 8x8
   Bayer threshold, geometry and the transition seed — or a palette tone (`Tones`: the palette
   sorted by luma; `shift(pixel, ±n)` moves along it). No colours are blended, so every output
   pixel is a palette colour by construction.
3. `EngineRuntime.readFrame` returns the composited frame. Preview (`seek`) and export (the
   `FrameSource` calls the same `seek`) share this code; a test exports a film and compares every
   transition frame with the preview byte for byte.

`p` = (t − shot.t0) / duration; the seed is `shotSeed(project seed, "transition:<shot id>")`. An
unknown `style` renders as its plain `type` (the validator reports it).

## Styles

| Style | Type | Duration | Look pairs | Look |
| --- | --- | --- | --- | --- |
| `pixel-wipe` | wipe | 0.25–0.6 s | any | 8-px stair-stepped edge with a 2x2 dithered fringe; direction (right/left/down/up/diagonal) from the seed |
| `dither-dissolve` | crossfade | 0.3–0.8 s | any | ordered (Bayer) dissolve in 2x2 cells, matrix offset by the seed |
| `glitch-cut` | glitch | 0.2–0.45 s | any | 10-px bands displaced (4-px steps), 32x8 blocks from the other shot, ±2 palette tone swaps, peak at mid, cut around 0.5 |
| `iris` | wipe | 0.3–0.7 s | any | 4-px stair-stepped circle from the centre with a bright B rim |
| `scanline-sweep` | wipe | 0.3–0.6 s | any | interlaced: even rows, then odd rows, top to bottom, behind a bright 2-px scan line |
| `mosaic-reveal` | crossfade | 0.3–0.7 s | any | pixel blocks 1→16 px and back; 16-px tiles switch A→B in seeded order |
| `crt-zoom` | glitch | 0.5–0.8 s | `* → retro-ui`, `retro-ui → *` | zoom ×4 into the centre with scanlines, collapse to a line (power off), B powers on from a line |
| `tile-flip` | wipe | 0.5–0.8 s | `* → diorama`, `diorama → *` | diagonal wave of 24-px tiles flipping (checker: alternate axes), dark gaps, shaded edge-on |
| `draw-over` | wipe | 0.4–0.8 s | `* → blueprint`, `blueprint → *` | slanted pen line (brightest tone) sweeps right; 16-px construction grid ahead, B hatched in behind |
| `pixel-sort-melt` | glitch | 0.4–0.8 s | any look change with a C-roll side | 2-px columns fall with random-walk delays; their leading rows are luma-sorted streaks; B behind |

The last four are **look-change specials**: only where the look changes (validator error
otherwise). p = 0 always gives A exactly, p = 1 gives B exactly (unit-tested).

Metadata (`TRANSITION_STYLES` in `packages/shared/src/transitions.ts`): id, label, description
(one line in the storyboard prompt), plain `type`, duration range + default, look pairs (`*` =
any look, optional rolls), `lookChange`, vibe tags. The engine registry `TRANSITIONS` adds the
compositor to every entry.

## Choosing a style

- **Storyboard prompt** (`mixed` look mode with 2+ looks only; `voxel-only` text is byte-identical):
  lists the styles the available looks can use (`availableTransitionStyles`), the pairing rule
  and "never the same style twice in a row". Transitions stay at act changes as before.
- **`transitionFor(fromLook, toLook, rolls, seed, { recent, avoidRecent })`**
  (`packages/shared/src/transition-picker.ts`): deterministic; candidates = styles suiting the
  pair; specials weigh 3 where the look changes; the last `avoidRecent` (default 1) styles in
  `recent` are skipped — the hook for repetition control (PLAN.md#12.23).
- **Storyboard stage** (`mixed`): after validation, `assignTransitionStyles` fills `style` into
  every non-cut transition that has none (keeping the duration when the style allows it) and
  aligns `type` with a named style; storyboard.json is written back only when something changed.
- **Validator** (`packages/prompts/src/validators/storyboard.ts`, only when a `style` is set):
  unknown id = error `transition-style`; special on a same-look pair = error
  `transition-special`; pair the style does not suit = warning `transition-pair`; duration outside
  the style's range = warning `transition-duration` (plain transitions keep 0.2–0.6 s).

## Sound

`lookChangeSlot` (`packages/stages/src/sound/palettes/index.ts`): a look change through a special
plays its own sound (`TRANSITION_STYLE_SFX`: CRT power-on, paper flip/servo, pencil/plotter,
glitch/downer); other look changes keep the entered look's accents; within one look the palette's
usual `transition-*` sound plays (the gesture kind follows `type`). Voxel-only films never reach
it (one palette).

## Tests

- Unit: `packages/engine/src/transitions/transitions.test.ts` (A at 0, B at 1, determinism,
  palette purity at 19 progress values per style, masks, seeds), `packages/shared/src/
  transitions.test.ts` (pairs, picker, a synthetic 8-minute storyboard: no special on same-look
  pairs, no style twice in a row, valid durations, every style used), validator, prompt, stage
  and sound tests.
- Render: `packages/engine/test/render/transition-kinds.test.ts` (every style at p = 0.5 between
  two synthetic shots, goldens `transition-kind-<style>`, byte-equal to `compositeTransition` of
  the two shots' own frames); `packages/kit/test/render/transition-looks.test.ts` (one film over
  every ordered pair of voxel / retro-ui / diorama / blueprint, p = 0.35 / 0.65, goldens
  `transition-look-<from>-<to>-p<35|65>`, contact sheet `packages/kit/out/contact/
  transition-looks.png`); vibe guard on every golden.
- Parity: `packages/pipeline/src/export/transition-parity.integration.test.ts` (export frames =
  preview frames).

## Adding a style

1. Add the id to `TRANSITION_STYLE_IDS` and its entry to `TRANSITION_STYLES` (shared): type,
   duration range within 0.2–0.8 s, pairs, `lookChange`, vibe, a one-line description.
2. Write the compositor in `packages/engine/src/transitions/` (`basic.ts` for any-pair styles,
   `looks.ts` for specials): a pure `Compositor` that writes only pixels of `a`/`b` or `tones`
   values, gives A at p = 0 and B at p = 1, and uses only integer hashes (`hashOf`, `unit`),
   `bayerThreshold` and plain arithmetic (no `Math.random`, no trig needed). Register it in
   `COMPOSITORS`.
3. Optional: a sound in `TRANSITION_STYLE_SFX`.
4. Run `pnpm test` (the unit tests cover every style automatically) and `pnpm test:render`
   (writes the new `transition-kind-*` golden; look at it). The storyboard prompt lists styles
   from the table, so no prompt edit is needed (update the `looks.test.ts` expectations).

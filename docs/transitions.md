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

## Wow transitions (ReelForge 2.3.7, ADR-028)

Rare showpieces for any look pair, chosen by **content** (the storyboard names one where the shot is
about what it fits), about one per 40–90 s. `transitionIn.focus: { x, y }` (0..1 of the outgoing
frame from the left / top; default the centre) is the subject they enter, break at or dive into.

| Style | Family | Type | Duration (default) | Focus | Fits (content tags) | Look |
| --- | --- | --- | --- | --- | --- | --- |
| `enter-lens` | enter | wipe | 0.7–1.3 s (1.0) | yes | surveillance, search, detail, investigation, evidence, clue | a magnifying glass (metal rim, wooden handle, glint) pops onto the subject showing it magnified, the subject dissolves into B inside, the lens rushes at the camera while A zooms (nearest neighbour) and dims around it |
| `enter-binoculars` | enter | wipe | 0.8–1.4 s (1.1) | yes | watching, distance, spying, lookout, wildlife, horizon | a black two-circle mask closes on the subject, A zooms and goes out of focus (mosaic), B comes into focus (8 -> 1 px blocks), the mask opens |
| `enter-window` | enter | wipe | 0.6–1.2 s (0.9) | yes | place, people, home, building, inside, neighbourhood | a four-pane window with a sill pops onto the subject, B behind the glass (reflections), the camera flies through the pane on the subject |
| `enter-keyhole` | enter | wipe | 0.8–1.4 s (1.1) | yes | secret, hidden, private, locked, conspiracy, mystery | a dark plank door with a rounded brass plate closes around the subject, B shows through the keyhole, the camera pushes through |
| `paper-roll` | texture | wipe | 0.6–1.2 s (0.9) | – | documents, records, archive, scroll, map, contract | A rolls up from an edge (seed) into a growing cylinder (the picture wraps around it, dither shading), B under it with a soft shadow |
| `cube-smash` | texture | glitch | 0.8–1.4 s (1.1) | yes | games, digital, collapse, destruction, blocks, disruption | three voxel cubes fly at the screen (the first at the focus), impact bursts, jagged cracks run along a hidden block wall, the blocks fall away with voxel side faces, nearest first |
| `sponge-wipe` | texture | wipe | 0.8–1.4 s (1.1) | – | correction, explanation, whiteboard, cleaning, reset, mistake | a kitchen sponge (foam + green pad) scrubs three bands left / right / left, wavy edges, wet streaks of A and foam that dry up by the end |
| `page-turn` | texture | wipe | 0.6–1.2 s (0.9) | – | history, books, chapter, story, diary, past | the picture peels off from a corner (seed) along a straight fold; the flap shows the paper back with a curl highlight; shadows on both shots |
| `shatter` | texture | glitch | 0.7–1.3 s (1.0) | yes | failure, crash, security, breach, shock, broken | impact star and shake at the focus, a spider-web of jagged rays and straight ring chords spreads, shards drop away (inner first), turning and shrinking, glass-edged |
| `dive-in` | dive | crossfade | 0.6–1.2 s (0.9) | yes | scale, zoom, micro, inside, cells, atoms | A zooms 1 -> 8x into the focus with growing mosaic and speed lines, 16-px tiles flip to B at 8x, B settles to 1x on the same point |
| `dive-out` | dive | crossfade | 0.6–1.2 s (0.9) | yes | scale, space, zoom, city, planet, big picture | the camera pulls back 8x: A shrinks into the focus point of B, which sharpens around it; A dissolves once small |

Rules (`WOW_RULES`, `packages/shared/src/wow-transitions.ts`; validator
`packages/prompts/src/validators/wow.ts`, run on every storyboard that names a wow style):

- `wow-early` (error): none in the first 6 s, except an `enter-*` into a shot marked `"hook": true`.
- `wow-spacing`: two wow moments closer than 25 s = error, closer than 40 s = warning;
  `wow-budget`: more than one per 25 s of film = error, more than one per 40 s = warning.
- `wow-in-a-row` (error): never two consecutive shots opening with a wow transition, except a
  **scale sequence**: `dive-in` / `dive-out` chained over consecutive shots all marked
  `"scaleSequence": true` (flat -> street -> city -> globe), which counts as one moment;
  `wow-scale-sequence` (warning) above 4 chained dives.
- `wow-repeat` (warning): the same wow style within 90 s. Repetition control (PLAN.md#12.23,
  `docs/repetition.md`) reports it too (window 90 s for wow styles, scale-sequence dives excepted)
  and proposes a plain style.
- `wow-too-long` (error): longer than the shot; `transition-duration` (warning) outside the range;
  `transition-focus` (warning): `focus` on a style that does not use it. A focus outside 0..1 does
  not parse.

Choosing: the storyboard prompt (`mixed` with 2+ looks; voxel-only text unchanged) lists the wow
styles with their content tags and the film's budget (`wowBudget`: one per 40 s, at least one) and
asks Claude to choose by content and set `focus` on the thing being entered. `transitionFor` never
picks a wow style unless the caller allows one (`wow: { content, avoid }`); then only wow styles
whose content tags the shot's intent names are candidates (weight 4). `assignTransitionStyles`
allows one only from 6 s on, at least 60 s from any other wow transition, not next to one, in a
shot of 2.4 s or more, avoiding wow styles used within 90 s. Repetition re-picks never choose one.

How they are drawn: `enter.ts` (portal: the shape per 2x2 cell, A zoomed nearest-neighbour around
the focus outside, B inside, size and centre per phase; the size at which a shape covers the frame
is searched numerically), `paper.ts` (roll, page, sponge), `shatter.ts` and `cube-smash.ts` (a piece
map per pixel built once per transition with `lastValueCache`, then pieces drawn by inverse mapping
with rational rotations, `pieces.ts`), `dive.ts`; helpers in `wow.ts`. Only copies of A / B pixels
and palette colours (`tones.nearest(0xRRGGBB)` for materials: paper, brass, wood, sponge), no
trigonometry (diamond angles, half-angle rotations, a polynomial arc).

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

`lookChangeSlot` (`packages/stages/src/sound/palettes/index.ts`): a wow transition always plays its
own sound in the entered palette's voice (`palettes/wow-sfx.ts`: swoosh / whoosh for enter and dive,
`paper` / `paper-slide` for the roll, `page-flip` for the page, `eraser-swipe` for the sponge,
`glass-crack` for shatter and cube smash, the cubes landing 0.15 s in; a retro UI window chirps
open, flat 2D uses `whoosh-flat`, paper cut-out and blueprint their paper sounds); a look change
through a special plays its own sound (`TRANSITION_STYLE_SFX`: CRT power-on, paper flip/servo, pencil/plotter,
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
  preview frames, including a `shatter` with a focus point).
- Wow: `packages/engine/src/transitions/wow.test.ts` (exact ends and palette purity at 19 progress
  values for every focus style at corner focus points, the focus is followed, cached geometry
  stays deterministic, masks, dives), `packages/shared/src/transitions.test.ts` (picker by content,
  an 8-minute storyboard within the budget), `packages/prompts/src/validators/wow.test.ts` (every
  rule, an 8-minute storyboard with no issue), repetition and sound tests; render goldens
  `transition-wow-<style>-p35|p65` (engine, synthetic shots, byte-equal to `compositeTransition`
  with the focus) and `transition-wow-look-<style>-p35|p65` (kit, six real look pairs, contact
  sheet `packages/kit/out/contact/transition-wow-looks.png`).

## Adding a style

1. Add the id to `TRANSITION_STYLE_IDS` and its entry to `TRANSITION_STYLES` (shared): type,
   duration range within 0.2–0.8 s, pairs, `lookChange`, vibe, a one-line description. A wow
   style goes into `WOW_STYLE_IDS` / `WOW_STYLES` (0.5–1.4 s, family, content tags, focus) and
   needs a sound in `WOW_STYLE_SFX`.
2. Write the compositor in `packages/engine/src/transitions/` (`basic.ts` for any-pair styles,
   `looks.ts` for specials): a pure `Compositor` that writes only pixels of `a`/`b` or `tones`
   values, gives A at p = 0 and B at p = 1, and uses only integer hashes (`hashOf`, `unit`),
   `bayerThreshold` and plain arithmetic (no `Math.random`, no trig needed). Register it in
   `COMPOSITORS`.
3. Optional: a sound in `TRANSITION_STYLE_SFX`.
4. Run `pnpm test` (the unit tests cover every style automatically) and `pnpm test:render`
   (writes the new `transition-kind-*` golden; look at it). The storyboard prompt lists styles
   from the table, so no prompt edit is needed (update the `looks.test.ts` expectations).

# Brief 02 — PLAN.md#14.7: CC0 ink-stroke lettering for the C-CAM world

Branch: `phase-14/ccam-lettering`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first (rules).

## Goal
The C-CAM films use system fonts (Impact, Arial Black, Arial, Georgia, Courier New, Times New Roman)
which ReelForge may not ship (CLAUDE.md §6: only OFL/CC0 fonts, with a row in `docs/licenses.md`).
Provide the replacement: hand-made ink-stroke lettering as data plus drawing helpers, so titles, poster
words, stamps, labels and digits can be drawn with the style's ink ribbon line. Mandatory before any
release of the world.

## Read first
- `docs/concepts/c-cam-style/README.md`, `docs/01-STYLE_GRAMMAR.md` (§2 line, §9 text),
  `docs/07-REELFORGE_INTEGRATION.md` (§9 fonts), `docs/04-CHARACTER_GUIDE.md` (tone), the films'
  `js/brushes.js` (`ST.label`, `ST.posterWord`, `ST.inkLine`, ribbon width swell 0.4–1.9x) and the
  call sites: `rg -n "posterWord|ST.label|fillText|font" docs/concepts/c-cam-style/films/*/js`.
- The existing CC0 stroke glyphs of the Sketchbook world:
  `packages/kit/src/worlds/sketchbook/draw/glyphs.ts` and `docs/licenses.md` (its row).
  `docs/decisions/ADR-005-pixel-text.md` (why no `fillText`).
- Sketchbook/Comic lettering code for how glyph strokes become ink:
  `packages/kit/src/worlds/sketchbook/draw/`, `packages/kit/src/worlds/comic/draw/fonts.ts`.

## Do
1. New module `packages/kit/src/worlds/c-cam/lettering/` (no world registration, no world `index.ts`:
   another session builds the skeleton later). Content:
   - `glyphs.ts`: stroke skeletons (polylines/quadratics in a unit em box) for A–Z, a–z (or caps-only
     with a documented fallback to caps), 0–9 and the punctuation the films use (. , ! ? : ; - ' " / %
     + = ( ) # & @ and the dash/ellipsis). Two faces: (a) `hand` — loose handwriting for labels, notes,
     ledger lines (start from the Sketchbook CC0 glyphs, extend/adjust); (b) `poster` — fat stencil/block
     capitals and digits for titles, DSKY digits, stamps (CLACK, MASTER ALARM style). Original work
     only; no tracing of fonts; state CC0-1.0 in the file header.
   - `layout.ts`: pure functions: measure text, wrap, tracking, baseline wobble and per-glyph
     rotation/scale jitter derived from an integer hash of (text, index, seed) — deterministic, no
     Math.random/Date.
   - `draw.ts`: draws a string through a tiny interface
     `InkSurface { ribbon(points: readonly Pt[], widths: readonly number[], fill: string): void }` so it
     can be wired to the world's ink ribbon later and to a recording mock in tests. Ink width swells
     along each stroke (0.4–1.9x of a base width) and strokes taper at open ends, per the grammar.
   - `thud-in.ts` (if time): the title "thud-in" helper: scale 1.6 -> 1.0 with a 2-frame overshoot as a
     pure function of t, on twos (12 fps quantised).
2. A deterministic specimen: a script or test that produces the full character sheet as an SVG under
   `packages/kit/test/support/` (and as an image in the PR description if the tooling allows): all
   glyphs in both faces plus 3 sample titles, so the maintainer can look at the faces.
3. Licence: a row in `docs/licenses.md` ("C-CAM ink lettering, own work, CC0 1.0") like the existing
   glyph rows.
4. Tests (vitest): every glyph used by the films' strings exists (extract the strings from the films
   with a small list in the test: titles, labels, DSKY digits), layout determinism (same input -> same
   output), measure/wrap, no forbidden APIs in the module (Date, Math.random, performance, document).
5. Text-provenance guard awareness: document in the module header which function name the anti-slop
   text guard must treat as an on-screen text call (`packages/stages/src/slop/*` lists text-calling
   methods per world). Do NOT edit it now; list the needed entry in the PR description.

## Acceptance
`pnpm typecheck`, `pnpm lint`, targeted vitest green; licences row present; the PR description includes
the specimen and the coverage list (which strings of the three films are covered).

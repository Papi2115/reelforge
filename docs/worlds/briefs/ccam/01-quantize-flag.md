# Brief 01 — PLAN.md#14.1: style preset without palette quantization

Branch: `phase-14/ccam-quantize-flag`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first (rules).

## Goal
Let a style preset opt out of the palette snap so a full-colour world ("Grim Ink") can reach the screen
and the export with unchanged pixels. Every existing style must render byte-identically.

## Context (verified facts)
- The palette snap is the last step of every frame: `packages/engine/src/gl/post-shader.ts` (LUT, ~line
  208). The LUT is built unconditionally in `packages/engine/src/style.ts` (`resolveStyle`, ~line 158).
  The palette is 2..32 colours (`packages/shared/src/palette.ts`); merged overrides are capped too
  (`style.ts` ~line 97). Dither knobs: `dither.spread` (`packages/shared/src/style-preset.ts`).
- The preset schema `stylePresetSchema` (`packages/shared/src/style-preset.ts`) has no opt-out key and
  is not `.strict()` (unknown keys are stripped).
- There is also a CPU reference of the post pass used by tests/goldens (find it with
  `rg -n "dither|lut" packages/engine/src packages/engine/test`). Both paths must honour the flag.
- Existing presets: `packages/engine/src/presets/*.json`. World styles live in
  `packages/kit/src/worlds/*/style.ts` (palette + fonts + resolution).

## Do
1. Add an optional field to the preset schema, e.g. `quantize?: boolean` (absent or true = today's
   behaviour). Document it in the schema comment and in the doc that describes presets
   (`rg -n "dither" docs | head`).
2. `style.ts`: when `quantize === false` do not build/apply the LUT and do not require a 2..32 colour
   palette for the output (the palette tokens stay for text and annotation colours: keep a valid small
   palette for them but the output must not be snapped). `post-shader.ts` and the CPU reference: skip
   the snap and the dither offset; keep transitions, vignette and every other pass unchanged.
3. Make sure transitions and the vignette still work in truecolor and that the export path (readback,
   ffmpeg) is unchanged.
4. Tests: (a) schema: absent flag = existing behaviour, `quantize: false` accepted; (b) a render/unit
   test: a full-colour test style where a pixel colour outside any 32-colour palette passes through
   unchanged (render a flat colour such as #7a5c3e through the real post path and compare the exact
   value); (c) all existing golden tests untouched and passing (`pnpm test:render`).
5. Do NOT add any world or style yet; the flag is infrastructure.

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test` (at least engine, shared, kit) and `pnpm test:render` green;
zero changes to existing golden PNGs; the PR description lists files, results and the exact semantics
of the flag.

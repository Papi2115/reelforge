# Brief 11 — PLAN.md#14.18: pipeline and kit fixes found by the first Grim Ink sample

Branch: `phase-14/ccam-fixes-1`. Repository: Papi2115/reelforge.
Read `docs/worlds/briefs/ccam/README.md` first, then `docs/real-run-grim-ink-1.md` (defect table).
These are engineering fixes, independent of brief 09 (direction) and brief 10 (lab).

## Do (each with tests)
1. **Validators in the build loop.** `reelforge people-preview` (packages/cli/src/commands/
   ink-preview.ts, packages/cli/src/ink/preview.ts) and the c-cam build stage QA must show the
   `validateCharacter` findings (errors AND warnings, with fix hints) in the CLI output that the
   build/fix turns read, in a compact list (<= 25 lines, grouped by rule). The fix turn must receive
   them verbatim. Verify that the champion-type failures (`hand-in-head`, `contact-miss`) are visible
   in the preview output; add a test with a deliberately broken person.
2. **Captions.** (a) In c-cam films the captions must use the world's ink-stroke lettering (the
   lettering module `packages/kit/src/worlds/c-cam/lettering`) instead of the engine pixel display
   font — add a captions style hook per world (engine captions layer: packages/engine/src/text/
   captions.ts; keep every other world byte-identical). (b) The highlighted word must stay readable
   on any ground: use outline + the palette's brightest/darkest ink contrast, never `accent1` alone;
   test contrast against the c-cam sand colours. (c) Captions must not overlap scene lettering:
   reserve the caption band (bottom 18%) and make scene lettering avoid it (c-cam prompt/doc rule +
   a guard in the anti-slop layer that flags text drawn inside the band when captions are on).
   (d) A film-level captions switch: project setting `captions: 'off'|'words'` (project.json
   schema + Project settings UI row + manifest flag), default off; shorts keep their own.
3. **Accent-colour guard.** It fires when the accent object shares the colour of the ground
   (mustard on sand). Make the guard measure accent coverage relative to objects that are NOT
   the ground/set (use the render's object-layer or the palette index of the accent drawn through
   `ink` accent helpers), or exempt the ground colours of the place's palette; add tests built
   from the sample's frames (use goldens / synthetic frames).
4. **Prop rendering.** In the sample the editor's sword and cloth props never rendered and his arm
   came out of mid-chest in s04. Reproduce with the generated module (it is in the report /
   `packages/kit/examples/c-cam/lab` is not available yet: write a minimal person that holds a prop
   via `held(...)` and `arms(p)` per the contract), find the bug (prop drawn off-canvas? `held` not
   called for `after`? shoulder anchor from the wrong view?) and fix it in the rig/contract with a
   render test.
5. **Music mood + transitions.** The c-cam sound palette must declare its own music moods (dry,
   low, tense: map to existing beds: e.g. `tense-investigation`, `calm-tech` variants — do not use
   `lofi-chill`) and the storyboard validator must not warn `interrupt-transition` for worlds with
   `cutsOnly` (c-cam).
6. **Length control.** Script prompt for worlds with a target length: state the words budget from
   150 wpm explicitly in the prompt (`~2.5 words/s × target`), and add a validator warning when
   the script exceeds it by > 10%. Only the c-cam path changes.
7. **Docs/period props.** Add to the c-cam craft brief/guard vocabulary a one-line rule: props must
   be period-correct (no modern bound books in antiquity); list a few neutral `kind`s for
   writing surfaces (scroll, wax tablet, ledger sheet) in the kit-docs people/places topics.

## Acceptance
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:render` (goldens regenerated only where the
change is intended: list them); other worlds byte-identical; PR description with before/after for
each item.

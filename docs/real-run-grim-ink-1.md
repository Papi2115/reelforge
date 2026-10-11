# Real run Grim Ink 1: "What If You Won Your Freedom in the Colosseum?" (PLAN.md#14.14)

Date: 2026-10-10 · Claude Code CLI on the user's subscription (sanitized env, every turn
`apiKeySource: none`) · Windows 11 · run by the Coder through the stage code: `StageRunner` with
`experimentalWorlds: true`, scenes `concurrency: 2`, `maxFixIterations: 1`. Code: branch
`phase-14/ccam-wave3a` at e4bdae7, clean tree; before the run `pnpm exec tsc -b`, `pnpm build:cli`,
`pnpm check:cli-bundle` (up to date). Project by `createProject({ style: 'c-cam' })`: fps 24,
`lookMode mixed`, `continuityLinks`, `antiSlopGuards`, research mode set to off (no asset fetch; the
research turn still used WebSearch/WebFetch for facts). Driver `scratch/real-run-ccam-1/`
(gitignored): `drive.mjs`, `sheets.mjs`, logs `*.out`, `run-log.jsonl`.

Output: `C:\Users\galar\Desktop\ReelForge-test-films\grim-ink-test-1.mp4` (31.96 s, 1920×1080
**24 fps** H.264 **NVENC** first try + AAC, 12.7 MB), `grim-ink-test-1-contact-sheet.png` (3 frames
per shot), `grim-ink-test-1-modules.png` (the 5 module QA sheets), project
`grim-ink-test-1 work\Colosseum Freedom\`. No transitions sheet: every cut is a hard cut (world rule).

## 0. Papi's rules for this run (no voice)

- **Voice-over = silence.** `silent-vo.wav` (16-bit mono 48 kHz digital silence, 32.0 s) imported by
  the real **voiceover** stage (`audio/vo.original.wav`).
- **Words = synthetic 150 wpm**: the real **words** stage ran with the driver's audio tools, whose
  `transcribe` returns script words at 0.4 s each (sounding 0.36 s), +0.4 s after every sentence
  end and paragraph, lead 0.3 s, tail 0.5 s → `timing/words.json` (68 words, 100 % coverage,
  `synthetic-150wpm`), report and stage state written exactly as for whisper.
- **Length:** the script stage wrote 68 words (brief: "at most 68 words"); with the 0.4 s pauses
  (11 sentences) that is **32 s, 2 s over the 30 s cap**. Kept as written (no hand edit of the
  script); the next run should ask for ~62 words.
- **Captions on:** a film has no captions switch (`captionsOn()` is short-only), so the driver's
  export manifest sets `captions: true` (same field the shorts use). No product change.
- **Audio cleaned / mix refuse digital silence** (by design: "input is silent", "voice-over is
  silent"). Workaround, test only: `audio/vo.clean.wav` = pink noise at **-62.6 LUFS** (ffmpeg
  `anoisesrc`), ~48 dB under the -14.07 LUFS mix; the clean stage stays `failed` in
  `pipeline.json`. Not a pipeline bug for real films.

## 1. Script and facts

Research (Sonnet, 3 sources: archaeology.org glossary, Smith's Dictionary via LacusCurtius,
Wikipedia "Gladiator"), then script + one repair (62 → 68 words):

> You've just won. The crowd wants you free, and the editor hands you a wooden sword. The rudis. So
> what do you do with freedom? / Volunteers were released from their contract. A slave might be
> freed, though sources disagree. / But here's what some did next. They went back. The arena paid.
> Freedom, it turns out, was optional. Tiberius reportedly offered retired gladiators one hundred
> thousand sesterces to return.

Fact check: rudis given by the editor, often at the crowd's request ✓; volunteers (auctorati)
released ✓; slave freed vs only discharged is genuinely disputed and hedged ✓; Tiberius' 100,000
sesterces to retired gladiators = Suetonius, *Tib.* 7 ✓ (hedged "reportedly"). "Some went back",
no invented count ✓. No invented numbers, names or dates.

## 2. People and places (`{stage:'scenes', action:'c-cam-modules'}`)

1022 s, 6 Opus build turns + 4 Haiku critic turns, $4.06. Sheets: `.reelforge/frames/<kind>/<id>/qa-*.png`.

| Module | Result | Notes |
| --- | --- | --- |
| people `champion` (freed gladiator: huge jaw, tiny helmet, shield) | **⚠ placeholder** after build + 1 fix | The built module looked right (bronze cap, stubbled jaw, plum shield on the back, 14 acting faces, `signatureGag: fidget`), but the stage's validators failed it: `hand-in-head` (18 cases, jig pose: palm 13.5 px inside the head box) and `contact-miss` (handshake: palms 6.5 px apart). The fix turn said "I could not run the handshake contact validator from here": `reelforge people-preview` does not run `validateCharacter`, so the fix was blind. The grey-coated stand-in is what the film shows. |
| people `editor` (bloated toga, stick body, sniffs a perfumed cloth) | ✓ (1 attempt, critic ok) | Note `guard-out-of-reach` (jig). The turn reported its `props.sword` / `props.cloth` never appear on the sheet. Reads well: laurel, toga + purple sash, long nose. |
| places `arenaSand` | ✓ | Awning, crowd dots, barred gate, raked sand, blood drag, half-buried helmet. Good. |
| places `ludusOffice` | ✓ | Lamp, pigeonholes, peg sword, desk. **Ledger stacks read as modern bound books** (the turn said so itself; the critic passed it). |
| places `arenaGate` | ✓ | Arch, rusted bars, chalk slate with hand-stroked `100 000` digits (option `digits`), footprint trail options. Best module. |

## 3. Scenes, look and checks

Scenes build: 8 shots, 5 ✓ 3 ⚠, 2 fix turns (s03 off-anchor whoosh, s08 off-anchor ticks), no
failure, no denied tool. Treatments: 2 posters (s01, s07), 2 character scenes (s02, s04), 4 ink
inserts (s03, s05, s06, s08).

- **Look vs the Apollo concept film** (`docs/concepts/c-cam-style/films/03-apollo-11/proof/`):
  palette (mud olive, ochre, bone, rust), uneven black ink line, flat grime shapes and the poster
  lettering match the concept well. What is missing is the Apollo film's main strength: **people
  acting in mid/close shots**. Here people are on screen only in s02 and s04 (~10 s of 32), one of
  them a placeholder, mostly in wides with stiff poses; the editor's arm comes out of mid-chest in
  s04. Inserts carry the film (feet turning back s05, coin in the palm s06, chalked price s08).
- **Signature gags:** champion none (placeholder). Editor `cough` (as the cloth sniff) wired on "a
  wooden" (s02) and "sources" (s04); the s02 turn reported it is **not visible** in its frames; the
  contact sheet does not show it either.
- **Camera cuts:** shot-to-shot all hard cuts (world rule); inside shots ~17 framings in 32 s
  (s02 3, s03 2, s04 4, s05 3, s06 2, s08 3; s01/s07 one push-in each) with Dutch tilts in s04/s05,
  short shakes on landings. Pace feels right for the world.
- **Text / lettering:** all scene text is the world's own ink lettering (`ink.drawText` faces
  `hand`/`poster`, `posterLayers`), arenaGate digits are hand strokes — **no system font**. The
  captions use the engine's pixel `DISPLAY_FONT` (own CC0, not a system font) — off-style in an ink
  world. Caption highlight = `palette.accent1` = **mustard**, invisible on the mustard sand and
  poster ("THE **RUDIS**", "SOME DID **NEXT**", "**YOU'VE**"); captions sit over scene lettering
  (s07 "TIBERIUS" tag hidden by "RETIRED", s01 duplicates the poster). s07 letters overlap while
  "NAL" lands, "OP TIONAL" spacing gap when settled.
- **Anti-slop guards (scene QA):** `accent colour on 23 % / 48 % / 37 %` for s02, s03, s05 — **false
  positives**: Grim Ink's `accent1` is mustard, the arena sand is mustard. Storyboard warnings:
  2× `interrupt-transition` ("look-switch reads better with a look-change transition") contradict
  the hard-cut world rule; 2× `shot-length` (s06 1.6 s, s08 2.9 s), 1× `tension-tempo`.
- **Sound:** 17 sfx (pen-click, stamp, paper, coin, hit-soft, ticks), room-tone bed, and **music
  "lofi-chill"** chosen by the sound turn — the c-cam palette defines no music mood; lofi fits the
  "muted" world poorly. Mix -14.07 LUFS, TP -1.87 dBTP.
- **Render time:** 767 frames in 240.8 s with 2 Playwright workers on **SwiftShader (software)** →
  0.31 s/frame wall, 0.63 s per worker-frame (the desktop app renders on ANGLE D3D11, faster).

## 4. Wall clock, turns, cost

`costUsd` = ledger deltas (list-price meter, not a bill). Rate-limit events: 10 `allowed`, **35
`allowed_warning`** (the weekly limit is close to its warning threshold); `limitHits: 0`, no failed turn.

| Stage | Wall | Turns | Output tok | costUsd |
| --- | --- | --- | --- | --- |
| research + script + repair | 86 s | 3 Sonnet | 8.3 k | 0.32 |
| voiceover (silent import) / clean / words (synthetic) | 0.8 / failed 0.7 / 0.6 s | – | – | – |
| tension + storyboard + repair | 121 s | 3 Sonnet | 13.4 k | 0.36 |
| people and places | 1022 s | 6 Opus + 4 Haiku | 86.1 k | 4.06 |
| scenes build | 1182 s | 10 Opus (8 + 2 fix) + 8 Haiku | 165.8 k | 9.54 |
| sound cues / mix | 33 / 3.8 s | 1 Sonnet | 3.2 k | 0.13 |
| export (767 frames, NVENC) | 241 s | – | – | – |
| **Total** | **~45 min** | **35** | 277 k | **14.41** |

Scenes $1.19/shot (Comic 2: $0.99). People and places $0.81/module; the failed champion cost ~2×.

## 5. Verdict: 5/10

The world's look is there — places and inserts are genuinely Grim Ink and close to the Apollo
concept; facts are clean. It loses on people (the protagonist is a placeholder, the rest is wide and
stiff), on captions that fight the style, and on guards that fire on the world's own colours.

Top 5 defects and suggested fixes:

1. **Protagonist ended as a placeholder because the build turn cannot run the validators.** Make
   `reelforge people-preview` (or a new `people-check`) run `validateCharacter` and print the same
   findings the stage QA uses, so build and fix turns self-check; consider keeping the real module
   with ⚠ when only the jig/handshake test poses fail.
2. **Captions off-style and unreadable:** pixel font in an ink world, mustard highlight on mustard
   sand, laid over scene lettering. For c-cam use the world's `hand` face with an ink outline, a
   highlight colour checked against the frame, and keep the band clear of lettering.
3. **Accent guard false positives:** c-cam `accent1` (mustard) is also the base of sand/ochre
   places → every arena shot ⚠. Give the world a distinct accent swatch or measure only pixels
   outside the place's own colours.
4. **People act less than in the concept:** wides with small, stiff figures; editor's props never
   render; arm from mid-chest; gags wired but not visible. Push the storyboard/scene prompts towards
   mid/close character framings (Apollo: faces in most shots) and verify gag visibility in QA.
5. **Small world misfits:** modern bound books in a Roman office (critic passed it), lofi-chill
   music in a muted world (palette has no mood list), `interrupt-transition` warning contradicting
   hard cuts. Add a period check to the place critic, a c-cam music mood, and skip that warning for
   worlds that only cut.

## 6. Pipeline failures

None blocking, no code changed. Test-setup only: clean and mix refuse digital silence (by design),
handled by the -62.6 LUFS bed above. Not fixed (product gaps, listed above): the validator blind
spot in `people-preview` (defect 1), no film-level captions switch.

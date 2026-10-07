# Worlds — quality bible (no AI slop, a human hand in every frame)

Applies to every new world (Style + A/B/C looks): `game-hud`, `comic-panels`, `detective-board`, and to anything after them.
Papi's rule: **the film must feel made by a person with taste, never "generated"**. These rules are binding for the coders who
build the looks, for the prompts that tell the runtime Claude how to build scenes, and for the critic that judges frames.

## 1. The slop tells — never ship these
1. **Everything centred and symmetric**, one big thing in the middle with decorations evenly sprinkled around it.
2. **Decoration without meaning**: floating cubes, random sparkles, orbiting dots, glow gradients, "tech" lines that point at nothing.
3. **Generic icon spam**: a row of unrelated icons standing in for an idea; stock metaphors (lightbulb = idea) used without a twist.
4. **Invented text**: gibberish, lorem-like strings, fake numbers, labels that are not in the narration or research. Every word on screen
   must come from the script, the research notes, or be an obvious real label of the shown object.
5. **Uniform spacing and uniform timing**: every item the same gap, every animation the same easing and duration, everything staggered by
   exactly 0.1 s.
6. **Over-polish**: perfectly clean, perfectly straight, perfectly aligned, with zero trace of a hand. Real craft has small flaws.
7. **Constant motion**: something is always moving, nothing ever holds. The eye never gets a place to rest.
8. **Too many things**: more than ~6 competing elements, three accent colours, five type sizes, text over busy areas.
9. **Same shot twice**: two consecutive shots with the same composition and treatment; the same chart type five times a minute.
10. **Cosmetic camera**: zoom or pan with no reason; a push-in that crops the thing it was supposed to show.
11. **Mascot or character as decoration**: it must do something that serves the sentence (see mascot rules in ADR-025).
12. **Vague literalism**: showing "a computer" for "the system"; show the SPECIFIC thing the narrator names (the 61 KB, the 1976 chip).

## 2. The human tells — every scene needs at least three
Humans leave traces. All of these are deterministic (seeded by shot id + element index, never `Math.random`):
- **Imperfect alignment**: elements off-grid by 1–3 px, slightly rotated labels (±1–2°, pixel-snapped), uneven margins that still look
  intentional; one element deliberately breaks the grid.
- **Hand marks**: scribbled underline, circled word, an arrow drawn in two strokes, a crossed-out word with the correction beside it,
  an ink smudge, tape, a staple, a coffee ring, a thumbprint, a sticky note stuck at an angle.
- **Timing with feel**: stagger delays vary ±30 %, holds are different lengths, a small anticipation before a pop, overshoot and settle
  after, one beat of *silence* before the key reveal.
- **Opinion**: the shot has a point of view (low angle on the threat, big empty space around a lonely number, tight crop on the detail).
- **Specificity**: a real number with units, a real name, a real date, an object with a recognisable shape and a wear mark.
- **Restraint**: one focal point; the rest supports it. Negative space is part of the design.
- **Rhythm**: fast-fast-pause. Never the same tempo for a full minute.
- **Layered depth**: foreground, subject, background with different sharpness/value, not a flat row.
- **Line boil / frame hold** for hand-drawn worlds: shapes redrawn on a 8–12 fps cadence with seeded 1 px wobble, not smooth vectors.
- **Craft sounds**: tiny foley that matches the world (pencil scratch, cartridge click, thumbtack press).

**Deliberate roughness is a feature.** Simple, slightly crude hand-drawn figures and props are part of the charm (Papi loves them): never "polish"
them into slick, symmetric art. Fix a drawing only when it hurts readability.

## 3. Composition rules
- **One focal point per shot**, decided before building: what must the viewer read first? Give it the highest contrast, the largest
  size or the only accent colour. Everything else is lower value.
- **Hierarchy**: three levels at most (hero, support, texture). Texture elements are low contrast and never animate loudly.
- **Asymmetry on purpose**: place the hero on a third or off-centre with weight balanced by negative space.
- **Safe area** 6 % inside the frame for text and key shapes (phones crop). Nothing important in the lower 12 % when captions may overlay.
- **Max elements**: 6 competing items on screen (not counting texture). More only in an explicit "chaos" beat that then resolves.
- **Text**: short (≤ 6 words per line, ≤ 3 lines), reading time ≥ 0.3 s per word on screen, never text over a busy area without a plate,
  pixel fonts at integer scales, no text smaller than 7 px tall at 640×360.
- **Colour**: palette tokens only. 60 % base, 30 % support, 10 % accent; the accent marks the point of the sentence and nothing else.

## 4. Motion rules
- Mix easings: out-back for pops, in-out for travel, linear only for machines. Never one easing for everything.
- Anticipation → action → overshoot → settle for anything that "lands". Hold the landing for at least 0.25 s before the next move.
- Stagger with variance; group by meaning, not by position.
- Camera moves must reveal or emphasise something; end every move on a held frame; never move the camera during a callout.
- At least one **still moment** per shot of ≥ 0.4 s where only micro-motion (blink, flicker, breathing) happens.

## 5. Content rules
- Build from the narration: the shot's nouns and numbers drive the visuals. If the narrator says "twelve hundred", the number 1,200
  is on screen, big, in the accent colour, with its unit.
- Literal first, metaphor second: show the actual thing; add a metaphor only if it sharpens the claim and is visually specific.
- Never invent facts, labels, brand marks or UI text; use the research notes and assets.
- Every shot answers: "what does the viewer learn or feel in these seconds that the voice alone did not give them?" If nothing, cut it
  or merge it with the neighbour.

## 6. World signatures (each world must ship these craft details)
**game-hud** (film as a level): a persistent HUD whose elements mean something — progress bar = film progress, score = a running fact count
or a number from the story, hearts/HP only for a real threat; chapter = checkpoint flag; boss bar only for the central problem; menu and
inventory screens as B-roll; "level up" stinger only once. Human tells: slightly uneven sprite frames, input-lag squash on jumps, screen
shake with decay, a typo-free but *voiced* dialogue box (typewriter with irregular cadence), a developer-note easter egg in a corner.
**comic-panels** (panel grammar): gutters of uneven width, one panel breaking the frame for impact, panel size = importance, lettering
in a hand-lettered pixel face with varied baseline, speech bubbles with tails pointing at the speaker, onomatopoeia drawn as big
imperfect letters, halftone dots with misregistration, speed lines that stop before the subject, a "pause" panel (mostly empty) before
a twist. Never more than 5 panels at once; never identical panels in a grid unless it is the joke.
**detective-board** (corkboard): photos pinned at angles with curling corners, handwritten notes (varied slant), red string that sags
and is pulled taut when a connection is made, pins with shadows, tape strips, a coffee ring, scribbled question marks that become
ticks, a note crossed out and replaced, one photo "peeled off" when a theory dies; the camera travels along the string.

## 7. Review protocol (every showcase frame and every shipped look)
Score each frame 0–2 on: focal clarity · hierarchy · asymmetry/negative space · specificity (real content) · human traces (≥ 3 present) ·
motion feel (judged on the 3-frame strip) · palette discipline · text quality · world signature present · "would a designer ship it".
**Fail below 14/20.** Tests: *squint* (blur it: is the focal point still obvious?), *5-second* (what did you read first, second?),
*thumbnail* (64 px wide, still readable?), *swap* (replace every word with another: does the frame still make sense? if yes it is
decoration). Frames are reviewed by the Manager with the PNGs open, and by the world's critic checklist. A frame with a slop tell from §1
is rejected regardless of score.

## 8. Programmatic guards (to implement with each world)
- **Text provenance**: every on-screen string is checked against the shot's narration words, research notes, asset titles and a
  whitelist of world labels; unknown strings → ⚠.
- **Clutter**: count of distinct high-contrast components per frame ≤ budget; accent-colour pixel share ≤ 12 %.
- **Symmetry/centering score**: left-right mirror similarity above a threshold with the hero centred → ⚠ (except title cards).
- **Uniformity**: identical gaps/durations across ≥ 4 siblings → ⚠ ("stagger variance").
- **Human-trace check**: the scene source must call the world's trace helpers at least 3 times (marks, jitter, hold, correction).
- **Camera sanity**: a move that crops text or ends without a hold → ⚠ (exists for interrupts; extend to all moves).
- **Same-composition detector**: perceptual hash distance between consecutive shots below a threshold → ⚠.

### 8.1 Implemented (v1, PLAN.md#13.7) — `packages/stages/src/slop/`
Warn, never block: every guard reports a ⚠ finding with source `slop` (severity `warning`): no fix turn, no change to the gating
or the critic sampling; shown in the scenes report, the final review and the app's ⚠ chips. Per project switch
`antiSlopGuards` (absent = on for a world's style, off for the built-in styles; the template writes `false`, a world's project
defaults write `true`). Source and frame guards run in every scene QA round and in the final review; the same-composition
detector runs in the final review only (it needs the previous shot's frame). Frames are judged on a block grid (~80 blocks
across, 8 px at 640 wide).

| Guard | Input | ⚠ when | Notes |
|---|---|---|---|
| Text provenance | literal strings of text calls (`page.write`, `ctx.text.*`, local `write` helpers) and text options (`text`, `label`, `note`, `band`, `lines`, `caption`, `title`…; `const` strings resolved; `meta` ignored) | a string has an unknown capitalised/all-caps word (a name or label), ≥ 2 unknown words making ≥ half of it, or an unsourced number | vocabulary = script.txt + words.json + research.md + asset titles, with stems and abbreviations ("Feb"); world labels (Sketchbook: `p.7`, `fig.`, …) and months/weekdays/eras/units allowed. Numbers: in the sources (digits or English number words, "365 and a quarter"), a decade of a sourced number ("1500s"), or the visible result of a calculation with sourced on-screen numbers (sum/difference with any sourced number, product/quotient of two on-screen ones), at the shown precision; 0 and 1 free. One paraphrased word is not flagged. Polish number words are not parsed. |
| Clutter | each checked frame | > 6 competing elements: groups of blocks ≥ 64 (max channel) from the background median, marks ≤ 2 blocks apart merged, ≥ 0.2 % of the frame | pencil texture and paper grain stay below the contrast threshold |
| Accent share | each checked frame | > 12 % of pixels within 30 (RGB sum) of the style's `accent1` | Sketchbook accent = red (corrections) |
| Symmetry/centering | each checked frame, outer 8 % of the width ignored (binding) | mirror similarity ≥ 0.8 (content blocks mirrored by content within 10 luma) **and** content centroid and biggest element both within 5 % of the centre; ≥ 2 % content | `title-card` shots exempt |
| Stagger variance | literal `at`/`dur`/`until` of sibling calls in one block; `for` loops with literal bounds | ≥ 4 siblings of one method with identical start gaps or identical durations; a loop of ≥ 4 items with `at: … i × step` and no call (jitter) in the expression | steps < 0.05 s read as one gesture (a run of ticks) and are ignored; times given as phrases or computed are skipped |
| Human traces | scene source (AST) | < 3 traces | Sketchbook: `tape`, `coffeeRing`, `clip`, `sticky`, `smudge`, `ruler`, `loop`, `underline`, `crossOut`, `arrow` = 1 each; `popup`, `strip` = 3 (they draw their own traces); options `rot` ≠ 0 (jittered lettering) and `tool: 'red'` (correction) = 1 each. Worlds without an entry are not checked. |
| Same composition | last review frame of consecutive shots | layout-signature distance < 0.2 (16 × 9 cells, brightness steps between neighbours as −1/0/+1 with a 4-luma dead band; share of differing non-flat steps) | shots with a continuity link or `continues` are deliberate matches and skipped |

Calibration (unit tests): 0 findings on all 30 Sketchbook goldens (looks A/B/C, pop-up, strip) and 4 voxel goldens, on the 10
Sketchbook template scenes (text, traces, timing) with the showcase narration + research notes; different Sketchbook scenes are
≥ 0.45 apart in layout. 26/26 seeded bad cases caught (`slop/detection.test.ts`). Comic (PLAN.md#13.3 part c): 0 findings
on the 12 comic templates and 36 comic goldens, 24/25 planted fakes caught (`slop/comic-*.test.ts`; the miss: clutter inside
panels, whose inked borders join every mark into one component); its breakthroughs' intents must be grounded in the sources. **Camera sanity** (moves that crop text or end
without a hold, for all moves) is not in v1: it stays with the interrupt check (`source-checks-camera.ts`) — backlog.

### 8.2 Variety (real run Sketchbook 1: "not a single pop-up, I got bored")
A world film must not be one kind of page repeated. The storyboard plans a **page moment** per shot from the script content
(`worldMoment`, a closed list per world) and the validator enforces the variety (errors → the storyboard's repair turn):
- **Breakthroughs** (Sketchbook: pop-up, accordion strip) — on average one per ~50 s; at least 1 from 25 s, then
  max(1, floor(duration / 60)); at most ceil(duration / 35) (never a gimmick); two different kinds once two are needed; never in
  adjacent shots.
- **Every moment kind at most once per 90 s**; never 3 shots in a row with the same moment (or plain) in one roll; never more than
  2 shots in a row in one look; at least 3 different page transitions in a film of 25 s or more (budget unchanged: one per ~20 s).
- **Composition** (craft brief): the hero figure or object ≥ 25 % of the page height, never < 3 elements on the page for > 0.6 s,
  and the hand never ends a shot on the subject (always `sketchPage({ …, duration: ctx.shot.duration })`, last mark ≥ 0.4 s before
  the cut); one hand: no marks > 80 px apart at the same time (they queue ≤ 0.6 s or lose the hand; `parallel: true` on purpose).
- The critic checks that a planned moment is visible (else `off-intent`, `moment:`) and counts only authored marks as traces (never
  the spiral, the paper, the page number or the hand).
Numbers: `packages/prompts/src/worlds/variety.ts` (tunable); catalog per world: `packages/prompts/src/worlds/<world>-moments.ts`.

## 9. How this reaches the runtime Claude
Each world has a short **craft brief** (≤ 1.5 KB) inside its look docs and `STYLE.md`: the §1 tells as a don't-list, the §2 traces as a
do-list with the world's own marks, the focal-point-first process ("write the focal point and the three traces in a comment before the
code"), and 3–4 reference frames from the showcase set (path + one-line critique each) so the model sees what "good" is. The critic
prompt gets the world's checklist and must name the focal point and the traces it found, or fail the shot.

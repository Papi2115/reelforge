# Style: C-CAM · Grim Ink

World style (`c-cam`, experimental, wired in PLAN.md#14.12: offered with Settings → Experimental worlds). Renders at
1920×1080 (no upscale), canvas ink drawing in full colour (`quantize: false`), 24 fps. Hand-built, ugly-lovable caricature
people in specific, grimy places; deadpan acting on twos; a restless TV-cartoon camera with cuts inside a shot. The world is
a grammar, never a catalogue: every film builds its own people and places from its narration. Prompt wording: `packages/prompts/src/worlds/c-cam.ts`; API reference:
`reelforge kit-docs grim-ink`. Moves to `styles/c-cam/STYLE.md` when the world ships.

## Look
- **Line:** only the kit ink line (width swells 0.4–1.9×); silhouettes w 7–8, faces 5–7, details 3–4. Never uniform strokes.
- **Palette:** muddy olive/clay/grey-blue/mustard/rust/plum; skins ruddy/sallow/clay/olive/grey; whites are dirty linen,
  darks are ink. One warm light pool per place, drawn behind people. **One accent object per shot.**
- **Grime as flat shapes:** shade crescents, mottling, hatch clusters, stains, peels, cracks. No textures, filters,
  gradients, noise, paper or watercolour.
- **People:** each one hand-built (`kit-ext/people/<id>.js`, camelCase id), one exaggeration axis, head:body 1:2.7–1:4.2, a torso and a
  head drawn for each view, tiny pupils, heavy lids, 4–6 grit marks, a loud prop with a gag use. Grim realism over goofy
  caricature (no snout noses). Background people stay simple (flat colour, dot eyes, no hatching).

## Composition
- One focal point per framing, off-centre; layered depth (foreground silhouette or table edge, subject, place).
- Places (`kit-ext/places/<id>.js`) are drawn wider than any framing (coverage check); a floor of its own material and
  clutter that tells the place.

## Camera
- 2–5 framings per shot, hard cuts on beats (anchors): establish → the gag object (ECU) → the reaction (CU) → pull-back.
- Moves inside a framing are small (5–40 % zoom, ≤ 100 px pan). Dutch tilt 2–7° only on tense beats; calm framings level.
- Solve hands and props in world space first, then frame them. Over-the-shoulder backs and foreground silhouettes for depth.
- Hard cuts between shots, like a TV show.

## Typography
- No `ctx.text`. Text is `env.ink.text(text, { role })` with the prototypes' own fonts (caption, poster, title, label: Arial
  Black / Impact; ledger: Georgia; digits: Courier New) when installed, else the CC0 ink lettering (`hand`, `poster`), or
  `env.ink.drawText` for the ink lettering itself. Every word comes from the narration or the research.
- Captions (Project settings, off by default): the prototypes' caption pass, bold 46 px Arial Black, bone `#e2d8b8`, 11 px
  ink outline, last line on y 1010, one short line at a time. Scene lettering stays above the bottom 18 % (the caption band).
- The opening shot is a poster that is a ready thumbnail: `env.ink.titleCard({ title, subtitle, cast, place })`.

## Pacing
- Characters act on twos; expressions snap; shock = snap + head jolt for 0.2 s; long deadpan holds (≥ 0.4 s still).
- A recurring gag and a payoff that calls back to it. Breakthroughs (`reverse`, `poster`) about one per 50 s.

## Annotations
- None from `ctx.annotate`; emphasis is a cut to an ECU, a sound word or an ink mark in the place, lettered on the thing it names.

## Avoid
Generic or generated faces; the same face on two people; arms across faces; props held "near" a hand; pools over people;
more than one accent; pure black or white; over-the-top caricature (at most two strong exaggerations per face); polished
symmetric drawing; cosmetic camera moves; tilt on calm beats; a set edge in any framing; scenes > 600 lines (move people and
places into their modules, shared code into `kit-ext/lib`); content from the showcase films.

## Looks of this world
- A = `ink-scene` (the people acting in one place), B = `ink-insert` (an extreme close-up of the thing), C = `ink-poster`
  (the line the film turns on). A project may turn looks off (Project settings → Looks of this world, project.json
  `worldLooks`; at least one stays on): the storyboard then uses only the looks in use, lettered A, B, C by place, and never
  plans the moments only an off look hosts (`poster` needs `ink-poster`; `reverse` and `over-shoulder` need `ink-scene`;
  `insert` needs `ink-insert`).

## Sound
- Palette `c-cam`: dry room foley (a chair creak, a knuckle on wood, a stamp, papers, a pen click, a latch), a quiet room bed;
  music `lofi-chill` under the deadpan holds, `tense-investigation` where the stakes land.

## Ambient variation budget
None (one hand-drawn world; places differ by content, not by tone drift).

## Exceptions to engine rules
Prototype fidelity beats the general engine rules in this world (PLAN.md#14.19, CLAUDE.md §8 2026-10-11). Every exception is
scoped to `c-cam`, has a CI-safe fallback and leaves the other worlds byte-identical; the audit is
`docs/worlds/c-cam-ENGINE-GAPS.md`.
- Size: scenes up to ~600 lines (was ~250); people, places and libraries up to 450 lines, 160 KB, 64 per kind (was 250 / 64 KB /
  24).
- Shared code: `kit-ext/lib/<name>.js` (`export const lib = { … }` of pure functions) as `ctx.kit.lib.<name>` in scenes and
  `ink.lib.<name>` in people and places; same lint, limits and cache-key family as the modules.
- Film time: `ctx.film` (`t`, `duration`, `progress`, `shotIndex`, `shotCount`, `shotT0`, `anchor`) and `ctx.shot.t0` for
  running gags across shots (additive for every style; scenes that do not read it render and cache exactly as before).
- Anti-slop frame budgets measured on the concept films' proof frames (+15 %): 8 competing elements (general 6), accent share
  11.7 % (general 12 %), centred symmetry from mirror 0.84 (general 0.80).
- Critic: at least Sonnet (general: the settings' Haiku), two reference frames of the shot's look (fallback: none when the
  files are not shipped), at least three QA times per framing of the cut table (fallback: the five smoke times), at least two
  fix turns also with Faster checks.
- Fonts (PLAN.md#14.18, ADR-005 addendum): `env.ink.text` and the captions draw the prototypes' system fonts (Arial Black,
  Impact, Arial, Georgia, Courier New, Times New Roman) with canvas `fillText` / `strokeText` inside the kit, only when the
  font is installed (never shipped); fallback: the CC0 ink lettering at the same cap height (goldens, CI). Scene and module
  source still never call `fillText`, set `font` or touch `document`. The export cache key and report name the fallback.
- Captions: drawn by the kit on the shot's ink stage over the scene's frame (other worlds: the engine's pixel captions);
  fallback: the engine's own captions when no stage was painted.
- Accent guard: counts only accent regions that stay inside the frame (the mustard sand and ochre walls reaching the
  frame's edges are the set, not the accent).
- Script length: the prompt states the 150 wpm words budget (~2.5 words/s x target); a script > 10 % over it is a warning.
- Style references: `reelforge kit-docs shots` (technique shots of the concept films, never content; their objects are flagged
  in a scene the narration does not ask for) and `reelforge kit-docs lib`.

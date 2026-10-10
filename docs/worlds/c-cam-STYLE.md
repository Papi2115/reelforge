# Style: C-CAM · Grim Ink

World style (`c-cam`, experimental, not wired yet: PLAN.md#14.12). Renders at 1920×1080 (no upscale), canvas ink drawing in
full colour (`quantize: false`), 24 fps. Hand-built, ugly-lovable caricature people in specific, grimy places; deadpan acting
on twos; a restless TV-cartoon camera with cuts inside a shot. The world is a grammar, never a catalogue: every film builds its
own people and places from its narration. Prompt wording: `packages/prompts/src/worlds/c-cam.ts`; API reference:
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
- No `ctx.text`, no fonts. Signs, sound words and posters use the stage's ink lettering (CC0 strokes: `hand` and `poster`
  faces). Every word comes from the narration or the research. No captions in films.

## Pacing
- Characters act on twos; expressions snap; shock = snap + head jolt for 0.2 s; long deadpan holds (≥ 0.4 s still).
- A recurring gag and a payoff that calls back to it. Breakthroughs (`reverse`, `poster`) about one per 50 s.

## Annotations
- None from `ctx.annotate`; emphasis is a cut to an ECU, a sound word or an ink mark in the place, lettered on the thing it names.

## Avoid
Generic or generated faces; the same face on two people; arms across faces; props held "near" a hand; pools over people;
more than one accent; pure black or white; over-the-top caricature (at most two strong exaggerations per face); polished
symmetric drawing; cosmetic camera moves; tilt on calm beats; a set edge in any framing; scenes > 250 lines (move people and
places into their modules); content from the showcase films.

## Ambient variation budget
None (one hand-drawn world; places differ by content, not by tone drift).

/**
 * Grim Ink (`c-cam`) in the stage prompts (PLAN.md#14.10; docs/concepts/c-cam-style, docs/worlds
 * "a world is a style GRAMMAR"): hand-built caricature people in specific, grimy places, one uneven
 * ink line over muddy flat full colour, deadpan acting on twos and a TV-cartoon camera that cuts
 * between 2-5 framings inside a shot. Look A `ink-scene`, B `ink-insert`, C `ink-poster`
 * (packages/kit/src/worlds/c-cam). The prompts impose the STYLE and a design process per shot
 * (the narration's nouns -> the film's own people and places by id -> the cut table on the beats
 * -> contacts before the camera -> draw order -> every framing checked); the people and places are
 * built per film (`kit-ext/people`, `kit-ext/places`), never replayed from the showcase films.
 * Hard cuts between shots (`cutsOnly`). API names live in c-cam-api.ts.
 */
import {
  C_CAM_API,
  C_CAM_CAST_TAG,
  C_CAM_PLACE_TAG,
  C_CAM_MODULE_TOPICS,
  C_CAM_TOPICS,
  cCamSnippet as snippet,
} from './c-cam-api.js';
import { C_CAM_MOMENTS } from './c-cam-moments.js';
import type { WorldPromptText } from './types.js';

const CRAFT_BRIEF = `Craft brief (Grim Ink; binding). The world gives the GRAMMAR, the narration gives the content: draw what THIS shot names.
- First, a comment: \`// focal: <the one thing read first> | cast: <ids> | place: <id> | traces: <three>\`; build toward the focal point.
- Line: only the ink line (width swells 0.4-1.9x); silhouettes w 7-8, faces 5-7, details 3-4; never a uniform stroke.
- Colour: muddy olive, clay, grey-blue, mustard, rust, plum; whites are dirty linen, darks are ink; one warm light pool BEHIND the people; ONE accent object per shot.
- Grime as flat shapes only (shade crescents, mottle, hatching, stains, cracks, peels); never gradients, textures, noise, blur, paper or watercolour.
- People: the film's own, by id; one exaggeration axis, tiny pupils, heavy lids, ugly-lovable and grim, never goofy. Hands ON things (solve the palm first), never across a face.
- Camera: 2-5 framings cut on the beats; one focal point off-centre each; Dutch tilt 2-7 deg only on tense beats; small moves; the place wider than every framing.
- Timing: acting on twos, expressions snap, a shock = snap + head jolt for 0.2 s; holds >= 0.4 s; never constant motion.
- Traces (>= 3): a stain, a crack, a peel, stubble, a wart, flies, a head jolt, a tilt on the tense beat, a foreground silhouette.
- Text: only words of the narration or research, in ink lettering; never \`ctx.text\` or \`ctx.annotate\`.`;

const DESIGN = `Design the shot from THIS narration (the world gives the grammar, never the content): (i) list the people, places, things and actions the shot's words name. (ii) Cast and place: the film's people are hand-built once per film (\`${C_CAM_API.peopleDir}/<id>.js\`) and drawn by id, ${snippet('person')}; the shot's setting is the film's place by id, ${snippet('place')} (\`reelforge kit-docs ${C_CAM_MODULE_TOPICS.people}\` and \`${C_CAM_MODULE_TOPICS.places}\`: their options); a recurring person is always drawn by its id, the same in every shot; a one-off prop is drawn inline in this scene from the ink brushes (centred on its grip point, a seed, a shade crescent and a little hatching). (iii) The cut table from the beats: 2-5 framings on the narration's phrases (establish -> the object in extreme close-up -> the reaction in close-up -> a pull-back), built in build() with the anchors: ${snippet('anchors')}; ${snippet('cuts')} (\`reelforge kit-docs ${C_CAM_TOPICS.camera}\`). (iv) Contacts first, in world space, before the camera: where a palm is (${snippet('palm')}) or the hand target that puts it ON a point (${snippet('reach')}); draw the held thing there and frame it; never move a contact to suit the frame. (v) Draw order in the painter: the camera first (${snippet('camera')}), the place with its light pool behind the people (or ${snippet('pool')}), the props, the people back to front, foreground pieces, then screen-space silhouettes (${snippet('fg')}). (vi) Check every framing in your frames (\`reelforge frames\` at the middle of each cut): no edge of the place in any framing, the focal point readable at thumbnail size, hands on what they hold. Keep a scene under ~250 lines: people and places live in their modules. Pitfalls seen in real films: arms growing out of the jowls, a pool of light drawn over a face, a set edge in an extreme close-up, a prop held "near" a hand.`;

const MOTION = `${DESIGN}
Build ONE ink stage per shot: ${snippet('stage')} in build(), then ${snippet('paint')} in \`update(t, s, ctx)\`, where \`paintShot(g, env, s, ctx)\` is a pure function of \`env.t\` (no state between frames) that repaints everything from scratch. Acting on twos: poses and positions read \`${C_CAM_API.time}.twos(env.t)\`, expressions snap on the beats (\`${C_CAM_API.ink}.exprAt\`), a shock is a snap plus a head jolt (\`headDy\` -10 to -22 for 0.2 s); moves inside a framing run smoothly and end on a hold. Fast-fast-hold: a beat lands, then the frame holds >= 0.4 s with only a blink or a fly. Shapes with ${snippet('blob')}, lines with ${snippet('line')}; grime with ${snippet('stain')} and ${snippet('crack')}. Letter only in ink, on the thing it names: ${snippet('hand')}; never cut content words from the narration.`;

export const C_CAM_PROMPTS: WorldPromptText = {
  film: 'a hand-inked grim cartoon video ("Grim Ink": hand-built caricature people in specific, grimy places, one uneven ink line over muddy flat colour, deadpan acting on twos and a restless TV-cartoon camera that cuts inside a shot)',
  brief: `the whole film is one hand-inked grim cartoon in the manner of an adult TV animation: specific, grimy places and hand-built, ugly-lovable caricature people drawn with one uneven ink line over muddy flat colour, grime as flat shapes, one warm light per place, acting on twos with long deadpan holds, and a camera that cuts between 2-5 framings inside a shot (wide, extreme close-up of the object, close-up of the reaction, over-the-shoulder, low angle, a Dutch tilt on tense beats). The world is a style, not a catalogue: the people and places are designed for THIS film from its narration, whatever the topic. Cast: 2-5 roles, each a person the narration needs (a job, one exaggeration axis, one loud prop with a gag use), named by a camelCase id (it becomes the module's file name); the first intent that shows a role introduces it, \`${C_CAM_CAST_TAG} nightPorter (the hotel's night porter; axis: a long drooping face; loud prop: a ring of forty keys he can never sort)\`, later intents name the id only (\`${C_CAM_CAST_TAG} nightPorter, guest\`). Places: every setting gets an id, \`${C_CAM_PLACE_TAG} boilerRoom\`, the same in every shot set there. A recurring gag and a payoff that calls back to it. Nothing else appears: no rendered 3D sets, no photos, no UI windows, no character pack or mascot, no captions. Everything is drawn, so never list \`missingProps\`.`,
  rolls: `Rolls and looks: give every shot a \`"roll"\` and a \`"look"\`, e.g. \`{ "id": "s04_debt", …, "roll": "A", "look": "ink-scene" }\`. Begin every intent with the shot's cast and place tags (\`${C_CAM_CAST_TAG} …\`, \`${C_CAM_PLACE_TAG} …\`; none on a poster without people), then its beats and framings with sizes (e.g. "wide; ECU of the stamp on 'denied'; CU of the reaction").
- \`A\` = the scene (\`ink-scene\`: the narration's people acting in a specific place, 2-5 framings cut on the beats, one gag beat and one reaction). It is the film's anchor: come back to it every 3–6 s, at least once in every 6 shots.
- \`B\` = the insert (\`ink-insert\`: an extreme close-up of the specific thing the narration names: a document, a number on a gauge, a worn tool, a coin in a palm); short.
- \`C\` = the poster (\`ink-poster\`: the title card, the line the film turns on, a sound word on a loud beat): open the film and land the biggest beats; short and rare.`,
  tensionLooks:
    '- Rolls and looks by tension: high tension → tight A-roll framings (close-ups, extreme close-ups, a Dutch tilt, a foreground silhouette, cuts every 0.4–1 s) and the rare C-roll poster; calm → A-roll wides with long deadpan holds; B-roll inserts where the narration names the specific thing or number.',
  rhythm:
    "Rhythm: never more than 2 shots in a row in one look; open the film with a C-roll title poster; hard cuts between shots, like a TV show; inside a shot, cut between framings on the narration's beats (a framing lasts 0.4–2.4 s, an extreme close-up 0.4–1.5 s).",
  shared:
    'every look is drawn on the same ink stage (one uneven ink line, muddy flat colour, grime as flat shapes, dirty whites, one accent object)',
  transitionIn:
    'a short `"type": "crossfade"` (0.2–0.4 s) at most; this world cuts hard, its camera work happens inside the shots',
  camera:
    "The camera is a restless TV-cartoon camera: an intent names the framings and their sizes (wide, medium, close-up, extreme close-up, over-the-shoulder, low angle), cut on the narration's beats; moves inside a framing are small (a 5–40 % push-in or pull-back, a short pan) and reveal or stress something; a Dutch tilt of 2–7° only on tense beats; never a spin, an orbit or a move that crops the focal point.",
  interrupts:
    '`"interrupt": { "kind": "look-switch", "note": "the scene cuts hard to the poster as the verdict lands" }`. Kind in this world: only `look-switch` (the look changes from the previous shot, on a hard cut).',
  marks:
    'In this world every mark is drawn into the place: a pin or label is hand lettering on the object it names (a tag, a chalk line, a sign), a ring is an ink loop, an underline or arrow is an ink stroke, a counter is digits lettered on a gauge or a ledger, a sound is a sound word in hand lettering, emphasis is a cut to an extreme close-up; every word comes from the narration.',
  annotate: `draw each into the place, never with \`ctx.annotate\` or \`ctx.text\`: a label or number is hand lettering on the object it names (${snippet('hand')}: a sign, a tag, a ledger line), a pointer is a cut to an extreme close-up of the target, a ring or underline is an ink stroke (\`${C_CAM_API.ink}.inkLine\`), a sound is a sound word in hand lettering on the beat; each timed to its spoken phrase (\`ctx.anchor('the phrase').t\`)`,
  motion: MOTION,
  missing: `Nothing is missing in this world: draw everything the narration needs. A person the film has not built (no such id in \`${C_CAM_API.people}\`): never a generic face or a stand-in; keep the role off-screen, as a foreground silhouette or a simple background figure (flat colour, dot eyes, no hatching). A thing no place or person module covers: draw it inline in this scene from the ink brushes, its 2-3 defining features with a strong silhouette, centred on its grip point. Never end your reply with a \`MISSING:\` line.`,
  craftBrief: CRAFT_BRIEF,
  criticMedium: 'hand-inked grim cartoon',
  criticStyle:
    'hand-built caricature people in specific grimy places, one uneven ink line over muddy flat full colour, grime as flat shapes, dirty whites, one accent object, a TV-cartoon camera',
  vibe: 'Vibe check (every look of the film must feel like one hand-inked grim cartoon): an uneven ink line that swells and pinches, muddy flat colour (olive, clay, grey-blue, mustard, rust, plum), dirty whites, grime drawn as flat shapes, ugly-lovable specific people. Gradients, glows, textures, paper, watercolour, noise or blur, clean vector shapes of uniform width, pixel art, photos, rendered 3D, typeset fonts or software windows break the world: answer `off-intent` with a note starting `vibe:`.',
  checklist:
    "one focal point per framing, off-centre (the gag object, the reaction face or the line); the people specific and ugly-lovable, each with one exaggeration axis (never goofy: no snout noses; tiny pupils, heavy lids), readable at thumbnail size; hands ON the thing they hold, never across a face, arms rooted at the shoulders below the chin, the jaw part of the head when the mouth is open; the warm light pool behind the people, never over them; one accent object only; the place reaching past every frame edge (no set edge or empty ink at a border); a Dutch tilt only on a tense beat; lettering whole, drawn in ink strokes, words of the narration only; human traces such as a stain, a crack, a peel, stubble, a wart, flies, a head jolt, a tilt on the tense beat, a foreground silhouette. Only authored marks count as traces: the ink line's swell, the mottle and hatching of every fill and the ink background never do. Slop tells: a generic or symmetric face, the same face on two people, uniform line width, gradients or glows, a centred symmetric frame, decoration the narration never names, more than one accent, pure white or pure black, a camera move that crops the focal point, a hand floating near a prop, a poster with words the narration never says.",
  continuity:
    'Link the pair where the narration carries one thing into the next shot: `zoom-through` into an object in the place (the extreme close-up of a keyhole becomes the room behind it), `shared-object` (the same object holds its place on screen while the place around it changes), `carry-environment` (the same place goes on and one thing in it changes: a person gone, a pile grown). Name the object in both intents; never link two unrelated shots.',
  surprise:
    'a sudden shot moment (e.g. "a hard cut to the other side of the door shows who was listening", "the verdict thuds in as a poster, letter by letter"); never a smooth camera trick (no dolly zoom, orbit or rack focus)',
  moments: C_CAM_MOMENTS,
  cutsOnly: true,
};

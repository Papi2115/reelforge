/**
 * Sketchbook in the stage prompts (PLAN.md#13.6, #13.15 phase 2, docs/worlds/DECISIONS.md
 * "PRINCIPLE: a world is a style GRAMMAR"): one spiral notebook drawn live by a visible hand; look
 * A `sketch-story`, B `sketch-graph`, C `sketch-loud` (packages/kit/src/worlds/sketchbook). The
 * wording imposes the notebook's grammar (inks and what they mean, the rough hand, paper, page
 * composition, one focal point, red only for the correction) and a design process per shot (the
 * narration's nouns -> how the hand draws each with the open vocabulary or the project's cast ->
 * layout -> thumbnail test), and never the showcase's content: `sketchbook-bias.test.ts` fails
 * when a showcase noun creeps back. The craft brief is the world's <= 1.5 KB brief of QUALITY.md §9.
 */
import { SKETCHBOOK_MOMENTS } from './sketchbook-moments.js';
import { snippet } from './sketchbook-snippets.js';
import type { WorldPromptText } from './types.js';

const CRAFT_BRIEF = `Craft brief (Sketchbook; binding). The notebook is the style; THIS narration is the content.
- Design first, as a comment: \`// nouns: <what it names> | drawn as: <person, draw kind, diagram, doodle or cast id> | layout: <name> | focal: <read first> | traces: <three>\`; build to the focal.
- Draw the film's own things, rough on purpose (loop heads, stick limbs, bowed lines, crayon past the lines), never slick; hero >= 25% of the page height (figure \`h\` >= 135), readable at 64 px.
- Inks: felt-tip = story, ballpoint = proof and numbers, pencil = doubts, marker = one loud word, red = only the correction on the point, after a still beat (>= 0.4 s).
- ONE focal point, off-centre; never < 3 elements on the page for > 0.6 s, never > 6; >= 3 traces: a crossed-out word and its fix, a two-stroke arrow, a margin note, tape, a coffee ring, a smudge.
- One hand: ALWAYS \`kit.fx.sketchPage({ …, duration: ctx.shot.duration })\`; last mark done >= 0.4 s before the end; marks > 80 px apart never overlap in time. The hand draws the key marks; short of time, labels and numbers \`appear\` on their own: never cut a narration word.
- Don't: centred or symmetric layouts, decoration without meaning, rows of icons, uniform gaps or timings, constant motion, a second accent, a page that repeats an earlier one.
- Text: only words of the narration or research notes (real numbers, names, dates); \`page.write\` or diagram labels; no \`ctx.text\`, \`ctx.annotate\` or stroke-drawn letters.
- No slur-like words (chink): sound words CLINK, CLANG, TINK.`;

const LAYOUTS =
  "'hero-left' one person and their thing, 'facing' two sides, 'tall-diagram' a person explains a diagram, 'wide-strip' several along one ground, 'top-down-map' a place from above, 'close-up' one thing huge, 'landscape' a place under its sky, 'two-column' then and now, 'big-number' one number";

const DESIGN = `Design the page before the code, from this shot's narration (the notebook is the style, never the content): (i) list the people, animals, plants, things, places, actions and numbers it names; (ii) decide how the hand draws each in this notebook: a person (${snippet('person')}), an animal, plant, building, vehicle, object, tool or instrument (\`page.draw(kind, { type })\`: ${snippet('plant')}; ${snippet('animal')}), a pale backdrop that soaks in while the hand works (${snippet('backdrop')}), a place as a map (${snippet('map')}), a number on a drawing as a callout (${snippet('callout')}), and what no generator has as your own drawing (\`page.doodle\` parts, or tiny \`page.spot\` art: ${snippet('spot')}); \`reelforge kit-docs sketchPage\` lists every kind, type, pose and diagram; (iii) pick the layout from the narration's structure; (iv) make the hero the biggest mark, recognisable at 64 px by its silhouette.`;

const HAND = `Build ONE page per shot: \`scene.add(page)\` in build() and \`page.update(t)\` in update(t) (a page never added to the scene renders a blank frame). Let each drawing land and hold (a still beat of at least 0.4 s), the hand clear of the subject: always create the page with \`duration: ctx.shot.duration\` (the hand leaves the subject in the last 0.4 s); a story page (look A) also takes a \`layout\` that fits the narration (${LAYOUTS}; place with \`page.slots()\`; vary it page to page): ${snippet('storyPage')}. Never overlap in time two marks more than 80 px apart (the one hand queues them, up to 0.6 s, or they appear without it; \`parallel: true\` only on purpose). The hand draws the key elements: the hero mark keeps its time and gets the hand (${snippet('heroWrite')}; default the largest text). When the hand cannot keep up with the narration, a label, word or number simply appears on its own while the hand draws something else (${snippet('appearWrite')}; \`appear: 'bloom' | 'pop' | 'type'\`, \`parallel: true\` = bloom); a secondary write the hand cannot reach in time blooms in by itself. Writing is brisk (12 letters ~1.1 s): ${snippet('quickWrite')} for labels, ${snippet('speedWrite')} (speed up to 2) for a phrase. Never cut content words from the narration because writing is slow, and never letter text with \`page.stroke\`. Move the camera only to reveal or to push toward the focal point. Red (\`tool: 'red'\`) marks only the page's one point (the correction or the key number): at most one red word and three red marks per page, never a title, label or caption; strike out only a wrong idea the narration names, never an invented word.`;

const CAST = `The film's recurring people and things are the project's cast and props: asset files \`assets/sketchbook/<id>.json\` (read their \`id\` and \`description\`), designed once for this film, that reach the scene as \`ctx.worldAssets\` and the page as \`library\`. Draw them by id so they look the same in every shot (${snippet('castPerson')}; ${snippet('useProp')}; \`holds\` may name a prop id), never redraw or restyle them by hand. A thing only this shot needs: draw it directly, or define it inline and use it (${snippet('defineFigure')}, then \`page.person({ like: 'astronaut', … })\`; ${snippet('defineProp')}, then \`page.use('roof', { x, y, h })\`); an id nobody defined is an error. Before you finish, look at the frames small: the hero must still read at 64 px. Everything is drawn by hand on the page: this world has no props to build, so never end your reply with a \`MISSING:\` line.`;

export const SKETCHBOOK_PROMPTS: WorldPromptText = {
  film: 'a hand-drawn sketchbook video (one spiral notebook, every page drawn live by a visible hand)',
  brief:
    'the whole film is one spiral notebook. Every shot is one page a visible hand draws live: felt-tip for the story, a blue ballpoint for proofs and numbers, pencil for guides and doubts, a marker for the one loud word and one red pen for the correction on the point; crude figures, rough lines, crayon fills out of the lines, hand lettering, paper, tape, coffee rings, line boil. The notebook is the style, never the content: every page draws what THIS narration names (its people, animals, plants, buildings, vehicles, objects, places as maps, numbers as charts), designed for this film. Say in each intent what is drawn and what the red pen marks (e.g. "a park ranger points up at one huge oak; red 300 yrs"), and name a recurring person or thing the same way in every intent (the ranger, the lighthouse): it is designed once for the film and every page draws the same one. Nothing outside the notebook appears: no rendered sets, no UI windows, no photo-real props, no character pack or mascot (the hand-drawn people are the cast). Everything is drawn on the page, so never list `missingProps`.',
  rolls: `Rolls and looks: give every shot a \`"roll"\` and a \`"look"\`, e.g. \`{ "id": "s04_proof", …, "roll": "B", "look": "sketch-graph" }\`.
- \`A\` = the story page (\`sketch-story\`: felt-tip pages with the people, animals, places and things the narration names, crude and with reacting faces, one red correction). It is the film's anchor: come back to it every 3–6 s, at least once in every 6 shots.
- \`B\` = the proof on paper (\`sketch-graph\`: blue ballpoint on graph paper, an envelope back or an index card: sums worked line by line, ruled charts, a map with its route, a cutaway or a flow; one red result): show what the narration claims, with its real numbers.
- \`C\` = the loud page (\`sketch-loud\`: one huge marker word or number the red pen corrects, a flipbook riffled in the corner, sticky notes slapped on): open acts and land the biggest facts; short and rare. A C page is one word or number; a pair or a comparison goes to B.`,
  tensionLooks:
    '- Rolls and looks by tension: high tension → loud C-roll pages and tight A-roll pages (one figure, one object, close); calm → A-roll story pages with room around the drawing; B-roll proofs on plateaus where the narration explains or proves.',
  rhythm:
    'Rhythm: never more than 2 shots in a row in one look; change roll, look or treatment at least every 6–8 s; open each act with a C-roll page and a page-native transition.',
  shared:
    'every look draws in the same notebook (paper stocks, felt-tip, ballpoint, pencils, one red pen, hand lettering, line boil)',
  transitionIn:
    'a page-native transition (`"type": "wipe"` with a `style` from the list below and about its duration)',
  camera:
    "The camera is the reader's eye over the page: an intent may ask for a slow push toward the focal drawing or a held frame, never a move that crops the hand lettering, never a spin or a circling move.",
  interrupts:
    '`"interrupt": { "kind": "look-switch", "note": "the story page is torn out and the marker slams the one number onto a fresh page" }`. Kind in this world: only `look-switch` (the look changes from the previous shot; give the shot a page-native `transitionIn`).',
  marks:
    "In this world every mark is drawn by the hand on the page in the look's own pen: a pin is a hand-written label with a two-stroke arrow, a ring is a pencil loop, an underline is uneven, a stamp is the red pen, a counter is a number written and corrected; every label comes from the narration.",
  annotate:
    "draw each by hand on the page (`page.write`, `page.arrow`, `page.loop`, `page.underline`, `page.crossOut`), timed to its spoken phrase (`at: 'the phrase'`), on the named target, never with `ctx.annotate` or `ctx.text`",
  motion: `${DESIGN} ${HAND}`,
  missing: CAST,
  craftBrief: CRAFT_BRIEF,
  criticMedium: 'hand-drawn sketchbook',
  criticStyle:
    'a hand-drawn notebook page: paper, felt-tip, ballpoint, pencils and one red pen, hand lettering, a visible hand, slight line wobble',
  vibe: 'Vibe check (every look of the film must feel like one notebook): paper, hand-drawn strokes with a slight wobble, hand lettering, the same few inks. Clean vector shapes, glossy gradients, rendered 3D, pixel-art fonts or software windows break the world: answer `off-intent` with a note starting `vibe:`.',
  checklist:
    "one focal point, off-centre, big enough to read (about a quarter of the page height or more) and recognisable by its silhouette; the drawings show what this shot's narration names; red ink only on the point; crude, slightly wobbly figures and lettering (never slick or symmetric); at most 6 elements; human traces such as a crossed-out word with its correction, a two-stroke arrow, a pencil fill out of the lines, an uneven underline, a margin note, tape, a coffee ring, a smudge. Only authored marks count as traces: the spiral binding, the paper (lines, grid, grain), the page number and the visible hand never do. Slop tells: a centred symmetric layout, decoration without meaning (a disc, shape or icon the narration never mentions), a drawing of something the narration does not name standing in for what it does, rows of icons, invented labels or gibberish, an empty callout, box or tag, a highlighter bar that reads as a strike-through, everything evenly spaced, tiny figures on a mostly empty page, the hand covering the subject or still on it at the end of the shot, a stroke-drawn mark (a figure, a line, hand lettering) growing with no pen at its tip (a label or number that appears whole on its own is fine), a pop-up whose pulled motion shows nothing the narration says.",
  continuity:
    'Link the pair where the narration carries one thing into the next shot: `zoom-through` into a drawn object (the pencil map becomes the page of the place it shows), `shared-object` (the same drawing or taped scrap stays in place while the page around it changes), `carry-environment` (the same page goes on and one drawing in it changes). Name the object in both intents; never link two unrelated pages.',
  surprise:
    'a sudden page moment (e.g. "the page is torn out and a pop-up card stands up with the answer", "a flipbook riffles through the years"); never a camera move (no dolly zoom, circling camera, rack focus or screen)',
  moments: SKETCHBOOK_MOMENTS,
};

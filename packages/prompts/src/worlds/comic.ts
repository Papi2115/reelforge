/**
 * Comic in the stage prompts (PLAN.md#13.3, #13.15; docs/worlds/DECISIONS.md "a world is a style
 * GRAMMAR"): one printed comic book, a page per shot; look A `comic-story`, B `comic-info`, C
 * `comic-loud` (packages/kit/src/worlds/comic). The prompts impose the STYLE (panel grammar,
 * inks, lettering, roughness on purpose) and a design process per shot (the narration's nouns ->
 * how each is drawn in the grammar -> layout from the beats -> no empty panel -> thumbnail test
 * -> one look per recurring character); the content is designed per film with the open
 * vocabulary (`page.art`, the project's asset files), never replayed from the showcase. The craft
 * brief is the world's ≤ 1.5 KB brief of QUALITY.md §9.
 */
import { COMIC_MOMENTS } from './comic-moments.js';
import { comicSnippet as snippet } from './comic-snippets.js';
import type { WorldPace } from './pace.js';
import type { WorldPromptText } from './types.js';

const CRAFT_BRIEF = `Craft brief (Comic; binding). The world gives the GRAMMAR, the narration gives the content: draw what THIS shot names.
- First, a comment: \`// focal: <the one thing read first> | nouns: <what the words name> | traces: <three>\`; build toward the focal point.
- Grammar: ONE focal point, off-centre; panel size = importance, <= 5 panels, uneven leaning gutters; a near-empty pause panel before a twist; one panel or loud word breaks the frame; balloon tails at the speaker; onomatopoeia = big imperfect letters on uneven beats; fills on \`g.plate\`; speed lines stop before the subject; ONE accent colour, on the point.
- Rough on purpose: simple, slightly crude figures, strong silhouettes; >= 3 traces: thumbprint, smudge, coffee ring, margin note, two-stroke arrow, a struck word and its fix, a worn stamp, a pencil rough.
- Thumbnail test: the hero reads at 64 px (silhouette, <= 3 value steps, its defining features: a skull shows sockets and teeth); hero >= 25% of the page height; no panel empty or flat > 0.6 s.
- Don't: centred or symmetric pages, identical panels in a grid (unless it is the joke), > 6 competing elements, icon rows, decoration the narration never names, two loud words at once, even timing, constant motion, slick art.
- Text: only words of the narration or research notes (real numbers, names, dates; never a quantity nobody said; sound words aside); only page lettering, no \`ctx.text\`, \`ctx.annotate\` or stroke-drawn letters; a sound word is never a slur or close to one (metal: CLINK, CLANG, TINK).`;

const DESIGN = `Design the page from THIS narration (the world gives the grammar, never the content): (i) list the nouns, places and actions the shot's words name; (ii) decide how each is drawn in comic grammar. The project's own cast, props and backdrops come first: when \`ctx.worldAssets\` is set, load them once with ${snippet('assets')} and draw them by id, ${snippet('cast')}; a recurring character is always drawn by its id, the same look in every shot. Anything else comes from the open vocabulary (\`reelforge kit-docs comicPage\` lists every generator and option): a person with a pose and an expression ${snippet('person')}, an animal ${snippet('animal')}, a plant ${snippet('plant')}, a backdrop ${snippet('backdrop')}, a crowd ${snippet('crowd')}, also bird, fish, insect, reptile, sky, land, sea, building, vehicle, object, icon, chart (values from the narration), map, sign and effect (painter calls: inside \`panel.draw((g, t) => …)\`). (iii) Choose the layout from the narration's structure: one beat per narrated moment, its weight = its importance; ${snippet('suggest')} says which preset and why, ${snippet('layout')} builds the panels in beat order, each with its establishing backdrop. Use the presets ('splash', '2-up', 'strip', '3-up-l', '4-grid', '4-l', 'splash-inset') and vary them page to page, never the same two-panel split on every page; ${snippet('panels')} or a custom \`page.panel(quad)\` only when the beats need it; at most 5 panels at once. Let the pages unfold in different directions, like a printed comic: ${snippet('flow')} lays 2-5 panels out as a strip that runs \`down\` (a tall narrow column read downward: a fall, a descent, going deeper), \`across\` (a long band wider than the page, read sideways: a journey, one thing after another) or \`diagonal\` (a stair), and the camera reads it; never the same page flow on three pages in a row. Carry things across panels: one element of the narration (a rope, a road, a route, a colour, a gesture, a thing in flight) drawn over 3 or more panels and the gutters between them, ${snippet('thread')}; both need an \`intent\` (why the page reads this way, what the carried thing means). (iv) No empty panel: the backdrop is there from the panel's first frame and its subject arrives on its beat; end build() with a check that ${snippet('audit')} is \`[]\` (throw it, so \`reelforge frames\` names the panel and the span). (v) Thumbnail test on your frames: can you name the hero at 64 px? If not, cut it down to its silhouette and its 2-3 defining features. Pitfalls seen in real films: a skull drawn as a potato, panels ruled but empty for 2 s, five pages of the same two side-by-side panels, the page camera cropping a sound word.`;

const MOTION = `${DESIGN}
Build ONE page per shot: ${snippet('page')}; \`scene.add(page)\`, lay it out in build(), \`page.update(t)\` in update(t). Fast-fast-pause: things land (a subject arrives, a balloon pops, letters slam on uneven beats) and then the page HOLDS (a still beat of at least 0.4 s, only line boil); never constant motion. Letter only on the page: ${snippet('balloon')} (the tail at the speaker's mouth), ${snippet('caption')}, ${snippet('sfx')} (big imperfect letters on uneven beats, may break the frame; one loud word at a time), ${snippet('note')} (a pencil margin note), ${snippet('stamp')}. Never cut content words from the narration. Move the page camera (\`page.camera([...])\`) only to read the page or push toward the focal panel, never so far that it crops lettering, and end on a hold.`;

/**
 * Pages flow into each other (Papi after real run Comic 3: "the transitions feel dry"; the
 * showcase joined 9 of its 10 shots with a page-native transition): about one non-cut transition
 * per 8 s, a link per ~18 s, never 4 plain cuts in a row without something carried across.
 */
const PACE: WorldPace = {
  transitionEveryS: 8,
  continuityEveryS: 18,
  dryCutRun: 4,
  guide:
    'Match the transition to what the narration does: reading on to the next step, place or person = `comic-page-slide`; going down, deeper or further = `comic-page-scroll`; into a detail the narration names = `comic-panel-zoom` (focus on it); one thing crowding out another, pressure building = `comic-panel-push`; a sudden stop or a trap closing = `comic-gutter-collapse` (focus at its height); a hit or a loud beat = `comic-panel-slam`; two sides, a split or a choice = `comic-gutter-wipe` (focus on the cut); a new chapter = `comic-page-turn`; into the past = `comic-page-back`, back out of it = `comic-ink-bleed`',
};

export const COMIC_PROMPTS: WorldPromptText = {
  film: 'a printed comic-book video (every shot one comic page: hand-ruled panels, ink over off-register colour plates, halftone, balloons, captions and onomatopoeia)',
  brief:
    'the whole film is one printed comic book. Every shot is one page of hand-ruled panels with uneven, leaning gutters: ink line art over flat colour plates printed slightly out of register, halftone screens, hand-lettered speech balloons with tails, yellow captions, big imperfect onomatopoeia; the camera reads the page like an eye. The world is a style, not a catalogue: whatever the narration names (people, animals, plants, places, machines, objects) is drawn for THIS film in that grammar, as simple, slightly crude figures with strong silhouettes; recurring characters and places keep one look through the film (name them the same way in every intent). Nothing else appears: no rendered 3D sets, no UI windows, no photos, no character pack or mascot. Everything is drawn on the page, so never list `missingProps`.',
  rolls: `Rolls and looks: give every shot a \`"roll"\` and a \`"look"\`, e.g. \`{ "id": "s04_why", …, "roll": "B", "look": "comic-info" }\`. In every intent name what the page draws (the narration's own people, places and things) and its beats: how many panels and which one is the biggest (e.g. "three beats, the last biggest").
- \`A\` = the story page (\`comic-story\`: 2-5 panels of what happens, the people and the specific thing the narrator names, balloons with tails, captions, a sound effect on a real hit). It is the film's anchor: come back to it every 3–6 s, at least once in every 6 shots.
- \`B\` = the information page (\`comic-info\`: a cutaway of the real thing, a chart drawn as panel art with the narration's numbers, a map, a ticked checklist, a stamp, a caption with the definition): show what the narration explains, with its real numbers and names.
- \`C\` = the loud page (\`comic-loud\`: the near-empty pause panel before a twist, one giant onomatopoeia breaking the frame, a slammed panel, the one line lettered large): open acts and land the biggest beats; short and rare. A C page has one loud thing; an explanation goes to B.`,
  tensionLooks:
    '- Rolls and looks by tension: high tension → loud C-roll pages and tight A-roll pages (few big panels, gutters closing, close crops); calm → A-roll story pages with more, smaller panels and room to read; B-roll information pages on plateaus where the narration explains or proves.',
  rhythm:
    'Rhythm: never more than 2 shots in a row in one look; change roll, look or panel layout at least every 6–8 s; open each act with a C-roll page and a panel-native transition.',
  shared:
    'every look prints on the same comic page (newsprint, hand-ruled panels, ink over off-register colour plates, halftone, hand lettering, one accent colour)',
  transitionIn:
    'a panel-native transition (`"type": "wipe"` with a `style` from the list below and about its duration; `"focus": { "x": 0.6, "y": 0.4 }` = the panel or object it goes through, as a share of the frame)',
  camera:
    "The camera is the reader's eye over the page: an intent may ask it to read the page panel by panel, to push into one panel or to hold, never a move that crops the lettering, never a spin or an orbit.",
  interrupts:
    '`"interrupt": { "kind": "look-switch", "note": "the story page is cut along a gutter and CLANG slams onto a near-empty page" }`. Kind in this world: only `look-switch` (the look changes from the previous shot; give the shot a panel-native `transitionIn`).',
  marks:
    'In this world every mark is part of the printed page: a pin is a caption box or a hand-lettered label with a kinked leader, a ring is a pencil loop, an underline or arrow is pencilled, a stamp is a worn rubber stamp, a counter is digits drawn in the panel, a sound is an onomatopoeia; every label comes from the narration.',
  annotate:
    "letter each on the page (`page.caption`, `page.balloon`, `page.note`, `page.arrow`, `page.loop`, `page.stamp`, labels inside the art with `g.text`, a sign's `text` or a chart's `labels`), timed to its spoken phrase (`at: 'the phrase'`, with `anchor: ctx.anchor` on the page), on the named target, never with `ctx.annotate` or `ctx.text`",
  motion: MOTION,
  missing: `Nothing is missing in this world: draw everything the narration needs on the page. A thing that neither the project's assets nor a generator covers: define it once in this scene and draw it by id, a one-off from shape parts (${snippet('prop')}) or sprite rows (\`page.art.sprite\`), or a generator preset with your own knobs (${snippet('character')}); draw its 2-3 defining features with a strong silhouette, never a blank stand-in. Never end your reply with a \`MISSING:\` line.`,
  craftBrief: CRAFT_BRIEF,
  criticMedium: 'printed comic-book',
  criticStyle:
    'a printed comic page: hand-ruled panels with uneven gutters, ink line art over off-register colour plates, halftone dots, hand-lettered balloons and captions, big imperfect onomatopoeia',
  vibe: 'Vibe check (every look of the film must feel like one printed comic book): newsprint paper, hand-ruled panels, inked outlines with a slight boil, colour plates slightly off register, halftone dots, hand lettering in balloons and captions. Smooth gradients, glossy or rendered 3D, photos, pixel-art UI fonts, clean vector icons or software windows break the world: answer `off-intent` with a note starting `vibe:`.',
  checklist:
    'one focal point, off-centre: the biggest panel or the one loud word (the hero figure or object about a quarter of the page height or more); the hero can be named at a glance, as at thumbnail size (a strong silhouette and its defining features: a skull with sockets and teeth, a person the narration names with a face); panel size follows importance; uneven, leaning gutters; at most 5 panels and 6 competing elements; the accent colour only on the point; balloon tails pointing at the speaker; lettering whole and readable; human traces such as a thumbprint, a smudge, a coffee ring, a pencil margin note, a two-stroke arrow, a struck word with its correction, ticks that differ, a worn stamp, letters off-square on uneven beats. Only authored marks count as traces: the paper, the panel borders, the gutters and the halftone screen never do. Slop tells: a centred symmetric page, identical panels in a grid, a panel ruled but empty that is not a deliberate pause, a hero that reads as a blob, decoration without meaning (a shape or icon the narration never mentions), rows of icons, invented labels or gibberish in balloons and captions, two loud words at once, speed lines running through the subject, a balloon tail pointing at nobody, lettering cropped by the camera, slick polished art, a flashback or spread whose picture shows nothing the narration says.',
  continuity:
    'Link the pair where the narration carries one thing into the next shot: `zoom-through` into a panel or a drawn object (a window in the panel becomes the next page), `shared-object` (the same drawn object holds its place while the panels around it change), `carry-environment` (the same page goes on and one panel or object in it changes). Name the object in both intents; never link two unrelated pages. Let continuity last longer than one cut: carry one object, colour or gesture through three or more panels or shots where the narration follows it (over the panels of one page, or a link into the next page and on into the one after when the film has links to spare), and plan pages that unfold down or across instead of a run of plain cuts.',
  surprise:
    'a sudden page moment (e.g. "the page holds its breath on an almost empty panel, then CLANG slams across the frame", "a torn sepia strip of the past is pasted over the page"); never a camera move (no dolly zoom, orbit, rack focus or screen)',
  moments: COMIC_MOMENTS,
  pace: PACE,
};

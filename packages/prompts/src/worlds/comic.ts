/**
 * Comic in the stage prompts (PLAN.md#13.3, docs/worlds/DECISIONS.md, QUALITY.md §6/§9): one
 * printed comic book, a page per shot; look A `comic-story`, B `comic-info`, C `comic-loud`
 * (packages/kit/src/worlds/comic). The craft brief is the world's ≤ 1.5 KB brief of QUALITY.md
 * §9: the slop tells as a don't-list, the comic signature (§6) as a do-list, the focal-point-first
 * process, text provenance and reference frames of the approved showcase (comic-panels-v2).
 */
import { COMIC_MOMENTS } from './comic-moments.js';
import { comicSnippet as snippet } from './comic-snippets.js';
import type { WorldPromptText } from './types.js';

const CRAFT_BRIEF = `Craft brief (Comic; binding):
- First, write a comment: \`// focal: <the one thing read first> | traces: <three human traces>\`; build toward it.
- Do: ONE focal point, off-centre (panel size = importance: the biggest panel or the one loud word); uneven leaning gutters, one panel or word breaking the frame; lettering off-square (\`tilt\`, \`slant\`, sfx \`angles\`/\`rise\`); balloon tails at the speaker; fills on \`g.plate\`; speed lines stop before the subject; ONE accent colour, on the point; a near-empty pause panel before a twist; >= 3 traces: thumbprint, smudge, coffee ring, margin note, two-stroke arrow, a struck word and its fix, a worn stamp, a pencil rough before a slam.
- Fill the page: hero >= 25% of the page height; no empty panel except the pause; never < 3 elements for > 0.6 s.
- Don't: centred or symmetric pages, identical panels in a grid (unless it is the joke), > 5 panels, > 6 competing elements, icon rows, decoration without meaning, two loud words at once, even timing, constant motion, slick polished art: keep figures simple, slightly crude.
- Text: only words of the narration or research notes (real numbers, names, dates; sound words aside), no invented labels; only page lettering, no \`ctx.text\`, \`ctx.annotate\` or stroke-drawn letters.
- No slur-like words (chink): sound words CLINK, CLANG, TINK.
- References (docs/worlds/comic-panels-v2/shots/): s1-t6.9.png 1202 breaks the frame; s6-t3.5.png gutters closing, BEEP on uneven beats; s7-t7.9.png ABORT struck to GO, one accent; s8-t4.0.png the pause.`;

const MOTION = `Build ONE page per shot: ${snippet('page')}; \`scene.add(page)\`, lay it out in build(), \`page.update(t)\` in update(t). Panel size = importance: ${snippet('panels')} (layouts 'splash', '2-up', 'strip', '3-up-l', '4-grid', '4-l', 'splash-inset'; vary them page to page) or a custom \`page.panel(quad)\`; at most 5 panels at once. Fast-fast-pause: things land (a panel \`enter\`s, a balloon pops, letters slam on uneven beats) and then the page HOLDS (a still beat of at least 0.4 s, only line boil); never constant motion. Letter only on the page: ${snippet('balloon')} (the tail at the speaker's mouth), ${snippet('caption')}, ${snippet('sfx')} (big imperfect letters on uneven beats, may break the frame), ${snippet('note')} (a pencil margin note), ${snippet('stamp')}. Never cut content words from the narration. Move the page camera (\`page.camera([...])\`) only to read the page or push toward the focal panel, and end on a hold.`;

export const COMIC_PROMPTS: WorldPromptText = {
  film: 'a printed comic-book video (every shot one comic page: hand-ruled panels, ink over off-register colour plates, halftone, balloons, captions and onomatopoeia)',
  brief:
    'the whole film is one printed comic book. Every shot is one page of hand-ruled panels with uneven, leaning gutters: ink line art over flat colour plates printed slightly out of register, halftone screens, hand-lettered speech balloons with tails, yellow captions, big imperfect onomatopoeia; the camera reads the page like an eye. The cast is drawn on the page: simple, slightly crude figures, silhouettes and hands, and the specific machine, place or object the narrator names. Nothing else appears: no rendered 3D sets, no UI windows, no photos, no character pack or mascot. Everything is drawn on the page, so never list `missingProps`.',
  rolls: `Rolls and looks: give every shot a \`"roll"\` and a \`"look"\`, e.g. \`{ "id": "s04_why", …, "roll": "B", "look": "comic-info" }\`.
- \`A\` = the story page (\`comic-story\`: 2-5 panels of what happens, the people and the specific thing the narrator names, balloons with tails, captions, a sound effect on a real hit). It is the film's anchor: come back to it every 3–6 s, at least once in every 6 shots.
- \`B\` = the information page (\`comic-info\`: a cutaway of the real object, a chart drawn as panel art, a ticked checklist, a stamp, a caption with the definition): show what the narration explains, with its real numbers and names.
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
    "letter each on the page (`page.caption`, `page.balloon`, `page.note`, `page.arrow`, `page.loop`, `page.stamp`, labels inside the art with `g.text`), timed to its spoken phrase (`at: 'the phrase'`, with `anchor: ctx.anchor` on the page), on the named target, never with `ctx.annotate` or `ctx.text`",
  motion: MOTION,
  missing:
    'Draw everything the narration needs on the page (panels, figures, machines, places, charts): this world has no props to build, so never end your reply with a `MISSING:` line.',
  craftBrief: CRAFT_BRIEF,
  criticMedium: 'printed comic-book',
  criticStyle:
    'a printed comic page: hand-ruled panels with uneven gutters, ink line art over off-register colour plates, halftone dots, hand-lettered balloons and captions, big imperfect onomatopoeia',
  vibe: 'Vibe check (every look of the film must feel like one printed comic book): newsprint paper, hand-ruled panels, inked outlines with a slight boil, colour plates slightly off register, halftone dots, hand lettering in balloons and captions. Smooth gradients, glossy or rendered 3D, photos, pixel-art UI fonts, clean vector icons or software windows break the world: answer `off-intent` with a note starting `vibe:`.',
  checklist:
    'one focal point, off-centre: the biggest panel or the one loud word (the hero figure or object about a quarter of the page height or more); panel size follows importance; uneven, leaning gutters; at most 5 panels and 6 competing elements; the accent colour only on the point; balloon tails pointing at the speaker; lettering whole and readable; human traces such as a thumbprint, a smudge, a coffee ring, a pencil margin note, a two-stroke arrow, a struck word with its correction, ticks that differ, a worn stamp, letters off-square on uneven beats. Only authored marks count as traces: the paper, the panel borders, the gutters and the halftone screen never do. Slop tells: a centred symmetric page, identical panels in a grid, an empty panel that is not a deliberate pause, decoration without meaning (a shape or icon the narration never mentions), rows of icons, invented labels or gibberish in balloons and captions, two loud words at once, speed lines running through the subject, a balloon tail pointing at nobody, slick polished art, a flashback or spread whose picture shows nothing the narration says.',
  continuity:
    'Link the pair where the narration carries one thing into the next shot: `zoom-through` into a panel or a drawn object (the cabin window becomes the next page), `shared-object` (the same drawn object holds its place while the panels around it change), `carry-environment` (the same page goes on and one panel or object in it changes). Name the object in both intents; never link two unrelated pages.',
  surprise:
    'a sudden page moment (e.g. "the page holds its breath on an almost empty panel, then CLANG slams across the frame", "a torn sepia strip of the past is pasted over the page"); never a camera move (no dolly zoom, orbit, rack focus or screen)',
  moments: COMIC_MOMENTS,
};

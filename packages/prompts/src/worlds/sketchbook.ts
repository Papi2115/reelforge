/**
 * Sketchbook in the stage prompts (PLAN.md#13.6, docs/worlds/DECISIONS.md, QUALITY.md §9): one
 * spiral notebook drawn live by a visible hand; look A `sketch-story`, B `sketch-graph`, C
 * `sketch-loud` (packages/kit/src/worlds/sketchbook). The craft brief is the world's ≤ 1.5 KB
 * brief of QUALITY.md §9: the slop tells as a don't-list, the world's traces as a do-list, the
 * focal-point-first process, text provenance and reference frames of the approved showcase.
 */
import { SKETCHBOOK_MOMENTS } from './sketchbook-moments.js';
import type { WorldPromptText } from './types.js';

const CRAFT_BRIEF = `Craft brief (Sketchbook; binding, docs/worlds/QUALITY.md):
- First, before any code, write a comment: \`// focal: <the one thing read first> | traces: <three human traces>\`; build toward it.
- Do: ONE focal point, off-centre; red only for the correction on the point, after a still beat (>= 0.4 s); crude figures (loop heads, stick limbs, reacting faces); holds of different lengths; >= 3 traces: a crossed-out word and its fix, a two-stroke arrow, a fill out of the lines, an uneven underline, a pencil margin doubt, angled tape, a coffee ring, a smudge.
- Fill the page: hero >= 25% of the page height (figure \`h\` >= 135), purposeful marks around it; never < 3 elements on the page for > 0.6 s.
- One hand: ALWAYS \`kit.fx.sketchPage({ …, duration: ctx.shot.duration })\` (the hand leaves the subject in the last 0.4 s); last mark done >= 0.4 s before the end. No marks > 80 px apart at the same time: they queue (<= 0.6 s) or lose the hand; \`parallel: true\` only on purpose.
- Don't: centred or symmetric layouts, decoration without meaning, rows of icons, uniform gaps or timings, constant motion, > 6 elements, a second accent or loud word, slick drawings.
- Text: every on-screen word comes from the narration or the research notes (real numbers, names, dates); never invent labels or figures; \`page.write\`, never \`ctx.text\` or \`ctx.annotate\`.
- References (docs/worlds/sketchbook-v2/shots/): s2-t6.0.png one idea; s4-t7.4.png red +1 DAY, a pencil doubt; s3-t7.9.png boxes fill, one red result; s1-t6.0.png marker word, red fix.`;

export const SKETCHBOOK_PROMPTS: WorldPromptText = {
  film: 'a hand-drawn sketchbook video (one spiral notebook, every page drawn live by a visible hand)',
  brief:
    'the whole film is one spiral notebook. Every shot is one page a visible hand draws live with a felt-tip, a blue ballpoint, coloured pencils and one red pen: crude stick people, the specific thing the narrator names, hand-lettered words from the narration, one red correction on the point; paper, tape, coffee rings, line boil. Nothing else appears: no rendered sets, no UI windows, no photo-real props, no character pack or mascot (the stick people are the cast). Everything is drawn by hand on the page, so never list `missingProps`.',
  rolls: `Rolls and looks: give every shot a \`"roll"\` and a \`"look"\`, e.g. \`{ "id": "s04_proof", …, "roll": "B", "look": "sketch-graph" }\`.
- \`A\` = the story page (\`sketch-story\`: felt-tip pages, crude stick people with props and reacting faces, the thing the narrator names, one red correction). It is the film's anchor: come back to it every 3–6 s, at least once in every 6 shots.
- \`B\` = the proof on paper (\`sketch-graph\`: blue ballpoint sums worked line by line on graph paper, an envelope back or an index card, ruled charts, one red result): show what the narration claims, with its real numbers.
- \`C\` = the loud page (\`sketch-loud\`: one huge marker word or number the red pen corrects, a flipbook riffled in the corner, sticky notes slapped on): open acts and land the biggest facts; short and rare.`,
  tensionLooks:
    '- Rolls and looks by tension: high tension → loud C-roll pages and tight A-roll pages (one figure, one object, close); calm → A-roll story pages with room around the drawing; B-roll proofs on plateaus where the narration explains or proves.',
  rhythm:
    'Rhythm: never more than 2 shots in a row in one look; change roll, look or treatment at least every 6–8 s; open each act with a C-roll page and a page-native transition.',
  shared:
    'every look draws in the same notebook (paper stocks, felt-tip, ballpoint, pencils, one red pen, hand lettering, line boil)',
  transitionIn:
    'a page-native transition (`"type": "wipe"` with a `style` from the list below and about its duration)',
  camera:
    "The camera is the reader's eye over the page: an intent may ask for a slow push toward the focal drawing or a held frame, never a move that crops the hand lettering, never a spin or an orbit.",
  interrupts:
    '`"interrupt": { "kind": "look-switch", "note": "the story page is torn out and the marker slams 365 onto a fresh page" }`. Kind in this world: only `look-switch` (the look changes from the previous shot; give the shot a page-native `transitionIn`).',
  marks:
    "In this world every mark is drawn by the hand on the page in the look's own pen: a pin is a hand-written label with a two-stroke arrow, a ring is a pencil loop, an underline is uneven, a stamp is the red pen, a counter is a number written and corrected; every label comes from the narration.",
  annotate:
    "draw each by hand on the page (`page.write`, `page.arrow`, `page.loop`, `page.underline`, `page.crossOut`), timed to its spoken phrase (`at: 'the phrase'`), on the named target, never with `ctx.annotate` or `ctx.text`",
  motion:
    'Let each drawing land and hold (a still beat of at least 0.4 s), the hand clear of the subject: always create the page with `duration: ctx.shot.duration` (the hand leaves the subject in the last 0.4 s) and never overlap in time two marks more than 80 px apart (the one hand queues them, up to 0.6 s, or they appear without it; `parallel: true` only on purpose); move the camera only to reveal or to push toward the focal point.',
  missing:
    'Draw everything the narration needs by hand on the page (strokes, figures, sheets, inserts): this world has no props to build, so never end your reply with a `MISSING:` line.',
  craftBrief: CRAFT_BRIEF,
  criticMedium: 'hand-drawn sketchbook',
  criticStyle:
    'a hand-drawn notebook page: paper, felt-tip, ballpoint, pencils and one red pen, hand lettering, a visible hand, slight line wobble',
  vibe: 'Vibe check (every look of the film must feel like one notebook): paper, hand-drawn strokes with a slight wobble, hand lettering, the same few inks. Clean vector shapes, glossy gradients, rendered 3D, pixel-art fonts or software windows break the world: answer `off-intent` with a note starting `vibe:`.',
  checklist:
    'one focal point, off-centre, big enough to read (about a quarter of the page height or more); red ink only on the point; crude, slightly wobbly figures and lettering (never slick or symmetric); at most 6 elements; human traces such as a crossed-out word with its correction, a two-stroke arrow, a pencil fill out of the lines, an uneven underline, a margin note, tape, a coffee ring, a smudge. Only authored marks count as traces: the spiral binding, the paper (lines, grid, grain), the page number and the visible hand never do. Slop tells: a centred symmetric layout, decoration without meaning, rows of icons, invented labels or gibberish, everything evenly spaced, tiny figures on a mostly empty page, the hand covering the subject.',
  surprise:
    'a sudden page moment (e.g. "the page is torn out and a pop-up card stands up with the answer", "a flipbook riffles through the years"); never a camera move (no dolly zoom, orbit, rack focus or screen)',
  moments: SKETCHBOOK_MOMENTS,
};

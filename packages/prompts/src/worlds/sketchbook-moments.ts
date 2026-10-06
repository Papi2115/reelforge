/**
 * The Sketchbook moment catalog (real run Sketchbook 1, docs/worlds/README.md "Variety"): the
 * closed list of page moments the storyboard plans per shot from the narration (`worldMoment`),
 * with the host looks, the exact kit call the scene turn makes (packages/kit/src/worlds/sketchbook,
 * templates in packages/kit/examples/sketchbook) and what the critic must see. `popup` and `strip`
 * are the breakthroughs (docs/worlds/sketchbook-v2 shots 5 and 8).
 */
import type { WorldMomentOption } from './types.js';

const STORY = 'sketch-story';
const GRAPH = 'sketch-graph';
const LOUD = 'sketch-loud';

export const SKETCHBOOK_MOMENTS: readonly WorldMomentOption[] = [
  {
    id: 'popup',
    breakthrough: true,
    looks: [LOUD],
    useWhen:
      'turns on a reveal, a twist, the answer to an open question or the one fact the film is about (a C-roll page); say in the intent which mechanism the pulled ribbon drives and the claim its motion shows, never the same mechanism twice in a film',
    build:
      "`page.popup({ x, y, w, depth, at, intent: '<the claim the motion shows>', elements: [ … ], pull: { at } })` (look `sketch-loud`; element kinds, motions, `appear` labels and caps in `reelforge kit-docs`). Every pop-up is original: no template, never copy the showcase or a catalog example. Invent a paper mechanism that visualises this shot's claim and play with it: the ribbon pulled at the side must trigger a motion that MEANS something in the narration (the sun slides, so the calendar drifts). Inspiration, each a different mechanism: a thermometer or water level rising, a door or flap opening on the answer, a slider moving along a timeline, a wheel or gear turning a counter, a curtain drawn aside, a pointer moving along a scale. Never the same mechanism twice in one film. `intent` (required) names the claim the motion shows (`the dancers multiply day by day`), never a generic `reveal`. Every element, and above all every element that moves, is something the narration names (no decorative disc, sun or arm); every word from the narration; nothing else is written on the card while it opens. Make the card the shot: open it within the first second, hold it standing for at least 1.5 s, pull on the spoken claim.",
    visible:
      "a pop-up card standing up from the page (paper pieces rising from a fold); once the side ribbon is pulled, its motion must express the shot intent's claim: name that claim as the focal point; a pull whose motion shows nothing the narration says (a decorative disc, a swinging arm) is `off-intent` with a note starting `pull:`",
  },
  {
    id: 'strip',
    breakthrough: true,
    looks: [GRAPH],
    useWhen:
      'runs through a sequence of dates or steps (a chronology, a campaign day by day, a before-and-after in stages; a B-roll page, treatment `node-graph/timeline`)',
    build:
      "`page.strip({ y: 156, events: [{ label: '2 NOV', note: 'first try' }, { label: '4 NOV', note: ['ambush', 'gun jams'], doodle: 'figure' }, …], highlight: 1, at, until, pen: 'bic' })` (look `sketch-graph`; template `b4_strip.js`): 2-8 events in order (`label` <= 10 characters, `note` one or two lines <= 22 each, `year` on every event or none, increasing), `highlight` = the event that is the point (its note in red after a held beat; no other red), `until` = when the last note is written (its pace may stretch 0.7-1.8x), `end: 'now'` only when the timeline really runs on to today. Time the events to their spoken dates.",
    visible:
      'an accordion paper strip dragged through the view with dated panels written on it (folded panels at the left)',
  },
  {
    id: 'flipbook',
    breakthrough: false,
    looks: [LOUD],
    useWhen:
      'counts or races through years, numbers or a change over time in one breath ("over the next decade…")',
    build:
      '`const book = page.flipbook({ count: 22, at, until })` then draw every `book.page(k)` (the same doodle, the changing number huge in marker) on a `sketchPage({ …, pen: false })` (look `sketch-loud`; template `c2_flipbook.js`). Make it big: the riffled pages fill at least a third of the frame, never a thumb-sized corner.',
    visible: 'a flipbook riffling with a big changing number or drawing',
  },
  {
    id: 'envelope',
    breakthrough: false,
    looks: [GRAPH],
    useWhen:
      'stacks several facts or a calculation into one result (a sum, a subtraction, a ratio worked out)',
    build:
      "`const sheet = page.sheet({ x, y, w, h, deg, paper: 'kraft', envelope: true })`, then work the sum on it with `page.write(text, { attach: sheet.frame(), tool: 'bic', hand: 'print' })` line by line, the result once in `tool: 'red'` (look `sketch-graph`; template `b2_envelope.js`).",
    visible: 'a kraft envelope back taped on the page with a worked calculation',
  },
  {
    id: 'sticky-slap',
    breakthrough: false,
    looks: [LOUD, STORY],
    useWhen:
      'lands a short verdict, a label or a scoreline the narration says outright ("REFUSED", "a draw")',
    build:
      "`const note = page.sheet({ x, y, w: 180, h: 160, deg, paper: 'sticky', at })` slapped on at the spoken word (falls, squashes, then tape), marker text with `page.write(word, { attach: note.frame(), hand: 'marker' })`; one or two notes, words only from the narration.",
    visible: 'a sticky note slapped onto the page with a marker word',
  },
  {
    id: 'torn-page',
    breakthrough: false,
    looks: [],
    transition: 'sketchbook-torn-strip',
    useWhen:
      'breaks with what came before (a plan abandoned, "forget that", a fresh start); the shot opens with the `sketchbook-torn-strip` transition',
    build:
      '`kit.fx.sketchPage({ …, duration: ctx.shot.duration, torn: true })`: the stubs of the torn-out page stay in the spiral; the new page starts nearly empty and fills fast with the new idea.',
    visible: 'torn stubs of a ripped-out page in the spiral binding',
  },
  {
    id: 'ruler-graph',
    breakthrough: false,
    looks: [GRAPH],
    useWhen: 'compares amounts or shows a trend (bigger than, half of, rising, falling)',
    build:
      "a hand-ruled chart: axes and bars with `page.ruled(x0, y0, x1, y1, { tool: 'bic' })` and labelled hand ticks, boxes that fill with `page.fill(…, { color: 'bicLight', dir: -1 })`, and `page.ruler(x, y, { at, until })` slid in under the line being ruled (look `sketch-graph`; template `b3_rule.js`); real values with units on the axes.",
    visible: 'a hand-ruled chart with labelled axes (a plastic ruler slid in while ruling)',
  },
];

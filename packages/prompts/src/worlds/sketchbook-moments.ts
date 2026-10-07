/**
 * The Sketchbook moment catalog (real run Sketchbook 1, docs/worlds/README.md "Variety"): the
 * closed list of page moments the storyboard plans per shot from the narration (`worldMoment`),
 * with the host looks, the exact kit call the scene turn makes (packages/kit/src/worlds/sketchbook)
 * and what the critic must see. `popup` and `strip` are the breakthroughs. A moment is a page
 * mechanism, never a topic: what it shows is always THIS film's claim (PLAN.md#13.15 phase 2).
 */
import { snippet, SKETCHBOOK_SNIPPETS } from './sketchbook-snippets.js';
import type { WorldMomentOption } from './types.js';

const STORY = 'sketch-story';
const GRAPH = 'sketch-graph';
const LOUD = 'sketch-loud';

const SNIP_FLIPBOOK = SKETCHBOOK_SNIPPETS.flipbook;
const SNIP_ENVELOPE = SKETCHBOOK_SNIPPETS.envelope;
const SNIP_STICKY = SKETCHBOOK_SNIPPETS.sticky;

const POPUP_BUILD = `\`page.popup({ intent, x, y, w, depth, at, elements, pull })\` (look \`sketch-loud\`), a toolkit, never a template. The shape of a call (one mechanism of many; never copy it): ${snippet('popup')}; another mechanism: ${snippet('popupFlap')}. Every pop-up is original: invent the paper mechanism that visualises THIS shot's claim and play with it: the ribbon pulled at the side must trigger a motion that MEANS something in the narration. Mechanisms are metaphors for any topic, each a different one: a \`gauge\` (thermometer or water level, \`level\`) rising for any quantity that grows, a \`flap\` (door) opening on the answer for any reveal (\`open\`), a \`window\` sliding to the next item (\`index\`), a \`wheel\` or gear (\`teeth: true\`, \`angle\`) turning a \`counter\` (\`value\`) for a cause that drives a number, a \`card\` drawn aside like a curtain (\`x\`, \`show\`), a \`scale\` pointer tipping between two ends (\`value\`); blocks and cutouts \`rise\`/\`slide\`, an \`arm\` swings (\`angle\`). Never the same mechanism twice in one film. \`intent\` (required, 12-160 characters) names the claim the motion shows (\`the queue doubles every week\`), never a generic \`reveal\`. Give every moving piece an \`id\`; \`pull\`: \`tab\` (tab, ribbon, knob, lever), \`side\` (left, right, bottom), \`motions\` (\`target\` id, \`to\` its values, \`span\` share of the pull, \`ease\`) or a pure \`drive: (p, t) => ({ id: { prop: n } })\`, \`focus\` = the id the red pen loops, \`callout\` (loop, trail, notch for an arm, none). At most 8 pieces (block, cutout, arm, card, flap, gauge, wheel, counter, window, scale, tag, note); a piece may rise on its own word (\`at\`). Every element, and above all every element that moves, is something the narration names (no decorative disc or arm); every word from the narration; nothing else is written on the card while it opens. Make the card the shot: open it within the first second, hold it standing for at least 1.5 s, pull on the spoken claim. Every piece and option: \`reelforge kit-docs sketchPage\`.`;

export const SKETCHBOOK_MOMENTS: readonly WorldMomentOption[] = [
  {
    id: 'popup',
    breakthrough: true,
    looks: [LOUD],
    cue: 'a reveal or twist',
    useWhen:
      'turns on a reveal, a twist, the answer to an open question or the one fact the film is about (a C-roll page); say in the intent which mechanism the pulled ribbon drives and the claim its motion shows, never the same mechanism twice in a film',
    build: POPUP_BUILD,
    visible:
      "a pop-up card standing up from the page (paper pieces rising from a fold); once the side ribbon is pulled, its motion must express the shot intent's claim: name that claim as the focal point; a pull whose motion shows nothing the narration says (a decorative disc, a swinging arm) is `off-intent` with a note starting `pull:`",
  },
  {
    id: 'strip',
    breakthrough: true,
    looks: [GRAPH],
    cue: 'a sequence of dates',
    useWhen:
      'runs through a sequence of dates or steps (a chronology, a campaign day by day, a before-and-after in stages; a B-roll page, treatment `node-graph/timeline`)',
    build: `${snippet('strip')} (look \`sketch-graph\`): 2-8 events in order (\`label\` <= 10 characters, \`note\` one or two lines <= 22 each, \`year\` on every event or none, increasing), \`highlight\` = the event that is the point (its note in red after a held beat; no other red), \`until\` = when the last note is written (its pace may stretch 0.7-1.8x; the kit says the range when it does not fit), \`end: 'now'\` only when the timeline really runs on to today. Time the events to their spoken dates or steps (\`at\` may be a spoken phrase).`,
    visible:
      'an accordion paper strip dragged through the view with dated panels written on it (folded panels at the left)',
  },
  {
    id: 'flipbook',
    breakthrough: false,
    looks: [LOUD],
    useWhen:
      'counts or races through years, numbers or a change over time in one breath ("over the next decade…")',
    build: `\`const book = ${SNIP_FLIPBOOK}\` then draw every \`book.page(k)\` (the same doodle of the thing that changes, the changing number huge in marker) on a \`sketchPage({ …, pen: false })\` (look \`sketch-loud\`). Make it big: the riffled pages fill at least a third of the frame, never a thumb-sized corner.`,
    visible: 'a flipbook riffling with a big changing number or drawing',
  },
  {
    id: 'envelope',
    breakthrough: false,
    looks: [GRAPH],
    useWhen:
      'stacks several facts or a calculation into one result (a sum, a subtraction, a ratio worked out)',
    build: `\`const sheet = ${SNIP_ENVELOPE}\`, then work the sum on it with \`page.write(text, { attach: sheet.frame(), tool: 'bic', hand: 'print' })\` line by line, the result once in \`tool: 'red'\` (look \`sketch-graph\`).`,
    visible: 'a kraft envelope back taped on the page with a worked calculation',
  },
  {
    id: 'sticky-slap',
    breakthrough: false,
    looks: [LOUD, STORY],
    useWhen:
      'lands a short verdict, a label or a scoreline the narration says outright ("REFUSED", "a draw")',
    build: `\`const note = ${SNIP_STICKY}\` slapped on at the spoken word (\`at\`; it falls, squashes, then tape), marker text with \`page.write(word, { attach: note.frame(), hand: 'marker' })\`; one or two notes, words only from the narration.`,
    visible: 'a sticky note slapped onto the page with a marker word',
  },
  {
    id: 'torn-page',
    breakthrough: false,
    looks: [],
    transition: 'sketchbook-torn-strip',
    useWhen:
      'breaks with what came before (a plan abandoned, "forget that", a fresh start); the shot opens with the `sketchbook-torn-strip` transition',
    build: `${snippet('tornPage')}: the stubs of the torn-out page stay in the spiral; the new page starts nearly empty and fills fast with the new idea.`,
    visible: 'torn stubs of a ripped-out page in the spiral binding',
  },
  {
    id: 'ruler-graph',
    breakthrough: false,
    looks: [GRAPH],
    useWhen: 'compares amounts or shows a trend (bigger than, half of, rising, falling)',
    build: `a hand-ruled chart of the narration's real values with units: a diagram (${snippet('chart')}; also \`'line'\`, \`'pie'\`, \`'stack'\`), or your own axes and bars with ${snippet('ruled')} and labelled hand ticks, boxes that fill with ${snippet('fill')}; ${snippet('ruler')} slides in under the line being ruled (look \`sketch-graph\`).`,
    visible: 'a hand-ruled chart with labelled axes (a plastic ruler slid in while ruling)',
  },
];

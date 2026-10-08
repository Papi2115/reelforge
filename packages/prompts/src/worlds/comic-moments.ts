/**
 * The Comic moment catalog (docs/worlds/README.md "Variety", QUALITY.md §6/§8.2): the closed list
 * of page moments the storyboard plans per shot from the narration (`worldMoment`), with the host
 * looks, the page grammar and the exact kit call the scene turn makes
 * (packages/kit/src/worlds/comic) and what the critic must see. Every moment is grammar, never
 * content: what is drawn comes from the film's narration (`page.art`, the project's assets).
 * `flashback` and `spread` are the breakthroughs: creative toolkits with a required `intent`,
 * never a template, never the same mechanism twice in a film; both may be built with the open
 * toolkit `page.panelBreak` (PLAN.md#13.15), whose motion is invented per claim.
 */
import { comicSnippet as snippet } from './comic-snippets.js';
import type { WorldMomentOption } from './types.js';

const STORY = 'comic-story';
const INFO = 'comic-info';
const LOUD = 'comic-loud';

/** The open toolkit both breakthroughs may be built with (PLAN.md#13.15, real run Comic 2). */
const TOOLKIT = `the open toolkit ${snippet('panelBreak')} (the shape of a call, never copy it): 1-5 panels you shape and place (\`box\` or \`quad\`, \`shape: 'rect' | 'lean' | 'wedge' | 'shard'\`, painted in panel-local px), how each arrives (\`enter: 'cut' | 'slide' | 'slam' | 'pop' | 'drop' | 'swing' | 'grow' | 'unroll'\` from a side or hinge), \`moves\` on the narration's phrases (\`to: { x, y, rotate, scale, box, border }\`; several targets with \`lag\` = one panel pulls the others after it) or a pure \`drive(t)\`, what the gutters do meanwhile (\`gutters: { kind: 'close' }\` = the borders melt into one picture, \`'lift'\` = the panels come off the page as loose pieces, \`'tear'\`), a camera inside a panel, \`fold\` = a spine crease. The MOTION is the point: it must show the claim (what moves, where to, and why that is what the narration says); no decorative pieces`;

const FLASHBACK_BUILD = `A look back, never a template (look \`comic-info\`). First decide what the look back must SHOW (the claim of THIS narration) and which motion shows it, then build it. Preferably invent the mechanism with ${TOOLKIT}; \`print: 'past'\` prints its panels as the older sepia job (a panel's own \`print\` makes a then-and-now), \`when\` = the time-stamp caption. Or use \`page.flashback({ intent, when, at, until, cover, arrange, beats, stamp })\` with an arrangement chosen for this story (the shape of a call, on a made-up topic; never copy it): ${snippet('flashback')}. Every flashback is original: \`cover: 'page'\` (the whole page re-inked as an old sepia print) or \`'strip'\` (a torn strip pasted over the present page, which stays in colour; give it \`until\` to leave), \`arrange: 'rows' | 'row' | 'stair' | 'pile'\`, \`box\`, \`tilt\`, \`enter\`; there are no defaults, and the showcase's own pairs (page + rows, strip + row) are never yours. Never the same cover and arrangement twice in one film, never the same mechanism twice. \`intent\` (required, 12-240 characters) names the claim in the narration's words, never a generic "flashback"; \`when\` = the time-stamp caption in the narration's words. 1-5 \`beats\`, one per narrated moment, each \`{ at: 'its phrase', draw: (g, t, [w, h]) => …, weight, caption }\` in narration order, >= 0.15 s apart (beat-local px, 0,0 = its top-left; the beat that is the point gets the biggest \`weight\`); draw each with \`page.art\` (generators, the project's cast by id) so the past is as readable as the present; an optional \`stamp\` (a date from the narration, the only red of the past). Captions appear at once; \`type: s\` letters them in only when the typing itself means something. Draw only what the narration names (no decorative scenery); every word from the narration. It may open with \`comic-page-back\`; the next shot may leave it with \`comic-ink-bleed\`.`;

const SPREAD_BUILD = `The big picture, never a template (look \`comic-loud\`; build the page with \`duration: ctx.shot.duration\`). ONE picture across both pages and the fold (page px 640x360, bleed past the edges) of the specific place, crowd, landscape or machine THIS narration names, built with \`page.art\` (a backdrop, a crowd, the film's cast), its title (a word from the narration) built into the picture with \`g.standing('TITLE', { x, y0, y1, h0, h1 })\` or none. Decide which motion shows how this picture comes together, then build it. Preferably invent the mechanism with ${TOOLKIT} (e.g. pieces that each paint their part of the one picture and are pulled into register with \`gutters: { kind: 'close' }\` and a \`fold\`). Or use \`page.spread({ intent, art, assemble, pieces, delay, dur, focus, insets, beats })\` (the shape of a call, on a made-up topic; never copy it): ${snippet('spread')}: \`assemble: 'merge'\` (panels that turn out to be one picture; \`pieces: 'grid' | 'columns' | 'halves'\` required), \`'unfold'\` (the book opens from the spine) or \`'pull-back'\` (a small panel on \`focus\` pulls back to the whole spread); there are no defaults, and the showcase's own assemblies (merge + grid, unfold) are never yours. Never the same assembly twice in one film, never the same mechanism twice. \`intent\` (required, 12-240 characters) names what the big picture shows, never a generic "big reveal". It may hold still, but never > 4 s without a new beat: \`beats\` (the narration's phrases landing), a \`page.note\`, a caption or up to 3 \`insets\` \`{ box: [x, y, w, h], at, draw }\` once it is whole.`;

export const COMIC_MOMENTS: readonly WorldMomentOption[] = [
  {
    id: 'flashback',
    breakthrough: true,
    looks: [INFO],
    cue: 'a look back to where it came from',
    useWhen:
      'goes back in time to where something came from (an origin, a cause, "years earlier", "it started in…"; a B-roll page); say in the intent the claim the look back shows and how the past sits on the page, never the same cover and arrangement twice in a film',
    build: FLASHBACK_BUILD,
    visible:
      "the page printed as an older sepia print (brown ink, coarse screen, yellowed paper) or a torn sepia strip pasted over the colour page, with a time-stamp caption and narrated panels revealed one by one; name the intent's claim as the focal point; a flashback whose panels show nothing the narration says (decorative scenery, a generic past) is `off-intent` with a note starting `flashback:`",
  },
  {
    id: 'spread',
    breakthrough: true,
    looks: [LOUD],
    cue: 'the big picture',
    useWhen:
      'lands the big picture the film has been building to (an arrival, the scale of a place or a crowd, the thing as a whole, the moment everything changes; a C-roll page); say in the intent what the one picture shows and how it assembles, never the same assembly twice in a film',
    build: SPREAD_BUILD,
    visible:
      'one picture running across both pages and the fold (a spine crease in the middle, the margins gone); name what it shows as the focal point; a spread whose picture shows nothing the narration says, or that holds still for more than 4 s with nothing new, is `off-intent` with a note starting `spread:`',
  },
  {
    id: 'pause-panel',
    breakthrough: false,
    looks: [LOUD],
    useWhen:
      'falls silent or holds its breath right before a twist, a verdict or an arrival ("and then…", a long beat of silence)',
    build: `one almost empty panel, a wide flat field with ONE small detail of the narration's world that changes in held steps, no lettering, held >= 1.5 s: ${snippet('pause')} (look \`comic-loud\`). It is the only panel on the page; the next shot breaks the silence.`,
    visible: 'one almost empty panel (a flat field with one small detail) and no lettering',
  },
  {
    id: 'impact-break',
    breakthrough: false,
    looks: [LOUD, STORY],
    useWhen:
      'lands a hit, a crash, an alarm or another sudden event ("the dam broke", "a shot rang out")',
    build: `a panel slams in past the margin (${snippet('slam')}) with ${snippet('shake')} on the impact and ONE onomatopoeia of the event breaking out of the panel (${snippet('sfx')}: big imperfect letters on uneven beats; a sound word that fits the event, never a slur or close to one); speed lines stop before the subject (\`g.speedLines({ x, y, dx, dy, gap })\`), a \`page.art.effect\` (impact, motion) on the hit; then the page holds. One loud word only, never cropped by the camera.`,
    visible: 'a panel slammed onto the page and one big onomatopoeia breaking the panel frame',
  },
  {
    id: 'cutaway',
    breakthrough: false,
    looks: [INFO],
    useWhen: 'explains how a machine, a body or a place works inside, or what happened inside it',
    build: `the real thing the narration names, drawn whole first (a generator or the project's prop), then its front torn open along ${snippet('torn')} (ink the torn edge, the inside on a darker plate), its parts named by hand with kinked leaders (\`g.text\` + \`g.ink(pts, { closed: false })\`), the thing that matters moving inside, a caption with the definition (look \`comic-info\`); real names, numbers and directions only, as the research notes give them.`,
    visible:
      'a drawn object with its front torn open showing the inside, its parts named with leaders',
  },
  {
    id: 'checklist',
    breakthrough: false,
    looks: [INFO],
    useWhen:
      'weighs conditions, steps or options toward a verdict (which option won, what was kept and what was dropped)',
    build: `a clipboard, card or slate that fits the narration's world, in its own panel: 3-5 items lettered from the narration, ticked one by one with ${snippet('tick')} (each tick on its own beat), the wrong option struck with ${snippet('strike')} and the right one written beside it, ${snippet('highlight')} on the answer (look \`comic-info\`); never a tidy spreadsheet.`,
    visible: 'a hand-ticked checklist with one item struck out and the answer highlighted',
  },
  {
    id: 'big-line',
    breakthrough: false,
    looks: [LOUD, STORY],
    useWhen:
      'speaks the one line the film turns on (a famous quote, a shouted warning, a verdict said aloud)',
    build: `a smaller balloon first, then the line lettered large: ${snippet('bigLine')} (\`size: 2\`, the tail at the speaker, who is drawn), lots of empty paper around it, a pencilled note or time in the margin (${snippet('note')}). The words exactly as the narration says them.`,
    visible: 'one big speech balloon lettered large with empty paper around it',
  },
  {
    id: 'squeeze',
    breakthrough: false,
    looks: [STORY],
    useWhen:
      'tightens: time runs out, pressure builds, the walls close in ("ten minutes left", a countdown)',
    build: `the gutters close in at different speeds: panels \`morph\` to tighter quads on uneven timings (${snippet('squeeze')}), a new panel shoves its way in (\`enter({ at, kind: 'slide' })\`), then the page freezes for a beat.`,
    visible: 'panels whose gutters close in, squeezing the page',
  },
];

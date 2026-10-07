/**
 * The kit-docs lines of the open-vocabulary page methods (PLAN.md#13.15a), joined into the
 * `kit.fx.sketchPage` methods table. The `draw` line lists every generator kind and its types
 * from the registry, so the docs never drift from the code.
 */
import { DIAGRAM_KINDS } from './diagrams.js';
import { vocabularyLines } from './gen/index.js';
import { MOOD_NAMES, POSE_NAMES } from './person.js';
import { CLOTHES, HAIRS, HATS, SKINS } from './person-parts.js';
import { NIB_NAMES, PART_KINDS } from './spec.js';

const list = (values: readonly string[]): string => values.join('|');

export const VOCAB_METHODS: Readonly<Record<string, string>> = {
  'draw(kind, { x, y, h | w, type, color, action, count, shade, flip, rot, anchor, plain, bold, at, until, speed, hero, appear, subject })': `Hand-drawn things for THIS film's nouns, generated per call (seeded, rough on purpose, one crayon colour, shade dense for a hero on a busy ground; anchored bottom-centre, h = height on the page; backdrops take w x h). ${vocabularyLines().join(' || ')}. Returns { at, end, box }`,
  'person({ x, y, h, face, action, mood, like, body, clothes, color, hat, hatColor, hair, hairColor, skin, holds, holdSize, hand, pose, expression, at, until })': `A crude person drawn by the hand: action ${list(POSE_NAMES)}; face 1 (right) | -1 | 0; mood ${list(MOOD_NAMES)} or [{ at, mood }]; body stick|blob; clothes ${list(CLOTHES)}; hat ${list(HATS)}; hair ${list(HAIRS)}; skin ${list(SKINS)}; holds = a tool/object/instrument type or a prop id; pose/expression override; returns the figure handle (joint, carry, head, jointAt)`,
  'crowd({ x0, x1, y, count, h, rows, colors, at })':
    'Many simple people (heads and shoulders) along a ground line, back rows smaller',
  'doodle({ box: [w, h], parts, wobble }, { x, y, h | w, anchor, flip, rot, at, until, attach })': `Your own drawing in local units (y down): parts ${PART_KINDS.map((kind) => `{ ${kind} }`).join(' ')} - blob [cx, cy, rx, ry], circle [cx, cy, r], rect [x, y, w, h], poly/line/hatch/scribble/dots points, arc [cx, cy, r, from, to], rays [cx, cy, r0, r1] + count, zigzag [x0, y0, x1, y1] + teeth, amp, wave [x0, y, x1] + count, amp; each with nib ${list(NIB_NAMES)}, color, width, fill (+ shade hatch|dense|light|scribble), line sharp/arrow, wobble`,
  'spot({ rows, legend, px }, { x, y, h })':
    "Tiny spot-art icon: rows of characters ('.' and ' ' = paper), legend { '#': 'ink', 'o': { color: 'orange', nib: 'crayon' } }; each run of a row is one hand dab",
  'diagram(kind, spec)': `Diagram kit (${list(DIAGRAM_KINDS)}): callout { x, y, label, from: [x, y], ring }, timeline { x, y, w, events: [{ label, pos }] }, map { x, y, w, h, land, route: [[u, v]], mark: [u, v], places: [{ label, at }] }, bars { x, y, w, h, bars: [{ value, label }], values }, line { x, y, w, h, points, from, to }, pie { x, y, r, slices: [{ value, label }] }, venn { x, y, r, sets: [{ label }, { label }], both }, flow { x, y, w, steps: [{ label }], direction }, stack { x, y, items: [{ label }], bullet }, cutaway { x, y, w, h, layers: [{ label, color, depth }] }; pen felt|bic|fine|pencil, size, labels appear|hand, highlight = index of the one red element`,
  'defineFigure(id, look) / defineProp(id, spec) / use(id, place)':
    "The film's recurring things, the same drawing in every shot: defineFigure('ranger', { clothes: 'vest', hat: 'brim', holds: 'axe' }) then person({ like: 'ranger', x, y, action }); defineProp('fire-tower', { doodle } | { spot } | { draw: 'building', type: 'tower' }, + h) then use('fire-tower', { x, y, h }). Project files assets/sketchbook/<id>.json { version: 1, id, kind: figure|prop, description, spec } arrive as sketchPage({ library })",
};

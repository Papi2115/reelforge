/**
 * Sketchbook guards on the open vocabulary (PLAN.md#13.15 phase 2): films far from the showcase.
 * The false-positive side: the kit's six open examples (forest, ocean, space station, village,
 * desert, city), each judged against its own narration and research notes, report nothing (text
 * provenance of `page.write` and every diagram label, human traces, stagger, pop-up intents). The
 * other side: planted fakes written with the open API (generators, `person`, diagrams, defined
 * props) on the same topics; at least 90 % must be caught.
 */
import { describe, expect, it } from 'vitest';
import {
  openSketchbookSource,
  SKETCHBOOK_OPEN_EXAMPLES,
} from '../testing/sketchbook-open-fixtures.js';
import { slopSourceFindings, type AntiSlopSetup } from './guards.js';
import { countTraces, MIN_HUMAN_TRACES } from './source-guards.js';
import { onScreenTexts, parseScene } from './source-text.js';
import { inventedTexts } from './text-provenance.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const SKETCHBOOK = worldSlopSpec('sketchbook');
if (SKETCHBOOK === undefined) throw new Error('no Sketchbook spec');
const SPEC = SKETCHBOOK;

function setupFor(file: string): AntiSlopSetup {
  const example = SKETCHBOOK_OPEN_EXAMPLES.find((entry) => entry.file === file);
  if (example === undefined) throw new Error(`no open example ${file}`);
  const vocabulary = buildVocabulary([example.narration, example.research]);
  // Source guards only: the accent share is a frame check.
  return { vocabulary, spec: SPEC, accent: undefined };
}

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

const DIAGRAMS = `export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540], library: ctx.worldAssets });
  page.defineProp('roof', { h: 26, doodle: { box: [40, 26], parts: [{ rect: [0, 0, 40, 26] }] } });
  page.person({ like: 'ranger', x: 200, y: 470, h: 170, action: 'point', mood: 'happy', holds: 'map' });
  page.draw('tree', { type: 'oak', x: 300, y: 470, h: 270, hero: true });
  page.diagram('callout', { x: 1, y: 2, label: 'old oak', from: [600, 486], labels: 'hand' });
  page.diagram('map', { x: 1, y: 2, w: 300, h: 200, places: [{ label: 'well', at: [0.1, 0.2] }], compass: true });
  page.diagram('line', { x: 1, y: 2, w: 300, h: 200, points: [1, 3], from: 'then', to: 'now' });
  page.diagram('venn', { x: 1, y: 2, r: 80, sets: [{ label: 'city' }, { label: 'people' }], both: 'half' });
  page.diagram('flow', { x: 1, y: 2, w: 300, steps: [{ label: 'dig' }, { label: 'build' }] });
  page.diagram('stack', { x: 1, y: 2, items: [{ label: '100 litres' }, { label: 'fat' }] });
  page.write('N', { x: 900, y: 40, size: 18, appear: 'pop' });
  return { page };
}`;

describe('Sketchbook guards on the open examples (false positives)', () => {
  it('has the six open examples', () => {
    expect(SKETCHBOOK_OPEN_EXAMPLES.map((entry) => entry.file)).toEqual([
      'o1_forest.js',
      'o2_ocean.js',
      'o3_space.js',
      'o4_village.js',
      'o5_desert.js',
      'o6_city.js',
    ]);
  });

  it('reads every diagram label as on-screen text, never ids, kinds, types or a label mode', () => {
    const texts = onScreenTexts(program(DIAGRAMS), SPEC).map((entry) => entry.text);
    expect(texts).toEqual([
      'old oak',
      'hand',
      'well',
      'then',
      'now',
      'half',
      'city',
      'people',
      'dig',
      'build',
      '100 litres',
      'fat',
      'N',
    ]);
    // A label mode (`labels: 'hand'`) and a compass letter are never judged as invented.
    const vocabulary = buildVocabulary(['nothing on topic']);
    const judged = [
      { text: 'hand', line: 1 },
      { text: 'appear', line: 2 },
      { text: 'N', line: 3 },
    ];
    expect(inventedTexts(judged, vocabulary, SPEC)).toEqual([]);
  });

  it.each(SKETCHBOOK_OPEN_EXAMPLES.map((entry) => entry.file))(
    '%s: no invented text and no finding through the public source guard',
    (file) => {
      const source = openSketchbookSource(file);
      const setup = setupFor(file);
      const invented = inventedTexts(onScreenTexts(program(source), SPEC), setup.vocabulary, SPEC);
      expect(invented.map((entry) => `${entry.text} (${entry.unknown.join(', ')})`)).toEqual([]);
      expect(slopSourceFindings(setup, source, file).map((entry) => entry.message)).toEqual([]);
      expect(countTraces(program(source), SPEC).total).toBeGreaterThanOrEqual(MIN_HUMAN_TRACES);
    },
  );
});

/** A page with three traces and no lettering around `body` (open API, a project figure). */
const page = (body: string): string =>
  `export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540], duration: ctx.shot.duration, layout: 'landscape', library: ctx.worldAssets });
  page.person({ like: 'ranger', x: 200, y: 470, h: 170, action: 'point', at: 1.2 });
  page.draw('tree', { type: 'oak', x: 300, y: 470, h: 270, hero: true, at: 0.4 });
  page.coffeeRing(880, 470, 38);
  page.tape(70, 28, 90, 22, -8);
  page.crossOut(600, 100, 90, 28, { at: 5 });
${body}
  return { page };
}
export function update(t, state) { state.page.update(t); }
`;

const flags = (file: string, body: string, reason: string): boolean =>
  slopSourceFindings(setupFor(file), page(body), 'scenes/s01.js').some((entry) =>
    entry.message.startsWith(reason),
  );

const CASES: readonly (readonly [string, () => boolean])[] = [
  ['invented title', () => flags('o1_forest.js', `  page.write('ANCIENT GROVE', { x: 600, y: 80, size: 40, at: 1 });`, 'invented text')],
  ['fake depth number', () => flags('o2_ocean.js', `  page.write('3,500 m', { x: 600, y: 80, size: 40, at: 1 });`, 'invented text')],
  ['invented map place', () => flags('o4_village.js', `  page.diagram('map', { x: 120, y: 110, w: 520, h: 340, places: [{ label: 'well', at: [0.1, 0.8] }, { label: 'Oakvale Abbey', at: [0.6, 0.3] }], at: 0.5 });`, 'invented text')],
  ['invented chart labels', () => flags('o1_forest.js', `  page.diagram('bars', { x: 140, y: 450, w: 420, h: 260, bars: [{ value: 3, label: 'PINES' }, { value: 5, label: 'BIRCHES' }], at: 0.6 });`, 'invented text')],
  ['fake share on a bar label', () => flags('o6_city.js', `  page.diagram('bars', { x: 140, y: 450, w: 420, h: 260, bars: [{ value: 30, label: '30 %' }, { value: 75, label: '75 %' }], at: 0.6 });`, 'invented text')],
  ['invented ends of a line chart', () => flags('o5_desert.js', `  page.diagram('line', { x: 140, y: 450, w: 420, h: 260, points: [1, 3, 2], from: 'DRY SEASON', to: 'MONSOON', at: 0.6 });`, 'invented text')],
  ['invented venn overlap', () => flags('o6_city.js', `  page.diagram('venn', { x: 480, y: 300, r: 90, sets: [{ label: 'city' }, { label: 'people' }], both: 'MEGACITY', at: 0.6 });`, 'invented text')],
  ['invented flow step', () => flags('o3_space.js', `  page.diagram('flow', { x: 100, y: 300, w: 600, steps: [{ label: 'station' }, { label: 'Zarya Module' }], at: 0.6 });`, 'invented text')],
  ['invented timeline year', () => flags('o1_forest.js', `  page.diagram('timeline', { x: 100, y: 300, w: 600, events: [{ label: '1723' }, { label: 'today' }], at: 0.6 });`, 'invented text')],
  ['invented fact in a stack', () => flags('o5_desert.js', `  page.diagram('stack', { x: 600, y: 120, items: [{ label: '100 litres' }, { label: '40 days without water' }], at: 0.6 });`, 'invented text')],
  ['invented cutaway layer', () => flags('o2_ocean.js', `  page.diagram('cutaway', { x: 70, y: 150, w: 500, h: 350, layers: [{ label: 'sunlit', color: 'skyPencil', depth: 1 }, { label: 'ABYSSAL TRENCH', color: 'bic', depth: 2 }], at: 0.6 });`, 'invented text')],
  ['invented callout', () => flags('o5_desert.js', `  page.diagram('callout', { x: 420, y: 300, label: 'HUMP FUEL', from: [600, 486], at: 5 });`, 'invented text')],
  ['invented strip panel', () => flags('o4_village.js', `  page.strip({ y: 156, events: [{ label: 'WELL', note: 'one well' }, { label: 'GREAT FIRE', note: 'it burned' }], at: 0.4, pen: 'bic' });`, 'invented text')],
  ['generic pop-up intent', () => flags('o2_ocean.js', `  page.popup({ intent: 'the reveal', x: 330, y: 260, w: 420, depth: 200, at: 0.4, elements: [{ kind: 'flap', id: 'door', u: 200, v: 40, text: 'DEEP' }], pull: { at: 2, motions: [{ target: 'door', to: { open: 1 } }] } });`, 'generic pop-up intent')],
  ['generator art and no traces', () => slopSourceFindings(setupFor('o1_forest.js'), `export function build(ctx) { const page = ctx.kit.fx.sketchPage({}); page.draw('tree', { type: 'oak', x: 300, y: 470, h: 270 }); page.draw('beast', { type: 'deer', x: 500, y: 470, h: 90 }); page.write('OLD OAKS', { x: 1, y: 2 }); return { page }; }`, 's.js').some((entry) => entry.message.startsWith('too few human traces'))],
  ['trees on the same gap', () => flags('o1_forest.js', `  page.draw('tree', { type: 'pine', x: 500, y: 470, h: 140, at: 1 });\n  page.draw('tree', { type: 'pine', x: 560, y: 470, h: 140, at: 1.5 });\n  page.draw('tree', { type: 'pine', x: 620, y: 470, h: 140, at: 2 });\n  page.draw('tree', { type: 'pine', x: 680, y: 470, h: 140, at: 2.5 });`, 'stagger variance')],
  ['an invented quantity lettered on a bar chart', () => flags('o6_city.js', `  page.diagram('bars', { x: 140, y: 450, w: 420, h: 260, bars: [{ value: 30, label: '1950' }, { value: 87, label: 'today' }], values: true, at: 0.6 });`, 'invented text')],
]; // prettier-ignore

/**
 * Known blind spots: none. A bar chart with `values: true` letters its data, so those values are
 * judged as text (slop-sketchbook/diagram-numbers.ts); data only drawn as heights is not a claim
 * on screen and stays with the critic and the research notes.
 */
const KNOWN_MISSES: readonly string[] = [];

const missed = CASES.filter(([, caught]) => !caught()).map(([name]) => name);

describe('Sketchbook guards on planted fakes (detection)', () => {
  it('catches at least 90 % of the planted fakes', () => {
    expect(missed).toEqual(KNOWN_MISSES);
    expect((CASES.length - missed.length) / CASES.length).toBeGreaterThanOrEqual(0.9);
  });

  it('reads the line chart ends and the venn overlap only through the Sketchbook spec', () => {
    const source = `page.diagram('line', { from: 'DRY SEASON', to: 'MONSOON' }); page.diagram('venn', { both: 'MEGACITY' });`;
    const read = (spec: typeof SPEC | undefined) =>
      onScreenTexts(program(source), spec).map((entry) => entry.text);
    expect(read(undefined)).toEqual([]);
    expect(read(SPEC)).toEqual(['DRY SEASON', 'MONSOON', 'MEGACITY']);
  });
});

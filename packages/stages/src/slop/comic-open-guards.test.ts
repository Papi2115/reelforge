/**
 * Comic guards on the open vocabulary (PLAN.md#13.15 phase 2): films far from the showcase. The
 * false-positive side: the kit's six open examples (forest, ocean, station, village, desert,
 * city), each judged against its own narration and research notes, report nothing (text
 * provenance of captions, balloons, sound words, signs and chart labels; human traces; stagger;
 * breakthrough intents). The other side: planted fakes written with the open API (`page.art`,
 * `page.layout`, defined cast and props) on the same topics; at least 90 % must be caught.
 */
import { describe, expect, it } from 'vitest';
import { COMIC_OPEN_EXAMPLES, openComicSource } from '../testing/comic-open-fixtures.js';
import { slopSourceFindings, type AntiSlopSetup } from './guards.js';
import { countTraces, MIN_HUMAN_TRACES } from './source-guards.js';
import { onScreenTexts, parseScene } from './source-text.js';
import { inventedTexts } from './text-provenance.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const COMIC = worldSlopSpec('comic');
if (COMIC === undefined) throw new Error('no Comic spec');
const SPEC = COMIC;

function setupFor(file: string): AntiSlopSetup {
  const example = COMIC_OPEN_EXAMPLES.find((entry) => entry.file === file);
  if (example === undefined) throw new Error(`no open example ${file}`);
  const vocabulary = buildVocabulary([example.narration, example.research]);
  // Source guards only: the accent share is a frame check.
  return { vocabulary, spec: SPEC, accent: undefined };
}

/**
 * True findings on the examples (not false positives): o2 letters two authored traces (a margin
 * note, a thumbprint); the rest its header calls traces are animation (the line paying out, the
 * lure pulsing, the jellyfish flashing), which the guard rightly does not count as marks.
 */
const TRUE_FINDINGS: Readonly<Record<string, readonly string[]>> = {
  'o2_ocean.js': ['too few human traces'],
};

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

describe('Comic guards on the open examples (false positives)', () => {
  it('has the six open examples', () => {
    expect(COMIC_OPEN_EXAMPLES.map((entry) => entry.file)).toEqual([
      'o1_forest.js',
      'o2_ocean.js',
      'o3_station.js',
      'o4_village.js',
      'o5_desert.js',
      'o6_city.js',
    ]);
  });

  it('reads the open API lettering as on-screen text, never a description', () => {
    const texts = onScreenTexts(
      program(`export function build(ctx) {
  const page = ctx.kit.fx.comicPage({});
  page.art.defineProp('vane', { description: 'a weather vane on the barn', parts: [] });
  page.panel([0, 0, 9, 0, 9, 9, 0, 9]).draw((g) => {
    page.art.sign(g, { x: 1, y: 2, text: 'MARKET' });
    page.art.chart(g, { box: [0, 0, 9, 9], values: [3, 5], labels: ['GEESE', 'BREAD'] });
  });
  page.flashback({ intent: 'x', when: 'IN 1350...', beats: [{ at: 1, draw: (g) => g.rect(0, 0, 1, 1, 'ink'), caption: 'THE OLD FAIR.' }] });
  return { page };
}`),
      SPEC,
    );
    expect(texts.map((entry) => entry.text)).toEqual([
      'MARKET',
      'GEESE BREAD',
      'IN 1350...',
      'THE OLD FAIR.',
    ]);
  });

  it('accepts the sound words of the prompts and of real run Comic 1 in sfx', () => {
    const sounds = ['CLINK', 'TINK', 'LA LA LA', 'SKRRT', 'TOK TOK TOK', 'HSSSS', 'RATTLE'];
    const texts = sounds.map((text, line) => ({ text, line, role: 'sound' as const }));
    expect(inventedTexts(texts, setupFor('o1_forest.js').vocabulary, SPEC)).toEqual([]);
  });

  it.each(COMIC_OPEN_EXAMPLES.map((entry) => entry.file))(
    '%s: no invented text and only its true findings through the public source guard',
    (file) => {
      const source = openComicSource(file);
      const setup = setupFor(file);
      const invented = inventedTexts(onScreenTexts(program(source), SPEC), setup.vocabulary, SPEC);
      expect(invented.map((entry) => `${entry.text} (${entry.unknown.join(', ')})`)).toEqual([]);
      const expected = TRUE_FINDINGS[file] ?? [];
      const messages = slopSourceFindings(setup, source, file).map((entry) => entry.message);
      expect(messages).toHaveLength(expected.length);
      expected.forEach((start, i) => {
        expect(messages[i]).toMatch(new RegExp(`^${start}`));
      });
      if (expected.length === 0) {
        expect(countTraces(program(source), SPEC).total).toBeGreaterThanOrEqual(MIN_HUMAN_TRACES);
      }
    },
  );
});

/** A page with three traces and no lettering around `body` (the open API, a defined character). */
const forest = (body: string): string =>
  `export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 3, anchor: ctx.anchor });
  const { art } = page;
  art.defineCharacter('ranger', { gen: 'person', description: 'the park ranger', hat: 'brim' });
  const [walk, deer] = page.layout([{ at: 0, weight: 2, backdrop: 'forest' }, { at: 2.1, backdrop: 'meadow' }]);
  walk.draw((g, t) => art.draw(g, 'ranger', { x: 120, y: 300, size: 160, pose: 'walk', t }));
  page.thumbprint(600, 340);
  page.smudge(300, 200, { length: 8 });
  page.coffeeRing(520, 300, 22);
${body}
  return { page };
}
export function update(t, state) { state.page.update(t); }
`;

const flags = (file: string, source: string, reason: string): boolean =>
  slopSourceFindings(setupFor(file), source, 'scenes/s01.js').some((entry) =>
    entry.message.startsWith(reason),
  );
const forestFlags = (body: string, reason: string): boolean =>
  flags('o1_forest.js', forest(body), reason);

const CASES: readonly (readonly [string, () => boolean])[] = [
  ['invented sign', () => forestFlags(`  deer.draw((g) => art.sign(g, { x: 300, y: 300, text: 'RANGER HQ' }));`, 'invented text')],
  ['fake number on a depth sign', () => flags('o2_ocean.js', forest(`  deer.draw((g) => art.sign(g, { x: 300, y: 300, kind: 'board', text: '500 M' }));`), 'invented text')],
  ['invented chart labels', () => forestFlags(`  deer.draw((g) => art.chart(g, { box: [300, 60, 200, 120], values: [3, 5], labels: ['OAKS', 'BIRCHES'] }));`, 'invented text')],
  ['invented flashback beat caption', () => forestFlags(`  page.flashback({ intent: 'the ranger walks the old pine forest at first light', when: 'AT FIRST LIGHT...', beats: [{ at: 1, draw: (g) => g.rect(0, 0, 9, 9, 'paper'), caption: 'THE GREAT FIRE OF 1888.' }] });`, 'invented text')],
  ['invented line for the cast', () => forestFlags(`  page.balloon('ZORBLAX, GET THE AXE!', { x: 200, y: 60, at: 2, tail: [130, 160] });`, 'invented text')],
  ['a word that is no sound slammed as sfx', () => forestFlags(`  page.sfx('SYNERGY', { x: 400, y: 120, at: 3 });`, 'invented text')],
  ['invented caption on a far topic', () => flags('o5_desert.js', forest(`  page.caption('THE QUANTUM DUNES.', { x: 9, y: 9, at: 1 });`), 'invented text')],
  ['fake number in a caption', () => flags('o6_city.js', forest(`  page.caption('NINE MILLION PEOPLE.', { x: 9, y: 9, at: 1 });`), 'invented text')],
  ['generic flashback intent', () => forestFlags(`  page.flashback({ intent: 'the flashback', when: 'AT FIRST LIGHT...', beats: [] });`, 'generic flashback intent')],
  ['spread intent the narration never makes', () => forestFlags(`  page.spread({ intent: 'a dramatic journey through destiny and fate', art: (g) => art.backdrop(g, { preset: 'forest', box: [0, 0, 640, 360] }) });`, 'spread intent')],
  ['a page of generator art and no traces', () => flags('o1_forest.js', `export function build(ctx) { const page = ctx.kit.fx.comicPage({}); const [a] = page.layout([{ at: 0, backdrop: 'forest' }]); a.draw((g) => page.art.animal(g, { x: 300, y: 300, species: 'deer' })); page.caption('SOMETHING MOVES.', { x: 9, y: 9, at: 1 }); return { page }; }`, 'too few human traces')],
  ['captions on the same gap', () => forestFlags(`  page.caption('AT FIRST LIGHT...', { x: 1, y: 1, at: 1 });\n  page.caption('SOMETHING MOVES.', { x: 1, y: 2, at: 1.5 });\n  page.caption('A RED DEER', { x: 1, y: 3, at: 2 });\n  page.caption('THE RANGER', { x: 1, y: 4, at: 2.5 });`, 'stagger variance')],
  ['an invented quantity drawn as chart bars', () => forestFlags(`  deer.draw((g) => art.chart(g, { box: [300, 60, 200, 120], values: [87, 13], labels: ['PINE', 'FERNS'] }));`, 'invented text')],
]; // prettier-ignore

/**
 * Known blind spot: a chart's `values` are bar heights, not lettering, so a quantity nobody said
 * drawn as bars is not caught (real run Comic 1: the ~90 % "most likely" bar); the prompts ask for
 * values from the narration and the critic judges facts against the research notes.
 */
const KNOWN_MISSES = ['an invented quantity drawn as chart bars'];

const missed = CASES.filter(([, caught]) => !caught()).map(([name]) => name);
const caught = CASES.length - missed.length;

describe('Comic guards on planted fakes with the open vocabulary', () => {
  it('report nothing on the clean page the fakes are planted in', () => {
    expect(slopSourceFindings(setupFor('o1_forest.js'), forest(''), 'scenes/s01.js')).toEqual([]);
  });

  it(`catch ${String(caught)}/${String(CASES.length)} deliberately bad cases (target ≥ 90 %)`, () => {
    expect(caught / CASES.length).toBeGreaterThanOrEqual(0.9);
  });

  it('miss only the known blind spot today (regression guard)', () => {
    expect(missed).toEqual(KNOWN_MISSES);
  });
});

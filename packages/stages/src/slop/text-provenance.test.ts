import { describe, expect, it } from 'vitest';
import {
  SHOWCASE_NARRATION,
  SHOWCASE_RESEARCH,
  sketchbookExamples,
} from '../testing/slop-fixtures.js';
import { onScreenTexts, parseScene } from './source-text.js';
import { inventedTexts } from './text-provenance.js';
import { buildVocabulary, spelledNumbers, stem, tokenize } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const VOCABULARY = buildVocabulary([SHOWCASE_NARRATION, SHOWCASE_RESEARCH]);
const SKETCHBOOK = worldSlopSpec('sketchbook');

function texts(source: string) {
  const program = parseScene(source);
  if (program === undefined) throw new Error('does not parse');
  return onScreenTexts(program);
}

describe('vocabulary', () => {
  it('tokenizes numbers, ordinals, decades and fraction glyphs', () => {
    expect(
      tokenize('EVERY 4TH year, 1,257 days').map((token) => token.number ?? token.text),
    ).toEqual(['every', 4, 'year', 1257, 'days']);
    expect(tokenize('.24')[0]?.number).toBe(0.24);
    expect(tokenize('1500s')[0]?.range).toEqual([1500, 1600]);
    expect(tokenize('+¼ day').map((token) => token.text)).toEqual(['quarter', 'day']);
    expect(tokenize('Neural CORE').map((token) => token.shape)).toEqual(['capital', 'upper']);
  });

  it('reads English number words', () => {
    const numbers = (text: string): number[] => spelledNumbers(tokenize(text));
    expect(numbers('ten whole days, sixteen centuries')).toEqual([10, 16]);
    expect(numbers('three hundred and five')).toEqual([305]);
    expect(numbers('about 365 and a quarter days')).toEqual([365.25]);
    expect(numbers('twenty one thousand')).toEqual([21000]);
    expect(numbers('every fourth year')).toEqual([4]);
  });

  it('stems plurals and verb endings', () => {
    expect(['years', 'drifted', 'centuries', 'boxes'].map(stem)).toEqual([
      'year',
      'drift',
      'century',
      'box',
    ]);
  });
});

describe('on-screen texts', () => {
  it('reads text calls, text options and const strings, but not meta or computed text', () => {
    const source = `export const meta = { id: 's1', title: 'Not on screen' };
const LINE = 'from a const';
export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540] });
  page.write('hello', { x: 1, y: 2 });
  page.write(LINE, { x: 1, y: 2 });
  page.write(String(1582), { x: 1, y: 2 });
  ctx.text.title(\`templated\`);
  page.popup({ elements: [{ kind: 'tag', lines: ['spring', 'equinox'] }, { band: 'MARCH', text: '21' }] });
  return { page };
}`;
    expect(texts(source).map((entry) => entry.text)).toEqual([
      'hello',
      'from a const',
      'templated',
      'spring equinox',
      'MARCH',
      '21',
    ]);
  });

  it("reads a sheet's printed text and a strip's end word", () => {
    const source = `export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540] });
  page.sheet({ x: 1, y: 2, w: 300, h: 200 }).print('FILE 12', { u: 1, v: 2 });
  page.strip({ events: [{ label: '1518' }, { label: 'SEPTEMBER' }], end: 'now', at: 'By September' });
  return { page };
}`;
    expect(texts(source)).toEqual([
      { text: 'FILE 12', line: 3 },
      { text: '1518', line: 4 },
      { text: 'SEPTEMBER', line: 4 },
      { text: 'now', line: 4, role: 'timeline-end' },
    ]);
  });
});

describe('text provenance', () => {
  it('passes every on-screen string of the approved Sketchbook templates', () => {
    const flagged = [...sketchbookExamples()].flatMap(([name, source]) =>
      inventedTexts(texts(source), VOCABULARY, SKETCHBOOK).map((entry) => `${name}: ${entry.text}`),
    );
    expect(flagged).toEqual([]);
  });

  it('sources computed numbers through the numbers on screen', () => {
    const shown = (strings: string[]) =>
      inventedTexts(
        strings.map((text, line) => ({ text, line })),
        VOCABULARY,
        SKETCHBOOK,
      ).map((entry) => entry.text);
    expect(shown(['1 year = 365.2422 days', '0.2422 × 4 = 0.9688'])).toEqual([]);
    expect(shown(['0.2422 × 4 = 0.9688'])).toEqual(['0.2422 × 4 = 0.9688']);
    expect(shown(['1500s', '1300s'])).toEqual(['1300s']);
  });

  it('flags a timeline that ends "now" when the sources never reach the modern era', () => {
    const end = [{ text: 'now', line: 7, role: 'timeline-end' as const }];
    const medieval = buildVocabulary([
      'In July 1518 a woman began to dance. By September it ended.',
    ]);
    expect(inventedTexts(end, medieval, SKETCHBOOK).map((entry) => entry.unknown)).toEqual([
      ['now'],
    ]);
    expect(inventedTexts(end, VOCABULARY, SKETCHBOOK)).toEqual([]);
    expect(inventedTexts([{ text: 'now', line: 7 }], medieval, SKETCHBOOK)).toEqual([]);
  });

  it('flags invented names, mostly unknown strings and fake numbers, not one paraphrased word', () => {
    const flagged = inventedTexts(
      [
        { text: 'QUANTUM year', line: 1 },
        { text: 'the year of Neural Drift', line: 2 },
        { text: 'synergy matrix', line: 3 },
        { text: '87% of days', line: 4 },
        { text: 'equinox slipped', line: 5 },
        { text: 'p.12 → Feb 29', line: 6 },
      ],
      VOCABULARY,
      SKETCHBOOK,
    );
    expect(flagged.map((entry) => [entry.line, entry.unknown])).toEqual([
      [1, ['quantum']],
      [2, ['neural']],
      [3, ['synergy', 'matrix']],
      [4, ['87']],
    ]);
  });
});

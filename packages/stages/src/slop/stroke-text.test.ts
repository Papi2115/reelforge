import { describe, expect, it } from 'vitest';
import { sketchbookExamples } from '../testing/slop-fixtures.js';
import { parseScene } from './source-text.js';
import { strokeLettering } from './stroke-text.js';
import { inventedTexts } from './text-provenance.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

/** Real film 2, s09 (abridged): capitals drawn from a scene-local glyph table. */
const strokeScene = (
  word: string,
): string => `export const meta = { id: 's09', title: 'Not on screen' };
const arc = (a0, a1, n = 9) => [[0, 0], [1, 1]];
const GLYPHS = {
  "/": [[[0.1, 1], [0.7, 0]]],
  D: [[[0, 1], [0, 0], [0.95, 0.45], [0, 1]]],
  A: [[[0, 1], [0.5, 0], [1, 1]], [[0.22, 0.62], [0.8, 0.6]]],
  Y: [[[0, 0], [0.5, 0.5], [1, 0]]],
  O: [arc(-90, 275, 12)],
};
const STAMP = "${word}";
function letter(page, text, { x, y, at }) {
  let penAt = at;
  for (const ch of text) for (const g of GLYPHS[ch]) penAt = page.stroke(g, { at: penAt }).end;
  return { end: penAt };
}
export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540] });
  letter(page, "/ DAY", { x: 1, y: 2, at: 1, tool: 'bic' });
  letter(page, STAMP, { x: 1, y: 2, at: 2 });
  return { page };
}`;

function lettering(source: string) {
  const program = parseScene(source);
  if (program === undefined) throw new Error('does not parse');
  return strokeLettering(source, program);
}

describe('stroke lettering', () => {
  it('finds a glyph table and reads the strings passed to the scene helpers', () => {
    const found = lettering(strokeScene('NO RECORD'));
    expect(found.findings.map((entry) => [entry.rule, entry.line])).toEqual([
      ['glyph-table', 4],
      ['char-strokes', 13],
    ]);
    expect(found.texts.map((entry) => entry.text)).toEqual(['/ DAY', 'NO RECORD']);
  });

  it('catches a fake drawn from strokes and passes the sourced words', () => {
    const vocabulary = buildVocabulary([
      'Fifteen deaths a day is often claimed. No record backs it.',
    ]);
    const judge = (word: string) =>
      inventedTexts(
        lettering(strokeScene(word)).texts,
        vocabulary,
        worldSlopSpec('sketchbook'),
      ).map((entry) => entry.text);
    expect(judge('NO RECORD')).toEqual([]);
    expect(judge('ZORBLAX 4,321')).toEqual(['ZORBLAX 4,321']);
  });

  it('ignores scenes without a glyph table (coordinates, lowercase keys, the templates)', () => {
    const plain = `const P = { x: [1, 2], y: [3, 4], w: [5, 6], h: [7, 8] };
function mark(page, tool) { page.stroke([0, 0, 9, 9], { tool }); }
export function build(ctx) { mark(ctx.page, 'QUANTUM'); return {}; }`;
    expect(lettering(plain)).toEqual({ findings: [], texts: [] });
    const flagged = [...sketchbookExamples()].filter(
      ([, source]) => lettering(source).findings.length > 0,
    );
    expect(flagged.map(([name]) => name)).toEqual([]);
  });
});

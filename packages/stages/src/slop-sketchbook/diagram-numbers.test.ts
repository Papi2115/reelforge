/**
 * A Sketchbook bar chart with `values: true` writes its data on the page: the values are judged
 * like any written number (real run Sketchbook 3 #6).
 */
import { describe, expect, it } from 'vitest';
import { onScreenTexts, parseScene } from '../slop/source-text.js';
import { inventedTexts } from '../slop/text-provenance.js';
import { buildVocabulary } from '../slop/vocabulary.js';
import { worldSlopSpec } from '../slop/world-labels.js';
import { diagramNumberTexts } from './index.js';

const SKETCHBOOK = worldSlopSpec('sketchbook');
const VOCABULARY = buildVocabulary(['In 1950 about 30 boats fished here; today 55 do.']);

function chart(values: string, bars: string) {
  const parsed = parseScene(`export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540] });
  page.diagram('bars', { x: 140, y: 450, w: 420, h: 260, bars: [${bars}]${values}, at: 0.6 });
  return { page };
}`);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

describe('diagram data on screen', () => {
  it('reads the values a bar chart writes, only with values: true', () => {
    const bars = "{ value: 30, label: '1950' }, { value: 55, label: 'today' }";
    expect(diagramNumberTexts(chart(', values: true', bars))).toEqual([
      { text: '30', line: 3 },
      { text: '55', line: 3 },
    ]);
    expect(diagramNumberTexts(chart('', bars))).toEqual([]);
  });

  it('flags an invented bar value, passes sourced ones', () => {
    const invented = (bars: string): string[] =>
      inventedTexts(
        onScreenTexts(chart(', values: true', bars), SKETCHBOOK),
        VOCABULARY,
        SKETCHBOOK,
      ).map((entry) => entry.text);
    expect(invented("{ value: 30, label: '1950' }, { value: 55, label: 'today' }")).toEqual([]);
    expect(invented("{ value: 30, label: '1950' }, { value: 48, label: 'today' }")).toEqual(['48']);
  });
});
